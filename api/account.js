// Passkey (WebAuthn) — viết mới, tự chứa: chỉ dùng Redis + module crypto của Node, không cần thư viện ngoài.
// Đăng nhập bằng passkey thành công => cấp đúng cookie như đăng nhập mật khẩu (auth.cookie()).
// Thêm / xem / xóa passkey cần đang đăng nhập. Trình duyệt gửi khóa công khai dạng SPKI (getPublicKey) nên không cần đọc CBOR.
// Redis: hash stc:pk (mã passkey -> {k: khóa SPKI, a: thuật toán, c: bộ đếm, n: tên, t: ngày tạo, l: lần dùng cuối}); stc:pk:ch:<challenge> (120 giây, dùng một lần).
const crypto = require('crypto');
const auth = require('./_auth');
const RU = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'stc:pk', CH = 'stc:pk:ch:', MAX = 10, ALGS = [-7, -8, -257];   // ES256, EdDSA, RS256

class UErr extends Error { }   // lỗi cho người dùng thấy; lỗi khác chỉ báo chung chung
const rd = async (...cmds) => {
  const r = await fetch(RU + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + RT, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  const j = await r.json();
  if (!Array.isArray(j) || j.some(x => !x || x.error)) throw new Error('redis');
  return j.map(x => x.result);
};
const b64 = b => Buffer.from(b).toString('base64url'), unb = s => Buffer.from(String(s || ''), 'base64url');
const sha = b => crypto.createHash('sha256').update(b).digest();
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const ipOf = auth.clientIp;
function devName(req) {
  const u = String(req.headers['user-agent'] || '');
  const os = /Windows/.test(u) ? 'Windows' : /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : '';
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /CriOS|Chrome/.test(u) ? 'Chrome' : /Safari/.test(u) ? 'Safari' : 'Trình duyệt';
  return br + (os ? ' · ' + os : '');
}
function site(req) {   // tên miền (rpId) và origin mà trình duyệt đang dùng
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim(), id = host.replace(/:\d+$/, '');
  const proto = /^(localhost|127\.0\.0\.1)$/.test(id) ? String(req.headers['x-forwarded-proto'] || 'http') : 'https';
  return { id, origin: proto + '://' + host };
}
async function newChallenge(kind) {
  const c = b64(crypto.randomBytes(32));
  await rd(['SET', CH + c, kind, 'EX', '120']);
  return c;
}
async function useChallenge(req, cdB64, type, kind) {   // kiểm clientDataJSON + tiêu thụ challenge
  const buf = unb(cdB64), S = site(req), cd = parse(buf.toString('utf8'));
  if (!cd || cd.type !== type || cd.origin !== S.origin || typeof cd.challenge !== 'string' || cd.challenge.length > 100) throw new UErr('Dữ liệu xác thực không hợp lệ');
  const [k] = await rd(['GETDEL', CH + cd.challenge]);
  if (k !== kind) throw new UErr('Phiên xác thực đã hết hạn, hãy thử lại');
  return { hash: sha(buf), S };
}
function pubKey(spki) { return crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' }); }
const verifySig = (rec, data, sig) => { try { return crypto.verify(rec.a === -8 ? null : 'sha256', data, pubKey(unb(rec.k)), sig); } catch (e) { return false; } };

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
  if (!RU || !RT) return send(200, { ok: false, err: 'Cần Redis để dùng passkey' });
  if (PRIVATE.includes(act) && !(await auth.ok(req, res))) return send(401, { ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });
  try {
    const cred = b.cred || {}, r = cred.response || {};
    switch (act) {
      case 'has': {
        const [n] = await rd(['HLEN', KEY]);
        return send(200, { ok: true, has: +n > 0 });
      }
      case 'authopts': {
        const rl = 'stc:pk:rl:' + ipOf(req), [, n] = await rd(['SET', rl, '0', 'EX', '300', 'NX'], ['INCR', rl]);   // SET NX gắn TTL, INCR giữ nguyên TTL: không bao giờ có key vô hạn
        if (+n > 30) return send(429, { ok: false, err: 'Thử quá nhiều lần, hãy đợi vài phút' });
        const [ids] = await rd(['HKEYS', KEY]);
        if (!ids.length) throw new UErr('Chưa có passkey nào được đăng ký');
        return send(200, { ok: true, challenge: await newChallenge('get'), rpId: site(req).id, allow: ids });
      }
      case 'authverify': {
        const cid = String(cred.id || '');
        if (!cid || cid.length > 400) throw new UErr('Passkey không hợp lệ');
        const [raw] = await rd(['HGET', KEY, cid]), rec = parse(raw);
        if (!rec) throw new UErr('Passkey không hợp lệ');
        const { hash, S } = await useChallenge(req, r.clientDataJSON, 'webauthn.get', 'get');
        const ad = unb(r.authenticatorData);
        if (ad.length < 37 || !crypto.timingSafeEqual(ad.subarray(0, 32), sha(S.id))) throw new UErr('Sai tên miền');
        if (!(ad[32] & 1) || !(ad[32] & 4)) throw new UErr('Cần xác minh bằng vân tay / khuôn mặt / mã PIN');
        const cnt = ad.readUInt32BE(33);
        if (!verifySig(rec, Buffer.concat([ad, hash]), unb(r.signature)) || ((cnt || rec.c) && cnt <= rec.c)) throw new UErr('Passkey không hợp lệ');
        rec.c = cnt; rec.l = Date.now();
        await rd(['HSET', KEY, cid, JSON.stringify(rec)]);
        await auth.logLogin(req, 'Passkey', true);
        res.setHeader('Set-Cookie', auth.cookie());   // giống đăng nhập mật khẩu
        return send(200, { ok: true });
      }
      case 'info': {
        const [h] = await rd(['HGETALL', KEY]), list = [];
        for (let i = 0; Array.isArray(h) && i + 1 < h.length; i += 2) { const o = parse(h[i + 1]); if (o) list.push({ id: h[i], n: o.n, t: o.t, l: o.l }); }
        return send(200, { ok: true, passkeys: list.sort((a, c) => (c.t || 0) - (a.t || 0)) });
      }
      case 'regopts': {
        const [ids] = await rd(['HKEYS', KEY]);
        if (ids.length >= MAX) throw new UErr('Tối đa ' + MAX + ' passkey, hãy xóa bớt');
        return send(200, {
          ok: true, challenge: await newChallenge('reg'), rp: { name: 'Sổ Thu Chi', id: site(req).id },
          user: { id: b64('stc-owner'), name: 'so-thu-chi', displayName: 'Sổ Thu Chi' },
          params: ALGS.map(alg => ({ type: 'public-key', alg })),
          sel: { residentKey: 'preferred', userVerification: 'required' }, exclude: ids
        });
      }
      case 'regverify': {
        await useChallenge(req, r.clientDataJSON, 'webauthn.create', 'reg');
        const cid = String(cred.id || ''), alg = +cred.alg;
        if (!cid || cid.length > 400 || !ALGS.includes(alg)) throw new UErr('Passkey không hợp lệ');
        const spki = unb(cred.publicKey);
        try { pubKey(spki); } catch (e) { throw new UErr('Khóa passkey không hợp lệ'); }
        const [n] = await rd(['HLEN', KEY]);
        if (+n >= MAX) throw new UErr('Tối đa ' + MAX + ' passkey, hãy xóa bớt');
        await rd(['HSET', KEY, cid, JSON.stringify({ k: b64(spki), a: alg, c: 0, n: devName(req), t: Date.now(), l: 0 })]);
        return send(200, { ok: true });
      }
      case 'pkdel': {
        const id = String(b.id || '');
        if (!id || id.length > 400) throw new UErr('Mã passkey không hợp lệ');
        await rd(['HDEL', KEY, id]);
        return send(200, { ok: true });
      }
    }
  } catch (e) {
    if (e instanceof UErr) return send(400, { ok: false, err: e.message });
    return send(500, { ok: false, err: 'Lỗi máy chủ, hãy thử lại' });
  }
};
