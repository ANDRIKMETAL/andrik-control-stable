/* Control ANDRIK v55.00 FINAL STABLE R85 — mobile standalone viewport fit. */
(()=>{
  'use strict';
  if(window.__andrikR85PlayerViewportFitReady)return;
  window.__andrikR85PlayerViewportFitReady=true;

  const root=document.documentElement;
  let raf=0;

  function apply(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const height=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||0));
      root.style.setProperty('--r85-player-vh',`${height}px`);
      root.classList.toggle(
        'r85-player-fit',
        document.body.classList.contains('standalone-player')&&window.matchMedia('(max-width:860px)').matches
      );
      if(root.classList.contains('r85-player-fit')){
        document.scrollingElement?.scrollTo?.(0,0);
        window.scrollTo?.(0,0);
      }
    });
  }

  new MutationObserver(apply).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.visualViewport?.addEventListener('resize',apply,{passive:true});
  window.addEventListener('resize',apply,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(apply,120),{passive:true});
  window.addEventListener('pageshow',apply,{passive:true});
  apply();
})();
