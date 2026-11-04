// Xác thực phía server. File bắt đầu bằng "_" nên Vercel KHÔNG coi là một API route.
// Mật khẩu (APP_PASS) và KEY (APP_KEY) chỉ nằm trong biến môi trường của server, không bao giờ gửi xuống trình duyệt.
// Đăng nhập đúng -> server cấp cookie HttpOnly có chữ ký HMAC (JS trên trang không đọc được; service worker tự gửi kèm).
const crypto = require('crypto');
const { APP_PASS = '', APP_KEY = '' } = process.env;
const HOURS = Number(process.env.APP_TTL_HOURS) > 0 ? Number(process.env.APP_TTL_HOURS) : 168;
const NAME = 'stc_auth';

const hmacKey = () => crypto.createHash('sha256').update('stc-auth|' + APP_KEY + '|' + APP_PASS).digest();   // đổi PASS hoặc KEY => mọi cookie cũ mất hiệu lực
const sig = p => crypto.createHmac('sha256', hmacKey()).update(p).digest('base64url');
const eq = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

// Mật khẩu đúng, hoặc KEY (dùng cho liên kết đăng nhập nhanh ?key=...)
const secretOk = s => !!s && ((APP_PASS && eq(s, APP_PASS)) || (APP_KEY && eq(s, APP_KEY)));

function cookie() {
  const exp = String(Math.floor(Date.now() / 1000) + HOURS * 3600);
  return NAME + '=' + exp + '.' + sig(exp) + '; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=' + HOURS * 3600;
}
function ok(req) {
  const c = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith(NAME + '='));
  if (!c) return false;
  const t = c.slice(NAME.length + 1), i = t.indexOf('.');
  if (i < 1) return false;
  const p = t.slice(0, i);
  return eq(t.slice(i + 1), sig(p)) && +p > Date.now() / 1000;
}
module.exports = { ok, secretOk, cookie };
