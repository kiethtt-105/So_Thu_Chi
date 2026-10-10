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
