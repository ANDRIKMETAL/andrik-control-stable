(()=>{
  'use strict';
  if(window.__andrikR73MapUiLockReady)return;
  window.__andrikR73MapUiLockReady=true;

  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  if(!map||!list)return;

  const decode=v=>{try{return decodeURIComponent(String(v||''))}catch(_){return String(v||'')}};
  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const countryToFlag=code=>{
    const cc=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(cc))return '🌍';
    return String.fromCodePoint(...[...cc].map(ch=>127397+ch.charCodeAt(0)));
  };
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,.world-map-dot[aria-current="true"]');
  }
  function selectedCountry(){
    const fromMap=String(map.dataset.focusCountry||'').trim();
    if(fromMap)return fromMap;
    const direct=list.querySelector('.world-country-selected-card.is-selected,.world-country-button.is-selected,.world-country-selected-card[aria-pressed="true"],.world-country-button[aria-pressed="true"]');
    if(direct)return decode(direct.dataset.country).trim();
    const marker=selectedMarker();
    return marker?decode(marker.dataset.country).trim():'';
  }
  function selectedSource(country){
    const direct=list.querySelector('.world-country-selected-card.is-selected,.world-country-button.is-selected,.world-country-selected-card[aria-pressed="true"],.world-country-button[aria-pressed="true"]');
    if(direct)return direct;
    return [...list.querySelectorAll('.world-country-selected-card,.world-country-button')].find(node=>decode(node.dataset.country).trim()===country)||null;
  }

  function ensureLabel(){
    let node=document.getElementById('landscapeCountryLabelR73');
    if(!node){
      node=document.createElement('div');
      node.id='landscapeCountryLabelR73';
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
      node.innerHTML='<span class="r73-country-dot" aria-hidden="true"></span><span class="r73-country-flag" aria-hidden="true"></span><span class="r73-country-name"></span>';
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

  function update(){
    const node=ensureLabel();
    if(!isLandscape())return hide();
    const marker=selectedMarker();
    const country=selectedCountry();
    if(!marker||!country)return hide();

    const source=selectedSource(country);
    const code=String(source?.dataset?.code||marker?.dataset?.code||'').trim().toUpperCase();
    const flagText=(source?.querySelector('.world-country-flag')?.textContent||'').trim()||countryToFlag(code);
    const nameText=(source?.querySelector('.world-country-name .world-country-marquee')?.textContent||source?.querySelector('.world-country-name')?.textContent||country).trim()||country;

    node.querySelector('.r73-country-flag').textContent=flagText;
    node.querySelector('.r73-country-name').textContent=nameText;
    node.hidden=false;
    node.setAttribute('aria-hidden','false');

    const markerRect=marker.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const width=Math.max(60,node.offsetWidth||160);
    const height=Math.max(20,node.offsetHeight||22);
    const half=width/2;
    const left=clamp(markerRect.left+markerRect.width/2,mapRect.left+12+half,mapRect.right-12-half);
    let top=markerRect.bottom+12;
    const maxTop=mapRect.bottom-height-8;
    if(top>maxTop)top=Math.max(mapRect.top+8,markerRect.top-height-10);
    node.style.setProperty('left',left.toFixed(1)+'px','important');
    node.style.setProperty('top',top.toFixed(1)+'px','important');
  }

  const delayedUpdate=()=>{clearTimeout(delayedUpdate._a);clearTimeout(delayedUpdate._b);delayedUpdate._a=setTimeout(update,30);delayedUpdate._b=setTimeout(update,220)};
  new MutationObserver(delayedUpdate).observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-focus-country','aria-current']});
  new MutationObserver(delayedUpdate).observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-selected-country','aria-pressed','data-country','data-code']});
  document.addEventListener('click',ev=>{if(ev.target.closest?.('.world-map-dot,.world-country-button,.world-country-selected-card'))delayedUpdate()},true);
  window.addEventListener('resize',delayedUpdate,{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(update,80);setTimeout(update,260)},{passive:true});
  window.addEventListener('pageshow',delayedUpdate,{passive:true});
  window.addEventListener('andrik:country-focus-changed',delayedUpdate);

  update();
  setTimeout(update,300);
  setTimeout(update,900);
})();
