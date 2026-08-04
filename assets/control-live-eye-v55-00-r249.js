(() => {
  'use strict';
  if (window.__andrikLiveEyeR249) return;
  window.__andrikLiveEyeR249 = true;

  const root = document.documentElement;
  const body = document.body;
  const path = String(location.pathname || '').toLowerCase();
  const logo = document.getElementById('controlCenterLogo') || document.querySelector('.control-center-logo');
  if (!logo) return;

  const isProtection = body?.classList.contains('protection-page') || path.includes('protection-admin');
  const isAttack = body?.classList.contains('attack-page') || path.includes('attack-map');
  const pageLock = isProtection ? 'blue' : (isAttack ? 'yellow' : 'auto');

  logo.removeAttribute('href');
  logo.setAttribute('role', 'button');
  logo.setAttribute('tabindex', '0');
  logo.setAttribute('aria-label', 'Открыть живую анимацию ANDRIK');
  logo.setAttribute('title', 'Открыть живую анимацию ANDRIK');

  let motion = logo.querySelector('.andrik-live-eye-motion-r249, .andrik-live-eye-motion-r248, .andrik-live-eye-motion-r247, .andrik-live-eye-motion-r244, .andrik-live-eye-motion-r3d');
  if (!motion) {
    motion = document.createElement('span');
    logo.appendChild(motion);
  }
  motion.className = 'andrik-live-eye-motion-r249 andrik-live-eye-motion-r3d';

  [...logo.querySelectorAll('img')].forEach(img => {
    if (img.parentElement !== motion) motion.appendChild(img);
  });

  let halo = logo.querySelector('.andrik-live-eye-halo-r249, .andrik-live-eye-halo-r248, .andrik-live-eye-halo-r247, .andrik-live-eye-halo-r244, .andrik-live-eye-halo-r3d');
  if (!halo) {
    halo = document.createElement('span');
    logo.insertBefore(halo, motion);
  }
  halo.className = 'andrik-live-eye-halo-r249 andrik-live-eye-halo-r3d';

  document.querySelectorAll('#andrik-live-eye-style-r248,#andrik-live-eye-style-r247,#andrik-live-eye-style-r244,#andrik-live-eye-style-r249').forEach(node => node.remove());
  const style = document.createElement('style');
  style.id = 'andrik-live-eye-style-r249';
  style.textContent = `
    @keyframes andrikR249EyePulse{0%,100%{transform:translate(-50%,-50%) scale(.90);opacity:.92}50%{transform:translate(-50%,-50%) scale(1.15);opacity:1}}
    @keyframes andrikR249HaloPulse{0%,100%{transform:translate(-50%,-50%) scale(.74);opacity:.42}50%{transform:translate(-50%,-50%) scale(1.58);opacity:1}}
    @keyframes andrikR249HeaderPulse{0%,100%{filter:brightness(.96)}50%{filter:brightness(1.16)}}
    html[data-andrik-header-state="green"]{--r249-filter:brightness(1.30) saturate(1.70);--r249-a:rgba(151,255,194,1);--r249-b:rgba(29,255,130,.92);--r249-c:rgba(0,192,87,.72);--r249-halo:rgba(63,255,143,.86);--r249-bg:rgba(0,226,100,.27);--r249-bg2:rgba(0,91,46,.10);--r249-line:rgba(110,255,178,.98)}
    html[data-andrik-header-state="blue"]{--r249-filter:brightness(1.34) saturate(2.35) hue-rotate(102deg);--r249-a:rgba(166,242,255,1);--r249-b:rgba(44,171,255,.98);--r249-c:rgba(0,91,255,.78);--r249-halo:rgba(49,173,255,.96);--r249-bg:rgba(34,151,255,.32);--r249-bg2:rgba(15,65,160,.12);--r249-line:rgba(111,220,255,.99)}
    html[data-andrik-header-state="yellow"]{--r249-filter:brightness(1.40) saturate(2.40) hue-rotate(-68deg);--r249-a:rgba(255,250,171,1);--r249-b:rgba(255,185,38,.98);--r249-c:rgba(255,111,0,.78);--r249-halo:rgba(255,204,48,.96);--r249-bg:rgba(255,192,35,.34);--r249-bg2:rgba(135,71,0,.13);--r249-line:rgba(255,225,104,.99)}
    html[data-andrik-header-state="gold"]{--r249-filter:brightness(1.42) saturate(2.45) hue-rotate(-78deg);--r249-a:rgba(255,241,180,1);--r249-b:rgba(255,153,27,.98);--r249-c:rgba(255,87,0,.82);--r249-halo:rgba(255,171,36,.98);--r249-bg:rgba(255,174,28,.38);--r249-bg2:rgba(130,59,0,.15);--r249-line:rgba(255,211,104,.99)}
    html[data-andrik-header-state="red"]{--r249-filter:brightness(1.28) saturate(2.25) hue-rotate(235deg);--r249-a:rgba(255,171,180,1);--r249-b:rgba(255,46,72,.98);--r249-c:rgba(176,0,28,.80);--r249-halo:rgba(255,50,77,.94);--r249-bg:rgba(255,38,67,.32);--r249-bg2:rgba(114,0,21,.13);--r249-line:rgba(255,112,130,.99)}
    html[data-andrik-header-state] .control-topbar{
      position:relative!important;overflow:hidden!important;border-bottom-color:var(--r249-line)!important;
      background:radial-gradient(ellipse 38% 84% at 50% 50%,var(--r249-bg) 0%,var(--r249-bg2) 52%,rgba(1,8,9,.985) 100%)!important;
      box-shadow:0 2px 0 color-mix(in srgb,var(--r249-line) 82%,transparent),0 10px 28px color-mix(in srgb,var(--r249-line) 17%,transparent)!important;
      animation:andrikR249HeaderPulse 2.35s ease-in-out infinite!important
    }
    html[data-andrik-header-state] .control-topbar::before{
      content:""!important;display:block!important;position:absolute!important;inset:0!important;pointer-events:none!important;
      background:radial-gradient(ellipse 30% 78% at 50% 50%,color-mix(in srgb,var(--r249-bg) 92%,transparent),transparent 78%)!important;
      opacity:.96!important
    }
    html[data-andrik-header-state] .control-topbar::after{
      content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:-1px!important;height:2px!important;pointer-events:none!important;
      background:linear-gradient(90deg,transparent,var(--r249-line) 22%,var(--r249-line) 78%,transparent)!important;
      box-shadow:0 0 12px var(--r249-line),0 0 25px color-mix(in srgb,var(--r249-line) 58%,transparent)!important
    }
    .control-center-logo{position:relative!important;isolation:isolate!important;overflow:visible!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    .andrik-live-eye-motion-r249,.andrik-live-eye-halo-r249{position:absolute!important;left:50%!important;top:50%!important;transform-origin:50% 50%!important;pointer-events:none!important;will-change:transform,opacity,filter!important}
    .andrik-live-eye-motion-r249{width:100%!important;height:100%!important;z-index:3!important;animation:andrikR249EyePulse 2.12s ease-in-out infinite!important}
    .andrik-live-eye-halo-r249{width:168px!important;height:168px!important;border-radius:50%!important;z-index:1!important;background:radial-gradient(circle,var(--r249-halo) 0%,color-mix(in srgb,var(--r249-halo) 62%,transparent) 31%,transparent 73%)!important;filter:blur(9px)!important;animation:andrikR249HaloPulse 2.12s ease-in-out infinite!important}
    .andrik-live-eye-motion-r249 img{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;transform-origin:50% 50%!important}
    .andrik-live-eye-motion-r249 .logo-ok{display:block!important;opacity:1!important;visibility:visible!important;filter:var(--r249-filter) drop-shadow(0 0 14px var(--r249-a)) drop-shadow(0 0 36px var(--r249-b)) drop-shadow(0 0 58px var(--r249-c))!important}
    .andrik-live-eye-motion-r249 .logo-error{display:none!important;opacity:0!important;visibility:hidden!important}
    html[data-andrik-header-state="red"] .andrik-live-eye-motion-r249 .logo-ok{display:none!important;opacity:0!important;visibility:hidden!important}
    html[data-andrik-header-state="red"] .andrik-live-eye-motion-r249 .logo-error{display:block!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 0 15px rgba(255,117,132,1)) drop-shadow(0 0 38px rgba(255,25,56,.94)) drop-shadow(0 0 58px rgba(173,0,28,.78))!important}
    .andrik-live-eye-overlay-r249{position:fixed!important;inset:0!important;z-index:2147483647!important;display:none!important;background:#000!important;padding:0!important;margin:0!important;overflow:hidden!important;touch-action:manipulation!important}
    .andrik-live-eye-overlay-r249.is-open{display:block!important}
    .andrik-live-eye-stage-r249{position:absolute!important;inset:0!important;width:100vw!important;height:100dvh!important;overflow:hidden!important;background:#000!important;border:0!important;border-radius:0!important}
    .andrik-live-eye-stage-r249 video{display:block!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:50% 50%!important;transform:none!important;background:#000!important}
  `;
  document.head.appendChild(style);

  let manual = 'auto';
  let goldUntil = 0;
  let goldLatched = false;
  const allowed = new Set(['auto','green','blue','yellow','gold','red']);

  const readStage = () => {
    const stages = document.getElementById('siteUpdateStages');
    if (!stages) return 'auto';
    const items = [...stages.querySelectorAll('[data-stage]')];
    const deploy = stages.querySelector('[data-stage="deploy"]');
    const protect = stages.querySelector('[data-stage="protect"]');
    const result = document.getElementById('siteUpdateResultState');
    const text = `${result?.textContent || ''} ${document.getElementById('siteUpdateDeployMessage')?.textContent || ''} ${document.getElementById('siteUpdateResultText')?.textContent || ''}`;
    if (items.some(item => item.classList.contains('is-error')) || result?.classList.contains('is-error') || /ошиб|сбой|failed|failure|критичес/i.test(text)) return 'red';
    if (deploy?.classList.contains('is-running') || deploy?.classList.contains('is-warn')) return 'yellow';
    if (items.some(item => item.classList.contains('is-running'))) return 'blue';
    const complete = deploy?.classList.contains('is-done') && protect?.classList.contains('is-done') && result?.classList.contains('is-ready');
    if (complete && !goldLatched) { goldLatched = true; goldUntil = Date.now() + 5200; }
    if (complete && Date.now() < goldUntil) return 'gold';
    if (!items.some(item => /\bis-(?:running|done|warn|error|skipped)\b/.test(item.className))) { goldLatched = false; goldUntil = 0; }
    return 'auto';
  };

  const sync = () => {
    logo.removeAttribute('href');
    const stage = readStage();
    const critical = logo.classList.contains('is-error') || stage === 'red' || manual === 'red';
    const state = critical ? 'red' : (pageLock !== 'auto' ? pageLock : (stage !== 'auto' ? stage : (manual !== 'auto' ? manual : (logo.classList.contains('is-checking') ? 'blue' : 'green'))));
    root.dataset.andrikHeaderState = state;
  };

  window.AndrikHeaderState = {
    set(value = 'auto') { manual = allowed.has(value) ? value : 'auto'; sync(); return root.dataset.andrikHeaderState; },
    clear() { manual = 'auto'; sync(); },
    get() { return root.dataset.andrikHeaderState || 'green'; }
  };
  window.addEventListener('andrik:header-state', event => window.AndrikHeaderState.set(event?.detail?.state || event?.detail || 'auto'));

  new MutationObserver(sync).observe(logo, {attributes:true, attributeFilter:['class']});
  const stages = document.getElementById('siteUpdateStages');
  if (stages) new MutationObserver(sync).observe(stages, {subtree:true, attributes:true, childList:true, characterData:true});
  sync();
  setInterval(() => { if (!document.hidden) sync(); }, 850);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync, {passive:true});

  document.querySelectorAll('.andrik-live-eye-overlay-r248,.andrik-live-eye-overlay-r247,.andrik-live-eye-overlay-r244').forEach(node => node.remove());
  let overlay = document.querySelector('.andrik-live-eye-overlay-r249');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'andrik-live-eye-overlay-r249';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="andrik-live-eye-stage-r249"><video muted playsinline webkit-playsinline preload="metadata" src="/assets/live-eye-r223.mp4?v=55.00-r249"></video></div>';
    document.body.appendChild(overlay);
  }
  const video = overlay.querySelector('video');
  let lastOpenAt = 0;
  const close = event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    try { video?.pause(); if (video) video.currentTime = 0; } catch (_) {}
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  };
  const open = event => {
    const now = Date.now();
    if (now - lastOpenAt < 400) return false;
    lastOpenAt = now;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    logo.removeAttribute('href');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    try { if (video) { video.currentTime = 0; video.play().catch(() => {}); } } catch (_) {}
    return false;
  };

  logo.onclick = open;
  logo.addEventListener('click', open, {capture:true, passive:false});
  logo.addEventListener('touchend', open, {capture:true, passive:false});
  logo.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(event); }, true);
  document.addEventListener('click', event => {
    const targetLogo = event.target?.closest?.('#controlCenterLogo,.control-center-logo');
    if (targetLogo === logo) open(event);
  }, true);
  overlay.addEventListener('click', close, {capture:true, passive:false});
  video?.addEventListener('ended', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay.classList.contains('is-open')) close(event); });
  window.addEventListener('popstate', () => { if (overlay.classList.contains('is-open')) close(); });
})();
