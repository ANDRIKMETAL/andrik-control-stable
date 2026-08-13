/* ANDRIK R412 — Monitoring live network globe status bridge. */
(()=>{
  'use strict';
  if(window.__ANDRIK_NETWORK_GLOBE_R412__)return;
  window.__ANDRIK_NETWORK_GLOBE_R412__=true;
  const card=document.getElementById('andrikNetworkGlobeR412');
  const summary=document.getElementById('observabilityHealthSummary');
  const state=document.getElementById('andrikNetworkGlobeStateR412');
  if(!card||!state)return;

  const pluralCountries=n=>{
    const a=Math.abs(Number(n)||0)%100,b=a%10;
    return a>10&&a<20?'стран':b===1?'страна':b>=2&&b<=4?'страны':'стран';
  };
  const cachedCountryCount=()=>{
    try{
      const box=JSON.parse(localStorage.getItem('andrik-control-audience-v54-39')||'null');
      const rows=box?.data?.youtube?.studio?.countries;
      return Array.isArray(rows)&&rows.length?rows.length:0;
    }catch(_){return 0}
  };
  const apply=()=>{
    const text=String(summary?.textContent||'').trim();
    card.classList.remove('is-ok','is-warning','is-error');
    let label='Сеть активна';
    if(/провер/i.test(text)){label='Проверяем глобальную сеть'}
    else if(summary?.classList.contains('is-down')){card.classList.add('is-error');label='Есть критический сбой'}
    else if(summary?.classList.contains('is-degraded')){card.classList.add('is-warning');label='Сеть работает с предупреждением'}
    else if(summary?.classList.contains('is-ok')){card.classList.add('is-ok');label='Сеть активна'}
    const count=cachedCountryCount();
    state.innerHTML=`<i aria-hidden="true"></i><span>${label}${count?` · ${count} ${pluralCountries(count)}`:''}</span>`;
  };
  apply();
  if(summary)new MutationObserver(apply).observe(summary,{attributes:true,childList:true,subtree:true,attributeFilter:['class']});
  window.addEventListener('storage',e=>{if(e.key==='andrik-control-audience-v54-39')apply()});
  window.addEventListener('pageshow',apply,{passive:true});

  let inView=true;
  const syncPause=()=>card.classList.toggle('is-paused',document.hidden||!inView);
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{inView=entry.isIntersecting;syncPause()}),{threshold:.04});
    io.observe(card);
  }
  document.addEventListener('visibilitychange',syncPause);
  syncPause();
})();
