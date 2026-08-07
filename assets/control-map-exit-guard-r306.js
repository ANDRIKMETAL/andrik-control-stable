/* ANDRIK Control R306 — one-tap exit guard on analytics/map. */
(()=>{
  'use strict';
  if(window.__ANDRIK_MAP_EXIT_GUARD_R306__) return;
  window.__ANDRIK_MAP_EXIT_GUARD_R306__=true;

  const STATE_KEY='__andrikMapExitGuardR306';
  const EXIT_URL='https://andrikmetal.com/';
  let modal=null,open=false,leaving=false,lastPointerExit=0;

  const injectStyle=()=>{
    if(document.getElementById('andrik-map-exit-style-r306'))return;
    const style=document.createElement('style');
    style.id='andrik-map-exit-style-r306';
    style.textContent=`
      .andrik-map-exit-guard-r306[hidden]{display:none!important}
      .andrik-map-exit-guard-r306{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:max(22px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(22px,calc(18px + env(safe-area-inset-bottom))) max(18px,env(safe-area-inset-left))!important;background:rgba(0,5,8,.80)!important;backdrop-filter:blur(13px)!important;-webkit-backdrop-filter:blur(13px)!important}
      .andrik-map-exit-dialog-r306{width:min(100%,420px)!important;box-sizing:border-box!important;padding:24px 20px 18px!important;border:2px solid rgba(112,255,183,.48)!important;border-radius:28px!important;background:linear-gradient(160deg,rgba(8,24,29,.99),rgba(2,8,13,.995))!important;box-shadow:0 24px 70px rgba(0,0,0,.76),0 0 36px rgba(45,235,133,.20),inset 0 0 24px rgba(76,220,166,.06)!important;color:#effff7!important;text-align:center!important}
      .andrik-map-exit-eye-r306{width:70px!important;height:70px!important;margin:0 auto 12px!important;border-radius:50%!important;background:url('/assets/control-topbar-eye-triangle.jpg?v=55.00-r306') center/cover no-repeat!important;box-shadow:0 0 18px rgba(91,255,180,.68),0 0 44px rgba(30,210,105,.32)!important}
      .andrik-map-exit-dialog-r306 h2{margin:0!important;font-size:1.58rem!important;line-height:1.08!important}
      .andrik-map-exit-dialog-r306 p{margin:10px auto 20px!important;max-width:320px!important;color:#a9bec7!important;font-size:.98rem!important;line-height:1.42!important}
      .andrik-map-exit-actions-r306{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
      .andrik-map-exit-actions-r306 button{min-height:54px!important;border-radius:999px!important;border:1px solid rgba(160,210,226,.23)!important;font:800 1rem/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;letter-spacing:.01em!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
      .andrik-map-exit-stay-r306{color:#06120c!important;background:linear-gradient(135deg,#bfffe0,#5ce6a2)!important;box-shadow:0 8px 28px rgba(68,239,152,.22)!important}
      .andrik-map-exit-leave-r306{color:#ffd9dc!important;background:rgba(86,18,28,.58)!important;border-color:rgba(255,103,121,.45)!important}
      body.andrik-map-exit-open-r306{overflow:hidden!important}
      @media(max-width:380px){.andrik-map-exit-actions-r306{grid-template-columns:1fr!important}.andrik-map-exit-dialog-r306{padding:21px 16px 16px!important}}
      @media(orientation:landscape) and (max-height:520px){.andrik-map-exit-dialog-r306{width:min(92vw,520px)!important;padding:16px 18px!important}.andrik-map-exit-eye-r306{width:54px!important;height:54px!important;margin-bottom:8px!important}.andrik-map-exit-dialog-r306 p{margin:7px auto 13px!important}.andrik-map-exit-actions-r306 button{min-height:46px!important}}
    `;
    document.head.appendChild(style);
  };

  const closeEyeVideo=()=>{
    const overlay=document.querySelector('.andrik-live-eye-overlay-r219.is-open');
    overlay?.querySelector('.andrik-live-eye-close-r219')?.click();
  };
  const close=()=>{
    if(!modal)return;
    open=false;modal.hidden=true;modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('andrik-map-exit-open-r306');
  };
  const leave=()=>{
    if(leaving)return;
    leaving=true;close();
    try{sessionStorage.setItem('andrik-control-exit-r306','1')}catch(_){ }
    try{history.replaceState({...(history.state||{}),[STATE_KEY]:'leave'},'',location.href)}catch(_){ }
    try{window.open('','_self');window.close()}catch(_){ }
    setTimeout(()=>{
      try{
        if(history.length>1) history.go(-2);
        else location.replace(EXIT_URL);
      }catch(_){location.replace(EXIT_URL);}
    },20);
    setTimeout(()=>{
      if(document.visibilityState!=='hidden'){
        try{location.replace(EXIT_URL)}catch(_){ }
      }
    },420);
  };
  const create=()=>{
    if(modal)return modal;
    injectStyle();modal=document.createElement('div');modal.className='andrik-map-exit-guard-r306';modal.hidden=true;modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<section class="andrik-map-exit-dialog-r306" role="dialog" aria-modal="true" aria-labelledby="andrikMapExitTitleR306"><div class="andrik-map-exit-eye-r306" aria-hidden="true"></div><h2 id="andrikMapExitTitleR306">Выйти из Control?</h2><p>Выйти из панели сейчас?</p><div class="andrik-map-exit-actions-r306"><button class="andrik-map-exit-stay-r306" type="button">Остаться</button><button class="andrik-map-exit-leave-r306" type="button">Выйти</button></div></section>`;
    document.body.appendChild(modal);
    const stay=modal.querySelector('.andrik-map-exit-stay-r306');
    const leaveBtn=modal.querySelector('.andrik-map-exit-leave-r306');
    stay?.addEventListener('click',close);
    leaveBtn?.addEventListener('pointerup',e=>{if(e.isPrimary===false)return;lastPointerExit=Date.now();e.preventDefault();e.stopPropagation();leave()},{passive:false});
    leaveBtn?.addEventListener('click',e=>{if(Date.now()-lastPointerExit<900){e.preventDefault();return;}leave()});
    modal.addEventListener('click',e=>{if(e.target===modal)close()});
    return modal;
  };
  const show=()=>{closeEyeVideo();create();open=true;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('andrik-map-exit-open-r306');requestAnimationFrame(()=>modal.querySelector('.andrik-map-exit-stay-r306')?.focus())};
  const arm=()=>{if(leaving)return;try{history.replaceState({...(history.state||{}),[STATE_KEY]:'base'},'',location.href);history.pushState({...(history.state||{}),[STATE_KEY]:'guard'},'',location.href)}catch(_){ }};
  addEventListener('popstate',()=>{if(leaving)return;try{history.pushState({...(history.state||{}),[STATE_KEY]:'guard'},'',location.href)}catch(_){ }if(open){close();return;}show()});
  addEventListener('pageshow',()=>{if(!leaving)arm()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{create();arm()},{once:true});else{create();arm();}
})();
