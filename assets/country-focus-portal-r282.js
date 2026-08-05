/* Control ANDRIK R282 — selected-country action portal. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_ACTION_PORTAL_R282__) return;
  window.__ANDRIK_COUNTRY_ACTION_PORTAL_R282__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let marker = null;
  let originalParent = null;
  let originalNext = null;
  let syncing = false;
  let fill = null;
  let cardObserver = null;

  function remember() {
    actions = document.getElementById('mapFocusActions');
    if (!actions || marker) return Boolean(actions);
    originalParent = actions.parentNode;
    originalNext = actions.nextSibling;
    marker = document.createComment('andrik-r282-map-actions-home');
    originalParent?.insertBefore(marker, originalNext);
    return true;
  }

  function ensureFill() {
    if (fill?.isConnected) return fill;
    fill = document.getElementById('r282CountryBottomFill') || document.createElement('div');
    fill.id = 'r282CountryBottomFill';
    fill.setAttribute('aria-hidden', 'true');
    document.body.appendChild(fill);
    return fill;
  }

  function placeFill() {
    const panel = ensureFill();
    const card = document.querySelector('.analytics-map-top.has-country-focus');
    const bottom = card ? Math.round(card.getBoundingClientRect().bottom - 1) : window.innerHeight;
    const top = Math.max(0, Math.min(window.innerHeight, bottom));
    panel.style.top = `${top}px`;
    panel.hidden = top >= window.innerHeight - 2;
  }

  function restore() {
    if (!actions || !originalParent) return;
    actions.classList.remove('r282-country-actions-portal');
    document.body.classList.remove('r282-country-actions-active');
    if (fill) fill.hidden = true;
    if (actions.parentNode !== originalParent) {
      if (marker?.parentNode === originalParent) originalParent.insertBefore(actions, marker);
      else if (originalNext?.parentNode === originalParent) originalParent.insertBefore(actions, originalNext);
      else originalParent.appendChild(actions);
    }
  }

  function sync() {
    if (syncing) return;
    syncing = true;
    requestAnimationFrame(() => {
      syncing = false;
      if (!remember()) return;
      const active = portrait()
        && document.body.classList.contains('is-country-focus-active')
        && document.body.dataset.analyticsPage === 'map';

      if (!active) {
        restore();
        return;
      }

      if (actions.parentNode !== document.body) document.body.appendChild(actions);
      actions.hidden = false;
      actions.setAttribute('aria-hidden', 'false');
      actions.classList.add('r282-country-actions-portal');
      document.body.classList.add('r282-country-actions-active');
      placeFill();
    });
  }

  function start() {
    remember();
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-analytics-page'],
      childList: true,
      subtree: false
    });
    const card = document.querySelector('.analytics-map-top');
    if (card && 'ResizeObserver' in window) {
      cardObserver = new ResizeObserver(sync);
      cardObserver.observe(card);
    }
    if (actions) {
      const actionObserver = new MutationObserver(sync);
      actionObserver.observe(actions, { attributes: true, attributeFilter: ['hidden', 'class', 'aria-hidden'] });
    }
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('scroll', sync, { passive: true, capture: true });
    window.addEventListener('orientationchange', () => setTimeout(sync, 120), { passive: true });
    window.addEventListener('pageshow', sync, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
