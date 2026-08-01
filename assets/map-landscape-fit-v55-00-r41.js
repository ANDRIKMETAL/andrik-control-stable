/* Control ANDRIK v55.00 FINAL R41 — landscape crop + correct focus below the fixed header. */
(() => {
  'use strict';
  if (window.__andrikLandscapeFitR41) return;
  window.__andrikLandscapeFitR41 = true;

  const media = window.matchMedia('(orientation: landscape)');
  const pane = document.querySelector('.analytics-map-pane');
  const map = document.getElementById('worldMap');
  const topbar = document.querySelector('.control-detail-topbar, .control-topbar, .topbar');
  if (!pane || !map) return;

  const PORTRAIT_MAP = '/assets/world-map-control-v52.webp?v=52.14';
  const LANDSCAPE_MAP = '/assets/world-map-control-v55-r41-landscape.webp?v=55.00-r41';
  let generation = 0;
  let timers = [];
  let userMoved = false;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const currentImage = () => map.querySelector('.world-map-stage img, .world-map-canvas > img');

  const syncImage = () => {
    const image = currentImage();
    if (!image) return false;
    const wanted = media.matches ? LANDSCAPE_MAP : PORTRAIT_MAP;
    const current = image.getAttribute('src') || '';
    if (!current.includes(wanted.split('?')[0])) image.setAttribute('src', wanted);
    return true;
  };

  const alignBelowHeader = token => {
    if (token !== generation || userMoved || !media.matches || !map.isConnected) return;
    syncImage();
    const paneRect = pane.getBoundingClientRect();
    const mapRect = map.getBoundingClientRect();
    const headerBottom = topbar ? topbar.getBoundingClientRect().bottom : paneRect.top;
    const desiredTop = Math.max(paneRect.top, headerBottom);
    const target = Math.max(0, pane.scrollTop + mapRect.top - desiredTop);
    const previous = pane.style.scrollBehavior;
    pane.style.scrollBehavior = 'auto';
    pane.scrollTop = target;
    pane.style.scrollBehavior = previous;
  };

  const schedule = () => {
    clearTimers();
    userMoved = false;
    const token = ++generation;
    [40, 120, 260, 480, 760].forEach(delay => {
      timers.push(setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => alignBelowHeader(token)));
      }, delay));
    });
  };

  const handleChange = () => {
    syncImage();
    if (media.matches) schedule();
    else {
      clearTimers();
      userMoved = false;
    }
  };

  ['pointerdown', 'touchstart', 'wheel'].forEach(type => {
    pane.addEventListener(type, () => {
      userMoved = true;
      clearTimers();
    }, { passive: true });
  });

  new MutationObserver(() => {
    syncImage();
  }).observe(map, { childList: true, subtree: true });

  media.addEventListener?.('change', handleChange);
  window.addEventListener('orientationchange', handleChange, { passive: true });
  window.addEventListener('pageshow', handleChange, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handleChange();
  });

  syncImage();
  if (media.matches) schedule();
})();
