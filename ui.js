/* v2/ui.js — thành phần dùng chung: điều hướng, sheet, toast, confirm, chỉ báo đồng bộ, giao diện sáng/tối. */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const UI=(()=>{
  const ov=$('#ov'),sh=$('#sh');let onClose=null,last=null;
  function sheet({title,body,footer,close}){
    last=document.activeElement;onClose=close||null;
    sh.innerHTML='<div class="grab"></div><div class="sh-h"><h3></h3><button class="ib" data-x aria-label="Đóng"><svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="sh-b"></div>'+(footer?'<div class="sh-f"></div>':'');
    $('h3',sh).textContent=title||'';
    const b=$('.sh-b',sh);typeof body==='string'?b.innerHTML=body:b.append(body);
    if(footer){const f=$('.sh-f',sh);typeof footer==='string'?f.innerHTML=footer:f.append(...[].concat(footer))}
    ov.classList.add('on');ov.setAttribute('aria-hidden','false');setTimeout(()=>($('input,select,textarea',b)||$('[data-x]',sh)).focus(),60);return sh}
  function closeSheet(){if(!ov.classList.contains('on'))return;ov.classList.remove('on');ov.setAttribute('aria-hidden','true');onClose&&onClose();onClose=null;last&&last.focus&&last.focus()}
  ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('[data-x]'))closeSheet()});
  addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
  let y0=null;sh.addEventListener('touchstart',e=>{y0=e.target.closest('.grab,.sh-h')?e.touches[0].clientY:null},{passive:true});
  sh.addEventListener('touchend',e=>{if(y0!=null&&e.changedTouches[0].clientY-y0>70)closeSheet();y0=null});
  function toast(msg,{undo,ms=4000}={}){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;
    if(undo){const u=document.createElement('button');u.textContent='Hoàn tác';u.onclick=()=>{undo();t.remove()};t.append(u)}
    $('#toasts').append(t);setTimeout(()=>t.remove(),ms)}
  function confirm({title,msg,ok='Đồng ý',danger}){return new Promise(res=>{
    const n=document.createElement('button');n.className='btn';n.textContent='Hủy';const o=document.createElement('button');o.className='btn '+(danger?'d':'p');o.textContent=ok;
    const p=document.createElement('p');p.textContent=msg||'';sheet({title,body:p,footer:[n,o],close:()=>res(false)});
    n.onclick=()=>closeSheet();o.onclick=()=>{onClose=null;closeSheet();res(true)}})}
  /* chỉ báo đồng bộ: 'synced' | 'sending' | 'offline' | 'error' */
  const L={synced:'Đã đồng bộ',sending:'Đang gửi',offline:'Offline',error:'Lỗi đồng bộ'};
  function sync(s,n){const e=$('#sync');e.dataset.s=s;$('b',e).textContent=L[s]+(n?' · '+n:'')}
  addEventListener('online',()=>sync('synced'));addEventListener('offline',()=>sync('offline'));
  function tab(name){$$('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+name));$$('.tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===name));$('main').scrollTop=0;try{history.replaceState(null,'','#'+name)}catch(e){}}
  function theme(m){const d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);try{localStorage.theme=m}catch(e){}}
  $$('.tabs [data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  $('#themeb').onclick=()=>theme(document.documentElement.classList.contains('dark')?'light':'dark');
  $('#fab').onclick=()=>sheet({title:'Thêm giao dịch',body:'<p>Form đầy đủ làm ở giai đoạn 3.</p>',footer:'<button class="btn p" data-x>Xong</button>'});
  let t='auto';try{t=localStorage.theme||'auto'}catch(e){}theme(t);
  tab((location.hash||'#home').slice(1).replace(/[^a-z]/g,'')||'home');if(!$('.view.on'))tab('home');
  sync(navigator.onLine?'synced':'offline');
  return{sheet,close:closeSheet,toast,confirm,sync,tab,theme}
})();
