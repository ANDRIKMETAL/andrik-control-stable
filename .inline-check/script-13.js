
(function(){
  'use strict';
  try{localStorage.removeItem('live-web-ai-map-first-frame-v1')}catch(_){}
  const portrait=()=>window.matchMedia?window.matchMedia('(orientation:portrait)').matches:(innerHeight>=innerWidth);
  function sync(){
    const period=document.getElementById('worldMapPeriodR246');
    if(period&&(!window.__andrikEcosystemActiveLayer||window.__andrikEcosystemActiveLayer==='youtube'))period.innerHTML='Просмотры YouTube по странам за последние <span>28&nbsp;дней.</span>';
    const close1=document.getElementById('countryGrowthClose');if(close1){close1.textContent='×';close1.title='Закрыть список';}
    const close2=document.getElementById('mapMonthlyClose');if(close2){close2.textContent='×';close2.title='Закрыть архив';}
    const rotate=document.getElementById('mapOrientationFab');
    if(rotate){
      const p=portrait();
      rotate.dataset.mode=p?'enter-landscape':'return-portrait';
      rotate.setAttribute('aria-label',p?'Открыть карту в горизонтальном режиме':'Вернуть карту в портретный режим');
      rotate.setAttribute('title',p?'Открыть карту в горизонтальном режиме':'Вернуть карту в портретный режим');
      const icon=rotate.querySelector('.map-orientation-fab-icon');if(icon)icon.textContent=p?'↻':'↺';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
  window.addEventListener('pageshow',sync,{passive:true});
  window.addEventListener('resize',()=>setTimeout(sync,70),{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(sync,140),{passive:true});
  window.addEventListener('andrik:audience-data',sync);
})();
