(() => {
  'use strict';

  // R663: Android YouTube APP-FIRST with safe offline-LIVE fallback. Never let a generic https intent be the
  // first route, because Android 12+ may resolve that straight to the browser.
  // Proven path: vnd.youtube:VIDEO_ID. For channel/live links we first resolve
  // the current live id; if unavailable, use vnd.youtube: with the YouTube URL.
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const CHANNEL_LIVE_RE = /^https:\/\/(?:www\.|m\.)?youtube\.com\/@andrikmetal\/live(?:[/?#]|$)/i;
  let cachedLive = null;
  let liveFetch = null;

  function youtubeVideoId(rawUrl) {
    try {
      const u = new URL(rawUrl, location.href);
      const host = u.hostname.toLowerCase();
      if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || '';
      if (host.endsWith('youtube.com')) {
        const watch = u.searchParams.get('v');
        if (watch) return watch;
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'live' || parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] || '';
      }
    } catch (_) {}
    return '';
  }

  function navigationWatch() {
    let left = false;
    const mark = () => { left = true; };
    const onVis = () => { if (document.hidden) mark(); };
    document.addEventListener('visibilitychange', onVis, {once:true});
    window.addEventListener('pagehide', mark, {once:true});
    window.addEventListener('blur', mark, {once:true});
    return () => left || document.hidden;
  }

  function androidYoutubeTarget(webUrl, explicitId = '') {
    const id = explicitId || youtubeVideoId(webUrl);
    if (id) return `vnd.youtube:${id}`;
    // R663: NEVER feed a full https URL to vnd.youtube. Some YouTube clients
    // interpret vnd.youtube:https://... as a path and produce youtube.com/http....
    // For channel/profile pages use a normal Android https intent so YouTube,
    // ReVanced/RVX or another registered client can claim it, with web fallback.
    try {
      const u = new URL(webUrl, location.href);
      if (!/^(https?):$/.test(u.protocol)) return webUrl;
      const host = u.host;
      const path = `${u.pathname || '/'}${u.search || ''}${u.hash || ''}`.replace(/^\//,'');
      return `intent://${host}/${path}#Intent;scheme=${u.protocol.replace(':','')};S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    } catch (_) {
      return webUrl;
    }
  }

  function launchAppFirst(webUrl, id = '') {
    const didLeave = navigationWatch();
    try { window.location.href = androidYoutubeTarget(webUrl, id); } catch (_) {}
    // Browser is only a last fallback when no compatible app handled the app route.
    setTimeout(() => {
      if (!didLeave()) window.location.href = webUrl;
    }, 1800);
  }

  async function fetchLiveTarget({fresh=false, timeout=1400} = {}) {
    if (!fresh && cachedLive?.id) return cachedLive;
    if (!fresh && liveFetch) return liveFetch;
    const job = (async () => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
      try {
        const url = `${LIVE_TARGET_API}?${fresh ? 'fresh=1&' : ''}ts=${Date.now()}`;
        const res = await fetch(url, {
          cache:'no-store',
          headers:{accept:'application/json'},
          signal:controller?.signal
        });
        const data = await res.json().catch(() => ({}));
        const direct = String(data?.watchUrl || '');
        const id = String(data?.videoId || '') || youtubeVideoId(direct);
        if (res.ok && id) {
          cachedLive = {id, url: direct || `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, at:Date.now()};
          return cachedLive;
        }
      } catch (_) {
      } finally {
        if (timer) clearTimeout(timer);
      }
      return null;
    })();
    if (!fresh) liveFetch = job.finally(() => { liveFetch = null; });
    return job;
  }

  function prepare(root = document) {
    root.querySelectorAll(selector).forEach(link => {
      const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
      if (!webUrl) return;
      link.setAttribute('href', webUrl);
      link.setAttribute('rel', 'noopener noreferrer external');
      if (isAndroid) link.removeAttribute('target');
    });
  }

  async function preloadCurrentLiveTarget() {
    const links = [...document.querySelectorAll(selector)].filter(link => {
      const url = link.getAttribute('data-web-url') || link.href || '';
      return CHANNEL_LIVE_RE.test(url);
    });
    if (!links.length) return;
    const live = await fetchLiveTarget({fresh:false, timeout:2200});
    if (!live?.id) return;
    for (const link of links) {
      if (!link.getAttribute('data-web-fallback')) {
        link.setAttribute('data-web-fallback', link.getAttribute('data-web-url') || link.href || '');
      }
      link.setAttribute('data-youtube-live-id', live.id);
      link.setAttribute('data-web-url', live.url);
      link.setAttribute('href', live.url);
    }
  }

  async function openYoutubeFromRealTap(event, link) {
    if (!isAndroid) return;
    event.preventDefault();
    event.stopPropagation();

    const webUrl = link.getAttribute('data-web-url') || link.href || 'https://www.youtube.com/@andrikmetal/live';
    const knownId = link.getAttribute('data-youtube-live-id') || youtubeVideoId(webUrl) || cachedLive?.id || '';
    if (knownId) {
      launchAppFirst(webUrl, knownId);
      return;
    }

    const originalFallback = link.getAttribute('data-web-fallback') || webUrl;
    const isLiveChannel = CHANNEL_LIVE_RE.test(originalFallback) || CHANNEL_LIVE_RE.test(webUrl);
    if (isLiveChannel) {
      // A real tap may happen before page preload finishes. Resolve fresh right now;
      // wait only briefly, then still launch vnd.youtube rather than generic https.
      const live = await fetchLiveTarget({fresh:true, timeout:1200});
      if (live?.id) {
        link.setAttribute('data-youtube-live-id', live.id);
        link.setAttribute('data-web-url', live.url);
        link.setAttribute('href', live.url);
        launchAppFirst(live.url, live.id);
      } else {
        // R663: the stream itself is currently offline or unresolved. Do not
        // create vnd.youtube:https://...; let the Worker resolve a valid LIVE
        // video or redirect cleanly to the channel Streams page.
        window.location.href = '/radio-live?from=home&ts=' + Date.now();
      }
      return;
    }

    launchAppFirst(webUrl);
  }

  const boot = () => {
    prepare();
    preloadCurrentLiveTarget();
    setInterval(preloadCurrentLiveTarget, 45000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    openYoutubeFromRealTap(event, link);
  }, true);
})();
