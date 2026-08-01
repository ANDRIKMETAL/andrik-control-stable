(() => {
  if (location.hostname.toLowerCase() === 'control.andrikmetal.com') return;
  const KEY = 'andrik-site-visitor-v1';
  const makeId = () => {
    try { return crypto.randomUUID(); }
    catch (_) { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
  };
  let visitorId = '';
  try {
    visitorId = localStorage.getItem(KEY) || '';
    if (!/^[a-z0-9_-]{16,120}$/i.test(visitorId)) {
      visitorId = makeId();
      localStorage.setItem(KEY, visitorId);
    }
  } catch (_) {
    visitorId = makeId();
  }
  const body = JSON.stringify({ visitorId, path: location.pathname });
  const send = () => {
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/site/visit', blob)) return;
      }
    } catch (_) {}
    fetch('/api/site/visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body,
      keepalive: true,
      cache: 'no-store',
      credentials: 'same-origin'
    }).catch(() => {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', send, { once: true });
  else send();
})();
