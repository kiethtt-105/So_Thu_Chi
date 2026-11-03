/* ===== 11_Validation.gs — CẤU HÌNH ràng buộc nhập liệu (sửa bảng VALIDATION, không cần sửa code bên dưới) ===== */
/* Mỗi nhóm = 1 tab. max = số dòng tối đa áp dụng (0 = toàn bộ dòng của tab).
 * Mỗi rule: col = khóa cột GiaoDich (chuỗi) hoặc số thứ tự cột (tab khác); fmt = định dạng số/ngày;
 * check.type = date | list | between | gt | range; help = gợi ý khi nhập; allowInvalid = true thì chỉ cảnh báo, không chặn. */
const VALIDATION = [
  { sheet: 'tx', max: 0, rules: [
    { col: 'date', fmt: 'yyyy-mm-dd', check: { type: 'date' }, help: 'Nhập ngày hợp lệ, vd 2026-10-10' },
    { col: 'type', check: { type: 'list', values: TYPES }, help: 'Chọn: ' + TYPES.join(' / ') },
    { col: 'amount', fmt: '#,##0', check: { type: 'between', min: -1e13, max: 1e13 }, help: 'Chỉ nhập số NGUYÊN (đồng). Số lẻ sẽ tự làm tròn. Thu/Chi/Chuyển khoản > 0; Điều chỉnh có thể âm' },
    { col: ['acc', 'accTo'], check: { type: 'range', sheet: 'acc', a1: 'A2:A' + ACC_LAST_ }, help: 'Chọn tài khoản có trong tab TaiKhoan' },
    { col: 'cat', check: { type: 'range', sheet: 'cat', a1: 'B2:B' + CAT_LAST_ }, help: 'Chọn hạng mục cha có trong tab DanhMuc' },
    { col: 'sub', check: { type: 'range', sheet: 'cat', a1: 'C2:C' + CAT_LAST_ }, help: 'Chọn hạng mục con có trong tab DanhMuc (phải thuộc đúng hạng mục cha)' },
    { col: 'at', fmt: 'yyyy-mm-dd hh:mm:ss' }
  ] },
  { sheet: 'acc', max: MAX_ACC, rules: [
    { col: 2, check: { type: 'list', values: ACC_TYPES } },
    { col: 3, fmt: '#,##0', check: { type: 'between', min: -1e13, max: 1e13 }, help: 'Số dư ban đầu (số nguyên)' }
  ] },
  { sheet: 'cat', max: MAX_CAT, rules: [
    { col: 1, check: { type: 'list', values: ['Chi', 'Thu'] } }
  ] },
  { sheet: 'lim', max: 0, rules: [
    { col: 1, check: { type: 'list', values: PERIODS }, help: 'Ngày hoặc Tháng' },
    { col: 2, check: { type: 'range', sheet: 'cat', a1: 'B2:B' + CAT_LAST_ }, allowInvalid: true, help: 'Hạng mục CHA loại Chi. Để trống = tổng chi' },
    { col: 3, fmt: '#,##0', check: { type: 'gt', min: 0 }, help: 'Hạn mức > 0 (số nguyên)' }
  ] }
];

function sheetOf_(key) { return key === 'lim' ? limSheet() : need(TAB[key]); }

function validationBuilder_(k) {
  const V = SpreadsheetApp.newDataValidation();
  switch (k.type) {
    case 'date': return V.requireDate();
    case 'list': return V.requireValueInList(k.values, true);
    case 'between': return V.requireNumberBetween(k.min, k.max);
    case 'gt': return V.requireNumberGreaterThan(k.min);
    case 'range': return V.requireValueInRange(need(TAB[k.sheet]).getRange(k.a1), true);
    default: throw new Error('Kiểu ràng buộc không hợp lệ: ' + k.type);
  }
}

function applyValidation() {
  const tc = txCols_();
  VALIDATION.forEach(S => {
    const g = sheetOf_(S.sheet), total = Math.max(g.getMaxRows() - 1, 1), rows = S.max ? Math.min(total, S.max) : total;
    S.rules.forEach(r => [].concat(r.col).forEach(key => {
      const col = typeof key === 'number' ? key : tc[key], rg = g.getRange(2, col, rows);
      if (r.fmt) rg.setNumberFormat(r.fmt);
      if (!r.check) return;
      const b = validationBuilder_(r.check).setAllowInvalid(!!r.allowInvalid);
      if (r.help) b.setHelpText(r.help);
      rg.setDataValidation(b.build());
    }));
  });
  khoaCotTuTinh_(); caiBangGiaoDich_();
}
