(() => {
  'use strict';

  // R862: quota-safe CURRENT-LIVE routing.
  // Public pages do not poll YouTube in the background. A real Radio tap resolves
  // the current LIVE id with fresh=1, then opens YouTube/ReVanced app-first.
  // If JavaScript/app handoff fails, /radio-live performs the same fresh server-side resolve.
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const LIVE_GATE = '/radio-live?from=home';
  let lastFreshLive = null;

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

  function androidYoutubeTarget(webUrl, explicitId = '') {
    const id = explicitId || youtubeVideoId(webUrl);
    if (id) return `vnd.youtube:${id}`;
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
    setTimeout(() => {
      if (!didLeave()) window.location.href = webUrl;
    }, 1400);
  }

  async function fetchFreshLiveTarget({timeout=2600} = {}) {
    // Short same-tap cache only; never trust an old page/preload id.
    if (lastFreshLive?.id && Date.now() - lastFreshLive.at < 10000) return lastFreshLive;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      const res = await fetch(`${LIVE_TARGET_API}?fresh=1&ts=${Date.now()}`, {
        cache:'no-store',
        headers:{accept:'application/json'},
        signal:controller?.signal
      });
      const data = await res.json().catch(() => ({}));
      const direct = String(data?.watchUrl || '');
      const id = String(data?.videoId || '') || youtubeVideoId(direct);
      if (res.ok && id && data?.active !== false) {
        lastFreshLive = {id, url:direct || `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, at:Date.now()};
        return lastFreshLive;
      }
    } catch (_) {
    } finally {
      if (timer) clearTimeout(timer);
    }
    return null;
  }

  function prepare(root = document) {
    root.querySelectorAll(selector).forEach(link => {
      const isLive = link.dataset.youtubeLiveAuto === '1';
      if (isLive) {
        // A plain browser click/copy still goes through the server-side CURRENT-LIVE gate.
        link.setAttribute('href', LIVE_GATE);
        link.setAttribute('data-web-url', LIVE_GATE);
      } else {
        const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
        if (webUrl) link.setAttribute('href', webUrl);
      }
      link.setAttribute('rel', 'noopener noreferrer external');
      if (isAndroid) link.removeAttribute('target');
    });
  }

  async function openYoutubeFromRealTap(event, link) {
    const isLive = link.dataset.youtubeLiveAuto === '1';

    // For non-Android LIVE links, route through /radio-live, which resolves fresh server-side.
    if (!isAndroid) return;

    event.preventDefault();
    event.stopPropagation();

    if (isLive) {
      const live = await fetchFreshLiveTarget({timeout:2600});
      if (live?.id) {
        link.setAttribute('data-youtube-live-id', live.id);
        launchAppFirst(live.url, live.id);
        return;
      }
      window.location.href = `${LIVE_GATE}&ts=${Date.now()}`;
      return;
    }

    const webUrl = link.getAttribute('data-web-url') || link.href || 'https://www.youtube.com/@andrikmetal';
    launchAppFirst(webUrl);
  }

  const boot = () => prepare(); // R862: zero background LIVE polling = quota-safe.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    void openYoutubeFromRealTap(event, link);
  }, true);
})();
