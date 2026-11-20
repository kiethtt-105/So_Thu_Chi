// Cảnh báo hạn mức NGAY KHI NHẬP khoản chi (trước khi bấm Lưu). Nạp sau app.js; dùng E, S, stx(), heldSet(), amtVal(), ymd(), vnd(), emo(), $.
// Chỉ đọc dữ liệu, không ghi gì. Sau khi lưu, cảnh báo "bội chi" cũ trong limCheck() vẫn chạy như trước.
(function () {
    const WARN = 0.8;   // từ 80% hạn mức trở lên mới hiện, giống mức "sắp hết" ở trang Tổng quan
    let raf = 0;

    function lines() {
        if (typeof E === 'undefined' || !E || E.type !== 'Chi' || !S.lim || !S.lim.length) return [];
        const fa = $('#fa'); if (!fa) return [];
        const amt = amtVal(fa.value || ''); if (!(amt > 0)) return [];
        const acc = ($('#fc') || {}).value || E.acc;
        if (heldSet().has(acc)) return [];                                   // tài khoản giữ hộ không tính thu chi
        const date = ($('#fd') || {}).value || ymd(new Date()), cat = ($('#fp') || {}).value || E.cat || '';
        const others = stx().filter(t => t.type === 'Chi' && String(t.id) !== String(E.id));
        const out = [];
        S.lim.forEach(L => {
            if (L.cat && L.cat !== cat) return;
            const day = L.per === 'Ngày', k = day ? date : date.slice(0, 7);
            const used = others.filter(t => (day ? t.date === k : t.date.slice(0, 7) === k) && (!L.cat || t.cat === L.cat)).reduce((s, t) => s + t.amount, 0);
            const after = used + amt, pct = after / L.v;
            if (pct >= WARN) out.push({ name: L.cat ? emo(L.cat) + ' ' + L.cat : 'Tổng chi', when: day ? 'ngày' : 'tháng', after, v: L.v, pct, over: after > L.v });
        });
        return out.sort((a, b) => b.pct - a.pct).slice(0, 3);
    }

    function paint() {
        raf = 0;
        let box = $('#lpv');
        const L = lines();
        if (!L.length) { if (box) box.remove(); return; }
        if (!box) {
            const anchor = document.querySelector('#sh .amtw'); if (!anchor) return;
            box = document.createElement('div'); box.id = 'lpv'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
            box.style.cssText = 'margin:8px 0;font-size:13px;line-height:1.5';
            anchor.insertAdjacentElement('afterend', box);
        }
        const html = L.map(x => `<div style="color:${x.over ? 'var(--chi)' : 'var(--mut)'};${x.over ? 'font-weight:600' : ''}">${x.over ? '🚨' : '⚠️'} ${esc(x.name)} · hạn mức ${x.when}: sau khoản này ${vnd(x.after)} / ${vnd(x.v)} (${Math.round(x.pct * 100)}%)${x.over ? ', vượt ' + vnd(x.after - x.v) : ''}</div>`).join('');
        if (box.innerHTML !== html) box.innerHTML = html;
    }
    const later = () => { if (!raf) raf = requestAnimationFrame(paint); };

    const ov = $('#ov');
    if (ov) ['input', 'change', 'click'].forEach(ev => ov.addEventListener(ev, later));
    const sh = $('#sh');
    if (sh) new MutationObserver(later).observe(sh, { childList: true });   // form() dựng lại #sh: vẽ lại ngay, không lặp vì chỉ theo dõi con trực tiếp
})();
