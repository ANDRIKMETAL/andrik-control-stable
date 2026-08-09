
(()=>{
  const isLandscape=()=>matchMedia?.('(orientation:landscape)')?.matches===true;
  const force=()=>{
    if(!isLandscape())return;
    const top=document.querySelector('.analytics-map-pane .analytics-map-top');
    const map=document.getElementById('worldMap');
    const canvas=map?.querySelector('.world-map-canvas');
    const stage=map?.querySelector('.world-map-stage');
    if(top){top.style.setProperty('padding','0 18px 4px','important');top.style.setProperty('height','100dvh','important');top.style.setProperty('min-height','100dvh','important');}
    if(map){map.style.setProperty('height','calc(100dvh - 4px)','important');map.style.setProperty('min-height','260px','important');map.style.setProperty('margin','0 auto','important');}
    [canvas,stage].forEach(el=>{if(el){el.style.setProperty('inset','0','important');el.style.setProperty('height','100%','important');el.style.setProperty('min-height','100%','important');el.style.setProperty('padding','0','important');}});
  };
  const schedule=()=>[0,70,220,650,1500].forEach(ms=>setTimeout(force,ms));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  addEventListener('pageshow',schedule,{passive:true});addEventListener('orientationchange',schedule,{passive:true});addEventListener('resize',()=>setTimeout(force,80),{passive:true});
})();
