(() => {
  'use strict';

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const TOKEN_KEY = 'andrik-owner-session-token-r198';
  const LEGACY_TOKEN_KEYS = ['andrik-owner-session-token-r197'];
  const RENEWED_AT_KEY = 'andrik-owner-session-renewed-r198';
  const RENEW_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
  const SENTINEL = '__ANDRIK_OWNER_SESSION_R198__';
  const LEGACY_SENTINELS = new Set(['__ANDRIK_OWNER_SESSION_R197__','__ANDRIK_OWNER_SESSION_R195__','__ANDRIK_OWNER_SESSION_EMERGENCY__']);
  const isSentinel = value => String(value || '').trim() === SENTINEL || LEGACY_SENTINELS.has(String(value || '').trim());
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
    if (text && !isSentinel(text)) runtimeRawKey = text;
    return runtimeRawKey;
  };

  const storedToken = () => {
    const current = safeGet(localStorage, TOKEN_KEY) || safeGet(sessionStorage, TOKEN_KEY);
    if (current) return current;
    for (const key of LEGACY_TOKEN_KEYS) {
      const legacy = safeGet(localStorage, key) || safeGet(sessionStorage, key);
      if (legacy) return legacy;
    }
    return '';
  };

  const saveToken = value => {
    const token = String(value || '').trim();
    if (!token) return '';
    try { nativeSetItem.call(localStorage, TOKEN_KEY, token); } catch (_) {}
    try { nativeSetItem.call(sessionStorage, TOKEN_KEY, token); } catch (_) {}
    for (const key of LEGACY_TOKEN_KEYS) {
      try { nativeRemoveItem.call(localStorage, key); } catch (_) {}
      try { nativeRemoveItem.call(sessionStorage, key); } catch (_) {}
    }
    return token;
  };

  const clearToken = () => {
    try { nativeRemoveItem.call(localStorage, TOKEN_KEY); } catch (_) {}
    try { nativeRemoveItem.call(sessionStorage, TOKEN_KEY); } catch (_) {}
    for (const key of LEGACY_TOKEN_KEYS) {
      try { nativeRemoveItem.call(localStorage, key); } catch (_) {}
      try { nativeRemoveItem.call(sessionStorage, key); } catch (_) {}
    }
    try { nativeRemoveItem.call(localStorage, RENEWED_AT_KEY); } catch (_) {}
  };

  const legacyStoredRaw = () => {
    const values = [safeGet(localStorage, KEY_LOCAL), safeGet(sessionStorage, KEY_SESSION)];
    return values.find(value => value && !isSentinel(value)) || '';
  };

  const hasStoredMarker = () => (
    isSentinel(safeGet(localStorage, KEY_LOCAL)) ||
    isSentinel(safeGet(sessionStorage, KEY_SESSION))
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
      if (isSentinel(text)) return nativeSetItem.call(this, key, SENTINEL);
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

  const lastRenewedAt = () => Number(safeGet(localStorage, RENEWED_AT_KEY) || 0);

  const markRenewed = () => {
    try { nativeSetItem.call(localStorage, RENEWED_AT_KEY, String(Date.now())); } catch (_) {}
  };

  async function renewSignedSession(force = false) {
    const token = storedToken();
    if (!token) return { ok:false, owner:false, skipped:true };
    if (!force && Date.now() - lastRenewedAt() < RENEW_EVERY_MS) {
      return { ok:true, owner:true, skipped:true };
    }
    const response = await nativeFetch('/api/control/owner-session', {
      method:'POST',
      credentials:'include',
      cache:'no-store',
      headers:tokenHeaders({
        accept:'application/json',
        'content-type':'application/json',
        'cache-control':'no-cache'
      }),
      body:'{}'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.owner || !data.compatToken) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    saveToken(data.compatToken);
    markRenewed();
    setSentinel();
    return { ...data, renewed:true };
  }

  async function status() {
    try {
      const response = await nativeFetch(`/api/control/owner-status?fresh=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: tokenHeaders({ accept:'application/json', 'cache-control':'no-cache' })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.owner) {
        const token = storedToken();
        if (token) saveToken(token);
        setSentinel();
        if (token && Date.now() - lastRenewedAt() >= RENEW_EVERY_MS) {
          renewSignedSession().catch(() => null);
        }
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
    if (!raw || isSentinel(raw)) return status();
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
      if (data.compatToken) { saveToken(data.compatToken); markRenewed(); }

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
    if (raw && !isSentinel(raw)) return establish(raw);
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
    const raw = supplied && !isSentinel(supplied) ? captureRaw(supplied) : '';
    const token = storedToken();

    if (sameOriginApi) next.credentials = 'include';
    if (isSentinel(supplied)) headers.delete('authorization');
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
    renew:renewSignedSession,
    storedValue:() => active || hasStoredMarker() || storedToken() ? SENTINEL : runtimeRawKey
  };

  // Normalize old non-secret marker values synchronously so legacy page scripts
  // never mistake them for a real ADMIN_KEY during this upgrade.
  try {
    if (isSentinel(safeGet(localStorage, KEY_LOCAL))) nativeSetItem.call(localStorage, KEY_LOCAL, SENTINEL);
    if (isSentinel(safeGet(sessionStorage, KEY_SESSION))) nativeSetItem.call(sessionStorage, KEY_SESSION, SENTINEL);
  } catch (_) {}

  // Emergency/older builds may leave a raw key in legacy slots. Migrate it
  // once to the signed R198 session and remove the raw value immediately.
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
