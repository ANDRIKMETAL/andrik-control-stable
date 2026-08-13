/* ANDRIK R412 — hard lock for the two portrait country buttons only. */
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_ACTIONS_R412__)return;
  window.__ANDRIK_COUNTRY_ACTIONS_R412__=true;
  const set=(el,p,v)=>{ try{el.style.setProperty(p,v,'important')}catch(_){ } };
  const apply=()=>{
    if(!window.matchMedia || !window.matchMedia('(orientation: portrait)').matches)return;
    const box=document.getElementById('mapFocusActions');
    if(!box)return;
    set(box,'box-sizing','border-box');
    set(box,'min-height','112px');
    set(box,'height','112px');
    set(box,'max-height','112px');
    set(box,'margin-top','8px');
    set(box,'overflow','visible');
    box.querySelectorAll('.map-focus-action').forEach(btn=>{
      set(btn,'box-sizing','border-box');
      set(btn,'width','100%');
      set(btn,'min-width','0');
      set(btn,'min-height','112px');
      set(btn,'height','112px');
      set(btn,'max-height','112px');
      set(btn,'padding','14px 10px');
      set(btn,'border-radius','22px');
      set(btn,'display','flex');
      set(btn,'flex-direction','column');
      set(btn,'align-items','center');
      set(btn,'justify-content','center');
      set(btn,'text-align','center');
      set(btn,'white-space','normal');
      set(btn,'line-height','1.10');
    });
  };
  const boot=()=>{
    apply();
    [40,120,300,700,1400,2600].forEach(ms=>setTimeout(apply,ms));
    try{
      const target=document.getElementById('mapFocusActions')?.parentElement || document.body;
      new MutationObserver(apply).observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
    }catch(_){ }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  addEventListener('pageshow',apply,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(apply,180),{passive:true});
  addEventListener('andrik:country-focus-changed',()=>setTimeout(apply,0));
  addEventListener('andrik:country-deep-changed',()=>setTimeout(apply,0));
})();
