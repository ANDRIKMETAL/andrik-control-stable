/* ANDRIK Control R305 — immediate reliable exit from Control on Android/PWA. */
(()=>{
  'use strict';
  const STATE_KEY='__andrikControlExitGuardR305';
  const EXIT_URL='https://andrikmetal.com/';
  let modal=null,open=false,leaving=false,lastPointerExit=0;
  const injectStyle=()=>{
    if(document.getElementById('andrik-exit-guard-style-r305'))return;
    const style=document.createElement('style');
    style.id='andrik-exit-guard-style-r305';
    style.textContent=`
      .andrik-exit-guard-r305[hidden]{display:none!important}.andrik-exit-guard-r305{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:22px max(18px,env(safe-area-inset-right)) max(22px,calc(18px + env(safe-area-inset-bottom))) max(18px,env(safe-area-inset-left))!important;background:rgba(0,5,8,.76)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important}
      .andrik-exit-dialog-r305{width:min(100%,420px)!important;box-sizing:border-box!important;padding:24px 20px 18px!important;border:1px solid rgba(112,255,183,.38)!important;border-radius:28px!important;background:linear-gradient(160deg,rgba(8,24,29,.98),rgba(2,8,13,.99))!important;box-shadow:0 24px 70px rgba(0,0,0,.72),0 0 34px rgba(45,235,133,.16),inset 0 0 22px rgba(76,220,166,.05)!important;color:#effff7!important;text-align:center!important}
      .andrik-exit-eye-r305{width:68px!important;height:68px!important;margin:0 auto 12px!important;border-radius:50%!important;background:url('/assets/control-topbar-eye-triangle.jpg?v=55.00-r305') center/cover no-repeat!important;box-shadow:0 0 18px rgba(91,255,180,.62),0 0 42px rgba(30,210,105,.28)!important}
      .andrik-exit-dialog-r305 h2{margin:0!important;font-size:1.58rem!important;line-height:1.08!important}.andrik-exit-dialog-r305 p{margin:10px auto 20px!important;max-width:310px!important;color:#a9bec7!important;font-size:.98rem!important;line-height:1.42!important}.andrik-exit-actions-r305{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}.andrik-exit-actions-r305 button{min-height:54px!important;border-radius:999px!important;border:1px solid rgba(160,210,226,.23)!important;font:800 1rem/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif!important;letter-spacing:.01em!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}.andrik-exit-stay-r305{color:#06120c!important;background:linear-gradient(135deg,#bfffe0,#5ce6a2)!important;box-shadow:0 8px 28px rgba(68,239,152,.20)!important}.andrik-exit-leave-r305{color:#ffd9dc!important;background:rgba(86,18,28,.54)!important;border-color:rgba(255,103,121,.42)!important}@media(max-width:380px){.andrik-exit-actions-r305{grid-template-columns:1fr!important}.andrik-exit-dialog-r305{padding:21px 16px 16px!important}}`;
    document.head.appendChild(style);
  };
  const close=()=>{if(!modal)return;open=false;modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('andrik-exit-open-r305')};
  const leave=()=>{
    if(leaving)return;
    leaving=true;
    close();
    try{history.replaceState({...(history.state||{}),[STATE_KEY]:'leave'},'',location.href)}catch(_){ }
    // Deterministic exit: do not wait for Android history to unwind two guard entries.
    location.replace(EXIT_URL);
  };
  const create=()=>{
    if(modal)return modal;injectStyle();modal=document.createElement('div');modal.className='andrik-exit-guard-r305';modal.hidden=true;modal.setAttribute('aria-hidden','true');modal.innerHTML=`<section class="andrik-exit-dialog-r305" role="dialog" aria-modal="true" aria-labelledby="andrikExitTitleR305"><div class="andrik-exit-eye-r305" aria-hidden="true"></div><h2 id="andrikExitTitleR305">Выйти из Control?</h2><p>Вы нажали «Назад». Выйти из панели или остаться здесь?</p><div class="andrik-exit-actions-r305"><button class="andrik-exit-stay-r305" type="button">Остаться</button><button class="andrik-exit-leave-r305" type="button">Выйти</button></div></section>`;document.body.appendChild(modal);
    const stay=modal.querySelector('.andrik-exit-stay-r305'),leaveBtn=modal.querySelector('.andrik-exit-leave-r305');
    stay?.addEventListener('click',close);
    leaveBtn?.addEventListener('pointerup',e=>{if(e.isPrimary===false)return;lastPointerExit=Date.now();e.preventDefault();e.stopPropagation();leave()},{passive:false});
    leaveBtn?.addEventListener('click',e=>{if(Date.now()-lastPointerExit<900){e.preventDefault();return}leave()});
    modal.addEventListener('click',e=>{if(e.target===modal)close()});return modal;
  };
  const show=()=>{create();open=true;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('andrik-exit-open-r305');requestAnimationFrame(()=>modal.querySelector('.andrik-exit-stay-r305')?.focus())};
  const arm=()=>{if(leaving)return;try{history.replaceState({...(history.state||{}),[STATE_KEY]:'base'},'',location.href);history.pushState({...(history.state||{}),[STATE_KEY]:'guard'},'',location.href)}catch(_){ }};
  addEventListener('popstate',()=>{if(leaving)return;try{history.pushState({...(history.state||{}),[STATE_KEY]:'guard'},'',location.href)}catch(_){ }if(open){close();return}show()});
  addEventListener('pageshow',()=>{if(!leaving)arm()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{create();arm()},{once:true});else{create();arm()}
})();
