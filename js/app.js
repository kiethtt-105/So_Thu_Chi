const { PASS, API } = window.CONFIG || {}, WANT = 'v5', POLL_MS = 2000, TTL = 12 * 3600e3;
try {
    localStorage.removeItem('sess');
}
catch (e) { }
const alive = () => { const t = +sessionStorage.sess || 0; return t && Date.now() - t < TTL; }, touch = () => { sessionStorage.sess = Date.now(); };
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const num = n => new Intl.NumberFormat('vi-VN').format(n), vnd = n => num(Math.round(n)) + ' ₫';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const newId = i => 'G' + Date.now().toString(36) + (i || 0) + Math.floor(Math.random() * 1296).toString(36);
const pm = v => { const s = String(v || '').trim(), n = Number(s.replace(/[^\d]/g, '')); return n ? (s.startsWith('-') ? -n : n) : 0; };
const fm = el => { const s = el.value.trim(), ng = el.dataset.neg && s.startsWith('-'), d = s.replace(/[^\d]/g, ''); el.value = (ng ? '-' : '') + (d ? num(+d) : ''); };
const TYPES = ['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'], CLS = { Thu: 'thu', Chi: 'chi', 'Chuyển khoản': 'chuyen', 'Điều chỉnh': 'dc' };
const HELD = 'Giữ Hộ';
const ACC_TYPES = ['Tiền mặt', 'Ngân hàng', 'Thẻ tín dụng', 'Ví điện tử', 'Tiết kiệm', HELD];
const IC = { home: 'M3 11l9-8 9 8M5 10v10h14V10', tx: 'M4 6h16M4 12h16M4 18h10', rec: 'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', lim: 'M4 18a8 8 0 1 1 16 0M12 18l4-6', acc: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18', cat: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', tr: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', more: 'M5 12h.01M12 12h.01M19 12h.01', dl: 'M12 4v11M7 11l5 5 5-5M5 20h14', pl: 'M12 5v14M5 12h14', fl: 'M4 5h16l-6 8v6l-4-2v-4z', rp: 'M5 20V11M12 20V4M19 20v-6' };
const ic = k => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[k]}"/></svg>`;
IC.ba = 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3';
IC.bc = 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01';
IC.bl = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01';
const TABS = [['home', 'Tổng quan', 'Sổ sách'], ['rp', 'Báo cáo'], ['tx', 'Tất cả', 'Giao dịch'], ['ba', 'Theo tài khoản'], ['bc', 'Theo danh mục'], ['bl', 'Theo hạn mức'], ['rec', 'Cân đối', 'Quản lý'], ['lim', 'Hạn mức'], ['acc', 'Tài khoản'], ['cat', 'Hạng mục'], ['tr', 'Thùng rác']], MOB = ['home', 'tx', 'rp', 'lim'], MONTHLY = ['home', 'tx', 'ba', 'bc', 'bl', 'lim', 'acc', 'cat'], GRP_TX = ['tx', 'ba', 'bc', 'bl'], SHORT = { tx: 'Giao dịch' };
const SN = { GiaoDich: 'Giao dịch', TaiKhoan: 'Tài khoản', DanhMuc: 'Hạng mục', HanMuc: 'Hạn mức', DaXoa: 'Thùng rác' };
const PAL = [1, 2, 3, 4, 5, 6, 7, 8].map(i => 'var(--c' + i + ')'), col = i => PAL[i % PAL.length];
const EMO = [[/đầu tư|lãi|lời|cổ phiếu|chứng khoán/i, '📈'], [/làm thêm|freelance|việc phụ/i, '💼'], [/cân đối|điều chỉnh/i, '⚖️'], [/^\s*khác\s*$/i, '📦'], [/ăn|uống|cơm|cafe|cà phê|nhà hàng/i, '🍜'], [/xe|xăng|đi lại|grab|taxi/i, '🛵'], [/nhà|thuê|điện|nước|internet/i, '🏠'], [/mua|sắm|quần|áo/i, '🛍️'], [/y tế|thuốc|khám|sức khỏe/i, '💊'], [/học|sách|giáo dục/i, '📚'], [/giải trí|phim|game|du lịch/i, '🎮'], [/lương|thưởng|thu/i, '💰'], [/quà|từ thiện|cho/i, '🎁'], [/tiết kiệm/i, '🐷']];
const emo = k => (EMO.find(e => e[0].test(k || '')) || [0, '🧾'])[1];
const ATYPE = { 'Tiền mặt': ['💵', '#15803D'], 'Ngân hàng': ['🏦', '#2563EB'], 'Thẻ tín dụng': ['💳', '#7C3AED'], 'Ví điện tử': ['👛', '#DB2777'], 'Tiết kiệm': ['🐷', '#D97706'], [HELD]: ['🤝', '#667085'] }, ATORD = ['Tiền mặt', 'Ngân hàng', 'Ví điện tử', 'Thẻ tín dụng', 'Tiết kiệm', HELD], EM = ['💵', '🏦', '💳', '👛', '🐷', '📱', '💰', '🪙', '🏧', '🛒', '📈', '🎯'];
const BR = [[/grab/i, 'G', '#00B14F'], [/momo/i, 'M', '#A50064'], [/zalo/i, 'Z', '#0068FF'], [/shopee/i, 'S', '#EE4D2D'], [/vcb|vietcombank/i, 'VCB', '#007A3D'], [/tcb|techcom/i, 'TCB', '#E3000F'], [/\bmb\b|mbbank/i, 'MB', '#1C3FAA'], [/bidv/i, 'BIDV', '#1D6E8C'], [/acb/i, 'ACB', '#0057A8'], [/vpbank/i, 'VP', '#00A651'], [/tpbank/i, 'TP', '#6A1B9A'], [/agribank/i, 'AGR', '#AE1C3F'], [/sacombank/i, 'STB', '#0A5EAB'], [/vietinbank|ctg/i, 'CTG', '#0B4DA2'], [/vnpay/i, 'VN', '#0F4C99'], [/viettel/i, 'VT', '#EE0033']];
let AI = {};
try {
    AI = JSON.parse(localStorage.aicon || '{}');
}
catch (e) { }
function aIco(a) {
    const t = ATYPE[a.type] || ['🏦', '#667085'], o = AI[a.name];
    if (o)
        return `<span class="dot" style="background:color-mix(in srgb,${t[1]} 16%,transparent)">${o}</span>`;
    const b = BR.find(x => x[0].test(a.name));
    if (b)
        return `<span class="dot" style="background:${b[2]};color:#fff;font-size:${b[1].length > 2 ? 10 : b[1].length > 1 ? 12 : 15}px">${b[1]}</span>`;
    return `<span class="dot" style="background:color-mix(in srgb,${t[1]} 16%,transparent)">${t[0]}</span>`;
}
if (!window.CONFIG)
    $('#lerr').textContent = 'Thiếu file config.js';
const S = { tx: [], acc: [], cat: [], lim: [], trash: [], issues: [], rev: '', m: ymd(new Date()).slice(0, 7), tab: location.hash.slice(1) || 'home', f: 'all', q: '', rg: 'm', so: 'dn', xa: '', xc: '', mn: '', mx: '', d1: '', d2: '', fo: false, act: {}, ready: false, busy: 0, err: '' };
let E = null, ED = null;
if (!TABS.some(t => t[0] === S.tab))
    S.tab = 'home';
try {
    const c = JSON.parse(sessionStorage.cache || 'null');
    if (c) {
        ['tx', 'acc', 'cat', 'lim', 'trash', 'issues'].forEach(k => S[k] = c[k] || []);
        S.ready = true;
    }
}
catch (e) { }
const themeMode = () => localStorage.theme || (localStorage.dark === '1' ? 'dark' : localStorage.dark === '0' ? 'light' : 'auto');
const isDark = () => { const m = themeMode(); return m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches); };
function applyTheme() { const d = isDark(); [document.documentElement, document.body].forEach(e => e.classList.toggle('dark', d)); const m = document.querySelector('meta[name=theme-color]'); if (m)
    m.content = d ? '#080C16' : '#F1F3F8'; }
function setTheme(v) { try {
    localStorage.theme = v;
}
catch (e) { } applyTheme(); }
const toggleTheme = () => setTheme(isDark() ? 'light' : 'dark');
applyTheme();
try {
    matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => { if (themeMode() === 'auto')
        applyTheme(); });
}
catch (e) { }
try {
    localStorage.removeItem('hb');
}
catch (e) { }
async function call(ops, rev) {
    if (!API)
        throw Error('Thiếu địa chỉ API: file config.js chưa được tải');
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000);
    let r;
    try {
        r = await fetch(API, { method: 'POST', signal: ac.signal, body: JSON.stringify({ ops: ops || [], rev: rev || '' }) });
    }
    catch (e) {
        throw Error('Không có kết nối mạng');
    }
    finally {
        clearTimeout(tm);
    }
    let j;
    try {
        j = await r.json();
    }
    catch (e) {
        throw Error('Máy chủ chưa phản hồi đúng. Vui lòng kiểm tra lại cấu hình kết nối');
    }
    if (!j.ok) {
        if (/Hành động không hợp lệ/i.test(j.err || ''))
            throw Error('Máy chủ đang chạy phiên bản cũ. Vui lòng cập nhật lên phiên bản mới nhất.');
        throw Error(j.err || 'Lỗi máy chủ');
    }
    return j;
}
function stamp() { const t = 'Đã đồng bộ ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); $('#st').textContent = t; $('#st2').textContent = t; }
function apply(j) {
    stamp();
    if (j.same)
        return false;
    ['tx', 'acc', 'cat', 'lim', 'trash', 'issues'].forEach(k => S[k] = j[k] || []);
    S.rev = j.rev;
    S.ready = true;
    try {
        sessionStorage.cache = JSON.stringify({ tx: S.tx, acc: S.acc, cat: S.cat, lim: S.lim, trash: S.trash, issues: S.issues });
    }
    catch (e) { }
    return true;
}
const setLive = s => { const e = $('#live'); if (!e || e.dataset.s === s)
    return; e.dataset.s = s; e.className = 'live ' + s; e.lastChild.textContent = { ok: 'Live', err: 'Mất kết nối', wait: 'Đang kết nối' }[s]; };
const spin = on => { const e = $('#rf'); if (e)
    e.classList.toggle('spin', on); };
function ask(title, msg, o) {
    o = o || {};
    return new Promise(res => {
        const c = $('#cf');
        $('#cft').textContent = title;
        $('#cfm').textContent = msg || '';
        $('#cfi').textContent = o.icon || (o.danger ? '🗑️' : '❓');
        $('#cfo').textContent = o.ok || 'Đồng ý';
        $('#cfn').textContent = o.cancel || 'Hủy';
        c.classList.toggle('danger', !!o.danger);
        c.classList.add('open');
        $('#cfo').focus();
        const done = v => { c.classList.remove('open'); $('#cfo').onclick = $('#cfn').onclick = c.onclick = null; document.removeEventListener('keydown', kd, true); res(v); }, kd = e => { if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            done(false);
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            done(true);
        } };
        $('#cfo').onclick = () => done(true);
        $('#cfn').onclick = () => done(false);
        c.onclick = e => { if (e.target === c)
            done(false); };
        document.addEventListener('keydown', kd, true);
    });
}
let UNDO = null;
const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#v') && /INPUT|SELECT|TEXTAREA/.test(a.tagName)); };
let inflight = false, fails = 0, skip = 0;
async function sync(manual) {
    if (inflight || (!manual && (S.busy || (document.hidden && !pushOn()))))
        return;
    if (!manual && fails > 3 && ++skip % 5)
        return;
    inflight = true;
    if (manual)
        spin(1);
    try {
        const first = !S.synced, j = await call([], manual ? '' : S.rev);
        S.synced = true;
        fails = 0;
        setLive('ok');
        S.err = '';
        const old = new Map(S.tx.map(t => [t.id, JSON.stringify(t)]));
        if (apply(j)) {
            if (!first && !manual) {
                const nw = [], up = [];
                S.tx.forEach(t => { const o = old.get(t.id); if (o === undefined)
                    nw.push(t);
                else if (o !== JSON.stringify(t))
                    up.push(t); });
                notifyChanges(nw, up);
            }
            if (typing())
                S.dirty = true;
            else
                render();
        }
        else if (manual)
            toast('Đã đồng bộ');
    }
    catch (e) {
        fails++;
        setLive('err');
        S.err = e.message;
        if (manual)
            toast(e.message);
        $('#st').textContent = 'Chưa đồng bộ được';
        if (!S.ready)
            render();
    }
    inflight = false;
    if (manual)
        spin(0);
}
let chain = Promise.resolve();
function commit(ops, o = {}) {
    if (o.local)
        o.local();
    render();
    S.busy++;
    spin(1);
    chain = chain.then(async () => {
        let res = { ok: true };
        try {
            apply(await call(ops, ''));
            setLive('ok');
            notify(o.ok || 'Đã lưu', { undo: o.undo, title: o.title, ico: o.ico, tag: o.tag, kind: o.kind });
        }
        catch (e) {
            res = { ok: false, err: e.message };
            notify('Chưa lưu được: ' + e.message, { title: 'Lỗi', err: 1 });
            try {
                apply(await call([], ''));
            }
            catch (_) { }
        }
        S.busy--;
        if (!S.busy)
            spin(0);
        render();
        return res;
    });
    return chain;
}
async function act(ops, msg) { const r = await commit(ops, { ok: msg }); if (r.ok)
    closeSheet();
else {
    const o = $('#ov.open #sh');
    if (o) {
        let m = $('#serr');
        if (!m) {
            m = document.createElement('p');
            m.id = 'serr';
            m.className = 'chi';
            m.style.cssText = 'margin-top:10px;font-size:13px';
            o.appendChild(m);
        }
        m.textContent = 'Lỗi: ' + r.err;
    }
} return r; }
function lock() { sessionStorage.clear(); localStorage.removeItem('sess'); $('#app').classList.add('hide'); $('#login').classList.remove('hide'); $('#pw').value = ''; closeSheet(); }
$('#lf').onsubmit = ev => { ev.preventDefault(); if ($('#pw').value === PASS) {
    touch();
    boot();
}
else {
    $('#lerr').textContent = 'Mật khẩu không đúng';
    $('#lf').classList.remove('shake');
    void $('#lf').offsetWidth;
    $('#lf').classList.add('shake');
    $('#pw').select();
} };
function boot() { $('#login').classList.add('hide'); $('#app').classList.remove('hide'); render(); sync(true); if (typeof pushInit === 'function')
    pushInit(); }
document.addEventListener('visibilitychange', () => { if (document.hidden)
    return; if (!alive())
    return lock(); sync(false); });
setInterval(() => { if (!alive()) {
    if (!$('#app').classList.contains('hide'))
        lock();
    return;
} sync(false); }, POLL_MS);
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty && !typing()) {
    S.dirty = false;
    render();
} }, 60));
addEventListener('offline', () => setLive('err'));
addEventListener('online', () => { fails = 0; sync(false); });
['click', 'keydown'].forEach(t => document.addEventListener(t, () => { if (alive())
    touch(); }, { passive: true }));
const mOf = t => t.date.slice(0, 7), inM = (t, m) => mOf(t) === m;
let _own = null;
const heldSet = () => new Set(S.acc.filter(a => a.type === HELD).map(a => a.name));
const stx = () => { if (_own && _own.t === S.tx && _own.a === S.acc && _own.n === S.tx.length)
    return _own.l; const h = heldSet(), l = h.size ? S.tx.filter(t => !h.has(t.acc) && !(t.accTo && h.has(t.accTo))) : S.tx; _own = { t: S.tx, a: S.acc, n: S.tx.length, l }; return l; };
const ownAcc = () => S.acc.filter(a => a.type !== HELD);
const sums = m => { let thu = 0, chi = 0; stx().forEach(t => { if (!inM(t, m))
    return; if (t.type === 'Thu')
    thu += t.amount; if (t.type === 'Chi')
    chi += t.amount; }); return { thu, chi }; };
const bal = a => { let b = a.open; S.tx.forEach(t => { const x = t.amount; if (t.acc === a.name) {
    if (t.type === 'Thu' || t.type === 'Điều chỉnh')
        b += x;
    else
        b -= x;
} if (t.type === 'Chuyển khoản' && t.accTo === a.name)
    b += x; }); return b; };
const mlabel = m => 'Tháng ' + m.slice(5) + '/' + m.slice(0, 4), shift = (m, d) => ymd(new Date(+m.slice(0, 4), +m.slice(5) - 1 + d, 1)).slice(0, 7);
const group = (l, f) => { const o = {}; l.forEach(t => { const k = f(t); o[k] = (o[k] || 0) + t.amount; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
const chiM = m => stx().filter(t => t.type === 'Chi' && inM(t, m));
const limOf = (per, cat) => (S.lim.find(l => l.per === per && l.cat === cat) || {}).v || 0;
function limCalc() {
    const today = ymd(new Date()), chi = stx().filter(t => t.type === 'Chi'), M = chi.filter(t => inM(t, S.m)), sum = (a, c) => a.reduce((s, t) => (!c || t.cat === c) ? s + t.amount : s, 0);
    return S.lim.map(L => {
        const name = L.cat || 'Tổng chi';
        if (L.per === 'Ngày') {
            const pd = {};
            M.forEach(t => { if (!L.cat || t.cat === L.cat)
                pd[t.date] = (pd[t.date] || 0) + t.amount; });
            const days = Object.entries(pd).filter(([, a]) => a > L.v).map(([d, a]) => [d, a - L.v]);
            return { ...L, name, used: sum(chi.filter(t => t.date === today), L.cat), over: days.length, excess: days.reduce((s, x) => s + x[1], 0), days };
        }
        const used = sum(M, L.cat);
        return { ...L, name, used, over: used > L.v ? 1 : 0, excess: Math.max(0, used - L.v), days: [] };
    })
        .sort((a, b) => (a.cat ? 1 : 0) - (b.cat ? 1 : 0) || a.name.localeCompare(b.name, 'vi'));
}
function limWarn(r) { if (typeof limCheck === 'function')
    limCheck([r], UNDO && Date.now() - UNDO.t < 9000 ? UNDO.fn : null); }
const empty = (a, b = '') => `<div class="empty"><b>${a}</b>${b}</div>`;
const monthNav = () => `<div class="mn"><button data-m="-1" aria-label="Tháng trước">‹</button><b>${mlabel(S.m)}</b><button data-m="1" aria-label="Tháng sau">›</button></div>`;
const head = (t, sub, btns = '') => `<div class="ph"><div><h1>${t}</h1><p>${sub}</p></div><div class="pa">${MONTHLY.includes(S.tab) ? monthNav() : ''}${btns}</div></div>`;
const kpi = (l, v, c = '', s = '', h = '') => `<div class="card kpi ${h}"><small>${l}</small><b class="sens ${c}">${v}</b><em>${s}</em></div>`;
let _bk = null;
function balMap() {
    if (_bk && _bk.t === S.tx && _bk.a === S.acc && _bk.n === S.tx.length)
        return _bk.m;
    const B = {};
    S.acc.forEach(a => B[a.name] = +a.open || 0);
    const tm = t => (t.at || '').slice(11) || '23:59:59', m = {};
    S.tx.map((t, i) => [t, i]).sort((x, y) => x[0].date.localeCompare(y[0].date) || tm(x[0]).localeCompare(tm(y[0])) || x[1] - y[1]).forEach(([t]) => {
        const x = t.amount;
        B[t.acc] = (B[t.acc] || 0) + (t.type === 'Thu' || t.type === 'Điều chỉnh' ? x : -x);
        if (t.type === 'Chuyển khoản' && t.accTo)
            B[t.accTo] = (B[t.accTo] || 0) + x;
        m[t.id] = B[t.acc];
    });
    _bk = { t: S.tx, a: S.acc, n: S.tx.length, m };
    return m;
}
function txRow(t, v) {
    const xs = typeof v === 'string' && t.type === 'Chuyển khoản', sg = xs ? (t.acc === v ? '−' : '+') : (t.type === 'Chi' ? '−' : t.type === 'Thu' ? '+' : ''), hb = xs && t.acc !== v;
    const c = CLS[t.type], ttl = t.type === 'Chuyển khoản' ? `${esc(t.acc)} → ${esc(t.accTo)}` : esc(t.sub || t.cat || (t.type === 'Chi' || t.type === 'Thu' ? 'Chưa phân loại' : t.type)), ico = t.type === 'Chuyển khoản' ? '⇄' : t.type === 'Điều chỉnh' ? '±' : emo(t.sub || t.cat);
    return `<button class="row" data-edit="${esc(t.id)}"><span class="dot ${c}">${ico}</span><span class="m"><b>${ttl}</b><small>${esc(noteTxt(t.note) || t.cat || '') + (hasImg(t.note) ? ' 📎' : '')}${t.type === 'Chuyển khoản' ? '' : (noteTxt(t.note) || t.cat || hasImg(t.note) ? ' · ' : '') + esc(t.acc)}</small></span><span class="am"><b class="sens ${c}">${sg}${num(t.amount)}</b>${balMap()[t.id] !== undefined && !hb ? `<small class="sens mut" title="Số dư của ${esc(t.acc)} sau giao dịch này">Dư ${num(balMap()[t.id])}</small>` : ''}</span></button>`;
}
function donut(rows, tot, off = 0, fi = emo) {
    if (!rows.length || !tot)
        return empty('Chưa có dữ liệu');
    const R = 48, C = 2 * Math.PI * R;
    let o = 0;
    return `<div class="cd"><svg width="132" height="132" viewBox="0 0 120 120" role="img" aria-label="Biểu đồ cơ cấu">${rows.map(([k, v], i) => { const l = v / tot * C, x = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${col(i + off)}" stroke-width="18" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-o}" transform="rotate(-90 60 60)"/>`; o += l; return x; }).join('')}<text x="60" y="58" text-anchor="middle" font-size="9" fill="var(--mut)">${rows.length} nhóm</text><text x="60" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${tot >= 1e6 ? (tot / 1e6).toFixed(1) + 'tr' : Math.round(tot / 1e3) + 'k'}</text></svg>
<ul>${rows.slice(0, 6).map(([k, v], i) => `<li><i style="background:${col(i + off)}"></i><span>${fi(k)} ${esc(k)}</span><b>${Math.round(v / tot * 100)}%</b></li>`).join('')}</ul></div>`;
}
const bar = (lb, v, max, color) => `<div class="bar" style="--bc:${color}"><div><span>${lb}</span><b class="sens">${vnd(v)}</b></div><i><s style="width:${Math.min(100, max ? v / max * 100 : 0)}%"></s></i></div>`;
function limBar(x, label) {
    const r = x.v ? x.used / x.v : 0, c = r > 1 ? 'var(--chi)' : r > .8 ? 'var(--dc)' : 'var(--thu)';
    return `<div class="bar" style="--bc:${c}"><div><span>${label}</span><b class="sens">${vnd(x.used)} / ${vnd(x.v)} <small style="color:${c}">${x.used > x.v ? 'vượt ' + vnd(x.used - x.v) : Math.round(r * 100) + '%'}</small></b></div><i><s style="width:${Math.min(100, r * 100)}%"></s></i></div>`;
}
function issueBanner() {
    if (!S.issues.length)
        return '';
    const e = S.issues.filter(i => i.lv === 'err').length, w = S.issues.length - e;
    return `<div class="warn ${e ? 'err' : ''}">⚠️ ${e ? e + ' dòng dữ liệu bị lỗi (chưa được tính vào số liệu)' : ''}${e && w ? ' · ' : ''}${w ? w + ' dòng cần lưu ý' : ''}. <button data-a="issues">Xem chi tiết</button></div>`;
}
function home() {
    const { thu, chi } = sums(S.m), total = ownAcc().reduce((s, a) => s + bal(a), 0), M = stx().filter(t => inM(t, S.m)), rows = group(chiM(S.m), t => t.cat || 'Chưa phân loại'), mx = rows[0] ? rows[0][1] : 1;
    const months = [];
    for (let i = 11; i >= 0; i--)
        months.push(shift(S.m, -i));
    const d = months.map(m => ({ m, ...sums(m) })), top = Math.max(1, ...d.map(x => Math.max(x.thu, x.chi)));
    const ch = [0, .5, 1].map(f => `<line x1="0" x2="480" y1="${130 - f * 120}" y2="${130 - f * 120}" stroke="var(--line)"/>`).join('') + d.map((x, i) => { const w = 40, h1 = x.thu / top * 120, h2 = x.chi / top * 120; return `<rect x="${i * w + 6}" y="${130 - h1}" width="13" height="${h1}" rx="2" fill="var(--thu)"/><rect x="${i * w + 20}" y="${130 - h2}" width="13" height="${h2}" rx="2" fill="var(--chi)"/><text x="${i * w + 20}" y="148" font-size="10" text-anchor="middle" fill="var(--mut)">${x.m.slice(5)}</text>`; }).join('');
    const y = +S.m.slice(0, 4), mo = +S.m.slice(5), dim = new Date(y, mo, 0).getDate(), off = (new Date(y, mo - 1, 1).getDay() + 6) % 7, dc = {};
    chiM(S.m).forEach(t => dc[+t.date.slice(8)] = (dc[+t.date.slice(8)] || 0) + t.amount);
    const cmx = Math.max(1, ...Object.values(dc)), sh = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'tr' : Math.round(n / 1e3) + 'k';
    const dnum = S.m === ymd(new Date()).slice(0, 7) ? new Date().getDate() : dim, big = chiM(S.m).sort((a, b) => b.amount - a.amount)[0], LC = limCalc(), rec = M.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const limHtml = LC.map(x => limBar(x, (x.cat ? emo(x.cat) + ' ' : '') + esc(x.name) + ' · ' + (x.per === 'Ngày' ? 'hôm nay' : 'tháng'))).join(''), ov = LC.filter(x => x.over).length;
    return head('Tổng quan', mlabel(S.m) + ' · ' + M.length + ' giao dịch') + issueBanner() +
        `<div class="kpis">${kpi('Tổng tài sản', vnd(total), '', ownAcc().length + ' tài khoản', 'h')}${kpi('Thu', vnd(thu), 'thu', 'Tháng này')}${kpi('Chi', vnd(chi), 'chi', 'TB ' + vnd(chi / dnum) + '/ngày')}${kpi('Còn lại', vnd(thu - chi), thu - chi < 0 ? 'chi' : '', 'Tiết kiệm ' + (thu ? Math.round((thu - chi) / thu * 100) : 0) + '%')}</div>
<div class="grid a"><div class="card"><div class="ch">Thu chi 12 tháng <small><span class="thu">■</span> thu &nbsp;<span class="chi">■</span> chi</small></div><svg viewBox="0 0 480 154" width="100%" role="img" aria-label="Biểu đồ thu chi 12 tháng">${ch}</svg></div>
<div class="card"><div class="ch">Cơ cấu chi tiêu <small>${big ? 'Lớn nhất ' + num(big.amount) : ''}</small></div>${donut(rows, chi)}</div></div>
<div class="grid b"><div class="card"><div class="ch">Chi theo hạng mục</div>${rows.length ? rows.map(([k, v], i) => bar(emo(k) + ' ' + esc(k), v, mx, col(i)).replace('</b>', ' <small class="mut">' + Math.round(v / chi * 100) + '%</small></b>')).join('') : empty('Chưa có khoản chi', 'Bấm + để ghi khoản đầu tiên của tháng.')}${rows.length ? `<div class="ch" style="margin:16px 0 0;padding-top:12px;border-top:1px solid var(--line)">Khoản chi lớn nhất</div>${chiM(S.m).sort((a, b) => b.amount - a.amount).slice(0, 3).map(txRow).join('')}` : ''}</div>
<div class="card"><div class="ch">Lịch chi tiêu</div><div class="cal">${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(x => `<i>${x}</i>`).join('')}${'<span class="e"></span>'.repeat(off)}${Array.from({ length: dim }, (_, i) => { const v = dc[i + 1]; return `<span style="${v ? `background:color-mix(in srgb,var(--chi) ${Math.round(12 + 38 * v / cmx)}%,transparent)` : ''}"><b>${i + 1}</b>${v ? `<small class="sens">${sh(v)}</small>` : ''}</span>`; }).join('')}</div></div></div>
<div class="grid b"><div class="card"><div class="ch">Giao dịch gần đây <button class="chip" data-tab="tx">Xem tất cả</button></div>${rec.length ? rec.map(txRow).join('') : empty('Chưa có giao dịch')}</div>
<div class="card"><div class="ch">Hạn mức chi <button class="chip" data-tab="lim">Chi tiết</button></div>${limHtml || empty('Chưa đặt hạn mức', 'Vào mục Hạn mức để thiết lập.')}${ov ? `<p class="chi" style="font-size:13px;margin-top:10px">⚠️ ${ov} hạn mức đang bị vượt</p>` : ''}</div></div>`;
}
function txs() {
    const q = S.q.toLowerCase();
    let l = S.tx.filter(t => {
        if (S.rg === 'm' && !inM(t, S.m))
            return false;
        if (S.rg === 'c' && ((S.d1 && t.date < S.d1) || (S.d2 && t.date > S.d2)))
            return false;
        if (S.f !== 'all' && t.type !== S.f)
            return false;
        if (S.xa && t.acc !== S.xa && t.accTo !== S.xa)
            return false;
        if (S.xc && t.cat !== S.xc)
            return false;
        if (S.mn !== '' && t.amount < +S.mn)
            return false;
        if (S.mx !== '' && t.amount > +S.mx)
            return false;
        return !q || [noteTxt(t.note), t.cat, t.sub, t.acc, t.accTo, String(t.amount)].join(' ').toLowerCase().includes(q);
    });
    const ds = S.so === 'dn' || S.so === 'do';
    const ix = new Map(S.tx.map((t, i) => [t, i])), tk = t => t.date + ' ' + ((t.at || '').slice(11) || '23:59:59');
    l.sort({ dn: (a, b) => tk(b).localeCompare(tk(a)) || ix.get(b) - ix.get(a), do: (a, b) => tk(a).localeCompare(tk(b)) || ix.get(a) - ix.get(b), ah: (a, b) => b.amount - a.amount, al: (a, b) => a.amount - b.amount }[S.so]);
    const dsum = {};
    l.forEach(t => { if (t.type === S.f && (S.f === 'Thu' || S.f === 'Chi'))
        dsum[t.date] = (dsum[t.date] || 0) + t.amount; });
    const thu = l.filter(t => t.type === 'Thu').reduce((a, t) => a + t.amount, 0), chi = l.filter(t => t.type === 'Chi').reduce((a, t) => a + t.amount, 0), dt = {};
    stx().forEach(t => { if (t.type === 'Chi')
        dt[t.date] = (dt[t.date] || 0) + t.amount; });
    const ld = limOf('Ngày', '');
    let h = '', last = '';
    l.forEach(t => { if (ds && t.date !== last) {
        last = t.date;
        const dd = new Date(t.date + 'T00:00'), ov = ld && dt[t.date] > ld;
        h += `<div class="dh ${ov ? 'over' : ''}"><span>${dd.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span><span class="sens">${S.f === 'Thu' ? (dsum[t.date] ? 'thu ' + num(dsum[t.date]) : '') : S.f === 'Chi' || S.f === 'all' ? (dt[t.date] ? 'chi ' + num(dt[t.date]) + (ov ? ' ⚠️ vượt hạn mức ngày' : '') : '') : ''}</span></div>`;
    } h += txRow(t); });
    const op = (a, v, ph) => `<option value="">${ph}</option>` + a.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join(''), pars = [...new Set(S.cat.map(c => c.p))], n = [S.xa, S.xc, S.mn, S.mx, S.d1, S.d2].filter(x => x !== '').length + (S.rg !== 'm' ? 1 : 0);
    return head('Giao dịch', S.rg === 'm' ? mlabel(S.m) : S.rg === 'a' ? 'Toàn bộ thời gian' : 'Khoảng ngày tùy chọn', `<button class="btn" data-a="csv">${ic('dl')}CSV</button>`) + txSwitch() +
        `<div class="tb"><input class="search" id="q" placeholder="Tìm theo ghi chú, hạng mục, số tiền" value="${esc(S.q)}" aria-label="Tìm giao dịch"><div class="chips">${['all', ...TYPES].map(t => `<button class="chip ${S.f === t ? 'on' : ''}" data-f="${t}">${t === 'all' ? 'Tất cả' : t}</button>`).join('')}<button class="chip ${n ? 'on' : ''}" data-a="fo">${ic('fl').replace('class="i"', 'class="i" style="width:14px;height:14px;vertical-align:-2px"')} Bộ lọc${n ? ' (' + n + ')' : ''}</button></div></div>
${S.fo ? `<div class="card" style="margin-bottom:12px"><div class="fp"><label class="l w">Thời gian<select id="x_rg"><option value="m" ${S.rg === 'm' ? 'selected' : ''}>Theo tháng đang xem</option><option value="a" ${S.rg === 'a' ? 'selected' : ''}>Toàn bộ thời gian</option><option value="c" ${S.rg === 'c' ? 'selected' : ''}>Khoảng ngày tùy chọn</option></select></label>
${S.rg === 'c' ? `<label class="l">Từ ngày<input type="date" id="x_d1" value="${S.d1}"></label><label class="l">Đến ngày<input type="date" id="x_d2" value="${S.d2}"></label>` : ''}
<label class="l">Tài khoản<select id="x_acc">${op(S.acc.map(a => a.name), S.xa, 'Tất cả')}</select></label><label class="l">Hạng mục<select id="x_cat">${op(pars, S.xc, 'Tất cả')}</select></label>
<label class="l">Số tiền từ<input type="number" id="x_mn" inputmode="numeric" value="${S.mn}"></label><label class="l">Đến<input type="number" id="x_mx" inputmode="numeric" value="${S.mx}"></label>
<label class="l w">Sắp xếp<select id="x_so">${[['dn', 'Mới nhất trước'], ['do', 'Cũ nhất trước'], ['ah', 'Số tiền: cao → thấp'], ['al', 'Số tiền: thấp → cao']].map(([k, v]) => `<option value="${k}" ${S.so === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div><button class="btn" data-a="rs">Xóa bộ lọc</button></div>` : ''}
<div class="sum"><span>${l.length} giao dịch</span><span class="thu sens">Thu ${vnd(thu)}</span><span class="chi sens">Chi ${vnd(chi)}</span><span class="sens">Ròng ${vnd(thu - chi)}</span></div>
<div class="card flush">${l.length ? h : empty('Không có giao dịch', 'Thử đổi bộ lọc hoặc khoảng thời gian.')}</div>`;
}
function limPage() {
    const LC = limCalc(), D = LC.filter(x => x.per === 'Ngày'), M = LC.filter(x => x.per === 'Tháng'), O = LC.filter(x => x.over).sort((a, b) => b.excess - a.excess), tot = O.reduce((s, x) => s + x.excess, 0), now = new Date();
    const lb = x => (x.cat ? emo(x.cat) + ' ' : '') + esc(x.name);
    return head('Hạn mức chi', 'Theo dõi mức chi so với hạn mức theo ngày và theo tháng', `<span class="tip r" tabindex="0" role="note" aria-label="Cách tính hạn mức" data-tip="Chỉ tính các giao dịch loại Chi. Hạn mức theo hạng mục được tính theo hạng mục cha; để trống hạng mục thì áp dụng cho tổng chi. Hạn mức ngày so với tổng chi từng ngày, hạn mức tháng so với tổng chi cả tháng.">ⓘ</span><button class="btn p" data-a="lim">Thiết lập hạn mức</button>`) +
        `<div class="grid b"><div class="card"><div class="ch">Hạn mức NGÀY <small>hôm nay ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}</small></div>${D.map(x => limBar(x, lb(x))).join('') || empty('Chưa đặt hạn mức ngày')}</div>
<div class="card"><div class="ch">Hạn mức THÁNG <small>${mlabel(S.m)}</small></div>${M.map(x => limBar(x, lb(x))).join('') || empty('Chưa đặt hạn mức tháng')}</div></div>
<div class="card"><div class="ch">Đã vượt hạn mức trong ${mlabel(S.m).toLowerCase()} ${tot ? `<small class="chi sens">+${vnd(tot)}</small>` : ''}</div>${O.map(x => `<div class="row"><span class="dot">${x.cat ? emo(x.cat) : '∑'}</span><span class="m"><b>${esc(x.name)} · ${x.per === 'Ngày' ? 'ngày' : 'tháng'}</b><small>${x.per === 'Ngày' ? x.over + ' ngày vượt: ' + x.days.slice(0, 8).map(d => +d[0].slice(8)).join(', ') + (x.days.length > 8 ? '…' : '') : 'Vượt hạn mức tháng'}</small></span><b class="chi sens">+${vnd(x.excess)}</b></div>`).join('') || empty('Không có hạn mức nào bị vượt', 'Tháng này đang trong hạn mức.')}</div>
`;
}
const diffs = () => S.acc.map(a => { const sys = bal(a), v = S.act[a.name], has = v !== undefined; return { a, sys, has, act: v, diff: has ? v - sys : 0 }; });
function balPlan(L) {
    const r = L.map(x => ({ n: x.a.name, d: x.diff })), T = [], neg = r.filter(x => x.d < 0).sort((a, b) => a.d - b.d), pos = r.filter(x => x.d > 0).sort((a, b) => b.d - a.d);
    neg.forEach(n => pos.forEach(p => { const m = Math.min(-n.d, p.d); if (m > 0) {
        T.push({ from: n.n, to: p.n, amount: m });
        n.d += m;
        p.d -= m;
    } }));
    return { T, A: r.filter(x => x.d !== 0) };
}
function recon() {
    const D = diffs();
    return head('Cân đối', 'So số dư thực tế với hệ thống; lệch thì chuyển tiền qua lại giữa các tài khoản, phần còn lại ghi điều chỉnh') +
        `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div class="card kpi h kfull"><small>Tổng chênh lệch</small><b class="sens" id="r_t">–</b><em id="r_n"></em></div><div class="card kpi"><small>Hệ thống</small><b class="sens" id="r_s">–</b></div><div class="card kpi"><small>Thực tế</small><b class="sens" id="r_a">–</b></div></div>
<div class="grid c"><div class="card"><div class="ch">Nhập số dư thực tế</div>${D.map((x, i) => `<div class="rr"><span style="display:flex;align-items:center;gap:10px">${aIco(x.a)}<span style="min-width:0"><b style="font-weight:500">${esc(x.a.name)}</b><small class="sens">Hệ thống: ${vnd(x.sys)}</small></span></span><input class="ba money" data-neg="1" data-i="${i}" inputmode="text" placeholder="${num(x.sys)}" value="${x.has ? num(x.act) : ''}" aria-label="Số dư thực tế ${esc(x.a.name)}"><span class="df" id="df${i}"></span></div>`).join('') || empty('Chưa có tài khoản')}</div>
<div class="card"><div class="ch">Xử lý</div><div id="rbtn"></div></div></div>`;
}
function reconUpdate() {
    const D = diffs(), has = D.filter(x => x.has), tot = has.reduce((s, x) => s + x.diff, 0), sg = n => (n > 0 ? '+' : '−') + vnd(Math.abs(n)), bad = has.filter(x => x.diff !== 0);
    D.forEach((x, i) => { const e = $('#df' + i); if (e) {
        e.textContent = !x.has ? '' : x.diff === 0 ? 'Khớp' : sg(x.diff).replace(' ₫', '');
        e.className = 'df ' + (!x.has ? '' : x.diff === 0 ? 'thu' : 'chi');
    } });
    $('#r_t').textContent = has.length ? (!bad.length ? 'Khớp' : tot === 0 ? '0 ₫ (nhưng lệch từng tài khoản)' : sg(tot)) : '–';
    $('#r_n').textContent = has.length ? (bad.length ? bad.length + '/' + has.length + ' tài khoản lệch' : 'Tất cả khớp') : '';
    $('#r_s').textContent = vnd((has.length ? has : D).reduce((s, x) => s + x.sys, 0));
    $('#r_a').textContent = has.length ? vnd(has.reduce((s, x) => s + x.act, 0)) : '–';
    const pos = bad.some(x => x.diff > 0), neg = bad.some(x => x.diff < 0);
    const PL = balPlan(bad), sgn = n => (n > 0 ? '+' : '−') + num(Math.abs(n));
    $('#rbtn').innerHTML = (bad.length ? `<button class="btn p w" data-bdo="bal" style="margin-top:0">Cân đối ${PL.T.length ? PL.T.length + ' chuyển khoản' : ''}${PL.T.length && PL.A.length ? ' + ' : ''}${PL.A.length ? PL.A.length + ' điều chỉnh' : ''}</button><p class="note">Tài khoản dư và tài khoản thiếu sẽ được <b>chuyển tiền qua lại</b> cho khớp${PL.T.length ? ':<br>' + PL.T.map(t => '• ' + esc(t.from) + ' → ' + esc(t.to) + ': <b>' + num(t.amount) + '</b>').join('<br>') : ''}${PL.A.length ? '<br>Phần còn lại không bù được ghi bằng <b>dòng “Điều chỉnh” đặc biệt</b>:<br>' + PL.A.map(x => '• ' + esc(x.n) + ': <b>' + sgn(x.d) + '</b>').join('<br>') : ''}</p><button class="btn w" data-bdo="adj">Chỉ ghi điều chỉnh (không chuyển khoản)</button>` : has.length ? empty('Đã khớp', 'Số dư thực tế trùng với hệ thống.') : '<p class="mut" style="margin-bottom:6px">Nhập số dư thực tế để xem chênh lệch.</p>') + `<button class="btn w" data-bdo="form">Chuyển tiền giữa các tài khoản</button>`;
}
async function doBal(k) {
    if (k === 'form')
        return openForm(null, 'Chuyển khoản');
    const today = ymd(new Date()), L = diffs().filter(x => x.has && x.diff !== 0);
    if (!L.length)
        return;
    const adjRow = (n, amt, i) => ({ id: newId(i), date: today, type: 'Điều chỉnh', amount: amt, acc: n, accTo: '', cat: '', sub: '', note: 'Chênh lệch không xác định (cân đối)' });
    let rows;
    if (k === 'adj') {
        if (!await ask('Ghi ' + L.length + ' giao dịch điều chỉnh?', L.map(x => x.a.name + ': ' + (x.diff > 0 ? '+' : '−') + num(Math.abs(x.diff))).join('\n'), { icon: '⚖️', ok: 'Ghi' }))
            return;
        rows = L.map((x, i) => adjRow(x.a.name, x.diff, i));
    }
    else {
        const P = balPlan(L);
        if (!await ask('Xác nhận cân đối', (P.T.length ? P.T.map(t => '⇄ ' + t.from + ' → ' + t.to + ': ' + num(t.amount)).join('\n') : '(không có chuyển khoản)') + (P.A.length ? '\n\nĐiều chỉnh phần còn lại:\n' + P.A.map(x => x.n + ': ' + (x.d > 0 ? '+' : '−') + num(Math.abs(x.d))).join('\n') : ''), { icon: '⇄', ok: 'Cân đối' }))
            return;
        rows = P.T.map((t, i) => ({ id: newId(i), date: today, type: 'Chuyển khoản', amount: t.amount, acc: t.from, accTo: t.to, cat: '', sub: '', note: 'Cân đối: chuyển giữa tài khoản' })).concat(P.A.map((x, i) => adjRow(x.n, x.d, P.T.length + i)));
    }
    S.act = {};
    commit(rows.map(row => ({ op: 'tx.save', row })), { ok: 'Đã ghi ' + rows.length + ' giao dịch cân đối', local: () => { S.tx = S.tx.concat(rows); } });
}
function accs() {
    const bs = S.acc.map(a => ({ a, b: bal(a) })), own = bs.filter(x => x.a.type !== HELD), tot = own.reduce((s, x) => s + x.b, 0), pos = own.filter(x => x.b > 0).reduce((s, x) => s + x.b, 0), neg = own.filter(x => x.b < 0).reduce((s, x) => s + x.b, 0), mo = {};
    S.tx.forEach(t => { if (!inM(t, S.m))
        return; const o = mo[t.acc] = mo[t.acc] || { thu: 0, chi: 0 }; if (t.type === 'Thu')
        o.thu += t.amount; if (t.type === 'Chi')
        o.chi += t.amount; });
    const types = [...new Set([...ATORD, ...S.acc.map(a => a.type)])].filter(t => bs.some(x => x.a.type === t)), pie = own.filter(x => x.b > 0).sort((a, b) => b.b - a.b).map(x => [x.a.name, x.b]);
    const grp = types.map(t => { const l = bs.filter(x => x.a.type === t), sub = l.reduce((s, x) => s + x.b, 0); return `<div class="card flush"><div class="ch" style="padding-top:14px;margin:0"><span>${(ATYPE[t] || ['🏦'])[0]} ${esc(t)} <small>· ${l.length} tài khoản</small></span><b class="sens ${sub < 0 ? 'chi' : ''}">${vnd(sub)}</b></div>${l.map(({ a, b }) => { const i = S.acc.indexOf(a), m = mo[a.name] || { thu: 0, chi: 0 }; return `<button class="row" data-ed="tk:${i}">${aIco(a)}<span class="m"><b>${esc(a.name)}</b><small class="sens">${mlabel(S.m)}: <span class="thu">+${num(m.thu)}</span> · <span class="chi">−${num(m.chi)}</span></small></span><b class="sens ${b < 0 ? 'chi' : ''}">${vnd(b)}</b></button>`; }).join('')}</div>`; }).join('');
    const th = Object.entries(mo).filter(([k]) => !heldSet().has(k)).reduce((s, [, x]) => s + x.thu, 0), ch = Object.entries(mo).filter(([k]) => !heldSet().has(k)).reduce((s, [, x]) => s + x.chi, 0);
    return head('Tài khoản', S.acc.length + ' tài khoản · bấm vào để sửa hoặc xem giao dịch', `<button class="btn p" data-ed="tk:new">${ic('pl')}Thêm tài khoản</button>`) +
        `<div class="kpis">${kpi('Tổng tài sản ròng', vnd(tot), tot < 0 ? 'chi' : '', 'Sau khi trừ nợ', 'h')}${kpi('Tiền đang có', vnd(pos), 'thu', own.filter(x => x.b > 0).length + ' tài khoản')}${kpi('Đang nợ', vnd(neg), neg < 0 ? 'chi' : '', own.filter(x => x.b < 0).length + ' tài khoản')}${kpi('Thu − chi ' + mlabel(S.m).toLowerCase(), vnd(th - ch), th - ch < 0 ? 'chi' : 'thu', '+' + num(th) + ' / −' + num(ch))}</div>
<div class="grid a" style="align-items:start"><div class="col">${grp || `<div class="card">${empty('Chưa có tài khoản', 'Bấm “Thêm tài khoản” để bắt đầu.')}</div>`}</div><div class="card"><div class="ch">Phân bổ tài sản</div>${donut(pie, pos, 0, k => '')}</div></div>`;
}
function cats() {
    const g = {}, sp = {}, known = new Set(), mk = (t, x) => t + '|' + x, lo = { Chi: {}, Thu: {} }, tt = { Thu: 0, Chi: 0 };
    S.cat.forEach((c, i) => { (g[c.t + '|' + c.p] = g[c.t + '|' + c.p] || []).push([c, i]); known.add(mk(c.t, c.c)); });
    stx().forEach(t => {
        if ((t.type !== 'Chi' && t.type !== 'Thu') || !inM(t, S.m))
            return;
        tt[t.type] += t.amount;
        const k = mk(t.type, t.sub);
        if (known.has(k))
            sp[k] = (sp[k] || 0) + t.amount;
        else {
            const n = t.sub || t.cat || 'Chưa phân loại';
            lo[t.type][n] = (lo[t.type][n] || 0) + t.amount;
        }
    });
    const amt = (t, v) => v ? ` <b class="${t === 'Thu' ? 'thu' : 'chi'} sens">${num(v)}</b>` : '';
    const cards = Object.entries(g).map(([k, v]) => {
        const [t, p] = k.split('|'), sum = v.reduce((s, [c]) => s + (sp[mk(t, c.c)] || 0), 0);
        return `<div class="card"><div class="ch"><span>${emo(p)} ${esc(p)}</span><small class="${t === 'Thu' ? 'thu' : 'chi'}">${t}${sum ? ' · <span class="sens">' + vnd(sum) + '</span>' : ''}</small></div><div class="cg">${v.map(([c, i]) => `<button class="chip" data-ed="dm:${i}">${esc(c.c)}${amt(t, sp[mk(t, c.c)])}</button>`).join('')}</div></div>`;
    });
    const extra = ['Chi', 'Thu'].filter(t => Object.keys(lo[t]).length).map(t => `<div class="card"><div class="ch"><span>⚠️ Chưa có trong danh mục</span><small class="${t === 'Thu' ? 'thu' : 'chi'}">${t}</small></div><div class="cg">${Object.entries(lo[t]).map(([n, v]) => `<span class="chip" style="cursor:default">${esc(n)}${amt(t, v)}</span>`).join('')}</div></div>`);
    return head('Hạng mục', 'Thu chi theo hạng mục con trong ' + mlabel(S.m).toLowerCase(), `<button class="btn p" data-ed="dm:new">${ic('pl')}Thêm hạng mục</button>`) +
        `<div class="sum"><span class="thu sens">Thu ${vnd(tt.Thu)}</span><span class="chi sens">Chi ${vnd(tt.Chi)}</span></div><div class="grid b" style="align-items:start">${cards.concat(extra).join('') || empty('Chưa có hạng mục')}</div>`;
}
const KT = { gd: 'Giao dịch', tk: 'Tài khoản', dm: 'Hạng mục' };
function trashPage() { return head('Thùng rác', 'Các mục đã xóa có thể được khôi phục') + `<div class="card flush">${S.trash.map((t, i) => `<div class="row"><span class="m"><b>${KT[t.k] || ''}: ${esc(t.k === 'gd' ? (t.sub || t.cat || t.type) + ' · ' + num(t.amount) : t.k === 'tk' ? t.id : t.cat + ' › ' + t.sub)}</b><small>${t.k === 'gd' ? esc(t.date + ' · ' + t.acc) + ' · ' : ''}Xóa lúc ${esc(t.at)}</small></span><button class="chip" data-rs="${i}">Khôi phục</button></div>`).join('') || empty('Thùng rác trống')}</div>`; }
const errCard = () => `<div class="card"><h3>Chưa tải được dữ liệu</h3><p class="chi" style="margin-bottom:10px">${esc(S.err === 'Failed to fetch' || S.err === 'Không có kết nối mạng' ? 'Không kết nối được tới máy chủ' : S.err)}</p><p class="mut" style="font-size:13px">Vui lòng kiểm tra kết nối mạng rồi thử lại. Nếu vẫn không được, hãy liên hệ người quản trị để kiểm tra lại cấu hình.</p><button class="btn p w" data-a="retry">Thử lại</button></div>`;
function nav() {
    const tb = $('#tb');
    tb.innerHTML = TABS.map(([k, l, gr]) => (gr ? '<i class="sep">' + gr + '</i>' : '') + `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${ic(k)}<span>${l}</span></button>`).join('') + `<i class="sep"></i><button data-nt="settings">${ic('set')}<span>Cài đặt</span></button>`;
    const mt = GRP_TX.includes(S.tab) ? 'tx' : S.tab;
    $('#bn').innerHTML = MOB.map(k => { const t = TABS.find(x => x[0] === k); return `<button class="${mt === k ? 'on' : ''}" data-tab="${k}">${ic(k)}${SHORT[k] || t[1]}</button>`; }).join('') + `<button class="${MOB.includes(mt) ? '' : 'on'}" data-a="more">${ic('more')}${MOB.includes(mt) ? 'Thêm' : TABS.find(x => x[0] === S.tab)[1]}</button>`;
    const n = S.issues.length;
    $('#isb').classList.toggle('hide', !n);
    $('#isn').textContent = n > 99 ? '99+' : n;
    if (typeof qbNav === 'function')
        qbNav();
    if (typeof nbUpdate === 'function')
        nbUpdate();
}
function render() { nav(); $('#v').innerHTML = !S.ready ? (S.err ? errCard() : '<div class="sk"></div><div class="sk"></div><div class="sk"></div>') : { home, tx: txs, ba: accView, bc: catView, bl: limView, rp: reportPage, rec: recon, lim: limPage, acc: accs, cat: cats, tr: trashPage }[S.tab](); if (S.ready && S.tab === 'rec')
    reconUpdate(); mdFix(); }
const go = t => { S.tab = t; location.hash = t; scrollTo(0, 0); closeSheet(); render(); };
document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab],[data-m],[data-f],[data-edit],[data-a],[data-bdo],[data-ed],[data-rs]');
    if (!t || t.closest('#ov'))
        return;
    const d = t.dataset;
    if (d.tab)
        return go(d.tab);
    if (d.m) {
        S.m = shift(S.m, +d.m);
        return render();
    }
    if (d.f) {
        S.f = d.f;
        return render();
    }
    if (d.edit) {
        const x = S.tx.find(x => x.id === d.edit);
        return x && openForm(x);
    }
    if (d.bdo)
        return doBal(d.bdo);
    if (d.rs != null && S.tab === 'tr') {
        const x = S.trash[+d.rs];
        return x && act([{ op: 'restore', at: x.at, kind: x.k }], 'Đã khôi phục');
    }
    if (d.ed) {
        const [k, i] = d.ed.split(':'), src = { tk: S.acc, dm: S.cat }[k];
        return ed(k, i === 'new' ? {} : { ...src[+i] }, i === 'new' ? null : +i);
    }
    switch (d.a) {
        case 'new': return openForm();
        case 'lock': return lock();
        case 'retry':
            S.err = '';
            render();
            return sync(true);
        case 'dark': return toggleTheme();
        case 'fo':
            S.fo = !S.fo;
            return render();
        case 'rs':
            Object.assign(S, { xa: '', xc: '', mn: '', mx: '', d1: '', d2: '', so: 'dn', rg: 'm', f: 'all', q: '' });
            return render();
        case 'csv': return csv();
        case 'lim': return openLim();
        case 'more': return openMore();
        case 'issues': return openIssues();
    }
});
document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') {
        S.q = t.value;
        const p = t.selectionStart;
        render();
        const q = $('#q');
        q.focus();
        q.setSelectionRange(p, p);
        return;
    }
    if (t.classList && t.classList.contains('money'))
        fm(t);
    if (t.classList && t.classList.contains('ba')) {
        const a = S.acc[+t.dataset.i];
        if (!a)
            return;
        if (t.value.replace(/[^\d]/g, ''))
            S.act[a.name] = pm(t.value);
        else
            delete S.act[a.name];
        reconUpdate();
    }
});
document.addEventListener('change', e => { const k = { x_rg: 'rg', x_acc: 'xa', x_cat: 'xc', x_mn: 'mn', x_mx: 'mx', x_so: 'so', x_d1: 'd1', x_d2: 'd2' }[e.target.id]; if (k) {
    S[k] = e.target.value;
    render();
} });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        return closeSheet();
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '') || !$('#login').classList.contains('hide'))
        return;
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openForm();
    }
    if (e.key === '/') {
        e.preventDefault();
        go('tx');
        setTimeout(() => { const q = $('#q'); q && q.focus(); }, 0);
    }
});
function csv() {
    const r = [['ID', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Tài khoản đến', 'Hạng mục cha', 'Hạng mục con', 'Ghi chú'], ...S.tx.map(t => [t.id, t.date, t.type, t.amount, t.acc, t.accTo, t.cat, t.sub, t.note])];
    const b = new Blob(['\ufeff' + r.map(x => x.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'so-thu-chi.csv';
    a.click();
}
const openSheet = () => $('#ov').classList.add('open'), closeSheet = () => $('#ov').classList.remove('open');
function openMore() { $('#sh').innerHTML = `<h3>Thêm</h3><div class="menu">${['ba', 'bc', 'bl', 'rec', 'acc', 'cat', 'tr'].map(k => `<button class="row" data-sheettab="${k}">${ic(k)}<span class="m"><b>${TABS.find(x => x[0] === k)[1]}</b></span>${k === 'tr' && S.trash.length ? `<small class="mut">${S.trash.length}</small>` : ''}</button>`).join('')}<button class="row" data-nt="settings">${ic('set')}<span class="m"><b>Cài đặt</b><small>Giao diện, thông báo, nhắc nhở, báo cáo mỗi sáng</small></span></button><button class="row" data-a2="csv">${ic('dl')}<span class="m"><b>Tải CSV toàn bộ</b></span></button></div>`; ED = null; E = null; openSheet(); }
function openIssues() { const L = S.issues; ED = null; E = null; $('#sh').innerHTML = `<h3>Dữ liệu cần kiểm tra (${L.length}) <span class="tip" tabindex="0" role="note" aria-label="Ý nghĩa màu" data-tip="Đỏ = lỗi, dòng đó chưa được tính vào số liệu. Vàng = cần lưu ý, vẫn được tính. Chỉnh lại các dòng được liệt kê, số liệu sẽ tự cập nhật.">ⓘ</span></h3>${L.slice(0, 80).map(i => `<div class="iss ${i.lv}"><b>${esc(SN[i.sheet] || i.sheet)} · dòng ${i.row}</b><span>${esc(i.msg)}</span></div>`).join('')}${L.length > 80 ? `<p class="mut" style="margin-top:8px">… và ${L.length - 80} mục nữa</p>` : ''}`; openSheet(); }
function catFields(ty, cat, sub, ip, is) {
    const L = S.cat.map((c, i) => ({ ...c, i })).filter(c => c.t === ty), pars = [...new Set(L.map(c => c.p))], o = c => `<option value="${c.i}" ${c.p === cat && c.c === sub ? 'selected' : ''}>${esc(c.c)}</option>`;
    return `<label>Hạng mục<select id="${ip}"><option value="">Chọn…</option>${pars.map(p => `<option ${p === cat ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><label>Chi tiết<select id="${is}"><option value="">${cat ? 'Chọn…' : 'Chọn (tự điền hạng mục)…'}</option>${cat ? L.filter(c => c.p === cat).map(o).join('') : pars.map(p => `<optgroup label="${esc(p)}">${L.filter(c => c.p === p).map(o).join('')}</optgroup>`).join('')}</select></label>`;
}
const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
function openForm(t, ty) { E = t ? { ...t, note: noteTxt(t.note), imgs: splitImg(t.note).imgs, time: (t.at || '').slice(11, 16) } : { id: newId(), date: ymd(new Date()), time: hm(new Date()), type: ty || 'Chi', amount: 0, acc: (S.acc[0] || {}).name || '', accTo: '', cat: '', sub: '', note: '', imgs: [], isNew: true }; ED = null; form(); openSheet(); }
function form() {
    const ty = E.type, op = (a, v) => a.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    $('#sh').innerHTML = `<div class="seg">${TYPES.map(x => `<button data-ty="${x}" class="${x === ty ? 'on' : ''}">${x === 'Chuyển khoản' ? 'Chuyển' : x}</button>`).join('')}</div>${tplRow()}
<input class="amt money ${CLS[ty]}" ${ty === 'Điều chỉnh' ? 'data-neg="1"' : ''} id="fa" inputmode="${ty === 'Điều chỉnh' ? 'text' : 'numeric'}" placeholder="0" value="${E.amount ? num(E.amount) : ''}" aria-label="Số tiền"><div class="f">
<label>Ngày<input type="date" id="fd" value="${E.date}"></label><label>Giờ<input type="time" id="fh" value="${E.time || ''}"></label><label class="w">${ty === 'Chuyển khoản' ? 'Từ tài khoản' : 'Tài khoản'}<select id="fc">${op(S.acc.map(a => a.name), E.acc)}</select></label>
${ty === 'Chuyển khoản' ? `<label class="w">Đến tài khoản<select id="ft"><option value="">Chọn…</option>${op(S.acc.map(a => a.name).filter(n => n !== E.acc), E.accTo)}</select></label>` : ty === 'Điều chỉnh' ? '' : catFields(ty, E.cat, E.sub, 'fp', 'fs')}
<label class="w">Ghi chú<input id="fn" value="${esc(E.note)}" placeholder="Không bắt buộc"></label><div class="w" id="att"></div></div>
<button class="btn p w" data-save>${E.isNew ? 'Lưu giao dịch' : 'Lưu thay đổi'}</button><button class="btn w" data-tplsave style="margin-top:6px">☆ Lưu thành mẫu</button>${E.isNew ? '' : '<button class="btn w" data-dup>⧉ Nhân đôi giao dịch</button><button class="btn d w" data-del style="margin-top:2px">Xóa giao dịch</button>'}`;
    renderAtt();
}
function pull() { const g = i => ($(i) || {}).value; E.date = g('#fd') || E.date; if ($('#fh'))
    E.time = g('#fh'); E.acc = g('#fc') || E.acc; E.note = g('#fn') || ''; if ($('#ft'))
    E.accTo = g('#ft'); E.amount = pm($('#fa').value); }
function openLim() {
    ED = null;
    E = null;
    const pars = [...new Set(S.cat.filter(c => c.t === 'Chi').map(c => c.p))], orph = [...new Set(S.lim.filter(l => l.cat && !pars.includes(l.cat)).map(l => l.cat))], all = ['', ...pars, ...orph];
    const list = per => all.map(p => `<label class="${p === '' ? 'w' : ''}">${p === '' ? '∑ Tổng chi (tất cả hạng mục)' : emo(p) + ' ' + esc(p) + (orph.includes(p) ? ' ⚠️ hạng mục này không còn tồn tại' : '')}<input class="lm money" data-per="${per}" data-cat="${esc(p)}" inputmode="numeric" placeholder="Để trống = không đặt" title="Để trống hoặc nhập 0 để bỏ hạn mức" value="${limOf(per, p) ? num(limOf(per, p)) : ''}"></label>`).join('');
    $('#sh').innerHTML = `<h3>Thiết lập hạn mức chi <span class="tip" tabindex="0" role="note" aria-label="Hướng dẫn" data-tip="Để trống hoặc nhập 0 để bỏ hạn mức. Chỉ tính các giao dịch loại Chi.">ⓘ</span></h3><div class="tabs" style="margin-bottom:12px"><button type="button" class="on" data-lt="gd">Theo ngày</button><button type="button" data-lt="gc">Theo tháng</button></div>
<div class="f" id="gd">${list('Ngày')}</div><div class="f hide" id="gc">${list('Tháng')}</div><button class="btn p w" data-lsave>Lưu hạn mức</button>`;
    openSheet();
}
function ed(kind, o, idx) {
    const L = [...new Set(S.cat.map(c => c.p))], isN = idx == null;
    ED = { kind, o, idx };
    E = null;
    const F = { tk: [['name', 'Tên tài khoản', 'text', o.name], ['type', 'Loại', 'select', o.type || ACC_TYPES[0], ACC_TYPES], ['open', 'Số dư ban đầu', 'money', o.open ? num(o.open) : '']],
        dm: [['t', 'Loại', 'select', o.t || 'Chi', ['Chi', 'Thu']], ['p', 'Hạng mục cha', 'text', o.p, L], ['c', 'Chi tiết', 'text', o.c]] }[kind];
    $('#sh').innerHTML = `<h3>${isN ? 'Thêm' : 'Sửa'} ${{ tk: 'tài khoản', dm: 'hạng mục' }[kind]}</h3><div class="f">${F.map(([id, lb, ty, v, ls]) => `<label class="${id === 'name' || id === 'c' ? 'w' : ''}">${lb}${ty === 'select' ? `<select id="e_${id}">${ls.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ty === 'money' ? `<input id="e_${id}" class="money" data-neg="1" inputmode="text" value="${esc(v)}" placeholder="0">` : `<input id="e_${id}" type="text" value="${esc(v ?? '')}" ${ls ? `list="dl_${id}"` : ''}>${ls ? `<datalist id="dl_${id}">${ls.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`}</label>`).join('')}${kind === 'tk' ? `<div class="w"><span class="l" style="font-size:12px;color:var(--mut)">Biểu tượng (chỉ lưu trên máy này)</span><div class="cg" style="margin-top:6px"><button type="button" class="chip ${AI[o.name] ? '' : 'on'}" data-ico="">Tự động</button>${EM.map(e => `<button type="button" class="chip ${AI[o.name] === e ? 'on' : ''}" data-ico="${e}">${e}</button>`).join('')}</div></div>` : ''}</div><button class="btn p w" data-esave>Lưu</button>${kind === 'tk' && !isN ? '<button class="btn w" data-viewacc>Xem giao dịch của tài khoản này</button>' : ''}${isN ? '' : '<button class="btn d w" data-edel style="margin-top:2px">Chuyển vào Thùng rác</button>'}`;
    openSheet();
}
$('#ov').addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('money'))
        fm(t);
    if (E && ['fc', 'fp', 'fs'].includes(t.id)) {
        const id = t.id, val = t.value;
        pull();
        if (id === 'fp') {
            E.cat = val;
            if (E.sub && !S.cat.some(c => c.t === E.type && c.p === E.cat && c.c === E.sub))
                E.sub = '';
        }
        if (id === 'fs') {
            if (val !== '') {
                const c = S.cat[+val];
                E.cat = c.p;
                E.sub = c.c;
            }
            else
                E.sub = '';
        }
        form();
        $('#' + id).focus();
    }
});
$('#ov').addEventListener('click', async (e) => {
    const T = e.target;
    if (T.id === 'ov')
        return closeSheet();
    const q = s => T.closest(s);
    if (q('[data-ico]')) {
        const b = q('[data-ico]');
        $$('[data-ico]').forEach(x => x.classList.toggle('on', x === b));
        if (ED)
            ED.ico = b.dataset.ico;
        return;
    }
    if (q('[data-viewacc]') && ED) {
        Object.assign(S, { xa: ED.o.name, rg: 'a', fo: true, f: 'all', q: '' });
        return go('tx');
    }
    if (q('[data-sheettab]'))
        return go(q('[data-sheettab]').dataset.sheettab);
    if (q('[data-a2]')) {
        closeSheet();
        return csv();
    }
    if (q('[data-lt]')) {
        const b = q('[data-lt]');
        $$('[data-lt]').forEach(x => x.classList.toggle('on', x === b));
        $('#gd').classList.toggle('hide', b.dataset.lt !== 'gd');
        $('#gc').classList.toggle('hide', b.dataset.lt !== 'gc');
        return;
    }
    if (q('[data-lsave]')) {
        const ops = [];
        $$('.lm').forEach(i => { const v = pm(i.value), per = i.dataset.per, cat = i.dataset.cat; if (v < 0)
            return; if (v !== limOf(per, cat))
            ops.push({ op: 'lim.set', per, cat, v }); });
        if (!ops.length)
            return closeSheet();
        return act(ops, 'Đã lưu hạn mức');
    }
    if (ED) {
        const v = id => ($('#e_' + id) || {}).value, { kind, o, idx } = ED;
        if (q('[data-esave]')) {
            if (kind === 'tk') {
                const nm = v('name').trim(), old = o.name;
                if (!nm)
                    return toast('Nhập tên tài khoản');
                const r = act([{ op: 'acc.save', acc: { name: nm, type: v('type'), open: pm(v('open')) }, old: old || null }], 'Đã lưu');
                r.then(x => { if (!x.ok)
                    return; if (ED && ED.ico !== undefined) {
                    if (ED.ico)
                        AI[nm] = ED.ico;
                    else
                        delete AI[nm];
                }
                else if (old && old !== nm && AI[old]) {
                    AI[nm] = AI[old];
                } if (old && old !== nm)
                    delete AI[old]; try {
                    localStorage.aicon = JSON.stringify(AI);
                }
                catch (er) { } render(); });
                return;
            }
            if (kind === 'dm') {
                if (!v('p').trim() || !v('c').trim())
                    return toast('Nhập hạng mục cha và chi tiết');
                return act([{ op: 'cat.save', cat: { t: v('t'), p: v('p').trim(), c: v('c').trim() }, old: idx == null ? null : { t: o.t, p: o.p, c: o.c } }], 'Đã lưu');
            }
        }
        if (q('[data-edel]')) {
            if (!await ask('Chuyển vào Thùng rác?', 'Bạn có thể khôi phục lại trong Thùng rác.', { danger: 1, ok: 'Xóa' }))
                return;
            if (kind === 'tk')
                return act([{ op: 'acc.del', name: o.name }], 'Đã chuyển vào Thùng rác');
            if (kind === 'dm')
                return act([{ op: 'cat.del', cat: { t: o.t, p: o.p, c: o.c } }], 'Đã chuyển vào Thùng rác');
        }
        return;
    }
    if (!E)
        return;
    if (q('[data-ty]')) {
        pull();
        E.type = q('[data-ty]').dataset.ty;
        E.cat = E.sub = '';
        form();
        return;
    }
    if (q('[data-dup]')) {
        pull();
        E = { ...E, id: newId(), date: ymd(new Date()), isNew: true };
        form();
        return;
    }
    if (q('[data-del]')) {
        if (!await ask('Chuyển giao dịch vào Thùng rác?', 'Bạn có thể khôi phục lại trong Thùng rác.', { danger: 1, ok: 'Xóa' }))
            return;
        const id = E.id;
        closeSheet();
        txDel(id);
        return;
    }
    if (q('[data-save]')) {
        pull();
        const ty = E.type;
        let er = '';
        if (!E.amount)
            er = 'Nhập số tiền';
        else if (E.amount < 0 && ty !== 'Điều chỉnh')
            er = 'Số tiền phải lớn hơn 0';
        else if (!E.acc)
            er = 'Chọn tài khoản';
        else if (ty === 'Chuyển khoản' && !E.accTo)
            er = 'Chọn tài khoản nhận';
        else if (ty === 'Chuyển khoản' && E.accTo === E.acc)
            er = 'Tài khoản nguồn và nhận phải khác nhau';
        else if (ty !== 'Chuyển khoản' && ty !== 'Điều chỉnh' && (!E.cat || !E.sub))
            er = 'Chọn hạng mục và chi tiết';
        if (er)
            return toast(er);
        if (E.up)
            return toast('Đang tải ảnh lên, vui lòng chờ…');
        const x = ty === 'Chuyển khoản' || ty === 'Điều chỉnh', row = { id: E.id, date: E.date, type: ty, amount: E.amount, acc: E.acc, accTo: ty === 'Chuyển khoản' ? E.accTo : '', cat: x ? '' : E.cat, sub: x ? '' : E.sub, note: joinImg(E.note, E.imgs) };
        if (E.time) {
            row.at = E.date + 'T' + E.time + ':00';
        }
        else if (E.at) {
            row.at = E.at;
        }
        closeSheet();
        txSave(row);
    }
});
const nzc = c => { if (c === 'đ')
    return 'd'; if (c === 'Đ')
    return 'D'; const r = c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return r.length === 1 ? r : (r ? c : ' '); };
const nz = s => String(s || '').normalize('NFC').split('').map(nzc).join('').toLowerCase();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topKey = (o, f) => { let b = null, bv = -1; for (const k in o) {
    const v = f ? f(o[k]) : o[k];
    if (v > bv) {
        bv = v;
        b = k;
    }
} return b; };
const todayS = () => ymd(new Date());
const catOk = (t, p, c) => S.cat.some(x => x.t === t && x.p === p && x.c === c);
function txSave(row, okMsg) {
    const prev = S.tx.find(t => t.id === row.id), old = prev && { ...prev }, isNew = !prev;
    return commit([{ op: 'tx.save', row }], {
        ok: txMsg(row), title: isNew ? 'Giao dịch đã được tạo' : 'Giao dịch đã được cập nhật', ico: isNew ? '🧾' : '✏️', tag: 'tx-' + row.id, kind: 'tx',
        local: () => { S.tx = S.tx.filter(t => t.id !== row.id).concat(row); S.m = row.date.slice(0, 7); },
        undo: () => commit(old ? [{ op: 'tx.save', row: old }] : [{ op: 'tx.del', id: row.id }], { ok: 'Đã hoàn tác', local: () => { S.tx = S.tx.filter(t => t.id !== row.id); if (old)
                S.tx.push(old); } })
    }).then(r => { if (r.ok)
        limWarn(row); return r; });
}
function txDel(id) {
    const old = { ...S.tx.find(x => x.id === id) };
    return commit([{ op: 'tx.del', id }], {
        ok: 'Mã ' + id + ' đã chuyển vào Thùng rác', title: 'Giao dịch đã được xóa', ico: '🗑️', tag: 'tx-' + id, kind: 'tx', local: () => { S.tx = S.tx.filter(x => x.id !== id); },
        undo: () => {
            const tr = S.trash.find(t => t.k === 'gd' && t.id === id);
            return commit(tr ? [{ op: 'restore', at: tr.at, kind: 'gd' }, { op: 'tx.save', row: old }] : [{ op: 'tx.save', row: old }], { ok: 'Đã hoàn tác', local: () => { S.tx = S.tx.filter(x => x.id !== id).concat(old); } });
        }
    });
}
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || ''))
            return;
        if (UNDO && Date.now() - UNDO.t < 15000) {
            e.preventDefault();
            const f = UNDO.fn;
            UNDO = null;
            $('#toast').classList.remove('on');
            f();
        }
    }
});
let TPL = [];
try {
    TPL = JSON.parse(localStorage.tpl || '[]');
}
catch (e) { }
let tplMg = false;
const tplSaveLS = () => { try {
    localStorage.tpl = JSON.stringify(TPL);
}
catch (e) { } };
const short = n => n >= 1e6 ? +(n / 1e6).toFixed(2) + 'tr' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'k' : String(n);
const tplLabel = t => (t.name || t.sub || t.type) + (t.amount ? ' ' + short(t.amount) : '');
function tplFrom(E0) {
    const name = (E0.note || E0.sub || E0.type).trim();
    return { name, type: E0.type, amount: E0.amount, acc: E0.acc, accTo: E0.accTo || '', cat: E0.cat || '', sub: E0.sub || '', note: E0.note || '' };
}
function tplRow() {
    if (!E || !E.isNew || !TPL.length)
        return '';
    return `<div class="tplr"><small>Mẫu</small><div class="chips">${TPL.map((t, i) => `<button type="button" class="chip" data-tpl="${i}">⚡ ${esc(tplLabel(t))}</button>`).join('')}</div></div>`;
}
function renderTpl() {
    const el = $('#qtp');
    if (!el)
        return;
    el.innerHTML = TPL.length ? TPL.map((t, i) => tplMg
        ? `<span class="chip tx"><span>${esc(tplLabel(t))}</span><button type="button" data-tpldel="${i}" aria-label="Xóa mẫu">×</button></span>`
        : `<button type="button" class="chip" data-tpluse="${i}" title="${esc(t.type + ' · ' + (t.cat ? t.cat + ' › ' + t.sub : t.acc))}">⚡ ${esc(tplLabel(t))}</button>`).join('')
        + `<button type="button" class="chip ${tplMg ? 'on' : ''}" data-tplmg>${tplMg ? 'Xong' : '✎ Mẫu'}</button>`
        : `<small class="mut">Mẫu giao dịch: mở form thêm giao dịch → “☆ Lưu thành mẫu” để tạo nút một chạm.</small>`;
}
function useTpl(i) {
    const t = TPL[i];
    if (!t)
        return;
    const p = { type: t.type, amount: t.amount, acc: S.acc.some(a => a.name === t.acc) ? t.acc : '', accTo: S.acc.some(a => a.name === t.accTo) ? t.accTo : '', cat: t.cat, sub: t.sub, note: t.note, date: todayS(), time: hm(new Date()) };
    if (!p.acc)
        p.acc = (S.acc[0] || {}).name || '';
    if (!t.amount || qMissing(p).length)
        qOpen(p);
    else
        qSave(p);
}
document.addEventListener('click', e => {
    const b = e.target.closest('[data-tpluse],[data-tpldel],[data-tplmg]');
    if (!b)
        return;
    if (b.dataset.tplmg !== undefined) {
        tplMg = !tplMg;
        renderTpl();
        return;
    }
    if (b.dataset.tpldel !== undefined) {
        const t = TPL.splice(+b.dataset.tpldel, 1)[0];
        tplSaveLS();
        renderTpl();
        toast('Đã xóa mẫu “' + (t && t.name) + '”');
        return;
    }
    useTpl(+b.dataset.tpluse);
});
$('#ov').addEventListener('click', e => {
    if (!E)
        return;
    const u = e.target.closest('[data-tpl]'), sv = e.target.closest('[data-tplsave]');
    if (u) {
        pull();
        const t = TPL[+u.dataset.tpl];
        if (!t)
            return;
        Object.assign(E, { type: t.type, amount: t.amount, acc: S.acc.some(a => a.name === t.acc) ? t.acc : E.acc, accTo: t.accTo || '', cat: t.cat, sub: t.sub, note: t.note });
        form();
        return;
    }
    if (sv) {
        pull();
        const ty = E.type, need = ty === 'Chi' || ty === 'Thu';
        if (!E.amount && !E.note && !E.sub)
            return toast('Nhập số tiền hoặc ghi chú trước khi lưu mẫu');
        if (need && (!E.cat || !E.sub))
            return toast('Chọn hạng mục và chi tiết trước khi lưu mẫu');
        const t = tplFrom(E), k = TPL.findIndex(x => x.name.toLowerCase() === t.name.toLowerCase());
        k >= 0 ? TPL[k] = t : TPL.push(t);
        tplSaveLS();
        renderTpl();
        toast('Đã lưu mẫu “' + t.name + '”');
        form();
    }
});
const STOP_ACC = new Set(['ngan', 'hang', 'bank', 'tk', 'the', 'vi', 'tien', 'mat', 'tai', 'khoan', 'tiet', 'kiem', 'tin', 'dung', 'dien', 'tu', 'cua', 'va']);
const CONN = new Set(['bang', 'tu', 'vao', 'tai', 'den', 'het', 'da', 'la', 'luc', 'hom', 'nay']);
const CONN_X = new Set([...CONN, 'sang', 'qua', 'chuyen', 'khoan', 'tien', 'ck']);
const KW = {
    Chi: [[/\b(com|pho|bun|banh|an sang|an trua|an toi|an vat|an uong|tra sua|cafe|ca phe|nuoc|nhau|bia|lau|nuong|bua)\b/, /an|uong/], [/\b(xang|grab|be|gojek|taxi|gui xe|ve xe|xe bus|dau xe|rua xe|sua xe)\b/, /xe|di lai|di chuyen|giao thong/],
        [/\b(dien|internet|wifi|thue nha|tien nha|gas|rac|nuoc sinh hoat)\b/, /nha|dien|hoa don|sinh hoat/], [/\b(thuoc|kham|benh vien|nha thuoc)\b/, /y te|suc khoe|thuoc/], [/\b(sach|hoc phi|khoa hoc)\b/, /hoc|giao duc|sach/],
        [/\b(phim|game|du lich|karaoke|netflix|spotify)\b/, /giai tri|du lich|phim/], [/\b(quan|ao|giay|dep|shopee|lazada)\b/, /mua|sam|quan ao|thoi trang/]],
    Thu: [[/\b(luong|thuong)\b/, /luong|thuong|thu nhap/], [/\b(lai|cashback|hoan)\b/, /lai|thu nhap|khac/]]
};
let _hx = null, _hk = null;
function hist() {
    if (_hk === S.tx)
        return _hx;
    const H = { Chi: { ex: {}, tk: {}, ac: {} }, Thu: { ex: {}, tk: {}, ac: {} } };
    S.tx.forEach(t => {
        const h = H[t.type];
        if (!h || !t.cat || !t.sub)
            return;
        const cs = t.cat + '|' + t.sub, key = nz(t.note).trim();
        h.ac[t.acc] = (h.ac[t.acc] || 0) + 1;
        if (key) {
            const e = (h.ex[key] = h.ex[key] || {}), x = (e[cs] = e[cs] || { n: 0, acc: {} });
            x.n++;
            x.acc[t.acc] = (x.acc[t.acc] || 0) + 1;
        }
        key.split(/[^a-z0-9]+/).filter(w => w.length >= 2).forEach(w => { const e = (h.tk[w] = h.tk[w] || {}); e[cs] = (e[cs] || 0) + 1; });
    });
    _hk = S.tx;
    return (_hx = H);
}
function accHits(w) {
    const L = S.acc.map(a => ({ a, n: nz(a.name) })), toks = L.map(x => new Set(x.n.split(/[^a-z0-9]+/).filter(t => t.length >= 2 && !STOP_ACC.has(t)))), hits = [];
    L.forEach((x, i) => {
        const pats = [x.n];
        if (x.a.type === 'Tiền mặt' && L.filter(y => y.a.type === 'Tiền mặt').length === 1)
            pats.push('tm', 'cash', 'tien mat');
        toks[i].forEach(t => { if (toks.filter(s => s.has(t)).length === 1)
            pats.push(t); });
        for (const p of pats) {
            if (!p)
                continue;
            const m = new RegExp('(^|[^a-z0-9])(' + reEsc(p) + ')(?![a-z0-9])').exec(w);
            if (m) {
                hits.push({ a: x.a, i: m.index + m[1].length, len: p.length });
                break;
            }
        }
    });
    return hits.sort((x, y) => x.i - y.i);
}
function defSub(type, p) {
    const c = {};
    S.tx.forEach(t => { if (t.type === type && t.cat === p && t.sub && catOk(type, p, t.sub))
        c[t.sub] = (c[t.sub] || 0) + 1; });
    return topKey(c) || (S.cat.filter(x => x.t === type && x.p === p).length === 1 ? S.cat.find(x => x.t === type && x.p === p).c : '');
}
function qMatch(type, note, w) {
    const h = hist()[type], nn = nz(note).trim(), out = { cat: '', sub: '', acc: '' };
    let cs = null;
    if (nn && h.ex[nn]) {
        const e = h.ex[nn];
        cs = topKey(e, v => v.n);
        out.acc = topKey(e[cs].acc);
    }
    if (!cs) {
        const sc = {};
        nn.split(/[^a-z0-9]+/).filter(t => t.length >= 2).forEach(t => { const e = h.tk[t]; if (!e)
            return; const tot = Object.values(e).reduce((s, v) => s + v, 0); for (const k in e)
            sc[k] = (sc[k] || 0) + e[k] / tot; });
        const k = topKey(sc);
        if (k && sc[k] >= 0.6)
            cs = k;
    }
    if (cs) {
        const [p, c] = cs.split('|');
        if (!catOk(type, p, c)) {
            cs = null;
            out.acc = '';
        }
    }
    if (!cs) {
        const L = S.cat.filter(c => c.t === type);
        let best = null;
        L.forEach(c => { const n = nz(c.c); if (n.length >= 3 && new RegExp('(^|[^a-z0-9])' + reEsc(n) + '($|[^a-z0-9])').test(nn) && (!best || n.length > nz(best.c).length))
            best = c; });
        if (best)
            cs = best.p + '|' + best.c;
        else {
            const P = L.find(c => { const n = nz(c.p); return n.length >= 3 && nn.includes(n); });
            if (P) {
                out.cat = P.p;
                out.sub = defSub(type, P.p);
                return out;
            }
        }
    }
    if (!cs) {
        for (const [re, tg] of KW[type] || []) {
            if (!re.test(nn))
                continue;
            const L = S.cat.filter(c => c.t === type && (tg.test(nz(c.p)) || tg.test(nz(c.c))));
            if (!L.length)
                continue;
            const tk = nn.split(/[^a-z0-9]+/), c = L.find(c => tk.some(t => t.length >= 3 && nz(c.c).includes(t))) || L[0];
            out.cat = c.p;
            out.sub = tk.some(t => t.length >= 3 && nz(c.c).includes(t)) ? c.c : defSub(type, c.p);
            return out;
        }
    }
    if (cs) {
        const [p, c] = cs.split('|');
        out.cat = p;
        out.sub = c;
    }
    return out;
}
function qParse(text) {
    const raw = String(text || '').normalize('NFC').trim();
    if (!raw)
        return null;
    let w = raw.split('').map(nzc).join('').toLowerCase();
    const used = new Array(raw.length).fill(false), now = new Date();
    const find = re => re.exec(w), cut = m => { for (let i = m.index; i < m.index + m[0].length; i++)
        used[i] = true; w = w.slice(0, m.index) + ' '.repeat(m[0].length) + w.slice(m.index + m[0].length); };
    let m, d = new Date(now), time = hm(now), dayTxt = '';
    if ((m = find(/(?:luc\s*)?(\d{1,2})\s*(?:h(?![a-z])|gio|:)\s*(\d{1,2})?(?!\d)/)) && +m[1] < 24 && (m[2] == null || +m[2] < 60)) {
        time = String(+m[1]).padStart(2, '0') + ':' + String(+(m[2] || 0)).padStart(2, '0');
        cut(m);
    }
    const setD = (dd, mm, yy) => { const x = new Date(yy, mm - 1, dd); if (x.getDate() === dd && x.getMonth() === mm - 1) {
        d = x;
        return true;
    } return false; };
    if ((m = find(/hom kia/))) {
        d.setDate(d.getDate() - 2);
        cut(m);
        dayTxt = 'hôm kia';
    }
    else if ((m = find(/hom qua/))) {
        d.setDate(d.getDate() - 1);
        cut(m);
        dayTxt = 'hôm qua';
    }
    else if ((m = find(/hom nay/)))
        cut(m);
    else if ((m = find(/(?:ngay\s*)?(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?(?!\d)/))) {
        const yy = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
        if (setD(+m[1], +m[2], yy))
            cut(m);
    }
    else if ((m = find(/ngay\s*(\d{1,2})(?!\d)/))) {
        if (setD(+m[1], now.getMonth() + 1, now.getFullYear()))
            cut(m);
    }
    const hits = accHits(w);
    hits.forEach(h => cut({ index: h.i, 0: ' '.repeat(h.len) }));
    let amt = 0, hint = '';
    if ((m = find(/(\d+(?:[.,]\d+)?)\s*(?:tr|trieu|cu)(?![a-z])(?:\s*(\d{1,3})(?!\d))?/))) {
        amt = parseFloat(m[1].replace(',', '.')) * 1e6;
        if (m[2])
            amt += +m[2] * (m[2].length === 1 ? 1e5 : m[2].length === 2 ? 1e4 : 1e3);
        cut(m);
    }
    else if ((m = find(/(\d+(?:[.,]\d+)?)\s*(?:k|nghin|ngan)(?![a-z])/))) {
        amt = parseFloat(m[1].replace(',', '.')) * 1e3;
        cut(m);
    }
    else if ((m = find(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})(?!\d)/))) {
        amt = +m[1].replace(/[.,]/g, '');
        cut(m);
    }
    else {
        const all = [...w.matchAll(/(^|[^\d.,])(\d{1,3})(?![\d.,])/g)];
        if (all.length) {
            const l = all[all.length - 1];
            amt = +l[2] * 1e3;
            hint = 'x1000';
            cut({ index: l.index + l[1].length, 0: l[2] });
        }
    }
    amt = Math.round(amt);
    const plus = /^\s*\+/.test(raw);
    let type = 'Chi', accTo = '';
    if (hits.length >= 2 && /chuyen|sang|->|=>|→|\bqua\b|\bck\b|\bden\b/.test(w))
        type = 'Chuyển khoản';
    else if (plus || /(^|\s)(luong|thuong|thu nhap|nhan tien|duoc cho|hoan tien|hoan lai|tien lai|lai suat|cashback|refund|thu)(\s|$)/.test(w))
        type = 'Thu';
    let note = raw.split('').filter((c, i) => !used[i]).join('').replace(/^\s*[+\-]/, '').replace(/[,;·|]/g, ' ').replace(/\s+/g, ' ').trim();
    let tk = note.split(' ').filter(Boolean);
    const isC = t => CONN.has(nz(t));
    while (tk.length && isC(tk[0]))
        tk.shift();
    while (tk.length && isC(tk[tk.length - 1]))
        tk.pop();
    if (type === 'Chuyển khoản')
        tk = tk.filter(t => !CONN_X.has(nz(t)) && !/^[-=]*>|→/.test(t));
    note = tk.join(' ');
    if (note)
        note = note[0].toUpperCase() + note.slice(1);
    const p = { type, amount: amt, hint, date: ymd(d), time, note, cat: '', sub: '', acc: '', accTo: '', dayTxt };
    if (type === 'Chuyển khoản') {
        p.acc = hits[0].a.name;
        p.accTo = hits[1].a.name;
        p.note = note;
    }
    else {
        const g = qMatch(type, note, w);
        p.cat = g.cat;
        p.sub = g.sub;
        p.acc = hits[0] ? hits[0].a.name : (S.acc.some(a => a.name === g.acc) ? g.acc : (topKey(hist()[type].ac) || (S.acc[0] || {}).name || ''));
    }
    return p;
}
function qMissing(p) {
    const L = [];
    if (!(p.amount > 0))
        L.push('số tiền');
    if (!p.acc)
        L.push('tài khoản');
    if (p.type === 'Chuyển khoản') {
        if (!p.accTo || p.accTo === p.acc)
            L.push('tài khoản nhận');
    }
    else if (p.type === 'Chi' || p.type === 'Thu') {
        if (!p.cat || !p.sub || !catOk(p.type, p.cat, p.sub))
            L.push('hạng mục');
    }
    return L;
}
function qPreview(p) {
    if (!p)
        return '';
    const miss = qMissing(p), C = CLS[p.type], when = (p.date === todayS() ? 'hôm nay' : p.date.slice(8) + '/' + p.date.slice(5, 7)) + ' ' + p.time;
    const cat = p.type === 'Chuyển khoản' ? `${esc(p.acc)} → ${esc(p.accTo || '?')}` : p.cat ? `${emo(p.sub || p.cat)} ${esc(p.cat)}${p.sub ? ' › ' + esc(p.sub) : ''}` : '<b class="chi">chưa rõ hạng mục</b>';
    return `<span class="qp ${C}">${p.type}</span><b class="${C}">${p.amount ? num(p.amount) + ' ₫' : '?'}</b>${p.hint ? '<small class="mut">(hiểu là nghìn)</small>' : ''}<span>${cat}</span>${p.type === 'Chuyển khoản' ? '' : `<span class="mut">${esc(p.acc)}</span>`}<span class="mut">${when}</span>${p.note ? `<span class="mut">“${esc(p.note)}”</span>` : ''}${miss.length ? `<em class="chi">Thiếu: ${miss.join(', ')} → Enter để mở form</em>` : '<em class="thu">Enter để lưu</em>'}`;
}
function qRow(p) {
    const x = p.type === 'Chuyển khoản';
    const r = { id: newId(), date: p.date, type: p.type, amount: p.amount, acc: p.acc, accTo: x ? p.accTo : '', cat: x ? '' : p.cat, sub: x ? '' : p.sub, note: p.note };
    if (p.time)
        r.at = p.date + 'T' + p.time + ':00';
    return r;
}
function qSave(p) { return txSave(qRow(p), 'Đã ghi: ' + p.type + ' ' + num(p.amount) + (p.sub ? ' · ' + p.sub : '')); }
function qOpen(p) {
    E = { id: newId(), date: p.date, time: p.time, type: p.type, amount: p.amount || 0, acc: p.acc || (S.acc[0] || {}).name || '', accTo: p.accTo || '', cat: p.cat || '', sub: p.sub || '', note: p.note || '', isNew: true };
    ED = null;
    form();
    openSheet();
}
function qSubmit(forceForm) {
    const el = $('#qin'), p = qParse(el.value);
    if (!p)
        return;
    if (!S.ready)
        return toast('Đang tải dữ liệu, thử lại sau giây lát');
    if (forceForm || qMissing(p).length) {
        qOpen(p);
    }
    else
        qSave(p);
    el.value = '';
    $('#qpv').innerHTML = '';
}
const qin = $('#qin');
qin.addEventListener('input', () => { $('#qpv').innerHTML = S.ready ? qPreview(qParse(qin.value)) : ''; });
qin.addEventListener('keydown', e => { if (e.key === 'Enter') {
    e.preventDefault();
    qSubmit(e.ctrlKey || e.metaKey || e.shiftKey);
}
else if (e.key === 'Escape') {
    qin.value = '';
    $('#qpv').innerHTML = '';
    qin.blur();
} });
$('#qsv').addEventListener('click', () => qSubmit(false));
$('#qed').addEventListener('click', () => { if (qin.value.trim())
    qSubmit(true);
else
    openForm(); });
document.addEventListener('keydown', e => {
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '') && !$('#qb').classList.contains('hide') && $('#login').classList.contains('hide') && !$('#ov').classList.contains('open')) {
        e.preventDefault();
        qin.focus();
    }
});
let _qv = null;
function qbNav() {
    const show = (S.tab === 'home' || S.tab === 'tx') && S.ready;
    $('#qb').classList.toggle('hide', !show);
    if (show && _qv !== JSON.stringify(TPL) + tplMg) {
        _qv = JSON.stringify(TPL) + tplMg;
        renderTpl();
    }
}
document.addEventListener('click', e => { if (e.target.closest('[data-a3="print"]'))
    window.print(); });
S.rpv = S.rpv || 'm';
const pct = (x, y) => y ? Math.round((x - y) / y * 100) : null;
function delta(x, y, isChi = true) {
    const p = pct(x, y);
    if (p === null)
        return x ? '<span class="dl mut">mới</span>' : '';
    if (p === 0)
        return '<span class="dl mut">±0%</span>';
    const bad = isChi ? p > 0 : p < 0;
    return `<span class="dl ${bad ? 'chi' : 'thu'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%</span>`;
}
const flow = t => t.type === 'Thu' || t.type === 'Điều chỉnh' ? t.amount : t.type === 'Chi' ? -t.amount : 0;
const daysIn = m => new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
const isCurM = m => m === ymd(new Date()).slice(0, 7);
function lineChart(series, n, opt = {}) {
    const W = 480, H = 150, L = 6, R = 6, T = 10, B = 22, all = series.flatMap(s => s.v.filter(x => x != null));
    if (!all.length)
        return empty('Chưa có dữ liệu');
    const mn = opt.zero ? Math.min(0, ...all) : Math.min(...all), mx = Math.max(...all), rg = (mx - mn) || 1;
    const X = i => L + (n > 1 ? i / (n - 1) : .5) * (W - L - R), Y = v => T + (1 - (v - mn) / rg) * (H - T - B);
    const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${T + f * (H - T - B)}" y2="${T + f * (H - T - B)}" stroke="var(--line)"/>`).join('');
    const lines = series.map(s => {
        const pts = s.v.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
        if (!pts.length)
            return '';
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        const area = s.area ? `<path d="${d} L${pts[pts.length - 1][0].toFixed(1)} ${H - B} L${pts[0][0].toFixed(1)} ${H - B}Z" fill="${s.c}" opacity=".12"/>` : '';
        const e = pts[pts.length - 1];
        return `${area}<path d="${d}" fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/><circle cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3.4" fill="${s.c}"/>`;
    }).join('');
    const step = n > 20 ? 7 : n > 10 ? 5 : 2, xl = Array.from({ length: n }, (_, i) => i).filter(i => i === 0 || i === n - 1 || (i + 1) % step === 0)
        .map(i => `<text x="${X(i)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--mut)">${opt.xl ? opt.xl(i) : i + 1}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(opt.label || 'Biểu đồ đường')}">${grid}${lines}${xl}</svg>`;
}
function netSeries(m) {
    const start = m + '-01', per = {};
    let base = ownAcc().reduce((s, a) => s + (+a.open || 0), 0);
    stx().forEach(t => { if (t.date < start)
        base += flow(t);
    else if (t.date.slice(0, 7) === m)
        per[+t.date.slice(8)] = (per[+t.date.slice(8)] || 0) + flow(t); });
    const last = isCurM(m) ? new Date().getDate() : daysIn(m), v = [];
    let b = base;
    for (let d = 1; d <= last; d++) {
        b += per[d] || 0;
        v.push(b);
    }
    return { v, base };
}
function cumChi(m) {
    const per = {};
    chiM(m).forEach(t => per[+t.date.slice(8)] = (per[+t.date.slice(8)] || 0) + t.amount);
    const last = isCurM(m) ? new Date().getDate() : daysIn(m), v = [];
    let c = 0;
    for (let d = 1; d <= last; d++) {
        c += per[d] || 0;
        v.push(c);
    }
    return v;
}
function anomalies(m) {
    const start = m + '-01', from = shift(m, -6) + '-01', H = {};
    stx().forEach(t => { if (t.type === 'Chi' && t.date >= from && t.date < start) {
        const k = t.sub || t.cat || '';
        (H[k] = H[k] || []).push(t.amount);
    } });
    const out = [];
    chiM(m).forEach(t => {
        const h = H[t.sub || t.cat || ''];
        if (!h || h.length < 4)
            return;
        const s = [...h].sort((a, b) => a - b), med = s[s.length >> 1], mean = h.reduce((a, b) => a + b, 0) / h.length, sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) ** 2, 0) / h.length);
        if (t.amount >= 50000 && t.amount > Math.max(med * 2.5, mean + 2 * sd))
            out.push({ t, med, r: t.amount / (med || 1) });
    });
    return out.sort((a, b) => b.r - a.r).slice(0, 6);
}
function surges(m, dnum, dim) {
    const prev = [1, 2, 3].map(i => shift(m, -i)), cur = {}, avg = {};
    chiM(m).forEach(t => { const k = t.cat || 'Chưa phân loại'; cur[k] = (cur[k] || 0) + t.amount; });
    prev.forEach(pm => chiM(pm).forEach(t => { const k = t.cat || 'Chưa phân loại'; avg[k] = (avg[k] || 0) + t.amount / 3; }));
    const k = isCurM(m) ? dim / Math.max(1, dnum) : 1;
    return Object.keys(cur).map(c => ({ c, proj: cur[c] * k, avg: avg[c] || 0 })).filter(x => x.avg > 0 && x.proj > x.avg * 1.4 && x.proj - x.avg > 200000).sort((a, b) => (b.proj - b.avg) - (a.proj - a.avg)).slice(0, 4);
}
function rpHead(sub, nav) {
    return `<div class="ph"><div><h1>Báo cáo</h1><p>${sub}</p></div><div class="pa">${nav}<div class="tabs rpt-tabs"><button type="button" class="${S.rpv === 'm' ? 'on' : ''}" data-rp="m">Tháng</button><button type="button" class="${S.rpv === 'y' ? 'on' : ''}" data-rp="y">Năm</button></div><button class="btn noprint" data-a3="print">In / PDF</button></div></div>`;
}
const navM = (lb, step) => `<div class="mn noprint"><button data-m="${-step}" aria-label="Trước">‹</button><b>${lb}</b><button data-m="${step}" aria-label="Sau">›</button></div>`;
function rpMonth() {
    const m = S.m, pm = shift(m, -1), dim = daysIn(m), cur = isCurM(m), dnum = cur ? new Date().getDate() : dim;
    const a = sums(m), b = sums(pm), fc = cur ? a.chi / Math.max(1, dnum) * dim : a.chi, saveP = a.thu ? Math.round((a.thu - a.chi) / a.thu * 100) : 0;
    const limM = limOf('Tháng', ''), limNote = limM ? (fc > limM ? `<b class="chi">vượt hạn mức tháng ${vnd(fc - limM)}</b>` : `<b class="thu">còn trong hạn mức, dư ${vnd(limM - fc)}</b>`) : '';
    const cc = {}, pp = {};
    chiM(m).forEach(t => { const k = t.cat || 'Chưa phân loại'; cc[k] = (cc[k] || 0) + t.amount; });
    chiM(pm).forEach(t => { const k = t.cat || 'Chưa phân loại'; pp[k] = (pp[k] || 0) + t.amount; });
    const keys = [...new Set([...Object.keys(cc), ...Object.keys(pp)])].sort((x, y) => Math.max(cc[y] || 0, pp[y] || 0) - Math.max(cc[x] || 0, pp[x] || 0)).slice(0, 12), mx = Math.max(1, ...keys.map(k => Math.max(cc[k] || 0, pp[k] || 0)));
    const cmp = keys.map(k => `<div class="cmp"><div class="cl"><span>${emo(k)} ${esc(k)}</span><span class="sens"><b>${vnd(cc[k] || 0)}</b> ${delta(cc[k] || 0, pp[k] || 0)}</span></div><div class="cb"><i style="width:${(cc[k] || 0) / mx * 100}%"></i></div><div class="cb p"><i style="width:${(pp[k] || 0) / mx * 100}%"></i></div><small class="mut sens">${mlabel(pm)}: ${vnd(pp[k] || 0)}</small></div>`).join('');
    const ns = netSeries(m), cm = cumChi(m), cp = cumChi(pm), nn = Math.max(cm.length, cp.length), net0 = ns.v[0], net1 = ns.v[ns.v.length - 1];
    const AN = anomalies(m), SG = surges(m, dnum, dim);
    const wd = [0, 0, 0, 0, 0, 0, 0], wc = [0, 0, 0, 0, 0, 0, 0];
    chiM(m).forEach(t => { const i = (new Date(t.date + 'T00:00').getDay() + 6) % 7; wd[i] += t.amount; });
    for (let d = 1; d <= (cur ? dnum : dim); d++)
        wc[(new Date(+m.slice(0, 4), +m.slice(5) - 1, d).getDay() + 6) % 7]++;
    const wa = wd.map((v, i) => wc[i] ? v / wc[i] : 0), wmx = Math.max(1, ...wa), wtop = wa.indexOf(Math.max(...wa)), WN = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    const nm = {};
    chiM(m).forEach(t => { const k = (t.note || t.sub || t.cat || 'Khác').trim(), key = nz(k); const o = nm[key] = nm[key] || { k, n: 0, v: 0 }; o.n++; o.v += t.amount; });
    const topN = Object.values(nm).sort((x, y) => y.v - x.v).slice(0, 6);
    return rpHead(mlabel(m) + (cur ? ' · đến hôm nay (ngày ' + dnum + '/' + dim + ')' : ''), navM(mlabel(m), 1)) + issueBanner() +
        `<div class="kpis">${kpi('Chi tháng này', vnd(a.chi), 'chi', delta(a.chi, b.chi) + ' so với ' + mlabel(pm).toLowerCase(), 'h')}${kpi('Thu tháng này', vnd(a.thu), 'thu', delta(a.thu, b.thu, false) + ' so với tháng trước')}${kpi(cur ? 'Dự báo chi cả tháng' : 'Chi TB mỗi ngày', vnd(cur ? fc : a.chi / dim), cur && limM && fc > limM ? 'chi' : '', cur ? 'TB ' + vnd(a.chi / Math.max(1, dnum)) + '/ngày' : '')}${kpi('Tỷ lệ tiết kiệm', saveP + '%', saveP < 0 ? 'chi' : '', 'Thu − chi = ' + vnd(a.thu - a.chi))}</div>
${cur && a.chi ? `<div class="card insight"><span>Giữ nhịp chi này, cuối tháng bạn sẽ chi khoảng <b class="sens">${vnd(fc)}</b>${b.chi ? ' (' + (fc > b.chi ? 'cao hơn' : 'thấp hơn') + ' tháng trước <b class="sens">' + vnd(Math.abs(fc - b.chi)) + '</b>)' : ''}${limNote ? ' — ' + limNote : ''}.</span></div>` : ''}
<div class="grid b"><div class="card"><div class="ch">Chi tiêu lũy kế <small><span class="chi">■</span> ${mlabel(m).toLowerCase()} &nbsp;<span class="mut">■</span> tháng trước</small></div>${lineChart([{ v: cp, c: '#98A2B3', dash: true }, { v: cm, c: 'var(--chi)', area: true }], nn, { zero: true, label: 'Chi tiêu lũy kế so với tháng trước' })}<p class="note">Đường đỏ nằm trên đường xám = bạn đang chi nhanh hơn tháng trước tại cùng thời điểm.</p></div>
<div class="card"><div class="ch">Tổng tài sản trong tháng <small class="sens">${net0 != null ? vnd(net0) + ' → ' + vnd(net1) : ''}</small></div>${lineChart([{ v: ns.v, c: 'var(--acc)', area: true }], ns.v.length, { label: 'Xu hướng tổng tài sản' })}<p class="note">${net1 != null ? (net1 >= ns.base ? 'Tài sản <b class="thu">tăng ' : 'Tài sản <b class="chi">giảm ') + '<span class="sens">' + vnd(Math.abs(net1 - ns.base)) + '</span></b> so với đầu tháng.' : ''}</p></div></div>
<div class="grid b" style="align-items:start"><div class="card"><div class="ch">So sánh theo hạng mục <small>so với ${mlabel(pm).toLowerCase()}</small></div>${cmp || empty('Chưa có khoản chi')}</div>
<div class="col"><div class="card"><div class="ch">⚠️ Cảnh báo bất thường</div>${AN.length || SG.length ? AN.map(x => `<div class="an">${txRow(x.t)}<small class="chi">Gấp ${x.r.toFixed(1)} lần mức thường thấy của “${esc(x.t.sub || x.t.cat)}” (trung vị ${vnd(x.med)})</small></div>`).join('') + SG.map(x => `<div class="an"><div class="row" style="border:0"><span class="dot">${emo(x.c)}</span><span class="m"><b>${esc(x.c)} tăng mạnh</b><small class="sens">Dự kiến ${vnd(x.proj)} · TB 3 tháng trước ${vnd(x.avg)}</small></span><b class="chi">+${Math.round((x.proj / x.avg - 1) * 100)}%</b></div></div>`).join('') : empty('Không có gì bất thường', 'Các khoản chi trong tháng nằm trong mức thường thấy.')}<p class="note">Khoản chi bị gắn cờ khi lớn hơn rõ rệt so với 6 tháng trước ở cùng chi tiết (cần ≥ 4 lần ghi nhận để so sánh).</p></div>
<div class="card"><div class="ch">Chi theo thứ trong tuần <small>trung bình mỗi ngày</small></div>${wa.map((v, i) => bar(WN[i], v, wmx, i === wtop && v ? 'var(--chi)' : 'var(--acc)')).join('')}${wa[wtop] ? `<p class="note">Bạn chi nhiều nhất vào <b>${WN[wtop]}</b> (TB <span class="sens">${vnd(wa[wtop])}</span>/ngày).</p>` : ''}</div>
<div class="card"><div class="ch">Chi nhiều nhất cho</div>${topN.map(o => `<div class="row" style="border:0;padding:7px 0"><span class="m"><b>${esc(o.k)}</b><small>${o.n} lần</small></span><b class="chi sens">${vnd(o.v)}</b></div>`).join('') || empty('Chưa có khoản chi')}</div></div></div>`;
}
function rpYear() {
    const Y = +S.m.slice(0, 4), rows = [];
    for (let i = 1; i <= 12; i++) {
        const m = Y + '-' + String(i).padStart(2, '0'), s = sums(m);
        rows.push({ m, i, ...s, n: s.thu - s.chi, c: stx().filter(t => inM(t, m)).length });
    }
    const T = rows.reduce((o, r) => ({ thu: o.thu + r.thu, chi: o.chi + r.chi }), { thu: 0, chi: 0 }), active = rows.filter(r => r.thu || r.chi).length || 1;
    const pY = { thu: 0, chi: 0 };
    for (let i = 1; i <= 12; i++) {
        const s = sums((Y - 1) + '-' + String(i).padStart(2, '0'));
        pY.thu += s.thu;
        pY.chi += s.chi;
    }
    const topM = Math.max(1, ...rows.map(r => Math.max(r.thu, r.chi))), maxChi = rows.reduce((b, r) => r.chi > b.chi ? r : b, rows[0]), minChi = rows.filter(r => r.chi).reduce((b, r) => r.chi < b.chi ? r : b, maxChi);
    const bars = [0, .5, 1].map(f => `<line x1="0" x2="480" y1="${130 - f * 120}" y2="${130 - f * 120}" stroke="var(--line)"/>`).join('') + rows.map((x, i) => { const h1 = x.thu / topM * 120, h2 = x.chi / topM * 120; return `<rect x="${i * 40 + 6}" y="${130 - h1}" width="13" height="${h1}" rx="2" fill="var(--thu)"/><rect x="${i * 40 + 20}" y="${130 - h2}" width="13" height="${h2}" rx="2" fill="var(--chi)"/><text x="${i * 40 + 20}" y="148" font-size="10" text-anchor="middle" fill="var(--mut)">${x.i}</text>`; }).join('');
    const cats = group(stx().filter(t => t.type === 'Chi' && t.date.startsWith(Y + '-')), t => t.cat || 'Chưa phân loại'), cmx = cats[0] ? cats[0][1] : 1;
    return rpHead('Năm ' + Y, navM('Năm ' + Y, 12)) +
        `<div class="kpis">${kpi('Tổng chi', vnd(T.chi), 'chi', delta(T.chi, pY.chi) + ' so với ' + (Y - 1), 'h')}${kpi('Tổng thu', vnd(T.thu), 'thu', delta(T.thu, pY.thu, false) + ' so với ' + (Y - 1))}${kpi('Tiết kiệm', vnd(T.thu - T.chi), T.thu - T.chi < 0 ? 'chi' : '', (T.thu ? Math.round((T.thu - T.chi) / T.thu * 100) : 0) + '% thu nhập')}${kpi('Chi TB mỗi tháng', vnd(T.chi / active), '', 'Cao nhất T' + maxChi.i + ' · thấp nhất T' + minChi.i)}</div>
<div class="card" style="margin-bottom:14px"><div class="ch">Thu chi từng tháng ${Y} <small><span class="thu">■</span> thu &nbsp;<span class="chi">■</span> chi</small></div><svg viewBox="0 0 480 154" width="100%" role="img" aria-label="Thu chi theo tháng">${bars}</svg></div>
<div class="grid b" style="align-items:start"><div class="card"><div class="ch">Bảng theo tháng</div><div class="tw"><table class="rpt"><thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Ròng</th><th>%TK</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.i === maxChi.i && r.chi ? 'mx' : ''}"><td>T${r.i}</td><td class="thu sens">${r.thu ? num(r.thu) : '–'}</td><td class="chi sens">${r.chi ? num(r.chi) : '–'}</td><td class="sens ${r.n < 0 ? 'chi' : ''}">${r.thu || r.chi ? num(r.n) : '–'}</td><td>${r.thu ? Math.round(r.n / r.thu * 100) + '%' : '–'}</td></tr>`).join('')}</tbody><tfoot><tr><td>Cả năm</td><td class="thu sens">${num(T.thu)}</td><td class="chi sens">${num(T.chi)}</td><td class="sens ${T.thu - T.chi < 0 ? 'chi' : ''}">${num(T.thu - T.chi)}</td><td>${T.thu ? Math.round((T.thu - T.chi) / T.thu * 100) + '%' : '–'}</td></tr></tfoot></table></div></div>
<div class="card"><div class="ch">Chi theo hạng mục cả năm <small>TB/tháng</small></div>${cats.slice(0, 12).map(([k, v], i) => bar(emo(k) + ' ' + esc(k), v, cmx, col(i)).replace('</b>', ' <small class="mut">' + Math.round(v / (T.chi || 1) * 100) + '% · ' + short(v / active) + '/th</small></b>')).join('') || empty('Chưa có khoản chi')}</div></div>`;
}
function reportPage() { return S.rpv === 'y' ? rpYear() : rpMonth(); }
document.addEventListener('click', e => {
    const b = e.target.closest('[data-rp]');
    if (!b)
        return;
    S.rpv = b.dataset.rp;
    render();
});
Object.assign(S, { sa: '', sc: '', ss: '', ct: 'Chi', sl: '', lo: false, vf: 'all' });
const TXV = [['tx', 'Tất cả'], ['ba', 'Theo tài khoản'], ['bc', 'Theo danh mục'], ['bl', 'Theo hạn mức']];
const txSwitch = () => `<div class="tabs vsw" role="tablist">${TXV.map(([k, l]) => `<button type="button" role="tab" class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${ic(k)}${l}</button>`).join('')}</div>`;
const keyOr = (keys, cur, def) => keys.includes(cur) ? cur : def;
const byTime = (a, b) => (b.date + ' ' + ((b.at || '').slice(11) || '23:59:59')).localeCompare(a.date + ' ' + ((a.at || '').slice(11) || '23:59:59'));
const dayName = d => new Date(d + 'T00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
const dayHd = (d, r, cls) => `<div class="dh ${cls || ''}"><span>${dayName(d)}</span><span class="sens">${r || ''}</span></div>`;
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n));
function dayList(l, hd, v) { let h = '', last = ''; l.forEach(t => { if (t.date !== last) {
    last = t.date;
    h += hd(t.date);
} h += txRow(t, v); }); return h; }
const mdWrap = (l, d) => `<div class="md"><div class="mdl" role="tablist">${l}</div><div class="mdd">${d}</div></div>`;
const mdi = (on, k, v, ico, name, sub, amt, ratio, color, dim) => `<button type="button" role="tab" aria-selected="${!!on}" class="mi ${on ? 'on' : ''} ${dim ? 'z' : ''}" data-pk="${k}" data-pv="${esc(v)}"><span class="mt">${ico}<span class="mtx"><b>${name}</b><small>${sub}</small></span><span class="ma sens">${amt}</span></span><i class="mbar" style="--bc:${color}"><s style="width:${Math.min(100, Math.max(0, ratio * 100))}%"></s></i></button>`;
const dhead = (ico, name, sub, right) => `<div class="card dcard"><div class="dtop">${ico}<div class="dtt"><h2>${name}</h2><p>${sub}</p></div>${right || ''}</div></div>`;
const noData = (a, b, btn) => `<div class="card">${empty(a, b)}${btn || ''}</div>`;
const sKpis = a => `<div class="kpis sm">${a.join('')}</div>`;
function accInfo(a) {
    let thu = 0, chi = 0, tin = 0, tout = 0, adj = 0;
    const l = [];
    S.tx.forEach(t => {
        if (!inM(t, S.m))
            return;
        const mine = t.acc === a.name, to = t.type === 'Chuyển khoản' && t.accTo === a.name;
        if (!mine && !to)
            return;
        l.push(t);
        if (mine) {
            if (t.type === 'Thu')
                thu += t.amount;
            else if (t.type === 'Chi')
                chi += t.amount;
            else if (t.type === 'Chuyển khoản')
                tout += t.amount;
            else
                adj += t.amount;
        }
        if (to)
            tin += t.amount;
    });
    return { thu, chi, tin, tout, adj, l: l.sort(byTime), net: thu + tin + adj - chi - tout };
}
function accView() {
    const head0 = head('Giao dịch', 'Theo tài khoản · ' + mlabel(S.m)) + txSwitch();
    if (!S.acc.length)
        return head0 + noData('Chưa có tài khoản', 'Thêm tài khoản ở mục Tài khoản.');
    const A = S.acc.slice().sort((x, y) => (x.type === HELD) - (y.type === HELD)), I = new Map(A.map(a => [a.name, accInfo(a)]));
    const key = keyOr(A.map(a => a.name), S.sa, (A.find(a => I.get(a.name).l.length) || A[0]).name), a = A.find(x => x.name === key), f = I.get(key), b = bal(a);
    const act = Math.max(1, ...A.map(x => I.get(x.name).thu + I.get(x.name).chi + I.get(x.name).tin + I.get(x.name).tout));
    const list = A.map(x => {
        const i = I.get(x.name), B = bal(x), c = (ATYPE[x.type] || ['', '#667085'])[1];
        return mdi(x.name === key, 'sa', x.name, aIco(x), esc(x.name), `${i.l.length} giao dịch · <span class="thu">+${short(i.thu + i.tin)}</span> <span class="chi">−${short(i.chi + i.tout)}</span>`, `<span class="${B < 0 ? 'chi' : ''}">${vnd(B)}</span>`, (i.thu + i.chi + i.tin + i.tout) / act, c, !i.l.length);
    }).join('');
    const L = f.l.filter(t => S.vf === 'all' || t.type === S.vf), D = {};
    L.forEach(t => { const mine = t.acc === key, v = t.type === 'Thu' ? t.amount : t.type === 'Chi' ? -t.amount : t.type === 'Điều chỉnh' ? t.amount : t.type === 'Chuyển khoản' ? (mine ? -t.amount : t.amount) : 0; D[t.date] = (D[t.date] || 0) + (mine || t.accTo === key ? v : 0); });
    const hd = d => dayHd(d, D[d] ? 'ròng <b class="' + (D[d] < 0 ? 'chi' : 'thu') + '">' + sgn(D[d]) + '</b>' : '');
    const det = dhead(aIco(a), esc(a.name), esc(a.type) + (a.type === HELD ? ' · không tính vào thống kê' : '') + ' · ' + mlabel(S.m), `<div class="dbal"><small>Số dư hiện tại</small><b class="sens ${b < 0 ? 'chi' : ''}">${vnd(b)}</b></div>`)
        + sKpis([kpi('Thu', vnd(f.thu), 'thu', 'Tiền vào'), kpi('Chi', vnd(f.chi), 'chi', 'Tiền ra'), kpi('Chuyển khoản ròng', sgn(f.tin - f.tout) + ' ₫', 'chuyen', 'vào ' + short(f.tin) + ' · ra ' + short(f.tout)), kpi('Biến động', sgn(f.net) + ' ₫', f.net < 0 ? 'chi' : 'thu', mlabel(S.m))])
        + `<div class="tb"><div class="chips">${['all', ...TYPES].map(t => `<button class="chip ${S.vf === t ? 'on' : ''}" data-pk="vf" data-pv="${t}">${t === 'all' ? 'Tất cả' : t}</button>`).join('')}</div><button class="btn" data-vgo="acc" data-pv="${esc(key)}">Xem toàn bộ thời gian</button></div>`
        + `<div class="card flush">${L.length ? dayList(L, hd, key) : empty('Không có giao dịch', 'Tài khoản này chưa có giao dịch trong ' + mlabel(S.m).toLowerCase() + '.')}</div>`;
    return head0 + mdWrap(list, det);
}
function catView() {
    const ty = S.ct, cl = ty === 'Thu' ? 'thu' : 'chi', L = stx().filter(t => t.type === ty && inM(t, S.m)), tot = L.reduce((s, t) => s + t.amount, 0), G = {};
    const NS = '(không chi tiết)';
    S.cat.filter(c => c.t === ty).forEach(c => { G[c.p] = G[c.p] || { k: c.p, v: 0, n: 0, s: {} }; });
    L.forEach(t => { const k = t.cat || '', g = G[k] = G[k] || { k, v: 0, n: 0, s: {} }; g.v += t.amount; g.n++; const sk = t.sub || NS; g.s[sk] = (g.s[sk] || 0) + t.amount; });
    const R = Object.values(G).sort((x, y) => y.v - x.v || x.k.localeCompare(y.k, 'vi')), mx = R[0] ? R[0].v : 1, nm = k => k || 'Chưa phân loại';
    const sw = `<div class="tabs ctsw">${['Chi', 'Thu'].map(t => `<button type="button" class="${ty === t ? 'on' : ''}" data-pk="ct" data-pv="${t}">${t === 'Chi' ? 'Khoản chi' : 'Khoản thu'}</button>`).join('')}</div>`;
    const head0 = head('Giao dịch', 'Theo danh mục · ' + mlabel(S.m), sw) + txSwitch();
    if (!R.length)
        return head0 + noData('Chưa có hạng mục', 'Thêm hạng mục ở mục Hạng mục.');
    const key = keyOr(R.map(r => r.k), S.sc, (R.find(r => r.v) || R[0]).k), g = G[key], ss = keyOr(Object.keys(g.s), S.ss, '');
    const list = R.map((r, i) => mdi(r.k === key, 'sc', r.k, `<span class="dot">${emo(r.k)}</span>`, esc(nm(r.k)), `${r.n} giao dịch · ${tot ? Math.round(r.v / tot * 100) : 0}%`, `<span class="${r.v ? cl : ''}">${vnd(r.v)}</span>`, mx ? r.v / mx : 0, col(i), !r.v)).join('');
    const subs = Object.entries(g.s).sort((x, y) => y[1] - x[1]);
    let T = L.filter(t => (t.cat || '') === key);
    const base = T;
    if (ss)
        T = T.filter(t => (t.sub || NS) === ss);
    T.sort(byTime);
    const sum = T.reduce((s, t) => s + t.amount, 0), big = T.reduce((b, t) => t.amount > b ? t.amount : b, 0), pv = stx().filter(t => t.type === ty && (t.cat || '') === key && inM(t, shift(S.m, -1))).reduce((s, t) => s + t.amount, 0), D = {};
    T.forEach(t => D[t.date] = (D[t.date] || 0) + t.amount);
    const hd = d => dayHd(d, (ty === 'Thu' ? 'thu ' : 'chi ') + num(D[d]));
    const det = dhead(`<span class="dot lg">${emo(key)}</span>`, esc(nm(key)), (ty === 'Thu' ? 'Khoản thu' : 'Khoản chi') + ' · ' + mlabel(S.m) + (tot ? ' · ' + Math.round(g.v / tot * 100) + '% tổng ' + ty.toLowerCase() : ''), `<div class="dbal"><small>Tổng tháng này</small><b class="sens ${cl}">${vnd(g.v)}</b>${delta(g.v, pv, ty === 'Chi')}</div>`)
        + sKpis([kpi(ss ? 'Đang lọc' : 'Tổng', vnd(sum), cl, ss ? esc(ss) : mlabel(S.m)), kpi('Số giao dịch', String(T.length), '', 'TB ' + vnd(T.length ? sum / T.length : 0)), kpi('Lớn nhất', vnd(big), '', 'Một giao dịch'), kpi('Tháng trước', vnd(pv), '', mlabel(shift(S.m, -1)))])
        + (subs.length ? `<div class="card"><div class="ch">Chi tiết trong hạng mục <small>${subs.length} nhóm · bấm để lọc</small></div><div class="dsub">${subs.length > 1 ? donut(subs, g.v, 1, () => '') : ''}<div class="cg"><button class="chip ${ss ? '' : 'on'}" data-pk="ss" data-pv="">Tất cả <b class="sens">${num(g.v)}</b></button>${subs.map(([k, v]) => `<button class="chip ${ss === k ? 'on' : ''}" data-pk="ss" data-pv="${esc(k)}">${esc(k)} <b class="sens ${ss === k ? '' : cl}">${num(v)}</b></button>`).join('')}</div></div></div>` : '')
        + (key ? `<div class="tb"><span class="mut" style="font-size:13px">${T.length} giao dịch</span><button class="btn" data-vgo="cat" data-pv="${esc(key)}">Xem toàn bộ thời gian</button></div>` : '')
        + `<div class="card flush">${T.length ? dayList(T, hd) : empty('Không có giao dịch', 'Hạng mục này chưa có giao dịch trong ' + mlabel(S.m).toLowerCase() + '.')}</div>`;
    return head0 + mdWrap(list, det);
}
function limStat(L) {
    const l = chiM(S.m).filter(t => !L.cat || t.cat === L.cat), pd = {};
    l.forEach(t => pd[t.date] = (pd[t.date] || 0) + t.amount);
    const used = l.reduce((s, t) => s + t.amount, 0), dim = daysIn(S.m), cur = isCurM(S.m), dn = cur ? new Date().getDate() : dim, od = Object.entries(pd).filter(([, a]) => a > L.v).map(([d, a]) => [d, a - L.v]);
    return { ...L, name: L.cat || 'Tổng chi', l, pd, used, dim, cur, dn, avg: used / Math.max(1, dn), od, odx: od.reduce((s, x) => s + x[1], 0), fc: cur ? used / Math.max(1, dn) * dim : used,
        over: L.per === 'Ngày' ? od.length > 0 : used > L.v };
}
function dayBars(pd, lim, dim) {
    const W = 480, H = 150, T = 12, B = 22, mx = Math.max(lim * 1.15, ...Object.values(pd), 1), bw = W / dim, y = v => T + (1 - v / mx) * (H - T - B);
    const bd = {};
    Object.keys(pd).forEach(x => bd[+x.slice(8)] = pd[x]);
    let r = '';
    for (let d = 1; d <= dim; d++) {
        const k = bd[d] || 0, yy = y(k);
        r += `<rect x="${((d - 1) * bw + 1.5).toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(1, bw - 3).toFixed(1)}" height="${Math.max(0, H - B - yy).toFixed(1)}" rx="2" fill="${k > lim ? 'var(--chi)' : 'var(--acc)'}" opacity="${k ? 1 : 0}"/>`;
        if (d === 1 || (d % 5 === 0 && dim - d >= 3) || d === dim)
            r += `<text x="${((d - .5) * bw).toFixed(1)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="var(--mut)">${d}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Chi mỗi ngày so với hạn mức"><line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="var(--line)"/>${r}<line x1="0" x2="${W}" y1="${y(lim).toFixed(1)}" y2="${y(lim).toFixed(1)}" stroke="var(--dc)" stroke-width="1.6" stroke-dasharray="5 4"/><text x="${W - 2}" y="${(y(lim) - 4).toFixed(1)}" font-size="10" text-anchor="end" fill="var(--dc)">Hạn mức</text></svg>`;
}
function limView() {
    const head0 = head('Giao dịch', 'Theo hạn mức chi · ' + mlabel(S.m), `<button class="btn p" data-a="lim">Thiết lập hạn mức</button>`) + txSwitch();
    const LS = S.lim.filter(l => l.v > 0).map(limStat).sort((a, b) => (a.per === b.per ? 0 : a.per === 'Ngày' ? -1 : 1) || (a.cat ? 1 : 0) - (b.cat ? 1 : 0) || a.name.localeCompare(b.name, 'vi'));
    if (!LS.length)
        return head0 + noData('Chưa đặt hạn mức', 'Đặt hạn mức theo ngày hoặc theo tháng để xem giao dịch tính vào từng hạn mức.', '<button class="btn p w" data-a="lim">Thiết lập hạn mức</button>');
    const K = x => x.per + '|' + x.cat, key = keyOr(LS.map(K), S.sl, K(LS.find(x => x.over) || LS[0])), x = LS.find(z => K(z) === key), isD = x.per === 'Ngày';
    let last = '', list = '';
    LS.forEach(z => {
        if (z.per !== last) {
            last = z.per;
            list += `<div class="mh">Hạn mức theo ${z.per === 'Ngày' ? 'ngày' : 'tháng'}</div>`;
        }
        const r = z.per === 'Ngày' ? z.avg / z.v : z.used / z.v, c = z.over ? 'var(--chi)' : r > .8 ? 'var(--dc)' : 'var(--thu)';
        list += mdi(K(z) === key, 'sl', K(z), `<span class="dot">${z.cat ? emo(z.cat) : '∑'}</span>`, esc(z.name) + ` <em class="pb">${z.per === 'Ngày' ? 'ngày' : 'tháng'}</em>`, z.per === 'Ngày' ? (z.od.length ? `<span class="chi">${z.od.length} ngày vượt</span>` : 'Không ngày nào vượt') : (z.over ? `<span class="chi">vượt ${vnd(z.used - z.v)}</span>` : 'còn ' + vnd(z.v - z.used)), z.per === 'Ngày' ? `${short(z.v)}/ngày` : `${short(z.used)} / ${short(z.v)}`, r, c, false);
    });
    let T = x.l.slice().sort(byTime), D = {}, cum = {}, ch = '', hd;
    x.l.forEach(t => D[t.date] = (D[t.date] || 0) + t.amount);
    if (isD) {
        if (S.lo)
            T = T.filter(t => D[t.date] > x.v);
        hd = d => { const o = D[d] > x.v; return dayHd(d, 'chi ' + num(D[d]) + ' / ' + num(x.v) + (o ? ' · <b class="chi">vượt ' + num(D[d] - x.v) + '</b>' : ''), o ? 'over' : ''); };
        ch = `<div class="card"><div class="ch">Chi mỗi ngày <small><span class="chi">■</span> vượt &nbsp;<span style="color:var(--acc)">■</span> trong hạn mức</small></div>${dayBars(x.pd, x.v, x.dim)}</div>`;
    }
    else {
        let c = 0;
        Object.keys(D).sort().forEach(d => { c += D[d]; cum[d] = c; });
        hd = d => dayHd(d, 'chi ' + num(D[d]) + ' · lũy kế <b class="' + (cum[d] > x.v ? 'chi' : '') + '">' + num(cum[d]) + '</b>', cum[d] > x.v ? 'over' : '');
        const cv = [];
        let cc = 0;
        for (let d = 1; d <= x.dn; d++) {
            cc += D[S.m + '-' + String(d).padStart(2, '0')] || 0;
            cv.push(cc);
        }
        ch = `<div class="card"><div class="ch">Chi lũy kế trong tháng <small><span style="color:var(--dc)">■</span> hạn mức &nbsp;<span class="chi">■</span> đã chi</small></div>${lineChart([{ v: Array(x.dim).fill(x.v), c: 'var(--dc)', dash: true }, { v: cv, c: x.over ? 'var(--chi)' : 'var(--acc)', area: true }], x.dim, { zero: true, label: 'Chi lũy kế so với hạn mức tháng' })}</div>`;
    }
    const today = x.cur ? (x.pd[todayS()] || 0) : null;
    const kp = isD
        ? [kpi('Hạn mức mỗi ngày', vnd(x.v), '', x.cat ? 'Hạng mục ' + esc(x.cat) : 'Tổng chi'), x.cur ? kpi('Chi hôm nay', vnd(today), today > x.v ? 'chi' : '', today > x.v ? 'Đã vượt ' + vnd(today - x.v) : 'Còn ' + vnd(x.v - today)) : kpi('Chi TB mỗi ngày', vnd(x.avg), '', 'Cả tháng'), kpi('Số ngày vượt', x.od.length + ' ngày', x.od.length ? 'chi' : 'thu', 'Trên ' + x.dn + ' ngày'), kpi('Tổng số tiền vượt', vnd(x.odx), x.odx ? 'chi' : '', 'Cộng dồn các ngày')]
        : [kpi('Hạn mức tháng', vnd(x.v), '', x.cat ? 'Hạng mục ' + esc(x.cat) : 'Tổng chi'), kpi('Đã chi', vnd(x.used), x.over ? 'chi' : '', Math.round(x.used / x.v * 100) + '% hạn mức'), kpi(x.over ? 'Đã vượt' : 'Còn lại', vnd(Math.abs(x.v - x.used)), x.over ? 'chi' : 'thu', x.over ? 'Vượt hạn mức' : 'Trong hạn mức'), x.cur ? kpi('Dự báo cuối tháng', vnd(x.fc), x.fc > x.v ? 'chi' : '', x.fc > x.v ? 'Có thể vượt ' + vnd(x.fc - x.v) : 'Vẫn trong hạn mức') : kpi('TB mỗi ngày', vnd(x.avg), '', 'Cả tháng')];
    const pct0 = x.v ? x.used / x.v : 0, stat = x.over ? `<span class="pill bad">${isD ? x.od.length + ' ngày vượt' : 'Đã vượt'}</span>` : pct0 > .8 && !isD ? '<span class="pill warn">Sắp chạm hạn mức</span>' : '<span class="pill ok">Trong hạn mức</span>';
    const det = dhead(`<span class="dot lg">${x.cat ? emo(x.cat) : '∑'}</span>`, esc(x.name), 'Hạn mức theo ' + (isD ? 'ngày' : 'tháng') + ' · ' + mlabel(S.m), `<div class="dbal">${stat}</div>`)
        + sKpis(kp) + ch
        + `<div class="tb"><span class="mut" style="font-size:13px">${T.length} giao dịch tính vào hạn mức này</span>${isD ? `<button class="chip ${S.lo ? 'on' : ''}" data-pk="lo" data-pv="1">Chỉ ngày vượt hạn mức</button>` : ''}</div>`
        + `<div class="card flush">${T.length ? dayList(T, hd) : empty(S.lo ? 'Không có ngày nào vượt' : 'Không có giao dịch', S.lo ? 'Tháng này chưa ngày nào chi quá hạn mức.' : 'Chưa có khoản chi nào tính vào hạn mức này.')}</div>`;
    return head0 + mdWrap(list, det);
}
function mdFix() {
    const el = $('.mdl .mi.on'), p = el && el.parentElement;
    if (!p)
        return;
    if (p.scrollWidth > p.clientWidth + 2)
        p.scrollLeft = el.offsetLeft - (p.clientWidth - el.offsetWidth) / 2;
    else if (p.scrollHeight > p.clientHeight + 2)
        p.scrollTop = el.offsetTop - (p.clientHeight - el.offsetHeight) / 2;
}
document.addEventListener('click', e => {
    if (e.target.closest('#ov'))
        return;
    const g = e.target.closest('[data-vgo]');
    if (g) {
        const v = g.dataset.pv;
        if (g.dataset.vgo === 'acc')
            Object.assign(S, { xa: v, xc: '', rg: 'a', fo: true, f: 'all', q: '' });
        else
            Object.assign(S, { xc: v, xa: '', rg: 'a', fo: true, f: S.ct, q: '' });
        return go('tx');
    }
    const b = e.target.closest('[data-pk]');
    if (!b)
        return;
    const k = b.dataset.pk, v = b.dataset.pv, sl = $('.mdl'), st = sl ? [sl.scrollLeft, sl.scrollTop] : null;
    if (k === 'sc') {
        S.sc = v;
        S.ss = '';
    }
    else if (k === 'ct') {
        S.ct = v;
        S.sc = '';
        S.ss = '';
    }
    else if (k === 'lo')
        S.lo = !S.lo;
    else if (k === 'ss')
        S.ss = S.ss === v ? '' : v;
    else
        S[k] = v;
    render();
    const n = $('.mdl');
    if (n && st) {
        n.scrollLeft = st[0];
        n.scrollTop = st[1];
    }
});
