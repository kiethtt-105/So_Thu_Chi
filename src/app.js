'use strict';
/* Sổ Thu Chi v2 — kiến trúc: util → money → api → outbox → store → views → actions → boot.
   Giữ nguyên giao thức /api/store, /api/account và hàng đợi IndexedDB 'stc-outbox' của sw.js. */
const { STORE } = window.CONFIG || {}, POLL = 10000, HELD = 'Giữ Hộ';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NF = new Intl.NumberFormat('vi-VN'), vnd = n => NF.format(Math.round(n)) + ' ₫', sgn = n => (n > 0 ? '+' : '') + NF.format(Math.round(n));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0'), ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const today = () => ymd(new Date()), nowAt = () => { const d = new Date(); return ymd(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); };
const uid = () => 'G' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const mShift = (m, n) => { const [y, mo] = m.split('-').map(Number), d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + '-' + p2(d.getMonth() + 1); };
const mLabel = m => 'Tháng ' + (+m.slice(5)) + '/' + m.slice(0, 4), dLabel = d => { const t = today(), y = ymd(new Date(Date.now() - 864e5)); return d === t ? 'Hôm nay' : d === y ? 'Hôm qua' : d.split('-').reverse().join('/'); };
const store = { get: (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };

/* ---------- Tiền: "45k", "1tr2", "1,5tr", phép tính 20k+35k*2 ---------- */
const UNIT = { k: 1e3, nghìn: 1e3, ngàn: 1e3, tr: 1e6, triệu: 1e6, m: 1e6, tỷ: 1e9, ty: 1e9, b: 1e9 };
function pm(v) {
  const raw = String(v || '').trim().toLowerCase(), neg = raw.startsWith('-'), s = raw.replace(/^-/, '').replace(/[₫đ\s]/g, '');
  const m = s.match(/^(\d+)(?:[.,](\d{1,3}))?(k|nghìn|ngàn|tr|triệu|m|tỷ|ty|b)(\d{1,3})?$/);
  const n = m ? Math.round(parseFloat(m[1] + '.' + (m[2] || m[4] || '0')) * UNIT[m[3]]) : Number(s.replace(/[^\d]/g, ''));
  return n ? (neg ? -n : n) : 0;
}
function calc(src) {   // bộ phân tích đệ quy, không dùng eval
  const t = String(src).toLowerCase().replace(/[₫đ\s]/g, '').match(/\d+(?:[.,]\d+)?(?:k|nghìn|ngàn|tr|triệu|m|tỷ|ty|b)?\d*|[-+*/()×x÷]/g) || []; let i = 0;
  const num = () => { const k = t[i++]; if (k === '(') { const v = expr(); i++; return v; } if (k === '-') return -num(); const v = pm(k); return v; };
  const term = () => { let v = num(); while (/[*/×x÷]/.test(t[i] || '')) { const o = t[i++], r = num(); v = /[*×x]/.test(o) ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (/[+-]/.test(t[i] || '')) { const o = t[i++], r = term(); v = o === '+' ? v + r : v - r; } return v; };
  try { const v = expr(); return isFinite(v) && i >= t.length ? Math.round(v) : null; } catch (e) { return null; }
}
const isExpr = v => /[+*/×÷()]|.-/.test(String(v).replace(/^\s*-/, '')) && /\d/.test(v);
const amt = v => isExpr(v) ? calc(v) : pm(v);
document.addEventListener('input', e => {
  const el = e.target; if (!el.classList.contains('money')) return;
  const h = el.parentElement.querySelector('.hint'); const raw = el.value;
  if (isExpr(raw) || /[a-zA-Zàáâãèéêìíòóôõùúýăđơư]/.test(raw)) { const r = amt(raw); h.textContent = r == null ? 'Phép tính chưa hợp lệ…' : '= ' + vnd(r); return; }
  h.textContent = ''; const neg = el.dataset.neg && raw.trim().startsWith('-'), d = raw.replace(/\D/g, ''); el.value = (neg ? '-' : '') + (d ? NF.format(+d) : '');
});
document.addEventListener('focusout', e => { const el = e.target; if (el.classList && el.classList.contains('money') && (isExpr(el.value) || /\D/.test(el.value.replace(/[.,\s-]/g, '')))) { const r = amt(el.value); if (r != null) { el.value = r ? NF.format(r) : ''; el.parentElement.querySelector('.hint').textContent = ''; } } });

/* ---------- API ---------- */
class NetErr extends Error { constructor(m, auth) { super(m); this.net = true; this.auth = !!auth; } }
async function post(body, ms = 30000, url = STORE) {
  if (!url) throw new NetErr('Thiếu config.js');
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms); let r, j;
  try { r = await fetch(url, { method: 'POST', credentials: 'same-origin', signal: ac.signal, body: JSON.stringify(body) }); }
  catch (e) { throw new NetErr(navigator.onLine === false ? 'Không có kết nối mạng' : 'Không kết nối được máy chủ'); } finally { clearTimeout(tm); }
  try { j = await r.json(); } catch (e) { throw new NetErr('Lỗi máy chủ (' + r.status + ')'); }
  return j;
}
async function api(body, ms) {
  const j = await post(body, ms);
  if (j.auth) { showLogin(); throw new NetErr('Phiên đã hết hạn, hãy đăng nhập lại', true); }
  if (j.hubErr) throw new NetErr(j.err || 'Máy chủ đang lỗi');
  if (!j.ok) { const e = new Error(j.err || 'Lỗi máy chủ'); if (/chờ khóa|lock|đang bận|busy|time(d)? ?out|quá tải|tạm thời|unavailable/i.test(j.err || '')) e.net = true; throw e; }
  return j;
}

/* ---------- Outbox (IndexedDB, cùng định dạng với sw.js) ---------- */
const Ob = {
  run(mode, fn) {
    return new Promise(ok => {
      try {
        const r = indexedDB.open('stc-outbox', 1); r.onupgradeneeded = () => r.result.createObjectStore('j', { keyPath: 'id' }); r.onerror = () => ok(null);
        r.onsuccess = () => { const db = r.result, t = db.transaction('j', mode), q = fn(t.objectStore('j')); t.oncomplete = () => { db.close(); ok(q && q.result); }; t.onerror = t.onabort = () => { db.close(); ok(null); }; };
      } catch (e) { ok(null); }
    });
  },
  add(ops) { return this.run('readwrite', s => s.put({ id: 'j' + Date.now() + Math.random().toString(36).slice(2, 6), t: Date.now(), ops })); },
  async count() { const a = (await this.run('readonly', s => s.getAll())) || []; return a.filter(x => !String(x.id).startsWith('hb:')).length; },
  async kick() {
    try { const reg = await navigator.serviceWorker.ready; if (reg.sync) await reg.sync.register('stc-outbox'); else reg.active && reg.active.postMessage({ type: 'flush' }); }
    catch (e) { try { (await navigator.serviceWorker.ready).active.postMessage({ type: 'flush' }); } catch (x) { } }
  }
};

/* ---------- Store ---------- */
const S = { tx: [], acc: [], cat: [], lim: [], trash: [], rev: '', ready: false, v: 0, busy: 0, q: 0, m: today().slice(0, 7), tab: 'home', f: 'all', s: '', rg: 'm', xa: '', pg: 80, tf: 'all' };
const TXOPS = new Set(['tx.save', 'tx.del', 'tx.purge']), SAFE = new Set([...TXOPS, 'lim.set']);
const bump = () => { S.v++; };
try { Object.assign(S, JSON.parse(store.get('cache', '{}'))); S.ready = S.tx.length > 0 || S.acc.length > 0; } catch (e) { }
function apply(j) {
  if (j.same) return false; let ch = false;
  ['tx', 'acc', 'cat', 'lim', 'trash'].forEach(k => { if (Array.isArray(j[k])) { S[k] = j[k]; ch = true; } });
  if (j.rev !== undefined) S.rev = j.rev; bump();
  store.set('cache', JSON.stringify({ tx: S.tx, acc: S.acc, cat: S.cat, lim: S.lim, trash: S.trash })); return ch;
}
const skipAcc = a => a.type === HELD || !!a.skip, skipSet = () => new Set(S.acc.filter(skipAcc).map(a => a.name));
let _bal = { v: -1 };
function balances() {   // số dư theo tài khoản, đến hết hôm nay (cache theo phiên bản dữ liệu)
  const td = today(); if (_bal.v === S.v && _bal.d === td) return _bal.B;
  const B = {}; S.acc.forEach(a => B[a.name] = Math.round(+a.open || 0));
  S.tx.forEach(t => { if (t.date > td) return; const x = Math.round(+t.amount || 0); B[t.acc] = (B[t.acc] || 0) + (t.type === 'Thu' || t.type === 'Điều chỉnh' ? x : -x); if (t.type === 'Chuyển khoản' && t.accTo) B[t.accTo] = (B[t.accTo] || 0) + x; });
  _bal = { v: S.v, d: td, B }; return B;
}
const stx = () => { const sk = skipSet(); return S.tx.filter(t => !sk.has(t.acc)); };   // giao dịch tính vào thu chi
const inM = (t, m) => t.date.slice(0, 7) === m;
const sumBy = (l, ty) => l.reduce((s, t) => t.type === ty ? s + t.amount : s, 0);
const group = (l, f) => { const o = {}; l.forEach(t => { const k = f(t); o[k] = (o[k] || 0) + t.amount; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
function limits() {
  const td = today(), chi = stx().filter(t => t.type === 'Chi'), M = chi.filter(t => inM(t, S.m)), sum = (a, c) => a.reduce((s, t) => (!c || t.cat === c) ? s + t.amount : s, 0);
  return S.lim.filter(l => l.v > 0).map(L => {
    const name = L.cat || 'Tổng chi', used = L.per === 'Ngày' ? sum(chi.filter(t => t.date === td), L.cat) : sum(M, L.cat);
    return { ...L, name, used, pct: used / L.v };
  }).sort((a, b) => b.pct - a.pct);
}

/* ---------- Commit: lạc quan + hàng đợi offline ---------- */
async function commit(ops, o = {}) {
  const snap = S.tx.slice(), txOnly = ops.every(x => TXOPS.has(x.op));
  if (o.local) { o.local(); bump(); render(); }
  S.busy++;
  try {
    const j = await api({ ops, rev: '', fast: txOnly });
    if (!txOnly) apply(j); else store.set('cache', JSON.stringify({ tx: S.tx, acc: S.acc, cat: S.cat, lim: S.lim, trash: S.trash }));
    render(); if (o.ok) toast(typeof o.ok === 'function' ? o.ok() : o.ok, o.undo); if (o.after) o.after(); return { ok: true };
  } catch (e) {
    if (e.net && ops.every(x => SAFE.has(x.op))) { await Ob.add(ops); Ob.kick(); S.q = await Ob.count(); toast('Đã lưu trên máy, sẽ tự gửi khi có mạng'); return { ok: true, queued: true }; }
    if (o.local) { S.tx = snap; bump(); render(); }
    toast(e.message, null, 1); return { ok: false, err: e.message };
  } finally { S.busy--; }
}
const act = (ops, ok) => commit(ops, { ok });
function txSave(row, old) {
  const nw = !old;
  return commit([{ op: 'tx.save', row }], {
    local: () => { S.tx = S.tx.filter(t => t.id !== row.id).concat(row); },
    after: r => { tgTx(nw ? '🆕' : '✏️', row).then(() => { const w = limWarn(row); if (w) tgSend('⚠️' + w.replace('⚠️', '')); }); },
    ok: () => nw ? 'Đã thêm giao dịch' + limWarn(row) : 'Đã cập nhật' + limWarn(row),
    undo: () => commit(old ? [{ op: 'tx.save', row: old }] : [{ op: 'tx.purge', id: row.id }], { local: () => { S.tx = S.tx.filter(t => t.id !== row.id); if (old) S.tx.push(old); }, ok: 'Đã hoàn tác' })
  });
}
function txDel(id) {
  const old = S.tx.find(t => t.id === id); if (!old) return;
  commit([{ op: 'tx.del', id }], { after: () => { tgTx('🗑️', old); }, local: () => { S.tx = S.tx.filter(t => t.id !== id); }, ok: 'Đã chuyển vào Thùng rác', undo: () => commit([{ op: 'tx.save', row: old }], { local: () => { S.tx.push(old); }, ok: 'Đã hoàn tác' }) });
}
function limWarn(r) {   // cảnh báo ngay khi một giao dịch chi làm vượt hạn mức
  if (r.type !== 'Chi') return ''; const m = r.date.slice(0, 7), td = today(); let w = '';
  limits().forEach(L => { if (L.cat && L.cat !== r.cat) return; if (L.per === 'Tháng' && m !== S.m) return; if (L.per === 'Ngày' && r.date !== td) return; if (L.used > L.v) w = '\n⚠️ Vượt hạn mức ' + L.name + ' (' + L.per.toLowerCase() + ')'; });
  return w;
}

/* ---------- UI nguyên tử: toast, hỏi xác nhận, sheet ---------- */
let _tt; function toast(msg, undo, err) {
  const t = $('#toast'); t.className = err ? 'err on' : 'on'; t.style.whiteSpace = 'pre-line'; t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button data-act="undo">Hoàn tác</button>' : '');
  t._u = undo; clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('on'), undo ? 8000 : 3500);
}
const ask = (title, msg, ok = 'OK') => new Promise(res => { $('#cft').textContent = title; $('#cfm').textContent = msg; $('#cfo').textContent = ok; $('#cf').classList.add('open'); const d = v => { $('#cf').classList.remove('open'); $('#cfo').onclick = $('#cfn').onclick = null; res(v); }; $('#cfo').onclick = () => d(true); $('#cfn').onclick = () => d(false); });
const openSheet = h => { $('#sh').innerHTML = h; $('#ov').classList.add('open'); const f = $('#sh input:not([type=checkbox]),#sh select'); f && !matchMedia('(pointer:coarse)').matches && f.focus(); };
const closeSheet = () => { $('#ov').classList.remove('open'); $('#sh').innerHTML = ''; };
$('#ov').addEventListener('mousedown', e => { if (e.target.id === 'ov') closeSheet(); });

/* ---------- Thành phần hiển thị ---------- */
const IC = { home: 'M3 11l9-8 9 8M5 10v10h14V10', tx: 'M4 6h16M4 12h16M4 18h10', acc: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18', lim: 'M4 18a8 8 0 1 1 16 0M12 18l4-6', rp: 'M5 20V11M12 20V4M19 20v-6', more: 'M5 12h.01M12 12h.01M19 12h.01', debt: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', bal: 'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', cat: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', sec: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' };
const svg = k => `<svg class="i" viewBox="0 0 24 24"><path d="${IC[k]}"/></svg>`;
const TABS = [['home', 'Tổng quan'], ['tx', 'Giao dịch'], ['acc', 'Tài khoản'], ['lim', 'Hạn mức'], ['more', 'Thêm']], SIDE = [['home', 'Tổng quan'], ['rp', 'Báo cáo'], ['tx', 'Giao dịch'], ['acc', 'Tài khoản'], ['lim', 'Hạn mức'], ['debt', 'Sổ nợ'], ['bal', 'Cân đối'], ['cat', 'Hạng mục'], ['trash', 'Thùng rác'], ['sec', 'Cài đặt']];
const EMO = [[/đầu tư|lãi|cổ phiếu/i, '📈'], [/ăn|uống|cơm|cafe|cà phê/i, '🍜'], [/xe|xăng|đi lại|grab/i, '🛵'], [/nhà|thuê|điện|nước|internet/i, '🏠'], [/mua|sắm|quần|áo/i, '🛍️'], [/y tế|thuốc|khám/i, '💊'], [/học|sách/i, '📚'], [/giải trí|phim|game|du lịch/i, '🎮'], [/lương|thưởng/i, '💰'], [/quà|từ thiện/i, '🎁'], [/tiết kiệm/i, '🐷']];
const emo = k => (EMO.find(e => e[0].test(k || '')) || [0, '🧾'])[1];
const ATY = { 'Tiền mặt': '💵', 'Ngân hàng': '🏦', 'Thẻ tín dụng': '💳', 'Ví điện tử': '👛', 'Tiết kiệm': '🐷', [HELD]: '🤝' };
const empty = (a, b = '') => `<div class="empty"><b>${a}</b>${b}</div>`;
const col = i => 'var(--c' + (i % 8 + 1) + ')';
const monthNav = () => `<div class="mn"><button data-m="-1" aria-label="Tháng trước">‹</button><b>${mLabel(S.m)}</b><button data-m="1" aria-label="Tháng sau">›</button></div>`;
function txRow(t) {
  const x = t.type === 'Chuyển khoản', title = x ? `${esc(t.acc)} → ${esc(t.accTo)}` : esc(t.sub || t.cat || (t.type === 'Chi' || t.type === 'Thu' ? 'Chưa phân loại' : t.type));
  const cls = t.type === 'Thu' ? 'thu' : t.type === 'Chi' ? 'chi' : '', note = String(t.note || '').replace(/https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view\S*/g, '').trim();
  return `<button class="row" data-edit="${esc(t.id)}"><span class="dot">${x ? '⇄' : t.type === 'Điều chỉnh' ? '±' : emo(t.sub || t.cat)}</span><span class="m"><b>${title}</b><small>${esc(x ? note : t.acc + (note ? ' · ' + note : ''))}</small></span><span class="a num sens ${cls}">${t.type === 'Chi' ? '−' : t.type === 'Thu' ? '+' : ''}${NF.format(Math.abs(t.amount))}</span></button>`;
}
function donut(rows, tot) {
  if (!rows.length || !tot) return empty('Chưa có dữ liệu'); const R = 48, C = 2 * Math.PI * R; let o = 0;
  return `<div class="donut"><svg width="132" height="132" viewBox="0 0 120 120">${rows.slice(0, 8).map(([k, v], i) => { const l = v / tot * C, s = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${col(i)}" stroke-width="18" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-o}" transform="rotate(-90 60 60)"/>`; o += l; return s; }).join('')}</svg>
<ul>${rows.slice(0, 6).map(([k, v], i) => `<li><i style="background:${col(i)}"></i><span>${emo(k)} ${esc(k || 'Chưa phân loại')}</span><b class="sens">${Math.round(v / tot * 100)}%</b></li>`).join('')}</ul></div>`;
}
function bars(ms) {   // cột Thu / Chi theo tháng
  const d = ms.map(m => { const l = stx().filter(t => inM(t, m)); return [m, sumBy(l, 'Thu'), sumBy(l, 'Chi')]; }), mx = Math.max(1, ...d.flat().filter(x => typeof x === 'number')), W = 100 / d.length;
  return `<svg viewBox="0 0 300 150" style="width:100%">${d.map(([m, a, b], i) => { const x = i * 300 / d.length + 8, w = (300 / d.length - 16) / 2, h1 = a / mx * 110, h2 = b / mx * 110; return `<rect x="${x}" y="${120 - h1}" width="${w}" height="${h1}" rx="3" fill="var(--ok)"/><rect x="${x + w + 2}" y="${120 - h2}" width="${w}" height="${h2}" rx="3" fill="var(--er)"/><text x="${x + w}" y="140" text-anchor="middle" font-size="9" fill="var(--mu)">T${+m.slice(5)}</text>`; }).join('')}</svg>`;
}
const prog = (pct, cls) => `<div class="bar ${cls}"><i style="width:${Math.min(100, pct * 100)}%"></i></div>`;


/* ---------- Telegram ---------- */
const tgOn = () => store.get('tg', '1') === '1';
async function tgSend(text, silent) { if (!tgOn()) return { ok: true, skip: 1 }; try { const r = await fetch('/api/telegram', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, silent: !!silent }) }); const j = await r.json().catch(() => ({})); return { ok: !!j.ok, err: j.err || (r.status === 404 ? 'Chưa có /api/telegram' : '') }; } catch (e) { return { ok: false, err: 'Không gọi được máy chủ' }; } }
const tgTx = (verb, t) => tgSend(`${verb} ${t.type} ${NF.format(Math.abs(t.amount))} ₫${t.sub || t.cat ? ' — ' + (t.sub || t.cat) : ''}\n💳 ${t.acc}${t.accTo ? ' → ' + t.accTo : ''}\n📅 ${t.date}${t.note ? '\n📝 ' + String(t.note).replace(/https:\/\/\S+/g, '').trim() : ''}`, true);

/* ---------- Dữ liệu mở rộng (sổ nợ...) đồng bộ qua cfg 'stcx' ---------- */
const X = { d: { rec: [], debt: [], card: {}, flt: [] }, t: 0 };
try { Object.assign(X.d, JSON.parse(store.get('stcx', '{}'))); } catch (e) { }
async function xPull() { try { const j = await api({ cfg: {} }); if (j.off) return; const r = j.cfg && j.cfg.stcx; if (r) { X.t = r.t; try { Object.assign(X.d, JSON.parse(r.v)); } catch (e) { } store.set('stcx', r.v); } } catch (e) { } }
async function xSave() { const v = JSON.stringify(X.d); store.set('stcx', v); try { const j = await api({ cfg: { set: { stcx: { v, base: X.t } } } }); if (j.conflict && j.conflict.length) { await xPull(); toast('Sổ nợ vừa đổi trên máy khác, hãy thử lại', null, 1); render(); } else if (j.cfg && j.cfg.stcx) X.t = j.cfg.stcx.t; } catch (e) { toast(e.message, null, 1); } }
const dbLeft = d => Math.max(0, d.amount - (d.paid || 0));

/* ---------- Các màn hình ---------- */
const V = {};
V.home = () => {
  const B = balances(), sk = skipSet(), total = S.acc.reduce((s, a) => s + (sk.has(a.name) ? 0 : B[a.name] || 0), 0), L = stx().filter(t => inM(t, S.m)), thu = sumBy(L, 'Thu'), chi = sumBy(L, 'Chi');
  const lm = limits().filter(l => l.pct >= .8).slice(0, 3), recent = S.tx.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 6);
  return `<div class="card hero"><small>Tổng số dư</small><div class="big num sens">${vnd(total)}</div></div>${monthNav()}
<div class="kp"><div class="card"><small>Thu</small><b class="thu num sens">${NF.format(thu)}</b></div><div class="card"><small>Chi</small><b class="chi num sens">${NF.format(chi)}</b></div><div class="card"><small>Còn lại</small><b class="num sens ${thu - chi < 0 ? 'chi' : ''}">${sgn(thu - chi)}</b></div></div>
<form class="q" data-quick><input id="qk" placeholder="Nhập nhanh: ăn trưa 45k" aria-label="Nhập nhanh"><button class="btn pri">Ghi</button></form>
${lm.length ? `<div class="card"><h3>⚠️ Hạn mức cần chú ý</h3>${lm.map(l => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between"><b>${esc(l.name)} <small class="mu">/${l.per.toLowerCase()}</small></b><span class="num sens ${l.pct > 1 ? 'chi' : ''}">${NF.format(l.used)} / ${NF.format(l.v)}</span></div>${prog(l.pct, l.pct > 1 ? 'o' : 'w')}</div>`).join('')}</div>` : ''}
<div class="gr"><div class="card"><h3>Chi theo danh mục</h3>${donut(group(L.filter(t => t.type === 'Chi'), t => t.cat || ''), chi)}</div>
<div class="card fl"><h3 style="padding:16px 16px 4px">Gần đây <a href="#tx" class="mu" style="font-size:13px">Xem tất cả</a></h3>${recent.map(txRow).join('') || empty('Chưa có giao dịch', 'Bấm “Thêm” để ghi giao dịch đầu tiên.')}</div></div>`;
};
function filtered() {
  const q = fold(S.s).trim(); let L = S.tx.filter(t => (S.f === 'all' || t.type === S.f) && (!S.xa || t.acc === S.xa || t.accTo === S.xa) && (S.rg === 'a' || inM(t, S.m)));
  if (q) L = L.filter(t => fold([t.cat, t.sub, t.note, t.acc, t.accTo, t.amount, t.type].join(' ')).includes(q));
  return L.sort((a, b) => b.date.localeCompare(a.date) || String(b.at || '').localeCompare(String(a.at || '')));
}
V.tx = () => {
  const L = filtered(), shown = L.slice(0, S.pg); let last = '', h = '';
  shown.forEach(t => { if (t.date !== last) { last = t.date; const d = L.filter(x => x.date === t.date && x.type !== 'Chuyển khoản'), n = sumBy(d, 'Thu') - sumBy(d, 'Chi'); h += `<div class="dh"><span>${dLabel(t.date)}</span><span class="num sens">${sgn(n)}</span></div>`; } h += txRow(t); });
  const chip = (k, v, l) => `<button class="chip ${S[k] === v ? 'on' : ''}" data-set="${k}" data-v="${v}">${l}</button>`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">${S.rg === 'm' ? monthNav() : '<b>Toàn bộ thời gian</b>'}<span class="sp"></span><button class="btn" data-act="csv">⬇ CSV</button></div>
<div class="q"><input id="srch" type="search" placeholder="Tìm kiếm (không cần dấu)…  /" value="${esc(S.s)}"><select id="xa" style="width:auto"><option value="">Mọi tài khoản</option>${S.acc.map(a => `<option ${S.xa === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
<div class="chips">${chip('rg', 'm', 'Tháng này')}${chip('rg', 'a', 'Toàn bộ')}|${['all', 'Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'].map(t => chip('f', t, t === 'all' ? 'Tất cả' : t)).join('')}</div>
<div class="card fl">${h || empty('Không có giao dịch phù hợp')}${L.length > S.pg ? `<button class="row" data-act="more-tx" style="justify-content:center;font-weight:700">Xem thêm (${L.length - S.pg})</button>` : ''}</div>
<p class="mu" style="text-align:center">${L.length} giao dịch</p>`;
};
V.acc = () => {
  const B = balances(), L = S.acc.slice().sort((a, b) => (skipAcc(a) - skipAcc(b)));
  return `<div style="margin-bottom:12px"><button class="btn pri" data-act="acc-new">＋ Thêm tài khoản</button></div><div class="card fl">${L.map(a => `<button class="row" data-acc="${esc(a.name)}"><span class="dot">${ATY[a.type] || '🏦'}</span><span class="m"><b>${esc(a.name)}</b><small>${esc(a.type)}${skipAcc(a) ? ' · không tính vào thu chi' : ''}</small></span><span class="a num sens ${(B[a.name] || 0) < 0 ? 'chi' : ''}">${vnd(B[a.name] || 0)}</span></button>`).join('') || empty('Chưa có tài khoản')}</div>`;
};
V.lim = () => {
  const L = limits();
  return `${monthNav()}<div style="margin-bottom:12px"><button class="btn pri" data-act="lim-edit">Đặt hạn mức</button></div><div class="card">${L.map(l => `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between"><b>${emo(l.cat)} ${esc(l.name)} <small class="mu">/${l.per.toLowerCase()}</small></b><span class="num sens ${l.pct > 1 ? 'chi' : ''}">${Math.round(l.pct * 100)}%</span></div>${prog(l.pct, l.pct > 1 ? 'o' : l.pct >= .8 ? 'w' : '')}<small class="mu num sens">Đã chi ${NF.format(l.used)} / ${NF.format(l.v)}${l.pct > 1 ? ' · vượt ' + NF.format(l.used - l.v) : ' · còn ' + NF.format(l.v - l.used)}</small></div>`).join('') || empty('Chưa đặt hạn mức', 'Đặt hạn mức theo ngày hoặc tháng để được cảnh báo khi chi vượt.')}</div>`;
};
V.rp = () => {
  const ms = [5, 4, 3, 2, 1, 0].map(n => mShift(S.m, -n)), cur = stx().filter(t => inM(t, S.m) && t.type === 'Chi'), prev = stx().filter(t => inM(t, mShift(S.m, -1)) && t.type === 'Chi'), pv = Object.fromEntries(group(prev, t => t.cat || '')), tot = sumBy(cur, 'Chi'), avg = ms.reduce((s, m) => s + sumBy(stx().filter(t => inM(t, m)), 'Chi'), 0) / 6;
  return `${monthNav()}<div class="card"><h3>Thu / Chi 6 tháng <small class="mu">TB chi ${NF.format(avg)}</small></h3>${bars(ms)}</div>
<div class="card"><h3>Chi theo danh mục</h3>${group(cur, t => t.cat || '').map(([k, v], i) => { const d = v - (pv[k] || 0); return `<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between"><span>${emo(k)} ${esc(k || 'Chưa phân loại')}</span><b class="num sens">${NF.format(v)} <small class="${d > 0 ? 'chi' : 'thu'}">${pv[k] ? sgn(d) : 'mới'}</small></b></div><div class="bar"><i style="width:${v / tot * 100}%;background:${col(i)}"></i></div></div>`; }).join('') || empty('Chưa có chi tiêu tháng này')}</div>`;
};

V.debt = () => {
  const L = X.d.debt.map((d, i) => ({ d, i })).sort((a, b) => (dbLeft(a.d) === 0) - (dbLeft(b.d) === 0) || (a.d.due || '9999').localeCompare(b.d.due || '9999')), sum = dir => X.d.debt.filter(d => d.dir === dir).reduce((s, d) => s + dbLeft(d), 0), td = today();
  return `<div style="margin-bottom:12px"><button class="btn pri" data-act="debt-new">＋ Thêm khoản</button></div>
<div class="kp" style="grid-template-columns:1fr 1fr"><div class="card"><small>Mình đang nợ</small><b class="chi num sens">${vnd(sum('owe'))}</b></div><div class="card"><small>Người khác nợ mình</small><b class="thu num sens">${vnd(sum('lent'))}</b></div></div>
<div class="card fl">${L.map(({ d, i }) => { const left = dbLeft(d), late = left && d.due && d.due < td; return `<button class="row" data-debt="${i}"><span class="dot">${d.dir === 'owe' ? '📤' : '📥'}</span><span class="m"><b>${esc(d.who)}</b><small>${d.dir === 'owe' ? 'Mình nợ' : 'Nợ mình'}${d.due ? ' · hạn ' + dLabel(d.due) : ''}${late ? ' · quá hạn' : ''}${d.note ? ' · ' + esc(d.note) : ''}</small>${prog((d.paid || 0) / d.amount, left ? '' : '')}</span><span class="a num sens ${d.dir === 'owe' ? 'chi' : 'thu'}">${left ? vnd(left) : '✓ Xong'}</span></button>`; }).join('') || empty('Chưa có khoản nợ nào', 'Thêm khoản bạn nợ hoặc cho vay để theo dõi ngày hẹn và số còn lại.')}</div>`;
};
function debtForm(i) {
  const d = i == null ? { who: '', dir: 'owe', amount: 0, due: '', note: '', acc: defAcc() } : X.d.debt[i];
  openSheet(`<h3>${i == null ? 'Thêm khoản nợ' : 'Khoản nợ'}<button class="ib" data-act="close">✕</button></h3><div class="seg" style="grid-template-columns:1fr 1fr"><button data-dir="owe" class="${d.dir === 'owe' ? 'on' : ''}">Mình nợ</button><button data-dir="lent" class="${d.dir === 'lent' ? 'on' : ''}">Nợ mình</button></div><input type="hidden" id="d_dir" value="${d.dir}">
<label class="f"><span>Với ai</span><input id="d_who" value="${esc(d.who)}"></label><div class="g2"><label class="f"><span>Số tiền</span><div><input id="d_amt" class="money" value="${d.amount ? NF.format(d.amount) : ''}"><small class="hint mu"></small></div></label><label class="f"><span>Hạn</span><input id="d_due" type="date" value="${esc(d.due || '')}"></label></div>
<label class="f"><span>Ghi chú</span><input id="d_note" value="${esc(d.note || '')}"></label>
${i != null && dbLeft(d) ? `<div class="card" style="padding:12px"><b>Trả / thu một phần</b> <small class="mu">(còn ${vnd(dbLeft(d))})</small><div class="q" style="margin:8px 0 0"><div style="flex:1"><input id="d_pay" class="money" placeholder="Số tiền"><small class="hint mu"></small></div><button class="btn" data-act="debt-pay" data-i="${i}">Ghi</button></div></div>` : ''}
<div class="acts">${i != null ? `<button class="btn dng" data-act="debt-del" data-i="${i}">Xóa</button>` : ''}<button class="btn pri" data-act="debt-save" data-i="${i == null ? '' : i}">Lưu</button></div>`);
}
V.bal = () => { const B = balances(); return `<p class="mu">Nhập số dư thật (trong ví / app ngân hàng). App sẽ ghi giao dịch “Điều chỉnh” cho phần chênh.</p><div class="card fl">${S.acc.filter(a => a.type !== HELD).map(a => `<div class="row"><span class="dot">${ATY[a.type] || '🏦'}</span><span class="m"><b>${esc(a.name)}</b><small class="num sens">Trong sổ: ${vnd(B[a.name] || 0)}</small></span><div style="width:150px"><input class="money bl" data-neg="1" data-bacc="${esc(a.name)}" placeholder="Số dư thật"><small class="hint mu"></small></div></div>`).join('') || empty('Chưa có tài khoản')}</div><button class="btn pri" data-act="bal-save">Ghi điều chỉnh</button>`; };

V.more = () => `<div class="card fl">${[['rp', '📊', 'Báo cáo', 'Thu chi 6 tháng, theo danh mục'], ['debt', '🤝', 'Sổ nợ', 'Khoản bạn nợ và cho vay'], ['bal', '⚖️', 'Cân đối', 'Đối chiếu số dư thật'], ['cat', '🗂️', 'Hạng mục', 'Danh mục thu chi'], ['trash', '🗑️', 'Thùng rác', S.trash.length + ' mục có thể khôi phục'], ['sec', '⚙️', 'Cài đặt', 'Giao diện, Telegram, passkey, bảo mật']].map(([k, i, t, s]) => `<a class="row" href="#${k}" style="text-decoration:none;color:inherit"><span class="dot">${i}</span><span class="m"><b>${t}</b><small>${s}</small></span>›</a>`).join('')}</div>`;
V.cat = () => {
  const out = ['Chi', 'Thu'].map(t => { const P = [...new Set(S.cat.filter(c => c.t === t).map(c => c.p))]; return `<div class="card fl"><div class="dh"><span>${t}</span><button class="chip" data-act="cat-new" data-t="${t}">＋ Thêm</button></div>${P.map(p => `<div class="row" style="align-items:flex-start"><span class="dot">${emo(p)}</span><span class="m"><b>${esc(p)}</b><small style="white-space:normal">${S.cat.filter(c => c.t === t && c.p === p && c.c).map(c => `<a href="#" data-cat="${esc(t)}|${esc(c.p)}|${esc(c.c)}" style="color:inherit">${esc(c.c)}</a>`).join(' · ') || '—'}</small></span><button class="chip" data-cat="${esc(t)}|${esc(p)}|">Sửa</button></div>`).join('') || empty('Chưa có hạng mục')}</div>`; });
  return out.join('');
};
V.trash = () => {
  const K = { gd: 'Giao dịch', tk: 'Tài khoản', dm: 'Hạng mục' }, L = S.trash.filter(x => S.tf === 'all' || x.k === S.tf);
  return `<div class="chips">${['all', 'gd', 'tk', 'dm'].map(k => `<button class="chip ${S.tf === k ? 'on' : ''}" data-set="tf" data-v="${k}">${k === 'all' ? 'Tất cả' : K[k]}</button>`).join('')}</div><div class="card fl">${L.map(x => `<div class="row"><span class="dot">${x.k === 'gd' ? '🧾' : x.k === 'tk' ? '🏦' : '🗂️'}</span><span class="m"><b>${esc(x.k === 'gd' ? (x.sub || x.cat || x.type || 'Giao dịch') : x.k === 'tk' ? x.id : (x.cat || '') + ' › ' + (x.sub || ''))}</b><small>${esc(String(x.at || '').slice(0, 16))}${x.amount ? ' · ' + NF.format(x.amount) : ''}</small></span><button class="btn" data-restore="${esc(x.k)}|${esc(x.at)}">Khôi phục</button></div>`).join('') || empty('Thùng rác trống')}</div>${L.length ? `<button class="btn dng" data-act="purge" style="margin-top:4px">Dọn sạch thùng rác</button>` : ''}`;
};
V.sec = () => `<div class="card"><h3>Giao diện</h3><div class="chips">${[['auto', 'Tự động'], ['light', 'Sáng'], ['dark', 'Tối']].map(([k, l]) => `<button class="chip ${store.get('theme', 'auto') === k ? 'on' : ''}" data-theme="${k}">${l}</button>`).join('')}<button class="chip ${store.get('priv') === '1' ? 'on' : ''}" data-act="priv">Ẩn số tiền</button></div></div>
<div class="card"><h3>Telegram</h3><label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-tg style="width:auto" ${tgOn() ? 'checked' : ''}> Gửi thông báo giao dịch qua Telegram</label><button class="btn" data-act="tg-test">Gửi tin thử</button></div>
<div class="card"><h3>Passkey <button class="btn" data-act="pk-add">＋ Thêm</button></h3><div id="pkl" class="mu">Đang tải…</div></div>
<div class="card"><h3>Phiên đăng nhập</h3><div class="acts"><button class="btn" data-act="logoutall">Đăng xuất thiết bị khác</button><button class="btn dng" data-act="lock">Khóa sổ</button></div></div>`;
const TITLE = { debt: 'Sổ nợ', bal: 'Cân đối', home: 'Tổng quan', tx: 'Giao dịch', acc: 'Tài khoản', lim: 'Hạn mức', rp: 'Báo cáo', more: 'Thêm', cat: 'Hạng mục', trash: 'Thùng rác', sec: 'Bảo mật' };

/* ---------- Render + điều hướng ---------- */
let _scroll = {};
function render() {
  if (!S.ready) { $('#v').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>'; return; }
  if ($('#ov').classList.contains('open') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && $('#v').contains(document.activeElement) && S.tab !== 'tx') { S.dirty = true; return; }
  const tab = V[S.tab] ? S.tab : 'home', y = window.scrollY, f = document.activeElement && document.activeElement.id, sel = f === 'srch' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  $('#v').innerHTML = V[tab](); $('#ttl').textContent = TITLE[tab]; document.title = TITLE[tab] + ' · Sổ Thu Chi';
  const grp = { cat: 'more', trash: 'more', sec: 'more', rp: 'more', debt: 'more', bal: 'more' }[tab] || tab, lk = (k, l, on) => `<a href="#${k}" class="${on ? 'on' : ''}">${svg(k)}<span>${l}</span></a>`;
  $('#nv').innerHTML = SIDE.map(([k, l]) => lk(k, l, k === tab)).join('') + (S.trash.length ? '' : ''); $('#bn').innerHTML = TABS.map(([k, l]) => lk(k, l, k === grp)).join(''); S.dirty = false; window.scrollTo(0, y);
  if (f === 'srch') { const e = $('#srch'); e.focus(); e.setSelectionRange(...sel); }
  if (tab === 'sec') pkList();
}
const go = () => { S.tab = location.hash.slice(1) || 'home'; S.pg = 80; window.scrollTo(0, 0); render(); };
window.addEventListener('hashchange', go);

/* ---------- Form giao dịch ---------- */
const AI_ON = store.get('ai', '1') === '1';
async function scanFile(file) {
  if (!file) return; toast('Đang đọc ảnh…'); readForm();
  try {
    const img = await new Promise((ok, no) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = no; im.src = u; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', .85).split(',')[1];
    const j = await post({ image: data, mime: 'image/jpeg', today: today(), accounts: S.acc.filter(a => a.type !== HELD).map(a => ({ n: a.name, t: a.type })), cats: S.cat.map(x => ({ t: x.t, p: x.p, c: x.c })) }, 45000, '/api/scan');
    if (!j.ok || !j.data) return toast(j.err || 'AI không đọc được ảnh', null, 1);
    const d = j.data; if (['Chi', 'Thu', 'Chuyển khoản'].includes(d.type)) E.type = d.type; if (+d.amount > 0) E.amount = Math.round(+d.amount); if (/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) E.date = d.date; if (/^\d{1,2}:\d{2}/.test(d.time || '')) E.time = d.time.slice(0, 5).padStart(5, '0');
    const an = n => S.acc.find(a => a.name === n); if (an(d.account)) E.acc = d.account; if (an(d.account_to)) E.accTo = d.account_to;
    if (d.category && catsOf(E.type).includes(d.category)) { E.cat = d.category; if (d.detail && catsOf(E.type, d.category).includes(d.detail)) E.sub = d.detail; }
    if (d.note || d.memo || d.payee) E.note = d.note || d.memo || d.payee; drawForm(); toast('Đã điền từ ảnh, hãy kiểm tra lại');
  } catch (e) { toast('Không xử lý được ảnh', null, 1); }
}

let E = null;
const catsOf = (type, p) => [...new Set(S.cat.filter(c => c.t === type && (p === undefined ? true : c.p === p)).map(c => p === undefined ? c.p : c.c).filter(Boolean))];
function defAcc() { const a = store.get('lastAcc'); return S.acc.some(x => x.name === a) ? a : (S.acc.find(x => !skipAcc(x)) || S.acc[0] || {}).name || ''; }
function openForm(t) {
  E = t ? { ...t, amount: t.amount, isNew: false, old: t, time: (t.at || '').slice(11, 16) || '12:00' } : { id: uid(), type: 'Chi', date: today(), amount: 0, acc: defAcc(), accTo: '', cat: '', sub: '', note: '', isNew: true, time: nowAt().slice(11, 16) };
  drawForm();
}
function readForm() { if (!E || !$('#f_amt')) return; E.amount = amt($('#f_amt').value) ?? 0; E.date = $('#f_date').value; E.time = $('#f_time').value || E.time; E.acc = $('#f_acc').value; E.note = $('#f_note').value; if ($('#f_to')) E.accTo = $('#f_to').value; if ($('#f_cat')) { E.cat = $('#f_cat').value; E.sub = $('#f_sub') ? $('#f_sub').value : ''; } }
function drawForm() {
  const x = E.type === 'Chuyển khoản', cat = !x && E.type !== 'Điều chỉnh', opt = (l, v) => l.map(n => `<option ${n === v ? 'selected' : ''}>${esc(n)}</option>`).join(''), an = S.acc.map(a => a.name);
  openSheet(`${AI_ON ? '<label class="btn wide" style="border-style:dashed;margin-bottom:12px">📷 Quét ảnh hóa đơn / bill<input type="file" id="f_scan" accept="image/*" hidden></label>' : ''}<h3>${E.isNew ? 'Thêm giao dịch' : 'Sửa giao dịch'}<button class="ib" data-act="close">✕</button></h3>
<div class="seg">${['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'].map(t => `<button data-ty="${t}" class="${E.type === t ? 'on' : ''}">${t === 'Chuyển khoản' ? 'Chuyển' : t === 'Điều chỉnh' ? 'Chỉnh' : t}</button>`).join('')}</div>
<label class="f"><span>Số tiền</span><div><input id="f_amt" class="money" ${E.type === 'Điều chỉnh' ? 'data-neg="1"' : ''} inputmode="${E.type === 'Điều chỉnh' ? 'text' : 'decimal'}" value="${E.amount ? NF.format(E.amount) : ''}" placeholder="0   (45k, 1tr2, 20k+35k)" autocomplete="off"><small class="hint mu"></small></div></label>
<div class="g2"><label class="f"><span>Ngày</span><input id="f_date" type="date" value="${esc(E.date)}"></label><label class="f"><span>Giờ</span><input id="f_time" type="time" value="${esc(E.time)}"></label></div><div class="chips">${[['Hôm nay', 0], ['Hôm qua', 1], ['Hôm kia', 2]].map(([l, n]) => `<button type="button" class="chip" data-dq="${n}">${l}</button>`).join('')}</div>
<label class="f"><span>${x ? 'Từ tài khoản' : 'Tài khoản'}</span><select id="f_acc">${opt(an, E.acc)}</select></label>
${x ? `<label class="f"><span>Đến tài khoản</span><select id="f_to"><option value="">— chọn —</option>${opt(an.filter(n => n !== E.acc), E.accTo)}</select></label>` : ''}
${cat ? `<div class="g2"><label class="f"><span>Danh mục</span><select id="f_cat" data-cat-sel><option value="">— chưa phân loại —</option>${opt(catsOf(E.type), E.cat)}</select></label><label class="f"><span>Chi tiết</span><select id="f_sub"><option value="">—</option>${opt(catsOf(E.type, E.cat), E.sub)}</select></label></div>` : ''}
<label class="f"><span>Ghi chú</span><input id="f_note" value="${esc(E.note)}" placeholder="Ghi chú"></label>
<div class="acts">${E.isNew ? '' : '<button class="btn dng" data-act="f-del">Xóa</button>'}<button class="btn pri" data-act="f-save">Lưu</button></div>`);
}
async function formSave() {
  readForm(); const t = E.type, a = E.amount, row = { id: E.id, type: t, date: E.date, amount: a, acc: E.acc, accTo: t === 'Chuyển khoản' ? E.accTo : '', cat: t === 'Chuyển khoản' || t === 'Điều chỉnh' ? '' : E.cat, sub: t === 'Chuyển khoản' || t === 'Điều chỉnh' ? '' : E.sub, note: E.note.trim(), at: E.date + ' ' + (E.time || '12:00') + ':00' };
  if (E.old) Object.keys(E.old).forEach(k => { if (!(k in row)) row[k] = E.old[k]; });
  if (!a || (a < 0 && t !== 'Điều chỉnh')) return toast('Hãy nhập số tiền hợp lệ', null, 1);
  if (!row.acc) return toast('Chọn tài khoản', null, 1);
  if (t === 'Chuyển khoản' && (!row.accTo || row.accTo === row.acc)) return toast('Chọn tài khoản nhận khác tài khoản nguồn', null, 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return toast('Ngày không hợp lệ', null, 1);
  if (E.isNew && S.tx.some(x => x.date === row.date && x.acc === row.acc && x.amount === row.amount && x.type === row.type && Date.now() - Date.parse((x.at || '').replace(' ', 'T')) < 6e4) && !await ask('Có thể trùng giao dịch', 'Vừa có giao dịch giống hệt trong 1 phút qua. Vẫn lưu?', 'Vẫn lưu')) return;
  store.set('lastAcc', row.acc); const old = E.old; closeSheet(); txSave(row, old);
}
async function quickAdd(text) {   // "ăn trưa 45k" → Chi, đoán danh mục từ giao dịch cũ có cùng ghi chú
  const m = text.trim().match(/^(.*?)\s*(-?\d[\d.,]*\s*(?:k|nghìn|ngàn|tr|triệu|m|tỷ)?\d*)$/i); if (!m) return toast('Cú pháp: mô tả rồi số tiền, ví dụ “ăn trưa 45k”', null, 1);
  const a = pm(m[2]), note = m[1].trim(), q = fold(note), hit = q && S.tx.find(t => t.type === 'Chi' && fold(t.note) === q) || q && S.tx.find(t => t.type === 'Chi' && fold(t.note).includes(q));
  if (!a || a < 0) return toast('Số tiền chưa hợp lệ', null, 1);
  txSave({ id: uid(), type: 'Chi', date: today(), amount: a, acc: hit ? hit.acc : defAcc(), accTo: '', cat: hit ? hit.cat : '', sub: hit ? hit.sub : '', note, at: nowAt() }, null);
}

/* ---------- Tài khoản / hạng mục / hạn mức ---------- */
const val = id => ($(id) || {}).value || '';
function accForm(name) {
  const a = S.acc.find(x => x.name === name), ty = ['Tiền mặt', 'Ngân hàng', 'Thẻ tín dụng', 'Ví điện tử', 'Tiết kiệm', HELD];
  openSheet(`<h3>${a ? 'Sửa tài khoản' : 'Thêm tài khoản'}<button class="ib" data-act="close">✕</button></h3><label class="f"><span>Tên</span><input id="a_n" value="${esc(a ? a.name : '')}"></label>
<div class="g2"><label class="f"><span>Loại</span><select id="a_t">${ty.map(t => `<option ${a && a.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="f"><span>Số dư đầu kỳ</span><div><input id="a_o" class="money" data-neg="1" value="${a && a.open ? NF.format(a.open) : ''}"><small class="hint mu"></small></div></label></div>
<label class="f" style="display:flex;gap:8px;align-items:center"><input id="a_s" type="checkbox" style="width:auto" ${a && a.skip ? 'checked' : ''}> Không tính vào thu chi</label>
<div class="acts">${a ? '<button class="btn dng" data-act="a-del" data-n="' + esc(a.name) + '">Xóa</button>' : ''}<button class="btn pri" data-act="a-save" data-old="${esc(a ? a.name : '')}">Lưu</button></div>`);
}
function accSave(old) {
  const name = val('#a_n').trim(); if (!name) return toast('Nhập tên tài khoản', null, 1);
  if (name !== old && S.acc.some(a => a.name === name)) return toast('Tên tài khoản đã tồn tại', null, 1);
  const o = S.acc.find(a => a.name === old); closeSheet();
  act([{ op: 'acc.save', acc: { name, type: val('#a_t'), open: amt(val('#a_o')) || 0, skip: $('#a_s').checked }, old: o || null }], 'Đã lưu');
}
function catForm(t, p, c) {
  const o = S.cat.find(x => x.t === t && x.p === p && (x.c || '') === (c || '')); openSheet(`<h3>${o ? 'Sửa hạng mục' : 'Thêm hạng mục'}<button class="ib" data-act="close">✕</button></h3>
<label class="f"><span>Loại</span><select id="c_t">${['Chi', 'Thu'].map(x => `<option ${x === t ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
<label class="f"><span>Nhóm</span><input id="c_p" value="${esc(p || '')}"></label><label class="f"><span>Chi tiết (tùy chọn)</span><input id="c_c" value="${esc(c || '')}"></label>
<div class="acts">${o ? `<button class="btn dng" data-act="c-del" data-k="${esc(t)}|${esc(p)}|${esc(c || '')}">Xóa</button>` : ''}<button class="btn pri" data-act="c-save" data-k="${o ? esc(t) + '|' + esc(p) + '|' + esc(c || '') : ''}">Lưu</button></div>`);
}
function limForm() {
  const par = [...new Set(S.cat.filter(c => c.t === 'Chi').map(c => c.p))], rows = ['', ...par], g = (per, cat) => (S.lim.find(l => l.per === per && l.cat === cat) || {}).v || 0;
  openSheet(`<h3>Hạn mức chi<button class="ib" data-act="close">✕</button></h3><p class="mu" style="margin-top:-6px">Để trống hoặc 0 = không giới hạn.</p>${rows.map(c => `<div class="g2"><label class="f"><span>${esc(c || 'Tổng chi')} · ngày</span><input class="lm money" data-per="Ngày" data-cat="${esc(c)}" value="${g('Ngày', c) ? NF.format(g('Ngày', c)) : ''}"><small class="hint"></small></label><label class="f"><span>${esc(c || 'Tổng chi')} · tháng</span><input class="lm money" data-per="Tháng" data-cat="${esc(c)}" value="${g('Tháng', c) ? NF.format(g('Tháng', c)) : ''}"><small class="hint"></small></label></div>`).join('')}<div class="acts"><button class="btn pri" data-act="l-save">Lưu hạn mức</button></div>`);
}
function csv() {
  const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"', L = filtered(), b = new Blob(['\ufeff' + ['Ngày,Loại,Số tiền,Tài khoản,Đến TK,Danh mục,Chi tiết,Ghi chú'].concat(L.map(t => [t.date, t.type, t.amount, t.acc, t.accTo, t.cat, t.sub, t.note].map(q).join(','))).join('\r\n')], { type: 'text/csv' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = 'so-thu-chi-' + today() + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Passkey (WebAuthn) ---------- */
const ACC_URL = STORE ? STORE.replace(/[^/]*$/, 'account') : '';
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), ub = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const pkApi = async (act, extra) => { const j = await post({ act, ...extra }, 20000, ACC_URL); if (j.auth) { showLogin(); throw new Error(j.err); } if (!j.ok) throw new Error(j.err || 'Lỗi'); return j; };
async function pkLogin() {
  try {
    const o = await pkApi('authopts'), c = await navigator.credentials.get({ publicKey: { challenge: ub(o.challenge), rpId: o.rpId, allowCredentials: o.allow.map(id => ({ type: 'public-key', id: ub(id) })), userVerification: 'required', timeout: 60000 } }), r = c.response;
    await pkApi('authverify', { cred: { id: c.id, response: { clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature) } } }); boot();
  } catch (e) { if (e.name !== 'NotAllowedError') $('#lerr').textContent = e.message; }
}
async function pkAdd() {
  try {
    const o = await pkApi('regopts'), c = await navigator.credentials.create({ publicKey: { challenge: ub(o.challenge), rp: o.rp, user: { id: ub(o.user.id), name: o.user.name, displayName: o.user.displayName }, pubKeyCredParams: o.params, authenticatorSelection: o.sel, excludeCredentials: o.exclude.map(id => ({ type: 'public-key', id: ub(id) })), timeout: 60000 } }), r = c.response;
    await pkApi('regverify', { cred: { id: c.id, alg: r.getPublicKeyAlgorithm(), publicKey: b64(r.getPublicKey()), response: { clientDataJSON: b64(r.clientDataJSON) } } }); toast('Đã thêm passkey'); pkList();
  } catch (e) { if (e.name !== 'NotAllowedError') toast(e.message, null, 1); }
}
async function pkList() {
  const el = $('#pkl'); if (!el) return;
  try { const j = await pkApi('info'); el.innerHTML = j.passkeys.length ? j.passkeys.map(p => `<div class="row" style="padding:8px 0"><span class="m"><b>${esc(p.n || 'Passkey')}</b><small>Tạo ${new Date(p.t).toLocaleDateString('vi-VN')}${p.l ? ' · dùng ' + new Date(p.l).toLocaleDateString('vi-VN') : ''}</small></span><button class="btn dng" data-pkdel="${esc(p.id)}">Xóa</button></div>`).join('') : 'Chưa có passkey.'; }
  catch (e) { el.textContent = e.message; }
}

/* ---------- Đăng nhập / khóa ---------- */
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').value = ''; $('#lerr').textContent = ''; setTimeout(() => $('#pw').focus(), 50); post({ act: 'has' }, 8000, ACC_URL).then(j => { }).catch(() => { }); $('#pkb').hidden = !window.PublicKeyCredential; }
$('#lf').addEventListener('submit', async e => {
  e.preventDefault(); const pw = $('#pw').value; if (!pw) return; $('#lb').disabled = true;
  let j; try { j = await post({ login: pw }, 20000); } catch (x) { j = { ok: false, err: x.message }; } $('#lb').disabled = false;
  if (j.ok) return boot();
  $('#lerr').textContent = j.wait ? 'Thử sai quá nhiều lần, thử lại sau ' + Math.ceil(j.wait / 60) + ' phút' : (j.err && j.err !== 'Sai mật khẩu') ? j.err : 'Sai mật khẩu';
  $('#lf').classList.remove('shake'); void $('#lf').offsetWidth; $('#lf').classList.add('shake'); $('#pw').select();
});
$('#pwt').onclick = () => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; };
$('#pkb').onclick = pkLogin;
function lock() { post({ logout: 1 }, 5000).catch(() => { }); S.ready = false; S.tx = S.acc = S.cat = S.lim = S.trash = []; S.rev = ''; try { localStorage.removeItem('cache'); sessionStorage.clear(); } catch (e) { } showLogin(); }

/* ---------- Hành động (ủy quyền sự kiện) ---------- */
const A = {
  new: () => openForm(), close: closeSheet, undo: () => { const u = $('#toast')._u; $('#toast').classList.remove('on'); u && u(); },
  theme: () => { const d = !document.documentElement.classList.contains('dark'); setTheme(d ? 'dark' : 'light'); }, lock: () => lock(), csv,
  priv: () => { const on = document.documentElement.classList.toggle('priv'); store.set('priv', on ? '1' : '0'); render(); },
  'f-save': formSave, 'f-del': async () => { const id = E.id; if (await ask('Xóa giao dịch?', 'Giao dịch sẽ được chuyển vào Thùng rác.', 'Xóa')) { closeSheet(); txDel(id); } },
  'more-tx': () => { S.pg += 80; render(); }, 'acc-new': () => accForm(), 'a-save': el => accSave(el.dataset.old),
  'a-del': async el => { if (await ask('Xóa tài khoản?', 'Tài khoản sẽ vào Thùng rác, có thể khôi phục.', 'Xóa')) { closeSheet(); act([{ op: 'acc.del', name: el.dataset.n }], 'Đã chuyển vào Thùng rác'); } },
  'cat-new': el => catForm(el.dataset.t), 'c-save': el => {
    const t = val('#c_t'), p = val('#c_p').trim(), c = val('#c_c').trim(); if (!p) return toast('Nhập tên nhóm', null, 1); const k = el.dataset.k ? el.dataset.k.split('|') : null, o = k ? { t: k[0], p: k[1], c: k[2] } : null; closeSheet(); act([{ op: 'cat.save', cat: { t, p, c }, old: o }], 'Đã lưu');
  }, 'c-del': async el => { const k = el.dataset.k.split('|'); if (await ask('Xóa hạng mục?', 'Hạng mục sẽ vào Thùng rác.', 'Xóa')) { closeSheet(); act([{ op: 'cat.del', cat: { t: k[0], p: k[1], c: k[2] } }], 'Đã chuyển vào Thùng rác'); } },
  'lim-edit': limForm, 'l-save': () => {
    const ops = []; $$('.lm').forEach(i => { const v = amt(i.value) || 0, o = (S.lim.find(l => l.per === i.dataset.per && l.cat === i.dataset.cat) || {}).v || 0; if (v >= 0 && v !== o) ops.push({ op: 'lim.set', per: i.dataset.per, cat: i.dataset.cat, v }); });
    closeSheet(); if (ops.length) act(ops, 'Đã lưu hạn mức');
  },
  purge: async () => { const L = S.trash.filter(x => S.tf === 'all' || x.k === S.tf); if (await ask('Dọn thùng rác?', 'Xóa hẳn ' + L.length + ' mục, không thể khôi phục.', 'Xóa hẳn')) act([{ op: 'trash.purge', items: L.map(x => ({ at: x.at, kind: x.k, id: x.id || '' })) }], 'Đã dọn thùng rác'); },
  'debt-new': () => debtForm(), 'debt-save': el => {
    const who = val('#d_who').trim(), a = amt(val('#d_amt')) || 0; if (!who || a <= 0) return toast('Nhập tên và số tiền', null, 1); const i = el.dataset.i === '' ? null : +el.dataset.i, o = { who, dir: val('#d_dir'), amount: a, due: val('#d_due'), note: val('#d_note').trim() };
    if (i == null) X.d.debt.push({ id: uid(), paid: 0, at: Date.now(), acc: defAcc(), ...o }); else Object.assign(X.d.debt[i], o); closeSheet(); xSave(); render();
  }, 'debt-del': async el => { if (await ask('Xóa khoản nợ?', 'Không thể khôi phục.', 'Xóa')) { X.d.debt.splice(+el.dataset.i, 1); closeSheet(); xSave(); render(); } },
  'debt-pay': async el => { const d = X.d.debt[+el.dataset.i], a = Math.min(amt(val('#d_pay')) || 0, dbLeft(d)); if (!(a > 0)) return toast('Nhập số tiền', null, 1); d.paid = (d.paid || 0) + a; closeSheet(); xSave(); render();
    if (await ask('Ghi vào sổ thu chi?', 'Tạo giao dịch ' + (d.dir === 'owe' ? 'Chi' : 'Thu') + ' ' + NF.format(a) + ' để số dư khớp.', 'Ghi')) { openForm(); E.type = d.dir === 'owe' ? 'Chi' : 'Thu'; E.amount = a; E.acc = d.acc || E.acc; E.note = (d.dir === 'owe' ? 'Trả nợ ' : 'Thu nợ ') + d.who; drawForm(); } },
  'bal-save': async () => { const B = balances(), rows = []; $$('.bl').forEach(i => { if (!i.value.trim()) return; const r = amt(i.value); if (r == null) return; const diff = r - (B[i.dataset.bacc] || 0); if (diff) rows.push({ id: uid(), type: 'Điều chỉnh', date: today(), amount: diff, acc: i.dataset.bacc, accTo: '', cat: '', sub: '', note: 'Cân đối số dư', at: nowAt() }); });
    if (!rows.length) return toast('Số dư đã khớp, không cần điều chỉnh'); if (!await ask('Ghi ' + rows.length + ' điều chỉnh?', rows.map(r => r.acc + ': ' + sgn(r.amount)).join('\n'), 'Ghi')) return; commit(rows.map(row => ({ op: 'tx.save', row })), { local: () => { S.tx = S.tx.concat(rows); }, ok: 'Đã cân đối ' + rows.length + ' tài khoản' }); },
  'tg-test': async () => { const r = await tgSend('✅ Sổ Thu Chi: kết nối Telegram hoạt động'); toast(r.ok ? 'Đã gửi tin thử' : (r.err || 'Gửi thất bại'), null, !r.ok); },
  'pk-add': pkAdd, logoutall: async () => { if (!await ask('Đăng xuất thiết bị khác?', 'Giữ lại máy này, các máy khác phải đăng nhập lại.', 'Đăng xuất')) return; try { const j = await post({ logoutAll: 1 }); toast(j.ok ? 'Đã đăng xuất các thiết bị khác' : j.err, null, !j.ok); } catch (e) { toast(e.message, null, 1); } }
};
function setTheme(v) { store.set('theme', v); const d = v === 'dark' || (v === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches); document.documentElement.classList.toggle('dark', d); document.querySelector('meta[name=theme-color]').content = d ? '#0B0F19' : '#F4F5F9'; if (S.tab === 'sec') render(); }
document.addEventListener('click', async e => {
  const t = e.target, c = s => t.closest(s);
  let el;
  if ((el = c('[data-act]'))) { const f = A[el.dataset.act]; return f && f(el, e); }
  if ((el = c('[data-debt]'))) return debtForm(+el.dataset.debt);
  if ((el = c('[data-dir]'))) { $('#d_dir').value = el.dataset.dir; $$('[data-dir]').forEach(b => b.classList.toggle('on', b === el)); return; }
  if ((el = c('[data-dq]'))) { $('#f_date').value = ymd(new Date(Date.now() - 864e5 * el.dataset.dq)); return; }
  if ((el = c('[data-edit]'))) return openForm(S.tx.find(x => x.id === el.dataset.edit));
  if ((el = c('[data-acc]'))) return accForm(el.dataset.acc);
  if ((el = c('[data-cat]'))) { e.preventDefault(); const [a, b, d] = el.dataset.cat.split('|'); return catForm(a, b, d); }
  if ((el = c('[data-ty]'))) { readForm(); E.type = el.dataset.ty; if (E.type === 'Chuyển khoản') { E.cat = E.sub = ''; } else E.accTo = ''; return drawForm(); }
  if ((el = c('[data-m]'))) { S.m = mShift(S.m, +el.dataset.m); return render(); }
  if ((el = c('[data-set]'))) { S[el.dataset.set] = el.dataset.v; S.pg = 80; return render(); }
  if ((el = c('[data-theme]'))) return setTheme(el.dataset.theme);
  if ((el = c('[data-restore]'))) { const [k, at] = el.dataset.restore.split('|'); return act([{ op: 'restore', at, kind: k }], 'Đã khôi phục'); }
  if ((el = c('[data-pkdel]'))) { if (await ask('Xóa passkey?', 'Thiết bị này sẽ không đăng nhập bằng passkey được nữa.', 'Xóa')) { try { await pkApi('pkdel', { id: el.dataset.pkdel }); pkList(); } catch (x) { toast(x.message, null, 1); } } }
});
document.addEventListener('change', e => {
  if (e.target.id === 'xa') { S.xa = e.target.value; render(); }
  if (e.target.id === 'f_scan') scanFile(e.target.files[0]);
  if (e.target.matches('[data-tg]')) store.set('tg', e.target.checked ? '1' : '0');
  if (e.target.id === 'f_cat') { readForm(); E.sub = ''; drawForm(); }
  if (e.target.id === 'f_acc' && E.type === 'Chuyển khoản') { readForm(); drawForm(); }
});
let _st; document.addEventListener('input', e => { if (e.target.id === 'srch') { S.s = e.target.value; clearTimeout(_st); _st = setTimeout(render, 160); } });
document.addEventListener('submit', e => { if (e.target.matches('[data-quick]')) { e.preventDefault(); const i = $('#qk'), v = i.value; if (v.trim()) { i.value = ''; quickAdd(v); } } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#cf').classList.contains('open')) $('#cfn').click(); else closeSheet(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && E && $('#ov').classList.contains('open')) return formSave();
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey || $('#ov').classList.contains('open')) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openForm(); }
  else if (e.key === '/') { e.preventDefault(); location.hash = 'tx'; setTimeout(() => { const s = $('#srch'); s && s.focus(); }, 30); }
  else if (/^[1-5]$/.test(e.key)) location.hash = TABS[+e.key - 1][0];
});

/* ---------- Đồng bộ ---------- */
let inflight = false, fails = 0, skip = 0;
const live = (k, t) => { const l = $('#live'); l.className = 'live ' + k; l.querySelector('b').textContent = t; };
async function sync(manual) {
  if (inflight || S.busy || (!manual && document.hidden)) return; if (!manual && S.ready && fails > 3 && ++skip % 5) return; inflight = true;
  try {
    S.q = await Ob.count(); const j = await api({ ops: [], rev: manual || S.q ? '' : S.rev }, 30000); fails = 0;
    if (S.busy) return; const first = !S.ready; S.ready = true; if (j.crev !== undefined && j.crev !== S.crev) { S.crev = j.crev; xPull().then(() => render()); } live('ok', S.q ? 'Đang gửi ' + S.q + ' thay đổi' : 'Đã đồng bộ');
    if (!S.q && apply(j) || first) { if (first) apply(j); render(); }
  } catch (e) { fails++; live('err', e.message); if (!S.ready) $('#v').innerHTML = empty('Không tải được dữ liệu', esc(e.message) + '<br><br><button class="btn pri" onclick="sync(true)">Thử lại</button>'); }
  finally { inflight = false; if (S.dirty && !$('#ov').classList.contains('open')) render(); }
}
window.sync = sync;
setInterval(() => sync(), POLL);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
window.addEventListener('online', () => { Ob.kick(); sync(true); });
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => { }); navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !window.__rl) { window.__rl = 1; location.reload(); } });
  navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (d.type === 'note') toast(d.body, null, 1); if (d.type === 'open-tab' && d.tab) location.hash = d.tab; });
}

/* ---------- Khởi động ---------- */
function boot(fresh) { $('#login').hidden = true; $('#app').hidden = false; S.tab = location.hash.slice(1) || 'home'; render(); live('wait', 'Đang kết nối'); fresh ? sync() : sync(true); Ob.kick(); }
(async () => { // có cookie hợp lệ → vào thẳng; không thì hiện màn đăng nhập
  try { const j = await post({ ops: [], rev: '' }, 15000); if (j.auth) return showLogin(); if (j.ok) apply(j), S.ready = true; boot(true); } catch (e) { if (S.ready) boot(); else showLogin(); }
})();
