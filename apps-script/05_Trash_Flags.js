/* ===== 05_Trash_Flags.gs — thùng rác (DaXoa) & tô lỗi trên Gsheet ===== */
function dx() {
  let s = opt(TAB.del) || ss().insertSheet(TAB.del);
  if (s.getLastRow() === 0) { s.appendRow(['ID/Tên', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Đến TK', 'Hạng mục', 'Chi tiết', 'Ghi chú', 'Xóa lúc', 'Nhóm', 'Khôi phục lúc', 'Giờ GD']); s.setFrozenRows(1); }
  else if (str(s.getRange(1, 13).getValue()) === '') {                       // tab DaXoa cũ chưa có cột "Giờ GD" (cột M)
    if (s.getMaxColumns() < 13) s.insertColumnsAfter(s.getMaxColumns(), 13 - s.getMaxColumns());
    s.getRange(1, 13).setValue('Giờ GD');
  }
  return s;
}
/* Dấu thời gian "Xóa lúc" là KHÓA để web gọi khôi phục. Mỗi lần lưu luôn lệch ít nhất 1 giây so với mục liền trước. */
function stampUnique_(s) {
  const now = Date.now(), n = s.getLastRow(); let last = 0;
  if (n > 1) {
    const v = s.getRange(n, 10).getValue();
    if (v instanceof Date) last = v.getTime();
    else { try { last = Utilities.parseDate(str(v), tz(), 'yyyy-MM-dd HH:mm:ss').getTime(); } catch (e) { last = 0; } }
    if (last > now + 600000) last = 0;                                       // giá trị lạ nằm quá xa trong tương lai → bỏ qua
  }
  return Utilities.formatDate(new Date(Math.max(now, last + 1000)), tz(), 'yyyy-MM-dd HH:mm:ss');
}
function arch(a, kind, at) {
  const r = a.slice(0, 9); while (r.length < 9) r.push('');
  const s = dx();
  s.appendRow(r.concat([stampUnique_(s), kind, '', at instanceof Date ? Utilities.formatDate(at, tz(), "yyyy-MM-dd'T'HH:mm:ss") : '']));   // M = giờ giao dịch gốc
  return s.getLastRow();
}
function readTrash() {
  const s = opt(TAB.del); if (!s || s.getLastRow() < 2) return [];
  return s.getDataRange().getValues().slice(1).filter(r => r[9] && r[11] === '').slice(-300).reverse()
    .map(r => ({ at: String(r[9]), k: r[10], id: String(r[0]), date: r[1] instanceof Date ? day(r[1]) : str(r[1]).slice(0, 10), type: r[2], amount: parseMoney_(r[3]) || 0, acc: r[4], accTo: r[5], cat: r[6], sub: r[7], note: r[8] }));
}
/* Khôi phục. Giao dịch chỉ được khôi phục khi tài khoản của nó còn tồn tại — nếu không, sổ bị LỆCH. */
function restore(at, kind, id) {
  const d = dx(), v = d.getDataRange().getValues(), want = str(id);
  const i = v.findIndex((r, k) => k > 0 && String(r[9]) === at && r[10] === kind && r[11] === '' && (!want || str(r[0]) === want));
  if (i < 0) throw new Error('Không tìm thấy mục đã xóa');
  const r = v[i];
  if (kind === 'gd') {
    const g = need(TAB.tx), rid = str(r[0]), a9 = r.slice(0, 9), sp = splitImg_(r[8]);
    const gio = r[12] instanceof Date ? r[12] : parseAt_(r[12]);                  // giờ giao dịch gốc; mục cũ không có thì dùng giờ hiện tại
    if (!rid || rid[0] === '@') a9[0] = newId();                                  // mục thùng rác cũ mang ID tạm '@dòng' → cấp ID thật
    const daCo = a9[0] === rid && findRow(rid);                                   // giao dịch cùng ID đã có → không khôi phục trùng
    if (!daCo) {
      const o = txObj(a9), ctx = getCtx(), bad = txProblems(o, ctx).filter(p => p.lv === 'err');
      if (!ctx.acc.has(o.acc)) bad.push({ msg: 'Tài khoản "' + o.acc + '" không còn trong tab TaiKhoan' });
      if (fixType(o.type) === 'Chuyển khoản' && o.accTo && !ctx.acc.has(o.accTo)) bad.push({ msg: 'Tài khoản nhận "' + o.accTo + '" không còn trong tab TaiKhoan' });
      if (bad.length) throw new Error('Chưa khôi phục được giao dịch này: ' + bad[0].msg + '. Hãy khôi phục tài khoản (mục Thùng rác) trước.');
      a9[3] = parseMoney_(a9[3]);                                                 // tiền luôn nguyên
      a9[8] = sp.text;
      const row = nextTxRow(g); putRow_(g, row, { id: a9[0], date: a9[1], type: a9[2], amount: a9[3], acc: a9[4], accTo: a9[5], cat: a9[6], sub: a9[7], note: a9[8], at: gio || new Date() }); setImgs_(g, row, sp.imgs);
    }
  }
  else if (kind === 'tk') saveAcc({ name: r[0], type: r[2], open: r[3] });
  else if (kind === 'dm') saveCat({ t: r[2], p: r[6], c: r[7] });
  d.getRange(i + 1, 12).setValue(nowStr());
}

/* ---- TÔ LỖI TRÊN GSHEET ---- */
function clearFlags(s, row, ncols) {
  const rg = s.getRange(row, 1, 1, ncols), B = rg.getBackgrounds()[0];
  B.forEach((b, c) => { b = String(b).toLowerCase(); if (b === RED || b === YEL) s.getRange(row, c + 1).setBackground(null).setNote(''); });
}
function applyFlags(s, rows, ncols, map) {
  if (!rows.length) return;
  const first = rows[0].n, rg = s.getRange(first, 1, rows.length, ncols), B = rg.getBackgrounds(), N = rg.getNotes();
  rows.forEach((r, i) => {
    const want = {};
    r.P.forEach(p => { const cc = map ? map(p.c) : p.c; if (!cc) return; const w = want[cc] || (want[cc] = { lv: p.lv, msg: '' }); w.msg += (w.msg ? '; ' : '') + p.msg; if (p.lv === 'err') w.lv = 'err'; });
    for (let c = 1; c <= ncols; c++) {
      const w = want[c], bg = String(B[i][c - 1]).toLowerCase(), cell = () => s.getRange(first + i, c);
      if (w) { const col = w.lv === 'err' ? RED : YEL; if (bg !== col) cell().setBackground(col); if (N[i][c - 1] !== w.msg) cell().setNote(w.msg); }
      else if (bg === RED || bg === YEL) cell().setBackground(null).setNote('');
    }
  });
}
function flagTx(first, last, ctx) {
  const g = need(TAB.tx); last = Math.min(last, g.getLastRow()); if (last < first) return [];
  const c = txCols_(), V = g.getRange(first, 1, last - first + 1, c.lc).getValues(), rows = V.map((v, i) => ({ n: first + i, P: TX_CORE_.every(k => v[c[k] - 1] === '') ? [] : txProblems(txObj(v, c), ctx) }));
  applyFlags(g, rows, c.lc, x => c[LOGI_[x]]); return rows.filter(r => r.P.length);
}
function revalidateAll() {
  const A = accRows(), C = catRows(), ctx = makeCtx(A, C), L = limRows(ctx.chiParents);
  applyFlags(need(TAB.acc), A, 3); applyFlags(need(TAB.cat), C, 3);
  if (opt(TAB.lim) && L.length) applyFlags(opt(TAB.lim), L, 3);
  const T = flagTx(2, need(TAB.tx).getLastRow(), ctx), all = T.concat(A, C, L).filter(r => r.P.length);
  return { err: all.filter(r => r.P.some(p => p.lv === 'err')).length, warn: all.filter(r => !r.P.some(p => p.lv === 'err')).length };
}
