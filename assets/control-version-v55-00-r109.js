(() => {
  'use strict';
  const release = Object.freeze({
    short: 'R109',
    number: 109,
    version: '55.00',
    full: 'v55.00 LIVE WEB AI FINAL R109',
    build: 'ANDRIK POLISH + VERSION SYNC + YOUTUBE EVENT CONTROL',
    date: '01.08.2026'
  });
  window.ANDRIK_CONTROL_RELEASE = release;
  window.ANDRIK_CONTROL_VERSION = '55.00 LIVE WEB AI FINAL R109';
  window.ANDRIK_CONTROL_BUILD = release.build;
  const apply = () => {
    document.documentElement.dataset.andrikRelease = release.short;
    document.body?.setAttribute('data-andrik-release', release.short);
    document.querySelectorAll('.control-version-footer strong').forEach(el => {
      const profile = /профиль\s+ANDRIK/i.test(el.textContent || '');
      el.textContent = profile
        ? `Live Web AI · профиль ANDRIK · ${release.full}`
        : `Live Web AI · ANDRIK · ${release.full}`;
    });
    document.querySelectorAll('[data-andrik-version]').forEach(el => { el.textContent = release.full; });
    document.querySelectorAll('[data-andrik-release]').forEach(el => { el.textContent = release.short; });
    window.dispatchEvent(new CustomEvent('andrik-control-version-ready', { detail: release }));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else apply();
})();
