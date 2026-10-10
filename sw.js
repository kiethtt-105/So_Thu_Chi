/* Sổ Thu Chi — service worker: chạy offline, hiện thông báo, nhận push */
const V = 'stc-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/app.js', 'js/notify.js', 'js/upload.js', 'js/main.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {            // file của ứng dụng: ưu tiên bản mới, mất mạng thì dùng bản đã lưu
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)) }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
  } else if (/(^|\.)(googleapis|gstatic)\.com$/.test(u.hostname)) {   // font chữ
    e.respondWith(caches.open(V).then(c => c.match(r).then(m => {
      const f = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res }).catch(() => m);
      return m || f;
    })));
  }
});

/* bấm vào thông báo → mở / quay lại ứng dụng */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});

/* sẵn sàng cho push từ máy chủ (khi có dịch vụ push) */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {} } catch (x) { d = { body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(d.title || 'Sổ Thu Chi', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'stc', data: { url: d.url || './index.html' }
  }));
});
