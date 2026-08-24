(() => {
  'use strict';

  // R644: Android APP-FIRST navigation for ANDRIK public links.
  // Installed app gets the real tap; browser is only S.browser_fallback_url.
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  if (!isAndroid) return;

  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const RADIO_WEB = 'https://www.youtube.com/@andrikmetal/live';
  let liveTarget = {id:'', url:'', at:0};

  const packages = {
    'open.spotify.com': 'com.spotify.music',
    'music.apple.com': 'com.apple.android.music',
    'music.amazon.com': 'com.amazon.mp3',
    'www.instagram.com': 'com.instagram.android',
    'instagram.com': 'com.instagram.android',
    'www.tiktok.com': 'com.zhiliaoapp.musically',
    'tiktok.com': 'com.zhiliaoapp.musically',
    'soundcloud.com': 'com.soundcloud.android',
    'www.soundcloud.com': 'com.soundcloud.android',
    'x.com': 'com.twitter.android',
    'www.x.com': 'com.twitter.android',
    'twitter.com': 'com.twitter.android',
    'www.twitter.com': 'com.twitter.android',
    'www.pinterest.com': 'com.pinterest',
    'pinterest.com': 'com.pinterest',
    't.me': 'org.telegram.messenger'
  };

  function youtubeId(raw) {
    try {
      const u = new URL(raw, location.href);
      const h = u.hostname.toLowerCase();
      if (h === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || '';
      if (h.endsWith('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return v;
        const p = u.pathname.split('/').filter(Boolean);
        if (['watch','live','shorts','embed'].includes(p[0])) return p[1] || '';
      }
    } catch (_) {}
    return '';
  }

  function browserFallback(raw) {
    try { return new URL(raw, location.href).href; }
    catch (_) { return String(raw || ''); }
  }

  function httpsIntent(raw, packageName='') {
    try {
      const u = new URL(raw, location.href);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return raw;
      const path = `${u.pathname}${u.search}${u.hash}`.replace(/^\//, '');
      const pkg = packageName ? `package=${packageName};` : '';
      return `intent://${u.host}/${path}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;${pkg}S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    } catch (_) { return raw; }
  }

  function youtubeIntent(raw) {
    const id = youtubeId(raw);
    // vnd.youtube keeps the chooser limited to YouTube-compatible clients
    // (official YouTube / compatible mods) instead of sending a normal https tap to Chrome.
    if (id) return `vnd.youtube:${encodeURIComponent(id)}`;
    return httpsIntent(raw, '');
  }

  function youtubeMusicIntent(raw) {
    // Force YouTube Music when it is installed. Browser remains fallback.
    return httpsIntent(raw, 'com.google.android.apps.youtube.music');
  }

  function platformIntent(raw, link) {
    const web = browserFallback(raw);
    if (!web) return '';
    let u;
    try { u = new URL(web); } catch (_) { return web; }
    const host = u.hostname.toLowerCase();

    if (host === 'music.youtube.com') return youtubeMusicIntent(web);
    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') return youtubeIntent(web);

    const explicit = link?.getAttribute('data-app-package') || '';
    const pkg = explicit || packages[host] || '';
    if (!pkg) return web;
    return httpsIntent(web, pkg);
  }

  function isExternalPlatform(link) {
    if (!link || link.tagName !== 'A') return false;
    const raw = link.getAttribute('data-web-url') || link.getAttribute('href') || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return false;
    try {
      const host = new URL(raw, location.href).hostname.toLowerCase();
      return host === 'music.youtube.com' || host.endsWith('youtube.com') || host === 'youtu.be' || !!packages[host] || !!link.getAttribute('data-app-package');
    } catch (_) { return false; }
  }

  function prepareLink(link) {
    if (!isExternalPlatform(link)) return;
    const web = link.getAttribute('data-web-url') || link.getAttribute('href') || '';
    if (!web) return;
    if (!link.hasAttribute('data-web-url')) link.setAttribute('data-web-url', web);
    const intent = platformIntent(web, link);
    if (intent) link.setAttribute('href', intent);
    link.removeAttribute('target');
    link.setAttribute('rel', 'noopener noreferrer external');
  }

  function prepare(root=document) {
    root.querySelectorAll('a[href],a[data-web-url]').forEach(prepareLink);
  }

  async function fetchLive() {
    try {
      const res = await fetch(`${LIVE_TARGET_API}?fresh=1&ts=${Date.now()}`, {cache:'no-store',headers:{accept:'application/json'}});
      const data = await res.json().catch(() => ({}));
      const url = String(data?.watchUrl || '');
      const id = String(data?.videoId || youtubeId(url) || '').trim();
      if (res.ok && id && data?.active !== false) {
        liveTarget = {id, url:url || `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, at:Date.now()};
        return liveTarget;
      }
    } catch (_) {}
    return null;
  }

  function applyLive(link) {
    if (!link || link.dataset.youtubeLiveAuto !== '1') return;
    if (liveTarget.id && Date.now()-liveTarget.at < 90000) {
      link.setAttribute('data-web-url', liveTarget.url);
      link.setAttribute('data-youtube-live-id', liveTarget.id);
      link.setAttribute('href', `vnd.youtube:${encodeURIComponent(liveTarget.id)}`);
    } else {
      link.setAttribute('data-web-url', RADIO_WEB);
      link.setAttribute('href', youtubeIntent(RADIO_WEB));
    }
    link.removeAttribute('target');
  }

  function prepareLiveLinks() {
    document.querySelectorAll('a[data-youtube-live-auto="1"]').forEach(link => {
      link.dataset.youtubeLiveAuto='1';
      applyLive(link);
    });
  }

  async function refreshLive() {
    const found = await fetchLive();
    if (found) document.querySelectorAll('a[data-youtube-live-auto="1"]').forEach(applyLive);
  }

  const boot = () => {
    prepare();
    prepareLiveLinks();
    void refreshLive();
    setInterval(refreshLive, 30000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  // Re-apply synchronously before the real tap. This is important inside Android PWA/WebView.
  document.addEventListener('pointerdown', e => {
    const link = e.target.closest?.('a[href],a[data-web-url]');
    if (!link) return;
    if (link.dataset.youtubeLiveAuto === '1') applyLive(link);
    else prepareLink(link);
  }, true);
  document.addEventListener('touchstart', e => {
    const link = e.target.closest?.('a[href],a[data-web-url]');
    if (!link) return;
    if (link.dataset.youtubeLiveAuto === '1') applyLive(link);
    else prepareLink(link);
  }, {capture:true, passive:true});
})();
