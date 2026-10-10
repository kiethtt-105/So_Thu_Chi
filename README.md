# Sổ Thu Chi

Web app quản lý thu chi cá nhân, chạy trên cả máy tính và điện thoại. Dữ liệu lưu trong Google Sheet, đồng bộ hai chiều gần như tức thời qua Google Apps Script. Giao diện là một file `index.html` duy nhất, không cần cài đặt hay build.

## Tính năng

**Sổ sách**
- **Tổng quan:** tổng tài sản, thu, chi, còn lại; biểu đồ thu chi 12 tháng; cơ cấu chi tiêu; lịch chi tiêu theo ngày; giao dịch gần đây; khoản chi lớn nhất.
- **Giao dịch:** thêm, sửa, xóa, nhân đôi. Có 4 loại: Chi, Thu, Chuyển khoản, Điều chỉnh. Tìm kiếm, lọc theo loại, tài khoản, hạng mục, khoảng số tiền, khoảng ngày; sắp xếp; xuất CSV.
- **Cân đối:** nhập số dư thực tế của từng tài khoản, app tính chênh lệch và tạo giao dịch Điều chỉnh hoặc Chuyển khoản bù trừ.

**Kế hoạch**
- **Hạn mức:** hạn mức theo ngày, theo tháng, theo hạng mục (ngày hoặc tháng). Có cảnh báo khi vượt và danh sách hạng mục bội chi.
- **Định kỳ:** giao dịch lặp lại hằng tháng (tiền nhà, lương…).

**Danh mục**
- **Tài khoản:** nhóm theo loại, có icon riêng, tổng tài sản ròng, phân bổ tài sản, thu chi từng tài khoản trong tháng.
- **Hạng mục:** hạng mục cha và hạng mục con cho Chi và Thu.
- **Thùng rác:** mục đã xóa được giữ lại và khôi phục được.

**Khác**
- Chọn Hạng mục cha thì Chi tiết chỉ hiện mục con của cha đó. Chọn Chi tiết trước thì Hạng mục cha tự điền.
- Chế độ sáng/tối, nút ẩn số dư, trạng thái kết nối Live.
- Phím tắt: `N` thêm giao dịch, `/` tìm kiếm, `Esc` đóng hộp thoại.
- Tự đăng xuất sau 12 giờ không dùng.

## Cấu trúc thư mục

```
So_Thu_Chi/
├── index.html    # toàn bộ giao diện và logic
├── config.js     # mật khẩu và địa chỉ API (tự tạo, xem bên dưới)
└── README.md
```

## Cài đặt

### 1. Chuẩn bị Google Sheet

Bắt buộc có 3 sheet (đúng tên, phân biệt hoa thường):

| Sheet | Cột dữ liệu | Giới hạn |
|---|---|---|
| `GiaoDich` | A: ID, B: Ngày, C: Loại, D: Số tiền, E: Tài khoản, F: Đến TK, G: Hạng mục, H: Chi tiết, I: Ghi chú, J: Thời điểm tạo | Không giới hạn |
| `TaiKhoan` | A: Tên, B: Loại, C: Số dư đầu kỳ (cột D trở đi là công thức tổng hợp) | Tối đa 20 tài khoản (dòng 2–21) |
| `DanhMuc` | A: Loại (Chi/Thu), B: Hạng mục cha, C: Hạng mục con | Tối đa 99 dòng (dòng 2–100) |

Các sheet sau do script **tự tạo**: `HanMuc` (hạn mức), `DinhKy` (giao dịch định kỳ), `DaXoa` (thùng rác), `_CongThuc` (ẩn, lưu bản gốc công thức để tự khôi phục). Sheet `TongQuan` và `HuongDan` là tùy chọn, app không đọc.

Loại tài khoản dùng các giá trị: `Tiền mặt`, `Ngân hàng`, `Ví điện tử`, `Thẻ tín dụng`, `Tiết kiệm`. Thẻ tín dụng đang nợ thì để số dư đầu kỳ âm.

Số dư hiện tại = Số dư đầu kỳ + Thu − Chi + Chuyển vào − Chuyển ra + Điều chỉnh.

### 2. Triển khai Apps Script

1. Mở Google Sheet, chọn **Tiện ích mở rộng → Apps Script**, dán nội dung `Code.gs` rồi lưu.
2. Tải lại Google Sheet, chọn menu **Sổ Thu Chi → Cài đặt tự động** và cấp quyền. Bước này tạo trigger (tự khôi phục công thức mỗi 5 phút và khi sửa Sheet), tạo các sheet phụ và kiểm tra dữ liệu nhập.
3. Chọn **Triển khai → Triển khai mới → Ứng dụng web**.
   - Thực thi dưới tên: **Tôi**.
   - Ai có quyền truy cập: **Bất kỳ ai**.
4. Sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
5. **Mỗi lần sửa `Code.gs`** phải vào **Triển khai → Quản lý triển khai → biểu tượng bút → Phiên bản mới → Triển khai**. Chỉ lưu code thì web vẫn chạy bản cũ và báo "Hành động không hợp lệ".

### 3. Tạo `config.js`

Tạo file `config.js` cạnh `index.html`:

```js
window.CONFIG = {
  PASS: "mat-khau-cua-ban",
  API:  "https://script.google.com/macros/s/XXXXXXXX/exec"
};
```

### 4. Chạy

- **Thử nhanh:** mở thẳng `index.html` bằng trình duyệt.
- **Đưa lên mạng:** đẩy cả thư mục lên GitHub rồi bật **GitHub Pages**, hoặc import repo vào **Vercel**. Không cần build.

Trên điện thoại, mở link rồi chọn **Thêm vào Màn hình chính** để dùng như một ứng dụng.

## Giao thức API (dành cho người sửa `Code.gs`)

App gửi `POST` tới URL Apps Script với body JSON `{ "a": "<hành động>", ... }`. Mọi phản hồi đều có dạng `{ "ok": true, ... }`, lỗi thì `{ "ok": false, "err": "..." }`.

| Hành động | Tham số | Việc làm |
|---|---|---|
| `all` | `h` (tùy chọn) | Trả toàn bộ dữ liệu. Nếu `h` trùng bản hiện tại thì trả `same: true`. App gọi mỗi 5 giây khi đang mở. |
| `add` / `upd` | `row` | Thêm / cập nhật giao dịch |
| `del` | `id` | Chuyển giao dịch vào `DaXoa` |
| `lim` | `lim` | Lưu hạn mức |
| `accSave` | `acc`, `old` | Thêm / sửa tài khoản |
| `accDel` | `name` | Xóa tài khoản vào thùng rác |
| `catSave` | `cat`, `old` | Thêm / sửa hạng mục |
| `catDel` | `cat` | Xóa hạng mục vào thùng rác |
| `recSet` | `rec` | Ghi đè toàn bộ danh sách định kỳ |
| `restore` | `at`, `kind` | Khôi phục mục trong thùng rác |

Cấu trúc dữ liệu trả về:

```
tx:    [{ id, date (YYYY-MM-DD), type, amount, acc, accTo, cat, sub, note }]
acc:   [{ name, type, open }]
cat:   [{ t: "Chi"|"Thu", p: "hạng mục cha", c: "hạng mục con" }]
rec:   [{ id, type, amount, acc, cat, sub, note, day }]
lim:   { d, m, c: { "hạng mục": số }, cd: { "hạng mục": số } }
trash: [{ k: "gd"|"tk"|"dm", at, ... }]
bad:   số dòng dữ liệu lỗi trong Sheet
h:     mã băm phiên bản dữ liệu
```

## Lưu ý bảo mật

- Mật khẩu trong `config.js` chỉ chặn người dùng thông thường. Ai mở được web đều đọc được file này, và URL Apps Script ở chế độ "Bất kỳ ai" thì ai biết link đều gọi được. Đừng dùng cho dữ liệu nhạy cảm nếu chưa kiểm tra mật khẩu ở phía Apps Script.
- Không dùng mật khẩu trùng với mật khẩu quan trọng khác.
- Giao dịch định kỳ tự sinh giao dịch thật vào sổ khi đến ngày. Nếu thêm định kỳ có ngày đã qua trong tháng, giao dịch của tháng đó được tạo ngay. Xóa giao dịch tự sinh thì sẽ không bị tạo lại.
- Icon tài khoản chọn thủ công chỉ lưu trên trình duyệt đang dùng, không đồng bộ giữa các thiết bị.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Báo "Thiếu file config.js" | Tạo `config.js` cùng thư mục với `index.html` |
| "Không kết nối được tới Apps Script" | Kiểm tra URL `/exec`, quyền truy cập là "Bất kỳ ai", và đã triển khai phiên bản mới |
| "Máy chủ không trả về JSON" | Chưa cấp quyền cho Apps Script, hoặc chưa Deploy bản mới |
| "Hành động không hợp lệ" / "chưa hỗ trợ hành động…" | Bản `Code.gs` đang Deploy quá cũ, Deploy phiên bản mới (bước 5 mục Triển khai) |
| "Tài khoản đang có giao dịch, không thể xóa" | Đây là chủ ý: chuyển hoặc xóa giao dịch của tài khoản đó trước |
| Dữ liệu trống dù Sheet có dữ liệu | Kiểm tra đủ 3 sheet GiaoDich, TaiKhoan, DanhMuc và đúng thứ tự cột |
| Giao diện không đổi sau khi cập nhật | Tải lại cứng bằng `Ctrl + Shift + R` |
| Báo "Có dòng dữ liệu sai" | Mở Sheet kiểm tra dòng lỗi, app đã tự sửa phần có thể sửa |

## Yêu cầu

Trình duyệt hiện đại (Chrome, Edge, Safari, Firefox bản mới). Cần mạng để đồng bộ và để tải font Be Vietnam Pro từ Google Fonts.