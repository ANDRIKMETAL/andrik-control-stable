(() => {
  'use strict';
  if (window.__andrikAnalyticsR249) return;
  window.__andrikAnalyticsR249 = true;

  const style = document.createElement('style');
  style.id = 'andrik-analytics-r249-final-fixes';
  style.textContent = `
    @media screen and (orientation:portrait){
      body.analytics-admin-page .analytics-map-pane #worldCountries.world-country-list{
        display:grid!important;
        max-height:min(43dvh,430px)!important;
        overflow-y:auto!important;
        overflow-x:hidden!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior-y:contain!important;
        touch-action:pan-y!important;
        scrollbar-gutter:stable!important;
        padding-bottom:18px!important;
      }
      body.analytics-admin-page .analytics-map-pane #worldCountries.world-country-list .world-country-button,
      body.analytics-admin-page .analytics-map-pane #worldCountries.world-country-list .world-country-toggle{
        touch-action:pan-y!important;
      }
      body.analytics-admin-page .analytics-map-pane #worldCountries.world-country-list::-webkit-scrollbar{width:5px!important}
      body.analytics-admin-page .analytics-map-pane #worldCountries.world-country-list::-webkit-scrollbar-thumb{background:rgba(92,224,185,.72)!important;border-radius:999px!important}
      body.analytics-admin-page.andrik-country-list-open-r249 .analytics-map-pane{
        overflow-y:auto!important;
        overflow-x:hidden!important;
        -webkit-overflow-scrolling:touch!important;
        overscroll-behavior-y:contain!important;
      }
      body.analytics-admin-page.andrik-country-list-open-r249 .analytics-map-pane>.analytics-pane-wrap.analytics-map-pane-wrap{
        height:auto!important;
        min-height:100dvh!important;
        overflow:visible!important;
        padding-bottom:calc(92px + env(safe-area-inset-bottom))!important;
      }
      body.analytics-admin-page.andrik-country-list-open-r249 .analytics-map-pane .analytics-map-top{
        overflow:visible!important;
      }
      body.analytics-admin-page.andrik-country-list-open-r249 .analytics-map-pane #worldCountries.world-country-list{
        height:auto!important;
        max-height:none!important;
        overflow:visible!important;
      }
      body.analytics-admin-page .analytics-map-pane #mapFocusActions.map-focus-actions{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:8px!important;
        margin:8px 0 2px!important;
        width:100%!important;
      }
      body.analytics-admin-page .analytics-map-pane #mapFocusActions.map-focus-actions .map-focus-action{
        width:100%!important;
        min-width:0!important;
        height:68px!important;
        min-height:68px!important;
        max-height:68px!important;
        padding:8px 10px!important;
        border-radius:18px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        text-align:center!important;
        line-height:1.12!important;
        font-size:clamp(.82rem,3.4vw,.98rem)!important;
      }
    }
    body #mapMonthlyModal:not([hidden]) .map-monthly-panel{
      position:relative!important;
      padding-bottom:76px!important;
    }
    body #mapMonthlyModal:not([hidden]) .map-monthly-panel #mapMonthlyClose{
      position:absolute!important;
      top:auto!important;
      left:auto!important;
      right:14px!important;
      bottom:12px!important;
      width:54px!important;
      height:54px!important;
      min-width:54px!important;
      min-height:54px!important;
      margin:0!important;
      z-index:80!important;
      transform:none!important;
    }
  `;
  document.head.appendChild(style);

  const list = document.getElementById('worldCountries');
  if (list) {
    list.setAttribute('tabindex', '0');
    list.setAttribute('aria-label', 'Список стран. Проведите вверх или вниз для прокрутки.');
    const keepLocalScroll = event => {
      if (event.target?.closest?.('#worldCountries')) event.stopPropagation();
    };
    ['pointerdown','pointermove','pointerup','touchstart','touchmove','touchend','wheel'].forEach(type => {
      list.addEventListener(type, keepLocalScroll, {capture:true, passive:true});
    });
  }

  const syncCountryListMode = () => {
    if (!list) return;
    const toggle = list.querySelector('.world-country-toggle');
    const open = /скрыть/i.test(String(toggle?.textContent || '')) || list.querySelectorAll('.world-country-button').length > 8;
    document.body.classList.toggle('andrik-country-list-open-r249', open);
  };
  if (list) new MutationObserver(syncCountryListMode).observe(list, {subtree:true, childList:true, characterData:true});

  const isLandscape = () => matchMedia('(orientation:landscape)').matches || innerWidth > innerHeight;
  const rotate = document.getElementById('mapOrientationFab');
  let rotationBusy = false;
  const enterLandscape = async event => {
    event?.preventDefault?.(); event?.stopPropagation?.();
    if (rotationBusy) return;
    rotationBusy = true;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({navigationUI:'hide'}).catch(() => null);
      }
      if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => null);
      document.body.classList.add('andrik-r249-landscape-requested');
    } finally { setTimeout(() => { rotationBusy = false; }, 500); }
  };
  const returnPortrait = async event => {
    event?.preventDefault?.(); event?.stopPropagation?.();
    if (rotationBusy) return;
    rotationBusy = true;
    try {
      if (screen.orientation?.lock) await screen.orientation.lock('portrait').catch(() => null);
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen().catch(() => null);
      document.body.classList.remove('andrik-r249-landscape-requested');
    } finally { setTimeout(() => { rotationBusy = false; }, 500); }
  };
  if (rotate) {
    rotate.addEventListener('click', event => isLandscape() ? returnPortrait(event) : enterLandscape(event), {capture:true});
  }

  const pane = document.querySelector('.analytics-map-pane');
  const worldMap = document.getElementById('worldMap');
  let swipe = null;
  const startSwipe = event => {
    if (!isLandscape() || !worldMap) return;
    const point = event.touches?.[0] || event;
    const rect = worldMap.getBoundingClientRect();
    if (point.clientY < rect.bottom - 100) return;
    swipe = {x:point.clientX,y:point.clientY,id:point.identifier ?? event.pointerId ?? null};
  };
  const endSwipe = event => {
    if (!swipe) return;
    const point = event.changedTouches?.[0] || event;
    const dy = point.clientY - swipe.y;
    const dx = point.clientX - swipe.x;
    swipe = null;
    if (Math.abs(dy) >= 56 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      location.assign(`/control-home.html?page=menu&source=map-r249-swipe&t=${Date.now()}`);
    }
  };
  pane?.addEventListener('touchstart', startSwipe, {passive:true, capture:true});
  pane?.addEventListener('touchend', endSwipe, {passive:true, capture:true});
  pane?.addEventListener('pointerdown', startSwipe, {passive:true, capture:true});
  pane?.addEventListener('pointerup', endSwipe, {passive:true, capture:true});

  const sync = () => {
    if (list) {
      list.style.setProperty('overflow-y', 'auto', 'important');
      list.style.setProperty('touch-action', 'pan-y', 'important');
      syncCountryListMode();
    }
    const close = document.getElementById('mapMonthlyClose');
    if (close) close.textContent = '×';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, {once:true}); else sync();
  window.addEventListener('pageshow', sync, {passive:true});
  window.addEventListener('orientationchange', () => setTimeout(sync, 180), {passive:true});
})();
