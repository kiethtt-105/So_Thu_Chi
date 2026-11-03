/* ===== 09_Menu.gs — menu Sổ Thu Chi (thay cho 09_Menu_Backup.gs; đã bỏ toàn bộ chức năng sao lưu) ===== */
function withLock(fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return fn(); } finally { CacheService.getScriptCache().remove('rev'); lock.releaseLock(); }
}
function daCaiTuDong_() {
  try { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'onEditInstalled'); }
  catch (e) { return true; }   // trigger đơn giản không đủ quyền kiểm tra → coi như đã cài, không báo nhầm
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sổ Thu Chi')
    .addItem('Thêm giao dịch', 'moThanhBen')
    .addItem(daCaiTuDong_() ? 'Đồng bộ & sửa công thức' : '⚠ Cài đặt lần đầu (bấm 1 lần)', 'menuDongBo')
    .addToUi();
}
function menuDongBo() {
  if (!daCaiTuDong_()) { SpreadsheetApp.getUi().alert('Kết quả', suaGsheet(false).text, SpreadsheetApp.getUi().ButtonSet.OK); return; }
  withLock(capNhatTuDong_);
  ss().toast('Đã đồng bộ số liệu và dựng lại công thức', 'Sổ Thu Chi', 5);
}
/* CHẠY MỘT LẦN trong trình soạn thảo: gỡ trigger sao lưu hằng đêm cũ (hàm saoLuuTuDong đã bị xóa) */
function xoaTriggerSaoLuu() {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'saoLuuTuDong') { ScriptApp.deleteTrigger(t); n++; } });
  Logger.log('Đã gỡ ' + n + ' trigger sao lưu');
}


/* ---- SAO LƯU: chép nguyên bảng tính vào thư mục riêng tư "SoThuChi_SaoLuu" ở gốc Drive, giữ 14 bản mới nhất ---- */
function saoLuu_() {
  const root = DriveApp.getRootFolder(), it = root.getFoldersByName('SoThuChi_SaoLuu'), dir = it.hasNext() ? it.next() : root.createFolder('SoThuChi_SaoLuu');   // thư mục RIÊNG TƯ (không chung với thư mục ảnh)
  const name = 'SO_THU_CHI_saoluu_' + Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd_HH-mm');
  DriveApp.getFileById(ss().getId()).makeCopy(name, dir);
  const L = []; const fs = dir.getFiles(); while (fs.hasNext()) { const f = fs.next(); L.push([f, f.getDateCreated().getTime()]); }
  L.sort((a, b) => b[1] - a[1]).slice(BACKUP_KEEP).forEach(x => x[0].setTrashed(true));
  return name;
}
function saoLuuTuDong() { safe(saoLuu_, null); }   // trigger hằng đêm
function menuSaoLuu() {
  try { ss().toast('Đã sao lưu: ' + saoLuu_(), 'Sổ Thu Chi', 6); }
  catch (e) { SpreadsheetApp.getUi().alert('Chưa sao lưu được', String(e.message || e), SpreadsheetApp.getUi().ButtonSet.OK); }
}
