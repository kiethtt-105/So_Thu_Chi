const auth = require('./_auth');
const crypto = require('crypto');
const env = auth.env;

// Nhiều thiết bị cùng mở sẽ cùng gửi một thông báo: chỉ cho tin ĐẦU TIÊN đi trong 90 giây.
// Bỏ qua các dòng số dư (💰) và giờ tạo (🕒) vì mỗi máy tính ra hơi khác nhau.
// Không hỏi được Apps Script: chống trùng trong bộ nhớ của instance (cùng cách với giới hạn đăng nhập ở store.js). Tốt nhất có thể, không bền giữa các lần khởi động.
const memTg = new Map();
function memFirst(key) {
  const now = Date.now();
  for (const [k, t] of memTg) if (now - t > 90000) memTg.delete(k);
  if (memTg.has(key)) return false;
  memTg.set(key, now);
  return true;
}
// Hỏi Apps Script (Code.gs: dedupe_) xem tin này đã được gửi trong 90 giây qua chưa. Trả về true/false, hoặc null nếu không hỏi được / Code.gs chưa cập nhật.
async function gsFirst(key) {
  const api = env('APP_API'), k = env('APP_KEY');
  if (!api || !k) return null;
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(api, { method: 'POST', signal: ac.signal, body: JSON.stringify({ key: k, dedupe: key }) });
    const j = JSON.parse(await r.text());
    return j && j.ok && typeof j.first === 'boolean' ? j.first : null;
  } catch (e) { return null; } finally { clearTimeout(tm); }
}
async function firstOf(text, dk) {
  const norm = text.split('\n').filter(l => !/^(💰|🕒)/u.test(l.trim())).join('\n');
  // Có dk (khóa theo nội dung giao dịch): dedupe theo dk + tiêu đề, nên hai khoản khác nhau cùng chữ vẫn được gửi. Không có: theo nội dung như cũ.
  const base = dk ? 'k|' + dk + '|' + text.split('\n')[0] : norm;
  const key = 'stc:tgd:' + crypto.createHash('sha1').update(base).digest('hex');
  const g = await gsFirst(key);   // Apps Script: dùng chung cho mọi instance Vercel
  return g !== null ? g : memFirst(key);
}


module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, err: 'Method not allowed' });
  const TG_TOKEN = env('TG_TOKEN'), TG_CHAT_ID = env('TG_CHAT_ID');
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return res.status(403).json({ ok: false, err: 'Forbidden' });   // chặn gọi từ trang web khác
  if (!(await auth.ok(req, res))) return res.status(401).json({ ok: false, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });        // cookie đăng nhập, không còn dùng key
  if (!TG_TOKEN || !TG_CHAT_ID) return res.status(500).json({ ok: false, err: 'Thiếu TG_TOKEN hoặc TG_CHAT_ID trên Vercel' });   // kiểm tra SAU khi xác thực để không lộ cấu hình
  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return res.status(400).json({ ok: false, err: 'Dữ liệu không hợp lệ' }); }
  const text = String(body.text || '').slice(0, 4000);
  if (!text) return res.status(400).json({ ok: false, err: 'Thiếu nội dung' });
  if (!body.nodup && !(await firstOf(text, String(body.dk || '').slice(0, 600)))) return res.status(200).json({ ok: true, dup: true });
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