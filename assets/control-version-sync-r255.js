(() => {
  'use strict';
  if (window.__ANDRIK_VERSION_SYNC_R255__) return;
  window.__ANDRIK_VERSION_SYNC_R255__ = true;
  const RELEASE = 'R255';
  const FULL = 'Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R255';

  const apply = () => {
    const meta = document.querySelector('meta[name="andrik-control-release"]');
    if (meta) meta.content = RELEASE;
    document.documentElement.dataset.andrikControlRelease = RELEASE;
    document.body?.setAttribute('data-andrik-control-release', RELEASE);

    document.querySelectorAll('.control-version-footer strong').forEach(node => {
      if (node.closest('.control-menu-page')) node.textContent = 'Live Web AI';
      else node.textContent = FULL;
    });
    document.querySelectorAll('.control-menu-page .control-version-footer span').forEach(node => { node.textContent = RELEASE; });
    document.querySelectorAll('.control-split-number-r181').forEach(node => { node.textContent = RELEASE; });
    document.querySelectorAll('.control-split-version-r181').forEach(node => { node.setAttribute('aria-label', `Live Web AI, версия ${RELEASE}`); });

    const release = document.getElementById('siteUpdateRelease');
    if (release) release.value = RELEASE;
    const message = document.getElementById('siteUpdateMessage');
    if (message) {
      const base = String(message.value || 'ANDRIK Control — update website');
      message.value = /R\d+/i.test(base) ? base.replace(/R\d+/ig, RELEASE) : `${base} ${RELEASE}`;
    }

    document.querySelectorAll('[data-release-fallback]').forEach(node => { node.dataset.releaseFallback = RELEASE; });
    window.dispatchEvent(new CustomEvent('andrik-control-version-ready', { detail:{ release:RELEASE } }));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else apply();
  window.addEventListener('pageshow', apply, { passive:true });
  [60, 300, 900, 1800].forEach(ms => setTimeout(apply, ms));
})();
