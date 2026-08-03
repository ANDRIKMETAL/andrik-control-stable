(() => {
  'use strict';

  const init = () => {
    const logo = document.getElementById('controlCenterLogo');
    if (!logo || logo.dataset.r3dLiveEye === '1') return;
    logo.dataset.r3dLiveEye = '1';

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
      .control-topbar{
        background:linear-gradient(180deg,#020507 0%,#03080b 100%)!important;
      }
      .control-page .control-topbar::before,
      .control-topbar::before{
        opacity:.085!important;
        filter:saturate(.92) brightness(.70)!important;
      }
      .control-center-logo{
        isolation:isolate!important;
        overflow:visible!important;
      }
      .andrik-live-eye-motion-r3d,
      .andrik-live-eye-halo-r3d{
        position:absolute!important;
        left:50%!important;
        top:50%!important;
        transform:translate(-50%,-50%) scale(1)!important;
        transform-origin:50% 50%!important;
        pointer-events:none!important;
        will-change:transform,filter,opacity!important;
      }
      .andrik-live-eye-motion-r3d{
        width:100%!important;
        height:100%!important;
        z-index:2!important;
      }
      .andrik-live-eye-halo-r3d{
        width:118px!important;
        height:118px!important;
        border-radius:50%!important;
        z-index:1!important;
        background:radial-gradient(circle,
          rgba(118,255,174,.64) 0%,
          rgba(49,224,108,.34) 28%,
          rgba(16,142,62,.14) 49%,
          rgba(0,0,0,0) 74%)!important;
        filter:blur(8px)!important;
      }
      .andrik-live-eye-motion-r3d img{
        position:absolute!important;
        left:50%!important;
        top:50%!important;
        transform:translate(-50%,-50%)!important;
        transform-origin:50% 50%!important;
      }
      @media(max-width:760px){
        .andrik-live-eye-halo-r3d{width:112px!important;height:112px!important}
      }
      @media(max-width:420px){
        .andrik-live-eye-halo-r3d{width:106px!important;height:106px!important}
      }
    `;
    document.head.appendChild(style);

    let raf = 0;
    let visible = !document.hidden;

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
          haloColor = `radial-gradient(circle,rgba(255,122,140,.54) 0%,rgba(255,47,73,.30) 38%,rgba(80,0,12,0) 74%)`;
        } else if (warning) {
          shadow = `brightness(${1.15 + smooth * .24}) saturate(${1.30 + smooth * .22}) drop-shadow(0 0 ${11 + smooth * 10}px rgba(150,255,194,.94)) drop-shadow(0 0 ${30 + smooth * 24}px rgba(43,226,105,.84)) drop-shadow(0 0 ${56 + smooth * 34}px rgba(13,176,68,.56))`;
          haloColor = `radial-gradient(circle,rgba(118,255,174,.62) 0%,rgba(49,224,108,.34) 39%,rgba(16,142,62,0) 74%)`;
        } else {
          shadow = `brightness(${1.20 + smooth * .28}) saturate(${1.36 + smooth * .24}) drop-shadow(0 0 ${12 + smooth * 10}px rgba(150,255,194,.99)) drop-shadow(0 0 ${34 + smooth * 28}px rgba(43,226,105,.92)) drop-shadow(0 0 ${62 + smooth * 40}px rgba(13,176,68,.64))`;
          haloColor = `radial-gradient(circle,rgba(118,255,174,.68) 0%,rgba(49,224,108,.36) 31%,rgba(16,142,62,.15) 52%,rgba(0,0,0,0) 74%)`;
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
    }, { passive: true });

    raf = requestAnimationFrame(frame);
    window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
