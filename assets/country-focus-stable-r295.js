/* Control ANDRIK R295 — stable selected-country action buttons.
   The buttons are visible only on the map while a country is really selected.
   No sticky focus memory, no polling timer and no flash on Activity/Summary pages. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_FOCUS_STABLE_R295__) return;
  window.__ANDRIK_COUNTRY_FOCUS_STABLE_R295__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let card = null;
  let list = null;
  let frame = 0;

  const onMapPage = () => document.body?.dataset?.analyticsPage === 'map';
  const hasRealFocus = () => Boolean(
    document.querySelector('#worldCountries .world-country-button.is-selected[aria-pressed="true"]') ||
    document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus') ||
    String(document.getElementById('worldMap')?.dataset?.focusCountry || '').trim()
  );
  const shouldShow = () => Boolean(
    portrait() &&
    onMapPage() &&
    document.body?.classList.contains('is-country-focus-active') &&
    hasRealFocus()
  );

  function remember() {
    actions ||= document.getElementById('mapFocusActions');
    card ||= document.querySelector('.analytics-map-top.world-map-card,.analytics-map-top');
    list ||= document.getElementById('worldCountries');
    return Boolean(actions && card);
  }

  function clearLegacyPortalState() {
    document.body?.classList.remove(
      'r283-country-actions-active','r284-country-actions-active','r285-country-actions-active',
      'r286-country-actions-active','r287-country-actions-active','r288-country-actions-active',
      'r289-country-actions-active','r290-country-actions-active','r293-country-actions-visible',
      'r294-country-actions-visible'
    );
    if (!actions) return;
    [...actions.classList].forEach(name => {
      if (/^r28\d-country-actions-portal$/.test(name) || /^r29[0-4]-country-actions-/.test(name)) {
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
    if (!remember() || !shouldShow()) return hide();
    clearLegacyPortalState();
    placeInCard();
    actions.hidden = false;
    actions.setAttribute('aria-hidden', 'false');
    actions.classList.add('r295-country-actions-in-card');
    document.body.classList.add('r295-country-actions-visible');
  }

  function hide() {
    if (!actions) return;
    actions.classList.remove('r295-country-actions-in-card');
    document.body?.classList.remove('r295-country-actions-visible');
    actions.hidden = true;
    actions.setAttribute('aria-hidden', 'true');
  }

  function sync() {
    frame = 0;
    if (shouldShow()) show(); else hide();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  }

  function hideImmediately() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    hide();
  }

  function start() {
    if (!remember()) return;
    clearLegacyPortalState();
    hideImmediately();

    actions.addEventListener('click', event => {
      if (event.target.closest('a,button')) hideImmediately();
    }, true);

    window.addEventListener('andrik:country-focus-changed', schedule, { passive:true });
    window.addEventListener('andrik:analytics-page-changed', event => {
      if (event?.detail?.page !== 'map') hideImmediately();
      else schedule();
    }, { passive:true });
    window.addEventListener('resize', schedule, { passive:true });
    window.addEventListener('orientationchange', () => setTimeout(schedule, 120), { passive:true });
    window.addEventListener('pageshow', schedule, { passive:true });
    window.addEventListener('pagehide', hideImmediately, { passive:true });
    window.addEventListener('beforeunload', hideImmediately, { passive:true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hideImmediately(); else schedule();
    }, { passive:true });

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes:true,
      attributeFilter:['class','data-analytics-page']
    });
    if (list) {
      observer.observe(list, {
        subtree:true,
        childList:true,
        attributes:true,
        attributeFilter:['class','aria-pressed']
      });
    }
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
