'use strict';
const STORE=(self.CONFIG||{}).STORE||'/api/store',$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const vnd=n=>new Intl.NumberFormat('vi-VN').format(Math.round(n))+' ₫',ymd=d=>{const z=d.getTimezoneOffset()*6e4;return new Date(d-z).toISOString().slice(0,10)};
const HELD='Giữ Hộ',TYPES=['Chi','Thu','Chuyển khoản','Điều chỉnh'],CLS={Thu:'thu',Chi:'chi'},ATI={'Tiền mặt':'💵','Ngân hàng':'🏦','Thẻ tín dụng':'💳','Ví điện tử':'👛','Tiết kiệm':'🐷',[HELD]:'🤝'};
const SID=sessionStorage.sid||(sessionStorage.sid=Math.random().toString(36).slice(2)+Date.now().toString(36));
const TABS=[['home','Tổng quan','🏠'],['tx','Giao dịch','🧾'],['acc','Tài khoản','🏦']];
const S={tx:[],acc:[],cat:[],rev:'',ready:false,err:'',m:ymd(new Date()).slice(0,7),tab:'home',f:'all',q:''};
const sign=t=>t.type==='Thu'||t.type==='Điều chỉnh'?1:-1;
/* ---------- tiện ích ---------- */
let tt;const toast=m=>{const e=$('#ts');e.textContent=m;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),2600)};
const shift=(m,d)=>ymd(new Date(+m.slice(0,4),+m.slice(5)-1+d,15)).slice(0,7),mlabel=m=>'Tháng '+m.slice(5)+'/'+m.slice(0,4);
const parseAmt=v=>{v=String(v).trim().toLowerCase().replace(/\s/g,'');const m=v.match(/^([\d.,]+)(k|nghìn|ngàn|tr|triệu|m|tỷ|ty)?$/);if(!m)return 0;
 const mul={k:1e3,nghìn:1e3,ngàn:1e3,tr:1e6,triệu:1e6,m:1e6,tỷ:1e9,ty:1e9}[m[2]]||1;let n=m[1];n=m[2]?+n.replace(',','.'):+n.replace(/[.,]/g,'');return Math.round(n*mul)||0};
const own=()=>S.acc.filter(a=>a.type!==HELD),held=()=>new Set(S.acc.filter(a=>a.type===HELD).map(a=>a.name));
const ownTx=()=>{const h=held();return h.size?S.tx.filter(t=>!h.has(t.acc)&&!(t.accTo&&h.has(t.accTo))):S.tx};
const bal=a=>S.tx.reduce((s,t)=>(t.acc===a.name?s+sign(t)*t.amount:s)+(t.accTo===a.name&&t.type==='Chuyển khoản'?t.amount:0),+a.open||0);
const sums=m=>ownTx().reduce((o,t)=>{if(t.date.slice(0,7)===m){if(t.type==='Thu')o.thu+=t.amount;else if(t.type==='Chi')o.chi+=t.amount}return o},{thu:0,chi:0});
const byTime=(a,b)=>(b.date+(b.at||'').slice(11)).localeCompare(a.date+(a.at||'').slice(11));
/* ---------- gọi máy chủ ---------- */
async function api(body,ms=30000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);let r,j;
 try{r=await fetch(STORE,{method:'POST',credentials:'same-origin',signal:ac.signal,body:JSON.stringify(body)});j=await r.json()}
 catch(e){const x=Error(navigator.onLine===false?'Không có kết nối mạng':'Không kết nối được máy chủ');x.net=1;throw x}finally{clearTimeout(t)}
 if(j.auth){lock();throw Object.assign(Error('Phiên đã hết hạn'),{net:1})}
 if(j.sess===false){lock('Phiên bị khóa vì thiết bị khác đăng nhập');throw Object.assign(Error('Phiên bị khóa'),{net:1})}
 if(!j.ok){throw Error(j.err||'Lỗi máy chủ')}return j}
function apply(j){if(j.same)return false;['tx','acc','cat'].forEach(k=>S[k]=j[k]||[]);S.rev=j.rev;S.ready=true;
 try{localStorage.cache2=JSON.stringify({tx:S.tx,acc:S.acc,cat:S.cat})}catch(e){}return true}
let busy=0,fails=0;const live=c=>{$('#lv').className='lv '+c};
async function sync(force){if(busy||(document.hidden&&!force))return;
 try{const j=await api({ops:[],rev:force?'':S.rev,sid:SID});fails=0;live('ok');S.err='';if(apply(j)||force)render()}
 catch(e){fails++;live('er');if(!S.ready){S.err=e.message;render()}}}
async function commit(ops,local,okMsg){const snap={tx:S.tx,acc:S.acc,cat:S.cat};busy++;local&&local();render();
 try{const j=await api({ops,rev:'',fast:ops.every(o=>o.op.startsWith('tx.')),sid:SID});if(j.tx)apply(j);else await sync(true);okMsg&&toast(okMsg);return true}
 catch(e){Object.assign(S,snap);render();toast('Không lưu được: '+e.message);return false}finally{busy--}}
/* ---------- đăng nhập / khóa ---------- */
function lock(msg){$('#app').classList.add('hide');$('#lg').classList.remove('hide');$('#pw').value='';$('#le').textContent=msg||'';closeSheet();sessionStorage.removeItem('in')}
$('#lg').onsubmit=async ev=>{ev.preventDefault();const pw=$('#pw').value;if(!pw)return;$('#lb').disabled=true;
 try{const r=await fetch(STORE,{method:'POST',credentials:'same-origin',body:JSON.stringify({login:pw})}),j=await r.json();
  if(j.ok){sessionStorage.in=1;boot()}else $('#le').textContent=j.wait?'Thử lại sau '+Math.ceil(j.wait/60)+' phút':(j.err&&j.err!=='Sai mật khẩu'?j.err:'Sai mật khẩu')}
 catch(e){$('#le').textContent='Không kết nối được máy chủ'}$('#lb').disabled=false};
/* ---------- điều hướng ---------- */
const tabOk=t=>TABS.some(x=>x[0]===t);
function go(t){if(!tabOk(t))t='home';S.tab=t;if(location.hash.slice(1)!==t)location.hash=t;$('#v').scrollTop=0;closeSheet();render()}
addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(tabOk(t)&&t!==S.tab&&!$('#app').classList.contains('hide'))go(t)});
function nav(){$('#nv').innerHTML=TABS.map(([k,l,i])=>`<button class="${S.tab===k?'on':''}" data-go="${k}">${i}<span>${l}</span></button>`).join('');
 const b=TABS.map(([k,l,i])=>`<button class="${S.tab===k?'on':''}" data-go="${k}"><span>${i}</span>${l}</button>`);
 $('#bn').innerHTML=b[0]+b[1]+'<button class="fab" data-a="new" aria-label="Thêm giao dịch">＋</button>'+b[2]}
/* ---------- màn hình ---------- */
const row=t=>{const tr=t.type==='Chuyển khoản',c=t.type==='Chi'?'#E11D48':t.type==='Thu'?'#16A34A':'#2563EB';
 return `<button class="rw" data-edit="${esc(t.id)}"><span class="av" style="--c:${c}">${tr?'🔁':t.type==='Điều chỉnh'?'⚖️':t.type==='Thu'?'💰':'🛍️'}</span><span class="m"><b>${esc(t.sub||t.cat||t.type)}</b><small>${esc(t.acc)}${tr?' → '+esc(t.accTo):''}${t.note?' · '+esc(String(t.note).split(' http')[0]):''}</small></span><span class="a ${CLS[t.type]||''}">${t.type==='Chi'?'−':t.type==='Thu'?'+':''}${vnd(t.amount)}</span></button>`};
const skel='<div class="pg"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
function home(){const {thu,chi}=sums(S.m),total=own().reduce((s,a)=>s+bal(a),0);
 const cats={};ownTx().forEach(t=>{if(t.type==='Chi'&&t.date.slice(0,7)===S.m){const k=t.cat||'Chưa phân loại';cats[k]=(cats[k]||0)+t.amount}});
 const rows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6),mx=rows[0]?rows[0][1]:1;
 const ms=Array.from({length:12},(_,i)=>shift(S.m,i-11)).map(m=>({m,...sums(m)})),top=Math.max(1,...ms.map(x=>Math.max(x.thu,x.chi)));
 const svg=`<svg viewBox="0 0 480 140" width="100%" role="img" aria-label="Thu chi 12 tháng">${ms.map((x,i)=>{const a=x.thu/top*110,b=x.chi/top*110;return `<rect x="${i*40+6}" y="${120-a}" width="14" height="${a}" rx="3" fill="var(--thu)"/><rect x="${i*40+21}" y="${120-b}" width="14" height="${b}" rx="3" fill="var(--chi)"/><text x="${i*40+20}" y="136" font-size="10" text-anchor="middle" fill="var(--mu)">${x.m.slice(5)}</text>`}).join('')}</svg>`;
 const rec=ownTx().filter(t=>t.date.slice(0,7)===S.m).sort(byTime).slice(0,6);
 return `<div class="pg"><div class="kp h"><div class="cd big"><small>Tổng tài sản</small><b>${vnd(total)}</b></div><div class="cd"><small>Thu</small><b class="thu">${vnd(thu)}</b></div><div class="cd"><small>Chi</small><b class="chi">${vnd(chi)}</b></div><div class="cd"><small>Còn lại</small><b class="${thu-chi<0?'chi':''}">${vnd(thu-chi)}</b></div></div>
 <div class="g2 g3"><div class="cd"><h3>Thu chi 12 tháng</h3>${svg}</div><div class="cd"><h3>Chi theo hạng mục</h3>${rows.length?rows.map(([k,v])=>`<div class="bar"><span>${esc(k)}</span><b>${vnd(v)}</b><i><s style="width:${v/mx*100}%"></s></i></div>`).join(''):'<div class="em">Chưa có khoản chi</div>'}</div></div>
 <div class="cd"><h3>Gần đây <button class="mut" data-go="tx" style="float:right">Xem tất cả ›</button></h3>${rec.length?rec.map(row).join(''):'<div class="em">Chưa có giao dịch.<br>Bấm ＋ để ghi khoản đầu tiên.</div>'}</div></div>`}
function txs(){const q=S.q.toLowerCase();
 const l=S.tx.filter(t=>t.date.slice(0,7)===S.m&&(S.f==='all'||t.type===S.f)&&(!q||[t.note,t.cat,t.sub,t.acc,t.accTo,t.amount].join(' ').toLowerCase().includes(q))).sort(byTime);
 const days={};l.forEach(t=>(days[t.date]=days[t.date]||[]).push(t));
 const th=l.filter(t=>t.type==='Thu').reduce((s,t)=>s+t.amount,0),ch=l.filter(t=>t.type==='Chi').reduce((s,t)=>s+t.amount,0);
 const body=Object.entries(days).map(([d,a])=>{const n=a.reduce((s,t)=>s+(t.type==='Chi'?-t.amount:t.type==='Thu'?t.amount:0),0),dt=new Date(d+'T12:00');
  return `<div class="dh"><span>${['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()]}, ${d.slice(8)}/${d.slice(5,7)}</span><span>${n>0?'+':''}${vnd(n)}</span></div>`+a.map(row).join('')}).join('');
 return `<div class="pg"><div class="tb"><input class="sr" id="q" type="search" placeholder="Tìm ghi chú, hạng mục, tài khoản…" value="${esc(S.q)}" aria-label="Tìm kiếm"><div class="sg">${['all',...TYPES].map(k=>`<button class="${S.f===k?'on':''}" data-f="${k}">${k==='all'?'Tất cả':k}</button>`).join('')}</div>
 <div class="mut">${l.length} giao dịch · <span class="thu">+${vnd(th)}</span> · <span class="chi">−${vnd(ch)}</span></div></div><div class="cd" id="lst">${body||'<div class="em">Không có giao dịch phù hợp</div>'}</div></div>`}
function accs(){const L=S.acc.map(a=>({a,b:bal(a)}));
 return `<div class="pg"><div class="g2 w3">${L.map(({a,b})=>`<div class="cd rw" style="cursor:default"><span class="av">${ATI[a.type]||'🏦'}</span><span class="m"><b>${esc(a.name)}</b><small>${esc(a.type)}</small></span><span class="a ${b<0?'chi':''}">${vnd(b)}</span></div>`).join('')||'<div class="em">Chưa có tài khoản</div>'}</div><p class="mut" style="text-align:center">Thêm / sửa tài khoản: dùng giao diện cũ hoặc Google Sheet.</p></div>`}
const VIEWS={home,tx:txs,acc:accs},MONTHLY=['home','tx'];
function render(){nav();const t=TABS.find(x=>x[0]===S.tab);$('#ttl').textContent=t[1];
 $('#mn').innerHTML=MONTHLY.includes(S.tab)?`<div class="mn"><button data-m="-1" aria-label="Tháng trước">‹</button><b>${mlabel(S.m)}</b><button data-m="1" aria-label="Tháng sau">›</button></div>`:'';
 const v=$('#v'),h=!S.ready?(S.err?`<div class="pg"><div class="cd em"><b>Chưa tải được dữ liệu</b><p>${esc(S.err)}</p><br><button class="btn p" data-a="retry">Thử lại</button></div></div>`:skel):VIEWS[S.tab]();
 const keep=document.activeElement&&document.activeElement.id==='q',st=v.scrollTop;
 if(keep&&S.tab==='tx'){const l=$('#lst');if(l){const tmp=document.createElement('div');tmp.innerHTML=h;l.innerHTML=tmp.querySelector('#lst').innerHTML;return}}
 v.innerHTML=h;if(v.dataset.t===S.tab)v.scrollTop=st;v.dataset.t=S.tab}
/* ---------- form ---------- */
let F=null;const openSheet=h=>{$('#sh').innerHTML=h;$('#ov').classList.add('on')},closeSheet=()=>{$('#ov').classList.remove('on');F=null};
const opts=(a,c)=>a.map(x=>`<option${x===c?' selected':''}>${esc(x)}</option>`).join('');
function catOpts(type,cur){const g={};S.cat.filter(c=>c.t===type).forEach(c=>(g[c.p]=g[c.p]||[]).push(c.c));
 return Object.entries(g).map(([p,a])=>`<optgroup label="${esc(p)}">${a.map(c=>`<option value="${esc(p)}|${esc(c)}"${cur===p+'|'+c?' selected':''}>${esc(c)}</option>`).join('')}</optgroup>`).join('')}
function form(t){const isNew=!t;t=t||{id:'G'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),date:ymd(new Date()),type:'Chi',amount:0,acc:(own()[0]||{}).name||'',accTo:'',cat:'',sub:'',note:''};
 F={...t,isNew};draw()}
function draw(){const t=F,x=t.type==='Chuyển khoản'||t.type==='Điều chỉnh',names=S.acc.map(a=>a.name);
 openSheet(`<h2>${F.isNew?'Thêm giao dịch':'Sửa giao dịch'}</h2><div class="fd"><div class="seg">${TYPES.map(k=>`<button type="button" class="${t.type===k?'on':''}" data-ty="${k}">${k}</button>`).join('')}</div>
 <input class="amt" id="fa" inputmode="decimal" placeholder="0 (gõ 50k, 1.5tr…)" value="${t.amount?new Intl.NumberFormat('vi-VN').format(t.amount):''}" aria-label="Số tiền">
 <div class="r2"><label>Ngày<input id="fd" type="date" value="${t.date}"></label><label>${t.type==='Chuyển khoản'?'Từ tài khoản':'Tài khoản'}<select id="fc">${opts(names,t.acc)}</select></label></div>
 ${t.type==='Chuyển khoản'?`<label>Đến tài khoản<select id="ft">${opts(names.filter(n=>n!==t.acc),t.accTo)}</select></label>`:''}
 ${x?'':`<label>Hạng mục<select id="fk"><option value="">— Chưa phân loại —</option>${catOpts(t.type,t.cat+'|'+t.sub)}</select></label>`}
 <label>Ghi chú<input id="fn" value="${esc(t.note)}" placeholder="Tuỳ chọn"></label>
 <button class="btn p w" data-a="save">Lưu</button>${F.isNew?'':'<button class="btn d w" data-a="del">Xóa giao dịch</button>'}</div>`);
 if(F.isNew)setTimeout(()=>{const e=$('#fa');e&&e.focus()},250)}
function pull(){const g=i=>{const e=$('#'+i);return e?e.value:null};F.amount=parseAmt(g('fa')||0)||0;F.date=g('fd')||F.date;F.acc=g('fc')||F.acc;
 if(g('ft')!==null)F.accTo=g('ft');if(g('fn')!==null)F.note=g('fn');const k=g('fk');if(k!==null){const [p,c]=k?k.split('|'):['',''];F.cat=p;F.sub=c}}
async function save(){pull();const t=F,x=t.type==='Chuyển khoản'||t.type==='Điều chỉnh';
 if(!(t.amount>0))return toast('Nhập số tiền');if(!t.acc)return toast('Chọn tài khoản');if(t.type==='Chuyển khoản'&&!t.accTo)return toast('Chọn tài khoản nhận');
 const r={id:t.id,date:t.date,type:t.type,amount:t.amount,acc:t.acc,accTo:t.type==='Chuyển khoản'?t.accTo:'',cat:x?'':t.cat,sub:x?'':t.sub,note:t.note||''};
 closeSheet();commit([{op:'tx.save',row:r}],()=>{S.tx=S.tx.some(y=>y.id===r.id)?S.tx.map(y=>y.id===r.id?r:y):S.tx.concat(r)},'Đã lưu')}
function del(){const id=F.id;closeSheet();commit([{op:'tx.del',id}],()=>{S.tx=S.tx.filter(x=>x.id!==id)},'Đã chuyển vào Thùng rác')}
/* ---------- sự kiện ---------- */
document.addEventListener('click',e=>{const t=e.target.closest('[data-go],[data-a],[data-m],[data-f],[data-edit],[data-ty]');
 if(e.target.id==='ov')return closeSheet();if(!t)return;const d=t.dataset;
 if(d.go)return go(d.go);if(d.m){S.m=shift(S.m,+d.m);return render()}if(d.f){S.f=d.f;return render()}
 if(d.edit){const x=S.tx.find(y=>y.id===d.edit);return x&&form(x)}
 if(d.ty){pull();F.type=d.ty;if(d.ty==='Chuyển khoản')F.accTo=(S.acc.find(a=>a.name!==F.acc)||{}).name||'';return draw()}
 switch(d.a){case 'new':return form();case 'save':return save();case 'del':return del();case 'lock':return fetch(STORE,{method:'POST',credentials:'same-origin',body:JSON.stringify({logout:1})}).catch(()=>{}),lock();
  case 'retry':S.err='';render();return sync(true);case 'theme':{const c=document.documentElement,dk=getComputedStyle(c).getPropertyValue('--bg').trim()==='#0B1020';c.dataset.t=dk?'light':'dark';try{localStorage.theme=c.dataset.t}catch(x){}}}});
document.addEventListener('input',e=>{if(e.target.id==='q'){S.q=e.target.value;render()}if(e.target.id==='fa'){const v=e.target.value;if(/^[\d.,]+$/.test(v)){const n=+v.replace(/[.,]/g,'');e.target.value=n?new Intl.NumberFormat('vi-VN').format(n):''}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;if(e.key==='n'||e.key==='N'){e.preventDefault();form()}});
document.addEventListener('visibilitychange',()=>!document.hidden&&sync());addEventListener('focus',()=>sync());addEventListener('online',()=>sync(true));
setInterval(()=>sync(),20000);
/* ---------- khởi động ---------- */
function boot(){$('#lg').classList.add('hide');$('#app').classList.remove('hide');const h=location.hash.slice(1);S.tab=tabOk(h)?h:'home';
 try{const c=JSON.parse(localStorage.cache2||'null');if(c&&!S.ready){Object.assign(S,c);S.ready=true}}catch(e){}render();sync(true)}
(async()=>{try{const j=await api({ops:[],rev:'',sid:SID});apply(j);boot()}catch(e){if(!e.net||!$('#app').classList.contains('hide')){/* đã ở màn khóa */}
 if($('#lg').classList.contains('hide')&&$('#app').classList.contains('hide'))$('#lg').classList.remove('hide')}})();
