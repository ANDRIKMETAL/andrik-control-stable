/* Control ANDRIK R307 — safe display-version synchronization.
   Never writes text into <html> or <body>. */
(() => {
  'use strict';
  if (window.__ANDRIK_VERSION_SYNC_R307__) return;
  window.__ANDRIK_VERSION_SYNC_R307__ = true;

  const RELEASE = 'R307';
  const RUNTIME = '55.00-r307';
  const FULL = 'Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R307';
  let applying = false;

  const isRoot = node => node === document.documentElement || node === document.body;
  const setText = (node, value) => {
    if (!node || isRoot(node)) return;
    if (node.textContent !== value) node.textContent = value;
  };

  const apply = () => {
    if (applying) return;
    applying = true;
    try {
      document.documentElement.dataset.andrikRelease = RELEASE;
      if (document.body) document.body.dataset.andrikRelease = RELEASE;

      let meta = document.querySelector('meta[name="andrik-control-release"]');
      if (!meta && document.head) {
        meta = document.createElement('meta');
        meta.name = 'andrik-control-release';
        document.head.appendChild(meta);
      }
      if (meta) meta.content = RELEASE;

      document.querySelectorAll('[data-andrik-version]').forEach(node => setText(node, RELEASE));

      const isHome = document.body?.classList.contains('control-home-page');
      document.querySelectorAll('.control-version-footer').forEach(footer => {
        if (isRoot(footer)) return;
        const strong = footer.querySelector('strong');
        const span = footer.querySelector('span');
        if (isHome || footer.closest('.control-menu-page')) {
          setText(strong, 'Live Web AI');
          setText(span, RELEASE);
        } else if (strong) {
          const current = String(strong.textContent || '');
          const profile = /профиль\s+ANDRIK/i.test(current);
          setText(strong, profile
            ? `Live Web AI · профиль ANDRIK · v55.00 LIVE WEB AI FINAL ${RELEASE}`
            : FULL);
        }
        footer.dataset.release = RELEASE;
      });

      document.querySelectorAll('.control-split-number-r181').forEach(node => setText(node, RELEASE));
      document.querySelectorAll('.control-split-version-r181').forEach(node => {
        if (!isRoot(node)) node.setAttribute('aria-label', `Live Web AI, версия ${RELEASE}`);
      });

      const releaseInput = document.getElementById('siteUpdateRelease');
      if (releaseInput && document.activeElement !== releaseInput) releaseInput.value = RELEASE;
      const messageInput = document.getElementById('siteUpdateMessage');
      if (messageInput && document.activeElement !== messageInput) {
        const value = String(messageInput.value || 'ANDRIK Control — update website');
        messageInput.value = /R\d+/i.test(value)
          ? value.replace(/R\d+/ig, RELEASE)
          : `${value.trim()} ${RELEASE}`.trim();
      }

      window.ANDRIK_CONTROL_RELEASE = Object.freeze({
        short: RELEASE, number: 307, version: '55.00',
        full: 'v55.00 LIVE WEB AI FINAL R307',
        build: 'R307 NO-SITE ONE-TAP EXIT',
        date: '07.08.2026'
      });
      window.ANDRIK_CONTROL_VERSION = '55.00 LIVE WEB AI FINAL R307';
      window.ANDRIK_CONTROL_BUILD = 'R307 NO-SITE ONE-TAP EXIT';
      try { localStorage.setItem('andrik-control-display-version', RUNTIME); } catch (_) {}
      window.dispatchEvent(new CustomEvent('andrik-control-version-ready', {detail: window.ANDRIK_CONTROL_RELEASE}));
    } finally {
      applying = false;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, {once:true});
  } else {
    apply();
  }
  window.addEventListener('pageshow', apply, {passive:true});
  window.addEventListener('load', apply, {once:true});
  [60, 250, 800, 1600].forEach(ms => setTimeout(apply, ms));

  if (document.body) {
    const observer = new MutationObserver(() => {
      if (!applying) requestAnimationFrame(apply);
    });
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});
  }
})();
