(() => {
  'use strict';
  if(window.__ANDRIK_VERSION_SYNC_R270__)return;
  window.__ANDRIK_VERSION_SYNC_R270__=true;
  const RELEASE='R270';
  const FULL='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R270';
  const apply=()=>{
    document.documentElement.dataset.andrikRelease=RELEASE;
    let meta=document.querySelector('meta[name="andrik-control-release"]');
    if(!meta){meta=document.createElement('meta');meta.name='andrik-control-release';document.head.appendChild(meta);}
    meta.content=RELEASE;
    document.querySelectorAll('[data-andrik-version]').forEach(node=>node.textContent=RELEASE);
    document.querySelectorAll('.control-version-footer').forEach(footer=>{
      const strong=footer.querySelector('strong');
      const span=footer.querySelector('span');
      if(document.body.classList.contains('control-home-page')){
        if(strong)strong.textContent='Live Web AI';
        if(span)span.textContent=RELEASE;
      }else if(strong){
        strong.textContent=FULL;
      }
      footer.dataset.release=RELEASE;
    });
    try{localStorage.setItem('andrik-control-runtime-version','55.00-r270');}catch(_){}
  };
  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('pageshow',apply,{passive:true});
  const observer=new MutationObserver(()=>{
    const home=document.body?.classList.contains('control-home-page');
    const bad=[...document.querySelectorAll('.control-version-footer')].some(footer=>{
      const strong=footer.querySelector('strong')?.textContent||'';
      const span=footer.querySelector('span')?.textContent||'';
      return home ? span!==RELEASE : !strong.includes(RELEASE);
    });
    if(bad)apply();
  });
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
