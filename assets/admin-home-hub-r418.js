/* ANDRIK R418 — home hub globe + direct side swipes. */
(()=>{
  'use strict';
  if(window.__ANDRIK_ADMIN_HUB_R418__)return;
  window.__ANDRIK_ADMIN_HUB_R418__=true;
  const page=document.querySelector('.control-menu-page');
  const globe=document.getElementById('adminHubGlobeR418');
  const sphere=document.getElementById('adminHubGlobeSphereR418');
  const texture=document.getElementById('adminHubGlobeTextureR418');
  const dot=document.getElementById('adminHubGlobeDotR418');
  if(globe&&sphere&&texture&&dot){
    const SK_LAT=48.67,SK_LON=19.70,REVOLUTION_MS=20000;
    const started=performance.now();let raf=0,last=0;
    const mod=(v,m)=>((v%m)+m)%m;
    const draw=now=>{
      raf=0;if(document.hidden)return;
      if(now-last<32){raf=requestAnimationFrame(draw);return}last=now;
      const w=Math.max(1,sphere.clientWidth),h=Math.max(1,sphere.clientHeight),mapW=w*2;
      const phase=((now-started)%REVOLUTION_MS)/REVOLUTION_MS;
      const xMap=((SK_LON+180)/360)*mapW,yMap=((90-SK_LAT)/180)*h;
      const offset=(w*.62-xMap)-phase*mapW;
      texture.style.backgroundPosition=`${offset}px 50%`;
      const x=mod(xMap+offset,mapW),visible=x>=0&&x<=w;
      dot.style.opacity=visible?'1':'0';
      if(visible){const flat=(x/w)*2-1,curved=.5+.5*Math.sin(flat*Math.PI/2);dot.style.left=`${(curved*w).toFixed(2)}px`;dot.style.top=`${yMap.toFixed(2)}px`;}
      raf=requestAnimationFrame(draw);
    };
    const resume=()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;return}if(!raf)raf=requestAnimationFrame(draw)};
    document.addEventListener('visibilitychange',resume,{passive:true});resume();
  }
  if(!page)return;
  const sideUrls={google:'/analytics-admin.html?page=google&source=admin-hub-swipe&v=55.00-r420',youtube:'/analytics-admin.html?page=youtube&source=admin-hub-swipe&v=55.00-r420'};
  const warmSides=()=>{
    if(window.__ANDRIK_HUB_SIDE_WARM_R418__)return;window.__ANDRIK_HUB_SIDE_WARM_R418__=true;
    Promise.allSettled(Object.values(sideUrls).map(url=>fetch(url,{method:'GET',credentials:'same-origin',cache:'force-cache',priority:'low'}).then(r=>r.ok?r.text():''))).catch(()=>{});
  };
  if('requestIdleCallback'in window)requestIdleCallback(warmSides,{timeout:900});else setTimeout(warmSides,260);
  let gesture=null,navigating=false;
  const formInteractive=target=>Boolean(target?.closest?.('a,button,input,textarea,select,label,[contenteditable="true"]')); // R422: links/buttons own their tap
  let suppressClickUntil=0;
  page.addEventListener('pointerdown',e=>{
    if(navigating||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0)||formInteractive(e.target))return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,t:performance.now(),axis:''};
  },true);
  page.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    gesture.lastX=e.clientX;gesture.lastY=e.clientY;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,ax=Math.abs(dx),ay=Math.abs(dy);
    if(!gesture.axis&&Math.max(ax,ay)>12)gesture.axis=ax>ay*1.18?'x':'y';
    if(gesture.axis==='x')e.preventDefault();
  },{passive:false,capture:true});
  page.addEventListener('pointerup',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const dx=(e.clientX??gesture.lastX)-gesture.x,dy=(e.clientY??gesture.lastY)-gesture.y;
    const elapsed=Math.max(1,performance.now()-gesture.t),velocity=Math.abs(dx)/elapsed;
    const valid=gesture.axis==='x'&&Math.abs(dx)>=Math.max(64,innerWidth*.16)&&Math.abs(dx)>Math.abs(dy)*1.18&&(velocity>.16||Math.abs(dx)>92);
    gesture=null;
    if(!valid||navigating)return;
    suppressClickUntil=performance.now()+700;
    navigating=true;
    // Finger left -> right = Google Analytics. Finger right -> left = YouTube.
    const url=dx>0?sideUrls.google:sideUrls.youtube;
    location.assign(url);
  },true);
  page.addEventListener('pointercancel',()=>{gesture=null},true);
  window.addEventListener('pageshow',()=>{gesture=null;navigating=false;suppressClickUntil=0},{passive:true});
  page.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
})();
