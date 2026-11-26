// Phần "Đăng nhập và thiết bị" trong Cài đặt: thiết bị tin cậy, lịch sử đăng nhập, thu hồi đăng nhập trên máy khác.
// Nạp sau app.js (dùng chung $, esc, ask, toast, STORE, lockExpired, LOGOUT_ALL_AT).
const SES = STORE ? STORE.replace(/[^/]*$/, 'sessions') : '';
let HIST_ALL = false;

async function sesCall(body) {
    if (!SES) return { ok: false, err: 'Thiếu cấu hình máy chủ' };
    try {
        const r = await fetch(SES, { method: 'POST', credentials: 'same-origin', body: JSON.stringify(body) });
        let j; try { j = await r.json(); } catch (e) { return { ok: false, err: 'Máy chủ trả lỗi ' + r.status }; }
        if (j.auth) lockExpired();
        return j;
    } catch (e) { return { ok: false, err: 'Không kết nối được máy chủ' }; }
}

function secSection() {
    return `<div class="sec">Đăng nhập và thiết bị</div>
<div id="seccard"></div>
<div id="trustcard"></div>
<div class="menu"><label class="row sw"><span class="dot">🧹</span><span class="m"><b>Xóa bản lưu sổ trên máy này khi khóa</b><small>Giao dịch, tài khoản lưu để dùng offline sẽ bị xóa khi khóa sổ hoặc hết phiên, lần mở sau tải lại từ Google Sheet. Sổ nợ và cài đặt giữ nguyên. Nên bật trên máy dùng chung.</small></span><input type="checkbox" role="switch" id="wipeLock" ${localStorage.wipeLock === '1' ? 'checked' : ''}></label></div>
<div class="menu"><div class="row"><span class="dot">🔒</span><span class="m"><b>Thu hồi đăng nhập trên máy khác</b><small>Giữ lại máy này. Các máy khác phải nhập lại mật khẩu và bị bỏ khỏi danh sách tin cậy.</small></span><button type="button" class="btn" data-a="logoutall">Thu hồi</button></div></div>
<div id="histcard"></div>`;
}

async function logoutAll() {
    if (!await ask('Thu hồi đăng nhập trên máy khác?', 'Mọi máy khác phải nhập lại mật khẩu. Máy này vẫn giữ đăng nhập.', { icon: '🔒', ok: 'Thu hồi' })) return;
    LOGOUT_ALL_AT = Date.now();
    const j = await sesCall({ act: 'revokeOthers' });
    LOGOUT_ALL_AT = Date.now();
    toast(j.ok ? 'Đã thu hồi đăng nhập trên các máy khác' : (j.err || 'Không thực hiện được'));
    if (j.ok) secHistLoad();
}

// Gọi từ lock() trong app.js: xóa bản lưu offline của sổ (không đụng sổ nợ / cài đặt, và không xóa khi còn thay đổi chưa gửi)
function wipeLocal() {
    if (localStorage.wipeLock !== '1') return;
    if (typeof OB !== 'undefined' && OB && OB.n) return;
    try { localStorage.removeItem('cache'); } catch (e) { }
    try { KV.put('cache', ''); } catch (e) { }
}
document.addEventListener('change', e => {
    if (!e.target || e.target.id !== 'wipeLock') return;
    try { if (e.target.checked) localStorage.wipeLock = '1'; else localStorage.removeItem('wipeLock'); } catch (x) { }
    toast(e.target.checked ? 'Sẽ xóa bản lưu sổ trên máy này mỗi khi khóa' : 'Đã tắt xóa bản lưu khi khóa');
});

// ---- Thiết bị tin cậy: mặc định KHÔNG tin cậy (phiên 12 giờ). Tin cậy = phiên tự gia hạn khi còn dùng, hết hạn nếu 24 giờ không mở (tối đa 30 ngày). ----
async function secTrustLoad() {
    const box = $('#trustcard'); if (!box) return;
    box.innerHTML = '<div class="sec">Thiết bị tin cậy</div><p class="hint">Đang tải…</p>';
    const j = await sesCall({ act: 'devices' });
    const b2 = $('#trustcard'); if (!b2) return;
    if (!j.ok) { b2.innerHTML = `<div class="sec">Thiết bị tin cậy</div><p class="hint">${esc(j.err || 'Không tải được danh sách thiết bị')}</p>`; return; }
    const me = j.me || '-', list = j.list || [];
    try { if (me !== '-') { localStorage.trust = '1'; localStorage.did = me; } else { localStorage.removeItem('trust'); localStorage.removeItem('did'); } } catch (e) { }   // đồng bộ cờ trên máy với server
    const row = x => `<div class="row"><span class="dot">${x.id === me ? '💻' : '🖥️'}</span><span class="m"><b>${esc(x.n || 'Thiết bị')}</b><small>Dùng lần cuối ${hFmt(x.l || x.t)}${x.ip ? ' · IP ' + esc(x.ip) : ''}</small></span>${x.id === me ? '<span class="chip on">Máy này</span>' : `<button type="button" class="btn" data-trust="del:${esc(x.id)}">Bỏ tin cậy</button>`}</div>`;
    b2.innerHTML = `<div class="sec">Thiết bị tin cậy</div>
<div class="menu"><label class="row sw"><span class="dot">🛡️</span><span class="m"><b>Tin cậy thiết bị này</b><small>Tắt (mặc định): phiên hết hạn sau 12 giờ kể từ lúc đăng nhập. Bật: phiên tự gia hạn khi bạn còn dùng, chỉ hết hạn nếu 24 giờ không mở, tối đa 30 ngày. Chỉ bật trên máy của riêng bạn.</small></span><input type="checkbox" role="switch" id="trustHere" ${me !== '-' ? 'checked' : ''}></label></div>`
        + (list.length ? `<div class="menu">${list.map(row).join('')}</div>` : '<p class="hint">Chưa có thiết bị nào được tin cậy.</p>');
}
document.addEventListener('change', async e => {
    if (!e.target || e.target.id !== 'trustHere') return;
    const on = e.target.checked; e.target.disabled = true;
    const j = await sesCall({ act: on ? 'trust' : 'untrust' });
    if (j.ok) {
        try { if (on) { localStorage.trust = '1'; localStorage.did = j.id; localStorage.sess = Date.now(); } else { localStorage.removeItem('trust'); localStorage.removeItem('did'); localStorage.sess = Date.now(); } } catch (x) { }
        toast(on ? 'Đã tin cậy thiết bị này' : 'Đã bỏ tin cậy, phiên hết hạn sau 12 giờ');
    } else toast(j.err || 'Không thực hiện được');
    secTrustLoad();
});
document.addEventListener('click', async e => {
    const b = e.target.closest('[data-trust]'); if (!b || !/^del:/.test(b.dataset.trust)) return;
    if (!await ask('Bỏ tin cậy thiết bị này?', 'Thiết bị đó sẽ phải đăng nhập lại và chỉ giữ phiên 12 giờ.', { icon: '🛡️', ok: 'Bỏ tin cậy' })) return;
    const j = await sesCall({ act: 'untrust', id: b.dataset.trust.slice(4) });
    toast(j.ok ? 'Đã bỏ tin cậy thiết bị' : (j.err || 'Không thực hiện được'));
    secTrustLoad();
});

const hFmt = t => new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function secHistLoad() {
    const box = $('#histcard'); if (!box) return;
    box.innerHTML = '<div class="sec">Lịch sử đăng nhập</div><p class="hint">Đang tải…</p>';
    const j = await sesCall({ act: 'history' });
    const b2 = $('#histcard'); if (!b2) return;
    if (!j.ok) { b2.innerHTML = `<div class="sec">Lịch sử đăng nhập</div><p class="hint">${esc(j.err || 'Không tải được lịch sử')}</p>`; return; }
    const list = j.list || [], rev = +j.rev || 0, me = j.me || {};
    let meSeen = false;   // chỉ gắn "Máy này" cho lần đăng nhập thành công mới nhất khớp IP + trình duyệt
    const row = x => {
        const here = !meSeen && x.ok && x.ip === me.ip && x.d === me.d; if (here) meSeen = true;
        const gone = x.ok && x.t < rev;
        return `<div class="row"><span class="dot">${x.ok ? '✅' : '⚠️'}</span><span class="m"><b>${esc(x.d || 'Không rõ')}${x.ok ? '' : ' · sai mật khẩu'}</b><small>${hFmt(x.t)} · IP ${esc(x.ip || '?')}${x.ok ? ' · ' + esc(x.m || '') : ''}${gone ? ' · đã bị thu hồi' : ''}</small></span>${here ? '<span class="chip on">Máy này</span>' : ''}</div>`;
    };
    const shown = HIST_ALL ? list : list.slice(0, 5);
    b2.innerHTML = `<div class="sec">Lịch sử đăng nhập</div>` + (list.length
        ? `<div class="menu">${shown.map(row).join('')}</div>
<div class="shh sub">${list.length > 5 ? `<button type="button" class="chip" data-hist="more">${HIST_ALL ? 'Thu gọn' : 'Xem tất cả (' + list.length + ')'}</button>` : '<span></span>'}<button type="button" class="chip" data-hist="clear">Xóa lịch sử</button></div>`
        : '<p class="hint">Chưa có lần đăng nhập nào được ghi lại (chỉ ghi từ khi bật tính năng này).</p>')
        + (rev ? `<p class="hint">Lần thu hồi gần nhất: ${hFmt(rev)}.</p>` : '');
}

document.addEventListener('click', async e => {
    const b = e.target.closest('[data-hist]'); if (!b) return;
    if (b.dataset.hist === 'more') { HIST_ALL = !HIST_ALL; return secHistLoad(); }
    if (b.dataset.hist === 'clear') {
        if (!await ask('Xóa lịch sử đăng nhập?', 'Chỉ xóa danh sách ghi lại, không ảnh hưởng đăng nhập hiện tại.', { icon: '🗑️', ok: 'Xóa' })) return;
        const j = await sesCall({ act: 'clearHistory' });
        toast(j.ok ? 'Đã xóa lịch sử' : (j.err || 'Không xóa được'));
        return secHistLoad();
    }
});
