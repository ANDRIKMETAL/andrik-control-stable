/* ANDRIK Control R313 — fast standalone exit, no confirmation modal.
   Restores the proven R225-style history unwind, but keeps a short-lived
   continuation flag so a previous Statistics/YouTube Control entry does not
   become the final landing page. No external redirect is ever performed. */
(()=>{
  'use strict';
  if(window.__ANDRIK_FAST_EXIT_R313__) return;
  window.__ANDRIK_FAST_EXIT_R313__=true;

  const STATE_KEY='__andrikFastExitGuardR313';
  const EXIT_KEY='andrik-fast-exit-r311';
  const MAX_AGE=2800;
  let leaving=false;
  let scheduled=false;

  const isStandalone=()=>{
    try{
      return Boolean(
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        window.navigator?.standalone === true
      );
    }catch(_){ return false; }
  };

  const readExit=()=>{
    try{
      const raw=sessionStorage.getItem(EXIT_KEY);
      if(!raw) return null;
      const data=JSON.parse(raw);
      if(!data || Date.now()-Number(data.at||0)>MAX_AGE){
        sessionStorage.removeItem(EXIT_KEY);
        return null;
      }
      return data;
    }catch(_){ return null; }
  };

  const writeExit=(hops=0)=>{
    try{ sessionStorage.setItem(EXIT_KEY,JSON.stringify({at:Date.now(),hops:Number(hops||0)})); }catch(_){ }
  };
  const clearExit=()=>{ try{sessionStorage.removeItem(EXIT_KEY)}catch(_){ } };

  const tryNativeClose=()=>{
    try{ window.Android?.closeApp?.(); }catch(_){ }
    try{ navigator.app?.exitApp?.(); }catch(_){ }
    try{ window.Capacitor?.Plugins?.App?.exitApp?.(); }catch(_){ }
    try{ window.open('','_self'); window.close(); }catch(_){ }
  };

  const continueExit=()=>{
    if(scheduled) return;
    if(!isStandalone()){ clearExit(); return; }
    scheduled=true;
    const current=readExit() || {at:Date.now(),hops:0};
    const hops=Number(current.hops||0)+1;
    if(hops>10){ clearExit(); leaving=false; scheduled=false; return; }
    writeExit(hops);
    leaving=true;
    tryNativeClose();
    setTimeout(()=>{
      scheduled=false;
      try{ history.back(); }
      catch(_){ clearExit(); leaving=false; }
    },0);
  };

  const guardState=()=>({...(history.state||{}),[STATE_KEY]:'guard'});
  const baseState=()=>({...(history.state||{}),[STATE_KEY]:'base'});

  const arm=()=>{
    if(!isStandalone() || readExit()) return;
    leaving=false;
    try{
      if(history.state?.[STATE_KEY]==='guard') return;
      history.replaceState(baseState(),'',location.href);
      history.pushState(guardState(),'',location.href);
    }catch(_){ }
  };

  addEventListener('popstate',()=>{
    if(!isStandalone()) return;
    if(!readExit()) writeExit(0);
    continueExit();
  });

  addEventListener('pageshow',()=>{
    if(!isStandalone()) return;
    if(readExit()){
      setTimeout(continueExit,0);
      return;
    }
    arm();
  },{passive:true});

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      if(readExit()) setTimeout(continueExit,0);
      else arm();
    },{once:true});
  }else{
    if(readExit()) setTimeout(continueExit,0);
    else arm();
  }
})();
