/* ANDRIK R448 — guaranteed visible cross-page portal for Admin globe and world map. */
(()=>{
  'use strict';
  if(window.__ANDRIK_PLANET_MAP_TRANSITION_R448__)return;
  window.__ANDRIK_PLANET_MAP_TRANSITION_R448__=true;
  const K_RECT='andrik-portal-globe-rect-r448',K_OPEN='andrik-portal-map-open-r448',K_RETURN='andrik-portal-return-r448';
  const now=()=>Date.now(),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}};
  const openMs=()=>reduce()?360:760,closeMs=()=>reduce()?320:620;
  const fresh=v=>{const n=Number(v||0);return n>0&&now()-n<12000};
  const animate=(el,k,o)=>{try{return el.animate(k,o).finished.catch(()=>{})}catch(_){return wait(Number(o?.duration||0))}};
  const cloneClean=node=>{if(!node)return null;const c=node.cloneNode(true);c.removeAttribute?.('id');c.querySelectorAll?.('[id]').forEach(x=>x.removeAttribute('id'));return c};
  const portal=()=>{const root=document.createElement('div');root.className='andrik-map-portal-r448';const back=document.createElement('div');back.className='andrik-map-portal-backdrop-r448';const orb=document.createElement('div');orb.className='andrik-map-portal-orb-r448';const map=document.createElement('div');map.className='andrik-map-portal-map-r448';const flare=document.createElement('div');flare.className='andrik-map-portal-flare-r448';orb.append(map,flare);root.append(back,orb);document.body.append(root);return{root,back,orb,map,flare}};
  const place=(orb,cx,cy,size)=>{orb.style.left=`${cx-size/2}px`;orb.style.top=`${cy-size/2}px`;orb.style.width=`${size}px`;orb.style.height=`${size}px`};
  const target=()=>{const size=Math.hypot(innerWidth,innerHeight)*1.18;return{cx:innerWidth/2,cy:innerHeight/2,size}};
  const saveRect=r=>{try{const m=Math.max(1,Math.min(innerWidth,innerHeight));sessionStorage.setItem(K_RECT,JSON.stringify({x:(r.left+r.width/2)/innerWidth,y:(r.top+r.height/2)/innerHeight,s:Math.max(r.width,r.height)/m,t:now()}))}catch(_){}};
  const readRect=()=>{try{const o=JSON.parse(sessionStorage.getItem(K_RECT)||'null');if(!o||!fresh(o.t))return null;const m=Math.max(1,Math.min(innerWidth,innerHeight));return{cx:o.x*innerWidth,cy:o.y*innerHeight,size:Math.max(76,o.s*m)}}catch(_){return null}};
  let navigating=false,suppressClickUntil=0,press=null;

  async function open(globe){
    if(navigating)return;navigating=true;suppressClickUntil=performance.now()+1600;
    const href=globe.href||'/analytics-admin.html?page=map&source=admin-globe&v=55.00-r448';
    const sphere=globe.querySelector('#adminHubGlobeSphereR418,.admin-hub-globe-sphere-r418')||globe;
    const r=sphere.getBoundingClientRect();saveRect(r);try{sessionStorage.setItem(K_OPEN,String(now()))}catch(_){}
    const p=portal(),c=cloneClean(sphere);if(c){c.classList.add('andrik-map-portal-source-r448');p.orb.insertBefore(c,p.map)}
    place(p.orb,r.left+r.width/2,r.top+r.height/2,Math.max(r.width,r.height));
    sphere.classList.add('andrik-portal-source-hidden-r448');
    // Two frames guarantee the starting globe is actually painted before expansion begins.
    await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));
    const t=target(),dx=t.cx-(r.left+r.width/2),dy=t.cy-(r.top+r.height/2),scale=t.size/Math.max(r.width,r.height),d=openMs();
    await Promise.all([
      animate(p.back,[{opacity:0},{offset:.35,opacity:.58},{opacity:.94}],{duration:d,easing:'ease-out',fill:'forwards'}),
      animate(p.orb,[{transform:'translate3d(0,0,0) scale(1) rotate(0deg)'},{offset:.32,transform:`translate3d(${dx*.28}px,${dy*.28}px,0) scale(${1+(scale-1)*.16}) rotate(5deg)`},{offset:.67,transform:`translate3d(${dx*.72}px,${dy*.72}px,0) scale(${1+(scale-1)*.58}) rotate(10deg)`},{transform:`translate3d(${dx}px,${dy}px,0) scale(${scale}) rotate(14deg)`}],{duration:d,easing:'cubic-bezier(.16,.82,.18,1)',fill:'forwards'}),
      animate(p.map,[{opacity:0,transform:'scale(1.14)'},{offset:.28,opacity:.05},{offset:.60,opacity:.72,transform:'scale(1.04)'},{opacity:1,transform:'scale(1)'}],{duration:d,easing:'ease-out',fill:'forwards'}),
      c?animate(c,[{opacity:1},{offset:.48,opacity:.92},{opacity:0}],{duration:d,easing:'ease-out',fill:'forwards'}):Promise.resolve(),
      animate(p.flare,[{opacity:0,transform:'translate(-50%,-50%) scale(.15)'},{offset:.34,opacity:1,transform:'translate(-50%,-50%) scale(1.7)'},{offset:.64,opacity:.34,transform:'translate(-50%,-50%) scale(4)'},{opacity:0,transform:'translate(-50%,-50%) scale(5.4)'}],{duration:d,easing:'ease-out',fill:'forwards'})
    ]);
    location.assign(href.replace(/([?&])v=[^&]*/,'$1v=55.00-r448'));
  }

  async function arriveMap(){
    let stamp=0;try{stamp=sessionStorage.getItem(K_OPEN)}catch(_){}if(!fresh(stamp))return;try{sessionStorage.removeItem(K_OPEN)}catch(_){}
    const p=portal(),t=target();place(p.orb,t.cx,t.cy,t.size);p.map.style.opacity='1';p.back.style.opacity='.92';
    await Promise.all([animate(p.root,[{opacity:1},{offset:.55,opacity:.86},{opacity:0}],{duration:reduce()?220:420,easing:'ease-out',fill:'forwards'}),animate(p.orb,[{transform:'scale(1.03)'},{transform:'scale(.99)'}],{duration:reduce()?220:420,easing:'ease-out',fill:'forwards'})]);
    p.root.remove();
  }

  async function closeToAdmin(url){
    if(navigating)return;navigating=true;const p=portal(),s=target(),r=readRect()||{cx:innerWidth*.5,cy:innerHeight*.70,size:96};place(p.orb,s.cx,s.cy,s.size);p.map.style.opacity='1';
    await new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(res)));const dx=r.cx-s.cx,dy=r.cy-s.cy,scale=r.size/s.size,d=closeMs();
    await Promise.all([
      animate(p.back,[{opacity:0},{offset:.28,opacity:.62},{opacity:.94}],{duration:d,easing:'ease-out',fill:'forwards'}),
      animate(p.orb,[{transform:'translate3d(0,0,0) scale(1)'},{offset:.58,transform:`translate3d(${dx*.72}px,${dy*.72}px,0) scale(${.42+scale*.58})`},{transform:`translate3d(${dx}px,${dy}px,0) scale(${scale})`}],{duration:d,easing:'cubic-bezier(.16,.82,.18,1)',fill:'forwards'}),
      animate(p.map,[{opacity:1},{offset:.68,opacity:.9},{opacity:.12}],{duration:d,easing:'ease-out',fill:'forwards'})
    ]);
    try{sessionStorage.setItem(K_RETURN,String(now()))}catch(_){}location.assign(url.replace(/([?&])v=[^&]*/,'$1v=55.00-r448'));
  }
  window.andrikMapPortalCloseR448=closeToAdmin;
  window.andrikMapPortalCloseR446=closeToAdmin; // keep existing map return hooks working

  async function arriveAdmin(){let stamp=0;try{stamp=sessionStorage.getItem(K_RETURN)}catch(_){}if(!fresh(stamp))return;try{sessionStorage.removeItem(K_RETURN)}catch(_){}
    const sphere=document.getElementById('adminHubGlobeSphereR418');if(!sphere)return;const r=sphere.getBoundingClientRect(),p=portal(),c=cloneClean(sphere);if(c){c.classList.add('andrik-map-portal-source-r448');p.orb.insertBefore(c,p.map)}place(p.orb,r.left+r.width/2,r.top+r.height/2,Math.max(r.width,r.height));p.map.style.opacity='1';sphere.classList.add('andrik-portal-source-hidden-r448');
    await Promise.all([animate(p.map,[{opacity:1,transform:'scale(1.08)'},{opacity:0,transform:'scale(1)'}],{duration:reduce()?220:360,easing:'ease-out',fill:'forwards'}),c?animate(c,[{opacity:.1},{opacity:1}],{duration:reduce()?220:360,easing:'ease-out',fill:'forwards'}):Promise.resolve()]);sphere.classList.remove('andrik-portal-source-hidden-r448');p.root.remove();}

  function globeFrom(e){return e.target?.closest?.('#adminHubGlobeR418')||null}
  document.addEventListener('pointerdown',e=>{const g=globeFrom(e);if(!g||e.isPrimary===false)return;press={g,id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()}},true);
  document.addEventListener('pointerup',e=>{if(!press||press.id!==e.pointerId)return;const p0=press;press=null;const g=globeFrom(e)||p0.g,dist=Math.hypot(e.clientX-p0.x,e.clientY-p0.y),dt=performance.now()-p0.t;if(!g||dist>22||dt>1600)return;e.preventDefault();e.stopImmediatePropagation();open(g)},true);
  document.addEventListener('pointercancel',()=>{press=null},true);
  document.addEventListener('click',e=>{const g=globeFrom(e);if(!g)return;if(performance.now()<suppressClickUntil||navigating){e.preventDefault();e.stopImmediatePropagation();return}e.preventDefault();e.stopImmediatePropagation();open(g)},true);
  addEventListener('pageshow',()=>{navigating=false;press=null;suppressClickUntil=0},{passive:true});

  const route=new URL(location.href),page=(route.searchParams.get('page')||'').toLowerCase(),source=(route.searchParams.get('source')||'').toLowerCase();
  const isHome=document.body?.classList.contains('control-home-page');const isMap=document.body?.classList.contains('analytics-admin-page')&&page==='map'&&source==='admin-globe';
  if(isHome)arriveAdmin();if(isMap)arriveMap();
})();
