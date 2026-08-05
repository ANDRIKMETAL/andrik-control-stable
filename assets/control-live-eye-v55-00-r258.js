(() => {
  'use strict';
  if(window.__ANDRIK_LIVE_EYE_R258__)return;
  window.__ANDRIK_LIVE_EYE_R258__=true;
  const VERSION='55.00-r258';
  const logo=document.getElementById('controlCenterLogo')||document.querySelector('.control-center-logo');
  if(!logo)return;

  const root=document.documentElement;
  const body=document.body;
  const path=String(location.pathname||'').toLowerCase();
  const allowed=new Set(['auto','green','blue','yellow','gold','red']);
  let manual='auto';
  let stage='auto';
  let goldUntil=0;
  let goldLatched=false;

  logo.dataset.r258LiveEye='1';
  logo.dataset.r256LiveEye='1';
  logo.dataset.r255LiveEye='1';
  logo.dataset.r254LiveEye='1';
  logo.dataset.r247LiveEye='1';
  logo.dataset.r244LiveEye='1';
  logo.dataset.r3dLiveEye='1';
  logo.setAttribute('role','button');
  logo.setAttribute('tabindex','0');
  logo.setAttribute('aria-label','Открыть живую анимацию ANDRIK');
  logo.removeAttribute('href');

  let motion=logo.querySelector('.andrik-live-eye-motion-r244');
  if(!motion){
    motion=document.createElement('span');
    motion.className='andrik-live-eye-motion-r244 andrik-live-eye-motion-r3d';
    [...logo.querySelectorAll(':scope > img')].forEach(img=>motion.appendChild(img));
    logo.appendChild(motion);
  }
  let halo=logo.querySelector('.andrik-live-eye-halo-r244');
  if(!halo){
    halo=document.createElement('span');
    halo.className='andrik-live-eye-halo-r244 andrik-live-eye-halo-r3d';
    logo.insertBefore(halo,motion);
  }

  const style=document.createElement('style');
  style.id='andrik-live-eye-style-r244';
  style.textContent=`
    @keyframes andrikR244EyePulse{0%,100%{transform:translate(-50%,-50%) scale(.9)}50%{transform:translate(-50%,-50%) scale(1.16)}}
    @keyframes andrikR244HaloPulse{0%,100%{transform:translate(-50%,-50%) scale(.7);opacity:.42}50%{transform:translate(-50%,-50%) scale(1.62);opacity:1}}
    @keyframes andrikR244HeaderPulse{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.18)}}
    html[data-andrik-header-state="green"]{--r244-eye-filter:brightness(1.24) saturate(1.62);--r244-eye-a:rgba(168,255,209,.98);--r244-eye-b:rgba(31,255,150,.86);--r244-halo:rgba(86,255,177,.78);--r244-bg1:rgba(0,255,157,.22);--r244-bg2:rgba(0,180,96,.10);--r244-line:#8cffc4;--r244-line-soft:rgba(120,255,188,.95)}
    html[data-andrik-header-state="blue"]{--r244-eye-filter:brightness(1.32) saturate(2.05) hue-rotate(74deg);--r244-eye-a:rgba(191,241,255,.99);--r244-eye-b:rgba(82,172,255,.9);--r244-halo:rgba(86,196,255,.82);--r244-bg1:rgba(72,193,255,.24);--r244-bg2:rgba(22,96,216,.11);--r244-line:#b6f2ff;--r244-line-soft:rgba(126,220,255,.98)}
    html[data-andrik-header-state="yellow"]{--r244-eye-filter:brightness(1.34) saturate(2.1) hue-rotate(-72deg);--r244-eye-a:rgba(255,244,181,.99);--r244-eye-b:rgba(255,188,44,.92);--r244-halo:rgba(255,221,98,.84);--r244-bg1:rgba(255,211,78,.24);--r244-bg2:rgba(207,128,10,.10);--r244-line:#fff2b8;--r244-line-soft:rgba(255,220,100,.98)}
    html[data-andrik-header-state="gold"]{--r244-eye-filter:brightness(1.24) saturate(1.84) hue-rotate(-82deg);--r244-eye-a:rgba(255,229,147,.99);--r244-eye-b:rgba(255,154,24,.78);--r244-halo:rgba(255,194,67,.74);--r244-bg1:rgba(255,203,77,.42);--r244-bg2:rgba(199,118,12,.20);--r244-line:#ffe6a0;--r244-line-soft:rgba(255,199,70,.96)}
    html[data-andrik-header-state="red"]{--r244-eye-filter:brightness(1.12) saturate(1.86) hue-rotate(238deg);--r244-eye-a:rgba(255,142,153,.96);--r244-eye-b:rgba(255,39,68,.72);--r244-halo:rgba(255,70,91,.66);--r244-bg1:rgba(255,54,77,.35);--r244-bg2:rgba(170,8,34,.17);--r244-line:#ff98a7;--r244-line-soft:rgba(255,81,101,.92)}
    html[data-andrik-section-lock="blue"]{--r244-eye-filter:brightness(1.36) saturate(2.15) hue-rotate(74deg);--r244-eye-a:rgba(198,244,255,.99);--r244-eye-b:rgba(74,176,255,.94);--r244-halo:rgba(84,199,255,.88);--r244-bg1:rgba(64,192,255,.28);--r244-bg2:rgba(18,103,220,.12);--r244-line:#baf4ff;--r244-line-soft:rgba(132,224,255,.99)}
    html[data-andrik-section-lock="yellow"]{--r244-eye-filter:brightness(1.36) saturate(2.12) hue-rotate(-72deg);--r244-eye-a:rgba(255,247,190,.99);--r244-eye-b:rgba(255,190,42,.94);--r244-halo:rgba(255,221,91,.88);--r244-bg1:rgba(255,208,58,.26);--r244-bg2:rgba(205,124,8,.11);--r244-line:#fff3b9;--r244-line-soft:rgba(255,222,104,.99)}
    body.control-page .control-topbar,body.comment-collection-page .control-topbar,.control-topbar{
      position:relative!important;overflow:hidden!important;border-bottom-color:var(--r244-line-soft)!important;
      background:linear-gradient(90deg,#010507 0%,#01090a 38%,#031017 50%,#01090a 62%,#010507 100%)!important;
      box-shadow:0 3px 0 color-mix(in srgb,var(--r244-line) 12%,transparent),0 10px 25px color-mix(in srgb,var(--r244-line) 13%,transparent)!important;
      animation:andrikR244HeaderPulse 1.45s ease-in-out infinite!important
    }
    body.control-page .control-topbar::before,body.comment-collection-page .control-topbar::before,.control-topbar::before{
      content:""!important;position:absolute!important;left:50%!important;right:auto!important;top:50%!important;bottom:auto!important;width:190px!important;height:118px!important;transform:translate(-50%,-50%)!important;pointer-events:none!important;
      background:radial-gradient(ellipse at center,var(--r244-bg1) 0%,var(--r244-bg2) 48%,transparent 76%)!important;opacity:.98!important
    }
    body.control-page .control-topbar::after,body.comment-collection-page .control-topbar::after,.control-topbar::after{
      content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:-1px!important;height:2px!important;pointer-events:none!important;
      background:linear-gradient(90deg,transparent 0%,transparent 30%,var(--r244-line-soft) 43%,var(--r244-line) 50%,var(--r244-line-soft) 57%,transparent 70%,transparent 100%)!important;
      box-shadow:0 0 9px var(--r244-line-soft),0 0 25px color-mix(in srgb,var(--r244-line) 64%,transparent)!important
    }
    .control-center-logo{position:relative!important;isolation:isolate!important;overflow:visible!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    .andrik-live-eye-motion-r244,.andrik-live-eye-halo-r244{position:absolute!important;left:50%!important;top:50%!important;transform-origin:50% 50%!important;pointer-events:none!important;will-change:transform,opacity,filter!important}
    .andrik-live-eye-motion-r244{width:100%!important;height:100%!important;z-index:3!important;animation:andrikR244EyePulse 1.12s ease-in-out infinite!important}
    .andrik-live-eye-halo-r244{width:146px!important;height:146px!important;border-radius:50%!important;z-index:1!important;background:radial-gradient(circle,var(--r244-halo) 0%,color-mix(in srgb,var(--r244-halo) 62%,transparent) 34%,transparent 74%)!important;filter:blur(12px)!important;animation:andrikR244HaloPulse 1.12s ease-in-out infinite!important}
    .andrik-live-eye-motion-r244 img{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;transform-origin:50% 50%!important}
    .andrik-live-eye-motion-r244 .logo-ok{display:block!important;opacity:1!important;visibility:visible!important;filter:var(--r244-eye-filter) drop-shadow(0 0 14px var(--r244-eye-a)) drop-shadow(0 0 36px var(--r244-eye-b)) drop-shadow(0 0 56px var(--r244-halo))!important}
    /* R258: override the older R88 green !important filter on locked sections. */
    html[data-andrik-section-lock="blue"] .control-center-logo:not(.is-error) .andrik-live-eye-motion-r244 .logo-ok,
    body.control-home-page .control-center-logo:not(.is-error) .andrik-live-eye-motion-r244 .logo-ok{
      filter:brightness(1.42) saturate(0) sepia(1) hue-rotate(148deg) saturate(7.4) brightness(1.18)
        drop-shadow(0 0 15px rgba(205,247,255,.99))
        drop-shadow(0 0 38px rgba(77,184,255,.96))
        drop-shadow(0 0 60px rgba(54,150,255,.72))!important;
    }
    html[data-andrik-section-lock="yellow"] .control-center-logo:not(.is-error) .andrik-live-eye-motion-r244 .logo-ok{
      filter:brightness(1.40) saturate(0) sepia(1) hue-rotate(350deg) saturate(7.2) brightness(1.20)
        drop-shadow(0 0 15px rgba(255,247,194,.99))
        drop-shadow(0 0 38px rgba(255,190,45,.96))
        drop-shadow(0 0 60px rgba(255,157,22,.70))!important;
    }
    .andrik-live-eye-motion-r244 .logo-error{display:none!important}
    .andrik-live-eye-overlay-r244{position:fixed!important;inset:0!important;z-index:2147483647!important;display:none!important;place-items:center!important;background:rgba(0,0,0,.96)!important;padding:0!important;overflow:hidden!important}
    .andrik-live-eye-overlay-r244.is-open{display:grid!important}
    .andrik-live-eye-stage-r247{position:relative!important;width:100vw!important;height:100dvh!important;overflow:hidden!important;border-radius:0!important;background:#000!important;box-shadow:none!important}
    .andrik-live-eye-stage-r247 video{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:50% 50%!important;transform:none!important;transform-origin:50% 50%!important;background:#000!important}
    @media(max-width:430px){.andrik-live-eye-stage-r247{width:100vw!important;height:100dvh!important;border-radius:0!important}}
    @media (prefers-reduced-motion:reduce){.andrik-live-eye-motion-r244,.andrik-live-eye-halo-r244{animation-duration:1.7s!important}.control-topbar{animation-duration:2.1s!important}}
  `;
  document.head.appendChild(style);

  const adminBluePage=(
    body?.classList.contains('control-home-page')||
    path.includes('control-home')||
    path.includes('admin-sections')||
    path.includes('service-admin')||
    path.includes('observability-admin')||
    path.includes('lyrics-admin')||
    path.includes('comments-admin')||
    path.includes('comment-collection')||
    path.includes('youtube-admin')||
    path.includes('youtube-comment-reply')
  );
  const pageLock=body?.classList.contains('protection-page')||path.includes('protection-admin')
    ? 'blue'
    : ((body?.classList.contains('attack-page')||path.includes('attack-map'))
      ? 'yellow'
      : (adminBluePage?'blue':'auto'));

  const readStage=()=>{
    const stages=document.getElementById('siteUpdateStages');
    if(!stages)return 'auto';
    const items=[...stages.querySelectorAll('[data-stage]')];
    const deploy=stages.querySelector('[data-stage="deploy"]');
    const protect=stages.querySelector('[data-stage="protect"]');
    const result=document.getElementById('siteUpdateResultState');
    const text=`${result?.textContent||''} ${document.getElementById('siteUpdateDeployMessage')?.textContent||''} ${document.getElementById('siteUpdateResultText')?.textContent||''}`;
    const error=items.some(x=>x.classList.contains('is-error'))||result?.classList.contains('is-error')||/ошиб|сбой|failed|failure|критичес/i.test(text);
    if(error)return 'red';
    if(deploy?.classList.contains('is-running')||deploy?.classList.contains('is-warn'))return 'yellow';
    if(items.some(x=>x.classList.contains('is-running')))return 'blue';
    const complete=deploy?.classList.contains('is-done')&&protect?.classList.contains('is-done')&&result?.classList.contains('is-ready');
    if(complete&&!goldLatched){goldLatched=true;goldUntil=Date.now()+5200;}
    if(complete&&Date.now()<goldUntil)return 'gold';
    if(!items.some(x=>/\bis-(?:running|done|warn|error|skipped)\b/.test(x.className))){goldLatched=false;goldUntil=0;}
    return 'auto';
  };

  const sync=()=>{
    stage=readStage();
    const critical=logo.classList.contains('is-error')||stage==='red'||manual==='red';
    const state=critical?'red':(pageLock!=='auto'?pageLock:(stage!=='auto'?stage:(manual!=='auto'?manual:(logo.classList.contains('is-checking')?'blue':'green'))));
    root.dataset.andrikHeaderState=state;
    if(pageLock!=='auto')root.dataset.andrikSectionLock=pageLock;else delete root.dataset.andrikSectionLock;
    logo.dataset.andrikGlowActive=state;
  };

  window.addEventListener('andrik:eye-glow',event=>{const next=String(event?.detail?.state||'auto').toLowerCase();manual=allowed.has(next)?next:'auto';sync();});
  window.addEventListener('andrik:site-update-stage',sync);
  const stages=document.getElementById('siteUpdateStages');
  if(stages)new MutationObserver(sync).observe(stages,{subtree:true,attributes:true,childList:true,characterData:true});
  new MutationObserver(sync).observe(logo,{attributes:true,attributeFilter:['class']});
  sync();
  setInterval(sync,900);

  let overlay=document.querySelector('.andrik-live-eye-overlay-r244');
  if(!overlay){
    overlay=document.createElement('div');overlay.className='andrik-live-eye-overlay-r244';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<div class="andrik-live-eye-stage-r247"><video muted playsinline preload="metadata" src="/assets/live-eye-r223.mp4?v=55.00-r223"></video></div>';
    document.body.appendChild(overlay);
  }
  const video=overlay.querySelector('video');
  const close=()=>{try{video.pause();video.currentTime=0}catch(_){}overlay.classList.remove('is-open');overlay.setAttribute('aria-hidden','true');};
  const open=e=>{e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();overlay.classList.add('is-open');overlay.setAttribute('aria-hidden','false');try{video.currentTime=0;video.play().catch(()=>{})}catch(_){}};
  let openedAt=0;
  const openSafe=e=>{openedAt=Date.now();open(e);};
  logo.addEventListener('click',openSafe,true);
  logo.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){openedAt=Date.now();open(e)}});
  video?.addEventListener('ended',close);
  const closeByTap=e=>{if(Date.now()-openedAt<420){e?.preventDefault?.();e?.stopPropagation?.();return;}close();};
  video?.addEventListener('click',closeByTap);
  overlay.addEventListener('click',closeByTap);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
