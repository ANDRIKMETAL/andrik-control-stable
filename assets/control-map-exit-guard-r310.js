/* ANDRIK Control R310 — no exit confirmation on Statistics/map root.
   Installed PWA: Back stays on Statistics and shows only a small hint.
   No modal, no window.close(), no redirect, no jump to a previous YouTube page.
   Normal browser tabs keep native Back behavior. */
(()=>{
  'use strict';
  if(window.__ANDRIK_MAP_EXIT_GUARD_R310__) return;
  window.__ANDRIK_MAP_EXIT_GUARD_R310__=true;

  const STATE_KEY='__andrikMapRootR310';
  let toast=null;
  const isStandalone=()=>{
    try{
      return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        window.navigator?.standalone === true);
    }catch(_){ return false; }
  };

  const closeEyeVideo=()=>{
    const overlay=document.querySelector('.andrik-live-eye-overlay-r219.is-open');
    overlay?.querySelector('.andrik-live-eye-close-r219')?.click();
  };

  const ensureToast=()=>{
    if(toast) return toast;
    const style=document.createElement('style');
    style.id='andrik-map-exit-hint-style-r310';
    style.textContent=`
      .andrik-map-exit-hint-r310[hidden]{display:none!important}
      .andrik-map-exit-hint-r310{position:fixed!important;left:50%!important;bottom:max(24px,calc(18px + env(safe-area-inset-bottom)))!important;z-index:2147483647!important;transform:translateX(-50%)!important;width:max-content!important;max-width:calc(100vw - 36px)!important;padding:11px 16px!important;border:1px solid rgba(122,204,235,.24)!important;border-radius:999px!important;background:rgba(5,18,27,.96)!important;box-shadow:0 12px 34px rgba(0,0,0,.52)!important;color:#bfd7e2!important;font:750 .82rem/1.25 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;text-align:center!important;pointer-events:none!important}`;
    document.head.appendChild(style);
    toast=document.createElement('div');
    toast.className='andrik-map-exit-hint-r310';
    toast.hidden=true;
    toast.setAttribute('role','status');
    toast.textContent='Для выхода из приложения нажмите Домой';
    document.body.appendChild(toast);
    return toast;
  };

  const hint=()=>{
    closeEyeVideo();
    const node=ensureToast();
    node.hidden=false;
    clearTimeout(hint.timer);
    hint.timer=setTimeout(()=>{ if(toast) toast.hidden=true; },1800);
  };

  const guardState=()=>({...(history.state||{}),[STATE_KEY]:'guard'});
  const baseState=()=>({...(history.state||{}),[STATE_KEY]:'base'});
  const arm=()=>{
    if(!isStandalone()) return;
    try{
      if(history.state?.[STATE_KEY]==='guard') return;
      history.replaceState(baseState(),'',location.href);
      history.pushState(guardState(),'',location.href);
    }catch(_){}
  };

  addEventListener('popstate',()=>{
    if(!isStandalone()) return;
    try{ history.pushState(guardState(),'',location.href); }catch(_){}
    hint();
  });
  addEventListener('pageshow',arm,{passive:true});

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{ ensureToast(); arm(); },{once:true});
  }else{
    ensureToast(); arm();
  }
})();
