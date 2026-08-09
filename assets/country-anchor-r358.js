(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_ANCHOR_R358__) return;
  window.__ANDRIK_COUNTRY_ANCHOR_R358__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  const ensure=()=>{
    const overlay=map.querySelector('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active')) return;

    let anchor=svg.querySelector('.country-center-anchor-r358');
    let halo=svg.querySelector('.country-center-anchor-halo-r358');

    // Если старый fallback уже есть — используем его как центральный anchor.
    const fallback=svg.querySelector('.country-point-r352.is-empty');
    const fallbackHalo=svg.querySelector('.country-point-halo-r352');

    let cx=500, cy=300;
    const shape=svg.querySelector('.country-shape-r352');
    if(shape){
      try{
        const b=shape.getBBox();
        if(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.width>0&&b.height>0){
          cx=b.x+b.width/2;
          cy=b.y+b.height/2;
        }
      }catch(_){}
    }

    if(fallback){
      fallback.classList.add('country-center-anchor-r358');
      fallback.setAttribute('cx',cx.toFixed(1));
      fallback.setAttribute('cy',cy.toFixed(1));
      anchor=fallback;
    }
    if(fallbackHalo){
      fallbackHalo.classList.add('country-center-anchor-halo-r358');
      fallbackHalo.setAttribute('cx',cx.toFixed(1));
      fallbackHalo.setAttribute('cy',cy.toFixed(1));
      halo=fallbackHalo;
    }

    if(!halo){
      halo=document.createElementNS(NS,'circle');
      halo.classList.add('country-center-anchor-halo-r358');
      halo.setAttribute('cx',cx.toFixed(1));
      halo.setAttribute('cy',cy.toFixed(1));
      halo.setAttribute('r','50');
      // Позади точки, но поверх контура.
      svg.appendChild(halo);
    }
    if(!anchor){
      anchor=document.createElementNS(NS,'circle');
      anchor.classList.add('country-center-anchor-r358');
      anchor.setAttribute('cx',cx.toFixed(1));
      anchor.setAttribute('cy',cy.toFixed(1));
      anchor.setAttribute('r','22');
      svg.appendChild(anchor);
    }

    // Маркер должен быть поверх обычных городских точек.
    if(halo.parentNode===svg) svg.appendChild(halo);
    if(anchor.parentNode===svg) svg.appendChild(anchor);
  };

  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(ensure));
  };

  new MutationObserver(schedule).observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-signature','data-layer']});
  window.addEventListener('andrik:country-deep-changed',schedule,{passive:true});
  window.addEventListener('andrik:country-focus-changed',schedule,{passive:true});
  window.addEventListener('andrik:ecosystem-layer-changed',schedule,{passive:true});
  window.addEventListener('andrik:audience-data',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  schedule();
})();