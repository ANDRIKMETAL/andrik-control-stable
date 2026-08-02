(() => {
  'use strict';

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const SENTINEL = '__ANDRIK_OWNER_SESSION_EMERGENCY__';

  const nativeFetch = window.fetch.bind(window);
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const nativeGetItem = Storage.prototype.getItem;

  let runtimeAdminKey = '';
  let active = false;

  const safeGet = (storage, key) => {
    try {
      return String(nativeGetItem.call(storage, key) || '').trim();
    } catch (_) {
      return '';
    }
  };

  const storedKey = () => {
    const local = safeGet(localStorage, KEY_LOCAL);
    const session = safeGet(sessionStorage, KEY_SESSION);

    for (const value of [local, session, runtimeAdminKey]) {
      if (value && value !== SENTINEL) return value;
    }

    return '';
  };

  const saveRawKey = value => {
    const raw = String(value || '').trim();
    if (!raw || raw === SENTINEL) return storedKey();

    runtimeAdminKey = raw;

    try {
      nativeSetItem.call(sessionStorage, KEY_SESSION, raw);
      nativeSetItem.call(localStorage, KEY_LOCAL, raw);
    } catch (_) {}

    return raw;
  };

  Storage.prototype.setItem = function(key, value) {
    const name = String(key);
    const text = String(value || '').trim();

    if (name === KEY_SESSION || name === KEY_LOCAL) {
      if (!text) {
        return nativeRemoveItem.call(this, name);
      }

      if (text === SENTINEL) {
        const raw = storedKey();
        if (raw) return nativeSetItem.call(this, name, raw);
        return undefined;
      }

      runtimeAdminKey = text;
      return nativeSetItem.call(this, name, text);
    }

    return nativeSetItem.call(this, key, value);
  };

  const dispatch = value => {
    active = Boolean(value);
    document.documentElement.dataset.ownerSession =
      active ? 'active' : 'inactive';

    window.dispatchEvent(new CustomEvent('andrik-owner-session', {
      detail: {
        active,
        emergencyLegacyMode: true,
        runtimeKey: Boolean(storedKey())
      }
    }));
  };

  async function establish(rawKey = '') {
    const raw = saveRawKey(rawKey || storedKey());

    if (!raw) {
      const error = new Error('owner-session-required-enter-admin-key');
      error.status = 401;
      throw error;
    }

    const response = await nativeFetch(
      `/api/control/access?emergency_admin_key=${Date.now()}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${raw}`,
          'cache-control': 'no-cache'
        }
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    saveRawKey(raw);
    dispatch(true);

    return {
      ...data,
      owner: true,
      emergencyLegacyMode: true,
      storage: 'ADMIN_KEY on this device'
    };
  }

  async function status() {
    const raw = storedKey();

    if (!raw) {
      dispatch(false);
      return {
        ok: true,
        owner: false,
        emergencyLegacyMode: true
      };
    }

    try {
      return await establish(raw);
    } catch (_) {
      dispatch(false);
      return {
        ok: false,
        owner: false,
        emergencyLegacyMode: true
      };
    }
  }

  async function ensure(rawKey = '') {
    return establish(rawKey || storedKey());
  }

  async function clear() {
    runtimeAdminKey = '';

    try {
      nativeRemoveItem.call(sessionStorage, KEY_SESSION);
      nativeRemoveItem.call(localStorage, KEY_LOCAL);
    } catch (_) {}

    dispatch(false);
  }

  const normalizedHeaders = (input, suppliedHeaders) => {
    try {
      return new Headers(
        suppliedHeaders ||
        (input instanceof Request ? input.headers : undefined)
      );
    } catch (_) {
      return new Headers();
    }
  };

  const protectedApi = url => (
    url &&
    url.origin === location.origin &&
    url.pathname.startsWith('/api/') &&
    ![
      '/api/health',
      '/api/control/owner-status',
      '/api/control/owner-session'
    ].includes(url.pathname)
  );

  window.fetch = async function(input, init = {}) {
    const requestUrl = (() => {
      try {
        return new URL(
          typeof input === 'string' ? input : input.url,
          location.href
        );
      } catch (_) {
        return null;
      }
    })();

    const next = { ...init };
    const headers = normalizedHeaders(input, next.headers);
    const raw = storedKey();

    if (requestUrl?.origin === location.origin) {
      next.credentials = 'include';
    }

    if (
      raw &&
      protectedApi(requestUrl) &&
      !headers.has('authorization')
    ) {
      headers.set('authorization', `Bearer ${raw}`);
    }

    next.headers = headers;

    return nativeFetch(input, next);
  };

  window.AndrikOwnerSession = {
    sentinel: SENTINEL,
    establish,
    ensure,
    status,
    clear,
    capture: saveRawKey,
    isActive: () => active,
    hasMarker: () => Boolean(storedKey()),
    runtimeKey: storedKey,
    storedValue: storedKey,
    ready: () => Promise.resolve(status())
  };

  const initialKey = storedKey();

  if (initialKey) {
    runtimeAdminKey = initialKey;
    status();
  } else {
    dispatch(false);
  }
})();
