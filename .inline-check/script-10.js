
(()=>{
  'use strict';
  if(window.__liveWebAiR101MagneticFrameReady)return;
  window.__liveWebAiR101MagneticFrameReady=true;
  const ID='liveWebAiMagneticLandscapeFrameR101';
  const landscape=()=>window.matchMedia&&window.matchMedia('(orientation: landscape)').matches;
  let raf=0;
  function frame(){
    let el=document.getElementById(ID);
    if(!el){
      el=document.createElement('div');
      el.id=ID;
      el.setAttribute('aria-hidden','true');
      document.body.appendChild(el);
    }
    return el;
  }
  function update(){
    raf=0;
    const el=frame();
    if(!landscape()){
      el.style.display='none';
      return;
    }
    const viewport=document.getElementById('analyticsSwipeViewport');
    const rect=viewport&&viewport.getBoundingClientRect();
    if(!rect||rect.width<120||rect.height<120){
      el.style.display='none';
      return;
    }
    const vw=Math.max(1,document.documentElement.clientWidth||window.innerWidth||0);
    const vh=Math.max(1,document.documentElement.clientHeight||window.innerHeight||0);
    const side=Math.max(18,Math.min(30,Math.round(vw*.013)));
    const left=Math.max(8,Math.round(rect.left+side));
    const right=Math.min(vw-8,Math.round(rect.right-side));
    const top=Math.max(1,Math.round(rect.top+1));
    const bottom=Math.min(vh-1,Math.round(rect.bottom-1));
    el.style.display='block';
    el.style.left=left+'px';
    el.style.top=top+'px';
    el.style.width=Math.max(80,right-left)+'px';
    el.style.height=Math.max(80,bottom-top)+'px';
  }
  function schedule(){
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(update));
  }
  function start(){
    frame();
    schedule();
    [80,180,420,900,1600].forEach(ms=>setTimeout(schedule,ms));
    const viewport=document.getElementById('analyticsSwipeViewport');
    if(window.ResizeObserver&&viewport)new ResizeObserver(schedule).observe(viewport);
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,120),{passive:true});
  window.visualViewport&&window.visualViewport.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('andrik:analytics-page-changed',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
