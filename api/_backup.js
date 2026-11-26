// Sao lưu JSON lên Drive qua Backup.gs (Apps Script). Nguồn dữ liệu = Google Sheet.
// Gọi từ Vercel Cron (GET /api/store) hoặc nút "Sao lưu ngay" (POST { backupNow:true }).
const { sheet } = require('./_sheet'), auth = require('./_auth');

async function backupDrive() {
  const j = await sheet({ ops: [], rev: '' }, 30000);
  if (!j.ok) return { ok: false, err: j.err || 'Không đọc được Google Sheet' };
  const cj = await auth.kv('cfg.sync', { cfg: { get: true } }, 20000);   // sổ nợ, định kỳ, thẻ, nhắc nhở... (tab CauHinh)
  const cfg = {}; if (cj.ok) Object.keys(cj.cfg || {}).forEach(k => { cfg[k] = cj.cfg[k].v; });
  const data = { app: 'so-thu-chi', v: 1, at: new Date().toISOString(), rev: String(j.rev || ''), tx: j.tx || [], acc: j.acc || [], cat: j.cat || [], lim: j.lim || [], trash: j.trash || [], cfg };
  const r = await sheet({ backup: { json: JSON.stringify(data) } }, 40000);
  if (!r.ok) return { ok: false, err: r.err || 'Apps Script từ chối sao lưu' };
  if (!r.saved) return { ok: false, err: 'Apps Script chưa có Backup.gs hoặc chưa Deploy phiên bản mới' };
  return { ok: true, n: data.tx.length, at: data.at, size: r.size || 0, url: r.url || '' };
}

module.exports = { backupDrive };
