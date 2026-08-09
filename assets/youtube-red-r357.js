(()=>{
  'use strict';
  if(window.__ANDRIK_YOUTUBE_RED_R357__) return;
  window.__ANDRIK_YOUTUBE_RED_R357__=true;

  const map=document.getElementById('worldMap');
  if(!map) return;

  const isYoutube=()=>{
    const data=String(map.dataset.ecosystemLayer||'').toLowerCase();
    const active=map.querySelector('.ecosystem-layer-switcher [data-ecosystem-layer="youtube"].is-active');
    const period=String(document.getElementById('worldMapPeriodR246')?.textContent||'').toLowerCase();
    return data==='youtube' || !!active || period.includes('youtube');
  };

  const paint=()=>{
    const youtube=isYoutube();
    map.classList.toggle('is-youtube-red-r357',youtube);
    const dots=map.querySelectorAll('.world-map-dot i,.world-map-city-dot i');
    dots.forEach((node,index)=>{
      if(youtube){
        node.style.setProperty('background',index%3===0?'#ff7182':'#ff5f75','important');
        node.style.setProperty('border-color','rgba(255,220,226,.88)','important');
        node.style.setProperty(
          'box-shadow',
          '0 0 7px rgba(255,61,92,.56)',
          'important'
        );
        node.style.setProperty('filter','none','important');
        node.style.setProperty('animation','none','important');
        node.dataset.youtubeRedR357='1';
      }else if(node.dataset.youtubeRedR357==='1'){
        node.style.removeProperty('background');
        node.style.removeProperty('border-color');
        node.style.removeProperty('box-shadow');
        node.style.removeProperty('filter');
        node.style.removeProperty('animation');
        delete node.dataset.youtubeRedR357;
      }
    });
  };

  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(paint));
  };

  window.addEventListener('andrik:ecosystem-layer-changed',schedule,{passive:true});
  map.addEventListener('click',e=>{
    if(e.target.closest?.('[data-ecosystem-layer]')) setTimeout(schedule,0);
  },true);

  new MutationObserver(schedule).observe(map,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['data-ecosystem-layer','class']
  });

  schedule();
})();