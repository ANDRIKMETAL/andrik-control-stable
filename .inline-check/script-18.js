
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_OVERLAY_R258__)return;
  window.__ANDRIK_COUNTRY_OVERLAY_R258__=true;
  const boot=()=>{
    const list=document.getElementById('worldCountries');
    if(!list||list.dataset.r258OverlayBound==='1')return;
    list.dataset.r258OverlayBound='1';
    const home=document.createComment('worldCountries-r258-home');
    list.parentNode.insertBefore(home,list);
    const overlay=document.createElement('section');
    overlay.className='country-scroll-overlay-r258';
    overlay.setAttribute('aria-label','Полный список стран');
    document.body.appendChild(overlay);
    const open=()=>{
      if(list.parentNode!==overlay)overlay.appendChild(list);
      overlay.classList.add('is-open');
      document.body.classList.add('andrik-country-overlay-r258-open');
      requestAnimationFrame(()=>{list.scrollTop=0;});
    };
    const close=()=>{
      overlay.classList.remove('is-open');
      document.body.classList.remove('andrik-country-overlay-r258-open');
      if(home.parentNode)home.parentNode.insertBefore(list,home.nextSibling);
      list.scrollTop=0;
    };
    const sync=()=>{
      const expanded=list.classList.contains('is-expanded');
      if(expanded)open();else close();
    };
    // The list already owns its own touch scrolling. Stop every outer map/swipe gesture at the overlay boundary.
    ['touchstart','touchmove','touchend','pointerdown','pointermove','pointerup','wheel'].forEach(type=>{
      overlay.addEventListener(type,e=>{
        if(!overlay.classList.contains('is-open'))return;
        e.stopPropagation();
      },{capture:false,passive:true});
    });
    new MutationObserver(sync).observe(list,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&overlay.classList.contains('is-open')){
        list.querySelector('[data-country-toggle]')?.click();
      }
    });
    sync();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  addEventListener('pageshow',boot,{passive:true});
})();
