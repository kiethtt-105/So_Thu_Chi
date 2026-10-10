/************************************************************
 * Upload.gs — nhận ảnh đã nén từ web và lưu vào thư mục Drive
 * Thêm file này vào CÙNG project Apps Script với Code.gs.
 ************************************************************/
const DRIVE_FOLDER_ID = '1Xj-nZA81dGuFGnDY5YXen_bK8w3zQm3G';
const IMG_MAX_B64 = 14e6;                       // ~10 MB sau khi giải mã (ảnh đã nén nên thường < 0,5 MB)

function uploadImage(img) {
  if (!img || !img.data) throw new Error('Thiếu dữ liệu ảnh');
  if (img.data.length > IMG_MAX_B64) throw new Error('Ảnh quá lớn');
  const mime = /^image\/(jpeg|png|webp)$/.test(img.mime) ? img.mime : 'image/jpeg';
  const name = String(img.name || 'anh.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 90);
  const blob = Utilities.newBlob(Utilities.base64Decode(img.data), mime, name);
  const f = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
  return { ok: true, id: f.getId(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', name: f.getName(), size: f.getSize() };
}

/* Chạy hàm này MỘT LẦN trong trình soạn thảo để cấp quyền Drive */
function capQuyenDrive() { DriveApp.getFolderById(DRIVE_FOLDER_ID).getName(); }
