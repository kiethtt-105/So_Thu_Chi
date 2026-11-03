/* ===== 04_Write.gs — ghi dữ liệu từ web: giao dịch, tài khoản, hạng mục, hạn mức ===== */
function findRow(id) {
  id = str(id); if (!id) return 0;
  const g = need(TAB.tx), n = g.getLastRow();
  if (id[0] === '@') { const r = +id.slice(1); return r >= 2 && r <= n ? r : 0; }
  if (n < 2) return 0;
  const i = g.getRange(2, txCols_().id, n - 1, 1).getValues().findIndex(x => str(x[0]) === id);
  return i < 0 ? 0 : i + 2;
}
function nextTxRow(g) {
  const n = g.getLastRow(); if (n < 2) return 2;
  const c = txCols_(), ks = TX_CORE_.filter(k => k !== 'at'), V = g.getRange(2, 1, n - 1, c.lc).getValues(); let last = 1;
  for (let i = V.length - 1; i >= 0; i--) if (ks.some(k => V[i][c[k] - 1] !== '')) { last = i + 2; break; }
  if (last + 1 > g.getMaxRows()) g.insertRowsAfter(g.getMaxRows(), 50);
  return last + 1;
}
function saveTx(r) {
  const sp = splitImg_(r.note), o = { id: str(r.id), date: r.date, type: fixType(r.type) || str(r.type), amount: r.amount, acc: str(r.acc), accTo: str(r.accTo), cat: str(r.cat), sub: str(r.sub), note: sp.text };
  if (o.type === 'Chuyển khoản') o.cat = o.sub = ''; else if (o.type === 'Điều chỉnh') o.cat = o.sub = o.accTo = ''; else o.accTo = '';
  const P_ = txProblems(o, getCtx()); if (P_.length) throw new Error(P_[0].msg);
  const g = need(TAB.tx), c = txCols_(); let row = findRow(o.id);
  if (!o.id || o.id[0] === '@') o.id = newId();
  const rec = { id: o.id, date: parseDate(o.date), type: o.type, amount: parseMoney_(o.amount), acc: o.acc, accTo: o.accTo, cat: o.cat, sub: o.sub, note: o.note };   // tiền luôn nguyên
  const at = parseAt_(r.at);          // giờ giao dịch do web gửi (cột "Tạo lúc"); không có thì dùng giờ hiện tại
  if (row) {
    if (at) rec.at = at;                                                         // sửa giao dịch → cập nhật giờ theo web
    else if (g.getRange(row, c.at).getValue() === '') rec.at = new Date();
    putRow_(g, row, rec);
  } else {
    row = nextTxRow(g); rec.at = at || new Date();
    putRow_(g, row, rec);
  }
  clearFlags(g, row, c.lc);
  setImgs_(g, row, sp.imgs);          // liên kết ảnh → cột "Ảnh" riêng
}
/* Xóa dòng an toàn: dòng đang bị BỘ LỌC ẩn thì deleteRow() không xóa được → gỡ bộ lọc, xóa, dựng lại bộ lọc cũ.
 * Sheet chỉ còn đúng 1 dòng dữ liệu (dưới dòng cố định) thì Gsheet từ chối xóa → chèn thêm 1 dòng trống trước. */
function deleteRowSafe_(g, row) {
  if (g.getMaxRows() - g.getFrozenRows() <= 1) g.insertRowsAfter(g.getMaxRows(), 1);
  const f = g.getFilter(); let keep = null;
  if (f) {
    const r = f.getRange(), c0 = r.getColumn(), nc = r.getNumColumns(), cr = {};
    for (let c = c0; c < c0 + nc; c++) { const k = f.getColumnFilterCriteria(c); if (k) cr[c] = k; }
    keep = { r1: r.getRow(), c0, nr: r.getNumRows(), nc, cr };
    f.remove();
  }
  try { g.deleteRow(row); }
  finally {
    if (keep) {
      const nr = Math.max(1, keep.nr - (row >= keep.r1 && row < keep.r1 + keep.nr ? 1 : 0)), nf = g.getRange(keep.r1, keep.c0, nr, keep.nc).createFilter();
      Object.keys(keep.cr).forEach(c => { try { nf.setColumnFilterCriteria(+c, keep.cr[c]); } catch (x) {} });
    }
  }
}
/* Xóa giao dịch: lưu Thùng rác TRƯỚC, xóa dòng SAU; nếu xóa lỗi thì gỡ bản vừa lưu. */
function delTx(id) {
  const row = findRow(id); if (!row) return;
  const g = need(TAB.tx), c = txCols_(), rv = g.getRange(row, 1, 1, c.lc).getValues()[0], vals = ['id', 'date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note'].map(k => rv[c[k] - 1]), icd = c.img;
  vals[8] = noteWeb_(vals[8], icd ? rv[icd - 1] : '');   // Thùng rác giữ cả link ảnh
  const at = rv[c.at - 1];                                 // giờ giao dịch gốc → lưu vào thùng rác để khôi phục đúng giờ
  if (!str(vals[0]) || str(vals[0])[0] === '@') vals[0] = newId();           // dòng chưa có ID: cấp ID thật
  const archRow = arch(vals, 'gd', at);
  try {
    deleteRowSafe_(g, row); SpreadsheetApp.flush();
    const again = findRow(id);
    if (again && again === row && str(g.getRange(row, 1).getValue()) === str(id)) throw new Error('Không xóa được dòng ' + row + ' trong GiaoDich (kiểm tra bộ lọc / vùng được bảo vệ).');
  } catch (e) {
    safe(() => dx().deleteRow(archRow), null);                              // xóa lỗi → bỏ bản vừa lưu thùng rác
    throw e;
  }
}
function purgeTx(id) {
  const row = findRow(id); if (!row) return;
  const g = need(TAB.tx), c = txCols_(), rv = g.getRange(row, 1, 1, c.lc).getValues()[0];
  const imgs = fileIds_(rv[c.note - 1]).concat(c.img ? fileIds_(rv[c.img - 1]) : []);
  deleteRowSafe_(g, row);
  if (imgs.length) safe(() => trashImgs_(imgs), 0);
}
/* Đọc / ghi 1 cột của GiaoDich theo khóa (dữ liệu dòng 2 → cuối) */
function txColVals_(g, k) { const n = g.getLastRow(); return n < 2 ? [] : g.getRange(2, txCols_()[k], n - 1, 1).getValues().map(r => r[0]); }
function txColSet_(g, k, A) { if (A.length) g.getRange(2, txCols_()[k], A.length, 1).setValues(A.map(x => [x])); }
const renameTx = (keys, from, to) => keys.reduce((k, key) => {
  const g = need(TAB.tx), V = txColVals_(g, key); let n = 0;
  const W = V.map(v => { if (str(v) === from) { n++; return to; } return v; });
  if (n) txColSet_(g, key, W);
  return k + n;
}, 0);
const usesAcc = name => { const g = need(TAB.tx); return ['acc', 'accTo'].some(k => txColVals_(g, k).some(v => str(v) === name)); };
const usesCat = (t, p, c) => { const g = need(TAB.tx), T = txColVals_(g, 'type'), P = txColVals_(g, 'cat'), S = txColVals_(g, 'sub'); return T.some((v, i) => str(v) === t && str(P[i]) === p && str(S[i]) === c); };
const renameCat = (t, p, c, np, nc) => {
  const g = need(TAB.tx), T = txColVals_(g, 'type'), P = txColVals_(g, 'cat'), S = txColVals_(g, 'sub'), P2 = P.slice(), S2 = S.slice(); let k = 0;
  T.forEach((v, i) => { if (str(v) === t && str(P[i]) === p && str(S[i]) === c) { P2[i] = np; S2[i] = nc; k++; } });
  if (k) { txColSet_(g, 'cat', P2); txColSet_(g, 'sub', S2); }
  return k;
};
function renameLimCat(from, to) {
  const s = opt(TAB.lim), n = s ? s.getLastRow() : 0; if (n < 2) return;
  const rg = s.getRange(2, 2, n - 1, 1), V = rg.getValues(); rg.setValues(V.map(v => [str(v[0]) === from ? to : v[0]]));
}

function saveAcc(a, old) {
  const name = str(a.name), type = str(a.type);
  if (!name) throw new Error('Thiếu tên tài khoản');
  if (type && !ACC_TYPES.includes(type)) throw new Error('Loại tài khoản phải là: ' + ACC_TYPES.join(', '));
  const open = a.open === '' || a.open == null ? 0 : parseMoney_(a.open);
  if (open === null) throw new Error('Số dư ban đầu phải là số');
  const s = need(TAB.acc), V = block(s, MAX_ACC, 3), i = V.findIndex(v => str(v[0]) === (old || name)), dup = V.findIndex(v => str(v[0]) === name);
  if (!old && i >= 0) throw new Error('Tài khoản "' + name + '" đã tồn tại');
  if (old && i < 0) throw new Error('Không tìm thấy tài khoản "' + old + '"');
  if (old && name !== old && dup >= 0) throw new Error('Tên "' + name + '" đã được dùng');
  let row = i + 2;
  if (i < 0) { const e = V.findIndex(v => v.every(x => x === '')); if (e < 0) throw new Error('Đã đủ ' + MAX_ACC + ' tài khoản (giới hạn của bảng)'); row = e + 2; }
  s.getRange(row, 1, 1, 3).setValues([[name, type, open]]);
  if (old && old !== name) renameTx(['acc', 'accTo'], old, name);
  clearFlags(s, row, 3);
}
function delAcc(name) {
  if (usesAcc(name)) throw new Error('Tài khoản đang có giao dịch, không thể xóa');
  const s = need(TAB.acc), V = block(s, MAX_ACC, 3), i = V.findIndex(v => str(v[0]) === name); if (i < 0) return;
  arch([name, '', V[i][1], V[i][2]], 'tk'); s.getRange(i + 2, 1, 1, 3).clearContent();
}
function saveCat(c, old) {
  const t = str(c.t), p = str(c.p), n = str(c.c);
  if (t !== 'Chi' && t !== 'Thu') throw new Error('Loại phải là Chi hoặc Thu');
  if (!p || !n) throw new Error('Thiếu hạng mục cha hoặc hạng mục con');
  const s = need(TAB.cat), V = block(s, MAX_CAT, 3), same = (v, x) => str(v[0]) === x.t && str(v[1]) === x.p && str(v[2]) === x.c;
  const i = old ? V.findIndex(v => same(v, old)) : -1;
  if (old && i < 0) throw new Error('Không tìm thấy hạng mục cần sửa');
  if (V.some((v, k) => k !== i && str(v[0]) === t && str(v[2]) === n)) throw new Error('Đã có hạng mục con "' + n + '" (mỗi hạng mục con phải có tên riêng)');
  if (old && old.t !== t && usesCat(old.t, old.p, old.c)) throw new Error('Hạng mục đang có giao dịch, không đổi loại Chi/Thu được');
  let row = i + 2;
  if (i < 0) { const e = V.findIndex(v => v.every(x => x === '')); if (e < 0) throw new Error('Đã đủ ' + MAX_CAT + ' hạng mục (giới hạn của bảng)'); row = e + 2; }
  s.getRange(row, 1, 1, 3).setValues([[t, p, n]]);
  if (old && (old.p !== p || old.c !== n)) {
    renameCat(t, old.p, old.c, p, n);
    if (old.p !== p && !V.some((v, k) => k !== i && str(v[0]) === 'Chi' && str(v[1]) === old.p)) renameLimCat(old.p, p);
  }
  clearFlags(s, row, 3);
}
function delCat(c) {
  if (usesCat(c.t, c.p, c.c)) throw new Error('Hạng mục đang có giao dịch, không thể xóa');
  const s = need(TAB.cat), V = block(s, MAX_CAT, 3), i = V.findIndex(v => str(v[0]) === c.t && str(v[1]) === c.p && str(v[2]) === c.c); if (i < 0) return;
  arch(['', '', c.t, '', '', '', c.p, c.c], 'dm'); s.getRange(i + 2, 1, 1, 3).clearContent();
}

/* ---- HẠN MỨC: HanMuc!A=Kỳ (Ngày|Tháng), B=Hạng mục cha (trống = tổng chi), C=Hạn mức ---- */
function limSheet() {
  let s = opt(TAB.lim);
  if (!s) { s = ss().insertSheet(TAB.lim); }
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 4).setValues([['Kỳ', 'Hạng mục (trống = tổng chi)', 'Hạn mức (₫)', 'Ghi chú']]).setFontWeight('bold').setBackground('#5B3DF5').setFontColor('#ffffff');
    s.setFrozenRows(1); s.setColumnWidths(1, 4, 150);
    s.getRange('A1').setNote('Ngày = hạn mức chi mỗi ngày. Tháng = hạn mức chi mỗi tháng.\nHạng mục để trống = tổng chi tất cả hạng mục.\nChỉ tính giao dịch loại Chi; hạng mục theo hạng mục CHA.');
  }
  return s;
}
function setLim(per, cat, v) {
  per = fixPer(per); cat = str(cat); v = (v === '' || v == null) ? 0 : parseMoney_(v);   // để trống = bỏ hạn mức
  if (!per) throw new Error('Kỳ phải là Ngày hoặc Tháng');
  if (v === null || v < 0) throw new Error('Hạn mức phải là số từ 0 trở lên');
  if (cat && !getCtx().chiParents.has(cat)) throw new Error('Hạng mục "' + cat + '" không có trong DanhMuc (loại Chi)');
  const s = limSheet(), n = s.getLastRow(), V = n > 1 ? s.getRange(2, 1, n - 1, 3).getValues() : [];
  const i = V.findIndex(r => fixPer(r[0]) === per && str(r[1]) === cat);
  if (v === 0) { if (i >= 0) s.deleteRow(i + 2); return; }
  let row = i + 2;
  if (i < 0) { const e = V.findIndex(r => r.every(x => x === '')); row = e >= 0 ? e + 2 : n + 1; if (row - 1 > MAX_LIM) throw new Error('Đã đủ ' + MAX_LIM + ' hạn mức'); }
  s.getRange(row, 1, 1, 3).setValues([[per, cat, v]]);
  s.getRange(row, 3).setNumberFormat('#,##0'); clearFlags(s, row, 3);
}

/* ---- SẮP XẾP GIAODICH: Ngày mới → cũ, cùng ngày thì "Tạo lúc" mới → cũ (giao dịch mới nhất luôn ở trên đầu).
 * Chỉ sắp khi thứ tự đang sai. Bộ lọc được gỡ trước khi sắp rồi dựng lại đúng như cũ. ---- */
function sapXepGiaoDich_() {
  const g = need(TAB.tx), n = g.getLastRow(); if (n < 3) return 0;
  const c = txCols_(), D = g.getRange(2, c.date, n - 1, 1).getValues(), A = g.getRange(2, c.at, n - 1, 1).getValues();
  // dòng thiếu ID (ID tạm '@dòng' sẽ trỏ nhầm khi dòng bị đổi vị trí) → cấp ID thật trước khi sắp xếp
  const I = g.getRange(2, c.id, n - 1, 1).getValues(); let idFix = 0;
  I.forEach((r, i) => { if (str(r[0]) === '' && D[i][0] !== '') { r[0] = newId(); idFix++; } });
  if (idFix) g.getRange(2, c.id, n - 1, 1).setValues(I);
  const t = v => v instanceof Date ? v.getTime() : 0;
  let sorted = true;
  for (let i = 1; i < D.length && sorted; i++) {
    const d0 = t(D[i - 1][0]), d1 = t(D[i][0]);
    if (d1 > d0 || (d1 === d0 && t(A[i][0]) > t(A[i - 1][0]))) sorted = false;
  }
  if (sorted) return 0;
  const f = g.getFilter(); let keep = null;
  if (f) {
    const r = f.getRange(), c0 = r.getColumn(), nc = r.getNumColumns(), cr = {};
    for (let k = c0; k < c0 + nc; k++) { const x = f.getColumnFilterCriteria(k); if (x) cr[k] = x; }
    keep = { r1: r.getRow(), c0, nr: r.getNumRows(), nc, cr };
    f.remove();
  }
  try {
    g.getRange(2, 1, n - 1, c.lc).sort([{ column: c.date, ascending: false }, { column: c.at, ascending: false }]);
  } finally {
    if (keep) {
      const nf = g.getRange(keep.r1, keep.c0, keep.nr, keep.nc).createFilter();
      Object.keys(keep.cr).forEach(k => { try { nf.setColumnFilterCriteria(+k, keep.cr[k]); } catch (x) {} });
    }
  }
  return 1;
}
