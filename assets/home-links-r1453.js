/* R1453: catalogue navigation and radio links in the latest-video card. */
(() => {
  'use strict';
  const SINGLE_URL = '/singles?view=all&v=1453';
  const isRadioTitle = title => /(?:\bradio\b|\blive\s*24\s*\/\s*7\b|\b24\s*\/\s*7\b|радио\s*24|прямой\s*эфир|радіо\s*24)/i.test(title || '');

  function boot() {
    const latest = document.getElementById('homeLatestVideo');
    const title = document.getElementById('homeVideoTitle');
    const youtube = window.AndrikYoutubeLinks;
    if (latest && title && youtube) {
      const updateLatestLink = () => {
        if (isRadioTitle(title.textContent)) {
          youtube.followCurrentLive(latest);
        } else {
          delete latest.dataset.youtubeLiveAuto;
          youtube.setTarget(latest, latest.dataset.webUrl);
        }
      };
      const observer = new MutationObserver(updateLatestLink);
      observer.observe(title, { characterData: true, childList: true, subtree: true });
      updateLatestLink();
    }
    document.querySelectorAll('#singles .andrik-singles-more').forEach(a => {
      a.href = SINGLE_URL;
      a.setAttribute('aria-label', (a.textContent || 'Все синглы').trim());
    });
  }

  let going = false;
  function openSingles(event) {
    const target = event.target?.closest?.('a.andrik-singles-more');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (going) return;
    going = true;
    const go = new URL(SINGLE_URL, window.location.origin).href;
    try {
      if (window.top && window.top !== window) window.top.location.assign(go);
      else window.location.assign(go);
    } catch (_) {
      window.location.href = go;
    }
  }

  document.addEventListener('click', openSingles, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
