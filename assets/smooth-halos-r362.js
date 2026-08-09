(()=>{
  'use strict';
  if(window.__ANDRIK_SMOOTH_HALOS_R362__) return;
  window.__ANDRIK_SMOOTH_HALOS_R362__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  const killAnimations=(el)=>{
    if(!el) return;
    el.querySelectorAll('animate').forEach(a=>a.remove());
  };

  const addWave=(parent,before,cx,cy,startR,endR,className,begin)=>{
    let wave=parent.querySelector('.'+className);
    if(!wave){
      wave=document.createElementNS(NS,'circle');
      wave.classList.add('andrik-smooth-wave-r362',className);
      parent.insertBefore(wave,before);
    }
    wave.setAttribute('cx',cx);
    wave.setAttribute('cy',cy);
    wave.setAttribute('r',String(startR));
    wave.setAttribute('opacity','0.22');

    if(wave.dataset.r362Bound==='1') return wave;
    wave.dataset.r362Bound='1';

    const r=document.createElementNS(NS,'animate');
    r.setAttribute('attributeName','r');
    r.setAttribute('from',String(startR));
    r.setAttribute('to',String(endR));
    r.setAttribute('dur','4.8s');
    r.setAttribute('begin',begin);
    r.setAttribute('repeatCount','indefinite');
    r.setAttribute('calcMode','spline');
    r.setAttribute('keyTimes','0;1');
    r.setAttribute('keySplines','.16 1 .3 1');

    const o=document.createElementNS(NS,'animate');
    o.setAttribute('attributeName','opacity');
    o.setAttribute('from','0.22');
    o.setAttribute('to','0');
    o.setAttribute('dur','4.8s');
    o.setAttribute('begin',begin);
    o.setAttribute('repeatCount','indefinite');
    o.setAttribute('calcMode','spline');
    o.setAttribute('keyTimes','0;1');
    o.setAttribute('keySplines','.16 1 .3 1');

    wave.appendChild(r);
    wave.appendChild(o);
    try{r.beginElement();o.beginElement();}catch(_){}
    return wave;
  };

  const setupCenter=(svg)=>{
    const anchor=svg.querySelector('.country-center-anchor-r358,.country-point-r352.is-empty');
    if(!anchor) return;

    // Center itself stays completely static: no size/opacity blink.
    killAnimations(anchor);
    anchor.classList.remove('country-native-pulse-r359','country-native-pulse-r361');
    anchor.classList.add('country-center-static-r362');
    anchor.style.setProperty('animation','none','important');
    anchor.setAttribute('r','18');
    anchor.setAttribute('opacity','1');

    // Hide every older animated halo.
    svg.querySelectorAll(
      '.country-center-anchor-halo-r358,.country-point-halo-r352,.country-native-halo-r359,.country-native-halo-r361'
    ).forEach(h=>{
      if(h.classList.contains('andrik-smooth-wave-r362')) return;
      killAnimations(h);
      h.style.setProperty('display','none','important');
    });

    if(anchor.dataset.r362Halo==='1') return;
    anchor.dataset.r362Halo='1';

    const cx=anchor.getAttribute('cx')||'500';
    const cy=anchor.getAttribute('cy')||'300';

    // Two large waves, half-cycle apart: no flicker, continuous aura.
    addWave(svg,anchor,cx,cy,38,158,'country-center-wave-a-r362','0s');
    addWave(svg,anchor,cx,cy,38,158,'country-center-wave-b-r362','-2.4s');
    svg.appendChild(anchor);
  };

  const setupCities=(svg)=>{
    svg.querySelectorAll('.country-city-point-r360').forEach(point=>{
      // Real city point is static; only halo moves.
      killAnimations(point);
      point.classList.add('country-city-static-r362');
      point.style.setProperty('animation','none','important');

      const group=point.closest('.country-city-marker-r360');
      if(!group || point.dataset.r362Halo==='1') return;
      point.dataset.r362Halo='1';

      const oldHalo=group.querySelector('.country-city-halo-r360');
      if(oldHalo){
        killAnimations(oldHalo);
        oldHalo.style.setProperty('display','none','important');
      }

      const cx=point.getAttribute('cx')||'0';
      const cy=point.getAttribute('cy')||'0';
      const base=Math.max(6,Number(point.getAttribute('r')||8));

      addWave(group,point,cx,cy,base+7,base+108,'country-city-wave-a-r362','0s');
      addWave(group,point,cx,cy,base+7,base+108,'country-city-wave-b-r362','-2.4s');
    });
  };

  const ensure=()=>{
    const overlay=map.querySelector('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    if(!overlay||!svg||!document.body.classList.contains('is-country-deep-active')) return;
    setupCenter(svg);
    setupCities(svg);
  };

  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(ensure));
  };

  new MutationObserver(schedule).observe(map,{subtree:true,childList:true});
  ['andrik:country-deep-changed','andrik:country-focus-changed','andrik:ecosystem-layer-changed','andrik:audience-data']
    .forEach(name=>window.addEventListener(name,schedule,{passive:true}));
  window.addEventListener('pageshow',schedule,{passive:true});
  schedule();
})();