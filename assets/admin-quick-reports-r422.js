/* ANDRIK R422 — deterministic Admin quick reports. */
(()=>{
  'use strict';
  if(window.__ANDRIK_ADMIN_QUICK_REPORTS_R422__)return;
  window.__ANDRIK_ADMIN_QUICK_REPORTS_R422__=true;
  const wrap=document.querySelector('.admin-hub-quick-r418');
  if(!wrap)return;
  let busy=false;
  const go=(link)=>{
    if(busy)return;busy=true;
    const url=new URL(link.href,location.href);
    url.searchParams.set('source','admin-quick-r422');
    url.searchParams.set('v','55.00-r422');
    url.searchParams.set('nav',String(Date.now()));
    location.assign(url.pathname+url.search);
  };
  wrap.querySelectorAll('a').forEach(link=>{
    link.style.touchAction='manipulation';
    link.addEventListener('pointerdown',e=>{e.stopPropagation()},true);
    link.addEventListener('pointerup',e=>{e.stopPropagation()},true);
    link.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();go(link);
    },true);
  });
  window.addEventListener('pageshow',()=>{busy=false},{passive:true});
})();
