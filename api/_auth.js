// Xác thực phía server. File bắt đầu bằng "_" nên Vercel KHÔNG coi là một API route.
// APP_PASS / APP_KEY chỉ nằm trong biến môi trường của server. Đăng nhập đúng -> cookie HttpOnly có chữ ký HMAC.
// Cookie: <iat_ms>.<exp_s>.<chữ ký>. Hạn trượt: còn dưới nửa thời hạn mà vẫn có yêu cầu hợp lệ thì cấp lại cookie đủ hạn.
//  "Đăng xuất tất cả" = ghi mốc thời gian vào Redis (stc:revoked); cookie cấp trước mốc đó bị loại.
const crypto = require('crypto');
const env = k => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();   // bỏ dấu nháy / khoảng trắng thừa
const APP_PASS = env('APP_PASS'), APP_KEY = env('APP_KEY');
const HOURS = Number(env('APP_TTL_HOURS')) > 0 ? Number(env('APP_TTL_HOURS')) : 48;   // dùng env() để bỏ dấu nháy như build.js
const NAME = 'stc_auth', REV = 'stc:revoked';
const RU = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const sig = p => crypto.createHmac('sha256', hash('stc-auth|' + APP_KEY + '|' + APP_PASS)).update(p).digest('base64url');   // đổi PASS hoặc KEY => mọi cookie cũ mất hiệu lực
const eq = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const secretOk = s => !!s && ((APP_PASS && eq(s, APP_PASS)) || (APP_KEY && eq(s, APP_KEY)));   // mật khẩu hoặc KEY (liên kết nhanh)

const FLAGS = '; Path=/api; HttpOnly; Secure; SameSite=Strict';
const clear = () => NAME + '=' + FLAGS + '; Max-Age=0';
function cookie() {
  const iat = Date.now(), p = iat + '.' + (Math.floor(iat / 1000) + HOURS * 3600);
  return NAME + '=' + p + '.' + sig(p) + FLAGS + '; Max-Age=' + HOURS * 3600;
}

const redis = async cmd => {
  const r = await fetch(RU + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + RT, 'Content-Type': 'application/json' }, body: JSON.stringify([cmd]) });
  const j = await r.json();
  if (!Array.isArray(j) || !j[0] || j[0].error) throw new Error('redis');
  return j[0].result;
};
let rc = { v: 0, t: 0 };   // cache mốc đăng xuất 5 giây, đỡ gọi Redis ở mọi request
async function revokedAt() {
  if (!RU || !RT) return 0;
  if (Date.now() - rc.t > 5000) {
    try { rc = { v: +(await redis(['GET', REV])) || 0, t: Date.now() }; }
    catch (e) { rc.t = Date.now(); }   // Redis lỗi: giữ giá trị cũ, không khóa nhầm mọi người
  }
  return rc.v;
}
async function revokeAll() {
  if (!RU || !RT) return false;
  const t = Date.now();
  try { await redis(['SET', REV, String(t)]); rc = { v: t, t }; return true; } catch (e) { return false; }
}

async function ok(req, res) {   // truyền res để tự gia hạn cookie khi đang dùng
  if (!APP_PASS || !APP_KEY) return false;   // thiếu cấu hình thì không ai hợp lệ
  const c = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith(NAME + '='));
  const a = c ? c.slice(NAME.length + 1).split('.') : [];
  if (a.length !== 3) return false;
  const p = a[0] + '.' + a[1];
  const good = eq(a[2], sig(p)) && +a[1] > Date.now() / 1000 && +a[0] >= await revokedAt();
  if (good && res && +a[1] - Date.now() / 1000 < HOURS * 1800) res.setHeader('Set-Cookie', cookie());   // còn dưới 1/2 hạn: gia hạn
  return good;
}
// IP thật của client. Trên Vercel, x-vercel-forwarded-for / x-real-ip do nền tảng đặt, client không giả được;
// x-forwarded-for phần đầu thì client tự thêm được nên chỉ dùng làm phương án cuối.
const clientIp = req => String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();

// ---- Lịch sử đăng nhập (Redis). Thành công: stc:lh (50 mục). Thất bại: stc:lhf (20 mục, riêng để kẻ đoán mò không đẩy mất lịch sử thật). ----
const LH = 'stc:lh', LHF = 'stc:lhf';
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
const parseList = a => (a || []).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
async function logLogin(req, method, good) {   // không bao giờ ném lỗi, không làm hỏng đăng nhập nếu Redis lỗi
  if (!RU || !RT) return;
  const key = good ? LH : LHF, max = good ? 50 : 20, now = Date.now(), ip = clientIp(req), d = devName(req);
  try {
    let alert = null;
    if (good) {
      const prev = parseList(await redis(['LRANGE', LH, '0', '-1']));
      // Có lịch sử mà chưa từng thấy đúng cặp (IP + trình duyệt) này => báo. Chưa có lịch sử (mới bật tính năng) thì không báo.
      if (prev.length && !prev.some(p => p.ip === ip && p.d === d)) {
        const known = prev.some(p => p.d === d);
        alert = { silent: known, text: (known ? 'ℹ️ Đăng nhập từ IP mới' : '🚨 Đăng nhập từ thiết bị MỚI') + ' — Sổ Thu Chi\n' + d + '\nIP: ' + ip + '\nCách: ' + method + '\n🕒 ' + vnTime(now) + '\nKhông phải bạn? Vào Cài đặt → Đăng nhập và thiết bị → Thu hồi, rồi đổi mật khẩu.' };
      }
    }
    await redis(['LPUSH', key, JSON.stringify({ t: now, ip, d, m: method, ok: good ? 1 : 0 })]);
    await redis(['LTRIM', key, '0', String(max - 1)]);
    if (!good) {   // sai mật khẩu liên tiếp từ cùng một IP trong 15 phút: báo ở lần thứ 3 và lần thứ 5 (lần 5 là bị khóa)
      const n = parseList(await redis(['LRANGE', LHF, '0', '-1'])).filter(p => p.ip === ip && now - p.t < 900000).length;
      if (n === 3 || n === 5) alert = { silent: false, text: '⚠️ Sai mật khẩu ' + n + ' lần liên tiếp — Sổ Thu Chi\nIP: ' + ip + '\n' + d + (n >= 5 ? '\nIP này đã bị khóa 15 phút.' : '') + '\n🕒 ' + vnTime(now) };
    }
    if (alert) await tgAlert(alert.text, alert.silent);
  } catch (e) { }
}
async function loginList() {   // null = chưa có Redis
  if (!RU || !RT) return null;
  const rows = [];
  for (const k of [LH, LHF]) {
    const a = await redis(['LRANGE', k, '0', '-1']);
    (a || []).forEach(s => { try { rows.push(JSON.parse(s)); } catch (e) { } });
  }
  return rows.sort((x, y) => y.t - x.t).slice(0, 60);
}
async function clearLogins() {
  if (!RU || !RT) return false;
  try { await redis(['DEL', LH, LHF]); return true; } catch (e) { return false; }
}
module.exports = { env, ok, secretOk, cookie, clear, revokeAll, revokedAt, clientIp, devName, logLogin, loginList, clearLogins };
