/* config.js đặt self.CONFIG → service worker đọc được địa chỉ API + KEY để gửi hàng đợi khi tab đã đóng */
let CFG = {};
try { importScripts('config.js'); CFG = self.CONFIG || {}; } catch (e) { }
const V = 'stc-v31';
const SHELL = ['./', 'index.html', 'style.css', 'config.js', 'app.js', 'manifest.webmanifest', 'icons/icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

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
    // Cache trước, cập nhật ngầm (stale-while-revalidate): mạng yếu vẫn mở tức thì
    e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: true }).then(hit => {
      const net = fetch(r)
        .then(res => { if (res && res.ok && res.type === 'basic') c.put(r, res.clone()); return res; })
        .catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(res => res || c.match('index.html'));
    })));
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
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || 'stc',
    data: { url: d.url || './index.html', tab: d.tab || '' }
  }));
});

/* ===== Background Sync: gửi nốt hàng đợi (IndexedDB "stc-outbox") kể cả khi đã đóng tab =====
 * Trang đăng ký tag "stc-outbox" mỗi khi lưu một việc. Khi có mạng lại, trình duyệt (Chrome / Edge) đánh thức
 * service worker ở đây. Nếu còn tab đang mở thì để tab tự gửi (tránh gửi hai lần). */
const OB_FAST = ['tx.save', 'tx.del', 'tx.purge'];
const idbRun = (mode, fn) => new Promise(ok => {
  try {
    const r = indexedDB.open('stc-outbox', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('j', { keyPath: 'id' });
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      const db = r.result, t = db.transaction('j', mode), q = fn(t.objectStore('j'));
      t.oncomplete = () => { db.close(); ok(q && q.result); };
      t.onerror = t.onabort = () => { db.close(); ok(null); };
    };
  } catch (e) { ok(null); }
});
const obAll = () => idbRun('readonly', s => s.getAll()).then(r => r || []);
const obPut = j => idbRun('readwrite', s => s.put(j));
const obDel = id => idbRun('readwrite', s => s.delete(id));
async function toB64(blob) {
  const u = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function obPost(body) {
  if (!CFG.API) { const x = new Error('Thiếu địa chỉ API'); x.net = true; throw x; }
  let r, j;
  try { r = await fetch(CFG.API, { method: 'POST', body: JSON.stringify(Object.assign({ key: CFG.KEY || '' }, body)) }); }
  catch (e) { const x = new Error('Không có kết nối mạng'); x.net = true; throw x; }
  try { j = await r.json(); } catch (e) { const x = new Error('Lỗi máy chủ'); x.net = true; throw x; }
  if (!j.ok) throw new Error(j.err || 'Lỗi máy chủ');
  return j;
}
async function obSend(job) {
  const files = job.files || [];
  job.urls = job.urls || [];
  for (let i = job.urls.length; i < files.length; i++) {   // ảnh chờ tải lên Drive
    const j = await obPost({ img: { name: files[i].name, mime: 'image/jpeg', data: await toB64(files[i].blob) } });
    job.urls.push(j.url);
    await obPut(job);
  }
  let ops = job.ops;
  if (job.urls.length) ops = ops.map(x => x.op === 'tx.save' ? Object.assign({}, x, { row: Object.assign({}, x.row, { note: [String(x.row.note || '').trim()].concat(job.urls).filter(Boolean).join(' ') }) }) : x);
  await obPost({ ops, rev: '', fast: ops.every(x => OB_FAST.includes(x.op)) });
}
function obNote(body) {
  try {
    if (self.Notification && Notification.permission === 'granted')
      return self.registration.showNotification('Sổ Thu Chi', { body, icon: 'icons/icon-192.png', tag: 'stc-sync' });
  } catch (e) { }
}
async function obFlush() {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (wins.length) return;                                   // tab đang mở: để trang tự gửi
  const jobs = (await obAll()).sort((a, b) => a.t - b.t);
  let sent = 0;
  for (const job of jobs) {
    try { await obSend(job); await obDel(job.id); sent++; }
    catch (err) {
      if (err.net) throw err;                                // mất mạng: để trình duyệt thử lại sau
      await obDel(job.id);                                   // máy chủ từ chối: báo rồi bỏ, tránh lặp mãi
      await obNote('Chưa lưu được một thay đổi: ' + err.message);
    }
  }
  if (sent) await obNote('Đã gửi ' + sent + ' thay đổi đang chờ');
}
self.addEventListener('sync', e => { if (e.tag === 'stc-outbox') e.waitUntil(obFlush()); });
