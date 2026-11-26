// ===== 12_QuanLy — tab "QuanLy" + menu "Quản lý nâng cao" =====
// File riêng, được Code chính gọi qua: qlMenu_(ui) trong onOpen và qlAuto_() trong capNhatTuDong_.
// Dùng lại các hàm có sẵn: withLock, readAll, readTrash, trashPurge, revalidateAll, quetLoiTatCa_, installTriggers, saoLuu_, sessGet_...
const QL_TAB = 'QuanLy', QL_LOG_HEAD = 40, QL_LOG_MAX = 300;   // nhật ký thao tác bắt đầu ở dòng 40 (tiêu đề cột), mới nhất nằm trên cùng
const QL_BG = '#5B3DF5';

// ---------- Menu ----------
function qlMenu_(ui) {
  return ui.createMenu('Quản lý nâng cao')
    .addItem('Mở / làm mới bảng Quản lý', 'qlMo')
    .addSeparator()
    .addItem('Khóa tất cả phiên thiết bị (buộc đăng nhập lại)', 'qlKhoaPhien')
    .addItem('Dọn thùng rác cũ…', 'qlDonThung')
    .addItem('Kiểm tra dữ liệu + quét lỗi công thức', 'qlKiemTra')
    .addItem('Cài lại trigger tự động', 'qlSuaTrigger')
    .addItem('Sao lưu ngay (có ghi nhật ký)', 'qlSaoLuu');
}

// ---------- Tab QuanLy ----------
const jget_ = k => { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(k) || 'null'); } catch (e) { return null; } };
function qlSheet_() {
  let s = opt(QL_TAB);
  if (!s) {
    s = ss().insertSheet(QL_TAB);
    s.setHiddenGridlines(true);
    s.setColumnWidth(1, 260); s.setColumnWidth(2, 330); s.setColumnWidth(3, 460);
  }
  return s;
}
function qlAuto_() { if (opt(QL_TAB)) safe(qlBuild_, null); }   // gọi từ capNhatTuDong_ (đã giữ khóa) — chỉ làm mới nếu tab đã được tạo

function qlMo() {
  withLock(qlBuild_);
  ss().setActiveSheet(qlSheet_());
}

function qlBuild_() {
  const s = qlSheet_(), R = [], sec = t => R.push([t, '', '', 1]), kv = (a, b, c) => R.push([a, b == null ? '' : b, c || '', 0]);
  const st = safe(readAll, null) || { tx: [], acc: [], cat: [], lim: [], trash: [], issues: [] };

  sec('HỆ THỐNG');
  kv('Phiên bản script', VER);
  kv('Múi giờ / ngôn ngữ', tz() + ' / ' + ss().getSpreadsheetLocale());
  kv('Spreadsheet ID', ss().getId());
  const trg = safe(() => ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction()), []);
  kv('Trigger tự động', trg.length + ' trigger', trg.length ? trg.join(', ') : '⚠ Chưa cài — menu Quản lý nâng cao → Cài lại trigger');
  const at = +(PropertiesService.getScriptProperties().getProperty('TUSUA_AT') || 0);
  kv('Lần tự sửa gần nhất', at ? Utilities.formatDate(new Date(at), tz(), 'yyyy-MM-dd HH:mm:ss') : 'Chưa chạy');
  kv('Khóa API (KEY)', prop_('KEY') ? 'Đã cấu hình' : '⚠ THIẾU — web sẽ không kết nối được');
  kv('Thư mục ảnh Drive', driveFolderId_() ? 'Đã cấu hình' : '⚠ THIẾU DRIVE_FOLDER_ID', safe(() => driveFolderId_() ? DriveApp.getFolderById(driveFolderId_()).getName() : '', '⚠ Không mở được thư mục (chưa cấp quyền?)'));

  sec('PHIÊN THIẾT BỊ (phía Google Sheet)');
  const ss_ = sessGet_();
  kv('Số thiết bị được phép', ss_ === null ? 'Chưa giới hạn' : ss_.length + ' / ' + MAX_SESS, ss_ === null ? 'Chưa có thiết bị nào đăng nhập từ khi bật tính năng' : (ss_.length ? 'Mã phiên: ' + ss_.map(x => String(x).slice(0, 6) + '…').join(', ') : 'Đang khóa: mọi thiết bị phải đăng nhập lại'));
  const lh = jget_('LH_OK') || [], lf = jget_('LH_FAIL') || [], rv = +(PropertiesService.getScriptProperties().getProperty('REVOKED') || 0);
  const fmt_ = t => Utilities.formatDate(new Date(t), tz(), 'yyyy-MM-dd HH:mm');
  kv('Đăng nhập thành công gần nhất', lh[0] ? fmt_(lh[0].t) : 'Chưa có', lh[0] ? lh[0].d + ' · IP ' + lh[0].ip + ' · ' + lh[0].m : '');
  kv('Sai mật khẩu gần nhất', lf[0] ? fmt_(lf[0].t) : 'Chưa có', lf[0] ? lf[0].d + ' · IP ' + lf[0].ip : '');
  kv('Thu hồi đăng nhập gần nhất', rv ? fmt_(rv) : 'Chưa lần nào');
  kv('Passkey đã đăng ký', Object.keys(PropertiesService.getScriptProperties().getProperties()).filter(k => k.indexOf('PK_') === 0).length, 'Xem và xóa ở web: Cài đặt → Đăng nhập và thiết bị');

  sec('SỐ LIỆU');
  kv('Giao dịch', st.tx.length);
  kv('Tài khoản / Hạng mục / Hạn mức', st.acc.length + ' / ' + st.cat.length + ' / ' + st.lim.length);
  kv('Thùng rác', st.trash.length, st.trash.length >= TRASH_SHOW ? 'Chỉ đếm ' + TRASH_SHOW + ' mục mới nhất' : '');
  const er = st.issues.filter(i => i.lv === 'err').length, wr = st.issues.length - er;
  kv('Dòng LỖI / cảnh báo', er + ' / ' + wr, er ? '⚠ Dòng lỗi không được tính vào số liệu — bấm "Kiểm tra dữ liệu" để tô màu' : '');
  const fe = safe(quetLoiTatCa_, {});
  kv('Ô lỗi công thức', tongLoi_(fe), Object.keys(fe).map(k => k + ' ' + fe[k]).join(' · '));

  sec('SAO LƯU (thư mục SoThuChi_SaoLuu)');
  const bk = safe(() => {
    const it = DriveApp.getRootFolder().getFoldersByName('SoThuChi_SaoLuu'); if (!it.hasNext()) return [];
    const fs = it.next().getFiles(), L = []; while (fs.hasNext()) { const f = fs.next(); L.push([f.getName(), f.getDateCreated().getTime()]); }
    return L.sort((a, b) => b[1] - a[1]);
  }, []);
  kv('Số bản sao lưu', bk.length, 'Giữ tối đa ' + BACKUP_KEEP + ' bản');
  bk.slice(0, 5).forEach((x, i) => kv(i ? '' : 'Gần nhất', x[0], Utilities.formatDate(new Date(x[1]), tz(), 'yyyy-MM-dd HH:mm')));

  // ghi khối thông tin (dòng 1 = tiêu đề, dòng 2 = giờ cập nhật, từ dòng 4)
  const maxRows = QL_LOG_HEAD - 5, body = R.slice(0, maxRows);
  s.getRange(1, 1, QL_LOG_HEAD - 2, 4).clear();
  s.getRange(1, 1).setValue('QUẢN LÝ NÂNG CAO').setFontSize(16).setFontWeight('bold').setFontColor(QL_BG);
  s.getRange(2, 1).setValue('Cập nhật lúc ' + nowStr() + ' · làm mới: menu Sổ Thu Chi → Quản lý nâng cao').setFontColor('#6b7280');
  if (body.length) {
    const rg = s.getRange(4, 1, body.length, 3);
    rg.setValues(body.map(r => r.slice(0, 3))).setVerticalAlignment('middle').setWrap(true);
    body.forEach((r, i) => {
      const line = s.getRange(4 + i, 1, 1, 3);
      if (r[3]) line.setBackground(QL_BG).setFontColor('#ffffff').setFontWeight('bold');
      else { s.getRange(4 + i, 1).setFontWeight('bold'); s.getRange(4 + i, 3).setFontColor('#6b7280'); if (/^⚠/.test(String(r[1]) + String(r[2]))) line.setBackground(YEL); }
    });
    s.getRange(4, 2, body.length, 1).setHorizontalAlignment('left');
  }
  qlLogHead_(s);
  return body.length;
}

// ---------- Nhật ký thao tác ----------
function qlLogHead_(s) {
  if (s.getMaxRows() < QL_LOG_HEAD + 1) s.insertRowsAfter(s.getMaxRows(), QL_LOG_HEAD + 1 - s.getMaxRows());
  s.getRange(QL_LOG_HEAD - 1, 1).setValue('NHẬT KÝ THAO TÁC').setFontWeight('bold').setFontColor(QL_BG);
  if (str(s.getRange(QL_LOG_HEAD, 1).getValue()) === '')
    s.getRange(QL_LOG_HEAD, 1, 1, 3).setValues([['Thời gian', 'Thao tác', 'Chi tiết']]).setFontWeight('bold').setBackground('#e5e7eb');
}
function qlLog_(act, detail) {
  safe(() => {
    const s = qlSheet_(); qlLogHead_(s);
    const who = safe(() => Session.getActiveUser().getEmail(), '') || '';
    s.insertRowBefore(QL_LOG_HEAD + 1);
    s.getRange(QL_LOG_HEAD + 1, 1, 1, 3).setValues([[nowStr(), act, (who ? who + ' — ' : '') + (detail || '')]]).setFontWeight('normal').setBackground(null).setFontColor('#111827');
    const extra = s.getLastRow() - (QL_LOG_HEAD + QL_LOG_MAX);
    if (extra > 0) s.deleteRows(QL_LOG_HEAD + QL_LOG_MAX + 1, extra);
  }, null);
}
const qlOk_ = (t, m) => { const u = SpreadsheetApp.getUi(); return u.alert(t, m, u.ButtonSet.YES_NO) === u.Button.YES; };
const qlInfo_ = (t, m) => SpreadsheetApp.getUi().alert(t, m, SpreadsheetApp.getUi().ButtonSet.OK);

// ---------- Thao tác ----------
function qlKhoaPhien() {
  if (!qlOk_('Khóa tất cả phiên thiết bị?', 'Mọi thiết bị (kể cả web đang mở) sẽ bị báo "phiên đã bị khóa" và phải đăng nhập lại. Dữ liệu không bị ảnh hưởng.\n\nMuốn thu hồi cookie đăng nhập: web → Cài đặt → Đăng nhập và thiết bị.')) return;
  withLock(() => PropertiesService.getScriptProperties().setProperty('SESS', '[]'));
  qlLog_('Khóa phiên thiết bị', 'Đặt danh sách phiên về rỗng');
  withLock(qlBuild_);
  ss().toast('Đã khóa mọi phiên thiết bị', 'Sổ Thu Chi', 5);
}

function qlDonThung() {
  const ui = SpreadsheetApp.getUi(), r = ui.prompt('Dọn thùng rác', 'Xóa vĩnh viễn các mục đã xóa cách đây hơn bao nhiêu ngày? (ảnh đính kèm không còn dùng cũng bị bỏ vào thùng rác Drive)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const days = parseInt(str(r.getResponseText()), 10);
  if (!(days >= 1 && days <= 3650)) { qlInfo_('Không hợp lệ', 'Hãy nhập số ngày từ 1 đến 3650.'); return; }
  const cut = Date.now() - days * 86400000;
  const items = readTrash(100000).filter(t => { const d = parseAt_(t.at); return d && d.getTime() < cut; }).map(t => ({ at: t.at, kind: t.k, id: t.id }));
  if (!items.length) { qlInfo_('Dọn thùng rác', 'Không có mục nào cũ hơn ' + days + ' ngày.'); return; }
  if (!qlOk_('Xóa vĩnh viễn ' + items.length + ' mục?', 'Không khôi phục được sau khi xóa.')) return;
  withLock(() => trashPurge(items));
  qlLog_('Dọn thùng rác', 'Xóa ' + items.length + ' mục cũ hơn ' + days + ' ngày');
  withLock(qlBuild_);
  ss().toast('Đã xóa ' + items.length + ' mục', 'Sổ Thu Chi', 5);
}

function qlKiemTra() {
  const v = withLock(revalidateAll), q = safe(quetLoiTatCa_, {});
  const t = 'Dòng LỖI (đỏ): ' + v.err + '\nDòng cảnh báo (vàng): ' + v.warn + '\nÔ lỗi công thức: ' + tongLoi_(q) + (tongLoi_(q) ? '\n' + Object.keys(q).map(k => '  • ' + k + ': ' + q[k]).join('\n') : '');
  qlLog_('Kiểm tra dữ liệu', t.replace(/\n/g, '; '));
  withLock(qlBuild_);
  qlInfo_('Kết quả kiểm tra', t);
}

function qlSuaTrigger() {
  if (!qlOk_('Cài lại trigger tự động?', 'Xóa và tạo lại các trigger: sửa ô, thay đổi bảng, mở file, và mỗi 10 phút.')) return;
  installTriggers();
  qlLog_('Cài lại trigger', 'Đã cài 4 trigger');
  withLock(qlBuild_);
  ss().toast('Đã cài lại trigger', 'Sổ Thu Chi', 5);
}

function qlSaoLuu() {
  try { const n = saoLuu_(); qlLog_('Sao lưu', n); withLock(qlBuild_); ss().toast('Đã sao lưu: ' + n, 'Sổ Thu Chi', 6); }
  catch (e) { qlLog_('Sao lưu LỖI', String(e.message || e)); qlInfo_('Chưa sao lưu được', String(e.message || e)); }
}