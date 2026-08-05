(() => {
  'use strict';

  const VIDEO_URL = '/assets/live-eye-r223.mp4?v=55.00-r223';

  const init = () => {
    const logo = document.getElementById('controlCenterLogo');
    if (!logo || logo.dataset.r3dLiveEye === '1') return;
    logo.dataset.r3dLiveEye = '1';
    logo.setAttribute('aria-label', 'Открыть живую анимацию ANDRIK');
    logo.removeAttribute('href');
    logo.setAttribute('role', 'button');
    logo.setAttribute('tabindex', '0');

    const images = Array.from(logo.querySelectorAll('img'));
    if (!images.length) return;

    const motion = document.createElement('span');
    motion.className = 'andrik-live-eye-motion-r3d';
    const halo = document.createElement('span');
    halo.className = 'andrik-live-eye-halo-r3d';
    images.forEach((image) => motion.appendChild(image));
    logo.appendChild(halo);
    logo.appendChild(motion);

    const style = document.createElement('style');
    style.id = 'andrik-live-eye-style-r3d';
    style.textContent = `
      .control-page .control-topbar,
      .control-topbar{background:linear-gradient(180deg,#020507 0%,#03080b 100%)!important}
      .control-page .control-topbar::before,
      .control-topbar::before{opacity:.085!important;filter:saturate(.92) brightness(.70)!important}
      .control-center-logo{isolation:isolate!important;overflow:visible!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;cursor:pointer!important}
      .andrik-live-eye-motion-r3d,.andrik-live-eye-halo-r3d{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%) scale(1)!important;transform-origin:50% 50%!important;pointer-events:none!important;will-change:transform,filter,opacity!important}
      .andrik-live-eye-motion-r3d{width:100%!important;height:100%!important;z-index:2!important}
      .andrik-live-eye-halo-r3d{width:118px!important;height:118px!important;border-radius:50%!important;z-index:1!important;background:radial-gradient(circle,rgba(118,255,174,.64) 0%,rgba(49,224,108,.34) 28%,rgba(16,142,62,.14) 49%,rgba(0,0,0,0) 74%)!important;filter:blur(8px)!important}
      .andrik-live-eye-motion-r3d img{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;transform-origin:50% 50%!important}

      /* R237: fixed section colors cannot be overridden by ordinary green/check states. */
      html[data-andrik-header-state="green"] body.control-page .control-topbar,
      html[data-andrik-header-state="green"] body.comment-collection-page .control-topbar{
        border-bottom-color:rgba(92,255,168,.50)!important;
        background:radial-gradient(ellipse at 50% 52%,rgba(0,255,119,.30) 0%,rgba(0,180,77,.12) 22%,transparent 55%),linear-gradient(90deg,#01070a 0%,#03170f 36%,#062318 50%,#03170f 64%,#01070a 100%)!important;
        box-shadow:0 3px 0 rgba(79,244,151,.08),0 12px 34px rgba(15,225,107,.16)!important
      }
      html[data-andrik-header-state="blue"] body.control-page .control-topbar,
      html[data-andrik-header-state="blue"] body.comment-collection-page .control-topbar{
        border-bottom-color:rgba(91,204,255,.64)!important;
        background:radial-gradient(ellipse at 50% 52%,rgba(55,184,255,.33) 0%,rgba(24,104,208,.14) 24%,transparent 57%),linear-gradient(90deg,#01070b 0%,#031226 36%,#071f3a 50%,#031226 64%,#01070b 100%)!important;
        box-shadow:0 3px 0 rgba(102,210,255,.10),0 12px 34px rgba(37,145,255,.22)!important
      }
      html[data-andrik-header-state="yellow"] body.control-page .control-topbar,
      html[data-andrik-header-state="yellow"] body.comment-collection-page .control-topbar{
        border-bottom-color:rgba(255,222,89,.72)!important;
        background:radial-gradient(ellipse at 50% 52%,rgba(255,214,64,.34) 0%,rgba(205,130,12,.15) 24%,transparent 57%),linear-gradient(90deg,#090701 0%,#1d1503 36%,#332406 50%,#1d1503 64%,#090701 100%)!important;
        box-shadow:0 3px 0 rgba(255,224,104,.11),0 12px 34px rgba(255,177,30,.22)!important
      }
      html[data-andrik-header-state="gold"] body.control-page .control-topbar,
      html[data-andrik-header-state="gold"] body.comment-collection-page .control-topbar{
        border-bottom-color:rgba(255,215,104,.88)!important;
        background:radial-gradient(ellipse at 50% 52%,rgba(255,203,77,.42) 0%,rgba(199,118,12,.19) 25%,transparent 58%),linear-gradient(90deg,#0a0701 0%,#241703 36%,#452d07 50%,#241703 64%,#0a0701 100%)!important;
        box-shadow:0 3px 0 rgba(255,225,134,.14),0 12px 38px rgba(255,166,28,.30)!important
      }
      html[data-andrik-header-state="red"] body.control-page .control-topbar,
      html[data-andrik-header-state="red"] body.comment-collection-page .control-topbar{
        border-bottom-color:rgba(255,89,105,.72)!important;
        background:radial-gradient(ellipse at 50% 52%,rgba(255,54,77,.34) 0%,rgba(170,8,34,.16) 24%,transparent 57%),linear-gradient(90deg,#0a0103 0%,#22050a 36%,#3b0810 50%,#22050a 64%,#0a0103 100%)!important;
        box-shadow:0 3px 0 rgba(255,99,114,.11),0 12px 36px rgba(255,37,65,.24)!important
      }
      html[data-andrik-header-state="green"] body.control-page .control-topbar::before,
      html[data-andrik-header-state="green"] body.comment-collection-page .control-topbar::before{background:radial-gradient(ellipse at center,rgba(71,255,151,.28),rgba(26,203,98,.10) 35%,transparent 70%)!important}
      html[data-andrik-header-state="blue"] body.control-page .control-topbar::before,
      html[data-andrik-header-state="blue"] body.comment-collection-page .control-topbar::before{background:radial-gradient(ellipse at center,rgba(99,211,255,.34),rgba(31,126,232,.13) 36%,transparent 70%)!important}
      html[data-andrik-header-state="yellow"] body.control-page .control-topbar::before,
      html[data-andrik-header-state="yellow"] body.comment-collection-page .control-topbar::before{background:radial-gradient(ellipse at center,rgba(255,229,105,.35),rgba(226,154,28,.14) 36%,transparent 70%)!important}
      html[data-andrik-header-state="gold"] body.control-page .control-topbar::before,
      html[data-andrik-header-state="gold"] body.comment-collection-page .control-topbar::before{background:radial-gradient(ellipse at center,rgba(255,222,126,.44),rgba(224,143,22,.18) 36%,transparent 70%)!important}
      html[data-andrik-header-state="red"] body.control-page .control-topbar::before,
      html[data-andrik-header-state="red"] body.comment-collection-page .control-topbar::before{background:radial-gradient(ellipse at center,rgba(255,107,120,.35),rgba(219,31,54,.14) 36%,transparent 70%)!important}
      html[data-andrik-header-state="green"] body.control-page .control-topbar::after,
      html[data-andrik-header-state="green"] body.comment-collection-page .control-topbar::after{background:linear-gradient(90deg,transparent,rgba(89,255,160,.86) 18%,#79ffb6 50%,rgba(89,255,160,.86) 82%,transparent)!important;box-shadow:0 0 8px rgba(85,255,158,.86),0 0 22px rgba(40,225,125,.50)!important}
      html[data-andrik-header-state="blue"] body.control-page .control-topbar::after,
      html[data-andrik-header-state="blue"] body.comment-collection-page .control-topbar::after{background:linear-gradient(90deg,transparent,rgba(91,204,255,.88) 18%,#8be5ff 50%,rgba(91,204,255,.88) 82%,transparent)!important;box-shadow:0 0 8px rgba(91,204,255,.90),0 0 24px rgba(40,139,255,.58)!important}
      html[data-andrik-header-state="yellow"] body.control-page .control-topbar::after,
      html[data-andrik-header-state="yellow"] body.comment-collection-page .control-topbar::after{background:linear-gradient(90deg,transparent,rgba(255,218,80,.90) 18%,#fff09a 50%,rgba(255,218,80,.90) 82%,transparent)!important;box-shadow:0 0 8px rgba(255,224,101,.94),0 0 24px rgba(255,174,34,.62)!important}
      html[data-andrik-header-state="gold"] body.control-page .control-topbar::after,
      html[data-andrik-header-state="gold"] body.comment-collection-page .control-topbar::after{background:linear-gradient(90deg,transparent,rgba(255,199,70,.94) 18%,#ffe6a0 50%,rgba(255,199,70,.94) 82%,transparent)!important;box-shadow:0 0 10px rgba(255,222,126,.98),0 0 28px rgba(255,161,24,.72)!important}
      html[data-andrik-header-state="red"] body.control-page .control-topbar::after,
      html[data-andrik-header-state="red"] body.comment-collection-page .control-topbar::after{background:linear-gradient(90deg,transparent,rgba(255,81,101,.90) 18%,#ff98a7 50%,rgba(255,81,101,.90) 82%,transparent)!important;box-shadow:0 0 8px rgba(255,91,109,.92),0 0 24px rgba(255,31,62,.62)!important}
      html[data-andrik-header-state="green"] .andrik-live-eye-motion-r3d .logo-ok{filter:brightness(1.12) saturate(1.34)!important}
      html[data-andrik-header-state="blue"] .andrik-live-eye-motion-r3d .logo-ok{filter:brightness(1.15) saturate(1.55) hue-rotate(74deg)!important}
      html[data-andrik-header-state="yellow"] .andrik-live-eye-motion-r3d .logo-ok{filter:brightness(1.20) saturate(1.62) hue-rotate(-70deg)!important}
      html[data-andrik-header-state="gold"] .andrik-live-eye-motion-r3d .logo-ok{filter:brightness(1.23) saturate(1.72) hue-rotate(-82deg)!important}
      html[data-andrik-header-state="red"] .andrik-live-eye-motion-r3d .logo-ok{filter:brightness(1.08) saturate(1.72) hue-rotate(238deg)!important}
      @media(max-width:760px){.andrik-live-eye-halo-r3d{width:112px!important;height:112px!important}}
      @media(max-width:420px){.andrik-live-eye-halo-r3d{width:106px!important;height:106px!important}}

      html.andrik-live-eye-open,html.andrik-live-eye-open body{overflow:hidden!important;overscroll-behavior:none!important}
      .andrik-live-eye-overlay-r219{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:max(10px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;background:radial-gradient(circle at 50% 42%,rgba(18,102,55,.30),rgba(0,0,0,.97) 60%,#000 100%)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .10s ease,visibility 0s linear .10s!important}
      .andrik-live-eye-overlay-r219.is-open{opacity:1!important;visibility:visible!important;pointer-events:auto!important;transition:opacity .10s ease!important}
      .andrik-live-eye-stage-r219{position:relative!important;width:min(calc(100vw - 16px),520px)!important;height:min(88dvh,900px)!important;overflow:hidden!important;border:4px solid rgba(104,255,174,.98)!important;border-radius:30px!important;background:#000!important;box-shadow:0 0 0 1px rgba(187,255,216,.24),0 0 12px rgba(104,255,174,.86),0 0 34px rgba(43,226,105,.60),0 0 70px rgba(18,155,72,.34),inset 0 0 20px rgba(80,255,161,.15)!important}
      .andrik-live-eye-video-r219{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:50% 50%!important;transform:scale(1.30)!important;transform-origin:50% 50%!important;background:#000!important;will-change:transform!important}
      .andrik-live-eye-play-r219{position:absolute!important;left:50%!important;top:50%!important;z-index:3!important;transform:translate(-50%,-50%)!important;display:none!important;align-items:center!important;justify-content:center!important;min-width:170px!important;min-height:54px!important;padding:0 22px!important;border:2px solid rgba(124,255,178,.70)!important;border-radius:999px!important;background:rgba(1,12,16,.90)!important;color:#d8ffe6!important;font:850 14px/1 system-ui,sans-serif!important;box-shadow:0 0 30px rgba(43,226,105,.32)!important}
      .andrik-live-eye-play-r219.is-visible{display:flex!important}
      @media(max-width:430px){.andrik-live-eye-stage-r219{width:calc(100vw - 12px)!important;height:88dvh!important;border-width:4px!important;border-radius:25px!important}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'andrik-live-eye-overlay-r219';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Живая анимация ANDRIK. Видео проигрывается один раз и автоматически возвращает на текущую страницу.');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="andrik-live-eye-stage-r219">
        <video class="andrik-live-eye-video-r219" muted playsinline webkit-playsinline preload="auto" src="${VIDEO_URL}"></video>
        <button class="andrik-live-eye-play-r219" type="button">▶ Запустить видео</button>
      </div>`;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('video');
    const playButton = overlay.querySelector('.andrik-live-eye-play-r219');
    let isOpen = false;
    let raf = 0;
    let visible = !document.hidden;
    let savedScrollX = 0;
    let savedScrollY = 0;
    let previousFocus = null;
    let manualGlowState = 'auto';
    let stageGlowState = 'auto';
    let goldUntil = 0;
    let successLatched = false;
    let goldReturnTimer = 0;
    const GOLD_DURATION = 5200;
    const currentPath = String(location.pathname || '').toLowerCase();
    const pageGlowState = currentPath.endsWith('/protection-admin.html')
      ? 'blue'
      : (currentPath.endsWith('/attack-map.html') ? 'yellow' : 'auto');

    if (pageGlowState !== 'auto') {
      document.documentElement.dataset.andrikHeaderState = pageGlowState;
      logo.dataset.andrikPageGlow = pageGlowState;
    }

    const allowedGlowStates = new Set(['auto','green','blue','yellow','gold','red']);
    const setManualGlowState = (state) => {
      const next = String(state || 'auto').toLowerCase();
      manualGlowState = allowedGlowStates.has(next) ? next : 'auto';
      logo.dataset.andrikGlowState = manualGlowState;
    };

    const readStageGlowState = () => {
      const stages = document.getElementById('siteUpdateStages');
      if (!stages) return 'auto';
      const items = Array.from(stages.querySelectorAll('[data-stage]'));
      const release = stages.querySelector('[data-stage="release"]');
      const deploy = stages.querySelector('[data-stage="deploy"]');
      const protect = stages.querySelector('[data-stage="protect"]');
      const resultState = document.getElementById('siteUpdateResultState');
      const resultText = `${resultState?.textContent || ''} ${document.getElementById('siteUpdateDeployMessage')?.textContent || ''} ${document.getElementById('siteUpdateResultText')?.textContent || ''}`;
      const explicitFailure = /ошиб|неуда|сбой|failed|failure|deploy\s+failed|критичес/i.test(resultText);
      const hasAnyStageState = items.some((item) => /\bis-(?:running|done|warn|error|skipped)\b/.test(item.className));

      if (!hasAnyStageState) {
        successLatched = false;
        goldUntil = 0;
      }

      if (items.some((item) => item.classList.contains('is-error')) || resultState?.classList.contains('is-error') || explicitFailure) return 'red';
      if (release?.classList.contains('is-warn') || protect?.classList.contains('is-warn')) return 'red';
      if (release?.classList.contains('is-running')) return 'yellow';
      if (items.some((item) => item.classList.contains('is-running'))) return 'blue';
      if (deploy?.classList.contains('is-warn')) return 'blue';

      const releaseComplete = Boolean(release?.classList.contains('is-done') || release?.classList.contains('is-skipped'));
      const completed = Boolean(
        releaseComplete &&
        deploy?.classList.contains('is-done') &&
        protect?.classList.contains('is-done') &&
        resultState?.classList.contains('is-ready')
      );
      if (completed && !successLatched) {
        successLatched = true;
        goldUntil = Date.now() + GOLD_DURATION;
      }
      if (completed && Date.now() < goldUntil) return 'gold';
      return 'auto';
    };

    const syncStageGlowState = () => {
      window.clearTimeout(goldReturnTimer);
      stageGlowState = readStageGlowState();
      logo.dataset.andrikStageGlow = stageGlowState;
      if (stageGlowState === 'gold') {
        goldReturnTimer = window.setTimeout(syncStageGlowState, Math.max(40, goldUntil - Date.now() + 40));
      }
    };

    const stages = document.getElementById('siteUpdateStages');
    if (stages) {
      syncStageGlowState();
      const stageObserver = new MutationObserver(syncStageGlowState);
      stageObserver.observe(stages, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
        childList: true
      });
      const resultState = document.getElementById('siteUpdateResultState');
      if (resultState) stageObserver.observe(resultState, { attributes: true, childList: true, characterData: true, subtree: true, attributeFilter: ['class'] });
      ['siteUpdateDeployMessage','siteUpdateResultText'].forEach((id) => {
        const node = document.getElementById(id);
        if (node) stageObserver.observe(node, { childList: true, characterData: true, subtree: true });
      });
    }

    window.addEventListener('andrik:site-update-stage', () => {
      syncStageGlowState();
    });
    window.addEventListener('andrik:eye-glow', (event) => {
      setManualGlowState(event?.detail?.state || 'auto');
    });

    // Preload once. The source stays attached, so every next launch is immediate.
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

    const openVideo = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (isOpen) return;
      savedScrollX = window.scrollX || 0;
      savedScrollY = window.scrollY || 0;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      isOpen = true;
      overlay.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('andrik-live-eye-open');
      overlay.classList.add('is-open');
      startPlayback();
    };

    const closeVideo = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!isOpen) return;
      isOpen = false;
      try { video.pause(); } catch (_) {}
      playButton?.classList.remove('is-visible');
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('andrik-live-eye-open');
      requestAnimationFrame(() => {
        try { window.scrollTo(savedScrollX, savedScrollY); } catch (_) {}
        try { previousFocus?.focus?.({ preventScroll: true }); } catch (_) {}
        try { video.currentTime = 0; } catch (_) {}
      });
    };

    // A single click handler avoids the old pointerup+click double firing.
    logo.addEventListener('click', openVideo, true);
    logo.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openVideo(event);
    }, true);
    logo.addEventListener('pointerdown', () => {
      try { if (video.readyState < 3) video.load(); } catch (_) {}
    }, { passive: true });

    playButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startPlayback();
    });
    video.addEventListener('ended', () => closeVideo(), { passive: true });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen) closeVideo(event);
    });

    const frame = (time) => {
      if (visible) {
        const phase = (Math.sin(time / 420) + 1) / 2;
        const smooth = phase * phase * (3 - 2 * phase);
        const scale = 0.915 + smooth * 0.245;
        const haloScale = 0.78 + smooth * 0.72;
        const haloOpacity = 0.18 + smooth * 0.70;
        const checking = logo.classList.contains('is-checking');
        const error = logo.classList.contains('is-error');
        const criticalRed = error || stageGlowState === 'red' || manualGlowState === 'red';
        const glowState = criticalRed
          ? 'red'
          : (pageGlowState !== 'auto'
              ? pageGlowState
              : (stageGlowState !== 'auto'
                  ? stageGlowState
                  : (manualGlowState !== 'auto'
                      ? manualGlowState
                      : (checking ? 'blue' : 'green'))));
        logo.dataset.andrikGlowActive = glowState;
        if (document.documentElement.dataset.andrikHeaderState !== glowState) {
          document.documentElement.dataset.andrikHeaderState = glowState;
        }

        let shadow;
        let haloColor;
        if (glowState === 'red') {
          shadow = `brightness(${1.04 + smooth * .16}) saturate(1.12) drop-shadow(0 0 ${10 + smooth * 9}px rgba(255,143,156,.90)) drop-shadow(0 0 ${27 + smooth * 23}px rgba(255,45,72,.72)) drop-shadow(0 0 ${54 + smooth * 32}px rgba(167,0,27,.48))`;
          haloColor = 'radial-gradient(circle,rgba(255,137,151,.64) 0%,rgba(255,47,73,.36) 36%,rgba(116,0,20,.16) 54%,rgba(80,0,12,0) 74%)';
        } else if (glowState === 'gold') {
          shadow = `brightness(${1.22 + smooth * .30}) saturate(${1.44 + smooth * .24}) drop-shadow(0 0 ${13 + smooth * 11}px rgba(255,239,177,.99)) drop-shadow(0 0 ${37 + smooth * 29}px rgba(255,188,47,.96)) drop-shadow(0 0 ${70 + smooth * 42}px rgba(189,104,0,.68))`;
          haloColor = 'radial-gradient(circle,rgba(255,236,166,.78) 0%,rgba(255,185,42,.48) 31%,rgba(176,94,0,.22) 53%,rgba(0,0,0,0) 75%)';
        } else if (glowState === 'yellow') {
          shadow = `brightness(${1.18 + smooth * .28}) saturate(${1.22 + smooth * .20}) drop-shadow(0 0 ${12 + smooth * 10}px rgba(255,244,165,.98)) drop-shadow(0 0 ${34 + smooth * 27}px rgba(255,191,47,.92)) drop-shadow(0 0 ${64 + smooth * 38}px rgba(184,109,0,.62))`;
          haloColor = 'radial-gradient(circle,rgba(255,242,149,.70) 0%,rgba(255,190,42,.40) 31%,rgba(184,109,0,.18) 52%,rgba(0,0,0,0) 74%)';
        } else if (glowState === 'blue') {
          shadow = `brightness(${1.18 + smooth * .27}) saturate(${1.28 + smooth * .20}) drop-shadow(0 0 ${12 + smooth * 10}px rgba(180,240,255,.99)) drop-shadow(0 0 ${34 + smooth * 27}px rgba(57,179,255,.92)) drop-shadow(0 0 ${64 + smooth * 38}px rgba(0,98,196,.60))`;
          haloColor = 'radial-gradient(circle,rgba(170,236,255,.70) 0%,rgba(57,179,255,.40) 31%,rgba(0,98,196,.18) 52%,rgba(0,0,0,0) 74%)';
        } else {
          shadow = `brightness(${1.20 + smooth * .28}) saturate(${1.36 + smooth * .24}) drop-shadow(0 0 ${12 + smooth * 10}px rgba(150,255,194,.99)) drop-shadow(0 0 ${34 + smooth * 28}px rgba(43,226,105,.92)) drop-shadow(0 0 ${62 + smooth * 40}px rgba(13,176,68,.64))`;
          haloColor = 'radial-gradient(circle,rgba(118,255,174,.68) 0%,rgba(49,224,108,.36) 31%,rgba(16,142,62,.15) 52%,rgba(0,0,0,0) 74%)';
        }
        motion.style.setProperty('transform', `translate(-50%,-50%) scale(${scale.toFixed(4)})`, 'important');
        motion.style.setProperty('filter', shadow, 'important');
        halo.style.setProperty('transform', `translate(-50%,-50%) scale(${haloScale.toFixed(4)})`, 'important');
        halo.style.setProperty('opacity', haloOpacity.toFixed(3), 'important');
        halo.style.setProperty('background', haloColor, 'important');
      }
      raf = requestAnimationFrame(frame);
    };

    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (!visible) closeVideo();
    }, { passive: true });

    raf = requestAnimationFrame(frame);
    window.addEventListener('pagehide', () => {
      closeVideo();
      cancelAnimationFrame(raf);
    }, { once: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
