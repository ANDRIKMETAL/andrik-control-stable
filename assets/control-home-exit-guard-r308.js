/* ANDRIK Control R308 — safe PWA exit guard.
   Android/Chrome does not guarantee that a web page can terminate an installed PWA.
   We therefore never redirect away from Control and never replace the UI with a fake
   "closed" screen. The button only attempts supported native/window close methods;
   if Android refuses, Control stays intact and the user can leave with Home/system UI. */
(()=>{
  'use strict';
  if(window.__ANDRIK_HOME_EXIT_GUARD_R308__) return;
  window.__ANDRIK_HOME_EXIT_GUARD_R308__=true;

  const STATE_KEY='__andrikControlExitGuardR308';
  let modal=null,toast=null,open=false,closing=false,lastPointerExit=0;

  const injectStyle=()=>{
    if(document.getElementById('andrik-exit-guard-style-r308')) return;
    const style=document.createElement('style');
    style.id='andrik-exit-guard-style-r308';
    style.textContent=`
      .andrik-exit-guard-r308[hidden],.andrik-exit-toast-r308[hidden]{display:none!important}
      .andrik-exit-guard-r308{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:22px max(18px,env(safe-area-inset-right)) max(22px,calc(18px + env(safe-area-inset-bottom))) max(18px,env(safe-area-inset-left))!important;background:rgba(0,5,8,.76)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important}
      .andrik-exit-dialog-r308{width:min(100%,420px)!important;box-sizing:border-box!important;padding:24px 20px 18px!important;border:1px solid rgba(112,255,183,.38)!important;border-radius:28px!important;background:linear-gradient(160deg,rgba(8,24,29,.98),rgba(2,8,13,.99))!important;box-shadow:0 24px 70px rgba(0,0,0,.72),0 0 34px rgba(45,235,133,.16),inset 0 0 22px rgba(76,220,166,.05)!important;color:#effff7!important;text-align:center!important}
      .andrik-exit-eye-r308{width:68px!important;height:68px!important;margin:0 auto 12px!important;border-radius:50%!important;background:url('/assets/control-topbar-eye-triangle.jpg?v=55.00-r308') center/cover no-repeat!important;box-shadow:0 0 18px rgba(91,255,180,.62),0 0 42px rgba(30,210,105,.28)!important}
      .andrik-exit-dialog-r308 h2{margin:0!important;font-size:1.58rem!important;line-height:1.08!important}.andrik-exit-dialog-r308 p{margin:10px auto 20px!important;max-width:315px!important;color:#a9bec7!important;font-size:.98rem!important;line-height:1.42!important}
      .andrik-exit-actions-r308{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}.andrik-exit-actions-r308 button{min-height:54px!important;border-radius:999px!important;border:1px solid rgba(160,210,226,.23)!important;font:800 1rem/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;letter-spacing:.01em!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}.andrik-exit-stay-r308{color:#06120c!important;background:linear-gradient(135deg,#bfffe0,#5ce6a2)!important;box-shadow:0 8px 28px rgba(68,239,152,.20)!important}.andrik-exit-leave-r308{color:#ffd9dc!important;background:rgba(86,18,28,.54)!important;border-color:rgba(255,103,121,.42)!important}body.andrik-exit-open-r308{overflow:hidden!important}
      .andrik-exit-toast-r308{position:fixed!important;left:50%!important;bottom:max(24px,calc(18px + env(safe-area-inset-bottom)))!important;z-index:2147483647!important;transform:translateX(-50%)!important;width:max-content!important;max-width:calc(100vw - 36px)!important;padding:11px 16px!important;border:1px solid rgba(122,204,235,.24)!important;border-radius:999px!important;background:rgba(5,18,27,.96)!important;box-shadow:0 12px 34px rgba(0,0,0,.52)!important;color:#bfd7e2!important;font:750 .82rem/1.25 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;text-align:center!important;pointer-events:none!important}
      @media(max-width:380px){.andrik-exit-actions-r308{grid-template-columns:1fr!important}.andrik-exit-dialog-r308{padding:21px 16px 16px!important}}
    `;
    document.head.appendChild(style);
  };

  const closeModal=()=>{
    if(!modal) return;
    open=false;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('andrik-exit-open-r308');
  };

  const showToast=()=>{
    injectStyle();
    if(!toast){
      toast=document.createElement('div');
      toast.className='andrik-exit-toast-r308';
      toast.hidden=true;
      toast.setAttribute('role','status');
      toast.textContent='Для полного выхода нажмите Домой';
      document.body.appendChild(toast);
    }
    toast.hidden=false;
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>{ if(toast) toast.hidden=true; },2400);
  };

  const trySupportedClose=()=>{
    let requested=false;
    try{ if(typeof window.Android?.closeApp==='function'){window.Android.closeApp();requested=true;} }catch(_){}
    try{ if(typeof navigator.app?.exitApp==='function'){navigator.app.exitApp();requested=true;} }catch(_){}
    try{ if(typeof window.Capacitor?.Plugins?.App?.exitApp==='function'){window.Capacitor.Plugins.App.exitApp();requested=true;} }catch(_){}
    try{ window.open('','_self'); window.close(); requested=true; }catch(_){}
    return requested;
  };

  const leave=()=>{
    if(closing) return;
    closing=true;
    closeModal();
    trySupportedClose();

    // Important: no location.replace(), no history.go(-2), no public-site fallback,
    // and no fake black "Control closed" page.
    setTimeout(()=>{
      if(document.visibilityState!=='hidden'){
        closing=false;
        showToast();
      }
    },220);
  };

  const createModal=()=>{
    if(modal) return modal;
    injectStyle();
    modal=document.createElement('div');
    modal.className='andrik-exit-guard-r308';
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`
      <section class="andrik-exit-dialog-r308" role="dialog" aria-modal="true" aria-labelledby="andrikExitTitleR308">
        <div class="andrik-exit-eye-r308" aria-hidden="true"></div>
        <h2 id="andrikExitTitleR308">Выйти из Control?</h2>
        <p>Закрыть Control сейчас?</p>
        <div class="andrik-exit-actions-r308">
          <button class="andrik-exit-stay-r308" type="button">Остаться</button>
          <button class="andrik-exit-leave-r308" type="button">Выйти</button>
        </div>
      </section>`;
    document.body.appendChild(modal);

    modal.querySelector('.andrik-exit-stay-r308')?.addEventListener('click',closeModal);
    const leaveBtn=modal.querySelector('.andrik-exit-leave-r308');
    leaveBtn?.addEventListener('pointerup',event=>{
      if(event.isPrimary===false) return;
      lastPointerExit=Date.now();
      event.preventDefault();
      event.stopPropagation();
      leave();
    },{passive:false});
    leaveBtn?.addEventListener('click',event=>{
      if(Date.now()-lastPointerExit<900){ event.preventDefault(); return; }
      leave();
    });
    modal.addEventListener('click',event=>{ if(event.target===modal) closeModal(); });
    return modal;
  };

  const showModal=()=>{
    createModal();
    open=true;
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('andrik-exit-open-r308');
    requestAnimationFrame(()=>modal.querySelector('.andrik-exit-stay-r308')?.focus());
  };

  const guardState=()=>({...(history.state||{}),[STATE_KEY]:'guard'});
  const baseState=()=>({...(history.state||{}),[STATE_KEY]:'base'});
  const arm=()=>{
    try{
      if(history.state?.[STATE_KEY]==='guard') return;
      history.replaceState(baseState(),'',location.href);
      history.pushState(guardState(),'',location.href);
    }catch(_){}
  };

  window.addEventListener('popstate',()=>{
    if(closing) return;
    try{history.pushState(guardState(),'',location.href);}catch(_){}
    if(open){closeModal();return;}
    showModal();
  });
  window.addEventListener('pageshow',arm,{passive:true});

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{createModal();arm();},{once:true});
  }else{
    createModal();arm();
  }
})();
