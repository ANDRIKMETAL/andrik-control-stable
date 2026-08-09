/* ANDRIK R351 — country list owns vertical gestures while expanded. */
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_SCROLL_R351__)return;
  window.__ANDRIK_COUNTRY_SCROLL_R351__=true;
  const boot=()=>{
    const list=document.getElementById('worldCountries');
    if(!list)return;
    const overlay=()=>list.closest('.country-scroll-overlay-r258');
    const active=()=>list.classList.contains('is-expanded')&&overlay()?.classList.contains('is-open');
    let startY=0,startScroll=0,drag=false;
    list.addEventListener('touchstart',e=>{
      if(!active()||e.touches.length!==1)return;
      startY=e.touches[0].clientY;
      startScroll=list.scrollTop;
      drag=true;
      e.stopPropagation();
    },{capture:true,passive:true});
    list.addEventListener('touchmove',e=>{
      if(!drag||!active()||e.touches.length!==1)return;
      const dy=e.touches[0].clientY-startY;
      const max=Math.max(0,list.scrollHeight-list.clientHeight);
      list.scrollTop=Math.max(0,Math.min(max,startScroll-dy));
      e.preventDefault();
      e.stopPropagation();
    },{capture:true,passive:false});
    const end=e=>{if(!drag)return;drag=false;e.stopPropagation();};
    list.addEventListener('touchend',end,{capture:true,passive:true});
    list.addEventListener('touchcancel',end,{capture:true,passive:true});
    ['pointerdown','pointermove','pointerup','wheel'].forEach(type=>list.addEventListener(type,e=>{
      if(active())e.stopPropagation();
    },{capture:true,passive:type!=='wheel'}));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  addEventListener('pageshow',boot,{passive:true});
})();
