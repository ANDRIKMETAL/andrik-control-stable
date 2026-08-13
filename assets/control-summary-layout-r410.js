/* ANDRIK R410 — sync the two lower summary actions to the actual height of cards above. */
(()=>{
  if(window.__ANDRIK_SUMMARY_LAYOUT_R410__)return;
  window.__ANDRIK_SUMMARY_LAYOUT_R410__=true;
  const sync=()=>{
    const summary=document.getElementById('controlHomeSummary');
    const card=summary?.querySelector('.control-home-summary-item');
    const dual=document.getElementById('controlSummaryDualR375');
    if(!card||!dual)return;
    const height=Math.round(card.getBoundingClientRect().height);
    if(height>=80&&height<=220)document.documentElement.style.setProperty('--control-summary-card-height-r410',`${height}px`);
  };
  const schedule=()=>requestAnimationFrame(()=>requestAnimationFrame(sync));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  const summary=document.getElementById('controlHomeSummary');
  if(summary){
    new MutationObserver(schedule).observe(summary,{childList:true,subtree:true,characterData:true});
    if('ResizeObserver'in window)new ResizeObserver(schedule).observe(summary);
  }
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
})();
