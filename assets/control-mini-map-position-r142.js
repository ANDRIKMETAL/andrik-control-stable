(()=>{
  'use strict';
  if(window.__andrikMiniMapPositionR144)return;
  window.__andrikMiniMapPositionR144=true;

  const sync=()=>{
    const dock=document.getElementById('andrik-control-mini-r141');
    if(!dock)return;
    if(window.matchMedia?.('(orientation:landscape)')?.matches===true){
      dock.style.setProperty('top','160px','important');
    }else{
      dock.style.removeProperty('top');
    }
  };

  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(sync,120),{passive:true});
  window.addEventListener('pageshow',sync,{passive:true});
  window.addEventListener('andrik:analytics-page-changed',sync,{passive:true});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.andrik-mini-r141-button'))setTimeout(sync,30);
  },{passive:true});

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',sync,{once:true});
  }else{
    sync();
  }
  [120,420,900,1600].forEach(ms=>setTimeout(sync,ms));
})();