(()=>{
  'use strict';
  if(window.__andrikAnalyticsR186ReturnFixReady)return;
  window.__andrikAnalyticsR186ReturnFixReady=true;

  const selectors=[
    '#landscapeMapScrollbarR65',
    '#landscapeMapScrollbarR66',
    '#landscapeMapScrollbarR67',
    '#landscapeMapScrollbarR69Final'
  ];

  function clean(){
    document.querySelectorAll(selectors.join(',')).forEach(node=>node.remove());
    const pane=document.querySelector('.analytics-map-pane');
    if(!pane)return;
    const max=Math.max(0,(pane.scrollHeight||0)-(pane.clientHeight||0));
    if(pane.scrollTop>max)pane.scrollTop=max;
  }

  const run=()=>requestAnimationFrame(()=>requestAnimationFrame(clean));

  window.addEventListener('pageshow',run,{passive:true});
  window.addEventListener('resize',run,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(run,120),{passive:true});
  window.addEventListener('andrik:analytics-page-changed',run);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) run(); },{passive:true});
  new MutationObserver(run).observe(document.body,{childList:true,subtree:false});
  run();
  setTimeout(run,240);
  setTimeout(run,900);
})();
