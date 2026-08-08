/* ANDRIK Control R320 — lightweight display version sync, no observer. */
(()=>{'use strict';
const RELEASE='R320',FULL='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R320';
function sync(){
  document.documentElement.dataset.andrikRelease=RELEASE;
  if(document.body)document.body.dataset.andrikRelease=RELEASE;
  const meta=document.querySelector('meta[name="andrik-control-release"]'); if(meta)meta.content=RELEASE;
  document.querySelectorAll('.control-version-footer strong,[data-control-version],.build-version,.version-label,.control-split-number-r181').forEach(el=>{
    if(el.matches('.control-version-footer strong')) el.textContent=/профиль\s+ANDRIK/i.test(el.textContent||'')?`Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL ${RELEASE}`:FULL;
    else el.textContent=RELEASE;
  });
  document.querySelectorAll('.control-split-version-r181').forEach(el=>el.setAttribute('aria-label',`Live Web AI, версия ${RELEASE}`));
  const rel=document.getElementById('siteUpdateRelease'); if(rel&&document.activeElement!==rel)rel.value=RELEASE;
  window.ANDRIK_CONTROL_VERSION='55.00 LIVE WEB AI FINAL R320';
  window.ANDRIK_CONTROL_BUILD='R320 R316 CAROUSEL RESTORE + TAG EDITOR';
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',sync,{once:true}):sync();
window.addEventListener('pageshow',sync,{passive:true});
setTimeout(sync,300);setTimeout(sync,1200);
})();