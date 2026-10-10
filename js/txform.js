const nzc = c => { if (c === 'đ')
    return 'd'; if (c === 'Đ')
    return 'D'; const r = c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return r.length === 1 ? r : (r ? c : ' '); };
const nz = s => String(s || '').normalize('NFC').split('').map(nzc).join('').toLowerCase();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topKey = (o, f) => { let b = null, bv = -1; for (const k in o) {
    const v = f ? f(o[k]) : o[k];
    if (v > bv) {
        bv = v;
        b = k;
    }
} return b; };
const todayS = () => ymd(new Date());
const catOk = (t, p, c) => S.cat.some(x => x.t === t && x.p === p && x.c === c);
function txSave(row, okMsg) {
    const prev = S.tx.find(t => t.id === row.id), old = prev && { ...prev }, isNew = !prev;
    return commit([{ op: 'tx.save', row }], {
        ok: txMsg(row), title: isNew ? 'Giao dịch đã được tạo' : 'Giao dịch đã được cập nhật', ico: isNew ? '🧾' : '✏️', tag: 'tx-' + row.id, kind: 'tx',
        local: () => { S.tx = S.tx.filter(t => t.id !== row.id).concat(row); S.m = row.date.slice(0, 7); },
        undo: () => commit(old ? [{ op: 'tx.save', row: old }] : [{ op: 'tx.del', id: row.id }], { ok: 'Đã hoàn tác', local: () => { S.tx = S.tx.filter(t => t.id !== row.id); if (old)
                S.tx.push(old); } })
    }).then(r => { if (r.ok)
        limWarn(row); return r; });
}
function txDel(id) {
    const old = { ...S.tx.find(x => x.id === id) };
    return commit([{ op: 'tx.del', id }], {
        ok: 'Mã ' + id + ' đã chuyển vào Thùng rác', title: 'Giao dịch đã được xóa', ico: '🗑️', tag: 'tx-' + id, kind: 'tx', local: () => { S.tx = S.tx.filter(x => x.id !== id); },
        undo: () => {
            const tr = S.trash.find(t => t.k === 'gd' && t.id === id);
            return commit(tr ? [{ op: 'restore', at: tr.at, kind: 'gd' }, { op: 'tx.save', row: old }] : [{ op: 'tx.save', row: old }], { ok: 'Đã hoàn tác', local: () => { S.tx = S.tx.filter(x => x.id !== id).concat(old); } });
        }
    });
}
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || ''))
            return;
        if (UNDO && Date.now() - UNDO.t < 15000) {
            e.preventDefault();
            const f = UNDO.fn;
            UNDO = null;
            $('#toast').classList.remove('on');
            f();
        }
    }
});
let TPL = [];
try {
    TPL = JSON.parse(localStorage.tpl || '[]');
}
catch (e) { }
let tplMg = false;
const tplSaveLS = () => { try {
    localStorage.tpl = JSON.stringify(TPL);
}
catch (e) { } };
const short = n => n >= 1e6 ? +(n / 1e6).toFixed(2) + 'tr' : n >= 1e3 ? +(n / 1e3).toFixed(1) + 'k' : String(n);
const tplLabel = t => (t.name || t.sub || t.type) + (t.amount ? ' ' + short(t.amount) : '');
function tplFrom(E0) {
    const name = (E0.note || E0.sub || E0.type).trim();
    return { name, type: E0.type, amount: E0.amount, acc: E0.acc, accTo: E0.accTo || '', cat: E0.cat || '', sub: E0.sub || '', note: E0.note || '' };
}
function tplRow() {
    if (!E || !E.isNew || !TPL.length)
        return '';
    return `<div class="tplr"><small>Mẫu</small><div class="chips">${TPL.map((t, i) => `<button type="button" class="chip" data-tpl="${i}">⚡ ${esc(tplLabel(t))}</button>`).join('')}</div></div>`;
}
function renderTpl() {
    const el = $('#qtp');
    if (!el)
        return;
    el.innerHTML = TPL.length ? TPL.map((t, i) => tplMg
        ? `<span class="chip tx"><span>${esc(tplLabel(t))}</span><button type="button" data-tpldel="${i}" aria-label="Xóa mẫu">×</button></span>`
        : `<button type="button" class="chip" data-tpluse="${i}" title="${esc(t.type + ' · ' + (t.cat ? t.cat + ' › ' + t.sub : t.acc))}">⚡ ${esc(tplLabel(t))}</button>`).join('')
        + `<button type="button" class="chip ${tplMg ? 'on' : ''}" data-tplmg>${tplMg ? 'Xong' : '✎ Mẫu'}</button>`
        : `<small class="mut">Mẫu giao dịch: mở form thêm giao dịch → “☆ Lưu thành mẫu” để tạo nút một chạm.</small>`;
}
function useTpl(i) {
    const t = TPL[i];
    if (!t)
        return;
    const p = { type: t.type, amount: t.amount, acc: S.acc.some(a => a.name === t.acc) ? t.acc : '', accTo: S.acc.some(a => a.name === t.accTo) ? t.accTo : '', cat: t.cat, sub: t.sub, note: t.note, date: todayS(), time: hm(new Date()) };
    if (!p.acc)
        p.acc = (S.acc[0] || {}).name || '';
    if (!t.amount || qMissing(p).length)
        qOpen(p);
    else
        qSave(p);
}
document.addEventListener('click', e => {
    const b = e.target.closest('[data-tpluse],[data-tpldel],[data-tplmg]');
    if (!b)
        return;
    if (b.dataset.tplmg !== undefined) {
        tplMg = !tplMg;
        renderTpl();
        return;
    }
    if (b.dataset.tpldel !== undefined) {
        const t = TPL.splice(+b.dataset.tpldel, 1)[0];
        tplSaveLS();
        renderTpl();
        toast('Đã xóa mẫu “' + (t && t.name) + '”');
        return;
    }
    useTpl(+b.dataset.tpluse);
});
$('#ov').addEventListener('click', e => {
    if (!E)
        return;
    const u = e.target.closest('[data-tpl]'), sv = e.target.closest('[data-tplsave]');
    if (u) {
        pull();
        const t = TPL[+u.dataset.tpl];
        if (!t)
            return;
        Object.assign(E, { type: t.type, amount: t.amount, acc: S.acc.some(a => a.name === t.acc) ? t.acc : E.acc, accTo: t.accTo || '', cat: t.cat, sub: t.sub, note: t.note });
        form();
        return;
    }
    if (sv) {
        pull();
        const ty = E.type, need = ty === 'Chi' || ty === 'Thu';
        if (!E.amount && !E.note && !E.sub)
            return toast('Nhập số tiền hoặc ghi chú trước khi lưu mẫu');
        if (need && (!E.cat || !E.sub))
            return toast('Chọn hạng mục và chi tiết trước khi lưu mẫu');
        const t = tplFrom(E), k = TPL.findIndex(x => x.name.toLowerCase() === t.name.toLowerCase());
        k >= 0 ? TPL[k] = t : TPL.push(t);
        tplSaveLS();
        renderTpl();
        toast('Đã lưu mẫu “' + t.name + '”');
        form();
    }
});
