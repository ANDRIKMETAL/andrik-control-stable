(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_PULSE_R368__) return;
  window.__ANDRIK_COUNTRY_PULSE_R368__=true;
  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;
  const kill=el=>{if(el)el.querySelectorAll('animate').forEach(a=>a.remove())};
  const makeAnim=(el,attr,values,dur,begin='0s')=>{
    const a=document.createElementNS(NS,'animate');
    a.setAttribute('attributeName',attr);a.setAttribute('values',values);a.setAttribute('dur',dur);
    a.setAttribute('begin',begin);a.setAttribute('repeatCount','indefinite');a.setAttribute('calcMode','spline');
    a.setAttribute('keyTimes','0;0.72;1');a.setAttribute('keySplines','.16 1 .3 1;.4 0 .6 1');el.appendChild(a);
    try{a.beginElement()}catch(_){}
  };
  const ensure=()=>{
    const overlay=map.querySelector('.country-map-r352'); const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active'))return;
    if(svg.dataset.pulseR368Signature===overlay.dataset.signature)return;
    svg.dataset.pulseR368Signature=overlay.dataset.signature||String(Date.now());
    const anchor=svg.querySelector('.country-center-anchor-r358,.country-point-r352.is-empty'); if(!anchor)return;
    kill(anchor);anchor.classList.remove('country-native-pulse-r359','country-native-pulse-r361','country-r277-selected-orb-r364','country-stable-core-r365');
    anchor.classList.add('country-core-r368');anchor.style.setProperty('animation','none','important');anchor.setAttribute('r','21');anchor.setAttribute('opacity','1');
    svg.querySelectorAll('.country-center-anchor-halo-r358,.country-point-halo-r352,.country-native-halo-r359,.country-native-halo-r361,.country-r277-glow1-r364,.country-r277-glow2-r364,.country-stable-halo-r365,.country-halo-r368').forEach(h=>{if(h.classList.contains('country-halo-r368'))h.remove();else{kill(h);h.style.setProperty('display','none','important')}});
    const cx=anchor.getAttribute('cx')||'500', cy=anchor.getAttribute('cy')||'300';
    for(const [cls,begin] of [['country-halo-r368-a','0s'],['country-halo-r368-b','-1.4s']]){
      const halo=document.createElementNS(NS,'circle');halo.classList.add('country-halo-r368',cls);halo.setAttribute('cx',cx);halo.setAttribute('cy',cy);halo.setAttribute('r','30');halo.setAttribute('opacity','.72');svg.insertBefore(halo,anchor);
      makeAnim(halo,'r','30;104;112','2.8s',begin);makeAnim(halo,'opacity','.72;.14;0','2.8s',begin);
    }
    svg.appendChild(anchor);
  };
  let raf=0;const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>requestAnimationFrame(ensure))};
  new MutationObserver(schedule).observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-signature','data-layer','data-code']});
  ['andrik:country-deep-changed','andrik:country-focus-changed','andrik:ecosystem-layer-changed','andrik:audience-data'].forEach(n=>window.addEventListener(n,schedule,{passive:true}));
  window.addEventListener('pageshow',schedule,{passive:true});schedule();
})();