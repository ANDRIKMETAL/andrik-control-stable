(() => {
  'use strict';
  const RELEASE='R271';
  const apply=()=>{
    const meta=document.querySelector('meta[name="andrik-control-release"]');
    if(meta)meta.content=RELEASE;
    document.querySelectorAll('.control-version-footer strong').forEach(node=>{node.textContent='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL '+RELEASE;});
    document.querySelectorAll('.control-version-footer span').forEach(node=>{if(node.closest('.control-version-footer')?.querySelector('strong')) node.dataset.release=RELEASE;});
    document.querySelectorAll('.control-split-number-r181').forEach(node=>{node.textContent=RELEASE;});
    document.querySelectorAll('.control-split-version-r181').forEach(node=>{node.setAttribute('aria-label','Live Web AI, версия '+RELEASE);});
    const release=document.getElementById('siteUpdateRelease'); if(release)release.value=RELEASE;
    const message=document.getElementById('siteUpdateMessage'); if(message&&/R\d+/i.test(message.value||''))message.value=(message.value||'ANDRIK Control — update website').replace(/R\d+/ig,RELEASE);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('pageshow',apply,{passive:true});
  setTimeout(apply,60);setTimeout(apply,500);
})();
