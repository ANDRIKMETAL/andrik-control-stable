(() => {
  'use strict';

  const VIDEO_URL = '/assets/live-eye-r219.mp4?v=55.00-r219';

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
      @media(max-width:760px){.andrik-live-eye-halo-r3d{width:112px!important;height:112px!important}}
      @media(max-width:420px){.andrik-live-eye-halo-r3d{width:106px!important;height:106px!important}}

      html.andrik-live-eye-open,html.andrik-live-eye-open body{overflow:hidden!important;overscroll-behavior:none!important}
      .andrik-live-eye-overlay-r219{position:fixed!important;inset:0!important;z-index:2147483647!important;display:grid!important;place-items:center!important;padding:max(10px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))!important;background:radial-gradient(circle at 50% 42%,rgba(18,102,55,.30),rgba(0,0,0,.97) 60%,#000 100%)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;transition:opacity .10s ease,visibility 0s linear .10s!important}
      .andrik-live-eye-overlay-r219.is-open{opacity:1!important;visibility:visible!important;pointer-events:auto!important;transition:opacity .10s ease!important}
      .andrik-live-eye-stage-r219{position:relative!important;width:min(calc(100vw - 16px),520px)!important;height:min(88dvh,900px)!important;overflow:hidden!important;border:3px solid rgba(104,255,174,.92)!important;border-radius:30px!important;background:#000!important;box-shadow:0 0 0 1px rgba(187,255,216,.24),0 0 12px rgba(104,255,174,.86),0 0 34px rgba(43,226,105,.60),0 0 70px rgba(18,155,72,.34),inset 0 0 20px rgba(80,255,161,.15)!important}
      .andrik-live-eye-video-r219{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:50% 50%!important;background:#000!important}
      .andrik-live-eye-close-r219{position:absolute!important;top:14px!important;right:14px!important;z-index:4!important;display:grid!important;place-items:center!important;width:54px!important;height:54px!important;border:2px solid rgba(255,255,255,.28)!important;border-radius:50%!important;background:rgba(2,8,11,.80)!important;color:#effff5!important;font:900 31px/1 system-ui,sans-serif!important;box-shadow:0 8px 26px rgba(0,0,0,.48),0 0 18px rgba(43,226,105,.18)!important}
      .andrik-live-eye-play-r219{position:absolute!important;left:50%!important;top:50%!important;z-index:3!important;transform:translate(-50%,-50%)!important;display:none!important;align-items:center!important;justify-content:center!important;min-width:170px!important;min-height:54px!important;padding:0 22px!important;border:2px solid rgba(124,255,178,.70)!important;border-radius:999px!important;background:rgba(1,12,16,.90)!important;color:#d8ffe6!important;font:850 14px/1 system-ui,sans-serif!important;box-shadow:0 0 30px rgba(43,226,105,.32)!important}
      .andrik-live-eye-play-r219.is-visible{display:flex!important}
      @media(max-width:430px){.andrik-live-eye-stage-r219{width:calc(100vw - 12px)!important;height:88dvh!important;border-width:3px!important;border-radius:25px!important}.andrik-live-eye-close-r219{width:48px!important;height:48px!important;top:12px!important;right:12px!important}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'andrik-live-eye-overlay-r219';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Живая анимация ANDRIK');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="andrik-live-eye-stage-r219">
        <video class="andrik-live-eye-video-r219" muted loop playsinline webkit-playsinline preload="auto" src="${VIDEO_URL}"></video>
        <button class="andrik-live-eye-close-r219" type="button" aria-label="Закрыть">×</button>
        <button class="andrik-live-eye-play-r219" type="button">▶ Запустить видео</button>
      </div>`;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('video');
    const closeButton = overlay.querySelector('.andrik-live-eye-close-r219');
    const playButton = overlay.querySelector('.andrik-live-eye-play-r219');
    let isOpen = false;
    let raf = 0;
    let visible = !document.hidden;

    // Preload once. The source stays attached, so every next launch is immediate.
    try {
      video.muted = true;
      video.playsInline = true;
      video.load();
    } catch (_) {}

    const startPlayback = async () => {
      try {
        video.pause();
        video.currentTime = 0;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        playButton?.classList.remove('is-visible');
      } catch (_) {
        playButton?.classList.add('is-visible');
      }
    };

    const openVideo = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (isOpen) {
        startPlayback();
        return;
      }
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
      try {
        video.pause();
        video.currentTime = 0;
      } catch (_) {}
      playButton?.classList.remove('is-visible');
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('andrik-live-eye-open');
    };

    // A single click handler avoids the old pointerup+click double firing.
    logo.addEventListener('click', openVideo, true);
    logo.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') openVideo(event);
    }, true);
    logo.addEventListener('pointerdown', () => {
      try { if (video.readyState < 3) video.load(); } catch (_) {}
    }, { passive: true });

    closeButton?.addEventListener('click', closeVideo);
    playButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startPlayback();
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeVideo(event);
    });
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
        const warning = logo.classList.contains('is-warning');
        const error = logo.classList.contains('is-error');
        let shadow;
        let haloColor;
        if (error) {
          shadow = `brightness(${1.02 + smooth * .14}) saturate(1.12) drop-shadow(0 0 ${9 + smooth * 8}px rgba(255,112,128,.82)) drop-shadow(0 0 ${24 + smooth * 20}px rgba(255,45,72,.62))`;
          haloColor = 'radial-gradient(circle,rgba(255,122,140,.54) 0%,rgba(255,47,73,.30) 38%,rgba(80,0,12,0) 74%)';
        } else if (warning) {
          shadow = `brightness(${1.15 + smooth * .24}) saturate(${1.30 + smooth * .22}) drop-shadow(0 0 ${11 + smooth * 10}px rgba(150,255,194,.94)) drop-shadow(0 0 ${30 + smooth * 24}px rgba(43,226,105,.84)) drop-shadow(0 0 ${56 + smooth * 34}px rgba(13,176,68,.56))`;
          haloColor = 'radial-gradient(circle,rgba(118,255,174,.62) 0%,rgba(49,224,108,.34) 39%,rgba(16,142,62,0) 74%)';
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
