(() => {
  'use strict';
  if (window.__ANDRIK_UNIFIED_GLOW_R139__) return;
  window.__ANDRIK_UNIFIED_GLOW_R139__ = true;

  const RELEASE = 'R139';
  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const OWNER_SYNC_STAMP = 'andrik-owner-session-sync-r139';

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

  const loadPlayerBridge = () => {};


  const apply = () => {
    const body = document.body;
    if (!body) return;

    body.classList.add('unified-glow-ready', 'andrik-ui-r139');
    const params = new URLSearchParams(location.search);
    // R139: embed-класс нужен только настоящему вложенному iframe.
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
      url.searchParams.set('v', '55.00-r139');
      image.src = `${url.pathname}${url.search}`;
    });

    // R389: visual glow must never own or downgrade the displayed Control build version.
    // Version display is handled only by the current control-version-sync script.

    syncOwnerSession();
    loadPlayerBridge();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once:true });
  } else {
    apply();
  }
})();