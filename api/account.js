// Passkey (WebAuthn) — tự chứa, chỉ dùng module crypto của Node. KHÔNG dùng Redis.
// Đăng nhập bằng passkey thành công => cấp đúng cookie như đăng nhập mật khẩu (auth.cookie()).
// Thêm / xem / xóa passkey cần đang đăng nhập. Trình duyệt gửi khóa công khai dạng SPKI (getPublicKey) nên không cần đọc CBOR.
// Kho passkey + challenge: Apps Script (Kv.gs: pk.count / pk.info / pk.opts / pk.prep / pk.save / pk.add / pk.del), challenge dùng một lần, hạn 120 giây.
const crypto = require('crypto');
const auth = require('./_auth');
const MAX = 10, ALGS = [-7, -8, -257];   // ES256, EdDSA, RS256

class UErr extends Error { }   // lỗi cho người dùng thấy; lỗi khác chỉ báo chung chung
async function kvx(op, extra) {   // gọi Kv.gs; lỗi thì ném UErr với thông báo tiếng Việt từ Apps Script / _auth.kv
  const j = await auth.kv(op, extra);
  if (!j.ok) throw new UErr(j.err || 'Không làm việc được với Google Sheet');
  return j;
}
const rlMap = new Map();   // đếm yêu cầu authopts theo IP (trong bộ nhớ instance, chỉ làm chậm kẻ đoán mò)
let CNT = { n: 0, t: 0 };  // cache số passkey 20 giây: màn đăng nhập hỏi "has" mỗi lần mở
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
const newChallenge = () => b64(crypto.randomBytes(32));
function readClient(req, cdB64, type) {   // kiểm clientDataJSON (loại, origin); challenge do Kv.gs tiêu thụ ở bước sau
  const buf = unb(cdB64), S = site(req), cd = parse(buf.toString('utf8'));
  if (!cd || cd.type !== type || cd.origin !== S.origin || typeof cd.challenge !== 'string' || cd.challenge.length > 100) throw new UErr('Dữ liệu xác thực không hợp lệ');
  return { hash: sha(buf), S, ch: cd.challenge };
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
        res.setHeader('Set-Cookie', auth.cookie());   // giống đăng nhập mật khẩu
        return send(200, { ok: true });
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
        await kvx('pk.add', { c: ch, id: cid, max: MAX, rec: { k: b64(spki), a: alg, c: 0, n: devName(req), t: Date.now(), l: 0 } });   // tiêu thụ challenge + kiểm giới hạn + lưu
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
