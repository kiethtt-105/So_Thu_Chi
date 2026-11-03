/* ===== 07_Formulas.gs — công thức chuẩn, khôi phục công thức, TongQuan ===== */
function ensureSystemTabs(L) {
  if (!opt(TAB.lim)) { limSheet(); L.push('• Đã tạo tab HanMuc'); }
  if (!opt(TAB.del)) { dx(); L.push('• Đã tạo tab DaXoa'); }
  if (!opt(TAB.fx)) { const s = ss().insertSheet(TAB.fx); s.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']); s.hideSheet(); L.push('• Đã tạo tab ẩn _CongThuc'); }
}

/* ---- Dấu phân cách công thức: vùng Việt Nam dùng ";" thay cho "," ---- */
let _sep = null;
function sep_() {
  if (_sep) return _sep;
  _sep = ',';
  const c = fxSheet().getRange('H1');
  try {
    try { c.setFormula('=IF(1=1,5,6)'); SpreadsheetApp.flush(); } catch (e) {}
    if (String(c.getValue()) !== '5') {
      try { c.setFormula('=IF(1=1;5;6)'); SpreadsheetApp.flush(); } catch (e) {}
      if (String(c.getValue()) === '5') _sep = ';';
    }
  } finally { c.clear(); }
  return _sep;
}
function fx_(f) {
  if (sep_() === ',') return f;
  let q = false, o = '';
  for (const ch of String(f)) { if (ch === '"') q = !q; o += (!q && ch === ',') ? ';' : ch; }
  return o;
}
const fxs_ = a => a.map(r => r.map(fx_));

/* Ghi công thức CHỈ KHI KHÁC bản hiện có → mở / F5 không làm Gsheet tính lại vô ích. Trả về số ô đã đổi. */
let _chg = 0;
const nFx_ = f => String(f).replace(/;/g, ',').replace(/\s+/g, '').toLowerCase();
function setF_(rg, F) {
  const want = fxs_(F), cur = rg.getFormulas(); let k = 0;
  for (let i = 0; i < want.length; i++) for (let j = 0; j < want[i].length; j++) if (nFx_(cur[i][j]) !== nFx_(want[i][j])) k++;
  if (k) { rg.setFormulas(want); _chg += k; }
  return k;
}

/* ---- Công thức: bản chuẩn lưu ở tab _CongThuc ---- */
function fxSheet() { return opt(TAB.fx) || (function () { const s = ss().insertSheet(TAB.fx); s.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']); s.hideSheet(); return s; })(); }
function saveFormulas() {
  const st = fxSheet(); st.clear(); st.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']);
  const rows = [];
  ZONES.forEach(z => {
    const s = opt(z.sheet); if (!s) return; const zf = zFrom_(z);
    const lr = s.getLastRow(), lc = s.getLastColumn(); if (!lr || !lc) return;
    if (z.cells) {
      s.getRange(1, 1, lr, lc).getFormulasR1C1().forEach((r, i) => r.forEach((x, j) => { if (x && !badFx(x)) rows.push([z.sheet, 'cell', s.getRange(i + 1, j + 1).getA1Notation(), x]); }));
      return;
    }
    if (lc < zf) return;
    const f = s.getRange(1, zf, lr, lc - zf + 1).getFormulasR1C1();
    for (let c = 0; c < f[0].length; c++) {
      const col = f.map(r => r[c]), first = col.findIndex((x, i) => i > 0 && x);
      if (first < 0 || badFx(col[first])) continue;        // không lưu công thức đã hỏng làm chuẩn
      rows.push([z.sheet, ARRAYISH.test(col[first]) ? 'array' : 'fill', (zf + c) + ':' + (first + 1), col[first]]);
    }
  });
  if (rows.length) { const rg = st.getRange(2, 1, rows.length, 4); rg.setNumberFormat('@'); rg.setValues(rows); }   // định dạng văn bản: chuỗi bắt đầu bằng "=" không thành công thức sống
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
      if (mode === 'cell') { const r = s.getRange(key); if (r.getFormulaR1C1() !== f1) { r.setFormulaR1C1(fx_(f1)); fixed++; } return; }
      const [c, top] = String(key).split(':').map(Number), lr = s.getLastRow(); if (lr < top) return;
      if (sn === TAB.tx && TX_ALL_.some(k => txCols_()[k] === c)) return;   // cột có đầu mục của GiaoDich là dữ liệu / giá trị script tính, không khôi phục công thức
      if (mode === 'array') {
        const a = s.getRange(top, c);
        if (a.getFormulaR1C1() !== f1) { if (lr > top) s.getRange(top + 1, c, lr - top, 1).clearContent(); a.setFormulaR1C1(fx_(f1)); fixed++; }
        else if (String(a.getDisplayValue()).indexOf('#REF') === 0 && lr > top) { s.getRange(top + 1, c, lr - top, 1).clearContent(); fixed++; }
      } else {
        const keys = s.getRange(1, zKey_(z), lr, 1).getValues(), cur = s.getRange(1, c, lr, 1).getFormulasR1C1(), end = Math.min(lr, z.max || lr), runs = [];
        let run = null;
        for (let i = top - 1; i < end; i++) {
          if (str(keys[i][0]) !== '' && cur[i][0] !== f1) { if (run) run[1] = i + 1; else run = [i + 1, i + 1]; }
          else if (run) { runs.push(run); run = null; }
        }
        if (run) runs.push(run);
        runs.forEach(([a, b]) => { s.getRange(a, c, b - a + 1, 1).setFormulaR1C1(fx_(f1)); fixed += b - a + 1; });
      }
    } catch (er) { Logger.log('Công thức ' + sn + ': ' + er); }
  });
  return { first: false, fixed };
}

/* ---- Công thức chuẩn viết sẵn trong code. Số dư TK CHỈ tính giao dịch có ngày <= hôm nay. ---- */
const denNgay_ = () => ',' + txRef_('date') + ',"<="&TODAY()';
function fxTaiKhoanRow_(r) {
  const S = (type, key) => '=IF($A' + r + '="","",SUMIFS(' + txRef_('amount') + ',' + txRef_('type') + ',"' + type + '",' + txRef_(key) + ',$A' + r + denNgay_() + '))';
  return [
    S('Thu', 'acc'),                // D  Thu
    S('Chi', 'acc'),                // E  Chi
    S('Chuyển khoản', 'accTo'),     // F  Chuyển vào (tài khoản đến)
    S('Chuyển khoản', 'acc'),       // G  Chuyển ra  (tài khoản đi)
    S('Điều chỉnh', 'acc'),         // H  Điều chỉnh
    '=IF($A' + r + '="","",C' + r + '+D' + r + '-E' + r + '+F' + r + '-G' + r + '+H' + r + ')'   // I  Số dư hiện tại
  ];
}
// TaiKhoan: ghi công thức cho CẢ 20 dòng (dòng trống tự hiện rỗng)
function datCongThucTaiKhoan_() {
  const a = need(TAB.acc), F = []; let n = 0;
  for (let r = 2; r <= 21; r++) F.push(fxTaiKhoanRow_(r));
  setF_(a.getRange(2, 4, 20, 6), F);
  a.getRange(2, 1, 20, 1).getValues().forEach(v => { if (str(v[0])) n++; });
  setF_(a.getRange(22, 3, 1, 7), [['C', 'D', 'E', 'F', 'G', 'H', 'I'].map(c => '=SUM(' + c + '2:' + c + '21)')]);   // hàng 22 = TỔNG
  const T = t => 'SUMIFS(' + txRef_('amount') + ',' + txRef_('type') + ',"' + t + '"' + denNgay_() + ')';                                  // hàng 24 = đối chiếu (phải = 0)
  setF_(a.getRange(24, 4, 1, 6), [[
    '=' + T('Thu') + '-D22', '=' + T('Chi') + '-E22', '=' + T('Chuyển khoản') + '-F22',
    '=' + T('Chuyển khoản') + '-G22', '=' + T('Điều chỉnh') + '-H22', '=I22-(C22+D22-E22+F22-G22+H22)'
  ]]);
  return n;
}
// DanhMuc!D = số tiền tháng đang xem (tháng chọn ở TongQuan!B3:B4) của từng hạng mục con. Thiếu tab TongQuan thì bỏ qua
function datDanhMuc_() {
  if (!opt('TongQuan')) return 0;
  const s = opt(TAB.cat); if (!s) return 0;
  const last = Math.min(CAT_LAST_, s.getMaxRows()), F = [];
  if (s.getMaxRows() > CAT_LAST_) { const x = s.getRange(CAT_LAST_ + 1, 4, s.getMaxRows() - CAT_LAST_, 1); if (x.getFormulas().some(r => r[0])) { x.clearContent(); _chg++; } }   // công thức thừa nằm ngoài vùng DanhMuc
  for (let r = 2; r <= last; r++) F.push(['=IF(C' + r + '="","",SUMIFS(' + txRef_('amount') + ',' + txRef_('type') + ',A' + r + ',' + txRef_('sub') + ',C' + r + ',' + txRef_('date') + ',">="&TongQuan!$B$6,' + txRef_('date') + ',"<"&TongQuan!$B$7))']);
  setF_(s.getRange(2, 4, last - 1, 1), F);
  return last - 1;
}

/* ---- TongQuan (B3 Năm, B4 Tháng · B6:B16 chỉ số · A20:C34 chi theo hạng mục cha · A38:C45 thu theo nguồn · E10:H23 theo tháng · K:O cột phụ ẩn) ---- */
function datTongQuan_() {
  const s = opt('TongQuan'); if (!s) return 0;
  const D = txRef_('amount'), B = txRef_('date'), C = txRef_('type'), G = txRef_('cat');
  const win = (f, t) => B + ',">="&' + f + ',' + B + ',"<"&' + t;
  const sum = (type, f, t) => 'SUMIFS(' + D + ',' + C + ',"' + type + '",' + win(f, t) + ')';
  const W = win('$B$6', '$B$7');
  setF_(s.getRange('B6:B7'), [['=DATE($B$3,$B$4,1)'], ['=DATE($B$3,$B$4+1,1)']]);
  setF_(s.getRange('E9'), [['="THU - CHI THEO THÁNG NĂM "&$B$3']]);
  setF_(s.getRange('B10:B16'), [
    ['=TaiKhoan!$I$22'], ['=' + sum('Thu', '$B$6', '$B$7')], ['=' + sum('Chi', '$B$6', '$B$7')],
    ['=B11-B12'], ['=IF(B11=0,0,B13/B11)'], ['=' + sum('Điều chỉnh', '$B$6', '$B$7')], ['=COUNTIFS(' + W + ')']
  ]);
  // Cột phụ K:O (dòng 2..60): hạng mục cha trong DanhMuc!E:F, số tiền tháng đang xem, khóa xếp hạng
  const H1 = 2, H2 = 60, help = [];
  for (let r = H1; r <= H2; r++) help.push([
    '=IF(DanhMuc!E' + r + '="","",DanhMuc!E' + r + ')',
    '=IF(DanhMuc!F' + r + '="","",DanhMuc!F' + r + ')',
    '=IF(OR(K' + r + '="",L' + r + '=""),0,SUMIFS(' + D + ',' + C + ',L' + r + ',' + G + ',K' + r + ',' + W + '))',
    '=IF(AND(L' + r + '="Chi",M' + r + '>0),M' + r + '+ROW()/1000000,"")',
    '=IF(AND(L' + r + '="Thu",M' + r + '>0),M' + r + '+ROW()/1000000,"")'
  ]);
  setF_(s.getRange(H1, 11, H2 - H1 + 1, 5), help);
  if (str(s.getRange('K1').getValue()) !== 'Cột phụ xếp hạng (ẩn, đừng sửa)') s.getRange('K1').setValue('Cột phụ xếp hạng (ẩn, đừng sửa)');
  if (!s.isColumnHiddenByUser(11)) s.hideColumns(11, 5);
  const rg = c => '$' + c + '$' + H1 + ':$' + c + '$' + H2;
  const blk = (r1, n, typ, key, total) => {
    const rows = [];
    for (let k = 1; k <= n; k++) {
      const r = r1 + k - 1;
      rows.push([
        '=IFERROR(INDEX(' + rg('K') + ',MATCH(LARGE(' + rg(key) + ',' + k + '),' + rg(key) + ',0)),"")',
        '=IF(A' + r + '="",0,SUMIFS(' + D + ',' + C + ',"' + typ + '",' + G + ',A' + r + ',' + W + '))',
        '=IF(' + total + '=0,0,B' + r + '/' + total + ')'
      ]);
    }
    setF_(s.getRange(r1, 1, n, 3), rows);
  };
  blk(20, 13, 'Chi', 'N', '$B$12');
  setF_(s.getRange('B33:C34'), [
    ['=B12-SUMIFS(' + D + ',' + C + ',"Chi",' + G + ',"<>",' + W + ')', '=IF($B$12=0,0,B33/$B$12)'],
    ['=B12', '=IF($B$12=0,0,B34/$B$12)']
  ]);
  blk(38, 6, 'Thu', 'O', '$B$11');
  setF_(s.getRange('B44:C45'), [
    ['=B11-SUMIFS(' + D + ',' + C + ',"Thu",' + G + ',"<>",' + W + ')', '=IF($B$11=0,0,B44/$B$11)'],
    ['=B11', '=IF($B$11=0,0,B45/$B$11)']
  ]);
  const m = [];
  for (let r = 11; r <= 22; r++) {
    const f = 'DATE($B$3,$E' + r + ',1)', t = 'DATE($B$3,$E' + r + '+1,1)';
    m.push(['=' + sum('Thu', f, t), '=' + sum('Chi', f, t), '=F' + r + '-G' + r]);
  }
  setF_(s.getRange(11, 6, 12, 3), m);
  setF_(s.getRange(23, 6, 1, 3), [['=SUM(F11:F22)', '=SUM(G11:G22)', '=SUM(H11:H22)']]);
  return 1;
}

/* ---- Quét lỗi công thức ---- */
function quetLoiCongThuc_() {
  const bad = [], isErr = x => /^#(REF|NAME|VALUE|N\/A|DIV|ERROR)/.test(x);
  ZONES.forEach(z => {
    const s = opt(z.sheet); if (!s) return;
    const lr = s.getLastRow(), lc = s.getLastColumn(), from = zFrom_(z) || 1; if (!lr || lc < from) return;
    let k = 0; s.getRange(1, from, lr, lc - from + 1).getDisplayValues().forEach(r => r.forEach(x => { if (isErr(x)) k++; }));
    if (k) bad.push(z.sheet + ': ' + k + ' ô');
  });
  const tq = opt('TongQuan');
  if (tq && tq.getLastRow()) { let k = 0; tq.getDataRange().getDisplayValues().forEach(r => r.forEach(x => { if (isErr(x)) k++; })); if (k) bad.push('TongQuan: ' + k + ' ô'); }
  return bad;
}
function datTatCa_() {
  const n = datCongThucTaiKhoan_(), d = datDanhMuc_(), c = capNhatSoDuCuoi_(), q = datTongQuan_();
  saveFormulas();                       // làm mới bản chuẩn trong _CongThuc (bỏ qua công thức hỏng / =0)
  SpreadsheetApp.flush();
  const bad = quetLoiCongThuc_();
  return '• Đã ghi lại công thức: TaiKhoan (' + n + ' tài khoản), DanhMuc (cột D), cột "' + SDC_HEAD + '" (cột ' + c + ' của GiaoDich)' + (q ? ', TongQuan' : '') + '\n' +
    (bad.length ? '• CÒN LỖI: ' + bad.join(' · ') : '• Quét lỗi công thức: sạch') + '\n• Dấu phân cách công thức của Gsheet này: "' + sep_() + '"';
}
