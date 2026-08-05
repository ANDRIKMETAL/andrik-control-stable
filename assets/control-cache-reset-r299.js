/* Control ANDRIK R299 — one-time cache generation switch.
   Uses a dedicated cache key and never fights the visible release number. */
(() => {
  'use strict';
  const VERSION = '55.00-r299';
  const KEY = 'andrik-control-cache-generation';
  const ONCE = 'andrik-control-cache-reload-r299';
  if (location.hostname.toLowerCase() !== 'control.andrikmetal.com') return;

  async function clearControlCaches() {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name).catch(() => false)));
  }

  async function removeOldControlWorkers() {
    if (!('serviceWorker' in navigator)) return;
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    for (const registration of registrations) {
      const script = String(registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || '');
      if (/OneSignalSDK|\/push\/onesignal\//i.test(script)) continue;
      try {
        registration.active?.postMessage?.({type:'CLEAR_ALL_CACHES'});
        registration.waiting?.postMessage?.({type:'CLEAR_ALL_CACHES'});
      } catch (_) {}
      await registration.unregister().catch(() => false);
    }
  }

  (async () => {
    try {
      if (localStorage.getItem(KEY) === VERSION) return;
      await clearControlCaches();
      await removeOldControlWorkers();
      localStorage.removeItem('andrik-control-runtime-version');
      localStorage.setItem(KEY, VERSION);
      if (sessionStorage.getItem(ONCE) === '1') return;
      sessionStorage.setItem(ONCE, '1');
      const url = new URL(location.href);
      url.searchParams.set('v', VERSION);
      url.searchParams.set('fresh', String(Date.now()));
      location.replace(url.toString());
    } catch (error) {
      console.warn('Control cache generation R299:', error);
    }
  })();
})();
