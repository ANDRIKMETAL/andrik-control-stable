(()=>{
  'use strict';
  if(window.__andrikR80PortraitRestoreReady)return;
  window.__andrikR80PortraitRestoreReady=true;

  const isPortrait=()=>window.matchMedia?.('(orientation:portrait)')?.matches===true;
  function resetOldStaticLocks(){
    if(!isPortrait())return;
    const wrap=document.querySelector('.analytics-map-pane .analytics-map-pane-wrap');
    if(!wrap)return;
    wrap.classList.remove('r79-static-composition','r80-static-header-lock');
    [...wrap.style].forEach(name=>{
      if(name.startsWith('--r79-')||name.startsWith('--r80-'))wrap.style.removeProperty(name);
    });
  }
  window.addEventListener('load',resetOldStaticLocks,{passive:true});
  window.addEventListener('pageshow',resetOldStaticLocks,{passive:true});
  window.addEventListener('resize',resetOldStaticLocks,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(resetOldStaticLocks,120),{passive:true});
  window.addEventListener('andrik:analytics-page-changed',resetOldStaticLocks);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.world-map-dot,.world-country-button,.world-country-selected-card')){
      setTimeout(resetOldStaticLocks,60);
    }
  },true);
  resetOldStaticLocks();
})();
