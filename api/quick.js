// POST /api/quick   body: {"text":"ăn sáng 20k tiền mặt"}   (thêm "key" nếu config.js có KEY)
// Dùng đúng bộ đọc câu của ô "Gõ nhanh" (js/quick.js) rồi ghi vào Google Apps Script. Không cần giao diện.
// Trả về JSON: {ok:true, msg:"Đã ghi: ..."} hoặc {ok:false, msg:"lý do"}.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
// app.js gom nhiều file; mỗi phần bắt đầu bằng dòng "/* ===== tên.js ===== */". J('quick.js') lấy đúng phần đó.
const J = f => {
    if (f === 'config.js') return R('config.js');
    const all = R('app.js'), tag = '/* ===== ' + f + ' ===== */\n', i = all.indexOf(tag);
    if (i < 0) throw Error('Thiếu phần ' + f);
    const j = all.indexOf('/* ===== ', i + tag.length);
    return all.slice(i + tag.length, j < 0 ? all.length : j);
};

function loadConfig() {
    const w = {}; vm.runInNewContext(J('config.js'), { window: w }); return w.CONFIG || {};
}
// Lấy đúng các hàm đọc câu từ file gốc của app để luôn khớp với giao diện.
function loadParser(S) {
    const core = J('core.js'), forms = J('forms.js'), tx = J('txform.js'), q = J('quick.js');
    const one = (src, name) => { const m = src.match(new RegExp('^const ' + name + ' = .*;$', 'm')); if (!m) throw Error('Thiếu ' + name); return m[0]; };
    const code = [one(core, 'ymd'), one(core, 'newId'), one(forms, 'hm'), tx.slice(0, tx.indexOf('function txSave')), q.slice(0, q.indexOf('function qPreview')),
        q.slice(q.indexOf('function qRow'), q.indexOf('function qSave'))].join('\n') + '\n;({qParse,qMissing,qRow})';
    return vm.runInNewContext(code, { S, Date, Set, Map, RegExp, String, Math, Object, Array, Number, parseFloat });
}
async function call(API, ops) {
    const r = await fetch(API, { method: 'POST', body: JSON.stringify({ ops, rev: '' }), redirect: 'follow' });
    let j; try { j = await r.json(); } catch (e) { throw Error('Máy chủ Apps Script không phản hồi đúng'); }
    if (!j.ok) throw Error(j.err || 'Lỗi máy chủ');
    return j;
}
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const num = n => new Intl.NumberFormat('vi-VN').format(n);

module.exports = async (req, res) => {
    process.env.TZ = 'Asia/Bangkok';              // ngày giờ theo giờ Việt Nam, không theo máy chủ
    const out = (c, o) => { res.statusCode = c; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
    if (req.method !== 'POST' && req.method !== 'GET') { res.setHeader('allow', 'GET, POST'); return out(405, { ok: false, msg: 'Chỉ nhận GET hoặc POST' }); }
    try {
        let b = req.body;
        if (req.method === 'GET') {   // GET /api/quick?key=...&text=ăn sáng 20k tiền mặt   (GET bắt buộc có key)
            const sp = new URL(req.url, 'http://x').searchParams;
            b = { text: sp.get('text') || sp.get('q') || '', key: sp.get('key') || sp.get('KEY') || '' };
        }
        else if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = { text: b }; } }   // body thuần chữ cũng nhận
        b = b || {};
        if (!b.key && req.headers && req.headers['x-key']) b.key = req.headers['x-key'];
        const C = loadConfig();
        if ((C.KEY || req.method === 'GET') && !(C.KEY && b.key && same(b.key, C.KEY))) return out(401, { ok: false, msg: 'Sai khóa' });   // POST: kiểm khóa nếu config.js có KEY; GET: luôn bắt buộc
        let text = String(b.text || '').trim();
        if (/%[0-9a-f]{2}/i.test(text)) { try { text = decodeURIComponent(text.replace(/\+/g, ' ')); } catch (e) { } }   // lỡ mã hóa URL ở phím tắt thì tự giải mã
        if (!text) return out(400, { ok: false, msg: 'Chưa có nội dung' });
        const j = await call(C.API, []);
        const S = { tx: j.tx || [], acc: j.acc || [], cat: j.cat || [], lim: j.lim || [] };
        const P = loadParser(S), p = P.qParse(text);
        if (!p) return out(422, { ok: false, msg: 'Không đọc được câu này' });
        const miss = P.qMissing(p);
        if (miss.length) return out(422, { ok: false, msg: 'Thiếu ' + miss.join(', ') + '. Nói rõ hơn, ví dụ: "ăn sáng 20k tiền mặt"', parsed: p });
        const row = P.qRow(p);
        await call(C.API, [{ op: 'tx.save', row }]);
        const where = p.type === 'Chuyển khoản' ? p.acc + ' → ' + p.accTo : (p.sub ? p.sub + ' · ' : '') + p.acc;
        return out(200, { ok: true, msg: 'Đã ghi: ' + p.type + ' ' + num(p.amount) + ' ₫ · ' + where, row });
    } catch (e) {
        return out(500, { ok: false, msg: 'Lỗi: ' + e.message });
    }
};