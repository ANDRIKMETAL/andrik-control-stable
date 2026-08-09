/* ANDRIK R347 — default ALL ecosystem map on every analytics opening. */
(() => {
  'use strict';
  if (window.__ANDRIK_ECOSYSTEM_MAP_R347__) return;
  window.__ANDRIK_ECOSYSTEM_MAP_R347__ = true;

  const runtime = window.__andrikWorldMapRuntime;
  const api = window.__andrikControlApi;
  const map = document.getElementById('worldMap');
  const list = document.getElementById('worldCountries');
  const period = document.getElementById('worldMapPeriodR246');
  if (!runtime || !map || !list) return;

  const state = {
    youtube:{rows:[],points:[],weekly:[],previous:[]},
    site:{rows:[],points:[],weekly:[],previous:[]},
    music:{rows:[],points:[],weekly:[],previous:[]},
    push:{rows:[],points:[],weekly:[],previous:[]},
    all:{rows:[],points:[],weekly:[],previous:[]},
    links:{},
    recent:[],
    breakdown:new Map(),
    loaded:false,
    updatedAt:''
  };
  const LAYER_STORAGE_KEY_R382 = 'andrik-ecosystem-last-layer-r382';
  const VALID_LAYERS_R382 = ['all','site','youtube','music','push'];
  const readSavedLayerR382 = () => {
    try {
      const saved = String(localStorage.getItem(LAYER_STORAGE_KEY_R382) || '').trim().toLowerCase();
      return VALID_LAYERS_R382.includes(saved) ? saved : 'all';
    } catch (_) { return 'all'; }
  };
  const rememberLayerR382 = layer => {
    if (!VALID_LAYERS_R382.includes(layer)) return;
    try { localStorage.setItem(LAYER_STORAGE_KEY_R382, layer); } catch (_) {}
  };

  let active = readSavedLayerR382();
  let requestPromise = null;
  window.__andrikEcosystemActiveLayer = active;

  const fmt = value => new Intl.NumberFormat('ru-RU').format(Number(value || 0));
  const countryName = raw => runtime.translateCountry ? runtime.translateCountry(raw) : String(raw || '');
  const cleanRows = (rows, valueKey='value') => (Array.isArray(rows)?rows:[]).map(row => ({
    ...row,
    country:countryName(row?.country || row?.name || ''),
    value:Number(row?.[valueKey] ?? row?.value ?? row?.views ?? row?.activeUsers ?? 0)
  })).filter(row => row.country && row.value > 0);

  const cleanWeekly = rows => (Array.isArray(rows)?rows:[]).map(row => ({
    country:String(row?.country || row?.code || '').trim().toUpperCase(),
    value:Math.max(0,Number(row?.value ?? row?.views ?? row?.activeUsers ?? 0))
  })).filter(row => row.country);
  const mergeWeekly = groups => {
    const merged = new Map();
    for (const group of groups) for (const row of cleanWeekly(group)) merged.set(row.country,(merged.get(row.country)||0)+row.value);
    return [...merged].map(([country,value])=>({country,value})).sort((a,b)=>b.value-a.value);
  };

  const readCaches = () => {
    try {
      const yt = JSON.parse(localStorage.getItem('andrik-control-youtube-map-v54-24') || 'null');
      if (Array.isArray(yt?.countries)) state.youtube.rows = cleanRows(yt.countries, 'views');
    } catch (_) {}
    try {
      const ga = JSON.parse(localStorage.getItem('andrik-control-ga-cache-v54-06') || 'null')?.google;
      if (Array.isArray(ga?.countries)) state.site.rows = cleanRows(ga.countries, 'activeUsers');
    } catch (_) {}
  };

  const aggregatePoints = groups => {
    const merged = new Map();
    for (const group of groups) {
      for (const point of Array.isArray(group)?group:[]) {
        const lat = Number(point?.latitude), lon = Number(point?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const country = countryName(point.country || '');
        const city = String(point.city || point.region || country).trim();
        const key = `${country}|${city}|${lat.toFixed(1)}|${lon.toFixed(1)}`;
        const current = merged.get(key) || {country,city,region:point.region||'',latitude:lat,longitude:lon,value:0};
        current.value += Math.max(0,Number(point.value || 0));
        merged.set(key,current);
      }
    }
    return [...merged.values()].sort((a,b)=>b.value-a.value).slice(0,180);
  };

  const rebuildAll = () => {
    const totals = new Map();
    const breakdown = new Map();
    const add = (name, rows) => {
      for (const row of cleanRows(rows)) {
        const key = row.country;
        totals.set(key,(totals.get(key)||0)+row.value);
        const item = breakdown.get(key) || {youtube:0,site:0,music:0,push:0};
        item[name] = (item[name]||0)+row.value;
        breakdown.set(key,item);
      }
    };
    add('youtube',state.youtube.rows);
    add('site',state.site.rows);
    add('music',state.music.rows);
    add('push',state.push.rows);
    state.all.rows = [...totals].map(([country,value])=>({country,value})).sort((a,b)=>b.value-a.value);
    state.all.points = aggregatePoints([state.site.points,state.music.points,state.push.points]);
    state.all.weekly = mergeWeekly([state.youtube.weekly,state.site.weekly,state.music.weekly,state.push.weekly]);
    state.all.previous = mergeWeekly([state.youtube.previous,state.site.previous,state.music.previous,state.push.previous]);
    state.breakdown = breakdown;
  };

  const layerMeta = layer => {
    const telegram = Number(state.links['telegram-open'] || 0);
    const common = {
      all:{
        periodText:`Вся экосистема ANDRIK · 30 дней + LIVE 60 мин${telegram?` · Telegram ${fmt(telegram)}`:''}.`,metricLabel:'сигналов',totalTitle:'Суммарные сигналы экосистемы',
        growthEyeline:'ВСЯ ЭКОСИСТЕМА · ПОСЛЕДНИЕ 7 ДНЕЙ',growthTitle:'Топ стран по общей активности',growthSubtitle:'Сравнение суммарных сигналов с предыдущими 7 днями',
        monthlyEyeline:'АРХИВ · ВСЯ ЭКОСИСТЕМА',monthlyTitle:'Динамика общей активности',monthlyDescription:'Сохраняется максимальное значение суммарных сигналов, достигнутое в каждом месяце.',monthlyMetric:'сигналов',
        growthButtonTitle:'Активность стран экосистемы за 7 дней',calendarTitle:'График общей активности по месяцам'
      },
      site:{
        periodText:'Сайт ANDRIK · 30 дней · города + LIVE события за 60 минут.',metricLabel:'польз.',totalTitle:'Пользователи сайта за 30 дней',
        growthEyeline:'САЙТ · ПОСЛЕДНИЕ 7 ДНЕЙ',growthTitle:'Топ стран по посещениям сайта',growthSubtitle:'Уникальные посетители по странам · сравнение 7 + 7 дней',
        monthlyEyeline:'АРХИВ · САЙТ',monthlyTitle:'Динамика посещений сайта',monthlyDescription:'Сохраняется максимальное число пользователей карты сайта, достигнутое в каждом месяце.',monthlyMetric:'пользователей',
        growthButtonTitle:'Активность стран сайта за 7 дней',calendarTitle:'График посещений сайта по месяцам'
      },
      youtube:{
        periodText:'YouTube ANDRIK · просмотры по странам за последние 28 дней.',metricLabel:'просм.',totalTitle:'Просмотры YouTube за 28 дней',
        growthEyeline:'YOUTUBE · ПОСЛЕДНИЕ 7 ДНЕЙ',growthTitle:'Топ стран по просмотрам YouTube',growthSubtitle:'Просмотры по странам · сравнение с предыдущими 7 днями',
        monthlyEyeline:'АРХИВ · YOUTUBE',monthlyTitle:'Динамика просмотров YouTube',monthlyDescription:'Сохраняется максимальное значение просмотров карты YouTube, достигнутое в каждом месяце.',monthlyMetric:'просмотров',
        growthButtonTitle:'Рост стран YouTube за 7 дней',calendarTitle:'График просмотров YouTube по месяцам'
      },
      music:{
        periodText:'Музыка ANDRIK · 30 дней · LIVE прослушивания/MP3 за 60 минут.',metricLabel:'действий',totalTitle:'Музыкальные действия за 30 дней',
        growthEyeline:'MUSIC · ПОСЛЕДНИЕ 7 ДНЕЙ',growthTitle:'Топ стран по музыкальной активности',growthSubtitle:'Прослушивания и скачивания MP3 · сравнение 7 + 7 дней',
        monthlyEyeline:'АРХИВ · MUSIC',monthlyTitle:'Динамика музыкальной активности',monthlyDescription:'Сохраняется максимальное число музыкальных действий карты, достигнутое в каждом месяце.',monthlyMetric:'действий',
        growthButtonTitle:'Музыкальная активность стран за 7 дней',calendarTitle:'График музыкальной активности по месяцам'
      },
      push:{
        periodText:'Push ANDRIK · активные подписки с известной географией.',metricLabel:'подписок',totalTitle:'Активные push-подписки с географией',
        growthEyeline:'PUSH · ПОСЛЕДНИЕ 7 ДНЕЙ',growthTitle:'Топ стран по новым push-подпискам',growthSubtitle:'Новые активные подписки · сравнение с предыдущими 7 днями',
        monthlyEyeline:'АРХИВ · PUSH',monthlyTitle:'Динамика push-аудитории',monthlyDescription:'Сохраняется максимальное число активных push-подписок на карте, достигнутое в каждом месяце.',monthlyMetric:'подписок',
        growthButtonTitle:'Новые push-подписки по странам за 7 дней',calendarTitle:'График push-аудитории по месяцам'
      }
    };
    return common[layer] || common.youtube;
  };
  window.__andrikEcosystemLayerMeta = layerMeta;

  const updateButtons = () => {
    map.dataset.ecosystemLayer = active;
    map.querySelectorAll('[data-ecosystem-layer]').forEach(button => {
      if (!button.matches('button')) return;
      const on = button.dataset.ecosystemLayer === active;
      button.classList.toggle('is-active',on);
      button.setAttribute('aria-pressed',on?'true':'false');
    });
  };

  const updateAccessoryLabels = () => {
    const meta = layerMeta(active);
    const growth = document.getElementById('mapGrowthFabR237');
    if (growth) { growth.title = meta.growthButtonTitle; growth.setAttribute('aria-label',meta.growthButtonTitle); }
    const growthText = document.getElementById('countryGrowthToggle');
    if (growthText) growthText.textContent = `📈 ${meta.growthButtonTitle}`;
    const monthly = document.getElementById('mapMonthlyOpen');
    if (monthly) { monthly.title = meta.calendarTitle; monthly.setAttribute('aria-label',meta.calendarTitle); }
  };
  const emitLayerChanged = () => {
    const layer = state[active] || state.youtube;
    const meta = layerMeta(active);
    const total = cleanRows(layer.rows).reduce((sum,row)=>sum+Math.max(0,Number(row.value||0)),0);
    const detail = {layer:active,meta,rows:cleanRows(layer.rows),weekly:cleanWeekly(layer.weekly),previous:cleanWeekly(layer.previous),total,updatedAt:state.updatedAt||new Date().toISOString()};
    window.__andrikEcosystemLayerDetail = detail;
    window.dispatchEvent(new CustomEvent('andrik:ecosystem-layer-changed',{detail}));
  };

  const topCities = (layer,country) => {
    const points = state[layer]?.points || [];
    return points.filter(point=>countryName(point.country)===country)
      .sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,3);
  };

  const liveLabel = type => ({
    visit:'LIVE посещение',
    'music-download':'LIVE MP3',
    'music-listen':'LIVE слушает',
    'telegram-open':'LIVE Telegram',
    'youtube-open':'LIVE YouTube',
    'spotify-open':'LIVE Spotify',
    'apple-music-open':'LIVE Apple Music',
    'soundcloud-open':'LIVE SoundCloud',
    'amazon-music-open':'LIVE Amazon Music'
  }[String(type||'')] || 'LIVE событие');

  const livePointsForLayer = layer => state.recent.filter(item => {
    const type=String(item?.type||'');
    if(layer==='site') return type==='visit';
    if(layer==='music') return type==='music-download'||type==='music-listen';
    if(layer==='all') return true;
    return false;
  }).map(item=>({
    country:item.country||'',region:item.region||'',city:item.city||'',
    latitude:Number(item.latitude),longitude:Number(item.longitude),value:1,
    label:liveLabel(item.type),type:item.type||''
  })).filter(item=>item.country&&Number.isFinite(item.latitude)&&Number.isFinite(item.longitude));

  const decorateCountry = () => {
    const country = runtime.getSelection?.() || '';
    if (!country) return;
    const card = list.querySelector('.world-country-selected-card,.world-country-button.is-selected');
    if (!card) return;
    card.querySelector('.ecosystem-country-detail')?.remove();
    const detail = document.createElement('small');
    detail.className = 'ecosystem-country-detail';
    if (active === 'all') {
      const b = state.breakdown.get(country) || {};
      const cities = topCities('all',country);
      const cityText = cities.length ? ` · ${cities.map(x=>`${x.city||x.region||country} ${fmt(x.value)}`).join(' · ')}` : '';
      detail.innerHTML = `<b>Экосистема:</b> ▶ ${fmt(b.youtube)} · 🌐 ${fmt(b.site)} · ♪ ${fmt(b.music)} · 🔔 ${fmt(b.push)}<span class="is-muted">${cityText}</span>`;
    } else {
      const cities = topCities(active,country);
      if (cities.length) detail.innerHTML = `<b>Города:</b> ${cities.map(x=>`${x.city||x.region||country} ${fmt(x.value)}`).join(' · ')}`;
      else detail.innerHTML = '<span class="is-muted">Детальная география будет накапливаться по новым событиям.</span>';
    }
    card.appendChild(detail);
  };

  const applyLayer = (force=false) => {
    const layer = state[active] || state.youtube;
    const rows = cleanRows(layer.rows);
    const meta = layerMeta(active);
    const selected = runtime.getSelection?.() || '';
    if (selected && rows.length && !rows.some(row=>row.country===selected)) runtime.clearSelection?.();
    if (!rows.length && active !== 'youtube') {
      runtime.render([],{
        source:`ecosystem-${active}`,layer:active,points:layer.points||[],livePoints:livePointsForLayer(active),loading:!state.loaded,
        error:state.loaded?'Данных для этого слоя пока нет. Они начнут появляться после новых событий.':'Загружаем слой экосистемы…',
        ...meta
      });
    } else {
      runtime.render(rows,{source:`ecosystem-${active}`,layer:active,points:layer.points||[],livePoints:livePointsForLayer(active),...meta});
    }
    window.__andrikEcosystemActiveLayer = active;
    updateButtons();
    updateAccessoryLabels();
    emitLayerChanged();
    requestAnimationFrame(()=>requestAnimationFrame(decorateCountry));
    if (force && period) period.dataset.ecosystemUpdated = state.updatedAt || '';
  };

  const setLayer = layer => {
    if (!VALID_LAYERS_R382.includes(layer)) return;
    active = layer;
    rememberLayerR382(active);
    window.__andrikEcosystemActiveLayer = active;
    applyLayer(true);
    if (!state.loaded && layer !== 'youtube') void loadEcosystem();
  };

  const bindButtons = () => {
    map.querySelectorAll('.ecosystem-layer-switcher [data-ecosystem-layer]').forEach(button => {
      if (button.dataset.ecosystemBound === '1') return;
      button.dataset.ecosystemBound = '1';
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();setLayer(button.dataset.ecosystemLayer)});
    });
    updateButtons();
  };

  const ingestAudience = data => {
    const rows = data?.youtube?.studio?.countries || data?.youtube?.countries || [];
    if (Array.isArray(rows) && rows.length) state.youtube.rows = cleanRows(rows,'views');
    rebuildAll();
    if (active === 'youtube' || active === 'all') applyLayer();
  };
  const ingestGoogle = ga => {
    if (Array.isArray(ga?.countries) && ga.countries.length) state.site.rows = cleanRows(ga.countries,'activeUsers');
    rebuildAll();
    if (active === 'site' || active === 'all') applyLayer();
  };

  async function loadEcosystem(force=false){
    if (!api) return null;
    if (requestPromise && !force) return requestPromise;
    const request = api(`/api/control/ecosystem-map${force?'?refresh=1':''}`,10000);
    requestPromise = request;
    try {
      const data = await request;
      state.loaded = true;
      state.updatedAt = data?.updatedAt || '';
      state.links = data?.links || {};
      state.recent = Array.isArray(data?.recent) ? data.recent : [];
      const siteGeo = cleanRows(data?.site?.countries || []);
      if (!state.site.rows.length && siteGeo.length) state.site.rows = siteGeo;
      state.site.points = Array.isArray(data?.site?.points)?data.site.points:[];
      state.site.weekly = cleanWeekly(data?.site?.weeklyCountries || []);
      state.site.previous = cleanWeekly(data?.site?.previousWeekCountries || []);
      state.music.rows = cleanRows(data?.music?.countries || []);
      state.music.points = Array.isArray(data?.music?.points)?data.music.points:[];
      state.music.weekly = cleanWeekly(data?.music?.weeklyCountries || []);
      state.music.previous = cleanWeekly(data?.music?.previousWeekCountries || []);
      state.push.rows = cleanRows(data?.push?.countries || []);
      state.push.points = Array.isArray(data?.push?.points)?data.push.points:[];
      state.push.weekly = cleanWeekly(data?.push?.weeklyCountries || []);
      state.push.previous = cleanWeekly(data?.push?.previousWeekCountries || []);
      rebuildAll();
      if (active !== 'youtube' || force) applyLayer(true);
      return data;
    } catch (_) {
      state.loaded = true;
      if (active !== 'youtube') applyLayer(true);
      return null;
    } finally {
      if (requestPromise === request) requestPromise = null;
    }
  }

  readCaches();
  rebuildAll();
  bindButtons();
  rememberLayerR382(active);
  applyLayer();
  updateAccessoryLabels();
  emitLayerChanged();
  if (window.__andrikLatestAudienceData) ingestAudience(window.__andrikLatestAudienceData);
  if (window.__andrikLatestGoogleAnalytics) ingestGoogle(window.__andrikLatestGoogleAnalytics);
  window.addEventListener('andrik:audience-data',event=>ingestAudience(event.detail||{}));
  window.addEventListener('andrik:google-analytics-data',event=>ingestGoogle(event.detail||{}));
  const ingestYoutubeGrowth = detail => {
    const source = detail?.weeklyCountries ? detail : detail?.data?.weeklyCountries ? detail.data : detail?.youtube?.studio?.weeklyCountries ? detail.youtube.studio : detail?.youtube?.weeklyCountries ? detail.youtube : {};
    state.youtube.weekly = cleanWeekly(source.weeklyCountries || []);
    state.youtube.previous = cleanWeekly(source.previousWeekCountries || []);
    rebuildAll();
    if (active === 'youtube' || active === 'all') emitLayerChanged();
  };
  if (window.__andrikLatestCountryGrowth) ingestYoutubeGrowth(window.__andrikLatestCountryGrowth);
  window.addEventListener('andrik:country-growth-data',event=>ingestYoutubeGrowth(event.detail||{}));
  window.addEventListener('andrik:country-focus-changed',()=>requestAnimationFrame(decorateCountry));
  const openRememberedOverviewR382 = () => {
    // Always return to the WORLD overview, but preserve the user's last map layer.
    active = readSavedLayerR382();
    window.__andrikEcosystemActiveLayer = active;
    try { runtime.clearSelection?.(); } catch (_) {}
    document.body?.classList.remove('is-country-focus-active','is-country-deep-active','is-country-returning');
    map.classList.remove('is-country-focused');
    delete map.dataset.focusCountry;
    delete map.dataset.countryDeep;
    bindButtons();
    applyLayer(true);
    window.dispatchEvent(new CustomEvent('andrik:country-focus-changed',{detail:{focused:false,country:''}}));
    window.dispatchEvent(new CustomEvent('andrik:country-deep-changed',{detail:{deep:false,country:''}}));
    if (!state.loaded && active !== 'youtube') void loadEcosystem();
  };
  window.addEventListener('pageshow',openRememberedOverviewR382,{passive:true});

  // Save once more when the page/app is being hidden. This covers Android PWA/back navigation.
  document.addEventListener('visibilitychange',()=>{
    if (document.visibilityState === 'hidden') rememberLayerR382(active);
  },{passive:true});
  window.addEventListener('pagehide',()=>rememberLayerR382(active),{passive:true});
  new MutationObserver(()=>{bindButtons();if(runtime.getSelection?.())requestAnimationFrame(decorateCountry)}).observe(map,{childList:true,subtree:false});
  void loadEcosystem();

  window.andrikEcosystemMap = { setLayer, refresh:()=>loadEcosystem(true), state:()=>state };
})();
