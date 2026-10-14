// Đăng nhập nhanh bằng GET: mở app với ?key=<KEY trong config.js> thì khỏi nhập mật khẩu.
// Key được xóa khỏi thanh địa chỉ ngay sau khi đọc. Có thể kèm ?q=... để ghi nhanh luôn (deeplink.js).
(function () {
    try {
        const u = new URL(location.href), kn = [...u.searchParams.keys()].find(x => x.toLowerCase() === 'key'), k = kn === undefined ? null : u.searchParams.get(kn);
        if (k !== null) {
            u.searchParams.delete(kn);
            history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
            const K = (window.CONFIG || {}).KEY;
            if (K && k === K)
                touch();
        }
    }
    catch (e) { }
})();
if (alive())
    boot();
