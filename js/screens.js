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
    l.slice(0, S.pg).forEach(t => { if (ds && t.date !== last) {
        last = t.date;
        const dd = new Date(t.date + 'T00:00'), ov = ld && dt[t.date] > ld;
        h += `<div class="dh ${ov ? 'over' : ''}"><span>${dd.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span><span class="sens">${S.f === 'Thu' ? (dsum[t.date] ? 'thu ' + num(dsum[t.date]) : '') : S.f === 'Chi' || S.f === 'all' ? (dt[t.date] ? 'chi ' + num(dt[t.date]) + (ov ? ' ⚠️ vượt hạn mức ngày' : '') : '') : ''}</span></div>`;
    } h += txRow(t); });
    if (l.length > S.pg)
        h += `<button class="btn w" data-a="moretx" style="margin:10px 0">Xem thêm (còn ${l.length - S.pg} giao dịch)</button>`;
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
<div class="grid c"><div class="card"><div class="ch">Nhập số dư thực tế</div>${D.map((x, i) => `<div class="rr"><span style="display:flex;align-items:center;gap:10px">${aIco(x.a)}<span style="min-width:0"><b style="font-weight:500">${esc(x.a.name)}</b><small class="sens">Hệ thống: ${vnd(x.sys)}</small></span></span>${x.a.type === 'Tiền mặt' ? `<button type="button" class="ib cnt" data-cash="${i}" aria-label="Đếm tiền mặt" title="Đếm số tờ">${ic('cnt')}</button>` : ''}<input class="ba money" data-neg="1" data-i="${i}" inputmode="text" placeholder="${num(x.sys)}" value="${x.has ? num(x.act) : ''}" aria-label="Số dư thực tế ${esc(x.a.name)}"><span class="df" id="df${i}"></span></div>`).join('') || empty('Chưa có tài khoản')}</div>
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
    tb.innerHTML = TABS.map(([k, l, gr]) => (gr ? '<i class="sep">' + gr + '</i>' : '') + `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}" title="${l}">${ic(k)}<span>${l}</span>${k === 'tr' && S.trash.length ? '<em class="nbd">' + S.trash.length + '</em>' : ''}</button>`).join('') + `<i class="sep"></i><button data-nt="settings" title="Cài đặt">${ic('set')}<span>Cài đặt</span></button>`;
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
