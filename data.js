/* v2/data.js — tầng dữ liệu: ghi cục bộ TRƯỚC (IndexedDB) → hàng đợi → server. Khớp giao thức api/store.js + Apps Script.
   Hàng đợi dùng chung DB "stc-outbox"/store "j" với sw.js hiện có → Android vẫn được Background Sync gửi bù khi đóng tab.
   Mọi thao tác idempotent (tx.save cùng id = cập nhật; tx.del lặp lại = bỏ qua) nên gửi trùng không nhân đôi. */
const Store=(()=>{
  const API='/api/store',FAST=['tx.save','tx.del','tx.purge'],EMPTY={tx:[],acc:[],cat:[],lim:[],trash:[],issues:[]};
  let sid='';try{sid=localStorage.sid2||(localStorage.sid2=crypto.randomUUID())}catch(e){}
  let S=EMPTY,rev='',jobs=[],busy=false,joined=false,ready=false;const subs=new Set();
  /* ---- IndexedDB ---- */
  const open=(name,store,key)=>new Promise(ok=>{try{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore(store,{keyPath:key});r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)}catch(e){ok(null)}});
  const run=(dbp,store,mode,fn)=>dbp.then(db=>!db?null:new Promise(ok=>{try{const t=db.transaction(store,mode),q=fn(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result);t.onerror=t.onabort=()=>ok(null)}catch(e){ok(null)}}));
  const kvDb=open('stc2','kv','k'),qDb=open('stc-outbox','j','id');
  const qAll=async()=>((await run(qDb,'j','readonly',s=>s.getAll()))||[]).filter(x=>!String(x.id).startsWith('hb:')).sort((a,b)=>a.t-b.t);
  const qPut=j=>run(qDb,'j','readwrite',s=>s.put(j)),qDel=id=>run(qDb,'j','readwrite',s=>s.delete(id));
  const kvPut=()=>run(kvDb,'kv','readwrite',s=>s.put({k:'state',S,rev,at:Date.now()}));
  /* ---- Trạng thái hiển thị = dữ liệu server + các thay đổi chưa gửi (không bao giờ "nhảy lùi") ---- */
  const sortTx=a=>a.sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.at||'')<(x.at||'')?-1:1);
  function view(){
    const m=new Map(S.tx.map(t=>[t.id,t])),P=new Set();
    jobs.forEach(j=>j.ops.forEach(o=>{if(o.op==='tx.save'&&o.row){m.set(o.row.id,Object.assign({},o.row,{amount:+o.row.amount}));P.add(o.row.id)}else if(o.op==='tx.del')m.delete(o.id)}));
    return Object.assign({},S,{tx:sortTx([...m.values()]),pending:P,queued:jobs.length,loaded:rev!==''})
  }
  const emit=()=>{const v=view();subs.forEach(f=>{try{f(v)}catch(e){console.error(e)}})};
  const status=(s,n)=>{window.UI&&UI.sync(s,n)};
  /* ---- Mạng ---- */
  async function post(body){
    let r,j;
    try{r=await fetch(API,{method:'POST',credentials:'same-origin',body:JSON.stringify(Object.assign({sid},body))});j=await r.json()}catch(e){throw{net:1}}
    if(j.auth)throw{auth:1};if(j.sess===false)throw{sess:1,msg:j.err};if(j.hubErr)throw{net:1,msg:j.err};
    if(!j.ok){const e={msg:j.err};if(/bận|busy|lock|khóa|time ?out|quá tải|tạm thời|unavailable/i.test(j.err||''))e.net=1;throw e}
    return j}
  async function fail(e,n){
    if(e.auth){status('error',n);Store.onAuth&&Store.onAuth();return}
    if(e.sess){status('error',n);Store.onSess&&Store.onSess(e.msg);return}
    status(navigator.onLine?'error':'offline',n)}
  async function join(){if(joined)return;await post({ops:[{op:'sess.join'}]});joined=true}
  /* ---- Gửi hàng đợi: tuần tự, giữ thứ tự, lỗi mạng thì giữ lại ---- */
  async function flush(){
    if(busy)return;busy=true;
    try{
      await join();
      for(;;){
        jobs=await qAll();emit();if(!jobs.length)break;
        const jb=jobs[0];status('sending',jobs.length);
        try{await post({ops:jb.ops,rev:'',fast:jb.ops.every(o=>FAST.includes(o.op))});await qDel(jb.id)}
        catch(e){
          if(e.net||e.auth||e.sess)return fail(e,jobs.length);
          await qDel(jb.id);window.UI&&UI.toast('Máy chủ từ chối: '+(e.msg||'lỗi'));   // lỗi thật: bỏ việc này để không chặn các việc sau
        }
      }
      status('synced');
    }catch(e){return fail(e,jobs.length)}
    finally{busy=false}
    pull()}
  let pulling=false;
  async function pull(){
    if(busy||pulling||!navigator.onLine)return;
    if((await qAll()).length)return flush();
    pulling=true;status('sending');
    try{await join();const j=await post({ops:[],rev});if(j.same){status('synced');return}
      if(!Array.isArray(j.tx)&&!Array.isArray(j.acc))throw{msg:'Phản hồi thiếu dữ liệu'};
      S={tx:j.tx||[],acc:j.acc||[],cat:j.cat||[],lim:j.lim||[],trash:j.trash||[],issues:j.issues||[]};rev=j.rev||'ok';await kvPut();emit();status('synced')}
    catch(e){console.error('pull',e);if(e.msg&&window.UI)UI.toast('Không tải được dữ liệu: '+e.msg);fail(e,jobs.length)}
    finally{pulling=false}}
  /* ---- API cho giao diện ---- */
  const newId=()=>'G'+Date.now().toString(36)+Math.floor(Math.random()*46656).toString(36);
  async function enqueue(ops){
    const j={id:'j'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),t:Date.now(),ops};
    await qPut(j);jobs.push(j);emit();status(navigator.onLine?'sending':'offline',jobs.length);
    try{const r=await navigator.serviceWorker.ready;r.sync&&r.sync.register('stc-outbox')}catch(e){}   // Android: gửi bù cả khi đóng tab
    flush();return j}
  const saveTx=row=>enqueue([{op:'tx.save',row:Object.assign({id:newId()},row)}]);
  const delTx=id=>enqueue([{op:'tx.del',id}]);
  const op=o=>enqueue([o]);   // acc.save, cat.save, lim.set, restore... (server là nguồn sự thật, chờ pull)
  async function login(pw){
    let j;try{j=await (await fetch(API,{method:'POST',credentials:'same-origin',body:JSON.stringify({login:pw})})).json()}catch(e){return{ok:false,err:'Không có kết nối mạng'}}
    if(j.ok){joined=false;try{await post({ops:[{op:'sess.login'}]});joined=true}catch(e){}flush()}return j}
  const logout=()=>fetch(API,{method:'POST',credentials:'same-origin',body:JSON.stringify({logout:1})}).catch(()=>{});
  /* ---- Thống kê: bám quy tắc "Không tính vào thu chi" (mục 6.4) ---- */
  function stats(ym,v){
    v=v||view();const skip=new Set(v.acc.filter(a=>a.skip||a.type==='Giữ Hộ').map(a=>a.name)),today=new Date().toISOString().slice(0,10),bal={};
    v.acc.forEach(a=>bal[a.name]=a.open||0);let thu=0,chi=0;
    v.tx.forEach(t=>{const a=+t.amount;
      if(t.date<=today){const g=k=>bal[k]||0;
        if(t.type==='Chuyển khoản'){bal[t.acc]=g(t.acc)-a;bal[t.accTo]=g(t.accTo)+a}else if(t.type==='Chi')bal[t.acc]=g(t.acc)-a;else bal[t.acc]=g(t.acc)+a}
      if(t.date.slice(0,7)!==ym||skip.has(t.acc)||(t.type==='Chuyển khoản'&&skip.has(t.accTo)))return;   // số dư vẫn tính, thu/chi thì bỏ
      if(t.type==='Thu')thu+=a;else if(t.type==='Chi')chi+=a});
    const assets=v.acc.filter(a=>a.type!=='Giữ Hộ').reduce((s,a)=>s+(bal[a.name]||0),0);
    return{assets,thu,chi,left:thu-chi,n:v.tx.filter(t=>t.date.slice(0,7)===ym).length}}
  async function init(){
    try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
    const snap=await run(kvDb,'kv','readonly',s=>s.get('state'));if(snap){S=snap.S||EMPTY;rev=snap.rev||''}
    jobs=await qAll();ready=true;emit();
    addEventListener('online',flush);addEventListener('pageshow',flush);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush()});
    setInterval(()=>{if(!document.hidden)flush()},30000);
    flush()}
  return{init,saveTx,delTx,op,login,logout,flush,pull,stats,newId,view,sub:f=>{subs.add(f);ready&&f(view());return()=>subs.delete(f)},onAuth:null,onSess:null}
})();
/* Nối vào Tổng quan: số liệu thật, tính theo tháng hiện tại */
(function(){const money=n=>(Math.round(n)||0).toLocaleString('vi-VN')+' đ',ym=new Date().toISOString().slice(0,7);
  Store.sub(v=>{const s=Store.stats(ym,v);[['a',s.assets],['t',s.thu],['c',s.chi],['l',s.left]].forEach(([k,x])=>{const e=document.querySelector('[data-k='+k+']');if(e)e.textContent=v.loaded?money(x):'—'});
    const sk=document.querySelector('.skel');sk&&(sk.hidden=!!v.loaded)});
  Store.onAuth=()=>UI.toast('Phiên đăng nhập đã hết, cần đăng nhập lại (màn đăng nhập làm ở giai đoạn 3)');
  Store.onSess=m=>UI.toast(m||'Có thiết bị khác đăng nhập');
  Store.init()})();
