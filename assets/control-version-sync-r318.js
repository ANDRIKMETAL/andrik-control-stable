/* ANDRIK Control R318 — lightweight display version sync (no global MutationObserver). */
(()=>{'use strict';
if(window.__ANDRIK_VERSION_SYNC_R318__)return;window.__ANDRIK_VERSION_SYNC_R318__=true;
const RELEASE='R318',FULL='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R318';
function sync(){
  try{
    document.documentElement.dataset.andrikRelease=RELEASE;
    if(document.body)document.body.dataset.andrikRelease=RELEASE;
    const meta=document.querySelector('meta[name="andrik-control-release"]');if(meta)meta.content=RELEASE;
    document.querySelectorAll('.control-version-footer strong,[data-control-version],.build-version,.version-label,.control-split-number-r181').forEach(el=>{
      if(el.matches('.control-version-footer strong')){
        const profile=/профиль\s+ANDRIK/i.test(el.textContent||'');
        el.textContent=profile?`Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL ${RELEASE}`:FULL;
      }else el.textContent=RELEASE;
    });
    document.querySelectorAll('.control-split-version-r181').forEach(el=>el.setAttribute('aria-label',`Live Web AI, версия ${RELEASE}`));
    const releaseInput=document.getElementById('siteUpdateRelease');if(releaseInput&&document.activeElement!==releaseInput)releaseInput.value=RELEASE;
    window.ANDRIK_CONTROL_RELEASE=Object.freeze({short:RELEASE,number:318,version:'55.00',full:'v55.00 LIVE WEB AI FINAL R318',build:'R318 FAST GESTURES + TAG EDITOR',date:'08.08.2026'});
    window.ANDRIK_CONTROL_VERSION='55.00 LIVE WEB AI FINAL R318';
    window.ANDRIK_CONTROL_BUILD='R318 FAST GESTURES + TAG EDITOR';
    try{localStorage.setItem('andrik-control-display-version','55.00-r318')}catch(_){ }
  }catch(_){ }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
window.addEventListener('pageshow',sync,{passive:true});
setTimeout(sync,350);
})();
