/* ANDRIK R355 — hard-bind YouTube visual identity after every map render. */
(()=>{
  'use strict';
  if(window.__ANDRIK_MAP_LAYER_COLOR_R355__)return;
  window.__ANDRIK_MAP_LAYER_COLOR_R355__=true;
  const map=document.getElementById('worldMap');
  if(!map)return;
  let raf=0;
  const isYoutube=()=>{
    const active=String(window.__andrikEcosystemActiveLayer||map.dataset.ecosystemLayer||'').toLowerCase();
    if(active==='youtube')return true;
    if(map.querySelector('[data-ecosystem-layer="youtube"].is-active,[data-ecosystem-layer="youtube"][aria-pressed="true"]'))return true;
    const period=String(document.getElementById('worldMapPeriodR246')?.textContent||'').trim().toLowerCase();
    return period.startsWith('youtube')||period.includes('youtube andrik');
  };
  const paint=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const yes=isYoutube();
      document.body.classList.toggle('r355-youtube-layer',yes);
      map.classList.toggle('is-youtube-layer-r355',yes);
      if(yes) map.dataset.ecosystemLayer='youtube';
      map.querySelectorAll('.world-map-dot i').forEach(i=>{
        if(yes){
          i.style.setProperty('background','#ff5f72','important');
          i.style.setProperty('border','1px solid rgba(255,221,226,.82)','important');
          i.style.setProperty('filter','none','important');
          i.style.setProperty('animation','andrikYoutubePulseR355Final 2.55s ease-in-out infinite','important');
        }else{
          i.style.removeProperty('background');
          i.style.removeProperty('border');
          i.style.removeProperty('filter');
          i.style.removeProperty('animation');
        }
      });
    });
  };
  window.addEventListener('andrik:ecosystem-layer-changed',paint,{passive:true});
  map.addEventListener('click',()=>setTimeout(paint,0),true);
  const mo=new MutationObserver(paint);
  mo.observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-ecosystem-layer','aria-pressed']});
  document.addEventListener('DOMContentLoaded',paint,{once:true});
  addEventListener('pageshow',paint,{passive:true});
  paint();
})();
