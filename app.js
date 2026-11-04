'use strict';
const STORE=(self.CONFIG||{}).STORE||'/api/store',$=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf=new Intl.NumberFormat('vi-VN'),vnd=n=>nf.format(Math.round(n))+' ₫',S$=n=>`<span class="s">${vnd(n)}</span>`;
const ymd=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10),today=()=>ymd(new Date()),dAdd=n=>{const d=new Date();d.setDate(d.getDate()+n);return ymd(d)};
const HELD='Giữ Hộ',TYPES=['Chi','Thu','Chuyển khoản','Điều chỉnh'],TC={Chi:'#E11D48',Thu:'#059669','Chuyển khoản':'#2563EB','Điều chỉnh':'#D97706'},CLS={Thu:'thu',Chi:'chi'};
const ATYPES=['Tiền mặt','Ngân hàng','Thẻ tín dụng','Ví điện tử','Tiết kiệm',HELD],ATI={'Tiền mặt':'💵','Ngân hàng':'🏦','Thẻ tín dụng':'💳','Ví điện tử':'👛','Tiết kiệm':'🐷',[HELD]:'🤝'},ATC={'Tiền mặt':'#10B981','Ngân hàng':'#3B82F6','Thẻ tín dụng':'#8B5CF6','Ví điện tử':'#EC4899','Tiết kiệm':'#F59E0B',[HELD]:'#64748B'};
const PAL=['#6366F1','#EC4899','#F59E0B','#10B981','#06B6D4','#8B5CF6','#EF4444','#84CC16','#F97316','#14B8A6'];
const hs=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h},colOf=s=>PAL[hs(s)%PAL.length];
const EMO=[[/ăn|uống|cafe|cà phê|nhà hàng|thực phẩm|chợ/i,'🍜'],[/xe|xăng|đi lại|grab|taxi/i,'🚗'],[/nhà|điện|nước|thuê|internet|gas/i,'🏠'],[/mua|sắm|quần|áo|shop/i,'🛍️'],[/y tế|thuốc|khám|sức khỏe/i,'💊'],[/học|sách|giáo dục/i,'📚'],[/giải trí|phim|game|du lịch/i,'🎬'],[/lương|thưởng|thu nhập/i,'💰'],[/quà|biếu|từ thiện/i,'🎁'],[/con|bé|trẻ/i,'🧸'],[/điện thoại|phí|dịch vụ/i,'📱'],[/đầu tư|lãi|cổ phiếu/i,'📈']];
const emo=s=>{for(const [r,e] of EMO)if(r.test(s))return e;return '🏷️'};
const SID=sessionStorage.sid||(sessionStorage.sid=Math.random().toString(36).slice(2)+Date.now().toString(36));
const TABS=[['home','Tổng quan','🏠'],['tx','Giao dịch','🧾'],['stat','Thống kê','📊'],['acc','Tài khoản','💳']],MONTHLY=['home','tx','stat'];
const S={tx:[],acc:[],cat:[],trash:[],rev:'',ready:false,err:'',m:today().slice(0,7),tab:'home',f:'all',q:'',pg:80};
/* ---------- tiện ích ---------- */
const sign=t=>t.type==='Thu'||t.type==='Điều chỉnh'?1:-1,mOf=t=>t.date.slice(0,7);
const shift=(m,d)=>ymd(new Date(+m.slice(0,4),+m.slice(5)-1+d,15)).slice(0,7),mlabel=m=>'Tháng '+m.slice(5)+'/'+m.slice(0,4);
function parseAmt(v){v=String(v).trim().toLowerCase().replace(/\s/g,'');const g=v.match(/^([\d.,]+)(k|nghìn|ngàn|tr|triệu|m|tỷ|ty)?$/);if(!g)return 0;
 const mul={k:1e3,nghìn:1e3,ngàn:1e3,tr:1e6,triệu:1e6,m:1e6,tỷ:1e9,ty:1e9}[g[2]]||1;return Math.round((g[2]?+g[1].replace(',','.'):+g[1].replace(/[.,]/g,''))*mul)||0}
const own=()=>S.acc.filter(a=>a.type!==HELD),held=()=>new Set(S.acc.filter(a=>a.type===HELD).map(a=>a.name));
const ownTx=()=>{const h=held();return h.size?S.tx.filter(t=>!h.has(t.acc)&&!(t.accTo&&h.has(t.accTo))):S.tx};
function balMap(){const B={};S.acc.forEach(a=>B[a.name]=+a.open||0);S.tx.forEach(t=>{B[t.acc]=(B[t.acc]||0)+sign(t)*t.amount;if(t.type==='Chuyển khoản'&&t.accTo)B[t.accTo]=(B[t.accTo]||0)+t.amount});return B}
const sums=m=>ownTx().reduce((o,t)=>{if(mOf(t)===m){if(t.type==='Thu')o.thu+=t.amount;else if(t.type==='Chi')o.chi+=t.amount}return o},{thu:0,chi:0});
const catAgg=m=>{const o={};ownTx().forEach(t=>{if(t.type==='Chi'&&mOf(t)===m){const k=t.cat||'Chưa phân loại';o[k]=(o[k]||0)+t.amount}});return Object.entries(o).sort((a,b)=>b[1]-a[1])};
const byTime=(a,b)=>(b.date+(b.at||'').slice(11)).localeCompare(a.date+(a.at||'').slice(11));
const dlt=(c,p,inv)=>{if(!p)return '';const x=Math.round((c-p)/p*100);return `<span class="dt ${x===0?'':(x>0)!==!!inv?'thu':'chi'}">${x>0?'▲':x<0?'▼':'='} ${Math.abs(x)}%</span>`};
let tt,UN=null;function toast(m,lab,fn){const e=$('#ts');UN=fn||null;e.innerHTML='<span>'+esc(m)+'</span>'+(lab?`<button data-a="undo">${lab}</button>`:'');e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>{e.classList.remove('on');UN=null},lab?7000:2600)}
/* ---------- máy chủ ---------- */
async function api(body,ms=30000){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),ms);let r,j;
 try{r=await fetch(STORE,{method:'POST',credentials:'same-origin',signal:ac.signal,body:JSON.stringify(body)});j=await r.json()}
 catch(e){throw Object.assign(Error(navigator.onLine===false?'Không có kết nối mạng':'Không kết nối được máy chủ'),{net:1})}finally{clearTimeout(t)}
 if(j.auth){lock();throw Object.assign(Error('Phiên đã hết hạn'),{net:1})}
 if(j.sess===false){lock('Phiên bị khóa vì thiết bị khác đăng nhập');throw Object.assign(Error('Phiên bị khóa'),{net:1})}
 if(!j.ok)throw Error(j.err||'Lỗi máy chủ');return j}
function apply(j){if(j.same)return false;['tx','acc','cat','trash'].forEach(k=>S[k]=j[k]||[]);S.rev=j.rev;S.ready=true;try{localStorage.cache2=JSON.stringify({tx:S.tx,acc:S.acc,cat:S.cat})}catch(e){}return true}
let busy=0;const live=c=>{$('#lv').className='lv '+c};
async function sync(force){if(busy||(document.hidden&&!force))return;
 try{const j=await api({ops:[],rev:force?'':S.rev,sid:SID});live('ok');S.err='';if(apply(j)||force)render()}catch(e){live('er');if(!S.ready){S.err=e.message;render()}}}
async function commit(ops,local,msg,undo){const snap={tx:S.tx,acc:S.acc,cat:S.cat};busy++;local&&local();render();
 try{const j=await api({ops,rev:'',fast:ops.every(o=>o.op.startsWith('tx.')),sid:SID});if(j.tx)apply(j);else{busy--;await sync(true);busy++}msg&&toast(msg,undo&&'Hoàn tác',undo);return true}
 catch(e){Object.assign(S,snap);render();toast('Không lưu được: '+e.message);return false}finally{busy--}}
/* ---------- đăng nhập ---------- */
function lock(msg){$('#app').classList.add('hide');$('#lg').classList.remove('hide');$('#pw').value='';$('#le').textContent=msg||'';closeSheet()}
$('#lg').onsubmit=async ev=>{ev.preventDefault();const pw=$('#pw').value;if(!pw)return;$('#lb').disabled=true;
 try{const r=await fetch(STORE,{method:'POST',credentials:'same-origin',body:JSON.stringify({login:pw})}),j=await r.json();
  if(j.ok)boot();else{$('#le').textContent=j.wait?'Thử lại sau '+Math.ceil(j.wait/60)+' phút':(j.err&&j.err!=='Sai mật khẩu'?j.err:'Sai mật khẩu');$('#lg .lgc').classList.remove('shake');void $('#lg').offsetWidth;$('#lg .lgc').classList.add('shake');$('#pw').select()}}
 catch(e){$('#le').textContent='Không kết nối được máy chủ'}$('#lb').disabled=false};
/* ---------- điều hướng ---------- */
const tabOk=t=>TABS.some(x=>x[0]===t);
function go(t){if(!tabOk(t))t='home';S.tab=t;S.pg=80;if(location.hash.slice(1)!==t)location.hash=t;$('#v').scrollTop=0;closeSheet();render()}
addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(tabOk(t)&&t!==S.tab&&!$('#app').classList.contains('hide'))go(t)});
function nav(){$('#nv').innerHTML=TABS.map(([k,l,i])=>`<button class="${S.tab===k?'on':''}" data-go="${k}"><span>${i}</span>${l}</button>`).join('');
 const b=TABS.map(([k,l,i])=>`<button class="${S.tab===k?'on':''}" data-go="${k}"><span>${i}</span>${l}</button>`);
 $('#bn').innerHTML=b[0]+b[1]+'<button class="fab" data-a="new" aria-label="Thêm giao dịch">＋</button>'+b[2]+b[3]}
/* ---------- thành phần ---------- */
const row=t=>{const tr=t.type==='Chuyển khoản',c=tr?'#2563EB':t.type==='Điều chỉnh'?'#D97706':colOf(t.cat||t.type),ic=tr?'🔁':t.type==='Điều chỉnh'?'⚖️':emo(t.cat||'');
 return `<button class="rw" data-edit="${esc(t.id)}"><span class="av" style="--c:${c}">${ic}</span><span class="m"><b>${esc(t.sub||t.cat||t.type)}</b><small>${esc(t.acc)}${tr?' → '+esc(t.accTo):''}${t.note?' · '+esc(String(t.note).split(' http')[0]):''}</small></span><span class="a tn ${CLS[t.type]||''}"><span class="s">${t.type==='Chi'?'−':t.type==='Thu'?'+':''}${vnd(t.amount)}</span></span></button>`};
const accCard=(a,b)=>`<button class="ac" style="--c:${ATC[a.type]||'#6366F1'}" data-acc="${esc(a.name)}"><span class="t"><span>${ATI[a.type]||'🏦'}</span>${esc(a.name)}</span><span><small>${esc(a.type)}</small><br><b class="tn s">${vnd(b)}</b></span></button>`;
const skel='<div class="gr pg"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
function donut(rows,tot){let a=0;const g=rows.map(([k,v])=>{const s=a;a+=v/tot*100;return `${colOf(k)} ${s}% ${a}%`}).join(',');
 return `<div class="dl"><div class="dn" style="background:conic-gradient(${g||'var(--ln) 0 100%'})"><i><span>Tổng chi<b class="s">${vnd(tot)}</b></span></i></div><div>${rows.slice(0,6).map(([k,v])=>`<div class="bar" style="--c:${colOf(k)}"><span>${emo(k)} ${esc(k)}</span><b class="tn"><span class="s">${vnd(v)}</span> <small class="mut">${Math.round(v/tot*100)}%</small></b><i><s style="width:${v/rows[0][1]*100}%"></s></i></div>`).join('')||'<div class="em">Chưa có khoản chi</div>'}</div></div>`}
/* ---------- màn hình ---------- */
function home(){const {thu,chi}=sums(S.m),B=balMap(),total=own().reduce((s,a)=>s+(B[a.name]||0),0),pv=sums(shift(S.m,-1));
 const cur=S.m===today().slice(0,7),dn=cur?+today().slice(8):new Date(+S.m.slice(0,4),+S.m.slice(5),0).getDate(),cats=catAgg(S.m);
 const ms=Array.from({length:12},(_,i)=>shift(S.m,i-11)).map(m=>({m,...sums(m)})),top=Math.max(1,...ms.map(x=>Math.max(x.thu,x.chi)));
 const svg=`<svg viewBox="0 0 480 150" width="100%" role="img" aria-label="Thu chi 12 tháng">${[0,.5,1].map(f=>`<line x1="0" x2="480" y1="${120-f*110}" y2="${120-f*110}" stroke="var(--ln)" stroke-dasharray="3 4"/>`).join('')}${ms.map((x,i)=>{const a=x.thu/top*110,b=x.chi/top*110,cm=x.m===S.m;return `<g opacity="${cm?1:.55}"><rect x="${i*40+5}" y="${120-a}" width="14" height="${a}" rx="5" fill="var(--thu)"/><rect x="${i*40+21}" y="${120-b}" width="14" height="${b}" rx="5" fill="var(--chi)"/></g><text x="${i*40+20}" y="140" font-size="11" text-anchor="middle" font-weight="${cm?700:400}" fill="var(--mu)">${x.m.slice(5)}</text>`}).join('')}</svg>`;
 const rec=ownTx().filter(t=>mOf(t)===S.m).sort(byTime).slice(0,7);
 return `<div class="gr pg"><div class="c8"><div class="hero"><div><small>Tổng tài sản</small><div class="tot tn s">${vnd(total)}</div></div><div class="pl"><div><small>Thu</small><b class="tn s">${vnd(thu)}</b></div><div><small>Chi</small><b class="tn s">${vnd(chi)}</b></div><div><small>Còn lại</small><b class="tn s">${vnd(thu-chi)}</b></div></div></div></div>
 <div class="c4 cd st"><h3>Tháng này</h3><div><small>Chi trung bình / ngày</small><b class="tn s">${vnd(chi/dn)}</b></div><div><small>Chi so với tháng trước</small>${dlt(chi,pv.chi,1)||'<small>–</small>'}</div><div><small>Tỉ lệ tiết kiệm</small><b>${thu?Math.round((thu-chi)/thu*100):0}%</b></div><div><small>Số giao dịch</small><b>${ownTx().filter(t=>mOf(t)===S.m).length}</b></div></div>
 <div><div class="sh"><h3>Tài khoản</h3><button data-go="acc">Quản lý ›</button></div><div class="car">${S.acc.map(a=>accCard(a,B[a.name]||0)).join('')||'<div class="cd em">Chưa có tài khoản</div>'}</div></div>
 <div class="c8 cd"><h3 style="margin-bottom:6px">Thu chi 12 tháng</h3>${svg}</div><div class="c4 cd"><h3>Chi theo hạng mục</h3>${cats.slice(0,5).map(([k,v])=>`<div class="bar" style="--c:${colOf(k)}"><span>${emo(k)} ${esc(k)}</span><b class="tn s">${vnd(v)}</b><i><s style="width:${v/cats[0][1]*100}%"></s></i></div>`).join('')||'<div class="em">Chưa có khoản chi</div>'}</div>
 <div class="cd"><div class="sh"><h3>Gần đây</h3><button data-go="tx">Xem tất cả ›</button></div>${rec.length?rec.map(row).join(''):'<div class="em">Chưa có giao dịch.<br>Bấm ＋ để ghi khoản đầu tiên.</div>'}</div></div>`}
function listHtml(){const q=S.q.toLowerCase().trim();
 const l=S.tx.filter(t=>mOf(t)===S.m&&(S.f==='all'||t.type===S.f)&&(!q||[t.note,t.cat,t.sub,t.acc,t.accTo,t.amount].join(' ').toLowerCase().includes(q))).sort(byTime),sh=l.slice(0,S.pg),days={};
 sh.forEach(t=>(days[t.date]=days[t.date]||[]).push(t));
 const th=l.filter(t=>t.type==='Thu').reduce((s,t)=>s+t.amount,0),ch=l.filter(t=>t.type==='Chi').reduce((s,t)=>s+t.amount,0);
 const body=Object.entries(days).map(([d,a])=>{const n=a.reduce((s,t)=>s+(t.type==='Chi'?-t.amount:t.type==='Thu'?t.amount:0),0),dt=new Date(d+'T12:00');
  return `<div class="dh"><span>${d===today()?'Hôm nay':['CN','T2','T3','T4','T5','T6','T7'][dt.getDay()]+', '+d.slice(8)+'/'+d.slice(5,7)}</span><span class="tn s">${n>0?'+':''}${vnd(n)}</span></div>`+a.map(row).join('')}).join('');
 return {cnt:`${l.length} giao dịch · <span class="thu s">+${vnd(th)}</span> · <span class="chi s">−${vnd(ch)}</span>`,list:(body||'<div class="em">Không có giao dịch phù hợp</div>')+(l.length>sh.length?'<button class="btn w" data-a="more" style="margin-top:10px">Xem thêm</button>':'')}}
function txs(){const L=listHtml();
 return `<div class="pg"><div class="tb"><input class="sr" id="q" type="search" placeholder="🔍  Tìm ghi chú, hạng mục, tài khoản…  ( / )" value="${esc(S.q)}" aria-label="Tìm kiếm"><div class="sg">${['all',...TYPES].map(k=>`<button class="ch ${S.f===k?'on':''}" style="--c:${TC[k]||'#6366F1'}" data-f="${k}">${k==='all'?'Tất cả':k}</button>`).join('')}</div><div class="mut" id="cnt">${L.cnt}</div></div><div class="cd" id="lst">${L.list}</div></div>`}
function stat(){const {thu,chi}=sums(S.m),p=sums(shift(S.m,-1)),cats=catAgg(S.m),dn=new Date(+S.m.slice(0,4),+S.m.slice(5),0).getDate(),dc={};
 ownTx().forEach(t=>{if(t.type==='Chi'&&mOf(t)===S.m){const d=+t.date.slice(8);dc[d]=(dc[d]||0)+t.amount}});const mx=Math.max(1,...Object.values(dc)),w=480/dn;
 const dbar=`<svg viewBox="0 0 480 120" width="100%" role="img" aria-label="Chi theo ngày">${Array.from({length:dn},(_,i)=>{const v=dc[i+1]||0,h=v/mx*95;return `<rect x="${i*w+1.5}" y="${105-h}" width="${w-3}" height="${Math.max(h,2)}" rx="3" fill="${v?'var(--chi)':'var(--ln)'}" opacity="${v?1:.6}"/>${(i+1)%5===0||i===0?`<text x="${i*w+w/2}" y="118" font-size="10" text-anchor="middle" fill="var(--mu)">${i+1}</text>`:''}`}).join('')}</svg>`;
 const big=ownTx().filter(t=>t.type==='Chi'&&mOf(t)===S.m).sort((a,b)=>b.amount-a.amount).slice(0,5);
 const kp=(l,v,pv,c,inv)=>`<div class="cd st"><div><small>${l}</small>${dlt(v,pv,inv)}</div><b class="tn s ${c}" style="font-size:22px">${vnd(v)}</b></div>`;
 return `<div class="gr pg"><div class="c4">${kp('Thu',thu,p.thu,'thu')}</div><div class="c4">${kp('Chi',chi,p.chi,'chi',1)}</div><div class="c4">${kp('Còn lại',thu-chi,p.thu-p.chi,thu-chi<0?'chi':'')}</div>
 <div class="c6 cd"><h3 style="margin-bottom:12px">Cơ cấu chi tiêu</h3>${donut(cats,chi)}</div><div class="c6 cd"><h3 style="margin-bottom:8px">Chi theo ngày</h3>${dbar}</div>
 <div class="cd"><h3>5 khoản chi lớn nhất</h3>${big.map(row).join('')||'<div class="em">Chưa có khoản chi</div>'}</div></div>`}
function accs(){const B=balMap();
 return `<div class="gr pg"><div class="c12 car">${S.acc.map(a=>accCard(a,B[a.name]||0)).join('')}<button class="ac add" data-acc="">＋ Thêm tài khoản</button></div></div>`}
const VIEWS={home,tx:txs,stat,acc:accs};
function render(){nav();const t=TABS.find(x=>x[0]===S.tab);$('#ttl').textContent=t[1];
 $('#mn').innerHTML=MONTHLY.includes(S.tab)?`<div class="mn"><button data-m="-1" aria-label="Tháng trước">‹</button><b>${mlabel(S.m)}</b><button data-m="1" aria-label="Tháng sau">›</button></div>`:'';
 const v=$('#v'),h=!S.ready?(S.err?`<div class="pg"><div class="cd em"><b>Chưa tải được dữ liệu</b><p>${esc(S.err)}</p><br><button class="btn p" data-a="retry">Thử lại</button></div></div>`:skel):VIEWS[S.tab](),st=v.scrollTop,same=v.dataset.t===S.tab;
 if(same&&document.activeElement&&document.activeElement.id==='q'&&S.tab==='tx'){const L=listHtml();$('#lst').innerHTML=L.list;$('#cnt').innerHTML=L.cnt;return}
 v.innerHTML=h;v.dataset.t=S.tab;if(same)v.scrollTop=st}
/* ---------- form giao dịch ---------- */
let F=null,A=null;const closeSheet=()=>{$('#ov').classList.remove('on');F=A=null},openSheet=h=>{$('#sh').innerHTML=h;$('#ov').classList.add('on')};
const newId=()=>'G'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36);
function form(t,dup){let la='';try{la=localStorage.lastAcc||''}catch(e){}const names=S.acc.map(a=>a.name),def=names.includes(la)?la:(own()[0]||{}).name||names[0]||'';
 F=t?{...t,isNew:!!dup}:{id:newId(),date:today(),type:'Chi',amount:0,acc:def,accTo:'',cat:'',sub:'',note:'',isNew:true};
 if(dup){F.id=newId();F.date=today()}F.focus=F.isNew;draw()}
function catChips(){const g={};S.cat.filter(c=>c.t===F.type).forEach(c=>(g[c.p]=g[c.p]||[]).push(c.c));
 const e=Object.entries(g);return e.length?e.map(([p,a])=>`<small>${emo(p)} ${esc(p)}</small><div class="wr">${a.map(c=>`<button type="button" class="ch ${F.cat===p&&F.sub===c?'on':''}" style="--c:${colOf(p)}" data-cat="${esc(p)}|${esc(c)}">${esc(c)}</button>`).join('')}</div>`).join(''):'<small>Chưa có hạng mục cho loại này</small>'}
function draw(){const t=F,x=t.type==='Chuyển khoản'||t.type==='Điều chỉnh',c=TC[t.type],ac=(n,k,cur)=>S.acc.filter(a=>a.name!==cur||k==='acc').map(a=>`<button type="button" class="ch ${t[k]===a.name?'on':''}" style="--c:${ATC[a.type]||'#6366F1'}" data-${k==='acc'?'acc':'to'}="${esc(a.name)}">${ATI[a.type]||'🏦'} ${esc(a.name)}</button>`).join('');
 openSheet(`<h2>${t.isNew?'Thêm giao dịch':'Sửa giao dịch'}</h2><div class="fd" style="--c:${c}"><div class="seg">${TYPES.map(k=>`<button type="button" class="${t.type===k?'on':''}" style="--c:${TC[k]}" data-ty="${k}">${k}</button>`).join('')}</div>
 <div class="amt"><input id="fa" inputmode="decimal" placeholder="0" value="${t.amount?nf.format(t.amount):''}" aria-label="Số tiền" autocomplete="off"><div class="qs">${[10e3,50e3,100e3,500e3].map(q=>`<button type="button" class="ch" data-q="${q}">+${q/1e3}k</button>`).join('')}<button type="button" class="ch" data-q="0">Xóa</button></div></div>
 ${x?'':`<div class="lb">Hạng mục<div class="cs">${catChips()}</div></div>`}
 <div class="lb">${t.type==='Chuyển khoản'?'Từ tài khoản':'Tài khoản'}<div class="wr">${ac(0,'acc')}</div></div>
 ${t.type==='Chuyển khoản'?`<div class="lb">Đến tài khoản<div class="wr">${ac(0,'to',t.acc)}</div></div>`:''}
 <div class="lb">Ngày<div class="wr"><button type="button" class="ch ${t.date===today()?'on':''}" data-d="0">Hôm nay</button><button type="button" class="ch ${t.date===dAdd(-1)?'on':''}" data-d="-1">Hôm qua</button><input id="fd" type="date" value="${t.date}" style="flex:1;min-width:140px"></div></div>
 <label>Ghi chú<input id="fn" value="${esc(t.note)}" placeholder="Tuỳ chọn" autocomplete="off"></label>
 <button class="btn p w" data-a="save">${t.isNew?'Lưu giao dịch':'Lưu thay đổi'}</button>${t.isNew?'':'<div class="r2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn w" data-a="dup">Nhân bản</button><button class="btn d w" data-a="del">Xóa</button></div>'}</div>`);
 if(F.focus){F.focus=false;setTimeout(()=>{const e=$('#fa');e&&e.focus()},280)}}
function save(){const t=F,x=t.type==='Chuyển khoản'||t.type==='Điều chỉnh';
 const bad=m=>{toast(m);const e=$('#fa');if(e){e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake')}};
 if(!(t.amount>0))return bad('Nhập số tiền');if(!t.acc)return toast('Chọn tài khoản');if(t.type==='Chuyển khoản'&&!t.accTo)return toast('Chọn tài khoản nhận');
 const r={id:t.id,date:t.date||today(),type:t.type,amount:t.amount,acc:t.acc,accTo:t.type==='Chuyển khoản'?t.accTo:'',cat:x?'':t.cat,sub:x?'':t.sub,note:t.note||''};
 try{localStorage.lastAcc=t.acc}catch(e){}const isNew=!S.tx.some(y=>y.id===r.id),old=S.tx.find(y=>y.id===r.id);closeSheet();
 commit([{op:'tx.save',row:r}],()=>{S.tx=isNew?S.tx.concat(r):S.tx.map(y=>y.id===r.id?r:y)},isNew?'Đã thêm giao dịch':'Đã cập nhật',()=>commit(old?[{op:'tx.save',row:old}]:[{op:'tx.purge',id:r.id}],()=>{S.tx=S.tx.filter(y=>y.id!==r.id);if(old)S.tx=S.tx.concat(old)},'Đã hoàn tác'))}
function del(){const id=F.id,old=S.tx.find(x=>x.id===id);if(!old)return closeSheet();closeSheet();
 commit([{op:'tx.del',id}],()=>{S.tx=S.tx.filter(x=>x.id!==id)},'Đã chuyển vào Thùng rác',()=>{const tr=S.trash.find(t=>t.k==='gd'&&t.id===id);
  commit(tr?[{op:'restore',at:tr.at,kind:'gd'},{op:'tx.save',row:old}]:[{op:'tx.save',row:old}],()=>{S.tx=S.tx.filter(x=>x.id!==id).concat(old)},'Đã hoàn tác')})}
/* ---------- form tài khoản ---------- */
function accForm(name){const o=name?S.acc.find(a=>a.name===name):null;A={old:o,name:o?o.name:'',type:o?o.type:ATYPES[0],open:o?+o.open||0:0,arm:false};drawA()}
function drawA(){openSheet(`<h2>${A.old?'Sửa tài khoản':'Thêm tài khoản'}</h2><div class="fd"><label>Tên tài khoản<input id="an" value="${esc(A.name)}" placeholder="VD: Vietcombank" autocomplete="off"></label>
 <div class="lb">Loại<div class="wr">${ATYPES.map(k=>`<button type="button" class="ch ${A.type===k?'on':''}" style="--c:${ATC[k]}" data-at="${esc(k)}">${ATI[k]} ${esc(k)}</button>`).join('')}</div></div>
 <label>Số dư ban đầu<input id="ao" inputmode="decimal" value="${A.open?nf.format(A.open):''}" placeholder="0  (gõ 5tr, -2tr…)" autocomplete="off"></label>
 <button class="btn p w" data-a="asave">Lưu tài khoản</button>${A.old?`<button class="btn d w" data-a="adel">${A.arm?'Chạm lần nữa để xóa':'Xóa tài khoản'}</button>`:''}</div>`)}
function asave(){const nm=A.name.trim();if(!nm)return toast('Nhập tên tài khoản');if(S.acc.some(a=>a.name===nm&&(!A.old||a.name!==A.old.name)))return toast('Tên tài khoản đã tồn tại');
 const acc={name:nm,type:A.type,open:A.open},old=A.old;closeSheet();commit([{op:'acc.save',acc,old:old||null}],()=>{S.acc=old?S.acc.map(a=>a.name===old.name?acc:a):S.acc.concat(acc)},'Đã lưu tài khoản')}
function adel(){if(!A.arm){A.arm=true;return drawA()}const n=A.old.name;closeSheet();commit([{op:'acc.del',name:n}],()=>{S.acc=S.acc.filter(a=>a.name!==n)},'Đã chuyển vào Thùng rác')}
const parseOpen=v=>{const neg=/^\s*-/.test(v);const n=parseAmt(v.replace(/^\s*-/,''));return neg?-n:n};
/* ---------- sự kiện ---------- */
const fmtIn=e=>{const v=e.value;if(/^[\d.,]+$/.test(v)){const n=+v.replace(/[.,]/g,'');e.value=n?nf.format(n):''}};
document.addEventListener('click',e=>{if(e.target.id==='ov')return closeSheet();
 const t=e.target.closest('[data-go],[data-a],[data-m],[data-f],[data-edit],[data-ty],[data-cat],[data-acc],[data-to],[data-d],[data-q],[data-at]');if(!t)return;const d=t.dataset;
 if(F){if(d.ty){F.type=d.ty;F.cat=F.sub='';if(d.ty==='Chuyển khoản')F.accTo=(S.acc.find(a=>a.name!==F.acc)||{}).name||'';return draw()}
  if(d.cat){[F.cat,F.sub]=d.cat.split('|');return draw()}if(d.acc!==undefined){F.acc=d.acc;if(F.accTo===F.acc)F.accTo='';return draw()}if(d.to!==undefined){F.accTo=d.to;return draw()}
  if(d.d!==undefined){F.date=dAdd(+d.d);return draw()}if(d.q!==undefined){F.amount=+d.q?(F.amount||0)+ +d.q:0;const i=$('#fa');i.value=F.amount?nf.format(F.amount):'';return i.focus()}}
 if(A&&d.at){A.type=d.at;return drawA()}
 if(d.go)return go(d.go);if(d.m){S.m=shift(S.m,+d.m);S.pg=80;return render()}if(d.f){S.f=d.f;S.pg=80;return render()}
 if(d.edit&&!F&&!A){const x=S.tx.find(y=>y.id===d.edit);return x&&form(x)}
 if(d.acc!==undefined&&!F&&!A)return accForm(d.acc);
 switch(d.a){case 'new':return form();case 'save':return save();case 'del':return del();case 'dup':return form(F,1);case 'asave':return asave();case 'adel':return adel();
  case 'more':S.pg+=80;return render();case 'sync':toast('Đang đồng bộ…');return sync(true);
  case 'undo':{const f=UN;UN=null;$('#ts').classList.remove('on');return f&&f()}
  case 'retry':S.err='';render();return sync(true);
  case 'eye':{const h=document.documentElement.classList.toggle('hid');try{localStorage.hide=h?'1':'0'}catch(x){}return}
  case 'lock':return fetch(STORE,{method:'POST',credentials:'same-origin',body:JSON.stringify({logout:1})}).catch(()=>{}),lock();
  case 'theme':{const c=document.documentElement,dk=c.dataset.t?c.dataset.t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;c.dataset.t=dk?'light':'dark';try{localStorage.theme=c.dataset.t}catch(x){}
   document.querySelector('meta[name=theme-color]').content=dk?'#F3F4FB':'#0A0E1C'}}});
document.addEventListener('input',e=>{const i=e.target;
 if(i.id==='q'){S.q=i.value;S.pg=80;render()}
 else if(i.id==='fa'&&F){fmtIn(i);F.amount=parseAmt(i.value)}else if(i.id==='fn'&&F)F.note=i.value;else if(i.id==='fd'&&F&&i.value)F.date=i.value;
 else if(i.id==='an'&&A)A.name=i.value;else if(i.id==='ao'&&A){const neg=/^\s*-/.test(i.value);if(/^-?[\d.,]*$/.test(i.value.trim())){const n=+i.value.replace(/[^\d]/g,'');i.value=(neg?'-':'')+(n?nf.format(n):'')}A.open=parseOpen(i.value)}});
document.addEventListener('change',e=>{if(e.target.id==='fd'&&F&&e.target.value){F.date=e.target.value;draw()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')return closeSheet();const tg=document.activeElement.tagName;
 if(e.key==='Enter'&&(F||A)&&tg==='INPUT'){e.preventDefault();return F?save():asave()}
 if(/INPUT|SELECT|TEXTAREA/.test(tg)||e.ctrlKey||e.metaKey)return;
 if(e.key==='n'||e.key==='N'){e.preventDefault();form()}else if(e.key==='/'&&S.tab==='tx'){e.preventDefault();const q=$('#q');q&&q.focus()}
 else if(e.key==='ArrowLeft'&&MONTHLY.includes(S.tab)){S.m=shift(S.m,-1);render()}else if(e.key==='ArrowRight'&&MONTHLY.includes(S.tab)){S.m=shift(S.m,1);render()}});
document.addEventListener('visibilitychange',()=>!document.hidden&&sync());addEventListener('focus',()=>sync());addEventListener('online',()=>sync(true));setInterval(()=>sync(),20000);
/* ---------- khởi động ---------- */
function boot(){$('#lg').classList.add('hide');$('#app').classList.remove('hide');const h=location.hash.slice(1);S.tab=tabOk(h)?h:'home';
 if(!S.ready)try{const c=JSON.parse(localStorage.cache2||'null');if(c){Object.assign(S,c);S.ready=true}}catch(e){}render();sync(true)}
(async()=>{try{await api({ops:[],rev:'',sid:SID,probe:1});boot()}catch(e){if(e.net&&/mạng|máy chủ/i.test(e.message)){$('#le').textContent=e.message}$('#lg').classList.remove('hide')}})();
