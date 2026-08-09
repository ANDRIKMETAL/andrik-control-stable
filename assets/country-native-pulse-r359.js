(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_NATIVE_PULSE_R359__) return;
  window.__ANDRIK_COUNTRY_NATIVE_PULSE_R359__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  const addAnimate=(el,attr,values,dur,keyTimes)=>{
    let a=el.querySelector(`animate[data-r359="${attr}"]`);
    if(!a){
      a=document.createElementNS(NS,'animate');
      a.dataset.r359=attr;
      a.setAttribute('attributeName',attr);
      a.setAttribute('repeatCount','indefinite');
      a.setAttribute('calcMode','spline');
      a.setAttribute('keySplines','.42 0 .58 1;.42 0 .58 1');
      el.appendChild(a);
    }
    a.setAttribute('values',values);
    a.setAttribute('dur',dur);
    a.setAttribute('keyTimes',keyTimes||'0;0.5;1');
    try{ a.beginElement(); }catch(_){}
  };

  const ensure=()=>{
    const overlay=map.querySelector('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active')) return;

    const anchor=svg.querySelector('.country-center-anchor-r358,.country-point-r352.is-empty');
    let halo=svg.querySelector('.country-center-anchor-halo-r358,.country-point-halo-r352');
    if(!anchor) return;

    anchor.classList.add('country-native-pulse-r359');
    anchor.style.setProperty('animation','none','important');
    anchor.style.setProperty('fill','#ffe600','important');
    anchor.style.setProperty('stroke','#fffbd0','important');
    anchor.style.setProperty('stroke-width','4','important');
    anchor.setAttribute('r','17');

    if(!halo){
      halo=document.createElementNS(NS,'circle');
      halo.classList.add('country-center-anchor-halo-r358','country-native-halo-r359');
      halo.setAttribute('cx',anchor.getAttribute('cx')||'500');
      halo.setAttribute('cy',anchor.getAttribute('cy')||'300');
      svg.insertBefore(halo,anchor);
    }else{
      halo.classList.add('country-native-halo-r359');
    }

    halo.style.setProperty('animation','none','important');
    halo.style.setProperty('fill','rgba(255,225,0,.16)','important');
    halo.style.setProperty('stroke','rgba(255,239,92,.95)','important');
    halo.style.setProperty('stroke-width','3','important');
    halo.setAttribute('cx',anchor.getAttribute('cx')||'500');
    halo.setAttribute('cy',anchor.getAttribute('cy')||'300');
    halo.setAttribute('r','26');

    // Native SVG/SMIL pulse: independent from CSS animation / reduced-motion.
    addAnimate(anchor,'r','17;28;17','.92s');
    addAnimate(anchor,'opacity','.78;1;.78','.92s');
    addAnimate(halo,'r','26;68;26','.92s');
    addAnimate(halo,'opacity','.58;.03;.58','.92s');

    // Keep anchor and halo visually above the country silhouette / city points.
    if(halo.parentNode===svg) svg.appendChild(halo);
    if(anchor.parentNode===svg) svg.appendChild(anchor);
  };

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