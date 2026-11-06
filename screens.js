/* screens.js — đăng nhập, giao dịch, form Thêm/Sửa, tài khoản (công tắc "Không tính thu chi"), xuất CSV. */
(()=>{
const money=n=>(Math.round(n)||0).toLocaleString('vi-VN')+' đ',pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
let V=Store.view(),ym=today().slice(0,7);
/* "50k", "1.5tr", "1.250.000", "-200k" (không còn phép tính, không hiện hướng dẫn) */
function parseAmt(s){s=String(s).toLowerCase().replace(/\s/g,'');const neg=s[0]==='-';if(neg)s=s.slice(1);const m=s.match(/^(\d[\d.,]*)(k|tr|m)?$/);if(!m)return null;
  const n=Math.round(m[2]?parseFloat(m[1].replace(',','.'))*(m[2]==='k'?1e3:1e6):+m[1].replace(/[.,]/g,''));return isNaN(n)?null:neg?-n:n}
const btn=(t,c,f)=>{const b=document.createElement('button');b.className='btn '+(c||'');b.textContent=t;b.onclick=f;return b};
/* ---- Đăng nhập ---- */
let lo=false;
function login(){
  if(lo)return;lo=true;
  UI.sheet({title:'Mở sổ',body:'<div class="f"><label for="pw">Mật khẩu</label><input id="pw" type="password" autocomplete="current-password"></div><div class="err" id="er" role="alert"></div>',close:()=>{lo=false}});
  const pw=$('#pw'),er=$('#er'),go=async()=>{er.textContent='';b.disabled=true;const r=await Store.login(pw.value);b.disabled=false;
    if(r.ok){UI.close();Store.pull()}else er.textContent=r.wait?'Thử sai quá nhiều, chờ '+r.wait+' giây':(r.err||'Sai mật khẩu')};
  const b=btn('Mở sổ','p',go);$('.sh-b').after(Object.assign(document.createElement('div'),{className:'sh-f'}));$('.sh-f').append(b);
  pw.onkeydown=e=>{if(e.key==='Enter')go()};pw.focus()}
Store.onAuth=login;
/* ---- Danh sách giao dịch ---- */
function shift(d){let[y,m]=ym.split('-').map(Number);m+=d;if(m<1){m=12;y--}if(m>12){m=1;y++}ym=y+'-'+pad(m);render()}
function render(){
  const L=V.tx.filter(t=>t.date.slice(0,7)===ym);let h='<div class="mn"><button class="ib" data-m="-1" aria-label="Tháng trước">‹</button><b>Tháng '+ym.slice(5)+'/'+ym.slice(0,4)+'</b><button class="ib" data-m="1" aria-label="Tháng sau">›</button></div><div class="card">';
  if(!L.length)h+='<div class="empty">'+(V.acc.length?'Chưa có giao dịch':'Đang tải dữ liệu…')+'</div>';
  let d='';L.forEach(t=>{
    if(t.date!==d){d=t.date;h+='<div class="dh">'+d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4)+'</div>'}
    const a=+t.amount,tr=t.type==='Chuyển khoản',cls=t.type==='Thu'||(t.type==='Điều chỉnh'&&a>0)?'in':t.type==='Chi'||a<0?'out':'',sg=cls==='in'?'+':cls==='out'?'−':'',img=/https?:\/\//.test(t.note||'');
    h+='<button class="li'+(V.pending.has(t.id)?' p':'')+'" data-id="'+esc(t.id)+'"><span class="m"><b>'+esc(tr?t.acc+' → '+t.accTo:(t.sub||t.cat||t.type))+'</b><small>'+esc(t.acc)+(t.note?' · '+esc(t.note.replace(/https?:\/\/\S+/g,'').trim()):'')+(img?' 📎':'')+'</small></span><span class="v '+cls+'">'+sg+money(Math.abs(a))+'</span></button>'});
  $('#v-tx').innerHTML=h+'</div>'}
$('#v-tx').onclick=e=>{const m=e.target.closest('[data-m]'),r=e.target.closest('[data-id]');if(m)shift(+m.dataset.m);else if(r){const t=V.tx.find(x=>x.id===r.dataset.id);t&&form(t)}};
/* ---- Form Thêm / Sửa ---- */
function form(t){
  const e=!!t,st={acc:e?t.acc:(V.acc[0]||{}).name||'',accTo:e?t.accTo:'',cat:e&&t.cat?t.cat+'\u0001'+t.sub:'',date:e?t.date:today(),note:e?t.note:''};let type=e?t.type:'Chi';
  const TY=['Chi','Thu','Chuyển khoản','Điều chỉnh'],LB={'Chuyển khoản':'Chuyển','Điều chỉnh':'Chỉnh'};
  UI.sheet({title:e?'Sửa giao dịch':'Thêm giao dịch',body:'<div class="seg" id="ty"></div><div class="amtw"><input class="amt" id="am" inputmode="decimal" autocomplete="off" placeholder="0 đ" aria-label="Số tiền"></div><div id="fb"></div><div class="err" id="er" role="alert"></div>'});
  const am=$('#am'),er=$('#er'),fb=$('#fb');
  if(e){const a=+t.amount;am.value=(a<0?'-':'')+Math.abs(a).toLocaleString('vi-VN')}
  am.onblur=()=>{const n=parseAmt(am.value);if(n!==null)am.value=(n<0?'-':'')+Math.abs(n).toLocaleString('vi-VN')};
  const sel=(id,opts,v)=>'<select id="'+id+'">'+opts.map(o=>'<option value="'+esc(o[0])+'"'+(o[0]===v?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';
  const A=V.acc.map(a=>[a.name,a.name]);
  function draw(){
    $('#ty').innerHTML=TY.map(x=>'<button type="button" class="'+(x===type?'on':'')+'" data-t="'+x+'">'+(LB[x]||x)+'</button>').join('');
    const tr=type==='Chuyển khoản',cats=V.cat.filter(c=>c.t===type).map(c=>[c.p+'\u0001'+c.c,c.p+' › '+c.c]);
    let h='<div class="f"><label>'+(tr?'Từ tài khoản':'Tài khoản')+'</label>'+sel('ac',A,st.acc)+'</div>';
    if(tr)h+='<div class="f"><label>Đến tài khoản</label>'+sel('at',[['','Chọn…']].concat(A),st.accTo)+'</div>';
    else if(type!=='Điều chỉnh')h+='<div class="f"><label>Hạng mục</label>'+sel('ct',[['','Chọn…']].concat(cats),st.cat)+'</div>';
    h+='<div class="f"><label>Ngày</label><input id="dt" type="date" value="'+st.date+'"></div><div class="f"><label>Ghi chú</label><input id="nt" value="'+esc(st.note)+'" maxlength="200"></div>';
    fb.innerHTML=h;
    const bind=(id,k)=>{const x=$('#'+id);x&&(x.onchange=x.oninput=()=>{st[k]=x.value})};bind('ac','acc');bind('at','accTo');bind('ct','cat');bind('dt','date');bind('nt','note')}
  $('#ty').onclick=ev=>{const b=ev.target.closest('[data-t]');if(b){type=b.dataset.t;st.cat='';draw()}};draw();
  const f=document.createElement('div');f.className='sh-f';
  const save=btn('Lưu giao dịch','p',()=>{
    const n=parseAmt(am.value),bad=m=>{er.textContent=m};
    if(n===null)return bad('Nhập số tiền hợp lệ');
    if(type==='Điều chỉnh'?n===0:n<=0)return bad(type==='Điều chỉnh'?'Số tiền điều chỉnh phải khác 0':'Số tiền phải lớn hơn 0');
    if(!st.acc)return bad('Chọn tài khoản');
    if(type==='Chuyển khoản'&&(!st.accTo||st.accTo===st.acc))return bad('Chọn tài khoản nhận khác tài khoản nguồn');
    if((type==='Chi'||type==='Thu')&&!st.cat)return bad('Chọn hạng mục');
    if(!st.date)return bad('Chọn ngày');
    const[p,c]=st.cat.split('\u0001'),row={date:st.date,type,amount:n,acc:st.acc,accTo:type==='Chuyển khoản'?st.accTo:'',cat:(type==='Chi'||type==='Thu')?p:'',sub:(type==='Chi'||type==='Thu')?c:'',note:st.note.trim()};
    if(e)row.id=t.id;Store.saveTx(row);UI.close();UI.toast(navigator.onLine?'Đã lưu':'Đã lưu, sẽ gửi khi có mạng')});
  f.append(save);
  if(e)f.append(btn('Xóa','d',async()=>{if(await UI.confirm({title:'Xóa giao dịch?',msg:'Giao dịch sẽ vào Thùng rác trên Google Sheet.',ok:'Xóa',danger:true})){Store.delTx(t.id);UI.toast('Đã xóa',{undo:()=>Store.saveTx(t)})}}));
  $('.sh-b').after(f);setTimeout(()=>am.focus(),80)}
$('#fab').onclick=()=>form(null);
/* ---- Tài khoản & tiện ích ---- */
function renderMore(){
  $('#v-more').innerHTML='<div class="card"><b style="font-size:17px">Tài khoản</b>'+(V.acc.length?V.acc.map(a=>'<div class="li"><span class="m"><b>'+esc(a.name)+'</b><small>'+esc(a.type)+(a.type==='Giữ Hộ'?' · luôn không tính thu chi':'')+'</small></span>'+(a.type==='Giữ Hộ'?'':'<span><small style="color:var(--mut)">Không tính thu chi</small> </span><button class="sw" role="switch" aria-checked="'+!!a.skip+'" data-sk="'+esc(a.name)+'" aria-label="Không tính vào thu chi"></button>')+'</div>').join(''):'<div class="empty">Đang tải…</div>')+'</div><div class="acts"><button class="btn" data-x="sync">Đồng bộ ngay</button><button class="btn" data-x="csv">Xuất CSV</button><button class="btn" data-x="lock">Khóa sổ</button></div>'}
$('#v-more').onclick=async e=>{
  const s=e.target.closest('[data-sk]'),x=e.target.closest('[data-x]');
  if(s){const a=V.acc.find(z=>z.name===s.dataset.sk);if(a){s.setAttribute('aria-checked',String(!a.skip));Store.op({op:'acc.save',acc:{name:a.name,type:a.type,open:a.open,skip:!a.skip},old:a.name});UI.toast('Đang cập nhật tài khoản…')}}
  else if(x){const k=x.dataset.x;
    if(k==='sync'){UI.toast('Đang đồng bộ…');Store.flush();Store.pull()}
    else if(k==='lock'){await Store.logout();login()}
    else if(k==='csv'){const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"',rows=[['Ngày','Loại','Số tiền','Tài khoản','Tài khoản đến','Hạng mục cha','Hạng mục con','Ghi chú']].concat(V.tx.map(t=>[t.date,t.type,t.amount,t.acc,t.accTo,t.cat,t.sub,t.note]));
      const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv'})),download:'so-thu-chi-'+today()+'.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}}};
Store.sub(v=>{V=v;render();renderMore()});render();renderMore();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
