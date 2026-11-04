// Trung tâm đồng bộ 3 chiều:  Thiết bị  <->  Redis (Vercel/Upstash)  <->  Google Sheet
//  - Ghi giao dịch (tx.save / tx.del / tx.purge): lưu NGAY vào Redis + đẩy vào hàng đợi, trả lời trong vài chục ms.
//  - Hàng đợi được đẩy sang Google Sheet (Apps Script) ở nền: trong các lần thiết bị hỏi (poll), hoặc cron.
//  - Thay đổi sửa tay trực tiếp trên Google Sheet được kéo về Redis (tối đa ~15 giây/lần), rồi thiết bị lấy từ Redis.
//  - Request có thao tác khác (tài khoản, danh mục, hạn mức, phiên...) được chuyển thẳng sang Google Sheet như cũ.
// Cùng định dạng request/response với Apps Script nên app.js dùng như cũ, chỉ thêm trường "hub" (trạng thái đồng bộ).

const { APP_KEY, APP_API, APP_PASS, CRON_SECRET } = process.env;
const auth = require('./_auth');
const RU = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RT = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const P = 'stc:';
const TX = new Set(['tx.save', 'tx.del', 'tx.purge']);
const MISC = ['acc', 'cat', 'lim', 'trash', 'issues'];
const SESS_ERR = 'Phiên đã bị khóa vì có thiết bị khác đăng nhập';
const PULL_EVERY = 15000;          // tối thiểu giữa hai lần kéo dữ liệu từ Google Sheet
const BATCH = 20;                  // gộp tối đa 20 việc trong hàng đợi thành 1 lần gọi Apps Script (1 lần khóa + 1 lần tính lại)
let TOUCHED = false;                // request này đã gửi thao tác ghi sang Google Sheet chưa (để quyết định có được chuyển thẳng khi Redis lỗi)
let DL = 0;                        // hạn chót của request hiện tại (ms) — maxDuration 60s
const TRANSIENT = /chờ khóa|giữ khóa|lock|đang bận|busy|time(d)? ?out|quá tải|too many|tạm thời|temporar|unavailable|service invoked/i;

async function rd(cmds) {
  const r = await fetch(RU + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RT, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(JSON.stringify(j).slice(0, 200));
  const bad = j.find(x => x && x.error);
  if (bad) throw new Error(bad.error);
  return j.map(x => x.result);
}

async function sheet(body, ms) {
  if (body && body.ops && body.ops.length) TOUCHED = true;
  const left = DL ? DL - Date.now() : 1e9, lim = Math.min(ms || 25000, left);
  if (lim < 3000) return { ok: false, net: true, err: 'Hết thời gian xử lý, sẽ thử lại' };
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), lim);
  try {
    const r = await fetch(APP_API, { method: 'POST', signal: ac.signal, body: JSON.stringify(Object.assign({ key: APP_KEY }, body)) });
    return await r.json();
  } catch (e) {
    return { ok: false, net: true, err: e && e.name === 'AbortError' ? 'Google Sheet phản hồi quá chậm' : 'Không kết nối được Google Sheet' };
  } finally { clearTimeout(tm); }
}

const parse = s => { try { return JSON.parse(s); } catch (e) { return null; } };
const rowsOf = ops => ops.filter(x => x.op === 'tx.save' && x.row && x.row.id).map(x => x.row);
const delsOf = ops => ops.filter(x => (x.op === 'tx.del' || x.op === 'tx.purge') && x.id).map(x => x.id);
// Phủ hàng đợi lên bản đồ giao dịch theo ĐÚNG thứ tự từng thao tác. keepDel=true: xóa được ghi là null (để HDEL).
function overlay(q, tx, keepDel) {
  q.forEach(s => {
    const jb = parse(s); if (!jb || !Array.isArray(jb.ops)) return;
    jb.ops.forEach(x => {
      if (x.op === 'tx.save' && x.row && x.row.id) tx.set(x.row.id, x.row);
      else if ((x.op === 'tx.del' || x.op === 'tx.purge') && x.id) { if (keepDel) tx.set(x.id, null); else tx.delete(x.id); }
    });
  });
}

// ---- đọc trạng thái ----
async function readState() {
  const [h, m, rev] = await rd([['HVALS', P + 'tx'], ['GET', P + 'misc'], ['GET', P + 'rev']]);
  if (!m) return null;
  const misc = parse(m) || {};
  const st = { tx: (h || []).map(parse).filter(Boolean) };
  MISC.forEach(k => { st[k] = misc[k] || []; });
  return { st, rev: String(rev || '0') };
}
async function status() {
  const [q, pullAt, meta] = await rd([['LRANGE', P + 'q', 0, -1], ['GET', P + 'pullAt'], ['GET', P + 'meta']]);
  const ids = [];
  (q || []).forEach(s => { const j = parse(s); if (j) j.ops.forEach(x => { const id = x.row ? x.row.id : x.id; if (id) ids.push(id); }); });
  const m = parse(meta) || {};
  return { q: (q || []).length, ids: Array.from(new Set(ids)).slice(0, 500), pullAt: +pullAt || 0, err: m.err || '', dead: m.dead || 0, deadMsg: m.deadMsg || '' };
}
const setMeta = async patch => {
  const [old] = await rd([['GET', P + 'meta']]);
  await rd([['SET', P + 'meta', JSON.stringify(Object.assign(parse(old) || {}, patch))]]);
};

// ---- Khóa phiên đa thiết bị (phản chiếu logic sess.* của Apps Script) ----
const sessFail = () => ({ ok: false, sess: false, err: SESS_ERR });
async function sessBlocked(sid) {
  if (!sid) return false;               // Apps Script cũng bỏ qua kiểm tra khi không có sid
  const [al, bad] = await rd([['GET', P + 'sess'], ['SISMEMBER', P + 'bad', sid]]);
  if (+bad) return true;
  const a = parse(al);
  return Array.isArray(a) && a.indexOf(sid) < 0;
}
async function sessLost(sid) { if (sid) await rd([['SADD', P + 'bad', sid], ['EXPIRE', P + 'bad', '86400']]); return sessFail(); }
async function sessMirror(ops, sid) {
  if (!sid) return;
  const so = ops.filter(o => o && typeof o.op === 'string' && o.op.indexOf('sess.') === 0);
  for (const o of so) {
    if (o.op === 'sess.login') await rd([['SET', P + 'sess', JSON.stringify([sid])]]);
    else if (o.op === 'sess.join') {
      const a = parse((await rd([['GET', P + 'sess']]))[0]);
      if (Array.isArray(a)) await rd([['SET', P + 'sess', JSON.stringify(a.filter(x => x !== sid).concat(sid).slice(-2))]]);
    }
  }
  if (so.length) await rd([['SREM', P + 'bad', sid]]);
}

// ---- Google Sheet -> Redis (phủ lên các thay đổi còn trong hàng đợi để không bị mất) ----
async function pull(sid, force) {
  const [srev, last] = await rd([['GET', P + 'srev'], ['GET', P + 'pullAt']]);
  if (!force && srev && Date.now() - (+last || 0) < PULL_EVERY) return { skipped: true };
  const j = await sheet({ ops: [], rev: force ? '' : (srev || ''), sid });
  if (j.sess === false) { await sessLost(sid); return { sess: false }; }
  if (!j.ok) return { err: j.err || 'Lỗi Google Sheet', net: !!j.net };
  if (sid) await rd([['SET', P + 'sid', sid]]);
  await rd([['SET', P + 'pullAt', String(Date.now())]]);
  if (j.same) return { changed: false };
  // Không DEL cả hash (sẽ làm mất giao dịch vừa ghi nhanh xen giữa, và thiết bị khác thấy hash rỗng).
  // Thay bằng: HDEL những id không còn, HSET phần còn lại theo lô, rồi phủ lại hàng đợi một lần nữa để vá khe hở.
  const [q, old] = await rd([['LRANGE', P + 'q', 0, -1], ['HKEYS', P + 'tx']]);
  const tx = new Map((j.tx || []).map(t => [t.id, t]));
  overlay(q || [], tx);
  const misc = {}; MISC.forEach(k => { misc[k] = j[k] || []; });
  const gone = (old || []).filter(id => !tx.has(id)), flat = [];
  tx.forEach((v, id) => flat.push(id, JSON.stringify(v)));
  const cmds = [];
  for (let i = 0; i < gone.length; i += 400) cmds.push(['HDEL', P + 'tx'].concat(gone.slice(i, i + 400)));
  for (let i = 0; i < flat.length; i += 400) cmds.push(['HSET', P + 'tx'].concat(flat.slice(i, i + 400)));
  cmds.push(['SET', P + 'misc', JSON.stringify(misc)], ['SET', P + 'srev', String(j.rev || '')], ['INCR', P + 'rev']);
  await rd(cmds);
  // Vá: nếu có giao dịch ghi nhanh chen vào giữa lúc đọc hàng đợi và lúc ghi hash, phủ lại hàng đợi hiện tại
  const q2 = (await rd([['LRANGE', P + 'q', 0, -1]]))[0] || [];
  if (q2.length) {
    const fix = new Map(); overlay(q2, fix, true);
    const sets = [], dels = [];
    fix.forEach((v, id) => v ? sets.push(id, JSON.stringify(v)) : dels.push(id));
    const c2 = [];
    for (let i = 0; i < dels.length; i += 400) c2.push(['HDEL', P + 'tx'].concat(dels.slice(i, i + 400)));
    for (let i = 0; i < sets.length; i += 400) c2.push(['HSET', P + 'tx'].concat(sets.slice(i, i + 400)));
    if (c2.length) { c2.push(['INCR', P + 'rev']); await rd(c2); }
  }
  return { changed: true };
}

// ---- Redis -> Google Sheet (đẩy hàng đợi, gộp lô) ----
async function drain(sid) {
  const got = (await rd([['SET', P + 'lock', '1', 'NX', 'EX', '70']]))[0];
  if (got !== 'OK') return { busy: true };
  let hard = 0, lastMsg = '', bs = BATCH;
  try {
    while (DL - Date.now() > 8000) {
      const hs = (await rd([['LRANGE', P + 'q', 0, bs - 1]]))[0] || [];
      if (!hs.length) break;
      const jobs = hs.map(parse).filter(Boolean);
      const ops = jobs.reduce((a, jb) => a.concat(jb.ops), []);
      const j = await sheet({ ops, rev: '', fast: true, sid });
      if (j.sess === false) return await sessLost(sid);
      if (j.ok) { await rd([['LTRIM', P + 'q', String(hs.length), '-1']]); bs = BATCH; continue; }
      if (j.net || TRANSIENT.test(j.err || '')) { await setMeta({ err: j.err || 'Google Sheet đang bận' }); return { err: j.err }; }
      if (hs.length > 1) { bs = 1; continue; }     // lô bị từ chối: tách từng việc để tìm việc gây lỗi
      // Google Sheet từ chối thật sự (vd dữ liệu không hợp lệ): đưa sang "dead", không kẹt hàng đợi
      await rd([['LPOP', P + 'q'], ['RPUSH', P + 'dead', JSON.stringify(Object.assign({}, jobs[0] || {}, { err: j.err, at: Date.now() }))]]);
      hard++; lastMsg = j.err || ''; bs = BATCH;
    }
    const mm = parse((await rd([['GET', P + 'meta']]))[0]) || {};
    await rd([['SET', P + 'meta', JSON.stringify(Object.assign(mm, { err: '', dead: (mm.dead || 0) + hard, deadMsg: hard ? lastMsg : (mm.deadMsg || '') }))]]);
    if (hard) await pull(sid, true);
    return { ok: true };
  } finally { await rd([['DEL', P + 'lock']]).catch(() => { }); }
}

// ---- Chuyển thẳng sang Google Sheet (khi không có Redis, hoặc Redis lỗi trước khi ghi gì) ----
async function proxy(body) {
  const sid = typeof body.sid === 'string' ? body.sid.slice(0, 64) : '';
  return sheet({ ops: Array.isArray(body.ops) ? body.ops : [], rev: body.rev || '', fast: !!body.fast, sid }, 45000);
}

// ---- Đăng nhập: so mật khẩu ở server, giới hạn số lần thử sai ----
const FAIL_MAX = 5, FAIL_WIN = 900, ALL_MAX = 60, ALL_WIN = 3600;   // 5 lần sai / 15 phút / IP; 60 lần sai / giờ toàn hệ thống
const memFail = new Map();
const clientIp = req => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();
async function failWait(ip, has) {
  if (has) {
    try {
      const [a, b, ta, tb] = await rd([['GET', P + 'lf:' + ip], ['GET', P + 'lf:all'], ['TTL', P + 'lf:' + ip], ['TTL', P + 'lf:all']]);
      if (+a >= FAIL_MAX) return Math.max(+ta, 1);
      if (+b >= ALL_MAX) return Math.max(+tb, 1);
    } catch (e) { }
    return 0;
  }
  const m = memFail.get(ip);
  return m && m.exp > Date.now() && m.n >= FAIL_MAX ? Math.ceil((m.exp - Date.now()) / 1000) : 0;
}
async function failAdd(ip, has) {
  if (has) {
    try {
      const [a, b] = await rd([['INCR', P + 'lf:' + ip], ['INCR', P + 'lf:all']]), c = [];
      if (+a === 1) c.push(['EXPIRE', P + 'lf:' + ip, String(FAIL_WIN)]);
      if (+b === 1) c.push(['EXPIRE', P + 'lf:all', String(ALL_WIN)]);
      if (c.length) await rd(c);
    } catch (e) { }
    return;
  }
  const m = memFail.get(ip);
  if (m && m.exp > Date.now()) m.n++; else memFail.set(ip, { n: 1, exp: Date.now() + FAIL_WIN * 1000 });
}
async function doLogin(req, res, body, has) {
  const ip = clientIp(req), wait = await failWait(ip, has);
  if (wait) return res.status(429).json({ ok: false, wait, err: 'Thử sai quá nhiều lần' });
  if (!auth.secretOk(String(body.login || ''))) {
    await failAdd(ip, has);
    await new Promise(r => setTimeout(r, 500));
    return res.status(200).json({ ok: false, err: 'Sai mật khẩu' });
  }
  if (has) { try { await rd([['DEL', P + 'lf:' + ip]]); } catch (e) { } }
  res.setHeader('Set-Cookie', auth.cookie());
  return res.status(200).json({ ok: true });
}

function reply(res, state, hub, extra) {
  return res.status(200).json(Object.assign({ ok: true }, state.st, { rev: state.rev, hub }, extra || {}));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  DL = Date.now() + 52000; TOUCHED = false;
  if (!APP_API || !APP_KEY || !APP_PASS)
    return res.status(200).json({ ok: false, hubErr: true, err: 'Chưa cấu hình APP_API / APP_KEY / APP_PASS trên Vercel' });
  const HAS_REDIS = !!(RU && RT);   // không có Redis: chạy chế độ chuyển thẳng sang Google Sheet
  let body = null;
  try {
    // Cron của Vercel: chạy nền khi không có ai mở app
    if (req.method === 'GET') {
      if (!CRON_SECRET || !HAS_REDIS) return res.status(200).json({ ok: true, redis: HAS_REDIS, cron: false });   // kiểm tra nhanh
      if (req.headers.authorization !== 'Bearer ' + CRON_SECRET) return res.status(401).json({ ok: false, err: 'Unauthorized' });
      const sid = (await rd([['GET', P + 'sid']]))[0] || '';
      const d = await drain(sid); const p = await pull(sid, false);
      return res.status(200).json({ ok: true, drain: d, pull: p, hub: await status() });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, err: 'Method not allowed' });
    const sfs = req.headers['sec-fetch-site'];
    if (sfs && sfs !== 'same-origin' && sfs !== 'none') return res.status(403).json({ ok: false, err: 'Forbidden' });   // chặn gọi từ trang web khác
    body = typeof req.body === 'string' ? parse(req.body || '{}') || {} : (req.body || {});

    // Đăng nhập (chưa cần cookie)
    if (body.login !== undefined) return await doLogin(req, res, body, HAS_REDIS);
    // Mọi request còn lại phải có cookie hợp lệ
    if (!auth.ok(req)) return res.status(401).json({ ok: false, auth: true, err: 'Chưa đăng nhập hoặc phiên đã hết hạn' });

    // Tải ảnh: chuyển sang Apps Script (KEY nằm ở server)
    if (body.img) return res.status(200).json(await sheet({ img: body.img }, 45000));
    if (!HAS_REDIS) return res.status(200).json(await proxy(body));
    
    const ops = Array.isArray(body.ops) ? body.ops : [], sid = typeof body.sid === 'string' ? body.sid.slice(0, 64) : '';
    const isSess = o => o && typeof o.op === 'string' && o.op.indexOf('sess.') === 0;
    const hasAt = ops.some(o => o && ((o.row && String(o.row.id || '')[0] === '@') || String(o.id || '')[0] === '@'));   // ID theo vị trí dòng: phải xử lý ngay trên Sheet
    if (!ops.some(isSess) && await sessBlocked(sid)) return res.status(200).json(sessFail());

    // 0) Chỉ có thao tác phiên (đăng nhập / tham gia): chuyển thẳng, không cần kéo dữ liệu
    if (ops.length && ops.every(isSess)) {
      const j = await sheet({ ops, rev: '', sid }, 15000);
      if (j.ok && j.sess !== false) await sessMirror(ops, sid);
      return res.status(200).json(Object.assign({}, j, { hub: await status() }));
    }

    // 1) Chỉ có thao tác giao dịch: ghi vào Redis ngay, đẩy sang Sheet sau
    if (ops.length && !hasAt && ops.every(x => TX.has(x.op))) {
      if (!(await rd([['EXISTS', P + 'misc']]))[0]) {
        const p = await pull(sid, true);
        if (p.sess === false) return res.status(200).json(sessFail());
        if (p.err) return res.status(200).json({ ok: false, err: 'Máy chủ đang bận: ' + p.err });
      }
      const cmds = [];
      rowsOf(ops).forEach(r => cmds.push(['HSET', P + 'tx', r.id, JSON.stringify(r)]));
      delsOf(ops).forEach(id => cmds.push(['HDEL', P + 'tx', id]));
      cmds.push(['RPUSH', P + 'q', JSON.stringify({ t: Date.now(), ops })], ['INCR', P + 'rev']);
      await rd(cmds);
      return res.status(200).json({ ok: true, fast: true, hub: await status() });
    }

    // 2) Thao tác khác (tài khoản, danh mục, hạn mức, phiên...): đẩy hết hàng đợi trước để giữ đúng thứ tự, rồi chuyển thẳng sang Sheet
    if (ops.length) {
      const d = await drain(sid);
      if (d.sess === false) return res.status(200).json(sessFail());
      if (d.busy || d.err) return res.status(200).json({ ok: false, err: 'Máy chủ đang bận, đang đồng bộ hàng đợi', hub: await status() });
      const j = await sheet({ ops, rev: '', fast: !!body.fast, sid }, 45000);
      if (j.sess === false) { await sessLost(sid); return res.status(200).json(sessFail()); }
      if (!j.ok) return res.status(200).json(j);
      if (sid) await rd([['SET', P + 'sid', sid]]);
      await sessMirror(ops, sid);
      await pull(sid, true);
      const st = await readState();
      return reply(res, st || { st: j, rev: String(j.rev || '') }, await status(), { sess: j.sess });
    }

    // 3) Thiết bị hỏi (poll): đẩy hàng đợi nếu còn, kéo thay đổi từ Sheet nếu đã đến hạn, rồi trả về từ Redis
    let st = await readState();
    const sess = {};
    if (!st) { const p = await pull(sid, true); if (p.sess === false) return res.status(200).json(sessFail()); if (p.err) return res.status(200).json({ ok: false, err: p.err }); st = await readState(); }
    else {
      const hub0 = await status();
      if (hub0.q) { const d = await drain(sid); if (d.sess === false) return res.status(200).json(sessFail()); }
      const p = await pull(sid, !body.rev);     // rev rỗng = mở app / bấm làm mới: kéo ngay từ Google Sheet
      if (p.sess === false) return res.status(200).json(sessFail());
      st = await readState();
    }
    if (!st) return res.status(200).json({ ok: false, err: 'Chưa có dữ liệu trên Redis' });
    const hub = await status();
    if (body.rev && body.rev === st.rev) return res.status(200).json({ ok: true, same: true, rev: st.rev, hub });
    return reply(res, st, hub, sess);
  } catch (e) {
    // Redis lỗi trước khi ghi gì sang Sheet: chuyển thẳng sang Google Sheet như chế độ không có Redis
    if (body && body.login === undefined && !TOUCHED) { try { return res.status(200).json(await proxy(body)); } catch (e2) { } }
    return res.status(200).json({ ok: false, hubErr: true, err: 'Redis: ' + (e && e.message || e) });
  }
};
