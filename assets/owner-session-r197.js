(() => {
  'use strict';

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const TOKEN_KEY = 'andrik-owner-session-token-r197';
  const SENTINEL = '__ANDRIK_OWNER_SESSION_R197__';
  const LEGACY_SENTINELS = new Set([SENTINEL, '__ANDRIK_OWNER_SESSION__']);
  const TOKEN_HEADER = 'x-andrik-owner-token';
  const KEY_NAMES = new Set([KEY_SESSION, KEY_LOCAL]);
  const nativeFetch = window.fetch.bind(window);
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeGetItem = Storage.prototype.getItem;

  let establishing = null;
  let active = false;
  let runtimeRawKey = '';
  let readyPromise = null;

  const safeGet = (storage, key) => {
    try { return String(nativeGetItem.call(storage, key) || '').trim(); }
    catch (_) { return ''; }
  };

  const captureRaw = value => {
    const text = String(value || '').trim();
    if (text && !LEGACY_SENTINELS.has(text)) runtimeRawKey = text;
    return runtimeRawKey;
  };

  const storedToken = () => safeGet(localStorage, TOKEN_KEY) || safeGet(sessionStorage, TOKEN_KEY);

  const saveToken = value => {
    const token = String(value || '').trim();
    if (!token) return '';
    try { nativeSetItem.call(localStorage, TOKEN_KEY, token); } catch (_) {}
    try { nativeSetItem.call(sessionStorage, TOKEN_KEY, token); } catch (_) {}
    return token;
  };

  const clearToken = () => {
    try { nativeRemoveItem.call(localStorage, TOKEN_KEY); } catch (_) {}
    try { nativeRemoveItem.call(sessionStorage, TOKEN_KEY); } catch (_) {}
  };

  const legacyStoredRaw = () => {
    const values = [safeGet(localStorage, KEY_LOCAL), safeGet(sessionStorage, KEY_SESSION)];
    return values.find(value => value && !LEGACY_SENTINELS.has(value)) || '';
  };

  const hasStoredMarker = () => (
    LEGACY_SENTINELS.has(safeGet(localStorage, KEY_LOCAL)) ||
    LEGACY_SENTINELS.has(safeGet(sessionStorage, KEY_SESSION))
  );

  const dispatch = value => {
    active = Boolean(value);
    document.documentElement.dataset.ownerSession = active ? 'active' : 'inactive';
    window.dispatchEvent(new CustomEvent('andrik-owner-session', {
      detail: {
        active,
        runtimeKey: Boolean(runtimeRawKey),
        signedFallback: Boolean(storedToken())
      }
    }));
  };

  const setSentinel = () => {
    try { nativeSetItem.call(sessionStorage, KEY_SESSION, SENTINEL); } catch (_) {}
    try { nativeSetItem.call(localStorage, KEY_LOCAL, SENTINEL); } catch (_) {}
    dispatch(true);
  };

  const clearStoredMarkers = () => {
    try { nativeRemoveItem.call(sessionStorage, KEY_SESSION); } catch (_) {}
    try { nativeRemoveItem.call(localStorage, KEY_LOCAL); } catch (_) {}
    dispatch(false);
  };

  // Never store the raw ADMIN_KEY. Legacy pages may still call setItem(), so
  // capture the key only in RAM and replace persisted values with a marker.
  Storage.prototype.setItem = function(key, value) {
    if (KEY_NAMES.has(String(key))) {
      const text = String(value || '').trim();
      if (!text) return nativeRemoveItem.call(this, key);
      if (LEGACY_SENTINELS.has(text)) return nativeSetItem.call(this, key, SENTINEL);
      captureRaw(text);
      return undefined;
    }
    return nativeSetItem.call(this, key, value);
  };

  const replaceVisibleRawKeys = raw => {
    if (!raw) return;
    document.querySelectorAll('input[type="password"],input[autocomplete="current-password"]').forEach(input => {
      if (String(input.value || '') === raw) input.value = SENTINEL;
    });
  };

  const tokenHeaders = (base = {}) => {
    const headers = new Headers(base || {});
    const token = storedToken();
    if (token) headers.set(TOKEN_HEADER, token);
    return headers;
  };

  async function status() {
    try {
      const response = await nativeFetch(`/api/control/owner-status?fresh=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: tokenHeaders({ accept:'application/json', 'cache-control':'no-cache' })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.owner) {
        setSentinel();
        return data;
      }
      if (storedToken()) clearToken();
      if (hasStoredMarker()) clearStoredMarkers();
      else dispatch(false);
      return data;
    } catch (_) {
      return { ok:false, owner:false };
    }
  }

  async function establish(rawKey = '') {
    const raw = String(rawKey || runtimeRawKey || '').trim();
    if (!raw || LEGACY_SENTINELS.has(raw)) return status();
    captureRaw(raw);
    if (establishing) return establishing;

    establishing = (async () => {
      const response = await nativeFetch('/api/control/owner-session', {
        method:'POST',
        credentials:'include',
        cache:'no-store',
        headers:{
          accept:'application/json',
          'content-type':'application/json',
          authorization:`Bearer ${raw}`,
          'cache-control':'no-cache'
        },
        body:'{}'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      // The HttpOnly cookie remains the primary transport. Android PWA/WebView
      // receives the same signed, expiring session as a compatibility token so
      // page navigation never falls back to storing the raw ADMIN_KEY.
      if (data.compatToken) saveToken(data.compatToken);

      const verified = await status();
      if (verified?.owner) {
        runtimeRawKey = '';
        setSentinel();
        replaceVisibleRawKeys(raw);
        return { ...data, verified:true, owner:true };
      }

      const error = new Error('owner-session-not-persisted');
      error.status = 401;
      throw error;
    })().finally(() => { establishing = null; });

    return establishing;
  }

  async function ensure(rawKey = '') {
    const raw = String(rawKey || '').trim();
    if (raw && !LEGACY_SENTINELS.has(raw)) return establish(raw);
    if (active) return { ok:true, owner:true, cached:true };

    const current = await status();
    if (current?.owner) return current;
    if (runtimeRawKey) return establish(runtimeRawKey);

    const error = new Error('owner-session-required-enter-admin-key');
    error.status = 401;
    throw error;
  }

  async function clear() {
    const headers = tokenHeaders({ accept:'application/json' });
    try {
      await nativeFetch('/api/control/owner-session', {
        method:'DELETE', credentials:'include', cache:'no-store', headers
      });
    } catch (_) {}
    runtimeRawKey = '';
    clearToken();
    clearStoredMarkers();
  }

  function readAuthorization(headersLike) {
    try {
      const headers = new Headers(headersLike || {});
      const auth = String(headers.get('authorization') || '');
      return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    } catch (_) {
      return '';
    }
  }

  function normalizedHeaders(input, initHeaders) {
    try {
      return new Headers(initHeaders || (input instanceof Request ? input.headers : undefined));
    } catch (_) {
      return new Headers();
    }
  }

  function isProtectedApi(url) {
    return url && url.origin === location.origin &&
      url.pathname.startsWith('/api/') &&
      !['/api/control/owner-session','/api/control/owner-status','/api/health'].includes(url.pathname);
  }

  window.fetch = async function(input, init = {}) {
    const requestUrl = (() => {
      try { return new URL(typeof input === 'string' ? input : input.url, location.href); }
      catch (_) { return null; }
    })();

    const sameOriginApi = requestUrl && requestUrl.origin === location.origin && requestUrl.pathname.startsWith('/api/');
    const next = { ...init };
    const headers = normalizedHeaders(input, next.headers);
    const supplied = readAuthorization(headers);
    const raw = supplied && !LEGACY_SENTINELS.has(supplied) ? captureRaw(supplied) : '';
    const token = storedToken();

    if (sameOriginApi) next.credentials = 'include';
    if (LEGACY_SENTINELS.has(supplied)) headers.delete('authorization');
    if (isProtectedApi(requestUrl) && token && !headers.has(TOKEN_HEADER)) {
      headers.set(TOKEN_HEADER, token);
    }
    next.headers = headers;

    let response = await nativeFetch(input, next);

    // A successful request made with the raw key is immediately exchanged for
    // a signed owner session. The raw value then disappears from RAM and inputs.
    if (isProtectedApi(requestUrl) && response.ok && raw) {
      await establish(raw).catch(() => null);
    }

    // If a stale signed token was rejected while the page still has a freshly
    // entered ADMIN_KEY in RAM, retry once before asking the owner to log in.
    if (isProtectedApi(requestUrl) && response.status === 401 && runtimeRawKey && !raw) {
      clearToken();
      const retryHeaders = normalizedHeaders(input, next.headers);
      retryHeaders.delete(TOKEN_HEADER);
      retryHeaders.set('authorization', `Bearer ${runtimeRawKey}`);
      response = await nativeFetch(input, { ...next, headers:retryHeaders, credentials:'include' });
      if (response.ok) await establish(runtimeRawKey).catch(() => null);
    }

    return response;
  };

  window.AndrikOwnerSession = {
    sentinel:SENTINEL,
    establish,
    ensure,
    status,
    clear,
    capture:captureRaw,
    isActive:() => active,
    hasMarker:hasStoredMarker,
    runtimeKey:() => runtimeRawKey,
    signedToken:storedToken,
    storedValue:() => active || hasStoredMarker() || storedToken() ? SENTINEL : runtimeRawKey
  };

  // R196 emergency mode stored the raw key in these legacy slots. Migrate it
  // once to the signed R197 session and remove the raw value immediately.
  const legacyRaw = legacyStoredRaw();
  if (legacyRaw) {
    captureRaw(legacyRaw);
    try { nativeRemoveItem.call(localStorage, KEY_LOCAL); } catch (_) {}
    try { nativeRemoveItem.call(sessionStorage, KEY_SESSION); } catch (_) {}
    readyPromise = establish(legacyRaw).catch(() => status());
  } else {
    readyPromise = status();
  }
  window.AndrikOwnerSession.ready = () => readyPromise;

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#serviceForget,#commentsAdminForget,#attackForget,#protectionForget,[data-owner-session-forget]');
    if (button) clear().catch(() => {});
  }, true);
})();
