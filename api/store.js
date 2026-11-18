// Thiết bị <-> Vercel (/api/store) <-> Google Sheet (Apps Script). KHÔNG dùng Redis.
// Google Sheet là nguồn dữ liệu duy nhất. Sao lưu JSON lên Drive qua Backup.gs (backupPut_).
// Cùng định dạng request/response với Apps Script nên app.js dùng như cũ (không còn trường "hub", "crev").
const auth = require('./_auth'), env = auth.env;
const APP_KEY = env('APP_KEY'), APP_API = env('APP_API'), APP_PASS = env('APP_PASS'), CRON_SECRET = env('CRON_SECRET');

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
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

// ---- Kiểm tra giao dịch ở server (giữ nguyên bản cũ) ----
const TX_TYPES = new Set(['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OPS = 500, MAX_AMT = 1e12;
function cleanRow(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { err: 'Giao dịch không hợp lệ' };
  const id = String(r.id == null ? '' : r.id);
  if (!id || id.length > 64) return { err: 'Mã giao dịch không hợp lệ' };
  if (!TX_TYPES.has(r.type)) return { err: 'Loại giao dịch không hợp lệ' };
  if (!DATE_RE.test(String(r.date || ''))) return { err: 'Ngày giao dịch không hợp lệ (cần dạng YYYY-MM-DD)' };
  if (typeof r.amount !== 'number' && !(typeof r.amount === 'string' && r.amount.trim())) return { err: 'Thiếu số tiền' };
  const a = Number(r.amount);
  if (!isFinite(a) || Math.abs(a) > MAX_AMT) return { err: 'Số tiền không hợp lệ' };
  const amount = Math.round(a);
  if (amount === 0) return { err: 'Số tiền phải khác 0' };
  if (amount < 0 && r.type !== 'Điều chỉnh') return { err: 'Số tiền phải lớn hơn 0' };
  const acc = String(r.acc == null ? '' : r.acc).trim(), to = String(r.accTo == null ? '' : r.accTo).trim();
  if (!acc || acc.length > 100) return { err: 'Thiếu tài khoản' };
  if (r.type === 'Chuyển khoản') {
    if (!to) return { err: 'Chuyển khoản thiếu tài khoản nhận' };
    if (to === acc) return { err: 'Tài khoản nguồn và nhận phải khác nhau' };
  }
  return { row: Object.assign({}, r, { amount }) };
}
function cleanOps(ops) {
  if (ops.length > MAX_OPS) return { err: 'Quá nhiều thao tác trong một lần gửi' };
  const out = [];
  for (const x of ops) {
    if (x && x.op === 'tx.save') {
      const c = cleanRow(x.row);
      if (c.err) return { err: c.err };
      out.push(Object.assign({}, x, { row: c.row }));
    } else if (x && (x.op === 'tx.del' || x.op === 'tx.purge') && typeof x.id !== 'string' && typeof x.id !== 'number') return { err: 'Thiếu mã giao dịch cần xóa' };
    else out.push(x);
  }
  return { ops: out };
}

// ---- Sao lưu JSON lên Drive (Backup.gs). Nguồn = Google Sheet. ----
async function backupDrive() {
  const j = await sheet({ ops: [], rev: '' }, 30000);
  if (!j.ok) return { ok: false, err: j.err || 'Không đọc được Google Sheet' };
  const data = { app: 'so-thu-chi', v: 1, at: new Date().toISOString(), rev: String(j.rev || ''), tx: j.tx || [], acc: j.acc || [], cat: j.cat || [], lim: j.lim || [], trash: j.trash || [] };
  const r = await sheet({ backup: { json: JSON.stringify(data) } }, 40000);
  if (!r.ok) return { ok: false, err: r.err || 'Apps Script từ chối sao lưu' };
  if (!r.saved) return { ok: false, err: 'Apps Script chưa có Backup.gs hoặc chưa Deploy phiên bản mới' };
  return { ok: true, n: data.tx.length, at: data.at, size: r.size || 0, url: r.url || '' };
}

// ---- Đăng nhập: giới hạn thử sai theo IP (trong bộ nhớ; chỉ làm chậm kẻ đoán mò, không bền giữa các lần khởi động) ----
const FAIL_MAX = 5, FAIL_WIN = 900 * 1000;
const memFail = new Map();
async function doLogin(req, res, body) {
  const ip = auth.clientIp(req), m = memFail.get(ip);
  if (m && m.exp > Date.now() && m.n >= FAIL_MAX) return res.status(429).json({ ok: false, wait: Math.ceil((m.exp - Date.now()) / 1000), err: 'Thử sai quá nhiều lần' });
  if (!auth.secretOk(String(body.login || ''))) {
    if (m && m.exp > Date.now()) m.n++; else memFail.set(ip, { n: 1, exp: Date.now() + FAIL_WIN });
    await new Promise(r => setTimeout(r, 500));
    return res.status(200).json({ ok: false, err: 'Sai mật khẩu' });
  }
  memFail.delete(ip);
  res.setHeader('Set-Cookie', auth.cookie());
  return res.status(200).json({ ok: true });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!APP_API || !APP_KEY || !APP_PASS) return res.status(200).json({ ok: false, hubErr: true, err: 'Chưa cấu hình APP_API / APP_KEY / APP_PASS trên Vercel' });
  try {
    if (req.method === 'GET') {   // Vercel Cron: sao lưu JSON mỗi ngày
      if (!CRON_SECRET || req.headers.authorization !== 'Bearer ' + CRON_SECRET) return res.status(200).json({ ok: true, cron: false });
      return res.status(200).json({ ok: true, backup: await backupDrive().catch(e => ({ ok: false, err: String(e && e.message || e) })) });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, err: 'Method not allowed' });
    const sfs = req.headers['sec-fetch-site'];
    if (sfs && sfs !== 'same-origin' && sfs !== 'none') return res.status(403).json({ ok: false, err: 'Forbidden' });
    const body = typeof req.body === 'string' ? parse(req.body || '{}') || {} : (req.body || {});

    if (body.logout) { res.setHeader('Set-Cookie', auth.clear()); return res.status(200).json({ ok: true }); }
    if (body.login !== undefined) return await doLogin(req, res, body);
    if (!(await auth.ok(req, res))) return res.status(401).json({ ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });

    if (body.logoutAll) return res.status(200).json({ ok: false, err: 'Đã bỏ Redis nên không còn "đăng xuất tất cả". Muốn đăng xuất mọi thiết bị: đổi APP_PASS (hoặc APP_KEY) trên Vercel rồi Redeploy.' });
    if (body.backupNow) return res.status(200).json(await backupDrive().catch(e => ({ ok: false, err: String(e && e.message || e) })));
    if (body.img) return res.status(200).json(await sheet({ img: body.img }, 45000));
    if (body.cfg) return res.status(200).json({ ok: true, off: true });   // cài đặt chỉ còn lưu trên từng máy (localStorage)

    if (Array.isArray(body.ops) && body.ops.length) {
      const v = cleanOps(body.ops);
      if (v.err) return res.status(200).json({ ok: false, reject: true, err: 'Dữ liệu bị từ chối: ' + v.err });
      body.ops = v.ops;
    }
    const sid = typeof body.sid === 'string' ? body.sid.slice(0, 64) : '';
    return res.status(200).json(await sheet({ ops: Array.isArray(body.ops) ? body.ops : [], rev: body.rev || '', fast: !!body.fast, sid }, 50000));
  } catch (e) {
    return res.status(200).json({ ok: false, hubErr: true, err: 'Máy chủ: ' + (e && e.message || e) });
  }
};
module.exports._cleanOps = cleanOps;
