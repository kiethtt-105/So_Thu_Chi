const go = t => { S.tab = t; location.hash = t; scrollTo(0, 0); closeSheet(); render(); };
document.addEventListener('click', e => {
    const t = e.target.closest('[data-tab],[data-m],[data-f],[data-edit],[data-a],[data-bdo],[data-ed],[data-rs]');
    if (!t || t.closest('#ov'))
        return;
    const d = t.dataset;
    if (d.tab)
        return go(d.tab);
    if (d.m) {
        S.m = shift(S.m, +d.m);
        return render();
    }
    if (d.f) {
        S.f = d.f;
        return render();
    }
    if (d.edit) {
        const x = S.tx.find(x => x.id === d.edit);
        return x && openForm(x);
    }
    if (d.bdo)
        return doBal(d.bdo);
    if (d.rs != null && S.tab === 'tr') {
        const x = S.trash[+d.rs];
        return x && act([{ op: 'restore', at: x.at, kind: x.k }], 'Đã khôi phục');
    }
    if (d.ed) {
        const [k, i] = d.ed.split(':'), src = { tk: S.acc, dm: S.cat }[k];
        return ed(k, i === 'new' ? {} : { ...src[+i] }, i === 'new' ? null : +i);
    }
    switch (d.a) {
        case 'new': return openForm();
        case 'lock': return lock();
        case 'retry':
            S.err = '';
            render();
            return sync(true);
        case 'dark': return toggleTheme();
        case 'fo':
            S.fo = !S.fo;
            return render();
        case 'rs':
            Object.assign(S, { xa: '', xc: '', mn: '', mx: '', d1: '', d2: '', so: 'dn', rg: 'm', f: 'all', q: '' });
            return render();
        case 'csv': return csv();
        case 'lim': return openLim();
        case 'more': return openMore();
        case 'issues': return openIssues();
    }
});
document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') {
        S.q = t.value;
        const p = t.selectionStart;
        render();
        const q = $('#q');
        q.focus();
        q.setSelectionRange(p, p);
        return;
    }
    if (t.classList && t.classList.contains('money'))
        fm(t);
    if (t.classList && t.classList.contains('ba')) {
        const a = S.acc[+t.dataset.i];
        if (!a)
            return;
        if (t.value.replace(/[^\d]/g, ''))
            S.act[a.name] = pm(t.value);
        else
            delete S.act[a.name];
        reconUpdate();
    }
});
document.addEventListener('change', e => { const k = { x_rg: 'rg', x_acc: 'xa', x_cat: 'xc', x_mn: 'mn', x_mx: 'mx', x_so: 'so', x_d1: 'd1', x_d2: 'd2' }[e.target.id]; if (k) {
    S[k] = e.target.value;
    render();
} });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        return closeSheet();
    if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '') || !$('#login').classList.contains('hide'))
        return;
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openForm();
    }
    if (e.key === '/') {
        e.preventDefault();
        go('tx');
        setTimeout(() => { const q = $('#q'); q && q.focus(); }, 0);
    }
});
