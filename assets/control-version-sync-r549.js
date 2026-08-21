/* ANDRIK R549 — authoritative visible build marker. */
(()=>{
  'use strict';
  if(window.__ANDRIK_VERSION_SYNC_R549__)return;
  window.__ANDRIK_VERSION_SYNC_R549__=true;
  const RELEASE='R549';
  const apply=()=>{
    let meta=document.querySelector('meta[name="andrik-control-release"]');
    if(!meta&&document.head){meta=document.createElement('meta');meta.name='andrik-control-release';document.head.appendChild(meta)}
    if(meta)meta.content=RELEASE;
    document.documentElement.dataset.andrikRelease=RELEASE;
    if(document.body)document.body.dataset.andrikRelease=RELEASE;
    document.querySelectorAll('.control-version-footer').forEach(footer=>{
      const strong=footer.querySelector('strong');
      if(strong)strong.textContent=`Live Web AI · ANDRIK · версия ${RELEASE}`;
      footer.dataset.release=RELEASE;
    });
    document.querySelectorAll('[data-andrik-version]').forEach(n=>n.textContent=RELEASE);
    window.ANDRIK_CONTROL_VERSION=`55.00 LIVE WEB AI FINAL ${RELEASE}`;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('pageshow',apply,{passive:true});
  [0,100,600,1800].forEach(ms=>setTimeout(apply,ms));
})();
