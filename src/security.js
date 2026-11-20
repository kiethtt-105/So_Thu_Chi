// Phần "Đăng nhập và thiết bị" trong Cài đặt: lịch sử đăng nhập + thu hồi đăng nhập trên máy khác.
// Nạp sau app.js (dùng chung $, esc, ask, toast, STORE, lockExpired, LOGOUT_ALL_AT). Passkey vẫn nằm ở app.js (secLoad).
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
<div class="menu"><div class="row"><span class="dot">🔒</span><span class="m"><b>Thu hồi đăng nhập trên máy khác</b><small>Giữ lại máy này. Phiên hết hạn sau 48 giờ không hoạt động.</small></span><button type="button" class="btn" data-a="logoutall">Thu hồi</button></div></div>
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
