// Đăng nhập bằng mật khẩu. Giới hạn thử sai tính ở Google Sheet (log.add): 5 lần sai trong 15 phút từ một IP thì khóa, kể cả khi sau đó nhập đúng.
// Bộ đếm trong bộ nhớ chỉ là lớp chặn nhanh, không phải nguồn sự thật nên không sao nếu Vercel khởi động lại.
// Thành công => cookie HttpOnly. Mặc định thiết bị KHÔNG tin cậy (hạn 12 giờ); gửi kèm did của thiết bị đã được tin cậy thì cấp cookie tin cậy.
const auth = require('./_auth');

const memFail = new Map();
async function doLogin(req, res, body) {
  const ip = auth.clientIp(req), now = Date.now();
  for (const [k, v] of memFail) if (v.exp < now) memFail.delete(k);
  const m = memFail.get(ip);
  if (m && m.n >= auth.FAIL_MAX) return res.status(429).json({ ok: false, wait: Math.ceil((m.exp - now) / 1000), err: 'Thử sai quá nhiều lần' });
  if (!auth.secretOk(String(body.login || ''))) {
    if (m) m.n++; else memFail.set(ip, { n: 1, exp: now + auth.FAIL_WIN });
    const [r] = await Promise.all([auth.logLogin(req, 'Sai mật khẩu', false, true), new Promise(r => setTimeout(r, 500))]);
    if (r && r.n >= auth.FAIL_MAX) memFail.set(ip, { n: auth.FAIL_MAX, exp: Date.now() + auth.FAIL_WIN });
    return res.status(200).json({ ok: false, err: 'Sai mật khẩu' });
  }
  const r = await auth.logLogin(req, 'Mật khẩu', true, true);
  if (r && r.locked) {   // đúng mật khẩu nhưng IP đã sai quá nhiều lần: vẫn từ chối
    memFail.set(ip, { n: auth.FAIL_MAX, exp: Date.now() + r.wait * 1000 });
    return res.status(429).json({ ok: false, wait: r.wait, err: 'Thử sai quá nhiều lần' });
  }
  memFail.delete(ip);
  const did = String(body.did || '').slice(0, 40), trusted = await auth.deviceTrusted(did);
  res.setHeader('Set-Cookie', auth.cookie(trusted ? did : '-'));
  return res.status(200).json({ ok: true, trusted });
}

module.exports = { doLogin };
