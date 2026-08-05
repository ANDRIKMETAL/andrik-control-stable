(() => {
  'use strict';
  if (window.__ANDRIK_CONTROL_RELEASE_R272__) return;
  window.__ANDRIK_CONTROL_RELEASE_R272__ = true;

  const release = Object.freeze({
    short: 'R272',
    number: 272,
    version: '55.00',
    runtime: '55.00-r272',
    full: 'v55.00 LIVE WEB AI FINAL R272',
    build: 'STABLE VERSION SOURCE',
    date: '05.08.2026'
  });

  window.ANDRIK_CONTROL_RELEASE = release;
  window.ANDRIK_CONTROL_VERSION = '55.00 LIVE WEB AI FINAL R272';
  window.ANDRIK_CONTROL_BUILD = release.build;

  const replaceRelease = value => {
    const text = String(value || '');
    return /\bR\d{1,6}\b/i.test(text)
      ? text.replace(/\bR\d{1,6}\b/ig, release.short)
      : text;
  };

  const apply = () => {
    document.documentElement.dataset.andrikCurrentRelease = release.short;
    document.documentElement.dataset.andrikRelease = release.short;
    if (document.body) {
      document.body.dataset.andrikCurrentRelease = release.short;
      document.body.dataset.andrikRelease = release.short;
    }

    let meta = document.querySelector('meta[name="andrik-control-release"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'andrik-control-release';
      document.head.appendChild(meta);
    }
    meta.content = release.short;

    document.querySelectorAll('.control-version-footer').forEach(footer => {
      footer.dataset.release = release.short;
      const strong = footer.querySelector('strong');
      const span = footer.querySelector('span');
      if (document.body?.classList.contains('control-home-page')) {
        if (strong) strong.textContent = 'Live Web AI';
        if (span && /^R\d+$/i.test(span.textContent.trim())) span.textContent = release.short;
      } else if (strong) {
        strong.textContent = replaceRelease(strong.textContent);
        if (!/\bR\d+\b/i.test(strong.textContent)) {
          strong.textContent = `${strong.textContent.trim()} · ${release.full}`;
        }
      }
    });

    document.querySelectorAll('.control-split-number-r181').forEach(node => {
      node.textContent = release.short;
    });
    document.querySelectorAll('.control-split-version-r181').forEach(node => {
      node.setAttribute('aria-label', `Live Web AI, версия ${release.short}`);
    });
    document.querySelectorAll('[data-andrik-release]').forEach(node => {
      node.textContent = release.short;
    });
    document.querySelectorAll('[data-andrik-version]').forEach(node => {
      node.textContent = release.full;
    });

    const releaseInput = document.getElementById('siteUpdateRelease');
    if (releaseInput && document.activeElement !== releaseInput) releaseInput.value = release.short;
    const messageInput = document.getElementById('siteUpdateMessage');
    if (messageInput && document.activeElement !== messageInput) {
      messageInput.value = replaceRelease(messageInput.value || `ANDRIK Control — update website ${release.short}`);
    }

    window.dispatchEvent(new CustomEvent('andrik-control-version-ready', { detail: release }));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
  window.addEventListener('pageshow', apply, { passive: true });
})();
