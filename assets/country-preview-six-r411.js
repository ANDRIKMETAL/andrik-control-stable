/* ANDRIK R411 — normalize every country renderer to a six-row portrait preview. */
(()=>{
  if(window.__ANDRIK_COUNTRY_PREVIEW_SIX_R411__)return;
  window.__ANDRIK_COUNTRY_PREVIEW_SIX_R411__=true;
  const PREVIEW=6;
  let queued=false;
  let applying=false;

  const normalize=()=>{
    queued=false;
    if(applying)return;
    const list=document.getElementById('worldCountries');
    if(!list)return;
    const body=document.body;
    const focused=body.classList.contains('is-country-focus-active')||
      body.classList.contains('is-country-deep-active')||
      list.classList.contains('is-landscape-layout')||
      Boolean(list.closest('.analytics-map-top')?.classList.contains('has-country-focus'));
    if(focused)return;

    const rows=[...list.children].filter(node=>node.classList?.contains('world-country-button'));
    if(!rows.length)return;
    applying=true;
    try{
      rows.forEach((row,index)=>{
        const extra=index>=PREVIEW;
        if(row.classList.contains('world-country-extra')!==extra){
          row.classList.toggle('world-country-extra',extra);
        }
      });
      const expanded=list.classList.contains('is-expanded');
      const toggles=[...list.querySelectorAll('[data-country-toggle]')];
      const bottom=toggles.find(btn=>!btn.classList.contains('is-top-toggle'));
      if(bottom){
        const wanted=expanded?'Скрыть список':`Показать все страны (${rows.length})`;
        if(bottom.textContent!==wanted)bottom.textContent=wanted;
        bottom.setAttribute('aria-expanded',expanded?'true':'false');
        if(rows.length<=PREVIEW)bottom.hidden=true;
        else if(bottom.hidden)bottom.hidden=false;
      }
    }finally{
      applying=false;
    }
  };
  const schedule=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(normalize);
  };
  const attach=()=>{
    const list=document.getElementById('worldCountries');
    if(!list)return false;
    new MutationObserver(schedule).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    schedule();
    return true;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(!attach())setTimeout(attach,100)},{once:true});
  else if(!attach())setTimeout(attach,100);
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.addEventListener('andrik:audience-data',schedule);
  window.addEventListener('andrik:country-growth-data',schedule);
})();
