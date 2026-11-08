(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const youtubeLinks = 'a[data-force-app="youtube"][data-web-url]';
  const publicLiveLinks = `${youtubeLinks}[data-youtube-live-auto="1"]`;
  const channelLiveUrl = 'https://www.youtube.com/@andrikmetal/live';
  const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
  let currentLiveUrl = channelLiveUrl;
  let liveRequest = null;
  let lastCheckAt = -Infinity;

  function youtubeVideoId(url) {
    const [, first, second] = url.pathname.split('/');
    let id = '';
    if (url.hostname === 'youtu.be') id = first;
    else if (first === 'watch') id = url.searchParams.get('v');
    else if (['live', 'shorts', 'embed'].includes(first)) id = second;
    return videoIdPattern.test(id || '') ? id : '';
  }

  function androidYoutubeHref(webUrl) {
    let url;
    try { url = new URL(webUrl, location.href); }
    catch (_) { return webUrl; }
    const host = url.hostname;
    if (url.protocol !== 'https:' || !(host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com'))) {
      return webUrl;
    }
    const fallback = `S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
    const id = youtubeVideoId(url);
    // Keep the native URI used by R1515 and let Android resolve its handler.
    if (id) return `intent:${id}#Intent;scheme=vnd.youtube;${fallback}`;
    return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;${fallback}`;
  }

  function setTarget(link, webUrl) {
    if (!webUrl) return;
    if (link.dataset.webUrl !== webUrl) link.dataset.webUrl = webUrl;
    const href = isAndroid ? androidYoutubeHref(webUrl) : webUrl;
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    if (isAndroid) link.removeAttribute('target');
  }

  function followCurrentLive(link) {
    link.dataset.youtubeLiveAuto = '1';
    setTarget(link, currentLiveUrl);
  }

  async function fetchLiveUrl() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(`/api/public/youtube-live-target?fresh=1&ts=${Date.now()}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: controller.signal
      });
      if (response.ok) {
        const data = await response.json();
        const id = String(data?.videoId || '');
        if (data?.active === true && videoIdPattern.test(id)) {
          return `https://www.youtube.com/watch?v=${id}`;
        }
      }
    } catch (_) {
      // The channel remains available while the live ID is being resolved.
    } finally {
      clearTimeout(timeout);
    }
    return channelLiveUrl;
  }

  function refreshCurrentLive() {
    if (document.hidden || liveRequest || Date.now() - lastCheckAt < 20000) return;
    lastCheckAt = Date.now();
    liveRequest = fetchLiveUrl().then(url => {
      currentLiveUrl = url;
      document.querySelectorAll(publicLiveLinks).forEach(link => setTarget(link, url));
    }).finally(() => { liveRequest = null; });
  }

  function boot() {
    document.querySelectorAll(youtubeLinks).forEach(link => {
      setTarget(link, link.dataset.webUrl);
      link.rel = 'noopener noreferrer external';
    });
    if (!document.querySelector(publicLiveLinks)) return;
    refreshCurrentLive();
    setInterval(refreshCurrentLive, 60000);
    document.addEventListener('visibilitychange', refreshCurrentLive);
    window.addEventListener('pageshow', refreshCurrentLive);
  }

  window.AndrikYoutubeLinks = { setTarget, followCurrentLive };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
