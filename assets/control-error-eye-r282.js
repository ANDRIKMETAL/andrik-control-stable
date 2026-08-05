(() => {
  'use strict';
  if(window.__ANDRIK_ERROR_EYE_R282__)return;
  window.__ANDRIK_ERROR_EYE_R282__=true;
  const root=document.documentElement;
  const logo=document.getElementById('controlCenterLogo')||document.querySelector('.control-center-logo');
  if(!logo)return;
  const style=document.createElement('style');
  style.id='andrik-error-eye-r282-style';
  style.textContent=`
    html[data-andrik-header-state="red"] .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-header-state="red"] .control-center-logo .logo-ok{display:none!important;opacity:0!important;visibility:hidden!important}
    html[data-andrik-header-state="red"] .control-center-logo .andrik-live-eye-motion-r244 .logo-error,
    html[data-andrik-header-state="red"] .control-center-logo .logo-error{display:block!important;opacity:1!important;visibility:visible!important;filter:brightness(1.25) saturate(1.8) drop-shadow(0 0 17px rgba(255,92,110,.98)) drop-shadow(0 0 42px rgba(255,28,58,.92))!important}
  `;
  document.head.appendChild(style);
  const hasError=()=>{
    const stages=document.getElementById('siteUpdateStages');
    const result=document.getElementById('siteUpdateResultState');
    const text=[result?.textContent,document.getElementById('siteUpdateResultText')?.textContent,document.getElementById('siteUpdatePublishMessage')?.textContent,document.getElementById('siteUpdateDeployMessage')?.textContent].filter(Boolean).join(' ');
    return Boolean(stages?.querySelector('.is-error'))||result?.classList.contains('is-error')||/ошиб|сбой|failed to fetch|failure|неуда|критичес/i.test(text);
  };
  const sync=()=>{
    const error=hasError();
    if(error){
      root.dataset.andrikHeaderState='red';
      logo.classList.add('is-error');
      logo.dataset.r282Error='1';
      try{window.dispatchEvent(new CustomEvent('andrik:eye-glow',{detail:{state:'red'}}))}catch(_){}
    }else if(logo.dataset.r282Error==='1'){
      delete logo.dataset.r282Error;
      logo.classList.remove('is-error');
      try{window.dispatchEvent(new CustomEvent('andrik:eye-glow',{detail:{state:'auto'}}))}catch(_){}
    }
  };
  const targets=[document.getElementById('siteUpdateStages'),document.getElementById('siteUpdateResultState'),document.getElementById('siteUpdateResultText'),document.getElementById('siteUpdatePublishMessage'),document.getElementById('siteUpdateDeployMessage')].filter(Boolean);
  const observer=new MutationObserver(()=>requestAnimationFrame(sync));
  targets.forEach(target=>observer.observe(target,{subtree:true,attributes:true,childList:true,characterData:true}));
  window.addEventListener('andrik:site-update-stage',sync);
  window.addEventListener('pageshow',sync,{passive:true});
  setInterval(sync,600);
  sync();
})();
