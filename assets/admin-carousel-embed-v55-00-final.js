/* Live Web AI R185 — smooth embedded admin carousel bridge. */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1' && window.top !== window.self;
  if (!embedded) return;

  document.documentElement.classList.add('admin-carousel-embedded');
  document.body?.classList.add('admin-carousel-embedded');

  const PARENT_CHANNEL = 'andrik-admin-carousel';
  const CHILD_CHANNEL = 'andrik-admin-carousel-control';

  const post = payload => {
    try {
      window.parent.postMessage({ channel: PARENT_CHANNEL, ...payload }, location.origin);
    } catch (_) {}
  };

  const sectionByPath = path => {
    const clean = String(path || '').replace(/\/+$/, '');
    if (clean.endsWith('/service-admin.html')) return 'service';
    if (clean.endsWith('/observability-admin.html')) return 'monitor';
    if (clean.endsWith('/lyrics-admin.html')) return 'releases';
    if (clean.endsWith('/comments-admin.html')) return 'discussion';
    return '';
  };

  const section = sectionByPath(location.pathname) ||
    document.body?.dataset?.controlSection || '';

  const getScrollHost = () => {
    const main = document.querySelector('.admin-main');
    if (main && main.scrollHeight > main.clientHeight + 2) return main;
    return document.scrollingElement || document.documentElement;
  };

  let applyingScroll = false;
  let scrollFrame = 0;

  const emitScrollState = () => {
    if (applyingScroll || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const host = getScrollHost();
      post({
        type: 'scroll-state',
        section,
        top: Math.max(0, Number(host?.scrollTop) || 0)
      });
    });
  };

  const installScrollSync = () => {
    const host = getScrollHost();
    host?.addEventListener('scroll', emitScrollState, { passive: true });
    post({
      type: 'scroll-state',
      section,
      top: Math.max(0, Number(host?.scrollTop) || 0)
    });
  };

  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.channel !== CHILD_CHANNEL) return;

    if (data.type === 'apply-scroll-state' && (!data.section || data.section === section)) {
      const host = getScrollHost();
      const nextTop = Math.max(0, Number(data.top) || 0);
      if (!host || Math.abs((Number(host.scrollTop) || 0) - nextTop) < 1) return;

      applyingScroll = true;
      host.scrollTop = nextTop;
      requestAnimationFrame(() => {
        host.scrollTop = nextTop;
        requestAnimationFrame(() => {
          applyingScroll = false;
        });
      });
    }
  });

  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;

    const targetSection = sectionByPath(url.pathname);
    if (targetSection) {
      event.preventDefault();
      post({ type: 'navigate-section', section: targetSection });
      return;
    }

    if (/\/(?:admin\/?|control-home\.html|analytics-admin\.html)$/.test(url.pathname)) {
      link.target = '_top';
    }
  }, { capture: true });

  let gesture = null;

  const blocked = target => Boolean(target?.closest?.(
    'input,textarea,select,option,button,summary,label,' +
    '[role="button"],[contenteditable="true"],iframe,video,audio,canvas,' +
    '[data-no-admin-carousel]'
  ));

  const begin = (point, target) => {
    if (!point || blocked(target)) return;

    const host = getScrollHost();

    gesture = {
      id: point.identifier,
      startX: point.clientX,
      startY: point.clientY,
      lastX: point.clientX,
      lastY: point.clientY,
      startedAt: performance.now(),
      axis: '',
      parentStarted: false,
      scrollHost: host,
      scrollTop: Math.max(0, Number(host?.scrollTop) || 0)
    };
  };

  const activateHorizontal = event => {
    if (!gesture || gesture.parentStarted) return;

    gesture.axis = 'x';
    gesture.parentStarted = true;

    if (gesture.scrollHost) {
      gesture.scrollHost.scrollTop = gesture.scrollTop;
    }

    if (event?.cancelable) event.preventDefault();
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

    if (!gesture.axis && Math.max(ax, ay) >= 11) {
      if (ax >= 12 && ax > ay * 1.28) {
        activateHorizontal(event);
      } else if (ay >= 11 && ay > ax * 1.12) {
        gesture.axis = 'y';
      }
    }

    if (gesture.axis === 'y') return;
    if (gesture.axis !== 'x') return;

    if (gesture.scrollHost &&
        Math.abs((Number(gesture.scrollHost.scrollTop) || 0) - gesture.scrollTop) > 0.5) {
      gesture.scrollHost.scrollTop = gesture.scrollTop;
    }

    if (event.cancelable) event.preventDefault();
    event.stopPropagation?.();

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
    const threshold = Math.max(48, Math.min(82, innerWidth * 0.10));

    const valid = gesture.axis === 'x' &&
      gesture.parentStarted &&
      Math.abs(dx) >= threshold &&
      Math.abs(dx) > Math.abs(dy) * 1.22 &&
      (velocity >= 0.11 || Math.abs(dx) >= threshold * 1.18);

    if (gesture.parentStarted) {
      if (valid) {
        post({
          type: 'gesture-commit',
          direction: dx < 0 ? 1 : -1,
          dx
        });
      } else {
        post({ type: 'gesture-cancel' });
      }
    }

    gesture = null;
  };

  document.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) return;
    begin(event.touches[0], event.target);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    const point = [...event.touches].find(item => item.identifier === gesture.id) ||
      event.touches[0];
    update(point, event);
  }, { passive: false, capture: true });

  document.addEventListener('touchend', event => {
    if (!gesture) return;
    const point = [...event.changedTouches].find(item => item.identifier === gesture.id) ||
      event.changedTouches[0];
    finish(point);
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', () => {
    if (!gesture) return;
    if (gesture.parentStarted) post({ type: 'gesture-cancel' });
    gesture = null;
  }, { passive: true, capture: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installScrollSync, { once: true });
  } else {
    installScrollSync();
  }

  post({ type: 'frame-ready', section });
})();
