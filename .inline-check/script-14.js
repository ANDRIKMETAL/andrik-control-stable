
(function(){
  'use strict';
  function clean(){
    document.querySelectorAll('.analytics-map-pane .map-landscape-title-row').forEach(node=>node.remove());
    const period=document.getElementById('worldMapPeriodR246');
    if(period&&(!window.__andrikEcosystemActiveLayer||window.__andrikEcosystemActiveLayer==='youtube'))period.innerHTML='Просмотры YouTube по странам за последние <span>28&nbsp;дней.</span>';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean,{once:true});else clean();
  window.addEventListener('pageshow',clean,{passive:true});
  window.addEventListener('andrik:audience-data',clean);
})();
