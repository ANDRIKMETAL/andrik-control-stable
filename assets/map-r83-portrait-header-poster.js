/* Control ANDRIK v55.00 FINAL STABLE R83 — PORTRAIT ONLY.
   Creates one immutable visual header and mirrors auth text from the hidden
   legacy header. During country DOM changes it keeps the card at the same
   viewport coordinate instead of restoring an unreliable raw scrollTop. */
(()=>{
  'use strict';
  if(window.__andrikR83PortraitHeaderPosterReady)return;
  window.__andrikR83PortraitHeaderPosterReady=true;

  const portrait=()=>window.matchMedia?.('(orientation:portrait)')?.matches===true;
  const pane=document.querySelector('.analytics-map-pane');
  const wrap=pane?.querySelector('.analytics-map-pane-wrap');
  const legacyHeader=wrap?.querySelector('.analytics-compact-header');
  const card=wrap?.querySelector('.analytics-map-top');
  const sourceAuth=document.getElementById('analyticsAuthStrip');
  const sourceAuthText=document.getElementById('analyticsAuthText');
  if(!pane||!wrap||!legacyHeader||!card)return;

  let poster=wrap.querySelector('.r83-portrait-header-poster');
  if(!poster){
    poster=document.createElement('section');
    poster.className='r83-portrait-header-poster';
    poster.setAttribute('aria-label','Данные проекта. Статистика');
    poster.innerHTML=`
      <span class="r83-poster-eyeline">ДАННЫЕ ПРОЕКТА</span>
      <h1 class="r83-poster-title">Статистика</h1>
      <p class="r83-poster-subtitle">Google Analytics · карта аудитории · YouTube</p>
      <div class="r83-poster-auth">
        <a class="r83-poster-service" href="/service-admin.html">Служебное</a>
        <span class="r83-poster-access"><i class="r83-poster-dot" aria-hidden="true"></i><strong class="r83-poster-auth-text">Проверяем доступ…</strong></span>
      </div>`;
    wrap.insertBefore(poster,legacyHeader);
  }

  const mirrorText=poster.querySelector('.r83-poster-auth-text');
  const mirrorAuth=poster.querySelector('.r83-poster-auth');

  function syncAuth(){
    const text=String(sourceAuthText?.textContent||'Проверяем доступ…').trim()||'Проверяем доступ…';
    if(mirrorText)mirrorText.textContent=text;
    const ok=/подтвержд|доступ разреш|подключен/i.test(text)&&!/провер|ошиб|нет доступа|требует/i.test(text);
    mirrorAuth?.classList.toggle('is-ok',ok);
  }

  const authObserver=new MutationObserver(syncAuth);
  if(sourceAuth){
    authObserver.observe(sourceAuth,{subtree:true,childList:true,characterData:true,attributes:true});
  }
  syncAuth();

  let baseline=null;
  let lockUntil=0;
  let raf=0;
  let timer=0;

  function capture(){
    if(!portrait())return;
    baseline={cardTop:card.getBoundingClientRect().top};
    lockUntil=performance.now()+620;
    stabilize();
  }

  function stabilize(){
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    const run=()=>{
      if(!portrait()||!baseline)return;
      const currentTop=card.getBoundingClientRect().top;
      const delta=currentTop-baseline.cardTop;
      if(Math.abs(delta)>.25)pane.scrollTop+=delta;
      if(performance.now()<lockUntil){
        raf=requestAnimationFrame(run);
      }else{
        baseline=null;
      }
    };
    raf=requestAnimationFrame(run);
    timer=setTimeout(()=>{
      if(!portrait()||!baseline)return;
      const delta=card.getBoundingClientRect().top-baseline.cardTop;
      if(Math.abs(delta)>.25)pane.scrollTop+=delta;
      baseline=null;
    },680);
  }

  document.addEventListener('pointerdown',event=>{
    if(!portrait())return;
    if(event.target.closest?.('#worldMap .world-map-dot,#worldCountries .world-country-button'))capture();
  },true);

  document.addEventListener('click',event=>{
    if(!portrait())return;
    if(event.target.closest?.('#worldMap .world-map-dot,#worldCountries .world-country-button')){
      if(!baseline)capture();
      else stabilize();
    }
  },true);

  window.addEventListener('andrik:country-focus-changed',()=>{
    if(!portrait())return;
    if(!baseline)capture();
    else stabilize();
  });

  const layoutObserver=new MutationObserver(()=>{
    if(portrait()&&baseline)stabilize();
  });
  layoutObserver.observe(card,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});

  function orientationSync(){
    baseline=null;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    syncAuth();
  }
  window.addEventListener('resize',orientationSync,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(orientationSync,140),{passive:true});
  window.addEventListener('pageshow',orientationSync,{passive:true});
})();
