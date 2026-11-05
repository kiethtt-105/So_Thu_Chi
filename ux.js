/* ux.js — lớp trải nghiệm, nạp SAU app.js. Chỉ dùng các hàm/biến toàn cục có sẵn của app
   (S, sums, stx, shift, isCurM, txDel, openForm, amtVal, num, toast, sync, fxOn); thiếu cái nào thì tính năng đó tự bỏ qua. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const calm = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  const coarse = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
  const fxOK = () => { try { return typeof fxOn === 'function' ? fxOn() : true; } catch (e) { return true; } };
  const hasS = () => typeof S !== 'undefined' && S && S.tx;

  /* ───── Rung phản hồi ─────
     Android/Chrome dùng navigator.vibrate. iPhone không có API này, nên dùng mẹo công tắc "switch" của Safari 17.4+
     (nhẹ, không đảm bảo, chỉ chạy được khi đang trong thao tác chạm của người dùng). Gắn vào navigator.vibrate để
     toàn bộ buzz() có sẵn của app cũng rung được trên iPhone. */
  let _sw = null;
  const iosTick = () => {
    try {
      if (!_sw) {
        _sw = document.createElement('label');
        _sw.setAttribute('aria-hidden', 'true');
        _sw.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        const i = document.createElement('input');
        i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
        _sw.appendChild(i); document.body.appendChild(_sw);
      }
      _sw.click();
    } catch (e) { }
  };
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && !navigator.vibrate) { try { navigator.vibrate = () => { iosTick(); return true; }; } catch (e) { } }
  const PAT = { tick: 6, select: 10, arm: 14, ok: [12, 40, 18], del: [18, 30, 24] };
  const hap = k => { if (!fxOK()) return; try { navigator.vibrate && navigator.vibrate(PAT[k] || 6); } catch (e) { } };

  /* ───── Hiệu ứng nảy ───── */
  const pop = (el, from = .88) => {
    if (!el || !el.animate || calm()) return;
    el.animate([{ transform: 'scale(' + from + ')' }, { transform: 'scale(1.07)', offset: .55 }, { transform: 'scale(1)' }], { duration: 340, easing: 'ease-out' });
  };
  const bump = el => {
    if (!el || !el.animate || calm()) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)', offset: .4 }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  };

  /* ───── 1. KPI: so với kỳ trước + sparkline ───── */
  const KP = { 'Thu': 'thu', 'Chi': 'chi', 'Còn lại': 'net' };
  function dlt(x, y, isChi) {
    if (x === y) return x ? '<span class="dl mut">±0%</span>' : '';
    if (!y) return x ? '<span class="dl mut">mới</span>' : '';
    const p = Math.round((x - y) / Math.abs(y) * 100);
    if (!p) return '<span class="dl mut">±0%</span>';
    const upv = p > 0, bad = isChi ? upv : !upv;
    return '<span class="dl ' + (bad ? 'chi' : 'thu') + '">' + (upv ? '▲' : '▼') + ' ' + Math.abs(p) + '%</span>';
  }
  function upTo(m, day) {
    let thu = 0, chi = 0;
    for (const t of stx()) {
      if (t.date.slice(0, 7) !== m || +t.date.slice(8, 10) > day) continue;
      if (t.type === 'Thu') thu += t.amount; else if (t.type === 'Chi') chi += t.amount;
    }
    return { thu, chi };
  }
  function spark(vals, partial) {
    const w = 56, h = 20, p = 2, n = vals.length, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn;
    if (n < 2 || (!mn && !mx)) return '';
    const pt = vals.map((v, i) => [p + i * (w - 2 * p) / (n - 1), r ? h - p - (v - mn) / r * (h - 2 * p) : h / 2]);
    const f = a => a[0].toFixed(1) + ' ' + a[1].toFixed(1);
    const solid = partial ? pt.slice(0, -1) : pt;
    const d = solid.map((a, i) => (i ? 'L' : 'M') + f(a)).join('');
    const last = pt[n - 1], area = 'M' + f(pt[0]) + pt.slice(1).map(a => 'L' + f(a)).join('') + 'L' + last[0].toFixed(1) + ' ' + h + 'L' + pt[0][0].toFixed(1) + ' ' + h + 'Z';
    return '<svg class="spk" viewBox="0 0 56 20" aria-hidden="true"><path class="ar" d="' + area + '"/>' +
      '<path class="ln" pathLength="1" d="' + d + '"/>' +
      (partial ? '<path class="lp" d="M' + f(pt[n - 2]) + 'L' + f(last) + '"/>' : '') +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.2"/></svg>';
  }
  function kpis() {
    const box = $('#v .kpis:not(.sm)');
    if (!box || !hasS() || !S.ready || typeof sums !== 'function' || typeof stx !== 'function' || typeof shift !== 'function') return;
    const cards = [...box.children].filter(c => c.classList.contains('kpi') && !c.classList.contains('h') && !c.dataset.ux);
    if (!cards.length) return;
    const m = S.m, cur = typeof isCurM === 'function' && isCurM(m), day = cur ? new Date().getDate() : 99, pm = shift(m, -1);
    const A = upTo(m, day), B = upTo(pm, day);
    const net = o => o.thu - o.chi, ser = [];
    for (let i = 5; i >= 1; i--) ser.push(sums(shift(m, -i)));
    ser.push(A);
    const vs = cur ? 'so với cùng kỳ tháng trước' : 'so với tháng trước';
    cards.forEach(c => {
      const sm = c.querySelector('small'), k = sm && KP[sm.textContent.trim()];
      c.dataset.ux = '1';
      if (!k) return;
      c.dataset.kp = k;
      const x = k === 'net' ? net(A) : A[k], y = k === 'net' ? net(B) : B[k];
      const vals = ser.map(o => k === 'net' ? net(o) : o[k]);
      c.insertAdjacentHTML('beforeend', '<div class="kx">' + dlt(x, y, k === 'chi') + '<span class="vs">' + vs + '</span></div>' + spark(vals, cur));
    });
  }

  /* ───── 2. Vuốt dòng giao dịch ───── */
  const IC = {
    ed: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/></svg>',
    del: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'
  };
  const W = 88;
  let sw = null, openW = null, swallow = 0;
  const commitAt = w => Math.min(Math.max(150, w.offsetWidth * .42), 230);
  function setX(w, x) {
    const r = w.querySelector('.row'), ed = w.querySelector('.ed'), dl = w.querySelector('.del');
    r.style.transform = x ? 'translateX(' + x + 'px)' : '';
    ed.style.width = x > 0 ? x + 'px' : '0';
    dl.style.width = x < 0 ? -x + 'px' : '0';
  }
  function closeW(w, quick) {
    if (!w) return;
    if (openW === w) openW = null;
    w.classList.remove('o', 'arm');
    if (quick) { w.classList.remove('snap', 'close'); setX(w, 0); return; }
    w.classList.add('snap', 'close');
    setX(w, 0);
    clearTimeout(w._t);
    w._t = setTimeout(() => { w.classList.remove('snap', 'close'); }, 320);
  }
  function openWrap(w, dir) {
    if (openW && openW !== w) closeW(openW);
    openW = w;
    w.classList.add('snap', 'o');
    w.classList.remove('close', 'arm');
    w.dataset.d = dir;
    setX(w, dir * W);
  }
  const rowId = w => (w.querySelector('.row') || {}).dataset.edit;
  function doEdit(w) {
    const id = rowId(w), t = hasS() && S.tx.find(x => x.id === id);
    hap('tick');
    if (t && typeof openForm === 'function') openForm(t);
  }
  function doDelete(w) {
    const id = rowId(w);
    if (!id || typeof txDel !== 'function') { closeW(w); return; }
    hap('del');
    if (openW === w) openW = null;
    w.style.height = w.offsetHeight + 'px';
    void w.offsetHeight;
    w.classList.add('gone');
    setTimeout(() => {
      Promise.resolve(txDel(id)).then(r => {
        if (r && r.ok === false && w.isConnected) { w.classList.remove('gone', 'arm'); w.style.height = ''; closeW(w, true); }
      }).catch(() => { if (w.isConnected) { w.classList.remove('gone', 'arm'); w.style.height = ''; closeW(w, true); } });
    }, 190);
  }
  function wrapRow(r) {
    r.dataset.sw = '1';
    const w = document.createElement('div');
    w.className = 'swr';
    w.innerHTML = '<div class="swa" aria-hidden="true">' +
      '<button type="button" class="swb ed" tabindex="-1">' + IC.ed + '<span class="t">Sửa</span><span class="t2">Thả để sửa</span></button>' +
      '<button type="button" class="swb del" tabindex="-1">' + IC.del + '<span class="t">Xóa</span><span class="t2">Thả để xóa</span></button></div>';
    r.replaceWith(w);
    w.appendChild(r);
  }
  function rows() {
    if (!coarse) return;
    $$('#v button.row[data-edit]:not([data-sw])').forEach(wrapRow);
  }
  if (coarse) {
    document.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const row = e.target.closest && e.target.closest('.swr>.row');
      if (openW && (!row || row.parentElement !== openW) && !(e.target.closest && e.target.closest('.swb'))) closeW(openW);
      if (!row || !e.isPrimary) return;
      const w = row.parentElement;
      sw = { row, w, pid: e.pointerId, x0: e.clientX, y0: e.clientY, lock: 0, x: 0, arm: false, base: w.classList.contains('o') ? (+w.dataset.d || 0) * W : 0 };
    }, { passive: true });
    document.addEventListener('pointermove', e => {
      if (!sw || e.pointerId !== sw.pid) return;
      if (!sw.row.isConnected) { sw = null; return; }
      const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
      if (!sw.lock) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }   // cuộn dọc, nhường cho trình duyệt
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          sw.lock = 1;
          try { sw.row.setPointerCapture(sw.pid); } catch (x) { }
          sw.w.classList.remove('close'); sw.w.classList.remove('snap'); sw.w.classList.add('drag');
          clearTimeout(sw.w._t);
        } else return;
      }
      const c = commitAt(sw.w), lim = sw.w.offsetWidth * .9;
      let x = sw.base + dx;
      const a = Math.abs(x);
      if (a > c) x = Math.sign(x) * (c + (a - c) * .35);
      x = Math.max(-lim, Math.min(lim, x));
      sw.x = x;
      setX(sw.w, x);
      const arm = Math.abs(x) >= c;
      if (arm !== sw.arm) { sw.arm = arm; sw.w.classList.toggle('arm', arm); hap('arm'); }
    }, { passive: true });
    const end = cancel => e => {
      if (!sw || e.pointerId !== sw.pid) return;
      const s = sw; sw = null;
      if (!s.lock) return;
      s.w.classList.remove('drag');
      try { s.row.releasePointerCapture(s.pid); } catch (x) { }
      swallow = Date.now() + 400;
      s.w.classList.add('snap');
      const x = s.x, c = commitAt(s.w);
      if (cancel) return closeW(s.w);
      if (x <= -c) return doDelete(s.w);
      if (x >= c) { closeW(s.w); return doEdit(s.w); }
      if (x <= -W * .5) return openWrap(s.w, -1);
      if (x >= W * .5) return openWrap(s.w, 1);
      closeW(s.w);
    };
    document.addEventListener('pointerup', end(false), { passive: true });
    document.addEventListener('pointercancel', end(true), { passive: true });
    addEventListener('scroll', () => { if (openW) closeW(openW); }, { passive: true });
  }
  document.addEventListener('click', e => {
    const t = e.target;
    if (!t || !t.closest) return;
    const b = t.closest('.swb');
    if (b) {
      e.preventDefault(); e.stopPropagation();
      const w = b.closest('.swr');
      if (b.classList.contains('del')) doDelete(w); else { closeW(w); doEdit(w); }
      return;
    }
    const r = t.closest('.swr>.row');
    if (!r) return;
    if (Date.now() < swallow) { e.preventDefault(); e.stopPropagation(); return; }
    if (r.parentElement.classList.contains('o')) { e.preventDefault(); e.stopPropagation(); closeW(r.parentElement); }
  }, true);

  /* ───── 3. Cộng nhanh số tiền ───── */
  const AMTS = [[1e4, '+10k'], [2e4, '+20k'], [5e4, '+50k'], [1e5, '+100k'], [2e5, '+200k'], [5e5, '+500k']];
  function quick() {
    const a = $('#sh #fa'), qk = a && $('#sh .qk');
    if (!qk || $('#sh .qamt')) return;
    const ty = ['chi', 'thu', 'chuyen', 'dc'].find(c => a.classList.contains(c)) || '';
    qk.insertAdjacentHTML('afterend', '<div class="qamt" data-ty="' + ty + '" role="group" aria-label="Cộng nhanh số tiền">' +
      AMTS.map(x => '<button type="button" class="chip" data-qamt="' + x[0] + '">' + x[1] + '</button>').join('') +
      '<button type="button" class="chip" data-qamt="0" aria-label="Xóa số tiền">✕</button></div>');
  }
  document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.qamt')) e.preventDefault(); });
  document.addEventListener('click', e => {
    const t = e.target;
    if (!t || !t.closest) return;
    const q = t.closest('[data-qamt]');
    if (q) {
      const a = $('#fa');
      if (!a) return;
      const n = +q.dataset.qamt;
      let next = 0;
      if (n) {
        const raw = a.value.trim();
        const cur = !raw ? 0 : (typeof amtVal === 'function' ? amtVal(raw) : parseInt(raw.replace(/\D/g, ''), 10));
        if (cur == null || isNaN(cur)) { if (typeof toast === 'function') toast('Phép tính ở ô Số tiền chưa hợp lệ'); return; }
        next = cur + n;
      }
      a.value = next ? (typeof num === 'function' ? num(next) : String(next)) : '';
      a.dispatchEvent(new Event('input', { bubbles: true }));
      pop(q, .84); bump(a.closest('.amtw') || a);
      return;
    }
    const b = t.closest('.btn,.pri,.ib,.fab,.qk .chip,.qd3 .chip');
    if (b) { pop(b, .9); if (b.matches('.qk .chip')) bump((b.closest('.tf-l') || document).querySelector('.amtw')); }
  });
  document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#ov select')) hap('select'); });

  /* ───── 4. Trạng thái trống ───── */
  const SV = '<svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="40" r="35" fill="currentColor" opacity=".10"/>';
  const ILL = {
    receipt: SV + '<path d="M26 17h28a3 3 0 0 1 3 3v43l-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5-5 3.5V20a3 3 0 0 1 3-3z" fill="var(--card)" stroke="currentColor" stroke-width="2.4"/><path d="M32 29h16M32 37h16M32 45h9" stroke="currentColor" stroke-width="2.4"/><circle cx="58" cy="21" r="8" fill="var(--thu)"/><path d="M58 17.5v7M54.5 21h7" stroke="#fff" stroke-width="2.2"/></svg>',
    wallet: SV + '<path d="M20 30l30-10a3 3 0 0 1 4 3v7" stroke="currentColor" stroke-width="2.4"/><rect x="17" y="30" width="46" height="31" rx="7" fill="var(--card)" stroke="currentColor" stroke-width="2.4"/><rect x="45" y="40" width="18" height="11" rx="5.5" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="2.2"/><circle cx="51" cy="45.5" r="1.9" fill="currentColor"/></svg>',
    gauge: SV + '<path d="M17 52a23 23 0 0 1 46 0" stroke="currentColor" stroke-width="7" opacity=".25"/><path d="M17 52a23 23 0 0 1 29-22" stroke="currentColor" stroke-width="7"/><path d="M40 52l10-14" stroke="var(--ink)" stroke-width="3"/><circle cx="40" cy="52" r="4" fill="var(--ink)"/></svg>',
    flag: SV + '<circle cx="38" cy="43" r="21" stroke="currentColor" stroke-width="2.4" fill="var(--card)"/><circle cx="38" cy="43" r="13" stroke="currentColor" stroke-width="2.4" opacity=".7"/><circle cx="38" cy="43" r="5" fill="currentColor"/><path d="M38 43l19-19M52 22l7 1-1 7" stroke="var(--chi)" stroke-width="2.6"/></svg>',
    search: SV + '<circle cx="35" cy="35" r="16" fill="var(--card)" stroke="currentColor" stroke-width="3"/><path d="M47 47l15 15" stroke="currentColor" stroke-width="4.5"/><path d="M29 35h12" stroke="currentColor" stroke-width="2.4"/></svg>',
    box: SV + '<path d="M16 33l24-12 24 12v24L40 69 16 57z" fill="var(--card)" stroke="currentColor" stroke-width="2.4"/><path d="M16 33l24 12 24-12M40 45v24" stroke="currentColor" stroke-width="2.4"/></svg>'
  };
  const pick = t => /không tìm thấy|kết quả/i.test(t) ? 'search' : /hạn mức/i.test(t) ? 'gauge' : /mục tiêu/i.test(t) ? 'flag' : /khoản chi|khoản thu/i.test(t) ? 'wallet' : /giao dịch/i.test(t) ? 'receipt' : 'box';
  function empties() {
    $$('#v .empty:not([data-ux]),#sh .empty:not([data-ux])').forEach(e => {
      e.dataset.ux = '1';
      const b = e.querySelector('b'), t = (b ? b.textContent : e.textContent).trim();
      e.insertAdjacentHTML('afterbegin', '<div class="ill" aria-hidden="true">' + ILL[pick(t)] + '</div>');
      if (/^chưa có (giao dịch|khoản chi)/i.test(t) && !e.querySelector('button,a')) {
        if (b && e.textContent.trim() === t) e.insertAdjacentHTML('beforeend', '<span class="hint">Chạm nút + để ghi giao dịch đầu tiên.</span>');
        e.insertAdjacentHTML('beforeend', '<button type="button" class="btn p" data-a="new">＋ Thêm giao dịch</button>');
      }
    });
  }

  /* ───── 5. Kéo xuống để làm mới ───── */
  function ptr() {
    if (!coarse) return;
    const el = document.createElement('div');
    el.id = 'ptr'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
    document.body.appendChild(el);
    let st = 0, x0 = 0, y0 = 0, pull = 0, armed = false, busy = false;
    const reset = () => { el.classList.add('go'); el.classList.remove('arm', 'spin'); el.style.transform = ''; el.style.opacity = ''; setTimeout(() => el.classList.remove('go'), 400); };
    addEventListener('touchstart', e => {
      st = 0;
      if (busy || e.touches.length !== 1 || scrollY > 0) return;
      const app = $('#app');
      if (!app || app.classList.contains('hide') || $('#ov.open') || $('#cf.open') || (e.target.closest && e.target.closest('.swr.drag'))) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; st = 1; pull = 0; armed = false;
    }, { passive: true });
    addEventListener('touchmove', e => {
      if (!st) return;
      const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (st === 1) {
        if (dy < -6 || Math.abs(dx) > Math.abs(dy)) { st = 0; return; }
        if (dy < 12) return;
        st = 2; el.classList.remove('go');
      }
      pull = Math.min(96, (dy - 12) * .55);
      el.style.opacity = Math.min(1, pull / 40);
      el.style.transform = 'translateY(' + (pull - 64) + 'px) rotate(' + (pull * 4) + 'deg)';
      const a = pull >= 54;
      if (a !== armed) { armed = a; el.classList.toggle('arm', a); if (a) hap('arm'); }
    }, { passive: true });
    const done = () => {
      if (st !== 2) { st = 0; return; }
      st = 0;
      if (!armed || typeof sync !== 'function') return reset();
      busy = true; hap('ok');
      el.classList.add('go', 'spin'); el.style.opacity = '1'; el.style.transform = 'translateY(0)';
      Promise.resolve(sync(true)).catch(() => { }).then(() => setTimeout(() => { reset(); busy = false; }, 350));
    };
    addEventListener('touchend', done, { passive: true });
    addEventListener('touchcancel', () => { if (st === 2) { st = 0; reset(); } }, { passive: true });
  }

  /* ───── Gắn vào vòng vẽ của app ───── */
  function decorate() {
    try { kpis(); } catch (e) { console.warn('ux.kpis', e); }
    try { rows(); } catch (e) { console.warn('ux.rows', e); }
    try { empties(); } catch (e) { console.warn('ux.empties', e); }
    try { quick(); } catch (e) { console.warn('ux.quick', e); }
  }
  let raf = 0;
  const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; decorate(); }); });
  ['#v', '#sh'].forEach(s => { const n = $(s); if (n) mo.observe(n, { childList: true, subtree: true }); });
  decorate();
  ptr();
  window.UX = { dlt, spark, hap };
})();
