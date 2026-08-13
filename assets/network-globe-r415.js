/* ANDRIK R415 — Monitoring live globe. Rotation is driven directly so mobile reduced-motion/browser optimizations cannot freeze it. */
(()=>{
  'use strict';
  if(window.__ANDRIK_NETWORK_GLOBE_R415__)return;
  window.__ANDRIK_NETWORK_GLOBE_R415__=true;
  const card=document.getElementById('andrikNetworkGlobeR415');
  const sphere=document.getElementById('andrikNetworkGlobeSphereR415');
  const texture=document.getElementById('andrikNetworkGlobeTextureR415');
  const dot=document.getElementById('andrikNetworkGlobeDotR415');
  const summary=document.getElementById('observabilityHealthSummary');
  const state=document.getElementById('andrikNetworkGlobeStateR415');
  if(!card||!sphere||!texture||!dot||!state)return;

  const pluralCountries=n=>{const a=Math.abs(Number(n)||0)%100,b=a%10;return a>10&&a<20?'стран':b===1?'страна':b>=2&&b<=4?'страны':'стран'};
  const cachedCountryCount=()=>{try{const box=JSON.parse(localStorage.getItem('andrik-control-audience-v54-39')||'null');const rows=box?.data?.youtube?.studio?.countries;return Array.isArray(rows)&&rows.length?rows.length:0}catch(_){return 0}};
  const apply=()=>{const text=String(summary?.textContent||'').trim();card.classList.remove('is-ok','is-warning','is-error');let label='Сеть активна';if(/провер/i.test(text)){label='Проверяем глобальную сеть'}else if(summary?.classList.contains('is-down')){card.classList.add('is-error');label='Есть критический сбой'}else if(summary?.classList.contains('is-degraded')){card.classList.add('is-warning');label='Сеть работает с предупреждением'}else if(summary?.classList.contains('is-ok')){card.classList.add('is-ok');label='Сеть активна'}const count=cachedCountryCount();state.innerHTML=`<i aria-hidden="true"></i><span>${label}${count?` · ${count} ${pluralCountries(count)}`:''}</span>`};
  apply();
  if(summary)new MutationObserver(apply).observe(summary,{attributes:true,childList:true,subtree:true,attributeFilter:['class']});
  window.addEventListener('storage',e=>{if(e.key==='andrik-control-audience-v54-39')apply()});
  window.addEventListener('pageshow',apply,{passive:true});

  // Slovakia / Košice-region marker: lat/lon are converted onto the rotating equirectangular texture.
  const SK_LAT=48.67,SK_LON=19.70;
  const REVOLUTION_MS=20000;
  let started=performance.now(),lastFrame=0,raf=0;
  const mod=(v,m)=>((v%m)+m)%m;
  const draw=now=>{
    raf=0;
    if(document.hidden){card.classList.add('is-paused');return}
    card.classList.remove('is-paused');
    if(now-lastFrame<32){raf=requestAnimationFrame(draw);return}
    lastFrame=now;
    const w=Math.max(1,sphere.clientWidth),h=Math.max(1,sphere.clientHeight),mapW=w*2;
    const phase=((now-started)%REVOLUTION_MS)/REVOLUTION_MS;
    const xMap=((SK_LON+180)/360)*mapW;
    const yMap=((90-SK_LAT)/180)*h;
    const desiredStart=w*.62;
    const startOffset=desiredStart-xMap;
    const offset=startOffset-phase*mapW;
    texture.style.backgroundPosition=`${offset}px 50%`;
    let x=mod(xMap+offset,mapW);
    const visible=x>=0&&x<=w;
    dot.style.opacity=visible?'1':'0';
    if(visible){
      // Gentle spherical projection: compress longitude near the visible rim.
      const flat=(x/w)*2-1;
      const curved=.5+.5*Math.sin(flat*Math.PI/2);
      dot.style.left=`${(curved*w).toFixed(2)}px`;
      dot.style.top=`${yMap.toFixed(2)}px`;
    }
    card.dataset.globePhase=phase.toFixed(3);
    raf=requestAnimationFrame(draw);
  };
  const resume=()=>{if(document.hidden){card.classList.add('is-paused');if(raf)cancelAnimationFrame(raf);raf=0;return}card.classList.remove('is-paused');if(!raf)raf=requestAnimationFrame(draw)};
  document.addEventListener('visibilitychange',resume,{passive:true});
  resume();
})();
