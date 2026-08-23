(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';

  function openYoutubeFromRealTap(event, link) {
    if (!isAndroid) return;

    const webUrl = link.getAttribute('data-web-url') || link.href;
    if (!webUrl) return;

    event.preventDefault();

    // YouTube-compatible Android clients (stock YouTube, ReVanced/RVX/Vanced)
    // inherit the vnd.youtube VIEW intent from YouTube.
    // IMPORTANT: this runs synchronously inside the REAL click gesture.
    const appUrl = `vnd.youtube:${webUrl}`;

    let leftPage = false;
    const markLeft = () => { leftPage = true; };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) markLeft();
    }, {once:true});
    window.addEventListener('pagehide', markLeft, {once:true});
    window.addEventListener('blur', markLeft, {once:true});

    try {
      window.location.href = appUrl;
    } catch (_) {}

    // If there is no app that handles vnd.youtube, keep a web fallback.
    setTimeout(() => {
      if (!leftPage && !document.hidden) {
        window.location.href = webUrl;
      }
    }, 1100);
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