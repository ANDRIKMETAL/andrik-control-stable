/* Control ANDRIK v55.00 FINAL STABLE GITHUB CAROUSEL — embedded section bridge. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1' && window.top !== window.self;
  if (!embedded) return;

  document.documentElement.classList.add('admin-carousel-embedded');
  document.body?.classList.add('admin-carousel-embedded');

  const post = payload => {
    try { window.parent.postMessage({ channel: 'andrik-admin-carousel', ...payload }, location.origin); }
    catch (_) {}
  };

  const sectionByPath = path => {
    const clean = String(path || '').replace(/\/+$/, '');
    if (clean.endsWith('/service-admin.html')) return 'service';
    if (clean.endsWith('/observability-admin.html')) return 'monitor';
    if (clean.endsWith('/lyrics-admin.html')) return 'releases';
    if (clean.endsWith('/comments-admin.html')) return 'discussion';
    return '';
  };

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    const section = sectionByPath(url.pathname);
    if (section) {
      event.preventDefault();
      post({ type: 'navigate-section', section });
      return;
    }
    if (/\/(?:admin\/?|control-home\.html|analytics-admin\.html)$/.test(url.pathname)) {
      link.target = '_top';
    }
  }, { capture: true });

  let gesture = null;
  const blocked = target => Boolean(target?.closest?.(
    'input,textarea,select,option,[contenteditable="true"],iframe,video,audio,canvas,[data-no-admin-carousel]'
  ));

  const begin = (point, target) => {
    if (!point || blocked(target)) return;
    gesture = {
      id: point.identifier,
      startX: point.clientX,
      startY: point.clientY,
      lastX: point.clientX,
      lastY: point.clientY,
      startedAt: performance.now(),
      axis: ''
    };
    post({ type: 'gesture-start' });
  };

  const update = (point, event) => {
    if (!gesture || !point) return;
    gesture.lastX = point.clientX;
    gesture.lastY = point.clientY;
    const dx = gesture.lastX - gesture.startX;
    const dy = gesture.lastY - gesture.startY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);

    if (!gesture.axis && Math.max(ax, ay) >= 9) {
      if (ax > ay * 1.08) gesture.axis = 'x';
      else if (ay > ax * 1.08) gesture.axis = 'y';
    }

    if (gesture.axis === 'y') {
      post({ type: 'gesture-cancel' });
      gesture = null;
      return;
    }
    if (gesture.axis !== 'x') return;

    if (event.cancelable) event.preventDefault();
    post({ type: 'gesture-move', dx });
  };

  const finish = point => {
    if (!gesture) return;
    if (point) {
      gesture.lastX = point.clientX;
      gesture.lastY = point.clientY;
    }
    const dx = gesture.lastX - gesture.startX;
    const dy = gesture.lastY - gesture.startY;
    const elapsed = Math.max(1, performance.now() - gesture.startedAt);
    const velocity = Math.abs(dx) / elapsed;
    const threshold = Math.max(44, Math.min(78, innerWidth * 0.095));
    const valid = gesture.axis === 'x' &&
      Math.abs(dx) >= threshold &&
      Math.abs(dx) > Math.abs(dy) * 1.08 &&
      (velocity >= 0.10 || Math.abs(dx) >= threshold * 1.15);

    if (valid) post({ type: 'gesture-commit', direction: dx < 0 ? 1 : -1, dx });
    else post({ type: 'gesture-cancel' });
    gesture = null;
  };

  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) return;
    begin(event.touches[0], event.target);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    const point = [...event.touches].find(item => item.identifier === gesture.id) || event.touches[0];
    update(point, event);
  }, { passive: false, capture: true });

  document.addEventListener('touchend', event => {
    if (!gesture) return;
    const point = [...event.changedTouches].find(item => item.identifier === gesture.id) || event.changedTouches[0];
    finish(point);
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', () => {
    if (!gesture) return;
    gesture = null;
    post({ type: 'gesture-cancel' });
  }, { passive: true, capture: true });

  post({ type: 'frame-ready', section: document.body?.dataset?.controlSection || '' });
})();
