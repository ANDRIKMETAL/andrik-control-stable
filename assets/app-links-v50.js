(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const CHANNEL_LIVE_RE = /^https:\/\/(?:www\.|m\.)?youtube\.com\/@andrikmetal\/live(?:[/?#]|$)/i;

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

  function genericYoutubeIntent(webUrl) {
    try {
      const u = new URL(webUrl, location.href);
      const host = u.hostname || 'www.youtube.com';
      const path = `${u.pathname}${u.search}${u.hash}`.replace(/^\//, '');
      // No package is pinned on purpose: Android may choose the user's configured
      // YouTube-compatible client (official YouTube, ReVanced, RVX, etc.).
      return `intent://${host}/${path}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    } catch (_) {
      return webUrl;
    }
  }

  function markNavigationWatch() {
    let leftPage = false;
    const markLeft = () => { leftPage = true; };
    document.addEventListener('visibilitychange', () => { if (document.hidden) markLeft(); }, {once:true});
    window.addEventListener('pagehide', markLeft, {once:true});
    window.addEventListener('blur', markLeft, {once:true});
    return () => leftPage || document.hidden;
  }

  function openYoutubeFromRealTap(event, link) {
    if (!isAndroid) return;
    const webUrl = link.getAttribute('data-web-url') || link.href;
    if (!webUrl) return;
    event.preventDefault();

    const videoId = youtubeVideoId(webUrl);
    const didLeave = markNavigationWatch();

    if (videoId) {
      // Same route that previously worked on ANDRIK: a raw video id via vnd.youtube.
      // Any installed compatible YouTube client can claim this scheme.
      try { window.location.href = `vnd.youtube:${videoId}`; } catch (_) {}
      setTimeout(() => {
        if (!didLeave()) window.location.href = webUrl;
      }, 1300);
      return;
    }

    // If the current live id has not finished preloading, ask Android's intent resolver
    // first instead of navigating straight to Chrome. Browser remains the fallback.
    try { window.location.href = genericYoutubeIntent(webUrl); } catch (_) { window.location.href = webUrl; }
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
    try {
      const res = await fetch(`${LIVE_TARGET_API}?ts=${Date.now()}`, {cache:'no-store', headers:{accept:'application/json'}});
      const data = await res.json().catch(() => ({}));
      const direct = String(data?.watchUrl || '');
      const id = youtubeVideoId(direct);
      if (!res.ok || !id) return;
      for (const link of links) {
        link.setAttribute('data-web-fallback', link.getAttribute('data-web-url') || link.href || '');
        link.setAttribute('data-web-url', direct);
        link.setAttribute('href', direct);
        link.setAttribute('data-youtube-live-id', id);
      }
    } catch (_) {}
  }

  const boot = () => {
    prepare();
    preloadCurrentLiveTarget();
    // Refresh occasionally so a newly-created broadcast is picked up without a rebuild.
    setInterval(preloadCurrentLiveTarget, 60000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    openYoutubeFromRealTap(event, link);
  }, true);
})();
