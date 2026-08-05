/* Control ANDRIK R293 — stable selected-country actions on the proven R275 map.
   The map geometry is never changed. The action bar is moved outside the old
   swipe/scroll container and a short debounce prevents it disappearing during
   a normal country-card redraw. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_FOCUS_STABLE_R293__) return;
  window.__ANDRIK_COUNTRY_FOCUS_STABLE_R293__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let pane = null;
  let homeMarker = null;
  let homeParent = null;
  let focused = false;
  let falseTimer = 0;
  let frame = 0;

  const onMapPage = () => document.body.dataset.analyticsPage === 'map';
  const hasFocusDom = () => Boolean(
    document.querySelector('#worldCountries .world-country-button.is-selected') ||
    document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus') ||
    String(document.getElementById('worldMap')?.dataset?.focusCountry || '').trim()
  );
  const active = () => portrait() && onMapPage() && focused;

  function remember() {
    actions ||= document.getElementById('mapFocusActions');
    pane ||= document.querySelector('.analytics-map-pane');
    if (!actions) return false;
    if (!homeMarker) {
      homeParent = actions.parentNode;
      homeMarker = document.createComment('andrik-r293-map-actions-home');
      homeParent?.insertBefore(homeMarker, actions);
    }
    return true;
  }

  function resetMapScroll() {
    const nodes = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      document.querySelector('.analytics-swipe-main'),
      document.querySelector('.analytics-swipe-viewport'),
      pane,
      pane?.querySelector('.analytics-pane-wrap')
    ];
    nodes.forEach(node => {
      if (!node) return;
      try { node.scrollTop = 0; } catch (_) {}
    });
    try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function show() {
    if (!remember()) return;
    if (actions.parentNode !== document.body) document.body.appendChild(actions);
    if (actions.hidden) actions.hidden = false;
    if (actions.getAttribute('aria-hidden') !== 'false') actions.setAttribute('aria-hidden', 'false');
    if (!actions.classList.contains('r293-country-actions-portal')) actions.classList.add('r293-country-actions-portal');
    if (!document.body.classList.contains('r293-country-actions-visible')) document.body.classList.add('r293-country-actions-visible');
  }

  function hide() {
    if (!actions) return;
    actions.classList.remove('r293-country-actions-portal');
    document.body.classList.remove('r293-country-actions-visible');
    actions.hidden = true;
    actions.setAttribute('aria-hidden', 'true');
    if (homeParent && actions.parentNode !== homeParent) {
      if (homeMarker?.parentNode === homeParent) homeParent.insertBefore(actions, homeMarker.nextSibling);
      else homeParent.appendChild(actions);
    }
  }

  function sync() {
    frame = 0;
    if (active()) show();
    else hide();
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  }

  function confirmBlur() {
    clearTimeout(falseTimer);
    falseTimer = window.setTimeout(() => {
      focused = Boolean(hasFocusDom() && document.body.classList.contains('is-country-focus-active'));
      schedule();
    }, 700);
  }

  function onFocusChanged(event) {
    const next = Boolean(event?.detail?.focused);
    if (next) {
      clearTimeout(falseTimer);
      focused = true;
      resetMapScroll();
      requestAnimationFrame(resetMapScroll);
      schedule();
      return;
    }
    // The country list is redrawn during a normal selection update. During that
    // redraw the old runtime may briefly emit a false state. Confirm it later.
    confirmBlur();
  }

  function stopLegacyScroll(event) {
    if (!active()) return;
    if (event.target?.closest?.('a,button,input,select,textarea,label,[role="button"]')) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function start() {
    if (!remember()) return;
    focused = Boolean(document.body.classList.contains('is-country-focus-active') && hasFocusDom());

    pane?.addEventListener('touchmove', stopLegacyScroll, { passive: false, capture: true });
    pane?.addEventListener('wheel', stopLegacyScroll, { passive: false, capture: true });

    window.addEventListener('andrik:country-focus-changed', onFocusChanged);
    window.addEventListener('andrik:analytics-page-changed', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(schedule, 120), { passive: true });
    window.addEventListener('pageshow', () => {
      focused = Boolean(document.body.classList.contains('is-country-focus-active') && hasFocusDom());
      if (focused) resetMapScroll();
      schedule();
    }, { passive: true });

    // Observe only country selection state. The action bar is not observed,
    // which avoids the self-triggering loop that broke later test builds.
    const observer = new MutationObserver(() => {
      if (!focused && hasFocusDom() && document.body.classList.contains('is-country-focus-active')) focused = true;
      schedule();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-analytics-page'] });
    const list = document.getElementById('worldCountries');
    if (list) observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
    if (actions) observer.observe(actions, { attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden'] });

    // Catch an old runtime moving the action bar back into the clipped map card.
    // This observes only direct children, so it does not follow map-marker redraws.
    const positionObserver = new MutationObserver(schedule);
    positionObserver.observe(document.body, { childList: true });
    if (homeParent && homeParent !== document.body) positionObserver.observe(homeParent, { childList: true });

    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
