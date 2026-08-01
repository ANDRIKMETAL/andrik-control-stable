/* Live Web AI FINAL R100
   One landscape frame attached to the stationary swipe viewport, never to a moving pane. */
(()=>{
  'use strict';
  if(window.__liveWebAiR100StableViewportFrameReady)return;
  window.__liveWebAiR100StableViewportFrameReady=true;

  const FRAME_ID='liveWebAiUniversalLandscapeFrameR100';
  const isLandscape=()=>window.matchMedia?.('(orientation: landscape)')?.matches===true;
  let raf=0;

  function ensureFrame(){
    let frame=document.getElementById(FRAME_ID);
    if(!frame){
      frame=document.createElement('div');
      frame.id=FRAME_ID;
      frame.setAttribute('aria-hidden','true');
      document.body.appendChild(frame);
    }
    return frame;
  }

  function viewportBox(){
    const viewport=document.getElementById('analyticsSwipeViewport');
    const rect=viewport?.getBoundingClientRect?.();
    const width=Math.max(1,document.documentElement.clientWidth||window.innerWidth||0);
    const height=Math.max(1,document.documentElement.clientHeight||window.innerHeight||0);
    if(!rect||rect.width<40||rect.height<40)return null;

    /* Same optical side inset as the accepted map frame, but measured from the
       stationary viewport. It therefore cannot collapse while the track slides. */
    const side=Math.max(16,Math.min(30,Math.round(width*.021)));
    const left=Math.max(8,Math.round(rect.left+side));
    const right=Math.min(width-8,Math.round(rect.right-side));
    const top=Math.max(0,Math.round(rect.top));
    const bottom=Math.max(top+24,Math.floor(height-1));
    return {
      left,
      top,
      width:Math.max(24,right-left),
      height:Math.max(24,bottom-top)
    };
  }

  function updateNow(){
    raf=0;
    const frame=ensureFrame();
    if(!isLandscape()){
      frame.classList.remove('is-visible');
      return;
    }
    const box=viewportBox();
    if(!box){
      frame.classList.remove('is-visible');
      return;
    }
    frame.style.left=`${box.left}px`;
    frame.style.top=`${box.top}px`;
    frame.style.width=`${box.width}px`;
    frame.style.height=`${box.height}px`;
    frame.classList.add('is-visible');
  }

  function schedule(){
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>requestAnimationFrame(updateNow));
  }

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,120),{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()},{passive:true});
  window.addEventListener('andrik:analytics-page-changed',schedule,{passive:true});

  const startObserver=()=>{
    const viewport=document.getElementById('analyticsSwipeViewport');
    if(window.ResizeObserver&&viewport){
      const observer=new ResizeObserver(schedule);
      observer.observe(viewport);
      const topbar=document.querySelector('.control-topbar');
      if(topbar)observer.observe(topbar);
    }
    schedule();
    setTimeout(schedule,180);
    setTimeout(schedule,700);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();
})();
