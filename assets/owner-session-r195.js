(() => {
  'use strict';

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const SENTINEL = '__ANDRIK_OWNER_SESSION_R195__';
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
    try { return nativeGetItem.call(storage, key) || ''; } catch (_) { return ''; }
  };

  const captureRaw = value => {
    const text = String(value || '').trim();
    if (text && text !== SENTINEL) runtimeRawKey = text;
    return runtimeRawKey;
  };

  const legacyStoredRaw = () => {
    const values = [safeGet(localStorage, KEY_LOCAL), safeGet(sessionStorage, KEY_SESSION)];
    return values.find(value => value && value !== SENTINEL) || '';
  };

  const hasStoredMarker = () => (
    safeGet(localStorage, KEY_LOCAL) === SENTINEL ||
    safeGet(sessionStorage, KEY_SESSION) === SENTINEL
  );

  const dispatch = value => {
    active = Boolean(value);
    document.documentElement.dataset.ownerSession = active ? 'active' : 'inactive';
    window.dispatchEvent(new CustomEvent('andrik-owner-session', {
      detail:{ active, runtimeKey:Boolean(runtimeRawKey) }
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

  // Raw ADMIN_KEY is never written to browser storage. Keep it only in RAM
  // until the Worker exchanges it for a signed HttpOnly owner session.
  Storage.prototype.setItem = function(key, value) {
    if (KEY_NAMES.has(String(key))) {
      const text = String(value || '').trim();
      if (!text) return nativeRemoveItem.call(this, key);
      if (text === SENTINEL) return nativeSetItem.call(this, key, SENTINEL);
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

  async function establish(rawKey = '') {
    const raw = String(rawKey || runtimeRawKey || '').trim();
    if (!raw || raw === SENTINEL) return status();
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
      // Do not hide/forget the raw key until the browser proves that the
      // HttpOnly cookie was actually stored. This prevents the old Android PWA
      // race where status was green once, but the next ZIP/rollback request was
      // unauthorized.
      const verifyResponse = await nativeFetch(`/api/control/owner-status?verify=${Date.now()}`, {
        credentials:'include',
        cache:'no-store',
        headers:{accept:'application/json','cache-control':'no-cache'}
      });
      const verifyData = await verifyResponse.json().catch(() => ({}));
      if (verifyResponse.ok && verifyData.owner) {
        setSentinel();
        replaceVisibleRawKeys(raw);
        return { ...data, verified:true };
      }
      // Cookie fallback: keep the ADMIN_KEY only in RAM and continue securely
      // with the Authorization header for this open page. Never write it to
      // localStorage/sessionStorage.
      dispatch(false);
      return { ...data, owner:false, verified:false, rawFallback:true };
    })().finally(() => { establishing = null; });

    return establishing;
  }

  async function status() {
    try {
      const response = await nativeFetch(`/api/control/owner-status?fresh=${Date.now()}`, {
        credentials:'include',
        cache:'no-store',
        headers:{accept:'application/json','cache-control':'no-cache'}
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.owner) {
        setSentinel();
        return data;
      }
      if (hasStoredMarker()) clearStoredMarkers();
      else dispatch(false);
      return data;
    } catch (_) {
      return { ok:false, owner:false };
    }
  }

  async function ensure(rawKey = '') {
    const raw = String(rawKey || '').trim();
    if (raw && raw !== SENTINEL) return establish(raw);
    if (active) return { ok:true, owner:true, cached:true };

    const current = await status();
    if (current?.owner) return current;
    if (runtimeRawKey) return establish(runtimeRawKey);

    const error = new Error('owner-session-required-enter-admin-key');
    error.status = 401;
    throw error;
  }

  async function clear() {
    try {
      await nativeFetch('/api/control/owner-session', {
        method:'DELETE', credentials:'include', cache:'no-store', headers:{accept:'application/json'}
      });
    } catch (_) {}
    runtimeRawKey = '';
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
    const raw = supplied && supplied !== SENTINEL ? captureRaw(supplied) : '';

    if (sameOriginApi) next.credentials = 'include';
    if (supplied === SENTINEL) headers.delete('authorization');
    next.headers = headers;

    let response = await nativeFetch(input, next);

    // A successful raw-key request must not turn the UI green until the
    // persistent HttpOnly session has actually been created.
    if (isProtectedApi(requestUrl) && response.ok && raw) {
      await establish(raw).catch(() => null);
    }

    // Android PWA/WebView fallback: if a cookie was not attached yet, retry the
    // protected request once with the RAM-only key. This fixes rollback/update
    // races without saving the secret in localStorage.
    if (isProtectedApi(requestUrl) && response.status === 401 && runtimeRawKey && !raw) {
      const retryHeaders = normalizedHeaders(input, next.headers);
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
    storedValue:() => active || hasStoredMarker() ? SENTINEL : runtimeRawKey
  };

  // Migrate an old key once, then keep only the signed HttpOnly session.
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
