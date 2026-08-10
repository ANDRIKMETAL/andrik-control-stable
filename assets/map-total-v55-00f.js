/* ANDRIK R391 — display true lifetime YouTube views on ALL world layer without corrupting period archives. */
(() => {
  'use strict';

  const list = document.getElementById('worldCountries');
  const shell = document.getElementById('worldMapTotal');
  const valueNode = document.getElementById('worldMapTotalValue');
  const labelNode = shell?.querySelector('span');
  if (!list || !shell || !valueNode) return;

  const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  let scheduled = false;
  let lastTotal = null;
  let activeLayer = String(document.getElementById('worldMap')?.dataset?.ecosystemLayer || window.__andrikEcosystemActiveLayer || 'all').toLowerCase();
  let lifetimeViews = Math.max(0, Number(window.__andrikYoutubeLifetimeViews || 0));
  try { lifetimeViews = Math.max(lifetimeViews, Number(localStorage.getItem('andrik-youtube-lifetime-views-r391') || 0)); } catch (_) {}

  function readNumber(text) {
    const normalized = String(text || '').replace(/[^\d-]/g, '');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : 0;
  }

  function emitTotal(total, countries) {
    if (lastTotal === total) return;
    lastTotal = total;
    window.__andrikMapTotal = total;
    window.dispatchEvent(new CustomEvent('andrik:map-total-updated', {
      detail: { total, countries, updatedAt: new Date().toISOString() }
    }));
  }

  function updateTotal() {
    scheduled = false;
    const rows = [...list.querySelectorAll('.world-country-button[data-country]')];
    if (!rows.length) {
      valueNode.textContent = '—';
      shell.classList.remove('is-ready');
      shell.classList.add('is-loading');
      shell.title = 'Сумма появится после загрузки стран';
      shell.setAttribute('aria-label', 'Всего просмотров: данные загружаются');
      return;
    }

    const total = rows.reduce((sum, row) => {
      const explicit = Number(row.dataset.value);
      if (Number.isFinite(explicit)) return sum + explicit;
      return sum + readNumber(row.querySelector('em')?.textContent);
    }, 0);

    // Keep the real period total for monthly archives and growth logic.
    emitTotal(total, rows.length);

    const showLifetime = activeLayer === 'all' && lifetimeViews > 0;
    const displayValue = showLifetime ? lifetimeViews : total;
    const formatted = format.format(displayValue);
    valueNode.textContent = formatted;
    if (labelNode) labelNode.textContent = showLifetime ? '🎧 Всего:' : 'Всего:';
    shell.classList.remove('is-loading');
    shell.classList.add('is-ready');
    if (showLifetime) {
      shell.title = `Просмотры ANDRIK на YouTube за всё время: ${formatted}`;
      shell.setAttribute('aria-label', `Просмотры ANDRIK на YouTube за всё время: ${formatted}`);
      shell.dataset.totalMode = 'youtube-lifetime';
    } else {
      shell.title = `Сумма текущего слоя по всем ${rows.length} странам: ${formatted}`;
      shell.setAttribute('aria-label', `Всего по текущему слою: ${formatted}`);
      shell.dataset.totalMode = 'period';
    }
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateTotal);
  }

  new MutationObserver(scheduleUpdate).observe(list, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-value']
  });

  window.addEventListener('andrik:audience-data', event => {
    const next = Math.max(0, Number(event?.detail?.youtube?.views || 0));
    if (next > 0) {
      lifetimeViews = next;
      window.__andrikYoutubeLifetimeViews = next;
      try { localStorage.setItem('andrik-youtube-lifetime-views-r391', String(next)); } catch (_) {}
    }
    scheduleUpdate();
  });
  window.addEventListener('andrik:youtube-lifetime-views', event => {
    const next = Math.max(0, Number(event?.detail?.views || 0));
    if (next > 0) lifetimeViews = next;
    scheduleUpdate();
  });
  window.addEventListener('andrik:ecosystem-layer-changed', event => {
    activeLayer = String(event?.detail?.layer || document.getElementById('worldMap')?.dataset?.ecosystemLayer || 'all').toLowerCase();
    const next = Math.max(0, Number(event?.detail?.youtubeLifetimeViews || 0));
    if (next > 0) lifetimeViews = next;
    scheduleUpdate();
  });
  window.addEventListener('andrik:country-growth-data', scheduleUpdate);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleUpdate();
  });

  scheduleUpdate();
})();
