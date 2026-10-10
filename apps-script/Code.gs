/** Sổ Thu Chi - backend. Dán vào Apps Script gắn với Google Sheet (Extensions > Apps Script), rồi Deploy > Manage deployments > Edit > New version. */
const PASS_DEFAULT = '0000'; // đổi bằng Project Settings > Script properties > APP_PASS
const SS = () => SpreadsheetApp.getActiveSpreadsheet();
const TZ = () => Session.getScriptTimeZone();

function doGet() { return out({ ok: true, name: 'So Thu Chi API' }); }

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents), c = CacheService.getScriptCache();
    if (d.a === 'login') {
      if (c.get('lock')) return out({ ok: false, err: 'Nhập sai nhiều lần, thử lại sau 5 phút' });
      const pass = PropertiesService.getScriptProperties().getProperty('APP_PASS') || PASS_DEFAULT;
      if (String(d.pass) !== pass) {
        const n = Number(c.get('fail') || 0) + 1; c.put('fail', String(n), 300);
        if (n >= 5) c.put('lock', '1', 300);
        return out({ ok: false, err: 'Mật khẩu không đúng' });
      }
      const t = Utilities.getUuid(); c.put('tk_' + t, '1', 21600);
      return out({ ok: true, token: t });
    }
    if (!d.t || !c.get('tk_' + d.t)) return out({ ok: false, err: 'auth' });
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (d.a === 'add') add(d.row);
      else if (d.a === 'upd') upd(d.row);
      else if (d.a === 'del') del(d.id);
      else if (d.a !== 'all') return out({ ok: false, err: 'Hành động không hợp lệ' });
      SpreadsheetApp.flush();
      return out(Object.assign({ ok: true }, readAll()));
    } finally { lock.releaseLock(); }
  } catch (err) { return out({ ok: false, err: String(err) }); }
}

const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const sh = n => SS().getSheetByName(n);
const day = v => v instanceof Date ? Utilities.formatDate(v, TZ(), 'yyyy-MM-dd') : String(v || '').slice(0, 10);

function readAll() {
  const g = sh('GiaoDich'), n = g.getLastRow();
  const tx = n < 2 ? [] : g.getRange(2, 1, n - 1, 10).getValues().filter(r => r[0] !== '' && r[1] !== '').map(r => ({
    id: String(r[0]), date: day(r[1]), type: r[2], amount: Number(r[3]) || 0, acc: r[4], accTo: r[5], cat: r[6], sub: r[7], note: r[8]
  }));
  const acc = sh('TaiKhoan').getRange(2, 1, 20, 3).getValues().filter(r => r[0] !== '').map(r => ({ name: r[0], type: r[1], open: Number(r[2]) || 0 }));
  const cat = sh('DanhMuc').getRange(2, 1, 99, 3).getValues().filter(r => r[2] !== '').map(r => ({ t: r[0], p: r[1], c: r[2] }));
  return { tx, acc, cat };
}

function rowArr(r) {
  const [y, m, d] = r.date.split('-').map(Number);
  return [r.id, new Date(y, m - 1, d), r.type, Number(r.amount), r.acc || '', r.accTo || '', r.cat || '', r.sub || '', r.note || ''];
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
function del(id) { const i = find(id); if (i) sh('GiaoDich').deleteRow(i); }
