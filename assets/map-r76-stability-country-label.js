(()=>{
  'use strict';
  if(window.__andrikR76StabilityCountryLabelReady)return;
  window.__andrikR76StabilityCountryLabelReady=true;

  const pane=document.querySelector('.analytics-map-pane');
  const wrap=pane?.querySelector('.analytics-map-pane-wrap');
  const header=wrap?.querySelector('.analytics-compact-header');
  const card=wrap?.querySelector('.analytics-map-top');
  const titleRow=card?.querySelector('.map-landscape-title-row');
  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  if(!pane||!wrap||!header||!card||!titleRow||!map||!list)return;

  const decode=value=>{try{return decodeURIComponent(String(value||''))}catch(_){return String(value||'')}};
  const isPortrait=()=>window.matchMedia?.('(orientation:portrait)')?.matches===true;
  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const onMap=()=>document.body?.dataset?.analyticsPage==='map';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const countryToFlag=code=>{
    const cc=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(cc))return '🌍';
    return String.fromCodePoint(...[...cc].map(ch=>127397+ch.charCodeAt(0)));
  };

  /* ---------- Portrait: freeze the card's real top and all geometry above the map. ---------- */
  let portraitLocked=false;
  let portraitWidth=0;
  let lockTimer=0;
  let heightRaf=0;

  function clearPortraitLock(){
    clearTimeout(lockTimer);
    portraitLocked=false;
    portraitWidth=0;
    wrap.classList.remove('r76-portrait-locked');
    ['--r76-wrap-height','--r76-header-height','--r76-map-card-top','--r76-map-card-width','--r76-title-height','--r76-map-height','--r76-wrap-pad-top'].forEach(name=>wrap.style.removeProperty(name));
  }

  function syncPortraitHeight(){
    if(!portraitLocked||!isPortrait())return;
    cancelAnimationFrame(heightRaf);
    heightRaf=requestAnimationFrame(()=>{
      const top=parseFloat(wrap.style.getPropertyValue('--r76-map-card-top'))||0;
      const needed=Math.ceil(top+card.offsetHeight+8);
      wrap.style.setProperty('--r76-wrap-height',`${Math.max(needed,pane.clientHeight||0)}px`);
    });
  }

  function capturePortraitLock(force=false){
    if(!isPortrait()||!onMap())return;
    const width=Math.round(window.visualViewport?.width||window.innerWidth||0);
    if(portraitLocked&&!force&&Math.abs(width-portraitWidth)<18){
      syncPortraitHeight();
      return;
    }

    wrap.classList.remove('r76-portrait-locked');
    wrap.style.removeProperty('--r76-wrap-height');
    requestAnimationFrame(()=>{
      if(!isPortrait()||!onMap())return;
      const wrapRect=wrap.getBoundingClientRect();
      const headerRect=header.getBoundingClientRect();
      const cardRect=card.getBoundingClientRect();
      const titleRect=titleRow.getBoundingClientRect();
      const mapRect=map.getBoundingClientRect();
      const cardTop=Math.max(0,cardRect.top-wrapRect.top);
      wrap.style.setProperty('--r76-wrap-pad-top',`${Math.max(0,parseFloat(getComputedStyle(wrap).paddingTop)||0)}px`);
      wrap.style.setProperty('--r76-header-height',`${Math.max(1,headerRect.height).toFixed(2)}px`);
      wrap.style.setProperty('--r76-map-card-top',`${cardTop.toFixed(2)}px`);
      wrap.style.setProperty('--r76-map-card-width',`${Math.max(1,cardRect.width).toFixed(2)}px`);
      wrap.style.setProperty('--r76-title-height',`${Math.max(1,titleRect.height).toFixed(2)}px`);
      wrap.style.setProperty('--r76-map-height',`${Math.max(1,mapRect.height).toFixed(2)}px`);
      portraitWidth=width;
      portraitLocked=true;
      wrap.classList.add('r76-portrait-locked');
      syncPortraitHeight();
    });
  }

  function schedulePortraitLock(delay=180,force=false){
    clearTimeout(lockTimer);
    lockTimer=setTimeout(()=>capturePortraitLock(force),delay);
  }

  const cardResizeObserver=new ResizeObserver(()=>syncPortraitHeight());
  cardResizeObserver.observe(card);

  /* Do not re-measure when a country is selected: that was the source of the visible jump. */
  window.addEventListener('andrik:country-focus-changed',()=>{
    if(isPortrait())syncPortraitHeight();
  });

  let lastOrientation=isPortrait()?'portrait':'landscape';
  window.addEventListener('resize',()=>{
    const orientation=isPortrait()?'portrait':'landscape';
    if(orientation!==lastOrientation){
      lastOrientation=orientation;
      clearPortraitLock();
      if(orientation==='portrait')schedulePortraitLock(260,true);
      return;
    }
    if(isPortrait()&&Math.abs((window.visualViewport?.width||window.innerWidth)-portraitWidth)>=18){
      clearPortraitLock();
      schedulePortraitLock(220,true);
    }else if(isPortrait())syncPortraitHeight();
  },{passive:true});

  window.addEventListener('pageshow',()=>{
    if(isPortrait())schedulePortraitLock(220,true);
  },{passive:true});
  window.addEventListener('andrik:analytics-page-changed',event=>{
    if(event?.detail?.page==='map'&&isPortrait())schedulePortraitLock(180,!portraitLocked);
  });
  document.fonts?.ready?.then(()=>{if(isPortrait())schedulePortraitLock(120,true)}).catch(()=>{});

  /* ---------- Landscape: flag + current country name under the transformed marker. ---------- */
  let activeCountry='';
  let activeCode='';
  let followUntil=0;
  let followRaf=0;
  let updateTimer=0;

  function markerByCountry(country){
    if(!country)return null;
    return [...map.querySelectorAll('.world-map-dot[data-country]')].find(node=>decode(node.dataset.country).trim()===country)||null;
  }

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,.world-map-dot[aria-current="true"]');
  }

  function sourceByCountry(country){
    return [...list.querySelectorAll('.world-country-button[data-country],.world-country-selected-card[data-country]')].find(node=>decode(node.dataset.country).trim()===country)||null;
  }

  function ensureLabel(){
    document.getElementById('landscapeCountryLabelR72')?.remove();
    document.getElementById('landscapeCountryLabelR73')?.remove();
    document.getElementById('landscapeCountryLabelR74')?.remove();
    let node=document.getElementById('landscapeCountryLabelR76');
    if(!node){
      node=document.createElement('div');
      node.id='landscapeCountryLabelR76';
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
      node.innerHTML='<span class="r76-country-flag" aria-hidden="true"></span><span class="r76-country-name"></span>';
      document.body.appendChild(node);
    }
    return node;
  }

  function resolveSelection(){
    const fromDataset=String(map.dataset.focusCountry||list.dataset.selectedCountry||'').trim();
    if(fromDataset){
      activeCountry=fromDataset;
      const marker=markerByCountry(activeCountry);
      if(marker)activeCode=String(marker.dataset.code||activeCode||'').trim().toUpperCase();
    }
    const marker=markerByCountry(activeCountry)||selectedMarker();
    if(!activeCountry&&marker)activeCountry=decode(marker.dataset.country).trim();
    if(marker&&!activeCode)activeCode=String(marker.dataset.code||'').trim().toUpperCase();
    return activeCountry&&marker?{country:activeCountry,code:activeCode,marker}:null;
  }

  function hideLabel(){
    const node=ensureLabel();
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
  }

  function updateLabel(){
    const node=ensureLabel();
    if(!isLandscape()||!onMap())return hideLabel();
    const selection=resolveSelection();
    if(!selection)return hideLabel();

    const source=sourceByCountry(selection.country);
    const code=String(source?.dataset?.code||selection.code||selection.marker.dataset.code||'').trim().toUpperCase();
    const flag=(source?.querySelector('.world-country-flag')?.textContent||'').trim()||countryToFlag(code);
    const name=(source?.querySelector('.world-country-marquee')?.textContent||source?.querySelector('.world-country-name')?.textContent||selection.country).trim()||selection.country;

    node.querySelector('.r76-country-flag').textContent=flag;
    node.querySelector('.r76-country-name').textContent=name;
    node.hidden=false;
    node.setAttribute('aria-hidden','false');

    const markerRect=selection.marker.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const width=Math.max(70,node.offsetWidth||150);
    const height=Math.max(20,node.offsetHeight||24);
    const half=width/2;
    const centerX=clamp(markerRect.left+markerRect.width/2,mapRect.left+10+half,mapRect.right-10-half);
    let top=markerRect.bottom+10;
    if(top+height>mapRect.bottom-6)top=Math.max(mapRect.top+6,markerRect.top-height-9);
    node.style.setProperty('left',`${centerX.toFixed(1)}px`,'important');
    node.style.setProperty('top',`${top.toFixed(1)}px`,'important');
  }

  function followLabel(ms=850){
    followUntil=Math.max(followUntil,performance.now()+ms);
    if(followRaf)return;
    const tick=now=>{
      updateLabel();
      if(now<followUntil)followRaf=requestAnimationFrame(tick);
      else followRaf=0;
    };
    followRaf=requestAnimationFrame(tick);
  }

  function setActive(country,code='',focused=true){
    if(!focused||!country){
      activeCountry='';
      activeCode='';
      hideLabel();
      return;
    }
    activeCountry=String(country).trim();
    activeCode=String(code||'').trim().toUpperCase();
    followLabel(1100);
  }

  function rememberTarget(target){
    const marker=target?.closest?.('.world-map-dot[data-country]');
    if(!marker)return;
    setActive(decode(marker.dataset.country).trim(),marker.dataset.code,true);
  }

  document.addEventListener('pointerdown',event=>{if(isLandscape())rememberTarget(event.target)},true);
  document.addEventListener('click',event=>{if(isLandscape())rememberTarget(event.target)},true);
  window.addEventListener('andrik:country-focus-changed',event=>{
    const detail=event?.detail||{};
    if(detail.focused&&detail.country){
      const marker=markerByCountry(String(detail.country));
      setActive(detail.country,marker?.dataset?.code||'',true);
    }else setActive('', '', false);
  });

  const labelObserver=new MutationObserver(()=>{
    if(!isLandscape())return;
    clearTimeout(updateTimer);
    updateTimer=setTimeout(()=>{updateLabel();if(activeCountry)followLabel(420)},20);
  });
  labelObserver.observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','data-focus-country','aria-current']});
  labelObserver.observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-selected-country','aria-pressed']});
  labelObserver.observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});

  ensureLabel();
  if(isPortrait())schedulePortraitLock(220,true);
  setTimeout(()=>{if(isPortrait())schedulePortraitLock(0,true);else updateLabel()},650);
})();
