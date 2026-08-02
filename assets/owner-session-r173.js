(() => {
  'use strict';

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const SENTINEL = '__ANDRIK_OWNER_SESSION__';
  const KEY_NAMES = new Set([KEY_SESSION, KEY_LOCAL]);
  const nativeFetch = window.fetch.bind(window);
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  let establishing = null;
  let active = false;

  const safeGet = (storage, key) => {
    try { return storage.getItem(key) || ''; } catch (_) { return ''; }
  };

  const rawStoredKey = () => {
    const values = [safeGet(localStorage, KEY_LOCAL), safeGet(sessionStorage, KEY_SESSION)];
    return values.find(value => value && value !== SENTINEL) || '';
  };

  const setSentinel = () => {
    try { nativeSetItem.call(sessionStorage, KEY_SESSION, SENTINEL); } catch (_) {}
    try { nativeSetItem.call(localStorage, KEY_LOCAL, SENTINEL); } catch (_) {}
    active = true;
    document.documentElement.dataset.ownerSession = 'active';
    window.dispatchEvent(new CustomEvent('andrik-owner-session', { detail:{ active:true } }));
  };

  const clearStoredMarkers = () => {
    try { nativeRemoveItem.call(sessionStorage, KEY_SESSION); } catch (_) {}
    try { nativeRemoveItem.call(localStorage, KEY_LOCAL); } catch (_) {}
    active = false;
    document.documentElement.dataset.ownerSession = 'inactive';
    window.dispatchEvent(new CustomEvent('andrik-owner-session', { detail:{ active:false } }));
  };

  // Never allow the raw ADMIN_KEY to be persisted again. Existing scripts may
  // still call setItem; they receive a harmless non-secret session marker.
  Storage.prototype.setItem = function(key, value) {
    if (KEY_NAMES.has(String(key))) {
      const text = String(value || '');
      return nativeSetItem.call(this, key, text ? SENTINEL : '');
    }
    return nativeSetItem.call(this, key, value);
  };

  const replaceVisibleRawKeys = raw => {
    if (!raw) return;
    document.querySelectorAll('input[type="password"],input[autocomplete="current-password"]').forEach(input => {
      if (String(input.value || '') === raw) input.value = SENTINEL;
    });
  };

  async function establish(rawKey) {
    const raw = String(rawKey || '').trim();
    if (!raw || raw === SENTINEL) return status();
    if (establishing) return establishing;
    establishing = (async () => {
      const response = await nativeFetch('/api/control/owner-session', {
        method:'POST',
        credentials:'include',
        cache:'no-store',
        headers:{
          accept:'application/json',
          'content-type':'application/json',
          authorization:`Bearer ${raw}`
        },
        body:'{}'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      setSentinel();
      replaceVisibleRawKeys(raw);
      return data;
    })().finally(() => { establishing = null; });
    return establishing;
  }

  async function status() {
    try {
      const response = await nativeFetch('/api/control/owner-status', {
        credentials:'include', cache:'no-store', headers:{accept:'application/json'}
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.owner) {
        setSentinel();
        return data;
      }
      if (safeGet(localStorage, KEY_LOCAL) === SENTINEL || safeGet(sessionStorage, KEY_SESSION) === SENTINEL) {
        clearStoredMarkers();
      }
      return data;
    } catch (_) {
      return { ok:false, owner:false };
    }
  }

  async function clear() {
    try {
      await nativeFetch('/api/control/owner-session', {
        method:'DELETE', credentials:'include', cache:'no-store', headers:{accept:'application/json'}
      });
    } catch (_) {}
    clearStoredMarkers();
  }

  // Same-origin API calls always carry the HttpOnly cookie. If an old page sends
  // the raw key once and succeeds, immediately convert it into the cookie session.
  window.fetch = async function(input, init = {}) {
    const requestUrl = (() => {
      try { return new URL(typeof input === 'string' ? input : input.url, location.href); }
      catch (_) { return null; }
    })();
    const next = { ...init };
    if (requestUrl && requestUrl.origin === location.origin && requestUrl.pathname.startsWith('/api/')) {
      next.credentials = 'include';
    }
    const response = await nativeFetch(input, next);
    if (requestUrl && requestUrl.origin === location.origin && requestUrl.pathname.startsWith('/api/') && requestUrl.pathname !== '/api/control/owner-session') {
      try {
        const headers = new Headers(next.headers || (input instanceof Request ? input.headers : undefined));
        const auth = String(headers.get('authorization') || '');
        const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
        if (response.ok && raw && raw !== SENTINEL) establish(raw).catch(() => {});
      } catch (_) {}
    }
    return response;
  };

  window.AndrikOwnerSession = {
    sentinel:SENTINEL,
    establish,
    status,
    clear,
    isActive:() => active,
    storedValue:() => active ? SENTINEL : rawStoredKey()
  };

  // Seamless migration of an existing device: exchange the old localStorage key
  // for a signed HttpOnly cookie, then erase the raw value.
  const legacyRaw = rawStoredKey();
  if (legacyRaw) establish(legacyRaw).catch(() => {});
  else status().catch(() => {});

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#serviceForget,#commentsAdminForget,#attackForget,#protectionForget,[data-owner-session-forget]');
    if (button) clear().catch(() => {});
  }, true);
})();
