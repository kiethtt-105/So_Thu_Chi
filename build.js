/* Sinh config.js từ biến môi trường rồi gom file tĩnh vào thư mục public/ để Vercel phục vụ.
 *   - Trên Vercel: biến lấy từ Project Settings -> Environment Variables.
 *   - Chạy máy bạn: biến lấy từ file .env (không đưa lên git). Chạy:  node build.js
 * Không cần cài thêm thư viện nào. */
const fs = require('fs'), path = require('path');
const ROOT = __dirname, OUT = path.join(ROOT, 'public');

// 1) Đọc .env (nếu có). Biến đã có sẵn trong môi trường (Vercel) luôn được ưu tiên.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

// 2) Kiểm tra biến bắt buộc
const REQUIRED = ['APP_PASS', 'APP_API', 'APP_KEY'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Thiếu biến môi trường: ' + missing.join(', ') + '\nĐặt trong file .env (máy bạn) hoặc Vercel > Settings > Environment Variables.');
  process.exit(1);
}

// 3) Sinh config.js. Dùng self (có cả trong trang lẫn service worker) để sw.js cũng đọc được địa chỉ API và KEY
const cfg = {
  NAME: process.env.APP_NAME || '',
  PASS: process.env.APP_PASS,
  API: process.env.APP_API,
  KEY: process.env.APP_KEY
};
const configJs = '/* File này được sinh tự động bởi build.js từ biến môi trường. Không sửa tay, không commit. */\nself.CONFIG = ' + JSON.stringify(cfg, null, 4) + ';\n';
fs.writeFileSync(path.join(ROOT, 'config.js'), configJs);   // dùng khi chạy thử trên máy (Live Server mở từ thư mục gốc)

// 4) Gom file tĩnh vào public/ (không chứa .env, build.js, package.json)
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const FILES = ['index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest'];
for (const f of FILES) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  else console.warn('Cảnh báo: không thấy ' + f + ', bỏ qua');
}
if (fs.existsSync(path.join(ROOT, 'icons'))) fs.cpSync(path.join(ROOT, 'icons'), path.join(OUT, 'icons'), { recursive: true });
else console.warn('Cảnh báo: không thấy thư mục icons, bỏ qua');
fs.writeFileSync(path.join(OUT, 'config.js'), configJs);
console.log('Xong: đã tạo config.js và thư mục public/');
