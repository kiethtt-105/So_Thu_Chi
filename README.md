# Sổ Thu Chi

Ứng dụng web (PWA) ghi chép thu chi. Dữ liệu lưu trên Google Sheet, ảnh đính kèm lưu trên Google Drive.

```
index.html  sw.js  manifest.webmanifest  .nojekyll
css/style.css
js/           config · app · notify · upload · main
icons/        apple-touch-icon · icon-192 · icon-512 · icon-maskable-512
apps-script/  Code.gs · Upload.gs  (dán vào Apps Script, không chạy trên web)
```

Thứ tự nạp script: config → app → notify → upload → main.
Sau khi sửa file, tăng số phiên bản `V` trong `sw.js` để thiết bị nạp lại bản mới.
