(() => {
  'use strict';

  const release = Object.freeze({
    short: 'R110',
    number: 110,
    version: '55.00',
    full: 'v55.00 LIVE WEB AI FINAL R110',
    build: 'EMERGENCY VERSION SCRIPT FIX + R109 FEATURES',
    date: '01.08.2026'
  });

  window.ANDRIK_CONTROL_RELEASE = release;
  window.ANDRIK_CONTROL_VERSION = '55.00 LIVE WEB AI FINAL R110';
  window.ANDRIK_CONTROL_BUILD = release.build;

  const apply = () => {
    /*
     * ВАЖНО:
     * data-andrik-release используется только как слот для текста.
     * На html/body ставятся ДРУГИЕ атрибуты, поэтому документ не может
     * выбрать сам себя и заменить всю страницу строкой версии.
     */
    document.documentElement.dataset.andrikCurrentRelease = release.short;
    if (document.body) {
      document.body.dataset.andrikCurrentRelease = release.short;
    }

    document.querySelectorAll('.control-version-footer strong').forEach((element) => {
      const profile = /профиль\s+ANDRIK/i.test(element.textContent || '');
      element.textContent = profile
        ? `Live Web AI · профиль ANDRIK · ${release.full}`
        : `Live Web AI · ANDRIK · ${release.full}`;
    });

    document.querySelectorAll('[data-andrik-version]').forEach((element) => {
      if (element === document.documentElement || element === document.body) return;
      element.textContent = release.full;
    });

    document.querySelectorAll('[data-andrik-release]').forEach((element) => {
      if (element === document.documentElement || element === document.body) return;
      element.textContent = release.short;
    });

    window.dispatchEvent(new CustomEvent('andrik-control-version-ready', {
      detail: release
    }));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
})();
