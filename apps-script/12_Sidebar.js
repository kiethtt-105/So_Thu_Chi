/* ===== 12_Sidebar.gs — thanh bên "Thêm giao dịch" ngay trong Google Sheet (giao diện: Sidebar.html) ===== */
function moThanhBen() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Thêm giao dịch'));
}
function sbData() {
  const ok = r => !r.empty && !r.bad;
  return {
    types: TYPES,
    acc: accRows().filter(ok).map(r => r.item.name),
    cat: catRows().filter(ok).map(r => r.item),
    today: day(new Date()),
    time: Utilities.formatDate(new Date(), tz(), 'HH:mm')
  };
}
function sbSave(f) {
  const row = {
    id: newId(), date: str(f.date), type: str(f.type), amount: f.amount, acc: str(f.acc), accTo: str(f.accTo),
    cat: str(f.cat), sub: str(f.sub), note: str(f.note), at: str(f.date) + 'T' + (str(f.time) || '00:00') + ':00'
  };
  dongBo([{ op: 'tx.save', row }], '', true);
  return { ok: true, id: row.id };
}
