
(function(){
  function bindChartInteractions(root){
    var scope = root || document;
    var days = scope.querySelectorAll('.search-console-day');
    if(!days.length) return;
    days.forEach(function(day, index){
      if(day.dataset.andrikBound==='1') return;
      day.dataset.andrikBound='1';
      day.setAttribute('tabindex','0');
      day.setAttribute('role','button');
      day.setAttribute('aria-label','День ' + (index + 1));
      function activate(){
        days.forEach(function(item){ item.classList.remove('is-active'); });
        day.classList.add('is-active');
      }
      day.addEventListener('pointerdown', activate, {passive:true});
      day.addEventListener('click', activate);
      day.addEventListener('mouseenter', activate);
      day.addEventListener('focus', activate);
      day.addEventListener('keydown', function(e){
        if(e.key==='Enter' || e.key===' '){ e.preventDefault(); activate(); }
      });
    });
  }
  function init(){
    bindChartInteractions(document);
    var hub = document.getElementById('searchConsoleTrend') || document.body;
    if('MutationObserver' in window && hub){
      new MutationObserver(function(){ bindChartInteractions(document); }).observe(hub, {childList:true, subtree:true});
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
