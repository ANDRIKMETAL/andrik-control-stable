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
  let checkingStatus = null;
  let active = false;
  let csrfToken = '';

  const PROTECTED_MUTATIONS = new Set([
    'POST /api/control/protection/guard-run',
    'POST /api/control/monitor/check',
    'POST /api/push/admin-device',
    'POST /api/push/send',
    'POST /api/push/inspect-playlist',
    'POST /api/push/check-playlist',
    'POST /api/push/check-youtube-events',
    'POST /api/automation/run',
    'POST /api/control/daily-summary/send',
    'POST /api/push/retry-latest',
    'POST /api/comments/moderate',
    'POST /api/lyrics/admin',
    'DELETE /api/lyrics/admin',
    'POST /api/lyrics/musixmatch',
    'POST /api/releases/publish',
    'POST /api/control/site-update/preview',
    'POST /api/control/site-update/backup',
    'POST /api/control/site-update/publish',
    'POST /api/control/site-update/release',
    'POST /api/control/site-update/finalize',
    'POST /api/control/site-update/rollback',
    'POST /api/control/snapshots/refresh',
    'POST /api/control/youtube-oauth/disconnect',
    'POST /api/control/youtube-comment/reply',
    'POST /api/backup/run',
    'POST /api/backup/restore'
  ]);

  const safeGet = (storage, key) => {
    try { return storage.getItem(key) || ''; } catch (_) { return ''; }
  };

  const rawStoredKey = () => {
    const values = [safeGet(localStorage, KEY_LOCAL), safeGet(sessionStorage, KEY_SESSION)];
    return values.find(value => value && value !== SENTINEL) || '';
  };

  const setSessionState = data => {
    if (data?.csrfToken) csrfToken = String(data.csrfToken);
    active = Boolean(data?.owner);
    document.documentElement.dataset.ownerSession = active ? 'active' : 'inactive';
    document.documentElement.dataset.ownerCsrf = csrfToken ? 'active' : 'inactive';
    window.dispatchEvent(new CustomEvent('andrik-owner-session', {
      detail:{ active, csrf:Boolean(csrfToken) }
    }));
  };

  const setSentinel = data => {
    try { nativeSetItem.call(sessionStorage, KEY_SESSION, SENTINEL); } catch (_) {}
    try { nativeSetItem.call(localStorage, KEY_LOCAL, SENTINEL); } catch (_) {}
    setSessionState({ ...data, owner:true });
  };

  const clearStoredMarkers = () => {
    try { nativeRemoveItem.call(sessionStorage, KEY_SESSION); } catch (_) {}
    try { nativeRemoveItem.call(localStorage, KEY_LOCAL); } catch (_) {}
    csrfToken = '';
    setSessionState({ owner:false });
  };

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
        method:'POST', credentials:'include', cache:'no-store',
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
      setSentinel(data);
      replaceVisibleRawKeys(raw);
      return data;
    })().finally(() => { establishing = null; });
    return establishing;
  }

  async function status() {
    if (checkingStatus) return checkingStatus;
    checkingStatus = (async () => {
      try {
        const response = await nativeFetch('/api/control/owner-status', {
          credentials:'include', cache:'no-store', headers:{accept:'application/json'}
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.owner) {
          setSentinel(data);
          return data;
        }
        if (safeGet(localStorage, KEY_LOCAL) === SENTINEL || safeGet(sessionStorage, KEY_SESSION) === SENTINEL) {
          clearStoredMarkers();
        }
        return data;
      } catch (_) {
        return { ok:false, owner:false };
      }
    })().finally(() => { checkingStatus = null; });
    return checkingStatus;
  }

  async function clear() {
    try {
      await nativeFetch('/api/control/owner-session', {
        method:'DELETE', credentials:'include', cache:'no-store', headers:{accept:'application/json'}
      });
    } catch (_) {}
    clearStoredMarkers();
  }

  const requestMethod = (input, init) => String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
  const requestHeaders = (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers || undefined).forEach((value, key) => headers.set(key, value));
    return headers;
  };

  window.fetch = async function(input, init = {}) {
    const requestUrl = (() => {
      try { return new URL(typeof input === 'string' ? input : input.url, location.href); }
      catch (_) { return null; }
    })();
    const next = { ...init };
    const sameApi = requestUrl && requestUrl.origin === location.origin && requestUrl.pathname.startsWith('/api/');
    let headers = requestHeaders(input, init);
    const method = requestMethod(input, init);
    const protectedMutation = Boolean(sameApi && PROTECTED_MUTATIONS.has(`${method} ${requestUrl.pathname.replace(/\/+$/, '') || '/'}`));

    if (sameApi) {
      next.credentials = 'include';
      const auth = String(headers.get('authorization') || '');
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      const xKey = String(headers.get('x-admin-key') || '').trim();
      const suppliedRaw = [bearer, xKey].find(value => value && value !== SENTINEL) || '';

      // Never send the harmless marker as if it were the real ADMIN_KEY.
      if (bearer === SENTINEL) headers.delete('authorization');
      if (xKey === SENTINEL) headers.delete('x-admin-key');

      if (protectedMutation) {
        if (suppliedRaw) {
          await establish(suppliedRaw);
          headers.delete('authorization');
          headers.delete('x-admin-key');
        } else if (!active || !csrfToken) {
          await status();
        }
        headers.set('x-andrik-control-request', '1');
        if (csrfToken) headers.set('x-andrik-csrf', csrfToken);
      }
      next.headers = headers;
    }

    const response = await nativeFetch(input, next);
    if (sameApi && requestUrl.pathname !== '/api/control/owner-session') {
      try {
        const auth = String(headers.get('authorization') || '');
        const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : String(headers.get('x-admin-key') || '').trim();
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
    csrfReady:() => Boolean(csrfToken),
    storedValue:() => active ? SENTINEL : rawStoredKey()
  };

  const legacyRaw = rawStoredKey();
  if (legacyRaw) establish(legacyRaw).catch(() => {});
  else status().catch(() => {});

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#serviceForget,#commentsAdminForget,#attackForget,#protectionForget,[data-owner-session-forget]');
    if (button) clear().catch(() => {});
  }, true);
})();
