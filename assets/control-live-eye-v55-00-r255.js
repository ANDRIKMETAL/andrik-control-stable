(() => {
  'use strict';
  if (window.__ANDRIK_LIVE_EYE_R255__) return;
  window.__ANDRIK_LIVE_EYE_R255__ = true;

  const VERSION = '55.00-r255';
  const logo = document.getElementById('controlCenterLogo') || document.querySelector('.control-center-logo');
  if (!logo) return;

  const root = document.documentElement;
  const body = document.body;
  const path = String(location.pathname || '').toLowerCase();
  const allowed = new Set(['auto', 'green', 'blue', 'yellow', 'gold', 'red']);
  let manual = 'auto';
  let goldUntil = 0;
  let goldLatched = false;
  let syncTimer = 0;

  logo.dataset.r255LiveEye = '1';
  logo.setAttribute('role', 'button');
  logo.setAttribute('tabindex', '0');
  logo.setAttribute('aria-label', 'Открыть живую анимацию ANDRIK');
  logo.setAttribute('href', '#andrik-live-eye');

  let motion = logo.querySelector('.andrik-live-eye-motion-r255');
  if (!motion) {
    motion = document.createElement('span');
    motion.className = 'andrik-live-eye-motion-r255';
    [...logo.querySelectorAll(':scope > img')].forEach(img => motion.appendChild(img));
    logo.appendChild(motion);
  }

  let halo = logo.querySelector('.andrik-live-eye-halo-r255');
  if (!halo) {
    halo = document.createElement('span');
    halo.className = 'andrik-live-eye-halo-r255';
    logo.insertBefore(halo, motion);
  }

  const style = document.createElement('style');
  style.id = 'andrik-live-eye-style-r255';
  style.textContent = `
    @keyframes andrikR255EyePulse{0%,100%{transform:translate(-50%,-50%) scale(.90)}50%{transform:translate(-50%,-50%) scale(1.16)}}
    @keyframes andrikR255HaloPulse{0%,100%{transform:translate(-50%,-50%) scale(.72);opacity:.38}50%{transform:translate(-50%,-50%) scale(1.48);opacity:.96}}
    @keyframes andrikR255HeaderPulse{0%,100%{filter:brightness(.97)}50%{filter:brightness(1.14)}}

    html[data-andrik-header-state="green"]{--r255-eye-filter:brightness(1.27) saturate(1.70);--r255-eye-a:rgba(174,255,213,.99);--r255-eye-b:rgba(39,255,151,.90);--r255-halo:rgba(80,255,173,.78);--r255-bg1:rgba(0,255,157,.22);--r255-bg2:rgba(0,180,96,.10);--r255-line:#8cffc4;--r255-line-soft:rgba(120,255,188,.96)}
    html[data-andrik-header-state="blue"]{--r255-eye-filter:brightness(1.38) saturate(2.20) hue-rotate(78deg);--r255-eye-a:rgba(205,246,255,.99);--r255-eye-b:rgba(57,174,255,.96);--r255-halo:rgba(55,184,255,.84);--r255-bg1:rgba(55,185,255,.26);--r255-bg2:rgba(17,91,209,.12);--r255-line:#b9f3ff;--r255-line-soft:rgba(112,213,255,.98)}
    html[data-andrik-header-state="yellow"]{--r255-eye-filter:brightness(1.40) saturate(2.22) hue-rotate(-72deg);--r255-eye-a:rgba(255,247,190,.99);--r255-eye-b:rgba(255,187,34,.96);--r255-halo:rgba(255,214,72,.84);--r255-bg1:rgba(255,205,54,.24);--r255-bg2:rgba(190,111,4,.11);--r255-line:#fff1ad;--r255-line-soft:rgba(255,214,77,.98)}
    html[data-andrik-header-state="gold"]{--r255-eye-filter:brightness(1.31) saturate(2.00) hue-rotate(-82deg);--r255-eye-a:rgba(255,235,161,.99);--r255-eye-b:rgba(255,153,20,.88);--r255-halo:rgba(255,187,52,.78);--r255-bg1:rgba(255,194,55,.38);--r255-bg2:rgba(195,108,5,.18);--r255-line:#ffe39a;--r255-line-soft:rgba(255,190,57,.97)}
    html[data-andrik-header-state="red"]{--r255-eye-filter:brightness(1.16) saturate(1.96) hue-rotate(238deg);--r255-eye-a:rgba(255,154,164,.98);--r255-eye-b:rgba(255,37,67,.80);--r255-halo:rgba(255,59,84,.70);--r255-bg1:rgba(255,48,72,.34);--r255-bg2:rgba(165,5,29,.17);--r255-line:#ff9baa;--r255-line-soft:rgba(255,76,98,.94)}

    body.control-page .control-topbar,
    body.comment-collection-page .control-topbar,
    .control-topbar{
      position:relative!important;
      overflow:hidden!important;
      border-bottom-color:var(--r255-line-soft)!important;
      background:
        radial-gradient(ellipse 31% 88% at 50% 48%,var(--r255-bg1) 0%,var(--r255-bg2) 40%,transparent 70%),
        linear-gradient(90deg,#010507 0%,#01090a 34%,#031017 50%,#01090a 66%,#010507 100%)!important;
      box-shadow:0 3px 0 color-mix(in srgb,var(--r255-line) 12%,transparent),0 10px 25px color-mix(in srgb,var(--r255-line) 13%,transparent)!important;
      animation:andrikR255HeaderPulse 1.55s ease-in-out infinite!important;
    }
    body.control-page .control-topbar::before,
    body.comment-collection-page .control-topbar::before,
    .control-topbar::before{
      content:""!important;
      position:absolute!important;
      left:25%!important;
      right:25%!important;
      top:0!important;
      bottom:0!important;
      pointer-events:none!important;
      background:radial-gradient(ellipse at 50% 50%,var(--r255-bg1) 0%,var(--r255-bg2) 45%,transparent 75%)!important;
      opacity:.94!important;
    }
    body.control-page .control-topbar::after,
    body.comment-collection-page .control-topbar::after,
    .control-topbar::after{
      content:""!important;
      position:absolute!important;
      left:0!important;
      right:0!important;
      bottom:-1px!important;
      height:2px!important;
      pointer-events:none!important;
      background:linear-gradient(90deg,transparent,var(--r255-line-soft) 18%,var(--r255-line) 50%,var(--r255-line-soft) 82%,transparent)!important;
      box-shadow:0 0 9px var(--r255-line-soft),0 0 25px color-mix(in srgb,var(--r255-line) 64%,transparent)!important;
    }

    body.r137-eye-motion-page .control-topbar .control-center-logo,
    body.r136-standard-header-page .control-topbar .control-center-logo,
    body.r139-standard-header-page .control-topbar .control-center-logo,
    .control-topbar .control-center-logo{
      position:relative!important;
      isolation:isolate!important;
      overflow:visible!important;
      cursor:pointer!important;
      touch-action:manipulation!important;
      -webkit-tap-highlight-color:transparent!important;
      animation:none!important;
      transform:translate(-50%,-50%)!important;
    }
    body.r137-eye-motion-page .control-topbar .control-center-logo::before,
    body.r137-eye-motion-page .control-topbar .control-center-logo::after,
    body.r136-standard-header-page .control-topbar .control-center-logo::before,
    body.r136-standard-header-page .control-topbar .control-center-logo::after,
    body.r139-standard-header-page .control-topbar .control-center-logo::before,
    body.r139-standard-header-page .control-topbar .control-center-logo::after,
    .control-topbar .control-center-logo::before,
    .control-topbar .control-center-logo::after{
      content:none!important;
      display:none!important;
      animation:none!important;
      box-shadow:none!important;
      background:none!important;
    }
    .andrik-live-eye-motion-r255,.andrik-live-eye-halo-r255{
      position:absolute!important;
      left:50%!important;
      top:50%!important;
      transform-origin:50% 50%!important;
      pointer-events:none!important;
      will-change:transform,opacity,filter!important;
    }
    .andrik-live-eye-motion-r255{
      width:100%!important;
      height:100%!important;
      z-index:3!important;
      animation:andrikR255EyePulse 1.15s ease-in-out infinite!important;
    }
    .andrik-live-eye-halo-r255{
      width:142px!important;
      height:142px!important;
      border-radius:50%!important;
      z-index:1!important;
      background:radial-gradient(circle,var(--r255-halo) 0%,color-mix(in srgb,var(--r255-halo) 60%,transparent) 34%,transparent 73%)!important;
      filter:blur(12px)!important;
      animation:andrikR255HaloPulse 1.15s ease-in-out infinite!important;
    }
    html[data-andrik-header-state] body.r137-eye-motion-page .control-topbar .andrik-live-eye-motion-r255 .logo-ok,
    html[data-andrik-header-state] body.r136-standard-header-page .control-topbar .andrik-live-eye-motion-r255 .logo-ok,
    html[data-andrik-header-state] body.r139-standard-header-page .control-topbar .andrik-live-eye-motion-r255 .logo-ok,
    html[data-andrik-header-state] .control-topbar .andrik-live-eye-motion-r255 .logo-ok{
      display:block!important;
      position:absolute!important;
      left:50%!important;
      top:50%!important;
      opacity:1!important;
      visibility:visible!important;
      transform:translate(-50%,-50%)!important;
      animation:none!important;
      filter:var(--r255-eye-filter) drop-shadow(0 0 14px var(--r255-eye-a)) drop-shadow(0 0 34px var(--r255-eye-b)) drop-shadow(0 0 54px var(--r255-halo))!important;
    }
    html[data-andrik-header-state] .control-topbar .andrik-live-eye-motion-r255 .logo-error{display:none!important}

    html.andrik-live-eye-open,html.andrik-live-eye-open body{overflow:hidden!important;overscroll-behavior:none!important}
    .andrik-live-eye-overlay-r255{
      position:fixed!important;
      inset:0!important;
      z-index:2147483647!important;
      display:grid!important;
      place-items:center!important;
      background:#000!important;
      padding:0!important;
      overflow:hidden!important;
      opacity:0!important;
      visibility:hidden!important;
      pointer-events:none!important;
      transition:opacity .10s ease,visibility 0s linear .10s!important;
    }
    .andrik-live-eye-overlay-r255.is-open{
      opacity:1!important;
      visibility:visible!important;
      pointer-events:auto!important;
      transition:opacity .10s ease!important;
    }
    .andrik-live-eye-stage-r255{position:relative!important;width:100vw!important;height:100dvh!important;overflow:hidden!important;background:#000!important}
    .andrik-live-eye-stage-r255 video{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:50% 50%!important;background:#000!important}
    .andrik-live-eye-play-r255{
      position:absolute!important;left:50%!important;top:50%!important;z-index:4!important;transform:translate(-50%,-50%)!important;
      display:none!important;min-width:190px!important;min-height:58px!important;padding:0 22px!important;border:2px solid var(--r255-line-soft)!important;
      border-radius:999px!important;background:rgba(3,15,22,.94)!important;color:#fff!important;font:900 15px/1 system-ui,sans-serif!important;
      box-shadow:0 0 30px color-mix(in srgb,var(--r255-line) 48%,transparent)!important;
    }
    .andrik-live-eye-play-r255.is-visible{display:block!important}
    @media(max-width:760px){.andrik-live-eye-halo-r255{width:118px!important;height:118px!important}}
    @media(prefers-reduced-motion:reduce){.andrik-live-eye-motion-r255,.andrik-live-eye-halo-r255{animation-duration:1.9s!important}.control-topbar{animation-duration:2.2s!important}}
  `;
  document.head.appendChild(style);

  const pageLock = body?.classList.contains('protection-page') || path.includes('protection-admin')
    ? 'blue'
    : (body?.classList.contains('attack-page') || path.includes('attack-map'))
      ? 'yellow'
      : (body?.classList.contains('control-home-page') || path.includes('control-home'))
        ? 'blue'
        : 'auto';

  const readStage = () => {
    const stages = document.getElementById('siteUpdateStages');
    if (!stages) return 'auto';
    const items = [...stages.querySelectorAll('[data-stage]')];
    const deploy = stages.querySelector('[data-stage="deploy"]');
    const protect = stages.querySelector('[data-stage="protect"]');
    const result = document.getElementById('siteUpdateResultState');
    const text = [
      result?.textContent,
      document.getElementById('siteUpdateDeployMessage')?.textContent,
      document.getElementById('siteUpdateResultText')?.textContent,
      document.getElementById('siteUpdatePublishMessage')?.textContent
    ].filter(Boolean).join(' ');
    const hasState = items.some(item => /\bis-(?:running|done|warn|error|skipped)\b/.test(item.className));
    const error = items.some(item => item.classList.contains('is-error')) || result?.classList.contains('is-error') || /ошиб|сбой|неуда|failed|failure|критичес/i.test(text);
    if (error) return 'red';
    if (deploy?.classList.contains('is-running') || deploy?.classList.contains('is-warn')) return 'yellow';
    if (protect?.classList.contains('is-running')) return 'blue';
    if (items.some(item => item.classList.contains('is-running'))) return 'blue';
    const complete = deploy?.classList.contains('is-done') && protect?.classList.contains('is-done') && result?.classList.contains('is-ready');
    if (complete && !goldLatched) {
      goldLatched = true;
      goldUntil = Date.now() + 5200;
    }
    if (complete && Date.now() < goldUntil) return 'gold';
    if (!hasState) {
      goldLatched = false;
      goldUntil = 0;
    }
    return 'auto';
  };

  const sync = () => {
    clearTimeout(syncTimer);
    const stage = readStage();
    const critical = logo.classList.contains('is-error') || stage === 'red' || manual === 'red';
    let state;
    if (critical) state = 'red';
    else if (stage !== 'auto') state = stage;
    else if (pageLock !== 'auto') state = pageLock;
    else if (manual !== 'auto') state = manual;
    else state = logo.classList.contains('is-checking') ? 'blue' : 'green';

    root.dataset.andrikHeaderState = state;
    if (pageLock !== 'auto') root.dataset.andrikSectionLock = pageLock;
    else delete root.dataset.andrikSectionLock;
    logo.dataset.andrikGlowActive = state;
    if (state === 'gold') syncTimer = setTimeout(sync, Math.max(60, goldUntil - Date.now() + 60));
  };

  window.addEventListener('andrik:eye-glow', event => {
    const next = String(event?.detail?.state || 'auto').toLowerCase();
    manual = allowed.has(next) ? next : 'auto';
    sync();
  });
  window.addEventListener('andrik:site-update-stage', sync);
  window.addEventListener('pageshow', sync, { passive:true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); }, { passive:true });

  const stages = document.getElementById('siteUpdateStages');
  if (stages) new MutationObserver(sync).observe(stages, { subtree:true, attributes:true, childList:true, characterData:true });
  new MutationObserver(sync).observe(logo, { attributes:true, attributeFilter:['class'] });
  sync();

  let overlay = document.querySelector('.andrik-live-eye-overlay-r255');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'andrik-live-eye-overlay-r255';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Живая анимация ANDRIK');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="andrik-live-eye-stage-r255">
        <video muted playsinline webkit-playsinline preload="auto" src="/assets/live-eye-r255.mp4?v=${VERSION}"></video>
        <button class="andrik-live-eye-play-r255" type="button">▶ Запустить видео</button>
      </div>`;
    document.body.appendChild(overlay);
  }

  const video = overlay.querySelector('video');
  const playButton = overlay.querySelector('.andrik-live-eye-play-r255');
  let isOpen = false;
  let savedScrollX = 0;
  let savedScrollY = 0;
  let previousFocus = null;

  try {
    video.muted = true;
    video.playsInline = true;
    video.loop = false;
    video.load();
  } catch (_) {}

  const startPlayback = async () => {
    try {
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      video.playsInline = true;
      video.loop = false;
      await video.play();
      playButton?.classList.remove('is-visible');
    } catch (_) {
      playButton?.classList.add('is-visible');
    }
  };

  const openVideo = event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    if (isOpen) return;
    savedScrollX = window.scrollX || 0;
    savedScrollY = window.scrollY || 0;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    isOpen = true;
    overlay.setAttribute('aria-hidden', 'false');
    root.classList.add('andrik-live-eye-open');
    overlay.classList.add('is-open');
    requestAnimationFrame(startPlayback);
  };

  const closeVideo = event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!isOpen) return;
    isOpen = false;
    try { video.pause(); } catch (_) {}
    playButton?.classList.remove('is-visible');
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    root.classList.remove('andrik-live-eye-open');
    requestAnimationFrame(() => {
      try { window.scrollTo(savedScrollX, savedScrollY); } catch (_) {}
      try { previousFocus?.focus?.({ preventScroll:true }); } catch (_) {}
      try { video.currentTime = 0; } catch (_) {}
    });
  };

  logo.addEventListener('pointerdown', () => {
    try { if (video.readyState < 3) video.load(); } catch (_) {}
  }, { passive:true });
  logo.addEventListener('click', openVideo, true);
  logo.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') openVideo(event);
  }, true);

  playButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    startPlayback();
  });
  video?.addEventListener('ended', () => closeVideo(), { passive:true });
  video?.addEventListener('click', closeVideo);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeVideo(event);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen) closeVideo(event);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isOpen) closeVideo();
  }, { passive:true });
})();
