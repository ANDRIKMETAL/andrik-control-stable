/* ANDRIK Control R272 — one-time runtime cache migration. */
(() => {
  'use strict';
  const VERSION = '55.00-r272';
  const KEY = 'andrik-control-runtime-version';
  const ONCE = 'andrik-control-runtime-reload-r272';
  if (location.hostname.toLowerCase() !== 'control.andrikmetal.com') return;

  let stored = '';
  try { stored = localStorage.getItem(KEY) || ''; } catch (_) {}
  if (stored === VERSION) {
    try { sessionStorage.removeItem(ONCE); } catch (_) {}
    return;
  }

  try {
    if (sessionStorage.getItem(ONCE) === '1') {
      localStorage.setItem(KEY, VERSION);
      return;
    }
    sessionStorage.setItem(ONCE, '1');
  } catch (_) {}

  const clearAllCaches = async () => {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name).catch(() => false)));
  };

  const removeOldWorkers = async () => {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    for (const registration of registrations) {
      const script = String(
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL || ''
      );
      if (/OneSignalSDK|\/push\/onesignal\//i.test(script)) continue;
      try {
        registration.active?.postMessage?.({ type: 'CLEAR_ALL_CACHES' });
        registration.waiting?.postMessage?.({ type: 'CLEAR_ALL_CACHES' });
      } catch (_) {}
      await registration.unregister().catch(() => false);
    }
  };

  (async () => {
    try {
      await clearAllCaches();
      await removeOldWorkers();
      try { localStorage.setItem(KEY, VERSION); } catch (_) {}
      const url = new URL(location.href);
      url.searchParams.set('v', VERSION);
      url.searchParams.set('fresh', String(Date.now()));
      location.replace(url.toString());
    } catch (error) {
      console.warn('Control runtime cache migration R272:', error);
      try { localStorage.setItem(KEY, VERSION); } catch (_) {}
    }
  })();
})();
