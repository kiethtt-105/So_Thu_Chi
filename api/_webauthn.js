// Phần "toán học" của WebAuthn cho passkey: mã hóa base64url, đọc clientDataJSON, kiểm khóa công khai SPKI và chữ ký.
// Thuần hàm (không gọi mạng, không biết Google Sheet). File bắt đầu bằng "_" nên không phải API route.
const crypto = require('crypto');

class UErr extends Error { }   // lỗi cho người dùng thấy; lỗi khác chỉ báo chung chung
const b64 = b => Buffer.from(b).toString('base64url'), unb = s => Buffer.from(String(s || ''), 'base64url');
const sha = b => crypto.createHash('sha256').update(b).digest();
const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
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

module.exports = { UErr, b64, unb, sha, parse, site, newChallenge, readClient, pubKey, verifySig };
