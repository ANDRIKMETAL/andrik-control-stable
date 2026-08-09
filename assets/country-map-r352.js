/* ANDRIK R352 — second tap opens the standalone country silhouette. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_MAP_R352__) return;
  window.__ANDRIK_COUNTRY_MAP_R352__ = true;

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
  const selectedCode = () => {
    const direct = String(selectedButton()?.dataset?.code || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(direct)) return direct;
    const country = String(selectedCountry() || '').trim().toLowerCase();
    const shapes = window.__ANDRIK_COUNTRY_SHAPES_R341__ || {};
    const extra = {
      'россия':'RU','russia':'RU','russian federation':'RU',
      'украина':'UA','ukraine':'UA',
      'индонезия':'ID','indonesia':'ID',
      'австрия':'AT','austria':'AT',
      'словакия':'SK','slovakia':'SK',
      'чехия':'CZ','czechia':'CZ','czech republic':'CZ'
    };
    if (extra[country]) return extra[country];
    for (const [code, shape] of Object.entries(shapes)) {
      const en = String(shape?.name || '').trim().toLowerCase();
      const ru = translate(shape?.name || '').trim().toLowerCase();
      if (country && (country === en || country === ru)) return code;
    }
    return '';
  };
  const isDeep = () => document.body.classList.contains('is-country-deep-active') || map.dataset.countryDeep === 'true' || runtime.isDeep?.() === true;

  let savedTotal = '';
  let savedPeriod = '';
  let transitionTimer = 0;
  let returningToWorld = false;

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
      const city = String(point?.city || '').trim();
      const region = String(point?.region || '').trim();
      const label = city || region || 'Город / регион';
      const key = `${label}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
      const prev = merged.get(key) || {lat, lon, value:0, city, region, label};
      prev.value += Math.max(0, Number(point?.value || 0));
      if (!prev.city && city) prev.city = city;
      if (!prev.region && region) prev.region = region;
      if (!prev.label || prev.label === 'Город / регион') prev.label = label;
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
    let overlay = stage.querySelector('.country-map-r352');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'country-map-r352';
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
  function finishWorldReturn(){
    clearTimeout(transitionTimer);
    transitionTimer = 0;
    const overlay = map.querySelector('.country-map-r352');
    overlay?.classList.remove('is-leaving');
    document.body.classList.remove('is-country-returning','is-country-entering');
    returningToWorld = false;
    if (typeof runtime.goWorld === 'function') runtime.goWorld();
    else {
      try { runtime.clearSelection?.(); } catch (_) {}
      document.body.classList.remove('is-country-deep-active','is-country-focus-active');
      delete map.dataset.countryDeep;
      delete map.dataset.focusCountry;
      map.classList.remove('is-country-focused');
      restoreOverviewLabels();
      window.dispatchEvent(new CustomEvent('andrik:country-focus-changed',{detail:{focused:false,country:''}}));
    }
  }
  function clearToWorld(){
    if (returningToWorld) return;
    returningToWorld = true;
    const overlay = map.querySelector('.country-map-r352');
    document.body.classList.remove('is-country-entering');
    document.body.classList.add('is-country-returning');
    overlay?.classList.add('is-leaving');
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(finishWorldReturn, 135);
  }
  function startCountryEnter(){
    returningToWorld = false;
    document.body.classList.remove('is-country-returning');
    document.body.classList.add('is-country-entering');
    clearTimeout(transitionTimer);
    transitionTimer = setTimeout(()=>{
      document.body.classList.remove('is-country-entering');
      transitionTimer = 0;
    }, 170);
  }
  function renderCountryMap() {
    if (!isDeep()) {
      const overlay = map.querySelector('.country-map-r352');
      if (!overlay) { restoreOverviewLabels(); return; }
      overlay.innerHTML = '';
      overlay.removeAttribute('data-layer');
      overlay.removeAttribute('data-code');
      overlay.removeAttribute('data-signature');
      restoreOverviewLabels();
      return;
    }
    const overlay = ensureOverlay();
    if (!overlay) return;
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
    overlay.dataset.code = code;
    const signature = JSON.stringify([code,layer,weekly,total,points.map(p=>[p.lat,p.lon,p.value,p.label||p.city||p.region||''])]);
    if (overlay.dataset.signature !== signature) {
      let svg='';
      if (shape?.path) {
        const max = Math.max(1, ...points.map(p => p.value || 0));
        let dots = points.map((point,index) => {
          const [x,y] = projectPoint(shape, point.lon, point.lat);
          if (!(x >= 0 && x <= 1000 && y >= 0 && y <= 600)) return '';
          const r = 7 + Math.round((Math.max(0,point.value)/max)*8);
          const rawLabel = String(point.label || point.city || point.region || '').trim();
          const label = esc(rawLabel || 'Город / регион');
          const valueNumber = Math.max(0, Number(point.value || 0));
          const value = fmt(valueNumber);
          return `<g class="country-city-marker-r360" data-city="${label}" data-value="${valueNumber}" data-index="${index}" tabindex="-1" focusable="false" role="button" aria-label="${label}: ${value} включений">
            <circle class="country-city-halo-r360" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r+11).toFixed(1)}"/>
            <circle class="country-point-r352 country-city-point-r360" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>
          </g>`;
        }).join('');
        if (!dots) dots = '<circle class="country-point-halo-r352" cx="500" cy="300" r="48"/><circle class="country-point-r352 is-empty" cx="500" cy="300" r="20"/>';
        const countryViewBox = code === 'RU' ? '45 135 910 330' : '0 0 1000 600';
        svg = `<svg viewBox="${countryViewBox}" role="img" aria-label="Карта страны ${esc(country)}"><path class="country-shape-r352" fill-rule="evenodd" d="${shape.path}"/>${dots}</svg>
          <div class="country-city-stat-r365" hidden aria-live="polite"></div>`;
      } else {
        svg = `<svg viewBox="0 0 1000 600" role="img" aria-label="Карта страны ${esc(country)}"><rect x="90" y="80" width="820" height="440" rx="80" fill="rgba(20,58,78,.55)" stroke="#92dbff" stroke-width="4" stroke-dasharray="12 12"/><circle class="country-point-halo-r352" cx="500" cy="300" r="48"/><circle class="country-point-r352 is-empty" cx="500" cy="300" r="20"/></svg>`;
      }
      overlay.innerHTML = svg;
      overlay.dataset.signature = signature;
      delete overlay.dataset.selectedCity;
    }
    if (totalNode) totalNode.textContent = fmt(total);
    if (period) period.textContent = `${country} · ${layer === 'youtube' ? 'YouTube' : layer === 'site' ? 'Сайт' : layer === 'music' ? 'Music' : layer === 'push' ? 'Push' : 'Вся экосистема'} · активность за 7 дней.`;
  }


  function cityCountWord(value){
    const n=Math.abs(Math.trunc(Number(value||0)));
    const n10=n%10, n100=n%100;
    if(n10===1 && n100!==11) return 'включение';
    if(n10>=2 && n10<=4 && !(n100>=12 && n100<=14)) return 'включения';
    return 'включений';
  }

  const CITY_NAMES_R367 = new Map(Object.entries({
    // Ukraine
    'kyiv':'Киев','kiev':'Киев','київ':'Киев','киев':'Киев',
    'dnipro':'Днепр','dnepr':'Днепр','dnipropetrovsk':'Днепр','дніпро':'Днепр','днепр':'Днепр',
    'odesa':'Одесса','odessa':'Одесса','одеса':'Одесса','одесса':'Одесса',
    'mykolaiv':'Николаев','nikolaev':'Николаев','миколаїв':'Николаев','николаев':'Николаев',
    'donetsk':'Донецк','донецьк':'Донецк','донецк':'Донецк',
    'kharkiv':'Харьков','kharkov':'Харьков','харків':'Харьков','харьков':'Харьков',
    'zaporizhzhia':'Запорожье','zaporozhye':'Запорожье','запоріжжя':'Запорожье','запорожье':'Запорожье',
    'lviv':'Львов','львів':'Львов','львов':'Львов',
    'kherson':'Херсон','херсон':'Херсон',
    'mariupol':'Мариуполь','маріуполь':'Мариуполь','мариуполь':'Мариуполь',
    'kryvyi rih':'Кривой Рог','krivoy rog':'Кривой Рог','кривий ріг':'Кривой Рог','кривой рог':'Кривой Рог',
    // Russia
    'voronezh':'Воронеж','воронеж':'Воронеж',
    'moscow':'Москва','moskva':'Москва','москва':'Москва',
    'saint petersburg':'Санкт-Петербург','st petersburg':'Санкт-Петербург','санкт-петербург':'Санкт-Петербург',
    'rostov-on-don':'Ростов-на-Дону','rostov on don':'Ростов-на-Дону','ростов-на-дону':'Ростов-на-Дону',
    'krasnodar':'Краснодар','краснодар':'Краснодар',
    'volgograd':'Волгоград','волгоград':'Волгоград',
    'kazan':'Казань','казань':'Казань',
    'samara':'Самара','самара':'Самара',
    'yekaterinburg':'Екатеринбург','ekaterinburg':'Екатеринбург','екатеринбург':'Екатеринбург',
    'novosibirsk':'Новосибирск','новосибирск':'Новосибирск',
    // Slovakia
    'kosice':'Кошице','košice':'Кошице','кошице':'Кошице',
    'bratislava':'Братислава','братислава':'Братислава'
  }));

  function displayCityNameR367(raw){
    const original=String(raw||'').trim();
    if(!original) return 'Город / регион';
    const key=original.toLocaleLowerCase('ru').replace(/\s+/g,' ').trim();
    return CITY_NAMES_R367.get(key)||original;
  }

  function flashCityNameR367(marker){
    const overlay=marker?.closest?.('.country-map-r352');
    const svg=overlay?.querySelector('svg');
    const point=marker?.querySelector('.country-city-point-r360');
    if(!overlay||!svg||!point) return;

    svg.querySelectorAll('.country-city-name-flash-r367').forEach(node=>node.remove());

    const city=displayCityNameR367(marker.dataset.city||'');
    let x=Number(point.getAttribute('cx')||0);
    let y=Number(point.getAttribute('cy')||0)-26;

    const vb=svg.viewBox?.baseVal;
    if(vb && vb.width>0 && vb.height>0){
      const padX=Math.min(70,vb.width*.09);
      const padY=Math.min(38,vb.height*.12);
      x=Math.max(vb.x+padX,Math.min(vb.x+vb.width-padX,x));
      y=Math.max(vb.y+padY,Math.min(vb.y+vb.height-padY,y));
    }

    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.classList.add('country-city-name-flash-r367');
    text.setAttribute('x',x.toFixed(1));
    text.setAttribute('y',y.toFixed(1));
    text.setAttribute('text-anchor','middle');
    text.setAttribute('dominant-baseline','central');
    text.textContent=city;
    svg.appendChild(text);

    requestAnimationFrame(()=>text.classList.add('is-visible-r367'));
    clearTimeout(overlay.__cityNameHideR367);
    overlay.__cityNameHideR367=setTimeout(()=>{
      text.classList.remove('is-visible-r367');
      text.classList.add('is-hiding-r367');
      setTimeout(()=>text.remove(),420);
    },2400);
  }
  function selectCityMarker(marker){
    if(!marker) return;
    const overlay=marker.closest('.country-map-r352');
    if(!overlay) return;
    overlay.querySelectorAll('.country-city-marker-r360.is-city-selected-r365')
      .forEach(node=>node.classList.remove('is-city-selected-r365'));
    marker.classList.add('is-city-selected-r365');
    const city=displayCityNameR367(marker.dataset.city||'Город / регион');
    const value=Math.max(0,Number(marker.dataset.value||0));
    const panel=overlay.querySelector('.country-city-stat-r365');
    if(panel){
      panel.textContent=`${city} · ${fmt(value)} ${cityCountWord(value)}`;
      panel.hidden=false;
    }
    overlay.dataset.selectedCity=city;
    overlay.querySelectorAll('.country-city-name-flash-r367').forEach(node=>node.remove());
    clearTimeout(overlay.__cityStatHideR368);
    clearTimeout(overlay.__cityStatRemoveR368);
    if(panel){
      panel.classList.remove('is-hiding-r368');
      panel.classList.add('is-visible-r368');
      overlay.__cityStatHideR368=setTimeout(()=>{
        panel.classList.remove('is-visible-r368');
        panel.classList.add('is-hiding-r368');
        overlay.__cityStatRemoveR368=setTimeout(()=>{
          panel.hidden=true;
          panel.classList.remove('is-hiding-r368');
        },360);
      },3000);
    }
  }
  map.addEventListener('click',event=>{
    const marker=event.target?.closest?.('.country-city-marker-r360');
    if(!marker || !map.contains(marker)) return;
    event.preventDefault();
    event.stopPropagation();
    selectCityMarker(marker);
  },true);
  map.addEventListener('keydown',event=>{
    if(event.key!=='Enter' && event.key!==' ') return;
    const marker=event.target?.closest?.('.country-city-marker-r360');
    if(!marker || !map.contains(marker)) return;
    event.preventDefault();
    event.stopPropagation();
    selectCityMarker(marker);
  },true);

  function closeGrowthOverlays(){
    const panel = document.getElementById('countryGrowthPanel');
    const toggle = document.getElementById('countryGrowthToggle');
    const viewport = document.getElementById('analyticsSwipeViewport');
    const pane = document.querySelector('.analytics-map-pane');
    if (panel && !panel.hidden) panel.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded','false');
    document.body.classList.remove('is-country-growth-open');
    document.documentElement.classList.remove('is-country-growth-open');
    viewport?.classList.remove('is-growth-open');
    pane?.classList.remove('is-growth-open');
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
  function sync(){ closeGrowthOverlays(); ensureActionsVisible(); requestAnimationFrame(renderCountryMap); }

  window.addEventListener('andrik:country-deep-changed',event=>{
    if (event?.detail?.active) startCountryEnter();
    else {
      document.body.classList.remove('is-country-entering','is-country-returning');
      returningToWorld = false;
    }
    sync();
  });
  window.addEventListener('andrik:country-focus-changed',sync);
  window.addEventListener('andrik:ecosystem-layer-changed',sync);
  const syncIfDeep=()=>{ if(isDeep()) sync(); };
  window.addEventListener('andrik:country-growth-data',syncIfDeep);
  window.addEventListener('andrik:audience-data',syncIfDeep);
  window.addEventListener('pageshow',()=>setTimeout(sync,80),{passive:true});
  setTimeout(sync,250);
})();
