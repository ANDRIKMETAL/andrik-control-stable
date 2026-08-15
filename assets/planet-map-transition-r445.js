/* ANDRIK R445 — safe cross-page portal between Admin globe and listener world map. */
(()=>{
  'use strict';
  if(window.__ANDRIK_PLANET_MAP_TRANSITION_R445__)return;
  window.__ANDRIK_PLANET_MAP_TRANSITION_R445__=true;

  const K_RECT='andrik-portal-globe-rect-r445';
  const K_OPEN='andrik-portal-map-open-r445';
  const K_RETURN='andrik-portal-return-r445';
  const D_OPEN=620,D_CLOSE=540;
  const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const now=()=>Date.now();
  const fresh=v=>{const n=Number(v||0);return n>0&&now()-n<8000};
  const cleanClone=node=>{if(!node)return null;const c=node.cloneNode(true);if(c.id)c.removeAttribute('id');c.querySelectorAll?.('[id]').forEach(x=>x.removeAttribute('id'));return c};
  const portalRoot=()=>{
    const root=document.createElement('div');root.className='andrik-map-portal-r445';root.setAttribute('aria-hidden','true');
    const back=document.createElement('div');back.className='andrik-map-portal-backdrop-r445';
    const orb=document.createElement('div');orb.className='andrik-map-portal-orb-r445';
    const map=document.createElement('div');map.className='andrik-map-portal-map-r445';
    const flare=document.createElement('div');flare.className='andrik-map-portal-flare-r445';
    orb.append(map,flare);root.append(back,orb);document.body.append(root);return {root,back,orb,map,flare};
  };
  const orbAt=(orb,cx,cy,size)=>{orb.style.left=(cx-size/2)+'px';orb.style.top=(cy-size/2)+'px';orb.style.width=size+'px';orb.style.height=size+'px';};
  const viewportTarget=()=>{const d=Math.hypot(innerWidth,innerHeight)*1.08;return{cx:innerWidth/2,cy:innerHeight/2,size:d}};
  const saveRect=rect=>{try{const min=Math.max(1,Math.min(innerWidth,innerHeight));sessionStorage.setItem(K_RECT,JSON.stringify({x:(rect.left+rect.width/2)/innerWidth,y:(rect.top+rect.height/2)/innerHeight,s:Math.max(rect.width,rect.height)/min,t:now()}))}catch(_){}};
  const readRect=()=>{try{const o=JSON.parse(sessionStorage.getItem(K_RECT)||'null');if(!o||!fresh(o.t))return null;const min=Math.max(1,Math.min(innerWidth,innerHeight));return{cx:o.x*innerWidth,cy:o.y*innerHeight,size:Math.max(74,o.s*min)}}catch(_){return null}};
  const animate=(el,keyframes,options)=>{try{return el.animate(keyframes,options).finished.catch(()=>{})}catch(_){return Promise.resolve()}};

  async function openFromGlobe(globe,href){
    if(window.__ANDRIK_PORTAL_NAVIGATING_R445__)return;
    window.__ANDRIK_PORTAL_NAVIGATING_R445__=true;
    const sphere=globe.querySelector('#adminHubGlobeSphereR418,.admin-hub-globe-sphere-r418')||globe;
    const rect=sphere.getBoundingClientRect();saveRect(rect);
    try{sessionStorage.setItem(K_OPEN,String(now()))}catch(_){ }
    if(reduced()){location.assign(href);return}
    const p=portalRoot();
    const clone=cleanClone(sphere);if(clone){clone.classList.add('andrik-map-portal-source-r445');p.orb.insertBefore(clone,p.map)}
    orbAt(p.orb,rect.left+rect.width/2,rect.top+rect.height/2,Math.max(rect.width,rect.height));
    p.root.classList.add('is-opening');
    sphere.classList.add('andrik-portal-source-hidden-r445');
    const target=viewportTarget();
    const dx=target.cx-(rect.left+rect.width/2),dy=target.cy-(rect.top+rect.height/2),scale=target.size/Math.max(rect.width,rect.height);
    animate(p.orb,[{transform:'translate3d(0,0,0) scale(1) rotate(0deg)'},{offset:.42,transform:`translate3d(${dx*.58}px,${dy*.58}px,0) scale(${1+(scale-1)*.38}) rotate(4deg)`},{transform:`translate3d(${dx}px,${dy}px,0) scale(${scale}) rotate(8deg)`}],{duration:D_OPEN,easing:'cubic-bezier(.22,.82,.18,1)',fill:'forwards'});
    await wait(D_OPEN-28);
    location.assign(href);
  }

  async function arriveOnMap(){
    let stamp=0;try{stamp=sessionStorage.getItem(K_OPEN)}catch(_){ }
    if(!fresh(stamp)){document.documentElement.classList.remove('andrik-portal-map-arrival-pending-r445');return}
    try{sessionStorage.removeItem(K_OPEN)}catch(_){ }
    if(reduced()){document.documentElement.classList.remove('andrik-portal-map-arrival-pending-r445');return}
    const p=portalRoot(),t=viewportTarget();orbAt(p.orb,t.cx,t.cy,t.size);p.root.classList.add('is-arriving');
    p.orb.style.transform='scale(1.02)';
    await Promise.all([
      animate(p.root,[{opacity:1},{offset:.52,opacity:.92},{opacity:0}],{duration:480,easing:'ease-out',fill:'forwards'}),
      animate(p.orb,[{transform:'scale(1.025)'},{transform:'scale(.985)'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'})
    ]);
    p.root.remove();document.documentElement.classList.remove('andrik-portal-map-arrival-pending-r445');
  }

  async function closeToAdmin(url){
    if(window.__ANDRIK_PORTAL_NAVIGATING_R445__)return;
    window.__ANDRIK_PORTAL_NAVIGATING_R445__=true;
    if(reduced()){try{sessionStorage.setItem(K_RETURN,String(now()))}catch(_){ }location.assign(url);return}
    const p=portalRoot(),start=viewportTarget(),target=readRect()||{cx:innerWidth*.5,cy:innerHeight*.70,size:94};
    orbAt(p.orb,start.cx,start.cy,start.size);p.map.style.opacity='1';p.orb.style.transform='scale(1)';p.root.classList.add('is-closing');
    await wait(24);
    const dx=target.cx-start.cx,dy=target.cy-start.cy,scale=target.size/start.size;
    const a1=animate(p.orb,[{transform:'translate3d(0,0,0) scale(1) rotate(0deg)'},{offset:.56,transform:`translate3d(${dx*.72}px,${dy*.72}px,0) scale(${.42+(scale*.58)}) rotate(-4deg)`},{transform:`translate3d(${dx}px,${dy}px,0) scale(${scale}) rotate(-8deg)`}],{duration:D_CLOSE,easing:'cubic-bezier(.22,.82,.18,1)',fill:'forwards'});
    const a2=animate(p.map,[{opacity:1},{offset:.66,opacity:.9},{opacity:.18}],{duration:D_CLOSE,easing:'ease',fill:'forwards'});
    const a3=animate(p.back,[{opacity:0},{offset:.24,opacity:.58},{opacity:.96}],{duration:D_CLOSE,easing:'ease',fill:'forwards'});
    await Promise.all([a1,a2,a3]);
    try{sessionStorage.setItem(K_RETURN,String(now()))}catch(_){ }
    location.assign(url);
  }
  window.andrikMapPortalCloseR445=closeToAdmin;

  async function arriveOnAdmin(){
    let stamp=0;try{stamp=sessionStorage.getItem(K_RETURN)}catch(_){ }
    if(!fresh(stamp)){document.documentElement.classList.remove('andrik-portal-return-pending-r445');return}
    try{sessionStorage.removeItem(K_RETURN)}catch(_){ }
    const globe=document.getElementById('adminHubGlobeR418');const sphere=document.getElementById('adminHubGlobeSphereR418');
    if(!globe||!sphere){document.documentElement.classList.remove('andrik-portal-return-pending-r445');return}
    const rect=sphere.getBoundingClientRect();
    if(reduced()){document.documentElement.classList.remove('andrik-portal-return-pending-r445');sphere.style.opacity='';return}
    const p=portalRoot(),clone=cleanClone(sphere);if(clone){clone.classList.add('andrik-map-portal-source-r445');p.orb.insertBefore(clone,p.map)}
    orbAt(p.orb,rect.left+rect.width/2,rect.top+rect.height/2,Math.max(rect.width,rect.height));
    p.map.style.opacity='1';p.root.style.background='transparent';p.back.style.opacity='.28';sphere.classList.add('andrik-portal-source-hidden-r445');
    await Promise.all([
      animate(p.map,[{opacity:1,transform:'scale(1.06)'},{opacity:0,transform:'scale(1)'}],{duration:380,easing:'ease-out',fill:'forwards'}),
      animate(clone||p.orb,[{opacity:.05,transform:'scale(.92)'},{opacity:1,transform:'scale(1)'}],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}),
      animate(p.orb,[{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:440,easing:'ease-out',fill:'forwards'})
    ]);
    sphere.classList.remove('andrik-portal-source-hidden-r445');p.root.remove();document.documentElement.classList.remove('andrik-portal-return-pending-r445');
  }

  function bindGlobe(){
    const globe=document.getElementById('adminHubGlobeR418');if(!globe||globe.dataset.portalR445==='1')return;
    globe.dataset.portalR445='1';
    globe.addEventListener('click',e=>{if(e.defaultPrevented||window.__ANDRIK_PORTAL_NAVIGATING_R445__)return;e.preventDefault();e.stopImmediatePropagation();const href=globe.href||'/analytics-admin.html?page=map&source=admin-globe&v=55.00-r445';openFromGlobe(globe,href)},true);
  }

  const url=new URL(location.href);const page=(url.searchParams.get('page')||'').toLowerCase(),source=(url.searchParams.get('source')||'').toLowerCase();
  const isMap=document.body?.classList.contains('analytics-admin-page')&&page==='map'&&source==='admin-globe';
  const isHome=document.body?.classList.contains('control-home-page');
  if(isHome){bindGlobe();arriveOnAdmin();}
  if(isMap)arriveOnMap();
})();
