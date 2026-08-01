(() => {
  'use strict';
  if (window.__andrikMapMenuSwipeV5499bReady) return;
  window.__andrikMapMenuSwipeV5499bReady = true;

  let start = null;
  const getMapPane = () => document.querySelector('.analytics-map-pane');
  const isMapPage = () => {
    const pane = getMapPane();
    return document.body.dataset.analyticsPage === 'map' || pane?.getAttribute('aria-hidden') === 'false';
  };
  const blocked = target => Boolean(target?.closest?.('a,button,input,textarea,select,summary,#countryGrowthPanel'));
  const getScrollState = () => {
    const pane = getMapPane();
    const inner = pane?.querySelector?.('.analytics-pane-wrap');
    const innerScrollable = Boolean(inner && inner.scrollHeight > inner.clientHeight + 8);
    const element = innerScrollable ? inner : pane;
    const scrollable = Boolean(element && element.scrollHeight > element.clientHeight + 8);
    const atBottom = Boolean(element) && (!scrollable || element.scrollTop + element.clientHeight >= element.scrollHeight - 4);
    return { element, atBottom };
  };

  document.addEventListener('touchstart', event => {
    if (!isMapPage() || event.touches.length !== 1 || blocked(event.target)) {
      start = null;
      return;
    }
    const touch = event.touches[0];
    const { atBottom } = getScrollState();
    const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    const rightScrollZone = touch.clientX >= Math.max(0, viewportWidth - 76);
    const bottomMenuZone = touch.clientY >= Math.max(0, viewportHeight - 118);
    const isLandscape = window.matchMedia?.('(orientation: landscape)')?.matches === true;
    const dedicatedZone = Boolean(event.target?.closest?.('#mapEndPullZone'));
    start = { x: touch.clientX, y: touch.clientY, t: Date.now(), canOpen: atBottom && bottomMenuZone && !rightScrollZone && (!isLandscape || dedicatedZone) };
  }, { passive: true, capture: true });

  document.addEventListener('touchend', event => {
    if (!start || !isMapPage() || event.changedTouches.length !== 1) {
      start = null;
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.t;
    const canOpen = start.canOpen;
    start = null;

    const growthOpen = document.getElementById('countryGrowthPanel')?.hidden === false;
    const stillAtBottom = getScrollState().atBottom;
    if (growthOpen || elapsed > 1100 || !canOpen || !stillAtBottom) return;
    if (dy < -82 && Math.abs(dy) > Math.abs(dx) * 1.25) {
      location.assign('/control-home.html?source=map-swipe&page=menu&v=54.99b');
    }
  }, { passive: true, capture: true });
})();
