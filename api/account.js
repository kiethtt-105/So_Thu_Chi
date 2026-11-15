// Bảo mật tài khoản: danh sách thiết bị, đăng xuất từng máy / tất cả, nhật ký đăng nhập, passkey (WebAuthn).
// Không dùng thư viện ngoài: tự đọc CBOR và kiểm chữ ký bằng module crypto của Node (ES256, EdDSA, RS256, attestation "none").
const crypto = require('crypto');
const auth = require('./_auth');
const WA = 'stc:wa', CH = 'stc:wa:ch:';
class UErr extends Error { }   // lỗi cho người dùng thấy; lỗi khác chỉ báo chung chung
const b64 = b => Buffer.from(b).toString('base64url'), unb = s => Buffer.from(String(s || ''), 'base64url');
const sha = b => crypto.createHash('sha256').update(b).digest();

function cbor(b, o = 0) {   // -> [giá trị, vị trí kế tiếp]
  const ib = b[o++], mt = ib >> 5, ai = ib & 31;
  let n = ai, v;
  if (ai === 24) n = b[o++];
  else if (ai === 25) { n = b.readUInt16BE(o); o += 2; }
  else if (ai === 26) { n = b.readUInt32BE(o); o += 4; }
  else if (ai > 24) throw new Error('cbor');
  switch (mt) {
    case 0: return [n, o];
    case 1: return [-1 - n, o];
    case 2: return [b.subarray(o, o + n), o + n];
    case 3: return [b.toString('utf8', o, o + n), o + n];
    case 4: v = []; for (let i = 0; i < n; i++) { const r = cbor(b, o); v.push(r[0]); o = r[1]; } return [v, o];
    case 5: v = new Map(); for (let i = 0; i < n; i++) { const k = cbor(b, o), x = cbor(b, k[1]); v.set(k[0], x[0]); o = x[1]; } return [v, o];
    case 6: return cbor(b, o);
    default: return [n === 21 ? true : n === 20 ? false : null, o];
  }
}
function jwkOf(k) {   // khóa COSE -> JWK
  const kty = k.get(1), alg = k.get(3);
  if (kty === 2 && alg === -7 && k.get(-1) === 1) return { alg, jwk: { kty: 'EC', crv: 'P-256', x: b64(k.get(-2)), y: b64(k.get(-3)) } };
  if (kty === 3 && alg === -257) return { alg, jwk: { kty: 'RSA', n: b64(k.get(-1)), e: b64(k.get(-2)) } };
  if (kty === 1 && alg === -8 && k.get(-1) === 6) return { alg, jwk: { kty: 'OKP', crv: 'Ed25519', x: b64(k.get(-2)) } };
  throw new UErr('Thiết bị dùng thuật toán khóa chưa được hỗ trợ');
}
const sigOk = (rec, data, sg) => { try { return crypto.verify(rec.a === -8 ? null : 'sha256', data, crypto.createPublicKey({ key: rec.k, format: 'jwk' }), sg); } catch (e) { return false; } };

function rp(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim(), id = host.replace(/:\d+$/, '');
  const proto = /^(localhost|127\.0\.0\.1)$/.test(id) ? String(req.headers['x-forwarded-proto'] || 'http') : 'https';
  return { id, origin: proto + '://' + host };
}
async function challenge(kind) {
  const ch = b64(crypto.randomBytes(32));
  await auth.redis(['SET', CH + ch, kind, 'EX', '120']);
  return ch;
}
async function clientCheck(req, cdB64, type, kind) {   // kiểm clientDataJSON và tiêu thụ challenge (dùng một lần)
  const buf = unb(cdB64), R = rp(req);
  let cd; try { cd = JSON.parse(buf.toString('utf8')); } catch (e) { throw new UErr('Dữ liệu xác thực không hợp lệ'); }
  if (cd.type !== type || cd.origin !== R.origin || typeof cd.challenge !== 'string' || cd.challenge.length > 100) throw new UErr('Dữ liệu xác thực không hợp lệ');
  const [k] = await auth.redis(['GETDEL', CH + cd.challenge]);
  if (k !== kind) throw new UErr('Phiên xác thực đã hết hạn, hãy thử lại');
  return { hash: sha(buf), R };
}
function authData(ad, R) {   // rpIdHash đúng tên miền; bắt buộc có xác minh người dùng (vân tay / PIN)
  if (ad.length < 37 || !crypto.timingSafeEqual(ad.subarray(0, 32), sha(R.id))) throw new UErr('Sai tên miền');
  const f = ad[32];
  if (!(f & 1) || !(f & 4)) throw new UErr('Cần xác minh bằng vân tay / khuôn mặt / mã PIN');
  return { f, cnt: ad.readUInt32BE(33) };
}

const AUTHED = new Set(['info', 'outdev', 'outall', 'regopts', 'regverify', 'pkdel']);
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const send = (c, b) => res.status(c).json(b);
  if (req.method !== 'POST') return send(405, { ok: false, err: 'Method not allowed' });
  const sfs = req.headers['sec-fetch-site'];
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return send(403, { ok: false, err: 'Forbidden' });
  let b = {};
  try { b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (e) { return send(400, { ok: false, err: 'Dữ liệu không hợp lệ' }); }
  const act = String(b.act || '');
  if (!AUTHED.has(act) && act !== 'has' && act !== 'authopts' && act !== 'authverify') return send(400, { ok: false, err: 'Yêu cầu không hợp lệ' });
  if (!auth.hasRedis) return send(200, { ok: false, err: 'Cần Redis để dùng tính năng này' });
  if (AUTHED.has(act) && !(await auth.ok(req, res))) return send(401, { ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
  try {
    const cred = b.cred || {}, r = cred.response || {}, id = String(b.id || '');
    switch (act) {
      case 'has': {   // chưa cần đăng nhập: có passkey nào chưa (để màn hình đăng nhập quyết định hiện nút)
        const [n] = await auth.redis(['HLEN', WA]);
        return send(200, { ok: true, has: +n > 0 });
      }
      case 'authopts': {   // chưa cần đăng nhập: xin challenge để đăng nhập bằng passkey
        const k = 'stc:wa:rl:' + auth.ip(req), [n] = await auth.redis(['INCR', k]);
        if (+n === 1) await auth.redis(['EXPIRE', k, '300']);
        if (+n > 30) return send(429, { ok: false, err: 'Thử quá nhiều lần, hãy đợi vài phút' });
        const [ids] = await auth.redis(['HKEYS', WA]);
        if (!ids.length) throw new UErr('Chưa có passkey nào được đăng ký');
        return send(200, { ok: true, challenge: await challenge('auth'), rpId: rp(req).id, allow: ids });
      }
      case 'authverify': {
        const cid = String(cred.id || ''), [raw] = await auth.redis(['HGET', WA, cid]);
        if (!raw || cid.length > 400) throw new UErr('Passkey không hợp lệ');
        const rec = JSON.parse(raw), cc = await clientCheck(req, r.clientDataJSON, 'webauthn.get', 'auth');
        const ad = unb(r.authenticatorData), A = authData(ad, cc.R);
        if (!sigOk(rec, Buffer.concat([ad, cc.hash]), unb(r.signature)) || ((A.cnt || rec.c) && A.cnt <= rec.c)) {
          await auth.log(req, { e: 'login', ok: false, m: 'passkey' });
          throw new UErr('Passkey không hợp lệ');
        }
        rec.c = A.cnt; rec.l = Date.now();
        await auth.redis(['HSET', WA, cid, JSON.stringify(rec)]);
        await auth.login(req, res, 'passkey');
        return send(200, { ok: true });
      }
      case 'info': {
        const [d, lg, pk] = await Promise.all([auth.list(), auth.logs(20), auth.redis(['HGETALL', WA])]), P = auth.pairs(pk[0]);
        const passkeys = Object.keys(P).map(k => { let x = {}; try { x = JSON.parse(P[k]); } catch (e) { } return { id: k, n: x.n, t: x.t, l: x.l }; }).sort((a, c) => c.t - a.t);
        return send(200, { ok: true, me: req.did, devices: d.out, passkeys, log: lg });
      }
      case 'outdev':
        if (!/^[a-f0-9]{24}$/.test(id)) throw new UErr('Mã thiết bị không hợp lệ');
        if (id === req.did) throw new UErr('Muốn thoát máy này, hãy dùng nút Khóa sổ');
        await auth.drop(id); await auth.log(req, { e: 'outdev', ok: true });
        return send(200, { ok: true });
      case 'outall': {
        const n = await auth.dropOthers(req.did); await auth.log(req, { e: 'outall', ok: true, x: n });
        return send(200, { ok: true, n });
      }
      case 'regopts': {
        const [ids] = await auth.redis(['HKEYS', WA]);
        if (ids.length >= 10) throw new UErr('Tối đa 10 passkey, hãy xóa bớt');
        return send(200, {
          ok: true, challenge: await challenge('reg'), rp: { name: 'Sổ Thu Chi', id: rp(req).id },
          user: { id: b64('stc-owner'), name: 'so-thu-chi', displayName: 'Sổ Thu Chi' },
          params: [-7, -8, -257].map(alg => ({ type: 'public-key', alg })),
          sel: { residentKey: 'preferred', userVerification: 'required' }, exclude: ids
        });
      }
      case 'regverify': {
        const cc = await clientCheck(req, r.clientDataJSON, 'webauthn.create', 'reg');
        let rec;
        try {
          const ad = cbor(unb(r.attestationObject))[0].get('authData'), A = authData(ad, cc.R);
          if (!(A.f & 0x40)) throw new UErr('Thiếu khóa công khai');
          const L = ad.readUInt16BE(53), cid = ad.subarray(55, 55 + L);
          if (b64(cid) !== String(cred.id || '')) throw new UErr('Mã passkey không khớp');
          const { alg, jwk } = jwkOf(cbor(ad, 55 + L)[0]);
          crypto.createPublicKey({ key: jwk, format: 'jwk' });
          rec = { id: b64(cid), v: { k: jwk, a: alg, c: A.cnt, n: auth.uaName(req), t: Date.now(), l: 0 } };
        } catch (e) { throw e instanceof UErr ? e : new UErr('Passkey không hợp lệ'); }
        await auth.redis(['HSET', WA, rec.id, JSON.stringify(rec.v)]);
        await auth.log(req, { e: 'pkadd', ok: true });
        return send(200, { ok: true });
      }
      case 'pkdel':
        if (!id || id.length > 400) throw new UErr('Mã passkey không hợp lệ');
        await auth.redis(['HDEL', WA, id]); await auth.log(req, { e: 'pkdel', ok: true });
        return send(200, { ok: true });
    }
  } catch (e) {
    if (e instanceof UErr) return send(400, { ok: false, err: e.message });
    return send(500, { ok: false, err: 'Lỗi máy chủ, hãy thử lại' });
  }
};
