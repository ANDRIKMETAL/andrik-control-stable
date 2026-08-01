(()=>{
  'use strict';
  if(window.__andrikR71CCenterLineReady)return;
  window.__andrikR71CCenterLineReady=true;

  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  const pane=document.querySelector('.analytics-map-pane');
  const cardRoot=map?.closest('.world-map-card,.analytics-map-top');
  const endZone=document.getElementById('mapEndPullZone');
  if(!map||!list||!pane||!cardRoot)return;

  const fmt=value=>new Intl.NumberFormat('ru-RU').format(Number(value)||0);
  const landscapeQuery=window.matchMedia('(orientation:landscape)');
  const isLandscape=()=>landscapeQuery.matches===true;
  const isPortrait=()=>!isLandscape();
  const ART_RATIO=1031/2560;
  const FOCUS_TARGET_RATIO=.53;
  const FOCUS_TRACK_MS=920;
  const OVERVIEW_RETURN_MS=620;
  let weekly=new Map();
  let previous=new Map();
  let raf=0;
  let railDrag=null;
  let lastOrientation=isLandscape()?'landscape':'portrait';
  let syntheticResizePending=false;
  let overviewScrollTop=0;
  let wasFocused=false;
  let focusLockTimer=0;
  let forcedCountry="";
  let lockedFocusScrollTop=null;
  let lastCenteredCountry="";
  let centeringCountry="";
  let focusTrackerRaf=0;
  let overviewReturnRaf=0;
  let didInitialOverviewReset=false;

  function decode(value){
    try{return decodeURIComponent(String(value||''))}catch(_){return String(value||'')}
  }

  function normalizeRows(rows){
    return (Array.isArray(rows)?rows:[]).map(item=>({
      code:String(item?.country||item?.code||'').trim().toUpperCase(),
      value:Number(item?.views??item?.value??0)
    })).filter(item=>item.code);
  }

  function ingest(detail){
    const source=detail?.weeklyCountries?detail
      :detail?.data?.weeklyCountries?detail.data
      :detail?.youtube?.studio?.weeklyCountries?detail.youtube.studio
      :detail?.youtube?.weeklyCountries?detail.youtube
      :{};
    const now=normalizeRows(source.weeklyCountries);
    const before=normalizeRows(source.previousWeekCountries);
    if(now.length)weekly=new Map(now.map(item=>[item.code,item.value]));
    if(before.length)previous=new Map(before.map(item=>[item.code,item.value]));
    schedule();
  }

  function readGrowthCache(){
    const keys=['andrik-country-growth-v54-87','andrik-country-growth-v54-82','andrik-country-growth-v54-75','andrik-country-growth-v54-74','andrik-country-growth-v54-73'];
    for(const key of keys){
      try{
        const parsed=JSON.parse(localStorage.getItem(key)||'null');
        const data=parsed?.data||parsed;
        if(data?.weeklyCountries||data?.data?.weeklyCountries){ingest(data);return}
      }catch(_){ }
    }
  }

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,.world-map-dot[aria-current="true"]');
  }

  function selectedCountry(){
    const forced=String(forcedCountry||'').trim();
    if(forced)return forced;
    const fromMap=String(map.dataset.focusCountry||'').trim();
    if(fromMap)return fromMap;
    const marker=selectedMarker();
    if(marker)return decode(marker.dataset.country).trim();
    const fromList=String(list.dataset.selectedCountry||'').trim();
    if(fromList)return fromList;
    const source=list.querySelector('.world-country-selected-card.is-selected,.world-country-button.is-selected,[aria-pressed="true"]');
    return decode(source?.dataset?.country).trim();
  }

  function selectedSource(){
    const direct=list.querySelector('.world-country-selected-card.is-selected,.world-country-button.is-selected,.world-country-selected-card[aria-pressed="true"],.world-country-button[aria-pressed="true"]');
    if(direct)return direct;
    const country=selectedCountry();
    if(!country)return null;
    return [...list.querySelectorAll('.world-country-selected-card,.world-country-button')].find(node=>decode(node.dataset.country).trim()===country)||null;
  }

  function isFocused(){
    return Boolean(selectedCountry()||map.classList.contains('is-country-focused'));
  }

  function ensureCard(){
    let card=document.getElementById('landscapeCountryCardR69');
    if(!card||card.parentElement!==document.body){
      card?.remove();
      card=document.createElement('button');
      card.id='landscapeCountryCardR69';
      card.type='button';
      card.hidden=true;
      card.setAttribute('aria-hidden','true');
      card.setAttribute('aria-label','Выбранная страна. Нажмите, чтобы вернуть всю карту');
      card.innerHTML='<span class="r69-country-flag" aria-hidden="true"></span><strong class="r69-country-name"></strong><em class="r69-country-value"></em><span class="r69-country-current"></span><span class="r69-country-compare"></span>';
      document.body.appendChild(card);
      card.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        const marker=selectedMarker();
        if(marker)marker.click();
        else selectedSource()?.click();
      });
    }
    return card;
  }

  function sourceText(source,selector,fallback=''){
    try{return source?.querySelector(selector)?.textContent?.trim()||fallback}catch(_){return fallback}
  }

  function markerFallback(){
    const marker=selectedMarker();
    const title=String(marker?.title||'');
    const split=title.lastIndexOf(':');
    return {
      country:selectedCountry()||(split>0?title.slice(0,split).trim():'Страна'),
      value:split>0?title.slice(split+1).trim():'0',
      code:String(marker?.dataset?.code||'').trim().toUpperCase()
    };
  }

  function frameMetrics(){
    const paneRect=pane.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const left=Math.max(0,Math.round(mapRect.left));
    const right=Math.min(window.innerWidth,Math.round(mapRect.right));
    const top=Math.max(0,Math.round(paneRect.top));
    const bottom=Math.max(top+20,Math.round(window.innerHeight-1));
    return {paneRect,mapRect,left,right,width:Math.max(20,right-left),top,bottom,height:Math.max(20,bottom-top)};
  }

  function ensureDock(){
    let dock=document.getElementById('landscapeMapDockR70');
    if(!dock){
      dock=document.createElement('div');
      dock.id='landscapeMapDockR70';
      dock.setAttribute('aria-hidden','true');
      document.body.appendChild(dock);
    }
    return dock;
  }

  function placeCard(){
    if(!isLandscape())return;
    const card=document.getElementById('landscapeCountryCardR69');
    if(!card||card.hidden)return;
    const marker=selectedMarker();
    const metrics=frameMetrics();
    const height=card.offsetHeight||58;
    const width=card.offsetWidth||360;
    const markerRect=marker?.getBoundingClientRect();
    const centerX=markerRect?markerRect.left+markerRect.width/2:(metrics.left+metrics.width/2);
    const minLeft=metrics.left+12+width/2;
    const maxLeft=metrics.right-12-width/2;
    const safeX=Math.max(minLeft,Math.min(maxLeft,centerX));
    let top=markerRect?markerRect.bottom+12:(metrics.top+metrics.height*.55);
    const maxTop=metrics.bottom-height-10;
    if(top>maxTop&&markerRect)top=Math.max(metrics.top+10,markerRect.top-height-12);
    top=Math.max(metrics.top+10,Math.min(maxTop,top));
    card.style.setProperty('left',`${safeX.toFixed(1)}px`,'important');
    card.style.setProperty('top',`${top.toFixed(1)}px`,'important');
    card.style.setProperty('transform','translateX(-50%)','important');
  }

  function fillCard(){
    const card=ensureCard();
    card.hidden=true;
    card.style.setProperty('display','none','important');
    card.setAttribute('aria-hidden','true');
  }

  function ensureActions(){
    const duplicates=[...document.querySelectorAll('#mapFocusActions')];
    let actions=duplicates.shift()||null;
    duplicates.forEach(node=>node.remove());
    if(!actions){
      actions=document.createElement('nav');
      actions.id='mapFocusActions';
      actions.className='map-focus-actions';
      actions.setAttribute('aria-label','Быстрые действия выбранной страны');
      actions.innerHTML='<a class="map-focus-action is-activity" href="/control-home.html?page=activity&amp;v=55.00-r69">⚡ Последняя активность</a><a class="map-focus-action is-daily" href="/control-home.html?page=summary&amp;v=55.00-r69">📊 Аналитика за день</a>';
    }
    if(actions.parentElement!==cardRoot){
      const growth=document.getElementById('countryGrowthToggle');
      if(growth?.parentElement===cardRoot)cardRoot.insertBefore(actions,growth);
      else cardRoot.appendChild(actions);
    }
    return actions;
  }

  function syncFocusState(){
    const focused=isFocused();
    cardRoot.classList.toggle('has-country-focus',focused);
    document.body.classList.toggle('is-country-focus-active',focused);
    if(!isPortrait())return;
    const actions=ensureActions();
    actions.hidden=!focused;
    actions.classList.toggle('is-visible',focused);
    actions.setAttribute('aria-hidden',focused?'false':'true');
    if(endZone)endZone.setAttribute('aria-hidden',focused?'true':'false');
  }

  function ensureRail(){
    let rail=document.getElementById('landscapeMapScrollbarR69Final');
    if(!rail){
      rail=document.createElement('div');
      rail.id='landscapeMapScrollbarR69Final';
      rail.setAttribute('role','scrollbar');
      rail.setAttribute('aria-label','Прокрутка карты');
      rail.setAttribute('aria-orientation','vertical');
      rail.innerHTML='<span id="landscapeMapScrollbarR69FinalThumb"></span>';
      document.body.appendChild(rail);
    }
    return rail;
  }

  function ensureFrame(){
    let frame=document.getElementById('landscapeMapFrameR69Final');
    if(!frame){
      frame=document.createElement('div');
      frame.id='landscapeMapFrameR69Final';
      frame.setAttribute('aria-hidden','true');
      document.body.appendChild(frame);
    }
    return frame;
  }

  function updateFrame(){
    const frame=ensureFrame();
    const dock=ensureDock();
    dock.classList.remove('is-visible');
    dock.setAttribute('aria-hidden','true');
    if(!isLandscape()||document.body.dataset.analyticsPage!=='map'){
      frame.classList.remove('is-visible');
      return;
    }
    const metrics=frameMetrics();
    if(metrics.width<10||metrics.height<10){
      frame.classList.remove('is-visible');
      return;
    }
    frame.style.left=`${metrics.left}px`;
    frame.style.top=`${metrics.top}px`;
    frame.style.width=`${metrics.width}px`;
    frame.style.height=`${metrics.height}px`;
    frame.classList.add('is-visible');
  }

  function maxScroll(){
    const mapBottom=(map.offsetTop||0)+(map.offsetHeight||0);
    return Math.max(0,mapBottom-pane.clientHeight);
  }

  function updateRail(){
    const rail=ensureRail();
    const thumb=rail.querySelector('#landscapeMapScrollbarR69FinalThumb');
    if(!isLandscape()||document.body.dataset.analyticsPage!=='map'){
      rail.classList.remove('is-visible');rail.setAttribute('aria-hidden','true');return;
    }
    const max=maxScroll();
    const metrics=frameMetrics();
    if(isFocused()){rail.classList.remove('is-visible');rail.setAttribute('aria-hidden','true');return;}
    if(max<=2||metrics.width<=0||metrics.height<=0){
      rail.classList.remove('is-visible');rail.setAttribute('aria-hidden','true');return;
    }
    const trackHeight=Math.max(80,Math.floor(metrics.height-18));
    rail.style.left=`${Math.max(3,Math.floor(Math.min(window.innerWidth-10,metrics.right+2)))}px`;
    rail.style.top=`${Math.floor(metrics.top+9)}px`;
    rail.style.height=`${trackHeight}px`;
    const ratio=Math.max(.08,Math.min(1,pane.clientHeight/Math.max(pane.scrollHeight,1)));
    const thumbHeight=Math.max(42,Math.floor(trackHeight*ratio));
    const travel=Math.max(0,trackHeight-thumbHeight-2);
    const position=max>0?Math.round((pane.scrollTop/max)*travel):0;
    thumb.style.height=`${thumbHeight}px`;
    thumb.style.transform=`translateY(${position}px)`;
    rail.classList.add('is-visible');
    rail.setAttribute('aria-hidden','false');
    rail.setAttribute('aria-valuemin','0');
    rail.setAttribute('aria-valuemax',String(Math.round(max)));
    rail.setAttribute('aria-valuenow',String(Math.round(pane.scrollTop)));
  }

  function clampPaneScroll(value){
    return Math.max(0,Math.min(maxScroll(),Number(value)||0));
  }

  function stopFocusTracker(){
    if(focusTrackerRaf)cancelAnimationFrame(focusTrackerRaf);
    focusTrackerRaf=0;
  }

  function stopOverviewReturn(){
    if(overviewReturnRaf)cancelAnimationFrame(overviewReturnRaf);
    overviewReturnRaf=0;
  }

  function centerFocusFrame(){
    const marker=selectedMarker();
    const stage=map.querySelector('.world-map-stage');
    if(!marker||!stage)return false;
    const frame=frameMetrics();
    const markerRect=marker.getBoundingClientRect();
    const stageRect=stage.getBoundingClientRect();
    const markerY=markerRect.top+(markerRect.height/2);
    const desiredY=frame.top+(frame.height*FOCUS_TARGET_RATIO);
    let delta=markerY-desiredY;

    /* Keep transformed map artwork covering the whole fixed viewport. */
    const minDelta=stageRect.top-frame.top;
    const maxDelta=stageRect.bottom-frame.bottom;
    if(minDelta<=maxDelta)delta=Math.max(minDelta,Math.min(maxDelta,delta));

    const next=clampPaneScroll(pane.scrollTop+delta);
    if(Math.abs(next-pane.scrollTop)>.25)pane.scrollTop=next;
    updateFrame();
    updateRail();
    return true;
  }

  function startFocusTracking({force=false}={}){
    if(!isLandscape()||!isFocused())return;
    const country=selectedCountry();
    if(!country)return;
    if(!force&&country===lastCenteredCountry&&lockedFocusScrollTop!==null){
      pane.scrollTop=lockedFocusScrollTop;
      return;
    }
    stopFocusTracker();
    stopOverviewReturn();
    centeringCountry=country;
    lockedFocusScrollTop=null;
    pane.style.setProperty('overflow-y','auto','important');
    pane.style.setProperty('touch-action','none','important');
    const started=performance.now();
    const tick=now=>{
      if(!isLandscape()||!isFocused()||selectedCountry()!==country){
        stopFocusTracker();
        centeringCountry='';
        return;
      }
      centerFocusFrame();
      if(now-started<FOCUS_TRACK_MS){focusTrackerRaf=requestAnimationFrame(tick);return;}
      focusTrackerRaf=0;
      centerFocusFrame();
      lockedFocusScrollTop=clampPaneScroll(pane.scrollTop);
      lastCenteredCountry=country;
      centeringCountry='';
      pane.scrollTop=lockedFocusScrollTop;
      pane.style.setProperty('overflow-y','hidden','important');
      pane.style.setProperty('touch-action','none','important');
      updateFrame();
      updateRail();
    };
    focusTrackerRaf=requestAnimationFrame(tick);
  }

  function animateOverviewReturn(){
    stopFocusTracker();
    stopOverviewReturn();
    clearTimeout(focusLockTimer);
    lockedFocusScrollTop=null;
    lastCenteredCountry='';
    centeringCountry='';
    pane.style.setProperty('overflow-y','auto','important');
    pane.style.setProperty('touch-action','none','important');
    const from=Number(pane.scrollTop)||0;
    const to=0;
    const started=performance.now();
    const ease=t=>1-Math.pow(1-t,3);
    const tick=now=>{
      const p=Math.max(0,Math.min(1,(now-started)/OVERVIEW_RETURN_MS));
      pane.scrollTop=from+((to-from)*ease(p));
      updateFrame();
      updateRail();
      if(p<1){overviewReturnRaf=requestAnimationFrame(tick);return;}
      overviewReturnRaf=0;
      pane.scrollTop=0;
      overviewScrollTop=0;
      pane.style.setProperty('touch-action','pan-y','important');
      updateFrame();
      updateRail();
    };
    overviewReturnRaf=requestAnimationFrame(tick);
  }

  function unlockOverview(){
    animateOverviewReturn();
  }

  function clearLandscapeInlineState(){
    ['height','max-height','min-height','overflow-y','overflow-x','touch-action','scroll-behavior'].forEach(name=>pane.style.removeProperty(name));
    pane.scrollTop=0;
    document.getElementById('landscapeScrollSpacerR69Hotfix')?.remove();
    list.classList.remove('is-landscape-layout');
    const card=document.getElementById('landscapeCountryCardR69');
    if(card){card.hidden=true;card.setAttribute('aria-hidden','true')}
    const rail=ensureRail();
    rail.classList.remove('is-visible');
    rail.setAttribute('aria-hidden','true');
    ensureFrame().classList.remove('is-visible');
    const dock=ensureDock();
    dock.classList.remove('is-visible');
    dock.setAttribute('aria-hidden','true');
  }

  function applyViewport(){
    if(isPortrait()){
      clearLandscapeInlineState();
      syncFocusState();
      return;
    }
    const currentPane=pane.getBoundingClientRect();
    const fullAvailable=Math.max(180,Math.floor(window.innerHeight-Math.max(0,currentPane.top)));
    pane.style.setProperty('height',`${fullAvailable}px`,'important');
    pane.style.setProperty('max-height',`${fullAvailable}px`,'important');
    pane.style.setProperty('min-height','0','important');
    pane.style.setProperty('overflow-x','hidden','important');
    const focused=isFocused();
    if(focused){
      pane.style.setProperty('overflow-y',focusTrackerRaf?'auto':'hidden','important');
      pane.style.setProperty('touch-action','none','important');
    }else{
      pane.style.setProperty('overflow-y','auto','important');
      pane.style.setProperty('touch-action','pan-y','important');
      pane.scrollTop=clampPaneScroll(pane.scrollTop);
    }
    fillCard();
    updateFrame();
    updateRail();
  }

  function recoverPortraitAfterRotation(){
    if(!isPortrait())return;
    const hadLandscapeLayout=list.classList.contains('is-landscape-layout');
    clearLandscapeInlineState();
    syncFocusState();
    requestAnimationFrame(()=>{
      const stage=map.querySelector('.world-map-stage');
      const height=map.getBoundingClientRect().height;
      /* The main renderer rebuilds all portrait rows on resize. Force exactly one
         additional resize only when landscape DOM survived the turn or the map collapsed. */
      if((hadLandscapeLayout||!stage||height<70)&&!syntheticResizePending){
        syntheticResizePending=true;
        try{window.dispatchEvent(new Event('resize'))}catch(_){ }
        setTimeout(()=>{syntheticResizePending=false},160);
      }
    });
  }

  function syncNow(){
    syncFocusState();
    const focused=isLandscape()&&isFocused();
    if(isLandscape()){
      if(!focused&&!didInitialOverviewReset){
        didInitialOverviewReset=true;
        pane.scrollTop=0;
        overviewScrollTop=0;
      }
      if(focused&&!wasFocused){
        overviewScrollTop=0;
        lockedFocusScrollTop=null;
        lastCenteredCountry='';
        centeringCountry='';
      }
      if(!focused&&wasFocused)unlockOverview();
      fillCard();
    }else recoverPortraitAfterRotation();
    wasFocused=focused;
    applyViewport();
    requestAnimationFrame(()=>{
      updateFrame();updateRail();
      if(focused&&lockedFocusScrollTop===null&&!focusTrackerRaf)startFocusTracking({force:true});
    });
  }

  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(syncNow);
  }

  const stopFocusedGesture=event=>{
    if(!isLandscape()||!isFocused())return;
    event.preventDefault();
    event.stopPropagation();
  };
  pane.addEventListener('touchmove',stopFocusedGesture,{passive:false,capture:true});
  pane.addEventListener('wheel',stopFocusedGesture,{passive:false,capture:true});

  const rail=ensureRail();
  rail.addEventListener('pointerdown',event=>{
    if(!isLandscape())return;
    event.preventDefault();event.stopPropagation();
    const rect=rail.getBoundingClientRect();
    const thumb=rail.querySelector('#landscapeMapScrollbarR69FinalThumb');
    const thumbRect=thumb.getBoundingClientRect();
    if(event.clientY<thumbRect.top||event.clientY>thumbRect.bottom){
      const ratio=Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(rect.height,1)));
      pane.scrollTop=ratio*maxScroll();
    }
    railDrag={id:event.pointerId,y:event.clientY,start:pane.scrollTop};
    try{rail.setPointerCapture(event.pointerId)}catch(_){ }
    updateRail();
  });
  rail.addEventListener('pointermove',event=>{
    if(!railDrag||railDrag.id!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const rect=rail.getBoundingClientRect();
    const thumb=rail.querySelector('#landscapeMapScrollbarR69FinalThumb');
    const travel=Math.max(1,rect.height-(thumb.offsetHeight||42)-2);
    pane.scrollTop=Math.max(0,Math.min(maxScroll(),railDrag.start+(event.clientY-railDrag.y)*(maxScroll()/travel)));
    updateRail();
  });
  const finishRail=event=>{if(railDrag&&(!event||railDrag.id===event.pointerId))railDrag=null};
  rail.addEventListener('pointerup',finishRail);
  rail.addEventListener('pointercancel',finishRail);

  const observer=new MutationObserver(schedule);
  observer.observe(map,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-focus-country','aria-current']});
  observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-selected-country','data-country','data-code','aria-pressed']});
  observer.observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});

  pane.addEventListener('scroll',()=>{
    if(!isLandscape())return;
    const safe=clampPaneScroll(pane.scrollTop);
    if(Math.abs(safe-pane.scrollTop)>.5)pane.scrollTop=safe;
    if(isFocused()){if(!focusTrackerRaf&&lockedFocusScrollTop!==null)pane.scrollTop=lockedFocusScrollTop;updateFrame();return;}
    overviewScrollTop=safe;
    updateFrame();updateRail();
  },{passive:true});
  map.addEventListener('transitionend',()=>{updateFrame();updateRail();if(isFocused()&&!focusTrackerRaf&&lockedFocusScrollTop===null)startFocusTracking({force:true})});
  window.addEventListener('andrik:country-growth-data',event=>ingest(event.detail));
  window.addEventListener('andrik:country-focus-changed',event=>{
    const detail=event?.detail||{};
    const next=detail.focused?String(detail.country||'').trim():'';
    if(next!==forcedCountry){
      forcedCountry=next;
      lockedFocusScrollTop=null;
      lastCenteredCountry='';
      centeringCountry='';
    }
    schedule();
    setTimeout(()=>{fillCard();updateFrame()},40);
    setTimeout(()=>{
      fillCard();updateFrame();
      if(isFocused()&&lockedFocusScrollTop===null&&!focusTrackerRaf)startFocusTracking({force:true});
    },180);
  });
  window.addEventListener('andrik:analytics-page-changed',schedule);
  window.addEventListener('resize',()=>{
    const orientation=isLandscape()?'landscape':'portrait';
    if(orientation!==lastOrientation){
      lastOrientation=orientation;
      if(orientation==='portrait')recoverPortraitAfterRotation();
    }
    schedule();
  },{passive:true});
  window.addEventListener('orientationchange',()=>{
    setTimeout(()=>{lastOrientation=isLandscape()?'landscape':'portrait';if(isPortrait())recoverPortraitAfterRotation();schedule()},60);
    setTimeout(()=>{if(isPortrait())recoverPortraitAfterRotation();schedule()},240);
    setTimeout(()=>{if(isPortrait())recoverPortraitAfterRotation();schedule()},650);
  },{passive:true});
  if(typeof landscapeQuery.addEventListener==='function')landscapeQuery.addEventListener('change',()=>{if(isPortrait())recoverPortraitAfterRotation();schedule()});
  window.addEventListener('pageshow',schedule,{passive:true});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.world-map-dot,.world-country-button,.world-country-selected-card,#landscapeCountryCardR69')){
      setTimeout(schedule,0);setTimeout(schedule,70);setTimeout(()=>{fillCard();updateFrame();if(isFocused()&&lockedFocusScrollTop===null&&!focusTrackerRaf)startFocusTracking({force:true})},220);
    }
  },true);

  readGrowthCache();
  if(window.__andrikLatestCountryGrowth)ingest(window.__andrikLatestCountryGrowth);
  schedule();
  setTimeout(schedule,250);
  setTimeout(schedule,900);
})();



/* R71F — robust portrait viewport stabilizer.
   It compensates the real layout shift regardless of which element owns scrolling. */
(()=>{
  'use strict';
  if(window.__andrikR71FPortraitStaticReady)return;
  window.__andrikR71FPortraitStaticReady=true;

  const pane=document.querySelector('.analytics-map-pane');
  const viewport=document.getElementById('analyticsSwipeViewport');
  const wrap=pane?.querySelector('.analytics-map-pane-wrap');
  const card=pane?.querySelector('.analytics-map-top');
  if(!pane||!card)return;

  const isPortrait=()=>window.matchMedia?.('(orientation:portrait)')?.matches===true;
  const onMap=()=>document.body.dataset.analyticsPage==='map';
  let targetTop=0;
  let shift=0;
  let lockUntil=0;
  let raf=0;
  let scrollSnapshot=null;

  const readScroll=()=>({
    winX:window.scrollX||0,
    winY:window.scrollY||0,
    doc:document.scrollingElement?.scrollTop||0,
    pane:pane.scrollTop||0,
    viewport:viewport?.scrollTop||0,
    wrap:wrap?.scrollTop||0
  });

  const restoreScroll=s=>{
    if(!s)return;
    if(document.scrollingElement)document.scrollingElement.scrollTop=s.doc;
    pane.scrollTop=s.pane;
    if(viewport)viewport.scrollTop=s.viewport;
    if(wrap)wrap.scrollTop=s.wrap;
    if(Math.abs((window.scrollY||0)-s.winY)>.5){
      try{window.scrollTo({left:s.winX,top:s.winY,behavior:'instant'})}
      catch(_){window.scrollTo(s.winX,s.winY)}
    }
  };

  function capture(){
    if(!isPortrait()||!onMap())return;
    card.style.setProperty('--r71f-card-shift',`${shift.toFixed(2)}px`);
    targetTop=card.getBoundingClientRect().top;
    scrollSnapshot=readScroll();
  }

  function stop(){
    if(raf)cancelAnimationFrame(raf);
    raf=0;
  }

  function tick(now){
    if(!isPortrait()||!onMap()||now>=lockUntil){
      stop();
      return;
    }
    restoreScroll(scrollSnapshot);
    const current=card.getBoundingClientRect().top;
    const delta=targetTop-current;
    if(Math.abs(delta)>.08){
      shift+=delta;
      card.style.setProperty('--r71f-card-shift',`${shift.toFixed(2)}px`);
    }
    raf=requestAnimationFrame(tick);
  }

  function hold(ms=1250){
    if(!isPortrait()||!onMap())return;
    stop();
    lockUntil=performance.now()+ms;
    raf=requestAnimationFrame(tick);
  }

  document.addEventListener('pointerdown',event=>{
    if(!isPortrait()||!onMap())return;
    if(event.target.closest?.('.world-map-dot,.world-country-button,.world-country-selected-card')){
      capture();
      hold(1450);
    }
  },true);

  window.addEventListener('andrik:country-focus-changed',()=>{
    if(!isPortrait()||!onMap())return;
    if(!targetTop)capture();
    hold(1500);
  });

  const observer=new MutationObserver(mutations=>{
    if(!isPortrait()||!onMap()||!lockUntil)return;
    const relevant=mutations.some(m=>m.target===card||card.contains(m.target)||m.target===document.body);
    if(relevant)hold(Math.max(700,lockUntil-performance.now()));
  });
  observer.observe(card,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
  observer.observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});

  window.addEventListener('orientationchange',()=>{
    stop();
    targetTop=0;
    shift=0;
    scrollSnapshot=null;
    card.style.removeProperty('--r71f-card-shift');
  },{passive:true});
  window.addEventListener('pageshow',()=>{
    targetTop=0;
    shift=0;
    scrollSnapshot=null;
    card.style.removeProperty('--r71f-card-shift');
  },{passive:true});
})();
