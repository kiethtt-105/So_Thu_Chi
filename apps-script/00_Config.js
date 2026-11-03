/* ===== 00_Config.gs — hằng số cấu hình (PHẢI đứng đầu danh sách file) ===== */
const VER = 'v20';
const FALLBACK_SHEET_ID = '10yJGQB7IalkqKE8b1nYu2YG78DOURNTtss7sPRbwmKE';
const TAB = { tx: 'GiaoDich', acc: 'TaiKhoan', cat: 'DanhMuc', lim: 'HanMuc', del: 'DaXoa', fx: '_CongThuc' };
const TYPES = ['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'];
const ACC_TYPES = ['Tiền mặt', 'Ngân hàng', 'Thẻ tín dụng', 'Ví điện tử', 'Tiết kiệm', 'Giữ Hộ'];   // "Giữ Hộ": tiền giữ hộ người khác, web không tính vào báo cáo
const PERIODS = ['Ngày', 'Tháng'];
// Dung lượng khớp với bảng tính: TaiKhoan dòng 2–21 (20 TK, dòng 22 = TỔNG), DanhMuc dòng 2–101 (100 hạng mục con; công thức cột D, ràng buộc cột A), HanMuc dòng 2–201
const MAX_ACC = 20, MAX_CAT = 100, MAX_LIM = 200;
const CAT_LAST_ = MAX_CAT + 1, ACC_LAST_ = MAX_ACC + 1;   // dòng cuối vùng dữ liệu DanhMuc / TaiKhoan
const RED = '#fecaca', YEL = '#fef3c7';   // màu tô ô lỗi / ô cảnh báo
const SDC_HEAD = 'Số dư cuối';
const IMG_HEAD = 'Ảnh';
const THANG_HEAD = 'Tháng';
const IMG_RE = /https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view\S*/g;

const DRIVE_FOLDER_ID = '1Xj-nZA81dGuFGnDY5YXen_bK8w3zQm3G';
const IMG_MAX_B64 = 14e6;                       // ~10 MB sau khi giải mã (ảnh đã nén nên thường < 0,5 MB)
const BACKUP_KEEP = 14;

// Vùng cột công thức script giữ cho đúng (công thức mẫu lấy từ tab _CongThuc).
const ZONES = [
  { sheet: 'GiaoDich', from: 0, key: 0 },   // from / key của GiaoDich tính động theo tên đầu mục (xem zFrom_ / zKey_)
  { sheet: 'TaiKhoan', from: 4, key: 1, max: 21 },     // cột D:I, dòng 2–21 (khớp ACC_LAST_)
  { sheet: 'DanhMuc', from: 4, key: 3, max: 101 }      // cột D (số tiền tháng đang xem), dòng 2–101 (khớp CAT_LAST_)
  // , { sheet: 'TongQuan', cells: true }
];
const ARRAYISH = /ARRAYFORMULA|QUERY\(|FILTER\(|SORT\(|UNIQUE\(|SPLIT\(|IMPORTRANGE\(|SEQUENCE\(|MAP\(|BYROW\(/i;

/* GIAODICH: TÌM CỘT THEO TÊN ĐẦU MỤC (dòng 1)
 * Cột BẮT BUỘC: ID · Ngày · Loại · Số tiền · Tài khoản · Tài khoản đến · Hạng mục cha · Hạng mục con · Ghi chú · Tạo lúc
 * Cột script tự tính / tự tạo (đặt ở đâu cũng được): Số dư cuối · Ảnh · Tháng */
const TX_KEYS_ = { 'id': 'id', 'ngay': 'date', 'loai': 'type', 'so tien': 'amount', 'tai khoan': 'acc', 'tai khoan den': 'accTo', 'hang muc cha': 'cat', 'hang muc con': 'sub', 'ghi chu': 'note', 'tao luc': 'at', 'so du cuoi': 'sdc', 'anh': 'img', 'thang': 'month' };
const TX_LABEL_ = { id: 'ID', date: 'Ngày', type: 'Loại', amount: 'Số tiền (₫)', acc: 'Tài khoản', accTo: 'Tài khoản đến', cat: 'Hạng mục cha', sub: 'Hạng mục con', note: 'Ghi chú', at: 'Tạo lúc' };
const TX_CORE_ = ['id', 'date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note', 'at'];
const TX_ALL_ = TX_CORE_.concat(['sdc', 'img', 'month']);
const TXO_DEFAULT = { id: 1, date: 2, type: 3, amount: 4, acc: 5, accTo: 6, cat: 7, sub: 8, note: 9, at: 10 };   // bố cục CỐ ĐỊNH của tab DaXoa (thùng rác) — không đổi
const LOGI_ = [null, 'id', 'date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note', 'at'];             // số cột "logic" trong txProblems → khóa
