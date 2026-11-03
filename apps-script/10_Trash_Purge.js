/* ===== 10_Trash_Purge.gs — xóa hẳn khỏi thùng rác + dọn ảnh trên Drive (file mới) ===== */
// Lấy ID file Drive từ các liên kết ảnh trong một ô
const fileIds_ = text => (String(text == null ? '' : text).match(IMG_RE) || []).map(u => (u.match(/\/d\/([\w-]+)/) || [])[1]).filter(Boolean);

// ID ảnh còn được dùng: giao dịch đang có (Ghi chú + cột Ảnh) và các mục thùng rác khác (bỏ qua các dòng đang xóa)
function imgsInUse_(skipRows) {
  const used = {}, g = opt(TAB.tx), skip = skipRows || {};
  if (g && g.getLastRow() > 1) {
    const c = txCols_(), n = g.getLastRow() - 1, ic = imgCol_(g);
    g.getRange(2, c.note, n, 1).getValues().forEach(v => fileIds_(v[0]).forEach(i => used[i] = 1));
    if (ic) g.getRange(2, ic, n, 1).getValues().forEach(v => fileIds_(v[0]).forEach(i => used[i] = 1));
  }
  const d = opt(TAB.del);
  if (d && d.getLastRow() > 1)
    d.getRange(2, 1, d.getLastRow() - 1, 12).getValues().forEach((r, i) => { if (r[11] === '' && !skip[i + 2]) fileIds_(r[8]).forEach(x => used[x] = 1); });
  return used;
}
// Chuyển ảnh vào thùng rác của Drive — CHỈ ảnh nằm trong thư mục ảnh của sổ và không còn nơi nào dùng
function trashImgs_(ids, skipRows) {
  ids = uniq_(ids || []); if (!ids.length) return 0;
  const used = imgsInUse_(skipRows); let k = 0;
  ids.forEach(id => {
    if (used[id]) return;
    try {
      const f = DriveApp.getFileById(id), ps = f.getParents(); let inside = false;
      while (ps.hasNext()) if (ps.next().getId() === DRIVE_FOLDER_ID) inside = true;
      if (inside) { f.setTrashed(true); k++; }
    } catch (e) { Logger.log('Ảnh ' + id + ': ' + e); }
  });
  return k;
}
/* Op 'trash.purge' — items: [{at, kind, id}]. Gom nhiều mục vào một lần để chỉ quét sổ một lần. Chạy lại nhiều lần vẫn an toàn. */
function trashPurge(items) {
  items = (Array.isArray(items) ? items : []).filter(x => x && x.at);
  if (!items.length) return;
  const d = dx(), v = d.getDataRange().getValues(), kill = [], ids = [], skip = {};
  items.forEach(it => {
    const i = v.findIndex((r, k) => k > 0 && String(r[9]) === String(it.at) && r[10] === it.kind && r[11] === '' && (!it.id || str(r[0]) === str(it.id)));
    if (i < 0 || skip[i + 1]) return;
    skip[i + 1] = 1; kill.push(i + 1);
    if (it.kind === 'gd') fileIds_(v[i][8]).forEach(x => ids.push(x));
  });
  if (!kill.length) return;
  trashImgs_(ids, skip);                                   // dọn ảnh trước, rồi mới xóa dòng
  kill.sort((a, b) => b - a).forEach(r => deleteRowSafe_(d, r));
}
