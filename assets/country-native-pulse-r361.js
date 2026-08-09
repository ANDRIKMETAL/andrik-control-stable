(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_NATIVE_PULSE_R361__) return;
  window.__ANDRIK_COUNTRY_NATIVE_PULSE_R361__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  const addAnimate=(el,attr,values,dur,keyTimes='0;0.5;1')=>{
    let a=el.querySelector(`animate[data-r361="${attr}"]`);
    if(!a){
      a=document.createElementNS(NS,'animate');
      a.dataset.r361=attr;
      a.setAttribute('attributeName',attr);
      a.setAttribute('repeatCount','indefinite');
      a.setAttribute('calcMode','spline');
      a.setAttribute('keySplines','.4 0 .2 1;.4 0 .2 1');
      el.appendChild(a);
    }
    a.setAttribute('values',values);
    a.setAttribute('dur',dur);
    a.setAttribute('keyTimes',keyTimes);
    try{ a.beginElement(); }catch(_){}
  };

  const removeOldNativeAnimations=(el)=>{
    el.querySelectorAll('animate[data-r359]').forEach(a=>a.remove());
  };

  const ensure=()=>{
    const overlay=map.querySelector('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active')) return;

    const anchor=svg.querySelector('.country-center-anchor-r358,.country-point-r352.is-empty');
    let halo=svg.querySelector('.country-center-anchor-halo-r358,.country-point-halo-r352');
    if(!anchor) return;

    removeOldNativeAnimations(anchor);
    anchor.classList.remove('country-native-pulse-r359');
    anchor.classList.add('country-native-pulse-r361');
    anchor.style.setProperty('animation','none','important');
    anchor.style.setProperty('fill','#ffd900','important');
    anchor.style.setProperty('stroke','rgba(255,247,165,.82)','important');
    anchor.style.setProperty('stroke-width','2.6','important');
    anchor.setAttribute('r','17');

    if(!halo){
      halo=document.createElementNS(NS,'circle');
      halo.classList.add('country-center-anchor-halo-r358');
      halo.setAttribute('cx',anchor.getAttribute('cx')||'500');
      halo.setAttribute('cy',anchor.getAttribute('cy')||'300');
      svg.insertBefore(halo,anchor);
    }

    removeOldNativeAnimations(halo);
    halo.classList.remove('country-native-halo-r359');
    halo.classList.add('country-native-halo-r361');
    halo.style.setProperty('animation','none','important');
    halo.style.setProperty('fill','rgba(255,215,0,.08)','important');
    halo.style.setProperty('stroke','rgba(255,223,60,.42)','important');
    halo.style.setProperty('stroke-width','2','important');
    halo.setAttribute('cx',anchor.getAttribute('cx')||'500');
    halo.setAttribute('cy',anchor.getAttribute('cy')||'300');
    halo.setAttribute('r','30');

    // Calm breathing pulse: small center movement, wide soft halo.
    addAnimate(anchor,'r','17;23;17','2.45s');
    addAnimate(anchor,'opacity','.88;1;.88','2.45s');
    addAnimate(halo,'r','30;88;30','2.45s');
    addAnimate(halo,'opacity','.30;.015;.30','2.45s');

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