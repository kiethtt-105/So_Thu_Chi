/* ===== 08_Columns.gs — cột phụ GiaoDich (Số dư cuối, Ảnh, Tháng), chuẩn hóa, khóa cột tự tính ===== */
function findCol_(g, head) {
  const lc = g.getLastColumn(); if (lc < 1) return 0;
  return g.getRange(1, 1, 1, lc).getValues()[0].findIndex(h => str(h) === head) + 1;
}
const sdcCol_ = g => findCol_(g, SDC_HEAD);
const imgCol_ = g => findCol_(g, IMG_HEAD);
const thangCol_ = g => findCol_(g, THANG_HEAD);
function ensureCol_(g, head, note, w) {
  let c = findCol_(g, head); if (c) return c;
  c = g.getLastColumn() + 1;                                        // cột mới luôn thêm vào cuối
  if (g.getMaxColumns() < c) g.insertColumnsAfter(g.getMaxColumns(), c - g.getMaxColumns());
  g.getRange(1, txCols_().at).copyTo(g.getRange(1, c), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  g.getRange(1, c).setValue(head); if (note) g.getRange(1, c).setNote(note);
  g.setColumnWidth(c, w || 120); _tc = null;
  return c;
}
function setImgs_(g, row, imgs) {
  let c = imgCol_(g);
  if (!c) { if (!imgs.length) return; c = ensureCol_(g, IMG_HEAD, 'Liên kết ảnh đính kèm (Google Drive). Nhiều ảnh: mỗi ảnh một dòng.', 260); }
  g.getRange(row, c).setValue(imgs.join('\n'));
}
// Chuyển link ảnh còn nằm trong Ghi chú sang cột "Ảnh"
function tachAnh_() {
  const g = need(TAB.tx), n = g.getLastRow(); if (n < 2) return 0;
  const N = g.getRange(2, txCols_().note, n - 1, 1).getValues(), idx = [];
  N.forEach((v, i) => { if (splitImg_(v[0]).imgs.length) idx.push(i); });
  if (!idx.length) return 0;
  const c = ensureCol_(g, IMG_HEAD, 'Liên kết ảnh đính kèm (Google Drive). Nhiều ảnh: mỗi ảnh một dòng.', 260), I = g.getRange(2, c, n - 1, 1).getValues();
  idx.forEach(i => { const sp = splitImg_(N[i][0]); I[i][0] = uniq_(sp.imgs.concat(splitImg_(I[i][0]).imgs)).join('\n'); N[i][0] = sp.text; });
  g.getRange(2, txCols_().note, n - 1, 1).setValues(N); g.getRange(2, c, n - 1, 1).setValues(I);
  return idx.length;
}
// Làm tròn các ô tiền KHÔNG phải số nguyên trong một cột. Trả về số ô đã sửa.
function lamTronCot_(s, col, maxRows) {
  if (!s) return 0;
  const n = Math.min(s.getLastRow() - 1, maxRows); if (n < 1) return 0;
  const V = s.getRange(2, col, n, 1).getValues(); let k = 0;
  V.forEach((v, i) => {
    if (typeof v[0] !== 'number') return;
    const r = Math.round(v[0]) + 0;
    if (r !== v[0]) { s.getRange(i + 2, col).setValue(r); k++; }
  });
  return k;
}

/* Số dư của tài khoản NGAY SAU mỗi giao dịch. Xếp theo Ngày → giờ "Tạo lúc" → vị trí dòng (dòng không có giờ xếp CUỐI ngày).
 * Thu / Điều chỉnh: cộng · Chi: trừ · Chuyển khoản: trừ TK nguồn, cộng TK nhận (hiển thị số dư TK nguồn). */
function tinhSoDuCuoi_(rows, open) {
  const bal = {}, res = {}, g = a => bal[a] || 0;
  Object.keys(open || {}).forEach(a => { bal[a] = Math.round(open[a]) + 0; });
  rows.slice().sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i).forEach(t => {
    const amt = Math.round(t.amt) + 0;
    if (t.type === 'Chuyển khoản') { bal[t.acc] = g(t.acc) - amt; if (t.accTo) bal[t.accTo] = g(t.accTo) + amt; }
    else if (t.type === 'Chi') bal[t.acc] = g(t.acc) - amt;
    else bal[t.acc] = g(t.acc) + amt;
    res[t.i] = bal[t.acc];
  });
  return res;
}
function capNhatSoDuCuoi_() {
  const g = need(TAB.tx), cc = ensureCol_(g, SDC_HEAD, 'Số dư của tài khoản (cột Tài khoản) ngay sau giao dịch này.\nChuyển khoản: số dư của tài khoản nguồn.\nScript tự tính lại mỗi khi dữ liệu đổi — không cần sửa tay.', 120);
  const n = g.getLastRow(); if (n < 2) return cc;
  const c = txCols_(), V = g.getRange(2, 1, n - 1, c.lc).getValues(), open = {}, rows = [];
  accRows().forEach(r => { if (!r.empty && r.item.name) open[r.item.name] = r.item.open; });
  V.forEach((v, i) => {
    const dt = parseDate(v[c.date - 1]), amt = parseMoney_(v[c.amount - 1]), type = fixType(v[c.type - 1]), acc = str(v[c.acc - 1]), at = v[c.at - 1];
    if (!dt || amt === null || !type || !acc) return;
    rows.push({ i, k: day(dt) + ' ' + (at instanceof Date ? Utilities.formatDate(at, tz(), 'HH:mm:ss') : '23:59:59'), type, amt, acc, accTo: str(v[c.accTo - 1]) });
  });
  const res = tinhSoDuCuoi_(rows, open), want = V.map((v, i) => [res[i] === undefined ? '' : res[i]]);
  const cur = g.getRange(2, cc, n - 1, 1).getValues();
  if (!want.every((w, i) => cur[i][0] === w[0]))                  // chỉ ghi khi có thay đổi
    g.getRange(2, cc, n - 1, 1).setValues(want).setNumberFormat('#,##0').setHorizontalAlignment('right');
  return cc;
}
/* Cột "Tháng" = yyyy-MM lấy từ cột Ngày. Lưu dạng văn bản nên sắp xếp A→Z đúng thứ tự thời gian. */
function capNhatThang_() {
  const g = need(TAB.tx);
  const c = ensureCol_(g, THANG_HEAD, 'Tháng của giao dịch (yyyy-MM), tự tính từ cột Ngày.\nDùng để lọc / sắp xếp. Đừng sửa tay, script sẽ tính lại.', 80);
  const n = g.getLastRow(); if (n < 2) return c;
  const rg = g.getRange(2, c, n - 1, 1), cur = rg.getValues();
  const want = g.getRange(2, txCols_().date, n - 1, 1).getValues().map(v => { const d = parseDate(v[0]); return [d ? day(d).slice(0, 7) : '']; });
  if (want.every((w, i) => String(cur[i][0]) === w[0])) return c;   // không đổi thì không ghi
  rg.setNumberFormat('@').setValues(want).setHorizontalAlignment('center');
  return c;
}

/* ---- Chuẩn hóa dữ liệu GiaoDich (chỉ ghi các cột ID, Ngày, Loại, Số tiền, Tạo lúc) ---- */
function normalizeTx(first, last) {
  const g = need(TAB.tx), n = g.getLastRow(); last = Math.min(last, n); if (n < 2 || last < first) return 0;
  const c = txCols_(), V = g.getRange(first, 1, last - first + 1, c.lc).getValues(), ids = {}, MID = ['date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note']; let k = 0;
  if (first > 2) g.getRange(2, c.id, first - 2, 1).getValues().forEach(x => { if (str(x[0])) ids[str(x[0])] = 1; });
  V.forEach((v, i) => {
    if (MID.every(key => v[c[key] - 1] === '')) return;
    const row = first + i, set = (key, val) => { g.getRange(row, c[key]).setValue(val); k++; };
    let id = str(v[c.id - 1]); if (!id || ids[id]) { id = newId(); set('id', id); } ids[id] = 1;
    const dt = parseDate(v[c.date - 1]); if (dt && !(v[c.date - 1] instanceof Date)) set('date', dt);
    const ty = fixType(v[c.type - 1]); if (ty && ty !== v[c.type - 1]) set('type', ty);
    const am = parseMoney_(v[c.amount - 1]); if (am !== null && am !== v[c.amount - 1]) set('amount', am);   // chữ → số, số lẻ → làm tròn về nguyên
    if (v[c.at - 1] === '') set('at', new Date());
  });
  return k;
}

/* Cảnh báo (không chặn) khi sửa tay vào cột tự tính: "Tháng" và "Số dư cuối" */
function khoaCotTuTinh_() {
  const g = need(TAB.tx), D = 'Cột tự tính (script)';
  g.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === D) p.remove(); });
  [thangCol_(g), sdcCol_(g)].filter(Boolean).forEach(c =>
    g.getRange(2, c, Math.max(g.getMaxRows() - 1, 1), 1).protect().setDescription(D).setWarningOnly(true));
}
/* Cố định dòng tiêu đề + tạo bộ lọc cho GiaoDich */
function caiBangGiaoDich_() {
  const g = need(TAB.tx);
  if (g.getFrozenRows() < 1) g.setFrozenRows(1);
  if (!g.getFilter()) g.getRange(1, 1, g.getMaxRows(), g.getLastColumn()).createFilter();
}
