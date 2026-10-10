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
    _bk = { t: S.tx, a: S.acc, n: S.tx.length, m, B };
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
