// /api/sessions — lịch sử đăng nhập và thu hồi đăng nhập trên máy khác. Cần đang đăng nhập.
//  history       : danh sách lần đăng nhập gần đây (thành công + sai mật khẩu) + mốc "đăng xuất tất cả" gần nhất
//  clearHistory  : xóa lịch sử
//  revokeOthers  : mọi cookie cấp trước bây giờ bị loại và mọi thiết bị tin cậy khác bị bỏ; máy này được cấp cookie mới nên vẫn đăng nhập
//  devices       : danh sách thiết bị tin cậy + mã thiết bị hiện tại (me = '-' nghĩa là máy này không tin cậy)
//  trust         : tin cậy máy này (tối đa 10 thiết bị)
//  untrust       : bỏ tin cậy một thiết bị (mặc định máy này)
const auth = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (c, b) => res.status(c).json(b);
  if (req.method !== 'POST') return send(405, { ok: false, err: 'Method not allowed' });
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return send(403, { ok: false, err: 'Forbidden' });
  const S = await auth.session(req, res);
  if (!S) return send(401, { ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
  let b = {};
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return send(400, { ok: false, err: 'Dữ liệu không hợp lệ' }); }
  const NO_KV = 'Không đọc/ghi được Google Sheet. Hãy thêm Kv.gs vào Apps Script rồi Deploy phiên bản mới';
  try {
    switch (String(b.act || '')) {
      case 'history': {
        const list = await auth.loginList();
        if (list === null) return send(200, { ok: false, err: NO_KV });
        const me = { ip: auth.clientIp(req), d: auth.devName(req) };
        return send(200, { ok: true, me, rev: await auth.revokedAt(), list });
      }
      case 'clearHistory':
        return send(200, (await auth.clearLogins()) ? { ok: true } : { ok: false, err: NO_KV });
      case 'revokeOthers': {
        if (!(await auth.revokeAll())) return send(200, { ok: false, err: NO_KV + '. Cách khác: đổi APP_PASS hoặc APP_KEY trên Vercel rồi Redeploy.' });
        await auth.devKeep(S.tid);   // các thiết bị tin cậy khác cũng bị bỏ
        res.setHeader('Set-Cookie', auth.cookie(S.tid));
        return send(200, { ok: true });
      }
      case 'devices': {
        const list = await auth.devList();
        if (list === null) return send(200, { ok: false, err: NO_KV });
        return send(200, { ok: true, me: S.tid, list });
      }
      case 'trust': {
        if (S.tid !== '-') return send(200, { ok: true, id: S.tid });
        const j = await auth.devAdd(req);
        if (!j.ok) return send(200, { ok: false, err: j.err || NO_KV });
        res.setHeader('Set-Cookie', auth.cookie(j.id, S.iat));
        return send(200, { ok: true, id: j.id });
      }
      case 'untrust': {
        const id = String(b.id || S.tid);
        if (id === '-') return send(200, { ok: true });
        if (!(await auth.devDel(id))) return send(200, { ok: false, err: NO_KV });
        if (id === S.tid) res.setHeader('Set-Cookie', auth.cookie('-'));
        return send(200, { ok: true });
      }
      default: return send(400, { ok: false, err: 'Yêu cầu không hợp lệ' });
    }
  } catch (e) {
    return send(500, { ok: false, err: 'Lỗi máy chủ, hãy thử lại' });
  }
};