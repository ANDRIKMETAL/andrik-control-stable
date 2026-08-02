(() => {
  'use strict';

  if (window.__ANDRIK_SLEEP_MODE_R195__) return;
  window.__ANDRIK_SLEEP_MODE_R195__ = true;

  const root = document.documentElement;
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeFetch = window.fetch.bind(window);
  const criticalUpdatePage = /\/site-update-admin(?:\.html)?$/.test(location.pathname);

  // The updater must never sleep while it is checking GitHub or following a Deploy.
  // Keep the public API available, but do not patch timers/fetch on this critical page.
  if (criticalUpdatePage) {
    window.ANDRIK_SLEEP_MODE = Object.freeze({
      build: 'R195',
      isHidden: () => document.hidden,
      isIdle: () => false,
      isSleeping: () => false,
      wake() {},
      markMediaActive() {}
    });
    return;
  }

  const IDLE_AFTER_MS = 45000;
  let idleTimer = 0;
  let idle = false;
  let hidden = document.hidden;
  let syntheticId = 910000;
  const managedIntervals = new Map();
  const inFlight = new Map();
  const responseCache = new Map();

  const mediaIsActive = () => {
    if (window.__ANDRIK_MEDIA_ACTIVE__ === true || root.dataset.andrikMediaActive === '1') return true;
    try {
      return [...document.querySelectorAll('audio,video')].some(media => !media.paused && !media.ended);
    } catch (_) {
      return false;
    }
  };

  const sleeping = () => hidden || idle;
  const idleDelay = delay => {
    const ms = Math.max(16, Number(delay) || 0);
    if (!idle) return ms;
    if (ms < 500) return 1000;
    if (ms < 2500) return 15000;
    if (ms < 30000) return 30000;
    if (ms < 60000) return 60000;
    return ms;
  };

  const dispatchState = previous => {
    root.classList.toggle('andrik-tab-hidden', hidden);
    root.classList.toggle('andrik-idle', idle);
    root.classList.toggle('andrik-sleeping', sleeping());
    const detail = { hidden, idle, sleeping: sleeping(), previous };
    document.dispatchEvent(new CustomEvent('andrik:sleepstate', { detail }));
    document.dispatchEvent(new CustomEvent(detail.sleeping ? 'andrik:sleep' : 'andrik:wake', { detail }));
  };

  const stopManagedTimers = () => {
    for (const record of managedIntervals.values()) {
      if (record.timer) nativeClearTimeout(record.timer);
      record.timer = 0;
    }
  };

  const scheduleRecord = record => {
    if (!record.active || record.timer || hidden) return;
    record.timer = nativeSetTimeout(() => {
      record.timer = 0;
      if (!record.active || hidden) return;
      try {
        if (typeof record.callback === 'function') record.callback(...record.args);
      } catch (error) {
        nativeSetTimeout(() => { throw error; }, 0);
      }
      scheduleRecord(record);
    }, idleDelay(record.delay));
  };

  const resumeManagedTimers = () => {
    if (hidden) return;
    for (const record of managedIntervals.values()) scheduleRecord(record);
  };

  window.setInterval = (callback, delay = 0, ...args) => {
    const id = ++syntheticId;
    const record = { id, callback, delay: Math.max(0, Number(delay) || 0), args, timer: 0, active: true };
    managedIntervals.set(id, record);
    scheduleRecord(record);
    return id;
  };

  window.clearInterval = id => {
    const record = managedIntervals.get(id);
    if (!record) return nativeClearInterval(id);
    record.active = false;
    if (record.timer) nativeClearTimeout(record.timer);
    managedIntervals.delete(id);
  };

  const setIdle = value => {
    const next = Boolean(value) && !mediaIsActive();
    if (idle === next) return;
    const previous = { hidden, idle, sleeping: sleeping() };
    idle = next;
    stopManagedTimers();
    resumeManagedTimers();
    dispatchState(previous);
  };

  const armIdle = () => {
    if (idleTimer) nativeClearTimeout(idleTimer);
    if (hidden || mediaIsActive()) {
      setIdle(false);
      return;
    }
    idleTimer = nativeSetTimeout(() => setIdle(true), IDLE_AFTER_MS);
  };

  const markActive = () => {
    if (hidden) return;
    setIdle(false);
    armIdle();
  };

  ['pointerdown','pointermove','keydown','wheel','touchstart','focus'].forEach(type => {
    window.addEventListener(type, markActive, { passive: true, capture: false });
  });

  document.addEventListener('visibilitychange', () => {
    const previous = { hidden, idle, sleeping: sleeping() };
    hidden = document.hidden;
    if (hidden) {
      if (idleTimer) nativeClearTimeout(idleTimer);
      idleTimer = 0;
      stopManagedTimers();
    } else {
      idle = false;
      resumeManagedTimers();
      armIdle();
    }
    dispatchState(previous);
  }, { passive: true });

  // Same-page GET hub: concurrent identical API reads become one network request.
  // A very short memory cache also prevents several widgets from asking for the same data at once.
  window.fetch = (input, init = {}) => {
    let request;
    try { request = input instanceof Request ? input : new Request(input, init); }
    catch (_) { return nativeFetch(input, init); }

    cleanupCache();
    const method = String(request.method || 'GET').toUpperCase();
    let url;
    try { url = new URL(request.url, location.href); }
    catch (_) { return nativeFetch(input, init); }

    const sameOriginApi = method === 'GET' && url.origin === location.origin && url.pathname.startsWith('/api/');
    const auth = request.headers.get('authorization') || '';
    const sensitiveApi = Boolean(auth) || url.pathname.startsWith('/api/control/site-update/');
    const bypass = sensitiveApi || request.headers.has('range') || url.searchParams.has('_nocache') || url.searchParams.has('fresh');
    if (!sameOriginApi || bypass) return nativeFetch(input, init);
    const key = `${url.href}|${auth}|${request.credentials}`;
    const now = Date.now();
    const ttl = hidden ? 0 : idle ? 15000 : 2500;
    const cached = responseCache.get(key);
    if (ttl && cached && now - cached.at <= ttl) return Promise.resolve(cached.response.clone());

    const pending = inFlight.get(key);
    if (pending) return pending.then(response => response.clone());

    const job = nativeFetch(request).then(response => {
      if (response.ok && ttl) responseCache.set(key, { at: Date.now(), response: response.clone() });
      return response;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, job);
    return job.then(response => response.clone());
  };

  const cleanupCache = () => {
    const now = Date.now();
    for (const [key, item] of responseCache) if (now - item.at > 60000) responseCache.delete(key);
  };

  window.ANDRIK_SLEEP_MODE = Object.freeze({
    build: 'R195',
    isHidden: () => hidden,
    isIdle: () => idle,
    isSleeping: sleeping,
    wake: markActive,
    markMediaActive(value) {
      window.__ANDRIK_MEDIA_ACTIVE__ = Boolean(value);
      if (value) markActive();
      else armIdle();
    }
  });

  dispatchState(null);
  armIdle();
})();
