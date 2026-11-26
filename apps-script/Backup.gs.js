// Backup.gs: file riêng trong dự án Apps Script (cùng dự án với Code.gs).
// Ghi bản sao JSON của sổ vào Google Drive: thư mục SoThuChi-Backup (ở GỐC Drive),
//   so-thu-chi.json            = bản mới nhất (ghi đè)
//   so-thu-chi-YYYY-MM-DD.json = bản theo ngày, giữ BK_KEEP bản gần nhất
// Cần 3 chỗ sửa nhỏ trong Code.gs: xem PATCH_Code.gs.txt
var BK_FOLDER = 'SoThuChi-Backup';
var BK_KEEP = 14;

function bkPut_(dir, name, text) {
  var it = dir.getFilesByName(name);
  if (it.hasNext()) { var f = it.next(); f.setContent(text); return f; }
  return dir.createFile(name, text, MimeType.PLAIN_TEXT);
}

// Tìm thư mục ở GỐC Drive (không lấy nhầm thư mục trùng tên được chia sẻ)
function bkDir_() {
  var root = DriveApp.getRootFolder(), it = root.getFoldersByName(BK_FOLDER);
  return it.hasNext() ? it.next() : root.createFolder(BK_FOLDER);
}

// Bổ sung vào JSON: dòng GiaoDich bị lỗi đỏ (không có trong "tx") và TOÀN BỘ thùng rác (không giới hạn 1000)
function backupExtras_() {
  var x = { note: 'dropped = dòng GiaoDich lỗi đỏ nên không có trong tx; trashFull = toàn bộ thùng rác', dropped: [], trashFull: [] };
  try {
    var g = need(TAB.tx), n = g.getLastRow();
    if (n >= 2) {
      var c = txCols_(), R = g.getRange(2, 1, n - 1, c.lc), V = R.getValues(), D = R.getDisplayValues(), ctx = getCtx();
      V.forEach(function (v, i) {
        if (TX_CORE_.every(function (k) { return v[c[k] - 1] === ''; })) return;
        var P = txProblems(txObj(v, c), ctx);
        if (P.some(function (p) { return p.lv === 'err'; })) x.dropped.push({ row: i + 2, v: D[i], err: P.map(function (p) { return p.msg; }).join('; ') });
      });
    }
  } catch (e) { x.droppedErr = String(e); }
  try { x.trashFull = readTrash(1e9); } catch (e) { x.trashErr = String(e); }
  return x;
}
// Gắn phần bổ sung vào JSON do Vercel gửi lên; lỗi thì giữ nguyên bản gốc
function withExtras_(b) {
  try {
    var o = JSON.parse(String((b && b.json) || ''));
    o.extra = backupExtras_();
    return { json: JSON.stringify(o) };
  } catch (e) { return b; }
}

// b = { json: '<chuỗi JSON của sổ>' }  ->  { ok, saved, size, url, name }
function backupPut_(b) {
  var json = String((b && b.json) || '');
  if (!json) return { ok: false, err: 'Dữ liệu sao lưu rỗng' };
  if (json.length > 40 * 1024 * 1024) return { ok: false, err: 'Dữ liệu sao lưu quá lớn' };
  try { JSON.parse(json); } catch (e) { return { ok: false, err: 'JSON sao lưu không hợp lệ' }; }
  var dir = bkDir_();
  var day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var latest = bkPut_(dir, 'so-thu-chi.json', json);
  bkPut_(dir, 'so-thu-chi-' + day + '.json', json);
  // dọn bản theo ngày cũ
  var names = [], files = dir.getFiles();
  while (files.hasNext()) {
    var f = files.next(), n = f.getName();
    if (/^so-thu-chi-\d{4}-\d{2}-\d{2}\.json$/.test(n)) names.push(n);
  }
  names.sort().reverse().slice(BK_KEEP).forEach(function (n) {
    var d = dir.getFilesByName(n);
    while (d.hasNext()) d.next().setTrashed(true);
  });
  return { ok: true, saved: true, size: json.length, url: latest.getUrl(), name: 'so-thu-chi.json' };
}

// Chạy tay một lần trong trình soạn thảo để cấp quyền Drive và thử:
function bkTest() {
  Logger.log(JSON.stringify(backupPut_({ json: '{"app":"so-thu-chi","test":true}' })));
}