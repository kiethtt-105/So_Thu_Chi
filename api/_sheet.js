// Gọi Apps Script (Google Sheet) từ server. File bắt đầu bằng "_" nên Vercel KHÔNG coi là API route.
// sheet(body, ms) luôn trả về object { ok, ... }, không bao giờ ném lỗi (lỗi mạng => { ok:false, net:true, hubErr:true, err }).
const auth = require('./_auth'), env = auth.env;
const APP_KEY = env('APP_KEY'), APP_API = env('APP_API');

async function sheet(body, ms) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 45000);
  try {
    const r = await fetch(APP_API, { method: 'POST', signal: ac.signal, body: JSON.stringify(Object.assign({ key: APP_KEY }, body)) });
    const txt = await r.text();
    try { return JSON.parse(txt); }
    catch (x) { return { ok: false, net: true, hubErr: true, err: 'Apps Script không trả về JSON (HTTP ' + r.status + '). Kiểm tra: Deploy > Web app > Who has access = Anyone, và đã deploy phiên bản mới' }; }
  } catch (e) {
    return { ok: false, net: true, hubErr: true, err: e && e.name === 'AbortError' ? 'Google Sheet phản hồi quá chậm' : 'Không kết nối được Google Sheet' };
  } finally { clearTimeout(tm); }
}

module.exports = { sheet };
