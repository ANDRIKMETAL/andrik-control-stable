(() => {
  'use strict';
  if (window.__ANDRIK_VERSION_SYNC_R269__) return;
  window.__ANDRIK_VERSION_SYNC_R269__ = true;
  const RELEASE='R269';
  const FULL='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R269';
  const PROFILE='Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL R269';

  const apply=()=>{
    document.documentElement.dataset.andrikRelease=RELEASE;
    let meta=document.querySelector('meta[name="andrik-control-release"]');
    if(!meta){meta=document.createElement('meta');meta.name='andrik-control-release';document.head.appendChild(meta);}
    meta.content=RELEASE;
    document.querySelectorAll('[data-andrik-version],[data-andrik-release]').forEach(node=>node.textContent=RELEASE);
    document.querySelectorAll('.control-version-footer').forEach(footer=>{
      const strong=footer.querySelector('strong');
      const span=footer.querySelector('span');
      if(document.body.classList.contains('control-home-page')){
        if(strong)strong.textContent='Live Web AI';
        if(span)span.textContent=RELEASE;
      }else if(strong){
        strong.textContent=/профиль\s+ANDRIK/i.test(strong.textContent||'')?PROFILE:FULL;
      }
      footer.dataset.release=RELEASE;
    });
    document.querySelectorAll('.control-split-number-r181').forEach(node=>node.textContent=RELEASE);
    document.querySelectorAll('.control-split-version-r181').forEach(node=>node.setAttribute('aria-label',`Live Web AI, версия ${RELEASE}`));
    try{localStorage.setItem('andrik-control-runtime-version','55.00-r269');}catch(_){ }
  };

  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('load',apply,{once:true});
  window.addEventListener('pageshow',apply,{passive:true});
  window.addEventListener('andrik-control-version-ready',apply);
  [80,250,700,1500,2600].forEach(ms=>setTimeout(apply,ms));
  const observer=new MutationObserver(()=>apply());
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
