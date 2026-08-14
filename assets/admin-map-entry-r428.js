/* ANDRIK R428 — reliable repeated Admin -> Map entry. */
(()=>{
  'use strict';
  if(window.__ANDRIK_ADMIN_MAP_ENTRY_R428__)return;
  window.__ANDRIK_ADMIN_MAP_ENTRY_R428__=true;
  const globe=document.getElementById('adminHubGlobeR418');
  if(!globe)return;
  let press=null,leaving=false,lastNav=0;
  const makeUrl=()=>`/analytics-admin.html?page=map&source=admin-globe&entry=${Date.now()}&v=55.00-r428`;
  const refreshHref=()=>{globe.href=makeUrl();globe.removeAttribute('aria-disabled');globe.style.pointerEvents='auto'};
  const go=()=>{
    const now=performance.now();
    if(leaving||now-lastNav<650)return;
    lastNav=now;leaving=true;
    const url=makeUrl();
    globe.href=url;
    try{sessionStorage.setItem('andrik-admin-map-entry-r428',String(Date.now()))}catch(_){ }
    location.assign(url);
  };
  globe.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    press={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};
  },true);
  globe.addEventListener('pointerup',e=>{
    if(!press||press.id!==e.pointerId)return;
    const dx=e.clientX-press.x,dy=e.clientY-press.y,dt=performance.now()-press.t;press=null;
    if(Math.hypot(dx,dy)>18||dt>1400)return;
    e.preventDefault();e.stopImmediatePropagation();go();
  },true);
  globe.addEventListener('pointercancel',()=>{press=null},true);
  globe.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(performance.now()-lastNav>650)go();
  },true);
  addEventListener('pageshow',()=>{press=null;leaving=false;lastNav=0;refreshHref()},{passive:true});
  addEventListener('focus',()=>{if(!document.hidden){leaving=false;refreshHref()}},{passive:true});
  refreshHref();
})();
