/* ANDRIK Control R317 — display version sync. */
(() => {
  'use strict';
  if (window.__ANDRIK_VERSION_SYNC_R317__) return;
  window.__ANDRIK_VERSION_SYNC_R317__ = true;
  const RELEASE='R317';
  const RUNTIME='55.00-r317';
  const FULL='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R317';
  let applying=false;
  const isRoot=n=>n===document.documentElement||n===document.body;
  const setText=(n,v)=>{if(n&&!isRoot(n)&&n.textContent!==v)n.textContent=v;};
  function apply(){
    if(applying)return; applying=true;
    try{
      document.documentElement.dataset.andrikRelease=RELEASE;
      if(document.body)document.body.dataset.andrikRelease=RELEASE;
      let meta=document.querySelector('meta[name="andrik-control-release"]');
      if(!meta&&document.head){meta=document.createElement('meta');meta.name='andrik-control-release';document.head.appendChild(meta)}
      if(meta)meta.content=RELEASE;
      document.querySelectorAll('[data-andrik-version],[data-control-version],.build-version,.version-label').forEach(n=>setText(n,RELEASE));
      const isHome=document.body?.classList.contains('control-home-page');
      document.querySelectorAll('.control-version-footer').forEach(footer=>{
        const strong=footer.querySelector('strong'),span=footer.querySelector('span');
        if(isHome||footer.closest('.control-menu-page')){setText(strong,'Live Web AI');setText(span,RELEASE)}
        else if(strong){const profile=/профиль\s+ANDRIK/i.test(strong.textContent||'');setText(strong,profile?`Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL ${RELEASE}`:FULL)}
        footer.dataset.release=RELEASE;
      });
      document.querySelectorAll('.control-split-number-r181').forEach(n=>setText(n,RELEASE));
      document.querySelectorAll('.control-split-version-r181').forEach(n=>n.setAttribute('aria-label',`Live Web AI, версия ${RELEASE}`));
      document.querySelectorAll('[aria-label],[title]').forEach(el=>{for(const a of ['aria-label','title']){const v=el.getAttribute(a);if(v&&/R\d+/i.test(v))el.setAttribute(a,v.replace(/R\d+/gi,RELEASE))}});
      const releaseInput=document.getElementById('siteUpdateRelease'); if(releaseInput&&document.activeElement!==releaseInput)releaseInput.value=RELEASE;
      const messageInput=document.getElementById('siteUpdateMessage'); if(messageInput&&document.activeElement!==messageInput){const v=String(messageInput.value||'ANDRIK Control — update website');messageInput.value=/R\d+/i.test(v)?v.replace(/R\d+/ig,RELEASE):`${v.trim()} ${RELEASE}`.trim()}
      window.ANDRIK_CONTROL_RELEASE=Object.freeze({short:RELEASE,number:317,version:'55.00',full:'v55.00 LIVE WEB AI FINAL R317',build:'R317 TAG EDITOR + ADMIN BLACK SCREEN RECOVERY',date:'08.08.2026'});
      window.ANDRIK_CONTROL_VERSION='55.00 LIVE WEB AI FINAL R317';
      window.ANDRIK_CONTROL_BUILD='R317 TAG EDITOR + ADMIN BLACK SCREEN RECOVERY';
      try{localStorage.setItem('andrik-control-display-version',RUNTIME)}catch(_){}
      window.dispatchEvent(new CustomEvent('andrik-control-version-ready',{detail:window.ANDRIK_CONTROL_RELEASE}));
    }finally{applying=false}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  window.addEventListener('pageshow',apply,{passive:true}); window.addEventListener('load',apply,{once:true});
  [60,250,800,1600].forEach(ms=>setTimeout(apply,ms));
  if(document.body){const o=new MutationObserver(()=>{if(!applying)requestAnimationFrame(apply)});o.observe(document.body,{subtree:true,childList:true,characterData:true})}
})();
