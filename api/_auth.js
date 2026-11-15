// Xác thực phía server. File bắt đầu bằng "_" nên Vercel KHÔNG coi là một API route.
// APP_PASS / APP_KEY chỉ nằm trong biến môi trường của server.
// Cookie HttpOnly: <did>.<iat_ms>.<exp_s>.<chữ ký HMAC>. did = mã thiết bị (24 hex).
// Mỗi lần đăng nhập (mật khẩu hoặc passkey) tạo một thiết bị trong Redis (hash stc:dev). Cookie chỉ hợp lệ khi thiết bị còn trong danh sách,
// nên "đăng xuất một máy" / "đăng xuất các máy khác" = xóa thiết bị khỏi hash. Hạn trượt: còn dưới nửa thời hạn thì cấp lại cookie.
// Không có Redis: chỉ kiểm chữ ký + hạn (không có danh sách thiết bị, không có passkey).
const crypto = require('crypto');
const env = k => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();   // bỏ dấu nháy / khoảng trắng thừa
const APP_PASS = env('APP_PASS'), APP_KEY = env('APP_KEY');
const HOURS = Number(process.env.APP_TTL_HOURS) > 0 ? Number(process.env.APP_TTL_HOURS) : 48;
const NAME = 'stc_auth', DEV = 'stc:dev', LOG = 'stc:log', MAX_DEV = 30;
const RU = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const hasRedis = !!(RU && RT);

const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const sig = p => crypto.createHmac('sha256', hash('stc-auth|' + APP_KEY + '|' + APP_PASS)).update(p).digest('base64url');   // đổi PASS hoặc KEY => mọi cookie cũ mất hiệu lực
const eq = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const secretOk = s => !!s && ((APP_PASS && eq(s, APP_PASS)) || (APP_KEY && eq(s, APP_KEY)));   // mật khẩu hoặc KEY (liên kết nhanh)

const FLAGS = '; Path=/api; HttpOnly; Secure; SameSite=Strict';
const clear = () => NAME + '=' + FLAGS + '; Max-Age=0';
const newDid = () => crypto.randomBytes(12).toString('hex');
function mint(did) {
  const iat = Date.now(), p = did + '.' + iat + '.' + (Math.floor(iat / 1000) + HOURS * 3600);
  return NAME + '=' + p + '.' + sig(p) + FLAGS + '; Max-Age=' + HOURS * 3600;
}

// Một lệnh Redis -> trả về MẢNG kết quả [kq] (nhiều lệnh: redis(['A'], ['B']) -> [kq1, kq2]).
const redis = async (...cmds) => {
  const r = await fetch(RU + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + RT, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json();
  if (!Array.isArray(j) || j.some(x => !x || x.error)) throw new Error('redis');
  return j.map(x => x.result);
};
const pairs = r => {   // kết quả HGETALL (mảng phẳng hoặc object) -> object
  if (!r) return {};
  if (Array.isArray(r)) { const o = {}; for (let i = 0; i + 1 < r.length; i += 2) o[r[i]] = r[i + 1]; return o; }
  return typeof r === 'object' ? r : {};
};
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

const ip = req => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();
function uaName(req) {
  const u = String(req.headers['user-agent'] || '');
  const os = /Windows/.test(u) ? 'Windows' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : '';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /CriOS|Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Trình duyệt';
  return br + (os ? ' · ' + os : '');
}

// ---- nhật ký ----
async function log(req, o) {
  if (!hasRedis) return;
  try { await redis(['LPUSH', LOG, JSON.stringify(Object.assign({ t: Date.now(), ip: ip(req), d: uaName(req) }, o))], ['LTRIM', LOG, '0', '199']); } catch (e) { }
}
async function logs(n) {
  if (!hasRedis) return [];
  try { const [a] = await redis(['LRANGE', LOG, '0', String(Math.max(1, n) - 1)]); return (a || []).map(parse).filter(Boolean); } catch (e) { return []; }
}

// ---- thiết bị ----
const dc = new Map();   // cache 5 giây: did -> { v, t }
async function aliveDev(did) {
  const c = dc.get(did);
  if (c && Date.now() - c.t < 5000) return c.v;
  let v;
  try {
    const [raw] = await redis(['HGET', DEV, did]);
    v = !!raw;
    const o = raw && parse(raw);
    if (o && Date.now() - (o.l || 0) > 600000) { o.l = Date.now(); await redis(['HSET', DEV, did, JSON.stringify(o)]); }   // ghi "dùng lần cuối" tối đa 10 phút/lần
  } catch (e) { v = c ? c.v : true; }   // Redis lỗi: giữ kết quả cũ, không khóa nhầm mọi người
  dc.set(did, { v, t: Date.now() });
  if (dc.size > 200) dc.clear();
  return v;
}
async function ok(req, res) {   // truyền res để tự gia hạn cookie khi đang dùng; thành công thì gán req.did
  if (!APP_PASS || !APP_KEY) return false;   // thiếu cấu hình thì không ai hợp lệ
  const c = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith(NAME + '='));
  const a = c ? c.slice(NAME.length + 1).split('.') : [];
  if (a.length !== 4 || !/^[a-f0-9]{24}$/.test(a[0])) return false;
  const p = a[0] + '.' + a[1] + '.' + a[2];
  if (!(eq(a[3], sig(p)) && +a[2] > Date.now() / 1000)) return false;
  if (hasRedis && !(await aliveDev(a[0]))) return false;   // thiết bị đã bị đăng xuất
  req.did = a[0];
  if (res && +a[2] - Date.now() / 1000 < HOURS * 1800) res.setHeader('Set-Cookie', mint(a[0]));   // còn dưới 1/2 hạn: gia hạn
  return true;
}
async function prune() {   // bỏ thiết bị quá hạn; còn quá nhiều thì bỏ máy lâu không dùng nhất
  const [h] = await redis(['HGETALL', DEV]), P = pairs(h), now = Date.now(), maxAge = HOURS * 3600000 + 3600000, live = [], dead = [];
  Object.keys(P).forEach(id => { const o = parse(P[id]); if (!o || now - (o.l || o.t || 0) > maxAge) dead.push(id); else live.push([id, o.l || o.t || 0]); });
  live.sort((a, b) => b[1] - a[1]).slice(MAX_DEV).forEach(x => dead.push(x[0]));
  if (dead.length) { await redis(['HDEL', DEV].concat(dead)); dead.forEach(id => dc.delete(id)); }
}
async function login(req, res, method) {   // tạo thiết bị mới + cookie. Không bao giờ throw
  const did = newDid();
  if (hasRedis) {
    try {
      const now = Date.now(), [n] = await redis(['HSET', DEV, did, JSON.stringify({ n: uaName(req), ip: ip(req), m: method, t: now, l: now })], ['HLEN', DEV]).then(r => [r[1]]);
      if (+n > MAX_DEV) await prune();
    } catch (e) { }
  }
  res.setHeader('Set-Cookie', mint(did));
  req.did = did;
  await log(req, { e: 'login', ok: true, m: method });
  return did;
}
async function list() {
  const [h] = await redis(['HGETALL', DEV]), P = pairs(h), now = Date.now(), maxAge = HOURS * 3600000 + 3600000, out = [], stale = [];
  Object.keys(P).forEach(id => {
    const o = parse(P[id]);
    if (!o || now - (o.l || o.t || 0) > maxAge) return stale.push(id);
    out.push({ id, n: o.n, ip: o.ip, m: o.m, t: o.t, l: o.l });
  });
  if (stale.length) await redis(['HDEL', DEV].concat(stale));
  out.sort((a, b) => (b.l || 0) - (a.l || 0));
  return { out };
}
async function drop(id) { await redis(['HDEL', DEV, id]); dc.delete(id); }
async function dropOthers(did) {
  const [ids] = await redis(['HKEYS', DEV]), other = (ids || []).filter(x => x !== did);
  if (other.length) await redis(['HDEL', DEV].concat(other));
  dc.clear();
  return other.length;
}
async function dropSelf(req) {   // khóa sổ: bỏ thiết bị của cookie hiện tại (chỉ khi chữ ký đúng)
  if (!hasRedis) return;
  const c = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith(NAME + '=')), a = c ? c.slice(NAME.length + 1).split('.') : [];
  if (a.length === 4 && /^[a-f0-9]{24}$/.test(a[0]) && eq(a[3], sig(a[0] + '.' + a[1] + '.' + a[2]))) await drop(a[0]);
}
module.exports = { env, ok, secretOk, mint, clear, hasRedis, redis, pairs, ip, uaName, log, logs, login, list, drop, dropOthers, dropSelf };
