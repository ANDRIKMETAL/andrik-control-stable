(()=>{
  'use strict';
  const VERSION='55.00-r556';
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const MAX_AGE=30*60*1000;
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const cacheKey=type=>`andrik-youtube-top-${type}-r556`;
  const fresh=type=>{try{const x=JSON.parse(localStorage.getItem(cacheKey(type))||'null');return Array.isArray(x?.rows)&&x.rows.length&&Date.now()-Number(x.savedAt||0)<MAX_AGE}catch(_){return false}};
  const save=(type,rows,updatedAt='')=>{try{localStorage.setItem(cacheKey(type),JSON.stringify({rows:Array.isArray(rows)?rows.slice(0,4):[],savedAt:Date.now(),updatedAt,version:VERSION}))}catch(_){}};
  async function waitOwner(){
    const owner=window.AndrikOwnerSession;
    if(owner?.ready) await owner.ready().catch(()=>null);
    return owner;
  }
  async function fetchType(type){
    if(fresh(type)) return;
    const key=getKey();
    const headers={accept:'application/json'};
    if(key&&!/^__ANDRIK_OWNER_SESSION_/i.test(key)) headers.authorization=`Bearer ${key}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(`/api/control/youtube-top-content?type=${encodeURIComponent(type)}&v=${VERSION}`,{headers,credentials:'include',cache:'no-store',signal:controller.signal});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d?.ok===false) return;
      const rows=type==='shorts'?d?.shorts:d?.videos;
      if(Array.isArray(rows)&&rows.length) save(type,rows,d?.updatedAt||'');
    }catch(_){ }finally{clearTimeout(timer)}
  }
  async function run(){
    await waitOwner();
    const key=getKey();
    if(!key&&!window.AndrikOwnerSession?.isActive?.()&&!window.AndrikOwnerSession?.signedToken?.()) return;
    await fetchType('shorts');
    setTimeout(()=>fetchType('videos'),350);
  }
  if(document.readyState==='complete') setTimeout(run,1800);
  else window.addEventListener('load',()=>setTimeout(run,1800),{once:true});
})();
