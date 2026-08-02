(()=>{
  'use strict';
  if(window.__andrikAdminFrameR142)return;
  window.__andrikAdminFrameR142=true;
  const landscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  let raf=0;
  const update=()=>{
    raf=0;
    const frame=document.querySelector('.control-admin-landscape-frame-r141');
    if(!frame)return;
    if(!landscape()){
      frame.style.removeProperty('left');
      frame.style.removeProperty('top');
      frame.style.removeProperty('width');
      frame.style.removeProperty('height');
      return;
    }
    const viewport=document.querySelector('.control-swipe-main');
    const rect=viewport?.getBoundingClientRect?.();
    if(!rect||rect.width<120||rect.height<100)return;
    const vw=Math.max(1,document.documentElement.clientWidth||innerWidth||0);
    const vh=Math.max(1,document.documentElement.clientHeight||innerHeight||0);
    const side=Math.max(18,Math.min(30,Math.round(vw*.013)));
    const left=Math.max(8,Math.round(rect.left+side));
    const right=Math.min(vw-8,Math.round(rect.right-side));
    const top=Math.max(1,Math.round(rect.top+1));
    const bottom=Math.max(top+80,vh-1);
    viewport.style.setProperty('height',`${Math.max(80,vh-rect.top)}px`,'important');
    frame.style.setProperty('left',`${left}px`,'important');
    frame.style.setProperty('top',`${top}px`,'important');
    frame.style.setProperty('width',`${Math.max(80,right-left)}px`,'important');
    frame.style.setProperty('height',`${Math.max(80,bottom-top)}px`,'important');
  };
  const schedule=()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(update));
  };
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,120),{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  [80,220,600,1200].forEach(ms=>setTimeout(schedule,ms));
})();