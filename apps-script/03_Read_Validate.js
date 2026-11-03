/* ===== 03_Read_Validate.gs — đọc dữ liệu & ràng buộc logic ===== */
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
  const c = txCols_(), V = g.getRange(2, 1, n - 1, c.lc).getValues(), res = [], seen = {};
  V.forEach((v, i) => {
    if (TX_CORE_.every(k => v[c[k] - 1] === '')) return;
    const row = i + 2, o = txObj(v, c), P = txProblems(o, ctx), bad = P.some(p => p.lv === 'err'), at = v[c.at - 1];
    if (P.length) issues.push({ sheet: TAB.tx, row, lv: bad ? 'err' : 'warn', msg: P.map(p => p.msg).join('; ') });
    if (bad) return;
    let id = o.id; if (!id || seen[id]) id = '@' + row;
    seen[id] = 1;
    res.push({ id, date: day(parseDate(o.date)), type: fixType(o.type), amount: parseMoney_(o.amount), acc: o.acc, accTo: o.accTo, cat: o.cat, sub: o.sub, note: noteWeb_(o.note, c.img ? v[c.img - 1] : ''), at: at instanceof Date ? day(parseDate(o.date)) + 'T' + Utilities.formatDate(at, tz(), 'HH:mm:ss') : '' });   // ngày lấy từ cột Ngày + giờ lấy từ cột Tạo lúc → web (byTime so cả chuỗi at) xếp đúng kể cả dòng cũ có giờ lệch ngày
  });
  return res;
}
const txObj = (v, c) => { c = c || TXO_DEFAULT; return { id: str(v[c.id - 1]), date: v[c.date - 1], type: str(v[c.type - 1]), amount: v[c.amount - 1], acc: str(v[c.acc - 1]), accTo: str(v[c.accTo - 1]), cat: str(v[c.cat - 1]), sub: str(v[c.sub - 1]), note: str(v[c.note - 1]) }; };

/* ---- RÀNG BUỘC LOGIC ---- */
const P = (c, lv, msg) => ({ c, lv, msg });

function txProblems(r, ctx) {
  const L = [], type = fixType(r.type), amt = parseMoney_(r.amount);
  if (!type) L.push(P(3, 'err', 'Loại "' + r.type + '" không hợp lệ (chỉ: ' + TYPES.join(', ') + ')'));
  const pd_ = parseDate(r.date);
  if (!pd_) L.push(P(2, 'err', 'Ngày không hợp lệ'));
  else { const y_ = +day(pd_).slice(0, 4), ny_ = +day(new Date()).slice(0, 4);
    if (y_ < 2000 || y_ > ny_ + 5) L.push(P(2, 'warn', 'Năm ' + y_ + ' bất thường (nên trong 2000–' + (ny_ + 5) + ')')); }
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
  const L = [], per = fixPer(v[0]), cat = str(v[1]), val = parseMoney_(v[2]);
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
    return { n: i + 2, v, P: P_, empty, bad: P_.some(p => p.lv === 'err'), item: { name: n, type: str(v[1]), open: parseMoney_(v[2]) || 0 } };
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
    return { n: i + 2, v, P: P_, empty, bad: P_.some(p => p.lv === 'err'), item: { per, cat: str(v[1]), v: parseMoney_(v[2]) || 0 } };
  });
}
