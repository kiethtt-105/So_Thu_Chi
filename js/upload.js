const IMG_MAX = 1600, IMG_KB = 300;
function viaImg(f) {
    return new Promise((ok, no) => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); no(Error('Không đọc được ảnh này')); }; i.src = u; });
}
const loadBmp = f => window.createImageBitmap ? createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => viaImg(f)) : viaImg(f);
const toBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function squeeze(f) {
    const im = await loadBmp(f), w = im.width || im.naturalWidth, h = im.height || im.naturalHeight;
    let k = Math.min(1, IMG_MAX / Math.max(w, h)), q = .82, b;
    for (let i = 0; i < 10; i++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        const x = c.getContext('2d');
        x.fillStyle = '#fff';
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        b = await toBlob(c, q);
        if (!b)
            throw Error('Không nén được ảnh');
        if (b.size <= IMG_KB * 1024)
            break;
        if (q > .5)
            q -= .1;
        else
            k *= .85;
    }
    if (im.close)
        im.close();
    return b;
}
const b64 = b => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(Error('Không đọc được ảnh')); r.readAsDataURL(b); });
async function driveUp(blob, name) {
    if (!API)
        throw Error('Thiếu địa chỉ kết nối');
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 90000);
    let r;
    try {
        r = await fetch(API, { method: 'POST', signal: ac.signal, body: JSON.stringify({ img: { name, mime: 'image/jpeg', data: await b64(blob) } }) });
    }
    catch (e) {
        throw Error('Không có kết nối mạng');
    }
    finally {
        clearTimeout(tm);
    }
    let j;
    try {
        j = await r.json();
    }
    catch (e) {
        throw Error('Máy chủ chưa cấp quyền Drive hoặc chưa triển khai bản mới');
    }
    if (!j.ok)
        throw Error(j.err || 'Tải ảnh thất bại');
    if (!j.url)
        throw Error('Máy chủ đang chạy bản cũ, chưa nhận ảnh — cần triển khai phiên bản mới');
    return j;
}
function renderAtt() {
    const a = $('#att');
    if (!a || !E)
        return;
    const im = E.imgs || [], pd = E.pend || [];
    a.innerHTML = `<span class="l" style="font-size:12px;color:var(--mut)">Ảnh đính kèm</span><div class="cg" style="margin-top:6px">`
        + im.map((u, i) => `<span class="chip att-i"><a href="${esc(u)}" target="_blank" rel="noopener">📎 Ảnh ${i + 1}</a><button type="button" data-imgdel="${i}" aria-label="Gỡ ảnh">×</button></span>`).join('')
        + pd.map(p => p.err ? `<span class="chip att-i bad">⚠️ ${esc(p.err)}<button type="button" data-imgx="${p.id}" aria-label="Đóng">×</button></span>` : `<span class="chip att-i"><i class="spn"></i> Đang nén và tải lên…</span>`).join('')
        + `<label class="chip att-add">📷 Thêm ảnh<input type="file" id="fimg" accept="image/*" multiple hidden></label></div>`;
}
const imgName = () => {
    const E0 = E, amt = pm(($('#fa') || {}).value || E0.amount);
    return [E0.date, nz(E0.sub || E0.cat || E0.type).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'giao-dich', amt || 0, Date.now().toString(36)].join('_') + '.jpg';
};
async function attach(f) {
    const E0 = E;
    if (!E0)
        return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) {
        toast('Chỉ đính kèm được file ảnh');
        return;
    }
    const p = { id: Math.random().toString(36).slice(2) };
    (E0.pend = E0.pend || []).push(p);
    E0.up = (E0.up || 0) + 1;
    renderAtt();
    try {
        const small = await squeeze(f), j = await driveUp(small, imgName());
        (E0.imgs = E0.imgs || []).push(j.url);
        E0.pend = E0.pend.filter(x => x !== p);
        notify('Đã tải ảnh lên Drive (' + Math.round(small.size / 1024) + ' KB, đã nén từ ' + Math.round(f.size / 1024) + ' KB)', { title: 'Ảnh đính kèm', ico: '📷', tag: 'img' });
    }
    catch (e) {
        p.err = e.message;
    }
    E0.up--;
    if (E === E0)
        renderAtt();
}
$('#ov').addEventListener('change', e => {
    if (e.target.id !== 'fimg' || !E)
        return;
    const fs = [...e.target.files];
    e.target.value = '';
    fs.forEach(attach);
});
$('#ov').addEventListener('click', e => {
    if (!E)
        return;
    const d = e.target.closest('[data-imgdel]'), x = e.target.closest('[data-imgx]');
    if (d) {
        E.imgs.splice(+d.dataset.imgdel, 1);
        renderAtt();
    }
    else if (x) {
        E.pend = (E.pend || []).filter(p => p.id !== x.dataset.imgx);
        renderAtt();
    }
});
