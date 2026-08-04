(() => {
  'use strict';
  const VERSION='55.00-r244';
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
    @keyframes andrikR244EyePulse{0%,100%{transform:translate(-50%,-50%) scale(.91)}50%{transform:translate(-50%,-50%) scale(1.13)}}
    @keyframes andrikR244HaloPulse{0%,100%{transform:translate(-50%,-50%) scale(.76);opacity:.26}50%{transform:translate(-50%,-50%) scale(1.48);opacity:.94}}
    @keyframes andrikR244HeaderPulse{0%,100%{filter:brightness(.92)}50%{filter:brightness(1.14)}}
    html[data-andrik-header-state="green"]{--r244-eye-filter:brightness(1.14) saturate(1.42);--r244-eye-a:rgba(114,255,175,.90);--r244-eye-b:rgba(29,218,108,.58);--r244-halo:rgba(80,255,151,.58);--r244-bg1:rgba(0,255,119,.30);--r244-bg2:rgba(0,180,77,.13);--r244-line:#79ffb6;--r244-line-soft:rgba(89,255,160,.86)}
    html[data-andrik-header-state="blue"]{--r244-eye-filter:brightness(1.18) saturate(1.70) hue-rotate(74deg);--r244-eye-a:rgba(126,224,255,.95);--r244-eye-b:rgba(49,145,255,.67);--r244-halo:rgba(79,188,255,.64);--r244-bg1:rgba(55,184,255,.34);--r244-bg2:rgba(24,104,208,.15);--r244-line:#9ceaff;--r244-line-soft:rgba(91,204,255,.92)}
    html[data-andrik-header-state="yellow"]{--r244-eye-filter:brightness(1.22) saturate(1.76) hue-rotate(-70deg);--r244-eye-a:rgba(255,239,137,.97);--r244-eye-b:rgba(255,177,34,.72);--r244-halo:rgba(255,217,80,.66);--r244-bg1:rgba(255,214,64,.35);--r244-bg2:rgba(205,130,12,.16);--r244-line:#fff2a9;--r244-line-soft:rgba(255,218,80,.94)}
    html[data-andrik-header-state="gold"]{--r244-eye-filter:brightness(1.24) saturate(1.84) hue-rotate(-82deg);--r244-eye-a:rgba(255,229,147,.99);--r244-eye-b:rgba(255,154,24,.78);--r244-halo:rgba(255,194,67,.74);--r244-bg1:rgba(255,203,77,.42);--r244-bg2:rgba(199,118,12,.20);--r244-line:#ffe6a0;--r244-line-soft:rgba(255,199,70,.96)}
    html[data-andrik-header-state="red"]{--r244-eye-filter:brightness(1.12) saturate(1.86) hue-rotate(238deg);--r244-eye-a:rgba(255,142,153,.96);--r244-eye-b:rgba(255,39,68,.72);--r244-halo:rgba(255,70,91,.66);--r244-bg1:rgba(255,54,77,.35);--r244-bg2:rgba(170,8,34,.17);--r244-line:#ff98a7;--r244-line-soft:rgba(255,81,101,.92)}
    body.control-page .control-topbar,body.comment-collection-page .control-topbar,.control-topbar{
      position:relative!important;overflow:visible!important;border-bottom-color:var(--r244-line-soft)!important;
      background:radial-gradient(ellipse at 50% 52%,var(--r244-bg1) 0%,var(--r244-bg2) 24%,transparent 58%),linear-gradient(90deg,#01070a 0%,#03140f 36%,#061f18 50%,#03140f 64%,#01070a 100%)!important;
      box-shadow:0 3px 0 color-mix(in srgb,var(--r244-line) 12%,transparent),0 12px 36px color-mix(in srgb,var(--r244-line) 22%,transparent)!important;
      animation:andrikR244HeaderPulse 2.45s ease-in-out infinite!important
    }
    body.control-page .control-topbar::before,body.comment-collection-page .control-topbar::before,.control-topbar::before{
      content:""!important;position:absolute!important;inset:0!important;pointer-events:none!important;
      background:radial-gradient(ellipse at center,var(--r244-bg1),var(--r244-bg2) 38%,transparent 72%)!important;opacity:1!important
    }
    body.control-page .control-topbar::after,body.comment-collection-page .control-topbar::after,.control-topbar::after{
      content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:-1px!important;height:2px!important;pointer-events:none!important;
      background:linear-gradient(90deg,transparent,var(--r244-line-soft) 18%,var(--r244-line) 50%,var(--r244-line-soft) 82%,transparent)!important;
      box-shadow:0 0 9px var(--r244-line-soft),0 0 25px color-mix(in srgb,var(--r244-line) 64%,transparent)!important
    }
    .control-center-logo{position:relative!important;isolation:isolate!important;overflow:visible!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    .andrik-live-eye-motion-r244,.andrik-live-eye-halo-r244{position:absolute!important;left:50%!important;top:50%!important;transform-origin:50% 50%!important;pointer-events:none!important;will-change:transform,opacity,filter!important}
    .andrik-live-eye-motion-r244{width:100%!important;height:100%!important;z-index:3!important;animation:andrikR244EyePulse 2.32s ease-in-out infinite!important}
    .andrik-live-eye-halo-r244{width:128px!important;height:128px!important;border-radius:50%!important;z-index:1!important;background:radial-gradient(circle,var(--r244-halo) 0%,color-mix(in srgb,var(--r244-halo) 55%,transparent) 31%,transparent 73%)!important;filter:blur(9px)!important;animation:andrikR244HaloPulse 2.32s ease-in-out infinite!important}
    .andrik-live-eye-motion-r244 img{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;transform-origin:50% 50%!important}
    .andrik-live-eye-motion-r244 .logo-ok{display:block!important;opacity:1!important;visibility:visible!important;filter:var(--r244-eye-filter) drop-shadow(0 0 10px var(--r244-eye-a)) drop-shadow(0 0 28px var(--r244-eye-b))!important}
    .andrik-live-eye-motion-r244 .logo-error{display:none!important}
    .andrik-live-eye-overlay-r244{position:fixed!important;inset:0!important;z-index:2147483647!important;display:none!important;place-items:center!important;background:rgba(0,0,0,.94)!important;padding:18px!important}
    .andrik-live-eye-overlay-r244.is-open{display:grid!important}
    .andrik-live-eye-overlay-r244 video{display:block!important;width:min(92vw,720px)!important;max-height:84vh!important;border-radius:28px!important;box-shadow:0 0 54px color-mix(in srgb,var(--r244-line) 55%,transparent)!important;background:#000!important}
    .andrik-live-eye-overlay-r244 button{position:fixed!important;right:18px!important;top:max(18px,env(safe-area-inset-top))!important;width:52px!important;height:52px!important;border-radius:50%!important;border:1px solid var(--r244-line-soft)!important;background:#07131b!important;color:#fff!important;font-size:30px!important;line-height:1!important}
    @media (prefers-reduced-motion:reduce){.andrik-live-eye-motion-r244,.andrik-live-eye-halo-r244,.control-topbar{animation-duration:3.2s!important}}
  `;
  document.head.appendChild(style);

  const pageLock=body?.classList.contains('protection-page')||path.includes('protection-admin')
    ? 'blue'
    : (body?.classList.contains('attack-page')||path.includes('attack-map')?'yellow':'auto');

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
    overlay.innerHTML='<video muted playsinline preload="metadata" src="/assets/live-eye-r223.mp4?v=55.00-r223"></video><button type="button" aria-label="Закрыть">×</button>';
    document.body.appendChild(overlay);
  }
  const video=overlay.querySelector('video');
  const close=()=>{try{video.pause();video.currentTime=0}catch(_){}overlay.classList.remove('is-open');overlay.setAttribute('aria-hidden','true');};
  const open=e=>{e?.preventDefault?.();e?.stopPropagation?.();overlay.classList.add('is-open');overlay.setAttribute('aria-hidden','false');try{video.currentTime=0;video.play().catch(()=>{})}catch(_){}};
  logo.addEventListener('click',open,true);
  logo.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){open(e)}});
  overlay.querySelector('button')?.addEventListener('click',close);
  video?.addEventListener('ended',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
