
(()=>{
  'use strict';
  const map=document.getElementById('worldMap');
  const zone=document.getElementById('r179FocusedMapAdminSwipe');
  if(!map||!zone)return;
  let gesture=null,leaving=false;
  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const reset=()=>{gesture=null;zone.classList.remove('is-pulling','is-ready');zone.style.removeProperty('--r179-pull-y')};
  const sync=()=>{
    const ready=isLandscape()&&map.classList.contains('is-country-focused');
    document.body.classList.toggle('r179-focused-map-swipe-ready',ready);
    zone.setAttribute('aria-hidden',ready?'false':'true');
    if(!ready)reset();
  };
  zone.addEventListener('pointerdown',event=>{
    if(leaving||event.isPrimary===false||!isLandscape()||!map.classList.contains('is-country-focused'))return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY};
    zone.classList.add('is-pulling');
    try{zone.setPointerCapture(event.pointerId)}catch(_){}
    event.preventDefault();event.stopPropagation();
  },{passive:false});
  zone.addEventListener('pointermove',event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    gesture.lastX=event.clientX;gesture.lastY=event.clientY;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    const up=Math.max(0,-dy),vertical=up>Math.abs(dx)*1.10;
    zone.style.setProperty('--r179-pull-y',`${-Math.min(28,up*.34)}px`);
    zone.classList.toggle('is-ready',vertical&&up>=58);
    event.preventDefault();event.stopPropagation();
  },{passive:false});
  const finish=event=>{
    if(!gesture||gesture.id!==event.pointerId)return;
    const dx=(event.clientX??gesture.lastX)-gesture.x;
    const dy=(event.clientY??gesture.lastY)-gesture.y;
    const up=Math.max(0,-dy),valid=up>=58&&up>Math.abs(dx)*1.10;
    event.preventDefault();event.stopPropagation();
    if(valid&&!leaving){
      leaving=true;zone.classList.add('is-ready');
      const label=zone.querySelector('.r179-focused-map-handle');
      if(label)label.textContent='Открываем админ-панель…';
      setTimeout(()=>location.assign('/control-home.html?page=menu&source=focused-map-swipe&v=55.00-r179'),120);
      return;
    }
    reset();
  };
  zone.addEventListener('pointerup',finish,{passive:false});
  zone.addEventListener('pointercancel',event=>{if(gesture&&gesture.id===event.pointerId){event.stopPropagation();reset()}},{passive:false});
  new MutationObserver(sync).observe(map,{attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
  sync();
})();
