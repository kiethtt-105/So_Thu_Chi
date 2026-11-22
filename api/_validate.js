// Kiểm tra giao dịch trước khi gửi sang Google Sheet. Thuần hàm, không gọi mạng.
// cleanOps(ops) => { ops } đã chuẩn hóa (số tiền làm tròn nguyên), hoặc { err } nếu có thao tác không hợp lệ.
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
  if (Math.abs(a - Math.round(a)) > 1e-6) return { err: 'Số tiền phải là số nguyên (không dùng dấu thập phân)' };
  const amount = Math.round(a);
  if (amount === 0) return { err: 'Số tiền phải khác 0' };
  if (amount < 0 && r.type !== 'Điều chỉnh') return { err: 'Số tiền phải lớn hơn 0' };
  const acc = String(r.acc == null ? '' : r.acc).trim(), to = String(r.accTo == null ? '' : r.accTo).trim();
  if (!acc || acc.length > 100) return { err: 'Thiếu tài khoản' };
  if (r.type === 'Chuyển khoản') {
    if (!to) return { err: 'Chuyển khoản thiếu tài khoản nhận' };
    if (to === acc) return { err: 'Tài khoản nguồn và nhận phải khác nhau' };
  }
  // Chuỗi người dùng / AI nhập đi thẳng vào Google Sheet: cắt độ dài, và nếu bắt đầu bằng ký tự công thức (= @ hoặc +/- kèm chữ) thì thêm dấu cách đầu để Sheets coi là chữ thường
  const safe = (v, n) => { const s = String(v == null ? '' : v).slice(0, n); return /^[=@]|^[+\-](?=[A-Za-z(])/.test(s) ? ' ' + s : s; };
  const out = { amount };
  if ('note' in r) out.note = safe(r.note, 2000);
  if ('cat' in r) out.cat = safe(r.cat, 100);
  if ('sub' in r) out.sub = safe(r.sub, 100);
  return { row: Object.assign({}, r, out) };
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

module.exports = { cleanOps, cleanRow };
