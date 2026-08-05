/* Control ANDRIK R282 — lock selected-country portrait view at the top. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_SCROLL_LOCK_R282__) return;
  window.__ANDRIK_COUNTRY_SCROLL_LOCK_R282__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let active = false;
  let correcting = false;
  let observer = null;

  const elements = () => ({
    pane: document.querySelector('.analytics-map-pane'),
    viewport: document.getElementById('analyticsSwipeViewport') || document.querySelector('.analytics-swipe-viewport'),
    main: document.querySelector('.analytics-swipe-main'),
    wrap: document.querySelector('.analytics-map-pane .analytics-map-pane-wrap'),
    doc: document.scrollingElement || document.documentElement
  });

  function shouldLock() {
    return portrait()
      && document.body.classList.contains('is-country-focus-active')
      && document.body.dataset.analyticsPage === 'map';
  }

  function resetScroll() {
    if (!active || correcting) return;
    correcting = true;
    requestAnimationFrame(() => {
      const { pane, viewport, main, wrap, doc } = elements();
      [pane, viewport, main, wrap, doc, document.documentElement, document.body].forEach(node => {
        if (!node) return;
        try { node.scrollTop = 0; } catch (_) {}
      });
      try { window.scrollTo(0, 0); } catch (_) {}
      correcting = false;
    });
  }

  function lock() {
    const { pane, viewport } = elements();
    pane?.classList.remove('is-country-expanded');
    viewport?.classList.remove('is-country-list-open');
    document.documentElement.classList.add('r282-country-focus-locked');
    document.body.classList.add('r282-country-focus-locked');
    active = true;
    resetScroll();
    setTimeout(resetScroll, 40);
    setTimeout(resetScroll, 140);
  }

  function unlock() {
    active = false;
    document.documentElement.classList.remove('r282-country-focus-locked');
    document.body.classList.remove('r282-country-focus-locked');
  }

  function sync() {
    if (shouldLock()) lock();
    else unlock();
  }

  function blockVerticalMove(event) {
    if (!active) return;
    const target = event.target;
    if (target?.closest?.('#mapFocusActions a, #mapFocusActions button')) return;
    event.preventDefault();
    resetScroll();
  }

  function start() {
    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-analytics-page']
    });
    window.addEventListener('andrik:country-focus-changed', sync, { passive: true });
    window.addEventListener('scroll', resetScroll, { passive: true, capture: true });
    document.querySelector('.analytics-map-pane')?.addEventListener('scroll', resetScroll, { passive: true });
    document.addEventListener('touchmove', blockVerticalMove, { passive: false, capture: true });
    document.addEventListener('wheel', blockVerticalMove, { passive: false, capture: true });
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(sync, 120), { passive: true });
    window.addEventListener('pageshow', sync, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
