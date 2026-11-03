/* ===== 02_WebApp.gs — doGet / doPost, đồng bộ 2 chiều ===== */
const MAX_SESS = 2;   // số phiên đăng nhập được dùng song song tối đa (xem khóa phiên ở cuối file)
function doGet() { return out({ ok: true, name: 'So Thu Chi API', ver: VER }); }
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // Khóa truy cập: nếu đã đặt Script property KEY thì mọi yêu cầu (đồng bộ lẫn upload ảnh) phải gửi đúng key.
    const K = PropertiesService.getScriptProperties().getProperty('KEY');
    if (K && d.key !== K) throw new Error('Không có quyền truy cập');
    if (d.img) return out(uploadImage(d.img));
    let ops = Array.isArray(d.ops) ? d.ops : [];
    const sid = typeof d.sid === 'string' ? d.sid.slice(0, 64) : '';
    // Thao tác phiên (sess.login / sess.join): xử lý riêng, không đi vào đồng bộ dữ liệu
    const so = ops.filter(isSessOp_);
    if (so.length) { ops = ops.filter(o => !isSessOp_(o)); so.forEach(o => sessApply_(o.op, sid)); }
    // Phiên không còn trong danh sách được phép => từ chối, không ghi gì
    if (sid && !sessOk_(sid)) return out({ ok: false, sess: false, err: 'Phiên đã bị khóa vì có thiết bị khác đăng nhập' });
    if (so.length && !ops.length) return out({ ok: true, sess: true });
    const r = dongBo(ops, d.rev, d.fast);
    if (sid) r.sess = true;
    return out(r);
  } catch (err) { return out({ ok: false, err: err.message || String(err) }); }
}

/* HÀM 1 — ĐỒNG BỘ 2 CHIỀU */
let _ctx = null;
function dongBo(ops, clientRev, fast) {
  ops = Array.isArray(ops) ? ops : [];
  const cache = CacheService.getScriptCache();
  if (ops.length) {
    const lock = LockService.getScriptLock(); lock.waitLock(25000);
    try { _ctx = null; ops = pinIds_(ops); ops.forEach(applyOp); safe(sapXepGiaoDich_, null); safe(capNhatSoDuCuoi_, null); safe(capNhatThang_, null); SpreadsheetApp.flush(); }
    finally { cache.remove('rev'); lock.releaseLock(); }
  }
  if (fast && ops.length) return { ok: true, fast: true };   // chế độ nhanh: ghi xong trả lời luôn, web tự tải lại sổ sau (bỏ bước đọc lại toàn bộ sổ)
  let rev = cache.get('rev'), state = null;
  if (!rev) { state = readAll(); rev = hash(state); cache.put('rev', rev, 15); }
  if (!ops.length && clientRev && clientRev === rev) return { ok: true, same: true, rev };
  return Object.assign({ ok: true, rev }, state || readAll());
}
/* ID dạng '@dòng' là ID theo VỊ TRÍ dòng. Xóa nhiều giao dịch trong một lần đồng bộ thì các dòng dưới bị dồn lên
 * → '@dòng' thứ hai trỏ nhầm sang giao dịch khác. Nên đổi hết '@dòng' thành ID thật TRƯỚC khi áp dụng thao tác. */
function pinIds_(ops) {
  const isAt = id => str(id)[0] === '@';
  if (!ops.some(o => o && ((o.op === 'tx.del' && isAt(o.id)) || (o.op === 'tx.save' && o.row && isAt(o.row.id))))) return ops;
  const g = need(TAB.tx), n = g.getLastRow(); if (n < 2) return ops;
  const A = g.getRange(2, txCols_().id, n - 1, 1).getValues().map(x => str(x[0])), cnt = {}, memo = {};
  A.forEach(x => { if (x) cnt[x] = (cnt[x] || 0) + 1; });
  const fix = id => {
    id = str(id); if (id[0] !== '@') return id; if (memo[id]) return memo[id];
    const r = +id.slice(1); if (!(r >= 2 && r <= n)) return id;
    const cur = A[r - 2]; let nid = cur;
    if (!cur || cnt[cur] > 1) { nid = newId(); if (cur) cnt[cur]--; A[r - 2] = nid; g.getRange(r, txCols_().id).setValue(nid); }   // dòng chưa có ID / trùng ID → cấp ID thật
    return (memo[id] = nid);
  };
  return ops.map(o => !o ? o
    : o.op === 'tx.del' ? Object.assign({}, o, { id: fix(o.id) })
    : (o.op === 'tx.save' && o.row) ? Object.assign({}, o, { row: Object.assign({}, o.row, { id: fix(o.row.id) }) })
    : o);
}
function applyOp(o) {
  switch (o && o.op) {
    case 'tx.save': return saveTx(o.row);
    case 'tx.del': return delTx(o.id);
    case 'tx.purge': return purgeTx(o.id);   // hoàn tác giao dịch vừa tạo: xóa hẳn, không vào thùng rác
    case 'acc.save': _ctx = null; return saveAcc(o.acc, o.old);
    case 'acc.del': _ctx = null; return delAcc(o.name);
    case 'cat.save': _ctx = null; return saveCat(o.cat, o.old);
    case 'cat.del': _ctx = null; return delCat(o.cat);
    case 'lim.set': return setLim(o.per, o.cat, o.v);
    case 'restore': _ctx = null; return restore(o.at, o.kind, o.id);
    case 'trash.purge': return trashPurge(o.items);
    default: throw new Error('Thao tác không hợp lệ: ' + (o && o.op));
  }
}

/* ---- KHÓA PHIÊN ĐA THIẾT BỊ ----
 * Script property SESS = danh sách mã phiên (SID) đang được phép, ví dụ ["a1","b2"].
 *  - sess.login : có người đăng nhập mới  → danh sách chỉ còn SID đó, mọi phiên khác bị khóa ở lần đồng bộ kế tiếp
 *  - sess.join  : phiên bị khóa nhập lại mật khẩu → thêm vào, giữ tối đa MAX_SESS phiên mới nhất
 * Chưa có SESS (chưa ai đăng nhập kể từ khi nâng cấp) → cho qua hết, nên nâng cấp không đá ai ra.
 * Yêu cầu không kèm sid (bản web cũ, hàng đợi offline của sw.js) → không bị kiểm tra. */
const isSessOp_ = o => !!(o && typeof o.op === 'string' && o.op.indexOf('sess.') === 0);
function sessGet_() {
  const raw = PropertiesService.getScriptProperties().getProperty('SESS');
  if (raw === null) return null;
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : null; } catch (e) { return null; }
}
function sessOk_(sid) { const a = sessGet_(); return a === null || a.indexOf(sid) >= 0; }
function sessApply_(op, sid) {
  if (!sid) return;
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    let a = sessGet_() || [];
    if (op === 'sess.login') a = [sid];
    else if (op === 'sess.join') a = a.filter(x => x !== sid).concat(sid).slice(-MAX_SESS);
    else return;
    PropertiesService.getScriptProperties().setProperty('SESS', JSON.stringify(a));
  } finally { lock.releaseLock(); }
}

/* ---- UPLOAD ẢNH — nhận ảnh đã nén từ web và lưu vào thư mục Drive ---- */
function uploadImage(img) {
  if (!img || !img.data) throw new Error('Thiếu dữ liệu ảnh');
  if (img.data.length > IMG_MAX_B64) throw new Error('Ảnh quá lớn');
  const mime = /^image\/(jpeg|png|webp)$/.test(img.mime) ? img.mime : 'image/jpeg';
  const name = String(img.name || 'anh.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 90);
  const blob = Utilities.newBlob(Utilities.base64Decode(img.data), mime, name);
  const f = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob);
  return { ok: true, id: f.getId(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', name: f.getName(), size: f.getSize() };
}
/* Chạy hàm này MỘT LẦN trong trình soạn thảo để cấp quyền Drive */
function capQuyenDrive() { DriveApp.getFolderById(DRIVE_FOLDER_ID).getName(); }