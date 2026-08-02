(()=>{
  'use strict';
  if(window.__andrikMiniMapPositionR142)return;
  window.__andrikMiniMapPositionR142=true;
  const landscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  let raf=0;
  const update=()=>{
    raf=0;
    const dock=document.getElementById('andrik-control-mini-r141');
    if(!dock)return;
    const onMap=document.body?.dataset?.analyticsPage==='map';
    if(!landscape()||!onMap){
      dock.style.removeProperty('top');
      return;
    }
    const frame=document.getElementById('liveWebAiMagneticLandscapeFrameR101');
    const rect=frame?.getBoundingClientRect?.();
    if(!rect||rect.width<120||rect.height<120)return;
    const panel=dock.querySelector('.andrik-mini-r141-panel');
    const panelHeight=Math.max(96,panel?.getBoundingClientRect?.().height||0);
    const desired=rect.top+74;
    const maximum=rect.bottom-panelHeight-16;
    const top=Math.max(rect.top+24,Math.min(desired,maximum));
    dock.style.setProperty('top',`${Math.round(top)}px`,'important');
  };
  const schedule=()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(update));
  };
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,120),{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('andrik:analytics-page-changed',schedule,{passive:true});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.andrik-mini-r141-button'))setTimeout(schedule,30);
  },{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  [120,420,900,1600].forEach(ms=>setTimeout(schedule,ms));
})();