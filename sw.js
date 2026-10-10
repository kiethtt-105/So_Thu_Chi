const V = 'stc-v5';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/core.js', 'js/sync.js', 'js/data.js', 'js/screens.js', 'js/events.js', 'js/forms.js', 'js/txform.js', 'js/quick.js', 'js/report.js', 'js/lists.js', 'js/notify.js', 'js/upload.js', 'js/trend.js', 'js/goals.js', 'js/main.js', 'manifest.webmanifest', 'icons/icon.png', 'icons/icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(r)
        .then(res => {
          if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
          return res;
        })
        .catch(() => caches.match(r).then(m => m || caches.match('index.html')))
    );
  } else if (/(^|\.)(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(V).then(c => c.match(r).then(hit => {
      const net = fetch(r)
        .then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; })
        .catch(() => hit);
      return hit || net;
    })));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  const url = d.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) {
        c.postMessage({ type: 'open-tab', tab: d.tab || '' });
        return c.focus();
      }
    }
    return self.clients.openWindow(url + (d.tab ? '#' + d.tab : ''));
  }));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Sổ Thu Chi', {
    body: d.body || '',
    icon: 'icons/icon.png',
    badge: 'icons/icon.png',
    tag: d.tag || 'stc',
    data: { url: d.url || './index.html', tab: d.tab || '' }
  }));
});
