/* ANDRIK R336 — first-party live ecosystem telemetry.
   Stores no raw IP in the browser or request body. Server keeps only coarse geo from Cloudflare edge. */
(() => {
  'use strict';
  if (location.hostname.toLowerCase() === 'control.andrikmetal.com') return;
  const KEY = 'andrik-site-visitor-v1';
  const makeId = () => {
    try { return crypto.randomUUID(); }
    catch (_) { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
  };
  let visitorId = '';
  try {
    visitorId = localStorage.getItem(KEY) || '';
    if (!/^[a-z0-9_-]{16,120}$/i.test(visitorId)) {
      visitorId = makeId();
      localStorage.setItem(KEY, visitorId);
    }
  } catch (_) {
    visitorId = makeId();
  }

  const send = (eventType = 'visit', target = '') => {
    const body = JSON.stringify({ visitorId, path: location.pathname, eventType, target:String(target || '').slice(0,500) });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/site/visit', blob)) return;
      }
    } catch (_) {}
    fetch('/api/site/visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body,
      keepalive: true,
      cache: 'no-store',
      credentials: 'same-origin'
    }).catch(() => {});
  };

  const classify = anchor => {
    if (!anchor) return null;
    const raw = String(anchor.getAttribute('data-web-url') || anchor.getAttribute('href') || '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return null;
    let url;
    try { url = new URL(raw, location.href); } catch (_) { return null; }
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const label = `${anchor.textContent || ''} ${anchor.getAttribute('aria-label') || ''}`.toLowerCase();

    if (host === 't.me' || host.endsWith('.t.me') || host === 'telegram.me') return ['telegram-open', url.href];
    if (host.includes('spotify.com')) return ['spotify-open', url.href];
    if (host.includes('music.apple.com')) return ['apple-music-open', url.href];
    if (host.includes('soundcloud.com')) return ['soundcloud-open', url.href];
    if (host.includes('music.amazon.')) return ['amazon-music-open', url.href];
    if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('music.youtube.com')) return ['youtube-open', url.href];

    const looksMp3 = /\.mp3(?:$|[?#])/i.test(url.href) || anchor.hasAttribute('download') || /скачать\s*mp3|download\s*mp3/i.test(label);
    const musicHost = host === 'music.andrikmetal.com' || host.endsWith('.music.andrikmetal.com');
    if (looksMp3 || (musicHost && path.includes('/singles/'))) return ['music-download', url.href];
    if (musicHost || /\bслушать\b|\blisten\b/i.test(label)) return ['music-listen', url.href];
    return null;
  };

  const boot = () => {
    send('visit');
    document.addEventListener('click', event => {
      const target = event.target;
      const playButton = target?.closest?.('[data-play]');
      if (playButton) {
        const article = playButton.closest?.('.andrik-track');
        const title = article?.querySelector?.('.andrik-track-title')?.textContent?.trim() || `track-${playButton.getAttribute('data-play') || ''}`;
        send('music-listen', title);
        return;
      }
      const anchor = target?.closest?.('a[href],a[data-web-url]');
      const hit = classify(anchor);
      if (hit) send(hit[0], hit[1]);
    }, { capture:true, passive:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
