(() => {
  'use strict';
  const release=Object.freeze({short:'R113',number:113,version:'55.00',full:'v55.00 LIVE WEB AI FINAL R113',build:'LIVE SECURITY HUB',date:'01.08.2026'});
  window.ANDRIK_CONTROL_RELEASE=release;
  window.ANDRIK_CONTROL_VERSION='55.00 LIVE WEB AI FINAL R113';
  window.ANDRIK_CONTROL_BUILD=release.build;
  const apply=()=>{
    document.documentElement.dataset.andrikCurrentRelease=release.short;
    if(document.body)document.body.dataset.andrikCurrentRelease=release.short;
    document.querySelectorAll('.control-version-footer strong').forEach(el=>{
      if(el===document.documentElement||el===document.body)return;
      const profile=/профиль\s+ANDRIK/i.test(el.textContent||'');
      el.textContent=profile?`Live Web AI · профиль ANDRIK · ${release.full}`:`Live Web AI · ANDRIK · ${release.full}`;
    });
    document.querySelectorAll('[data-andrik-version]').forEach(el=>{if(el!==document.documentElement&&el!==document.body)el.textContent=release.full});
    document.querySelectorAll('[data-andrik-release]').forEach(el=>{if(el!==document.documentElement&&el!==document.body)el.textContent=release.short});
    window.dispatchEvent(new CustomEvent('andrik-control-version-ready',{detail:release}));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
