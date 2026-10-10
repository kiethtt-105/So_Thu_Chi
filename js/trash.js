/* Thùng rác: định dạng thời gian, nhóm theo ngày, lọc theo loại, khôi phục an toàn (kiểm tra trùng / thiếu tài khoản), khôi phục hàng loạt */
let TF = 'all';
const TRK = { gd: 'Giao dịch', tk: 'Tài khoản', dm: 'Hạng mục' };
const trTime = x => { const t = Date.parse(x.at); return isNaN(t) ? 0 : t; };
const trKey = x => [x.k, x.at, x.id || ''].join('|');
const trDay = t => {
    if (!t) return 'Không rõ thời gian';
    const d = ymd(new Date(t)), n = new Date(), y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    return d === ymd(n) ? 'Hôm nay' : d === ymd(y) ? 'Hôm qua' : new Date(t).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
};
const trHM = t => t ? hm(new Date(t)) : '';
function trRow(x) {
    const t = trTime(x);
    let ico, title, sub;
    if (x.k === 'gd') {
        const sg = x.type === 'Chi' ? '−' : x.type === 'Thu' ? '+' : '';
        ico = x.type === 'Chuyển khoản' ? '⇄' : x.type === 'Điều chỉnh' ? '±' : emo(x.sub || x.cat);
        title = (x.type === 'Chuyển khoản' ? esc(x.acc) + ' → ' + esc(x.accTo) : esc(x.sub || x.cat || x.type)) + ' · <span class="' + (CLS[x.type] || '') + '">' + sg + num(x.amount) + '</span>';
        sub = esc([x.date, x.type === 'Chuyển khoản' ? '' : x.acc, noteTxt(x.note)].filter(Boolean).join(' · '));
    } else if (x.k === 'tk') {
        ico = '🏦';
        title = esc(x.id);
        sub = 'Tài khoản';
    } else {
        ico = emo(x.cat);
        title = esc(x.cat) + ' › ' + esc(x.sub);
        sub = 'Hạng mục';
    }
    return `<div class="row"><span class="dot">${ico}</span><span class="m"><b>${title}</b><small>${sub}${t ? ' · xóa lúc ' + trHM(t) : ''}</small></span><button class="chip" data-trr="${esc(trKey(x))}">Khôi phục</button></div>`;
}
function trashPage() {
    const all = S.trash.map((x, i) => ({ x, i, t: trTime(x) })).sort((a, b) => b.t - a.t || a.i - b.i);
    const L = all.filter(o => TF === 'all' || o.x.k === TF), cnt = k => k === 'all' ? all.length : all.filter(o => o.x.k === k).length;
    let h = '', last = '';
    L.forEach(o => {
        const d = trDay(o.t);
        if (d !== last) {
            last = d;
            h += `<div class="dh"><span>${esc(d)}</span><span>${L.filter(z => trDay(z.t) === d).length} mục</span></div>`;
        }
        h += trRow(o.x);
    });
    const chips = ['all', 'gd', 'tk', 'dm'].map(k => `<button type="button" class="chip ${TF === k ? 'on' : ''}" data-trf="${k}">${k === 'all' ? 'Tất cả' : TRK[k]} (${cnt(k)})</button>`).join('');
    return head('Thùng rác', all.length ? all.length + ' mục đã xóa, có thể khôi phục' : 'Các mục đã xóa có thể được khôi phục', L.length > 1 ? `<button class="btn p" data-trall>Khôi phục ${TF === 'all' ? 'tất cả' : L.length + ' mục'}</button>` : '')
        + (all.length ? `<div class="chips" style="margin-bottom:14px">${chips}</div>` : '')
        + `<div class="card flush">${h || empty('Thùng rác trống', 'Các giao dịch, tài khoản, hạng mục bạn xóa sẽ nằm ở đây để khôi phục.')}</div>`;
}
const trConflict = x => x.k === 'tk' && S.acc.some(a => a.name === x.id) ? 'Đã có tài khoản tên “' + x.id + '”. Hãy đổi tên tài khoản đó trước khi khôi phục.'
    : x.k === 'dm' && S.cat.some(c => c.p === x.cat && c.c === x.sub) ? 'Hạng mục “' + x.cat + ' › ' + x.sub + '” đã tồn tại.' : '';
async function trRestore(key) {
    const [k, at, id] = key.split('|'), x = S.trash.find(t => t.k === k && t.at === at && String(t.id || '') === id);
    if (!x) return toast('Mục này đã được khôi phục hoặc không còn trong thùng rác');
    const bad = trConflict(x);
    if (bad) return toast(bad);
    const ops = [];
    if (k === 'gd') {
        for (const n of [x.acc, x.accTo].filter(Boolean)) {
            if (S.acc.some(a => a.name === n)) continue;
            const tr = S.trash.find(t => t.k === 'tk' && t.id === n);
            if (tr) {
                if (!await ask('Khôi phục cả tài khoản “' + n + '”?', 'Giao dịch này thuộc tài khoản đang nằm trong Thùng rác.', { icon: '🏦', ok: 'Khôi phục cả hai' })) return;
                ops.push({ op: 'restore', at: tr.at, kind: 'tk' });
            } else if (!await ask('Tài khoản “' + n + '” không còn', 'Giao dịch sẽ được khôi phục nhưng không thuộc tài khoản nào đang có, số dư sẽ không khớp.', { icon: '⚠️', ok: 'Vẫn khôi phục' })) return;
        }
    }
    ops.push({ op: 'restore', at: x.at, kind: k });
    act(ops, 'Đã khôi phục');
}
async function trRestoreAll() {
    const L = S.trash.filter(x => TF === 'all' || x.k === TF).slice().sort((a, b) => ({ tk: 0, dm: 1, gd: 2 }[a.k] - { tk: 0, dm: 1, gd: 2 }[b.k]));
    const ok = L.filter(x => !trConflict(x)), skip = L.length - ok.length, tkIn = new Set(ok.filter(x => x.k === 'tk').map(x => x.id));
    const orph = ok.filter(x => x.k === 'gd' && [x.acc, x.accTo].filter(Boolean).some(n => !S.acc.some(a => a.name === n) && !tkIn.has(n))).length;
    if (!ok.length) return toast('Không có mục nào khôi phục được (trùng tên với mục đang có)');
    const msg = (skip ? skip + ' mục trùng tên với mục đang có sẽ được bỏ qua. ' : '') + (orph ? orph + ' giao dịch thuộc tài khoản không còn tồn tại. ' : '') + 'Khôi phục ' + ok.length + ' mục?';
    if (!await ask('Khôi phục ' + ok.length + ' mục', msg, { icon: '♻️', ok: 'Khôi phục' })) return;
    act(ok.map(x => ({ op: 'restore', at: x.at, kind: x.k })), 'Đã khôi phục ' + ok.length + ' mục');
}
function edelMsg(kind, o) {
    let s = '';
    if (kind === 'tk') {
        const n = S.tx.filter(t => t.acc === o.name || t.accTo === o.name).length, g = typeof GOALS !== 'undefined' ? GOALS.filter(x => x.acc === o.name).length : 0;
        if (n) s += 'Tài khoản đang có ' + n + ' giao dịch. ';
        if (g) s += 'Mục tiêu gắn với tài khoản này sẽ mất liên kết. ';
    } else if (kind === 'dm') {
        const n = S.tx.filter(t => t.cat === o.p && t.sub === o.c).length;
        if (n) s += 'Có ' + n + ' giao dịch đang dùng hạng mục này, chúng sẽ hiện ở mục “Chưa có trong danh mục”. ';
    }
    return s + 'Bạn có thể khôi phục lại trong Thùng rác.';
}
document.addEventListener('click', e => {
    const r = e.target.closest('[data-trr]'), f = e.target.closest('[data-trf]'), a = e.target.closest('[data-trall]');
    if (r) return trRestore(r.dataset.trr);
    if (f) { TF = f.dataset.trf; return render(); }
    if (a) return trRestoreAll();
});
