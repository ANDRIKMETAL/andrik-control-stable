/* Control ANDRIK R292 — latched country focus: buttons never disappear during map re-render. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_PORTAL_R292__) return;
  window.__ANDRIK_COUNTRY_PORTAL_R292__ = true;

  const portrait = () => window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight >= window.innerWidth;

  let actions = null;
  let pane = null;
  let marker = null;
  let originalParent = null;
  let originalNext = null;
  let scheduled = false;
  let focusLatched = false;

  const hasSelectedCountry = () => Boolean(
    document.querySelector('#worldCountries .world-country-button.is-selected') ||
    document.querySelector('.analytics-map-top.has-country-focus,.world-map-card.has-country-focus') ||
    String(document.getElementById('worldMap')?.dataset?.focusCountry || '').trim()
  );

  const onMapPage = () => document.body.dataset.analyticsPage === 'map';
  const active = () => Boolean(portrait() && onMapPage() && focusLatched);

  function removeLegacy() {
    ['r283CountryBottomFill','r284CountryBottomFill','r285CountryBottomFill','r286CountryBottomFill',
     'r287CountryBottomFill','r288CountryBottomFill','r289CountryBottomFill','r290CountryBottomFill']
      .forEach(id => document.getElementById(id)?.remove());
    document.body.classList.remove(
      'r283-country-actions-active','r284-country-actions-active','r285-country-actions-active','r286-country-actions-active',
      'r287-country-actions-active','r288-country-actions-active','r289-country-actions-active',
      'r283-country-scroll-locked','r284-country-scroll-locked','r285-country-scroll-locked','r286-country-scroll-locked',
      'r287-country-scroll-locked','r288-country-scroll-locked','r289-country-scroll-locked'
    );
    document.querySelectorAll('#mapFocusActions').forEach(node => node.classList.remove(
      'r283-country-actions-portal','r284-country-actions-portal','r285-country-actions-portal','r286-country-actions-portal',
      'r287-country-actions-portal','r288-country-actions-portal','r289-country-actions-portal'
    ));
  }

  function remember() {
    actions ||= document.getElementById('mapFocusActions');
    pane ||= document.querySelector('.analytics-map-pane');
    if (!actions || marker) return Boolean(actions);
    originalParent = actions.parentNode;
    originalNext = actions.nextSibling;
    marker = document.createComment('andrik-r290-map-actions-home');
    originalParent?.insertBefore(marker, originalNext);
    return true;
  }

  function forceMainMapSize() {
    const map = document.getElementById('worldMap');
    if (!map) return;
    if (active()) {
      map.style.setProperty('height','clamp(282px, 33dvh, 326px)','important');
      map.style.setProperty('min-height','282px','important');
      map.style.setProperty('max-height','326px','important');
    } else {
      map.style.removeProperty('height');
      map.style.removeProperty('min-height');
      map.style.removeProperty('max-height');
    }
  }

  function restore() {
    if (!actions || !originalParent) return;
    actions.classList.remove('r290-country-actions-portal');
    document.body.classList.remove('r290-country-actions-active','r290-country-scroll-locked');
    forceMainMapSize();
    if (actions.parentNode !== originalParent) {
      if (marker?.parentNode === originalParent) originalParent.insertBefore(actions, marker);
      else if (originalNext?.parentNode === originalParent) originalParent.insertBefore(actions, originalNext);
      else originalParent.appendChild(actions);
    }
    actions.hidden = true;
    actions.setAttribute('aria-hidden','true');
  }

  function apply() {
    scheduled = false;
    removeLegacy();
    if (!remember()) return;

    /* DOM redraws temporarily remove the selected button. Do not treat that as deselection.
       Only the explicit country-focus event is allowed to unlatch the controls. */
    if (!focusLatched && hasSelectedCountry()) focusLatched = true;

    if (!active()) {
      restore();
      return;
    }

    document.body.classList.add('is-country-focus-active','r290-country-actions-active','r290-country-scroll-locked');
    if (actions.parentNode !== document.body) document.body.appendChild(actions);
    actions.hidden = false;
    if (actions.getAttribute('aria-hidden') !== 'false') actions.setAttribute('aria-hidden','false');
    actions.classList.add('r290-country-actions-portal');
    forceMainMapSize();
    if (pane) {
      pane.scrollTop = 0;
      pane.scrollLeft = 0;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function stopOldScroll(event) {
    if (!active()) return;
    if (event.target?.closest?.('a,button,input,select,textarea,label,[role="button"]')) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function start() {
    removeLegacy();
    remember();
    focusLatched = hasSelectedCountry() || document.body.classList.contains('is-country-focus-active');

    pane?.addEventListener('touchmove', stopOldScroll, { passive:false, capture:true });
    pane?.addEventListener('wheel', stopOldScroll, { passive:false, capture:true });

    window.addEventListener('andrik:country-focus-changed', event => {
      focusLatched = Boolean(event?.detail?.focused);
      schedule();
    });
    window.addEventListener('andrik:analytics-page-changed', schedule, { passive:true });
    window.addEventListener('resize', schedule, { passive:true });
    window.addEventListener('orientationchange', () => setTimeout(schedule,120), { passive:true });
    window.addEventListener('pageshow', () => {
      if (hasSelectedCountry()) focusLatched = true;
      schedule();
    }, { passive:true });

    const observer = new MutationObserver(schedule);
    observer.observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});
    const list = document.getElementById('worldCountries');
    if (list) observer.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
    if (actions) observer.observe(actions,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});

    /* Cheap safety watchdog: only corrects the two controls while a country is selected. */
    setInterval(() => { if (!document.hidden && focusLatched && onMapPage()) schedule(); }, 1000);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
