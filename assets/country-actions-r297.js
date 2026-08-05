/* Control ANDRIK R297 — stable portrait action portal.
   Moves only the two selected-country action buttons out of the legacy
   swipe container. It never changes map dimensions, transforms or scrolling. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_ACTIONS_R297__) return;
  window.__ANDRIK_COUNTRY_ACTIONS_R297__ = true;

  let actions = null;
  let list = null;
  let map = null;
  let scheduled = false;
  let focusedByEvent = false;
  let focusGraceUntil = 0;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  const onMapPage = () => document.body?.dataset?.analyticsPage === 'map';

  const realSelection = () => Boolean(
    focusedByEvent ||
    document.body?.classList.contains('is-country-focus-active') ||
    list?.querySelector('.world-country-button.is-selected,[aria-pressed="true"].world-country-button') ||
    map?.classList.contains('is-country-focused') ||
    String(map?.dataset?.focusCountry || '').trim()
  );

  const ensureConnected = () => {
    actions ||= document.getElementById('mapFocusActions');
    list ||= document.getElementById('worldCountries');
    map ||= document.getElementById('worldMap');
    if (!actions) return false;
    if (actions.parentNode !== document.body) document.body.appendChild(actions);
    if (!actions.classList.contains('r297-country-actions')) {
      actions.classList.add('r297-country-actions');
    }
    return true;
  };

  const setVisible = visible => {
    if (!actions) return;
    if (visible) {
      actions.style.removeProperty('display');
      if (actions.hidden) actions.hidden = false;
      if (actions.getAttribute('aria-hidden') !== 'false') actions.setAttribute('aria-hidden', 'false');
      document.body.classList.add('r297-country-actions-visible');
    } else {
      if (!actions.hidden) actions.hidden = true;
      if (actions.getAttribute('aria-hidden') !== 'true') actions.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('r297-country-actions-visible');
    }
  };

  const apply = () => {
    scheduled = false;
    if (!ensureConnected()) return;

    const selectedNow = realSelection();
    if (selectedNow) focusGraceUntil = Date.now() + 1200;

    const visible = Boolean(
      portrait() &&
      onMapPage() &&
      (selectedNow || Date.now() < focusGraceUntil)
    );
    setVisible(visible);
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  };

  const start = () => {
    if (!ensureConnected()) return;

    const bodyObserver = new MutationObserver(schedule);
    bodyObserver.observe(document.body, {
      attributes:true,
      attributeFilter:['class','data-analytics-page']
    });

    if (list) {
      const listObserver = new MutationObserver(schedule);
      listObserver.observe(list, {
        subtree:true,
        childList:true,
        attributes:true,
        attributeFilter:['class','aria-pressed']
      });
    }

    const actionObserver = new MutationObserver(schedule);
    actionObserver.observe(actions, {
      attributes:true,
      attributeFilter:['hidden','aria-hidden','class','style']
    });

    window.addEventListener('andrik:country-focus-changed', event => {
      const focused = Boolean(event?.detail?.focused);
      focusedByEvent = focused;
      focusGraceUntil = focused ? Date.now() + 1200 : 0;
      schedule();
    });
    window.addEventListener('andrik:analytics-page-changed', schedule, {passive:true});
    window.addEventListener('resize', schedule, {passive:true});
    window.addEventListener('orientationchange', () => setTimeout(schedule, 100), {passive:true});
    window.addEventListener('pageshow', schedule, {passive:true});
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule();
    }, {passive:true});

    schedule();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();
