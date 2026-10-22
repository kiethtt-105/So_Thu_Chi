/* ===== core.js ===== */
const { PASS, API, NAME } = window.CONFIG || {}, POLL_MS = 10000, TTL = 7 * 24 * 3600e3;
const alive = () => { let t = 0; try { t = +sessionStorage.sess || 0; } catch (e) { } return t && Date.now() - t < TTL; }, touch = (() => { let last = 0; return () => { const n = Date.now(); if (n - last < 30000) return; last = n; try { sessionStorage.sess = n; } catch (e) { } }; })();
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NF = new Intl.NumberFormat('vi-VN'), num = n => NF.format(n), vnd = n => num(Math.round(n)) + ' ₫';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const newId = i => 'G' + Date.now().toString(36) + (i || 0) + Math.floor(Math.random() * 1296).toString(36);
const PM_U = { k: 1e3, nghìn: 1e3, ngàn: 1e3, tr: 1e6, triệu: 1e6, m: 1e6, tỷ: 1e9, ty: 1e9, b: 1e9 };
const pm = v => {
    const raw = String(v || '').trim().toLowerCase(), neg = raw.startsWith('-'), s = raw.replace(/^-/, '').replace(/[₫đ\s]/g, '');
    const m = s.match(/^(\d+)(?:[.,](\d{1,3}))?(k|nghìn|ngàn|tr|triệu|m|tỷ|ty|b)(\d{1,3})?$/);
    const n = m ? Math.round(parseFloat(m[1] + '.' + (m[2] || m[4] || '0')) * PM_U[m[3]]) : Number(s.replace(/[^\d]/g, ''));
    return n ? (neg ? -n : n) : 0;
};
// Ô tiền hiểu cả dạng rút gọn (50k, 1.5tr) lẫn phép tính (45k*3+20k, 3tr-150k)
const amtVal = v => (CALC_RE.test(String(v)) ? calcEval(v) : pm(v));
const isShort = v => /[^\d\s.,\-₫đ]/i.test(v) || CALC_RE.test(v);
function amtHint(el) {
    if (!isShort(el.value)) return calcShow(el, '');
    const r = amtVal(el.value);
    calcShow(el, r == null ? 'Phép tính chưa hợp lệ…' : '= ' + calcFmt(r));
}
document.addEventListener('focusout', e => {
    const t = e.target;
    if (!t.classList || !t.classList.contains('money') || !isShort(t.value)) return;
    const n = amtVal(t.value);
    calcShow(t, '');
    if (n == null) { toast('Phép tính chưa hợp lệ'); return; }
    t.value = n ? (n < 0 ? '-' : '') + num(Math.abs(n)) : '';
    t.dispatchEvent(new Event('input', { bubbles: true }));
});
const fm = el => {
    amtHint(el);
    if (isShort(el.value)) return;   // đang gõ dạng rút gọn / phép tính → giữ nguyên, đổi thành số khi rời ô
    const s = el.value.trim(), ng = el.dataset.neg && s.startsWith('-'), d = s.replace(/[^\d]/g, '');
    const cur = document.activeElement === el, left = cur ? el.value.slice(0, el.selectionStart).replace(/\D/g, '').length : 0;
    el.value = (ng ? '-' : '') + (d ? num(+d) : '');
    if (cur) { let p = 0, c = 0; while (p < el.value.length && c < left) { if (/\d/.test(el.value[p])) c++; p++; } try { el.setSelectionRange(p, p); } catch (e) { } }
};
const TYPES = ['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'], CLS = { Thu: 'thu', Chi: 'chi', 'Chuyển khoản': 'chuyen', 'Điều chỉnh': 'dc' };
const HELD = 'Giữ Hộ';
const ACC_TYPES = ['Tiền mặt', 'Ngân hàng', 'Thẻ tín dụng', 'Ví điện tử', 'Tiết kiệm', HELD];
const IC = { home: 'M3 11l9-8 9 8M5 10v10h14V10', tx: 'M4 6h16M4 12h16M4 18h10', rec: 'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', lim: 'M4 18a8 8 0 1 1 16 0M12 18l4-6', acc: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18', cat: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', tr: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', more: 'M5 12h.01M12 12h.01M19 12h.01', dl: 'M12 4v11M7 11l5 5 5-5M5 20h14', pl: 'M12 5v14M5 12h14', fl: 'M4 5h16l-6 8v6l-4-2v-4z', rp: 'M5 20V11M12 20V4M19 20v-6', goal: 'M5 21V4M5 4h11l-2 4 2 4H5' };
const ic = k => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[k]}"/></svg>`;
IC.ba = 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3';
IC.bc = 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01';
IC.bl = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01';
const TABS = [['home', 'Tổng quan', 'Sổ sách'], ['rp', 'Báo cáo'], ['tx', 'Tất cả', 'Giao dịch'], ['ba', 'Theo tài khoản'], ['bc', 'Theo danh mục'], ['bl', 'Theo hạn mức'], ['rec', 'Cân đối', 'Quản lý'], ['lim', 'Hạn mức'], ['goal', 'Mục tiêu'], ['acc', 'Tài khoản'], ['cat', 'Hạng mục'], ['tr', 'Thùng rác']], MONTHLY = ['home', 'tx', 'ba', 'bc', 'bl', 'lim', 'acc', 'cat'], GRP_TX = ['tx', 'ba', 'bc', 'bl'];
const SN = { GiaoDich: 'Giao dịch', TaiKhoan: 'Tài khoản', DanhMuc: 'Hạng mục', HanMuc: 'Hạn mức', DaXoa: 'Thùng rác' };
const PAL = [1, 2, 3, 4, 5, 6, 7, 8].map(i => 'var(--c' + i + ')'), col = i => PAL[i % PAL.length];
const EMO = [[/đầu tư|lãi|lời|cổ phiếu|chứng khoán/i, '📈'], [/làm thêm|freelance|việc phụ/i, '💼'], [/cân đối|điều chỉnh/i, '⚖️'], [/^\s*khác\s*$/i, '📦'], [/ăn|uống|cơm|cafe|cà phê|nhà hàng/i, '🍜'], [/xe|xăng|đi lại|grab|taxi/i, '🛵'], [/nhà|thuê|điện|nước|internet/i, '🏠'], [/mua|sắm|quần|áo/i, '🛍️'], [/y tế|thuốc|khám|sức khỏe/i, '💊'], [/học|sách|giáo dục/i, '📚'], [/giải trí|phim|game|du lịch/i, '🎮'], [/lương|thưởng|thu/i, '💰'], [/quà|từ thiện|cho/i, '🎁'], [/tiết kiệm/i, '🐷']];
const _emo = new Map();
const emo = k => { k = k || ''; let v = _emo.get(k); if (v === undefined) { v = (EMO.find(e => e[0].test(k)) || [0, '🧾'])[1]; _emo.set(k, v); } return v; };
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
const S = { tx: [], acc: [], cat: [], lim: [], trash: [], issues: [], rev: '', m: ymd(new Date()).slice(0, 7), tab: location.hash.slice(1) || 'home', f: 'all', q: '', rg: 'm', so: 'dn', xa: '', xc: '', mn: '', mx: '', d1: '', d2: '', fo: false, act: {}, ready: false, busy: 0, err: '', pg: 100 };
let E = null, ED = null;
if (!TABS.some(t => t[0] === S.tab))
    S.tab = 'home';
try {
    const c = JSON.parse(localStorage.cache || 'null');
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
function setTheme(v) { const h = document.documentElement; h.classList.add('tt'); clearTimeout(setTheme._t); setTheme._t = setTimeout(() => h.classList.remove('tt'), 380); try {
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
const IMG_RE = /https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view\S*/g;
const splitImg = n => { n = String(n || ''); return { text: n.replace(IMG_RE, '').replace(/\s+/g, ' ').trim(), imgs: n.match(IMG_RE) || [] }; };
const noteTxt = n => splitImg(n).text, hasImg = n => splitImg(n).imgs.length > 0;
const joinImg = (t, a) => [String(t || '').trim(), ...(a || [])].filter(Boolean).join(' ');

/* ===== sync.js ===== */
async function call(ops, rev, ms, fast) {
    if (!API)
        throw Error('Thiếu địa chỉ API: file config.js chưa được tải');
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms || 30000);
    let r;
    try {
        r = await fetch(API, { method: 'POST', signal: ac.signal, body: JSON.stringify({ ops: ops || [], rev: rev || '', key: (window.CONFIG || {}).KEY || '', fast: !!fast }) });
    }
    catch (e) {
        const x = Error(e && e.name === 'AbortError' ? 'Máy chủ Google phản hồi quá chậm, chưa nhận được kết quả' : navigator.onLine === false ? 'Không có kết nối mạng' : 'Không kết nối được tới máy chủ Google');
        x.net = true;
        throw x;
    }
    finally {
        clearTimeout(tm);
    }
    let j;
    try {
        j = await r.json();
    }
    catch (e) {
        const x = Error('Lỗi máy chủ. Kiểm tra lại cấu hình kết nối');
        x.net = true;
        throw x;
    }
    if (!j.ok) {
        if (/Thao tác không hợp lệ/i.test(j.err || ''))
            throw Error('Sai phiên làm việc. Vui lòng tải lại trang');
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
        localStorage.cache = JSON.stringify({ tx: S.tx, acc: S.acc, cat: S.cat, lim: S.lim, trash: S.trash, issues: S.issues });
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
    if (manual || !S.synced) pgSet(!S.synced ? 'Đang tải dữ liệu…' : 'Đang cập nhật…', null, OB.n);
    if (manual)
        spin(1);
    try {
        const first = !S.synced, j = await call([], manual ? '' : S.rev);
        if (S.busy) {
            inflight = false; if (!OB.n) pgHide(0);
            if (manual)
                spin(0);
            return;
        }
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
    inflight = false; if (!OB.n) pgHide(0);
    if (manual)
        spin(0);
}
let chain = Promise.resolve();
const SAFE_OPS = new Set(['tx.save', 'tx.del', 'tx.purge', 'lim.set']);
const FAST_OPS = new Set(['tx.save', 'tx.del', 'tx.purge']);   // đã cập nhật tạm trên màn hình → máy chủ khỏi gửi lại cả sổ, web tự tải lại sau   // ghi lại nhiều lần vẫn ra cùng kết quả (ID cố định)
const liveMsg = (s, t) => { const e = $('#live'); if (!e) return; e.dataset.s = s; e.className = 'live ' + s; e.lastChild.textContent = t; const st = $('#st'); if (st) st.textContent = t; };
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
function lock() { sessionStorage.clear(); localStorage.removeItem('sess'); localStorage.removeItem('cache'); $('#app').classList.add('hide'); $('#login').classList.remove('hide'); $('#pw').value = ''; closeSheet(); }
$('#lf').onsubmit = ev => { ev.preventDefault(); if ($('#pw').value === PASS) {
    touch();
    boot();
}
else {
    $('#lerr').textContent = 'Sai mật khẩu !!';
    $('#lf').classList.remove('shake');
    void $('#lf').offsetWidth;
    $('#lf').classList.add('shake');
    $('#pw').select();
} };
$('#pw').addEventListener('input', () => { const p = String(PASS || ''), f = $('#lf'); if (p && $('#pw').value.length === p.length) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); });
function setUser() {
    const n = String(NAME || '').trim(), ini = Array.from(n)[0] || '';
    $$('.usr').forEach(e => e.classList.toggle('hide', !n));
    $$('[data-usn]').forEach(e => { e.textContent = n; });
    $$('[data-usi]').forEach(e => { e.textContent = ini.toUpperCase(); });
    const g = $('#lgreet');
    if (g) g.textContent = n ? 'Xin chào ' + n + ', nhập mật khẩu để mở sổ' : 'Nhập mật khẩu để mở sổ';
}
setUser();
function boot() { setUser(); $('#login').classList.add('hide'); $('#app').classList.remove('hide'); render(); resumeOutbox(); sync(true); if (typeof pushInit === 'function')
    pushInit(); }
let ACT_T = Date.now(), PT = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden)
    return; if (!alive())
    return lock(); sync(false); });
setInterval(() => { if (!alive()) {
    if (!$('#app').classList.contains('hide'))
        lock();
    return;
} if (Date.now() - ACT_T > 120000 && ++PT % 6) return; sync(false); }, POLL_MS);
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty && !typing()) {
    S.dirty = false;
    render();
} }, 60));
addEventListener('offline', () => setLive('err'));
addEventListener('online', () => { fails = 0; sync(false); });
['click', 'keydown', 'touchstart'].forEach(t => document.addEventListener(t, () => { ACT_T = Date.now(); if (alive())
    touch(); }, { passive: true }));

/* ===== data.js ===== */
const mOf = t => t.date.slice(0, 7), inM = (t, m) => mOf(t) === m;
let _own = null;
const heldSet = () => new Set(S.acc.filter(a => a.type === HELD).map(a => a.name));
const stx = () => { if (_own && _own.t === S.tx && _own.a === S.acc && _own.n === S.tx.length)
    return _own.l; const h = heldSet(), l = h.size ? S.tx.filter(t => !h.has(t.acc) && !(t.accTo && h.has(t.accTo))) : S.tx; _own = { t: S.tx, a: S.acc, n: S.tx.length, l }; return l; };
const ownAcc = () => S.acc.filter(a => a.type !== HELD);
let _ag = null;
function monthAgg() {
    const tx = stx();
    if (_ag && _ag.k === tx && _ag.n === tx.length)
        return _ag.m;
    const m = {};
    tx.forEach(t => { const o = m[mOf(t)] || (m[mOf(t)] = { thu: 0, chi: 0 }); if (t.type === 'Thu')
        o.thu += t.amount; else if (t.type === 'Chi')
        o.chi += t.amount; });
    _ag = { k: tx, n: tx.length, m };
    return m;
}
const sums = m => { const o = monthAgg()[m]; return o ? { thu: o.thu, chi: o.chi } : { thu: 0, chi: 0 }; };
const bal = a => { balMap(); const v = _bk.B[a.name]; return v === undefined ? (+a.open || 0) : v; };
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
    if (_bk && _bk.t === S.tx && _bk.a === S.acc && _bk.n === S.tx.length && _bk.d === ymd(new Date()))
        return _bk.m;
    const B = {};
    S.acc.forEach(a => B[a.name] = +a.open || 0);
    const N = Object.assign({}, B), today = ymd(new Date());   // N = số dư hiện tại (chỉ tính giao dịch có ngày <= hôm nay, khớp công thức TaiKhoan trong Gsheet)
    const tm = t => (t.at || '').slice(11) || '23:59:59', m = {};
    S.tx.map((t, i) => [t, i]).sort((x, y) => x[0].date.localeCompare(y[0].date) || tm(x[0]).localeCompare(tm(y[0])) || x[1] - y[1]).forEach(([t]) => {
        const x = t.amount;
        B[t.acc] = (B[t.acc] || 0) + (t.type === 'Thu' || t.type === 'Điều chỉnh' ? x : -x);
        if (t.type === 'Chuyển khoản' && t.accTo)
            B[t.accTo] = (B[t.accTo] || 0) + x;
        if (t.date <= today) {
            N[t.acc] = (N[t.acc] || 0) + (t.type === 'Thu' || t.type === 'Điều chỉnh' ? x : -x);
            if (t.type === 'Chuyển khoản' && t.accTo)
                N[t.accTo] = (N[t.accTo] || 0) + x;
        }
        m[t.id] = B[t.acc];
    });
    _bk = { t: S.tx, a: S.acc, n: S.tx.length, d: today, m, B: N };
    return m;
}
function txRow(t, v) {
    const bm = balMap(), xs = typeof v === 'string' && t.type === 'Chuyển khoản', sg = xs ? (t.acc === v ? '−' : '+') : (t.type === 'Chi' ? '−' : t.type === 'Thu' ? '+' : ''), hb = xs && t.acc !== v;
    const c = CLS[t.type], ttl = t.type === 'Chuyển khoản' ? `${esc(t.acc)} → ${esc(t.accTo)}` : esc(t.sub || t.cat || (t.type === 'Chi' || t.type === 'Thu' ? 'Chưa phân loại' : t.type)), ico = t.type === 'Chuyển khoản' ? '⇄' : t.type === 'Điều chỉnh' ? '±' : emo(t.sub || t.cat);
    return `<button class="row" data-edit="${esc(t.id)}"><span class="dot ${c}">${ico}</span><span class="m"><b>${ttl}</b><small>${esc(noteTxt(t.note) || t.cat || '') + (hasImg(t.note) ? ' 📎' : '')}${t.type === 'Chuyển khoản' ? '' : (noteTxt(t.note) || t.cat || hasImg(t.note) ? ' · ' : '') + esc(t.acc)}</small></span><span class="am"><b class="sens ${c}">${sg}${num(t.amount)}</b>${bm[t.id] !== undefined && !hb ? `<small class="sens mut" title="Số dư của ${esc(t.acc)} sau giao dịch này">Dư ${num(bm[t.id])}</small>` : ''}</span></button>`;
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

/* ===== screens.js ===== */
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
    const dnum = S.m === ymd(new Date()).slice(0, 7) ? new Date().getDate() : dim, big = chiM(S.m).sort((a, b) => b.amount - a.amount)[0], LC = limCalc(), rec = M.slice().sort(byTime).slice(0, 6);
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
    const hs = heldSet(), isOwn = t => !hs.has(t.acc) && !(t.accTo && hs.has(t.accTo)), lo = hs.size ? l.filter(isOwn) : l, nHeld = l.length - lo.length;
    const thu = lo.filter(t => t.type === 'Thu').reduce((a, t) => a + t.amount, 0), chi = lo.filter(t => t.type === 'Chi').reduce((a, t) => a + t.amount, 0), dt = {};
    stx().forEach(t => { if (t.type === 'Chi')
        dt[t.date] = (dt[t.date] || 0) + t.amount; });
    const ld = limOf('Ngày', '');
    let h = '', last = '';
    l.slice(0, S.pg).forEach(t => { if (ds && t.date !== last) {
        last = t.date;
        const dd = new Date(t.date + 'T00:00'), ov = ld && dt[t.date] > ld;
        h += `<div class="dh ${ov ? 'over' : ''}"><span>${dd.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span><span class="sens">${S.f === 'Thu' ? (dsum[t.date] ? 'thu ' + num(dsum[t.date]) : '') : S.f === 'Chi' || S.f === 'all' ? (dt[t.date] ? 'chi ' + num(dt[t.date]) + (ov ? ' ⚠️ vượt hạn mức ngày' : '') : '') : ''}</span></div>`;
    } h += txRow(t); });
    if (l.length > S.pg)
        h += `<button class="btn w" data-a="moretx" style="margin:10px 0">Xem thêm (còn ${l.length - S.pg} giao dịch)</button>`;
    const op = (a, v, ph) => `<option value="">${ph}</option>` + a.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join(''), pars = [...new Set(S.cat.map(c => c.p))];
    const dfm = d => d ? d.split('-').reverse().join('/') : '…', SO = { dn: 'Mới nhất trước', do: 'Cũ nhất trước', ah: 'Số tiền: cao → thấp', al: 'Số tiền: thấp → cao' };
    const act = [];
    if (S.f !== 'all') act.push(['f', S.f]);
    if (S.rg === 'a') act.push(['rg', 'Toàn bộ thời gian']);
    if (S.rg === 'c') act.push(['rg', dfm(S.d1) + ' → ' + dfm(S.d2)]);
    if (S.xa) act.push(['xa', S.xa]);
    if (S.xc) act.push(['xc', emo(S.xc) + ' ' + S.xc]);
    if (S.mn !== '') act.push(['mn', 'Từ ' + num(+S.mn) + ' ₫']);
    if (S.mx !== '') act.push(['mx', 'Đến ' + num(+S.mx) + ' ₫']);
    if (S.so !== 'dn') act.push(['so', SO[S.so]]);
    const n = act.filter(a => a[0] !== 'f').length;
    const fset = (k, v, lb) => `<button type="button" class="chip ${S[k] === v ? 'on' : ''}" data-fset="${k}:${v}">${lb}</button>`;
    return head('Giao dịch', S.rg === 'm' ? mlabel(S.m) : S.rg === 'a' ? 'Toàn bộ thời gian' : 'Khoảng ngày tùy chọn', `<button class="btn" data-a="csv">${ic('dl')}CSV</button>`) + txSwitch() +
        `<div class="tb2"><div class="srch"><input class="search" id="q" type="search" placeholder="Tìm ghi chú, hạng mục, số tiền" value="${esc(S.q)}" aria-label="Tìm giao dịch"><button type="button" class="chip fbtn ${S.fo || n ? 'on' : ''}" data-a="fo" aria-expanded="${!!S.fo}">${ic('fl')}Bộ lọc${n ? ' · ' + n : ''}</button></div>
<div class="chips ty">${['all', ...TYPES].map(t => `<button class="chip ${S.f === t ? 'on' : ''}" data-f="${t}">${t === 'all' ? 'Tất cả' : t}</button>`).join('')}</div>
${act.length ? `<div class="chips afl">${act.map(([k, lb]) => `<button type="button" class="chip on fx" data-clr="${k}" aria-label="Bỏ lọc ${esc(lb)}">${esc(lb)}<i>×</i></button>`).join('')}<button type="button" class="chip" data-a="rs">Xóa hết</button></div>` : ''}</div>
${S.fo ? `<div class="card fpn">
<div class="fg"><div class="fgl">Thời gian</div><div class="chips fw">${fset('rg', 'm', 'Tháng đang xem')}${fset('rg', 'a', 'Toàn bộ')}${fset('rg', 'c', 'Tùy chọn')}</div>${S.rg === 'c' ? `<div class="fp2"><label class="l">Từ ngày<input type="date" id="x_d1" value="${S.d1}"></label><label class="l">Đến ngày<input type="date" id="x_d2" value="${S.d2}"></label></div>` : ''}</div>
<div class="fg"><div class="fgl">Tài khoản · Hạng mục</div><div class="fp2"><select id="x_acc" aria-label="Tài khoản">${op(S.acc.map(a => a.name), S.xa, 'Mọi tài khoản')}</select><select id="x_cat" aria-label="Hạng mục">${op(pars, S.xc, 'Mọi hạng mục')}</select></div></div>
<div class="fg"><div class="fgl">Số tiền (₫)</div><div class="fp2"><input type="number" id="x_mn" inputmode="numeric" placeholder="Từ" value="${S.mn}" aria-label="Số tiền từ"><input type="number" id="x_mx" inputmode="numeric" placeholder="Đến" value="${S.mx}" aria-label="Số tiền đến"></div></div>
<div class="fg"><div class="fgl">Sắp xếp</div><div class="chips fw">${Object.entries(SO).map(([k, v]) => fset('so', k, v)).join('')}</div></div>
<div class="fb"><button type="button" class="btn" data-a="rs">Xóa bộ lọc</button><button type="button" class="btn p" data-a="fo">Xong</button></div></div>` : ''}
<div class="sum"><span>${l.length} giao dịch</span><span class="thu sens">Thu ${vnd(thu)}</span><span class="chi sens">Chi ${vnd(chi)}</span><span class="sens">Ròng ${vnd(thu - chi)}</span>${nHeld ? `<span class="mut" title="Tài khoản Giữ Hộ không tính vào thu, chi, ròng">không tính ${nHeld} giao dịch Giữ Hộ</span>` : ''}</div>
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
    // Không tự bịa chuyển khoản giữa các tài khoản: mỗi tài khoản lệch chỉ ghi đúng 1 dòng điều chỉnh bằng đúng số lệch.
    return { T: [], A: L.map(x => ({ n: x.a.name, d: x.diff })).filter(x => x.d !== 0) };
}
function recon() {
    const D = diffs();
    return head('Cân đối','') +
        `<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div class="card kpi h kfull"><small>Tổng chênh lệch</small><b class="sens" id="r_t">–</b><em id="r_n"></em></div><div class="card kpi"><small>Hệ thống</small><b class="sens" id="r_s">–</b></div><div class="card kpi"><small>Thực tế</small><b class="sens" id="r_a">–</b></div></div>
<div class="grid c"><div class="card"><div class="ch">Nhập số dư thực tế <small>gõ được phép tính: 500k+200k*2, 3tr-150k</small></div>${D.map((x, i) => `<div class="rr"><span style="display:flex;align-items:center;gap:10px">${aIco(x.a)}<span style="min-width:0"><b style="font-weight:500">${esc(x.a.name)}</b><small class="sens">Hệ thống: ${vnd(x.sys)}</small></span></span>${x.a.type === 'Tiền mặt' ? `<button type="button" class="ib cnt" data-cash="${i}" aria-label="Đếm tiền mặt" title="Đếm số tờ">${ic('cnt')}</button>` : ''}<input class="ba money" data-neg="1" data-i="${i}" inputmode="text" placeholder="${num(x.sys)}" value="${x.has ? num(x.act) : ''}" aria-label="Số dư thực tế ${esc(x.a.name)}"><span class="df" id="df${i}"></span></div>`).join('') || empty('Chưa có tài khoản')}</div>
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
    $('#rbtn').innerHTML = (bad.length ? `<button class="btn p w" data-bdo="bal" style="margin-top:0">Cân đối ${PL.T.length ? PL.T.length + ' chuyển khoản' : ''}${PL.T.length && PL.A.length ? ' + ' : ''}${PL.A.length ? PL.A.length + ' điều chỉnh' : ''}</button><p class="note">Mỗi tài khoản lệch được ghi <b>1 dòng “Điều chỉnh”</b> đúng số lệch, không tự chuyển khoản giữa các tài khoản${PL.A.length ? ':<br>' + PL.A.map(x => '• ' + esc(x.n) + ': <b>' + sgn(x.d) + '</b>').join('<br>') : ''}</p><button class="btn w" data-bdo="adj">Chỉ ghi điều chỉnh (không chuyển khoản)</button>` : has.length ? empty('Đã khớp', 'Số dư thực tế trùng với hệ thống.') : '<p class="mut" style="margin-bottom:6px"> </p>') + `<button class="btn w" data-bdo="form">Chuyển tiền giữa các tài khoản</button>`;
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
const hidSet = () => { try { return new Set(JSON.parse(localStorage.hidtabs || '[]')); } catch (e) { return new Set(); } };
const tabOn = k => k === 'home' || !hidSet().has(k);
function nav() {
    const tb = $('#tb');
    let h = '', pend = '';
    TABS.forEach(([k, l, gr]) => {
        if (gr) pend = gr;                         // nhãn nhóm chuyển sang mục hiện đầu tiên của nhóm; nhóm ẩn hết thì không hiện nhãn
        if (!tabOn(k) && S.tab !== k) return;
        if (pend) { h += '<i class="sep">' + pend + '</i>'; pend = ''; }
        h += `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}" title="${l}">${ic(k)}<span>${l}</span>${k === 'tr' && S.trash.length ? '<em class="nbd">' + S.trash.length + '</em>' : ''}</button>`;
    });
    tb.innerHTML = h + `<i class="sep"></i><button data-nt="settings" title="Cài đặt">${ic('set')}<span>Cài đặt</span></button>`;
    const n = S.issues.length;
    $('#isb').classList.toggle('hide', !n);
    $('#isn').textContent = n > 99 ? '99+' : n;
    if (typeof nbUpdate === 'function')
        nbUpdate();
}
// Cài đặt → Menu hiển thị: bật/tắt từng mục, lưu trên máy này
document.addEventListener('change', e => {
    const t = e.target;
    if (!t.dataset || t.dataset.vis === undefined) return;
    const s = hidSet();
    if (t.checked) s.delete(t.dataset.vis); else s.add(t.dataset.vis);
    try { localStorage.hidtabs = JSON.stringify([...s]); } catch (x) { }
    nav();
});
document.addEventListener('click', e => {
    if (!e.target.closest('[data-visreset]')) return;
    try { localStorage.removeItem('hidtabs'); } catch (x) { }
    nav();
    if (typeof openSettings === 'function') openSettings();
});
const VIEWS = {
    home: () => home(), tx: () => txs(), ba: () => accView(), bc: () => catView(), bl: () => limView(),
    rp: () => reportPage(), rec: () => recon(), lim: () => limPage(), goal: () => goalPage(),
    acc: () => accs(), cat: () => cats(), tr: () => trashPage()
};
function drawView() {
    try {
        return VIEWS[S.tab]();
    } catch (e) {
        console.error(e);
        return `<div class="card"><h3>Không hiển thị được màn hình này</h3><p class="chi">${esc(e.message)}</p><p class="note">Thử tải lại trang bằng Ctrl+F5. Nếu vẫn lỗi, kiểm tra đủ file trong thư mục js (có goals.js và trend.js).</p></div>`;
    }
}
function render() { nav(); $('#v').innerHTML = !S.ready ? (S.err ? errCard() : '<div class="sk"></div><div class="sk"></div><div class="sk"></div>') : drawView(); if (S.ready && S.tab === 'rec')
    reconUpdate(); mdFix(); if (typeof fxEnter === 'function')
    fxEnter(); }
/* ===== cash.js ===== */
/* Đếm tiền mặt: nhập số tờ theo mệnh giá -> tính tổng -> điền vào ô Tiền mặt ở màn Cân đối */
(function () {
    IC.cnt = 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M15 4v16';  // biểu tượng bảng tính
    const DEN = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
    const KEY = 'stcash';
    let cur = -1;          // chỉ số tài khoản (trong S.acc) đang đếm
    let cnt = {};          // { mệnh giá: số tờ }

    const load = name => { try { return (JSON.parse(localStorage[KEY] || '{}'))[name] || {}; } catch (e) { return {}; } };
    const save = name => { try { const all = JSON.parse(localStorage[KEY] || '{}'); all[name] = cnt; localStorage[KEY] = JSON.stringify(all); } catch (e) { } };
    const total = () => DEN.reduce((s, d) => s + d * (+cnt[d] || 0), 0);
    const sheets = () => DEN.reduce((s, d) => s + (+cnt[d] || 0), 0);

    function refresh() {
        DEN.forEach(d => { const e = $('#cs' + d); if (e) e.textContent = cnt[d] ? num(d * cnt[d]) : '–'; });
        const t = $('#cs_t'), n = $('#cs_n');
        if (t) t.textContent = vnd(total());
        if (n) n.textContent = sheets() + ' tờ';
    }

    function openCash(i) {
        const a = S.acc[i];
        if (!a) return;
        cur = i;
        cnt = load(a.name);
        try { ED = null; E = null; } catch (e) { }
        $('#sh').innerHTML = `<h3>Bảng Kê Tiền Mặt <small class="mut" style="font:500 13px var(--fb,inherit)">${esc(a.name)}</small></h3>
<div class="cash" id="cash">${DEN.map(d => `<div class="cr"><b>${num(d)}</b><span class="x">×</span><input class="cin" data-d="${d}" inputmode="numeric" maxlength="5" placeholder="0" value="${cnt[d] ? cnt[d] : ''}" aria-label="Số tờ ${num(d)}"><span class="cs sens" id="cs${d}">–</span></div>`).join('')}</div>
<div class="ctot"><span>Tổng <small id="cs_n"></small></span><b class="sens" id="cs_t">0 ₫</b></div>
<button type="button" class="btn p w" data-cfill>Điền vào ô tiền mặt</button>
<button type="button" class="btn w" data-cclear>Xóa hết</button>`;
        refresh();
        openSheet();
        setTimeout(() => { const f = $('#cash .cin'); if (f) f.focus(); }, 80);
    }

    function fill() {
        const a = S.acc[cur];
        if (!a) return closeSheet();
        const t = total();
        save(a.name);
        S.act[a.name] = t;
        const el = $('.ba[data-i="' + cur + '"]');
        if (el) el.value = num(t);
        closeSheet();
        if (typeof reconUpdate === 'function') reconUpdate();
    }

    // mở sheet từ nút cạnh ô Tiền mặt
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-cash]');
        if (b && !b.closest('#ov')) { e.preventDefault(); return openCash(+b.dataset.cash); }
        if (!e.target.closest('#cash') && !e.target.closest('[data-cfill],[data-cclear]')) return;
        if (e.target.closest('[data-cfill]')) return fill();
        if (e.target.closest('[data-cclear]')) {
            cnt = {};
            $$('#cash .cin').forEach(i => { i.value = ''; });
            refresh();
            const f = $('#cash .cin'); if (f) f.focus();
        }
    });

    document.addEventListener('input', e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains('cin')) return;
        const v = t.value.replace(/[^\d]/g, '');
        if (t.value !== v) t.value = v;
        cnt[t.dataset.d] = +v || 0;
        refresh();
    });

    // Enter: nhảy sang mệnh giá kế tiếp; ở ô cuối thì điền luôn
    document.addEventListener('keydown', e => {
        const t = e.target;
        if (e.key !== 'Enter' || !t.classList || !t.classList.contains('cin')) return;
        e.preventDefault();
        const all = $$('#cash .cin'), i = all.indexOf(t);
        if (i < all.length - 1) { all[i + 1].focus(); all[i + 1].select(); } else fill();
    });
    document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('cin')) setTimeout(() => { try { e.target.select(); } catch (x) { } }, 0); });
})();

/* ===== events.js ===== */
const go = t => { S.tab = t; location.hash = t; scrollTo(0, 0); closeSheet(); render(); };
document.addEventListener('click', e => {
    if (e.target.closest('[data-a3="print"]')) { setTimeout(() => window.print(), 150); return; }
    const t = e.target.closest('[data-tab],[data-m],[data-f],[data-edit],[data-a],[data-bdo],[data-ed],[data-rs]');
    if (!t || t.closest('#ov'))
        return;
    const d = t.dataset;
    if (d.tab)
        return go(d.tab);
    if (d.m) {
        S.m = shift(S.m, +d.m);
        S.pg = 100;
        return render();
    }
    if (d.f) {
        S.f = d.f;
        S.pg = 100;
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
            Object.assign(S, { xa: '', xc: '', mn: '', mx: '', d1: '', d2: '', so: 'dn', rg: 'm', f: 'all', q: '', pg: 100 });
            return render();
        case 'sb': return sbToggle();
        case 'fx': return fxToggle();
        case 'moretx':
            S.pg += 100;
            return refreshList() || render();
        case 'csv': return csv();
        case 'lim': return openLim();
        case 'menu': return document.documentElement.classList.toggle('sdo');
        case 'keys': return openKeys();
        case 'issues': return openIssues();
    }
});
document.addEventListener('click', e => {
    const c = e.target.closest('[data-clr],[data-fset]');
    if (!c || c.closest('#ov')) return;
    if (c.dataset.clr) {
        const k = c.dataset.clr;
        if (k === 'f') S.f = 'all';
        else if (k === 'rg') { S.rg = 'm'; S.d1 = ''; S.d2 = ''; }
        else if (k === 'so') S.so = 'dn';
        else S[k] = '';
    }
    else {
        const [k, v] = c.dataset.fset.split(':');
        S[k] = v;
        if (k === 'rg' && v !== 'c') { S.d1 = ''; S.d2 = ''; }
    }
    S.pg = 100;
    render();
});
let qT = 0, qComp = false;
function refreshList() {
    if (S.tab !== 'tx' || !S.ready) return false;
    const tmp = document.createElement('div');
    try { tmp.innerHTML = txs(); } catch (e) { return false; }
    let n = 0;
    ['.sum', '.card.flush'].forEach(sel => { const a = $('#v ' + sel), b = tmp.querySelector(sel); if (a && b) { a.replaceWith(b); n++; } });
    if (n < 2) return false;
    if (typeof mdFix === 'function') mdFix();
    return true;
}
function qApply() {
    const t = $('#q');
    if (!t)
        return;
    S.q = t.value;
    S.pg = 100;
    if (refreshList()) return;
    const p = t.selectionStart;
    render();
    const q = $('#q');
    if (q) {
        q.focus();
        q.setSelectionRange(p, p);
    }
}
document.addEventListener('compositionstart', e => { if (e.target.id === 'q')
    qComp = true; });
document.addEventListener('compositionend', e => { if (e.target.id === 'q') {
    qComp = false;
    clearTimeout(qT);
    qApply();
} });
document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') {
        S.q = t.value;
        if (qComp || e.isComposing)
            return;
        clearTimeout(qT);
        qT = setTimeout(qApply, 180);
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
    S.pg = 100;
    render();
} });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        return tryClose();
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '') || !$('#login').classList.contains('hide'))
        return;
    if (e.key === '[') {
        e.preventDefault();
        return sbToggle();
    }
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openForm();
    }
    if (e.key === '/') {
        e.preventDefault();
        go('tx');
        setTimeout(() => { const q = $('#q'); q && q.focus(); }, 0);
    }
    if (e.key === '?') {
        e.preventDefault();
        openKeys();
    }
    if (e.key === 'd' || e.key === 'D') toggleTheme();
});
const KEYS = [
    ['Mọi lúc', [['N', 'Thêm giao dịch'], ['/', 'Tìm giao dịch'], ['Ctrl + Z', 'Hoàn tác thao tác vừa rồi (trong 15 giây)'], ['[', 'Thu gọn / mở rộng thanh bên'], ['D', 'Đổi sáng / tối'], ['?', 'Mở bảng phím tắt này'], ['Esc', 'Đóng cửa sổ']]],
    ['Khi nhập giao dịch', [['Ctrl + Enter', 'Lưu giao dịch'], ['Enter', 'Sang ô kế tiếp, ở ô cuối thì lưu'], ['Alt + 1…4', 'Chọn loại: Chi, Thu, Chuyển, Điều chỉnh'], ['45k*3+20k', 'Ô số tiền tự tính phép tính (+ − × ÷ và ngoặc)']]]
];
function openKeys() {
    ED = null; E = null;
    const k = t => t.split(/\s\+\s/).map(x => `<kbd>${esc(x)}</kbd>`).join('<span class="kp">+</span>');
    $('#sh').innerHTML = `<h3>Phím tắt</h3>` + KEYS.map(([g, L]) => `<div class="kg"><h4>${g}</h4>${L.map(([a, b]) => `<div class="kr"><span class="kk">${/^[\w\[\]/?…+ ]+$/.test(a) && a.length < 16 ? k(a) : `<code>${esc(a)}</code>`}</span><span>${esc(b)}</span></div>`).join('')}</div>`).join('');
    openSheet();
}
document.addEventListener('keydown', e => {   // Alt + 1…4 chọn loại giao dịch khi form đang mở
    if (!e.altKey || e.ctrlKey || e.metaKey || !/^[1-4]$/.test(e.key) || !E || !$('#ov').classList.contains('open')) return;
    const b = $('#sh [data-ty="' + TYPES[+e.key - 1] + '"]');
    if (!b) return;
    e.preventDefault(); b.click();
    setTimeout(() => { const a = $('#fa'); a && a.focus(); }, 0);
});

/* ===== forms.js ===== */
function csv() {
    const r = [['ID', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Tài khoản đến', 'Hạng mục cha', 'Hạng mục con', 'Ghi chú'], ...S.tx.map(t => [t.id, t.date, t.type, t.amount, t.acc, t.accTo, t.cat, t.sub, t.note])];
    const b = new Blob(['\ufeff' + r.map(x => x.map(v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && !(typeof v === 'number'))
        s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }).join(',')).join('\n')], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'so-thu-chi.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000);
}
let _opener = null;
function openSheet() {
    const ov = $('#ov');
    if (!ov.classList.contains('open'))
        _opener = document.activeElement;
    ov.classList.add('open');
    setTimeout(() => { const a = $('#ov.open #fa'); if (a && !ov.contains(document.activeElement))
        a.focus(); }, 60);
}
function formDirty() { if (!E || !E.isNew) return false; const a = $('#fa'), n = $('#fn'); return !!((a && amtVal(a.value)) || (n && n.value.trim()) || (E.imgs && E.imgs.length)); }
async function tryClose() { if (formDirty() && !await ask('Đóng mà chưa lưu?', 'Số tiền / ghi chú đang nhập sẽ bị mất.', { ok: 'Đóng', cancel: 'Tiếp tục nhập', icon: '✍️' })) return; closeSheet(); }
function closeSheet() {
    const ov = $('#ov'), was = ov.classList.contains('open');
    ov.classList.remove('open');
    if (was && _opener && _opener.isConnected && typeof _opener.focus === 'function') {
        try { _opener.focus({ preventScroll: true }); } catch (e) { }
    }
    _opener = null;
}
document.addEventListener('keydown', e => {
    if (e.key !== 'Tab')
        return;
    const ov = $('#ov');
    if (!ov.classList.contains('open') || $('#cf').classList.contains('open'))
        return;
    const f = [...ov.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length)
        return;
    const a = document.activeElement, i = f.indexOf(a);
    if (e.shiftKey && (i <= 0)) {
        e.preventDefault();
        f[f.length - 1].focus();
    }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) {
        e.preventDefault();
        f[0].focus();
    }
});
function openIssues() { const L = S.issues; ED = null; E = null; $('#sh').innerHTML = `<h3>Dữ liệu cần kiểm tra (${L.length}) <span class="tip" tabindex="0" role="note" aria-label="Ý nghĩa màu" data-tip="Đỏ = lỗi, dòng đó chưa được tính vào số liệu. Vàng = cần lưu ý, vẫn được tính. Chỉnh lại các dòng được liệt kê, số liệu sẽ tự cập nhật.">ⓘ</span></h3>${L.slice(0, 80).map(i => `<div class="iss ${i.lv}"><b>${esc(SN[i.sheet] || i.sheet)} · dòng ${i.row}</b><span>${esc(i.msg)}</span></div>`).join('')}${L.length > 80 ? `<p class="mut" style="margin-top:8px">… và ${L.length - 80} mục nữa</p>` : ''}`; openSheet(); }
const catNorm = s => nz(String(s || '')).replace(/\s+/g, ' ').trim();
/* Hạng mục / Chi tiết: ô chọn có tìm kiếm ngay trong ô (gõ không dấu cũng được) */
function cbOpts(kind, ty, cat, q) {
    const all = S.cat.filter(c => c.t === ty);
    let L;
    if (kind === 'p') {
        const seen = new Set();
        L = [];
        all.forEach(c => { if (!seen.has(c.p)) { seen.add(c.p); L.push({ p: c.p, c: '', lb: c.p }); } });
    }
    else L = (cat ? all.filter(c => c.p === cat) : all).map(c => ({ p: c.p, c: c.c, lb: cat ? c.c : c.p + ' › ' + c.c }));
    const w = catNorm(q).split(' ').filter(Boolean);
    return w.length ? L.filter(o => { const h = catNorm(o.p + ' ' + o.c); return w.every(x => h.includes(x)); }) : L;
}
const cbHtml = (kind, L) => L.length
    ? L.map((o, k) => `<div class="cbo ${k === 0 ? 'on' : ''}" role="option" data-cbo="${kind}" data-p="${esc(o.p)}" data-c="${esc(o.c)}">${emo(o.p)} ${esc(o.lb)}</div>`).join('')
    : '<div class="cbe">Không thấy kết quả. Thử từ khác, hoặc thêm ở mục Hạng mục.</div>';
function catFields(ty, cat, sub) {
    return `<div class="cbw"><span class="l">Hạng mục</span><div class="cb"><input id="fp" data-cb="p" autocomplete="off" placeholder="Chọn hoặc gõ…" value="${esc(cat)}"><div class="cbl hide"></div></div></div>
<div class="cbw"><span class="l">Chi tiết</span><div class="cb"><input id="fs" data-cb="s" autocomplete="off" placeholder="Chọn hoặc gõ…" value="${esc(sub)}"><div class="cbl hide"></div></div></div>`;
}
const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
function defAcc() { let a = ''; try { a = localStorage.lastAcc || ''; } catch (e) { } return S.acc.some(x => x.name === a) ? a : ((S.acc.find(x => x.type !== HELD) || S.acc[0] || {}).name || ''); }
$('#ov').addEventListener('click', e => {   // nút ngày nhanh
    const k = e.target.closest('[data-k]');
    if (k && E) { const a = $('#fa'); if (a && a.value.replace(/\D/g, '')) { a.value += k.dataset.k; fm(a); a.focus(); } return; }
    const b = e.target.closest('[data-qd]');
    if (!b || !E) return;
    const d = new Date(); d.setDate(d.getDate() + +b.dataset.qd);
    E.date = ymd(d); const f = $('#fd'); if (f) f.value = E.date;
});
function openForm(t, ty) { E = t ? { ...t, note: noteTxt(t.note), imgs: splitImg(t.note).imgs, time: (t.at || '').slice(11, 16) } : { id: newId(), date: ymd(new Date()), time: hm(new Date()), type: ty || 'Chi', amount: 0, acc: defAcc(), accTo: '', cat: '', sub: '', note: '', imgs: [], isNew: true }; ED = null; form(); openSheet(); }
function form() {
    const ty = E.type, op = (a, v) => a.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join(''), noAcc = !S.acc.length;
    // Chưa có danh sách tài khoản (chưa tải được dữ liệu): báo rõ + nút tải lại, không để ô chọn trống trơn
    const accBox = (id, lb, extra) => noAcc
        ? `<div class="w nodata"><span>${S.err ? 'Chưa tải được tài khoản: ' + esc(S.err) : 'Đang tải danh sách tài khoản…'}</span><button type="button" class="chip" data-reload>Tải lại</button></div>`
        : `<label class="w">${lb}<select id="${id}">${extra || ''}${op(S.acc.map(a => a.name).filter(n => id !== 'ft' || n !== E.acc), id === 'ft' ? E.accTo : E.acc)}</select></label>`;
    $('#sh').innerHTML = `<div class="seg">${TYPES.map(x => `<button data-ty="${x}" class="${x === ty ? 'on' : ''}">${x === 'Chuyển khoản' ? 'Chuyển' : x}</button>`).join('')}</div>${tplRow()}
<div class="amtw"><input class="amt money ${CLS[ty]}" ${ty === 'Điều chỉnh' ? 'data-neg="1"' : ''} id="fa" inputmode="${ty === 'Điều chỉnh' ? 'text' : 'numeric'}" placeholder="0" value="${E.amount ? num(E.amount) : ''}" aria-label="Số tiền"><span class="cur" aria-hidden="true">₫</span></div>
<div class="qk"><button type="button" class="chip" data-k="000">+000</button><small>Gõ 50k, 1.5tr hoặc phép tính như 45k*3+20k</small></div>
<div class="f">
<label>Ngày<input type="date" id="fd" value="${E.date}"></label><label>Giờ<input type="time" id="fh" value="${E.time || ''}"></label>
<div class="w qd3"><button type="button" class="chip" data-qd="0">Hôm nay</button><button type="button" class="chip" data-qd="-1">Hôm qua</button><button type="button" class="chip" data-qd="-2">Hôm kia</button></div>
${accBox('fc', ty === 'Chuyển khoản' ? 'Từ tài khoản' : 'Tài khoản')}
${ty === 'Chuyển khoản' ? (noAcc ? '' : accBox('ft', 'Đến tài khoản', '<option value="">Chọn…</option>')) : ty === 'Điều chỉnh' ? '' : catFields(ty, E.cat, E.sub)}
<label class="w">Ghi chú<input id="fn" value="${esc(E.note)}" placeholder="Không bắt buộc"></label><div class="w" id="att"></div></div>
<div class="sfoot"><button class="btn p w" data-save title="Ctrl + Enter">${E.isNew ? 'Lưu giao dịch' : 'Lưu thay đổi'}</button>
<div class="sec2"><button type="button" class="btn" data-tplsave>☆ Lưu mẫu</button>${E.isNew ? '' : '<button type="button" class="btn" data-dup>⧉ Nhân đôi</button><button type="button" class="btn d" data-del>🗑 Xóa</button>'}</div></div>`;
    renderAtt();
}
$('#ov').addEventListener('click', e => {   // nút "Tải lại" khi chưa có tài khoản
    if (!E || !e.target.closest('[data-reload]')) return;
    sync(true).then(() => { if (E && S.acc.length) { pull(); E.acc = defAcc(); form(); } else if (E) form(); });
});
function pull() { const g = i => ($(i) || {}).value; E.date = g('#fd') || E.date; if ($('#fh'))
    E.time = g('#fh'); E.acc = g('#fc') || E.acc; E.note = g('#fn') || ''; if ($('#ft'))
    E.accTo = g('#ft'); E.amount = amtVal($('#fa').value) || 0; }
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
    if (E && t.dataset.cb) return cbOpen(t, true);
    if (E && t.id === 'fc') {
        if (E.type === 'Chuyển khoản') {
            pull();
            form();
            $('#fc').focus();
        }
        else E.acc = t.value;
    }
});
function cbOpen(inp, filter) {
    if (!E) return;
    const kind = inp.dataset.cb, box = inp.parentElement.querySelector('.cbl');
    box.innerHTML = cbHtml(kind, cbOpts(kind, E.type, kind === 's' ? E.cat : '', filter ? inp.value : ''));
    box.classList.remove('hide');
    try { box.scrollIntoView({ block: 'nearest' }); } catch (x) { }
}
const cbClose = () => $$('#ov .cbl').forEach(b => b.classList.add('hide'));
function cbPick(el) {
    pull();
    const k = el.dataset.cbo, p = el.dataset.p, c = el.dataset.c;
    E.cat = p;
    if (k === 'p') { if (E.sub && !catOk(E.type, p, E.sub)) E.sub = ''; }
    else E.sub = c;
    form();
    if (k === 'p' && !E.sub) { const f = $('#fs'); if (f) f.focus(); }
    else if (!E.amount) { const f = $('#fa'); if (f) f.focus(); }
}
$('#ov').addEventListener('focusin', e => {
    const t = e.target;
    if (!E || !t.dataset || !t.dataset.cb) return;
    cbOpen(t, false);
    setTimeout(() => { try { t.select(); } catch (x) { } }, 0);
});
$('#ov').addEventListener('focusout', () => setTimeout(() => {
    if (!E || document.activeElement.closest('.cb')) return;
    cbClose();
    const p = $('#fp'), s = $('#fs');
    if (p && !p.value.trim()) { E.cat = ''; E.sub = ''; }
    if (s && !s.value.trim()) E.sub = '';
    if (p) p.value = E.cat || '';
    if (s) s.value = E.sub || '';
}, 160));
$('#ov').addEventListener('mousedown', e => { if (e.target.closest('.cbl')) e.preventDefault(); });
$('#ov').addEventListener('keydown', e => {
    const t = e.target;
    if (!E || !t.dataset || !t.dataset.cb) return;
    const box = t.parentElement.querySelector('.cbl'), open = !box.classList.contains('hide'), items = [...box.querySelectorAll('.cbo')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) return cbOpen(t, false);
        let i = items.findIndex(x => x.classList.contains('on'));
        items.forEach(x => x.classList.remove('on'));
        i = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
        if (items[i]) { items[i].classList.add('on'); items[i].scrollIntoView({ block: 'nearest' }); }
    }
    else if (e.key === 'Enter') {
        if (e.isComposing || e.keyCode === 229) return;
        const b = box.querySelector('.cbo.on') || items[0];
        // Danh sách đang mở và có kết quả: Enter = chọn. Ngược lại để logic Enter chung xử lý (nhảy ô kế tiếp).
        if (open && b) { e.preventDefault(); cbPick(b); }
    }
    else if (e.key === 'Escape' && open) {
        e.stopPropagation();
        cbClose();
    }
});
$('#ov').addEventListener('click', e => {
    if (!E) return;
    const o = e.target.closest('.cbo');
    if (o) return cbPick(o);
    const t = e.target.closest('[data-cb]');
    if (t && t.parentElement.querySelector('.cbl').classList.contains('hide')) cbOpen(t, false);
});
$('#ov').addEventListener('click', async (e) => {
    const T = e.target;
    if (T.id === 'ov')
        return tryClose();
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
                    return; if (old && nm !== old && typeof goalRename === 'function') goalRename(old, nm); if (ED && ED.ico !== undefined) {
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
            if (!await ask('Chuyển vào Thùng rác?', edelMsg(kind, o), { danger: 1, ok: 'Xóa' }))
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
        E = { ...E, id: newId(), date: ymd(new Date()), time: hm(new Date()), at: '', isNew: true };
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
        const raw = ($('#fa') || {}).value || '';
        if (raw && amtVal(raw) == null) return toast('Phép tính ở ô Số tiền chưa hợp lệ');
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
            return toast('Đang nén ảnh, vui lòng chờ…');
        const x = ty === 'Chuyển khoản' || ty === 'Điều chỉnh', row = { id: E.id, date: E.date, type: ty, amount: E.amount, acc: E.acc, accTo: ty === 'Chuyển khoản' ? E.accTo : '', cat: x ? '' : E.cat, sub: x ? '' : E.sub, note: joinImg(E.note, E.imgs) };
        if (E.time) {
            row.at = E.date + 'T' + E.time + ':00';
        }
        else if (E.at) {
            row.at = E.at;
        }
        const wasNew = !S.tx.some(t => t.id === row.id);
        try { localStorage.lastAcc = E.acc; } catch (x) { }
        const stg = (E.staged || []).map(s => ({ name: s.name, blob: s.blob }));
        closeSheet();
        txSave(row, null, stg).then(r => { if (r && !r.ok && !$('#ov').classList.contains('open')) { openForm(row); E.isNew = wasNew; form(); } });   // lỗi → trả form lại với dữ liệu đã nhập
    }
});

/* ===== txform.js ===== */
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
function txSave(row, okMsg, files) {
    const prev = S.tx.find(t => t.id === row.id), old = prev && { ...prev }, isNew = !prev;
    return commit([{ op: 'tx.save', row }], {
        pend: isNew ? 'Đang tạo giao dịch…' : 'Đang cập nhật giao dịch…', ok: txMsg(row), title: isNew ? 'Giao dịch đã được tạo' : 'Giao dịch đã được cập nhật', ico: isNew ? '🧾' : '✏️', tag: 'tx-' + row.id, kind: 'tx', files: files && files.length ? files : null,
        local: () => { S.tx = S.tx.filter(t => t.id !== row.id).concat(row); },
        undo: () => commit(old ? [{ op: 'tx.save', row: old }] : [{ op: 'tx.purge', id: row.id }], { ok: 'Đã hoàn tác', local: () => { S.tx = S.tx.filter(t => t.id !== row.id); if (old)
                S.tx.push(old); } })
    }).then(r => { if (r.ok)
        limWarn(row); return r; });
}
function txDel(id) {
    const old = { ...S.tx.find(x => x.id === id) };
    return commit([{ op: 'tx.del', id }], {
        pend: 'Đang xóa giao dịch…', ok: 'Mã ' + id + ' đã chuyển vào Thùng rác', title: 'Giao dịch đã được xóa', ico: '🗑️', tag: 'tx-' + id, kind: 'tx', local: () => { S.tx = S.tx.filter(x => x.id !== id); },
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
    return `<div class="tplr"><small>Mẫu</small><div class="chips">${TPL.map((t, i) => tplMg
        ? `<span class="chip tx"><span>${esc(tplLabel(t))}</span><button type="button" data-tpldel="${i}" aria-label="Xóa mẫu">×</button></span>`
        : `<button type="button" class="chip" data-tpl="${i}">⚡ ${esc(tplLabel(t))}</button>`).join('')}<button type="button" class="chip ${tplMg ? 'on' : ''}" data-tplmg>${tplMg ? 'Xong' : '✎'}</button></div></div>`;
}
$('#ov').addEventListener('click', e => {
    if (!E)
        return;
    const u = e.target.closest('[data-tpl]'), sv = e.target.closest('[data-tplsave]'), mg = e.target.closest('[data-tplmg]'), dl = e.target.closest('[data-tpldel]');
    if (mg || dl) {
        pull();
        if (dl) {
            const t = TPL.splice(+dl.dataset.tpldel, 1)[0];
            tplSaveLS();
            if (!TPL.length) tplMg = false;
            toast('Đã xóa mẫu “' + (t && t.name) + '”');
        }
        else
            tplMg = !tplMg;
        form();
        return;
    }
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
        toast('Đã lưu mẫu “' + t.name + '”');
        form();
    }
});

/* ===== quick.js: đã bỏ ô gõ nhanh; chỉ giữ hàm ghi giao dịch cho Mẫu / Công nợ ===== */
function qMissing(p) {
    const m = [];
    if (!p.amount) m.push('số tiền');
    if (!p.acc) m.push('tài khoản');
    if (p.type === 'Chuyển khoản') { if (!p.accTo) m.push('tài khoản nhận'); else if (p.accTo === p.acc) m.push('tài khoản nhận khác tài khoản nguồn'); }
    if ((p.type === 'Chi' || p.type === 'Thu') && (!p.cat || !p.sub)) m.push('hạng mục');
    return m;
}
function qRow(p) {
    const x = p.type === 'Chuyển khoản' || p.type === 'Điều chỉnh', d = p.date || todayS(), tm = p.time || hm(new Date());
    return { id: newId(), date: d, type: p.type, amount: p.amount, acc: p.acc, accTo: p.type === 'Chuyển khoản' ? p.accTo : '', cat: x ? '' : p.cat, sub: x ? '' : p.sub, note: p.note || '', at: d + 'T' + tm + ':00' };
}
function qOpen(p) {
    E = { id: newId(), date: p.date || todayS(), time: p.time || hm(new Date()), type: p.type || 'Chi', amount: p.amount || 0, acc: p.acc || defAcc(), accTo: p.accTo || '', cat: p.cat || '', sub: p.sub || '', note: p.note || '', imgs: [], isNew: true };
    ED = null;
    form();
    openSheet();
}

/* ===== report.js ===== */
S.rpv = S.rpv || 'm';
const pct = (x, y) => y ? Math.round((x - y) / y * 100) : null;
function delta(x, y, isChi = true) {
    const p = pct(x, y);
    if (p === null)
        return x ? '<span class="dl mut">mới</span>' : '';
    if (p === 0)
        return '<span class="dl mut">±0%</span>';
    const bad = isChi ? p > 0 : p < 0;
    if (p >= 300 && y > 0)
        return `<span class="dl ${bad ? 'chi' : 'thu'}">▲ gấp ${(x / y).toFixed(1).replace('.', ',').replace(',0', '')} lần</span>`;
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
    return `<div class="ph"><div><h1>Báo cáo</h1><p>${sub}</p></div><div class="pa">${nav}<div class="tabs rpt-tabs"><button type="button" class="${S.rpv === 'm' ? 'on' : ''}" data-rp="m">Tháng</button><button type="button" class="${S.rpv === 'y' ? 'on' : ''}" data-rp="y">Năm</button><button type="button" class="${S.rpv === 't' ? 'on' : ''}" data-rp="t">Xu hướng</button></div><button class="btn noprint" data-a3="print">In / PDF</button></div></div>`;
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
function reportPage() { return S.rpv === 'y' ? rpYear() : S.rpv === 't' ? rpTrend() : rpMonth(); }
document.addEventListener('click', e => {
    const b = e.target.closest('[data-rp]');
    if (!b)
        return;
    S.rpv = b.dataset.rp;
    render();
});
Object.assign(S, { sa: '', sc: '', ss: '', ct: 'Chi', sl: '', lo: false, vf: 'all' });

/* ===== lists.js ===== */
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

/* ===== notify.js ===== */
IC.bell = 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0';
IC.set = 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6';
const CAN_SYS = 'Notification' in window;
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let SWREG = null, INST = null;
const permOf = () => CAN_SYS ? Notification.permission : 'unsupported';
const pushOn = () => permOf() === 'granted';
const pad2 = n => String(n).padStart(2, '0');
const toMin = h => { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ''); return m ? +m[1] * 60 + +m[2] : -1; };
const CFG_KINDS = {
    tx: ['🧾', 'Giao dịch được tạo, cập nhật, xóa', 'Kèm mã giao dịch'],
    limit: ['⚠️', 'Hạng mục bội chi', 'Khi khoản chi làm vượt hạn mức ngày hoặc tháng'],
    sync: ['🔄', 'Thay đổi từ thiết bị khác', 'Giao dịch mới hoặc vừa được sửa ở nơi khác']
};
function cfg() {
    let c = {};
    try {
        c = JSON.parse(localStorage.stcfg || '{}') || {};
    }
    catch (e) { }
    return {
        fg: c.fg != null ? !!c.fg : localStorage.nall === '1',
        kinds: { tx: true, limit: true, sync: true, report: true, remind: true, ...c.kinds },
        rp: { on: true, at: '06:00', ...c.rp },
        rm: Array.isArray(c.rm) ? c.rm : []
    };
}
const cfgSave = c => { try {
    localStorage.stcfg = JSON.stringify(c);
}
catch (e) { } };
const kindOn = k => !k || cfg().kinds[k] !== false;
const nlog = () => { try {
    return JSON.parse(localStorage.nlog || '[]');
}
catch (e) {
    return [];
} };
const nsave = a => { try {
    localStorage.nlog = JSON.stringify(a.slice(0, 40));
}
catch (e) { } };
const ago = t => { const s = (Date.now() - t) / 1e3; return s < 60 ? 'vừa xong' : s < 3600 ? Math.floor(s / 60) + ' phút trước' : s < 86400 ? Math.floor(s / 3600) + ' giờ trước' : new Date(t).toLocaleDateString('vi-VN'); };
/* Nhật ký thông báo dùng chung giữa các thiết bị: ngoài nhật ký cục bộ, dựng thêm
   "Giao dịch đã được tạo" từ chính dữ liệu đồng bộ (mã giao dịch chứa mốc thời gian tạo). */
const idTs = id => { const m = /^G([0-9a-z]{8})/.exec(String(id || '')); if (!m)
    return 0; const t = parseInt(m[1], 36); return t > 1.4e12 && t < 4.1e12 ? t : 0; };
let _fd = null;
function feedAll() {
    const raw = (localStorage.nlog || '') + '|' + (localStorage.nclr || '') + '|' + cfg().kinds.sync;
    if (_fd && _fd.t === S.tx && _fd.n === S.tx.length && _fd.r === raw && Date.now() - _fd.at < 30000)
        return _fd.l;
    const L = nlog(), clr = +localStorage.nclr || 0, have = new Set();
    L.forEach(n => { if (/tạo/.test(n.title || ''))
        (String(n.body).match(/G[0-9a-z]{8,}/g) || []).forEach(x => have.add(x)); });
    let D = [];
    if (S.ready && kindOn('sync')) {
        const lim = Date.now() - 30 * 864e5;
        D = S.tx.map(t => [t, idTs(t.id)]).filter(([t, ts]) => ts > lim && ts > clr && !have.has(t.id)).sort((a, b) => b[1] - a[1]).slice(0, 30)
            .map(([t, ts]) => ({ t: ts, title: 'Giao dịch đã được tạo', body: txMsg(t), ico: '🧾', err: false, tab: 'tx', derived: 1 }));
    }
    const l = L.concat(D).sort((a, b) => b.t - a.t).slice(0, 60);
    _fd = { t: S.tx, n: S.tx.length, r: raw, at: Date.now(), l };
    return l;
}
function nbUpdate() {
    const el = $('#nbn');
    if (!el)
        return;
    if (!localStorage.nseen)
        localStorage.nseen = Date.now();
    const n = feedAll().filter(x => x.t > (+localStorage.nseen || 0)).length;
    el.classList.toggle('hide', !n);
    el.textContent = n > 99 ? '99+' : n;
}
function toastHide() { clearTimeout(toast.i); const e = $('#toast'); if (e) e.classList.remove('on'); }
function toast(t, u, o) {
    o = o || {};
    const e = $('#toast');
    e.innerHTML = `<span class="ni">${esc(o.ico || '🔔')}</span><span class="nb"><b>${esc(o.title || 'Sổ Thu Chi')}</b><span>${esc(t)}</span></span>`;
    e.classList.toggle('u', !!u);
    e.classList.toggle('err', !!o.err);
    if (u) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Hoàn tác';
        b.onclick = ev => { ev.stopPropagation(); if (UNDO && UNDO.fn === u) {
            UNDO = null;
            toastHide();
            u();
        } };
        e.appendChild(b);
        UNDO = { fn: u, t: Date.now() };
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'tx';
    x.setAttribute('aria-label', 'Ẩn thông báo');
    x.textContent = '×';
    e.appendChild(x);
    e.classList.add('on');
    clearTimeout(toast.i);
    toast.i = setTimeout(toastHide, u ? 6000 : o.sticky ? 9000 : 3000);
}
(() => {
    const e = $('#toast');
    if (!e) return;
    e.addEventListener('click', toastHide);   // chạm vào đâu trên thông báo cũng ẩn (trừ nút Hoàn tác)
})();
async function swReg() {
    if (SWREG)
        return SWREG;
    if (!('serviceWorker' in navigator))
        return null;
    try {
        return SWREG = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 2500))]);
    }
    catch (e) {
        return null;
    }
}
async function showSys(title, body, o) {
    if (!pushOn())
        return false;
    o = o || {};
    const opt = {
        body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: o.tag || 'stc', renotify: true, lang: 'vi',
        requireInteraction: !!o.sticky, vibrate: [80, 40, 80], data: { tab: o.tab || '', url: location.href.split('#')[0] }
    };
    try {
        const r = await swReg();
        if (r && r.showNotification) {
            await r.showNotification(title, opt);
            return true;
        }
        const n = new Notification(title, opt);
        n.onclick = () => { window.focus(); if (o.tab && alive())
            go(o.tab); n.close(); };
        return true;
    }
    catch (e) {
        return false;
    }
}
if ('serviceWorker' in navigator)
    navigator.serviceWorker.addEventListener('message', e => {
        const d = e.data || {};
        if (d.type === 'open-tab' && d.tab && alive())
            go(d.tab);
    });
function notify(body, o) {
    o = o || {};
    const title = o.title || 'Sổ Thu Chi', ico = o.ico || (o.err ? '⚠️' : '✅');
    if (o.kind && !kindOn(o.kind)) {
        if (!o.bg)
            toast(body, o.undo, { title, ico, err: o.err });
        return;
    }
    const a = nlog();
    if (o.tag === 'sync' && a[0] && a[0].tag === 'sync')
        a.shift();
    a.unshift({ t: Date.now(), title, body, ico, err: !!o.err, tab: o.tab || '', tag: o.tag || '' });
    nsave(a);
    nbUpdate();
    toast(body, o.undo, { title, ico, err: o.err, sticky: o.sticky });
    if (pushOn() && (o.force || cfg().fg || document.hidden || !document.hasFocus()))
        showSys(title, body, o);
}
const txLine = t => (t.type === 'Chi' ? '−' : t.type === 'Thu' ? '+' : '') + num(t.amount) + ' · ' + (t.sub || t.cat || t.type) + ' · ' + (t.type === 'Chuyển khoản' && t.accTo ? t.acc + ' → ' + t.accTo : t.acc);
const txMsg = t => 'Mã ' + t.id + '\n' + txLine(t);
function notifyChanges(nw, up) {
    const pack = (L, one, many, ico) => {
        const b = L.slice(0, 3).map(t => 'Mã ' + t.id + ': ' + txLine(t)).join('\n') + (L.length > 3 ? '\n+' + (L.length - 3) + ' giao dịch khác' : '');
        notify(b, { title: L.length === 1 ? one : L.length + ' ' + many, ico, tag: 'sync-' + ico, kind: 'sync', bg: true, tab: 'tx' });
    };
    if (!nw.length && !up.length)
        return notify('Dữ liệu vừa được cập nhật', { title: 'Đồng bộ', ico: '🔄', tag: 'sync', kind: 'sync', bg: true });
    if (nw.length)
        pack(nw, 'Giao dịch mới được tạo', 'giao dịch mới được tạo', '🧾');
    if (up.length)
        pack(up, 'Giao dịch đã được cập nhật', 'giao dịch đã được cập nhật', '✏️');
    setTimeout(() => limCheck(nw.concat(up), null, true), 1800);
}
function limCheck(rows, undo, bg) {
    rows = (rows || []).filter(r => r && r.type === 'Chi' && !heldSet().has(r.acc));
    if (!rows.length || !S.lim.length)
        return;
    const chi = stx().filter(t => t.type === 'Chi'), today = ymd(new Date()), W = [];
    S.lim.forEach(L => {
        const hit = rows.filter(r => !L.cat || L.cat === r.cat);
        if (!hit.length)
            return;
        const day = L.per === 'Ngày', keys = [...new Set(hit.map(r => day ? r.date : r.date.slice(0, 7)))];
        keys.forEach(k => {
            const used = chi.filter(t => (day ? t.date === k : t.date.slice(0, 7) === k) && (!L.cat || t.cat === L.cat)).reduce((s, t) => s + t.amount, 0);
            if (used <= L.v)
                return;
            const when = day ? (k === today ? 'ngày' : 'ngày ' + k.slice(8) + '/' + k.slice(5, 7)) : (k === today.slice(0, 7) ? 'tháng' : 'tháng ' + k.slice(5) + '/' + k.slice(0, 4));
            W.push((L.cat ? emo(L.cat) + ' ' + L.cat : 'Tổng chi') + ' bội chi ' + vnd(used - L.v) + '\nĐã chi ' + vnd(used) + ' / hạn mức ' + when + ' ' + vnd(L.v));
        });
    });
    if (W.length)
        setTimeout(() => notify(W.join('\n'), { title: 'Hạn mức đã bội chi', ico: '⚠️', err: 1, kind: 'limit', tag: 'limit', tab: 'lim', bg: !!bg, undo }), bg ? 0 : 1800);
}
const VN_DAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function reportOf(date) {
    const L = stx().filter(t => t.date === date && (t.type === 'Thu' || t.type === 'Chi')), d = new Date(date + 'T00:00');
    const lab = VN_DAY[d.getDay()] + ', ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
    const sm = ty => L.filter(t => t.type === ty).reduce((s, t) => s + t.amount, 0), thu = sm('Thu'), chi = sm('Chi'), net = thu - chi;
    if (!L.length)
        return lab + '\nChưa ghi khoản thu chi nào. Mở sổ để bổ sung nếu bạn quên.';
    const g = {};
    L.filter(t => t.type === 'Chi').forEach(t => { const k = t.cat || 'Khác'; g[k] = (g[k] || 0) + t.amount; });
    const top = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
    const over = S.lim.filter(x => x.per === 'Ngày').map(x => {
        const u = L.filter(t => t.type === 'Chi' && (!x.cat || t.cat === x.cat)).reduce((s, t) => s + t.amount, 0);
        return u > x.v ? (x.cat || 'Tổng chi') + ' vượt ' + vnd(u - x.v) : '';
    }).filter(Boolean);
    const mo = sums(ymd(new Date()).slice(0, 7));
    const lines = [lab + ' · ' + L.length + ' khoản', 'Thu +' + vnd(thu), 'Chi −' + vnd(chi), 'Chênh lệch ' + (net < 0 ? '−' : '+') + vnd(Math.abs(net))];
    if (top)
        lines.push('Chi nhiều nhất: ' + top[0] + ' (' + vnd(top[1]) + ')');
    if (over.length)
        lines.push('⚠️ Vượt hạn mức ngày: ' + over.join(', '));
    lines.push('Tháng này đã chi ' + vnd(mo.chi));
    return lines.join('\n');
}
/* Giờ gửi trước 12:00 -> báo cáo hôm qua; từ 12:00 trở đi -> báo cáo hôm nay */
const rpToday = () => { const m = toMin(cfg().rp.at); return m >= 12 * 60; };
function dailyReport(preview) {
    const y = new Date(), td = rpToday();
    if (!td)
        y.setDate(y.getDate() - 1);
    notify(reportOf(ymd(y)), { title: td ? 'Báo cáo thu chi hôm nay' : 'Báo cáo thu chi hôm qua', ico: '📒', tag: 'daily-report', kind: 'report', bg: !preview, force: true, sticky: true, tab: 'rp' });
}
const firedMap = () => { try {
    return JSON.parse(localStorage.nfired || '{}');
}
catch (e) {
    return {};
} };
const fired = k => !!firedMap()[k];
function markFired(k) {
    const o = firedMap();
    o[k] = Date.now();
    for (const x in o)
        if (Date.now() - o[x] > 3 * 864e5)
            delete o[x];
    try {
        localStorage.nfired = JSON.stringify(o);
    }
    catch (e) { }
}
const rmKey = (r, day) => 'rm:' + r.id + ':' + day + ':' + r.at;
function armRm(r) {
    const n = new Date();
    if (toMin(r.at) <= n.getHours() * 60 + n.getMinutes())
        markFired(rmKey(r, ymd(n)));
}
function schedTick() {
    const now = new Date(), today = ymd(now), cur = now.getHours() * 60 + now.getMinutes(), c = cfg();
    if (c.kinds.remind !== false)
        c.rm.forEach(r => {
            const m = toMin(r.at);
            if (!r.on || m < 0 || (r.days && !r.days.includes(now.getDay())))
                return;
            const k = rmKey(r, today);
            if (cur < m || fired(k))
                return;
            markFired(k);
            const late = cur - m;
            if (late > 240)
                return;
            notify((late > 2 ? 'Hẹn lúc ' + r.at + '\n' : '') + (r.text || 'Đến giờ ghi chép thu chi'), { title: 'Nhắc nhở thu chi', ico: '⏰', tag: 'rm-' + r.id, kind: 'remind', bg: true, force: true, sticky: true, tab: 'tx' });
        });
    if (c.rp.on && c.kinds.report !== false && S.synced && !$('#app').classList.contains('hide') && alive()) {
        const k = 'rp:' + today;
        const m = toMin(c.rp.at);
        if (m >= 0 && cur >= m && !fired(k)) {
            markFired(k);
            if (cur - m <= 240)   // mở app quá trễ so với giờ hẹn thì bỏ qua, không báo bù lệch giờ
                dailyReport(false);
        }
    }
}
let _sch = 0;
function schedStart() {
    if (_sch)
        return;
    _sch = setInterval(schedTick, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        schedTick(); });
    addEventListener('focus', schedTick);
}
async function enablePush() {
    if (!CAN_SYS) {
        toast(IOS ? 'Trên iPhone/iPad: thêm ứng dụng vào Màn hình chính rồi mở từ biểu tượng đó' : 'Trình duyệt này không hỗ trợ thông báo');
        return 'unsupported';
    }
    let p = Notification.permission;
    if (p === 'default') {
        try {
            p = await new Promise(res => { const r = Notification.requestPermission(res); if (r && r.then)
                r.then(res); });
        }
        catch (e) {
            p = Notification.permission;
        }
    }
    if (p === 'granted')
        showSys('Đã bật thông báo', 'Bạn sẽ nhận thông báo giao dịch, hạng mục bội chi, nhắc nhở và báo cáo mỗi sáng.', { tag: 'test' });
    else if (p === 'denied')
        toast('Thông báo đang bị chặn. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ để cho phép.');
    nbUpdate();
    return p;
}
function openNotif() {
    ED = null;
    E = null;
    localStorage.nseen = Date.now();
    nbUpdate();
    const L = feedAll();
    $('#sh').innerHTML = `<div class="shh"><h3>Thông báo</h3><button class="chip" data-nt="settings">${ic('set')}Cài đặt</button></div>
${L.length ? `<div class="shh sub"><b>Gần đây</b><button class="chip" data-nt="clear">Xóa hết</button></div>` : ''}
<div class="menu">${L.map(n => `<div class="row"><span class="dot">${esc(n.ico)}</span><span class="m"><b>${esc(n.title)}</b><small style="white-space:pre-line">${esc(n.body)}</small></span><small class="mut">${ago(n.t)}</small></div>`).join('') || empty('Chưa có thông báo', 'Giao dịch, bội chi, nhắc nhở và báo cáo sẽ xuất hiện ở đây.')}</div>`;
    openSheet();
}
function openSettings() {
    ED = null;
    E = null;
    const c = cfg(), p = permOf(), mode = themeMode();
    const sw = (key, ico, t, sub, on) => `<label class="row sw"><span class="dot">${ico}</span><span class="m"><b>${t}</b><small>${sub}</small></span><input type="checkbox" role="switch" data-cfg="${key}" ${on ? 'checked' : ''}></label>`;
    const stat = { granted: 'Đã bật', denied: 'Đang bị chặn trong trình duyệt', default: 'Chưa bật', unsupported: IOS ? 'Cần thêm vào Màn hình chính' : (window.isSecureContext ? 'Trình duyệt không hỗ trợ' : 'Cần mở bằng https') }[p];
    const hint = p === 'denied' ? 'Bấm biểu tượng ổ khóa cạnh thanh địa chỉ, đổi “Thông báo” sang Cho phép, rồi tải lại trang. Trên điện thoại: Cài đặt → Ứng dụng/Trang web → Thông báo.'
        : p === 'unsupported' && IOS ? 'iPhone/iPad chỉ nhận thông báo khi ứng dụng đã được thêm vào Màn hình chính: Chia sẻ → Thêm vào Màn hình chính, rồi mở từ biểu tượng mới.' : '';
    const day = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    $('#sh').innerHTML = `<div class="shh"><h3>Cài đặt</h3><button class="chip" data-nt="open">${ic('bell')}Thông báo</button></div>

<div class="sec">Giao diện</div>
<div class="seg s3">${[['auto', 'Theo thiết bị'], ['light', 'Sáng'], ['dark', 'Tối']].map(([k, l]) => `<button data-nt="theme:${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>

<div class="shh sub"><b>Menu hiển thị</b><button type="button" class="chip" data-visreset>Hiện tất cả</button></div>
<div class="menu">${TABS.filter(t => t[0] !== 'home').map(([k, l]) => `<label class="row sw">${ic(k)}<span class="m"><b>${l}</b></span><input type="checkbox" role="switch" data-vis="${k}" ${tabOn(k) ? 'checked' : ''} aria-label="Hiện ${l}"></label>`).join('')}</div>
<p class="hint">Tắt mục nào thì mục đó ẩn khỏi menu trái và menu Thêm trên điện thoại. Thanh dưới điện thoại luôn giữ đủ 4 ô, mục kế tiếp tự bù vào. Mục đang mở vẫn hiện. Lưu riêng trên từng thiết bị.</p>

<div class="sec">Thông báo trên thiết bị</div>
<div class="menu"><div class="row"><span class="dot">🔔</span><span class="m"><b>Thông báo của trình duyệt</b><small>${stat}</small></span>${p === 'default' ? '<button class="chip on" data-nt="enable">Bật</button>' : p === 'granted' ? '<button class="chip" data-nt="test">Gửi thử</button>' : ''}</div>
${p === 'granted' ? sw('fg', '📲', 'Hiện cả khi đang mở ứng dụng', 'Mặc định chỉ hiện khi bạn ở ứng dụng hoặc tab khác', c.fg) : ''}</div>
${hint ? `<p class="hint">${hint}</p>` : ''}

<div class="sec">Thông báo về</div>
<div class="menu">${Object.entries(CFG_KINDS).map(([k, [i, t, s]]) => sw('k:' + k, i, t, s, c.kinds[k] !== false)).join('')}</div>

<div class="sec">Báo cáo thu chi hằng ngày</div>
<div class="menu">${sw('k:report', '📒', 'Gửi báo cáo mỗi ngày', 'Tổng thu, chi và hạng mục chi nhiều nhất của ' + (rpToday() ? 'hôm nay' : 'hôm qua'), c.kinds.report !== false && c.rp.on)}
<div class="row"><span class="m"><b>Giờ gửi</b><small>Trước 12:00 báo cáo hôm qua, từ 12:00 báo cáo hôm nay</small></span><input type="time" class="tm" data-cfg="rp.at" value="${esc(c.rp.at)}"><button class="chip" data-nt="report">Xem thử</button></div></div>

<div class="sec">Nhắc nhở ghi chép thu chi</div>
${c.rm.map(r => `<div class="rem"><div class="rem-t"><input type="time" class="tm" data-rm="at:${r.id}" value="${esc(r.at)}"><input class="tx" data-rm="text:${r.id}" value="${esc(r.text)}" placeholder="Nội dung nhắc" aria-label="Nội dung nhắc"><label class="sw"><input type="checkbox" role="switch" data-rm="on:${r.id}" ${r.on ? 'checked' : ''} aria-label="Bật nhắc nhở"></label><button class="x" data-nt="rm-del:${r.id}" aria-label="Xóa nhắc nhở">×</button></div>
<div class="days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="${(r.days || []).includes(d) ? 'on' : ''}" data-nt="rm-day:${r.id}:${d}" aria-pressed="${(r.days || []).includes(d)}">${day[d]}</button>`).join('')}</div></div>`).join('')}
<button class="btn w" data-nt="rm-add">＋ Thêm nhắc nhở</button>
<p class="hint">Nhắc nhở và báo cáo chạy khi ứng dụng đang mở (kể cả ở tab nền hoặc ứng dụng đã cài). Nếu bạn mở lại sau giờ hẹn, ứng dụng sẽ nhắc bù.</p>
${INST ? `<div class="sec">Ứng dụng</div><div class="menu"><button class="row" data-nt="install"><span class="dot">⬇️</span><span class="m"><b>Cài đặt ứng dụng</b><small>Mở như ứng dụng riêng, có biểu tượng trên máy</small></span></button></div>` : ''}`;
    openSheet();
}
document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-nt]');
    if (!b || b.type === 'checkbox')
        return;
    const [k, a, d] = b.dataset.nt.split(':'), c = cfg();
    if (k === 'open')
        return openNotif();
    if (k === 'settings')
        return openSettings();
    if (k === 'enable') {
        await enablePush();
        return openSettings();
    }
    if (k === 'test')
        return notify('Thông báo thử: mọi thứ đang hoạt động tốt.', { title: 'Sổ Thu Chi', ico: '🔔', tag: 'test', force: true });
    if (k === 'report')
        return dailyReport(true);
    if (k === 'theme') {
        setTheme(a);
        return openSettings();
    }
    if (k === 'install' && INST) {
        INST.prompt();
        try {
            await INST.userChoice;
        }
        catch (x) { }
        INST = null;
        return openSettings();
    }
    if (k === 'clear') {
        nsave([]);
        localStorage.nclr = Date.now();
        _fd = null;
        nbUpdate();
        return openNotif();
    }
    if (k === 'rm-add') {
        const r = { id: Math.random().toString(36).slice(2, 8), at: '21:00', text: 'Ghi lại các khoản thu chi hôm nay', days: [0, 1, 2, 3, 4, 5, 6], on: true };
        armRm(r);
        c.rm.push(r);
        cfgSave(c);
        return openSettings();
    }
    if (k === 'rm-del') {
        c.rm = c.rm.filter(r => r.id !== a);
        cfgSave(c);
        return openSettings();
    }
    if (k === 'rm-day') {
        const r = c.rm.find(x => x.id === a);
        if (!r)
            return;
        const n = +d;
        r.days = (r.days || []).includes(n) ? r.days.filter(x => x !== n) : (r.days || []).concat(n);
        cfgSave(c);
        return openSettings();
    }
});
document.addEventListener('change', e => {
    const t = e.target, g = t.dataset && t.dataset.cfg, m = t.dataset && t.dataset.rm;
    if (!g && !m)
        return;
    const c = cfg();
    if (g) {
        if (g === 'fg')
            c.fg = t.checked;
        else if (g === 'rp.at') {
            if (toMin(t.value) < 0)
                return;
            c.rp.at = t.value;
        }
        else if (g === 'k:report') {
            c.kinds.report = t.checked;
            c.rp.on = t.checked;
        }
        else if (g.startsWith('k:'))
            c.kinds[g.slice(2)] = t.checked;
    }
    else {
        const [f, id] = m.split(':'), r = c.rm.find(x => x.id === id);
        if (!r)
            return;
        if (f === 'at') {
            if (toMin(t.value) < 0)
                return;
            r.at = t.value;
            armRm(r);
        }
        else if (f === 'on') {
            r.on = t.checked;
            if (r.on)
                armRm(r);
        }
    }
    cfgSave(c);
});
document.addEventListener('input', e => {
    const m = e.target.dataset && e.target.dataset.rm;
    if (!m || !m.startsWith('text:'))
        return;
    const c = cfg(), r = c.rm.find(x => x.id === m.slice(5));
    if (r) {
        r.text = e.target.value;
        cfgSave(c);
    }
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e; });
addEventListener('appinstalled', () => { INST = null; notify('Đã cài đặt ứng dụng', { ico: '📲' }); });
function pushInit() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
        navigator.serviceWorker.register('sw.js').then(r => { SWREG = r; }).catch(() => { });
    nbUpdate();
    schedTick();
    if (CAN_SYS && Notification.permission === 'default' && !localStorage.nask)
        setTimeout(async () => {
            localStorage.nask = '1';
            if (await ask('Bật thông báo?', 'Nhận thông báo giao dịch, hạng mục bội chi, nhắc nhở và báo cáo thu chi mỗi sáng, kể cả khi bạn đang ở ứng dụng khác.', { icon: '🔔', ok: 'Bật thông báo', cancel: 'Để sau' }))
                enablePush();
        }, 2500);
}
schedStart();

/* ===== upload.js ===== */
const IMG_MAX = 1600, IMG_KB = 300;
function viaImg(f) {
    return new Promise((ok, no) => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); no(Error('Không đọc được ảnh này')); }; i.src = u; });
}
const loadBmp = f => window.createImageBitmap ? createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => viaImg(f)) : viaImg(f);
const toBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
const isHeic = f => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name || '');
let _heic;
function heicLib() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    return _heic || (_heic = new Promise((ok, no) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js';
        sc.onload = () => window.heic2any ? ok(window.heic2any) : no(Error('Không tải được bộ đọc ảnh HEIC'));
        sc.onerror = () => { _heic = null; no(Error('Cần có mạng để đọc ảnh HEIC')); };
        document.head.appendChild(sc);
    }));
}
async function heicToJpg(f) {
    const lib = await heicLib();
    const r = await lib({ blob: f, toType: 'image/jpeg', quality: .9 });
    return Array.isArray(r) ? r[0] : r;
}
async function squeeze(f) {
    let im;
    try { im = await loadBmp(f); }
    catch (e) { if (!isHeic(f)) throw e; im = await loadBmp(await heicToJpg(f)); }   // Chrome / Firefox chưa đọc được HEIC → đổi sang JPEG
    const w = im.width || im.naturalWidth, h = im.height || im.naturalHeight;
    let k = Math.min(1, IMG_MAX / Math.max(w, h)), q = .82, b;
    for (let i = 0; i < 10; i++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        const x = c.getContext('2d');
        x.fillStyle = '#fff';
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        b = await toBlob(c, q);
        if (!b)
            throw Error('Không nén được ảnh');
        if (b.size <= IMG_KB * 1024)
            break;
        if (q > .5)
            q -= .1;
        else
            k *= .85;
    }
    if (im.close)
        im.close();
    return b;
}
const b64 = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(Error('Không đọc được ảnh')); r.readAsDataURL(b); });
async function driveUp(blob, name) {
    if (!API)
        throw Error('Thiếu địa chỉ kết nối');
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 90000);
    let r;
    try {
        r = await fetch(API, { method: 'POST', signal: ac.signal, body: JSON.stringify({ key: (window.CONFIG || {}).KEY || '', img: { name, mime: 'image/jpeg', data: await b64(blob) } }) });
    }
    catch (e) {
        const x = Error('Không có kết nối mạng'); x.net = true; throw x;
    }
    finally {
        clearTimeout(tm);
    }
    let j;
    try {
        j = await r.json();
    }
    catch (e) {
        throw Error('Máy chủ chưa cấp quyền Drive hoặc chưa triển khai bản mới');
    }
    if (!j.ok)
        throw Error(j.err || 'Tải ảnh thất bại');
    if (!j.url)
        throw Error('Máy chủ đang chạy bản cũ, chưa nhận ảnh — cần triển khai phiên bản mới');
    return j;
}
const driveId = u => (String(u).match(/\/d\/([\w-]+)/) || [])[1] || '';
const driveThumb = (u, w) => 'https://drive.google.com/thumbnail?id=' + driveId(u) + '&sz=w' + (w || 240);
const thumbFail = 'this.parentNode.classList.add("nf");this.remove()';
function renderAtt() {
    const a = $('#att');
    if (!a || !E)
        return;
    const im = E.imgs || [], pd = E.pend || [];
    const th = (src, big, label, del) => `<span class="th"><a href="${esc(big)}" data-lb="${esc(big)}" data-lbo="${esc(del.open || big)}" title="Xem ảnh lớn"><img src="${esc(src)}" alt="${label}" loading="lazy" onerror='${thumbFail}'><i class="ph">📎</i></a>${del.tag}<button type="button" ${del.attr} aria-label="Gỡ ảnh">×</button></span>`;
    a.innerHTML = `<span class="l" style="font-size:12px;color:var(--mut)">Ảnh đính kèm</span><div class="thg">`
        + im.map((u, i) => th(driveThumb(u), driveThumb(u, 1600), 'Ảnh ' + (i + 1), { open: u, tag: '', attr: `data-imgdel="${i}"` })).join('')
        + (E.staged || []).map(s => th(s.url, s.url, 'Ảnh chờ tải', { tag: `<small>${s.kb} KB · chờ tải</small>`, attr: `data-imgst="${s.id}"` })).join('')
        + pd.map(p => p.err ? `<span class="chip att-i bad">⚠️ ${esc(p.err)}<button type="button" data-imgx="${p.id}" aria-label="Đóng">×</button></span>` : `<span class="th wait"><i class="spn"></i><small>Đang xử lý…</small></span>`).join('')
        + `<label class="th add" title="Thêm ảnh (JPG, PNG, WebP, HEIC)"><b>＋</b><small>Thêm ảnh</small><input type="file" id="fimg" accept="image/*,.heic,.heif" multiple hidden></label></div>`;
}
/* Xem ảnh lớn ngay trong trang */
document.addEventListener('click', e => {
    const a = e.target.closest('[data-lb]'); if (!a) return;
    e.preventDefault();
    let L = $('#lbx');
    if (!L) { L = document.createElement('div'); L.id = 'lbx'; L.setAttribute('role', 'dialog'); L.setAttribute('aria-modal', 'true'); L.innerHTML = '<img alt=""><a class="lo" target="_blank" rel="noopener">Mở trong Drive</a><button type="button" aria-label="Đóng">×</button>'; document.body.appendChild(L); L.addEventListener('click', ev => { if (!ev.target.closest('.lo')) lbClose(); }); }
    const img = L.querySelector('img'), lo = L.querySelector('.lo');
    img.src = a.dataset.lb; lo.href = a.dataset.lbo || a.dataset.lb; lo.style.display = /^blob:/.test(a.dataset.lb) ? 'none' : '';
    L.classList.add('on');
});
const lbClose = () => { const L = $('#lbx'); if (L) L.classList.remove('on'); };
document.addEventListener('keydown', e => { const L = $('#lbx'); if (e.key === 'Escape' && L && L.classList.contains('on')) { e.stopImmediatePropagation(); e.preventDefault(); lbClose(); } }, true);
const imgName = () => {
    const E0 = E, amt = amtVal(($('#fa') || {}).value || E0.amount) || 0;
    return [E0.date, nz(E0.sub || E0.cat || E0.type).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'giao-dich', amt || 0, Date.now().toString(36)].join('_') + '.jpg';
};
async function attach(f) {
    const E0 = E;
    if (!E0) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) { toast('Chỉ đính kèm được file ảnh (JPG, PNG, WebP, HEIC)'); return; }
    const p = { id: Math.random().toString(36).slice(2) };
    (E0.pend = E0.pend || []).push(p);
    E0.up = (E0.up || 0) + 1;
    renderAtt();
    try {
        const small = await squeeze(f);
        (E0.staged = E0.staged || []).push({ id: p.id, blob: small, name: imgName(), url: URL.createObjectURL(small), kb: Math.round(small.size / 1024) });
        E0.pend = E0.pend.filter(x => x !== p);
    }
    catch (e) { p.err = e.message; }
    E0.up--;
    if (E === E0) renderAtt();
}
$('#ov').addEventListener('change', e => {
    if (e.target.id !== 'fimg' || !E)
        return;
    const fs = [...e.target.files];
    e.target.value = '';
    fs.forEach(attach);
});
$('#ov').addEventListener('click', e => {
    if (!E)
        return;
    const d = e.target.closest('[data-imgdel]'), x = e.target.closest('[data-imgx]');
    if (d) {
        E.imgs.splice(+d.dataset.imgdel, 1);
        renderAtt();
    }
    else if (x) {
        E.pend = (E.pend || []).filter(p => p.id !== x.dataset.imgx);
        renderAtt();
    }
});

/* ===== trend.js ===== */
S.tn = S.tn || 12;

function rpTrend() {
    const N = S.tn, end = S.m, ms = Array.from({ length: N }, (_, i) => shift(end, i - N + 1));
    const rows = ms.map(m => {
        const s = sums(m);
        return { m, thu: s.thu, chi: s.chi, n: s.thu - s.chi, py: sums(shift(m, -12)).chi };
    });
    const live = rows.filter(r => r.thu || r.chi), act = Math.max(1, live.length);
    const T = rows.reduce((o, r) => ({ thu: o.thu + r.thu, chi: o.chi + r.chi }), { thu: 0, chi: 0 });
    const rate = T.thu ? Math.round((T.thu - T.chi) / T.thu * 100) : 0;

    let before = ownAcc().reduce((s, a) => s + (+a.open || 0), 0);
    const flowBy = {};
    stx().forEach(t => {
        const k = t.date.slice(0, 7);
        if (k < ms[0]) before += flow(t);
        else if (k <= end) flowBy[k] = (flowBy[k] || 0) + flow(t);
    });
    let run = before;
    const net = ms.map(m => (run += flowBy[m] || 0));

    const lab = i => (i === 0 || ms[i].slice(5) === '01') ? ms[i].slice(5) + '/' + ms[i].slice(2, 4) : String(+ms[i].slice(5));
    const slot = 480 / N, bw = Math.min(14, slot * .36), every = N > 12 ? 2 : 1;
    const top = Math.max(1, ...rows.map(r => Math.max(r.thu, r.chi)));
    const grid = [0, .5, 1].map(f => `<line x1="0" x2="480" y1="${130 - f * 120}" y2="${130 - f * 120}" stroke="var(--line)"/>`).join('');
    const bars = grid + rows.map((r, i) => {
        const x0 = i * slot + slot / 2, h1 = r.thu / top * 120, h2 = r.chi / top * 120;
        return `<rect x="${(x0 - bw - .5).toFixed(1)}" y="${130 - h1}" width="${bw.toFixed(1)}" height="${h1}" rx="2" fill="var(--thu)"/>`
            + `<rect x="${(x0 + .5).toFixed(1)}" y="${130 - h2}" width="${bw.toFixed(1)}" height="${h2}" rx="2" fill="var(--chi)"/>`
            + (i % every === 0 ? `<text x="${x0.toFixed(1)}" y="148" font-size="10" text-anchor="middle" fill="var(--mut)">${lab(i)}</text>` : '');
    }).join('');

    const cm = {};
    stx().forEach(t => {
        const k = t.date.slice(0, 7);
        if (t.type !== 'Chi' || k < ms[0] || k > end) return;
        const c = t.cat || 'Chưa phân loại', o = cm[c] = cm[c] || { all: 0, a: 0, b: 0 }, i = ms.indexOf(k);
        o.all += t.amount;
        if (i >= N - 3) o.a += t.amount;
        else if (i >= N - 6) o.b += t.amount;
    });
    const cats = Object.entries(cm).sort((x, y) => y[1].all - x[1].all).slice(0, 8);

    const h = Math.floor(N / 2), first = rows.slice(0, h).reduce((s, r) => s + r.chi, 0) / h, last = rows.slice(N - h).reduce((s, r) => s + r.chi, 0) / h;
    const insight = first > 0 && last > 0
        ? `<div class="card insight"><span>${h} tháng gần nhất bạn chi trung bình <b class="sens">${vnd(last)}</b> mỗi tháng, ${last > first ? 'cao hơn' : 'thấp hơn'} ${h} tháng trước đó <b class="sens">${vnd(Math.abs(last - first))}</b>.</span></div>` : '';
    const maxChi = rows.reduce((b, r) => r.chi > b.chi ? r : b, rows[0]);

    const chips = [6, 12, 24].map(n => `<button type="button" class="chip ${S.tn === n ? 'on' : ''}" data-tn="${n}">${n} tháng</button>`).join('');
    return rpHead(N + ' tháng đến ' + mlabel(end).toLowerCase(), navM(mlabel(end), 1))
        + `<div class="chips" style="margin-bottom:14px">${chips}</div>`
        + `<div class="kpis">${kpi('Chi trung bình', vnd(T.chi / act), 'chi', 'mỗi tháng có phát sinh', 'h')}${kpi('Thu trung bình', vnd(T.thu / act), 'thu', 'mỗi tháng có phát sinh')}${kpi('Tỷ lệ tiết kiệm', rate + '%', rate < 0 ? 'chi' : '', 'Thu − chi = ' + vnd(T.thu - T.chi))}${kpi('Tài sản ròng', vnd(net[N - 1]), net[N - 1] < 0 ? 'chi' : '', (net[N - 1] >= before ? 'Tăng ' : 'Giảm ') + vnd(Math.abs(net[N - 1] - before)) + ' trong kỳ')}</div>`
        + insight
        + `<div class="grid b"><div class="card"><div class="ch">Thu chi từng tháng <small><span class="thu">■</span> thu &nbsp;<span class="chi">■</span> chi</small></div><svg viewBox="0 0 480 154" width="100%" role="img" aria-label="Thu chi theo tháng">${bars}</svg></div>`
        + `<div class="card"><div class="ch">Tài sản ròng cuối mỗi tháng</div>${lineChart([{ v: net, c: 'var(--acc)', area: true }], N, { label: 'Tài sản ròng cuối mỗi tháng', xl: i => String(+ms[i].slice(5)) })}</div></div>`
        + `<div class="grid b" style="align-items:start"><div class="card"><div class="ch">Chi theo hạng mục <small>3 tháng gần nhất so với 3 tháng trước đó</small></div>${cats.map(([k, o]) => `<div class="row" style="border:0;padding:8px 0"><span class="dot">${emo(k)}</span><span class="m"><b>${esc(k)}</b><small class="sens">Trung bình ${vnd(o.all / N)} mỗi tháng</small></span><span class="am"><b class="chi sens">${vnd(o.all)}</b><small>${delta(o.a, o.b) || '&nbsp;'}</small></span></div>`).join('') || empty('Chưa có khoản chi')}</div>`
        + `<div class="card"><div class="ch">Bảng theo tháng <small>cột cuối: chi so với cùng tháng năm trước</small></div><div class="tw"><table class="rpt"><thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Ròng</th><th>Cùng kỳ</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.m === maxChi.m && r.chi ? 'mx' : ''}"><td>${r.m.slice(5)}/${r.m.slice(2, 4)}</td><td class="thu sens">${r.thu ? num(r.thu) : '–'}</td><td class="chi sens">${r.chi ? num(r.chi) : '–'}</td><td class="sens ${r.n < 0 ? 'chi' : ''}">${r.thu || r.chi ? num(r.n) : '–'}</td><td>${r.py && r.chi ? delta(r.chi, r.py) : '–'}</td></tr>`).join('')}</tbody></table></div></div></div>`;
}

document.addEventListener('click', e => {
    const b = e.target.closest('[data-tn]');
    if (!b) return;
    S.tn = +b.dataset.tn;
    render();
});

/* ===== goals.js ===== */
let GOALS = [], GE = { i: null };
try { GOALS = JSON.parse(localStorage.goals || '[]'); } catch (e) { }
const goalsSave = () => { try { localStorage.goals = JSON.stringify(GOALS); } catch (e) { } };
const goalAcc = g => S.acc.find(a => a.name === g.acc);
const monthDiff = due => {
    const n = new Date();
    return (+due.slice(0, 4) - n.getFullYear()) * 12 + (+due.slice(5, 7) - 1 - n.getMonth());
};

function goalRename(from, to) {
    GOALS.forEach(g => { if (g.acc === from) { g.acc = to; g.name = to; } });
    goalsSave();
}

function goalStat(g) {
    const a = goalAcc(g), saved = a ? Math.max(0, bal(a)) : 0, left = Math.max(0, g.target - saved);
    const diff = g.due ? monthDiff(g.due) : null, done = saved >= g.target;
    const need = !done && diff != null && diff >= 0 ? left / Math.max(1, diff) : 0;
    return { a, saved, left, diff, done, need, pct: Math.min(100, Math.floor(saved / g.target * 100)) };
}

function goalCard(g, i) {
    const s = goalStat(g);
    let line;
    if (!s.a) line = `<span class="chi">Tài khoản “${esc(g.acc)}” không còn tồn tại. Hãy tạo lại tài khoản cùng tên hoặc xóa mục tiêu này.</span>`;
    else if (s.done) line = '<b class="thu">Đã đạt mục tiêu</b>';
    else if (g.due && s.diff < 0) line = `<span class="chi">Đã quá hạn ${mlabel(g.due).toLowerCase()}, còn thiếu ${vnd(s.left)}</span>`;
    else if (g.due) line = `Còn thiếu <b class="sens">${vnd(s.left)}</b>. Hạn ${mlabel(g.due).toLowerCase()}, nên để dành <b class="sens">${vnd(s.need)}</b> mỗi tháng.`;
    else line = `Còn thiếu <b class="sens">${vnd(s.left)}</b>.`;
    return `<div class="card dcard"><div class="dtop"><span class="dot lg">${ic('goal')}</span><div class="dtt"><h2>${esc(g.name)}</h2><p>Mục tiêu ${vnd(g.target)}${g.due ? ' · hạn ' + g.due.slice(5) + '/' + g.due.slice(0, 4) : ''}</p></div><div class="dbal"><small>Đã tích lũy</small><b class="sens ${s.done ? 'thu' : ''}">${vnd(s.saved)}</b></div></div>
<div class="bar" style="--bc:${s.done ? 'var(--thu)' : 'var(--acc)'};margin-top:14px"><div><span>${s.pct}%</span><span class="mut sens">${num(s.saved)} / ${num(g.target)}</span></div><i><s style="width:${s.pct}%"></s></i></div>
<p class="note">${line}</p>
<div class="cg" style="margin-top:12px"><button class="btn p" data-gdep="${i}">Nạp tiền</button><button class="btn" data-gwd="${i}">Rút tiền</button><button class="btn" data-gedit="${i}">Sửa</button><button class="btn d" data-gdel="${i}">Xóa mục tiêu</button></div></div>`;
}

function goalPage() {
    const st = GOALS.map(goalStat), tg = GOALS.reduce((s, g) => s + g.target, 0), sv = st.reduce((s, x) => s + x.saved, 0);
    const need = st.reduce((s, x) => s + x.need, 0);
    return head('Mục tiêu', GOALS.length ? GOALS.length + ' mục tiêu · mỗi mục tiêu có một tài khoản Tiết kiệm riêng' : 'Đặt mục tiêu tiết kiệm cho từng khoản lớn', `<button class="btn p" data-gnew>${ic('pl')}Tạo mục tiêu</button>`)
        + (GOALS.length
            ? `<div class="kpis">${kpi('Tổng mục tiêu', vnd(tg), '', GOALS.length + ' mục tiêu', 'h')}${kpi('Đã tích lũy', vnd(sv), 'thu', Math.floor(sv / (tg || 1) * 100) + '% tổng mục tiêu')}${kpi('Còn thiếu', vnd(Math.max(0, tg - sv)))}${kpi('Nên để dành mỗi tháng', vnd(need), '', 'Tính cho mục tiêu có đặt hạn')}</div><div class="col">${GOALS.map(goalCard).join('')}</div>`
            : `<div class="card">${empty('Chưa có mục tiêu', 'Khi tạo mục tiêu, app tự mở một tài khoản Tiết kiệm cùng tên để bạn chuyển tiền vào.')}</div>`);
}

function goalForm(i) {
    const g = i == null ? {} : GOALS[i];
    GE = { i };
    ED = null;
    E = null;
    $('#sh').innerHTML = `<h3>${i == null ? 'Tạo mục tiêu' : 'Sửa mục tiêu'}</h3><div class="f">`
        + (i == null
            ? '<label class="w">Tên mục tiêu<input id="g_name" placeholder="Ví dụ: Mua xe, Du lịch Nhật" autocomplete="off"></label>'
            : `<label class="w">Tài khoản gắn với mục tiêu<input value="${esc(g.acc)}" disabled></label>`)
        + `<label class="w">Số tiền cần đạt<input class="money" id="g_target" inputmode="numeric" placeholder="0" value="${g.target ? num(g.target) : ''}"></label>`
        + `<label class="w">Hạn hoàn thành, không bắt buộc<input type="month" id="g_due" value="${g.due || ''}"></label></div>`
        + (i == null ? '<p class="hint">Khi lưu, app tạo tài khoản loại Tiết kiệm cùng tên, số dư ban đầu 0. Dùng “Nạp tiền” để chuyển từ tài khoản khác vào.</p>' : '')
        + '<button class="btn p w" data-gsave>Lưu</button>';
    openSheet();
}

async function goalSave() {
    const target = pm($('#g_target').value), due = $('#g_due').value || '';
    if (!target) return toast('Nhập số tiền cần đạt');
    if (GE.i != null) {
        Object.assign(GOALS[GE.i], { target, due });
        goalsSave();
        closeSheet();
        render();
        return toast('Đã lưu mục tiêu');
    }
    const name = $('#g_name').value.trim();
    if (!name) return toast('Nhập tên mục tiêu');
    if (S.acc.some(a => a.name.toLowerCase() === name.toLowerCase())) return toast('Đã có tài khoản tên “' + name + '”, hãy đặt tên khác');
    const r = await act([{ op: 'acc.save', acc: { name, type: 'Tiết kiệm', open: 0 }, old: null }], 'Đã tạo mục tiêu “' + name + '”');
    if (!r.ok) return;
    GOALS.push({ id: newId(), name, acc: name, target, due, at: Date.now() });
    goalsSave();
    render();
}

function goalMove(i, dir) {
    const g = GOALS[i];
    if (!goalAcc(g)) return toast('Tài khoản của mục tiêu này không còn tồn tại');
    const others = ownAcc().filter(a => a.name !== g.acc), src = others.find(a => a.type !== 'Tiết kiệm') || others[0];
    if (!src) return toast('Cần thêm một tài khoản khác để chuyển tiền');
    openForm(null, 'Chuyển khoản');
    E.acc = dir > 0 ? src.name : g.acc;
    E.accTo = dir > 0 ? g.acc : src.name;
    E.note = 'Mục tiêu: ' + g.name;
    const s = goalStat(g);
    if (dir > 0 && s.need) E.amount = Math.ceil(s.need / 1000) * 1000;
    form();
}

async function goalDel(i) {
    const g = GOALS[i];
    const ok = await ask('Xóa mục tiêu “' + g.name + '”?', 'Chỉ xóa mục tiêu. Tài khoản “' + g.acc + '” và số dư trong đó vẫn còn, bạn có thể xóa riêng ở mục Tài khoản.', { danger: true, ok: 'Xóa mục tiêu' });
    if (!ok) return;
    GOALS.splice(i, 1);
    goalsSave();
    render();
    toast('Đã xóa mục tiêu');
}

document.addEventListener('click', e => {
    const b = e.target.closest('[data-gnew],[data-gdep],[data-gwd],[data-gedit],[data-gdel],[data-gsave]');
    if (!b) return;
    const d = b.dataset;
    if (d.gnew !== undefined) return goalForm(null);
    if (d.gsave !== undefined) return goalSave();
    if (d.gdep !== undefined) return goalMove(+d.gdep, 1);
    if (d.gwd !== undefined) return goalMove(+d.gwd, -1);
    if (d.gedit !== undefined) return goalForm(+d.gedit);
    if (d.gdel !== undefined) return goalDel(+d.gdel);
});

/* ===== trash.js ===== */
/* Thùng rác: định dạng thời gian, nhóm theo ngày, lọc theo loại, khôi phục an toàn (kiểm tra trùng / thiếu tài khoản), khôi phục hàng loạt */
let TF = 'all';
const TRK = { gd: 'Giao dịch', tk: 'Tài khoản', dm: 'Hạng mục' };
const trTime = x => { const t = Date.parse(x.at); return isNaN(t) ? 0 : t; };
const trKey = x => [x.k, x.at, x.id || ''].join('|');
const trDay = t => {
    if (!t) return 'Không rõ thời gian';
    const d = ymd(new Date(t)), n = new Date(), y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    return d === ymd(n) ? 'Hôm nay' : d === ymd(y) ? 'Hôm qua' : new Date(t).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const trHM = t => t ? hm(new Date(t)) : '';
function trRow(x) {
    const t = trTime(x);
    let ico, title, sub;
    if (x.k === 'gd') {
        const sg = x.type === 'Chi' ? '−' : x.type === 'Thu' ? '+' : '';
        ico = x.type === 'Chuyển khoản' ? '⇄' : x.type === 'Điều chỉnh' ? '±' : emo(x.sub || x.cat);
        title = (x.type === 'Chuyển khoản' ? esc(x.acc) + ' → ' + esc(x.accTo) : esc(x.sub || x.cat || x.type)) + ' · <span class="' + (CLS[x.type] || '') + '">' + sg + num(x.amount) + '</span>';
        sub = esc([x.date, x.type === 'Chuyển khoản' ? '' : x.acc, noteTxt(x.note)].filter(Boolean).join(' · '));
    } else if (x.k === 'tk') {
        ico = '🏦';
        title = esc(x.id);
        sub = 'Tài khoản';
    } else {
        ico = emo(x.cat);
        title = esc(x.cat) + ' › ' + esc(x.sub);
        sub = 'Hạng mục';
    }
    return `<div class="row"><span class="dot">${ico}</span><span class="m"><b>${title}</b><small>${sub}${t ? ' · xóa lúc ' + trHM(t) : ''}</small></span><button class="chip" data-trr="${esc(trKey(x))}">Khôi phục</button><button class="chip dgr" data-trx="${esc(trKey(x))}" title="Xóa hẳn khỏi thùng rác">Xóa hẳn</button></div>`;
}
function trashPage() {
    const all = S.trash.map((x, i) => ({ x, i, t: trTime(x) })).sort((a, b) => b.t - a.t || a.i - b.i);
    const L = all.filter(o => TF === 'all' || o.x.k === TF), cnt = k => k === 'all' ? all.length : all.filter(o => o.x.k === k).length;
    let h = '', last = '';
    L.forEach(o => {
        const d = trDay(o.t);
        if (d !== last) {
            last = d;
            h += `<div class="dh"><span>${esc(d)}</span><span>${L.filter(z => trDay(z.t) === d).length} mục</span></div>`;
        }
        h += trRow(o.x);
    });
    const chips = ['all', 'gd', 'tk', 'dm'].map(k => `<button type="button" class="chip ${TF === k ? 'on' : ''}" data-trf="${k}">${k === 'all' ? 'Tất cả' : TRK[k]} (${cnt(k)})</button>`).join('');
    return head('Thùng rác', all.length ? all.length + ' mục đã xóa, có thể khôi phục' : 'Các mục đã xóa có thể được khôi phục', (L.length > 1 ? `<button class="btn p" data-trall>Khôi phục ${TF === 'all' ? 'tất cả' : L.length + ' mục'}</button>` : '') + (L.length ? `<button class="btn d" data-trempty>Dọn thùng rác</button>` : ''))
        + (all.length ? `<div class="chips" style="margin-bottom:14px">${chips}</div>` : '')
        + `<div class="card flush">${h || empty('Thùng rác trống', 'Các giao dịch, tài khoản, hạng mục bạn xóa sẽ nằm ở đây để khôi phục.')}</div>`;
}
const trConflict = x => x.k === 'tk' && S.acc.some(a => a.name === x.id) ? 'Đã có tài khoản tên “' + x.id + '”. Hãy đổi tên tài khoản đó trước khi khôi phục.'
    : x.k === 'dm' && S.cat.some(c => c.p === x.cat && c.c === x.sub) ? 'Hạng mục “' + x.cat + ' › ' + x.sub + '” đã tồn tại.' : '';
async function trRestore(key) {
    const [k, at, id] = key.split('|'), x = S.trash.find(t => t.k === k && t.at === at && String(t.id || '') === id);
    if (!x) return toast('Mục này đã được khôi phục hoặc không còn trong thùng rác');
    const bad = trConflict(x);
    if (bad) return toast(bad);
    const ops = [];
    if (k === 'gd') {
        for (const n of [x.acc, x.accTo].filter(Boolean)) {
            if (S.acc.some(a => a.name === n)) continue;
            const tr = S.trash.find(t => t.k === 'tk' && t.id === n);
            if (tr) {
                if (!await ask('Khôi phục cả tài khoản “' + n + '”?', 'Giao dịch này thuộc tài khoản đang nằm trong Thùng rác.', { icon: '🏦', ok: 'Khôi phục cả hai' })) return;
                ops.push({ op: 'restore', at: tr.at, kind: 'tk' });
            } else if (!await ask('Tài khoản “' + n + '” không còn', 'Giao dịch sẽ được khôi phục nhưng không thuộc tài khoản nào đang có, số dư sẽ không khớp.', { icon: '⚠️', ok: 'Vẫn khôi phục' })) return;
        }
    }
    ops.push({ op: 'restore', at: x.at, kind: k });
    act(ops, 'Đã khôi phục');
}
async function trRestoreAll() {
    const L = S.trash.filter(x => TF === 'all' || x.k === TF).slice().sort((a, b) => ({ tk: 0, dm: 1, gd: 2 }[a.k] - { tk: 0, dm: 1, gd: 2 }[b.k]));
    const ok = L.filter(x => !trConflict(x)), skip = L.length - ok.length, tkIn = new Set(ok.filter(x => x.k === 'tk').map(x => x.id));
    const orph = ok.filter(x => x.k === 'gd' && [x.acc, x.accTo].filter(Boolean).some(n => !S.acc.some(a => a.name === n) && !tkIn.has(n))).length;
    if (!ok.length) return toast('Không có mục nào khôi phục được (trùng tên với mục đang có)');
    const msg = (skip ? skip + ' mục trùng tên với mục đang có sẽ được bỏ qua. ' : '') + (orph ? orph + ' giao dịch thuộc tài khoản không còn tồn tại. ' : '') + 'Khôi phục ' + ok.length + ' mục?';
    if (!await ask('Khôi phục ' + ok.length + ' mục', msg, { icon: '♻️', ok: 'Khôi phục' })) return;
    act(ok.map(x => ({ op: 'restore', at: x.at, kind: x.k })), 'Đã khôi phục ' + ok.length + ' mục');
}
function edelMsg(kind, o) {
    let s = '';
    if (kind === 'tk') {
        const n = S.tx.filter(t => t.acc === o.name || t.accTo === o.name).length, g = typeof GOALS !== 'undefined' ? GOALS.filter(x => x.acc === o.name).length : 0;
        if (n) s += 'Tài khoản đang có ' + n + ' giao dịch. ';
        if (g) s += 'Mục tiêu gắn với tài khoản này sẽ mất liên kết. ';
    } else if (kind === 'dm') {
        const n = S.tx.filter(t => t.cat === o.p && t.sub === o.c).length;
        if (n) s += 'Có ' + n + ' giao dịch đang dùng hạng mục này, chúng sẽ hiện ở mục “Chưa có trong danh mục”. ';
    }
    return s + 'Bạn có thể khôi phục lại trong Thùng rác.';
}
const trImgs = L => L.reduce((n, x) => n + (x.k === 'gd' ? splitImg(x.note).imgs.length : 0), 0);
async function trPurge(L, all) {
    if (!L.length) return;
    const n = trImgs(L), msg = (all ? 'Xóa hẳn ' + L.length + ' mục trong thùng rác. ' : 'Xóa hẳn mục này khỏi thùng rác. ') + (n ? n + ' ảnh đính kèm trên Drive cũng sẽ bị xóa (nếu không còn giao dịch nào dùng). ' : '') + 'Không thể khôi phục.';
    if (!await ask(all ? 'Dọn thùng rác?' : 'Xóa hẳn mục này?', msg, { danger: 1, ok: 'Xóa hẳn', icon: '🗑️' })) return;
    act([{ op: 'trash.purge', items: L.map(x => ({ at: x.at, kind: x.k, id: x.id || '' })) }], all ? 'Đã dọn ' + L.length + ' mục' : 'Đã xóa hẳn');
}
document.addEventListener('click', e => {
    const r = e.target.closest('[data-trr]'), f = e.target.closest('[data-trf]'), a = e.target.closest('[data-trall]'), px = e.target.closest('[data-trx]'), pe = e.target.closest('[data-trempty]');
    if (px) { const [k, at, id] = px.dataset.trx.split('|'); return trPurge(S.trash.filter(t => t.k === k && t.at === at && String(t.id || '') === id)); }
    if (pe) return trPurge(S.trash.filter(x => TF === 'all' || x.k === TF), true);
    if (r) return trRestore(r.dataset.trr);
    if (f) { TF = f.dataset.trf; return render(); }
    if (a) return trRestoreAll();
});

/* ===== extras.js ===== */
/* Tính năng bổ sung (lưu cục bộ trên máy):
   giao dịch định kỳ, sổ nợ, thẻ tín dụng, nhịp chi theo hạn mức, dự báo cuối tháng,
   bộ lọc đã lưu, nhập giọng nói, xuất Excel, in PDF. */
(function () {
    const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    let XD = { rec: [], debt: [], card: {}, flt: [] };
    try { Object.assign(XD, JSON.parse(localStorage.stcx || '{}')); } catch (e) { }
    const xsave = () => { try { localStorage.stcx = JSON.stringify(XD); } catch (e) { } };
    const xid = () => Math.random().toString(36).slice(2, 8);
    const dayOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const dimOf = (y, m) => new Date(y, m + 1, 0).getDate();
    const dmy = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    const parseD = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
    const val = id => ($('#' + id) || {}).value;
    const dayHit = (d, day) => d.getDate() === Math.min(+day, dimOf(d.getFullYear(), d.getMonth()));

    /* ---------- Giao dịch định kỳ ---------- */
    const rcMatch = (r, d) => { const s = parseD(r.start); if (s && d < s) return false; return r.freq === 'w' ? d.getDay() === +r.day : dayHit(d, r.day); };
    function rcNext(r) { const t = dayOf(new Date()); for (let i = 0; i < 400; i++) { const d = addD(t, i); if (rcMatch(r, d)) return d; } return null; }
    function rcValid(r) {
        if (!S.acc.some(a => a.name === r.acc)) return 'Tài khoản “' + r.acc + '” không còn';
        if (!catOk(r.type, r.cat, r.sub)) return 'Hạng mục không còn trong danh mục';
        return '';
    }
    function rcRun() {
        if (!S.ready || S.busy || !S.synced || !alive()) return;
        const today = dayOf(new Date()), ts = ymd(today), rows = [], mark = [], ids = new Set(S.tx.map(t => t.id));
        XD.rec.forEach(r => {
            if (!r.on) return;
            const bad = rcValid(r);
            if (bad) { if (r.err !== bad) { r.err = bad; xsave(); } return; }
            if (r.err) { delete r.err; xsave(); }
            const s = parseD(r.start) || today, l = parseD(r.last);
            let cur = new Date(Math.max(+s, l ? +addD(l, 1) : +s, +addD(today, -62)));
            if (r.last === ts) return;
            for (; ymd(cur) <= ts; cur = addD(cur, 1)) {
                if (!rcMatch(r, cur)) continue;
                const date = ymd(cur), id = 'R' + r.id + '_' + date;
                if (ids.has(id)) continue;
                rows.push({ id, date, type: r.type, amount: r.amount, acc: r.acc, accTo: '', cat: r.cat, sub: r.sub, note: (r.name || 'Định kỳ') + ' (định kỳ)', at: date + 'T08:00:00' });
            }
            mark.push([r, r.last]);
            r.last = ts;
        });
        if (!mark.length) return;
        xsave();
        if (!rows.length) return;
        commit(rows.map(row => ({ op: 'tx.save', row })), { ok: 'Đã tự ghi ' + rows.length + ' giao dịch định kỳ', title: 'Giao dịch định kỳ', ico: '🔁', kind: 'tx', tag: 'rc', local: () => { S.tx = S.tx.concat(rows); } })
            .then(res => { if (!res.ok) { mark.forEach(([r, p]) => { r.last = p; }); xsave(); } });
    }
    function rcPending() {
        const t = dayOf(new Date()), end = new Date(t.getFullYear(), t.getMonth() + 1, 0), o = { chi: 0, thu: 0 };
        XD.rec.forEach(r => { if (!r.on || rcValid(r)) return; for (let d = addD(t, 1); d <= end; d = addD(d, 1)) if (rcMatch(r, d)) o[r.type === 'Chi' ? 'chi' : 'thu'] += r.amount; });
        return o;
    }
    function rcPage() {
        const L = XD.rec.map((r, i) => ({ r, i, n: rcNext(r) }));
        const mon = L.filter(x => x.r.on && x.r.type === 'Chi').reduce((s, x) => s + x.r.amount * (x.r.freq === 'w' ? 4.33 : 1), 0);
        return head('Giao dịch định kỳ', 'Tự ghi các khoản lặp lại như tiền nhà, internet, lương', `<button class="btn p" data-rcnew>${ic('pl')}Thêm định kỳ</button>`)
            + (L.length ? `<div class="kpis">${kpi('Chi định kỳ / tháng', vnd(mon), 'chi', L.filter(x => x.r.on).length + ' quy tắc đang bật', 'h')}</div>` : '')
            + `<div class="card flush">${L.map(({ r, i, n }) => `<div class="row"><span class="dot">${emo(r.sub || r.cat)}</span><span class="m"><b>${esc(r.name)}</b><small>${r.freq === 'w' ? 'Hằng tuần ' + DAYS[r.day] : 'Hằng tháng ngày ' + r.day} · ${esc(r.acc)}${r.err ? ' · <span class="chi">' + esc(r.err) + '</span>' : n && r.on ? ' · tiếp theo ' + dmy(n) : ''}</small></span><span class="am"><b class="sens ${CLS[r.type]}">${r.type === 'Chi' ? '−' : '+'}${num(r.amount)}</b></span><button class="chip ${r.on ? 'on' : ''}" data-rct="${i}">${r.on ? 'Bật' : 'Tạm dừng'}</button><button class="chip" data-rce="${i}">Sửa</button></div>`).join('') || empty('Chưa có giao dịch định kỳ', 'Thêm quy tắc, app sẽ tự ghi đúng ngày khi bạn mở sổ.')}</div>`
            + `<p class="hint" style="margin-top:10px">Quy tắc lưu trên thiết bị này. giao dịch được ghi bằng mã cố định theo ngày nên không bị ghi trùng nếu nhiều máy cùng chạy.</p>`;
    }
    let RC = { i: null, r: null };
    function rcRead() {
        const c = val('rc_cat') === '' ? null : S.cat[+val('rc_cat')];
        return { ...RC.r, name: val('rc_name').trim(), type: val('rc_type'), amount: pm(val('rc_amt')), acc: val('rc_acc'), cat: c ? c.p : '', sub: c ? c.c : '', freq: val('rc_freq'), day: +val('rc_day') || 1, start: val('rc_start') || ymd(new Date()) };
    }
    function rcForm(i, dr) {
        const r = dr || (i == null ? { id: xid(), name: '', type: 'Chi', amount: 0, acc: (ownAcc()[0] || {}).name || '', cat: '', sub: '', freq: 'm', day: new Date().getDate(), start: ymd(new Date()), on: true, last: ymd(addD(new Date(), -1)) } : { ...XD.rec[i] });
        RC = { i, r }; ED = null; E = null;
        const cats = S.cat.map((c, k) => ({ ...c, k })).filter(c => c.t === r.type), sel = cats.find(c => c.p === r.cat && c.c === r.sub);
        $('#sh').innerHTML = `<h3>${i == null ? 'Thêm' : 'Sửa'} giao dịch định kỳ</h3><div class="f"><label class="w">Tên<input id="rc_name" value="${esc(r.name)}" placeholder="Ví dụ: Tiền nhà"></label>
<label>Loại<select id="rc_type">${['Chi', 'Thu'].map(x => `<option ${x === r.type ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label>Số tiền<input class="money" id="rc_amt" inputmode="numeric" value="${r.amount ? num(r.amount) : ''}" placeholder="0"></label>
<label class="w">Tài khoản<select id="rc_acc">${S.acc.map(a => `<option ${a.name === r.acc ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
<label class="w">Hạng mục<select id="rc_cat"><option value="">Chọn…</option>${cats.map(c => `<option value="${c.k}" ${sel && sel.k === c.k ? 'selected' : ''}>${esc(c.p)} › ${esc(c.c)}</option>`).join('')}</select></label>
<label>Lặp lại<select id="rc_freq"><option value="m" ${r.freq === 'm' ? 'selected' : ''}>Hằng tháng</option><option value="w" ${r.freq === 'w' ? 'selected' : ''}>Hằng tuần</option></select></label>
<label>${r.freq === 'm' ? 'Ngày trong tháng' : 'Thứ'}${r.freq === 'm' ? `<input id="rc_day" type="number" min="1" max="31" value="${r.day}">` : `<select id="rc_day">${DAYS.map((d, k) => `<option value="${k}" ${k === +r.day ? 'selected' : ''}>${d}</option>`).join('')}</select>`}</label>
<label class="w">Bắt đầu từ<input type="date" id="rc_start" value="${esc(r.start)}"></label></div><p class="hint">Ngày 29–31 sẽ tự lùi về ngày cuối tháng với tháng ngắn hơn.</p>
<button class="btn p w" data-rcsave>Lưu</button>${i == null ? '' : '<button class="btn d w" data-rcdel style="margin-top:6px">Xóa quy tắc</button>'}`;
        openSheet();
    }
    function rcSave() {
        const r = rcRead();
        if (!r.name) return toast('Nhập tên');
        if (!(r.amount > 0)) return toast('Nhập số tiền lớn hơn 0');
        if (!r.cat || !r.sub) return toast('Chọn hạng mục');
        if (r.freq === 'm' && (r.day < 1 || r.day > 31)) return toast('Ngày phải từ 1 đến 31');
        if (RC.i == null) XD.rec.push(r); else XD.rec[RC.i] = r;
        xsave(); closeSheet(); render(); toast('Đã lưu giao dịch định kỳ'); rcRun();
    }
    async function rcDel() {
        if (!await ask('Xóa quy tắc định kỳ?', 'Các giao dịch đã ghi trước đó được giữ nguyên.', { danger: 1, ok: 'Xóa' })) return;
        XD.rec.splice(RC.i, 1); xsave(); closeSheet(); render();
    }

    /* ---------- Sổ nợ ---------- */
    const dbLeft = d => Math.max(0, d.amount - (d.paid || 0));
    function dbPage() {
        const L = XD.debt.map((d, i) => ({ d, i })).sort((a, b) => (dbLeft(a.d) === 0) - (dbLeft(b.d) === 0) || (a.d.due || '9999').localeCompare(b.d.due || '9999'));
        const sum = dir => XD.debt.filter(d => d.dir === dir).reduce((s, d) => s + dbLeft(d), 0), today = ymd(new Date());
        return head('Sổ nợ', 'Theo dõi khoản bạn nợ và khoản cho vay', `<button class="btn p" data-dbnew>${ic('pl')}Thêm khoản</button>`)
            + (L.length ? `<div class="kpis">${kpi('Mình đang nợ', vnd(sum('owe')), 'chi', XD.debt.filter(d => d.dir === 'owe' && dbLeft(d)).length + ' khoản', 'h')}${kpi('Người khác nợ mình', vnd(sum('lent')), 'thu', XD.debt.filter(d => d.dir === 'lent' && dbLeft(d)).length + ' khoản')}</div>` : '')
            + (L.length ? `<div class="col">${L.map(({ d, i }) => {
                const left = dbLeft(d), pct = Math.min(100, Math.floor((d.paid || 0) / d.amount * 100)), late = left && d.due && d.due < today;
                return `<div class="card dcard"><div class="dtop"><span class="dot lg">${d.dir === 'owe' ? '🔴' : '🟢'}</span><div class="dtt"><h2>${esc(d.who)}</h2><p>${d.dir === 'owe' ? 'Mình nợ' : 'Họ nợ mình'} ${vnd(d.amount)}${d.due ? ' · hạn ' + d.due.slice(8) + '/' + d.due.slice(5, 7) + '/' + d.due.slice(0, 4) : ''}${d.note ? ' · ' + esc(d.note) : ''}</p></div><div class="dbal"><small>Còn lại</small><b class="sens ${left ? (d.dir === 'owe' ? 'chi' : 'thu') : ''}">${vnd(left)}</b></div></div>
<div class="bar" style="--bc:${left ? 'var(--acc)' : 'var(--thu)'};margin-top:14px"><div><span>${pct}%</span><span class="mut sens">${num(d.paid || 0)} / ${num(d.amount)}</span></div><i><s style="width:${pct}%"></s></i></div>
${late ? '<p class="note chi">Đã quá hạn</p>' : !left ? '<p class="note thu">Đã tất toán</p>' : ''}
<div class="cg" style="margin-top:12px">${left ? `<button class="btn p" data-dbpay="${i}">${d.dir === 'owe' ? 'Ghi nhận đã trả' : 'Ghi nhận đã thu'}</button>` : ''}<button class="btn" data-dbe="${i}">Sửa</button></div></div>`;
            }).join('')}</div>` : `<div class="card">${empty('Chưa có khoản nợ nào', 'Thêm khoản bạn nợ hoặc cho vay để theo dõi ngày hẹn và số còn lại.')}</div>`);
    }
    let DB = { i: null };
    function dbForm(i) {
        const d = i == null ? { who: '', dir: 'owe', amount: 0, due: '', note: '' } : XD.debt[i];
        DB = { i }; ED = null; E = null;
        $('#sh').innerHTML = `<h3>${i == null ? 'Thêm khoản nợ' : 'Sửa khoản nợ'}</h3><div class="f"><label class="w">Người liên quan<input id="db_who" value="${esc(d.who)}" placeholder="Tên người"></label>
<label class="w">Loại<select id="db_dir"><option value="owe" ${d.dir === 'owe' ? 'selected' : ''}>Mình nợ người khác</option><option value="lent" ${d.dir === 'lent' ? 'selected' : ''}>Người khác nợ mình</option></select></label>
<label>Số tiền<input class="money" id="db_amt" inputmode="numeric" value="${d.amount ? num(d.amount) : ''}" placeholder="0"></label><label>Hạn trả, không bắt buộc<input type="date" id="db_due" value="${esc(d.due || '')}"></label>
<label class="w">Ghi chú<input id="db_note" value="${esc(d.note || '')}" placeholder="Không bắt buộc"></label></div><button class="btn p w" data-dbsave>Lưu</button>${i == null ? '' : '<button class="btn d w" data-dbdel style="margin-top:6px">Xóa khoản này</button>'}`;
        openSheet();
    }
    function dbSave() {
        const who = val('db_who').trim(), amount = pm(val('db_amt'));
        if (!who) return toast('Nhập tên người');
        if (!(amount > 0)) return toast('Nhập số tiền lớn hơn 0');
        const o = { who, dir: val('db_dir'), amount, due: val('db_due') || '', note: val('db_note').trim() };
        if (DB.i == null) XD.debt.push({ id: xid(), paid: 0, at: Date.now(), ...o }); else Object.assign(XD.debt[DB.i], o);
        xsave(); closeSheet(); render(); toast('Đã lưu');
    }
    async function dbDel() {
        if (!await ask('Xóa khoản này?', 'Chỉ xóa ghi chú trong Sổ nợ, không ảnh hưởng giao dịch.', { danger: 1, ok: 'Xóa' })) return;
        XD.debt.splice(DB.i, 1); xsave(); closeSheet(); render();
    }
    function dbPay(i) {
        const d = XD.debt[i]; DB = { i }; ED = null; E = null;
        $('#sh').innerHTML = `<h3>${d.dir === 'owe' ? 'Đã trả cho' : 'Đã thu từ'} ${esc(d.who)}</h3><p class="hint" style="margin-bottom:10px">Còn lại ${vnd(dbLeft(d))}</p><div class="f"><label class="w">Số tiền<input class="money" id="db_pay" inputmode="numeric" value="${num(dbLeft(d))}"></label></div><button class="btn p w" data-dbpaygo>Xác nhận</button>`;
        openSheet();
    }
    async function dbPayGo() {
        const d = XD.debt[DB.i], a = Math.min(pm(val('db_pay')), dbLeft(d));
        if (!(a > 0)) return toast('Nhập số tiền');
        d.paid = (d.paid || 0) + a; xsave(); closeSheet(); render();
        if (await ask('Ghi vào sổ thu chi?', 'Tạo giao dịch ' + (d.dir === 'owe' ? 'Chi' : 'Thu') + ' ' + num(a) + ' để số dư tài khoản khớp.', { icon: '🧾', ok: 'Ghi', cancel: 'Để sau' }))
            qOpen({ type: d.dir === 'owe' ? 'Chi' : 'Thu', amount: a, date: todayS(), time: hm(new Date()), note: (d.dir === 'owe' ? 'Trả nợ ' : 'Thu nợ ') + d.who, cat: '', sub: '', acc: '', accTo: '' });
    }

    /* ---------- Thẻ tín dụng ---------- */
    const cdLast = (day, t) => { let d = new Date(t.getFullYear(), t.getMonth(), Math.min(day, dimOf(t.getFullYear(), t.getMonth()))); if (d > t) { const p = new Date(t.getFullYear(), t.getMonth() - 1, 1); d = new Date(p.getFullYear(), p.getMonth(), Math.min(day, dimOf(p.getFullYear(), p.getMonth()))); } return d; };
    const cdNext = (day, t) => { let d = new Date(t.getFullYear(), t.getMonth(), Math.min(day, dimOf(t.getFullYear(), t.getMonth()))); if (d < t) { const n = new Date(t.getFullYear(), t.getMonth() + 1, 1); d = new Date(n.getFullYear(), n.getMonth(), Math.min(day, dimOf(n.getFullYear(), n.getMonth()))); } return d; };
    function cdInfo(a) {
        const c = XD.card[a.name] || {}, t = dayOf(new Date()), debt = Math.max(0, -bal(a)), o = { a, c, debt };
        if (c.stmt) { const ls = cdLast(+c.stmt, t); o.ls = ls; o.ns = cdNext(+c.stmt, t); o.cycle = S.tx.filter(x => x.type === 'Chi' && x.acc === a.name && x.date > ymd(ls) && x.date <= ymd(t)).reduce((s, x) => s + x.amount, 0); }
        if (c.due) { o.nd = cdNext(+c.due, t); o.dl = Math.round((o.nd - t) / 864e5); }
        return o;
    }
    function cdPage() {
        const L = S.acc.filter(a => a.type === 'Thẻ tín dụng').map(cdInfo), tot = L.reduce((s, x) => s + x.debt, 0);
        return head('Thẻ tín dụng', 'Ngày sao kê, ngày đến hạn và dư nợ từng thẻ')
            + (L.length ? `<div class="kpis">${kpi('Tổng dư nợ thẻ', vnd(tot), tot ? 'chi' : '', L.length + ' thẻ', 'h')}</div>` : '')
            + (L.length ? `<div class="col">${L.map(x => {
                const warn = x.debt > 0 && x.dl != null && x.dl <= 3, pct = x.c.limit ? Math.min(100, Math.round(x.debt / x.c.limit * 100)) : 0;
                return `<div class="card dcard"><div class="dtop">${aIco(x.a)}<div class="dtt"><h2>${esc(x.a.name)}</h2><p>${x.c.stmt ? 'Sao kê ngày ' + x.c.stmt : 'Chưa đặt ngày sao kê'}${x.c.due ? ' · hạn thanh toán ngày ' + x.c.due : ''}</p></div><div class="dbal"><small>Dư nợ</small><b class="sens ${x.debt ? 'chi' : ''}">${vnd(x.debt)}</b></div></div>
${x.c.limit ? `<div class="bar" style="--bc:${pct > 80 ? 'var(--chi)' : 'var(--acc)'};margin-top:14px"><div><span>Hạn mức ${vnd(x.c.limit)}</span><span class="mut">${pct}%</span></div><i><s style="width:${pct}%"></s></i></div>` : ''}
${x.ls ? `<p class="note">Chi từ kỳ sao kê gần nhất (${dmy(x.ls)}): <b class="sens">${vnd(x.cycle)}</b>. Sao kê tiếp theo ${dmy(x.ns)}.</p>` : ''}
${x.nd ? `<p class="note ${warn ? 'chi' : ''}">${x.dl === 0 ? 'Hôm nay là hạn thanh toán' : 'Còn ' + x.dl + ' ngày đến hạn thanh toán (' + dmy(x.nd) + ')'}${warn ? '. Nhớ thanh toán!' : ''}</p>` : ''}
<div class="cg" style="margin-top:12px"><button class="btn p" data-cde="${esc(x.a.name)}">Thiết lập</button></div></div>`;
            }).join('')}</div>` : `<div class="card">${empty('Chưa có thẻ tín dụng', 'Thêm tài khoản loại “Thẻ tín dụng” ở mục Tài khoản.')}</div>`);
    }
    let CD = '';
    function cdForm(n) {
        const c = XD.card[n] || {}; CD = n; ED = null; E = null;
        $('#sh').innerHTML = `<h3>Thiết lập thẻ ${esc(n)}</h3><div class="f"><label>Ngày sao kê<input id="cd_stmt" type="number" min="1" max="31" value="${esc(c.stmt || '')}" placeholder="VD 25"></label><label>Ngày đến hạn<input id="cd_due" type="number" min="1" max="31" value="${esc(c.due || '')}" placeholder="VD 15"></label>
<label class="w">Hạn mức thẻ<input class="money" id="cd_lim" inputmode="numeric" value="${c.limit ? num(c.limit) : ''}" placeholder="Không bắt buộc"></label></div><p class="hint">Để trống ô nào thì bỏ thiết lập ô đó. App sẽ nhắc trước hạn thanh toán 3 ngày nếu thẻ còn dư nợ.</p><button class="btn p w" data-cdsave>Lưu</button>`;
        openSheet();
    }
    function cdSave() {
        const g = id => { const v = +val(id); return v >= 1 && v <= 31 ? v : 0; };
        XD.card[CD] = { stmt: g('cd_stmt'), due: g('cd_due'), limit: pm(val('cd_lim')) };
        xsave(); closeSheet(); render(); toast('Đã lưu');
    }

    /* ---------- Nhịp chi theo hạn mức + dự báo cuối tháng ---------- */
    const curMonth = () => S.m === ymd(new Date()).slice(0, 7);
    function pace() {
        const n = new Date(), D = dimOf(n.getFullYear(), n.getMonth()), d = n.getDate();
        return limCalc().filter(x => x.per === 'Tháng' && x.v > 0).map(x => ({ x, rem: x.v - x.used, perDay: Math.max(0, (x.v - x.used) / (D - d + 1)), proj: x.used / d * D }));
    }
    function paceCard() {
        if (!curMonth()) return '';
        const P = pace();
        if (!P.length) return '';
        return `<div class="card" style="margin-top:14px"><div class="ch">Nhịp chi tháng này <small>dự báo theo tốc độ chi hiện tại</small></div>${P.map(({ x, rem, perDay, proj }) => `<div class="row" style="border:0;padding:8px 0"><span class="dot">${x.cat ? emo(x.cat) : '∑'}</span><span class="m"><b>${esc(x.name)}</b><small class="sens">${rem >= 0 ? 'Còn ' + vnd(rem) + ', nên chi tối đa ' + vnd(perDay) + '/ngày' : 'Đã vượt ' + vnd(-rem)}</small></span><span class="am"><b class="sens ${proj > x.v ? 'chi' : 'thu'}">${vnd(proj)}</b><small>${proj > x.v ? 'dự báo vượt ' + vnd(proj - x.v) : 'dự báo trong hạn mức'}</small></span></div>`).join('')}</div>`;
    }
    function forecastCard() {
        const n = new Date(), D = dimOf(n.getFullYear(), n.getMonth()), d = n.getDate(), left = D - d, { chi } = sums(S.m);
        if (d < 3 || !chi) return '';
        const total = ownAcc().reduce((s, a) => s + bal(a), 0), avg = chi / d, pd = rcPending(), est = total - avg * left - pd.chi + pd.thu;
        return `<div class="card insight" style="margin-bottom:16px"><span>Dự báo cuối tháng: số dư khoảng <b class="sens ${est < 0 ? 'chi' : ''}">${vnd(est)}</b>, tổng chi cả tháng khoảng <b class="sens">${vnd(chi + avg * left + pd.chi)}</b> (trung bình ${vnd(avg)}/ngày, còn ${left} ngày${pd.chi || pd.thu ? ', đã tính định kỳ sắp tới' : ''}). Chỉ là ước tính.</span></div>`;
    }
    const _home = home; home = function () { const h = _home(); return curMonth() ? h.replace('<div class="grid a">', () => forecastCard() + '<div class="grid a">') : h; };
    const _limPage = limPage; limPage = function () { return _limPage() + paceCard(); };

    /* ---------- Bộ lọc đã lưu ---------- */
    const FK = ['f', 'xa', 'xc', 'mn', 'mx', 'rg', 'd1', 'd2', 'so', 'q'], FD = { f: 'all', xa: '', xc: '', mn: '', mx: '', rg: 'm', d1: '', d2: '', so: 'dn', q: '' };
    let fltMg = false;
    const fltDirty = () => FK.some(k => S[k] !== FD[k]);
    function fltBar() {
        const chips = XD.flt.map((p, i) => fltMg ? `<span class="chip tx"><span>${esc(p.name)}</span><button type="button" data-fltdel="${i}" aria-label="Xóa">×</button></span>` : `<button type="button" class="chip" data-flt="${i}">🔖 ${esc(p.name)}</button>`).join('');
        const add = fltDirty() ? `<button type="button" class="chip" data-fltsave>＋ Lưu bộ lọc này</button>` : '';
        const mg = XD.flt.length ? `<button type="button" class="chip ${fltMg ? 'on' : ''}" data-fltmg>${fltMg ? 'Xong' : '✎'}</button>` : '';
        return chips || add ? `<div class="chips" style="margin-bottom:10px">${chips}${add}${mg}</div>` : '';
    }
    const _txs = txs; txs = function () { return _txs().replace('<div class="sum">', () => fltBar() + '<div class="sum">'); };

    /* ---------- Xuất Excel, in PDF ---------- */
    function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 4000); }
    /* xlsx thật: tự ghép file zip (không nén) + XML, không cần thư viện, chạy offline */
    const CRCT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRCT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    function zipStore(files) {
        const te = new TextEncoder(), parts = [], cen = []; let off = 0;
        const u16 = v => [v & 255, v >> 8 & 255], u32 = v => [v & 255, v >> 8 & 255, v >> 16 & 255, v >>> 24 & 255];
        files.forEach(([name, text]) => {
            const nm = te.encode(name), d = te.encode(text), crc = crc32(d);
            const h = new Uint8Array([0x50, 0x4B, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0)]);
            parts.push(h, nm, d);
            cen.push(new Uint8Array([0x50, 0x4B, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
            off += h.length + nm.length + d.length;
        });
        const cl = cen.reduce((t, x) => t + x.length, 0);
        return new Blob([...parts, ...cen, new Uint8Array([0x50, 0x4B, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), 0, 0])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    const xcol = i => { let s = ''; for (i++; i > 0; i = (i - 1) / 26 | 0) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
    const xtxt = v => String(v ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    /* ô: số -> number; {n, s} -> style; chữ -> inlineStr. style: 1 đậm+nền, 2 số #,##0, 3 đậm số, 4 phần trăm, 5 đậm */
    function xsheet(rows, widths, freeze) {
        const body = rows.map((r, y) => '<row r="' + (y + 1) + '">' + r.map((c, x) => {
            if (c == null || c === '') return '';
            let v = c, st = 0; if (typeof c === 'object') { v = c.v; st = c.s; }
            const ref = xcol(x) + (y + 1);
            return typeof v === 'number' && isFinite(v)
                ? '<c r="' + ref + '"' + (st ? ' s="' + st + '"' : '') + '><v>' + v + '</v></c>'
                : '<c r="' + ref + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t xml:space="preserve">' + xtxt(v) + '</t></is></c>';
        }).join('') + '</row>').join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + (freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '')
            + '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols><sheetData>' + body + '</sheetData></worksheet>';
    }
    function xlsExport() {
        const m = S.m, L = S.tx.filter(t => inM(t, m)).sort((a, b) => a.date.localeCompare(b.date) || (a.at || '').localeCompare(b.at || '')), { thu, chi } = sums(m), cats = group(chiM(m), t => t.cat || 'Chưa phân loại');
        const H = a => a.map(v => ({ v, s: 1 }));
        const s1 = [[{ v: 'Báo cáo ' + mlabel(m), s: 5 }], [], [{ v: 'Thu', s: 5 }, { v: thu, s: 2 }], [{ v: 'Chi', s: 5 }, { v: chi, s: 2 }], [{ v: 'Còn lại', s: 5 }, { v: thu - chi, s: 3 }], [],
            H(['Hạng mục chi', 'Số tiền', 'Tỷ lệ']), ...cats.map(([k, v]) => [k, { v, s: 2 }, { v: chi ? v / chi : 0, s: 4 }])];
        const s2 = [H(['Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Đến tài khoản', 'Hạng mục', 'Chi tiết', 'Ghi chú']),
            ...L.map(t => [t.date, t.type, { v: Number(t.amount) || 0, s: 2 }, t.acc, t.accTo, t.cat, t.sub, noteTxt(t.note)])];
        const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', RN = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        const styles = X + '<styleSheet ' + NS + '><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
            + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3E9FD"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
            + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
        const blob = zipStore([
            ['[Content_Types].xml', X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
            ['_rels/.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + RN + '/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
            ['xl/workbook.xml', X + '<workbook ' + NS + ' xmlns:r="' + RN + '"><sheets><sheet name="Tổng quan" sheetId="1" r:id="rId1"/><sheet name="Giao dịch" sheetId="2" r:id="rId2"/></sheets></workbook>'],
            ['xl/_rels/workbook.xml.rels', X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + RN + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + RN + '/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="' + RN + '/styles" Target="styles.xml"/></Relationships>'],
            ['xl/styles.xml', styles],
            ['xl/worksheets/sheet1.xml', xsheet(s1, [24, 16, 10], false)],
            ['xl/worksheets/sheet2.xml', xsheet(s2, [12, 9, 14, 18, 18, 20, 20, 40], true)]
        ]);
        dl(blob, 'so-thu-chi-' + m + '.xlsx');
    }
    window.extraMenu = () => [['dl', 'Xuất báo cáo tháng (Excel)', 'xls'], ['dl', 'In / lưu PDF trang đang xem', 'pdf']].map(([i, t, k]) => `<button class="row" data-x="${k}">${ic(i)}<span class="m"><b>${t}</b></span></button>`).join('');

    /* ---------- Nhắc nhở nền ---------- */
    function xTick() {
        if (!S.ready || !alive()) return;
        rcRun();
        if (typeof notify !== 'function' || typeof fired === 'undefined') return;
        const t = dayOf(new Date());
        S.acc.filter(a => a.type === 'Thẻ tín dụng').map(cdInfo).forEach(x => {
            if (!x.nd || !(x.debt > 0) || x.dl > 3) return;
            const k = 'card:' + x.a.name + ':' + ymd(x.nd);
            if (fired(k)) return; markFired(k);
            notify(x.a.name + ': còn ' + (x.dl ? x.dl + ' ngày' : 'hôm nay') + ' đến hạn thanh toán (' + dmy(x.nd) + ')\nDư nợ ' + vnd(x.debt), { title: 'Sắp đến hạn thẻ tín dụng', ico: '💳', kind: 'remind', tag: 'card', bg: true, tab: 'card' });
        });
        XD.debt.forEach(d => {
            if (!dbLeft(d) || !d.due) return;
            const dl = Math.round((parseD(d.due) - t) / 864e5);
            if (dl > 1 || dl < 0) return;
            const k = 'debt:' + d.id + ':' + d.due; if (fired(k)) return; markFired(k);
            notify((d.dir === 'owe' ? 'Mình nợ ' : 'Họ nợ mình ') + d.who + ' ' + vnd(dbLeft(d)) + (dl ? ' · hạn ngày mai' : ' · hạn hôm nay'), { title: 'Khoản nợ sắp đến hạn', ico: '🤝', kind: 'remind', tag: 'debt', bg: true, tab: 'debt' });
        });
        if (curMonth() && t.getDate() >= 5) pace().forEach(({ x, proj }) => {
            if (x.used > x.v || proj <= x.v) return;
            const k = 'pace:' + (x.cat || '') + ':' + S.m + ':' + Math.floor(t.getDate() / 7); if (fired(k)) return; markFired(k);
            notify((x.cat ? x.cat : 'Tổng chi') + ': theo tốc độ hiện tại sẽ vượt hạn mức khoảng ' + vnd(proj - x.v) + '\nNên chi tối đa ' + vnd(Math.max(0, (x.v - x.used) / (dimOf(t.getFullYear(), t.getMonth()) - t.getDate() + 1))) + '/ngày', { title: 'Dự báo bội chi', ico: '📉', kind: 'limit', tag: 'pace', bg: true, tab: 'lim' });
        });
    }
    setInterval(xTick, 30000);
    setTimeout(xTick, 4000);

    /* ---------- Đăng ký tab + sự kiện ---------- */
    IC.rc = 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3';
    IC.debt = 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6';
    IC.card = IC.ba;
    const at = TABS.findIndex(t => t[0] === 'acc');
    TABS.splice(at < 0 ? TABS.length : at, 0, ['rc', 'Định kỳ'], ['debt', 'Sổ nợ'], ['card', 'Thẻ tín dụng']);
    VIEWS.rc = rcPage; VIEWS.debt = dbPage; VIEWS.card = cdPage;
    if (TABS.some(t => t[0] === location.hash.slice(1)) && ['rc', 'debt', 'card'].includes(location.hash.slice(1))) S.tab = location.hash.slice(1);

    document.addEventListener('change', e => {
        if (['rc_type', 'rc_freq'].includes(e.target.id) && RC.r) {
            const r = rcRead();
            if (e.target.id === 'rc_type') { r.cat = ''; r.sub = ''; }
            if (e.target.id === 'rc_freq') r.day = r.freq === 'm' ? new Date().getDate() : 1;
            rcForm(RC.i, r);
        }
    });
    document.addEventListener('click', e => {
        const g = s => e.target.closest(s);
        let b;
        if (g('[data-rcnew]')) return rcForm(null);
        if ((b = g('[data-rce]'))) return rcForm(+b.dataset.rce);
        if ((b = g('[data-rct]'))) { const r = XD.rec[+b.dataset.rct]; if (r) { r.on = !r.on; if (r.on) r.last = ymd(addD(new Date(), -1)); xsave(); render(); if (r.on) rcRun(); } return; }
        if (g('[data-rcsave]')) return rcSave();
        if (g('[data-rcdel]')) return rcDel();
        if (g('[data-dbnew]')) return dbForm(null);
        if ((b = g('[data-dbe]'))) return dbForm(+b.dataset.dbe);
        if ((b = g('[data-dbpay]'))) return dbPay(+b.dataset.dbpay);
        if (g('[data-dbsave]')) return dbSave();
        if (g('[data-dbdel]')) return dbDel();
        if (g('[data-dbpaygo]')) return dbPayGo();
        if ((b = g('[data-cde]'))) return cdForm(b.dataset.cde);
        if (g('[data-cdsave]')) return cdSave();
        if ((b = g('[data-flt]'))) { const p = XD.flt[+b.dataset.flt]; if (p) { Object.assign(S, FD, p.s, { pg: 100, fo: false }); render(); } return; }
        if (g('[data-fltsave]')) { const n = (prompt('Đặt tên cho bộ lọc này', '') || '').trim(); if (!n) return; const s = {}; FK.forEach(k => s[k] = S[k]); const i = XD.flt.findIndex(x => x.name.toLowerCase() === n.toLowerCase()); const o = { name: n, s }; if (i >= 0) XD.flt[i] = o; else XD.flt.push(o); xsave(); render(); return toast('Đã lưu bộ lọc “' + n + '”'); }
        if (g('[data-fltmg]')) { fltMg = !fltMg; return render(); }
        if ((b = g('[data-fltdel]'))) { XD.flt.splice(+b.dataset.fltdel, 1); xsave(); if (!XD.flt.length) fltMg = false; return render(); }
        if ((b = g('[data-x]'))) {
            closeSheet();
            return { xls: xlsExport, pdf: () => setTimeout(() => window.print(), 250), }[b.dataset.x]();
        }
    });
})();

/* ===== fx.js ===== */
/* Hiệu ứng vào trang + đếm số + thu gọn thanh bên */
const reduceMotion = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
function sbToggle() {
    const on = document.documentElement.classList.toggle('sbc');
    try { localStorage.sbc = on ? '1' : '0'; } catch (e) { }
    const b = $('#sbt');
    if (b) {
        b.setAttribute('aria-label', on ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên');
        b.title = (on ? 'Mở rộng' : 'Thu gọn') + ' thanh bên ( [ )';
    }
}
let _fxKey = '';
function countUp(el) {
    const t = el.textContent.trim(), m = t.match(/^([−-]?)([\d.]+)(\s*₫|%)?$/);
    if (!m) return;
    const to = +m[2].replace(/\./g, '');
    if (!to || to < 10) return;
    const t0 = performance.now(), D = 650;
    const step = now => {
        const p = Math.min(1, (now - t0) / D), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
        el.textContent = p >= 1 ? t : m[1] + (m[3] === '%' ? v : num(v)) + (m[3] || '');
        if (p < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
function fxEnter() {
    if (!S.ready) return;
    const key = S.tab + '|' + S.m;
    if (key === _fxKey) return;
    _fxKey = key;
    if (reduceMotion()) return;
    const v = $('#v');
    let i = 0;
    v.querySelectorAll('.ph,.kpis>.card,.grid>.card,.col>.card,.mdd>.card,.tb,.sum,.warn,.insight,.card.flush,.chips').forEach(e => { e.style.setProperty('--d', Math.min(i++, 9) * 45 + 'ms'); });
    v.classList.remove('pgin');
    void v.offsetWidth;
    v.classList.add('pgin');
    v.querySelectorAll('.kpi b').forEach(countUp);
    clearTimeout(fxEnter._t);
    fxEnter._t = setTimeout(() => v.classList.remove('pgin'), 1400);
}

/* ===== Âm thanh (WebAudio, không cần file) + rung + ripple + spotlight ===== */
const fxOn = () => !document.documentElement.classList.contains('fxoff');
let _ac = null, _lastTap = 0;
function audio() {
    if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (_ac.state === 'suspended') _ac.resume().catch(() => { });
    return _ac;
}
function tone(f, d, o = {}) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v || 0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + d + 0.02);
}
const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } };
const sfx = {
    tap: () => { tone(520, 0.05, { to: 380, v: 0.045 }); buzz(8); },
    nav: () => { tone(660, 0.05, { to: 500, v: 0.045 }); buzz(8); },
    ok: () => { tone(660, 0.09, { v: 0.05 }); tone(990, 0.14, { at: 0.08, v: 0.05 }); buzz(18); },
    err: () => { tone(220, 0.14, { type: 'triangle', v: 0.07 }); tone(165, 0.18, { at: 0.12, type: 'triangle', v: 0.07 }); buzz([30, 40, 30]); }
};
function fxToggle() {
    const off = document.documentElement.classList.toggle('fxoff');
    try { localStorage.fx = off ? '0' : '1'; } catch (e) { }
    if (!off) sfx.ok();
    toast('Âm thanh và rung: ' + (off ? 'Tắt' : 'Bật'));
}
document.addEventListener('pointerdown', e => {
    const b = e.target.closest('button,[data-tab],[data-a],a[href],.chip,.btn');
    if (!b || b.disabled) return;
    const n = performance.now();
    if (b.matches('.btn,.pri,.chip,.qs') && !b.querySelector('.rp')) {
        const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, sp = document.createElement('span');
        if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
        b.style.overflow = 'hidden';
        sp.className = 'rp';
        sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
        b.appendChild(sp);
        setTimeout(() => sp.remove(), 600);
    }
    if (!fxOn() || n - _lastTap < 40) return;
    _lastTap = n;
    (b.closest('[data-tab],#tb') ? sfx.nav : sfx.tap)();
}, { passive: true });
let _mv = 0;
document.addEventListener('pointermove', e => {
    if (_mv || e.pointerType === 'touch') return;
    const c = e.target.closest && e.target.closest('.kpis>.card,.dcard');
    if (!c) return;
    _mv = requestAnimationFrame(() => {
        _mv = 0;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', e.clientX - r.left + 'px');
        c.style.setProperty('--my', e.clientY - r.top + 'px');
    });
}, { passive: true });
if (typeof notify === 'function') {
    const _notify = notify;
    notify = function (body, o) {
        o = o || {};
        if (fxOn() && !o.bg) { o.err ? sfx.err() : sfx.ok(); }
        return _notify.apply(this, arguments);
    };
}

/* ===== main.js ===== */
// Đăng nhập nhanh bằng GET: mở app với ?key=<KEY trong config.js> thì khỏi nhập mật khẩu.
// Key được xóa khỏi thanh địa chỉ ngay sau khi đọc. 
(function () {
    try {
        const u = new URL(location.href), kn = [...u.searchParams.keys()].find(x => x.toLowerCase() === 'key'), k = kn === undefined ? null : u.searchParams.get(kn);
        if (k !== null) {
            u.searchParams.delete(kn);
            history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
            const K = (window.CONFIG || {}).KEY;
            if (K && k === K)
                touch();
        }
    }
    catch (e) { }
})();
/* ===== outbox.js: hàng đợi lưu bền (IndexedDB), thanh tiến trình, chặn tắt tab ===== */
const OB = { n: 0, ids: new Set(), jobs: {}, wk: new Set(), base: null, net: false };
let pgT = 0;
function pgSet(t, p, n) {
    const e = $('#pg'); if (!e) return; clearTimeout(pgT);
    e.classList.add('on'); e.classList.toggle('ind', p == null);
    $('#pgl').textContent = t; $('#pgc').textContent = n > 1 ? n + ' việc đang chờ' : '';
    $('#pgf').style.width = p == null ? '' : Math.max(4, Math.min(100, p)) + '%';
}
function oflSet() {
    const e = $('#ofl'); if (!e) return;
    const off = navigator.onLine === false || OB.net;
    e.classList.toggle('on', off);
    const m = $('#oflm'); if (m) m.textContent = OB.n ? 'Đang offline · ' + OB.n + ' thay đổi chờ gửi, sẽ tự gửi khi có mạng' : 'Đang offline · bạn vẫn xem được dữ liệu đã tải, thay đổi sẽ được gửi khi có mạng';
}
addEventListener('online', () => { OB.net = false; oflSet(); });
addEventListener('offline', oflSet);
function pgHide(d) { clearTimeout(pgT); const e = $('#pg'); if (e) pgT = setTimeout(() => e.classList.remove('on'), d || 0); }
const idb = (() => {
    let p;
    const open = () => p || (p = new Promise((ok, no) => { try { const r = indexedDB.open('stc-outbox', 1); r.onupgradeneeded = () => r.result.createObjectStore('j', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }).catch(() => null));
    const run = (m, f) => open().then(db => db && new Promise(ok => { try { const t = db.transaction('j', m), q = f(t.objectStore('j')); t.oncomplete = () => ok(q && q.result); t.onerror = t.onabort = () => ok(null); } catch (e) { ok(null); } }));
    return { put: j => run('readwrite', s => s.put(j)), del: id => run('readwrite', s => s.delete(id)), all: () => run('readonly', s => s.getAll()).then(r => r || []) };
})();
const waitNet = ms => new Promise(r => { let d = 0; const f = () => { if (d) return; d = 1; removeEventListener('online', f); OB.wk.delete(f); r(); }; OB.wk.add(f); addEventListener('online', f); setTimeout(f, navigator.onLine === false ? Math.max(ms, 4000) : ms); });
function bgSync() { try { navigator.serviceWorker && navigator.serviceWorker.ready.then(r => r.sync && r.sync.register('stc-outbox')).catch(() => { }); } catch (e) { } }
function obCancel() {
    if (!OB.n) return;
    Object.values(OB.jobs).forEach(j => { j.x = true; idb.del(j.id); });
    OB.wk.forEach(f => f());
    if (OB.base) { Object.assign(S, OB.base); saveCache(); render(); }
    notify('Đã hủy các thay đổi chưa gửi. Nếu sổ đã kịp nhận thì sẽ được cập nhật lại.', { title: 'Đã hủy', ico: '↩️', tag: 'ob', kind: 'err' });
    setTimeout(() => sync(true).catch(() => { }), 800);
}
document.addEventListener('click', async e => {
    if (!e.target.closest('#pgx')) return;
    if (await ask('Hủy các thay đổi chưa lưu?', OB.n + ' việc đang chờ sẽ bị bỏ, dữ liệu trở về như trên sổ.', { ok: 'Hủy thay đổi', cancel: 'Tiếp tục gửi', icon: '↩️', danger: 1 })) obCancel();
});
function saveCache() { try { localStorage.cache = JSON.stringify({ tx: S.tx, acc: S.acc, cat: S.cat, lim: S.lim, trash: S.trash, issues: S.issues }); } catch (e) { } }
addEventListener('beforeunload', e => { if (OB.n > 0 || (E && E.up)) { e.preventDefault(); e.returnValue = 'Đang lưu dữ liệu, thoát bây giờ có thể mất thay đổi.'; return e.returnValue; } });
const cancelErr = () => { const x = Error('Đã hủy'); x.cancel = true; return x; };
async function callRetry(ops, pend, job) {
    const safe = ops.every(x => SAFE_OPS.has(x.op));
    for (let i = 1; ; i++) {   // ghi an toàn (ID cố định): thử lại đến khi được
        if (job && job.x) throw cancelErr();
        try { const r = await call(ops, '', 45000, ops.every(x => FAST_OPS.has(x.op))); OB.net = false; oflSet(); return r; }
        catch (e) {
            if (job && job.x) throw cancelErr();
            if (!e.net || !safe) throw e;
            OB.net = true; oflSet();
            liveMsg('wait', pend + ' (mất kết nối, thử lại lần ' + i + ')');
            pgSet(pend.replace(/…$/, '') + ' · mất kết nối, đang thử lại (lần ' + i + ')', null, OB.n);
            await waitNet(Math.min(1500 * i, 20000));
            if (job && job.x) throw cancelErr();
        }
    }
}
async function upStaged(job) {   // ảnh chỉ được tải lên Drive khi người dùng đã bấm Lưu
    const n = job.files.length;
    for (let i = job.urls.length; i < n; i++) {
        for (let k = 1; ; k++) {
            if (job.x) throw cancelErr();
            try { pgSet('Đang tải ảnh ' + (i + 1) + '/' + n + '…', (i / n) * 100, OB.n); const j = await driveUp(job.files[i].blob, job.files[i].name); job.urls.push(j.url); idb.put(job); break; }
            catch (e) {
                if (!e.net) { notify('Ảnh chưa tải được (' + e.message + '). Giao dịch vẫn được lưu, hãy đính kèm lại ảnh sau.', { title: 'Ảnh đính kèm', ico: '⚠️', tag: 'img' }); return job.urls; }
                OB.net = true; oflSet();
                pgSet('Mất kết nối, đang thử tải ảnh lại…', null, OB.n);
                await waitNet(Math.min(2000 * k, 20000));
                if (job.x) throw cancelErr();
            }
        }
    }
    return job.urls;
}
function commit(ops, o = {}) {
    const had = new Set(S.tx.map(t => t.id)), pend = o.pend || 'Đang lưu…', safe = ops.every(x => SAFE_OPS.has(x.op));
    const job = { id: o.jid || 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ops, pend, files: o.files || null, urls: o.urls || [], t: Date.now() };
    if (!OB.n) OB.base = { tx: S.tx.slice(), acc: S.acc.slice(), cat: S.cat.slice(), lim: S.lim.slice(), trash: S.trash.slice() };
    job.x = false; OB.jobs[job.id] = job;
    if (o.local) o.local();
    saveCache(); render();
    S.busy++; OB.n++; OB.ids.add(job.id); spin(1); liveMsg('wait', pend); pgSet(pend, null, OB.n);
    const stored = safe && !o.noPersist ? idb.put(job).then(bgSync) : Promise.resolve();
    chain = chain.then(async () => {
        await stored;
        let res = { ok: true }, fast = false, ops2 = ops;
        if (job.x) { delete OB.jobs[job.id]; OB.ids.delete(job.id); S.busy--; OB.n--; if (!S.busy) spin(0); if (!OB.n) { pgHide(0); oflSet(); } return { ok: false, err: 'Đã hủy', cancel: true }; }
        const okNote = () => notify(o.ok || 'Đã lưu', { undo: o.undo, title: o.title, ico: o.ico, tag: o.tag, kind: o.kind });
        try {
            if (job.files && job.files.length) await upStaged(job);
            if (job.urls.length) ops2 = ops.map(x => x.op === 'tx.save' ? { ...x, row: { ...x.row, note: joinImg(x.row.note, job.urls) } } : x);
            pgSet(pend, null, OB.n);
            const j = await callRetry(ops2, pend, job);
            if (j.fast) { fast = true; stamp(); } else apply(j);
            if (S.busy <= 1) setLive('ok');
            okNote();
        }
        catch (e) {
            if (e.cancel) { res = { ok: false, err: 'Đã hủy', cancel: true }; }
            else {
            let fresh = false;
            try { apply(await call([], '')); fresh = true; } catch (_) { }
            const done = e.net && fresh && ops2.length && ops2.every(x => x.op === 'tx.save' && !had.has(x.row.id) && S.tx.some(t => t.id === x.row.id));
            if (done) { if (S.busy <= 1) setLive('ok'); okNote(); }
            else {
                res = { ok: false, err: e.message };
                notify('Chưa lưu được: ' + e.message + (e.net ? (fresh ? '. Sổ chưa nhận giao dịch này, bấm Lưu lại để thử lần nữa' : '. Chưa xác nhận được sổ đã nhận hay chưa, hãy kiểm tra lại') : ''), { title: 'Chưa lưu được', ico: '⚠️', tag: o.tag, kind: 'err' });
                if (S.busy <= 1) setLive(fresh ? 'ok' : 'err');
            }
            }
        }
        if (safe) await idb.del(job.id);
        delete OB.jobs[job.id]; OB.ids.delete(job.id); S.busy--; OB.n--;
        if (!OB.n) { OB.net = false; } oflSet();
        saveCache();
        if (!S.busy) spin(0);
        render();
        if (OB.n) pgSet('Đang xử lý việc kế tiếp…', null, OB.n);
        else if (res.cancel) pgHide(0);
        else { pgSet(res.ok ? 'Đã lưu xong' : 'Chưa lưu được', 100, 0); pgHide(res.ok ? 700 : 2500); }
        if (fast && !S.busy) setTimeout(() => sync(false), 400);
        return res;
    });
    return chain;
}
async function resumeOutbox() {   // mở lại web: gửi tiếp những thay đổi còn dang dở
    const js = (await idb.all()).filter(j => !OB.ids.has(j.id)).sort((a, b) => a.t - b.t);
    js.forEach(j => commit(j.ops, {
        jid: j.id, pend: 'Đang gửi lại thay đổi chưa lưu…', ok: 'Đã gửi xong thay đổi đang chờ', files: j.files, urls: j.urls, noPersist: true,
        local: () => j.ops.forEach(x => { if (x.op === 'tx.save') S.tx = S.tx.filter(t => t.id !== x.row.id).concat(x.row); else if (x.op === 'tx.del' || x.op === 'tx.purge') S.tx = S.tx.filter(t => t.id !== x.id); })
    }));
}
/* ===== calc.js: nhập phép tính ở ô số dư thực tế (Cân đối) ===== */
const CALC_RE = /[+*\/×÷()]|[\d\w)]\s*-|[\d)]\s*x\s*[\d(]/i;
function calcEval(s) {
    s = String(s).toLowerCase().replace(/[₫đ]/g, '').replace(/([\d)])\s*x\s*(?=[\d(])/g, '$1*').replace(/×/g, '*').replace(/÷/g, '/');
    const tk = s.match(/\d[\d.,]*\s*(?:nghìn|ngàn|triệu|tr|tỷ|ty|k|m|b)?\d{0,3}|[-+*\/()]/g) || [];
    if (tk.join('').replace(/\s/g, '') !== s.replace(/\s/g, '')) return null;
    let i = 0;
    const pk = () => tk[i], expr = () => { let v = term(); while (pk() === '+' || pk() === '-') { const o = tk[i++], r = term(); v = o === '+' ? v + r : v - r; } return v; },
        term = () => { let v = un(); while (pk() === '*' || pk() === '/') { const o = tk[i++], r = un(); if (o === '/' && r === 0) throw 0; v = o === '*' ? v * r : v / r; } return v; },
        un = () => { if (pk() === '-') { i++; return -un(); } if (pk() === '+') { i++; return un(); } return atom(); },
        atom = () => { const t = tk[i++]; if (t === '(') { const v = expr(); if (tk[i++] !== ')') throw 0; return v; } if (!t || !/^\d/.test(t)) throw 0; return pm(t); };
    try { const v = expr(); return i === tk.length && isFinite(v) ? Math.round(v) : null; } catch (e) { return null; }
}
const calcFmt = v => (v < 0 ? '−' : '') + num(Math.abs(v));
function calcShow(t, txt) {
    let p = $('#cpv'); if (!p) { p = document.createElement('div'); p.id = 'cpv'; document.body.appendChild(p); }
    p.classList.toggle('on', !!txt); if (!txt) return;
    const r = t.getBoundingClientRect(); p.textContent = txt; p.style.top = r.bottom + 6 + 'px'; p.style.right = Math.max(8, innerWidth - r.right) + 'px';
}
const isBa = t => t && t.classList && t.classList.contains('ba');
document.addEventListener('input', e => {
    const t = e.target; if (!isBa(t)) return;
    if (!CALC_RE.test(t.value)) { calcShow(t, ''); return; }
    e.stopImmediatePropagation();
    const a = S.acc[+t.dataset.i], v = calcEval(t.value);
    if (v == null) return calcShow(t, 'Phép tính chưa hợp lệ…');
    calcShow(t, '= ' + calcFmt(v)); if (a) { S.act[a.name] = v; reconUpdate(); }
}, true);
function calcDone(t) {
    if (!CALC_RE.test(t.value)) { calcShow(t, ''); return false; }
    const a = S.acc[+t.dataset.i], v = calcEval(t.value); calcShow(t, '');
    if (v == null) { toast('Phép tính chưa hợp lệ'); return true; }
    t.value = (v < 0 ? '-' : '') + num(Math.abs(v)); if (a) S.act[a.name] = v; reconUpdate(); return true;
}
document.addEventListener('focusout', e => { if (isBa(e.target) && calcDone(e.target)) e.stopImmediatePropagation(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Enter' && isBa(e.target)) calcDone(e.target); }, true);
$('#ov').addEventListener('click', e => {   // gỡ ảnh đang chờ tải
    const x = e.target.closest('[data-imgst]'); if (!x || !E) return;
    E.staged = (E.staged || []).filter(s => s.id !== x.dataset.imgst); renderAtt();
});

if (alive())
    boot();

/* ===== Cửa sổ (sheet): nút đóng × ===== */
(function () {
    const sh = $('#sh'), ov = $('#ov');
    const addX = () => {
        if (sh.firstElementChild && sh.firstElementChild.id === 'sx') return;
        const b = document.createElement('button');
        b.type = 'button'; b.id = 'sx'; b.setAttribute('aria-label', 'Đóng cửa sổ'); b.title = 'Đóng'; b.textContent = '×';
        sh.insertBefore(b, sh.firstChild);
    };
    new MutationObserver(addX).observe(sh, { childList: true });
    document.addEventListener('click', e => { if (e.target.closest('#sx')) { e.preventDefault(); tryClose(); } });
})();

/* ===== enter.js: logic phím Enter toàn app =====
   Quy tắc:
   1. Đang gõ tiếng Việt (IME) hoặc giữ phím (repeat): bỏ qua, tránh nhảy ô / lưu nhầm.
   2. Hộp xác nhận (#cf) và màn đăng nhập tự xử lý riêng, không can thiệp.
   3. Ô chọn Hạng mục/Chi tiết đang mở danh sách: Enter = chọn (xử lý ở forms.js); danh sách đóng thì Enter = ô kế tiếp.
   4. Trong cửa sổ (sheet): Enter = sang ô kế tiếp; ở ô cuối cùng = bấm nút chính (Lưu / Xác nhận...).
      Ctrl/Cmd + Enter ở bất kỳ ô nào = bấm nút chính ngay. Sheet không có nút chính (Cài đặt...) thì Enter chỉ thoát ô.
   5. Ô tìm kiếm giao dịch: Enter = tìm ngay, thu bàn phím.
   6. Ô số dư thực tế (Cân đối): Enter = sang tài khoản kế tiếp, ô cuối thì thoát ô.
   7. Các ô lọc / ô nhập khác trong trang: Enter = thoát ô (kích hoạt sự kiện change để áp dụng).
   Nút, liên kết, ô tích, textarea: giữ hành vi mặc định của trình duyệt. */
(function () {
    const PRIMARY = '[data-save],[data-esave],[data-lsave],[data-gsave],[data-rcsave],[data-dbsave],[data-dbpaygo],[data-cdsave],[data-cfill]';
    const visible = el => el && !el.disabled && el.offsetParent !== null;
    const fieldsOf = root => [...root.querySelectorAll('input,select')].filter(x =>
        visible(x) && !['hidden', 'file', 'checkbox', 'radio', 'button', 'submit'].includes(x.type));
    const focusEl = el => { el.focus(); if (el.select && /^(text|search|number|tel|email|url|)$/.test(el.type || '')) { try { el.select(); } catch (x) { } } };
    const primaryOf = root => [...root.querySelectorAll(PRIMARY)].find(visible);

    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing && !e.repeat && $('#ov').classList.contains('open') && !$('#cf').classList.contains('open') && !/^(INPUT|SELECT)$/.test((e.target || {}).tagName || '')) {
            const b = primaryOf($('#sh')); if (b) { e.preventDefault(); b.click(); }
            return;
        }
        if (e.key !== 'Enter' || e.defaultPrevented) return;
        if (e.isComposing || e.keyCode === 229 || e.repeat || e.altKey || e.shiftKey) return;
        const t = e.target;
        if (!t || !t.tagName || !/^(INPUT|SELECT)$/.test(t.tagName)) return;
        if (['button', 'submit', 'checkbox', 'radio', 'file'].includes(t.type)) return;
        if ($('#cf').classList.contains('open')) return;
        if (t.closest('#login')) return;
        const quick = e.ctrlKey || e.metaKey;

        // --- Trong cửa sổ (sheet) ---
        const sh = t.closest('#sh');
        if (sh && $('#ov').classList.contains('open')) {
            e.preventDefault();
            const btn = primaryOf(sh);
            if (!btn) return t.blur();                      // Cài đặt, thông báo...: chỉ thoát ô
            if (quick) return btn.click();
            const list = fieldsOf(sh), i = list.indexOf(t), next = list[i + 1];
            if (next) return focusEl(next);
            t.blur();                                       // chốt giá trị (sự kiện change) rồi lưu
            return btn.click();
        }

        // --- Ô tìm kiếm giao dịch ---
        if (t.id === 'q') {
            e.preventDefault();
            clearTimeout(qT);
            qApply();
            const q = $('#q');
            if (q) q.blur();
            return;
        }

        // --- Nhập số dư thực tế ở màn Cân đối ---
        if (t.classList.contains('ba')) {
            e.preventDefault();
            const all = $$('.ba'), next = all[all.indexOf(t) + 1];
            return next ? focusEl(next) : t.blur();
        }

        // --- Ô khác trong trang (bộ lọc ngày, số tiền, chọn tài khoản...) ---
        if (t.closest('#v')) {
            e.preventDefault();
            t.blur();
        }
    });
})();

/* ===== In / PDF: thêm tiêu đề + ngày in, đặt tên file theo màn hình ===== */
(function () {
    let oldT = '';
    window.addEventListener('beforeprint', () => {
        const tb = (typeof TABS !== 'undefined' && TABS.find(x => x[0] === S.tab)) || [], name = tb[1] || 'Tổng quan', m = S.m ? mlabel(S.m) : '';
        const d = new Date(), p2 = n => String(n).padStart(2, '0');
        let h = document.getElementById('phd');
        if (!h) { h = document.createElement('div'); h.id = 'phd'; document.body.insertBefore(h, document.body.firstChild); }
        h.innerHTML = '<b>Sổ Thu Chi – ' + esc(name) + (m ? ' · ' + esc(m) : '') + '</b><small>' + esc(((window.CONFIG || {}).NAME) || '') + ' · In lúc ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ' ngày ' + p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + '</small>';
        oldT = document.title;
        document.title = 'so-thu-chi-' + String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-') + (S.m ? '-' + S.m : '');
    });
    window.addEventListener('afterprint', () => { if (oldT) document.title = oldT; const h = document.getElementById('phd'); if (h) h.remove(); });
})();

oflSet();

/* Ngăn kéo điều hướng cho cửa sổ hẹp (< 700px): chọn mục hoặc bấm ra ngoài là đóng */
document.addEventListener('click', e => {
    const h = document.documentElement;
    if (!h.classList.contains('sdo')) return;
    if (e.target === document.body || e.target.closest('#tb [data-tab],#tb [data-nt]')) h.classList.remove('sdo');
});
addEventListener('resize', () => { if (innerWidth >= 700) document.documentElement.classList.remove('sdo'); });
