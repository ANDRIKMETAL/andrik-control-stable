/* ANDRIK Control R389 — authoritative display-version synchronization. */
(()=>{
  'use strict';
  if(window.__ANDRIK_VERSION_SYNC_R389__)return;
  window.__ANDRIK_VERSION_SYNC_R389__=true;
  const RELEASE='R389';
  const RUNTIME='55.00-r389';
  let busy=false;
  const apply=()=>{
    if(busy)return; busy=true;
    try{
      let meta=document.querySelector('meta[name="andrik-control-release"]');
      if(!meta&&document.head){meta=document.createElement('meta');meta.name='andrik-control-release';document.head.appendChild(meta);}
      if(meta)meta.content=RELEASE;
      document.documentElement.dataset.andrikRelease=RELEASE;
      if(document.body)document.body.dataset.andrikRelease=RELEASE;
      const isHome=document.body?.classList.contains('control-home-page');
      document.querySelectorAll('.control-version-footer').forEach(footer=>{
        const strong=footer.querySelector('strong');
        const span=footer.querySelector('span');
        if(isHome||footer.closest('.control-menu-page')){
          if(strong)strong.textContent='Live Web AI';
          if(span)span.textContent=RELEASE;
        }else if(strong){
          const profile=/профиль\s+ANDRIK/i.test(strong.textContent||'');
          strong.textContent=profile?`Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL ${RELEASE}`:`Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL ${RELEASE}`;
        }
        footer.dataset.release=RELEASE;
      });
      document.querySelectorAll('.control-split-number-r181').forEach(n=>n.textContent=RELEASE);
      document.querySelectorAll('.control-split-version-r181').forEach(n=>n.setAttribute('aria-label',`Live Web AI, версия ${RELEASE}`));
      document.querySelectorAll('[data-andrik-version]').forEach(n=>n.textContent=RELEASE);
      window.ANDRIK_CONTROL_VERSION=`55.00 LIVE WEB AI FINAL ${RELEASE}`;
      window.ANDRIK_CONTROL_BUILD='R389 VERSION LOCK + ERROR JOURNAL SPOILER';
      try{localStorage.setItem('andrik-control-display-version',RUNTIME)}catch(_){ }
      window.dispatchEvent(new CustomEvent('andrik-control-version-ready',{detail:{short:RELEASE,number:389,version:'55.00'}}));
    }finally{busy=false;}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  window.addEventListener('load',apply,{once:true});
  window.addEventListener('pageshow',apply,{passive:true});
  [80,260,850,1700,2600].forEach(ms=>setTimeout(apply,ms));
})();
