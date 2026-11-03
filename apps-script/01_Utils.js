/* ===== 01_Utils.gs — tiện ích chung, đọc/ghi số, ngày, cột GiaoDich ===== */
const ss = () => SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(FALLBACK_SHEET_ID);
const tz = () => ss().getSpreadsheetTimeZone();
const opt = n => ss().getSheetByName(n);
const need = n => { const s = opt(n); if (!s) throw new Error('Thiếu tab "' + n + '" — vào menu Sổ Thu Chi → Nâng cao → Cài đặt / sửa toàn bộ'); return s; };
const str = v => v == null ? '' : String(v).trim();
const noAccent = s => str(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
const fixType = v => TYPES.find(t => noAccent(t) === noAccent(v)) || null;
const fixPer = v => PERIODS.find(t => noAccent(t) === noAccent(v)) || null;
const day = d => Utilities.formatDate(d, tz(), 'yyyy-MM-dd');
const nowStr = () => Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd HH:mm:ss');
const hash = o => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(o)));
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const block = (s, rows, cols) => s.getRange(2, 1, Math.max(1, Math.min(rows, s.getMaxRows() - 1)), cols).getValues();
const safe = (f, d) => { try { return f(); } catch (e) { Logger.log(e); return d; } };
let _idN = 0;
const newId = () => 'G' + Date.now().toString(36) + (_idN++).toString(36) + Math.floor(Math.random() * 1296).toString(36);

// Tách / gộp liên kết ảnh Drive khỏi ô Ghi chú (web vẫn gửi/nhận dạng "ghi chú + link", sheet thì lưu riêng 2 cột)
const splitImg_ = n => { n = String(n == null ? '' : n); return { text: n.replace(IMG_RE, '').replace(/\s+/g, ' ').trim(), imgs: n.match(IMG_RE) || [] }; };
const uniq_ = a => a.filter((x, i) => a.indexOf(x) === i);
const joinImg_ = (t, a) => [str(t)].concat(a || []).filter(Boolean).join(' ');
const noteWeb_ = (note, cell) => { const sp = splitImg_(note); return joinImg_(sp.text, uniq_(sp.imgs.concat(splitImg_(cell).imgs))); };
// Công thức hỏng / bị "đóng băng" thành hằng số (=0, =#REF!, =#VALUE!...) KHÔNG bao giờ được lưu hay khôi phục làm bản chuẩn
const badFx = f => /#(REF|VALUE|ERROR|NAME|N\/A|DIV)/i.test(f) || /^=\s*-?\d+(\.\d+)?\s*$/.test(String(f));

/* ---- Tìm cột GiaoDich theo tên đầu mục ---- */
const hk_ = s => noAccent(s).replace(/[^a-z0-9]+/g, ' ').trim();
const colLetter_ = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
let _tc = null;
function txCols_(g) {
  if (_tc) return _tc;
  g = g || need(TAB.tx);
  const lc = g.getLastColumn(), H = lc ? g.getRange(1, 1, 1, lc).getValues()[0] : [], m = { lc };
  H.forEach((h, i) => { const k = TX_KEYS_[hk_(h)]; if (k && !m[k]) m[k] = i + 1; });
  const miss = TX_CORE_.filter(k => !m[k]);
  if (miss.length) throw new Error('Tab GiaoDich thiếu cột "' + miss.map(k => TX_LABEL_[k]).join('", "') + '" ở dòng 1 — hãy đặt lại đúng tên đầu mục');
  m.top = Math.max.apply(null, TX_ALL_.map(k => m[k] || 0));
  return (_tc = m);
}
const txRef_ = k => { const L = colLetter_(txCols_()[k]); return 'GiaoDich!$' + L + ':$' + L; };   // tham chiếu cả cột trong công thức
const zFrom_ = z => z.sheet === TAB.tx ? txCols_().top + 1 : z.from;
const zKey_ = z => z.sheet === TAB.tx ? txCols_().id : z.key;
/* Ghi nhiều ô của 1 dòng GiaoDich theo khóa; cột nằm liền nhau thì gom thành 1 lần ghi. rec: {khóa: giá trị} */
function putRow_(g, row, rec) {
  const c = txCols_(), cs = Object.keys(rec).filter(k => c[k] && rec[k] !== undefined).map(k => [c[k], rec[k]]).sort((a, b) => a[0] - b[0]);
  let i = 0;
  while (i < cs.length) {
    let j = i; while (j + 1 < cs.length && cs[j + 1][0] === cs[j][0] + 1) j++;
    g.getRange(row, cs[i][0], 1, j - i + 1).setValues([cs.slice(i, j + 1).map(x => x[1])]);
    i = j + 1;
  }
}

/* ---- Số / ngày ---- */
// Trả null nếu không phải số (KHÔNG tự đổi thành 0 để không sinh tiền ảo)
// Sai số dấu phẩy động (vd 1100000.0000000002) được gom về số nguyên gần nhất.
const snap_ = n => { const r = Math.round(n); return Math.abs(n - r) < 1e-6 ? r : n; };
function parseNum(v) {
  if (typeof v === 'number') return isFinite(v) ? snap_(v) : null;
  let s = str(v).replace(/[₫đ\s]/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^-?\d+[.,]\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s); return isFinite(n) ? snap_(n) : null;
}
// TIỀN (VND) LUÔN LÀ SỐ NGUYÊN: mọi số tiền đọc vào / ghi ra đều đi qua hàm này. null nếu không phải số.
function parseMoney_(v) { const n = parseNum(v); return n === null ? null : Math.round(n) + 0; }   // "+ 0" để không ra -0

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
// "2026-10-10T13:58:00" (web gửi trong row.at) → Date theo múi giờ của Gsheet; không hợp lệ → null
function parseAt_(v) {
  const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  try { return Utilities.parseDate(m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00'), tz(), 'yyyy-MM-dd HH:mm:ss'); }
  catch (e) { return null; }
}
