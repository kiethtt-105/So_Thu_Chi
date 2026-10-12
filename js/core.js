const { PASS, API } = window.CONFIG || {}, POLL_MS = 10000, TTL = 24 * 3600e3;
/* Phiên đăng nhập chỉ lưu trong sessionStorage: đóng tab/cửa sổ là mất phiên, phải nhập lại mật khẩu. Reload trong cùng tab vẫn giữ. */
try { localStorage.removeItem('sess'); } catch (e) { }   // dọn phiên cũ từng lưu lâu dài
const alive = () => { let t = 0; try { t = +sessionStorage.sess || 0; } catch (e) { } return t && Date.now() - t < TTL; }, touch = (() => { let last = 0; return () => { const n = Date.now(); if (n - last < 30000) return; last = n; try { sessionStorage.sess = n; } catch (e) { } }; })();
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const NF = new Intl.NumberFormat('vi-VN'), num = n => NF.format(n), vnd = n => num(Math.round(n)) + ' ₫';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const newId = i => 'G' + Date.now().toString(36) + (i || 0) + Math.floor(Math.random() * 1296).toString(36);
const pm = v => { const s = String(v || '').trim(), n = Number(s.replace(/[^\d]/g, '')); return n ? (s.startsWith('-') ? -n : n) : 0; };
const fm = el => {
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
const TABS = [['home', 'Tổng quan', 'Sổ sách'], ['rp', 'Báo cáo'], ['tx', 'Tất cả', 'Giao dịch'], ['ba', 'Theo tài khoản'], ['bc', 'Theo danh mục'], ['bl', 'Theo hạn mức'], ['rec', 'Cân đối', 'Quản lý'], ['lim', 'Hạn mức'], ['goal', 'Mục tiêu'], ['acc', 'Tài khoản'], ['cat', 'Hạng mục'], ['tr', 'Thùng rác']], MOB = ['home', 'tx', 'rp', 'lim'], MONTHLY = ['home', 'tx', 'ba', 'bc', 'bl', 'lim', 'acc', 'cat'], GRP_TX = ['tx', 'ba', 'bc', 'bl'], SHORT = { tx: 'Giao dịch' };
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
