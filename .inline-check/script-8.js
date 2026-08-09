
/* FINAL R64 ATOMIC SINGLE FILE — MAP RUNTIME */
/* FINAL R63 SELF-CONTAINED VERIFIED MAP */
/* Control ANDRIK v55.00 FINAL R61
   Complete landscape country caption + guaranteed map scrolling + action-card removal. */
(()=>{
  'use strict';
  const isLandscape=()=>window.matchMedia?.('(orientation: landscape)')?.matches===true;
  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  const pane=document.querySelector('.analytics-map-pane');
  const actions=document.getElementById('mapFocusActions');
  if(!map||!list||!pane)return;

  const format=value=>new Intl.NumberFormat('ru-RU').format(Number(value)||0);
  let weekly=new Map();
  let previous=new Map();
  let raf=0;
  let actionAnchor=null;
  let drag=null;

  function normalize(rows){
    return (Array.isArray(rows)?rows:[]).map(item=>({
      code:String(item?.country||item?.code||'').trim().toUpperCase(),
      views:Number(item?.views??item?.value??0)
    })).filter(item=>item.code);
  }
  function ingest(detail){
    const source=detail?.weeklyCountries?detail
      :detail?.data?.weeklyCountries?detail.data
      :detail?.youtube?.studio?.weeklyCountries?detail.youtube.studio
      :detail?.youtube?.weeklyCountries?detail.youtube
      :{};
    const current=normalize(source.weeklyCountries);
    const before=normalize(source.previousWeekCountries);
    if(current.length)weekly=new Map(current.map(item=>[item.code,item.views]));
    if(before.length)previous=new Map(before.map(item=>[item.code,item.views]));
    decorateCard();
  }
  function readCache(){
    const keys=['andrik-country-growth-v54-75','andrik-country-growth-v54-82','andrik-country-growth-v54-74','andrik-country-growth-v54-73'];
    for(const key of keys){
      try{
        const parsed=JSON.parse(localStorage.getItem(key)||'null');
        const data=parsed?.data||parsed;
        if(data?.weeklyCountries||data?.data?.weeklyCountries){ingest(data);return;}
      }catch(_){ }
    }
  }

  function decorateCard(){
    const card=list.querySelector('.world-country-selected-card');
    if(!card)return;
    if(window.__andrikEcosystemActiveLayer&&window.__andrikEcosystemActiveLayer!=='youtube'){
      card.querySelector('.country-weekly-gain')?.remove();
      return;
    }
    const code=String(card.dataset.code||'').toUpperCase();
    let badge=card.querySelector('.country-weekly-gain');
    if(!badge){
      badge=document.createElement('small');
      badge.className='country-weekly-gain';
      card.appendChild(badge);
    }
    const hasNow=weekly.has(code);
    const hasBefore=previous.has(code);
    const hasKnownNow=hasNow||hasBefore;
    const now=hasNow?Number(weekly.get(code)||0):0;
    const before=hasBefore?Number(previous.get(code)||0):0;
    const arrow=!hasBefore?'•':(now>before?'▲':(now<before?'▼':'•'));
    const state=!hasBefore||now===before?'is-flat':(now>before?'is-positive':'is-negative');
    const currentText=hasKnownNow?`+${format(now)} за 7 дней`:'данные за 7 дней обновляются';
    const compareText=hasBefore?`${arrow} ${format(before)} за предыдущие 7 дней`:'нет данных за предыдущие 7 дней';
    badge.hidden=false;
    badge.innerHTML=`<span class="country-weekly-current ${hasKnownNow?'is-positive':'is-flat'}">${currentText}</span><span class="country-weekly-compare ${state}"><span class="country-weekly-marquee-track"><span>${compareText}</span></span></span>`;
    schedule();
  }

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,[aria-current="true"].world-map-dot');
  }
  function placeCard(){
    if(!isLandscape())return;
    const card=list.querySelector('.world-country-selected-card');
    const marker=selectedMarker();
    if(!card||!marker)return;
    const root=list.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const markerRect=marker.getBoundingClientRect();
    if(!root.width||!mapRect.width)return;
    const cw=card.offsetWidth||310;
    const ch=card.offsetHeight||57;
    const mx=markerRect.left+markerRect.width/2-root.left;
    const my=markerRect.top+markerRect.height/2-root.top;
    const mapLeft=mapRect.left-root.left;
    const mapTop=mapRect.top-root.top;
    const mapRight=mapLeft+mapRect.width;
    const mapBottom=mapTop+mapRect.height;
    let left=mx-cw/2;
    left=Math.max(mapLeft+8,Math.min(mapRight-cw-8,left));
    let top=my+Math.max(13,markerRect.height/2)+6;
    if(top+ch>mapBottom-6)top=my-Math.max(13,markerRect.height/2)-ch-6;
    top=Math.max(mapTop+6,Math.min(mapBottom-ch-6,top));
    card.style.left=`${left.toFixed(1)}px`;
    card.style.top=`${top.toFixed(1)}px`;
  }

  function hideActions(){
    if(!actions)return;
    if(isLandscape()){
      actions.hidden=true;
      actions.setAttribute('aria-hidden','true');
      actions.style.setProperty('display','none','important');
      if(actions.isConnected){
        actionAnchor=document.createComment('r61-map-actions');
        actions.parentNode?.insertBefore(actionAnchor,actions);
        actions.remove();
      }
    }else if(actionAnchor?.isConnected&&!actions.isConnected){
      actionAnchor.parentNode?.insertBefore(actions,actionAnchor.nextSibling);
      actionAnchor.remove();
      actionAnchor=null;
      actions.style.removeProperty('display');
    }
  }

  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      hideActions();
      decorateCardNoLoop();
      requestAnimationFrame(placeCard);
    });
  }
  function decorateCardNoLoop(){
    const card=list.querySelector('.world-country-selected-card');
    if(!card)return;
    const code=String(card.dataset.code||'').toUpperCase();
    const badge=card.querySelector('.country-weekly-gain');
    if(!badge){
      // Avoid recursion through schedule(); create once and fill synchronously.
      const node=document.createElement('small');
      node.className='country-weekly-gain';
      card.appendChild(node);
      const hasNow=weekly.has(code),hasBefore=previous.has(code),hasKnownNow=hasNow||hasBefore;
      const now=hasNow?Number(weekly.get(code)||0):0,before=hasBefore?Number(previous.get(code)||0):0;
      const arrow=!hasBefore?'•':(now>before?'▲':(now<before?'▼':'•'));
      const state=!hasBefore||now===before?'is-flat':(now>before?'is-positive':'is-negative');
      node.innerHTML=`<span class="country-weekly-current ${hasKnownNow?'is-positive':'is-flat'}">${hasKnownNow?`+${format(now)} за 7 дней`:'данные за 7 дней обновляются'}</span><span class="country-weekly-compare ${state}"><span class="country-weekly-marquee-track"><span>${hasBefore?`${arrow} ${format(before)} за предыдущие 7 дней`:'нет данных за предыдущие 7 дней'}</span></span></span>`;
    }
  }

  /* R67: duplicate pane-level drag owner removed. The final document-level owner below handles landscape vertical map scrolling. */

  const observer=new MutationObserver(()=>{
    decorateCardNoLoop();
    schedule();
  });
  observer.observe(map,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-current']});
  observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-code']});

  window.addEventListener('andrik:country-growth-data',event=>ingest(event.detail));
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(schedule,120),{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  pane.addEventListener('scroll',schedule,{passive:true});
  map.addEventListener('transitionend',schedule);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.world-map-dot,.world-country-selected-card,.world-country-button')){
      setTimeout(schedule,0);setTimeout(schedule,120);setTimeout(schedule,360);
    }
  });

  readCache();
  if(window.__andrikLatestCountryGrowth)ingest(window.__andrikLatestCountryGrowth);
  hideActions();
  schedule();
  setTimeout(schedule,300);
  setTimeout(schedule,900);
})();

