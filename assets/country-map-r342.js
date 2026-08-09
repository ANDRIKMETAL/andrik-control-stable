/* ANDRIK R342 — second tap opens the standalone country silhouette. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_MAP_R342__) return;
  window.__ANDRIK_COUNTRY_MAP_R342__ = true;

  const map = document.getElementById('worldMap');
  const list = document.getElementById('worldCountries');
  if (!map || !list) return;
  const runtime = window.__andrikWorldMapRuntime || {};
  const fmt = value => new Intl.NumberFormat('ru-RU').format(Math.max(0, Number(value || 0)));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const translate = value => runtime.translateCountry ? runtime.translateCountry(value) : String(value || '');
  const flag = code => {
    const upper = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(upper)) return '🌍';
    return String.fromCodePoint(...[...upper].map(ch => 127397 + ch.charCodeAt(0)));
  };
  const activeLayer = () => String(window.__andrikEcosystemActiveLayer || map.dataset.ecosystemLayer || 'youtube');
  const state = () => { try { return window.andrikEcosystemMap?.state?.() || null; } catch (_) { return null; } };
  const selectedButton = () => list.querySelector('.world-country-button.is-selected,.world-country-selected-card.is-selected,[aria-pressed="true"]');
  const selectedCountry = () => String(runtime.getSelection?.() || map.dataset.focusCountry || '').trim();
  const selectedCode = () => String(selectedButton()?.dataset?.code || '').trim().toUpperCase();
  const isDeep = () => document.body.classList.contains('is-country-deep-active') || map.dataset.countryDeep === 'true' || runtime.isDeep?.() === true;

  let savedTotal = '';
  let savedPeriod = '';

  function layerRows(s, layer) {
    if (!s) return [];
    return Array.isArray(s[layer]?.rows) ? s[layer].rows : [];
  }
  function countryTotal(country, layer) {
    const s = state();
    if (!s || !country) return 0;
    if (layer === 'all') {
      const b = s.breakdown instanceof Map ? s.breakdown.get(country) : null;
      return Math.max(0, Number(b?.youtube || 0) + Number(b?.site || 0) + Number(b?.music || 0) + Number(b?.push || 0));
    }
    return layerRows(s, layer).filter(row => translate(row?.country || row?.name || '') === country)
      .reduce((sum, row) => sum + Math.max(0, Number(row?.value ?? row?.views ?? row?.activeUsers ?? 0)), 0);
  }
  function weeklyValue(code, layer) {
    const detail = window.__andrikEcosystemLayerDetail;
    if (!detail || String(detail.layer || '') !== layer) return 0;
    const row = (detail.weekly || []).find(item => String(item?.country || '').toUpperCase() === code);
    return Math.max(0, Number(row?.value || 0));
  }
  function pointsFor(country, layer) {
    const s = state();
    if (!s || !country || layer === 'youtube') return [];
    let points = [];
    if (layer === 'all') points = [...(s.site?.points || []), ...(s.music?.points || []), ...(s.push?.points || [])];
    else points = [...(s[layer]?.points || [])];
    const merged = new Map();
    for (const point of points) {
      if (translate(point?.country || point?.code || '') !== country) continue;
      const lat = Number(point?.latitude), lon = Number(point?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const key = `${String(point?.city || point?.region || '').trim()}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
      const prev = merged.get(key) || {lat, lon, value:0};
      prev.value += Math.max(0, Number(point?.value || 0));
      merged.set(key, prev);
    }
    return [...merged.values()].sort((a,b) => b.value - a.value).slice(0, 30);
  }
  function projectPoint(shape, lon, lat) {
    let [minx,miny,maxx,maxy] = shape.bbox || [-180,-90,180,90];
    if (shape.shifted && lon < 0) lon += 360;
    const dx = Math.max(1e-9, maxx - minx), dy = Math.max(1e-9, maxy - miny);
    const scale = Math.min(1000/dx, 600/dy) * .88;
    const ox = (1000 - dx*scale)/2, oy = (600 - dy*scale)/2;
    return [ox + (lon-minx)*scale, 600 - (oy + (lat-miny)*scale)];
  }
  function ensureOverlay() {
    const stage = map.querySelector('.world-map-stage');
    if (!stage) return null;
    let overlay = stage.querySelector('.country-map-r342');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'country-map-r342';
      stage.appendChild(overlay);
    }
    return overlay;
  }
  function restoreOverviewLabels(){
    const totalNode = document.getElementById('worldMapTotalValue');
    const period = document.getElementById('worldMapPeriodR246');
    if (savedTotal && totalNode) totalNode.textContent = savedTotal;
    if (savedPeriod && period) period.textContent = savedPeriod;
    savedTotal=''; savedPeriod='';
  }
  function clearToWorld(){
    try { runtime.clearSelection?.(); } catch (_) {}
    document.body.classList.remove('is-country-deep-active','is-country-focus-active');
    delete map.dataset.countryDeep;
    delete map.dataset.focusCountry;
    map.classList.remove('is-country-focused');
    restoreOverviewLabels();
    window.dispatchEvent(new CustomEvent('andrik:country-focus-changed',{detail:{focused:false,country:''}}));
    try { window.andrikEcosystemMap?.setLayer?.(activeLayer()); } catch (_) {}
  }
  function renderCountryMap() {
    const overlay = ensureOverlay();
    if (!overlay) return;
    if (!isDeep()) {
      overlay.innerHTML = '';
      overlay.removeAttribute('data-layer');
      overlay.removeAttribute('data-signature');
      restoreOverviewLabels();
      return;
    }
    const country = selectedCountry();
    const code = selectedCode();
    const layer = activeLayer();
    if (!country || !code) return;

    const totalNode = document.getElementById('worldMapTotalValue');
    const period = document.getElementById('worldMapPeriodR246');
    if (!savedTotal && totalNode) savedTotal = totalNode.textContent || '';
    if (!savedPeriod && period) savedPeriod = period.textContent || '';

    const shapes = window.__ANDRIK_COUNTRY_SHAPES_R341__ || {};
    const shape = shapes[code];
    const weekly = weeklyValue(code, layer);
    const total = countryTotal(country, layer);
    const points = pointsFor(country, layer);
    overlay.dataset.layer = layer;
    const signature = JSON.stringify([code,layer,weekly,total,points.map(p=>[p.lat,p.lon,p.value])]);
    if (overlay.dataset.signature !== signature) {
      let svg='';
      if (shape?.path) {
        const max = Math.max(1, ...points.map(p => p.value || 0));
        let dots = points.map(point => {
          const [x,y] = projectPoint(shape, point.lon, point.lat);
          if (!(x >= 0 && x <= 1000 && y >= 0 && y <= 600)) return '';
          const r = 6 + Math.round((Math.max(0,point.value)/max)*8);
          return `<circle class="country-point-r342" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;
        }).join('');
        if (!dots) dots = '<circle class="country-point-r342 is-empty" cx="500" cy="300" r="12"/>';
        svg = `<svg viewBox="0 0 1000 600" role="img" aria-label="Карта страны ${esc(country)}"><path class="country-shape-r342" fill-rule="evenodd" d="${shape.path}"/>${dots}</svg>`;
      } else {
        svg = `<svg viewBox="0 0 1000 600" role="img" aria-label="Карта страны ${esc(country)}"><rect x="90" y="80" width="820" height="440" rx="80" fill="rgba(20,58,78,.55)" stroke="#92dbff" stroke-width="4" stroke-dasharray="12 12"/><circle class="country-point-r342 is-empty" cx="500" cy="300" r="12"/></svg>`;
      }
      overlay.innerHTML = `${svg}<button class="country-map-label-r342" type="button" aria-label="Вернуться к мировой карте">← Мир · ${flag(code)} ${esc(country)}</button><span class="country-map-week-r342">+${fmt(weekly)} · 7 дней</span>${points.length ? '' : '<span class="country-map-empty-label-r342">пока без городских точек</span>'}`;
      overlay.querySelector('.country-map-label-r342')?.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();clearToWorld()},{once:true});
      overlay.dataset.signature = signature;
    }
    if (totalNode) totalNode.textContent = fmt(total);
    if (period) period.textContent = `${country} · ${layer === 'youtube' ? 'YouTube' : layer === 'site' ? 'Сайт' : layer === 'music' ? 'Music' : layer === 'push' ? 'Push' : 'Вся экосистема'} · активность за 7 дней.`;
  }
  function ensureActionsVisible(){
    if (!selectedCountry()) return;
    const actions = document.getElementById('mapFocusActions');
    if (actions) {
      actions.hidden=false;
      actions.setAttribute('aria-hidden','false');
      actions.classList.add('is-visible');
    }
  }
  function sync(){ ensureActionsVisible(); requestAnimationFrame(renderCountryMap); }

  window.addEventListener('andrik:country-deep-changed',sync);
  window.addEventListener('andrik:country-focus-changed',sync);
  window.addEventListener('andrik:ecosystem-layer-changed',sync);
  window.addEventListener('andrik:country-growth-data',sync);
  window.addEventListener('andrik:audience-data',sync);
  window.addEventListener('pageshow',()=>setTimeout(sync,80),{passive:true});
  setTimeout(sync,250);
})();
