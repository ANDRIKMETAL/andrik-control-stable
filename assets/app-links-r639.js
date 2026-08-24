(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const RADIO_GO = '/radio-live';
  const RADIO_WEB_FALLBACK = 'https://www.youtube.com/@andrikmetal/live';
  const CHANNEL_LIVE_RE = /^https:\/\/(?:www\.|m\.)?youtube\.com\/@andrikmetal\/live(?:[/?#]|$)/i;
  let liveTargetCache = { url:'', id:'', at:0 };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  function androidHttpsIntent(webUrl) {
    try {
      const u = new URL(webUrl, location.href);
      if (!/^https:$/.test(u.protocol)) return webUrl;
      const host = u.hostname || 'www.youtube.com';
      const path = `${u.pathname}${u.search}${u.hash}`.replace(/^\//, '');
      const fallback = encodeURIComponent(u.href);
      // R639: no package is pinned on purpose. Android can offer official YouTube,
      // ReVanced/RVX or any other app registered for YouTube links. A browser is only
      // the final fallback when Android has no compatible app.
      return `intent://${host}/${path}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${fallback};end`;
    } catch (_) {
      return webUrl;
    }
  }

  function radioFallbackIntent() {
    return androidHttpsIntent(RADIO_WEB_FALLBACK);
  }

  async function fetchOneLiveTarget(fresh=true) {
    try {
      const res = await fetch(`${LIVE_TARGET_API}?fresh=${fresh?'1':'0'}&ts=${Date.now()}`, {
        cache:'no-store', headers:{accept:'application/json'}
      });
      const data = await res.json().catch(() => ({}));
      const direct = String(data?.watchUrl || '');
      const id = String(data?.videoId || youtubeVideoId(direct) || '').trim();
      if (res.ok && id && data?.active === true) {
        const url = direct && youtubeVideoId(direct) === id
          ? direct
          : `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
        liveTargetCache = {url,id,at:Date.now()};
        return liveTargetCache;
      }
    } catch (_) {}
    return null;
  }

  async function fetchCurrentLiveTarget({fresh=false,retry=false}={}) {
    if (!fresh && liveTargetCache.id && Date.now()-liveTargetCache.at < 20000) return liveTargetCache;
    const waits = retry ? [0,350,750] : [0];
    for (const wait of waits) {
      if (wait) await sleep(wait);
      const found = await fetchOneLiveTarget(true);
      if (found) return found;
    }
    return {url:'',id:'',at:Date.now()};
  }

  function applyLiveTargetToLink(link, target) {
    if (!link || link.dataset.youtubeLiveAuto !== '1') return;
    if (target?.id) {
      link.setAttribute('data-web-url', target.url);
      link.setAttribute('data-youtube-live-id', target.id);
      link.setAttribute('href', isAndroid ? androidHttpsIntent(target.url) : target.url);
      return;
    }
    link.removeAttribute('data-youtube-live-id');
    link.setAttribute('data-web-url', RADIO_GO);
    link.setAttribute('href', isAndroid ? radioFallbackIntent() : RADIO_GO);
  }

  function updateLiveLinks(target) {
    document.querySelectorAll(selector).forEach(link => {
      if (link.dataset.youtubeLiveAuto === '1') applyLiveTargetToLink(link, target);
    });
  }

  function prepare(root=document) {
    root.querySelectorAll(selector).forEach(link => {
      const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
      if (!webUrl) return;
      if (CHANNEL_LIVE_RE.test(webUrl) || link.hasAttribute('data-youtube-live-auto')) {
        link.dataset.youtubeLiveAuto = '1';
      }
      link.setAttribute('rel', 'noopener noreferrer external');
      if (isAndroid) link.removeAttribute('target');

      if (link.dataset.youtubeLiveAuto === '1') {
        // Critical R639 behavior: the actual anchor is already an Android intent BEFORE
        // the user's tap. This preserves the real user gesture and prevents Chrome/PWA
        // from swallowing an app launch after an async fetch.
        applyLiveTargetToLink(link, liveTargetCache.id ? liveTargetCache : null);
      } else {
        link.setAttribute('href', webUrl);
      }
    });
  }

  async function preloadCurrentLiveTarget() {
    const links = [...document.querySelectorAll(selector)].filter(link => link.dataset.youtubeLiveAuto === '1');
    if (!links.length) return;
    const current = await fetchCurrentLiveTarget({fresh:false,retry:false});
    updateLiveLinks(current?.id ? current : null);
  }

  // Refresh on touch/pointer DOWN, before click. If the cached target exists this is fully
  // synchronous; otherwise the anchor still points at YouTube /@andrikmetal/live as an
  // Android intent, so an installed YouTube-compatible app gets first chance to handle it.
  function refreshLiveHrefSynchronously(link) {
    if (!link || link.dataset.youtubeLiveAuto !== '1') return;
    const freshEnough = liveTargetCache.id && Date.now()-liveTargetCache.at < 90000;
    applyLiveTargetToLink(link, freshEnough ? liveTargetCache : null);
  }

  const boot = () => {
    prepare();
    preloadCurrentLiveTarget();
    setInterval(preloadCurrentLiveTarget, 15000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  document.addEventListener('pointerdown', event => {
    const link = event.target.closest?.(selector);
    if (link?.dataset.youtubeLiveAuto === '1') refreshLiveHrefSynchronously(link);
  }, true);

  document.addEventListener('touchstart', event => {
    const link = event.target.closest?.(selector);
    if (link?.dataset.youtubeLiveAuto === '1') refreshLiveHrefSynchronously(link);
  }, {capture:true, passive:true});

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;

    const isLiveAuto = link.dataset.youtubeLiveAuto === '1';
    if (isLiveAuto && isAndroid) {
      // Do NOT preventDefault here. Native navigation of the intent:// href happens in the
      // same real tap and can therefore open official YouTube / ReVanced / RVX directly.
      refreshLiveHrefSynchronously(link);
      return;
    }

    if (!isLiveAuto || isAndroid) return;
    event.preventDefault();
    void (async () => {
      const current = await fetchCurrentLiveTarget({fresh:true,retry:true});
      if (current?.id) {
        updateLiveLinks(current);
        location.href = current.url;
      } else {
        location.href = `${RADIO_GO}?ts=${Date.now()}`;
      }
    })();
  }, true);
})();
