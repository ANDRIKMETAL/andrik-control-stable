(() => {
  'use strict';
  if (window.__ANDRIK_UNIFIED_GLOW_R133__) return;
  window.__ANDRIK_UNIFIED_GLOW_R133__ = true;

  const RELEASE = 'R133';
  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const OWNER_SYNC_STAMP = 'andrik-owner-session-sync-r133';

  const storedAdminKey = () => {
    try {
      return localStorage.getItem(KEY_LOCAL) || sessionStorage.getItem(KEY_SESSION) || '';
    } catch (_) {
      return '';
    }
  };

  const syncOwnerSession = async () => {
    const key = storedAdminKey();
    if (!key) return;
    try {
      const last = Number(localStorage.getItem(OWNER_SYNC_STAMP) || 0);
      if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    } catch (_) {}
    try {
      const response = await fetch('/api/control/owner-session', {
        method:'POST',
        credentials:'include',
        cache:'no-store',
        headers:{
          authorization:`Bearer ${key}`,
          accept:'application/json',
          'content-type':'application/json'
        },
        body:'{}'
      });
      if (response.ok) {
        try { localStorage.setItem(OWNER_SYNC_STAMP, String(Date.now())); } catch (_) {}
      }
    } catch (_) {}
  };

  const loadPlayerBridge = () => {
    const params = new URLSearchParams(location.search);
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const isUpdater = path === '/site-update-admin.html' || path === '/site-update-admin';
    const isReset = path.startsWith('/cache-reset');
    const isEmbeddedControlSection = params.get('embed') === '1';
    // R133: плеер работает и на странице обновления сайта.
    // Исключаются только технические cache-reset страницы.
    if (isReset) return;

    if (!document.querySelector('link[data-andrik-player-r133]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/control-player-bridge-r133.css?v=55.00-r133';
      link.dataset.andrikPlayerR133 = 'css';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-andrik-player-r133]')) {
      const script = document.createElement('script');
      script.src = '/assets/control-player-bridge-r133.js?v=55.00-r133';
      script.defer = true;
      script.dataset.andrikPlayerR133 = 'js';
      document.head.appendChild(script);
    }
  };

  const apply = () => {
    const body = document.body;
    if (!body) return;

    body.classList.add('unified-glow-ready', 'andrik-ui-r133');
    const params = new URLSearchParams(location.search);
    // R133: embed-класс нужен только настоящему вложенному iframe.
    const trulyEmbedded = window.self !== window.top;
    if (params.get('embed') === '1' && trulyEmbedded) {
      body.classList.add('unified-glow-embed');
    } else {
      body.classList.remove('unified-glow-embed');
    }

    const page = (params.get('page') || '').toLowerCase();
    const path = location.pathname.replace(/\/+$/, '/');
    const isMap = body.classList.contains('analytics-admin-page') &&
      (page === '' || page === 'map' || path.endsWith('/admin/'));
    if (isMap) body.classList.add('unified-glow-map-view');

    document.querySelectorAll('.control-center-logo .logo-ok').forEach(image => {
      const url = new URL(image.getAttribute('src') || '/assets/control-topbar-eye-triangle.jpg', location.href);
      url.searchParams.set('v', '55.00-r133');
      image.src = `${url.pathname}${url.search}`;
    });

    document.querySelectorAll('.control-version-footer strong').forEach(node => {
      node.textContent = 'Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R133';
    });

    syncOwnerSession();
    loadPlayerBridge();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once:true });
  } else {
    apply();
  }
})();