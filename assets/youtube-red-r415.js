/* ANDRIK R415 — final smooth YouTube red marker controller. */
(()=>{
  'use strict';
  if(window.__ANDRIK_YOUTUBE_RED_R415__) return;
  window.__ANDRIK_YOUTUBE_RED_R415__=true;

  const map=document.getElementById('worldMap');
  if(!map) return;

  const isYoutube=()=>{
    const data=String(map.dataset.ecosystemLayer||'').toLowerCase();
    const active=map.querySelector('.ecosystem-layer-switcher [data-ecosystem-layer="youtube"].is-active');
    const period=String(document.getElementById('worldMapPeriodR246')?.textContent||document.getElementById('worldMapPeriod')?.textContent||'').toLowerCase();
    return data==='youtube' || !!active || period.includes('youtube');
  };

  const paint=()=>{
    const youtube=isYoutube();
    map.classList.toggle('is-youtube-red-r415',youtube);
    const dots=map.querySelectorAll('.world-map-dot i,.world-map-city-dot i');
    dots.forEach((node,index)=>{
      if(youtube){
        node.style.setProperty('background',index%3===0?'#ff7182':'#ff5f75','important');
        node.style.setProperty('border-color','rgba(255,220,226,.88)','important');
        // Keep glow static. Animating shadow on 30+ markers forces repaints and caused jerky motion on Android.
        node.style.setProperty('box-shadow','0 0 0 5px rgba(255,86,111,.13),0 0 21px rgba(255,66,94,.90),0 0 35px rgba(255,40,78,.38)','important');
        node.style.setProperty('filter','none','important');
        node.style.setProperty('animation','andrikYoutubeRedPulseR415 2.9s cubic-bezier(.45,0,.55,1) infinite','important');
        node.style.setProperty('animation-delay',`${-((index%3)*.97).toFixed(2)}s`,'important');
        node.style.setProperty('will-change','transform, opacity','important');
        node.dataset.youtubeRedR415='1';
      }else if(node.dataset.youtubeRedR415==='1'){
        ['background','border-color','box-shadow','filter','animation','animation-delay','will-change'].forEach(prop=>node.style.removeProperty(prop));
        delete node.dataset.youtubeRedR415;
      }
    });
  };

  let raf=0;
  const schedule=()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{raf=0;paint()});
  };

  window.addEventListener('andrik:ecosystem-layer-changed',schedule,{passive:true});
  map.addEventListener('click',e=>{if(e.target.closest?.('[data-ecosystem-layer]'))setTimeout(schedule,0)},true);
  new MutationObserver(schedule).observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ecosystem-layer','class']});
  schedule();
})();
