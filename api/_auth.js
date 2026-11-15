// Xác thực phía server. File bắt đầu bằng "_" nên Vercel KHÔNG coi là một API route.
// APP_PASS / APP_KEY chỉ nằm trong biến môi trường của server. Đăng nhập đúng -> cookie HttpOnly có chữ ký HMAC.
// Cookie: <iat_ms>.<exp_s>.<chữ ký>. Hạn trượt: còn dưới nửa thời hạn mà vẫn có yêu cầu hợp lệ thì cấp lại cookie đủ hạn.
//  "Đăng xuất tất cả" = ghi mốc thời gian vào Redis (stc:revoked); cookie cấp trước mốc đó bị loại.
const crypto = require('crypto');
const env = k => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();   // bỏ dấu nháy / khoảng trắng thừa
const APP_PASS = env('APP_PASS'), APP_KEY = env('APP_KEY');
const HOURS = Number(process.env.APP_TTL_HOURS) > 0 ? Number(process.env.APP_TTL_HOURS) : 48;
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
module.exports = { env, ok, secretOk, cookie, clear, revokeAll, clientIp };
