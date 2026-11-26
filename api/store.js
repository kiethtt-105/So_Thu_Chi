// /api/store — cổng chính giữa thiết bị và Google Sheet (Apps Script). KHÔNG dùng Redis.
// File này chỉ định tuyến; logic nằm ở các module "_" (không phải route):
//   _auth.js (cookie, kho Kv)  _login.js (đăng nhập mật khẩu)  _validate.js (kiểm tra giao dịch)
//   _sheet.js (gọi Apps Script)  _backup.js (sao lưu Drive)
// Cùng định dạng request/response với Apps Script nên app.js dùng như cũ.
const auth = require('./_auth'), env = auth.env;
const { sheet } = require('./_sheet'), { cleanOps } = require('./_validate');
const { backupDrive } = require('./_backup'), { doLogin } = require('./_login');
const APP_KEY = env('APP_KEY'), APP_API = env('APP_API'), APP_PASS = env('APP_PASS'), CRON_SECRET = env('CRON_SECRET');
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!APP_API || !APP_KEY || !APP_PASS) return res.status(200).json({ ok: false, hubErr: true, err: 'Chưa cấu hình APP_API / APP_KEY / APP_PASS trên Vercel' });
  try {
    if (req.method === 'GET') {   // Vercel Cron: sao lưu JSON mỗi ngày
      if (!CRON_SECRET || req.headers.authorization !== 'Bearer ' + CRON_SECRET) return res.status(200).json({ ok: true, cron: false });
      return res.status(200).json({ ok: true, backup: await backupDrive().catch(e => ({ ok: false, err: String(e && e.message || e) })) });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, err: 'Method not allowed' });
    const sfs = req.headers['sec-fetch-site'];
    if (sfs && sfs !== 'same-origin' && sfs !== 'none') return res.status(403).json({ ok: false, err: 'Forbidden' });
    const body = typeof req.body === 'string' ? parse(req.body || '{}') || {} : (req.body || {});

    if (body.logout) { res.setHeader('Set-Cookie', auth.clear()); return res.status(200).json({ ok: true }); }
    if (body.login !== undefined) return await doLogin(req, res, body);
    const S = await auth.session(req, res);
    if (!S) return res.status(401).json({ ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });

    if (body.logoutAll) {   // ghi mốc thu hồi vào Apps Script; cấp lại cookie cho máy này (iat mới >= mốc) nên máy này vẫn đăng nhập
      if (!(await auth.revokeAll())) return res.status(200).json({ ok: false, err: 'Không ghi được mốc thu hồi lên Google Sheet (đã thêm Kv.gs và Deploy phiên bản mới chưa?). Cách khác: đổi APP_PASS hoặc APP_KEY trên Vercel rồi Redeploy.' });
      await auth.devKeep(S.tid);
      res.setHeader('Set-Cookie', auth.cookie(S.tid));
      return res.status(200).json({ ok: true });
    }
    if (body.backupNow) return res.status(200).json(await backupDrive().catch(e => ({ ok: false, err: String(e && e.message || e) })));
    if (body.img) return res.status(200).json(await sheet({ img: body.img }, 45000));
    if (body.cfg) {   // cài đặt đồng bộ giữa các máy: lưu ở tab CauHinh của Google Sheet (Kv.gs: cfg.sync)
      const c = body.cfg && typeof body.cfg === 'object' ? body.cfg : {};
      const j = await auth.kv('cfg.sync', { cfg: c.set ? { set: c.set } : { get: true } }, 25000);
      return res.status(200).json(j.ok ? j : { ok: false, err: j.err || 'Không đồng bộ được cài đặt với Google Sheet' });
    }

    if (Array.isArray(body.ops) && body.ops.length) {
      const v = cleanOps(body.ops);
      if (v.err) return res.status(200).json({ ok: false, reject: true, err: 'Dữ liệu bị từ chối: ' + v.err });
      body.ops = v.ops;
    }
    const sid = typeof body.sid === 'string' ? body.sid.slice(0, 64) : '';
    return res.status(200).json(await sheet({ ops: Array.isArray(body.ops) ? body.ops : [], rev: body.rev || '', fast: !!body.fast, sid }, 50000));
  } catch (e) {
    return res.status(200).json({ ok: false, hubErr: true, err: 'Máy chủ: ' + (e && e.message || e) });
  }
};
module.exports._cleanOps = cleanOps;