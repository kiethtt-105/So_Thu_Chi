// Ghi nhanh từ bên ngoài (Phím tắt iPhone): mở app với ?q=<câu gõ nhanh>
// Ví dụ: .../So_Thu_Chi/?q=an%20pho%2050k%20momo  → app đọc câu như khi gõ vào ô "Gõ nhanh" rồi tự lưu.
// Thiếu số tiền / tài khoản / hạng mục thì mở form để bổ sung thay vì lưu sai.
(function () {
    let q = '';
    try {
        const u = new URL(location.href);
        q = (u.searchParams.get('q') || '').trim();
        if (u.searchParams.has('q')) { u.searchParams.delete('q'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
    } catch (e) { }
    if (!q) return;
    const t0 = Date.now();
    const tick = setInterval(() => {
        const shown = !$('#app').classList.contains('hide');
        if (Date.now() - t0 > 5 * 60e3) return clearInterval(tick);
        // chờ đăng nhập xong và đồng bộ xong (tối đa 10 giây sau khi có dữ liệu cache)
        if (!shown || !S.ready || !(S.synced || Date.now() - t0 > 10e3)) return;
        clearInterval(tick);
        $('#qin').value = q;
        qSubmit(false);
    }, 250);
})();