(() => {
  'use strict';

  // R1047: resolve the CURRENT YouTube LIVE again on every real tap.
  // Official YouTube, ReVanced/RVX/Vanced-compatible clients can claim
  // vnd.youtube:VIDEO_ID. Browser is only a fallback.
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const CHANNEL_LIVE = 'https://www.youtube.com/@andrikmetal/live';
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
    document.addEventListener('visibilitychange', () => { if (document.hidden) mark(); }, {once:true});
    window.addEventListener('pagehide', mark, {once:true});
    window.addEventListener('blur', mark, {once:true});
    return () => left || document.hidden;
  }

  function genericYoutubeIntent(webUrl) {
    try {
      const u = new URL(webUrl, location.href);
      const path = `${u.pathname || '/'}${u.search || ''}${u.hash || ''}`.replace(/^\//,'');
      return `intent://${u.host}/${path}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    } catch (_) {
      return webUrl;
    }
  }

  function launchVideoAppFirst(webUrl, id) {
    const didLeave = navigationWatch();
    try { window.location.href = `vnd.youtube:${id}`; } catch (_) {}
    setTimeout(() => {
      if (!didLeave()) {
        try { window.location.href = genericYoutubeIntent(webUrl); }
        catch (_) { window.location.href = webUrl; }
      }
    }, 1600);
  }

  async function fetchLiveTarget({fresh=false, timeout=2200} = {}) {
    if (!fresh && cachedLive?.id && Date.now() - cachedLive.at < 45000) return cachedLive;
    if (!fresh && liveFetch) return liveFetch;

    const job = (async () => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
      try {
        const url = `${LIVE_TARGET_API}?${fresh ? 'fresh=1&' : ''}ts=${Date.now()}`;
        const res = await fetch(url, {
          cache:'no-store',
          credentials:'include',
          headers:{accept:'application/json','cache-control':'no-cache'},
          signal:controller?.signal
        });
        const data = await res.json().catch(() => ({}));
        const direct = String(data?.watchUrl || '');
        const id = String(data?.videoId || '') || youtubeVideoId(direct);
        if (res.ok && id && data?.active !== false) {
          cachedLive = {
            id,
            url: direct || `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
            at:Date.now()
          };
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

  function isAuto(link) {
    return link?.dataset?.youtubeLiveAuto === '1';
  }

  function applyLive(link, live) {
    if (!link || !live?.id) return;
    if (!link.dataset.webFallback) link.dataset.webFallback = CHANNEL_LIVE;
    link.dataset.youtubeLiveId = live.id;
    link.dataset.webUrl = live.url;
    link.href = live.url;
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
    const links = [...document.querySelectorAll(selector)].filter(isAuto);
    if (!links.length) return;
    const live = await fetchLiveTarget({fresh:false, timeout:2200});
    if (!live?.id) return;
    links.forEach(link => applyLive(link, live));
  }

  async function openYoutubeFromRealTap(event, link) {
    if (!isAndroid) return;
    event.preventDefault();
    event.stopPropagation();

    if (isAuto(link)) {
      // Always re-resolve on tap so a restarted 24/7 broadcast cannot leave an old id.
      const live = await fetchLiveTarget({fresh:true, timeout:2400});
      if (live?.id) {
        applyLive(link, live);
        launchVideoAppFirst(live.url, live.id);
        return;
      }

      const knownId = link.dataset.youtubeLiveId || cachedLive?.id || '';
      const knownUrl = link.dataset.webUrl || cachedLive?.url || CHANNEL_LIVE;
      if (knownId) {
        launchVideoAppFirst(knownUrl, knownId);
        return;
      }

      window.location.href = genericYoutubeIntent(CHANNEL_LIVE);
      return;
    }

    const webUrl = link.getAttribute('data-web-url') || link.href || CHANNEL_LIVE;
    const id = youtubeVideoId(webUrl);
    if (id) {
      launchVideoAppFirst(webUrl, id);
      return;
    }
    window.location.href = genericYoutubeIntent(webUrl);
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
    void openYoutubeFromRealTap(event, link);
  }, true);
})();
