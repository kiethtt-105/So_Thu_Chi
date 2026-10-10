/* Tính năng bổ sung (lưu cục bộ trên máy, có sao lưu/khôi phục):
   giao dịch định kỳ, sổ nợ, thẻ tín dụng, nhịp chi theo hạn mức, dự báo cuối tháng,
   bộ lọc đã lưu, nhập giọng nói, xuất Excel, in PDF, sao lưu/khôi phục. */
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
            + `<p class="hint" style="margin-top:10px">Quy tắc lưu trên thiết bị này. Dùng Sao lưu/Khôi phục để chép sang máy khác; giao dịch được ghi bằng mã cố định theo ngày nên không bị ghi trùng nếu nhiều máy cùng chạy.</p>`;
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

    /* ---------- Nhập giọng nói ---------- */
    const UNIT = { 'nghìn': 1e3, 'ngàn': 1e3, 'triệu': 1e6, 'tỷ': 1e9 }, DG = { 'không': 0, 'một': 1, 'mốt': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'tư': 4, 'năm': 5, 'lăm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9 };
    function viNum(text) {
        const w = text.split(/\s+/), out = [];
        for (let i = 0; i < w.length;) {
            const isN = x => x in DG || x in UNIT || ['mười', 'mươi', 'trăm', 'rưỡi', 'linh', 'lẻ'].includes(x.toLowerCase());
            if (!isN(w[i].toLowerCase())) { out.push(w[i++]); continue; }
            let j = i, total = 0, cur = 0, pend = 0, last = 1, strong = false;
            for (; j < w.length && isN(w[j].toLowerCase()); j++) {
                const x = w[j].toLowerCase();
                if (x in DG) pend = DG[x];
                else if (x === 'mười') { cur += 10; strong = true; }
                else if (x === 'mươi') { cur += (pend || 1) * 10; pend = 0; strong = true; }
                else if (x === 'trăm') { cur += (pend || 1) * 100; pend = 0; strong = true; }
                else if (x in UNIT) { total += (cur + pend) * UNIT[x]; last = UNIT[x]; cur = pend = 0; strong = true; }
                else if (x === 'rưỡi') total += last / 2;
            }
            total += cur + pend;
            if (strong && total > 0) out.push(String(total)); else out.push(...w.slice(i, j));
            i = j;
        }
        return out.join(' ');
    }
    window.viNum = viNum;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let REC = null;
    function micToggle() {
        const b = $('#qmic'), q = $('#qin');
        if (REC) { try { REC.stop(); } catch (e) { } return; }
        REC = new SR(); REC.lang = 'vi-VN'; REC.interimResults = true; REC.maxAlternatives = 1;
        REC.onresult = e => { q.value = viNum([...e.results].map(r => r[0].transcript).join(' ')); q.dispatchEvent(new Event('input', { bubbles: true })); };
        REC.onerror = e => { toast(e.error === 'not-allowed' ? 'Chưa cho phép dùng micro' : 'Không nhận được giọng nói'); };
        REC.onend = () => { REC = null; b.classList.remove('rec'); q.focus(); };
        b.classList.add('rec'); try { REC.start(); } catch (e) { REC = null; b.classList.remove('rec'); }
    }
    const mic = $('#qmic');
    if (mic && !SR) mic.classList.add('hide');

    /* ---------- Xuất Excel, in PDF, sao lưu ---------- */
    function dl(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    function xlsExport() {
        const m = S.m, L = S.tx.filter(t => inM(t, m)).sort((a, b) => a.date.localeCompare(b.date) || (a.at || '').localeCompare(b.at || '')), { thu, chi } = sums(m), cats = group(chiM(m), t => t.cat || 'Chưa phân loại');
        const td = v => '<td>' + esc(v) + '</td>';
        const html = `<html><head><meta charset="utf-8"></head><body><h3>Báo cáo ${esc(mlabel(m))}</h3><table border="1"><tr>${td('Thu')}${td(thu)}</tr><tr>${td('Chi')}${td(chi)}</tr><tr>${td('Còn lại')}${td(thu - chi)}</tr></table><br>
<table border="1"><tr><th>Hạng mục chi</th><th>Số tiền</th><th>Tỷ lệ</th></tr>${cats.map(([k, v]) => '<tr>' + td(k) + td(v) + td(chi ? Math.round(v / chi * 100) + '%' : '') + '</tr>').join('')}</table><br>
<table border="1"><tr><th>Ngày</th><th>Loại</th><th>Số tiền</th><th>Tài khoản</th><th>Đến tài khoản</th><th>Hạng mục</th><th>Chi tiết</th><th>Ghi chú</th></tr>${L.map(t => '<tr>' + [t.date, t.type, t.amount, t.acc, t.accTo, t.cat, t.sub, noteTxt(t.note)].map(td).join('') + '</tr>').join('')}</table></body></html>`;
        dl(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' }), 'so-thu-chi-' + m + '.xls');
    }
    const BK = ['goals', 'tpl', 'aicon', 'stcfg', 'stcx', 'theme', 'sbc', 'fx', 'nclr'];
    function bkExport() {
        const data = {}; BK.forEach(k => { const v = localStorage.getItem(k); if (v != null) data[k] = v; });
        dl(new Blob([JSON.stringify({ app: 'so-thu-chi', v: 1, at: new Date().toISOString(), data })], { type: 'application/json' }), 'so-thu-chi-sao-luu-' + ymd(new Date()) + '.json');
        toast('Đã tải file sao lưu');
    }
    function bkImport() {
        const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
        i.onchange = async () => {
            const f = i.files[0]; if (!f) return;
            let j; try { j = JSON.parse(await f.text()); } catch (e) { return toast('File không đọc được'); }
            if (!j || j.app !== 'so-thu-chi' || !j.data) return toast('Đây không phải file sao lưu của Sổ Thu Chi');
            if (!await ask('Khôi phục từ sao lưu?', 'Mục tiêu, mẫu giao dịch, định kỳ, sổ nợ, thẻ, biểu tượng và cài đặt trên máy này sẽ được thay bằng bản sao lưu (tạo lúc ' + (j.at || '').slice(0, 10) + '). Giao dịch trên server không bị ảnh hưởng.', { icon: '♻️', ok: 'Khôi phục' })) return;
            BK.forEach(k => { if (typeof j.data[k] === 'string') { try { localStorage.setItem(k, j.data[k]); } catch (e) { } } });
            toast('Đã khôi phục, đang tải lại…'); setTimeout(() => location.reload(), 900);
        };
        i.click();
    }
    window.extraMenu = () => [['dl', 'Xuất báo cáo tháng (Excel)', 'xls'], ['dl', 'In / lưu PDF trang đang xem', 'pdf'], ['dl', 'Sao lưu dữ liệu cục bộ', 'bk'], ['dl', 'Khôi phục từ file sao lưu', 'rs']].map(([i, t, k]) => `<button class="row" data-x="${k}">${ic(i)}<span class="m"><b>${t}</b></span></button>`).join('');

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
            return { xls: xlsExport, pdf: () => setTimeout(() => window.print(), 250), bk: bkExport, rs: bkImport }[b.dataset.x]();
        }
        if (g('#qmic')) return SR ? micToggle() : toast('Trình duyệt này chưa hỗ trợ nhập giọng nói');
    });
})();
