
(()=>{
  const bind=()=>{
    const zone=document.getElementById('mapEndPullZone');
    const label=document.getElementById('mapEndPullText');
    if(!zone||zone.dataset.r257Bound==='1')return;
    zone.dataset.r257Bound='1';
    let active=false,pointerId=null,startY=0,lastY=0,navigating=false;
    const isLandscape=()=>matchMedia?.('(orientation:landscape)')?.matches===true;
    const reset=()=>{
      active=false;pointerId=null;startY=0;lastY=0;
      zone.classList.remove('is-r257-ready');
      zone.style.setProperty('--r257-admin-pull','0px');
      if(label)label.textContent='Свайп вверх — Админ-панель';
    };
    const go=()=>{
      if(navigating)return;
      navigating=true;
      zone.classList.add('is-r257-ready');
      if(label)label.textContent='Открываем Админ-панель…';
      setTimeout(()=>location.assign('/control-home.html?page=menu&source=landscape-bottom-swipe&v=55.00-r257'),110);
    };
    zone.addEventListener('pointerdown',event=>{
      if(!isLandscape()||event.isPrimary===false)return;
      active=true;pointerId=event.pointerId;startY=lastY=event.clientY;
      try{zone.setPointerCapture(pointerId)}catch(_){}
      event.preventDefault();event.stopPropagation();
    },{passive:false});
    zone.addEventListener('pointermove',event=>{
      if(!active||event.pointerId!==pointerId)return;
      lastY=event.clientY;
      const distance=Math.max(0,startY-lastY);
      zone.style.setProperty('--r257-admin-pull',`${Math.min(54,distance)}px`);
      const ready=distance>=44;
      zone.classList.toggle('is-r257-ready',ready);
      if(label)label.textContent=ready?'Отпустите — открыть Админ-панель':'Свайп вверх — Админ-панель';
      event.preventDefault();event.stopPropagation();
    },{passive:false});
    const finish=event=>{
      if(!active||event.pointerId!==pointerId)return;
      const distance=Math.max(0,startY-(event.clientY||lastY));
      event.preventDefault();event.stopPropagation();
      try{zone.releasePointerCapture(pointerId)}catch(_){}
      if(distance>=44)go();else reset();
    };
    zone.addEventListener('pointerup',finish,{passive:false});
    zone.addEventListener('pointercancel',event=>{event.stopPropagation();reset();},{passive:true});
    zone.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();},{capture:true});
    reset();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  addEventListener('pageshow',bind,{passive:true});
})();
