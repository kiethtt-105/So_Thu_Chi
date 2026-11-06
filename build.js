const fs = require('fs'), path = require('path');
const ROOT = __dirname, SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'public');   // mã nguồn giao diện nằm trong src/

// Đọc biến môi trường: bỏ khoảng trắng thừa và dấu nháy bao quanh (hay bị dính khi dán từ file .env)
const env = k => String(process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();

// Các biến này chỉ dùng ở SERVER (api/store.js, api/_auth.js). Build chỉ kiểm tra, KHÔNG ghi vào file công khai.
const REQUIRED = ['APP_PASS', 'APP_API', 'APP_KEY'];
const missing = REQUIRED.filter(k => !env(k));
if (missing.length) {
  console.error('Thiếu biến môi trường: ' + missing.join(', ') + '\nKhai báo trong Vercel > Settings > Environment Variables.');
  process.exit(1);
}
// Bắt lỗi gõ sai URL Apps Script ngay lúc build (vd thiếu chữ "h" của https)
if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(env('APP_API'))) {
  console.error('APP_API không đúng dạng. Phải là https://script.google.com/macros/s/.../exec (URL Web app trong Apps Script > Deploy > Manage deployments).');
  process.exit(1);
}
if (env('APP_KEY').length < 16) console.warn('Cảnh báo: APP_KEY ngắn (<16 ký tự), nên dùng chuỗi ngẫu nhiên dài.');
if (!env('CRON_SECRET')) console.warn('Cảnh báo: chưa có CRON_SECRET, cron nền /api/store sẽ không chạy.');
if (!env('TG_TOKEN') || !env('TG_CHAT_ID')) console.warn('Cảnh báo: chưa có TG_TOKEN / TG_CHAT_ID, thông báo Telegram sẽ không gửi được.');
if (!env('ANTHROPIC_API_KEY')) console.warn('Cảnh báo: chưa có ANTHROPIC_API_KEY, quét ảnh bằng AI sẽ dùng bộ đọc chữ trên máy.');

// config.js là file CÔNG KHAI: chỉ để thông tin không nhạy cảm.
const cfg = {
  NAME: env('APP_NAME'),
  STORE: '/api/store',
  TTL_H: Number(env('APP_TTL_HOURS')) > 0 ? Number(env('APP_TTL_HOURS')) : 168
};
const configJs = 'self.CONFIG = ' + JSON.stringify(cfg, null, 4) + ';\n';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest']) {
  const src = path.join(SRC, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  else console.warn('Cảnh báo: không thấy src/' + f + ', bỏ qua');
}
if (fs.existsSync(path.join(SRC, 'icons'))) fs.cpSync(path.join(SRC, 'icons'), path.join(OUT, 'icons'), { recursive: true });
else console.warn('Cảnh báo: không thấy thư mục src/icons, bỏ qua');
fs.writeFileSync(path.join(OUT, 'config.js'), configJs);

// Mỗi lần deploy đổi tên cache của service worker => thiết bị luôn nhận bản mới, không dính CSS/JS cũ
const swp = path.join(OUT, 'sw.js');
if (fs.existsSync(swp)) {
  const id = String(process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 8);
  const sw = fs.readFileSync(swp, 'utf8'), out = sw.replace(/const V = 'stc-[^']*';/, "const V = 'stc-" + id + "';");
  if (out === sw) console.warn('Cảnh báo: không thấy dòng const V = \'stc-...\' trong sw.js, giữ nguyên');
  else fs.writeFileSync(swp, out);
}
console.log('Xong: đã tạo public/ (config.js không chứa mật khẩu/KEY)');
