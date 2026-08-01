/* Control ANDRIK v55.00 FINAL R48 — reliable end-of-page pull to Admin panel. */
(() => {
  'use strict';
  const init = () => {
    if (window.__andrikFinalMapPullR1) return;
    const zone = document.getElementById('mapEndPullZone');
    const pane = document.querySelector('.analytics-map-pane');
    const wrap = pane?.querySelector('.analytics-map-pane-wrap');
    const text = document.getElementById('mapEndPullText');
    const countries = document.getElementById('worldCountries');
    if (!zone || !pane || !wrap) return;
    window.__andrikFinalMapPullR1 = true;
    zone.setAttribute('aria-hidden', 'false');
    zone.style.touchAction = 'none';

    /* R48: keep the gesture zone at the true end of the map page in both orientations. */
    if (zone.parentNode !== wrap || zone !== wrap.lastElementChild) wrap.appendChild(zone);

    let active = false;
    let pointerId = null;
    let startY = 0;
    let distance = 0;
    let navigating = false;
    const threshold = 46;

    const isMapVisible = () => {
      const hidden = pane.getAttribute('aria-hidden');
      return hidden !== 'true' && (document.body.dataset.analyticsPage || 'map') === 'map';
    };
    const isAtBottom = () => {
      const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
      return max - pane.scrollTop <= 28;
    };
    const setVisual = (value) => {
      distance = Math.max(0, Math.min(92, Number(value) || 0));
      const progress = Math.min(1, distance / threshold);
      const resistance = Math.min(30, Math.pow(progress, .82) * 28);
      document.body.classList.toggle('is-map-end-pulling', distance > 2);
      document.body.classList.toggle('is-map-end-ready', distance >= threshold);
      zone.style.setProperty('--map-end-pull', `${distance}px`);
      zone.style.setProperty('--map-end-progress', String(progress));
      wrap.style.transition = 'none';
      wrap.style.transform = `translate3d(0,${-resistance}px,0)`;
      if (text) text.textContent = distance >= threshold
        ? 'Отпустите — открыть админ-панель'
        : 'Потяните вверх — открыть админ-панель';
    };
    const reset = (bounce = true) => {
      active = false;
      pointerId = null;
      distance = 0;
      document.body.classList.remove('is-map-end-pulling', 'is-map-end-ready');
      if (bounce) document.body.classList.add('is-map-end-bouncing');
      zone.style.setProperty('--map-end-pull', '0px');
      zone.style.setProperty('--map-end-progress', '0');
      wrap.style.transition = 'transform .34s cubic-bezier(.2,.86,.28,1.08)';
      wrap.style.transform = 'translate3d(0,0,0)';
      if (text) text.textContent = 'Потяните вверх — открыть админ-панель';
      window.setTimeout(() => {
        document.body.classList.remove('is-map-end-bouncing');
        wrap.style.removeProperty('transition');
        wrap.style.removeProperty('transform');
      }, 540);
    };
    const openMenu = () => {
      if (navigating) return;
      navigating = true;
      if (text) text.textContent = 'Открываем админ-панель…';
      document.body.classList.add('is-map-end-ready');
      window.setTimeout(() => {
        location.assign(`/control-home.html?source=map-r48-dedicated-pull&page=menu&v=55.00-r48&t=${Date.now()}`);
      }, 90);
    };

    zone.addEventListener('pointerdown', (event) => {
      if (event.isPrimary === false || navigating || !isMapVisible() || !isAtBottom()) return;
      active = true;
      pointerId = event.pointerId;
      startY = event.clientY;
      distance = 0;
      event.preventDefault();
      event.stopPropagation();
      try { zone.setPointerCapture(pointerId); } catch (_) {}
      setVisual(0);
    }, { passive: false, capture: true });

    zone.addEventListener('pointermove', (event) => {
      if (!active || event.pointerId !== pointerId) return;
      const pull = startY - event.clientY;
      event.preventDefault();
      event.stopPropagation();
      setVisual(pull);
    }, { passive: false, capture: true });

    const finish = (event, cancelled = false) => {
      if (!active || (event && event.pointerId !== pointerId)) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const ready = !cancelled && distance >= threshold;
      const id = pointerId;
      if (ready) {
        active = false;
        pointerId = null;
        navigating = true;
        try { zone.releasePointerCapture(id); } catch (_) {}
        if (text) text.textContent = 'Открываем админ-панель…';
        document.body.classList.add('is-map-end-ready');
        window.setTimeout(() => {
          location.assign(`/control-home.html?source=map-r48-dedicated-pull&page=menu&v=55.00-r48&t=${Date.now()}`);
        }, 90);
      } else {
        try { zone.releasePointerCapture(id); } catch (_) {}
        reset(true);
      }
    };
    zone.addEventListener('pointerup', (event) => finish(event, false), { passive: false, capture: true });
    zone.addEventListener('pointercancel', (event) => finish(event, true), { passive: false, capture: true });
    zone.addEventListener('lostpointercapture', () => { if (active && !navigating) reset(true); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
