  /* =====================================================================
  * SỔ THU CHI — TOÀN BỘ CODE TRONG 1 FILE (.gs). Không cần file HTML.
  * v22: tuSua nhẹ (bỏ qua nếu Sheet không đổi, tryLock 3s) · lô nhanh không tính lại toàn sổ
  *      · saveAcc/saveCat idempotent · bắt buộc KEY · TongQuan loại "Giữ Hộ"
  *      · "1.5" báo lỗi thay vì làm tròn · thùng rác 1000 mục · năm bất thường = lỗi đỏ
  * ===================================================================== */

  /* ===== 00_Config — hằng số cấu hình ===== */
  const VER = 'v22';
  const prop_ = k => PropertiesService.getScriptProperties().getProperty(k) || '';
  const driveFolderId_ = () => prop_('DRIVE_FOLDER_ID');
  const TAB = { tx: 'GiaoDich', acc: 'TaiKhoan', cat: 'DanhMuc', lim: 'HanMuc', del: 'DaXoa', fx: '_CongThuc' };
  const TYPES = ['Chi', 'Thu', 'Chuyển khoản', 'Điều chỉnh'];
  const ACC_TYPES = ['Tiền mặt', 'Ngân hàng', 'Thẻ tín dụng', 'Ví điện tử', 'Tiết kiệm', 'Giữ Hộ'];   // "Giữ Hộ": tiền giữ hộ người khác, không tính vào tổng số dư ở TongQuan
  const PERIODS = ['Ngày', 'Tháng'];
  // Dung lượng khớp với bảng tính: TaiKhoan dòng 2–21 (20 TK, dòng 22 = TỔNG), DanhMuc dòng 2–101 (100 hạng mục con), HanMuc dòng 2–201
  const MAX_ACC = 20, MAX_CAT = 100, MAX_LIM = 200;
  const CAT_LAST_ = MAX_CAT + 1, ACC_LAST_ = MAX_ACC + 1;   // dòng cuối vùng dữ liệu DanhMuc / TaiKhoan
  const RED = '#fecaca', YEL = '#fef3c7';   // màu tô ô lỗi / ô cảnh báo
  const SDC_HEAD = 'Số dư cuối';
  const IMG_HEAD = 'Ảnh';
  const THANG_HEAD = 'Tháng';
  const CNT_HEAD = 'Tính thu chi', SKIP_COL = 10, SKIP_HEAD = 'Không tính thu chi';   // GiaoDich: cột tự tính 1/0 · TaiKhoan: cột J
  const IMG_RE = /https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view\S*/g;

  const IMG_MAX_B64 = 14e6;                       // ~10 MB sau khi giải mã
  const BACKUP_KEEP = 14;
  const TRASH_SHOW = 1000;                        // số mục thùng rác web nhìn thấy

  // Vùng cột công thức script giữ cho đúng (công thức mẫu lấy từ tab _CongThuc).
  const ZONES = [
    { sheet: 'GiaoDich', from: 0, key: 0 },   // from / key của GiaoDich tính động theo tên đầu mục (xem zFrom_ / zKey_)
    { sheet: 'TaiKhoan', from: 4, key: 1, max: 21 },     // cột D:I, dòng 2–21
    { sheet: 'DanhMuc', from: 4, key: 3, max: 101 }      // cột D, dòng 2–101
  ];
  const ARRAYISH = /ARRAYFORMULA|QUERY\(|FILTER\(|SORT\(|UNIQUE\(|SPLIT\(|IMPORTRANGE\(|SEQUENCE\(|MAP\(|BYROW\(/i;

  /* GIAODICH: TÌM CỘT THEO TÊN ĐẦU MỤC (dòng 1)
  * Cột BẮT BUỘC: ID · Ngày · Loại · Số tiền · Tài khoản · Tài khoản đến · Hạng mục cha · Hạng mục con · Ghi chú · Tạo lúc
  * Cột script tự tính / tự tạo (đặt ở đâu cũng được): Số dư cuối · Ảnh · Tháng */
  const TX_KEYS_ = { 'id': 'id', 'ngay': 'date', 'loai': 'type', 'so tien': 'amount', 'tai khoan': 'acc', 'tai khoan den': 'accTo', 'hang muc cha': 'cat', 'hang muc con': 'sub', 'ghi chu': 'note', 'tao luc': 'at', 'so du cuoi': 'sdc', 'anh': 'img', 'thang': 'month', 'tinh thu chi': 'cnt' };
  const TX_LABEL_ = { id: 'ID', date: 'Ngày', type: 'Loại', amount: 'Số tiền (₫)', acc: 'Tài khoản', accTo: 'Tài khoản đến', cat: 'Hạng mục cha', sub: 'Hạng mục con', note: 'Ghi chú', at: 'Tạo lúc' };
  const TX_CORE_ = ['id', 'date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note', 'at'];
  const TX_ALL_ = TX_CORE_.concat(['sdc', 'img', 'month', 'cnt']);
  const TXO_DEFAULT = { id: 1, date: 2, type: 3, amount: 4, acc: 5, accTo: 6, cat: 7, sub: 8, note: 9, at: 10 };   // bố cục CỐ ĐỊNH của tab DaXoa
  const LOGI_ = [null, 'id', 'date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note', 'at'];             // số cột "logic" trong txProblems → khóa


  /* ===== 01_Utils — tiện ích chung, đọc/ghi số, ngày, cột GiaoDich ===== */
  const ss = () => SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(prop_('SHEET_ID'));
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

  // Tách / gộp liên kết ảnh Drive khỏi ô Ghi chú
  const splitImg_ = n => { n = String(n == null ? '' : n); return { text: n.replace(IMG_RE, '').replace(/\s+/g, ' ').trim(), imgs: n.match(IMG_RE) || [] }; };
  const uniq_ = a => a.filter((x, i) => a.indexOf(x) === i);
  const joinImg_ = (t, a) => [str(t)].concat(a || []).filter(Boolean).join(' ');
  const noteWeb_ = (note, cell) => { const sp = splitImg_(note); return joinImg_(sp.text, uniq_(sp.imgs.concat(splitImg_(cell).imgs))); };
  // Công thức hỏng / bị "đóng băng" thành hằng số KHÔNG bao giờ được lưu hay khôi phục làm bản chuẩn
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
  /* Ghi nhiều ô của 1 dòng GiaoDich theo khóa; cột liền nhau thì gom thành 1 lần ghi. */
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
  // TIỀN (VND) LUÔN LÀ SỐ NGUYÊN. Chuỗi kiểu "1.5" / "2,5" là mơ hồ → trả null để báo lỗi (không âm thầm làm tròn).
  function parseMoney_(v) {
    if (typeof v === 'string' && /^-?\d+[.,]\d{1,2}$/.test(v.replace(/[₫đ\s]/gi, ''))) return null;
    const n = parseNum(v); return n === null ? null : Math.round(n) + 0;
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
  function parseAt_(v) {
    const m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    try { return Utilities.parseDate(m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00'), tz(), 'yyyy-MM-dd HH:mm:ss'); }
    catch (e) { return null; }
  }


  /* ===== 02_WebApp — doGet / doPost, đồng bộ 2 chiều ===== */
  const MAX_SESS = 2;   // số phiên đăng nhập được dùng song song tối đa
  function doGet() { return out({ ok: true, name: 'So Thu Chi API', ver: VER }); }
  function doPost(e) {
    try {
      const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
      const K = PropertiesService.getScriptProperties().getProperty('KEY');
      if (!K || d.key !== K) throw new Error('Không có quyền truy cập');   // KEY bắt buộc: phải đặt trong Script Properties và trùng APP_KEY trên Vercel
      if (d.img) return out(uploadImage(d.img));
      let ops = Array.isArray(d.ops) ? d.ops : [];
      const sid = typeof d.sid === 'string' ? d.sid.slice(0, 64) : '';
      const so = ops.filter(isSessOp_);
      if (so.length) { ops = ops.filter(o => !isSessOp_(o)); so.forEach(o => sessApply_(o.op, sid)); }
      if (sid && !sessOk_(sid)) return out({ ok: false, sess: false, err: 'Phiên đã bị khóa vì có thiết bị khác đăng nhập' });
      if (so.length && !ops.length) return out({ ok: true, sess: true });
      const r = dongBo(ops, d.rev, d.fast);
      if (sid) r.sess = true;
      return out(r);
    } catch (err) { return out({ ok: false, err: err.message || String(err) }); }
  }

  /* HÀM 1 — ĐỒNG BỘ 2 CHIỀU
  * fast = true: chỉ ghi dữ liệu. Sắp xếp + cột "Số dư cuối" + cột "Tháng" để trigger tuSua (10 phút) làm. */
  let _ctx = null;
  function dongBo(ops, clientRev, fast) {
    ops = Array.isArray(ops) ? ops : [];
    const cache = CacheService.getScriptCache();
    if (ops.length) {
      const lock = LockService.getScriptLock(); lock.waitLock(25000);
      try {
        _ctx = null; ops = pinIds_(ops); ops.forEach(applyOp);
        if (!fast) { safe(sapXepGiaoDich_, null); safe(capNhatSoDuCuoi_, null); safe(capNhatThang_, null); safe(capNhatCnt_, null); }
        SpreadsheetApp.flush();
      }
      finally { cache.remove('rev'); lock.releaseLock(); }
    }
    if (fast && ops.length) return { ok: true, fast: true };
    let rev = cache.get('rev'), state = null;
    if (!rev) { state = readAll(); rev = hash(state); cache.put('rev', rev, 15); }
    if (!ops.length && clientRev && clientRev === rev) return { ok: true, same: true, rev };
    return Object.assign({ ok: true, rev }, state || readAll());
  }
  /* ID dạng '@dòng' là ID theo VỊ TRÍ dòng → đổi hết thành ID thật TRƯỚC khi áp dụng thao tác. */
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
      if (!cur || cnt[cur] > 1) { nid = newId(); if (cur) cnt[cur]--; A[r - 2] = nid; g.getRange(r, txCols_().id).setValue(nid); }
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
      case 'tx.purge': return purgeTx(o.id);
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

  /* ---- KHÓA PHIÊN ĐA THIẾT BỊ ---- */
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

  /* ---- UPLOAD ẢNH ---- */
  function uploadImage(img) {
    if (!img || !img.data) throw new Error('Thiếu dữ liệu ảnh');
    if (img.data.length > IMG_MAX_B64) throw new Error('Ảnh quá lớn');
    const mime = /^image\/(jpeg|png|webp)$/.test(img.mime) ? img.mime : 'image/jpeg';
    const name = String(img.name || 'anh.jpg').replace(/[^\w.\-]+/g, '_').slice(0, 90);
    const blob = Utilities.newBlob(Utilities.base64Decode(img.data), mime, name);
    const f = DriveApp.getFolderById(driveFolderId_()).createFile(blob);
    return { ok: true, id: f.getId(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', name: f.getName(), size: f.getSize() };
  }
  /* Chạy hàm này MỘT LẦN trong trình soạn thảo để cấp quyền Drive */
  function capQuyenDrive() { DriveApp.getFolderById(driveFolderId_()).getName(); }


  /* ===== 03_Read_Validate — đọc dữ liệu & ràng buộc logic ===== */
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
      chiParents: new Set(c.filter(r => r.item.t === 'Chi').map(r => r.item.p)),
      skip: new Set(a.filter(r => r.item.skip || r.item.type === 'Giữ Hộ').map(r => r.item.name))
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
      res.push({ id, date: day(parseDate(o.date)), type: fixType(o.type), amount: parseMoney_(o.amount), acc: o.acc, accTo: o.accTo, cat: o.cat, sub: o.sub, note: noteWeb_(o.note, c.img ? v[c.img - 1] : ''), at: at instanceof Date ? day(parseDate(o.date)) + 'T' + Utilities.formatDate(at, tz(), 'HH:mm:ss') : '' });
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
      if (y_ < 2000 || y_ > ny_ + 5) L.push(P(2, 'err', 'Năm ' + y_ + ' bất thường (phải trong 2000–' + (ny_ + 5) + ')')); }
    if (amt === null) L.push(P(4, 'err', 'Số tiền phải là số nguyên (không dùng dấu thập phân)'));
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

  const skipOf_ = v => ['1', 'true', 'x', 'có', 'co'].includes(str(v).toLowerCase());
  function accRows() {
    const s = need(TAB.acc), V = block(s, MAX_ACC, 3), J = s.getRange(2, SKIP_COL, V.length, 1).getValues(), seen = {};
    return V.map((v, i) => {
      const empty = v.every(x => x === ''), n = str(v[0]); if (n && !empty) seen[n] = (seen[n] || 0) + 1;
      const P_ = empty ? [] : accP(v, n && seen[n] > 1);
      return { n: i + 2, v, P: P_, empty, bad: P_.some(p => p.lv === 'err'), item: { name: n, type: str(v[1]), open: parseMoney_(v[2]) || 0, skip: skipOf_(J[i][0]) } };
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


  /* ===== 04_Write — ghi dữ liệu từ web: giao dịch, tài khoản, hạng mục, hạn mức ===== */
  function findRow(id) {
    id = str(id); if (!id) return 0;
    const g = need(TAB.tx), n = g.getLastRow();
    if (id[0] === '@') { const r = +id.slice(1); return r >= 2 && r <= n ? r : 0; }
    if (n < 2) return 0;
    const i = g.getRange(2, txCols_().id, n - 1, 1).getValues().findIndex(x => str(x[0]) === id);
    return i < 0 ? 0 : i + 2;
  }
  function nextTxRow(g) {
    const n = g.getLastRow(); if (n < 2) return 2;
    const c = txCols_(), ks = TX_CORE_.filter(k => k !== 'at'), V = g.getRange(2, 1, n - 1, c.lc).getValues(); let last = 1;
    for (let i = V.length - 1; i >= 0; i--) if (ks.some(k => V[i][c[k] - 1] !== '')) { last = i + 2; break; }
    if (last + 1 > g.getMaxRows()) g.insertRowsAfter(g.getMaxRows(), 50);
    return last + 1;
  }
  function saveTx(r) {
    const sp = splitImg_(r.note), o = { id: str(r.id), date: r.date, type: fixType(r.type) || str(r.type), amount: r.amount, acc: str(r.acc), accTo: str(r.accTo), cat: str(r.cat), sub: str(r.sub), note: sp.text };
    if (o.type === 'Chuyển khoản') o.cat = o.sub = ''; else if (o.type === 'Điều chỉnh') o.cat = o.sub = o.accTo = ''; else o.accTo = '';
    const E_ = txProblems(o, getCtx()).filter(p => p.lv === 'err'); if (E_.length) throw new Error(E_[0].msg);   // chỉ lỗi ĐỎ mới chặn lưu
    const g = need(TAB.tx), c = txCols_(); let row = findRow(o.id);
    if (!o.id || o.id[0] === '@') o.id = newId();
    const rec = { id: o.id, date: parseDate(o.date), type: o.type, amount: parseMoney_(o.amount), acc: o.acc, accTo: o.accTo, cat: o.cat, sub: o.sub, note: o.note };
    { const sk = getCtx().skip; rec.cnt = (sk.has(o.acc) || (o.type === 'Chuyển khoản' && sk.has(o.accTo))) ? 0 : 1; }   // ghi luôn cờ, không phải chờ trigger 10 phút
    const at = parseAt_(r.at);
    if (row) {
      if (at) rec.at = at;
      else if (g.getRange(row, c.at).getValue() === '') rec.at = new Date();
      putRow_(g, row, rec);
    } else {
      row = nextTxRow(g); rec.at = at || new Date();
      putRow_(g, row, rec);
      safe(() => unarchiveGd_(o.id), null);
    }
    clearFlags(g, row, c.lc);
    setImgs_(g, row, sp.imgs);
  }
  /* Giao dịch được thêm lại (hoàn tác xóa): đánh dấu bản trong DaXoa là đã khôi phục. */
  function unarchiveGd_(id) {
    const s = opt(TAB.del); if (!s || s.getLastRow() < 2) return;
    const V = s.getRange(2, 1, s.getLastRow() - 1, 12).getValues();
    for (let i = V.length - 1; i >= 0; i--) {
      if (V[i][10] === 'gd' && V[i][11] === '' && str(V[i][0]) === str(id)) { s.getRange(i + 2, 12).setValue(nowStr()); break; }
    }
  }

  /* Xóa dòng an toàn: gỡ bộ lọc, xóa, dựng lại bộ lọc cũ. */
  function deleteRowSafe_(g, row) {
    if (g.getMaxRows() - g.getFrozenRows() <= 1) g.insertRowsAfter(g.getMaxRows(), 1);
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
  /* Xóa giao dịch: lưu Thùng rác TRƯỚC, xóa dòng SAU; nếu xóa lỗi thì gỡ bản vừa lưu. */
  function delTx(id) {
    const row = findRow(id); if (!row) return;
    const g = need(TAB.tx), c = txCols_(), rv = g.getRange(row, 1, 1, c.lc).getValues()[0], vals = ['id', 'date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note'].map(k => rv[c[k] - 1]), icd = c.img;
    vals[8] = noteWeb_(vals[8], icd ? rv[icd - 1] : '');
    const at = rv[c.at - 1];
    if (!str(vals[0]) || str(vals[0])[0] === '@') vals[0] = newId();
    const archRow = arch(vals, 'gd', at);
    try {
      deleteRowSafe_(g, row); SpreadsheetApp.flush();
      const again = findRow(id);
      if (again && again === row && str(g.getRange(row, 1).getValue()) === str(id)) throw new Error('Không xóa được dòng ' + row + ' trong GiaoDich (kiểm tra bộ lọc / vùng được bảo vệ).');
    } catch (e) {
      safe(() => dx().deleteRow(archRow), null);
      throw e;
    }
  }
  function purgeTx(id) {
    const row = findRow(id); if (!row) return;
    const g = need(TAB.tx), c = txCols_(), rv = g.getRange(row, 1, 1, c.lc).getValues()[0];
    const imgs = fileIds_(rv[c.note - 1]).concat(c.img ? fileIds_(rv[c.img - 1]) : []);
    deleteRowSafe_(g, row);
    if (imgs.length) safe(() => trashImgs_(imgs), 0);
  }
  /* Đọc / ghi 1 cột của GiaoDich theo khóa */
  function txColVals_(g, k) { const n = g.getLastRow(); return n < 2 ? [] : g.getRange(2, txCols_()[k], n - 1, 1).getValues().map(r => r[0]); }
  function txColSet_(g, k, A) { if (A.length) g.getRange(2, txCols_()[k], A.length, 1).setValues(A.map(x => [x])); }
  const renameTx = (keys, from, to) => keys.reduce((k, key) => {
    const g = need(TAB.tx), V = txColVals_(g, key); let n = 0;
    const W = V.map(v => { if (str(v) === from) { n++; return to; } return v; });
    if (n) txColSet_(g, key, W);
    return k + n;
  }, 0);
  const usesAcc = name => { const g = need(TAB.tx); return ['acc', 'accTo'].some(k => txColVals_(g, k).some(v => str(v) === name)); };
  const usesCat = (t, p, c) => { const g = need(TAB.tx), T = txColVals_(g, 'type'), P = txColVals_(g, 'cat'), S = txColVals_(g, 'sub'); return T.some((v, i) => str(v) === t && str(P[i]) === p && str(S[i]) === c); };
  const renameCat = (t, p, c, np, nc) => {
    const g = need(TAB.tx), T = txColVals_(g, 'type'), P = txColVals_(g, 'cat'), S = txColVals_(g, 'sub'), P2 = P.slice(), S2 = S.slice(); let k = 0;
    T.forEach((v, i) => { if (str(v) === t && str(P[i]) === p && str(S[i]) === c) { P2[i] = np; S2[i] = nc; k++; } });
    if (k) { txColSet_(g, 'cat', P2); txColSet_(g, 'sub', S2); }
    return k;
  };
  function renameLimCat(from, to) {
    const s = opt(TAB.lim), n = s ? s.getLastRow() : 0; if (n < 2) return;
    const rg = s.getRange(2, 2, n - 1, 1), V = rg.getValues(); rg.setValues(V.map(v => [str(v[0]) === from ? to : v[0]]));
  }

  function saveAcc(a, old) {
    const name = str(a.name), type = str(a.type);
    if (!name) throw new Error('Thiếu tên tài khoản');
    if (type && !ACC_TYPES.includes(type)) throw new Error('Loại tài khoản phải là: ' + ACC_TYPES.join(', '));
    const open = a.open === '' || a.open == null ? 0 : parseMoney_(a.open);
    if (open === null) throw new Error('Số dư ban đầu phải là số nguyên');
    const hasSkip = a.skip !== undefined, skip = !!a.skip;
    const s = need(TAB.acc), V = block(s, MAX_ACC, 3), i = V.findIndex(v => str(v[0]) === (old || name)), dup = V.findIndex(v => str(v[0]) === name);
    const curSkip = i >= 0 ? skipOf_(s.getRange(i + 2, SKIP_COL).getValue()) : false;
    if (!old && i >= 0 && str(V[i][1]) === type && (parseMoney_(V[i][2]) || 0) === open && (!hasSkip || skip === curSkip)) return;   // lô gửi lại y hệt → bỏ qua
    if (!old && i >= 0) throw new Error('Tài khoản "' + name + '" đã tồn tại');
    if (old && i < 0) throw new Error('Không tìm thấy tài khoản "' + old + '"');
    if (old && name !== old && dup >= 0) throw new Error('Tên "' + name + '" đã được dùng');
    let row = i + 2;
    if (i < 0) { const e = V.findIndex(v => v.every(x => x === '')); if (e < 0) throw new Error('Đã đủ ' + MAX_ACC + ' tài khoản (giới hạn của bảng)'); row = e + 2; }
    s.getRange(row, 1, 1, 3).setValues([[name, type, open]]);
    if (hasSkip || i < 0) { ensureSkipHead_(s); s.getRange(row, SKIP_COL).setValue(skip ? 1 : ''); }
    if (old && old !== name) renameTx(['acc', 'accTo'], old, name);
    clearFlags(s, row, 3);
  }
  function delAcc(name) {
    if (usesAcc(name)) throw new Error('Tài khoản đang có giao dịch, không thể xóa');
    const s = need(TAB.acc), V = block(s, MAX_ACC, 3), i = V.findIndex(v => str(v[0]) === name); if (i < 0) return;
    arch([name, '', V[i][1], V[i][2]], 'tk'); s.getRange(i + 2, 1, 1, 3).clearContent();
    s.getRange(i + 2, SKIP_COL).clearContent();
  }
  function saveCat(c, old) {
    const t = str(c.t), p = str(c.p), n = str(c.c);
    if (t !== 'Chi' && t !== 'Thu') throw new Error('Loại phải là Chi hoặc Thu');
    if (!p || !n) throw new Error('Thiếu hạng mục cha hoặc hạng mục con');
    const s = need(TAB.cat), V = block(s, MAX_CAT, 3), same = (v, x) => str(v[0]) === x.t && str(v[1]) === x.p && str(v[2]) === x.c;
    const i = old ? V.findIndex(v => same(v, old)) : -1;
    if (!old && V.some(v => same(v, { t, p, c: n }))) return;   // đã có đúng hạng mục này (gửi lại) → bỏ qua
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
    per = fixPer(per); cat = str(cat); v = (v === '' || v == null) ? 0 : parseMoney_(v);
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

  /* ---- SẮP XẾP GIAODICH: Ngày mới → cũ, cùng ngày thì "Tạo lúc" mới → cũ ---- */
  function sapXepGiaoDich_() {
    const g = need(TAB.tx), n = g.getLastRow(); if (n < 3) return 0;
    const c = txCols_(), D = g.getRange(2, c.date, n - 1, 1).getValues(), A = g.getRange(2, c.at, n - 1, 1).getValues();
    const I = g.getRange(2, c.id, n - 1, 1).getValues(); let idFix = 0;
    I.forEach((r, i) => { if (str(r[0]) === '' && D[i][0] !== '') { r[0] = newId(); idFix++; } });
    if (idFix) g.getRange(2, c.id, n - 1, 1).setValues(I);
    const t = v => v instanceof Date ? v.getTime() : 0;
    let sorted = true;
    for (let i = 1; i < D.length && sorted; i++) {
      const d0 = t(D[i - 1][0]), d1 = t(D[i][0]);
      if (d1 > d0 || (d1 === d0 && t(A[i][0]) > t(A[i - 1][0]))) sorted = false;
    }
    if (sorted) return 0;
    const f = g.getFilter(); let keep = null;
    if (f) {
      const r = f.getRange(), c0 = r.getColumn(), nc = r.getNumColumns(), cr = {};
      for (let k = c0; k < c0 + nc; k++) { const x = f.getColumnFilterCriteria(k); if (x) cr[k] = x; }
      keep = { r1: r.getRow(), c0, nr: r.getNumRows(), nc, cr };
      f.remove();
    }
    try {
      g.getRange(2, 1, n - 1, c.lc).sort([{ column: c.date, ascending: false }, { column: c.at, ascending: false }]);
    } finally {
      if (keep) {
        const nf = g.getRange(keep.r1, keep.c0, keep.nr, keep.nc).createFilter();
        Object.keys(keep.cr).forEach(k => { try { nf.setColumnFilterCriteria(+k, keep.cr[k]); } catch (x) {} });
      }
    }
    return 1;
  }


  /* ===== 05_Trash_Flags — thùng rác (DaXoa) & tô lỗi trên Gsheet ===== */
  function dx() {
    let s = opt(TAB.del) || ss().insertSheet(TAB.del);
    if (s.getLastRow() === 0) { s.appendRow(['ID/Tên', 'Ngày', 'Loại', 'Số tiền', 'Tài khoản', 'Đến TK', 'Hạng mục', 'Chi tiết', 'Ghi chú', 'Xóa lúc', 'Nhóm', 'Khôi phục lúc', 'Giờ GD']); s.setFrozenRows(1); }
    else if (str(s.getRange(1, 13).getValue()) === '') {
      if (s.getMaxColumns() < 13) s.insertColumnsAfter(s.getMaxColumns(), 13 - s.getMaxColumns());
      s.getRange(1, 13).setValue('Giờ GD');
    }
    return s;
  }
  /* Dấu thời gian "Xóa lúc" là KHÓA để web gọi khôi phục. Mỗi lần lưu luôn lệch ít nhất 1 giây. */
  function stampUnique_(s) {
    const now = Date.now(), n = s.getLastRow(); let last = 0;
    if (n > 1) {
      const v = s.getRange(n, 10).getValue();
      if (v instanceof Date) last = v.getTime();
      else { try { last = Utilities.parseDate(str(v), tz(), 'yyyy-MM-dd HH:mm:ss').getTime(); } catch (e) { last = 0; } }
      if (last > now + 600000) last = 0;
    }
    return Utilities.formatDate(new Date(Math.max(now, last + 1000)), tz(), 'yyyy-MM-dd HH:mm:ss');
  }
  function arch(a, kind, at) {
    const r = a.slice(0, 9); while (r.length < 9) r.push('');
    const s = dx();
    s.appendRow(r.concat([stampUnique_(s), kind, '', at instanceof Date ? Utilities.formatDate(at, tz(), "yyyy-MM-dd'T'HH:mm:ss") : '']));
    return s.getLastRow();
  }
  function readTrash() {
    const s = opt(TAB.del); if (!s || s.getLastRow() < 2) return [];
    return s.getDataRange().getValues().slice(1).filter(r => r[9] && r[11] === '').slice(-TRASH_SHOW).reverse()
      .map(r => ({ at: String(r[9]), k: r[10], id: String(r[0]), date: r[1] instanceof Date ? day(r[1]) : str(r[1]).slice(0, 10), type: r[2], amount: parseMoney_(r[3]) || 0, acc: r[4], accTo: r[5], cat: r[6], sub: r[7], note: r[8] }));
  }
  /* Khôi phục. Giao dịch chỉ được khôi phục khi tài khoản của nó còn tồn tại. */
  function restore(at, kind, id) {
    const d = dx(), v = d.getDataRange().getValues(), want = str(id);
    const i = v.findIndex((r, k) => k > 0 && String(r[9]) === at && r[10] === kind && r[11] === '' && (!want || str(r[0]) === want));
    if (i < 0) {
      if (v.some((r, k) => k > 0 && String(r[9]) === at && r[10] === kind && r[11] !== '' && (!want || str(r[0]) === want))) return;   // đã khôi phục rồi
      throw new Error('Không tìm thấy mục đã xóa');
    }
    const r = v[i];
    if (kind === 'gd') {
      const g = need(TAB.tx), rid = str(r[0]), a9 = r.slice(0, 9), sp = splitImg_(r[8]);
      const gio = r[12] instanceof Date ? r[12] : parseAt_(r[12]);
      if (!rid || rid[0] === '@') a9[0] = newId();
      const daCo = a9[0] === rid && findRow(rid);
      if (!daCo) {
        const o = txObj(a9), ctx = getCtx(), bad = txProblems(o, ctx).filter(p => p.lv === 'err');
        if (!ctx.acc.has(o.acc)) bad.push({ msg: 'Tài khoản "' + o.acc + '" không còn trong tab TaiKhoan' });
        if (fixType(o.type) === 'Chuyển khoản' && o.accTo && !ctx.acc.has(o.accTo)) bad.push({ msg: 'Tài khoản nhận "' + o.accTo + '" không còn trong tab TaiKhoan' });
        if (bad.length) throw new Error('Chưa khôi phục được giao dịch này: ' + bad[0].msg + '. Hãy khôi phục tài khoản (mục Thùng rác) trước.');
        a9[3] = parseMoney_(a9[3]);
        a9[8] = sp.text;
        const row = nextTxRow(g); putRow_(g, row, { id: a9[0], date: a9[1], type: a9[2], amount: a9[3], acc: a9[4], accTo: a9[5], cat: a9[6], sub: a9[7], note: a9[8], at: gio || new Date() }); setImgs_(g, row, sp.imgs);
      }
    }
    else if (kind === 'tk') saveAcc({ name: r[0], type: r[2], open: r[3] });
    else if (kind === 'dm') saveCat({ t: r[2], p: r[6], c: r[7] });
    d.getRange(i + 1, 12).setValue(nowStr());
  }

  /* ---- TÔ LỖI TRÊN GSHEET ---- */
  function clearFlags(s, row, ncols) {
    const rg = s.getRange(row, 1, 1, ncols), B = rg.getBackgrounds()[0];
    B.forEach((b, c) => { b = String(b).toLowerCase(); if (b === RED || b === YEL) s.getRange(row, c + 1).setBackground(null).setNote(''); });
  }
  function applyFlags(s, rows, ncols, map) {
    if (!rows.length) return;
    const first = rows[0].n, rg = s.getRange(first, 1, rows.length, ncols), B = rg.getBackgrounds(), N = rg.getNotes();
    rows.forEach((r, i) => {
      const want = {};
      r.P.forEach(p => { const cc = map ? map(p.c) : p.c; if (!cc) return; const w = want[cc] || (want[cc] = { lv: p.lv, msg: '' }); w.msg += (w.msg ? '; ' : '') + p.msg; if (p.lv === 'err') w.lv = 'err'; });
      for (let c = 1; c <= ncols; c++) {
        const w = want[c], bg = String(B[i][c - 1]).toLowerCase(), cell = () => s.getRange(first + i, c);
        if (w) { const col = w.lv === 'err' ? RED : YEL; if (bg !== col) cell().setBackground(col); if (N[i][c - 1] !== w.msg) cell().setNote(w.msg); }
        else if (bg === RED || bg === YEL) cell().setBackground(null).setNote('');
      }
    });
  }
  function flagTx(first, last, ctx) {
    const g = need(TAB.tx); last = Math.min(last, g.getLastRow()); if (last < first) return [];
    const c = txCols_(), V = g.getRange(first, 1, last - first + 1, c.lc).getValues(), rows = V.map((v, i) => ({ n: first + i, P: TX_CORE_.every(k => v[c[k] - 1] === '') ? [] : txProblems(txObj(v, c), ctx) }));
    applyFlags(g, rows, c.lc, x => c[LOGI_[x]]); return rows.filter(r => r.P.length);
  }
  function revalidateAll() {
    const A = accRows(), C = catRows(), ctx = makeCtx(A, C), L = limRows(ctx.chiParents);
    applyFlags(need(TAB.acc), A, 3); applyFlags(need(TAB.cat), C, 3);
    if (opt(TAB.lim) && L.length) applyFlags(opt(TAB.lim), L, 3);
    const T = flagTx(2, need(TAB.tx).getLastRow(), ctx), all = T.concat(A, C, L).filter(r => r.P.length);
    return { err: all.filter(r => r.P.some(p => p.lv === 'err')).length, warn: all.filter(r => !r.P.some(p => p.lv === 'err')).length };
  }


  /* ===== 06_Auto_Triggers — tự động cập nhật, trigger, bắt lỗi khi sửa tay ===== */
  function onOpenInstalled() { safe(tuDongCapNhat, null); }
  function tuDongCapNhat() {
    const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
    try { capNhatTuDong_(); } finally { lock.releaseLock(); }
  }
  function capNhatTuDong_() {
    _sep = null;
    ensureSystemTabs([]);
    safe(capNhatCnt_, null);
    autoDat_();
    healFormulas();
    safe(sapXepGiaoDich_, null);
    autoDat_();
    capNhatSoDuCuoi_();
    safe(capNhatThang_, null);
    safe(tuLanhLoi_, null);
    CacheService.getScriptCache().remove('rev'); SpreadsheetApp.flush();
  }
  function autoDat_() {
    _chg = 0;
    safe(datCongThucTaiKhoan_, 0); safe(datDanhMuc_, 0); safe(datTongQuan_, 0);
    if (_chg || fxBaselineBad_()) saveFormulas();
    return _chg;
  }
  /* Bản chuẩn _CongThuc hỏng (#REF!, =0) hoặc không khớp công thức thật của vùng → coi là hỏng. */
  function fxBaselineBad_() {
    try {
      const st = opt(TAB.fx); if (!st || st.getLastRow() < 2) return false;
      return st.getRange(2, 1, st.getLastRow() - 1, 4).getValues().some(([sn, mode, key, f1]) => {
        const z = ZONES.find(x => x.sheet === sn); if (!z || !sn) return false;
        if (badFx(f1)) return true;
        if (mode !== 'fill') return false;
        const s = opt(sn); if (!s) return false;
        const [c, top] = String(key).split(':').map(Number); if (!c || !top) return true;
        return fxUs_(s.getRange(top, c).getFormulaR1C1()) !== fxUs_(f1);
      });
    } catch (e) { return false; }
  }

  /* Xóa / chèn / sắp xếp dòng, đổi cột trong Gsheet KHÔNG bắn onEdit → dùng onChange */
  function onChangeInstalled(e) {
    try { CacheService.getScriptCache().remove('rev'); } catch (x) {}
    if (e && (e.changeType === 'EDIT' || e.changeType === 'FORMAT' || e.changeType === 'OTHER')) return;
    const lock = LockService.getScriptLock(); if (!lock.tryLock(8000)) return;
    try { safe(capNhatTuDong_, null); } finally { lock.releaseLock(); }
  }

  /* ---- SỬA TAY TRÊN GSHEET → BÁO LỖI NGAY ---- */
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
        { const c = txCols_(); if (r.getNumColumns() === 1 && [c.sdc, c.month, c.img, c.cnt].includes(r.getColumn())) return; }
        normalizeTx(first, Math.min(last, first + 499));
        flagTx(first, Math.min(last, first + 499), getCtx()).forEach(x => msgs.push('Dòng ' + x.n + ': ' + x.P.map(p => p.msg).join('; ')));
      } else {
        if (name === TAB.acc) lamTronCot_(s, 3, MAX_ACC);
        if (name === TAB.lim) lamTronCot_(s, 3, MAX_LIM);
        guardMaster(e, name, msgs);
        _ctx = null;
        const A = accRows(), C = catRows(), ctx = makeCtx(A, C), L = limRows(ctx.chiParents);
        applyFlags(need(TAB.acc), A, 3); applyFlags(need(TAB.cat), C, 3); if (opt(TAB.lim) && L.length) applyFlags(opt(TAB.lim), L, 3);
        const sel = { [TAB.acc]: A, [TAB.cat]: C, [TAB.lim]: L }[name] || [];
        sel.filter(x => x.n >= first && x.n <= last && x.P.length).forEach(x => msgs.push('Dòng ' + x.n + ': ' + x.P.map(p => p.msg).join('; ')));
      }
      if (name === TAB.tx || name === TAB.acc) safe(capNhatCnt_, null);
      if (name === TAB.tx) safe(capNhatThang_, null);
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
      else { const k = renameTx(['acc', 'accTo'], ov, nv); if (k) msgs.push('Đã đổi tên tài khoản "' + ov + '" → "' + nv + '" trong ' + k + ' ô của GiaoDich'); }
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

  /* HÀM 2 — SỬA LẠI GSHEET (menu; lần đầu dùng để cài trigger). silent = true (trigger 10 phút) */
  function suaGsheet(silent) {
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    const L = [];
    try {
      _sep = null;
      ensureSystemTabs(L);
      safe(capNhatCnt_, null);
      autoDat_(); const f = healFormulas(); L.push(f.first ? '• Công thức: lần đầu — đã lưu công thức hiện tại làm chuẩn (' + f.saved + ' vùng)' : '• Công thức: đã khôi phục ' + f.fixed + ' ô/dòng');
      if (!silent) L.push(datTatCa_()); else autoDat_();
      const n = normalizeTx(2, need(TAB.tx).getLastRow()); L.push('• Chuẩn hóa GiaoDich: sửa ' + n + ' ô (ID / ngày / loại / số tiền, gồm làm tròn số lẻ)');
      const lt = lamTronCot_(need(TAB.acc), 3, MAX_ACC) + (opt(TAB.lim) ? lamTronCot_(opt(TAB.lim), 3, MAX_LIM) : 0); if (lt) L.push('• Đã làm tròn ' + lt + ' ô số dư ban đầu / hạn mức về số nguyên');
      const ta = tachAnh_(); if (ta) L.push('• Đã tách link ảnh khỏi Ghi chú sang cột "' + IMG_HEAD + '": ' + ta + ' dòng');
      safe(sapXepGiaoDich_, null);
      capNhatSoDuCuoi_();
      capNhatThang_();
      if (!silent) { applyValidation(); installTriggers(); L.push('• Đã cài ràng buộc nhập liệu và trigger TỰ ĐỘNG (mở/F5, xóa-chèn dòng, mỗi 10 phút)'); }
      const lanh = safe(tuLanhLoi_, 0); if (lanh > 0) L.push('• Đã tự sửa lỗi công thức (quét mọi tab)'); else if (lanh < 0) L.push('• CÒN lỗi công thức không tự sửa được — bấm menu "Chẩn đoán công thức"');
      const v = revalidateAll(); L.push('• Kiểm tra dữ liệu: ' + v.err + ' dòng LỖI (đỏ, không tính vào số liệu), ' + v.warn + ' dòng cảnh báo (vàng)');
      CacheService.getScriptCache().remove('rev'); SpreadsheetApp.flush();
      return { ok: true, text: L.join('\n') };
    } finally { lock.releaseLock(); }
  }

  /* Trigger 10 phút: NHẸ. Bỏ qua nếu bảng tính không đổi từ lần chạy trước; chỉ chờ khóa tối đa 3 giây để không chặn web. */
  function tuSua() {
    const PR = PropertiesService.getScriptProperties();
    const upd = DriveApp.getFileById(ss().getId()).getLastUpdated().getTime();
    if (upd <= +(PR.getProperty('TUSUA_AT') || 0)) return;
    const lock = LockService.getScriptLock(); if (!lock.tryLock(3000)) return;
    try { capNhatTuDong_(); PR.setProperty('TUSUA_AT', String(Date.now())); }
    finally { lock.releaseLock(); }
  }

  function installTriggers() {
    const mine = ['onEditInstalled', 'onChangeInstalled', 'onOpenInstalled', 'tuSua', 'tuDongCapNhat', 'heal', 'tuSuaGsheet', 'saoLuuTuDong'];
    ScriptApp.getProjectTriggers().forEach(t => { if (mine.includes(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss()).onEdit().create();
    ScriptApp.newTrigger('onChangeInstalled').forSpreadsheet(ss()).onChange().create();
    ScriptApp.newTrigger('onOpenInstalled').forSpreadsheet(ss()).onOpen().create();
    ScriptApp.newTrigger('tuSua').timeBased().everyMinutes(10).create();
  }


  /* ===== 07_Formulas — công thức chuẩn, khôi phục công thức, TongQuan ===== */
  function ensureSystemTabs(L) {
    if (!opt(TAB.lim)) { limSheet(); L.push('• Đã tạo tab HanMuc'); }
    if (!opt(TAB.del)) { dx(); L.push('• Đã tạo tab DaXoa'); }
    if (!opt(TAB.fx)) { const s = ss().insertSheet(TAB.fx); s.appendRow(['sheet', 'mode', 'cột:dòng đầu', 'R1C1']); s.hideSheet(); L.push('• Đã tạo tab ẩn _CongThuc'); }
  }

  /* ---- Dấu phân cách công thức: ÉP CỐ ĐỊNH ";" ----
  * Bản chuẩn trong _CongThuc luôn lưu dạng "," và được đổi sang ";" khi ghi ra bảng tính (fx_ / fxR_). */
  const SEP_FIXED_ = ';';
  let _sep = null;
  function sepAll_() { return _sep || (_sep = { a1: SEP_FIXED_, r1: SEP_FIXED_ }); }
  function sep_() { return sepAll_().a1; }
  function fxTo_(f, d) {                       // đổi dấu phân cách NGOÀI dấu nháy kép: về "," trước, rồi sang d
    let q = false, o = '';
    for (const ch of String(f)) { if (ch === '"') q = !q; o += (!q && (ch === ',' || ch === ';')) ? d : ch; }
    return o;
  }
  const fxUs_ = f => fxTo_(f, ',');
  const fx_ = f => fxTo_(f, sepAll_().a1);     // cho setFormula / setFormulas
  const fxR_ = f => fxTo_(f, sepAll_().r1);    // cho setFormulaR1C1
  const fxs_ = a => a.map(r => r.map(fx_));

  /* Ghi công thức CHỈ KHI KHÁC bản hiện có (hoặc ô đang báo #ERROR!). Trả về số ô đã đổi. */
  let _chg = 0;
  const nFx_ = f => String(f).replace(/;/g, ',').replace(/\s+/g, '').toLowerCase();
  function setF_(rg, F) {
    const want = fxs_(F), cur = rg.getFormulas(), disp = rg.getDisplayValues(); let k = 0;
    for (let i = 0; i < want.length; i++) for (let j = 0; j < want[i].length; j++)
      if (nFx_(cur[i][j]) !== nFx_(want[i][j]) || /^#ERROR/i.test(disp[i][j])) k++;
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
        s.getRange(1, 1, lr, lc).getFormulasR1C1().forEach((r, i) => r.forEach((x, j) => { if (x && !badFx(x)) rows.push([z.sheet, 'cell', s.getRange(i + 1, j + 1).getA1Notation(), fxUs_(x)]); }));
        return;
      }
      if (lc < zf) return;
      const f = s.getRange(1, zf, lr, lc - zf + 1).getFormulasR1C1();
      for (let c = 0; c < f[0].length; c++) {
        const col = f.map(r => r[c]), first = col.findIndex((x, i) => i > 0 && x);
        if (first < 0 || badFx(col[first])) continue;
        rows.push([z.sheet, ARRAYISH.test(col[first]) ? 'array' : 'fill', (zf + c) + ':' + (first + 1), fxUs_(col[first])]);
      }
    });
    if (rows.length) { const rg = st.getRange(2, 1, rows.length, 4); rg.setNumberFormat('@'); rg.setValues(rows); }
    return rows.length;
  }
  function healFormulas() {
    const st = fxSheet(); let t = st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 4).getValues() : [];
    if (!t.some(r => ZONES.some(z => z.sheet === r[0]))) return { first: true, saved: saveFormulas(), fixed: 0 };
    let fixed = 0;
    t.forEach(([sn, mode, key, f0]) => {
      const f1 = fxUs_(f0);
      if (badFx(f1)) return;
      try {
        const z = ZONES.find(x => x.sheet === sn), s = opt(sn); if (!z || !s) return;
        if (mode === 'cell') { const r = s.getRange(key); if (fxUs_(r.getFormulaR1C1()) !== f1) { r.setFormulaR1C1(fxR_(f1)); fixed++; } return; }
        const [c, top] = String(key).split(':').map(Number), lr = s.getLastRow(); if (lr < top) return;
        if (sn === TAB.tx && TX_ALL_.some(k => txCols_()[k] === c)) return;
        if (mode === 'array') {
          const a = s.getRange(top, c);
          if (fxUs_(a.getFormulaR1C1()) !== f1) { if (lr > top) s.getRange(top + 1, c, lr - top, 1).clearContent(); a.setFormulaR1C1(fxR_(f1)); fixed++; }
          else if (/^#(REF|ERROR)/.test(String(a.getDisplayValue())) && lr > top) { s.getRange(top + 1, c, lr - top, 1).clearContent(); fixed++; }
        } else {
          const keys = s.getRange(1, zKey_(z), lr, 1).getValues(), cur = s.getRange(1, c, lr, 1).getFormulasR1C1(), dsp = s.getRange(1, c, lr, 1).getDisplayValues(), end = Math.min(lr, z.max || lr), runs = [];
          let run = null;
          for (let i = top - 1; i < end; i++) {
            if (str(keys[i][0]) !== '' && (fxUs_(cur[i][0]) !== f1 || /^#ERROR/i.test(dsp[i][0]))) { if (run) run[1] = i + 1; else run = [i + 1, i + 1]; }
            else if (run) { runs.push(run); run = null; }
          }
          if (run) runs.push(run);
          runs.forEach(([a, b]) => { s.getRange(a, c, b - a + 1, 1).setFormulaR1C1(fxR_(f1)); fixed += b - a + 1; });
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
      S('Chuyển khoản', 'accTo'),     // F  Chuyển vào
      S('Chuyển khoản', 'acc'),       // G  Chuyển ra
      S('Điều chỉnh', 'acc'),         // H  Điều chỉnh
      '=IF($A' + r + '="","",C' + r + '+D' + r + '-E' + r + '+F' + r + '-G' + r + '+H' + r + ')'   // I  Số dư hiện tại
    ];
  }
  function datCongThucTaiKhoan_() {
    const a = need(TAB.acc), F = []; let n = 0;
    for (let r = 2; r <= 21; r++) F.push(fxTaiKhoanRow_(r));
    setF_(a.getRange(2, 4, 20, 6), F);
    a.getRange(2, 1, 20, 1).getValues().forEach(v => { if (str(v[0])) n++; });
    setF_(a.getRange(22, 3, 1, 7), [['C', 'D', 'E', 'F', 'G', 'H', 'I'].map(c => '=SUM(' + c + '2:' + c + '21)')]);   // hàng 22 = TỔNG
    const T = t => 'SUMIFS(' + txRef_('amount') + ',' + txRef_('type') + ',"' + t + '"' + denNgay_() + ')';           // hàng 24 = đối chiếu (phải = 0)
    setF_(a.getRange(24, 4, 1, 6), [[
      '=' + T('Thu') + '-D22', '=' + T('Chi') + '-E22', '=' + T('Chuyển khoản') + '-F22',
      '=' + T('Chuyển khoản') + '-G22', '=' + T('Điều chỉnh') + '-H22', '=I22-(C22+D22-E22+F22-G22+H22)'
    ]]);
    return n;
  }
  function datDanhMuc_() {
    if (!opt('TongQuan')) return 0;
    const s = opt(TAB.cat); if (!s) return 0;
    const last = Math.min(CAT_LAST_, s.getMaxRows()), F = [];
    if (s.getMaxRows() > CAT_LAST_) { const x = s.getRange(CAT_LAST_ + 1, 4, s.getMaxRows() - CAT_LAST_, 1); if (x.getFormulas().some(r => r[0])) { x.clearContent(); _chg++; } }
    for (let r = 2; r <= last; r++) F.push(['=IF(C' + r + '="","",SUMIFS(' + txRef_('amount') + ',' + txRef_('type') + ',A' + r + ',' + txRef_('sub') + ',C' + r + ',' + txRef_('date') + ',">="&TongQuan!$B$6,' + txRef_('date') + ',"<"&TongQuan!$B$7' + cntCrit_() + '))']);
    setF_(s.getRange(2, 4, last - 1, 1), F);
    return last - 1;
  }

  /* ---- TongQuan (B3 Năm, B4 Tháng · B6:B16 chỉ số · A20:C34 chi theo hạng mục cha · A38:C45 thu theo nguồn · E10:H23 theo tháng · K:O cột phụ ẩn) ---- */
  function datTongQuan_() {
    const s = opt('TongQuan'); if (!s) return 0;
    const D = txRef_('amount'), B = txRef_('date'), C = txRef_('type'), G = txRef_('cat');
    const win = (f, t) => B + ',">="&' + f + ',' + B + ',"<"&' + t + cntCrit_();    
    const sum = (type, f, t) => 'SUMIFS(' + D + ',' + C + ',"' + type + '",' + win(f, t) + ')';
    const W = win('$B$6', '$B$7');
    setF_(s.getRange('B6:B7'), [['=DATE($B$3,$B$4,1)'], ['=DATE($B$3,$B$4+1,1)']]);
    setF_(s.getRange('E9'), [['="THU - CHI THEO THÁNG NĂM "&$B$3']]);
    setF_(s.getRange('B10:B16'), [
      ['=SUMIF(TaiKhoan!$B$2:$B$21,"<>Giữ Hộ",TaiKhoan!$I$2:$I$21)'],   // tổng số dư, loại tài khoản "Giữ Hộ"
      ['=' + sum('Thu', '$B$6', '$B$7')], ['=' + sum('Chi', '$B$6', '$B$7')],
      ['=B11-B12'], ['=IF(B11=0,0,B13/B11)'], ['=' + sum('Điều chỉnh', '$B$6', '$B$7')], ['=COUNTIFS(' + W + ')']
    ]);
    // Cột phụ K:O (dòng 2..60)
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

  /* ---- TỰ QUÉT LỖI TOÀN BỘ CÁC TAB + TỰ CHỮA ---- */
  function quetLoiTatCa_() {
    const res = {}, isErr = x => /^#(ERROR|REF|NAME|VALUE|N\/A|DIV)/i.test(x);
    ss().getSheets().forEach(sh => {
      const n = sh.getName(); if (n === TAB.fx || n === TAB.del) return;
      const lr = sh.getLastRow(), lc = sh.getLastColumn(); if (!lr || !lc) return;
      let k = 0; sh.getRange(1, 1, lr, lc).getDisplayValues().forEach(r => r.forEach(x => { if (isErr(x)) k++; }));
      if (k) res[n] = k;
    });
    return res;
  }
  const tongLoi_ = o => Object.keys(o).reduce((a, k) => a + o[k], 0);
  function tuLanhLoi_() {
    const bad0 = tongLoi_(quetLoiTatCa_()); if (!bad0) return 0;
    const cache = CacheService.getScriptCache(); if (cache.get('lanhloi')) return -1;
    const lam = c => { _sep = c; _chg = 0; autoDat_(); healFormulas(); SpreadsheetApp.flush(); return tongLoi_(quetLoiTatCa_()); };
    const det = { a1: SEP_FIXED_, r1: SEP_FIXED_ };   // chỉ dùng ";" — không thử lại ","
    const k = lam(det);
    if (k < bad0) {
      saveFormulas();
      safe(() => ss().toast(k === 0 ? 'Đã tự sửa lỗi công thức' : 'Đã sửa bớt lỗi công thức, còn ' + k + ' ô lỗi', 'Sổ Thu Chi', 6), null);
      if (k) cache.put('lanhloi', '1', 1800);
      return k === 0 ? 2 : 1;
    }
    cache.put('lanhloi', '1', 1800);
    Logger.log('Còn lỗi, không tự sửa được: ' + JSON.stringify(quetLoiTatCa_()));
    return -1;
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
    saveFormulas();
    SpreadsheetApp.flush();
    const bad = quetLoiCongThuc_();
    return '• Đã ghi lại công thức: TaiKhoan (' + n + ' tài khoản), DanhMuc (cột D), cột "' + SDC_HEAD + '" (cột ' + c + ' của GiaoDich)' + (q ? ', TongQuan' : '') + '\n' +
      (bad.length ? '• CÒN LỖI: ' + bad.join(' · ') : '• Quét lỗi công thức: sạch') + '\n• Dấu phân cách công thức: "' + sep_() + '" (cố định)';
  }


  /* ===== 08_Columns — cột phụ GiaoDich (Số dư cuối, Ảnh, Tháng), chuẩn hóa, khóa cột tự tính ===== */
  function findCol_(g, head) {
    const lc = g.getLastColumn(); if (lc < 1) return 0;
    return g.getRange(1, 1, 1, lc).getValues()[0].findIndex(h => str(h) === head) + 1;
  }
  const sdcCol_ = g => findCol_(g, SDC_HEAD);
  const imgCol_ = g => findCol_(g, IMG_HEAD);
  const thangCol_ = g => findCol_(g, THANG_HEAD);
  function ensureCol_(g, head, note, w) {
    let c = findCol_(g, head); if (c) return c;
    c = g.getLastColumn() + 1;
    if (g.getMaxColumns() < c) g.insertColumnsAfter(g.getMaxColumns(), c - g.getMaxColumns());
    g.getRange(1, txCols_().at).copyTo(g.getRange(1, c), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    g.getRange(1, c).setValue(head); if (note) g.getRange(1, c).setNote(note);
    g.setColumnWidth(c, w || 120); _tc = null;
    return c;
  }
  function setImgs_(g, row, imgs) {
    let c = imgCol_(g);
    if (!c) { if (!imgs.length) return; c = ensureCol_(g, IMG_HEAD, 'Liên kết ảnh đính kèm (Google Drive). Nhiều ảnh: mỗi ảnh một dòng.', 260); }
    g.getRange(row, c).setValue(imgs.join('\n'));
  }
  function tachAnh_() {
    const g = need(TAB.tx), n = g.getLastRow(); if (n < 2) return 0;
    const N = g.getRange(2, txCols_().note, n - 1, 1).getValues(), idx = [];
    N.forEach((v, i) => { if (splitImg_(v[0]).imgs.length) idx.push(i); });
    if (!idx.length) return 0;
    const c = ensureCol_(g, IMG_HEAD, 'Liên kết ảnh đính kèm (Google Drive). Nhiều ảnh: mỗi ảnh một dòng.', 260), I = g.getRange(2, c, n - 1, 1).getValues();
    idx.forEach(i => { const sp = splitImg_(N[i][0]); I[i][0] = uniq_(sp.imgs.concat(splitImg_(I[i][0]).imgs)).join('\n'); N[i][0] = sp.text; });
    g.getRange(2, txCols_().note, n - 1, 1).setValues(N); g.getRange(2, c, n - 1, 1).setValues(I);
    return idx.length;
  }
  function lamTronCot_(s, col, maxRows) {
    if (!s) return 0;
    const n = Math.min(s.getLastRow() - 1, maxRows); if (n < 1) return 0;
    const V = s.getRange(2, col, n, 1).getValues(); let k = 0;
    V.forEach((v, i) => {
      if (typeof v[0] !== 'number') return;
      const r = Math.round(v[0]) + 0;
      if (r !== v[0]) { s.getRange(i + 2, col).setValue(r); k++; }
    });
    return k;
  }

  /* Số dư của tài khoản NGAY SAU mỗi giao dịch. */
  function tinhSoDuCuoi_(rows, open) {
    const bal = {}, res = {}, g = a => bal[a] || 0;
    Object.keys(open || {}).forEach(a => { bal[a] = Math.round(open[a]) + 0; });
    rows.slice().sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i).forEach(t => {
      const amt = Math.round(t.amt) + 0;
      if (t.type === 'Chuyển khoản') { bal[t.acc] = g(t.acc) - amt; if (t.accTo) bal[t.accTo] = g(t.accTo) + amt; }
      else if (t.type === 'Chi') bal[t.acc] = g(t.acc) - amt;
      else bal[t.acc] = g(t.acc) + amt;
      res[t.i] = bal[t.acc];
    });
    return res;
  }
  function capNhatSoDuCuoi_() {
    const g = need(TAB.tx), cc = ensureCol_(g, SDC_HEAD, 'Số dư của tài khoản (cột Tài khoản) ngay sau giao dịch này.\nChuyển khoản: số dư của tài khoản nguồn.\nScript tự tính lại mỗi khi dữ liệu đổi — không cần sửa tay.', 120);
    const n = g.getLastRow(); if (n < 2) return cc;
    const c = txCols_(), V = g.getRange(2, 1, n - 1, c.lc).getValues(), open = {}, rows = [];
    accRows().forEach(r => { if (!r.empty && r.item.name) open[r.item.name] = r.item.open; });
    V.forEach((v, i) => {
      const dt = parseDate(v[c.date - 1]), amt = parseMoney_(v[c.amount - 1]), type = fixType(v[c.type - 1]), acc = str(v[c.acc - 1]), at = v[c.at - 1];
      if (!dt || amt === null || !type || !acc) return;
      rows.push({ i, k: day(dt) + ' ' + (at instanceof Date ? Utilities.formatDate(at, tz(), 'HH:mm:ss') : '23:59:59'), type, amt, acc, accTo: str(v[c.accTo - 1]) });
    });
    const res = tinhSoDuCuoi_(rows, open), want = V.map((v, i) => [res[i] === undefined ? '' : res[i]]);
    const cur = g.getRange(2, cc, n - 1, 1).getValues();
    if (!want.every((w, i) => cur[i][0] === w[0]))
      g.getRange(2, cc, n - 1, 1).setValues(want).setNumberFormat('#,##0').setHorizontalAlignment('right');
    return cc;
  }
  /* Cột "Tháng" = yyyy-MM lấy từ cột Ngày (văn bản). */
  function capNhatThang_() {
    const g = need(TAB.tx);
    const c = ensureCol_(g, THANG_HEAD, 'Tháng của giao dịch (yyyy-MM), tự tính từ cột Ngày.\nDùng để lọc / sắp xếp. Đừng sửa tay, script sẽ tính lại.', 80);
    const n = g.getLastRow(); if (n < 2) return c;
    const rg = g.getRange(2, c, n - 1, 1), cur = rg.getValues();
    const want = g.getRange(2, txCols_().date, n - 1, 1).getValues().map(v => { const d = parseDate(v[0]); return [d ? day(d).slice(0, 7) : '']; });
    if (want.every((w, i) => String(cur[i][0]) === w[0])) return c;
    rg.setNumberFormat('@').setValues(want).setHorizontalAlignment('center');
    return c;
  }

  function ensureSkipHead_(s) {
    if (str(s.getRange(1, SKIP_COL).getValue())) return;
    s.getRange(1, 9).copyTo(s.getRange(1, SKIP_COL), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    s.getRange(1, SKIP_COL).setValue(SKIP_HEAD).setNote('Nhập 1 = tài khoản này KHÔNG tính vào thu/chi (số dư vẫn tính). Để trống = tính.\nLoại "Giữ Hộ" luôn không tính.');            
  }
  const cntCrit_ = () => txCols_().cnt ? ',' + txRef_('cnt') + ',"<>0"' : '';
  function capNhatCnt_() {
    const g = need(TAB.tx), cc = ensureCol_(g, CNT_HEAD, 'Script tự tính: 1 = tính vào thu chi, 0 = không (tài khoản Giữ Hộ hoặc bật "Không tính thu chi" ở tab TaiKhoan). Đừng sửa tay.', 90);
    const n = g.getLastRow(); if (n < 2) return cc;
    _ctx = null; const sk = getCtx().skip;
    const D = txColVals_(g, 'date'), T = txColVals_(g, 'type'), A = txColVals_(g, 'acc'), B = txColVals_(g, 'accTo');
    const want = D.map((d, i) => [d === '' ? '' : (sk.has(str(A[i])) || (str(T[i]) === 'Chuyển khoản' && sk.has(str(B[i])))) ? 0 : 1]);
    const rg = g.getRange(2, cc, n - 1, 1), cur = rg.getValues();
    if (want.every((w, i) => cur[i][0] === w[0])) return cc;
    rg.setNumberFormat('0').setValues(want).setHorizontalAlignment('center');
    return cc;
  }

  /* ---- Chuẩn hóa dữ liệu GiaoDich ---- */
  function normalizeTx(first, last) {
    const g = need(TAB.tx), n = g.getLastRow(); last = Math.min(last, n); if (n < 2 || last < first) return 0;
    const c = txCols_(), V = g.getRange(first, 1, last - first + 1, c.lc).getValues(), ids = {}, MID = ['date', 'type', 'amount', 'acc', 'accTo', 'cat', 'sub', 'note']; let k = 0;
    if (first > 2) g.getRange(2, c.id, first - 2, 1).getValues().forEach(x => { if (str(x[0])) ids[str(x[0])] = 1; });
    V.forEach((v, i) => {
      if (MID.every(key => v[c[key] - 1] === '')) return;
      const row = first + i, set = (key, val) => { g.getRange(row, c[key]).setValue(val); k++; };
      let id = str(v[c.id - 1]); if (!id || ids[id]) { id = newId(); set('id', id); } ids[id] = 1;
      const dt = parseDate(v[c.date - 1]); if (dt && !(v[c.date - 1] instanceof Date)) set('date', dt);
      const ty = fixType(v[c.type - 1]); if (ty && ty !== v[c.type - 1]) set('type', ty);
      const am = parseMoney_(v[c.amount - 1]); if (am !== null && am !== v[c.amount - 1]) set('amount', am);
      if (v[c.at - 1] === '') set('at', new Date());
    });
    return k;
  }

  /* Cảnh báo (không chặn) khi sửa tay vào cột tự tính: "Tháng" và "Số dư cuối" */
  function khoaCotTuTinh_() {
    const g = need(TAB.tx), D = 'Cột tự tính (script)';
    g.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === D) p.remove(); });
    [thangCol_(g), sdcCol_(g)].filter(Boolean).forEach(c =>
      g.getRange(2, c, Math.max(g.getMaxRows() - 1, 1), 1).protect().setDescription(D).setWarningOnly(true));
  }
  /* Cố định dòng tiêu đề + tạo bộ lọc cho GiaoDich */
  function caiBangGiaoDich_() {
    const g = need(TAB.tx);
    if (g.getFrozenRows() < 1) g.setFrozenRows(1);
    if (!g.getFilter()) g.getRange(1, 1, g.getMaxRows(), g.getLastColumn()).createFilter();
  }


  /* ===== 09_Menu — menu Sổ Thu Chi (không còn "Thêm giao dịch"/Sidebar) ===== */
  function withLock(fn) {
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try { return fn(); } finally { CacheService.getScriptCache().remove('rev'); lock.releaseLock(); }
  }
  function daCaiTuDong_() {
    try { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'onEditInstalled'); }
    catch (e) { return true; }
  }
  function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Sổ Thu Chi')
      .addItem(daCaiTuDong_() ? 'Đồng bộ & sửa công thức' : '⚠ Cài đặt lần đầu (bấm 1 lần)', 'menuDongBo')
      .addItem('Chẩn đoán công thức', 'chanDoan')
      .addSeparator()
      .addSubMenu(ui.createMenu('Nâng cao')
        .addItem('Cài đặt / sửa toàn bộ', 'menuCaiDatToanBo')
        .addItem('Kiểm tra dữ liệu (tô lỗi)', 'menuKiemTra')
        .addItem('Sao lưu ngay', 'menuSaoLuu'))
      .addToUi();
  }
  function chanDoan() {
    _sep = null; const d = sepAll_(), L = ['Dấu phân cách: setFormula = "' + d.a1 + '", setFormulaR1C1 = "' + d.r1 + '" (cố định)', 'Múi giờ/locale: ' + ss().getSpreadsheetTimeZone() + ' / ' + ss().getSpreadsheetLocale()];
    [['DanhMuc', 'D2'], ['TaiKhoan', 'D2'], ['TongQuan', 'B6']].forEach(([n, a]) => {
      const s = opt(n); if (!s) { L.push(n + ': không có tab'); return; }
      const r = s.getRange(a); L.push(n + '!' + a + ' → ' + r.getDisplayValue() + '\n    ' + r.getFormula());
    });
    const q = quetLoiTatCa_(); L.push('Quét mọi tab: ' + (Object.keys(q).map(k => k + ' ' + q[k] + ' ô').join(' · ') || 'sạch'));
    SpreadsheetApp.getUi().alert('Chẩn đoán công thức', L.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  }
  function menuDongBo() {
    if (!daCaiTuDong_()) { SpreadsheetApp.getUi().alert('Kết quả', suaGsheet(false).text, SpreadsheetApp.getUi().ButtonSet.OK); return; }
    withLock(capNhatTuDong_);
    ss().toast('Đã đồng bộ số liệu và dựng lại công thức', 'Sổ Thu Chi', 5);
  }
  function menuCaiDatToanBo() {
    SpreadsheetApp.getUi().alert('Kết quả', suaGsheet(false).text, SpreadsheetApp.getUi().ButtonSet.OK);
  }
  function menuKiemTra() {
    const v = withLock(revalidateAll);
    SpreadsheetApp.getUi().alert('Kiểm tra dữ liệu', v.err + ' dòng LỖI (đỏ, không tính vào số liệu)\n' + v.warn + ' dòng cảnh báo (vàng)', SpreadsheetApp.getUi().ButtonSet.OK);
  }
  /* CHẠY MỘT LẦN trong trình soạn thảo: gỡ trigger sao lưu hằng đêm cũ */
  function xoaTriggerSaoLuu() {
    let n = 0;
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'saoLuuTuDong') { ScriptApp.deleteTrigger(t); n++; } });
    Logger.log('Đã gỡ ' + n + ' trigger sao lưu');
  }

  /* ---- SAO LƯU: chép nguyên bảng tính vào thư mục riêng tư "SoThuChi_SaoLuu" ở gốc Drive, giữ 14 bản mới nhất ---- */
  function saoLuu_() {
    const root = DriveApp.getRootFolder(), it = root.getFoldersByName('SoThuChi_SaoLuu'), dir = it.hasNext() ? it.next() : root.createFolder('SoThuChi_SaoLuu');
    const name = 'SO_THU_CHI_saoluu_' + Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd_HH-mm');
    DriveApp.getFileById(ss().getId()).makeCopy(name, dir);
    const L = []; const fs = dir.getFiles(); while (fs.hasNext()) { const f = fs.next(); L.push([f, f.getDateCreated().getTime()]); }
    L.sort((a, b) => b[1] - a[1]).slice(BACKUP_KEEP).forEach(x => x[0].setTrashed(true));
    return name;
  }
  function saoLuuTuDong() { safe(saoLuu_, null); }
  function menuSaoLuu() {
    try { ss().toast('Đã sao lưu: ' + saoLuu_(), 'Sổ Thu Chi', 6); }
    catch (e) { SpreadsheetApp.getUi().alert('Chưa sao lưu được', String(e.message || e), SpreadsheetApp.getUi().ButtonSet.OK); }
  }


  /* ===== 10_Trash_Purge — xóa hẳn khỏi thùng rác + dọn ảnh trên Drive ===== */
  const fileIds_ = text => (String(text == null ? '' : text).match(IMG_RE) || []).map(u => (u.match(/\/d\/([\w-]+)/) || [])[1]).filter(Boolean);

  function imgsInUse_(skipRows) {
    const used = {}, g = opt(TAB.tx), skip = skipRows || {};
    if (g && g.getLastRow() > 1) {
      const c = txCols_(), n = g.getLastRow() - 1, ic = imgCol_(g);
      g.getRange(2, c.note, n, 1).getValues().forEach(v => fileIds_(v[0]).forEach(i => used[i] = 1));
      if (ic) g.getRange(2, ic, n, 1).getValues().forEach(v => fileIds_(v[0]).forEach(i => used[i] = 1));
    }
    const d = opt(TAB.del);
    if (d && d.getLastRow() > 1)
      d.getRange(2, 1, d.getLastRow() - 1, 12).getValues().forEach((r, i) => { if (r[11] === '' && !skip[i + 2]) fileIds_(r[8]).forEach(x => used[x] = 1); });
    return used;
  }
  function trashImgs_(ids, skipRows) {
    ids = uniq_(ids || []); if (!ids.length) return 0;
    const used = imgsInUse_(skipRows); let k = 0;
    ids.forEach(id => {
      if (used[id]) return;
      try {
        const f = DriveApp.getFileById(id), ps = f.getParents(); let inside = false;
        while (ps.hasNext()) if (ps.next().getId() === driveFolderId_()) inside = true;
        if (inside) { f.setTrashed(true); k++; }
      } catch (e) { Logger.log('Ảnh ' + id + ': ' + e); }
    });
    return k;
  }
  /* Op 'trash.purge' — items: [{at, kind, id}] */
  function trashPurge(items) {
    items = (Array.isArray(items) ? items : []).filter(x => x && x.at);
    if (!items.length) return;
    const d = dx(), v = d.getDataRange().getValues(), kill = [], ids = [], skip = {};
    items.forEach(it => {
      const i = v.findIndex((r, k) => k > 0 && String(r[9]) === String(it.at) && r[10] === it.kind && r[11] === '' && (!it.id || str(r[0]) === str(it.id)));
      if (i < 0 || skip[i + 1]) return;
      skip[i + 1] = 1; kill.push(i + 1);
      if (it.kind === 'gd') fileIds_(v[i][8]).forEach(x => ids.push(x));
    });
    if (!kill.length) return;
    trashImgs_(ids, skip);
    kill.sort((a, b) => b - a).forEach(r => deleteRowSafe_(d, r));
  }


  /* ===== 11_Validation — CẤU HÌNH ràng buộc nhập liệu ===== */
  const VALIDATION = [
    { sheet: 'tx', max: 0, rules: [
      { col: 'date', fmt: 'yyyy-mm-dd', check: { type: 'date' }, help: 'Nhập ngày hợp lệ, vd 2026-10-10' },
      { col: 'type', check: { type: 'list', values: TYPES }, help: 'Chọn: ' + TYPES.join(' / ') },
      { col: 'amount', fmt: '#,##0', check: { type: 'between', min: -1e13, max: 1e13 }, help: 'Chỉ nhập số NGUYÊN (đồng). Thu/Chi/Chuyển khoản > 0; Điều chỉnh có thể âm' },
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