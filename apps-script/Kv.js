// ===== 13_Kv (file Kv.gs) — kho dữ liệu cho phần đăng nhập (thay Redis của Vercel) =====
// Vercel gọi vào doPost với { key, kv: { op, ... } }. Dữ liệu nằm trong Script Properties (bền) và Cache (ngắn hạn, 120 giây).
//  REVOKED  : mốc "thu hồi đăng nhập trên máy khác" (ms)
//  LH_OK / LH_FAIL : lịch sử đăng nhập thành công (40 mục) / sai mật khẩu (15 mục)
//  PK_<hash>: mỗi passkey một mục {id,k,a,c,n,t,l}
//  cache ch_<challenge>: challenge WebAuthn dùng một lần
const KV_MAX_OK = 40, KV_MAX_FAIL = 15;

function kv_(d) {
  const P = PropertiesService.getScriptProperties(), C = CacheService.getScriptCache();
  const R = o => Object.assign({ ok: true, kv: 1 }, o), E = (err, user) => ({ ok: false, kv: 1, user: user ? 1 : 0, err });
  const s = (v, n) => String(v == null ? '' : v).slice(0, n || 200);
  const jget = k => { try { return JSON.parse(P.getProperty(k) || 'null'); } catch (e) { return null; } };
  const pkKey = id => 'PK_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id)).slice(0, 32);
  const pkAll = () => { const all = P.getProperties(), L = []; Object.keys(all).forEach(k => { if (k.indexOf('PK_') === 0) { try { const o = JSON.parse(all[k]); if (o && o.id) L.push(o); } catch (e) { } } }); return L; };
  const chPut = (c, kind) => C.put('ch_' + s(c, 100), kind, 120);
  const chUse = (c, kind) => { const k = 'ch_' + s(c, 100), v = C.get(k); if (!v) return false; C.remove(k); return v === kind; };
  const op = s(d && d.op, 30);

  if (op === 'rev.get') return R({ t: +(P.getProperty('REVOKED') || 0) });
  if (op === 'log.list') return R({ list: jget('LH_OK') || [], fails: jget('LH_FAIL') || [] });
  if (op === 'pk.count') return R({ n: pkAll().length });
  if (op === 'pk.info') return R({ list: pkAll().map(o => ({ id: o.id, n: o.n, t: o.t, l: o.l })) });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return E('Hệ thống đang bận, hãy thử lại', true);
  try {
    switch (op) {
      case 'rev.set': P.setProperty('REVOKED', String(Number(d.t) || Date.now())); return R({});
      case 'log.add': {
        const rec = { t: Number(d.rec && d.rec.t) || Date.now(), ip: s(d.rec && d.rec.ip, 60), d: s(d.rec && d.rec.d, 60), m: s(d.rec && d.rec.m, 30), ok: d.good ? 1 : 0 };
        const ok = jget('LH_OK') || [], fail = jget('LH_FAIL') || [], prev = ok.slice();
        if (d.good) { ok.unshift(rec); P.setProperty('LH_OK', JSON.stringify(ok.slice(0, KV_MAX_OK))); }
        else { fail.unshift(rec); P.setProperty('LH_FAIL', JSON.stringify(fail.slice(0, KV_MAX_FAIL))); }
        return R({ prev, fails: fail.slice(0, KV_MAX_FAIL) });
      }
      case 'log.clear': P.deleteProperty('LH_OK'); P.deleteProperty('LH_FAIL'); return R({});
      case 'pk.opts': {
        const ids = pkAll().map(o => o.id), max = Number(d.max) || 10;
        if (d.kind === 'get' && !ids.length) return E('Chưa có passkey nào được đăng ký', true);
        if (d.kind === 'reg' && ids.length >= max) return E('Tối đa ' + max + ' passkey, hãy xóa bớt', true);
        chPut(d.c, d.kind === 'reg' ? 'reg' : 'get');
        return R({ ids });
      }
      case 'pk.prep': {   // đăng nhập: tiêu thụ challenge + trả về khóa của passkey
        if (!chUse(d.c, 'get')) return E('Phiên xác thực đã hết hạn, hãy thử lại', true);
        return R({ rec: jget(pkKey(s(d.id, 400))) });
      }
      case 'pk.save': {
        const id = s(d.id, 400), k = pkKey(id);
        if (!P.getProperty(k)) return E('Passkey không hợp lệ', true);
        P.setProperty(k, JSON.stringify(Object.assign({}, d.rec, { id }))); return R({});
      }
      case 'pk.add': {
        if (!chUse(d.c, 'reg')) return E('Phiên xác thực đã hết hạn, hãy thử lại', true);
        const id = s(d.id, 400), max = Number(d.max) || 10, js = JSON.stringify(Object.assign({}, d.rec, { id }));
        if (!id || js.length > 4000) return E('Passkey không hợp lệ', true);
        if (pkAll().length >= max && !P.getProperty(pkKey(id))) return E('Tối đa ' + max + ' passkey, hãy xóa bớt', true);
        P.setProperty(pkKey(id), js); return R({});
      }
      case 'pk.del': P.deleteProperty(pkKey(s(d.id, 400))); return R({});
      default: return E('Thao tác kv không hợp lệ: ' + op, false);
    }
  } finally { lock.releaseLock(); }
}