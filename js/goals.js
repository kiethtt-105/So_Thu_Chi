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
