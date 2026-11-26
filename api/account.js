// /api/account — passkey (WebAuthn). KHÔNG dùng Redis.
// Đăng nhập bằng passkey thành công => cấp đúng cookie như đăng nhập mật khẩu (auth.cookie()). Thêm / xem / xóa passkey cần đang đăng nhập.
// Kho passkey + challenge: Apps Script (Kv.gs: pk.count / pk.info / pk.opts / pk.prep / pk.save / pk.add / pk.del), challenge dùng một lần, hạn 120 giây.
// Phần mã hóa WebAuthn nằm ở _webauthn.js.
const crypto = require('crypto');
const auth = require('./_auth');
const { UErr, b64, unb, sha, parse, site, newChallenge, readClient, pubKey, verifySig } = require('./_webauthn');
const MAX = 10, ALGS = [-7, -8, -257];   // ES256, EdDSA, RS256
const ipOf = auth.clientIp;

async function kvx(op, extra) {   // gọi Kv.gs; lỗi thì ném UErr với thông báo tiếng Việt từ Apps Script / _auth.kv
  const j = await auth.kv(op, extra);
  if (!j.ok) throw new UErr(j.err || 'Không làm việc được với Google Sheet');
  return j;
}
const rlMap = new Map();   // đếm yêu cầu authopts theo IP (trong bộ nhớ instance, chỉ làm chậm kẻ đoán mò)
let CNT = { n: 0, t: 0 };  // cache số passkey 20 giây: màn đăng nhập hỏi "has" mỗi lần mở

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (c, b) => res.status(c).json(b);
  if (req.method !== 'POST') return send(405, { ok: false, err: 'Method not allowed' });
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return send(403, { ok: false, err: 'Forbidden' });
  let b = {};
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return send(400, { ok: false, err: 'Dữ liệu không hợp lệ' }); }
  const act = String(b.act || '');
  const PUBLIC = ['has', 'authopts', 'authverify'], PRIVATE = ['info', 'regopts', 'regverify', 'pkdel'];
  if (!PUBLIC.includes(act) && !PRIVATE.includes(act)) return send(400, { ok: false, err: 'Yêu cầu không hợp lệ' });
  if (PRIVATE.includes(act) && !(await auth.ok(req, res))) return send(401, { ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
  try {
    const cred = b.cred || {}, r = cred.response || {};
    switch (act) {
      case 'has': {
        if (Date.now() - CNT.t > 20000) CNT = { n: +(await kvx('pk.count')).n || 0, t: Date.now() };
        return send(200, { ok: true, has: CNT.n > 0 });
      }
      case 'authopts': {
        const ip = ipOf(req), now = Date.now();
        for (const [k, v] of rlMap) if (v.exp < now) rlMap.delete(k);
        const q = rlMap.get(ip) || { n: 0, exp: now + 300000 };
        q.n++; rlMap.set(ip, q);
        if (q.n > 30) return send(429, { ok: false, err: 'Thử quá nhiều lần, hãy đợi vài phút' });
        const c = newChallenge(), j = await kvx('pk.opts', { kind: 'get', c });   // Kv.gs báo lỗi nếu chưa có passkey nào
        return send(200, { ok: true, challenge: c, rpId: site(req).id, allow: j.ids || [] });
      }
      case 'authverify': {
        const cid = String(cred.id || '');
        if (!cid || cid.length > 400) throw new UErr('Passkey không hợp lệ');
        const { hash, S, ch } = readClient(req, r.clientDataJSON, 'webauthn.get');
        const rec = (await kvx('pk.prep', { c: ch, id: cid })).rec;   // tiêu thụ challenge (dùng một lần) + lấy khóa
        if (!rec || typeof rec !== 'object') throw new UErr('Passkey không hợp lệ');
        const ad = unb(r.authenticatorData);
        if (ad.length < 37 || !crypto.timingSafeEqual(ad.subarray(0, 32), sha(S.id))) throw new UErr('Sai tên miền');
        if (!(ad[32] & 1) || !(ad[32] & 4)) throw new UErr('Cần xác minh bằng vân tay / khuôn mặt / mã PIN');
        const cnt = ad.readUInt32BE(33);
        if (!verifySig(rec, Buffer.concat([ad, hash]), unb(r.signature)) || ((cnt || rec.c) && cnt <= rec.c)) throw new UErr('Passkey không hợp lệ');
        rec.c = cnt; rec.l = Date.now();
        await Promise.all([auth.kv('pk.save', { id: cid, rec }), auth.logLogin(req, 'Passkey', true)]);   // ghi bộ đếm lỗi thì vẫn cho đăng nhập
        const did = String(b.did || '').slice(0, 40), trusted = await auth.deviceTrusted(did);
        res.setHeader('Set-Cookie', auth.cookie(trusted ? did : '-'));   // giống đăng nhập mật khẩu: mặc định không tin cậy
        return send(200, { ok: true, trusted });
      }
      case 'info': {
        const list = ((await kvx('pk.info')).list || []).slice();
        return send(200, { ok: true, passkeys: list.sort((a, c) => (c.t || 0) - (a.t || 0)) });
      }
      case 'regopts': {
        const c = newChallenge(), ids = (await kvx('pk.opts', { kind: 'reg', c, max: MAX })).ids || [];   // Kv.gs báo lỗi nếu đã đủ MAX
        return send(200, {
          ok: true, challenge: c, rp: { name: 'Sổ Thu Chi', id: site(req).id },
          user: { id: b64('stc-owner'), name: 'so-thu-chi', displayName: 'Sổ Thu Chi' },
          params: ALGS.map(alg => ({ type: 'public-key', alg })),
          sel: { residentKey: 'preferred', userVerification: 'required' }, exclude: ids
        });
      }
      case 'regverify': {
        const { ch } = readClient(req, r.clientDataJSON, 'webauthn.create');
        const cid = String(cred.id || ''), alg = +cred.alg;
        if (!cid || cid.length > 400 || !ALGS.includes(alg)) throw new UErr('Passkey không hợp lệ');
        const spki = unb(cred.publicKey);
        try { pubKey(spki); } catch (e) { throw new UErr('Khóa passkey không hợp lệ'); }
        await kvx('pk.add', { c: ch, id: cid, max: MAX, rec: { k: b64(spki), a: alg, c: 0, n: auth.devName(req), t: Date.now(), l: 0 } });   // tiêu thụ challenge + kiểm giới hạn + lưu
        CNT.t = 0;
        return send(200, { ok: true });
      }
      case 'pkdel': {
        const id = String(b.id || '');
        if (!id || id.length > 400) throw new UErr('Mã passkey không hợp lệ');
        await kvx('pk.del', { id });
        CNT.t = 0;
        return send(200, { ok: true });
      }
    }
  } catch (e) {
    if (e instanceof UErr) return send(400, { ok: false, err: e.message });
    return send(500, { ok: false, err: 'Lỗi máy chủ, hãy thử lại' });
  }
};
