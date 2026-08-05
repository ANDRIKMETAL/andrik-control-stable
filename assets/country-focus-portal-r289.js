/* Control ANDRIK R290 — selected-country portal without black filler. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_PORTAL_R290__) return;
  window.__ANDRIK_COUNTRY_PORTAL_R290__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let pane = null;
  let marker = null;
  let originalParent = null;
  let originalNext = null;
  let scheduled = false;
  let wasActive = false;

  const hasRealFocus = () => {
    const selectedButton = document.querySelector('#worldCountries .world-country-button.is-selected');
    const focusedCard = document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus');
    const focusCountry = String(document.getElementById('worldMap')?.dataset?.focusCountry || '').trim();
    return Boolean(selectedButton || focusedCard || focusCountry);
  };

  const isActive = () => Boolean(
    portrait()
    && document.body.dataset.analyticsPage === 'map'
    && document.body.classList.contains('is-country-focus-active')
    && hasRealFocus()
  );

  function removeLegacyOverlay() {
    ['r283CountryBottomFill','r284CountryBottomFill','r285CountryBottomFill','r286CountryBottomFill','r287CountryBottomFill','r288CountryBottomFill','r289CountryBottomFill']
      .forEach(id => document.getElementById(id)?.remove());
    document.body.classList.remove(
      'r283-country-actions-active','r284-country-actions-active','r285-country-actions-active',
      'r286-country-actions-active','r287-country-actions-active','r288-country-actions-active',
      'r283-country-scroll-locked','r284-country-scroll-locked','r285-country-scroll-locked',
      'r286-country-scroll-locked','r287-country-scroll-locked','r288-country-scroll-locked'
    );
    const oldClasses=['r283-country-actions-portal','r284-country-actions-portal','r285-country-actions-portal',
      'r286-country-actions-portal','r287-country-actions-portal','r288-country-actions-portal'];
    document.querySelectorAll('#mapFocusActions').forEach(node => node.classList.remove(...oldClasses));
  }

  function remember() {
    actions ||= document.getElementById('mapFocusActions');
    pane ||= document.querySelector('.analytics-map-pane');
    if (!actions || marker) return Boolean(actions);
    originalParent = actions.parentNode;
    originalNext = actions.nextSibling;
    marker = document.createComment('andrik-r289-map-actions-home');
    originalParent?.insertBefore(marker, originalNext);
    return true;
  }

  function setAttrIfChanged(node, name, value) {
    if (node?.getAttribute(name) !== value) node?.setAttribute(name, value);
  }

  function lockSelectedCountry() {
    if (!pane) return;
    document.body.classList.add('r289-country-scroll-locked');
    if (!wasActive) {
      pane.scrollTop = 0;
      pane.scrollLeft = 0;
      try { pane.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch (_) {}
    }
  }

  function unlockSelectedCountry() {
    document.body.classList.remove('r289-country-scroll-locked');
  }

  function restore() {
    if (!actions || !originalParent) return;
    actions.classList.remove('r289-country-actions-portal');
    document.body.classList.remove('r289-country-actions-active');
    unlockSelectedCountry();
    if (actions.parentNode !== originalParent) {
      if (marker?.parentNode === originalParent) originalParent.insertBefore(actions, marker);
      else if (originalNext?.parentNode === originalParent) originalParent.insertBefore(actions, originalNext);
      else originalParent.appendChild(actions);
    }
  }

  function clearStaleFocusState() {
    if (hasRealFocus()) return;
    document.body.classList.remove('is-country-focus-active');
    const map = document.getElementById('worldMap');
    const list = document.getElementById('worldCountries');
    const card = document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus');
    map?.classList.remove('is-country-focused');
    card?.classList.remove('has-country-focus');
    if (map?.dataset) delete map.dataset.focusCountry;
    list?.classList.remove('has-selected-country', 'has-expanded-country-details', 'is-country-focus-mode');
  }

  function apply() {
    scheduled = false;
    removeLegacyOverlay();
    if (!remember()) return;
    const active = isActive();

    if (!active) {
      clearStaleFocusState();
      restore();
      wasActive = false;
      return;
    }

    lockSelectedCountry();
    if (actions.parentNode !== document.body) document.body.appendChild(actions);
    actions.hidden = false;
    setAttrIfChanged(actions, 'aria-hidden', 'false');
    actions.classList.add('r289-country-actions-portal');
    document.body.classList.add('r289-country-actions-active');
    wasActive = true;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function stopOldScroll(event) {
    if (!isActive()) return;
    const target = event.target;
    if (target?.closest?.('a,button,input,select,textarea,label,[role="button"]')) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function start() {
    removeLegacyOverlay();
    remember();
    pane?.addEventListener('touchmove', stopOldScroll, { passive: false, capture: true });
    pane?.addEventListener('wheel', stopOldScroll, { passive: false, capture: true });

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-analytics-page']
    });
    const worldCountries = document.getElementById('worldCountries');
    if (worldCountries) {
      observer.observe(worldCountries, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'aria-pressed']
      });
    }

    window.addEventListener('andrik:country-focus-changed', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(schedule, 120), { passive: true });
    window.addEventListener('pageshow', schedule, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); }, { passive: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
