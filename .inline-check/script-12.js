
(function(){
  const isLandscape=()=>window.matchMedia?window.matchMedia('(orientation: landscape)').matches:(innerWidth>innerHeight);
  function syncGrowth(){
    const source=document.getElementById('countryGrowthToggle');
    const panel=document.getElementById('countryGrowthPanel');
    const button=document.getElementById('mapGrowthFabR237');
    if(!button)return;
    const open=Boolean(panel&&!panel.hidden&&panel.getAttribute('aria-hidden')!=='true');
    button.classList.toggle('is-open',open);
    button.setAttribute('aria-expanded',String(open));
    button.style.display=document.body.classList.contains('is-country-focus-active')?'none':'';
  }
  async function enterLandscape(){
    try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch(_){}
    try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape');}catch(_){}
  }
  async function returnPortrait(){
    try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('portrait');}catch(_){}
    try{if(document.fullscreenElement&&document.exitFullscreen)await document.exitFullscreen();}catch(_){}
  }
  document.addEventListener('click',event=>{
    const rotate=event.target.closest?.('#mapOrientationFab');
    if(rotate){event.preventDefault();isLandscape()?returnPortrait():enterLandscape();return;}
    if(event.target.closest?.('#mapGrowthFabR237,#countryGrowthToggle,#countryGrowthClose'))setTimeout(syncGrowth,30);
  },true);
  window.addEventListener('orientationchange',()=>setTimeout(syncGrowth,120),{passive:true});
  window.addEventListener('pageshow',syncGrowth,{passive:true});
  window.addEventListener('andrik:country-focus-changed',syncGrowth);
  setTimeout(syncGrowth,0);
})();
