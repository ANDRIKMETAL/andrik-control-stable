(() => {
  'use strict';

  const addMarker = () => {
    if (!document.body || document.body.children.length < 1) return false;

    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    const isHome =
      text.includes('Админ панель') &&
      text.includes('Служебное') &&
      text.includes('Мониторинг') &&
      text.includes('Релизы') &&
      text.includes('Обсуждение');

    const isCarousel =
      document.querySelectorAll('.admin-carousel-pane').length >= 6 &&
      document.querySelectorAll('.admin-carousel-pane iframe').length >= 6 &&
      document.querySelectorAll('.admin-carousel-dots button').length >= 4;

    if (!isHome && !isCarousel) return false;

    document.documentElement.dataset.andrikGuard = 'ok';
    document.body.dataset.andrikGuard = 'ok';

    let marker = document.getElementById('andrik-guard-ok');
    if (!marker) {
      marker = document.createElement('span');
      marker.id = 'andrik-guard-ok';
      marker.hidden = true;
      marker.setAttribute('aria-hidden', 'true');
      document.body.appendChild(marker);
    }
    marker.textContent = 'ANDRIK-GUARD-OK R111';
    window.__ANDRIK_GUARD_OK__ = true;
    return true;
  };

  const verify = () => {
    if (addMarker()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (addMarker() || attempts >= 8) clearInterval(timer);
    }, 500);
  };

  if (document.readyState === 'complete') verify();
  else window.addEventListener('load', verify, { once: true });
})();
