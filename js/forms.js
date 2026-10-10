function csv() {
    const r = [['ID', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Tài khoản đến', 'Hạng mục cha', 'Hạng mục con', 'Ghi chú'], ...S.tx.map(t => [t.id, t.date, t.type, t.amount, t.acc, t.accTo, t.cat, t.sub, t.note])];
    const b = new Blob(['\ufeff' + r.map(x => x.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'so-thu-chi.csv';
    a.click();
}
const openSheet = () => $('#ov').classList.add('open'), closeSheet = () => $('#ov').classList.remove('open');
function openMore() { $('#sh').innerHTML = `<h3>Thêm</h3><div class="menu">${['ba', 'bc', 'bl', 'rec', 'goal', 'acc', 'cat', 'tr'].map(k => `<button class="row" data-sheettab="${k}">${ic(k)}<span class="m"><b>${TABS.find(x => x[0] === k)[1]}</b></span>${k === 'tr' && S.trash.length ? `<small class="mut">${S.trash.length}</small>` : ''}</button>`).join('')}<button class="row" data-nt="settings">${ic('set')}<span class="m"><b>Cài đặt</b><small>Giao diện, thông báo, nhắc nhở, báo cáo mỗi sáng</small></span></button><button class="row" data-a2="csv">${ic('dl')}<span class="m"><b>Tải CSV toàn bộ</b></span></button></div>`; ED = null; E = null; openSheet(); }
function openIssues() { const L = S.issues; ED = null; E = null; $('#sh').innerHTML = `<h3>Dữ liệu cần kiểm tra (${L.length}) <span class="tip" tabindex="0" role="note" aria-label="Ý nghĩa màu" data-tip="Đỏ = lỗi, dòng đó chưa được tính vào số liệu. Vàng = cần lưu ý, vẫn được tính. Chỉnh lại các dòng được liệt kê, số liệu sẽ tự cập nhật.">ⓘ</span></h3>${L.slice(0, 80).map(i => `<div class="iss ${i.lv}"><b>${esc(SN[i.sheet] || i.sheet)} · dòng ${i.row}</b><span>${esc(i.msg)}</span></div>`).join('')}${L.length > 80 ? `<p class="mut" style="margin-top:8px">… và ${L.length - 80} mục nữa</p>` : ''}`; openSheet(); }
function catFields(ty, cat, sub, ip, is) {
    const L = S.cat.map((c, i) => ({ ...c, i })).filter(c => c.t === ty), pars = [...new Set(L.map(c => c.p))], o = c => `<option value="${c.i}" ${c.p === cat && c.c === sub ? 'selected' : ''}>${esc(c.c)}</option>`;
    return `<label>Hạng mục<select id="${ip}"><option value="">Chọn…</option>${pars.map(p => `<option ${p === cat ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label><label>Chi tiết<select id="${is}"><option value="">${cat ? 'Chọn…' : 'Chọn (tự điền hạng mục)…'}</option>${cat ? L.filter(c => c.p === cat).map(o).join('') : pars.map(p => `<optgroup label="${esc(p)}">${L.filter(c => c.p === p).map(o).join('')}</optgroup>`).join('')}</select></label>`;
}
const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
function openForm(t, ty) { E = t ? { ...t, note: noteTxt(t.note), imgs: splitImg(t.note).imgs, time: (t.at || '').slice(11, 16) } : { id: newId(), date: ymd(new Date()), time: hm(new Date()), type: ty || 'Chi', amount: 0, acc: (S.acc[0] || {}).name || '', accTo: '', cat: '', sub: '', note: '', imgs: [], isNew: true }; ED = null; form(); openSheet(); }
function form() {
    const ty = E.type, op = (a, v) => a.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    $('#sh').innerHTML = `<div class="seg">${TYPES.map(x => `<button data-ty="${x}" class="${x === ty ? 'on' : ''}">${x === 'Chuyển khoản' ? 'Chuyển' : x}</button>`).join('')}</div>${tplRow()}
<input class="amt money ${CLS[ty]}" ${ty === 'Điều chỉnh' ? 'data-neg="1"' : ''} id="fa" inputmode="${ty === 'Điều chỉnh' ? 'text' : 'numeric'}" placeholder="0" value="${E.amount ? num(E.amount) : ''}" aria-label="Số tiền"><div class="f">
<label>Ngày<input type="date" id="fd" value="${E.date}"></label><label>Giờ<input type="time" id="fh" value="${E.time || ''}"></label><label class="w">${ty === 'Chuyển khoản' ? 'Từ tài khoản' : 'Tài khoản'}<select id="fc">${op(S.acc.map(a => a.name), E.acc)}</select></label>
${ty === 'Chuyển khoản' ? `<label class="w">Đến tài khoản<select id="ft"><option value="">Chọn…</option>${op(S.acc.map(a => a.name).filter(n => n !== E.acc), E.accTo)}</select></label>` : ty === 'Điều chỉnh' ? '' : catFields(ty, E.cat, E.sub, 'fp', 'fs')}
<label class="w">Ghi chú<input id="fn" value="${esc(E.note)}" placeholder="Không bắt buộc"></label><div class="w" id="att"></div></div>
<button class="btn p w" data-save>${E.isNew ? 'Lưu giao dịch' : 'Lưu thay đổi'}</button><button class="btn w" data-tplsave style="margin-top:6px">☆ Lưu thành mẫu</button>${E.isNew ? '' : '<button class="btn w" data-dup>⧉ Nhân đôi giao dịch</button><button class="btn d w" data-del style="margin-top:2px">Xóa giao dịch</button>'}`;
    renderAtt();
}
function pull() { const g = i => ($(i) || {}).value; E.date = g('#fd') || E.date; if ($('#fh'))
    E.time = g('#fh'); E.acc = g('#fc') || E.acc; E.note = g('#fn') || ''; if ($('#ft'))
    E.accTo = g('#ft'); E.amount = pm($('#fa').value); }
function openLim() {
    ED = null;
    E = null;
    const pars = [...new Set(S.cat.filter(c => c.t === 'Chi').map(c => c.p))], orph = [...new Set(S.lim.filter(l => l.cat && !pars.includes(l.cat)).map(l => l.cat))], all = ['', ...pars, ...orph];
    const list = per => all.map(p => `<label class="${p === '' ? 'w' : ''}">${p === '' ? '∑ Tổng chi (tất cả hạng mục)' : emo(p) + ' ' + esc(p) + (orph.includes(p) ? ' ⚠️ hạng mục này không còn tồn tại' : '')}<input class="lm money" data-per="${per}" data-cat="${esc(p)}" inputmode="numeric" placeholder="Để trống = không đặt" title="Để trống hoặc nhập 0 để bỏ hạn mức" value="${limOf(per, p) ? num(limOf(per, p)) : ''}"></label>`).join('');
    $('#sh').innerHTML = `<h3>Thiết lập hạn mức chi <span class="tip" tabindex="0" role="note" aria-label="Hướng dẫn" data-tip="Để trống hoặc nhập 0 để bỏ hạn mức. Chỉ tính các giao dịch loại Chi.">ⓘ</span></h3><div class="tabs" style="margin-bottom:12px"><button type="button" class="on" data-lt="gd">Theo ngày</button><button type="button" data-lt="gc">Theo tháng</button></div>
<div class="f" id="gd">${list('Ngày')}</div><div class="f hide" id="gc">${list('Tháng')}</div><button class="btn p w" data-lsave>Lưu hạn mức</button>`;
    openSheet();
}
function ed(kind, o, idx) {
    const L = [...new Set(S.cat.map(c => c.p))], isN = idx == null;
    ED = { kind, o, idx };
    E = null;
    const F = { tk: [['name', 'Tên tài khoản', 'text', o.name], ['type', 'Loại', 'select', o.type || ACC_TYPES[0], ACC_TYPES], ['open', 'Số dư ban đầu', 'money', o.open ? num(o.open) : '']],
        dm: [['t', 'Loại', 'select', o.t || 'Chi', ['Chi', 'Thu']], ['p', 'Hạng mục cha', 'text', o.p, L], ['c', 'Chi tiết', 'text', o.c]] }[kind];
    $('#sh').innerHTML = `<h3>${isN ? 'Thêm' : 'Sửa'} ${{ tk: 'tài khoản', dm: 'hạng mục' }[kind]}</h3><div class="f">${F.map(([id, lb, ty, v, ls]) => `<label class="${id === 'name' || id === 'c' ? 'w' : ''}">${lb}${ty === 'select' ? `<select id="e_${id}">${ls.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ty === 'money' ? `<input id="e_${id}" class="money" data-neg="1" inputmode="text" value="${esc(v)}" placeholder="0">` : `<input id="e_${id}" type="text" value="${esc(v ?? '')}" ${ls ? `list="dl_${id}"` : ''}>${ls ? `<datalist id="dl_${id}">${ls.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`}</label>`).join('')}${kind === 'tk' ? `<div class="w"><span class="l" style="font-size:12px;color:var(--mut)">Biểu tượng (chỉ lưu trên máy này)</span><div class="cg" style="margin-top:6px"><button type="button" class="chip ${AI[o.name] ? '' : 'on'}" data-ico="">Tự động</button>${EM.map(e => `<button type="button" class="chip ${AI[o.name] === e ? 'on' : ''}" data-ico="${e}">${e}</button>`).join('')}</div></div>` : ''}</div><button class="btn p w" data-esave>Lưu</button>${kind === 'tk' && !isN ? '<button class="btn w" data-viewacc>Xem giao dịch của tài khoản này</button>' : ''}${isN ? '' : '<button class="btn d w" data-edel style="margin-top:2px">Chuyển vào Thùng rác</button>'}`;
    openSheet();
}
$('#ov').addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('money'))
        fm(t);
    if (E && ['fc', 'fp', 'fs'].includes(t.id)) {
        const id = t.id, val = t.value;
        pull();
        if (id === 'fp') {
            E.cat = val;
            if (E.sub && !S.cat.some(c => c.t === E.type && c.p === E.cat && c.c === E.sub))
                E.sub = '';
        }
        if (id === 'fs') {
            if (val !== '') {
                const c = S.cat[+val];
                E.cat = c.p;
                E.sub = c.c;
            }
            else
                E.sub = '';
        }
        form();
        $('#' + id).focus();
    }
});
$('#ov').addEventListener('click', async (e) => {
    const T = e.target;
    if (T.id === 'ov')
        return closeSheet();
    const q = s => T.closest(s);
    if (q('[data-ico]')) {
        const b = q('[data-ico]');
        $$('[data-ico]').forEach(x => x.classList.toggle('on', x === b));
        if (ED)
            ED.ico = b.dataset.ico;
        return;
    }
    if (q('[data-viewacc]') && ED) {
        Object.assign(S, { xa: ED.o.name, rg: 'a', fo: true, f: 'all', q: '' });
        return go('tx');
    }
    if (q('[data-sheettab]'))
        return go(q('[data-sheettab]').dataset.sheettab);
    if (q('[data-a2]')) {
        closeSheet();
        return csv();
    }
    if (q('[data-lt]')) {
        const b = q('[data-lt]');
        $$('[data-lt]').forEach(x => x.classList.toggle('on', x === b));
        $('#gd').classList.toggle('hide', b.dataset.lt !== 'gd');
        $('#gc').classList.toggle('hide', b.dataset.lt !== 'gc');
        return;
    }
    if (q('[data-lsave]')) {
        const ops = [];
        $$('.lm').forEach(i => { const v = pm(i.value), per = i.dataset.per, cat = i.dataset.cat; if (v < 0)
            return; if (v !== limOf(per, cat))
            ops.push({ op: 'lim.set', per, cat, v }); });
        if (!ops.length)
            return closeSheet();
        return act(ops, 'Đã lưu hạn mức');
    }
    if (ED) {
        const v = id => ($('#e_' + id) || {}).value, { kind, o, idx } = ED;
        if (q('[data-esave]')) {
            if (kind === 'tk') {
                const nm = v('name').trim(), old = o.name;
                if (!nm)
                    return toast('Nhập tên tài khoản');
                const r = act([{ op: 'acc.save', acc: { name: nm, type: v('type'), open: pm(v('open')) }, old: old || null }], 'Đã lưu');
                r.then(x => { if (!x.ok)
                    return; if (old && nm !== old && typeof goalRename === 'function') goalRename(old, nm); if (ED && ED.ico !== undefined) {
                    if (ED.ico)
                        AI[nm] = ED.ico;
                    else
                        delete AI[nm];
                }
                else if (old && old !== nm && AI[old]) {
                    AI[nm] = AI[old];
                } if (old && old !== nm)
                    delete AI[old]; try {
                    localStorage.aicon = JSON.stringify(AI);
                }
                catch (er) { } render(); });
                return;
            }
            if (kind === 'dm') {
                if (!v('p').trim() || !v('c').trim())
                    return toast('Nhập hạng mục cha và chi tiết');
                return act([{ op: 'cat.save', cat: { t: v('t'), p: v('p').trim(), c: v('c').trim() }, old: idx == null ? null : { t: o.t, p: o.p, c: o.c } }], 'Đã lưu');
            }
        }
        if (q('[data-edel]')) {
            if (!await ask('Chuyển vào Thùng rác?', 'Bạn có thể khôi phục lại trong Thùng rác.', { danger: 1, ok: 'Xóa' }))
                return;
            if (kind === 'tk')
                return act([{ op: 'acc.del', name: o.name }], 'Đã chuyển vào Thùng rác');
            if (kind === 'dm')
                return act([{ op: 'cat.del', cat: { t: o.t, p: o.p, c: o.c } }], 'Đã chuyển vào Thùng rác');
        }
        return;
    }
    if (!E)
        return;
    if (q('[data-ty]')) {
        pull();
        E.type = q('[data-ty]').dataset.ty;
        E.cat = E.sub = '';
        form();
        return;
    }
    if (q('[data-dup]')) {
        pull();
        E = { ...E, id: newId(), date: ymd(new Date()), isNew: true };
        form();
        return;
    }
    if (q('[data-del]')) {
        if (!await ask('Chuyển giao dịch vào Thùng rác?', 'Bạn có thể khôi phục lại trong Thùng rác.', { danger: 1, ok: 'Xóa' }))
            return;
        const id = E.id;
        closeSheet();
        txDel(id);
        return;
    }
    if (q('[data-save]')) {
        pull();
        const ty = E.type;
        let er = '';
        if (!E.amount)
            er = 'Nhập số tiền';
        else if (E.amount < 0 && ty !== 'Điều chỉnh')
            er = 'Số tiền phải lớn hơn 0';
        else if (!E.acc)
            er = 'Chọn tài khoản';
        else if (ty === 'Chuyển khoản' && !E.accTo)
            er = 'Chọn tài khoản nhận';
        else if (ty === 'Chuyển khoản' && E.accTo === E.acc)
            er = 'Tài khoản nguồn và nhận phải khác nhau';
        else if (ty !== 'Chuyển khoản' && ty !== 'Điều chỉnh' && (!E.cat || !E.sub))
            er = 'Chọn hạng mục và chi tiết';
        if (er)
            return toast(er);
        if (E.up)
            return toast('Đang tải ảnh lên, vui lòng chờ…');
        const x = ty === 'Chuyển khoản' || ty === 'Điều chỉnh', row = { id: E.id, date: E.date, type: ty, amount: E.amount, acc: E.acc, accTo: ty === 'Chuyển khoản' ? E.accTo : '', cat: x ? '' : E.cat, sub: x ? '' : E.sub, note: joinImg(E.note, E.imgs) };
        if (E.time) {
            row.at = E.date + 'T' + E.time + ':00';
        }
        else if (E.at) {
            row.at = E.at;
        }
        closeSheet();
        txSave(row);
    }
});
