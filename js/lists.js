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
