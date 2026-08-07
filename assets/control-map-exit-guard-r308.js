/* ANDRIK Control R308 — safe map/PWA exit guard.
   No redirect and no fake closed screen. Unsupported Android PWA close simply leaves
   Control intact; the user can leave with Home/system UI. */
(()=>{
  'use strict';
  if(window.__ANDRIK_MAP_EXIT_GUARD_R308__) return;
  window.__ANDRIK_MAP_EXIT_GUARD_R308__=true;

  const STATE_KEY='__andrikMapExitGuardR308';
  let modal=null,toast=null,open=false,closing=false,lastPointerExit=0;

  const injectStyle=()=>{
    if(document.getElementById('andrik-map-exit-style-r308')) return;
    const style=document.createElement('style');
    style.id='andrik-map-exit-style-r308';
    style.textContent=`
      .andrik-map-exit-guard-r308[hidden],.andrik-map-exit-toast-r308[hidden]{display:none!important}
      .andrik-map-exit-guard-r308{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:max(22px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(22px,calc(18px + env(safe-area-inset-bottom))) max(18px,env(safe-area-inset-left))!important;background:rgba(0,5,8,.80)!important;backdrop-filter:blur(13px)!important;-webkit-backdrop-filter:blur(13px)!important}
      .andrik-map-exit-dialog-r308{width:min(100%,420px)!important;box-sizing:border-box!important;padding:24px 20px 18px!important;border:2px solid rgba(112,255,183,.48)!important;border-radius:28px!important;background:linear-gradient(160deg,rgba(8,24,29,.99),rgba(2,8,13,.995))!important;box-shadow:0 24px 70px rgba(0,0,0,.76),0 0 36px rgba(45,235,133,.20),inset 0 0 24px rgba(76,220,166,.06)!important;color:#effff7!important;text-align:center!important}
      .andrik-map-exit-eye-r308{width:70px!important;height:70px!important;margin:0 auto 12px!important;border-radius:50%!important;background:url('/assets/control-topbar-eye-triangle.jpg?v=55.00-r308') center/cover no-repeat!important;box-shadow:0 0 18px rgba(91,255,180,.68),0 0 44px rgba(30,210,105,.32)!important}.andrik-map-exit-dialog-r308 h2{margin:0!important;font-size:1.58rem!important;line-height:1.08!important}.andrik-map-exit-dialog-r308 p{margin:10px auto 20px!important;max-width:320px!important;color:#a9bec7!important;font-size:.98rem!important;line-height:1.42!important}
      .andrik-map-exit-actions-r308{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}.andrik-map-exit-actions-r308 button{min-height:54px!important;border-radius:999px!important;border:1px solid rgba(160,210,226,.23)!important;font:800 1rem/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;letter-spacing:.01em!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}.andrik-map-exit-stay-r308{color:#06120c!important;background:linear-gradient(135deg,#bfffe0,#5ce6a2)!important;box-shadow:0 8px 28px rgba(68,239,152,.22)!important}.andrik-map-exit-leave-r308{color:#ffd9dc!important;background:rgba(86,18,28,.58)!important;border-color:rgba(255,103,121,.45)!important}body.andrik-map-exit-open-r308{overflow:hidden!important}
      .andrik-map-exit-toast-r308{position:fixed!important;left:50%!important;bottom:max(24px,calc(18px + env(safe-area-inset-bottom)))!important;z-index:2147483647!important;transform:translateX(-50%)!important;width:max-content!important;max-width:calc(100vw - 36px)!important;padding:11px 16px!important;border:1px solid rgba(122,204,235,.24)!important;border-radius:999px!important;background:rgba(5,18,27,.96)!important;box-shadow:0 12px 34px rgba(0,0,0,.52)!important;color:#bfd7e2!important;font:750 .82rem/1.25 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;text-align:center!important;pointer-events:none!important}
      @media(max-width:380px){.andrik-map-exit-actions-r308{grid-template-columns:1fr!important}.andrik-map-exit-dialog-r308{padding:21px 16px 16px!important}}@media(orientation:landscape) and (max-height:520px){.andrik-map-exit-dialog-r308{width:min(92vw,520px)!important;padding:16px 18px!important}.andrik-map-exit-eye-r308{width:54px!important;height:54px!important;margin-bottom:8px!important}.andrik-map-exit-dialog-r308 p{margin:7px auto 13px!important}.andrik-map-exit-actions-r308 button{min-height:46px!important}}
    `;
    document.head.appendChild(style);
  };

  const closeEyeVideo=()=>{
    const overlay=document.querySelector('.andrik-live-eye-overlay-r219.is-open');
    overlay?.querySelector('.andrik-live-eye-close-r219')?.click();
  };
  const closeModal=()=>{
    if(!modal) return;
    open=false;
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('andrik-map-exit-open-r308');
  };
  const showToast=()=>{
    injectStyle();
    if(!toast){
      toast=document.createElement('div');
      toast.className='andrik-map-exit-toast-r308';
      toast.hidden=true;
      toast.setAttribute('role','status');
      toast.textContent='Для полного выхода нажмите Домой';
      document.body.appendChild(toast);
    }
    toast.hidden=false;
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>{if(toast) toast.hidden=true;},2400);
  };
  const trySupportedClose=()=>{
    try{window.Android?.closeApp?.();}catch(_){}
    try{navigator.app?.exitApp?.();}catch(_){}
    try{window.Capacitor?.Plugins?.App?.exitApp?.();}catch(_){}
    try{window.open('','_self');window.close();}catch(_){}
  };
  const leave=()=>{
    if(closing) return;
    closing=true;
    closeModal();
    trySupportedClose();
    // No history unwind, no public-site fallback, no fake black closed page.
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
    modal.className='andrik-map-exit-guard-r308';
    modal.hidden=true;
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<section class="andrik-map-exit-dialog-r308" role="dialog" aria-modal="true" aria-labelledby="andrikMapExitTitleR308"><div class="andrik-map-exit-eye-r308" aria-hidden="true"></div><h2 id="andrikMapExitTitleR308">Выйти из Control?</h2><p>Закрыть Control сейчас?</p><div class="andrik-map-exit-actions-r308"><button class="andrik-map-exit-stay-r308" type="button">Остаться</button><button class="andrik-map-exit-leave-r308" type="button">Выйти</button></div></section>`;
    document.body.appendChild(modal);
    modal.querySelector('.andrik-map-exit-stay-r308')?.addEventListener('click',closeModal);
    const leaveBtn=modal.querySelector('.andrik-map-exit-leave-r308');
    leaveBtn?.addEventListener('pointerup',event=>{
      if(event.isPrimary===false) return;
      lastPointerExit=Date.now();
      event.preventDefault();event.stopPropagation();leave();
    },{passive:false});
    leaveBtn?.addEventListener('click',event=>{
      if(Date.now()-lastPointerExit<900){event.preventDefault();return;}
      leave();
    });
    modal.addEventListener('click',event=>{if(event.target===modal) closeModal();});
    return modal;
  };
  const showModal=()=>{
    closeEyeVideo();
    createModal();
    open=true;
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('andrik-map-exit-open-r308');
    requestAnimationFrame(()=>modal.querySelector('.andrik-map-exit-stay-r308')?.focus());
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
  addEventListener('popstate',()=>{
    if(closing) return;
    try{history.pushState(guardState(),'',location.href);}catch(_){}
    if(open){closeModal();return;}
    showModal();
  });
  addEventListener('pageshow',arm,{passive:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{createModal();arm();},{once:true});
  else{createModal();arm();}
})();
