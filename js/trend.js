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
