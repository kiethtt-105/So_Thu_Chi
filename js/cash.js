/* Đếm tiền mặt: nhập số tờ theo mệnh giá -> tính tổng -> điền vào ô Tiền mặt ở màn Cân đối */
(function () {
    IC.cnt = 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M15 4v16';  // biểu tượng bảng tính
    const DEN = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
    const KEY = 'stcash';
    let cur = -1;          // chỉ số tài khoản (trong S.acc) đang đếm
    let cnt = {};          // { mệnh giá: số tờ }

    const load = name => { try { return (JSON.parse(localStorage[KEY] || '{}'))[name] || {}; } catch (e) { return {}; } };
    const save = name => { try { const all = JSON.parse(localStorage[KEY] || '{}'); all[name] = cnt; localStorage[KEY] = JSON.stringify(all); } catch (e) { } };
    const total = () => DEN.reduce((s, d) => s + d * (+cnt[d] || 0), 0);
    const sheets = () => DEN.reduce((s, d) => s + (+cnt[d] || 0), 0);

    function refresh() {
        DEN.forEach(d => { const e = $('#cs' + d); if (e) e.textContent = cnt[d] ? num(d * cnt[d]) : '–'; });
        const t = $('#cs_t'), n = $('#cs_n');
        if (t) t.textContent = vnd(total());
        if (n) n.textContent = sheets() + ' tờ';
    }

    function openCash(i) {
        const a = S.acc[i];
        if (!a) return;
        cur = i;
        cnt = load(a.name);
        try { ED = null; E = null; } catch (e) { }
        $('#sh').innerHTML = `<h3>Đếm tiền mặt <small class="mut" style="font:500 13px var(--fb,inherit)">${esc(a.name)}</small></h3>
<div class="cash" id="cash">${DEN.map(d => `<div class="cr"><b>${num(d)}</b><span class="x">×</span><input class="cin" data-d="${d}" inputmode="numeric" maxlength="5" placeholder="0" value="${cnt[d] ? cnt[d] : ''}" aria-label="Số tờ ${num(d)}"><span class="cs sens" id="cs${d}">–</span></div>`).join('')}</div>
<div class="ctot"><span>Tổng <small id="cs_n"></small></span><b class="sens" id="cs_t">0 ₫</b></div>
<button type="button" class="btn p w" data-cfill>Điền vào ô tiền mặt</button>
<button type="button" class="btn w" data-cclear>Xóa hết</button>`;
        refresh();
        openSheet();
        setTimeout(() => { const f = $('#cash .cin'); if (f) f.focus(); }, 80);
    }

    function fill() {
        const a = S.acc[cur];
        if (!a) return closeSheet();
        const t = total();
        save(a.name);
        S.act[a.name] = t;
        const el = $('.ba[data-i="' + cur + '"]');
        if (el) el.value = num(t);
        closeSheet();
        if (typeof reconUpdate === 'function') reconUpdate();
    }

    // mở sheet từ nút cạnh ô Tiền mặt
    document.addEventListener('click', e => {
        const b = e.target.closest('[data-cash]');
        if (b && !b.closest('#ov')) { e.preventDefault(); return openCash(+b.dataset.cash); }
        if (!e.target.closest('#cash') && !e.target.closest('[data-cfill],[data-cclear]')) return;
        if (e.target.closest('[data-cfill]')) return fill();
        if (e.target.closest('[data-cclear]')) {
            cnt = {};
            $$('#cash .cin').forEach(i => { i.value = ''; });
            refresh();
            const f = $('#cash .cin'); if (f) f.focus();
        }
    });

    document.addEventListener('input', e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains('cin')) return;
        const v = t.value.replace(/[^\d]/g, '');
        if (t.value !== v) t.value = v;
        cnt[t.dataset.d] = +v || 0;
        refresh();
    });

    // Enter: nhảy sang mệnh giá kế tiếp; ở ô cuối thì điền luôn
    document.addEventListener('keydown', e => {
        const t = e.target;
        if (e.key !== 'Enter' || !t.classList || !t.classList.contains('cin')) return;
        e.preventDefault();
        const all = $$('#cash .cin'), i = all.indexOf(t);
        if (i < all.length - 1) { all[i + 1].focus(); all[i + 1].select(); } else fill();
    });
    document.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('cin')) setTimeout(() => { try { e.target.select(); } catch (x) { } }, 0); });
})();
