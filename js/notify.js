IC.bell = 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0';
IC.set = 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6';
const CAN_SYS = 'Notification' in window;
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let SWREG = null, INST = null;
const permOf = () => CAN_SYS ? Notification.permission : 'unsupported';
const pushOn = () => permOf() === 'granted';
const pad2 = n => String(n).padStart(2, '0');
const toMin = h => { const m = /^(\d{1,2}):(\d{2})$/.exec(h || ''); return m ? +m[1] * 60 + +m[2] : -1; };
const CFG_KINDS = {
    tx: ['🧾', 'Giao dịch được tạo, cập nhật, xóa', 'Kèm mã giao dịch'],
    limit: ['⚠️', 'Hạng mục bội chi', 'Khi khoản chi làm vượt hạn mức ngày hoặc tháng'],
    sync: ['🔄', 'Thay đổi từ thiết bị khác', 'Giao dịch mới hoặc vừa được sửa ở nơi khác']
};
function cfg() {
    let c = {};
    try {
        c = JSON.parse(localStorage.stcfg || '{}') || {};
    }
    catch (e) { }
    return {
        fg: c.fg != null ? !!c.fg : localStorage.nall === '1',
        kinds: { tx: true, limit: true, sync: true, report: true, remind: true, ...c.kinds },
        rp: { on: true, at: '06:00', ...c.rp },
        rm: Array.isArray(c.rm) ? c.rm : []
    };
}
const cfgSave = c => { try {
    localStorage.stcfg = JSON.stringify(c);
}
catch (e) { } };
const kindOn = k => !k || cfg().kinds[k] !== false;
const nlog = () => { try {
    return JSON.parse(localStorage.nlog || '[]');
}
catch (e) {
    return [];
} };
const nsave = a => { try {
    localStorage.nlog = JSON.stringify(a.slice(0, 40));
}
catch (e) { } };
const ago = t => { const s = (Date.now() - t) / 1e3; return s < 60 ? 'vừa xong' : s < 3600 ? Math.floor(s / 60) + ' phút trước' : s < 86400 ? Math.floor(s / 3600) + ' giờ trước' : new Date(t).toLocaleDateString('vi-VN'); };
function nbUpdate() {
    const el = $('#nbn');
    if (!el)
        return;
    const n = nlog().filter(x => x.t > (+localStorage.nseen || 0)).length;
    el.classList.toggle('hide', !n);
    el.textContent = n > 99 ? '99+' : n;
}
function toast(t, u, o) {
    o = o || {};
    const e = $('#toast');
    e.innerHTML = `<span class="ni">${esc(o.ico || '🔔')}</span><span class="nb"><b>${esc(o.title || 'Sổ Thu Chi')}</b><span>${esc(t)}</span></span><em>bây giờ</em>`;
    e.classList.toggle('u', !!u);
    e.classList.toggle('err', !!o.err);
    if (u) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Hoàn tác';
        b.onclick = () => { if (UNDO && UNDO.fn === u) {
            UNDO = null;
            e.classList.remove('on');
            u();
        } };
        e.appendChild(b);
        UNDO = { fn: u, t: Date.now() };
    }
    e.classList.add('on');
    clearTimeout(toast.i);
    toast.i = setTimeout(() => e.classList.remove('on'), u ? 8000 : o.sticky ? 12000 : 3600);
}
async function swReg() {
    if (SWREG)
        return SWREG;
    if (!('serviceWorker' in navigator))
        return null;
    try {
        return SWREG = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 2500))]);
    }
    catch (e) {
        return null;
    }
}
async function showSys(title, body, o) {
    if (!pushOn())
        return false;
    o = o || {};
    const opt = {
        body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: o.tag || 'stc', renotify: true, lang: 'vi',
        requireInteraction: !!o.sticky, vibrate: [80, 40, 80], data: { tab: o.tab || '', url: location.href.split('#')[0] }
    };
    try {
        const r = await swReg();
        if (r && r.showNotification) {
            await r.showNotification(title, opt);
            return true;
        }
        const n = new Notification(title, opt);
        n.onclick = () => { window.focus(); if (o.tab && alive())
            go(o.tab); n.close(); };
        return true;
    }
    catch (e) {
        return false;
    }
}
if ('serviceWorker' in navigator)
    navigator.serviceWorker.addEventListener('message', e => {
        const d = e.data || {};
        if (d.type === 'open-tab' && d.tab && alive())
            go(d.tab);
    });
function notify(body, o) {
    o = o || {};
    const title = o.title || 'Sổ Thu Chi', ico = o.ico || (o.err ? '⚠️' : '✅');
    if (o.kind && !kindOn(o.kind)) {
        if (!o.bg)
            toast(body, o.undo, { title, ico, err: o.err });
        return;
    }
    const a = nlog();
    a.unshift({ t: Date.now(), title, body, ico, err: !!o.err, tab: o.tab || '' });
    nsave(a);
    nbUpdate();
    toast(body, o.undo, { title, ico, err: o.err, sticky: o.sticky });
    if (pushOn() && (o.force || cfg().fg || document.hidden || !document.hasFocus()))
        showSys(title, body, o);
}
const txLine = t => (t.type === 'Chi' ? '−' : t.type === 'Thu' ? '+' : '') + num(t.amount) + ' · ' + (t.sub || t.cat || t.type) + ' · ' + (t.type === 'Chuyển khoản' && t.accTo ? t.acc + ' → ' + t.accTo : t.acc);
const txMsg = t => 'Mã ' + t.id + '\n' + txLine(t);
function notifyChanges(nw, up) {
    const pack = (L, one, many, ico) => {
        const b = L.slice(0, 3).map(t => 'Mã ' + t.id + ': ' + txLine(t)).join('\n') + (L.length > 3 ? '\n+' + (L.length - 3) + ' giao dịch khác' : '');
        notify(b, { title: L.length === 1 ? one : L.length + ' ' + many, ico, tag: 'sync-' + ico, kind: 'sync', bg: true, tab: 'tx' });
    };
    if (!nw.length && !up.length)
        return notify('Dữ liệu vừa được cập nhật', { title: 'Đồng bộ', ico: '🔄', tag: 'sync', kind: 'sync', bg: true });
    if (nw.length)
        pack(nw, 'Giao dịch mới được tạo', 'giao dịch mới được tạo', '🧾');
    if (up.length)
        pack(up, 'Giao dịch đã được cập nhật', 'giao dịch đã được cập nhật', '✏️');
    setTimeout(() => limCheck(nw.concat(up), null, true), 1800);
}
function limCheck(rows, undo, bg) {
    rows = (rows || []).filter(r => r && r.type === 'Chi' && !heldSet().has(r.acc));
    if (!rows.length || !S.lim.length)
        return;
    const chi = stx().filter(t => t.type === 'Chi'), today = ymd(new Date()), W = [];
    S.lim.forEach(L => {
        const hit = rows.filter(r => !L.cat || L.cat === r.cat);
        if (!hit.length)
            return;
        const day = L.per === 'Ngày', keys = [...new Set(hit.map(r => day ? r.date : r.date.slice(0, 7)))];
        keys.forEach(k => {
            const used = chi.filter(t => (day ? t.date === k : t.date.slice(0, 7) === k) && (!L.cat || t.cat === L.cat)).reduce((s, t) => s + t.amount, 0);
            if (used <= L.v)
                return;
            const when = day ? (k === today ? 'ngày' : 'ngày ' + k.slice(8) + '/' + k.slice(5, 7)) : (k === today.slice(0, 7) ? 'tháng' : 'tháng ' + k.slice(5) + '/' + k.slice(0, 4));
            W.push((L.cat ? emo(L.cat) + ' ' + L.cat : 'Tổng chi') + ' bội chi ' + vnd(used - L.v) + '\nĐã chi ' + vnd(used) + ' / hạn mức ' + when + ' ' + vnd(L.v));
        });
    });
    if (W.length)
        setTimeout(() => notify(W.join('\n'), { title: 'Hạn mức đã bội chi', ico: '⚠️', err: 1, kind: 'limit', tag: 'limit', tab: 'lim', bg: !!bg, undo }), bg ? 0 : 1800);
}
const VN_DAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function reportOf(date) {
    const L = stx().filter(t => t.date === date && (t.type === 'Thu' || t.type === 'Chi')), d = new Date(date + 'T00:00');
    const lab = VN_DAY[d.getDay()] + ', ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
    const sm = ty => L.filter(t => t.type === ty).reduce((s, t) => s + t.amount, 0), thu = sm('Thu'), chi = sm('Chi'), net = thu - chi;
    if (!L.length)
        return lab + '\nChưa ghi khoản thu chi nào. Mở sổ để bổ sung nếu bạn quên.';
    const g = {};
    L.filter(t => t.type === 'Chi').forEach(t => { const k = t.cat || 'Khác'; g[k] = (g[k] || 0) + t.amount; });
    const top = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
    const over = S.lim.filter(x => x.per === 'Ngày').map(x => {
        const u = L.filter(t => t.type === 'Chi' && (!x.cat || t.cat === x.cat)).reduce((s, t) => s + t.amount, 0);
        return u > x.v ? (x.cat || 'Tổng chi') + ' vượt ' + vnd(u - x.v) : '';
    }).filter(Boolean);
    const mo = sums(ymd(new Date()).slice(0, 7));
    const lines = [lab + ' · ' + L.length + ' khoản', 'Thu +' + vnd(thu), 'Chi −' + vnd(chi), 'Chênh lệch ' + (net < 0 ? '−' : '+') + vnd(Math.abs(net))];
    if (top)
        lines.push('Chi nhiều nhất: ' + top[0] + ' (' + vnd(top[1]) + ')');
    if (over.length)
        lines.push('⚠️ Vượt hạn mức ngày: ' + over.join(', '));
    lines.push('Tháng này đã chi ' + vnd(mo.chi));
    return lines.join('\n');
}
function dailyReport(preview) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    notify(reportOf(ymd(y)), { title: 'Báo cáo thu chi hôm qua', ico: '📒', tag: 'daily-report', kind: 'report', bg: !preview, force: true, sticky: true, tab: 'rp' });
}
const firedMap = () => { try {
    return JSON.parse(localStorage.nfired || '{}');
}
catch (e) {
    return {};
} };
const fired = k => !!firedMap()[k];
function markFired(k) {
    const o = firedMap();
    o[k] = Date.now();
    for (const x in o)
        if (Date.now() - o[x] > 3 * 864e5)
            delete o[x];
    try {
        localStorage.nfired = JSON.stringify(o);
    }
    catch (e) { }
}
const rmKey = (r, day) => 'rm:' + r.id + ':' + day + ':' + r.at;
function armRm(r) {
    const n = new Date();
    if (toMin(r.at) <= n.getHours() * 60 + n.getMinutes())
        markFired(rmKey(r, ymd(n)));
}
function schedTick() {
    const now = new Date(), today = ymd(now), cur = now.getHours() * 60 + now.getMinutes(), c = cfg();
    if (c.kinds.remind !== false)
        c.rm.forEach(r => {
            const m = toMin(r.at);
            if (!r.on || m < 0 || (r.days && !r.days.includes(now.getDay())))
                return;
            const k = rmKey(r, today);
            if (cur < m || fired(k))
                return;
            markFired(k);
            const late = cur - m;
            if (late > 240)
                return;
            notify((late > 2 ? 'Hẹn lúc ' + r.at + '\n' : '') + (r.text || 'Đến giờ ghi chép thu chi'), { title: 'Nhắc nhở thu chi', ico: '⏰', tag: 'rm-' + r.id, kind: 'remind', bg: true, force: true, sticky: true, tab: 'tx' });
        });
    if (c.rp.on && c.kinds.report !== false && S.synced && !$('#app').classList.contains('hide') && alive()) {
        const k = 'rp:' + today;
        if (cur >= toMin(c.rp.at) && !fired(k)) {
            markFired(k);
            dailyReport(false);
        }
    }
}
let _sch = 0;
function schedStart() {
    if (_sch)
        return;
    _sch = setInterval(schedTick, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden)
        schedTick(); });
    addEventListener('focus', schedTick);
}
async function enablePush() {
    if (!CAN_SYS) {
        toast(IOS ? 'Trên iPhone/iPad: thêm ứng dụng vào Màn hình chính rồi mở từ biểu tượng đó' : 'Trình duyệt này không hỗ trợ thông báo');
        return 'unsupported';
    }
    let p = Notification.permission;
    if (p === 'default') {
        try {
            p = await new Promise(res => { const r = Notification.requestPermission(res); if (r && r.then)
                r.then(res); });
        }
        catch (e) {
            p = Notification.permission;
        }
    }
    if (p === 'granted')
        showSys('Đã bật thông báo', 'Bạn sẽ nhận thông báo giao dịch, hạng mục bội chi, nhắc nhở và báo cáo mỗi sáng.', { tag: 'test' });
    else if (p === 'denied')
        toast('Thông báo đang bị chặn. Bấm biểu tượng ổ khóa cạnh thanh địa chỉ để cho phép.');
    nbUpdate();
    return p;
}
function openNotif() {
    ED = null;
    E = null;
    localStorage.nseen = Date.now();
    nbUpdate();
    const L = nlog();
    $('#sh').innerHTML = `<div class="shh"><h3>Thông báo</h3><button class="chip" data-nt="settings">${ic('set')}Cài đặt</button></div>
${L.length ? `<div class="shh sub"><b>Gần đây</b><button class="chip" data-nt="clear">Xóa hết</button></div>` : ''}
<div class="menu">${L.map(n => `<div class="row"><span class="dot">${esc(n.ico)}</span><span class="m"><b>${esc(n.title)}</b><small style="white-space:pre-line">${esc(n.body)}</small></span><small class="mut">${ago(n.t)}</small></div>`).join('') || empty('Chưa có thông báo', 'Giao dịch, bội chi, nhắc nhở và báo cáo sẽ xuất hiện ở đây.')}</div>`;
    openSheet();
}
function openSettings() {
    ED = null;
    E = null;
    const c = cfg(), p = permOf(), mode = themeMode();
    const sw = (key, ico, t, sub, on) => `<label class="row sw"><span class="dot">${ico}</span><span class="m"><b>${t}</b><small>${sub}</small></span><input type="checkbox" role="switch" data-cfg="${key}" ${on ? 'checked' : ''}></label>`;
    const stat = { granted: 'Đã bật', denied: 'Đang bị chặn trong trình duyệt', default: 'Chưa bật', unsupported: IOS ? 'Cần thêm vào Màn hình chính' : (window.isSecureContext ? 'Trình duyệt không hỗ trợ' : 'Cần mở bằng https') }[p];
    const hint = p === 'denied' ? 'Bấm biểu tượng ổ khóa cạnh thanh địa chỉ, đổi “Thông báo” sang Cho phép, rồi tải lại trang. Trên điện thoại: Cài đặt → Ứng dụng/Trang web → Thông báo.'
        : p === 'unsupported' && IOS ? 'iPhone/iPad chỉ nhận thông báo khi ứng dụng đã được thêm vào Màn hình chính: Chia sẻ → Thêm vào Màn hình chính, rồi mở từ biểu tượng mới.' : '';
    const day = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    $('#sh').innerHTML = `<div class="shh"><h3>Cài đặt</h3><button class="chip" data-nt="open">${ic('bell')}Thông báo</button></div>

<div class="sec">Giao diện</div>
<div class="seg s3">${[['auto', 'Theo thiết bị'], ['light', 'Sáng'], ['dark', 'Tối']].map(([k, l]) => `<button data-nt="theme:${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('')}</div>

<div class="sec">Thông báo trên thiết bị</div>
<div class="menu"><div class="row"><span class="dot">🔔</span><span class="m"><b>Thông báo của trình duyệt</b><small>${stat}</small></span>${p === 'default' ? '<button class="chip on" data-nt="enable">Bật</button>' : p === 'granted' ? '<button class="chip" data-nt="test">Gửi thử</button>' : ''}</div>
${p === 'granted' ? sw('fg', '📲', 'Hiện cả khi đang mở ứng dụng', 'Mặc định chỉ hiện khi bạn ở ứng dụng hoặc tab khác', c.fg) : ''}</div>
${hint ? `<p class="hint">${hint}</p>` : ''}

<div class="sec">Thông báo về</div>
<div class="menu">${Object.entries(CFG_KINDS).map(([k, [i, t, s]]) => sw('k:' + k, i, t, s, c.kinds[k] !== false)).join('')}</div>

<div class="sec">Báo cáo thu chi hôm qua</div>
<div class="menu">${sw('k:report', '📒', 'Gửi báo cáo mỗi ngày', 'Tổng thu, chi và hạng mục chi nhiều nhất của hôm qua', c.kinds.report !== false && c.rp.on)}
<div class="row"><span class="m"><b>Giờ gửi</b><small>Mặc định 06:00 sáng</small></span><input type="time" class="tm" data-cfg="rp.at" value="${esc(c.rp.at)}"><button class="chip" data-nt="report">Xem thử</button></div></div>

<div class="sec">Nhắc nhở ghi chép thu chi</div>
${c.rm.map(r => `<div class="rem"><div class="rem-t"><input type="time" class="tm" data-rm="at:${r.id}" value="${esc(r.at)}"><input class="tx" data-rm="text:${r.id}" value="${esc(r.text)}" placeholder="Nội dung nhắc" aria-label="Nội dung nhắc"><label class="sw"><input type="checkbox" role="switch" data-rm="on:${r.id}" ${r.on ? 'checked' : ''} aria-label="Bật nhắc nhở"></label><button class="x" data-nt="rm-del:${r.id}" aria-label="Xóa nhắc nhở">×</button></div>
<div class="days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" class="${(r.days || []).includes(d) ? 'on' : ''}" data-nt="rm-day:${r.id}:${d}" aria-pressed="${(r.days || []).includes(d)}">${day[d]}</button>`).join('')}</div></div>`).join('')}
<button class="btn w" data-nt="rm-add">＋ Thêm nhắc nhở</button>
<p class="hint">Nhắc nhở và báo cáo chạy khi ứng dụng đang mở (kể cả ở tab nền hoặc ứng dụng đã cài). Nếu bạn mở lại sau giờ hẹn, ứng dụng sẽ nhắc bù.</p>
${INST ? `<div class="sec">Ứng dụng</div><div class="menu"><button class="row" data-nt="install"><span class="dot">⬇️</span><span class="m"><b>Cài đặt ứng dụng</b><small>Mở như ứng dụng riêng, có biểu tượng trên máy</small></span></button></div>` : ''}`;
    openSheet();
}
document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-nt]');
    if (!b || b.type === 'checkbox')
        return;
    const [k, a, d] = b.dataset.nt.split(':'), c = cfg();
    if (k === 'open')
        return openNotif();
    if (k === 'settings')
        return openSettings();
    if (k === 'enable') {
        await enablePush();
        return openSettings();
    }
    if (k === 'test')
        return notify('Thông báo thử: mọi thứ đang hoạt động tốt.', { title: 'Sổ Thu Chi', ico: '🔔', tag: 'test', force: true });
    if (k === 'report')
        return dailyReport(true);
    if (k === 'theme') {
        setTheme(a);
        return openSettings();
    }
    if (k === 'install' && INST) {
        INST.prompt();
        try {
            await INST.userChoice;
        }
        catch (x) { }
        INST = null;
        return openSettings();
    }
    if (k === 'clear') {
        nsave([]);
        nbUpdate();
        return openNotif();
    }
    if (k === 'rm-add') {
        const r = { id: Math.random().toString(36).slice(2, 8), at: '21:00', text: 'Ghi lại các khoản thu chi hôm nay', days: [0, 1, 2, 3, 4, 5, 6], on: true };
        armRm(r);
        c.rm.push(r);
        cfgSave(c);
        return openSettings();
    }
    if (k === 'rm-del') {
        c.rm = c.rm.filter(r => r.id !== a);
        cfgSave(c);
        return openSettings();
    }
    if (k === 'rm-day') {
        const r = c.rm.find(x => x.id === a);
        if (!r)
            return;
        const n = +d;
        r.days = (r.days || []).includes(n) ? r.days.filter(x => x !== n) : (r.days || []).concat(n);
        cfgSave(c);
        return openSettings();
    }
});
document.addEventListener('change', e => {
    const t = e.target, g = t.dataset && t.dataset.cfg, m = t.dataset && t.dataset.rm;
    if (!g && !m)
        return;
    const c = cfg();
    if (g) {
        if (g === 'fg')
            c.fg = t.checked;
        else if (g === 'rp.at') {
            if (toMin(t.value) < 0)
                return;
            c.rp.at = t.value;
        }
        else if (g === 'k:report') {
            c.kinds.report = t.checked;
            c.rp.on = t.checked;
        }
        else if (g.startsWith('k:'))
            c.kinds[g.slice(2)] = t.checked;
    }
    else {
        const [f, id] = m.split(':'), r = c.rm.find(x => x.id === id);
        if (!r)
            return;
        if (f === 'at') {
            if (toMin(t.value) < 0)
                return;
            r.at = t.value;
            armRm(r);
        }
        else if (f === 'on') {
            r.on = t.checked;
            if (r.on)
                armRm(r);
        }
    }
    cfgSave(c);
});
document.addEventListener('input', e => {
    const m = e.target.dataset && e.target.dataset.rm;
    if (!m || !m.startsWith('text:'))
        return;
    const c = cfg(), r = c.rm.find(x => x.id === m.slice(5));
    if (r) {
        r.text = e.target.value;
        cfgSave(c);
    }
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e; });
addEventListener('appinstalled', () => { INST = null; notify('Đã cài đặt ứng dụng', { ico: '📲' }); });
function pushInit() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol))
        navigator.serviceWorker.register('sw.js').then(r => { SWREG = r; }).catch(() => { });
    nbUpdate();
    schedTick();
    if (CAN_SYS && Notification.permission === 'default' && !localStorage.nask)
        setTimeout(async () => {
            localStorage.nask = '1';
            if (await ask('Bật thông báo?', 'Nhận thông báo giao dịch, hạng mục bội chi, nhắc nhở và báo cáo thu chi mỗi sáng, kể cả khi bạn đang ở ứng dụng khác.', { icon: '🔔', ok: 'Bật thông báo', cancel: 'Để sau' }))
                enablePush();
        }, 2500);
}
schedStart();
