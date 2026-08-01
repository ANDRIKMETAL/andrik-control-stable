(()=>{
  'use strict';
  if(window.__andrikR68MapCardActionsReady)return;
  window.__andrikR68MapCardActionsReady=true;

  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  const card=map?.closest('.world-map-card,.analytics-map-top');
  const growthToggle=document.getElementById('countryGrowthToggle');
  if(!map||!list||!card)return;

  let actions=document.getElementById('mapFocusActions');
  let raf=0;
  const isPortrait=()=>window.matchMedia?.('(orientation:portrait)')?.matches===true;
  const selectedCountry=()=>{
    const selected=list.querySelector('.world-country-button.is-selected,[aria-pressed="true"]');
    return decodeURIComponent(selected?.dataset?.country||'').trim()||String(map.dataset.focusCountry||'').trim();
  };

  function ensureActions(){
    if(!actions){
      actions=document.createElement('nav');
      actions.id='mapFocusActions';
      actions.className='map-focus-actions';
      actions.setAttribute('aria-label','Быстрые действия выбранной страны');
      actions.innerHTML='<a class="map-focus-action is-activity" href="/control-home.html?page=activity&amp;v=55.00-r68">⚡ Последняя активность</a><a class="map-focus-action is-daily" href="/control-home.html?page=summary&amp;v=55.00-r68">📊 Аналитика за день</a>';
    }
    if(actions.parentElement!==card){
      if(growthToggle?.parentElement===card)card.insertBefore(actions,growthToggle);
      else card.appendChild(actions);
    }
    const activity=actions.querySelector('.is-activity');
    const daily=actions.querySelector('.is-daily');
    if(activity){activity.href='/control-home.html?page=activity&v=55.00-r68';activity.textContent='⚡ Последняя активность'}
    if(daily){daily.href='/control-home.html?page=summary&v=55.00-r68';daily.textContent='📊 Аналитика за день'}
    return actions;
  }

  function syncNow(){
    const focused=Boolean(selectedCountry());
    card.classList.toggle('has-country-focus',focused);
    document.body.classList.toggle('is-country-focus-active',focused);
    if(!isPortrait())return;
    const node=ensureActions();
    node.style.removeProperty('display');
    node.hidden=!focused;
    node.classList.toggle('is-visible',focused);
    node.setAttribute('aria-hidden',focused?'false':'true');
  }
  function sync(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(syncNow);
  }

  const observer=new MutationObserver(sync);
  observer.observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-pressed','data-code']});
  observer.observe(map,{attributes:true,attributeFilter:['class','data-focus-country']});
  observer.observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(sync,40);setTimeout(sync,220);setTimeout(sync,600)},{passive:true});
  window.addEventListener('pageshow',sync,{passive:true});
  window.addEventListener('andrik:country-focus-changed',sync);
  window.addEventListener('andrik:analytics-page-changed',sync);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.world-map-dot,.world-country-button,.world-country-selected-card')){
      setTimeout(sync,0);setTimeout(sync,100);setTimeout(sync,360);
    }
  },true);

  sync();
  setTimeout(sync,260);
  setTimeout(sync,900);
})();
