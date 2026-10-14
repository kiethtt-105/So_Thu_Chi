// Ô "Gõ nhanh": đọc câu như "ăn sáng 20k tiền mặt", "lương 15tr vcb", "chuyển 500k vcb sang momo hôm qua 8h30".
// Phần đọc câu (trước qPreview) KHÔNG được đụng tới DOM vì api/quick.js nạp lại đúng đoạn này để dùng cho Phím tắt iPhone.
const Q_UNIT = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, m: 1e6, cu: 1e6, ty: 1e9, ti: 1e9, d: 1, vnd: 1, dong: 1 };
const Q_STOP = new Set(['va', 'cho', 'tu', 'den', 'sang', 'vao', 'bang', 'tren', 'o', 'tai', 'la', 'cua', 'mot', 'nhung', 'cac', 'luc', 'ngay', 'hom', 'nay', 'qua', 'kia', 'tien', 'chi', 'thu']);
const _qn = new Map();
const qCut = (s, sp) => { const a = s.split(''); sp.forEach(([i, j]) => { for (let k = i; k < j; k++) a[k] = ' '; }); return a.join(''); };
const qNorm = s => String(s || '').replace(/[^a-z0-9]+/g, ' ').trim();
function qFind(h, w) {
    w = qNorm(w);
    if (!w) return null;
    const m = new RegExp('(^|[^a-z0-9])(' + w.split(' ').map(reEsc).join('\\s+') + ')(?![a-z0-9])').exec(h);
    return m ? [m.index + m[1].length, m.index + m[1].length + m[2].length] : null;
}
function qNote(s) {
    s = String(s || '');
    let v = _qn.get(s);
    if (v === undefined) { v = ' ' + qNorm(nz(s)) + ' '; if (_qn.size > 5000) _qn.clear(); _qn.set(s, v); }
    return v;
}
function qParse(text) {
    const t = String(text || '').normalize('NFC').trim();
    if (!t) return null;
    const n = nz(t), now = new Date(), spans = [];
    let w = n, date = todayS(), time = hm(now), m;
    const use = s => { spans.push(s); w = qCut(w, [s]); };
    const at = (r, g) => [r.index + r[1].length, r.index + r[0].length];
    const back = k => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - k));

    // 1) giờ: 8h, 8h30, 20:15, 8 gio
    m = /(^|[^a-z0-9.,:\/-])(\d{1,2})\s*(?:h|gio|:)\s*(\d{2})?(?![a-z0-9])/.exec(w);
    if (m && Number(m[2]) < 24 && (!m[3] || Number(m[3]) < 60)) { time = String(m[2]).padStart(2, '0') + ':' + (m[3] || '00'); use(at(m)); }

    // 2) ngày: hôm qua, hôm kia, hôm nay, 5/10, 5/10/2026, ngày 5
    if ((m = /(^|[^a-z0-9])(?:hom qua|hqua)(?![a-z0-9])/.exec(w))) { date = back(1); use(at(m)); }
    else if ((m = /(^|[^a-z0-9])hom kia(?![a-z0-9])/.exec(w))) { date = back(2); use(at(m)); }
    else if ((m = /(^|[^a-z0-9])hom nay(?![a-z0-9])/.exec(w))) { use(at(m)); }
    else if ((m = /(^|[^a-z0-9.,\/-])(?:ngay\s+)?(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?(?![a-z0-9\/-])/.exec(w)) && Number(m[2]) >= 1 && Number(m[2]) <= 31 && Number(m[3]) >= 1 && Number(m[3]) <= 12) {
        const y = m[4] ? (m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4])) : now.getFullYear();
        date = ymd(new Date(y, Number(m[3]) - 1, Number(m[2]))); use(at(m));
    }
    else if ((m = /(^|[^a-z0-9])ngay\s+(\d{1,2})(?![a-z0-9\/-])/.exec(w)) && Number(m[2]) >= 1 && Number(m[2]) <= 31) { date = ymd(new Date(now.getFullYear(), now.getMonth(), Number(m[2]))); use(at(m)); }

    // 3) tài khoản (tên khớp dài nhất trước; "tiền mặt"/"tm" → tài khoản loại Tiền mặt)
    let h2 = w.replace(/[^a-z0-9]/g, ' ');
    const found = [];
    S.acc.map(a => ({ a, k: qNorm(nz(a.name)) })).filter(x => x.k).sort((x, y) => y.k.length - x.k.length).forEach(x => {
        const s = qFind(h2, x.k);
        if (s) { found.push({ name: x.a.name, s }); h2 = qCut(h2, [s]); }
    });
    const cash = S.acc.find(a => a.type === 'Tiền mặt');
    if (cash && !found.some(f => f.name === cash.name)) {
        const s = qFind(h2, 'tien mat') || qFind(h2, 'tm');
        if (s) { found.push({ name: cash.name, s }); h2 = qCut(h2, [s]); }
    }
    found.sort((x, y) => x.s[0] - y.s[0]);
    found.forEach(f => use(f.s));
    const fn = found.map(f => f.name);

    // 4) số tiền: 20k, 1tr5, 1,5tr, 50.000, 2 triệu; số trần < 1000 hiểu là nghìn (50 = 50k)
    const cands = [];
    let r;
    const re1 = /(^|[^a-z0-9.,])(\d+)\s*(tr|trieu|m|cu)\s*(\d{1,3})(?![a-z0-9])/g;
    while ((r = re1.exec(w))) { const b = r[4]; cands.push({ v: Number(r[2]) * 1e6 + Number(b) * Math.pow(10, 6 - b.length), u: 1, s: at(r) }); }
    const re2 = /(^|[^a-z0-9.,])(\d+(?:[.,]\d+)*)\s*(k|nghin|ngan|tr|trieu|m|cu|ty|ti|vnd|dong|d)?(?![a-z0-9])/g;
    while ((r = re2.exec(w))) {
        const raw = r[2], mul = r[3] ? Q_UNIT[r[3]] : 0, sp = at(r);
        if (cands.some(c => c.s[0] < sp[1] && sp[0] < c.s[1])) continue;
        let v;
        if (mul > 1 && !/^\d{1,3}([.,]\d{3})+$/.test(raw)) v = Number(raw.replace(/[.,](?=.*[.,])/g, '').replace(',', '.')) * mul;
        else v = Number(raw.replace(/[.,]/g, '')) * (mul || 1);
        if (!mul && v > 0 && v < 1000) v *= 1000;
        cands.push({ v, u: mul > 1 ? 1 : 0, s: sp });
    }
    let amount = 0;
    if (cands.length) { const pk = cands.find(c => c.u) || cands.reduce((a, b) => b.v > a.v ? b : a); amount = Math.round(pk.v); use(pk.s); }

    // 5) loại giao dịch
    let type = '';
    if (/(^|[^a-z0-9])(dieu chinh|can doi)(?![a-z0-9])/.test(n)) type = 'Điều chỉnh';
    else if (fn.length >= 2 || /(^|[^a-z0-9])(chuyen khoan|ck)(?![a-z0-9])/.test(n)) type = 'Chuyển khoản';
    else if (/(^\s*thu(?![a-z0-9])|(^|[^a-z0-9])(thu nhap|luong|thuong|lai suat|hoan tien|nhan tien)(?![a-z0-9]))/.test(n) && !/^\s*thu\s+(hai|ba|tu|nam|sau|bay|\d)/.test(n)) type = 'Thu';
    else if (/(^|[^a-z0-9])(chi|mua|tra|dong)(?![a-z0-9])/.test(n)) type = 'Chi';
    let acc = fn[0] || '', accTo = '';
    if (type === 'Chuyển khoản') {
        accTo = fn[1] || '';
        if (found.length >= 2 && (/(^|\s)tu$/.test(n.slice(0, found[1].s[0]).trim()) || /(^|\s)(sang|den|vao)$/.test(n.slice(0, found[0].s[0]).trim()))) { acc = fn[1]; accTo = fn[0]; }
    }

    // 6) hạng mục: khớp tên chi tiết (ưu tiên) hoặc tên hạng mục cha; không có thì học từ giao dịch cũ có ghi chú giống
    let cat = '', sub = '';
    if (type === '' || type === 'Chi' || type === 'Thu') {
        const h = w.replace(/[^a-z0-9]/g, ' ');
        let best = null, bs = 0;
        S.cat.forEach(c => {
            if (type && c.t !== type) return;
            const a = qNorm(nz(c.c)), b = qNorm(nz(c.p));
            const sc = (a && qFind(h, a) ? 100 + a.length : 0) || (b && qFind(h, b) ? 50 + b.length : 0);
            if (sc > bs || (sc && sc === bs && !type && best && best.t !== 'Chi' && c.t === 'Chi')) { best = c; bs = sc; }
        });
        if (best) { cat = best.p; sub = bs >= 100 ? best.c : ''; if (!type) type = best.t; }
        if (!sub) {
            const toks = [...new Set(qNorm(h).split(' ').filter(x => x.length > 1 && !/^\d+$/.test(x) && !Q_STOP.has(x)))];
            if (toks.length) {
                const cnt = {};
                S.tx.forEach(x => {
                    if (!x.cat || !x.sub || (type ? x.type !== type : (x.type !== 'Chi' && x.type !== 'Thu')) || (cat && x.cat !== cat)) return;
                    const hx = qNote(x.note);
                    let k = 0;
                    toks.forEach(tk => { if (hx.indexOf(' ' + tk + ' ') >= 0) k++; });
                    if (k) { const key = x.type + '\u0001' + x.cat + '\u0001' + x.sub; cnt[key] = (cnt[key] || 0) + k; }
                });
                const top = topKey(cnt);
                if (top) { const [ty, c1, s1] = top.split('\u0001'); if (catOk(ty, c1, s1)) { cat = c1; sub = s1; if (!type) type = ty; } }
            }
        }
    }
    if (!type) type = 'Chi';
    if (type === 'Điều chỉnh' && (/(^|\s)-\s*\d/.test(n) || /(^|[^a-z0-9])giam(?![a-z0-9])/.test(n))) amount = -Math.abs(amount);
    if (type === 'Chuyển khoản' || type === 'Điều chỉnh') { cat = ''; sub = ''; }
    return { type, amount, acc, accTo, cat, sub, note: qCut(t, spans).replace(/\s+/g, ' ').trim(), date, time };
}
function qMissing(p) {
    const m = [];
    if (!p.amount) m.push('số tiền');
    if (!p.acc) m.push('tài khoản');
    if (p.type === 'Chuyển khoản') { if (!p.accTo) m.push('tài khoản nhận'); else if (p.accTo === p.acc) m.push('tài khoản nhận khác tài khoản nguồn'); }
    if ((p.type === 'Chi' || p.type === 'Thu') && (!p.cat || !p.sub)) m.push('hạng mục');
    return m;
}

function qPreview() {
    const q = $('#qin'), v = $('#qpv');
    if (!q || !v) return;
    const t = q.value.trim(), p = t && S.ready ? qParse(t) : null;
    if (!p) { v.innerHTML = ''; return; }
    const miss = qMissing(p), tr = p.type === 'Chuyển khoản';
    const cat = p.type === 'Chi' || p.type === 'Thu' ? `<span>${p.cat ? emo(p.cat) + ' ' + esc(p.cat) + (p.sub ? ' › ' + esc(p.sub) : '') : '— chưa có hạng mục'}</span>` : '';
    const where = tr ? esc(p.acc || '?') + ' → ' + esc(p.accTo || '?') : esc(p.acc || '— chưa có tài khoản');
    v.innerHTML = `<b class="${CLS[p.type] || ''}">${esc(p.type)} ${p.amount ? num(p.amount) + ' ₫' : '— chưa có số tiền'}</b>${cat}<span>${where}</span>${p.date !== todayS() ? `<span>📅 ${p.date.split('-').reverse().join('/')}</span>` : ''}<em class="${miss.length ? 'chi' : 'thu'}">${miss.length ? 'Thiếu ' + esc(miss.join(', ')) + ' · Enter để mở form' : 'Enter để lưu'}</em>`;
}
function qRow(p) {
    const x = p.type === 'Chuyển khoản' || p.type === 'Điều chỉnh', d = p.date || todayS(), tm = p.time || hm(new Date());
    return { id: newId(), date: d, type: p.type, amount: p.amount, acc: p.acc, accTo: p.type === 'Chuyển khoản' ? p.accTo : '', cat: x ? '' : p.cat, sub: x ? '' : p.sub, note: p.note || '', at: d + 'T' + tm + ':00' };
}
function qSave(p) {
    const row = qRow(p), q = $('#qin');
    if (q) { q.value = ''; qPreview(); }
    return txSave(row);
}
function qOpen(p) {
    E = { id: newId(), date: p.date || todayS(), time: p.time || hm(new Date()), type: p.type || 'Chi', amount: p.amount || 0, acc: p.acc || (S.acc[0] || {}).name || '', accTo: p.accTo || '', cat: p.cat || '', sub: p.sub || '', note: p.note || '', imgs: [], isNew: true };
    ED = null;
    form();
    openSheet();
    const q = $('#qin');
    if (q) { q.value = ''; qPreview(); }
}
function qSubmit(edit) {
    const q = $('#qin');
    if (!q) return;
    const t = q.value.trim();
    if (!t) return edit ? openForm() : toast('Gõ nội dung, ví dụ: ăn sáng 20k tiền mặt');
    if (!S.ready) return toast('Đang tải dữ liệu, thử lại sau giây lát');
    const p = qParse(t);
    if (!p) return toast('Không đọc được câu này');
    if (edit || qMissing(p).length) return qOpen(p);
    return qSave(p);
}
function qbNav() {
    const b = $('#qb');
    if (!b) return;
    b.classList.toggle('hide', !S.ready || S.tab === 'tr' || !tabOn('qb'));
    if (typeof renderTpl === 'function') renderTpl();
}
(() => {
    const q = $('#qin');
    if (!q) return;
    q.addEventListener('input', qPreview);
    q.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.isComposing) return; e.preventDefault(); qSubmit(e.ctrlKey || e.metaKey); });
    $('#qsv').onclick = () => qSubmit(false);
    $('#qed').onclick = () => qSubmit(true);
})();
