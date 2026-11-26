// Xác thực phía server. File bắt đầu bằng "_" nên Vercel KHÔNG coi là một API route.
// APP_PASS / APP_KEY chỉ nằm trong biến môi trường của server. Đăng nhập đúng -> cookie HttpOnly có chữ ký HMAC.
// Cookie: <iat_ms>.<exp_s>.<tid>.<chữ ký>. tid = '-' (thiết bị KHÔNG tin cậy, mặc định) hoặc mã thiết bị tin cậy (có mục DEV_<tid> trong Google Sheet).
//  Không tin cậy: hết hạn cố định 12 giờ sau khi đăng nhập, không gia hạn.
//  Tin cậy: hạn trượt, mỗi lần dùng gia hạn thêm 24 giờ (hết hạn nếu 24 giờ không mở), tối đa 30 ngày kể từ lúc đăng nhập. Bỏ thiết bị khỏi danh sách = cookie đó mất hiệu lực (trong ~10 giây).
//  "Đăng xuất tất cả" = ghi mốc thời gian vào Apps Script (REVOKED); cookie cấp trước mốc đó bị loại.
const crypto = require('crypto');
const env = k => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();   // bỏ dấu nháy / khoảng trắng thừa
const APP_PASS = env('APP_PASS'), APP_KEY = env('APP_KEY'), APP_API = env('APP_API');
const num = (k, d) => Number(env(k)) > 0 ? Number(env(k)) : d;
const UNT_H = num('APP_TTL_UNTRUSTED_H', 12), IDLE_H = num('APP_TTL_TRUSTED_H', 24), MAX_D = num('APP_TRUST_MAX_DAYS', 30);
const FAIL_MAX = 5, FAIL_WIN = 900 * 1000;   // sai mật khẩu liên tiếp từ một IP: khóa 15 phút (đếm ở Google Sheet nên không bị reset khi Vercel khởi động lại)
const TID_RE = /^[\w-]{8,32}$/;
const NAME = 'stc_auth';

const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const sig = p => crypto.createHmac('sha256', hash('stc-auth|' + APP_KEY + '|' + APP_PASS)).update(p).digest('base64url');   // đổi PASS hoặc KEY => mọi cookie cũ mất hiệu lực
const eq = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const secretOk = s => !!s && !!APP_PASS && eq(s, APP_PASS);   // chỉ mật khẩu APP_PASS; APP_KEY chỉ dùng nội bộ (ký cookie, gọi Apps Script), không đăng nhập được

const FLAGS = '; Path=/api; HttpOnly; Secure; SameSite=Strict';
const clear = () => NAME + '=' + FLAGS + '; Max-Age=0';
function cookie(tid, iat) {
  const now = Date.now(); iat = +iat || now; tid = TID_RE.test(String(tid || '')) ? tid : '-';
  const exp = tid === '-' ? Math.floor(iat / 1000) + UNT_H * 3600 : Math.min(Math.floor(now / 1000) + IDLE_H * 3600, Math.floor(iat / 1000) + MAX_D * 86400);
  const p = iat + '.' + exp + '.' + tid;
  return NAME + '=' + p + '.' + sig(p) + FLAGS + '; Max-Age=' + Math.max(0, exp - Math.floor(now / 1000));
}

// ---- Kho dữ liệu: Apps Script (Kv.gs). Không dùng Redis. ----
// Trả về { ok, ... }. Apps Script cũ (chưa có Kv.gs) không trả kv:1 nên coi là lỗi, không làm hỏng đăng nhập.
async function kv(op, extra, ms) {
  if (!APP_API || !APP_KEY) return { ok: false, err: 'Chưa cấu hình APP_API / APP_KEY' };
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 12000);
  try {
    const r = await fetch(APP_API, { method: 'POST', signal: ac.signal, body: JSON.stringify({ key: APP_KEY, kv: Object.assign({ op }, extra || {}) }) });
    const j = JSON.parse(await r.text());
    if (!j || !j.kv) return { ok: false, err: 'Apps Script chưa có Kv.gs hoặc chưa Deploy phiên bản mới' };
    return j;
  } catch (e) { return { ok: false, err: e && e.name === 'AbortError' ? 'Google Sheet phản hồi quá chậm' : 'Không kết nối được Google Sheet' }; }
  finally { clearTimeout(tm); }
}

// Trạng thái xác thực lấy từ Apps Script: mốc "đăng xuất tất cả" (REVOKED) + danh sách thiết bị tin cậy. Cache 10 giây trong bộ nhớ instance.
// Lỗi / Apps Script cũ chưa có auth.state: giữ giá trị cũ, thử lại sau ~1 phút; chưa từng đọc được thì d = null (chấp nhận cookie tin cậy đã có chữ ký, không khóa nhầm mọi người).
let rc = { v: 0, d: null, t: 0 }, pend = null;
async function state() {
  if (Date.now() - rc.t > 10000) {
    pend = pend || kv('auth.state', null, 6000).then(j => {
      rc = j.ok ? { v: +j.t || 0, d: new Set((j.d || []).map(x => x.id)), t: Date.now() } : { v: rc.v, d: rc.d, t: Date.now() + 50000 };
    }).finally(() => { pend = null; });
    await pend;
  }
  return rc;
}
const revokedAt = async () => (await state()).v;
async function revokeAll() {
  const t = Date.now(), j = await kv('rev.set', { t });
  if (!j.ok) return false;
  rc = { v: t, d: rc.d, t: Date.now() }; return true;
}

// Trả về { iat, exp, tid } nếu cookie hợp lệ, ngược lại null. Truyền res để tự gia hạn cookie của thiết bị tin cậy.
async function session(req, res) {
  if (!APP_PASS || !APP_KEY) return null;   // thiếu cấu hình thì không ai hợp lệ
  const c = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith(NAME + '='));
  const a = c ? c.slice(NAME.length + 1).split('.') : [];
  let iat, exp, tid, sg, p;
  if (a.length === 4) { iat = a[0]; exp = a[1]; tid = a[2]; sg = a[3]; p = iat + '.' + exp + '.' + tid; }
  else if (a.length === 3) { iat = a[0]; exp = a[1]; tid = '-'; sg = a[2]; p = iat + '.' + exp; }   // cookie cũ (trước khi có thiết bị tin cậy): coi là không tin cậy
  else return null;
  if (!eq(sg, sig(p))) return null;
  iat = +iat; exp = +exp;
  const now = Date.now();
  if (!(exp > now / 1000)) return null;
  const st = await state();
  if (!(iat >= st.v)) return null;
  if (tid === '-') return iat + UNT_H * 3600e3 > now ? { iat, exp, tid } : null;
  if (!TID_RE.test(tid) || iat + MAX_D * 86400e3 <= now) return null;
  if (st.d && !st.d.has(tid)) return null;   // thiết bị đã bị bỏ khỏi danh sách tin cậy
  if (res && exp - now / 1000 < IDLE_H * 1800) {   // còn dưới nửa hạn: gia hạn thêm 24 giờ (không vượt trần 30 ngày) và ghi "dùng lần cuối"
    res.setHeader('Set-Cookie', cookie(tid, iat));
    await kv('dev.touch', { id: tid, ip: clientIp(req), d: devName(req) }, 4000);
  }
  return { iat, exp, tid };
}
const ok = async (req, res) => !!(await session(req, res));

// ---- Thiết bị tin cậy (lưu ở Apps Script: DEV_<id>) ----
const deviceTrusted = async did => { did = String(did || ''); if (!TID_RE.test(did)) return false; const d = (await state()).d; return !!(d && d.has(did)); };
async function devAdd(req) {   // { ok, id } hoặc { ok:false, err }
  const id = crypto.randomBytes(12).toString('base64url'), now = Date.now();
  const j = await kv('dev.add', { rec: { id, n: devName(req), t: now, l: now, ip: clientIp(req) } });
  if (!j.ok) return { ok: false, err: j.err };
  rc = { v: rc.v, d: new Set([...(rc.d || []), id]), t: Date.now() };
  return { ok: true, id };
}
async function devList() { const j = await kv('dev.list'); return j.ok ? (j.list || []) : null; }
async function devDel(id) { const j = await kv('dev.del', { id: String(id || '') }); if (j.ok && rc.d) { const d = new Set(rc.d); d.delete(id); rc = { v: rc.v, d, t: Date.now() }; } return !!j.ok; }
async function devKeep(id) { const j = await kv('dev.keep', { id: String(id || '-') }); if (j.ok) rc = { v: rc.v, d: new Set(TID_RE.test(String(id)) && rc.d && rc.d.has(id) ? [id] : []), t: Date.now() }; return !!j.ok; }
// IP thật của client. Trên Vercel, x-vercel-forwarded-for / x-real-ip do nền tảng đặt, client không giả được;
// x-forwarded-for phần đầu thì client tự thêm được nên chỉ dùng làm phương án cuối.
const clientIp = req => String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();

// ---- Lịch sử đăng nhập (lưu ở Apps Script: 40 lần thành công + 15 lần sai mật khẩu, tách riêng để kẻ đoán mò không đẩy mất lịch sử thật) ----
function devName(req) {
  const u = String(req.headers['user-agent'] || '');
  const os = /Windows/.test(u) ? 'Windows' : /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : '';
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /CriOS|Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Trình duyệt';
  return br + (os ? ' · ' + os : '');
}
// Báo Telegram thẳng từ server (telegram.js cần cookie đăng nhập nên không dùng được ở đây). Tắt: đặt ALERT_LOGIN=0 trên Vercel.
async function tgAlert(text, silent) {
  const T = env('TG_TOKEN'), C = env('TG_CHAT_ID');
  if (!T || !C || env('ALERT_LOGIN') === '0') return;
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 5000);
  try {
    await fetch('https://api.telegram.org/bot' + T + '/sendMessage', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: C, text, disable_notification: !!silent }) });
  } catch (e) { } finally { clearTimeout(tm); }
}
const vnTime = t => new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
async function logLogin(req, method, good, lock) {   // không bao giờ ném lỗi, không làm hỏng đăng nhập nếu Apps Script lỗi. Trả { locked, wait } khi IP đang bị khóa, hoặc { n } = số lần sai còn hiệu lực. lock=true: áp giới hạn sai mật khẩu theo Google Sheet
  const now = Date.now(), ip = clientIp(req), d = devName(req);
  try {
    const j = await kv('log.add', { good: !!good, lim: lock ? FAIL_MAX : 0, win: FAIL_WIN, rec: { t: now, ip, d, m: method, ok: good ? 1 : 0 } });
    if (!j.ok) return {};
    if (j.locked) {
      await tgAlert('🚨 Nhập ĐÚNG mật khẩu nhưng IP đang bị khóa — Sổ Thu Chi\nIP: ' + ip + '\n' + d + '\n🕒 ' + vnTime(now) + '\nCó thể kẻ lạ đã đoán được mật khẩu: nên đổi APP_PASS.', false);
      return { locked: true, wait: j.wait || 900 };
    }
    let alert = null;
    if (good) {
      // Có lịch sử mà chưa từng thấy đúng cặp (IP + trình duyệt) này => báo. Chưa có lịch sử (mới bật tính năng) thì không báo.
      const prev = j.prev || [];
      if (prev.length && !prev.some(p => p.ip === ip && p.d === d)) {
        const known = prev.some(p => p.d === d);
        alert = { silent: known, text: (known ? 'ℹ️ Đăng nhập từ IP mới' : '🚨 Đăng nhập từ thiết bị MỚI') + ' — Sổ Thu Chi\n' + d + '\nIP: ' + ip + '\nCách: ' + method + '\n🕒 ' + vnTime(now) + '\nKhông phải bạn? Vào Cài đặt → Đăng nhập và thiết bị → Thu hồi, rồi đổi mật khẩu.' };
      }
    } else {   // sai mật khẩu liên tiếp từ cùng một IP trong 15 phút: báo ở lần thứ 3 và lần thứ 5 (lần 5 là bị khóa)
      const n = j.n || 0;
      if (n === 3 || n === 5) alert = { silent: false, text: '⚠️ Sai mật khẩu ' + n + ' lần liên tiếp — Sổ Thu Chi\nIP: ' + ip + '\n' + d + (n >= 5 ? '\nIP này đã bị khóa 15 phút.' : '') + '\n🕒 ' + vnTime(now) };
    }
    if (alert) await tgAlert(alert.text, alert.silent);
    return { n: j.n || 0 };
  } catch (e) { return {}; }
}
async function loginList() {   // null = không đọc được từ Apps Script
  const j = await kv('log.list');
  if (!j.ok) return null;
  return (j.list || []).concat(j.fails || []).sort((x, y) => y.t - x.t).slice(0, 60);
}
async function clearLogins() { return !!(await kv('log.clear')).ok; }
module.exports = { env, kv, ok, session, secretOk, cookie, clear, revokeAll, revokedAt, clientIp, devName, logLogin, loginList, clearLogins, deviceTrusted, devAdd, devList, devDel, devKeep, FAIL_MAX, FAIL_WIN };