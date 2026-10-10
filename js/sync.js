async function call(ops, rev) {
    if (!API)
        throw Error('Thiếu địa chỉ API: file config.js chưa được tải');
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 30000);
    let r;
    try {
        r = await fetch(API, { method: 'POST', signal: ac.signal, body: JSON.stringify({ ops: ops || [], rev: rev || '' }) });
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
        throw Error('Máy chủ chưa phản hồi đúng. Vui lòng kiểm tra lại cấu hình kết nối');
    }
    if (!j.ok) {
        if (/Hành động không hợp lệ/i.test(j.err || ''))
            throw Error('Máy chủ đang chạy phiên bản cũ. Vui lòng cập nhật lên phiên bản mới nhất.');
        throw Error(j.err || 'Lỗi máy chủ');
    }
    return j;
}
function stamp() { const t = 'Đã đồng bộ ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); $('#st').textContent = t; $('#st2').textContent = t; }
function apply(j) {
    stamp();
    if (j.same)
        return false;
    ['tx', 'acc', 'cat', 'lim', 'trash', 'issues'].forEach(k => S[k] = j[k] || []);
    S.rev = j.rev;
    S.ready = true;
    try {
        sessionStorage.cache = JSON.stringify({ tx: S.tx, acc: S.acc, cat: S.cat, lim: S.lim, trash: S.trash, issues: S.issues });
    }
    catch (e) { }
    return true;
}
const setLive = s => { const e = $('#live'); if (!e || e.dataset.s === s)
    return; e.dataset.s = s; e.className = 'live ' + s; e.lastChild.textContent = { ok: 'Live', err: 'Mất kết nối', wait: 'Đang kết nối' }[s]; };
const spin = on => { const e = $('#rf'); if (e)
    e.classList.toggle('spin', on); };
function ask(title, msg, o) {
    o = o || {};
    return new Promise(res => {
        const c = $('#cf');
        $('#cft').textContent = title;
        $('#cfm').textContent = msg || '';
        $('#cfi').textContent = o.icon || (o.danger ? '🗑️' : '❓');
        $('#cfo').textContent = o.ok || 'Đồng ý';
        $('#cfn').textContent = o.cancel || 'Hủy';
        c.classList.toggle('danger', !!o.danger);
        c.classList.add('open');
        $('#cfo').focus();
        const done = v => { c.classList.remove('open'); $('#cfo').onclick = $('#cfn').onclick = c.onclick = null; document.removeEventListener('keydown', kd, true); res(v); }, kd = e => { if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            done(false);
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            done(true);
        } };
        $('#cfo').onclick = () => done(true);
        $('#cfn').onclick = () => done(false);
        c.onclick = e => { if (e.target === c)
            done(false); };
        document.addEventListener('keydown', kd, true);
    });
}
let UNDO = null;
const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('#v') && /INPUT|SELECT|TEXTAREA/.test(a.tagName)); };
let inflight = false, fails = 0, skip = 0;
async function sync(manual) {
    if (inflight || (!manual && (S.busy || (document.hidden && !pushOn()))))
        return;
    if (!manual && fails > 3 && ++skip % 5)
        return;
    inflight = true;
    if (manual)
        spin(1);
    try {
        const first = !S.synced, j = await call([], manual ? '' : S.rev);
        S.synced = true;
        fails = 0;
        setLive('ok');
        S.err = '';
        const old = new Map(S.tx.map(t => [t.id, JSON.stringify(t)]));
        if (apply(j)) {
            if (!first && !manual) {
                const nw = [], up = [];
                S.tx.forEach(t => { const o = old.get(t.id); if (o === undefined)
                    nw.push(t);
                else if (o !== JSON.stringify(t))
                    up.push(t); });
                notifyChanges(nw, up);
            }
            if (typing())
                S.dirty = true;
            else
                render();
        }
        else if (manual)
            toast('Đã đồng bộ');
    }
    catch (e) {
        fails++;
        setLive('err');
        S.err = e.message;
        if (manual)
            toast(e.message);
        $('#st').textContent = 'Chưa đồng bộ được';
        if (!S.ready)
            render();
    }
    inflight = false;
    if (manual)
        spin(0);
}
let chain = Promise.resolve();
function commit(ops, o = {}) {
    if (o.local)
        o.local();
    render();
    S.busy++;
    spin(1);
    chain = chain.then(async () => {
        let res = { ok: true };
        try {
            apply(await call(ops, ''));
            setLive('ok');
            notify(o.ok || 'Đã lưu', { undo: o.undo, title: o.title, ico: o.ico, tag: o.tag, kind: o.kind });
        }
        catch (e) {
            res = { ok: false, err: e.message };
            notify('Chưa lưu được: ' + e.message, { title: 'Lỗi', err: 1 });
            try {
                apply(await call([], ''));
            }
            catch (_) { }
        }
        S.busy--;
        if (!S.busy)
            spin(0);
        render();
        return res;
    });
    return chain;
}
async function act(ops, msg) { const r = await commit(ops, { ok: msg }); if (r.ok)
    closeSheet();
else {
    const o = $('#ov.open #sh');
    if (o) {
        let m = $('#serr');
        if (!m) {
            m = document.createElement('p');
            m.id = 'serr';
            m.className = 'chi';
            m.style.cssText = 'margin-top:10px;font-size:13px';
            o.appendChild(m);
        }
        m.textContent = 'Lỗi: ' + r.err;
    }
} return r; }
function lock() { sessionStorage.clear(); localStorage.removeItem('sess'); $('#app').classList.add('hide'); $('#login').classList.remove('hide'); $('#pw').value = ''; closeSheet(); }
$('#lf').onsubmit = ev => { ev.preventDefault(); if ($('#pw').value === PASS) {
    touch();
    boot();
}
else {
    $('#lerr').textContent = 'Mật khẩu không đúng';
    $('#lf').classList.remove('shake');
    void $('#lf').offsetWidth;
    $('#lf').classList.add('shake');
    $('#pw').select();
} };
function boot() { $('#login').classList.add('hide'); $('#app').classList.remove('hide'); render(); sync(true); if (typeof pushInit === 'function')
    pushInit(); }
document.addEventListener('visibilitychange', () => { if (document.hidden)
    return; if (!alive())
    return lock(); sync(false); });
setInterval(() => { if (!alive()) {
    if (!$('#app').classList.contains('hide'))
        lock();
    return;
} sync(false); }, POLL_MS);
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty && !typing()) {
    S.dirty = false;
    render();
} }, 60));
addEventListener('offline', () => setLive('err'));
addEventListener('online', () => { fails = 0; sync(false); });
['click', 'keydown', 'touchstart'].forEach(t => document.addEventListener(t, () => { if (alive())
    touch(); }, { passive: true }));
