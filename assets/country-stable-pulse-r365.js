(()=>{
  'use strict';
  if(window.__ANDRIK_STABLE_COUNTRY_PULSE_R365__) return;
  window.__ANDRIK_STABLE_COUNTRY_PULSE_R365__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  const kill=(el)=>{
    if(!el) return;
    el.querySelectorAll('animate').forEach(a=>a.remove());
  };

  const ensure=()=>{
    const overlay=map.querySelector('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active')) return;

    const anchor=svg.querySelector('.country-center-anchor-r358,.country-point-r352.is-empty');
    if(!anchor) return;

    // The yellow core never changes radius, opacity or brightness.
    kill(anchor);
    anchor.classList.remove(
      'country-native-pulse-r359',
      'country-native-pulse-r361',
      'country-r277-selected-orb-r364'
    );
    anchor.classList.add('country-stable-core-r365');
    anchor.style.setProperty('animation','none','important');
    anchor.setAttribute('r','20');
    anchor.setAttribute('opacity','1');

    // Hide all older central halos from R352/R358/R359/R361/R367.
    svg.querySelectorAll(
      '.country-center-anchor-halo-r358,.country-point-halo-r352,'+
      '.country-native-halo-r359,.country-native-halo-r361,'+
      '.country-r277-glow1-r364,.country-r277-glow2-r364'
    ).forEach(h=>{
      if(h.classList.contains('country-stable-halo-r365')) return;
      kill(h);
      h.style.setProperty('display','none','important');
    });

    let halo=svg.querySelector('.country-stable-halo-r365');
    if(!halo){
      halo=document.createElementNS(NS,'circle');
      halo.classList.add('country-stable-halo-r365');
      svg.insertBefore(halo,anchor);
    }

    const cx=anchor.getAttribute('cx')||'500';
    const cy=anchor.getAttribute('cy')||'300';
    halo.setAttribute('cx',cx);
    halo.setAttribute('cy',cy);
    halo.setAttribute('r','34');
    halo.setAttribute('opacity','.38');
    halo.style.setProperty('animation','none','important');
    kill(halo);

    // Smooth halo only. Constant opacity = no flicker/darkening.
    const a=document.createElementNS(NS,'animate');
    a.setAttribute('attributeName','r');
    a.setAttribute('values','34;74;34');
    a.setAttribute('dur','2.6s');
    a.setAttribute('repeatCount','indefinite');
    a.setAttribute('calcMode','spline');
    a.setAttribute('keyTimes','0;0.5;1');
    a.setAttribute('keySplines','.42 0 .58 1;.42 0 .58 1');
    halo.appendChild(a);
    try{a.beginElement();}catch(_){}

    if(halo.parentNode===svg) svg.insertBefore(halo,anchor);
    if(anchor.parentNode===svg) svg.appendChild(anchor);
  };

  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(ensure));
  };

  new MutationObserver(schedule).observe(map,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class','data-signature','data-layer','data-code']
  });
  ['andrik:country-deep-changed','andrik:country-focus-changed',
   'andrik:ecosystem-layer-changed','andrik:audience-data']
   .forEach(name=>window.addEventListener(name,schedule,{passive:true}));
  window.addEventListener('pageshow',schedule,{passive:true});
  schedule();
})();