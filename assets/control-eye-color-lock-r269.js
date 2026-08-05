(() => {
  'use strict';
  if (window.__ANDRIK_EYE_COLOR_LOCK_R269__) return;
  window.__ANDRIK_EYE_COLOR_LOCK_R269__ = true;

  const root = document.documentElement;
  const body = document.body;
  const path = String(location.pathname || '').toLowerCase();
  const section = String(body?.dataset?.controlSection || '').toLowerCase();
  const blueSections = new Set(['service','monitor','releases','discussion']);
  const isBlueAdmin = blueSections.has(section) ||
    path.includes('service-admin') ||
    path.includes('observability-admin') ||
    path.includes('lyrics-admin') ||
    path.includes('comments-admin');
  const isUpdate = body?.classList.contains('site-update-page') || path.includes('site-update-admin');

  const style = document.createElement('style');
  style.id = 'andrik-eye-color-lock-r269';
  style.textContent = `
    html[data-andrik-section-lock="blue"] body[data-control-section="service"] .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body[data-control-section="monitor"] .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body[data-control-section="releases"] .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body[data-control-section="discussion"] .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body.admin-service-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body.observability-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body.lyrics-admin-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok,
    html[data-andrik-section-lock="blue"] body.comments-admin-page[data-control-section="discussion"] .control-center-logo .andrik-live-eye-motion-r244 .logo-ok {
      filter:brightness(1.40) saturate(2.36) hue-rotate(78deg) contrast(1.08)
        drop-shadow(0 0 15px rgba(202,246,255,.99))
        drop-shadow(0 0 38px rgba(70,178,255,.97))
        drop-shadow(0 0 60px rgba(74,198,255,.92))!important;
    }
    html[data-andrik-header-state="yellow"] body.site-update-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok {
      filter:brightness(1.48) saturate(2.46) sepia(.46) hue-rotate(-18deg) contrast(1.09)
        drop-shadow(0 0 15px rgba(255,248,190,.99))
        drop-shadow(0 0 38px rgba(255,188,40,.97))
        drop-shadow(0 0 60px rgba(255,220,82,.92))!important;
    }
    html[data-andrik-header-state="blue"] body.site-update-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok {
      filter:brightness(1.40) saturate(2.36) hue-rotate(78deg) contrast(1.08)
        drop-shadow(0 0 15px rgba(202,246,255,.99))
        drop-shadow(0 0 38px rgba(70,178,255,.97))
        drop-shadow(0 0 60px rgba(74,198,255,.92))!important;
    }
    html[data-andrik-header-state="green"] body.site-update-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok {
      filter:brightness(1.24) saturate(1.62)
        drop-shadow(0 0 14px rgba(168,255,209,.98))
        drop-shadow(0 0 36px rgba(31,255,150,.86))
        drop-shadow(0 0 56px rgba(86,255,177,.78))!important;
    }
    html[data-andrik-header-state="red"] body.site-update-page .control-center-logo .andrik-live-eye-motion-r244 .logo-ok {
      filter:brightness(1.22) saturate(2.22) hue-rotate(238deg) contrast(1.08)
        drop-shadow(0 0 15px rgba(255,142,153,.98))
        drop-shadow(0 0 38px rgba(255,39,68,.84))
        drop-shadow(0 0 60px rgba(255,70,91,.78))!important;
    }
  `;
  document.head.appendChild(style);

  const forceBlue = () => {
    if (!isBlueAdmin) return;
    root.dataset.andrikSectionLock = 'blue';
    root.dataset.andrikHeaderState = 'blue';
    const logo = document.getElementById('controlCenterLogo') || document.querySelector('.control-center-logo');
    if (logo) logo.dataset.andrikGlowActive = 'blue';
  };

  const sync = () => {
    if (isBlueAdmin) forceBlue();
    // On update page the existing stage controller remains the source of truth.
    // This module only locks the image color to the already selected green/yellow/blue/red state.
  };

  sync();
  if (isBlueAdmin) {
    new MutationObserver(sync).observe(root, {attributes:true, attributeFilter:['data-andrik-header-state','data-andrik-section-lock']});
    window.addEventListener('pageshow', sync, {passive:true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); }, {passive:true});
    setInterval(sync, 900);
  }
})();
