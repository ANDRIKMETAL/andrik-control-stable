/* ANDRIK R423 — deterministic one-tap Summary/Activity navigation. */
(()=>{
  'use strict';
  if(window.__ANDRIK_ADMIN_QUICK_NAV_R423__)return;
  window.__ANDRIK_ADMIN_QUICK_NAV_R423__=true;
  const wrap=document.querySelector('.admin-hub-quick-r418');
  if(!wrap)return;
  let press=null,locked=false,lastNav=0;
  const targetUrl=a=>{
    if(!a)return'';
    const text=(a.textContent||'').toLowerCase();
    const page=text.includes('актив')?'activity':'summary';
    return `/control-home.html?page=${page}&source=admin-quick-r423&v=55.00-r423&t=${Date.now()}`;
  };
  const go=a=>{
    if(!a||locked)return;
    const now=performance.now();if(now-lastNav<450)return;lastNav=now;locked=true;
    const url=targetUrl(a);if(!url){locked=false;return}
    try{window.location.assign(url)}catch(_){window.location.href=url}
    setTimeout(()=>{locked=false},1200);
  };
  wrap.addEventListener('pointerdown',e=>{
    const a=e.target.closest('a');if(!a||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    press={id:e.pointerId,a,x:e.clientX,y:e.clientY};
    e.stopPropagation();
  },true);
  wrap.addEventListener('pointermove',e=>{
    if(!press||press.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>18)press=null;
  },true);
  wrap.addEventListener('pointerup',e=>{
    if(!press||press.id!==e.pointerId)return;
    const a=press.a;press=null;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();go(a);
  },true);
  wrap.addEventListener('pointercancel',()=>{press=null},true);
  wrap.addEventListener('click',e=>{
    const a=e.target.closest('a');if(!a)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();go(a);
  },true);
  window.addEventListener('pageshow',()=>{press=null;locked=false;lastNav=0},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){press=null;locked=false}}, {passive:true});
})();
