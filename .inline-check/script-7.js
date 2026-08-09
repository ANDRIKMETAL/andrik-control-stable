
(function(){
  function markReady(){
    document.documentElement.setAttribute('data-andrik-map-build','r46');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', markReady, {once:true});
  else markReady();
})();
