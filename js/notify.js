/* =====================================================================
 * notify.js — Ứng dụng cài được (PWA) · Thông báo dạng app · Thông báo hệ thống
 * Dùng các biến/hàm của app.js: $, esc, num, S, E, ED, UNDO, ask, openSheet, empty, ic, IC
 * ===================================================================== */
IC.bell = 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0';

const CAN_SYS = 'Notification' in window;
let SWREG = null, INST = null;
const permOf = () => CAN_SYS ? Notification.permission : 'unsupported';
function pushOn() { return permOf() === 'granted' }

/* ---------- lịch sử thông báo (lưu trên máy này) ---------- */
const nlog = () => { try { return JSON.parse(localStorage.nlog || '[]') } catch (e) { return [] } };
const nsave = a => { try { localStorage.nlog = JSON.stringify(a.slice(0, 40)) } catch (e) {} };
const ago = t => { const s = (Date.now() - t) / 1e3; return s < 60 ? 'vừa xong' : s < 3600 ? Math.floor(s / 60) + ' phút trước' : s < 86400 ? Math.floor(s / 3600) + ' giờ trước' : new Date(t).toLocaleDateString('vi-VN') };
function nbUpdate() {
  const el = $('#nbn'); if (!el) return;
  const n = nlog().filter(x => x.t > (+localStorage.nseen || 0)).length;
  el.classList.toggle('hide', !n); el.textContent = n > 99 ? '99+' : n;
}

/* ---------- banner thông báo dạng app (thay cho toast cũ) ---------- */
function toast(t, u, o) {
  o = o || {};
  const e = $('#toast');
  e.innerHTML = `<span class="ni">${esc(o.ico || '🔔')}</span><span class="nb"><b>${esc(o.title || 'Sổ Thu Chi')}</b><span>${esc(t)}</span></span><em>bây giờ</em>`;
  e.classList.toggle('u', !!u); e.classList.toggle('err', !!o.err);
  if (u) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Hoàn tác';
    b.onclick = () => { if (UNDO && UNDO.fn === u) { UNDO = null; e.classList.remove('on'); u() } };
    e.appendChild(b); UNDO = { fn: u, t: Date.now() };
  }
  e.classList.add('on'); clearTimeout(toast.i); toast.i = setTimeout(() => e.classList.remove('on'), u ? 8000 : 3600);
}

/* ---------- thông báo hệ thống (nằm trong trung tâm thông báo của thiết bị) ---------- */
async function showSys(title, body, tag) {
  if (!pushOn()) return;
  const o = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: tag || 'stc', renotify: true, vibrate: [80, 40, 80], data: { url: location.href } };
  try {
    const reg = SWREG || ('serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null);
    if (reg && reg.showNotification) return await reg.showNotification(title, o);
    new Notification(title, o);
  } catch (e) {}
}

/* Một thông báo thật sự: banner trong app + lưu lịch sử + đẩy ra hệ thống khi bạn không đang xem app */
function notify(body, o) {
  o = o || {};
  const title = o.title || 'Sổ Thu Chi', ico = o.ico || (o.err ? '⚠️' : '✅');
  const a = nlog(); a.unshift({ t: Date.now(), title, body, ico, err: !!o.err }); nsave(a); nbUpdate();
  toast(body, o.undo, { title, ico, err: o.err });
  if (pushOn() && (localStorage.nall === '1' || document.hidden || !document.hasFocus())) showSys(title, body, o.tag);
}

/* Giao dịch mới từ thiết bị khác (đồng bộ nền) */
function notifyNew(L) {
  if (!L.length) return notify('Dữ liệu vừa được cập nhật', { title: 'Đồng bộ', ico: '🔄', tag: 'sync' });
  const f = t => (t.type === 'Chi' ? '−' : t.type === 'Thu' ? '+' : '') + num(t.amount) + ' · ' + (t.sub || t.cat || t.type) + ' · ' + t.acc;
  const b = L.slice(0, 3).map(f).join('\n') + (L.length > 3 ? '\n+' + (L.length - 3) + ' giao dịch khác' : '');
  notify(b, { title: L.length === 1 ? 'Giao dịch mới' : L.length + ' giao dịch mới', ico: '💸', tag: 'newtx' });
}

/* ---------- xin quyền thông báo ---------- */
async function enablePush() {
  if (!CAN_SYS) { toast('Trình duyệt này không hỗ trợ thông báo'); return 'unsupported' }
  let p = Notification.permission;
  if (p === 'default') { try { p = await Notification.requestPermission() } catch (e) {} }
  if (p === 'granted') showSys('Đã bật thông báo', 'Bạn sẽ nhận thông báo giao dịch mới, khoản chi vượt hạn mức và kết quả lưu.', 'test');
  else if (p === 'denied') toast('Thông báo đang bị chặn. Bấm vào biểu tượng ổ khóa cạnh thanh địa chỉ để cho phép.');
  nbUpdate(); return p;
}

/* ---------- trung tâm thông báo ---------- */
function openNotif() {
  ED = null; E = null; localStorage.nseen = Date.now(); nbUpdate();
  const p = permOf(), L = nlog();
  const st = { granted: 'Đã bật', denied: 'Đang bị chặn trong trình duyệt', default: 'Chưa bật', unsupported: 'Trình duyệt không hỗ trợ' }[p];
  $('#sh').innerHTML = `<h3>Thông báo</h3><div class="menu">
<div class="row"><span class="dot">🔔</span><span class="m"><b>Thông báo trên thiết bị</b><small>${st}</small></span>${p === 'default' ? '<button class="chip on" data-nt="enable">Bật</button>' : p === 'granted' ? '<button class="chip" data-nt="test">Gửi thử</button>' : ''}</div>
${p === 'granted' ? `<label class="row" style="cursor:pointer"><span class="dot">📲</span><span class="m"><b>Hiện cả khi đang mở ứng dụng</b><small>Mặc định chỉ hiện khi bạn đang ở ứng dụng khác</small></span><input type="checkbox" data-nt="all" ${localStorage.nall === '1' ? 'checked' : ''}></label>` : ''}
${INST ? '<button class="row" data-nt="install"><span class="dot">⬇️</span><span class="m"><b>Cài đặt ứng dụng</b><small>Mở như một ứng dụng riêng, có biểu tượng trên máy</small></span></button>' : ''}
</div><div class="ch" style="margin:16px 0 4px;display:flex;justify-content:space-between;align-items:center"><b>Gần đây</b>${L.length ? '<button class="chip" data-nt="clear">Xóa hết</button>' : ''}</div>
${L.map(n => `<div class="row"><span class="dot">${esc(n.ico)}</span><span class="m"><b>${esc(n.title)}</b><small style="white-space:pre-line">${esc(n.body)}</small></span><small class="mut">${ago(n.t)}</small></div>`).join('') || empty('Chưa có thông báo')}`;
  openSheet();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-nt]'); if (!b || b.type === 'checkbox') return;
  const k = b.dataset.nt;
  if (k === 'open') return openNotif();
  if (k === 'enable') { await enablePush(); return openNotif() }
  if (k === 'test') { notify('Thông báo thử — mọi thứ đang hoạt động tốt.', { title: 'Sổ Thu Chi', ico: '🔔', tag: 'test' }); return }
  if (k === 'install' && INST) { INST.prompt(); try { await INST.userChoice } catch (x) {} INST = null; return openNotif() }
  if (k === 'clear') { nsave([]); nbUpdate(); openNotif() }
});
document.addEventListener('change', e => { const b = e.target.closest('[data-nt="all"]'); if (b) localStorage.nall = b.checked ? '1' : '0' });
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e });
addEventListener('appinstalled', () => { INST = null; notify('Đã cài đặt ứng dụng', { ico: '📲' }) });

/* ---------- khởi tạo (gọi từ boot) ---------- */
function pushInit() {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
    navigator.serviceWorker.register('sw.js').then(r => { SWREG = r }).catch(() => {});
  nbUpdate();
  if (CAN_SYS && Notification.permission === 'default' && !localStorage.nask) setTimeout(async () => {
    localStorage.nask = '1';                                   // chỉ hỏi một lần; sau đó bật trong mục Thông báo
    if (await ask('Bật thông báo?', 'Nhận thông báo khi có giao dịch mới, khoản chi vượt hạn mức hoặc khi đồng bộ xong — kể cả lúc bạn đang ở ứng dụng khác.', { icon: '🔔', ok: 'Bật thông báo', cancel: 'Để sau' })) enablePush();
  }, 2500);
}
