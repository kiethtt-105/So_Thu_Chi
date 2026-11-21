// Đăng nhập bằng mật khẩu: giới hạn thử sai theo IP (trong bộ nhớ instance; chỉ làm chậm kẻ đoán mò, không bền giữa các lần khởi động).
// Thành công => cookie HttpOnly (auth.cookie()). Sai/đúng đều ghi lịch sử và báo Telegram qua auth.logLogin.
const auth = require('./_auth');

const FAIL_MAX = 5, FAIL_WIN = 900 * 1000;
const memFail = new Map();
async function doLogin(req, res, body) {
  const ip = auth.clientIp(req), now = Date.now();
  for (const [k, v] of memFail) if (v.exp < now) memFail.delete(k);
  const m = memFail.get(ip);
  if (m && m.n >= FAIL_MAX) return res.status(429).json({ ok: false, wait: Math.ceil((m.exp - now) / 1000), err: 'Thử sai quá nhiều lần' });
  if (!auth.secretOk(String(body.login || ''))) {
    if (m) m.n++; else memFail.set(ip, { n: 1, exp: now + FAIL_WIN });
    await Promise.all([auth.logLogin(req, 'Sai mật khẩu', false), new Promise(r => setTimeout(r, 500))]);
    return res.status(200).json({ ok: false, err: 'Sai mật khẩu' });
  }
  memFail.delete(ip);
  await auth.logLogin(req, 'Mật khẩu', true);
  res.setHeader('Set-Cookie', auth.cookie());
  return res.status(200).json({ ok: true });
}

module.exports = { doLogin };
