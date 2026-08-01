/* Control ANDRIK v55.00 FINAL R33 — restore centre pull-down from admin menu to the main map in landscape. */
(() => {
  'use strict';
  if (window.__andrikMenuReturnMapR33) return;
  window.__andrikMenuReturnMapR33 = true;

  const body = document.body;
  if (!body?.classList.contains('control-home-page')) return;

  const zone = document.createElement('div');
  zone.className = 'control-final-menu-pull-zone control-menu-return-map-r33';
  zone.setAttribute('aria-label', 'Потянуть сверху вниз — вернуться на карту');
  zone.setAttribute('role', 'button');
  body.appendChild(zone);

  const track = document.getElementById('controlSwipeTrack');
  const threshold = 62;
  let active = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastY = 0;
  let pulling = false;

  const isLandscape = () => window.matchMedia('(orientation: landscape)').matches;
  const isMenu = () => body.classList.contains('control-menu-visible');
  const enabled = () => isLandscape() && isMenu();

  const paint = distance => {
    const eased = Math.min(94, Math.max(0, distance) * .64);
    zone.style.setProperty('--final-pull-y', `${Math.min(28, eased * .29)}px`);
    zone.style.setProperty('--final-pull-opacity', String(Math.min(.98, .28 + eased / 105)));
    if (track) {
      track.classList.toggle('is-final-pulling', eased > 0);
      track.style.transform = `translate3d(0,${eased}px,0)`;
      track.style.transition = eased > 0 ? 'none' : 'transform .32s cubic-bezier(.2,.82,.24,1)';
    }
  };

  const reset = () => {
    active = false;
    pulling = false;
    pointerId = null;
    paint(0);
    window.setTimeout(() => {
      if (track) {
        track.classList.remove('is-final-pulling');
        track.style.removeProperty('transform');
        track.style.removeProperty('transition');
      }
      zone.style.removeProperty('--final-pull-y');
      zone.style.removeProperty('--final-pull-opacity');
    }, 340);
  };

  zone.addEventListener('pointerdown', event => {
    if (!enabled() || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    active = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastY = startY;
    pulling = false;
    try { zone.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  }, { passive: false });

  zone.addEventListener('pointermove', event => {
    if (!active || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    lastY = event.clientY;
    if (!pulling) {
      if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.05) pulling = true;
      else if (Math.abs(dx) > 16 || dy < -10) { reset(); return; }
    }
    if (!pulling) return;
    event.preventDefault();
    paint(dy);
  }, { passive: false });

  const finish = event => {
    if (!active || (event && event.pointerId !== pointerId)) return;
    const dy = lastY - startY;
    try { if (event) zone.releasePointerCapture(event.pointerId); } catch (_) {}
    if (pulling && dy >= threshold) {
      paint(98);
      window.setTimeout(() => {
        location.replace(`/admin/?source=menu-pull&page=map&v=55.00-final-r33&t=${Date.now()}`);
      }, 90);
      return;
    }
    reset();
  };

  zone.addEventListener('pointerup', finish);
  zone.addEventListener('pointercancel', reset);
  window.addEventListener('orientationchange', reset, { passive: true });
  window.addEventListener('resize', () => { if (!enabled()) reset(); }, { passive: true });
})();
