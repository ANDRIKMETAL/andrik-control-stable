/* Control ANDRIK v55.00 FINAL STABLE R86
   Keeps the landscape pane at one vertical position while only the map stage transforms. */
(()=>{
  'use strict';
  if(window.__andrikR86LandscapeStableReady)return;
  window.__andrikR86LandscapeStableReady=true;

  const pane=document.querySelector('.analytics-map-pane');
  const map=document.getElementById('worldMap');
  if(!pane||!map)return;
  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const onMapPage=()=>document.body.dataset.analyticsPage==='map';
  let raf=0,until=0,top=0;

  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;until=0}
  function tick(now){
    if(!isLandscape()||!onMapPage()||now>=until){stop();return}
    if(Math.abs((pane.scrollTop||0)-top)>.25)pane.scrollTop=top;
    raf=requestAnimationFrame(tick);
  }
  function lock(ms=760){
    if(!isLandscape()||!onMapPage())return;
    top=Math.max(0,pane.scrollTop||0);
    until=performance.now()+ms;
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(tick);
  }

  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('#worldMap .world-map-dot,#worldCountries .world-country-button,#worldCountries .world-country-selected-card,#landscapeCountryLabelR78'))lock(820);
  },true);
  window.addEventListener('andrik:country-focus-changed',()=>lock(820));
  map.addEventListener('transitionend',event=>{
    if(event.target?.classList?.contains('world-map-stage')&&event.propertyName==='transform')stop();
  });
  window.addEventListener('orientationchange',stop,{passive:true});
  window.addEventListener('andrik:analytics-page-changed',event=>{if(event?.detail?.page!=='map')stop()});
})();
