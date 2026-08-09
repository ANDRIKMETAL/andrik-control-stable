
/* FINAL R66 SINGLE NATIVE MAP SCROLL RUNTIME — no preventDefault, no synthetic rail. */
(()=>{
  'use strict';
  if(window.__andrikR66SingleNativeScrollReady)return;
  window.__andrikR66SingleNativeScrollReady=true;

  const pane=document.querySelector('.analytics-map-pane');
  const map=document.getElementById('worldMap');
  if(!pane||!map)return;
  const isLandscape=()=>window.matchMedia?.('(orientation: landscape)')?.matches===true;
  let raf=0;

  function removeSyntheticRails(){
    document.querySelectorAll('#landscapeMapScrollbarR65,#landscapeMapScrollbarR66').forEach(node=>node.remove());
  }

  function decorateAudienceDots(){
    if(!isLandscape())return;
    map.querySelectorAll('.world-map-dot').forEach(dot=>{
      const power=parseFloat(dot.style.getPropertyValue('--power'))||.5;
      const audience=Math.max(0,Math.min(1,(power-.5)*2));
      dot.style.setProperty('--r66-scale-min',(.90+audience*.10).toFixed(3));
      dot.style.setProperty('--r66-scale-max',(1.08+audience*.18).toFixed(3));
      dot.style.setProperty('--r66-opacity',(.70+audience*.30).toFixed(3));
      dot.style.setProperty('--r66-dot-opacity',(.56+audience*.44).toFixed(3));
      dot.style.setProperty('--r66-halo-min',`${(3+audience*5).toFixed(1)}px`);
      dot.style.setProperty('--r66-halo-max',`${(5+audience*7).toFixed(1)}px`);
      dot.style.setProperty('--r66-glow-min',`${(14+audience*24).toFixed(1)}px`);
      dot.style.setProperty('--r66-glow-max',`${(21+audience*34).toFixed(1)}px`);
      dot.style.setProperty('--r66-halo-alpha',(.05+audience*.09).toFixed(3));
      dot.style.setProperty('--r66-halo-alpha-max',(.03+audience*.06).toFixed(3));
      dot.style.setProperty('--r66-glow-alpha',(.56+audience*.36).toFixed(3));
      dot.style.setProperty('--r66-glow-alpha-max',(.60+audience*.38).toFixed(3));
      dot.style.setProperty('--r66-brightness',(.92+audience*.28).toFixed(3));
      dot.style.setProperty('--r66-saturation',(1+audience*.16).toFixed(3));
    });
  }

  function normalize(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      removeSyntheticRails();
      decorateAudienceDots();
      if(isLandscape()){
        pane.style.removeProperty('scroll-behavior');
        const max=Math.max(0,pane.scrollHeight-pane.clientHeight);
        if(pane.scrollTop>max)pane.scrollTop=max;
      }
    });
  }

  const observer=new MutationObserver(normalize);
  observer.observe(map,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  observer.observe(document.body,{childList:true,subtree:false});
  window.addEventListener('resize',normalize,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(normalize,140),{passive:true});
  window.addEventListener('pageshow',normalize,{passive:true});
  window.addEventListener('andrik:analytics-page-changed',normalize);

  normalize();
  setTimeout(normalize,300);
  setTimeout(normalize,1000);
})();
