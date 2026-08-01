(() => {
  'use strict';
  const list = document.getElementById('worldCountries');
  const toggle = document.getElementById('countryGrowthToggle');
  const panel = document.getElementById('countryGrowthPanel');
  const close = document.getElementById('countryGrowthClose');
  const target = document.getElementById('countryGrowthList');
  const viewport = document.getElementById('analyticsSwipeViewport');
  const mapPane = document.querySelector('.analytics-map-pane');
  if (!list || !toggle || !panel || !target || window.__andrikCountryGrowthV5482Ready) return;
  window.__andrikCountryGrowthV5482Ready = true;

  const CACHE_KEY = 'andrik-country-growth-v54-82';
  const FALLBACK_KEYS = ['andrik-country-growth-v54-82', 'andrik-country-growth-v54-75', 'andrik-country-growth-v54-74', 'andrik-country-growth-v54-73', 'andrik-country-growth-v54-69'];
  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  let weekly = new Map();
  let previous = new Map();
  let request = null;
  let syncFrame = 0;
  let loadedAt = 0;

  const num = value => new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
  const flag = code => /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map(char => 127397 + char.charCodeAt(0)))
    : '🌍';
  const readKey = () => {
    try { return localStorage.getItem(KEY_LOCAL) || sessionStorage.getItem(KEY_SESSION) || ''; }
    catch (_) { return ''; }
  };
  const readCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY) || FALLBACK_KEYS.map(key => localStorage.getItem(key)).find(Boolean) || 'null';
      return JSON.parse(raw);
    } catch (_) { return null; }
  };
  const saveCache = data => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() })); }
    catch (_) {}
  };
  const scheduleButtonSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncButtons);
  };
  const countryName = code => {
    const escaped = window.CSS?.escape ? CSS.escape(code) : code.replace(/[^A-Z0-9_-]/g, '');
    const button = list.querySelector(`.world-country-button[data-code="${escaped}"]`);
    return button?.querySelector('.world-country-marquee')?.textContent?.trim() || code;
  };
  const comparisonState = (now, before, hasPrevious) => {
    if (!hasPrevious || now === before) return 'is-flat';
    return now > before ? 'is-positive' : 'is-negative';
  };

  function syncButtons(){
    list.querySelectorAll('.world-country-button[data-code]').forEach(button => {
      let badge = button.querySelector('.country-weekly-gain');
      if (!badge) {
        badge = document.createElement('small');
        badge.className = 'country-weekly-gain';
        button.appendChild(badge);
      }
      const code = String(button.dataset.code || '').toUpperCase();
      const hasCurrent = weekly.has(code);
      const hasPrevious = previous.has(code);
      const now = hasCurrent ? Number(weekly.get(code) || 0) : 0;
      const before = hasPrevious ? Number(previous.get(code) || 0) : 0;
      const state = comparisonState(now, before, hasPrevious);
      const arrow = !hasPrevious ? '•' : (now > before ? '▲' : (now < before ? '▼' : '•'));
      const currentText = hasCurrent ? `+${num(now)} за 7 дней` : 'данные за 7 дней обновляются';
      const compareText = hasPrevious ? `${arrow} ${num(before)} за предыдущие` : 'нет данных за предыдущие';
      const desired = `<span class="country-weekly-current ${hasCurrent && now > 0 ? 'is-positive' : 'is-flat'}">${currentText}</span><span class="country-weekly-compare ${state}"><span class="country-weekly-marquee-track"><span>${compareText}</span><span aria-hidden="true">${compareText}</span></span></span>`;
      badge.hidden = false;
      if (badge.innerHTML !== desired) badge.innerHTML = desired;
      requestAnimationFrame(() => {
        const compare = badge.querySelector('.country-weekly-compare');
        const first = compare?.querySelector('.country-weekly-marquee-track > span');
        if (compare && first) compare.classList.toggle('is-overflowing', first.scrollWidth > compare.clientWidth - 4);
      });
    });
  }

  function render(){
    const rows = [...weekly.entries()]
      .map(([code, value]) => ({ code, value: Number(value || 0), previous: Number(previous.get(code) || 0), hasPrevious: previous.has(code) }))
      .filter(row => row.code && row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 31);
    if (!rows.length) {
      target.innerHTML = '<span class="country-growth-loading">Недельная сводка ещё не создана Центральным Cron.</span>';
      return;
    }
    const max = Math.max(1, ...rows.map(row => row.value));
    target.innerHTML = rows.map((row, index) => {
      const state = comparisonState(row.value, row.previous, row.hasPrevious);
      const arrow = !row.hasPrevious ? '•' : (row.value > row.previous ? '▲' : (row.value < row.previous ? '▼' : '•'));
      const previousText = row.hasPrevious ? `${arrow} ${num(row.previous)} за предыдущие 7 дней` : 'нет данных за предыдущие 7 дней';
      return `<article class="country-growth-row"><span class="country-growth-rank">${index + 1}</span><div class="country-growth-copy"><div class="country-growth-name"><span>${flag(row.code)}</span><span>${countryName(row.code)}</span></div><div class="country-growth-bar"><i style="width:${Math.max(4, row.value / max * 100).toFixed(1)}%"></i></div></div><strong class="country-growth-value">+${num(row.value)}<small class="${state}">${previousText}</small></strong></article>`;
    }).join('');
  }

  function normalizeRows(rows){
    return (Array.isArray(rows) ? rows : [])
      .map(item => ({ code: String(item?.country || item?.code || '').trim().toUpperCase(), views: Number(item?.views ?? item?.value ?? 0) }))
      .filter(item => item.code && item.views >= 0);
  }

  function emitGrowthData(origin='unknown'){
    const detail={
      weeklyCountries:[...weekly.entries()].map(([country,views])=>({country,views})),
      previousWeekCountries:[...previous.entries()].map(([country,views])=>({country,views})),
      source:origin,
      loadedAt
    };
    window.__andrikLatestCountryGrowth=detail;
    window.dispatchEvent(new CustomEvent('andrik:country-growth-data',{detail}));
  }

  function ingest(data, origin='unknown'){
    const source = data?.weeklyCountries ? data
      : data?.youtube?.studio?.weeklyCountries ? data.youtube.studio
      : data?.youtube?.weeklyCountries ? data.youtube
      : data?.data?.weeklyCountries ? data.data
      : {};
    const currentRows = normalizeRows(source.weeklyCountries);
    const previousRows = normalizeRows(source.previousWeekCountries);
    if (!currentRows.length && !previousRows.length) return false;
    weekly = new Map(currentRows.map(item => [item.code, item.views]));
    previous = new Map(previousRows.map(item => [item.code, item.views]));
    loadedAt = Date.now();
    render();
    scheduleButtonSync();
    emitGrowthData(origin);
    return true;
  }

  function hardFetch(url, options, timeoutMs = 15000){
    const controller = new AbortController();
    let timer = 0;
    const network = fetch(url, { ...options, signal: controller.signal });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try { controller.abort(); } catch (_) {}
        reject(new Error('сервер отвечает медленно'));
      }, timeoutMs);
    });
    return Promise.race([network, timeout]).finally(() => clearTimeout(timer));
  }

  function showRetry(message){
    target.innerHTML = `<div class="country-growth-retry"><span>${message}</span><button type="button" data-growth-retry>Повторить</button></div>`;
  }

  function loadGrowth(force = false){
    if (request && !force) return request;
    if (!force && weekly.size && Date.now() - loadedAt < 10 * 60 * 1000) return Promise.resolve(true);
    const key = readKey();
    if (!key) {
      const cached = readCache();
      if (cached?.data && ingest(cached.data,'cache')) return Promise.resolve(false);
      showRetry('Сначала подтвердите доступ владельца в разделе «Служебное».');
      return Promise.resolve(false);
    }
    if (!weekly.size) target.innerHTML = '<span class="country-growth-loading">Получаем сравнение 7 + 7 дней…</span>';
    toggle.classList.add('is-loading');
    request = hardFetch('/api/control/country-growth?refresh=1&v=54.82', {
      headers: { accept: 'application/json', authorization: `Bearer ${key}` },
      cache: 'no-store'
    }, 15000).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.details || data.error || `HTTP ${response.status}`);
      saveCache(data);
      if (!ingest(data,'network') && !weekly.size) showRetry('Недельная сводка пока пуста. Нажмите «Повторить» через минуту.');
      return true;
    }).catch(error => {
      const cached = readCache();
      if (cached?.data && ingest(cached.data,'cache')) return false;
      showRetry(`Не удалось получить рост стран: ${String(error?.message || error)}`);
      return false;
    }).finally(() => {
      toggle.classList.remove('is-loading');
      request = null;
      scheduleButtonSync();
    });
    return request;
  }

  const panelAnchor = document.createComment('country-growth-panel-anchor-v54-82');
  panel.parentNode?.insertBefore(panelAnchor, panel);

  function ensurePanelPortal(){
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
  }

  function setPanelOpen(open){
    const focused = Boolean(list.querySelector('.world-country-button.is-selected'));
    if (open && focused) open = false;
    if (open) ensurePanelPortal();
    panel.hidden = !open;
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if(!panel.hasAttribute('tabindex'))panel.tabIndex=-1;
    toggle.setAttribute('aria-expanded', String(open));
    viewport?.classList.toggle('is-growth-open', open);
    mapPane?.classList.toggle('is-growth-open', open);
    document.documentElement.classList.toggle('is-country-growth-open', open);
    document.body.classList.toggle('is-country-growth-open', open);
    if (open) {
      panel.scrollTop = 0;
      render();
      void loadGrowth(false);
      requestAnimationFrame(() => { try{panel.focus({preventScroll:true})}catch(_){} });
    }
  }

  const observer = new MutationObserver(() => {
    scheduleButtonSync();
    if (weekly.size) render();
  });
  observer.observe(list, { childList: true, subtree: true });

  // v54.77: one deterministic capture-phase handler for Android/PWA.
  // It runs before the swipe layer and suppresses the delayed synthetic click,
  // so one tap always performs exactly one open/close action.
  let lastActivationAt = -Infinity;

  const isPanelOpen = () => !panel.hidden && panel.getAttribute('aria-hidden') !== 'true';

  const activateToggle = event => {
    const now = performance.now();
    if (now - lastActivationAt < 650) {
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      event?.stopPropagation?.();
      return;
    }
    lastActivationAt = now;
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    event?.stopPropagation?.();
    setPanelOpen(!isPanelOpen());
  };

  toggle.disabled = false;
  toggle.style.pointerEvents = 'auto';
  toggle.style.touchAction = 'manipulation';
  toggle.style.position = 'relative';
  toggle.style.zIndex = '80';

  const captureActivation = event => {
    const button = event.target?.closest?.('#countryGrowthToggle');
    if (!button) return;
    activateToggle(event);
  };

  document.addEventListener('pointerup', captureActivation, true);
  document.addEventListener('click', captureActivation, true);

  window.__andrikToggleCountryGrowth = event => {
    activateToggle(event);
    return false;
  };

  close?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setPanelOpen(false);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && isPanelOpen()) setPanelOpen(false); });
  target.addEventListener('click', event => {
    if (!event.target.closest?.('[data-growth-retry]')) return;
    showRetry('Повторяем запрос…');
    void loadGrowth(true);
  });
  window.addEventListener('andrik:country-focus-changed', event => {
    if (event.detail?.focused) setPanelOpen(false);
    void loadGrowth(false).then(scheduleButtonSync);
  });
  window.addEventListener('andrik:audience-data', event => {
    ingest(event.detail,'audience');
    if (!weekly.size) void loadGrowth(false);
  });
  window.addEventListener('pageshow', () => {
    scheduleButtonSync();
    if (!weekly.size) void loadGrowth(false);
  });

  const cached = readCache();
  if (cached?.data) ingest(cached.data,'cache');
  setTimeout(() => void loadGrowth(false), 350);
  setTimeout(scheduleButtonSync, 900);
})();
