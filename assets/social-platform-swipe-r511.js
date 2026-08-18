(()=>{
  'use strict';
  if(window.__ANDRIK_SOCIAL_PLATFORM_SWIPE_R511__)return;
  window.__ANDRIK_SOCIAL_PLATFORM_SWIPE_R511__=true;
  const params=new URLSearchParams(location.search);
  const path=location.pathname.toLowerCase();
  const source=String(params.get('source')||'').toLowerCase();
  const routes=[
    {name:'Обзор',url:'/social-center-admin.html?source=social-center&v=55.00-r511'},
    {name:'Сайт · GA4',url:'/analytics-admin.html?page=site&source=social-center&v=55.00-r511'},
    {name:'YouTube Studio',url:'/youtube-admin.html?source=social-center&v=55.00-r511'},
    {name:'Instagram',url:'/instagram-admin.html?source=social-center&v=55.00-r511'},
    {name:'TikTok',url:'/tiktok-admin.html?source=social-center&v=55.00-r511'}
  ];
  let index=-1;
  if(path.endsWith('/social-center-admin.html'))index=0;
  else if(path.endsWith('/analytics-admin.html')&&source==='social-center')index=1;
  else if(path.endsWith('/youtube-admin.html')&&source==='social-center')index=2;
  else if(path.endsWith('/instagram-admin.html'))index=3;
  else if(path.endsWith('/tiktok-admin.html'))index=4;
  if(index<0)return;
  document.documentElement.classList.add('social-platform-swipe-r511-active');
  document.body?.setAttribute('data-social-platform-index',String(index));

  const toast=document.createElement('div');
  toast.className='social-platform-swipe-r511-toast';
  toast.setAttribute('aria-hidden','true');
  toast.innerHTML=`<span>‹</span><b>${index+1}/5 · ${routes[index].name}</b><span>›</span>`;
  document.body?.appendChild(toast);
  setTimeout(()=>toast.classList.add('is-hidden'),2200);

  let g=null,suppressClick=false,navigating=false;
  const interactive=el=>el?.closest?.('input,textarea,select,[contenteditable="true"],.no-social-swipe,[data-no-social-swipe]');
  const go=next=>{
    if(navigating)return;
    navigating=true;
    const target=(next+routes.length)%routes.length;
    toast.classList.remove('is-hidden');
    toast.querySelector('b').textContent=`${target+1}/5 · ${routes[target].name}`;
    document.documentElement.classList.add('social-platform-swipe-r511-leaving');
    setTimeout(()=>location.assign(routes[target].url),90);
  };
  document.addEventListener('pointerdown',e=>{
    if(e.isPrimary===false||interactive(e.target))return;
    g={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,t:performance.now(),mode:''};
  },{capture:true,passive:true});
  document.addEventListener('pointermove',e=>{
    if(!g||e.pointerId!==g.id)return;
    g.lastX=e.clientX;g.lastY=e.clientY;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(!g.mode&&Math.max(Math.abs(dx),Math.abs(dy))>11){
      if(Math.abs(dx)>Math.abs(dy)*1.18)g.mode='horizontal';
      else if(Math.abs(dy)>Math.abs(dx)*1.05)g.mode='vertical';
    }
    if(g.mode==='horizontal'){
      e.preventDefault();
      const p=Math.max(-1,Math.min(1,dx/150));
      document.documentElement.style.setProperty('--social-swipe-r511-x',`${p*10}px`);
      toast.classList.remove('is-hidden');
    }
  },{capture:true,passive:false});
  const finish=e=>{
    if(!g||e.pointerId!==g.id)return;
    const dx=(e.clientX??g.lastX)-g.x,dy=(e.clientY??g.lastY)-g.y;
    const dt=performance.now()-g.t;
    const horizontal=g.mode==='horizontal'&&Math.abs(dx)>Math.abs(dy)*1.12;
    const trigger=horizontal&&(Math.abs(dx)>=58||(dt<360&&Math.abs(dx)>=38));
    g=null;
    document.documentElement.style.removeProperty('--social-swipe-r511-x');
    if(trigger){suppressClick=true;setTimeout(()=>suppressClick=false,500);go(index+(dx<0?1:-1));}
    else setTimeout(()=>toast.classList.add('is-hidden'),500);
  };
  document.addEventListener('pointerup',finish,{capture:true,passive:true});
  document.addEventListener('pointercancel',e=>{if(g&&e.pointerId===g.id){g=null;document.documentElement.style.removeProperty('--social-swipe-r511-x');}}, {capture:true,passive:true});
  document.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
})();
