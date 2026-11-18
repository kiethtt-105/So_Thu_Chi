
let CFG = {};
try { importScripts('config.js'); CFG = self.CONFIG || {}; } catch (e) { }
const V = 'stc-v55';
const RT = 'stc-rt', RT_MAX = 30;   // cache nền: ảnh đính kèm, thư viện CDN (đọc ảnh HEIC / quét chữ) để dùng lại khi offline
const isLib = h => h === 'cdn.jsdelivr.net' || h === 'cdnjs.cloudflare.com' || h === 'unpkg.com';
const isImg = h => h === 'drive.google.com' || /(^|\.)googleusercontent\.com$/.test(h);
async function trim(c, max) { const ks = await c.keys(); for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]); }
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
      .then(keys => Promise.all(keys.filter(k => k !== V && k !== RT).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin && u.pathname.startsWith('/api/')) return;   // API luôn đi thẳng mạng, không cache
  if (u.origin === location.origin && u.pathname.startsWith('/_vercel/')) return; // Vercel Analytics luôn đi thẳng mạng, không cache
  if (u.origin === location.origin) {

    e.respondWith(caches.open(V).then(c => c.match(r, { ignoreSearch: true }).then(hit => {
      const net = fetch(r)
        .then(res => { if (res && res.ok && res.type === 'basic') c.put(r, res.clone()); return res; })
        .catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(res => res || (r.mode === 'navigate' ? c.match('index.html') : Response.error()));
    })));
  } else if (isLib(u.hostname)) {
    // Thư viện có phiên bản cố định trong URL: có bản trên máy thì dùng luôn
    e.respondWith(caches.open(RT).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { c.put(r, res.clone()); e.waitUntil(trim(c, RT_MAX)); } return res; }))));
  } else if (isImg(u.hostname) && r.destination === 'image') {
    // Ảnh đính kèm: hiện ngay từ máy, âm thầm làm mới ở nền
    e.respondWith(caches.open(RT).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') { c.put(r, res.clone()); e.waitUntil(trim(c, RT_MAX)); } return res; }).catch(() => hit || Response.error());
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    })));
  } else if (/(^|\.)(googleapis|gstatic)\.com$/.test(u.hostname)) {
    // Font: cache ở RT (không bị xóa mỗi lần deploy), có bản thì dùng ngay; offline mà chưa có thì báo lỗi mạng thay vì trả undefined
    e.respondWith(caches.open(RT).then(c => c.match(r).then(hit => {
      const net = fetch(r)
        .then(res => { if (res.ok || res.type === 'opaque') { c.put(r, res.clone()); e.waitUntil(trim(c, RT_MAX)); } return res; })
        .catch(() => hit || Response.error());
      if (hit) { e.waitUntil(net); return hit; }
      return net;
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
const obPut = j => idbRun('readwrite', s => s.put(j));
const obDel = id => idbRun('readwrite', s => s.delete(id));

const HB = 9000;
const obBeat = id => idbRun('readwrite', s => s.put({ id: 'hb:' + id, hb: Date.now() }));
const obUnbeat = id => idbRun('readwrite', s => s.delete('hb:' + id));
async function obLoad() {
  const all = (await idbRun('readonly', s => s.getAll())) || [], beats = {}, jobs = [];
  all.forEach(x => { if (String(x.id).startsWith('hb:')) beats[x.id.slice(3)] = x.hb; else jobs.push(x); });
  return { jobs: jobs.sort((a, b) => a.t - b.t), beats };
}
async function toB64(blob) {
  const u = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function obPost(body) {
  // offline = lỗi chung (mất mạng / hết phiên / Redis lỗi): dừng cả đợt gửi. Không có offline = lỗi riêng của việc này: bỏ qua, giữ lại, làm tiếp việc khác.
  const fail = (msg, f) => Object.assign(new Error(msg), f);
  if (!CFG.STORE) throw fail('Thiếu cấu hình máy chủ', { net: true, offline: true });
  let r, j;
  try { r = await fetch(CFG.STORE, { method: 'POST', credentials: 'same-origin', body: JSON.stringify(body) }); }
  catch (e) { throw fail('Không có kết nối mạng', { net: true, offline: true }); }
  try { j = await r.json(); } catch (e) { throw fail('Lỗi máy chủ', { net: true }); }
  // Chưa đăng nhập / hết phiên / máy chủ lỗi: KHÔNG bỏ thay đổi, giữ lại và gửi sau khi đăng nhập lại
  if (j.auth || j.hubErr) throw fail(j.err || 'Chưa đăng nhập hoặc máy chủ lỗi', { net: true, offline: true });
  if (!j.ok) {
    const x = fail(j.err || 'Lỗi máy chủ', {});
    if (j.reject) x.reject = true;
    else if (/chờ khóa|giữ khóa|lock|đang bận|busy|time(d)? ?out|quá tải|too many|tạm thời|temporar|unavailable|service invoked/i.test(j.err || '')) { x.net = true; x.offline = true; }
    throw x;
  }
  return j;
}
async function obSend(job) {
  const files = job.files || [];
  job.urls = job.urls || [];
  if (job.urls.length < files.length) {
    // Tải tuần tự, lưu ngay sau từng ảnh: lỗi giữa chừng không phải tải lại ảnh đã xong (tránh ảnh trùng trên Drive)
    const done = job.done || (job.done = {});
    job.urls.forEach((u, i) => { if (done[i] == null) done[i] = u; });
    for (let i = 0; i < files.length; i++) {
      if (done[i]) continue;
      const f = files[i];
      const j = await obPost({ img: { name: f.name, mime: 'image/jpeg', data: await toB64(f.blob) } });
      done[i] = j.url; await obPut(job);
    }
    job.urls = files.map((_, i) => done[i]).filter(Boolean);
    await obPut(job);
  }
  let ops = job.ops;
  if (job.urls.length) ops = ops.map(x => x.op === 'tx.save' ? Object.assign({}, x, { row: Object.assign({}, x.row, { note: [String(x.row.note || '').trim()].concat(job.urls).filter(Boolean).join(' ') }) }) : x);
  await obPost({ ops, rev: '', fast: ops.every(x => OB_FAST.includes(x.op)) });
}
function obNote(body) {
  // Không tự hiện popup hệ thống (sẽ bỏ qua cài đặt người dùng): chuyển cho app đang mở, app tự hiện toast
  try {
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => list.forEach(c => c.postMessage({ type: 'note', body })));
  } catch (e) { }
}
let flushing = null;
function obFlush() { return flushing || (flushing = obRun().finally(() => { flushing = null; })); }
async function obRun() {
  const skip = new Set();   // việc lỗi riêng trong lượt này: bỏ qua, KHÔNG xóa (app sẽ xử lý và báo lỗi khi mở lại), không chặn các việc sau
  for (let round = 0; round < 10; round++) {
    const { jobs, beats } = await obLoad();
    const todo = jobs.filter(j => !skip.has(j.id));
    if (!todo.length) break;
    const ready = todo.filter(j => Date.now() - (beats[j.id] || 0) > HB);
    if (!ready.length) { await new Promise(r => setTimeout(r, 3000)); continue; }
    for (const job of ready) {
      await obBeat(job.id);
      const t = setInterval(() => obBeat(job.id), 3000);
      try { await obSend(job); await obDel(job.id); }
      catch (err) {
        clearInterval(t); await obUnbeat(job.id);
        if (err.offline) throw err;             // mất mạng / hết phiên / Redis lỗi: giữ hết trong hàng đợi, thử lại sau
        skip.add(job.id);                       // lỗi riêng của việc này (kể cả bị từ chối): giữ nguyên, làm việc khác
        continue;
      }
      clearInterval(t);
      await obUnbeat(job.id);
    }
  }
}
self.addEventListener('sync', e => { if (e.tag === 'stc-outbox') e.waitUntil(obFlush()); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'flush') e.waitUntil(obFlush().catch(() => { })); });
