const SHEET_ID = '10yJGQB7IalkqKE8b1nYu2YG78DOURNTtss7sPRbwmKE';
const SS = () => SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
const TZ = () => Session.getScriptTimeZone();
const TYPES = ['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'];
const GUARD = [
  { sheet: 'TongQuan', mode: 'cells' },
  { sheet: 'GiaoDich', mode: 'cols', from: 11, key: 1 },
  { sheet: 'TaiKhoan', mode: 'cols', from: 4, key: 1 },
  { sheet: 'DanhMuc', mode: 'cols', from: 4, key: 3 }
];
const ARR = /ARRAYFORMULA|QUERY\(|FILTER\(|SORT\(|UNIQUE\(|SPLIT\(|IMPORTRANGE\(|SEQUENCE\(/i;

function doGet() { return out({ ok: true, name: 'So Thu Chi API v2' }); }
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (d.a === 'add') add(d.row);
      else if (d.a === 'upd') upd(d.row);
      else if (d.a === 'del') del(d.id);
      else if (d.a === 'accSave') accSave(d.acc, d.old);
      else if (d.a === 'accDel') accDel(d.name);
      else if (d.a === 'catSave') catSave(d.cat, d.old);
      else if (d.a === 'catDel') catDel(d.cat);
      else if (d.a === 'restore') restore(d.at, d.kind);
      else if (d.a === 'recSet') writeRec(d.rec || []);
      else if (d.a === 'lim') writeLim(d.lim || {});
      else if (d.a !== 'all') return out({ ok: false, err: 'Hành động không hợp lệ' });
      const cache = CacheService.getScriptCache();
      if (d.a !== 'all' || !cache.get('heal')) { heal(); cache.put('heal', '1', 15); }
      SpreadsheetApp.flush();
      const r = readAll(), h = hash(r);
      if (d.a === 'all' && d.h === h) return out({ ok: true, same: true, h });
      return out(Object.assign({ ok: true, h }, r));
    } finally { lock.releaseLock(); }
  } catch (err) { return out({ ok: false, err: String(err) }); }
}

const hash = o => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(o)));
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const sh = n => { const s = SS().getSheetByName(n); if (!s) throw new Error('Không tìm thấy sheet ' + n); return s; };
const rng = (s, rows, cols) => s.getRange(2, 1, Math.max(1, Math.min(rows, s.getMaxRows() - 1)), cols).getValues();
const day = v => v instanceof Date ? Utilities.formatDate(v, TZ(), 'yyyy-MM-dd') : String(v || '').slice(0, 10);
const noAccent = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim();
function toNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/[^\d,.\-]/g, '');
  if (!s) return 0;
  const n = Number(/[.,]\d{1,2}$/.test(s) ? s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.') : s.replace(/[.,]/g, ''));
  return isNaN(n) ? 0 : n;
}
function fixType(v) { const k = noAccent(v); return TYPES.find(t => noAccent(t) === k) || null; }
function toDate(v) {
  if (v instanceof Date) return v;
  const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/) || null;
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const i = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return i ? new Date(+i[1], +i[2] - 1, +i[3]) : null;
}

function readAll() {
  const g = sh('GiaoDich'), n = g.getLastRow(); let bad = 0;
  const tx = n < 2 ? [] : g.getRange(2, 1, n - 1, 10).getValues().filter(r => r[0] !== '' && r[1] !== '').map(r => {
    const t = fixType(r[2]), dt = toDate(r[1]); if (!t || !dt) bad++;
    return { id: String(r[0]), date: dt ? day(dt) : day(r[1]), type: t || r[2], amount: toNum(r[3]), acc: r[4], accTo: r[5], cat: r[6], sub: r[7], note: r[8] };
  });
  const acc = rng(sh('TaiKhoan'), 20, 3).filter(r => r[0] !== '').map(r => ({ name: r[0], type: r[1], open: toNum(r[2]) }));
  const cat = rng(sh('DanhMuc'), 99, 3).filter(r => r[2] !== '').map(r => ({ t: r[0], p: r[1], c: r[2] }));
  return { tx, acc, cat, bad, trash: readTrash(), rec: readRec(), lim: readLim() };
}

function rowArr(r) {
  if (!fixType(r.type)) throw new Error('Loại giao dịch không hợp lệ');
  const dt = toDate(r.date); if (!dt) throw new Error('Ngày không hợp lệ');
  return [r.id, dt, fixType(r.type), toNum(r.amount), r.acc || '', r.accTo || '', r.cat || '', r.sub || '', r.note || ''];
}
function find(id) {
  const g = sh('GiaoDich'), n = g.getLastRow();
  if (n < 2) return 0;
  const ids = g.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function add(r) {
  if (find(r.id)) return upd(r);
  const g = sh('GiaoDich'), row = Math.max(g.getLastRow() + 1, 2);
  g.getRange(row, 1, 1, 10).setValues([rowArr(r).concat([new Date()])]);
}
function upd(r) { const i = find(r.id); if (!i) return add(r); sh('GiaoDich').getRange(i, 1, 1, 9).setValues([rowArr(r)]); }

const NOW = () => Utilities.formatDate(new Date(), TZ(), 'yyyy-MM-dd HH:mm:ss');
const DX = () => { let s = SS().getSheetByName('DaXoa'); if (!s) { s = SS().insertSheet('DaXoa'); s.appendRow(['ID/Tên', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Đến TK', 'Hạng mục', 'Chi tiết', 'Ghi chú', 'Xóa lúc', 'Nhóm', 'Khôi phục lúc']); s.setFrozenRows(1); } return s; };
const arch = (a, kind) => { const r = a.slice(0, 9); while (r.length < 9) r.push(''); DX().appendRow(r.concat([NOW(), kind, ''])); };
const inTrash = id => DX().getDataRange().getValues().some(r => String(r[0]) === String(id) && r[10] === 'gd');
function del(id) { const i = find(id); if (!i) return; const g = sh('GiaoDich'); arch(g.getRange(i, 1, 1, 9).getValues()[0], 'gd'); g.deleteRow(i); }
function readTrash() {
  return DX().getDataRange().getValues().slice(1).filter(r => r[9] && r[11] === '').slice(-300).reverse().map(r => ({ at: String(r[9]), k: r[10], id: String(r[0]), date: day(r[1]), type: r[2], amount: toNum(r[3]), acc: r[4], accTo: r[5], cat: r[6], sub: r[7], note: r[8] }));
}
function emptyRow(s, rows) { const v = s.getRange(2, 1, rows, 1).getValues(); const i = v.findIndex(x => x[0] === ''); return i < 0 ? rows + 2 : i + 2; }
function renameIn(col, from, to) { const g = sh('GiaoDich'), n = g.getLastRow(); if (n < 2) return; const rg = g.getRange(2, col, n - 1, 1), v = rg.getValues(); rg.setValues(v.map(x => [x[0] === from ? to : x[0]])); }
function accSave(a, old) {
  if (!a.name) throw new Error('Thiếu tên tài khoản');
  const s = sh('TaiKhoan'), v = s.getRange(2, 1, 20, 1).getValues(), key = old || a.name, i = v.findIndex(x => x[0] === key);
  if (!old && i >= 0) throw new Error('Tài khoản đã tồn tại');
  const row = i >= 0 ? i + 2 : emptyRow(s, 20);
  s.getRange(row, 1, 1, 3).setValues([[a.name, a.type || '', toNum(a.open)]]);
  if (old && old !== a.name) { renameIn(5, old, a.name); renameIn(6, old, a.name); }
}
function accDel(name) {
  const g = sh('GiaoDich'), n = g.getLastRow();
  if (n > 1 && g.getRange(2, 5, n - 1, 2).getValues().some(r => r[0] === name || r[1] === name)) throw new Error('Tài khoản đang có giao dịch, không thể xóa');
  const s = sh('TaiKhoan'), v = s.getRange(2, 1, 20, 3).getValues(), i = v.findIndex(x => x[0] === name); if (i < 0) return;
  arch([name, '', v[i][1], v[i][2]], 'tk'); s.getRange(i + 2, 1, 1, 3).clearContent();
}
function catSave(c, old) {
  if (!c.t || !c.p || !c.c) throw new Error('Thiếu thông tin hạng mục');
  const s = sh('DanhMuc'), N = 99, v = s.getRange(2, 1, N, 3).getValues();
  const i = old ? v.findIndex(x => x[0] === old.t && x[1] === old.p && x[2] === old.c) : -1;
  if (!old && v.some(x => x[0] === c.t && x[1] === c.p && x[2] === c.c)) throw new Error('Hạng mục đã tồn tại');
  s.getRange(i >= 0 ? i + 2 : emptyRow(s, N), 1, 1, 3).setValues([[c.t, c.p, c.c]]);
  if (old && (old.p !== c.p || old.c !== c.c)) { const g = sh('GiaoDich'), n = g.getLastRow(); if (n > 1) { const rg = g.getRange(2, 7, n - 1, 2), x = rg.getValues(); rg.setValues(x.map(r => r[0] === old.p && r[1] === old.c ? [c.p, c.c] : r)); } }
}
function catDel(c) {
  const s = sh('DanhMuc'), v = s.getRange(2, 1, 99, 3).getValues(), i = v.findIndex(x => x[0] === c.t && x[1] === c.p && x[2] === c.c); if (i < 0) return;
  arch(['', '', c.t, '', '', '', c.p, c.c], 'dm'); s.getRange(i + 2, 1, 1, 3).clearContent();
}
function restore(at, kind) {
  const d = DX(), v = d.getDataRange().getValues(), i = v.findIndex((r, k) => k > 0 && String(r[9]) === at && r[10] === kind && r[11] === ''); if (i < 0) throw new Error('Không tìm thấy mục đã xóa');
  const r = v[i];
  if (kind === 'gd') { const g = sh('GiaoDich'); if (!find(r[0])) g.getRange(Math.max(g.getLastRow() + 1, 2), 1, 1, 10).setValues([r.slice(0, 9).concat([new Date()])]); }
  else if (kind === 'tk') accSave({ name: r[0], type: r[2], open: r[3] });
  else if (kind === 'dm') catSave({ t: r[2], p: r[6], c: r[7] });
  d.getRange(i + 1, 12).setValue(NOW());
}

function runRecurring() {
  const L = readRec(), now = new Date();
  const ym = Utilities.formatDate(now, TZ(), 'yyyyMM'), pre = Utilities.formatDate(now, TZ(), 'yyyy-MM-'), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  L.forEach(r => {
    const dd = Math.min(+r.day || 1, dim); if (now.getDate() < dd) return;
    const id = 'R' + r.id + ym; if (find(id) || inTrash(id)) return;
    add({ id, date: pre + ('0' + dd).slice(-2), type: r.type, amount: r.amount, acc: r.acc, accTo: '', cat: r.cat, sub: r.sub, note: (r.note || '') + ' (định kỳ)' });
  });
}

const GS = () => { let s = SS().getSheetByName('_CongThuc'); if (!s) { s = SS().insertSheet('_CongThuc'); s.hideSheet(); s.appendRow(['sheet', 'mode', 'a1/col', 'R1C1']); } return s; };

function ghiNhoCongThuc() {
  const store = GS(); store.clear(); store.appendRow(['sheet', 'mode', 'a1/col', 'R1C1']);
  const rows = [];
  GUARD.forEach(g => {
    const s = SS().getSheetByName(g.sheet); if (!s) return;
    const lr = s.getLastRow(), lc = s.getLastColumn(); if (!lr || !lc) return;
    const f = s.getRange(1, 1, lr, lc).getFormulasR1C1();
    if (g.mode === 'cells') {
      f.forEach((r, i) => r.forEach((x, j) => { if (x) rows.push([g.sheet, 'cell', s.getRange(i + 1, j + 1).getA1Notation(), x]); }));
    } else {
      for (let c = g.from; c <= lc; c++) {
        const col = f.map(r => r[c - 1]); const first = col.findIndex((x, i) => i > 0 && x);
        if (first < 0) continue;
        rows.push([g.sheet, ARR.test(col[first]) ? 'array' : 'fill', c + ':' + (first + 1), col[first]]);
      }
    }
  });
  if (rows.length) store.getRange(2, 1, rows.length, 4).setValues(rows);
  caiValidation();
  return rows.length;
}

function heal() {
  const store = SS().getSheetByName('_CongThuc');
  if (!store) ghiNhoCongThuc();
  chuanHoaGiaoDich();
  runRecurring();
  const t = GS().getDataRange().getValues().slice(1); let n = 0;
  t.forEach(([sn, mode, key, f1]) => {
    const s = SS().getSheetByName(sn); if (!s) return;
    if (mode === 'cell') {
      const r = s.getRange(key); if (r.getFormulaR1C1() !== f1) { r.setFormulaR1C1(f1); n++; }
    } else {
      const [c, top] = key.split(':').map(Number), g = GUARD.find(x => x.sheet === sn);
      const lr = s.getLastRow(); if (lr < top) return;
      if (mode === 'array') {
        const a = s.getRange(top, c);
        if (a.getFormulaR1C1() !== f1) { if (lr > top) s.getRange(top + 1, c, lr - top, 1).clearContent(); a.setFormulaR1C1(f1); n++; }
        else if (String(a.getDisplayValue()).indexOf('#REF') === 0 && lr > top) { s.getRange(top + 1, c, lr - top, 1).clearContent(); n++; }
      } else {
        const keys = s.getRange(1, g.key, lr, 1).getValues(), cur = s.getRange(1, c, lr, 1).getFormulasR1C1();
        for (let i = top - 1; i < lr; i++) if (keys[i][0] !== '' && cur[i][0] !== f1) { s.getRange(i + 1, c).setFormulaR1C1(f1); n++; }
      }
    }
  });
  return n;
}

function chuanHoaGiaoDich() {
  const g = sh('GiaoDich'), n = g.getLastRow(); if (n < 2) return;
  const rg = g.getRange(2, 1, n - 1, 10), v = rg.getValues(); let ch = false;
  v.forEach((r, i) => {
    if (r.slice(1, 9).every(x => x === '')) return;
    if (r[0] === '') { r[0] = 'G' + Date.now().toString(36) + i; ch = true; }
    const dt = toDate(r[1]); if (dt && !(r[1] instanceof Date)) { r[1] = dt; ch = true; }
    const ty = fixType(r[2]); if (ty && ty !== r[2]) { r[2] = ty; ch = true; }
    if (typeof r[3] !== 'number') { r[3] = toNum(r[3]); ch = true; }
    if (r[9] === '') { r[9] = new Date(); ch = true; }
  });
  if (ch) rg.setValues(v);
}

function caiValidation() {
  const g = sh('GiaoDich'), rows = Math.max(g.getMaxRows() - 1, 1), V = SpreadsheetApp.newDataValidation;
  g.getRange(2, 2, rows).setNumberFormat('yyyy-mm-dd').setDataValidation(V().requireDate().setAllowInvalid(false).setHelpText('Nhập ngày hợp lệ').build());
  g.getRange(2, 3, rows).setDataValidation(V().requireValueInList(TYPES, true).setAllowInvalid(false).build());
  g.getRange(2, 4, rows).setNumberFormat('#,##0').setDataValidation(V().requireNumberBetween(-1e13, 1e13).setAllowInvalid(false).setHelpText('Chỉ nhập số').build());
  const ta = sh('TaiKhoan'), list = V().requireValueInRange(ta.getRange('A2:A21'), true).setAllowInvalid(false).build();
  g.getRange(2, 5, rows, 2).setDataValidation(list);
}

function onEditInstalled(e) {
  const l = LockService.getScriptLock(); if (!l.tryLock(5000)) return;
  try { heal(); } finally { l.releaseLock(); }
}
function onOpen() { SpreadsheetApp.getUi().createMenu('Sổ Thu Chi').addItem('Khôi phục công thức ngay', 'heal').addItem('Ghi nhớ công thức hiện tại làm chuẩn', 'ghiNhoCongThuc').addItem('Cài đặt tự động', 'caiDat').addItem('Tạo các tab HanMuc, DinhKy, DaXoa', 'caiTab').addToUi(); }

function caiDat() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(SS()).onEdit().create();
  ScriptApp.newTrigger('heal').timeBased().everyMinutes(5).create();
  caiTab();
  return ghiNhoCongThuc();
}

const PR = () => PropertiesService.getScriptProperties();
function tab(name, head) {
  let s = SS().getSheetByName(name), fresh = false;
  if (!s) { s = SS().insertSheet(name); s.appendRow(head); s.setFrozenRows(1); s.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#5B3DF5').setFontColor('#ffffff'); s.setColumnWidths(1, head.length, 130); fresh = true; }
  return { s, fresh };
}
function limSheet() {
  const t = tab('HanMuc', ['Loại', 'Hạng mục', 'Hạn mức']);
  if (t.fresh) writeLim(JSON.parse(PR().getProperty('lim') || '{}'), t.s);
  return t.s;
}
function writeLim(l, s) {
  s = s || limSheet();
  const rows = [];
  if (l.d) rows.push(['Ngày', '', l.d]);
  if (l.m) rows.push(['Tháng', '', l.m]);
  Object.entries(l.cd || {}).forEach(([k, v]) => rows.push(['Ngày', k, v]));
  Object.entries(l.c || {}).forEach(([k, v]) => rows.push(['Tháng', k, v]));
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 3).clearContent();
  if (rows.length) s.getRange(2, 1, rows.length, 3).setValues(rows);
}
function readLim() {
  const s = limSheet(), o = { d: 0, m: 0, c: {}, cd: {} };
  if (s.getLastRow() < 2) return o;
  s.getRange(2, 1, s.getLastRow() - 1, 3).getValues().forEach(([t, k, v]) => {
    const n = toNum(v), x = noAccent(t); if (!n) return;
    if (x === 'ngay') k ? o.cd[k] = n : o.d = n;
    else if (x === 'thang') k ? o.c[k] = n : o.m = n;
  });
  return o;
}
const RH = ['ID', 'Loại', 'Số tiền', 'Tài khoản', 'Hạng mục', 'Chi tiết', 'Ghi chú', 'Ngày trong tháng'];
function recSheet() {
  const t = tab('DinhKy', RH);
  if (t.fresh) writeRec(JSON.parse(PR().getProperty('rec') || '[]'), t.s);
  return t.s;
}
function writeRec(list, s) {
  s = s || recSheet();
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 8).clearContent();
  if (list.length) s.getRange(2, 1, list.length, 8).setValues(list.map(r => [r.id, r.type, toNum(r.amount), r.acc, r.cat, r.sub, r.note || '', +r.day || 1]));
}
function readRec() {
  const s = recSheet(); if (s.getLastRow() < 2) return [];
  const rg = s.getRange(2, 1, s.getLastRow() - 1, 8), v = rg.getValues(); let ch = false;
  const list = [];
  v.forEach((r, i) => {
    const ty = fixType(r[1]); if (!ty || !toNum(r[2])) return;
    if (r[0] === '') { r[0] = 'K' + Date.now().toString(36) + i; ch = true; }
    list.push({ id: String(r[0]), type: ty, amount: toNum(r[2]), acc: r[3], cat: r[4], sub: r[5], note: r[6], day: Math.min(31, Math.max(1, +r[7] || 1)) });
  });
  if (ch) rg.setValues(v);
  return list;
}
function caiTab() {
  DX(); const a = limSheet(), b = recSheet(), V = SpreadsheetApp.newDataValidation;
  a.getRange(2, 1, 200).setDataValidation(V().requireValueInList(['Ngày', 'Tháng'], true).setAllowInvalid(false).build());
  a.getRange(2, 3, 200).setNumberFormat('#,##0').setDataValidation(V().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
  b.getRange(2, 2, 200).setDataValidation(V().requireValueInList(['Chi', 'Thu'], true).setAllowInvalid(false).build());
  b.getRange(2, 3, 200).setNumberFormat('#,##0');
  b.getRange(2, 8, 200).setDataValidation(V().requireNumberBetween(1, 31).setAllowInvalid(false).build());
}