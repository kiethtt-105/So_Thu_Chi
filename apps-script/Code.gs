/************************************************************
 * SỔ THU CHI — Code.gs (v5, đã gộp công thức + Số dư cuối)
 *
 * Hàm chính:
 *   dongBo(ops, rev)  : đồng bộ 2 CHIỀU (web ⇄ Gsheet)
 *   suaGsheet()       : sửa lại Gsheet (công thức, dữ liệu, ràng buộc, trigger)
 *   datTatCa_()       : ghi lại công thức chuẩn TaiKhoan + cột "Số dư cuối" + TongQuan
 *
 * Tab dữ liệu: GiaoDich, TaiKhoan, DanhMuc, HanMuc, DaXoa (+ _CongThuc là tab hệ thống)
 * TongQuan: chỉ bị ghi lại khi bạn bấm menu "Khôi phục công thức ngay".
 ************************************************************/

const VER = 'v5';
const FALLBACK_SHEET_ID = '10yJGQB7IalkqKE8b1nYu2YG78DOURNTtss7sPRbwmKE';
const TAB = { tx: 'GiaoDich', acc: 'TaiKhoan', cat: 'DanhMuc', lim: 'HanMuc', del: 'DaXoa', fx: '_CongThuc' };
const TYPES = ['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'];
const ACC_TYPES = ['Tiền mặt', 'Ngân hàng', 'Thẻ tín dụng', 'Ví điện tử', 'Tiết kiệm'];
const PERIODS = ['Ngày', 'Tháng'];
const MAX_ACC = 20, MAX_CAT = 99, MAX_LIM = 200;
const RED = '#fecaca', YEL = '#fef3c7';   // màu tô ô lỗi / ô cảnh báo
const SDC_HEAD = 'Số dư cuối';
// Công thức hỏng / bị "đóng băng" thành hằng số (=0, =#REF!, =#VALUE!...) KHÔNG bao giờ được lưu hay khôi phục làm bản chuẩn
const badFx = f => /#(REF|VALUE|ERROR|NAME|N\/A|DIV)/i.test(f) || /^=\s*-?\d+(\.\d+)?\s*$/.test(String(f));

// Vùng cột công thức script giữ cho đúng (công thức mẫu lấy từ tab _CongThuc).
const ZONES = [
  { sheet: 'GiaoDich', from: 11, key: 1 },
  { sheet: 'TaiKhoan', from: 4, key: 1, max: 21 },
  { sheet: 'DanhMuc', from: 4, key: 3, max: 100 }
  // , { sheet: 'TongQuan', cells: true }
];
const ARRAYISH = /ARRAYFORMULA|QUERY\(|FILTER\(|SORT\(|UNIQUE\(|SPLIT\(|IMPORTRANGE\(|SEQUENCE\(|MAP\(|BYROW\(/i;

/* ======================= TIỆN ÍCH ======================= */
const ss = () => SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(FALLBACK_SHEET_ID);
const tz = () => ss().getSpreadsheetTimeZone();
const opt = n => ss().getSheetByName(n);
const need = n => { const s = opt(n); if (!s) throw new Error('Thiếu tab "' + n + '" — vào menu Sổ Thu Chi → Sửa Gsheet'); return s; };
const str = v => v == null ? '' : String(v).trim();
const noAccent = s => str(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const fixType = v => TYPES.find(t => noAccent(t) === noAccent(v)) || null;
const fixPer = v => PERIODS.find(t => noAccent(t) === noAccent(v)) || null;
const day = d => Utilities.formatDate(d, tz(), 'yyyy-MM-dd');
const nowStr = () => Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd HH:mm:ss');
const hash = o => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(o)));
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const block = (s, rows, cols) => s.getRange(2, 1, Math.max(1, Math.min(rows, s.getMaxRows() - 1)), cols).getValues();
let _idN = 0;
const newId = () => 'G' + Date.now().toString(36) + (_idN++).toString(36) + Math.floor(Math.random() * 1296).toString(36);

// Trả null nếu không phải số (KHÔNG tự đổi thành 0 để không sinh tiền ảo)
function parseNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = str(v).replace(/[₫đ\s]/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^-?\d+[.,]\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s); return isFinite(n) ? n : null;
}
function parseDate(v) {
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = str(v); let y, m, d, x;
  if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) { d = +x[1]; m = +x[2]; y = +x[3]; }
  else return null;
  try {
    const dt = Utilities.parseDate(y + '-' + m + '-' + d, tz(), 'yyyy-M-d');
    return day(dt) === y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0') ? dt : null;
  } catch (e) { return null; }
}

/* ======================= WEB APP ======================= */
function doGet() { return out({ ok: true, name: 'So Thu Chi API', ver: VER }); }
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return out(dongBo(d.ops, d.rev));
  } catch (err) { return out({ ok: false, err: err.message || String(err) }); }
}

/* ===================================================================
 * HÀM 1 — ĐỒNG BỘ 2 CHIỀU
 * =================================================================== */
let _ctx = null;
function dongBo(ops, clientRev) {
  ops = Array.isArray(ops) ? ops : [];
  const cache = CacheService.getScriptCache();
  if (ops.length) {
    const lock = LockService.getScriptLock(); lock.waitLock(25000);
    try { _ctx = null; ops.forEach(applyOp); SpreadsheetApp.flush(); }
    finally { cache.remove('rev'); lock.releaseLock(); }
  }
  let rev = cache.get('rev'), state = null;
  if (!rev) { state = readAll(); rev = hash(state); cache.put('rev', rev, 15); }
  if (!ops.length && clientRev && clientRev === rev) return { ok: true, same: true, rev };
  return Object.assign({ ok: true, rev }, state || readAll());
}
function applyOp(o) {
  switch (o && o.op) {
    case 'tx.save': return saveTx(o.row);
    case 'tx.del': return delTx(o.id);
    case 'acc.save': _ctx = null; return saveAcc(o.acc, o.old);
    case 'acc.del': _ctx = null; return delAcc(o.name);
    case 'cat.save': _ctx = null; return saveCat(o.cat, o.old);
    case 'cat.del': _ctx = null; return delCat(o.cat);
    case 'lim.set': return setLim(o.per, o.cat, o.v);
    case 'restore': _ctx = null; return restore(o.at, o.kind);
    default: throw new Error('Thao tác không hợp lệ: ' + (o && o.op));
  }
}

/* ======================= ĐỌC DỮ LIỆU ======================= */
function readAll() {
  const issues = [], add = (sheet, rows) => rows.forEach(r => { if (r.P.length) issues.push({ sheet, row: r.n, lv: r.bad ? 'err' : 'warn', msg: r.P.map(p => p.msg).join('; ') }); });
  const A = accRows(), C = catRows(), ok = r => !r.empty && !r.bad;
  add(TAB.acc, A); add(TAB.cat, C);
  const ctx = makeCtx(A, C);
  const L = limRows(ctx.chiParents); add(TAB.lim, L);
  const tx = readTx(ctx, issues);
  return {
    ver: VER, tx,
    acc: A.filter(ok).map(r => r.item), cat: C.filter(ok).map(r => r.item),
    lim: L.filter(ok).map(r => r.item), trash: safe(readTrash, []),
    issues: issues.slice(0, 300)
  };
}
const safe = (f, d) => { try { return f(); } catch (e) { Logger.log(e); return d; } };

function makeCtx(A, C) {
  const a = A.filter(r => !r.empty && !r.bad), c = C.filter(r => !r.empty && !r.bad);
  return {
    acc: new Set(a.map(r => r.item.name)),
    cat: new Set(c.map(r => r.item.t + '|' + r.item.p + '|' + r.item.c)),
    chiParents: new Set(c.filter(r => r.item.t === 'Chi').map(r => r.item.p))
  };
}
function getCtx() { return _ctx || (_ctx = makeCtx(accRows(), catRows())); }

function readTx(ctx, issues) {
  const g = need(TAB.tx), n = g.getLastRow(); if (n < 2) return [];
  const V = g.getRange(2, 1, n - 1, 10).getValues(), res = [], seen = {};
  V.forEach((v, i) => {
    if (v.every(x => x === '')) return;
    const row = i + 2, o = txObj(v), P = txProblems(o, ctx), bad = P.some(p => p.lv === 'err');
    if (P.length) issues.push({ sheet: TAB.tx, row, lv: bad ? 'err' : 'warn', msg: P.map(p => p.msg).join('; ') });
    if (bad) return;
    let id = o.id; if (!id || seen[id]) id = '@' + row;
    seen[id] = 1;
    res.push({ id, date: day(parseDate(o.date)), type: fixType(o.type), amount: parseNum(o.amount), acc: o.acc, accTo: o.accTo, cat: o.cat, sub: o.sub, note: o.note, at: v[9] instanceof Date ? Utilities.formatDate(v[9], tz(), "yyyy-MM-dd'T'HH:mm:ss") : '' });
  });
  return res;
}
const txObj = v => ({ id: str(v[0]), date: v[1], type: str(v[2]), amount: v[3], acc: str(v[4]), accTo: str(v[5]), cat: str(v[6]), sub: str(v[7]), note: str(v[8]) });

/* ======================= RÀNG BUỘC LOGIC ======================= */
const P = (c, lv, msg) => ({ c, lv, msg });

function txProblems(r, ctx) {
  const L = [], type = fixType(r.type), amt = parseNum(r.amount);
  if (!type) L.push(P(3, 'err', 'Loại "' + r.type + '" không hợp lệ (chỉ: ' + TYPES.join(', ') + ')'));
  if (!parseDate(r.date)) L.push(P(2, 'err', 'Ngày không hợp lệ'));
  if (amt === null) L.push(P(4, 'err', 'Số tiền phải là số'));
  else if (type === 'Điều chỉnh' ? amt === 0 : amt <= 0) L.push(P(4, 'err', type === 'Điều chỉnh' ? 'Số tiền điều chỉnh phải khác 0' : 'Số tiền phải lớn hơn 0'));
  if (!r.acc) L.push(P(5, 'warn', 'Thiếu tài khoản'));
  else if (!ctx.acc.has(r.acc)) L.push(P(5, 'warn', 'Tài khoản "' + r.acc + '" không có trong tab TaiKhoan'));
  if (type === 'Chuyển khoản') {
    if (!r.accTo) L.push(P(6, 'warn', 'Chuyển khoản thiếu tài khoản nhận'));
    else if (!ctx.acc.has(r.accTo)) L.push(P(6, 'warn', 'Tài khoản nhận "' + r.accTo + '" không có trong tab TaiKhoan'));
    else if (r.accTo === r.acc) L.push(P(6, 'warn', 'Tài khoản nguồn và nhận trùng nhau'));
    if (r.cat || r.sub) L.push(P(7, 'warn', 'Chuyển khoản không có hạng mục'));
  } else if (type === 'Thu' || type === 'Chi') {
    if (r.accTo) L.push(P(6, 'warn', 'Chỉ Chuyển khoản mới có tài khoản nhận'));
    if (!r.cat || !r.sub) L.push(P(r.cat ? 8 : 7, 'warn', 'Thiếu hạng mục / chi tiết'));
    else if (!ctx.cat.has(type + '|' + r.cat + '|' + r.sub)) L.push(P(8, 'warn', 'Không có "' + r.cat + ' › ' + r.sub + '" trong DanhMuc (loại ' + type + ')'));
  } else if (type === 'Điều chỉnh') {
    if (r.accTo || r.cat || r.sub) L.push(P(r.accTo ? 6 : 7, 'warn', 'Điều chỉnh không có hạng mục / tài khoản nhận'));
  }
  return L;
}
function accP(v, dup) {
  const L = [], n = str(v[0]);
  if (!n) L.push(P(1, 'err', 'Thiếu tên tài khoản'));
  else if (dup) L.push(P(1, 'err', 'Trùng tên tài khoản "' + n + '"'));
  if (str(v[1]) && !ACC_TYPES.includes(str(v[1]))) L.push(P(2, 'warn', 'Loại tài khoản lạ: ' + str(v[1])));
  if (str(v[2]) !== '' && parseNum(v[2]) === null) L.push(P(3, 'err', 'Số dư ban đầu phải là số'));
  return L;
}
function catP(v, dup) {
  const L = [], t = str(v[0]), p = str(v[1]), c = str(v[2]);
  if (t !== 'Chi' && t !== 'Thu') L.push(P(1, 'err', 'Loại phải là Chi hoặc Thu'));
  if (!p) L.push(P(2, 'err', 'Thiếu hạng mục cha'));
  if (!c) L.push(P(3, 'err', 'Thiếu hạng mục con'));
  else if (dup) L.push(P(3, 'err', 'Trùng tên hạng mục con "' + c + '" (mỗi hạng mục con phải có tên riêng)'));
  return L;
}
function limP(v, dup, parents) {
  const L = [], per = fixPer(v[0]), cat = str(v[1]), val = parseNum(v[2]);
  if (!per) L.push(P(1, 'err', 'Kỳ phải là "Ngày" hoặc "Tháng"'));
  if (cat && !parents.has(cat)) L.push(P(2, 'warn', 'Hạng mục "' + cat + '" không có trong DanhMuc (loại Chi)'));
  if (val === null || val <= 0) L.push(P(3, 'err', 'Hạn mức phải là số lớn hơn 0'));
  else if (dup) L.push(P(3, 'err', 'Trùng hạn mức (cùng kỳ, cùng hạng mục) — chỉ dòng đầu có hiệu lực'));
  return L;
}

function accRows() {
  const V = block(need(TAB.acc), MAX_ACC, 3), seen = {};
  return V.map((v, i) => {
    const empty = v.every(x => x === ''), n = str(v[0]); if (n && !empty) seen[n] = (seen[n] || 0) + 1;
    const P_ = empty ? [] : accP(v, n && seen[n] > 1);
    return { n: i + 2, v, P: P_, empty, bad: P_.some(p => p.lv === 'err'), item: { name: n, type: str(v[1]), open: parseNum(v[2]) || 0 } };
  });
}
function catRows() {
  const V = block(need(TAB.cat), MAX_CAT, 3), seen = {};
  return V.map((v, i) => {
    const empty = v.every(x => x === ''), k = str(v[0]) + '|' + str(v[2]); if (str(v[2]) && !empty) seen[k] = (seen[k] || 0) + 1;
    const P_ = empty ? [] : catP(v, str(v[2]) && seen[k] > 1);
    return { n: i + 2, v, P: P_, empty, bad: P_.some(p => p.lv === 'err'), item: { t: str(v[0]), p: str(v[1]), c: str(v[2]) } };
  });
}
function limRows(parents) {
  const s = opt(TAB.lim); if (!s) return [];
  const V = block(s, MAX_LIM, 3), seen = {};
  return V.map((v, i) => {
    const empty = v.every(x => x === ''), per = fixPer(v[0]), k = per + '|' + str(v[1]); if (per && !empty) seen[k] = (seen[k] || 0) + 1;
    const P_ = empty ? [] : limP(v, per && seen[k] > 1, parents);
    return { n: i + 2, v, P: P_, empty, bad: P_.some(p => p.lv === 'err'), item: { per, cat: str(v[1]), v: parseNum(v[2]) || 0 } };
  });
}

/* ======================= GHI DỮ LIỆU TỪ WEB ======================= */
function findRow(id) {
  id = str(id); if (!id) return 0;
  const g = need(TAB.tx), n = g.getLastRow();
  if (id[0] === '@') { const r = +id.slice(1); return r >= 2 && r <= n ? r : 0; }
  if (n < 2) return 0;
  const i = g.getRange(2, 1, n - 1, 1).getValues().findIndex(x => str(x[0]) === id);
  return i < 0 ? 0 : i + 2;
}
function nextTxRow(g) {
  const n = g.getLastRow(); if (n < 2) return 2;
  const V = g.getRange(2, 1, n - 1, 9).getValues(); let last = 1;
  for (let i = V.length - 1; i >= 0; i--) if (V[i].some(x => x !== '')) { last = i + 2; break; }
  if (last + 1 > g.getMaxRows()) g.insertRowsAfter(g.getMaxRows(), 50);
  return last + 1;
}
function saveTx(r) {
  const o = { id: str(r.id), date: r.date, type: fixType(r.type) || str(r.type), amount: r.amount, acc: str(r.acc), accTo: str(r.accTo), cat: str(r.cat), sub: str(r.sub), note: str(r.note) };
  if (o.type === 'Chuyển khoản') o.cat = o.sub = ''; else if (o.type === 'Điều chỉnh') o.cat = o.sub = o.accTo = ''; else o.accTo = '';
  const P_ = txProblems(o, getCtx()); if (P_.length) throw new Error(P_[0].msg);
  const g = need(TAB.tx); let row = findRow(o.id);
  if (!o.id || o.id[0] === '@') o.id = newId();
  const arr = [o.id, parseDate(o.date), o.type, parseNum(o.amount), o.acc, o.accTo, o.cat, o.sub, o.note];
  if (row) g.getRange(row, 1, 1, 9).setValues([arr]);
  else { row = nextTxRow(g); g.getRange(row, 1, 1, 10).setValues([arr.concat([new Date()])]); }
  clearFlags(g, row, 9);
  safe(() => sdcRow(g, row), null);   // công thức "Số dư cuối" cho dòng mới
}
/* Xóa dòng an toàn: dòng đang bị BỘ LỌC ẩn thì deleteRow() không xóa được (hoặc xóa hụt) → gỡ bộ lọc, xóa, dựng lại bộ lọc cũ. */
function deleteRowSafe_(g, row) {
  const f = g.getFilter(); let keep = null;
  if (f) {
    const r = f.getRange(), c0 = r.getColumn(), nc = r.getNumColumns(), cr = {};
    for (let c = c0; c < c0 + nc; c++) { const k = f.getColumnFilterCriteria(c); if (k) cr[c] = k; }
    keep = { r1: r.getRow(), c0, nr: r.getNumRows(), nc, cr };
    f.remove();
  }
  try { g.deleteRow(row); }
  finally {
    if (keep) {
      const nr = Math.max(1, keep.nr - (row >= keep.r1 && row < keep.r1 + keep.nr ? 1 : 0)), nf = g.getRange(keep.r1, keep.c0, nr, keep.nc).createFilter();
      Object.keys(keep.cr).forEach(c => { try { nf.setColumnFilterCriteria(+c, keep.cr[c]); } catch (x) {} });
    }
  }
}
function delTx(id) {
  const row = findRow(id); if (!row) return;
  const g = need(TAB.tx), vals = g.getRange(row, 1, 1, 9).getValues()[0];
  deleteRowSafe_(g, row); SpreadsheetApp.flush();
  const again = findRow(id);
  if (again && again === row && str(g.getRange(row, 1).getValue()) === str(id)) throw new Error('Không xóa được dòng ' + row + ' trong GiaoDich (kiểm tra bộ lọc / vùng được bảo vệ).');
  arch(vals, 'gd');   // chỉ lưu Thùng rác SAU KHI đã xóa được → không bị đếm trùng
}
function rewriteTx(col, ncols, fn) {
  const g = need(TAB.tx), n = g.getLastRow(); if (n < 2) return 0;
  const rg = g.getRange(2, col, n - 1, ncols), V = rg.getValues(), T = g.getRange(2, 3, n - 1, 1).getValues(); let k = 0;
  const R = V.map((v, i) => { const w = fn(v, str(T[i][0])); if (w) { k++; return w; } return v; });
  if (k) rg.setValues(R); return k;
}
const renameTx = (cols, from, to) => cols.reduce((k, c) => k + rewriteTx(c, 1, v => str(v[0]) === from ? [to] : null), 0);
const usesAcc = name => { const g = need(TAB.tx), n = g.getLastRow(); return n > 1 && g.getRange(2, 5, n - 1, 2).getValues().some(r => str(r[0]) === name || str(r[1]) === name); };
const usesCat = (t, p, c) => { const g = need(TAB.tx), n = g.getLastRow(); return n > 1 && g.getRange(2, 3, n - 1, 6).getValues().some(r => str(r[0]) === t && str(r[4]) === p && str(r[5]) === c); };
const renameCat = (t, p, c, np, nc) => rewriteTx(7, 2, (v, ty) => ty === t && str(v[0]) === p && str(v[1]) === c ? [np, nc] : null);
function renameLimCat(from, to) {
  const s = opt(TAB.lim), n = s ? s.getLastRow() : 0; if (n < 2) return;
  const rg = s.getRange(2, 2, n - 1, 1), V = rg.getValues(); rg.setValues(V.map(v => [str(v[0]) === from ? to : v[0]]));
}

function saveAcc(a, old) {
  const name = str(a.name), type = str(a.type);
  if (!name) throw new Error('Thiếu tên tài khoản');
  if (type && !ACC_TYPES.includes(type)) throw new Error('Loại tài khoản phải là: ' + ACC_TYPES.join(', '));
  const open = a.open === '' || a.open == null ? 0 : parseNum(a.open);
  if (open === null) throw new Error('Số dư ban đầu phải là số');
  const s = need(TAB.acc), V = block(s, MAX_ACC, 3), i = V.findIndex(v => str(v[0]) === (old || name)), dup = V.findIndex(v => str(v[0]) === name);
  if (!old && i >= 0) throw new Error('Tài khoản "' + name + '" đã tồn tại');
  if (old && i < 0) throw new Error('Không tìm thấy tài khoản "' + old + '"');
  if (old && name !== old && dup >= 0) throw new Error('Tên "' + name + '" đã được dùng');
  let row = i + 2;
  if (i < 0) { const e = V.findIndex(v => v.every(x => x === '')); if (e < 0) throw new Error('Đã đủ ' + MAX_ACC + ' tài khoản (giới hạn của bảng)'); row = e + 2; }
  s.getRange(row, 1, 1, 3).setValues([[name, type, open]]);
  if (old && old !== name) renameTx([5, 6], old, name);
  clearFlags(s, row, 3);
}
function delAcc(name) {
  if (usesAcc(name)) throw new Error('Tài khoản đang có giao dịch, không thể xóa');
  const s = need(TAB.acc), V = block(s, MAX_ACC, 3), i = V.findIndex(v => str(v[0]) === name); if (i < 0) return;
  arch([name, '', V[i][1], V[i][2]], 'tk'); s.getRange(i + 2, 1, 1, 3).clearContent();
}
function saveCat(c, old) {
  const t = str(c.t), p = str(c.p), n = str(c.c);
  if (t !== 'Chi' && t !== 'Thu') throw new Error('Loại phải là Chi hoặc Thu');
  if (!p || !n) throw new Error('Thiếu hạng mục cha hoặc hạng mục con');
  const s = need(TAB.cat), V = block(s, MAX_CAT, 3), same = (v, x) => str(v[0]) === x.t && str(v[1]) === x.p && str(v[2]) === x.c;
  const i = old ? V.findIndex(v => same(v, old)) : -1;
  if (old && i < 0) throw new Error('Không tìm thấy hạng mục cần sửa');
  if (V.some((v, k) => k !== i && str(v[0]) === t && str(v[2]) === n)) throw new Error('Đã có hạng mục con "' + n + '" (mỗi hạng mục con phải có tên riêng)');
  if (old && old.t !== t && usesCat(old.t, old.p, old.c)) throw new Error('Hạng mục đang có giao dịch, không đổi loại Chi/Thu được');
  let row = i + 2;
  if (i < 0) { const e = V.findIndex(v => v.every(x => x === '')); if (e < 0) throw new Error('Đã đủ ' + MAX_CAT + ' hạng mục (giới hạn của bảng)'); row = e + 2; }
  s.getRange(row, 1, 1, 3).setValues([[t, p, n]]);
  if (old && (old.p !== p || old.c !== n)) {
    renameCat(t, old.p, old.c, p, n);
    if (old.p !== p && !V.some((v, k) => k !== i && str(v[0]) === 'Chi' && str(v[1]) === old.p)) renameLimCat(old.p, p);
  }
  clearFlags(s, row, 3);
}
function delCat(c) {
  if (usesCat(c.t, c.p, c.c)) throw new Error('Hạng mục đang có giao dịch, không thể xóa');
  const s = need(TAB.cat), V = block(s, MAX_CAT, 3), i = V.findIndex(v => str(v[0]) === c.t && str(v[1]) === c.p && str(v[2]) === c.c); if (i < 0) return;
  arch(['', '', c.t, '', '', '', c.p, c.c], 'dm'); s.getRange(i + 2, 1, 1, 3).clearContent();
}

/* ---- HẠN MỨC: HanMuc!A=Kỳ (Ngày|Tháng), B=Hạng mục cha (trống = tổng chi), C=Hạn mức ---- */
function limSheet() {
  let s = opt(TAB.lim);
  if (!s) { s = ss().insertSheet(TAB.lim); }
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 4).setValues([['Kỳ', 'Hạng mục (trống = tổng chi)', 'Hạn mức (₫)', 'Ghi chú']]).setFontWeight('bold').setBackground('#5B3DF5').setFontColor('#ffffff');
    s.setFrozenRows(1); s.setColumnWidths(1, 4, 150);
    s.getRange('A1').setNote('Ngày = hạn mức chi mỗi ngày. Tháng = hạn mức chi mỗi tháng.\nHạng mục để trống = tổng chi tất cả hạng mục.\nChỉ tính giao dịch loại Chi; hạng mục theo hạng mục CHA.');
  }
  return s;
}
function setLim(per, cat, v) {
  per = fixPer(per); cat = str(cat); v = parseNum(v);
  if (!per) throw new Error('Kỳ phải là Ngày hoặc Tháng');
  if (v === null || v < 0) throw new Error('Hạn mức phải là số từ 0 trở lên');
  if (cat && !getCtx().chiParents.has(cat)) throw new Error('Hạng mục "' + cat + '" không có trong DanhMuc (loại Chi)');
  const s = limSheet(), n = s.getLastRow(), V = n > 1 ? s.getRange(2, 1, n - 1, 3).getValues() : [];
  const i = V.findIndex(r => fixPer(r[0]) === per && str(r[1]) === cat);
  if (v === 0) { if (i >= 0) s.deleteRow(i + 2); return; }
  let row = i + 2;
  if (i < 0) { const e = V.findIndex(r => r.every(x => x === '')); row = e >= 0 ? e + 2 : n + 1; if (row - 1 > MAX_LIM) throw new Error('Đã đủ ' + MAX_LIM + ' hạn mức'); }
  s.getRange(row, 1, 1, 3).setValues([[per, cat, v]]);
  s.getRange(row, 3).setNumberFormat('#,##0'); clearFlags(s, row, 3);
}

/* ---- THÙNG RÁC (tab DaXoa) ---- */
function dx() {
  let s = opt(TAB.del) || ss().insertSheet(TAB.del);
  if (s.getLastRow() === 0) { s.appendRow(['ID/Tên', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Đến TK', 'Hạng mục', 'Chi tiết', 'Ghi chú', 'Xóa lúc', 'Nhóm', 'Khôi phục lúc']); s.setFrozenRows(1); }
  return s;
}
function arch(a, kind) { const r = a.slice(0, 9); while (r.length < 9) r.push(''); dx().appendRow(r.concat([nowStr(), kind, ''])); }
function readTrash() {
  const s = opt(TAB.del); if (!s || s.getLastRow() < 2) return [];
  return s.getDataRange().getValues().slice(1).filter(r => r[9] && r[11] === '').slice(-300).reverse()
    .map(r => ({ at: String(r[9]), k: r[10], id: String(r[0]), date: r[1] instanceof Date ? day(r[1]) : str(r[1]).slice(0, 10), type: r[2], amount: parseNum(r[3]) || 0, acc: r[4], accTo: r[5], cat: r[6], sub: r[7], note: r[8] }));
}
function restore(at, kind) {
  const d = dx(), v = d.getDataRange().getValues(), i = v.findIndex((r, k) => k > 0 && String(r[9]) === at && r[10] === kind && r[11] === '');
  if (i < 0) throw new Error('Không tìm thấy mục đã xóa');
  const r = v[i];
  if (kind === 'gd') { const g = need(TAB.tx); if (!findRow(r[0])) { const row = nextTxRow(g); g.getRange(row, 1, 1, 10).setValues([r.slice(0, 9).concat([new Date()])]); safe(() => sdcRow(g, row), null); } }
  else if (kind === 'tk') saveAcc({ name: r[0], type: r[2], open: r[3] });
  else if (kind === 'dm') saveCat({ t: r[2], p: r[6], c: r[7] });
  d.getRange(i + 1, 12).setValue(nowStr());
}

/* ======================= TÔ LỖI TRÊN GSHEET ======================= */
function clearFlags(s, row, ncols) {
  const rg = s.getRange(row, 1, 1, ncols), B = rg.getBackgrounds()[0];
  B.forEach((b, c) => { b = String(b).toLowerCase(); if (b === RED || b === YEL) s.getRange(row, c + 1).setBackground(null).setNote(''); });
}
function applyFlags(s, rows, ncols) {
  if (!rows.length) return;
  const first = rows[0].n, rg = s.getRange(first, 1, rows.length, ncols), B = rg.getBackgrounds(), N = rg.getNotes();
  rows.forEach((r, i) => {
    const want = {};
    r.P.forEach(p => { const w = want[p.c] || (want[p.c] = { lv: p.lv, msg: '' }); w.msg += (w.msg ? '; ' : '') + p.msg; if (p.lv === 'err') w.lv = 'err'; });
    for (let c = 1; c <= ncols; c++) {
      const w = want[c], bg = String(B[i][c - 1]).toLowerCase(), cell = () => s.getRange(first + i, c);
      if (w) { const col = w.lv === 'err' ? RED : YEL; if (bg !== col) cell().setBackground(col); if (N[i][c - 1] !== w.msg) cell().setNote(w.msg); }
      else if (bg === RED || bg === YEL) cell().setBackground(null).setNote('');
    }
  });
}
function flagTx(first, last, ctx) {
  const g = need(TAB.tx); last = Math.min(last, g.getLastRow()); if (last < first) return [];
  const V = g.getRange(first, 1, last - first + 1, 9).getValues(), rows = V.map((v, i) => ({ n: first + i, P: v.every(x => x === '') ? [] : txProblems(txObj(v), ctx) }));
  applyFlags(g, rows, 9); return rows.filter(r => r.P.length);
}
function revalidateAll() {
  const A = accRows(), C = catRows(), ctx = makeCtx(A, C), L = limRows(ctx.chiParents);
  applyFlags(need(TAB.acc), A, 3); applyFlags(need(TAB.cat), C, 3);
  if (opt(TAB.lim) && L.length) applyFlags(opt(TAB.lim), L, 3);
  const T = flagTx(2, need(TAB.tx).getLastRow(), ctx), all = T.concat(A, C, L).filter(r => r.P.length);
  return { err: all.filter(r => r.P.some(p => p.lv === 'err')).length, warn: all.filter(r => !r.P.some(p => p.lv === 'err')).length };
}

/* Xóa / chèn / sắp xếp dòng, đổi cột trong Gsheet KHÔNG bắn onEdit → dùng onChange để web thấy ngay */
function onChangeInstalled(e) { try { CacheService.getScriptCache().remove('rev'); } catch (x) {} }

/* ======================= SỬA TAY TRÊN GSHEET → BÁO LỖI NGAY ======================= */
function onEditInstalled(e) {
  if (!e || !e.range) return;
  const s = e.range.getSheet(), name = s.getName();
  if (![TAB.tx, TAB.acc, TAB.cat, TAB.lim].includes(name)) return;
  CacheService.getScriptCache().remove('rev');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(8000)) return;
  const msgs = [];
  try {
    const r = e.range, first = Math.max(r.getRow(), 2), last = r.getRow() + r.getNumRows() - 1;
    if (last < 2) return;
    if (name === TAB.tx) {
      if (r.getColumn() > 10) return;
      normalizeTx(first, Math.min(last, first + 499));
      flagTx(first, Math.min(last, first + 499), getCtx()).forEach(x => msgs.push('Dòng ' + x.n + ': ' + x.P.map(p => p.msg).join('; ')));
    } else {
      guardMaster(e, name, msgs);
      _ctx = null;
      const A = accRows(), C = catRows(), ctx = makeCtx(A, C), L = limRows(ctx.chiParents);
      applyFlags(need(TAB.acc), A, 3); applyFlags(need(TAB.cat), C, 3); if (opt(TAB.lim) && L.length) applyFlags(opt(TAB.lim), L, 3);
      const sel = { [TAB.acc]: A, [TAB.cat]: C, [TAB.lim]: L }[name] || [];
      sel.filter(x => x.n >= first && x.n <= last && x.P.length).forEach(x => msgs.push('Dòng ' + x.n + ': ' + x.P.map(p => p.msg).join('; ')));
    }
  } finally { lock.releaseLock(); }
  if (msgs.length) ss().toast(msgs.slice(0, 4).join('\n'), 'Sổ Thu Chi · ' + name, 15);
}
function guardMaster(e, name, msgs) {
  const r = e.range; if (r.getNumRows() !== 1 || r.getNumColumns() !== 1 || r.getRow() < 2) return;
  const col = r.getColumn(), row = r.getRow(), nv = str(r.getValue()), ov = e.oldValue === undefined ? '' : str(e.oldValue);
  if (ov === nv || !ov) return;
  const back = m => { r.setValue(ov); msgs.push(m); };
  if (name === TAB.acc && col === 1) {
    if (!nv) { if (usesAcc(ov)) back('Tài khoản "' + ov + '" đang có giao dịch — không xóa được, đã hoàn tác'); }
    else if (block(need(TAB.acc), MAX_ACC, 1).some((v, i) => i + 2 !== row && str(v[0]) === nv)) back('Tên tài khoản "' + nv + '" đã tồn tại — đã hoàn tác');
    else { const k = renameTx([5, 6], ov, nv); if (k) msgs.push('Đã đổi tên tài khoản "' + ov + '" → "' + nv + '" trong ' + k + ' ô của GiaoDich'); }
  } else if (name === TAB.cat && col <= 3) {
    const V = block(need(TAB.cat), MAX_CAT, 3), cur = V[row - 2].map(str), old = cur.slice(); old[col - 1] = ov;
    if (!nv) { if (usesCat(old[0], old[1], old[2])) back('Hạng mục "' + old[1] + ' › ' + old[2] + '" đang có giao dịch — không xóa được, đã hoàn tác'); }
    else if (col === 1) { if (usesCat(old[0], old[1], old[2])) back('Hạng mục đang có giao dịch — không đổi loại Chi/Thu được, đã hoàn tác'); }
    else if (col === 3 && V.some((v, i) => i + 2 !== row && str(v[0]) === cur[0] && str(v[2]) === nv)) back('Đã có hạng mục con "' + nv + '" — đã hoàn tác');
    else {
      const k = renameCat(old[0], old[1], old[2], cur[1], cur[2]); if (k) msgs.push('Đã đổi hạng mục trong ' + k + ' giao dịch');
      if (col === 2 && !V.some((v, i) => i + 2 !== row && str(v[0]) === 'Chi' && str(v[1]) === ov)) renameLimCat(ov, nv);
    }
  }
}

/* ===================================================================
 * HÀM 2 — SỬA LẠI GSHEET
 *  1) tạo tab hệ thống còn thiếu  2) khôi phục công thức  3) chuẩn hóa GiaoDich
 *  4) ràng buộc nhập liệu + tô lỗi  5) trigger
 *  silent = true (trigger 10 phút): chỉ khôi phục từ bản chuẩn, KHÔNG ghi đè công thức
 * =================================================================== */
function suaGsheet(silent) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const L = [];
  try {
    ensureSystemTabs(L);
    const f = healFormulas(); L.push(f.first ? '• Công thức: lần đầu — đã lưu công thức hiện tại làm chuẩn (' + f.saved + ' vùng)' : '• Công thức: đã khôi phục ' + f.fixed + ' ô/dòng');
    if (!silent) L.push(datTatCa_());
    const n = normalizeTx(2, need(TAB.tx).getLastRow()); L.push('• Chuẩn hóa GiaoDich: sửa ' + n + ' ô (ID / ngày / loại / số tiền)');
    if (!silent) { applyValidation(); installTriggers(); L.push('• Đã cài ràng buộc nhập liệu và trigger tự động'); }
    const v = revalidateAll(); L.push('• Kiểm tra dữ liệu: ' + v.err + ' dòng LỖI (đỏ, không tính vào số liệu), ' + v.warn + ' dòng cảnh báo (vàng)');
    CacheService.getScriptCache().remove('rev'); SpreadsheetApp.flush();
    return { ok: true, text: L.join('\n') };
  } finally { lock.releaseLock(); }
}
function tuSua() { suaGsheet(true); }   // trigger 10 phút

function ensureSystemTabs(L) {
  if (!opt(TAB.lim)) { limSheet(); L.push('• Đã tạo tab HanMuc'); }
  if (!opt(TAB.del)) { dx(); L.push('• Đã tạo tab DaXoa'); }
  if (!opt(TAB.fx)) { const s = ss().insertSheet(TAB.fx); s.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']); s.hideSheet(); L.push('• Đã tạo tab ẩn _CongThuc'); }
}

/* ---- Công thức: bản chuẩn lưu ở tab _CongThuc ---- */
function fxSheet() { return opt(TAB.fx) || (function () { const s = ss().insertSheet(TAB.fx); s.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']); s.hideSheet(); return s; })(); }
function saveFormulas() {
  const st = fxSheet(); st.clear(); st.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']);
  const rows = [];
  ZONES.forEach(z => {
    const s = opt(z.sheet); if (!s) return;
    const lr = s.getLastRow(), lc = s.getLastColumn(); if (!lr || !lc) return;
    if (z.cells) {
      s.getRange(1, 1, lr, lc).getFormulasR1C1().forEach((r, i) => r.forEach((x, j) => { if (x && !badFx(x)) rows.push([z.sheet, 'cell', s.getRange(i + 1, j + 1).getA1Notation(), x]); }));
      return;
    }
    if (lc < z.from) return;
    const f = s.getRange(1, z.from, lr, lc - z.from + 1).getFormulasR1C1();
    for (let c = 0; c < f[0].length; c++) {
      const col = f.map(r => r[c]), first = col.findIndex((x, i) => i > 0 && x);
      if (first < 0 || badFx(col[first])) continue;        // không lưu công thức đã hỏng làm chuẩn
      rows.push([z.sheet, ARRAYISH.test(col[first]) ? 'array' : 'fill', (z.from + c) + ':' + (first + 1), col[first]]);
    }
  });
  if (rows.length) st.getRange(2, 1, rows.length, 4).setValues(rows);
  return rows.length;
}
function healFormulas() {
  const st = fxSheet(); let t = st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 4).getValues() : [];
  if (!t.some(r => ZONES.some(z => z.sheet === r[0]))) return { first: true, saved: saveFormulas(), fixed: 0 };
  let fixed = 0;
  t.forEach(([sn, mode, key, f1]) => {
    if (badFx(f1)) return;                                            // bản chuẩn hỏng (=0, #REF!...): bỏ qua
    try {
      const z = ZONES.find(x => x.sheet === sn), s = opt(sn); if (!z || !s) return;
      if (mode === 'cell') { const r = s.getRange(key); if (r.getFormulaR1C1() !== f1) { r.setFormulaR1C1(f1); fixed++; } return; }
      const [c, top] = String(key).split(':').map(Number), lr = s.getLastRow(); if (lr < top) return;
      if (mode === 'array') {
        const a = s.getRange(top, c);
        if (a.getFormulaR1C1() !== f1) { if (lr > top) s.getRange(top + 1, c, lr - top, 1).clearContent(); a.setFormulaR1C1(f1); fixed++; }
        else if (String(a.getDisplayValue()).indexOf('#REF') === 0 && lr > top) { s.getRange(top + 1, c, lr - top, 1).clearContent(); fixed++; }
      } else {
        const keys = s.getRange(1, z.key, lr, 1).getValues(), cur = s.getRange(1, c, lr, 1).getFormulasR1C1(), end = Math.min(lr, z.max || lr), runs = [];
        let run = null;
        for (let i = top - 1; i < end; i++) {
          if (str(keys[i][0]) !== '' && cur[i][0] !== f1) { if (run) run[1] = i + 1; else run = [i + 1, i + 1]; }
          else if (run) { runs.push(run); run = null; }
        }
        if (run) runs.push(run);
        runs.forEach(([a, b]) => { s.getRange(a, c, b - a + 1, 1).setFormulaR1C1(f1); fixed += b - a + 1; });
      }
    } catch (er) { Logger.log('Công thức ' + sn + ': ' + er); }
  });
  return { first: false, fixed };
}

/* ---- Công thức chuẩn viết sẵn trong code (dùng CỘT MỞ → xóa/chèn dòng không gây #REF!) ---- */
function fxTaiKhoanRow_(r) {
  const S = (type, col) => '=IF($A' + r + '="","",SUMIFS(GiaoDich!$D:$D,GiaoDich!$C:$C,"' + type + '",GiaoDich!$' + col + ':$' + col + ',$A' + r + '))';
  return [
    S('Thu', 'E'),               // D  Thu
    S('Chi', 'E'),               // E  Chi
    S('Chuyển khoản', 'F'),      // F  Chuyển vào (tài khoản đến = cột F)
    S('Chuyển khoản', 'E'),      // G  Chuyển ra  (tài khoản đi = cột E)
    S('Điều chỉnh', 'E'),        // H  Điều chỉnh
    '=IF($A' + r + '="","",C' + r + '+D' + r + '-E' + r + '+F' + r + '-G' + r + '+H' + r + ')'   // I  Số dư hiện tại
  ];
}
// TaiKhoan: ghi công thức cho CẢ 20 dòng (dòng trống tự hiện rỗng) → thêm tài khoản mới là có số liệu ngay
function datCongThucTaiKhoan_() {
  const a = need(TAB.acc), F = []; let n = 0;
  for (let r = 2; r <= 21; r++) F.push(fxTaiKhoanRow_(r));
  a.getRange(2, 4, 20, 6).setFormulas(F);
  a.getRange(2, 1, 20, 1).getValues().forEach(v => { if (str(v[0])) n++; });
  a.getRange(22, 3, 1, 7).setFormulas([['C', 'D', 'E', 'F', 'G', 'H', 'I'].map(c => '=SUM(' + c + '2:' + c + '21)')]);   // hàng 22 = TỔNG
  const T = t => 'SUMIFS(GiaoDich!$D:$D,GiaoDich!$C:$C,"' + t + '")';                                                  // hàng 24 = đối chiếu (phải = 0)
  a.getRange(24, 4, 1, 6).setFormulas([[
    '=' + T('Thu') + '-D22', '=' + T('Chi') + '-E22', '=' + T('Chuyển khoản') + '-F22',
    '=' + T('Chuyển khoản') + '-G22', '=' + T('Điều chỉnh') + '-H22', '=I22-(C22+D22-E22+F22-G22+H22)'
  ]]);
  return n;
}
// DanhMuc!D = số tiền tháng đang xem (tháng chọn ở TongQuan!B3:B4) của từng hạng mục con
function datDanhMuc_() {
  const s = opt(TAB.cat); if (!s) return 0;
  const last = Math.min(101, s.getMaxRows()), F = [];
  for (let r = 2; r <= last; r++) F.push(['=IF(C' + r + '="","",SUMIFS(GiaoDich!$D:$D,GiaoDich!$C:$C,A' + r + ',GiaoDich!$H:$H,C' + r + ',GiaoDich!$B:$B,">="&TongQuan!$B$6,GiaoDich!$B:$B,"<"&TongQuan!$B$7))']);
  s.getRange(2, 4, last - 1, 1).setFormulas(F);
  return last - 1;
}

/* ---- Cột "Số dư cuối" ở GiaoDich ---- */
function sdcCol_(g) {
  const lc = g.getLastColumn(); if (lc < 1) return 0;
  return g.getRange(1, 1, 1, lc).getValues()[0].findIndex(h => str(h) === SDC_HEAD) + 1;
}
// = số dư đầu kỳ + ảnh hưởng của mọi giao dịch xảy ra trước (hoặc đúng) dòng r.
// Thứ tự: Ngày (B) rồi đến giờ của "Tạo lúc" (J); trùng giờ thì theo vị trí dòng. Không phụ thuộc thứ tự dòng trong sheet.
function sdcFormula_(r) {
  const N = 1000, R = c => '$' + c + '$2:$' + c + '$' + N;
  const key = '(' + R('B') + '+MOD(' + R('J') + ',1))', me = '($B' + r + '+MOD($J' + r + ',1))';
  const cond = '((' + key + '<' + me + ')+(' + key + '=' + me + ')*(ROW(' + R('B') + ')<=' + r + '))';
  const C = R('C'), D = R('D');
  const sign = '((' + C + '="Thu")-(' + C + '="Chi")+(' + C + '="Điều chỉnh")-(' + C + '="Chuyển khoản"))';
  const body = '(' + R('E') + '=$E' + r + ')*' + sign + '*' + D + '+(' + R('F') + '=$E' + r + ')*(' + C + '="Chuyển khoản")*' + D;
  return '=IF(OR($A' + r + '="",NOT(ISNUMBER($B' + r + ')),$E' + r + '=""),"",' +
    'IFERROR(VLOOKUP($E' + r + ',TaiKhoan!$A$2:$C$21,3,FALSE),0)+SUMPRODUCT(' + cond + '*(' + body + ')))';
}
function sdcRow(g, row) { const c = sdcCol_(g); if (c) g.getRange(row, c).setFormula(sdcFormula_(row)); }
function datSoDuCuoi_() {
  const g = need(TAB.tx); let c = sdcCol_(g);
  if (!c) {
    c = Math.max(g.getLastColumn() + 1, 11);                      // luôn nằm sau cột J
    if (g.getMaxColumns() < c) g.insertColumnsAfter(g.getMaxColumns(), c - g.getMaxColumns());
    g.getRange(1, 10).copyTo(g.getRange(1, c), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    g.getRange(1, c).setValue(SDC_HEAD).setNote('Số dư của tài khoản (cột Tài khoản) ngay sau giao dịch này.\nChuyển khoản: số dư của tài khoản nguồn.');
    g.setColumnWidth(c, 120);
  }
  const lr = g.getLastRow(); if (lr < 2) return c;
  const ids = g.getRange(2, 1, lr - 1, 1).getValues(), rg = g.getRange(2, c, lr - 1, 1);
  rg.setFormulas(ids.map((v, i) => [str(v[0]) ? sdcFormula_(i + 2) : '']));
  rg.setNumberFormat('#,##0').setHorizontalAlignment('right');
  return c;
}

/* ---- TongQuan (B3 Năm, B4 Tháng · B6:B16 chỉ số · A20:C34 chi theo hạng mục cha · A38:C45 thu theo nguồn · E10:H23 theo tháng · K:O cột phụ ẩn) ---- */
function datTongQuan_() {
  const s = opt('TongQuan'); if (!s) return 0;
  const D = 'GiaoDich!$D:$D', B = 'GiaoDich!$B:$B', C = 'GiaoDich!$C:$C', G = 'GiaoDich!$G:$G';
  const win = (f, t) => B + ',">="&' + f + ',' + B + ',"<"&' + t;
  const sum = (type, f, t) => 'SUMIFS(' + D + ',' + C + ',"' + type + '",' + win(f, t) + ')';
  const W = win('$B$6', '$B$7');
  s.getRange('B6:B7').setFormulas([['=DATE($B$3,$B$4,1)'], ['=DATE($B$3,$B$4+1,1)']]);
  s.getRange('E9').setFormula('="THU - CHI THEO THÁNG NĂM "&$B$3');
  s.getRange('B10:B16').setFormulas([
    ['=TaiKhoan!$I$22'], ['=' + sum('Thu', '$B$6', '$B$7')], ['=' + sum('Chi', '$B$6', '$B$7')],
    ['=B11-B12'], ['=IF(B11=0,0,B13/B11)'], ['=' + sum('Điều chỉnh', '$B$6', '$B$7')], ['=COUNTIFS(' + W + ')']
  ]);
  // Cột phụ K:O (dòng 2..60): hạng mục cha trong DanhMuc!E:F, số tiền tháng đang xem, khóa xếp hạng (số tiền + ROW()/1e6 để không trùng)
  const H1 = 2, H2 = 60, help = [];
  for (let r = H1; r <= H2; r++) help.push([
    '=IF(DanhMuc!E' + r + '="","",DanhMuc!E' + r + ')',
    '=IF(DanhMuc!F' + r + '="","",DanhMuc!F' + r + ')',
    '=IF(OR(K' + r + '="",L' + r + '=""),0,SUMIFS(' + D + ',' + C + ',L' + r + ',' + G + ',K' + r + ',' + W + '))',
    '=IF(AND(L' + r + '="Chi",M' + r + '>0),M' + r + '+ROW()/1000000,"")',
    '=IF(AND(L' + r + '="Thu",M' + r + '>0),M' + r + '+ROW()/1000000,"")'
  ]);
  s.getRange(H1, 11, H2 - H1 + 1, 5).setFormulas(help);
  s.getRange('K1').setValue('Cột phụ xếp hạng (ẩn, đừng sửa)');
  s.hideColumns(11, 5);
  const rg = c => '$' + c + '$' + H1 + ':$' + c + '$' + H2;
  const block = (r1, n, typ, key, total) => {
    const rows = [];
    for (let k = 1; k <= n; k++) {
      const r = r1 + k - 1;
      rows.push([
        '=IFERROR(INDEX(' + rg('K') + ',MATCH(LARGE(' + rg(key) + ',' + k + '),' + rg(key) + ',0)),"")',
        '=IF(A' + r + '="",0,SUMIFS(' + D + ',' + C + ',"' + typ + '",' + G + ',A' + r + ',' + W + '))',
        '=IF(' + total + '=0,0,B' + r + '/' + total + ')'
      ]);
    }
    s.getRange(r1, 1, n, 3).setFormulas(rows);
  };
  block(20, 13, 'Chi', 'N', '$B$12');
  s.getRange('B33:C34').setFormulas([
    ['=B12-SUMIFS(' + D + ',' + C + ',"Chi",' + G + ',"<>",' + W + ')', '=IF($B$12=0,0,B33/$B$12)'],
    ['=B12', '=IF($B$12=0,0,B34/$B$12)']
  ]);
  block(38, 6, 'Thu', 'O', '$B$11');
  s.getRange('B44:C45').setFormulas([
    ['=B11-SUMIFS(' + D + ',' + C + ',"Thu",' + G + ',"<>",' + W + ')', '=IF($B$11=0,0,B44/$B$11)'],
    ['=B11', '=IF($B$11=0,0,B45/$B$11)']
  ]);
  const m = [];
  for (let r = 11; r <= 22; r++) {
    const f = 'DATE($B$3,$E' + r + ',1)', t = 'DATE($B$3,$E' + r + '+1,1)';
    m.push(['=' + sum('Thu', f, t), '=' + sum('Chi', f, t), '=F' + r + '-G' + r]);
  }
  s.getRange(11, 6, 12, 3).setFormulas(m);
  s.getRange(23, 6, 1, 3).setFormulas([['=SUM(F11:F22)', '=SUM(G11:G22)', '=SUM(H11:H22)']]);
  return 1;
}

/* ---- Quét lỗi công thức ---- */
function quetLoiCongThuc_() {
  const bad = [], isErr = x => /^#(REF|NAME|VALUE|N\/A|DIV|ERROR)/.test(x);
  ZONES.forEach(z => {
    const s = opt(z.sheet); if (!s) return;
    const lr = s.getLastRow(), lc = s.getLastColumn(), from = z.from || 1; if (!lr || lc < from) return;
    let k = 0; s.getRange(1, from, lr, lc - from + 1).getDisplayValues().forEach(r => r.forEach(x => { if (isErr(x)) k++; }));
    if (k) bad.push(z.sheet + ': ' + k + ' ô');
  });
  const tq = opt('TongQuan');
  if (tq && tq.getLastRow()) { let k = 0; tq.getDataRange().getDisplayValues().forEach(r => r.forEach(x => { if (isErr(x)) k++; })); if (k) bad.push('TongQuan: ' + k + ' ô'); }
  return bad;
}
function datTatCa_() {
  const n = datCongThucTaiKhoan_(), d = datDanhMuc_(), c = datSoDuCuoi_(), q = datTongQuan_();
  saveFormulas();                       // làm mới bản chuẩn trong _CongThuc (bỏ qua công thức hỏng / =0)
  SpreadsheetApp.flush();
  const bad = quetLoiCongThuc_();
  return '• Đã ghi lại công thức: TaiKhoan (' + n + ' tài khoản), DanhMuc (cột D), cột "' + SDC_HEAD + '" (cột ' + c + ' của GiaoDich)' + (q ? ', TongQuan' : '') + '\n' +
    (bad.length ? '• CÒN LỖI: ' + bad.join(' · ') : '• Quét lỗi công thức: sạch');
}

/* ---- Chuẩn hóa dữ liệu GiaoDich (chỉ ghi cột A:D và J, không đụng cột E:I và cột công thức) ---- */
function normalizeTx(first, last) {
  const g = need(TAB.tx), n = g.getLastRow(); last = Math.min(last, n); if (n < 2 || last < first) return 0;
  const V = g.getRange(first, 1, last - first + 1, 10).getValues(), ids = {}; let k = 0;
  if (first > 2) g.getRange(2, 1, first - 2, 1).getValues().forEach(x => { if (str(x[0])) ids[str(x[0])] = 1; });
  V.forEach((v, i) => {
    if (v.slice(1, 9).every(x => x === '')) return;
    const row = first + i, set = (c, val) => { g.getRange(row, c).setValue(val); k++; };
    let id = str(v[0]); if (!id || ids[id]) { id = newId(); set(1, id); } ids[id] = 1;
    const dt = parseDate(v[1]); if (dt && !(v[1] instanceof Date)) set(2, dt);
    const ty = fixType(v[2]); if (ty && ty !== v[2]) set(3, ty);
    const am = parseNum(v[3]); if (am !== null && typeof v[3] !== 'number') set(4, am);
    if (v[9] === '') set(10, new Date());
  });
  return k;
}

/* ---- Ràng buộc nhập liệu ---- */
function applyValidation() {
  const V = () => SpreadsheetApp.newDataValidation(), g = need(TAB.tx), acc = need(TAB.acc), cat = need(TAB.cat), rows = Math.max(g.getMaxRows() - 1, 1);
  g.getRange(2, 2, rows).setNumberFormat('yyyy-mm-dd').setDataValidation(V().requireDate().setAllowInvalid(false).setHelpText('Nhập ngày hợp lệ, vd 2026-10-10').build());
  g.getRange(2, 3, rows).setDataValidation(V().requireValueInList(TYPES, true).setAllowInvalid(false).setHelpText('Chọn: ' + TYPES.join(' / ')).build());
  g.getRange(2, 4, rows).setNumberFormat('#,##0').setDataValidation(V().requireNumberBetween(-1e13, 1e13).setAllowInvalid(false).setHelpText('Chỉ nhập số. Thu/Chi/Chuyển khoản > 0; Điều chỉnh có thể âm').build());
  g.getRange(2, 5, rows, 2).setDataValidation(V().requireValueInRange(acc.getRange('A2:A21'), true).setAllowInvalid(false).setHelpText('Chọn tài khoản có trong tab TaiKhoan').build());
  g.getRange(2, 7, rows).setDataValidation(V().requireValueInRange(cat.getRange('B2:B100'), true).setAllowInvalid(false).setHelpText('Chọn hạng mục cha có trong tab DanhMuc').build());
  g.getRange(2, 8, rows).setDataValidation(V().requireValueInRange(cat.getRange('C2:C100'), true).setAllowInvalid(false).setHelpText('Chọn hạng mục con có trong tab DanhMuc (phải thuộc đúng hạng mục cha)').build());
  const ar = Math.max(acc.getMaxRows() - 1, 1);
  acc.getRange(2, 2, Math.min(ar, MAX_ACC)).setDataValidation(V().requireValueInList(ACC_TYPES, true).setAllowInvalid(false).build());
  acc.getRange(2, 3, Math.min(ar, MAX_ACC)).setNumberFormat('#,##0').setDataValidation(V().requireNumberBetween(-1e13, 1e13).setAllowInvalid(false).setHelpText('Số dư ban đầu (số)').build());
  cat.getRange(2, 1, Math.min(Math.max(cat.getMaxRows() - 1, 1), MAX_CAT)).setDataValidation(V().requireValueInList(['Chi', 'Thu'], true).setAllowInvalid(false).build());
  const h = limSheet(), hr = Math.max(h.getMaxRows() - 1, 1);
  h.getRange(2, 1, hr).setDataValidation(V().requireValueInList(PERIODS, true).setAllowInvalid(false).setHelpText('Ngày hoặc Tháng').build());
  h.getRange(2, 2, hr).setDataValidation(V().requireValueInRange(cat.getRange('B2:B100'), true).setAllowInvalid(true).setHelpText('Hạng mục CHA loại Chi. Để trống = tổng chi').build());
  h.getRange(2, 3, hr).setNumberFormat('#,##0').setDataValidation(V().requireNumberGreaterThan(0).setAllowInvalid(false).setHelpText('Hạn mức > 0').build());
}
function installTriggers() {
  const mine = ['onEditInstalled', 'onChangeInstalled', 'tuSua', 'heal', 'tuSuaGsheet'];
  ScriptApp.getProjectTriggers().forEach(t => { if (mine.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss()).onEdit().create();
  ScriptApp.newTrigger('onChangeInstalled').forSpreadsheet(ss()).onChange().create();
  ScriptApp.newTrigger('tuSua').timeBased().everyMinutes(10).create();
}

/* ======================= MENU ======================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Sổ Thu Chi')
    .addItem('Khôi phục công thức ngay', 'menuKhoiPhuc')
    .addItem('Ghi nhớ công thức hiện tại làm chuẩn', 'menuGhiNho')
    .addItem('Cài đặt tự động', 'menuCaiDat')
    .addItem('Tạo các tab HanMuc, DaXoa', 'menuTaoTab')
    .addSeparator()
    .addItem('Đồng bộ ngay', 'menuDongBo')
    .addItem('Sửa toàn bộ Gsheet (công thức + dữ liệu + ràng buộc)', 'menuSua')
    .addToUi();
}
const alertBox = (title, text) => SpreadsheetApp.getUi().alert(title, text, SpreadsheetApp.getUi().ButtonSet.OK);
function withLock(fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return fn(); } finally { CacheService.getScriptCache().remove('rev'); lock.releaseLock(); }
}
function menuKhoiPhuc() {
  const t = withLock(() => {
    const f = healFormulas();
    return '• Khôi phục từ bản chuẩn: ' + (f.first ? 'chưa có bản chuẩn, đã tạo mới' : f.fixed + ' ô/dòng') + '\n' + datTatCa_();
  });
  alertBox('Khôi phục công thức', t);
}
function menuGhiNho() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Ghi nhớ công thức hiện tại làm chuẩn?', 'Từ giờ công thức đang có sẽ là bản chuẩn để tự khôi phục. Chỉ làm khi bạn chắc công thức hiện tại đang ĐÚNG (công thức chứa #REF! sẽ tự bị bỏ qua).', ui.ButtonSet.YES_NO) === ui.Button.YES)
    ui.alert('Đã lưu ' + withLock(saveFormulas) + ' vùng công thức.');
}
function menuCaiDat() { withLock(() => { applyValidation(); installTriggers(); }); alertBox('Cài đặt tự động', 'Đã cài ràng buộc nhập liệu, kiểm tra khi sửa tay, và tự sửa mỗi 10 phút.'); }
function menuTaoTab() { const L = []; withLock(() => ensureSystemTabs(L)); alertBox('Tạo các tab', L.length ? L.join('\n') : 'Các tab HanMuc, DaXoa, _CongThuc đã có đủ.'); }
function menuDongBo() {
  CacheService.getScriptCache().remove('rev');
  const r = dongBo([], '');
  ss().toast('Giao dịch ' + r.tx.length + ' · Tài khoản ' + r.acc.length + ' · Hạng mục ' + r.cat.length + ' · Hạn mức ' + r.lim.length + (r.issues.length ? ' · ⚠ ' + r.issues.length + ' dòng cần sửa' : ''), 'Đã đồng bộ (' + VER + ')', 8);
}
function menuSua() { const r = suaGsheet(false); alertBox('Sửa Gsheet', r.text); }