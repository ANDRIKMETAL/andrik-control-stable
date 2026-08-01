/* Control ANDRIK v55.00 R3E — extra touch swipe for analytics panes on mobile. */
(() => {
  'use strict';
  if (!/\/analytics-admin\.html$/i.test(location.pathname)) return;
  const viewport = document.getElementById('analyticsSwipeViewport');
  if (!viewport) return;

  const getCurrentIndex = () => {
    const page = String(document.body?.dataset?.analyticsPage || '').toLowerCase();
    if (page === 'google' || page === 'site' || page === 'analytics' || page === 'ga' || page === 'ga4') return 0;
    if (page === 'youtube') return 2;
    if (page === 'map') return 1;
    const active = document.querySelector('#analyticsSwipeDots [data-page].is-active');
    return active ? Number(active.dataset.page || 1) : 1;
  };

  const canHandleTarget = target => {
    if (!target) return false;
    if (target.closest('#countryGrowthPanel')) return false;
    if (target.closest('input,textarea,select,option,[contenteditable="true"],iframe,video,audio')) return false;
    return true;
  };

  let tracking = false;
  let axis = '';
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startTime = 0;
  let touchId = null;

  const reset = () => {
    tracking = false;
    axis = '';
    startX = startY = lastX = lastY = 0;
    startTime = 0;
    touchId = null;
  };

  document.addEventListener('touchstart', event => {
    if (tracking || event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!canHandleTarget(event.target)) return;
    tracking = true;
    axis = '';
    touchId = touch.identifier;
    startX = lastX = touch.clientX;
    startY = lastY = touch.clientY;
    startTime = performance.now();
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', event => {
    if (!tracking) return;
    const touch = [...event.touches].find(item => item.identifier === touchId) || event.touches[0];
    if (!touch) return;
    lastX = touch.clientX;
    lastY = touch.clientY;
    const dx = lastX - startX;
    const dy = lastY - startY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    if (!axis && Math.max(ax, ay) >= 12) {
      if (ax > ay * 1.12) axis = 'horizontal';
      else if (ay > ax * 1.12) axis = 'vertical';
    }
    if (axis !== 'horizontal') {
      if (axis === 'vertical') tracking = false;
      return;
    }
    event.preventDefault();
  }, { passive: false, capture: true });

  document.addEventListener('touchend', event => {
    if (!tracking) return reset();
    const touch = [...event.changedTouches].find(item => item.identifier === touchId) || event.changedTouches[0];
    if (touch) {
      lastX = touch.clientX;
      lastY = touch.clientY;
    }
    const dx = lastX - startX;
    const dy = lastY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = Math.abs(dx) / elapsed;
    const threshold = Math.max(54, Math.min(90, window.innerWidth * 0.10));
    const valid = axis === 'horizontal' && Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.1 && (velocity >= 0.14 || Math.abs(dx) >= threshold * 1.25);
    if (valid && typeof window.analyticsSetPage === 'function') {
      const current = getCurrentIndex();
      window.analyticsSetPage(current + (dx < 0 ? 1 : -1));
    }
    reset();
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', reset, { passive: true, capture: true });
})();
