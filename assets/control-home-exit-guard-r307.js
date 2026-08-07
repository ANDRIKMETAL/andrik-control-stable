/* ANDRIK Control R307 — one-tap exit without redirecting to the public site.
   Installed PWAs cannot be force-killed by standard browser JavaScript on every Android build.
   We try any available native bridge + window.close(); if Android refuses, Control is covered by
   a local closed screen and is restored on the next app activation. Never navigate to andrikmetal.com. */
(()=>{
  'use strict';
  if(window.__ANDRIK_HOME_EXIT_GUARD_R307__) return;
  window.__ANDRIK_HOME_EXIT_GUARD_R307__=true;

  const STATE_KEY='__andrikControlExitGuardR307';
  let modal=null, closedScreen=null, open=false, leaving=false, lastPointerExit=0, hiddenAfterExit=false;

  const injectStyle=()=>{
    if(document.getElementById('andrik-exit-guard-style-r307')) return;
    const style=document.createElement('style');
    style.id='andrik-exit-guard-style-r307';
    style.textContent=`
      .andrik-exit-guard-r307[hidden],.andrik-control-closed-r307[hidden]{display:none!important}
      .andrik-exit-guard-r307{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:22px max(18px,env(safe-area-inset-right)) max(22px,calc(18px + env(safe-area-inset-bottom))) max(18px,env(safe-area-inset-left))!important;background:rgba(0,5,8,.76)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important}
      .andrik-exit-dialog-r307{width:min(100%,420px)!important;box-sizing:border-box!important;padding:24px 20px 18px!important;border:1px solid rgba(112,255,183,.38)!important;border-radius:28px!important;background:linear-gradient(160deg,rgba(8,24,29,.98),rgba(2,8,13,.99))!important;box-shadow:0 24px 70px rgba(0,0,0,.72),0 0 34px rgba(45,235,133,.16),inset 0 0 22px rgba(76,220,166,.05)!important;color:#effff7!important;text-align:center!important}
      .andrik-exit-eye-r307{width:68px!important;height:68px!important;margin:0 auto 12px!important;border-radius:50%!important;background:url('/assets/control-topbar-eye-triangle.jpg?v=55.00-r307') center/cover no-repeat!important;box-shadow:0 0 18px rgba(91,255,180,.62),0 0 42px rgba(30,210,105,.28)!important}
      .andrik-exit-dialog-r307 h2{margin:0!important;font-size:1.58rem!important;line-height:1.08!important}.andrik-exit-dialog-r307 p{margin:10px auto 20px!important;max-width:310px!important;color:#a9bec7!important;font-size:.98rem!important;line-height:1.42!important}
      .andrik-exit-actions-r307{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}.andrik-exit-actions-r307 button{min-height:54px!important;border-radius:999px!important;border:1px solid rgba(160,210,226,.23)!important;font:800 1rem/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;letter-spacing:.01em!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
      .andrik-exit-stay-r307{color:#06120c!important;background:linear-gradient(135deg,#bfffe0,#5ce6a2)!important;box-shadow:0 8px 28px rgba(68,239,152,.20)!important}.andrik-exit-leave-r307{color:#ffd9dc!important;background:rgba(86,18,28,.54)!important;border-color:rgba(255,103,121,.42)!important}
      body.andrik-exit-open-r307{overflow:hidden!important}
      .andrik-control-closed-r307{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;background:#000!important;color:#78909a!important;font:700 .82rem/1.3 system-ui,sans-serif!important;text-align:center!important;letter-spacing:.02em!important;user-select:none!important;-webkit-user-select:none!important}
      .andrik-control-closed-r307 span{opacity:.55!important}
      @media(max-width:380px){.andrik-exit-actions-r307{grid-template-columns:1fr!important}.andrik-exit-dialog-r307{padding:21px 16px 16px!important}}
    `;
    document.head.appendChild(style);
  };

  const closeModal=()=>{
    if(!modal) return;
    open=false; modal.hidden=true; modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('andrik-exit-open-r307');
  };

  const showClosedScreen=()=>{
    injectStyle();
    if(!closedScreen){
      closedScreen=document.createElement('div');
      closedScreen.className='andrik-control-closed-r307';
      closedScreen.hidden=true;
      closedScreen.setAttribute('aria-hidden','true');
      closedScreen.innerHTML='<span>Control закрыт</span>';
      document.body.appendChild(closedScreen);
    }
    closedScreen.hidden=false;
    closedScreen.setAttribute('aria-hidden','false');
  };

  const tryNativeClose=()=>{
    // Optional native bridges if Control is ever wrapped in a native shell.
    try{ window.Android?.closeApp?.(); }catch(_){ }
    try{ navigator.app?.exitApp?.(); }catch(_){ }
    try{ window.Capacitor?.Plugins?.App?.exitApp?.(); }catch(_){ }
    try{ window.open('','_self'); window.close(); }catch(_){ }
  };

  const leave=()=>{
    if(leaving) return;
    leaving=true;
    closeModal();
    try{ sessionStorage.setItem('andrik-control-exit-r307','1'); }catch(_){ }
    try{ history.replaceState({...(history.state||{}),[STATE_KEY]:'leave'},'',location.href); }catch(_){ }
    tryNativeClose();
    // IMPORTANT: no history.back/go and no external redirect. That was what opened the public site.
    setTimeout(()=>{
      if(document.visibilityState!=='hidden') showClosedScreen();
    },180);
  };

  const create=()=>{
    if(modal) return modal;
    injectStyle();
    modal=document.createElement('div');
    modal.className='andrik-exit-guard-r307';
    modal.hidden=true; modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<section class="andrik-exit-dialog-r307" role="dialog" aria-modal="true" aria-labelledby="andrikExitTitleR307"><div class="andrik-exit-eye-r307" aria-hidden="true"></div><h2 id="andrikExitTitleR307">Выйти из Control?</h2><p>Закрыть Control сейчас?</p><div class="andrik-exit-actions-r307"><button class="andrik-exit-stay-r307" type="button">Остаться</button><button class="andrik-exit-leave-r307" type="button">Выйти</button></div></section>`;
    document.body.appendChild(modal);
    const stay=modal.querySelector('.andrik-exit-stay-r307');
    const leaveBtn=modal.querySelector('.andrik-exit-leave-r307');
    stay?.addEventListener('click',closeModal);
    leaveBtn?.addEventListener('pointerup',e=>{if(e.isPrimary===false)return;lastPointerExit=Date.now();e.preventDefault();e.stopPropagation();leave()},{passive:false});
    leaveBtn?.addEventListener('click',e=>{if(Date.now()-lastPointerExit<900){e.preventDefault();return;}leave()});
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    return modal;
  };

  const show=()=>{create();open=true;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('andrik-exit-open-r307');requestAnimationFrame(()=>modal.querySelector('.andrik-exit-stay-r307')?.focus())};
  const arm=()=>{if(leaving)return;try{history.replaceState({...(history.state||{}),[STATE_KEY]:'base'},'',location.href);history.pushState({...(history.state||{}),[STATE_KEY]:'guard'},'',location.href)}catch(_){ }};

  addEventListener('popstate',()=>{if(leaving)return;try{history.pushState({...(history.state||{}),[STATE_KEY]:'guard'},'',location.href)}catch(_){ }if(open){closeModal();return;}show()});
  document.addEventListener('visibilitychange',()=>{
    if(!leaving) return;
    if(document.visibilityState==='hidden'){ hiddenAfterExit=true; return; }
    if(hiddenAfterExit && document.visibilityState==='visible'){
      // App was left and opened again: restore the normal Control start screen locally.
      location.replace('/control-home.html?page=menu&fresh='+Date.now());
    }
  },{passive:true});
  addEventListener('pageshow',()=>{if(!leaving)arm()},{passive:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{create();arm()},{once:true}); else {create();arm();}
})();
