(() => {
  'use strict';
  if (window.__andrikLiveEyeR248) return;
  window.__andrikLiveEyeR248 = true;

  const root = document.documentElement;
  const body = document.body;
  const path = String(location.pathname || '').toLowerCase();
  const logo = document.getElementById('controlCenterLogo') || document.querySelector('.control-center-logo');
  if (!logo) return;

  logo.removeAttribute('href');
  logo.setAttribute('role', 'button');
  logo.setAttribute('tabindex', '0');
  logo.setAttribute('aria-label', 'Открыть живую анимацию ANDRIK');
  logo.setAttribute('title', 'Открыть живую анимацию ANDRIK');
  logo.dataset.r248LiveEye = '1';

  let motion = logo.querySelector('.andrik-live-eye-motion-r248, .andrik-live-eye-motion-r244, .andrik-live-eye-motion-r3d');
  if (!motion) {
    motion = document.createElement('span');
    logo.appendChild(motion);
  }
  motion.classList.add('andrik-live-eye-motion-r248', 'andrik-live-eye-motion-r3d');

  const allImages = [...logo.querySelectorAll('img')];
  allImages.forEach(img => { if (img.parentElement !== motion) motion.appendChild(img); });

  let halo = logo.querySelector('.andrik-live-eye-halo-r248, .andrik-live-eye-halo-r244, .andrik-live-eye-halo-r3d');
  if (!halo) {
    halo = document.createElement('span');
    logo.insertBefore(halo, motion);
  }
  halo.classList.add('andrik-live-eye-halo-r248', 'andrik-live-eye-halo-r3d');

  document.getElementById('andrik-live-eye-style-r248')?.remove();
  const style = document.createElement('style');
  style.id = 'andrik-live-eye-style-r248';
  style.textContent = `
    @keyframes andrikR248EyePulse{0%,100%{transform:translate(-50%,-50%) scale(.91)}50%{transform:translate(-50%,-50%) scale(1.12)}}
    @keyframes andrikR248HaloPulse{0%,100%{transform:translate(-50%,-50%) scale(.74);opacity:.30}50%{transform:translate(-50%,-50%) scale(1.46);opacity:.96}}
    @keyframes andrikR248HeaderPulse{0%,100%{filter:brightness(.94)}50%{filter:brightness(1.12)}}
    html[data-andrik-header-state="green"]{--r248-filter:brightness(1.15) saturate(1.48);--r248-a:rgba(115,255,176,.96);--r248-b:rgba(26,222,108,.68);--r248-halo:rgba(70,255,147,.67);--r248-bg:rgba(0,235,105,.31);--r248-bg2:rgba(0,126,63,.11);--r248-line:rgba(104,255,174,.96)}
    html[data-andrik-header-state="blue"]{--r248-filter:brightness(1.20) saturate(1.82) hue-rotate(74deg);--r248-a:rgba(134,231,255,.99);--r248-b:rgba(42,146,255,.78);--r248-halo:rgba(70,186,255,.76);--r248-bg:rgba(42,176,255,.36);--r248-bg2:rgba(21,92,190,.14);--r248-line:rgba(112,220,255,.98)}
    html[data-andrik-header-state="yellow"]{--r248-filter:brightness(1.24) saturate(1.90) hue-rotate(-70deg);--r248-a:rgba(255,244,146,.99);--r248-b:rgba(255,168,27,.82);--r248-halo:rgba(255,213,65,.78);--r248-bg:rgba(255,205,48,.38);--r248-bg2:rgba(176,102,7,.15);--r248-line:rgba(255,228,105,.99)}
    html[data-andrik-header-state="gold"]{--r248-filter:brightness(1.26) saturate(1.95) hue-rotate(-82deg);--r248-a:rgba(255,234,161,.99);--r248-b:rgba(255,145,18,.84);--r248-halo:rgba(255,186,52,.80);--r248-bg:rgba(255,191,48,.42);--r248-bg2:rgba(174,92,5,.17);--r248-line:rgba(255,214,112,.99)}
    html[data-andrik-header-state="red"]{--r248-filter:brightness(1.13) saturate(1.90) hue-rotate(238deg);--r248-a:rgba(255,145,156,.99);--r248-b:rgba(255,35,65,.80);--r248-halo:rgba(255,59,83,.76);--r248-bg:rgba(255,43,69,.36);--r248-bg2:rgba(139,3,27,.15);--r248-line:rgba(255,112,130,.98)}
    html[data-andrik-header-state] body.control-page .control-topbar,html[data-andrik-header-state] body.comment-collection-page .control-topbar,html[data-andrik-header-state] .control-topbar{
      position:relative!important;overflow:hidden!important;
      border-bottom-color:var(--r248-line)!important;
      background:radial-gradient(ellipse 42% 88% at 50% 50%,var(--r248-bg) 0%,var(--r248-bg2) 52%,rgba(1,8,9,.98) 100%)!important;
      box-shadow:0 2px 0 color-mix(in srgb,var(--r248-line) 78%,transparent),0 9px 25px color-mix(in srgb,var(--r248-line) 17%,transparent)!important;
      animation:andrikR248HeaderPulse 2.45s ease-in-out infinite!important
    }
    html[data-andrik-header-state] body.control-page .control-topbar::before,html[data-andrik-header-state] body.comment-collection-page .control-topbar::before,html[data-andrik-header-state] .control-topbar::before{
      content:""!important;display:block!important;position:absolute!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:auto!important;height:auto!important;transform:none!important;pointer-events:none!important;
      background:radial-gradient(ellipse 34% 82% at 50% 50%,color-mix(in srgb,var(--r248-bg) 90%,transparent),transparent 76%)!important;
      opacity:.92!important;transform:none!important
    }
    html[data-andrik-header-state] body.control-page .control-topbar::after,html[data-andrik-header-state] body.comment-collection-page .control-topbar::after,html[data-andrik-header-state] .control-topbar::after{
      content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:-1px!important;height:2px!important;pointer-events:none!important;
      background:linear-gradient(90deg,transparent,var(--r248-line) 20%,var(--r248-line) 80%,transparent)!important;
      box-shadow:0 0 10px var(--r248-line),0 0 22px color-mix(in srgb,var(--r248-line) 55%,transparent)!important
    }
    .control-center-logo{position:relative!important;isolation:isolate!important;overflow:visible!important;cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    .andrik-live-eye-motion-r248,.andrik-live-eye-halo-r248{position:absolute!important;left:50%!important;top:50%!important;transform-origin:50% 50%!important;pointer-events:none!important;will-change:transform,opacity,filter!important}
    html body.protection-page .andrik-live-eye-motion-r248.andrik-live-eye-motion-r3d,
    html body.attack-page .andrik-live-eye-motion-r248.andrik-live-eye-motion-r3d,
    .andrik-live-eye-motion-r248{width:100%!important;height:100%!important;z-index:3!important;filter:none!important;animation:andrikR248EyePulse 2.25s ease-in-out infinite!important}
    .andrik-live-eye-halo-r248{width:132px!important;height:132px!important;border-radius:50%!important;z-index:1!important;background:radial-gradient(circle,var(--r248-halo) 0%,color-mix(in srgb,var(--r248-halo) 50%,transparent) 34%,transparent 74%)!important;filter:blur(8px)!important;animation:andrikR248HaloPulse 2.25s ease-in-out infinite!important}
    .andrik-live-eye-motion-r248 img{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;transform-origin:50% 50%!important}
    .andrik-live-eye-motion-r248 .logo-ok{display:block!important;opacity:1!important;visibility:visible!important;filter:var(--r248-filter) drop-shadow(0 0 11px var(--r248-a)) drop-shadow(0 0 31px var(--r248-b))!important}
    .andrik-live-eye-motion-r248 .logo-error{display:none!important;opacity:0!important;visibility:hidden!important}
    html[data-andrik-header-state="red"] .andrik-live-eye-motion-r248 .logo-ok{display:none!important;opacity:0!important;visibility:hidden!important}
    html[data-andrik-header-state="red"] .andrik-live-eye-motion-r248 .logo-error{display:block!important;opacity:1!important;visibility:visible!important;filter:drop-shadow(0 0 12px rgba(255,102,119,.96)) drop-shadow(0 0 32px rgba(255,32,58,.78))!important}
    .andrik-live-eye-overlay-r248{position:fixed!important;inset:0!important;z-index:2147483647!important;display:none!important;place-items:center!important;background:rgba(0,0,0,.95)!important;padding:4px!important;overflow:hidden!important}
    .andrik-live-eye-overlay-r248.is-open{display:grid!important}
    .andrik-live-eye-stage-r248{position:relative!important;width:calc(100vw - 8px)!important;max-width:820px!important;height:min(90dvh,940px)!important;overflow:hidden!important;border-radius:28px!important;background:#000!important;box-shadow:0 0 56px color-mix(in srgb,var(--r248-line) 58%,transparent)!important}
    .andrik-live-eye-stage-r248 video{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:cover!important;object-position:50% 50%!important;transform:scaleX(1.24)!important;transform-origin:50% 50%!important;background:#000!important}
    .andrik-live-eye-close-r248{position:fixed!important;right:18px!important;top:max(18px,env(safe-area-inset-top))!important;width:52px!important;height:52px!important;border-radius:50%!important;border:1px solid var(--r248-line)!important;background:#07131b!important;color:#fff!important;font-size:30px!important;line-height:1!important;z-index:3!important}
    @media(max-width:430px){.andrik-live-eye-stage-r248{width:calc(100vw - 6px)!important;height:89dvh!important;border-radius:24px!important}}
  `;
  document.head.appendChild(style);

  const pageLock = body?.classList.contains('protection-page') || path.includes('protection-admin')
    ? 'blue'
    : (body?.classList.contains('attack-page') || path.includes('attack-map') ? 'yellow' : 'auto');

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
    const text = `${result?.textContent||''} ${document.getElementById('siteUpdateDeployMessage')?.textContent||''} ${document.getElementById('siteUpdateResultText')?.textContent||''}`;
    if (items.some(x => x.classList.contains('is-error')) || result?.classList.contains('is-error') || /ошиб|сбой|failed|failure|критичес/i.test(text)) return 'red';
    if (deploy?.classList.contains('is-running') || deploy?.classList.contains('is-warn')) return 'yellow';
    if (items.some(x => x.classList.contains('is-running'))) return 'blue';
    const complete = deploy?.classList.contains('is-done') && protect?.classList.contains('is-done') && result?.classList.contains('is-ready');
    if (complete && !goldLatched) { goldLatched = true; goldUntil = Date.now() + 5200; }
    if (complete && Date.now() < goldUntil) return 'gold';
    if (!items.some(x => /\bis-(?:running|done|warn|error|skipped)\b/.test(x.className))) { goldLatched = false; goldUntil = 0; }
    return 'auto';
  };

  const sync = () => {
    logo.removeAttribute('href');
    logo.setAttribute('aria-label', 'Открыть живую анимацию ANDRIK');
    logo.setAttribute('title', 'Открыть живую анимацию ANDRIK');
    const stage = readStage();
    const critical = logo.classList.contains('is-error') || stage === 'red' || manual === 'red';
    const state = critical ? 'red' : (pageLock !== 'auto' ? pageLock : (stage !== 'auto' ? stage : (manual !== 'auto' ? manual : (logo.classList.contains('is-checking') ? 'blue' : 'green'))));
    root.dataset.andrikHeaderState = state;
  };

  window.AndrikHeaderState = {
    set(value='auto') { manual = allowed.has(value) ? value : 'auto'; sync(); return root.dataset.andrikHeaderState; },
    clear() { manual = 'auto'; sync(); },
    get() { return root.dataset.andrikHeaderState || 'green'; }
  };
  window.addEventListener('andrik:header-state', event => window.AndrikHeaderState.set(event?.detail?.state || event?.detail || 'auto'));

  new MutationObserver(sync).observe(logo, {attributes:true, attributeFilter:['class']});
  const stages = document.getElementById('siteUpdateStages');
  if (stages) new MutationObserver(sync).observe(stages, {subtree:true, attributes:true, childList:true, characterData:true});
  sync();
  setInterval(() => { if (!document.hidden) sync(); }, 900);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync, {passive:true});

  let overlay = document.querySelector('.andrik-live-eye-overlay-r248');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'andrik-live-eye-overlay-r248';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="andrik-live-eye-stage-r248"><video muted playsinline webkit-playsinline preload="metadata" src="/assets/live-eye-r223.mp4?v=55.00-r223"></video></div><button class="andrik-live-eye-close-r248" type="button" aria-label="Закрыть">×</button>';
    document.body.appendChild(overlay);
  }
  const video = overlay.querySelector('video');
  const close = event => {
    event?.preventDefault?.(); event?.stopPropagation?.(); event?.stopImmediatePropagation?.();
    try { video.pause(); video.currentTime = 0; } catch (_) {}
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  };
  const open = event => {
    event?.preventDefault?.(); event?.stopPropagation?.(); event?.stopImmediatePropagation?.();
    logo.removeAttribute('href');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    try { video.currentTime = 0; video.play().catch(() => {}); } catch (_) {}
    return false;
  };

  ['pointerdown','click','touchend'].forEach(type => logo.addEventListener(type, open, {capture:true, passive:false}));
  logo.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(event); }, true);
  overlay.querySelector('.andrik-live-eye-close-r248')?.addEventListener('click', close, true);
  video?.addEventListener('ended', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(event); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(event); });
})();
