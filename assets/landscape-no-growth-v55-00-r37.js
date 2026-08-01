(() => {
  'use strict';
  if (window.__andrikLandscapeNoGrowthR37) return;
  window.__andrikLandscapeNoGrowthR37 = true;

  const media = window.matchMedia('(orientation: landscape)');
  const closeGrowth = () => {
    if (!media.matches) return;
    const toggle = document.getElementById('countryGrowthToggle');
    const panel = document.getElementById('countryGrowthPanel');
    const viewport = document.getElementById('analyticsSwipeViewport');
    const mapPane = document.querySelector('.analytics-map-pane');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.tabIndex = -1;
    }
    if (panel) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }
    viewport?.classList.remove('is-growth-open');
    mapPane?.classList.remove('is-growth-open');
    document.documentElement.classList.remove('is-country-growth-open');
    document.body?.classList.remove('is-country-growth-open');
  };

  const blockLandscapeGrowth = event => {
    if (!media.matches) return;
    if (!event.target?.closest?.('#countryGrowthToggle,#countryGrowthPanel')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    closeGrowth();
  };

  ['pointerdown','pointerup','click','touchstart','touchend'].forEach(type => {
    document.addEventListener(type, blockLandscapeGrowth, true);
  });

  const sync = () => requestAnimationFrame(closeGrowth);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once:true });
  else sync();
  media.addEventListener?.('change', sync);
  window.addEventListener('orientationchange', sync, { passive:true });
  window.addEventListener('pageshow', sync, { passive:true });
})();
