/* Control ANDRIK v55.00 R38 — monthly archive stores the maximum value reached in each month. */
(() => {
  'use strict';

  const openButton = document.getElementById('mapMonthlyOpen');
  const modal = document.getElementById('mapMonthlyModal');
  const backdrop = document.getElementById('mapMonthlyBackdrop');
  const closeButton = document.getElementById('mapMonthlyClose');
  const listNode = document.getElementById('mapMonthlyList');
  const chartNode = document.getElementById('mapMonthlyChart');
  const captionNode = document.getElementById('mapMonthlyChartCaption');
  if (!openButton || !modal || !listNode || !chartNode) return;

  const STORAGE_KEY = 'andrik-control-map-monthly-archive-v1';
  const KNOWN_MONTH_MAXIMUMS = Object.freeze({ '2026-07': 16564 });
  const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
  const shortMonthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
  let archive = readArchive();
  let returnFocus = null;

  function monthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function dateFromKey(key) {
    const [year, month] = String(key).split('-').map(Number);
    return new Date(year || 2026, Math.max(0, (month || 1) - 1), 1);
  }

  function readNumber(text) {
    const value = Number(String(text || '').replace(/[^\d-]/g, ''));
    return Number.isFinite(value) ? value : 0;
  }

  function readArchive() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .map(item => {
          const key = String(item?.key || '');
          const legacyValue = Math.max(0, Number(item?.maxValue ?? item?.value) || 0);
          const knownFloor = Math.max(0, Number(KNOWN_MONTH_MAXIMUMS[key]) || 0);
          const value = Math.max(legacyValue, knownFloor);
          return {
            key,
            value,
            maxValue: value,
            savedAt: String(item?.maxAt || item?.savedAt || ''),
            maxAt: String(item?.maxAt || item?.savedAt || ''),
            checkedAt: String(item?.checkedAt || item?.savedAt || ''),
            final: Boolean(item?.final)
          };
        })
        .filter(item => /^\d{4}-\d{2}$/.test(item.key) && item.value > 0);
      for (const [key, value] of Object.entries(KNOWN_MONTH_MAXIMUMS)) {
        if (!normalized.some(item => item.key === key) && value > 0) {
          normalized.push({ key, value, maxValue: value, savedAt: '', maxAt: '', checkedAt: '', final: false });
        }
      }
      return normalized
        .sort((a, b) => a.key.localeCompare(b.key))
        .slice(-48);
    } catch (_) {
      return [];
    }
  }

  function writeArchive() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(archive.slice(-48))); } catch (_) {}
  }

  function rememberCurrentTotal(total) {
    const liveValue = Math.max(0, Number(total) || 0);
    if (!liveValue) return;
    const now = new Date();
    const nowIso = now.toISOString();
    const key = monthKey(now);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const knownFloor = Math.max(0, Number(KNOWN_MONTH_MAXIMUMS[key]) || 0);
    const candidate = Math.max(liveValue, knownFloor);
    const existing = archive.find(item => item.key === key);
    if (existing) {
      const previousMaximum = Math.max(0, Number(existing.maxValue ?? existing.value) || 0);
      const monthlyMaximum = Math.max(previousMaximum, candidate);
      existing.value = monthlyMaximum;
      existing.maxValue = monthlyMaximum;
      existing.checkedAt = nowIso;
      existing.final = Boolean(existing.final || now.getDate() === lastDay);
      if (monthlyMaximum > previousMaximum || !existing.maxAt) {
        existing.maxAt = nowIso;
        existing.savedAt = nowIso;
      }
    } else {
      archive.push({
        key,
        value: candidate,
        maxValue: candidate,
        savedAt: nowIso,
        maxAt: nowIso,
        checkedAt: nowIso,
        final: now.getDate() === lastDay
      });
    }
    archive.sort((a, b) => a.key.localeCompare(b.key));
    archive = archive.slice(-48);
    writeArchive();
    if (!modal.hidden) render();
  }

  function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function formatMonth(key) {
    const label = monthFormat.format(dateFromKey(key));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function formatShortMonth(key) {
    return shortMonthFormat.format(dateFromKey(key)).replace('.', '');
  }

  function niceCeiling(value) {
    if (value <= 0) return 100;
    const power = Math.pow(10, Math.max(0, Math.floor(Math.log10(value)) - 1));
    return Math.ceil(value / power) * power;
  }

  function renderList(entries) {
    const currentKey = monthKey();
    if (!entries.length) {
      listNode.innerHTML = '<div class="map-monthly-empty">Первый месячный снимок появится после загрузки карты.</div>';
      return;
    }
    listNode.innerHTML = [...entries].reverse().map(item => {
      const current = item.key === currentKey;
      const saved = item.maxAt ? new Date(item.maxAt) : item.savedAt ? new Date(item.savedAt) : null;
      const status = current
        ? 'Максимум месяца · обновляется автоматически'
        : item.final
          ? 'Максимум за месяц · зафиксирован'
          : saved && !Number.isNaN(saved.getTime())
            ? `Максимум месяца · ${saved.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
            : 'Максимум месяца';
      return `<article class="map-month-row${current ? ' is-current' : ''}">
        <i class="map-month-dot" aria-hidden="true"></i>
        <div class="map-month-copy"><strong>${safeText(formatMonth(item.key))}</strong><small>${safeText(status)}</small></div>
        <b class="map-month-value">${safeText(numberFormat.format(item.value))}</b>
      </article>`;
    }).join('');
  }

  function renderChart(entries) {
    if (!entries.length) {
      chartNode.innerHTML = '<div class="map-monthly-empty">График начнётся с первого сохранённого месяца.</div>';
      chartNode.setAttribute('aria-label', 'Месячных данных пока нет');
      if (captionNode) captionNode.textContent = 'Ожидаем первый месяц';
      return;
    }
    const graphEntries = entries.slice(-12);
    const maxValue = Math.max(...graphEntries.map(item => item.value), 1);
    const ceiling = niceCeiling(maxValue);
    const axis = [ceiling, Math.round(ceiling * .75), Math.round(ceiling * .5), Math.round(ceiling * .25), 0];
    const columns = graphEntries.map((item, index) => {
      const height = Math.max(4, Math.min(100, item.value / ceiling * 100));
      return `<div class="map-month-column" style="--bar-height:${height.toFixed(2)}%;grid-column:${index + 1}">
        <em>${safeText(numberFormat.format(item.value))}</em>
        <i class="map-month-bar" style="height:${height.toFixed(2)}%;animation-delay:${(index * .055).toFixed(3)}s"></i>
        <small>${safeText(formatShortMonth(item.key))}</small>
      </div>`;
    }).join('');
    chartNode.innerHTML = `<div class="map-monthly-axis">${axis.map(value => `<span>${safeText(numberFormat.format(value))}</span>`).join('')}</div><div class="map-monthly-bars map-monthly-bars-r38">${columns}</div>`;
    chartNode.setAttribute('aria-label', graphEntries.map(item => `${formatMonth(item.key)}, максимум: ${numberFormat.format(item.value)}`).join('. '));
    if (captionNode) captionNode.textContent = graphEntries.length === 1 ? 'Первый максимум месяца' : `${graphEntries.length} месяцев · максимумы`;
  }

  function render() {
    const entries = archive.filter(item => item.value > 0).sort((a, b) => a.key.localeCompare(b.key));
    renderList(entries);
    renderChart(entries);
  }

  function openModal() {
    const liveValue = readNumber(document.getElementById('worldMapTotalValue')?.textContent);
    if (liveValue) rememberCurrentTotal(liveValue);
    returnFocus = document.activeElement;
    render();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-map-monthly-open');
    closeButton?.focus({ preventScroll: true });
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-map-monthly-open');
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
  }

  window.__andrikOpenMapMonthly = openModal;
  openButton.addEventListener('click', openModal);
  backdrop?.addEventListener('click', closeModal);
  closeButton?.addEventListener('click', closeModal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
  window.addEventListener('andrik:map-total-updated', event => rememberCurrentTotal(event.detail?.total));
  const initial = readNumber(document.getElementById('worldMapTotalValue')?.textContent);
  if (initial) rememberCurrentTotal(initial);
})();
