(()=>{
  'use strict';
  if(window.__ANDRIK_SOCIAL_PLATFORM_SWIPE_R513__)return;
  window.__ANDRIK_SOCIAL_PLATFORM_SWIPE_R513__=true;

  const params=new URLSearchParams(location.search);
  const path=location.pathname.toLowerCase();
  const source=String(params.get('source')||'').toLowerCase();
  const routes=[
    {name:'Обзор',url:'/social-center-admin.html?source=social-center&v=55.00-r513'},
    {name:'Сайт · GA4',url:'/analytics-admin.html?page=site&source=social-center&v=55.00-r513'},
    {name:'YouTube Studio',url:'/youtube-admin.html?source=social-center&v=55.00-r513'},
    {name:'Instagram',url:'/instagram-admin.html?source=social-center&v=55.00-r513'},
    {name:'TikTok',url:'/tiktok-admin.html?source=social-center&v=55.00-r513'}
  ];

  let index=-1;
  if(path.endsWith('/social-center-admin.html'))index=0;
  else if(path.endsWith('/analytics-admin.html')&&source==='social-center')index=1;
  else if(path.endsWith('/youtube-admin.html')&&source==='social-center')index=2;
  else if(path.endsWith('/instagram-admin.html'))index=3;
  else if(path.endsWith('/tiktok-admin.html'))index=4;
  if(index<0)return;

  document.documentElement.classList.add('social-platform-swipe-r513-active');
  document.body?.setAttribute('data-social-platform-index',String(index));

  const toast=document.createElement('div');
  toast.className='social-platform-swipe-r513-toast is-hidden';
  toast.setAttribute('aria-hidden','true');
  toast.innerHTML=`<span>‹</span><b>${index+1}/5 · ${routes[index].name}</b><span>›</span>`;
  document.body?.appendChild(toast);

  let gesture=null;
  let suppressClick=false;
  let navigating=false;
  let hideTimer=0;

  const interactive=el=>el?.closest?.('input,textarea,select,[contenteditable="true"],[data-no-social-swipe],.no-social-swipe');
  const showToast=(text)=>{
    clearTimeout(hideTimer);
    if(text)toast.querySelector('b').textContent=text;
    toast.classList.remove('is-hidden');
  };
  const hideToast=(delay=420)=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>toast.classList.add('is-hidden'),delay)};
  const setDrag=dx=>{
    const px=Math.max(-13,Math.min(13,dx*0.075));
    document.documentElement.style.setProperty('--social-swipe-r513-x',`${px}px`);
  };
  const clearDrag=()=>document.documentElement.style.removeProperty('--social-swipe-r513-x');
  const go=delta=>{
    if(navigating)return;
    navigating=true;
    const target=(index+delta+routes.length)%routes.length;
    showToast(`${target+1}/5 · ${routes[target].name}`);
    document.documentElement.classList.add('social-platform-swipe-r513-leaving');
    setTimeout(()=>location.assign(routes[target].url),85);
  };
  const begin=(x,y,target,kind,id)=>{
    if(interactive(target))return false;
    gesture={x,y,lastX:x,lastY:y,t:performance.now(),mode:'',kind,id};
    return true;
  };
  const move=(x,y,prevent)=>{
    if(!gesture)return;
    gesture.lastX=x;gesture.lastY=y;
    const dx=x-gesture.x,dy=y-gesture.y;
    if(!gesture.mode&&Math.max(Math.abs(dx),Math.abs(dy))>10){
      if(Math.abs(dx)>Math.abs(dy)*1.13)gesture.mode='horizontal';
      else if(Math.abs(dy)>Math.abs(dx)*1.02)gesture.mode='vertical';
    }
    if(gesture.mode==='horizontal'){
      if(prevent)prevent();
      setDrag(dx);
      const target=(index+(dx<0?1:-1)+routes.length)%routes.length;
      showToast(`${target+1}/5 · ${routes[target].name}`);
    }
  };
  const finish=(x,y,cancelled=false)=>{
    if(!gesture)return;
    const dx=(Number.isFinite(x)?x:gesture.lastX)-gesture.x;
    const dy=(Number.isFinite(y)?y:gesture.lastY)-gesture.y;
    const dt=performance.now()-gesture.t;
    const horizontal=gesture.mode==='horizontal'&&Math.abs(dx)>Math.abs(dy)*1.08;
    const trigger=!cancelled&&horizontal&&(Math.abs(dx)>=52||(dt<420&&Math.abs(dx)>=34));
    gesture=null;clearDrag();
    if(trigger){
      suppressClick=true;setTimeout(()=>suppressClick=false,520);
      go(dx<0?1:-1);
    }else hideToast();
  };

  // Android/iOS: explicit touch handling. This is the primary path on phones.
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    const t=e.touches[0];
    begin(t.clientX,t.clientY,e.target,'touch',t.identifier);
  },{capture:true,passive:true});
  document.addEventListener('touchmove',e=>{
    if(!gesture||gesture.kind!=='touch'||e.touches.length!==1)return;
    const t=e.touches[0];
    move(t.clientX,t.clientY,()=>e.preventDefault());
  },{capture:true,passive:false});
  document.addEventListener('touchend',e=>{
    if(!gesture||gesture.kind!=='touch')return;
    const t=e.changedTouches?.[0];
    finish(t?.clientX,t?.clientY,false);
  },{capture:true,passive:true});
  document.addEventListener('touchcancel',()=>{if(gesture?.kind==='touch')finish(undefined,undefined,true)},{capture:true,passive:true});

  // Mouse / stylus fallback. Touch pointers are intentionally ignored to avoid duplicate gestures.
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||e.isPrimary===false)return;
    begin(e.clientX,e.clientY,e.target,'pointer',e.pointerId);
  },{capture:true,passive:true});
  document.addEventListener('pointermove',e=>{
    if(!gesture||gesture.kind!=='pointer'||gesture.id!==e.pointerId)return;
    move(e.clientX,e.clientY,()=>e.preventDefault());
  },{capture:true,passive:false});
  document.addEventListener('pointerup',e=>{
    if(!gesture||gesture.kind!=='pointer'||gesture.id!==e.pointerId)return;
    finish(e.clientX,e.clientY,false);
  },{capture:true,passive:true});
  document.addEventListener('pointercancel',e=>{
    if(gesture?.kind==='pointer'&&gesture.id===e.pointerId)finish(undefined,undefined,true);
  },{capture:true,passive:true});

  document.addEventListener('click',e=>{
    if(!suppressClick)return;
    e.preventDefault();e.stopImmediatePropagation();
  },true);
})();
