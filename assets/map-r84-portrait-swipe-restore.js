/* Control ANDRIK v55.00 FINAL STABLE R84 — PORTRAIT SWIPE RESTORE.
   The main swipe controller now accepts horizontal gestures on the portrait
   map page again. This marker also protects the static R83 header from
   accidental native image/text dragging without changing layout. */
(()=>{
  'use strict';
  if(window.__andrikR84PortraitSwipeRestoreReady)return;
  window.__andrikR84PortraitSwipeRestoreReady=true;

  const portrait=()=>window.matchMedia?.('(orientation:portrait)')?.matches===true;
  const pane=document.querySelector('.analytics-map-pane');
  const poster=pane?.querySelector('.r83-portrait-header-poster');

  function apply(){
    document.body.classList.toggle('r84-portrait-swipe-restored',portrait());
    if(poster){
      poster.setAttribute('draggable','false');
      poster.querySelectorAll('*').forEach(node=>node.setAttribute?.('draggable','false'));
    }
  }

  window.addEventListener('pageshow',apply,{passive:true});
  window.addEventListener('resize',apply,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(apply,120),{passive:true});
  apply();
})();
