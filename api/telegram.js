const auth = require('./_auth');

const env = k => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, err: 'Method not allowed' });
  const TG_TOKEN = env('TG_TOKEN'), TG_CHAT_ID = env('TG_CHAT_ID');
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return res.status(403).json({ ok: false, err: 'Forbidden' });   // chặn gọi từ trang web khác
  if (!auth.ok(req)) return res.status(401).json({ ok: false, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });        // cookie đăng nhập, không còn dùng key
  if (!TG_TOKEN || !TG_CHAT_ID) return res.status(500).json({ ok: false, err: 'Thiếu TG_TOKEN hoặc TG_CHAT_ID trên Vercel' });   // kiểm tra SAU khi xác thực để không lộ cấu hình
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return res.status(400).json({ ok: false, err: 'Dữ liệu không hợp lệ' }); }
  const text = String(body.text || '').slice(0, 4000);
  if (!text) return res.status(400).json({ ok: false, err: 'Thiếu nội dung' });
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch('https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage', {
      method: 'POST', signal: ac.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, disable_notification: !!body.silent })
    });
    const j = await r.json();
    return res.status(j.ok ? 200 : 502).json({ ok: !!j.ok, err: j.ok ? '' : j.description });
  } catch (e) {
    return res.status(502).json({ ok: false, err: 'Không gọi được Telegram' });
  } finally { clearTimeout(tm); }
};
