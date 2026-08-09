/* ANDRIK R354 — deterministic visual identity of the active ecosystem layer. */
(()=>{
  'use strict';
  const map=document.getElementById('worldMap');
  if(!map)return;
  const sync=detail=>{
    const layer=String(detail?.layer||window.__andrikEcosystemActiveLayer||map.dataset.ecosystemLayer||'').toLowerCase();
    map.classList.toggle('is-youtube-layer-r354',layer==='youtube');
  };
  window.addEventListener('andrik:ecosystem-layer-changed',e=>sync(e.detail||{}));
  new MutationObserver(()=>sync()).observe(map,{attributes:true,attributeFilter:['data-ecosystem-layer']});
  map.addEventListener('click',e=>{if(e.target.closest?.('[data-ecosystem-layer]'))setTimeout(()=>sync(),0)},true);
  sync();
})();
