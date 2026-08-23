(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';

  function youtubeVideoId(rawUrl) {
    try {
      const u = new URL(rawUrl, location.href);
      const host = u.hostname.toLowerCase();

      if (host === 'youtu.be') {
        return u.pathname.split('/').filter(Boolean)[0] || '';
      }

      if (host.endsWith('youtube.com')) {
        const watch = u.searchParams.get('v');
        if (watch) return watch;

        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'live' || parts[0] === 'shorts' || parts[0] === 'embed') {
          return parts[1] || '';
        }
      }
    } catch (_) {}
    return '';
  }

  function openYoutubeFromRealTap(event, link) {
    if (!isAndroid) return;

    const webUrl = link.getAttribute('data-web-url') || link.href;
    if (!webUrl) return;

    event.preventDefault();

    const videoId = youtubeVideoId(webUrl);

    // For a real video/live page use ONLY the raw video id.
    // This is what YouTube/ReVanced expects for the vnd.youtube scheme.
    if (videoId) {
      let leftPage = false;
      const markLeft = () => { leftPage = true; };
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) markLeft();
      }, {once:true});
      window.addEventListener('pagehide', markLeft, {once:true});
      window.addEventListener('blur', markLeft, {once:true});

      try {
        window.location.href = `vnd.youtube:${videoId}`;
      } catch (_) {}

      // Only if no installed YouTube-compatible client took the intent.
      setTimeout(() => {
        if (!leftPage && !document.hidden) window.location.href = webUrl;
      }, 1200);
      return;
    }

    // Channel/profile links have no video id.
    // Let Android handle the normal HTTPS link with the user's configured default app.
    window.location.href = webUrl;
  }

  function prepare(root=document) {
    root.querySelectorAll(selector).forEach(link => {
      const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
      if (!webUrl) return;
      link.setAttribute('href', webUrl);
      link.setAttribute('rel', 'noopener noreferrer external');
      if (isAndroid) link.removeAttribute('target');
    });
  }

  document.addEventListener('DOMContentLoaded', () => prepare());

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    openYoutubeFromRealTap(event, link);
  }, true);
})();