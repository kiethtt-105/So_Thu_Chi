/* ===== 06_Auto_Triggers.gs — tự động cập nhật, trigger, bắt lỗi khi sửa tay ===== */
function onOpenInstalled() { safe(tuDongCapNhat, null); }          // trigger "khi mở bảng tính" (F5 cũng tính là mở lại)
function tuDongCapNhat() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try { capNhatTuDong_(); } finally { lock.releaseLock(); }
}
function capNhatTuDong_() {
  _sep = null;
  ensureSystemTabs([]);
  autoDat_();                     // 0) công thức chuẩn theo vị trí cột hiện tại
  healFormulas();                 // 1) khôi phục công thức từ bản chuẩn
  safe(sapXepGiaoDich_, null);    // 1b) giao dịch mới nhất lên đầu
  autoDat_();                     // 2) ghi lại công thức chuẩn trong code (chỉ ghi khi khác)
  capNhatSoDuCuoi_();             // 3) "Số dư cuối" (cũng chỉ ghi khi đổi)
  safe(capNhatThang_, null);
  CacheService.getScriptCache().remove('rev'); SpreadsheetApp.flush();
}
function autoDat_() {
  _chg = 0;
  safe(datCongThucTaiKhoan_, 0); safe(datDanhMuc_, 0); safe(datTongQuan_, 0);
  if (_chg || fxBaselineBad_()) saveFormulas();   // công thức vừa đổi, hoặc bản chuẩn đang hỏng / lệch cột → dựng lại
  return _chg;
}
/* Bản chuẩn _CongThuc hỏng (#REF!, =0) hoặc không khớp công thức thật của vùng → coi là hỏng. */
function fxBaselineBad_() {
  try {
    const st = opt(TAB.fx); if (!st || st.getLastRow() < 2) return false;
    return st.getRange(2, 1, st.getLastRow() - 1, 4).getValues().some(([sn, mode, key, f1]) => {
      const z = ZONES.find(x => x.sheet === sn); if (!z || !sn) return false;
      if (badFx(f1)) return true;
      if (mode !== 'fill') return false;
      const s = opt(sn); if (!s) return false;
      const [c, top] = String(key).split(':').map(Number); if (!c || !top) return true;
      return s.getRange(top, c).getFormulaR1C1() !== f1;
    });
  } catch (e) { return false; }
}

/* Xóa / chèn / sắp xếp dòng, đổi cột trong Gsheet KHÔNG bắn onEdit → dùng onChange */
function onChangeInstalled(e) {
  try { CacheService.getScriptCache().remove('rev'); } catch (x) {}
  if (e && e.changeType === 'EDIT') return;                         // sửa ô đã có onEditInstalled lo
  const lock = LockService.getScriptLock(); if (!lock.tryLock(8000)) return;
  try { safe(capNhatTuDong_, null); } finally { lock.releaseLock(); }
}

/* ---- SỬA TAY TRÊN GSHEET → BÁO LỖI NGAY ---- */
function onEditInstalled(e) {
  if (!e || !e.range) return;
  const s = e.range.getSheet(), name = s.getName();
  if (![TAB.tx, TAB.acc, TAB.cat, TAB.lim].includes(name)) return;
  CacheService.getScriptCache().remove('rev');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(8000)) return;
  const msgs = [];
  try {
    const r = e.range, first = Math.max(r.getRow(), 2), last = r.getRow() + r.getNumRows() - 1;
    if (last < 2) return;
    if (name === TAB.tx) {
      { const c = txCols_(); if (r.getNumColumns() === 1 && [c.sdc, c.month, c.img].includes(r.getColumn())) return; }   // sửa cột script tự tính → bỏ qua
      normalizeTx(first, Math.min(last, first + 499));
      flagTx(first, Math.min(last, first + 499), getCtx()).forEach(x => msgs.push('Dòng ' + x.n + ': ' + x.P.map(p => p.msg).join('; ')));
    } else {
      if (name === TAB.acc) lamTronCot_(s, 3, MAX_ACC);                  // số dư ban đầu luôn nguyên
      if (name === TAB.lim) lamTronCot_(s, 3, MAX_LIM);                  // hạn mức luôn nguyên
      guardMaster(e, name, msgs);
      _ctx = null;
      const A = accRows(), C = catRows(), ctx = makeCtx(A, C), L = limRows(ctx.chiParents);
      applyFlags(need(TAB.acc), A, 3); applyFlags(need(TAB.cat), C, 3); if (opt(TAB.lim) && L.length) applyFlags(opt(TAB.lim), L, 3);
      const sel = { [TAB.acc]: A, [TAB.cat]: C, [TAB.lim]: L }[name] || [];
      sel.filter(x => x.n >= first && x.n <= last && x.P.length).forEach(x => msgs.push('Dòng ' + x.n + ': ' + x.P.map(p => p.msg).join('; ')));
    }
    if (name === TAB.tx || name === TAB.acc) safe(capNhatSoDuCuoi_, null);   // tính lại "Số dư cuối"
    if (name === TAB.tx) safe(capNhatThang_, null);
  } finally { lock.releaseLock(); }
  if (msgs.length) ss().toast(msgs.slice(0, 4).join('\n'), 'Sổ Thu Chi · ' + name, 15);
}
function guardMaster(e, name, msgs) {
  const r = e.range; if (r.getNumRows() !== 1 || r.getNumColumns() !== 1 || r.getRow() < 2) return;
  const col = r.getColumn(), row = r.getRow(), nv = str(r.getValue()), ov = e.oldValue === undefined ? '' : str(e.oldValue);
  if (ov === nv || !ov) return;
  const back = m => { r.setValue(ov); msgs.push(m); };
  if (name === TAB.acc && col === 1) {
    if (!nv) { if (usesAcc(ov)) back('Tài khoản "' + ov + '" đang có giao dịch — không xóa được, đã hoàn tác'); }
    else if (block(need(TAB.acc), MAX_ACC, 1).some((v, i) => i + 2 !== row && str(v[0]) === nv)) back('Tên tài khoản "' + nv + '" đã tồn tại — đã hoàn tác');
    else { const k = renameTx(['acc', 'accTo'], ov, nv); if (k) msgs.push('Đã đổi tên tài khoản "' + ov + '" → "' + nv + '" trong ' + k + ' ô của GiaoDich'); }
  } else if (name === TAB.cat && col <= 3) {
    const V = block(need(TAB.cat), MAX_CAT, 3), cur = V[row - 2].map(str), old = cur.slice(); old[col - 1] = ov;
    if (!nv) { if (usesCat(old[0], old[1], old[2])) back('Hạng mục "' + old[1] + ' › ' + old[2] + '" đang có giao dịch — không xóa được, đã hoàn tác'); }
    else if (col === 1) { if (usesCat(old[0], old[1], old[2])) back('Hạng mục đang có giao dịch — không đổi loại Chi/Thu được, đã hoàn tác'); }
    else if (col === 3 && V.some((v, i) => i + 2 !== row && str(v[0]) === cur[0] && str(v[2]) === nv)) back('Đã có hạng mục con "' + nv + '" — đã hoàn tác');
    else {
      const k = renameCat(old[0], old[1], old[2], cur[1], cur[2]); if (k) msgs.push('Đã đổi hạng mục trong ' + k + ' giao dịch');
      if (col === 2 && !V.some((v, i) => i + 2 !== row && str(v[0]) === 'Chi' && str(v[1]) === ov)) renameLimCat(ov, nv);
    }
  }
}

/* HÀM 2 — SỬA LẠI GSHEET (menu; lần đầu dùng để cài trigger). silent = true (trigger 10 phút): không đụng ràng buộc / trigger */
function suaGsheet(silent) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const L = [];
  try {
    _sep = null;
    ensureSystemTabs(L);
    autoDat_(); const f = healFormulas(); L.push(f.first ? '• Công thức: lần đầu — đã lưu công thức hiện tại làm chuẩn (' + f.saved + ' vùng)' : '• Công thức: đã khôi phục ' + f.fixed + ' ô/dòng');
    if (!silent) L.push(datTatCa_()); else autoDat_();
    const n = normalizeTx(2, need(TAB.tx).getLastRow()); L.push('• Chuẩn hóa GiaoDich: sửa ' + n + ' ô (ID / ngày / loại / số tiền, gồm làm tròn số lẻ)');
    const lt = lamTronCot_(need(TAB.acc), 3, MAX_ACC) + (opt(TAB.lim) ? lamTronCot_(opt(TAB.lim), 3, MAX_LIM) : 0); if (lt) L.push('• Đã làm tròn ' + lt + ' ô số dư ban đầu / hạn mức về số nguyên');
    const ta = tachAnh_(); if (ta) L.push('• Đã tách link ảnh khỏi Ghi chú sang cột "' + IMG_HEAD + '": ' + ta + ' dòng');
    safe(sapXepGiaoDich_, null);
    capNhatSoDuCuoi_();
    capNhatThang_();
    if (!silent) { applyValidation(); installTriggers(); L.push('• Đã cài ràng buộc nhập liệu và trigger TỰ ĐỘNG (mở/F5, xóa-chèn dòng, mỗi 10 phút)'); }
    const v = revalidateAll(); L.push('• Kiểm tra dữ liệu: ' + v.err + ' dòng LỖI (đỏ, không tính vào số liệu), ' + v.warn + ' dòng cảnh báo (vàng)');
    CacheService.getScriptCache().remove('rev'); SpreadsheetApp.flush();
    return { ok: true, text: L.join('\n') };
  } finally { lock.releaseLock(); }
}
function tuSua() { suaGsheet(true); }   // trigger 10 phút

function installTriggers() {
  const mine = ['onEditInstalled', 'onChangeInstalled', 'onOpenInstalled', 'tuSua', 'tuDongCapNhat', 'heal', 'tuSuaGsheet', 'saoLuuTuDong'];
  ScriptApp.getProjectTriggers().forEach(t => { if (mine.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss()).onEdit().create();
  ScriptApp.newTrigger('onChangeInstalled').forSpreadsheet(ss()).onChange().create();
  ScriptApp.newTrigger('onOpenInstalled').forSpreadsheet(ss()).onOpen().create();   // mở / F5 → tự cập nhật công thức
  ScriptApp.newTrigger('tuSua').timeBased().everyMinutes(10).create();
}
