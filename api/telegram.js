const auth = require('./_auth');
const crypto = require('crypto');
const RU = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Nhiều thiết bị cùng mở sẽ cùng gửi một thông báo: chỉ cho tin ĐẦU TIÊN đi trong 90 giây.
// Bỏ qua các dòng số dư (💰) và giờ tạo (🕒) vì mỗi máy tính ra hơi khác nhau. Redis lỗi thì cứ gửi (không chặn nhầm).
async function firstOf(text) {
  if (!RU || !RT) return true;
  const norm = text.split('\n').filter(l => !/^(💰|🕒)/u.test(l.trim())).join('\n');
  const key = 'stc:tgd:' + crypto.createHash('sha1').update(norm).digest('hex');
  try {
    const r = await fetch(RU + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + RT, 'Content-Type': 'application/json' }, body: JSON.stringify([['SET', key, '1', 'NX', 'EX', '90']]) });
    const j = await r.json();
    return !(Array.isArray(j) && j[0] && !j[0].error && j[0].result === null);
  } catch (e) { return true; }
}

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
  if (!body.nodup && !(await firstOf(text))) return res.status(200).json({ ok: true, dup: true });
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
