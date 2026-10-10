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
