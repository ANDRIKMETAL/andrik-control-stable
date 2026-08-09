/* ANDRIK R354 — overlay is the only scroll owner; never resets scrollTop while open. */
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_SCROLL_R354__)return;
  window.__ANDRIK_COUNTRY_SCROLL_R354__=true;
  const bind=()=>{
    const overlay=document.querySelector('.country-scroll-overlay-r258');
    const list=document.getElementById('worldCountries');
    if(!overlay||!list||overlay.dataset.r354Bound==='1')return false;
    overlay.dataset.r354Bound='1';
    const active=()=>overlay.classList.contains('is-open')&&list.classList.contains('is-expanded')&&list.parentNode===overlay;
    // Capture before old map/list gesture code. Stop propagation only; do NOT preventDefault,
    // so Android performs native scrolling on the overlay.
    ['touchstart','touchmove','touchend','touchcancel','pointerdown','pointermove','pointerup','pointercancel'].forEach(type=>{
      overlay.addEventListener(type,e=>{
        if(!active())return;
        e.stopPropagation();
      },{capture:true,passive:true});
    });
    overlay.addEventListener('wheel',e=>{if(active())e.stopPropagation()},{capture:true,passive:true});
    return true;
  };
  const boot=()=>{if(bind())return;let n=0;const t=setInterval(()=>{if(bind()||++n>40)clearInterval(t)},50)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  addEventListener('pageshow',boot,{passive:true});
})();
