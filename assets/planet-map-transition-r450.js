/* ANDRIK R450 — GPU-light planet <-> world-map portal. No giant DOM layers, no animation wait deadlocks. */
(()=>{
  'use strict';
  if(window.__ANDRIK_PLANET_MAP_TRANSITION_R450__)return;
  window.__ANDRIK_PLANET_MAP_TRANSITION_R450__=true;

  const K_RECT='andrik-portal-globe-rect-r450';
  const K_OPEN='andrik-portal-map-open-r450';
  const K_RETURN='andrik-portal-return-r450';
  const MAP_URL='/assets/world-map-control-v52.webp';
  const now=()=>Date.now();
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}};
  const fresh=v=>{const n=Number(v||0);return n>0&&now()-n<12000};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const baseSize=()=>clamp(Math.min(innerWidth,innerHeight)*0.74,232,320);
  const coverScale=base=>Math.hypot(innerWidth,innerHeight)*1.10/base;
  const withVersion=url=>{
    try{const u=new URL(url,location.href);u.searchParams.set('v','55.00-r450');return u.pathname+u.search+u.hash}catch(_){return url}
  };

  // Decode the transition map while the admin hub is idle so first tap does not trigger image decode jank.
  try{
    const img=new Image();img.decoding='async';img.src=MAP_URL;
    if(typeof img.decode==='function')img.decode().catch(()=>{});
  }catch(_){}

  const animateSafe=(el,keyframes,options={})=>{
    const duration=Number(options.duration||0);
    try{
      const animation=el.animate(keyframes,options);
      return Promise.race([
        animation.finished.catch(()=>{}),
        wait(duration+110)
      ]);
    }catch(_){
      return wait(duration);
    }
  };

  const cleanClone=node=>{
    if(!node)return null;
    const c=node.cloneNode(true);
    c.removeAttribute?.('id');
    c.querySelectorAll?.('[id]').forEach(x=>x.removeAttribute('id'));
    c.setAttribute?.('aria-hidden','true');
    return c;
  };

  const createPortal=()=>{
    const root=document.createElement('div');root.className='andrik-map-portal-r450';root.setAttribute('aria-hidden','true');
    const back=document.createElement('div');back.className='andrik-map-portal-backdrop-r450';
    const orb=document.createElement('div');orb.className='andrik-map-portal-orb-r450';
    const map=document.createElement('div');map.className='andrik-map-portal-map-r450';
    const flare=document.createElement('div');flare.className='andrik-map-portal-flare-r450';
    orb.append(map,flare);root.append(back,orb);document.body.append(root);
    return {root,back,orb,map,flare};
  };

  const placeBase=(orb,cx,cy,base)=>{
    orb.style.width=base+'px';orb.style.height=base+'px';
    orb.style.left=(cx-base/2)+'px';orb.style.top=(cy-base/2)+'px';
  };

  const saveRect=rect=>{
    try{
      const min=Math.max(1,Math.min(innerWidth,innerHeight));
      sessionStorage.setItem(K_RECT,JSON.stringify({
        x:(rect.left+rect.width/2)/innerWidth,
        y:(rect.top+rect.height/2)/innerHeight,
        s:Math.max(rect.width,rect.height)/min,
        t:now()
      }));
    }catch(_){}
  };

  const readRect=()=>{
    try{
      const raw=sessionStorage.getItem(K_RECT) || sessionStorage.getItem('andrik-portal-globe-rect-r449') || sessionStorage.getItem('andrik-portal-globe-rect-r448');
      const o=JSON.parse(raw||'null');
      if(!o||!fresh(o.t))return null;
      const min=Math.max(1,Math.min(innerWidth,innerHeight));
      return {cx:o.x*innerWidth,cy:o.y*innerHeight,size:Math.max(78,o.s*min)};
    }catch(_){return null}
  };

  let navigating=false;
  let suppressClickUntil=0;
  let press=null;

  // R450 — bfcache/PWA return hard reset. Android can restore the admin DOM exactly
  // as it was at navigation time (navigating=true + hidden sphere). Always re-arm it.
  const resetInteractionR450=()=>{
    navigating=false;
    press=null;
    suppressClickUntil=0;
    document.querySelectorAll('.andrik-map-portal-r450,.andrik-map-portal-r449').forEach(node=>node.remove());
    const sphere=document.getElementById('adminHubGlobeSphereR418');
    sphere?.classList.remove('andrik-portal-source-hidden-r450','andrik-portal-source-hidden-r449');
    const globe=document.getElementById('adminHubGlobeR418');
    if(globe){
      globe.removeAttribute('aria-disabled');
      globe.style.removeProperty('pointer-events');
      globe.href='/analytics-admin.html?page=map&source=admin-globe&v=55.00-r450';
    }
  };

  const navigateAfter=(url,delay)=>{
    let done=false;
    const go=()=>{if(done)return;done=true;location.assign(withVersion(url))};
    const timer=setTimeout(go,delay+170);
    return ()=>{clearTimeout(timer);go()};
  };

  async function open(globe){
    if(navigating)return;
    navigating=true;
    suppressClickUntil=performance.now()+1200;

    const href=globe.href||'/analytics-admin.html?page=map&source=admin-globe&v=55.00-r450';
    const sphere=globe.querySelector('#adminHubGlobeSphereR418,.admin-hub-globe-sphere-r418')||globe;
    const rect=sphere.getBoundingClientRect();
    if(rect.width<4||rect.height<4){location.assign(withVersion(href));return}

    saveRect(rect);
    try{sessionStorage.setItem(K_OPEN,String(now()))}catch(_){}

    if(reduced()){
      await wait(80);
      location.assign(withVersion(href));
      return;
    }

    const p=createPortal();
    const base=baseSize();
    const startCx=rect.left+rect.width/2,startCy=rect.top+rect.height/2;
    const startScale=Math.max(rect.width,rect.height)/base;
    const endScale=coverScale(base);
    const dx=innerWidth/2-startCx,dy=innerHeight/2-startCy;
    const duration=430;
    const finishNav=navigateAfter(href,duration);
    // If Android cancels the navigation for any reason, never leave the globe locked.
    setTimeout(()=>{if(document.visibilityState==='visible'&&document.body?.classList.contains('control-home-page'))resetInteractionR450()},2200);

    placeBase(p.orb,startCx,startCy,base);
    const clone=cleanClone(sphere);
    if(clone){clone.classList.add('andrik-map-portal-source-r450');p.orb.insertBefore(clone,p.map)}
    p.orb.style.transform=`translate3d(0,0,0) scale(${startScale})`;

    // One painted frame is enough; the old two-frame stall cost is removed.
    await new Promise(res=>requestAnimationFrame(res));
    sphere.classList.add('andrik-portal-source-hidden-r450');

    await Promise.all([
      animateSafe(p.back,[{opacity:0},{offset:.38,opacity:.48},{opacity:.88}],{duration,easing:'ease-out',fill:'forwards'}),
      animateSafe(p.orb,[
        {transform:`translate3d(0,0,0) scale(${startScale})`},
        {offset:.46,transform:`translate3d(${dx*.58}px,${dy*.58}px,0) scale(${startScale+(endScale-startScale)*.34})`},
        {transform:`translate3d(${dx}px,${dy}px,0) scale(${endScale})`}
      ],{duration,easing:'cubic-bezier(.20,.82,.22,1)',fill:'forwards'}),
      animateSafe(p.map,[
        {opacity:0,transform:'scale(1.05)'},
        {offset:.38,opacity:.10,transform:'scale(1.035)'},
        {offset:.72,opacity:.82,transform:'scale(1.01)'},
        {opacity:1,transform:'scale(1)'}
      ],{duration,easing:'ease-out',fill:'forwards'}),
      clone?animateSafe(clone,[{opacity:1},{offset:.52,opacity:.96},{opacity:0}],{duration,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
      animateSafe(p.flare,[{opacity:0,transform:'translate(-50%,-50%) scale(.35)'},{offset:.48,opacity:.78,transform:'translate(-50%,-50%) scale(1.25)'},{opacity:0,transform:'translate(-50%,-50%) scale(2.1)'}],{duration,easing:'ease-out',fill:'forwards'})
    ]);

    finishNav();
  }

  async function arriveMap(){
    let stamp=0;
    try{stamp=sessionStorage.getItem(K_OPEN)||sessionStorage.getItem('andrik-portal-map-open-r449') || sessionStorage.getItem('andrik-portal-map-open-r448')}catch(_){}
    if(!fresh(stamp)){
      document.documentElement.classList.remove('andrik-portal-map-arrival-pending-r450');
      return;
    }
    try{sessionStorage.removeItem(K_OPEN);sessionStorage.removeItem('andrik-portal-map-open-r449');sessionStorage.removeItem('andrik-portal-map-open-r448')}catch(_){}

    if(reduced()){
      document.documentElement.classList.remove('andrik-portal-map-arrival-pending-r450');
      return;
    }

    const p=createPortal(),base=baseSize(),scale=coverScale(base),duration=190;
    placeBase(p.orb,innerWidth/2,innerHeight/2,base);
    p.orb.style.transform=`translate3d(0,0,0) scale(${scale})`;
    p.map.style.opacity='1';p.back.style.opacity='.86';

    await Promise.all([
      animateSafe(p.root,[{opacity:1},{offset:.35,opacity:.96},{opacity:0}],{duration,easing:'ease-out',fill:'forwards'}),
      animateSafe(p.map,[{opacity:1},{opacity:.86}],{duration,easing:'ease-out',fill:'forwards'})
    ]);
    p.root.remove();
    document.documentElement.classList.remove('andrik-portal-map-arrival-pending-r450');
  }

  async function closeToAdmin(url){
    if(navigating)return;
    navigating=true;
    const target=readRect()||{cx:innerWidth*.5,cy:innerHeight*.70,size:94};
    try{sessionStorage.setItem(K_RETURN,String(now()))}catch(_){}

    if(reduced()){
      await wait(70);
      location.assign(withVersion(url));
      return;
    }

    const p=createPortal(),base=baseSize();
    const startScale=coverScale(base),endScale=target.size/base;
    const dx=target.cx-innerWidth/2,dy=target.cy-innerHeight/2;
    const duration=390;
    const finishNav=navigateAfter(url,duration);

    placeBase(p.orb,innerWidth/2,innerHeight/2,base);
    p.orb.style.transform=`translate3d(0,0,0) scale(${startScale})`;
    p.map.style.opacity='1';
    await new Promise(res=>requestAnimationFrame(res));

    await Promise.all([
      animateSafe(p.back,[{opacity:0},{offset:.30,opacity:.44},{opacity:.84}],{duration,easing:'ease-out',fill:'forwards'}),
      animateSafe(p.orb,[
        {transform:`translate3d(0,0,0) scale(${startScale})`},
        {offset:.54,transform:`translate3d(${dx*.70}px,${dy*.70}px,0) scale(${endScale+(startScale-endScale)*.30})`},
        {transform:`translate3d(${dx}px,${dy}px,0) scale(${endScale})`}
      ],{duration,easing:'cubic-bezier(.20,.82,.22,1)',fill:'forwards'}),
      animateSafe(p.map,[{opacity:1},{offset:.64,opacity:.92},{opacity:.10}],{duration,easing:'ease-out',fill:'forwards'}),
      animateSafe(p.flare,[{opacity:0},{offset:.64,opacity:.32},{opacity:.7}],{duration,easing:'ease-out',fill:'forwards'})
    ]);

    finishNav();
  }

  window.andrikMapPortalCloseR450=closeToAdmin;
  window.andrikMapPortalCloseR449=closeToAdmin;
  window.andrikMapPortalCloseR448=closeToAdmin;
  window.andrikMapPortalCloseR446=closeToAdmin;

  async function arriveAdmin(){
    let stamp=0;
    try{stamp=sessionStorage.getItem(K_RETURN)||sessionStorage.getItem('andrik-portal-return-r449') || sessionStorage.getItem('andrik-portal-return-r448')}catch(_){}
    if(!fresh(stamp)){
      document.documentElement.classList.remove('andrik-portal-return-pending-r450');
      return;
    }
    try{sessionStorage.removeItem(K_RETURN);sessionStorage.removeItem('andrik-portal-return-r449');sessionStorage.removeItem('andrik-portal-return-r448')}catch(_){}

    const sphere=document.getElementById('adminHubGlobeSphereR418');
    if(!sphere){document.documentElement.classList.remove('andrik-portal-return-pending-r450');return}
    if(reduced()){document.documentElement.classList.remove('andrik-portal-return-pending-r450');return}

    const rect=sphere.getBoundingClientRect(),p=createPortal(),base=baseSize();
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,scale=Math.max(rect.width,rect.height)/base;
    const clone=cleanClone(sphere);
    if(clone){clone.classList.add('andrik-map-portal-source-r450');p.orb.insertBefore(clone,p.map)}
    placeBase(p.orb,cx,cy,base);
    p.orb.style.transform=`translate3d(0,0,0) scale(${scale})`;
    p.map.style.opacity='1';p.back.style.opacity='.16';
    sphere.classList.add('andrik-portal-source-hidden-r450');

    await Promise.all([
      animateSafe(p.map,[{opacity:1,transform:'scale(1.025)'},{opacity:0,transform:'scale(1)'}],{duration:220,easing:'ease-out',fill:'forwards'}),
      clone?animateSafe(clone,[{opacity:.12},{opacity:1}],{duration:220,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
      animateSafe(p.back,[{opacity:.16},{opacity:0}],{duration:220,easing:'ease-out',fill:'forwards'})
    ]);

    sphere.classList.remove('andrik-portal-source-hidden-r450');
    p.root.remove();
    document.documentElement.classList.remove('andrik-portal-return-pending-r450');
    resetInteractionR450();
  }

  function globeFrom(e){return e.target?.closest?.('#adminHubGlobeR418')||null}
  document.addEventListener('pointerdown',e=>{
    const g=globeFrom(e);if(!g||e.isPrimary===false)return;
    press={g,id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};
  },true);
  document.addEventListener('pointerup',e=>{
    if(!press||press.id!==e.pointerId)return;
    const p0=press;press=null;
    const g=globeFrom(e)||p0.g;
    const dist=Math.hypot(e.clientX-p0.x,e.clientY-p0.y),dt=performance.now()-p0.t;
    if(!g||dist>22||dt>1600)return;
    e.preventDefault();e.stopImmediatePropagation();open(g);
  },true);
  document.addEventListener('pointercancel',()=>{press=null},true);
  document.addEventListener('click',e=>{
    const g=globeFrom(e);if(!g)return;
    if(performance.now()<suppressClickUntil||navigating){e.preventDefault();e.stopImmediatePropagation();return}
    e.preventDefault();e.stopImmediatePropagation();open(g);
  },true);
  addEventListener('pageshow',()=>{resetInteractionR450();requestAnimationFrame(()=>{const s=document.getElementById('adminHubGlobeSphereR418');s?.classList.remove('andrik-portal-source-hidden-r450','andrik-portal-source-hidden-r449')})},{passive:true});

  const route=new URL(location.href),page=(route.searchParams.get('page')||'').toLowerCase(),source=(route.searchParams.get('source')||'').toLowerCase();
  const isHome=document.body?.classList.contains('control-home-page');
  const isMap=document.body?.classList.contains('analytics-admin-page')&&page==='map'&&source==='admin-globe';
  if(isHome)arriveAdmin();
  if(isMap)arriveMap();
})();
