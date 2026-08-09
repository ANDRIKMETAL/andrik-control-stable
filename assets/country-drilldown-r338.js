/* ANDRIK R338 — country drilldown map with city-level points for focused country. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_DRILLDOWN_R338__) return;
  window.__ANDRIK_COUNTRY_DRILLDOWN_R338__ = true;

  const map = document.getElementById('worldMap');
  const list = document.getElementById('worldCountries');
  if (!map || !list) return;
  const runtime = window.__andrikWorldMapRuntime || {};
  const page = map.closest('.analytics-map-top') || map.parentElement;
  if (!page) return;
  const pane = document.querySelector('.analytics-map-pane');

  const layerNames = {
    all:'Вся экосистема',
    youtube:'YouTube',
    site:'Сайт',
    music:'Music',
    push:'Push'
  };
  const sourceNames = {
    all:'общей активности',
    youtube:'просмотрам YouTube',
    site:'посещениям сайта',
    music:'музыкальной активности',
    push:'push-подпискам'
  };
  const fmt = value => new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(value || 0)));
  const translateCountry = value => runtime.translateCountry ? runtime.translateCountry(value) : String(value || '');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const flagFromCode = code => {
    const upper = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(upper)) return '🌍';
    return String.fromCodePoint(...[...upper].map(ch => 127397 + ch.charCodeAt(0)));
  };

  const panel = document.createElement('section');
  panel.id = 'countryDrilldownPanelR338';
  panel.className = 'country-drilldown-panel';
  panel.setAttribute('aria-live', 'polite');
  panel.hidden = true;
  page.insertBefore(panel, document.getElementById('countryGrowthToggle') || null);

  function getState(){
    try { return window.andrikEcosystemMap?.state?.() || null; } catch (_) { return null; }
  }
  function getActiveLayer(){
    return String(window.__andrikEcosystemActiveLayer || map.dataset.ecosystemLayer || 'youtube');
  }
  function getSelectedCountry(){
    const selected = list.querySelector('.world-country-button.is-selected,[aria-pressed="true"]');
    return decodeURIComponent(selected?.dataset?.country || '').trim() || String(map.dataset.focusCountry || '').trim() || '';
  }
  function getSelectedCode(){
    const selected = list.querySelector('.world-country-button.is-selected,[aria-pressed="true"]');
    return String(selected?.dataset?.code || '').trim().toUpperCase();
  }

  function aggregatePoints(points){
    const merged = new Map();
    for (const point of Array.isArray(points) ? points : []) {
      const lat = Number(point?.latitude), lon = Number(point?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const country = translateCountry(point?.country || point?.code || '');
      const city = String(point?.city || point?.region || country || '—').trim();
      const region = String(point?.region || '').trim();
      const key = [country, city, lat.toFixed(2), lon.toFixed(2)].join('|');
      const prev = merged.get(key) || { country, city, region, latitude: lat, longitude: lon, value: 0, live: 0 };
      prev.value += Math.max(0, Number(point?.value || 0));
      if (point?.live) prev.live += Math.max(1, Number(point.live || 1));
      merged.set(key, prev);
    }
    return [...merged.values()].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  }

  function livePointsForLayer(state, layer){
    const items = Array.isArray(state?.recent) ? state.recent : [];
    return items.filter(item => {
      const type = String(item?.type || '');
      if (layer === 'site') return type === 'visit';
      if (layer === 'music') return type === 'music-download' || type === 'music-listen';
      if (layer === 'push') return false;
      if (layer === 'all') return type === 'visit' || type === 'music-download' || type === 'music-listen';
      return false;
    }).map(item => ({
      country: item.country || '',
      region: item.region || '',
      city: item.city || item.region || item.country || '',
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      value: 1,
      live: 1
    })).filter(item => item.country && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  }

  function pointsForLayer(state, layer, country){
    if (!state || !country) return [];
    let base = [];
    if (layer === 'all') {
      base = [].concat(state.site?.points || [], state.music?.points || [], state.push?.points || [], livePointsForLayer(state, 'all'));
    } else if (layer === 'youtube') {
      base = [];
    } else if (layer === 'site' || layer === 'music' || layer === 'push') {
      base = [].concat(state[layer]?.points || [], livePointsForLayer(state, layer));
    }
    return aggregatePoints(base.filter(point => translateCountry(point?.country || point?.code || '') === country));
  }

  function rowTotal(state, layer, country){
    const rows = Array.isArray(state?.[layer]?.rows) ? state[layer].rows : [];
    return rows.filter(row => translateCountry(row?.country || row?.name || '') === country)
      .reduce((sum, row) => sum + Math.max(0, Number(row?.value || row?.views || row?.activeUsers || 0)), 0);
  }

  function breakdownTotal(state, country){
    const b = state?.breakdown instanceof Map ? state.breakdown.get(country) : null;
    return b || { youtube: 0, site: 0, music: 0, push: 0 };
  }

  function computeBounds(points){
    if (!points.length) return null;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const point of points) {
      const lat = Number(point.latitude), lon = Number(point.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    }
    if (!Number.isFinite(minLat)) return null;
    if (minLat === maxLat) { minLat -= .6; maxLat += .6; }
    if (minLon === maxLon) { minLon -= .8; maxLon += .8; }
    const latPad = Math.max(.18, (maxLat - minLat) * .18);
    const lonPad = Math.max(.22, (maxLon - minLon) * .18);
    return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLon: minLon - lonPad, maxLon: maxLon + lonPad };
  }

  function pointMarkup(points, layer){
    if (!points.length) {
      return '<div class="country-drilldown-map-empty">Для этого слоя пока нет детальных городских точек внутри выбранной страны.</div>';
    }
    const bounds = computeBounds(points);
    if (!bounds) return '<div class="country-drilldown-map-empty">География пока не готова.</div>';
    const max = Math.max(1, ...points.map(point => Number(point.value || 0)));
    return points.slice(0, 16).map(point => {
      const x = 6 + ((Number(point.longitude) - bounds.minLon) / Math.max(0.0001, bounds.maxLon - bounds.minLon)) * 88;
      const y = 6 + (1 - ((Number(point.latitude) - bounds.minLat) / Math.max(0.0001, bounds.maxLat - bounds.minLat))) * 88;
      const size = 10 + Math.round((Number(point.value || 0) / max) * 16);
      const label = escapeHtml(point.city || point.region || '—');
      const region = point.region && point.region !== point.city ? ` · ${escapeHtml(point.region)}` : '';
      const title = `${escapeHtml(point.city || point.region || '—')}${region}: ${fmt(point.value)}${point.live ? ' · LIVE' : ''}`;
      return `<button type="button" class="country-drilldown-dot${point.live ? ' is-live' : ''}" data-layer="${escapeHtml(layer)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--dot-size:${size}px" title="${title}"><i></i><span class="country-drilldown-dot-label">${label}</span></button>`;
    }).join('');
  }

  function cityListMarkup(points, layer, country){
    if (!points.length) {
      if (layer === 'youtube') return '<div class="country-drilldown-empty">YouTube на этой карте сейчас доступен только до уровня страны. Городская детализация для YouTube не возвращается API.</div>';
      return '<div class="country-drilldown-empty">Список городов появится автоматически, когда накопятся детальные события по выбранной стране.</div>';
    }
    const max = Math.max(1, ...points.map(point => Number(point.value || 0)));
    return `<div class="country-drilldown-list">${points.slice(0, 8).map((point, index) => {
      const fill = Math.max(4, (Number(point.value || 0) / max) * 100).toFixed(1);
      const sub = point.region && point.region !== point.city ? escapeHtml(point.region) : 'точка на карте';
      return `<article class="country-drilldown-row"><span class="country-drilldown-rank">${index + 1}</span><div class="country-drilldown-city"><strong>${escapeHtml(point.city || point.region || country)}</strong><small>${sub}</small><span class="country-drilldown-bar"><i style="--fill:${fill}%"></i></span></div><strong class="country-drilldown-value">${fmt(point.value)}</strong></article>`;
    }).join('')}</div>`;
  }

  function render(){
    const country = getSelectedCountry();
    const code = getSelectedCode();
    const state = getState();
    const layer = getActiveLayer();
    if (!country || !state) {
      panel.hidden = true;
      panel.classList.remove('is-visible');
      pane?.classList.remove('is-country-expanded');
      return;
    }
    const meta = window.__andrikEcosystemLayerMeta ? window.__andrikEcosystemLayerMeta(layer) : null;
    const points = pointsForLayer(state, layer, country);
    const total = layer === 'all' ? rowTotal(state, 'all', country) : rowTotal(state, layer, country);
    const liveCount = points.reduce((sum, point) => sum + Math.max(0, Number(point.live || 0)), 0);
    const breakdown = breakdownTotal(state, country);
    const flag = code ? flagFromCode(code) : '🌍';
    const listTitle = layer === 'youtube' ? 'Список по стране' : 'Список городов / регионов';
    const listNote = layer === 'youtube' ? 'YouTube даёт только уровень страны.' : `Точки ранжированы по ${sourceNames[layer] || 'активности'} внутри страны.`;
    const mapNote = layer === 'youtube'
      ? 'У YouTube для этой карты нет городских координат. Здесь будет включён городский drill-down для тех слоёв, где география доступна.'
      : 'Масштаб внутри страны строится по детальным точкам: чем больше сигнал, тем крупнее светящаяся точка.';
    const subtitle = layer === 'all'
      ? 'Нажатая страна раскрыта в отдельный внутренний слой: теперь можно увидеть, где именно внутри неё концентрируется активность.'
      : `Слой «${layerNames[layer] || layer}» раскрыт внутри выбранной страны. Это даёт отдельную карту и отдельный список точек для более детального просмотра.`;
    const breakdownHtml = layer === 'all'
      ? `<p style="margin:10px 0 0;color:#dff5ff;font:700 .84rem/1.35 Arial,Helvetica,sans-serif">▶ YouTube ${fmt(breakdown.youtube)} · 🌐 Сайт ${fmt(breakdown.site)} · ♪ Music ${fmt(breakdown.music)} · 🔔 Push ${fmt(breakdown.push)}</p>`
      : '';
    panel.innerHTML = `
      <div class="country-drilldown-head">
        <div class="country-drilldown-breadcrumbs"><button type="button" id="countryDrilldownBackR338">← Мир</button><span>🌍 Мир</span><span>›</span><span>${flag} ${escapeHtml(country)}</span></div>
        <h3>${flag} ${escapeHtml(country)} · ${escapeHtml(layerNames[layer] || layer)}</h3>
        <p>${escapeHtml(subtitle)}</p>
        ${breakdownHtml}
        <div class="country-drilldown-kpis">
          <article><span>Что показывает список</span><strong>${escapeHtml(layer === 'all' ? 'Общая активность' : (layerNames[layer] || layer))}</strong></article>
          <article><span>Всего в стране</span><strong>${fmt(total)}</strong></article>
          <article><span>Городов / точек</span><strong>${fmt(points.length)}</strong></article>
        </div>
      </div>
      <div class="country-drilldown-map-wrap">
        <span class="country-drilldown-section-eyeline">${escapeHtml((meta?.growthEyeline || `${layerNames[layer] || layer} · Страна`).toUpperCase())}</span>
        <span class="country-drilldown-section-title">Карта активности внутри страны</span>
        <span class="country-drilldown-section-note">${escapeHtml(mapNote)}</span>
        <div class="country-drilldown-map">${pointMarkup(points, layer)}</div>
        <div class="country-drilldown-legend"><span>Слой: <b>${escapeHtml(layerNames[layer] || layer)}</b></span><span>LIVE точек: <b>${fmt(liveCount)}</b></span><span>Источник: <b>${escapeHtml(sourceNames[layer] || 'активность')}</b></span></div>
      </div>
      <div class="country-drilldown-list-wrap">
        <span class="country-drilldown-section-eyeline">${escapeHtml((meta?.monthlyEyeline || `${layerNames[layer] || layer} · Список`).toUpperCase())}</span>
        <span class="country-drilldown-section-title">${escapeHtml(listTitle)}</span>
        <span class="country-drilldown-section-note">${escapeHtml(listNote)}</span>
        ${cityListMarkup(points, layer, country)}
      </div>`;
    panel.querySelector('#countryDrilldownBackR338')?.addEventListener('click', event => {
      event.preventDefault();
      try { runtime.clearSelection?.(); } catch (_) {}
      window.dispatchEvent(new CustomEvent('andrik:country-focus-changed', { detail: { focused: false, country: '' } }));
      setTimeout(() => {
        document.querySelectorAll('.world-country-button.is-selected,[aria-pressed="true"],.world-map-dot.is-selected').forEach(node => {
          node.classList.remove('is-selected');
          if (node.hasAttribute('aria-pressed')) node.setAttribute('aria-pressed', 'false');
        });
        map.classList.remove('is-country-focused');
        delete map.dataset.focusCountry;
        render();
      }, 30);
    }, { once: true });
    panel.hidden = false;
    panel.classList.add('is-visible');
    pane?.classList.add('is-country-expanded');
  }

  window.addEventListener('andrik:country-focus-changed', () => requestAnimationFrame(render));
  window.addEventListener('andrik:ecosystem-layer-changed', () => requestAnimationFrame(render));
  window.addEventListener('andrik:audience-data', () => setTimeout(render, 90));
  window.addEventListener('andrik:google-analytics-data', () => setTimeout(render, 90));
  window.addEventListener('pageshow', () => setTimeout(render, 120), { passive: true });
  new MutationObserver(() => requestAnimationFrame(render)).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
  setTimeout(render, 350);
})();
