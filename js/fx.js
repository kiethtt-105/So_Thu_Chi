/* Hiệu ứng vào trang + đếm số + thu gọn thanh bên */
const reduceMotion = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
function sbToggle() {
    const on = document.documentElement.classList.toggle('sbc');
    try { localStorage.sbc = on ? '1' : '0'; } catch (e) { }
    const b = $('#sbt');
    if (b) {
        b.setAttribute('aria-label', on ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên');
        b.title = (on ? 'Mở rộng' : 'Thu gọn') + ' thanh bên ( [ )';
    }
}
let _fxKey = '';
function countUp(el) {
    const t = el.textContent.trim(), m = t.match(/^([−-]?)([\d.]+)(\s*₫|%)?$/);
    if (!m) return;
    const to = +m[2].replace(/\./g, '');
    if (!to || to < 10) return;
    const t0 = performance.now(), D = 650;
    const step = now => {
        const p = Math.min(1, (now - t0) / D), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
        el.textContent = p >= 1 ? t : m[1] + (m[3] === '%' ? v : num(v)) + (m[3] || '');
        if (p < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
function fxEnter() {
    if (!S.ready) return;
    const key = S.tab + '|' + S.m;
    if (key === _fxKey) return;
    _fxKey = key;
    if (reduceMotion()) return;
    const v = $('#v');
    let i = 0;
    v.querySelectorAll('.ph,.kpis>.card,.grid>.card,.col>.card,.mdd>.card,.tb,.sum,.warn,.insight,.card.flush,.chips').forEach(e => { e.style.setProperty('--d', Math.min(i++, 9) * 45 + 'ms'); });
    v.classList.remove('pgin');
    void v.offsetWidth;
    v.classList.add('pgin');
    v.querySelectorAll('.kpi b').forEach(countUp);
    clearTimeout(fxEnter._t);
    fxEnter._t = setTimeout(() => v.classList.remove('pgin'), 1400);
}

/* ===== Âm thanh (WebAudio, không cần file) + rung + ripple + spotlight ===== */
const fxOn = () => !document.documentElement.classList.contains('fxoff');
let _ac = null, _lastTap = 0;
function audio() {
    if (!_ac) { try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (_ac.state === 'suspended') _ac.resume().catch(() => { });
    return _ac;
}
function tone(f, d, o = {}) {
    const ac = audio();
    if (!ac) return;
    const t = ac.currentTime + (o.at || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v || 0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + d + 0.02);
}
const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } };
const sfx = {
    tap: () => { tone(520, 0.05, { to: 380, v: 0.045 }); buzz(8); },
    nav: () => { tone(660, 0.05, { to: 500, v: 0.045 }); buzz(8); },
    ok: () => { tone(660, 0.09, { v: 0.05 }); tone(990, 0.14, { at: 0.08, v: 0.05 }); buzz(18); },
    err: () => { tone(220, 0.14, { type: 'triangle', v: 0.07 }); tone(165, 0.18, { at: 0.12, type: 'triangle', v: 0.07 }); buzz([30, 40, 30]); }
};
function fxToggle() {
    const off = document.documentElement.classList.toggle('fxoff');
    try { localStorage.fx = off ? '0' : '1'; } catch (e) { }
    if (!off) sfx.ok();
    toast('Âm thanh và rung: ' + (off ? 'Tắt' : 'Bật'));
}
document.addEventListener('pointerdown', e => {
    const b = e.target.closest('button,[data-tab],[data-a],a[href],.chip,.btn');
    if (!b || b.disabled) return;
    const n = performance.now();
    if (b.matches('.btn,.pri,.chip,.qs,#bn button') && !b.querySelector('.rp')) {
        const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, sp = document.createElement('span');
        if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
        b.style.overflow = 'hidden';
        sp.className = 'rp';
        sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
        b.appendChild(sp);
        setTimeout(() => sp.remove(), 600);
    }
    if (!fxOn() || n - _lastTap < 40) return;
    _lastTap = n;
    (b.closest('[data-tab],#tb,#bn') ? sfx.nav : sfx.tap)();
}, { passive: true });
let _mv = 0;
document.addEventListener('pointermove', e => {
    if (_mv || e.pointerType === 'touch') return;
    const c = e.target.closest && e.target.closest('.kpis>.card,.dcard');
    if (!c) return;
    _mv = requestAnimationFrame(() => {
        _mv = 0;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', e.clientX - r.left + 'px');
        c.style.setProperty('--my', e.clientY - r.top + 'px');
    });
}, { passive: true });
if (typeof notify === 'function') {
    const _notify = notify;
    notify = function (body, o) {
        o = o || {};
        if (fxOn() && !o.bg) { o.err ? sfx.err() : sfx.ok(); }
        return _notify.apply(this, arguments);
    };
}
