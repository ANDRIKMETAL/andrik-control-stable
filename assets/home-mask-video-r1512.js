/* ANDRIK R1512 — hero video autoplay recovery. No audio, no external requests. */
(()=>{'use strict';
  const video=document.getElementById('homeHeroVideo');
  const button=document.getElementById('heroMotionToggle');
  const hero=document.querySelector('.h-hero');
  if(!video||!button||!hero)return;
  const lang=(document.documentElement.lang||'ru').slice(0,2);
  const startLabel={ru:'Включить живой фон',en:'Play animated background',uk:'Увімкнути живий фон',sk:'Spustiť animované pozadie'}[lang]||'Play animated background';
  const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let userStarted=false;
  let visible=true;
  let retryTimer=0;
  let pending=false;
  function showButton(){
    if(!video.paused && video.readyState>=2){hideButton();return;}
    button.textContent='▶';
    button.setAttribute('aria-label',startLabel);
    button.title=startLabel;
    button.hidden=false;
    button.classList.add('is-video-control');
  }
  function hideButton(){
    button.classList.remove('is-video-control');
    button.hidden=true;
  }
  function ready(){
    video.classList.add('is-ready');
    video.setAttribute('data-first-frame','1');
    document.body.dataset.heroVideoState='playing';
    hideButton();
  }
  function play(explicit=false){
    if(explicit)userStarted=true;
    if(reduced&&!userStarted){showButton();return;}
    if(document.hidden||!visible)return;
    if(!video.paused){ready();return;}
    if(pending)return;
    pending=true;
    video.muted=true;
    video.defaultMuted=true;
    video.playsInline=true;
    video.setAttribute('muted','');
    video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');
    const started=()=>{pending=false; if(!video.paused)ready();};
    const failed=()=>{pending=false; document.body.dataset.heroVideoState='needs-tap';showButton();};
    try{
      const p=video.play();
      if(p&&typeof p.then==='function')p.then(started).catch(failed);
      else started();
    }catch(_){failed();}
  }
  button.addEventListener('click',ev=>{
    ev.preventDefault();
    ev.stopPropagation();
    play(true);
  });
  video.addEventListener('playing',ready,{passive:true});
  video.addEventListener('error',()=>{
    document.body.dataset.heroVideoState='error';
    showButton();
  },{passive:true});
  const check=()=>{
    if(document.hidden||!visible)return;
    if(!video.paused){ready();return;}
    if(reduced&&!userStarted){showButton();return;}
    play();
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>{if(video.paused){showButton();}},1800);
  };
  if('IntersectionObserver' in window){
    const watcher=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.target!==hero)continue;
        visible=entry.isIntersecting;
        if(!visible){video.pause();}else check();
      }
    },{threshold:0.01});watcher.observe(hero);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();},{passive:true});
  window.addEventListener('pageshow',check,{passive:true});
  if(reduced){showButton();}
  else{check();setTimeout(check,500);setTimeout(check,1600);}
})();
