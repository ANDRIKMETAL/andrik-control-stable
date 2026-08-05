/* Control ANDRIK R283 — safe selected-country portal + scroll lock.
   No self-observing mutation loop. The full map geometry from R280 is preserved. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_PORTAL_R283__) return;
  window.__ANDRIK_COUNTRY_PORTAL_R283__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let pane = null;
  let marker = null;
  let originalParent = null;
  let originalNext = null;
  let fill = null;
  let scheduled = false;
  let wasActive = false;

  const hasRealFocus = () => {
    const selectedButton = document.querySelector('#worldCountries .world-country-button.is-selected');
    const focusedCard = document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus');
    const map = document.getElementById('worldMap');
    const focusCountry = String(map?.dataset?.focusCountry || '').trim();
    return Boolean(selectedButton || focusedCard || focusCountry);
  };

  const clearStaleFocusState = () => {
    const body = document.body;
    body.classList.remove('is-country-focus-active', 'r283-country-actions-active', 'r283-country-scroll-locked');
    const map = document.getElementById('worldMap');
    const list = document.getElementById('worldCountries');
    const card = document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus');
    map?.classList.remove('is-country-focused');
    card?.classList.remove('has-country-focus');
    if (map?.dataset) delete map.dataset.focusCountry;
    list?.classList.remove('has-selected-country', 'has-expanded-country-details', 'is-country-focus-mode');
    list?.querySelectorAll('.world-country-button.is-selected,.world-country-button.is-details-open').forEach(button => {
      button.classList.remove('is-selected', 'is-details-open');
      button.setAttribute('aria-pressed', 'false');
    });
    if (actions) {
      actions.hidden = true;
      actions.classList.remove('is-visible', 'r283-country-actions-portal');
      actions.setAttribute('aria-hidden', 'true');
    }
    if (fill) fill.hidden = true;
  };

  const isActive = () => Boolean(
    portrait()
    && document.body.dataset.analyticsPage === 'map'
    && document.body.classList.contains('is-country-focus-active')
    && hasRealFocus()
  );

  function remember() {
    actions ||= document.getElementById('mapFocusActions');
    pane ||= document.querySelector('.analytics-map-pane');
    if (!actions || marker) return Boolean(actions);
    originalParent = actions.parentNode;
    originalNext = actions.nextSibling;
    marker = document.createComment('andrik-r283-map-actions-home');
    originalParent?.insertBefore(marker, originalNext);
    return true;
  }

  function ensureFill() {
    if (fill?.isConnected) return fill;
    fill = document.getElementById('r283CountryBottomFill') || document.createElement('div');
    fill.id = 'r283CountryBottomFill';
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

  function setAttrIfChanged(node, name, value) {
    if (node?.getAttribute(name) !== value) node?.setAttribute(name, value);
  }

  function lockSelectedCountry() {
    if (!pane) return;
    document.body.classList.add('r283-country-scroll-locked');
    if (!wasActive) {
      pane.scrollTop = 0;
      pane.scrollLeft = 0;
      try { pane.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch (_) {}
    }
  }

  function unlockSelectedCountry() {
    document.body.classList.remove('r283-country-scroll-locked');
  }

  function restore() {
    if (!actions || !originalParent) return;
    if (actions.classList.contains('r283-country-actions-portal')) {
      actions.classList.remove('r283-country-actions-portal');
    }
    if (document.body.classList.contains('r283-country-actions-active')) {
      document.body.classList.remove('r283-country-actions-active');
    }
    unlockSelectedCountry();
    if (fill) fill.hidden = true;
    if (actions.parentNode !== originalParent) {
      if (marker?.parentNode === originalParent) originalParent.insertBefore(actions, marker);
      else if (originalNext?.parentNode === originalParent) originalParent.insertBefore(actions, originalNext);
      else originalParent.appendChild(actions);
    }
  }

  function apply() {
    scheduled = false;
    if (!remember()) return;
    const active = isActive();

    if (!active) {
      if (document.body.dataset.analyticsPage === 'map' && !hasRealFocus()) {
        clearStaleFocusState();
      }
      restore();
      wasActive = false;
      return;
    }

    lockSelectedCountry();
    if (actions.parentNode !== document.body) document.body.appendChild(actions);
    if (actions.hidden) actions.hidden = false;
    setAttrIfChanged(actions, 'aria-hidden', 'false');
    if (!actions.classList.contains('r283-country-actions-portal')) {
      actions.classList.add('r283-country-actions-portal');
    }
    if (!document.body.classList.contains('r283-country-actions-active')) {
      document.body.classList.add('r283-country-actions-active');
    }
    placeFill();
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
