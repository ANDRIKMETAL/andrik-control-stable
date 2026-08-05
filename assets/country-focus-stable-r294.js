/* Control ANDRIK R294 — stable in-card selected-country buttons.
   The map geometry is not changed. The buttons stay after the selected-country
   card, use compact dimensions, and are never moved into a fixed portal. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_FOCUS_STABLE_R294__) return;
  window.__ANDRIK_COUNTRY_FOCUS_STABLE_R294__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let card = null;
  let list = null;
  let focused = false;
  let blurTimer = 0;
  let frame = 0;

  const onMapPage = () => document.body.dataset.analyticsPage === 'map';
  const hasRealFocus = () => Boolean(
    document.querySelector('#worldCountries .world-country-button.is-selected') ||
    document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus') ||
    String(document.getElementById('worldMap')?.dataset?.focusCountry || '').trim()
  );

  function remember() {
    actions ||= document.getElementById('mapFocusActions');
    card ||= document.querySelector('.analytics-map-top.world-map-card,.analytics-map-top');
    list ||= document.getElementById('worldCountries');
    return Boolean(actions && card);
  }

  function clearLegacyPortalState() {
    document.body.classList.remove(
      'r283-country-actions-active','r284-country-actions-active','r285-country-actions-active',
      'r286-country-actions-active','r287-country-actions-active','r288-country-actions-active',
      'r289-country-actions-active','r290-country-actions-active','r293-country-actions-visible'
    );
    if (!actions) return;
    [...actions.classList].forEach(name => {
      if (/^r28\d-country-actions-portal$/.test(name) || name === 'r290-country-actions-portal' || name === 'r293-country-actions-portal') {
        actions.classList.remove(name);
      }
    });
  }

  function placeInCard() {
    if (!remember()) return;
    const growthToggle = document.getElementById('countryGrowthToggle');
    if (actions.parentNode !== card) {
      if (growthToggle?.parentNode === card) card.insertBefore(actions, growthToggle);
      else card.appendChild(actions);
    } else if (growthToggle?.parentNode === card && actions.nextSibling !== growthToggle) {
      card.insertBefore(actions, growthToggle);
    }
  }

  function show() {
    if (!remember()) return;
    clearLegacyPortalState();
    placeInCard();
    actions.hidden = false;
    actions.setAttribute('aria-hidden', 'false');
    actions.classList.add('r294-country-actions-in-card');
    document.body.classList.add('r294-country-actions-visible');
  }

  function hide() {
    if (!actions) return;
    actions.classList.remove('r294-country-actions-in-card');
    document.body.classList.remove('r294-country-actions-visible');
    actions.hidden = true;
    actions.setAttribute('aria-hidden', 'true');
  }

  function sync() {
    frame = 0;
    if (hasRealFocus()) focused = true;
    const active = portrait() && onMapPage() && focused;
    if (active) show(); else hide();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  }

  function confirmBlur() {
    clearTimeout(blurTimer);
    blurTimer = window.setTimeout(() => {
      focused = hasRealFocus();
      schedule();
    }, 900);
  }

  function onFocusChanged(event) {
    const next = Boolean(event?.detail?.focused);
    if (next) {
      clearTimeout(blurTimer);
      focused = true;
      schedule();
    } else {
      confirmBlur();
    }
  }

  function start() {
    if (!remember()) return;
    focused = hasRealFocus();
    clearLegacyPortalState();

    window.addEventListener('andrik:country-focus-changed', onFocusChanged);
    window.addEventListener('andrik:analytics-page-changed', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(schedule, 120), { passive: true });
    window.addEventListener('pageshow', schedule, { passive: true });

    const observer = new MutationObserver(() => {
      if (hasRealFocus()) focused = true;
      schedule();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-analytics-page'] });
    if (list) observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });

    window.setInterval(() => {
      if (hasRealFocus()) focused = true;
      if (focused && portrait() && onMapPage()) {
        placeInCard();
        if (actions.hidden || actions.getAttribute('aria-hidden') !== 'false') show();
      }
      schedule();
    }, 1000);

    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
