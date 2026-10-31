const fs = require('fs'), path = require('path');
const ROOT = __dirname, OUT = path.join(ROOT, 'public');

const REQUIRED = ['APP_PASS', 'APP_API', 'APP_KEY'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Thiếu biến môi trường: ' + missing.join(', ') + '\nKhai báo trong Vercel > Settings > Environment Variables.');
  process.exit(1);
}

const cfg = {
  NAME: process.env.APP_NAME || '',
  PASS: process.env.APP_PASS,
  API: process.env.APP_API,
  KEY: process.env.APP_KEY
};
const configJs = 'self.CONFIG = ' + JSON.stringify(cfg, null, 4) + ';\n';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest', 'telegram.html']) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  else console.warn('Cảnh báo: không thấy ' + f + ', bỏ qua');
}
if (fs.existsSync(path.join(ROOT, 'icons'))) fs.cpSync(path.join(ROOT, 'icons'), path.join(OUT, 'icons'), { recursive: true });
else console.warn('Cảnh báo: không thấy thư mục icons, bỏ qua');
fs.writeFileSync(path.join(OUT, 'config.js'), configJs);
console.log('Xong: đã tạo public/ (gồm config.js)');
