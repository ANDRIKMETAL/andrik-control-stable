(() => {
  'use strict';
  const release = Object.freeze({
    short:'R120', number:115, version:'55.00',
    full:'v55.00 LIVE WEB AI FINAL R120',
    build:'UNIFIED GLOW FRAME', date:'01.08.2026'
  });
  window.ANDRIK_CONTROL_RELEASE=release;
  window.ANDRIK_CONTROL_VERSION='55.00 LIVE WEB AI FINAL R120';
  window.ANDRIK_CONTROL_BUILD=release.build;
  const apply=()=>{
    document.documentElement.dataset.andrikCurrentRelease=release.short;
    if(document.body)document.body.dataset.andrikCurrentRelease=release.short;
    document.querySelectorAll('.control-version-footer strong').forEach(element=>{
      if(element===document.documentElement||element===document.body)return;
      if(element.closest('.control-menu-page'))return; // menu footer has deliberately short copy
      const profile=/профиль\s+ANDRIK/i.test(element.textContent||'');
      element.textContent=profile?`Live Web AI · профиль ANDRIK · ${release.full}`:`Live Web AI · ANDRIK · ${release.full}`;
    });
    document.querySelectorAll('[data-andrik-version]').forEach(element=>{
      if(element===document.documentElement||element===document.body)return;
      element.textContent=release.full;
    });
    document.querySelectorAll('[data-andrik-release]').forEach(element=>{
      if(element===document.documentElement||element===document.body)return;
      element.textContent=release.short;
    });
    window.dispatchEvent(new CustomEvent('andrik-control-version-ready',{detail:release}));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
