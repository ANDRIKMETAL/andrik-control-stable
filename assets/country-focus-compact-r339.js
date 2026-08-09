/* ANDRIK R339 — compact focused country map. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_FOCUS_COMPACT_R339__) return;
  window.__ANDRIK_COUNTRY_FOCUS_COMPACT_R339__ = true;
  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  if(!map||!list)return;
  const runtime=window.__andrikWorldMapRuntime||{};
  const fmt=value=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(value||0)));
  const translate=value=>runtime.translateCountry?runtime.translateCountry(value):String(value||'');

  const selectedCountry=()=>String(runtime.getSelection?.()||map.dataset.focusCountry||'').trim();
  const activeLayer=()=>String(window.__andrikEcosystemActiveLayer||map.dataset.ecosystemLayer||'youtube');
  const state=()=>{try{return window.andrikEcosystemMap?.state?.()||null}catch(_){return null}};

  function ensurePulse(){
    const stage=map.querySelector('.world-map-stage');
    if(!stage)return null;
    let pulse=stage.querySelector('.country-focus-center-pulse-r339');
    if(!pulse){pulse=document.createElement('span');pulse.className='country-focus-center-pulse-r339';pulse.innerHTML='<i></i><span></span>';stage.appendChild(pulse)}
    return pulse;
  }
  function hasCountryPoint(country,layer){
    const s=state(); if(!s||!country)return false;
    let points=[];
    if(layer==='all') points=[...(s.site?.points||[]),...(s.music?.points||[]),...(s.push?.points||[])];
    else if(layer!=='youtube') points=s[layer]?.points||[];
    return points.some(point=>translate(point?.country||point?.code||'')===country);
  }
  function weeklyValue(country,layer){
    const detail=window.__andrikEcosystemLayerDetail;
    if(!detail||String(detail.layer)!==layer)return 0;
    const code=String(list.querySelector('.world-country-button.is-selected')?.dataset?.code||'').toUpperCase();
    const row=(detail.weekly||[]).find(item=>String(item?.country||'').toUpperCase()===code);
    return Math.max(0,Number(row?.value||0));
  }
  function syncPulse(){
    const country=selectedCountry();
    const layer=activeLayer();
    const focused=Boolean(country);
    const pulse=ensurePulse();
    if(!pulse)return;
    const noPoint=focused&&!hasCountryPoint(country,layer);
    pulse.classList.toggle('is-visible',noPoint);
    const label=pulse.querySelector('span');
    if(label)label.textContent=noPoint?`${country} · +${fmt(weeklyValue(country,layer))} за 7 дней`:'';
  }
  function syncActions(){
    const focused=Boolean(selectedCountry());
    document.body.classList.toggle('is-country-focus-active',focused);
    const actions=document.getElementById('mapFocusActions');
    if(actions&&focused){actions.hidden=false;actions.setAttribute('aria-hidden','false');actions.classList.add('is-visible')}
  }
  function sync(){
    syncActions();
    requestAnimationFrame(()=>requestAnimationFrame(syncPulse));
  }
  window.addEventListener('andrik:country-focus-changed',sync);
  window.addEventListener('andrik:ecosystem-layer-changed',sync);
  window.addEventListener('andrik:country-growth-data',sync);
  window.addEventListener('pageshow',sync,{passive:true});
  new MutationObserver(sync).observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-focus-country','data-ecosystem-layer']});
  new MutationObserver(sync).observe(list,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
  setTimeout(sync,250);setTimeout(sync,900);
})();
