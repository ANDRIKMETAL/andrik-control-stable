(()=>{
  'use strict';
  if(window.__ANDRIK_R277_YELLOW_PULSE_R364__) return;
  window.__ANDRIK_R277_YELLOW_PULSE_R364__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  function anim(el, key, attr, values, dur='1.28s'){
    let a=el.querySelector(`animate[data-r364="${key}"]`);
    if(!a){
      a=document.createElementNS(NS,'animate');
      a.dataset.r364=key;
      a.setAttribute('attributeName',attr);
      a.setAttribute('repeatCount','indefinite');
      a.setAttribute('calcMode','spline');
      a.setAttribute('keyTimes','0;0.5;1');
      a.setAttribute('keySplines','.42 0 .58 1;.42 0 .58 1');
      el.appendChild(a);
    }
    a.setAttribute('values',values);
    a.setAttribute('dur',dur);
    try{a.beginElement();}catch(_){}
  }

  function removeOld(el){
    if(!el) return;
    el.querySelectorAll('animate[data-r359],animate[data-r361],animate[data-r364]').forEach(a=>a.remove());
  }

  function ensure(){
    const overlay=map.querySelector('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active')) return;

    const anchor=svg.querySelector('.country-center-anchor-r358,.country-point-r352.is-empty');
    if(!anchor) return;

    // Remove R359/R368 pulse from this center before applying the R277 behavior.
    removeOld(anchor);
    anchor.classList.remove('country-native-pulse-r359','country-native-pulse-r361');
    anchor.classList.add('country-r277-selected-orb-r364');
    anchor.style.setProperty('animation','none','important');
    anchor.setAttribute('r','18');
    anchor.setAttribute('opacity','1');

    // Retire the R368 halo only for this central point.
    svg.querySelectorAll('.country-center-anchor-halo-r358,.country-point-halo-r352,.country-native-halo-r359,.country-native-halo-r361')
      .forEach(h=>{
        removeOld(h);
        h.style.setProperty('display','none','important');
      });

    let glow1=svg.querySelector('.country-r277-glow1-r364');
    let glow2=svg.querySelector('.country-r277-glow2-r364');
    const cx=anchor.getAttribute('cx')||'500';
    const cy=anchor.getAttribute('cy')||'300';

    if(!glow2){
      glow2=document.createElementNS(NS,'circle');
      glow2.classList.add('country-r277-glow2-r364');
      svg.insertBefore(glow2,anchor);
    }
    if(!glow1){
      glow1=document.createElementNS(NS,'circle');
      glow1.classList.add('country-r277-glow1-r364');
      svg.insertBefore(glow1,anchor);
    }

    for(const g of [glow1,glow2]){
      g.setAttribute('cx',cx);
      g.setAttribute('cy',cy);
      g.style.setProperty('animation','none','important');
      g.style.setProperty('pointer-events','none','important');
    }

    removeOld(glow1);
    removeOld(glow2);

    // R277 selected orb: scale ~1.28 -> 1.68, adapted to radii.
    anim(anchor,'core-r','r','20;27;20','1.28s');
    anim(glow1,'inner-r','r','29;43;29','1.28s');
    anim(glow1,'inner-o','opacity','.66;.96;.66','1.28s');
    anim(glow2,'outer-r','r','44;66;44','1.28s');
    anim(glow2,'outer-o','opacity','.30;.58;.30','1.28s');

    // Keep glow behind the yellow core.
    if(glow2.parentNode===svg) svg.insertBefore(glow2,anchor);
    if(glow1.parentNode===svg) svg.insertBefore(glow1,anchor);
    if(anchor.parentNode===svg) svg.appendChild(anchor);
  }

  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(ensure));
  };

  new MutationObserver(schedule).observe(map,{
    subtree:true,childList:true,attributes:true,
    attributeFilter:['class','data-signature','data-layer']
  });
  ['andrik:country-deep-changed','andrik:country-focus-changed','andrik:ecosystem-layer-changed','andrik:audience-data']
    .forEach(name=>window.addEventListener(name,schedule,{passive:true}));
  window.addEventListener('pageshow',schedule,{passive:true});
  schedule();
})();