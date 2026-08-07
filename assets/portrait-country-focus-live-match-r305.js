/* ANDRIK Control R305 — remember the real overview map height and reuse it after country focus. */
(()=>{
  'use strict';
  if(window.__ANDRIK_MAP_HEIGHT_MATCH_R305__)return;
  window.__ANDRIK_MAP_HEIGHT_MATCH_R305__=true;
  const KEY='andrik-overview-map-height-r305';
  let observer=null;
  const focused=()=>Boolean(document.body?.classList.contains('is-country-focus-active')||document.querySelector('.analytics-map-top')?.classList.contains('has-country-focus'));
  const applyStored=()=>{
    let h=0;
    try{h=Number(sessionStorage.getItem(KEY)||0)}catch(_){ }
    if(h>=220&&h<=520)document.documentElement.style.setProperty('--andrik-overview-map-height-r305',`${Math.round(h)}px`);
    return h;
  };
  const measure=()=>{
    const map=document.getElementById('worldMap');
    if(!map||focused())return applyStored();
    const h=Math.round(map.getBoundingClientRect().height||0);
    if(h>=220&&h<=520){
      document.documentElement.style.setProperty('--andrik-overview-map-height-r305',`${h}px`);
      try{sessionStorage.setItem(KEY,String(h))}catch(_){ }
    }
    return h;
  };
  const sync=()=>{ if(focused())applyStored(); else measure(); };
  const boot=()=>{
    sync();
    [60,180,420,900].forEach(ms=>setTimeout(sync,ms));
    const top=document.querySelector('.analytics-map-top');
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>requestAnimationFrame(sync));
    if(document.body)observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    if(top)observer.observe(top,{attributes:true,attributeFilter:['class']});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  addEventListener('pageshow',boot,{passive:true});
  addEventListener('resize',()=>{if(!focused())setTimeout(measure,80)},{passive:true});
  addEventListener('orientationchange',()=>setTimeout(sync,180),{passive:true});
})();
