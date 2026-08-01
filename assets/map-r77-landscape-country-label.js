(()=>{
  'use strict';
  if(window.__andrikR77LandscapeCountryLabelReady)return;
  window.__andrikR77LandscapeCountryLabelReady=true;

  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  if(!map||!list)return;

  const decode=value=>{
    try{return decodeURIComponent(String(value||''))}
    catch(_){return String(value||'')}
  };
  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const countryToFlag=code=>{
    const cc=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(cc))return '🌍';
    return String.fromCodePoint(...[...cc].map(char=>127397+char.charCodeAt(0)));
  };

  let activeCountry='';
  let activeCode='';
  let followRaf=0;
  let followUntil=0;
  let updateTimer=0;

  function markerByCountry(country){
    const wanted=String(country||'').trim();
    if(!wanted)return null;
    return [...map.querySelectorAll('.world-map-dot[data-country]')]
      .find(marker=>decode(marker.dataset.country).trim()===wanted)||null;
  }

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,.world-map-dot[aria-current="true"]');
  }

  function sourceByCountry(country){
    const wanted=String(country||'').trim();
    if(!wanted)return null;
    return [...list.querySelectorAll('.world-country-button[data-country],.world-country-selected-card[data-country]')]
      .find(node=>decode(node.dataset.country).trim()===wanted)||null;
  }

  function ensureLabel(){
    let node=document.getElementById('landscapeCountryLabelR77');
    if(!node){
      node=document.createElement('div');
      node.id='landscapeCountryLabelR77';
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
      node.innerHTML='<span class="r77-country-flag" aria-hidden="true"></span><span class="r77-country-name"></span>';
      document.body.appendChild(node);
    }
    return node;
  }

  function hide(){
    const node=ensureLabel();
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
    node.style.removeProperty('left');
    node.style.removeProperty('top');
  }

  function setActive(country,code=''){
    const next=String(country||'').trim();
    if(!next){
      activeCountry='';
      activeCode='';
      hide();
      return;
    }
    activeCountry=next;
    activeCode=String(code||'').trim().toUpperCase();
    follow(1200);
  }

  function resolveCurrent(){
    /* The last touched/event country has priority. This avoids the old name
       remaining visible while switching directly between already zoomed countries. */
    let country=activeCountry;
    let marker=markerByCountry(country);

    if(!country||!marker){
      marker=selectedMarker();
      country=marker?decode(marker.dataset.country).trim():'';
    }

    if(!country||!marker)return null;
    const code=String(activeCode||marker.dataset.code||'').trim().toUpperCase();
    return {country,code,marker};
  }

  function update(){
    const node=ensureLabel();
    if(!isLandscape())return hide();

    const current=resolveCurrent();
    if(!current)return hide();

    const source=sourceByCountry(current.country);
    const code=String(source?.dataset?.code||current.code||current.marker.dataset.code||'').trim().toUpperCase();
    const flag=(source?.querySelector('.world-country-flag')?.textContent||'').trim()||countryToFlag(code);
    const name=(source?.querySelector('.world-country-marquee')?.textContent
      ||source?.querySelector('.world-country-name')?.textContent
      ||current.country).trim()||current.country;

    node.querySelector('.r77-country-flag').textContent=flag;
    node.querySelector('.r77-country-name').textContent=name;
    node.hidden=false;
    node.setAttribute('aria-hidden','false');

    const markerRect=current.marker.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const labelHeight=Math.max(20,node.offsetHeight||24);
    const centerX=markerRect.left+(markerRect.width/2);
    let top=markerRect.bottom+10;

    /* Keep the caption centered under the point. If the point is too low,
       place it directly above rather than changing the horizontal center. */
    if(top+labelHeight>mapRect.bottom-6){
      top=Math.max(mapRect.top+6,markerRect.top-labelHeight-9);
    }

    node.style.setProperty('left',`${centerX.toFixed(1)}px`,'important');
    node.style.setProperty('top',`${top.toFixed(1)}px`,'important');
  }

  function follow(milliseconds=900){
    followUntil=Math.max(followUntil,performance.now()+milliseconds);
    if(followRaf)return;
    const tick=now=>{
      update();
      if(now<followUntil)followRaf=requestAnimationFrame(tick);
      else followRaf=0;
    };
    followRaf=requestAnimationFrame(tick);
  }

  function rememberMarker(target){
    const marker=target?.closest?.('.world-map-dot[data-country]');
    if(!marker)return false;
    setActive(decode(marker.dataset.country).trim(),marker.dataset.code||'');
    return true;
  }

  /* Capture the new country before the old selected state can be reused. */
  document.addEventListener('pointerdown',event=>{
    if(isLandscape())rememberMarker(event.target);
  },true);

  document.addEventListener('click',event=>{
    if(isLandscape())rememberMarker(event.target);
  },true);

  window.addEventListener('andrik:country-focus-changed',event=>{
    const detail=event?.detail||{};
    if(detail.focused&&detail.country){
      const country=String(detail.country).trim();
      const marker=markerByCountry(country);
      setActive(country,marker?.dataset?.code||'');
    }else{
      setActive('','');
    }
  });

  const observer=new MutationObserver(()=>{
    clearTimeout(updateTimer);
    updateTimer=setTimeout(()=>{
      /* Do not overwrite activeCountry with a delayed old dataset value. */
      update();
      if(activeCountry)follow(450);
    },20);
  });
  observer.observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-current','data-focus-country']});
  observer.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed','data-selected-country']});

  window.addEventListener('resize',()=>follow(350),{passive:true});
  window.addEventListener('orientationchange',()=>{
    setTimeout(update,80);
    setTimeout(update,260);
  },{passive:true});
  window.addEventListener('pageshow',()=>setTimeout(update,120),{passive:true});

  ensureLabel();
  setTimeout(update,300);
  setTimeout(update,900);
})();
