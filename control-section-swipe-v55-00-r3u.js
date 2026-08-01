/* Control ANDRIK v55.00 R3U — verified circular touch swipe for four expanded sections. */
(() => {
  'use strict';
  if (window.__andrikAdminSectionSwipeR3U) return;
  window.__andrikAdminSectionSwipeR3U = true;

  const sections = [
    { key:'service', name: 'Служебное', file: 'service-admin.html', url: '/service-admin.html?v=55.00-r3u' },
    { key:'monitor', name: 'Мониторинг', file: 'observability-admin.html', url: '/observability-admin.html?v=55.00-r3u' },
    { key:'releases', name: 'Релизы', file: 'lyrics-admin.html', url: '/lyrics-admin.html?v=55.00-r3u' },
    { key:'discussion', name: 'Обсуждение', file: 'comments-admin.html', url: '/comments-admin.html?v=55.00-r3u' }
  ];

  const pathname = String(location.pathname || '/').replace(/\/+$/, '');
  const forcedSection=String(document.body?.dataset?.controlSection||'').toLowerCase();
  const currentIndex = sections.findIndex(section => section.key===forcedSection || pathname.endsWith(`/${section.file}`) || pathname === section.file);
  if (currentIndex < 0) return;

  const body = document.body;
  body.classList.add('control-section-swipe-r3u');
  body.dataset.controlSectionIndex = String(currentIndex);

  sections.forEach((section, index) => {
    if (index === currentIndex) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = section.url;
    document.head.appendChild(link);
  });

  const pager = document.createElement('nav');
  pager.className = 'control-section-pager-r3u';
  pager.setAttribute('aria-label', 'Круговое переключение разделов');
  pager.innerHTML = sections.map((section, index) =>
    `<button type="button" data-section-index="${index}" aria-label="${section.name}" class="${index === currentIndex ? 'is-active' : ''}"><i></i></button>`
  ).join('');
  body.appendChild(pager);

  const preview = document.createElement('div');
  preview.className = 'control-section-preview-r3u';
  preview.setAttribute('aria-hidden', 'true');
  preview.innerHTML = '<span></span><strong></strong>';
  body.appendChild(preview);
  const previewArrow = preview.querySelector('span');
  const previewText = preview.querySelector('strong');

  let touch = null;
  let mouse = null;
  let navigating = false;
  let hideTimer = 0;

  const isBlocked = target => Boolean(target?.closest?.(
    'input,textarea,select,option,[contenteditable="true"],iframe,video,audio,canvas,[data-no-section-swipe],.no-section-carousel'
  ));

  const targetIndex = dx => dx < 0
    ? (currentIndex + 1) % sections.length
    : (currentIndex - 1 + sections.length) % sections.length;

  const showPreview = (index, dx) => {
    previewArrow.textContent = dx < 0 ? '←' : '→';
    previewText.textContent = sections[index].name;
    preview.classList.add('is-visible');
    preview.setAttribute('aria-hidden', 'false');
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      preview.classList.remove('is-visible');
      preview.setAttribute('aria-hidden', 'true');
    }, 650);
  };

  const resetVisual = () => {
    body.style.removeProperty('--section-drag-x');
    body.classList.remove('is-section-dragging-r3u');
  };

  const navigate = (index, dx) => {
    if (navigating) return;
    navigating = true;
    const destination = sections[index].url;
    body.classList.add(dx < 0 ? 'is-section-leaving-left-r3u' : 'is-section-leaving-right-r3u');
    showPreview(index, dx);
    try { sessionStorage.setItem('andrik-section-entry-r3u', dx < 0 ? 'left' : 'right'); } catch (_) {}
    window.setTimeout(() => {
      if (typeof window.__ANDRIK_TEST_NAV_HOOK_R3U === 'function') {
        window.__ANDRIK_TEST_NAV_HOOK_R3U(destination, index);
      } else {
        location.assign(destination);
      }
    }, 105);
  };

  const finish = gesture => {
    if (!gesture || navigating) return;
    const dx = gesture.lastX - gesture.startX;
    const dy = gesture.lastY - gesture.startY;
    const elapsed = Math.max(1, performance.now() - gesture.startedAt);
    const velocity = Math.abs(dx) / elapsed;
    const threshold = Math.max(44, Math.min(76, innerWidth * 0.095));
    const valid = gesture.axis === 'x' &&
      Math.abs(dx) >= threshold &&
      Math.abs(dx) > Math.abs(dy) * 1.08 &&
      (velocity >= 0.10 || Math.abs(dx) >= threshold * 1.18);
    resetVisual();
    if (valid) navigate(targetIndex(dx), dx);
  };

  document.addEventListener('touchstart', event => {
    if (navigating || event.touches.length !== 1 || isBlocked(event.target)) return;
    const point = event.touches[0];
    touch = {
      id: point.identifier,
      startX: point.clientX,
      startY: point.clientY,
      lastX: point.clientX,
      lastY: point.clientY,
      startedAt: performance.now(),
      axis: ''
    };
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', event => {
    if (!touch || navigating) return;
    const point = [...event.touches].find(item => item.identifier === touch.id) || event.touches[0];
    if (!point) return;
    touch.lastX = point.clientX;
    touch.lastY = point.clientY;
    const dx = touch.lastX - touch.startX;
    const dy = touch.lastY - touch.startY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (!touch.axis && Math.max(ax, ay) >= 9) {
      if (ax > ay * 1.08) touch.axis = 'x';
      else if (ay > ax * 1.08) touch.axis = 'y';
    }
    if (touch.axis === 'y') {
      touch = null;
      resetVisual();
      return;
    }
    if (touch.axis !== 'x') return;
    if (event.cancelable) event.preventDefault();
    body.classList.add('is-section-dragging-r3u');
    body.style.setProperty('--section-drag-x', `${Math.max(-72, Math.min(72, dx * .28))}px`);
    showPreview(targetIndex(dx), dx);
  }, { passive: false, capture: true });

  document.addEventListener('touchend', event => {
    if (!touch) return;
    const point = [...event.changedTouches].find(item => item.identifier === touch.id) || event.changedTouches[0];
    if (point) {
      touch.lastX = point.clientX;
      touch.lastY = point.clientY;
    }
    const completed = touch;
    touch = null;
    finish(completed);
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', () => {
    touch = null;
    resetVisual();
  }, { passive: true, capture: true });

  document.addEventListener('pointerdown', event => {
    if (navigating || event.pointerType !== 'mouse' || event.button !== 0 || isBlocked(event.target)) return;
    mouse = { startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY, startedAt:performance.now(), axis:'' };
  }, { passive:true, capture:true });

  document.addEventListener('pointermove', event => {
    if (!mouse || navigating || event.pointerType !== 'mouse') return;
    mouse.lastX=event.clientX; mouse.lastY=event.clientY;
    const dx=mouse.lastX-mouse.startX, dy=mouse.lastY-mouse.startY;
    if(!mouse.axis && Math.max(Math.abs(dx),Math.abs(dy))>=9){
      mouse.axis=Math.abs(dx)>Math.abs(dy)*1.08?'x':'y';
    }
    if(mouse.axis!=='x')return;
    if(event.cancelable)event.preventDefault();
    body.classList.add('is-section-dragging-r3u');
    body.style.setProperty('--section-drag-x', `${Math.max(-72, Math.min(72, dx * .28))}px`);
    showPreview(targetIndex(dx),dx);
  }, { passive:false, capture:true });

  document.addEventListener('pointerup', event => {
    if(!mouse||event.pointerType!=='mouse')return;
    mouse.lastX=event.clientX; mouse.lastY=event.clientY;
    const completed=mouse; mouse=null; finish(completed);
  }, { passive:true, capture:true });

  pager.addEventListener('click', event => {
    const button = event.target.closest('[data-section-index]');
    if (!button || navigating) return;
    const index = Number(button.dataset.sectionIndex);
    if (!Number.isInteger(index) || index === currentIndex) return;
    const forward = (index - currentIndex + sections.length) % sections.length;
    const backward = (currentIndex - index + sections.length) % sections.length;
    navigate(index, forward <= backward ? -100 : 100);
  });

  let entry = '';
  try {
    entry = sessionStorage.getItem('andrik-section-entry-r3u') || '';
    sessionStorage.removeItem('andrik-section-entry-r3u');
  } catch (_) {}
  if (entry) {
    body.classList.add(entry === 'left' ? 'is-section-entering-right-r3u' : 'is-section-entering-left-r3u');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      body.classList.remove('is-section-entering-right-r3u', 'is-section-entering-left-r3u');
    }));
  }
})();
