/* ANDRIK R337 — country activity list follows the active ecosystem map layer. */
(() => {
  'use strict';
  if (window.__ANDRIK_COUNTRY_ACTIVITY_R337__) return;
  window.__ANDRIK_COUNTRY_ACTIVITY_R337__ = true;

  const list = document.getElementById('worldCountries');
  const toggle = document.getElementById('countryGrowthToggle');
  const panel = document.getElementById('countryGrowthPanel');
  const close = document.getElementById('countryGrowthClose');
  const target = document.getElementById('countryGrowthList');
  const viewport = document.getElementById('analyticsSwipeViewport');
  const mapPane = document.querySelector('.analytics-map-pane');
  if (!list || !toggle || !panel || !target) return;

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const CACHE_KEY = 'andrik-country-growth-v54-75';
  const FALLBACK_KEYS = ['andrik-country-growth-v54-75','andrik-country-growth-v54-74','andrik-country-growth-v54-73','andrik-country-growth-v54-69'];
  const layerData = new Map();
  let active = String(window.__andrikEcosystemActiveLayer || 'youtube');
  let request = null;
  let lastActivationAt = -Infinity;

  const fmt = value => new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
  const flag = code => /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map(char => 127397 + char.charCodeAt(0))) : '🌍';
  const readKey = () => { try { return localStorage.getItem(KEY_LOCAL) || sessionStorage.getItem(KEY_SESSION) || ''; } catch (_) { return ''; } };
  const metaFor = layer => window.__andrikEcosystemLayerMeta?.(layer) || ({
    growthEyeline:'YOUTUBE · ПОСЛЕДНИЕ 7 ДНЕЙ',growthTitle:'Топ стран по просмотрам YouTube',growthSubtitle:'Сравнение с предыдущими 7 днями',growthButtonTitle:'Рост стран YouTube за 7 дней'
  });
  const countryName = code => {
    const runtime = window.__andrikWorldMapRuntime;
    if (runtime?.translateCountry) return runtime.translateCountry(code) || code;
    const escaped = window.CSS?.escape ? CSS.escape(code) : code.replace(/[^A-Z0-9_-]/g,'');
    return list.querySelector(`.world-country-button[data-code="${escaped}"] .world-country-marquee`)?.textContent?.trim() || code;
  };
  const normalize = rows => (Array.isArray(rows)?rows:[]).map(item=>({
    country:String(item?.country || item?.code || '').trim().toUpperCase(),
    value:Math.max(0,Number(item?.value ?? item?.views ?? item?.activeUsers ?? 0))
  })).filter(item=>item.country);
  const mapRows = rows => new Map(normalize(rows).map(item=>[item.country,item.value]));
  const stateFor = layer => layerData.get(layer) || {weekly:new Map(),previous:new Map(),loaded:false};
  const setLayerData = (layer,weekly,previous,loaded=true) => {
    layerData.set(layer,{weekly:mapRows(weekly),previous:mapRows(previous),loaded});
  };
  const comparison = (now,before,hasPrevious) => {
    if (!hasPrevious || now === before) return {state:'is-flat',arrow:hasPrevious?'•':'•'};
    return now > before ? {state:'is-positive',arrow:'▲'} : {state:'is-negative',arrow:'▼'};
  };

  function updateHeading(){
    const meta = metaFor(active);
    const head = panel.querySelector('.country-growth-head > div');
    const eyebrow = head?.querySelector('span');
    const title = head?.querySelector('strong');
    if (eyebrow) eyebrow.textContent = meta.growthEyeline;
    if (title) title.textContent = meta.growthTitle;
    panel.dataset.ecosystemLayer = active;
    toggle.textContent = `📈 ${meta.growthButtonTitle}`;
    const fab = document.getElementById('mapGrowthFabR237');
    if (fab) { fab.title = meta.growthButtonTitle; fab.setAttribute('aria-label',meta.growthButtonTitle); }
  }

  function render(){
    updateHeading();
    const state = stateFor(active);
    const rows = [...state.weekly.entries()].map(([code,value])=>({
      code,value:Number(value||0),previous:Number(state.previous.get(code)||0),hasPrevious:state.previous.has(code)
    })).filter(row=>row.code && row.value>0).sort((a,b)=>b.value-a.value).slice(0,31);
    if (!rows.length) {
      const meta = metaFor(active);
      const message = active === 'youtube'
        ? 'Недельная сводка YouTube ещё не создана Центральным Cron.'
        : active === 'push'
          ? 'Новые push-подписки по странам появятся здесь после накопления событий.'
          : `Для слоя «${meta.growthTitle.replace(/^Топ стран по\s*/i,'')}» недельные данные начнут накапливаться после установки R337.`;
      target.innerHTML = `<span class="country-growth-loading">${message}</span>`;
      return;
    }
    const max = Math.max(1,...rows.map(row=>row.value));
    target.innerHTML = rows.map((row,index)=>{
      const cmp = comparison(row.value,row.previous,row.hasPrevious);
      const previousText = row.hasPrevious ? `${cmp.arrow} ${fmt(row.previous)} за предыдущие 7 дней` : 'нет данных за предыдущие 7 дней';
      return `<article class="country-growth-row" data-layer="${active}"><span class="country-growth-rank">${index+1}</span><div class="country-growth-copy"><div class="country-growth-name"><span>${flag(row.code)}</span><span>${countryName(row.code)}</span></div><div class="country-growth-bar"><i style="width:${Math.max(4,row.value/max*100).toFixed(1)}%"></i></div></div><strong class="country-growth-value">+${fmt(row.value)}<small class="${cmp.state}">${previousText}</small></strong></article>`;
    }).join('');
  }

  function syncButtons(){
    const state = stateFor(active);
    list.querySelectorAll('.world-country-button[data-code]').forEach(button=>{
      let badge=button.querySelector('.country-weekly-gain');
      if (!badge) { badge=document.createElement('small'); badge.className='country-weekly-gain'; button.appendChild(badge); }
      const code=String(button.dataset.code||'').toUpperCase();
      const hasNow=state.weekly.has(code),hasBefore=state.previous.has(code),known=hasNow||hasBefore;
      if (!known) { badge.hidden=true; return; }
      const now=Number(state.weekly.get(code)||0),before=Number(state.previous.get(code)||0);
      const cmp=comparison(now,before,hasBefore);
      const currentText=`+${fmt(now)} за 7 дней`;
      const previousText=hasBefore?`${cmp.arrow} ${fmt(before)} за предыдущие 7 дней`:'нет данных за предыдущие 7 дней';
      badge.hidden=false;
      badge.dataset.ecosystemLayer=active;
      badge.innerHTML=`<span class="country-weekly-current ${known?'is-positive':'is-flat'}">${currentText}</span><span class="country-weekly-compare ${cmp.state}"><span class="country-weekly-marquee-track"><span>${previousText}</span></span></span>`;
    });
  }
  const scheduleSync = () => { requestAnimationFrame(()=>setTimeout(syncButtons,0)); };

  function detachPanel(){
    document.querySelectorAll('.country-growth-summary-shortcut').forEach(node=>node.remove());
    if (panel.dataset.detached==='true') return;
    try { document.body.appendChild(panel); panel.dataset.detached='true'; } catch (_) {}
  }
  function isOpen(){ return !panel.hidden && panel.getAttribute('aria-hidden')!=='true'; }
  function setOpen(open){
    const focused=Boolean(list.querySelector('.world-country-button.is-selected'));
    if (open && focused) open=false;
    detachPanel();
    panel.hidden=!open;
    panel.setAttribute('aria-hidden',open?'false':'true');
    toggle.setAttribute('aria-expanded',String(open));
    viewport?.classList.toggle('is-growth-open',open);
    mapPane?.classList.toggle('is-growth-open',open);
    document.body.classList.toggle('is-country-growth-open',open);
    if (open) { panel.scrollTop=0; target.scrollTop=0; render(); scheduleSync(); requestAnimationFrame(()=>{try{panel.focus({preventScroll:true})}catch(_){}}); }
  }

  function readCachedYoutube(){
    try {
      const raw=localStorage.getItem(CACHE_KEY)||FALLBACK_KEYS.map(key=>localStorage.getItem(key)).find(Boolean)||'null';
      const cached=JSON.parse(raw);
      return cached?.data || cached || null;
    } catch (_) { return null; }
  }
  function ingestYoutube(data,origin='unknown'){
    const source=data?.weeklyCountries?data:data?.youtube?.studio?.weeklyCountries?data.youtube.studio:data?.youtube?.weeklyCountries?data.youtube:data?.data?.weeklyCountries?data.data:{};
    const weekly=normalize(source.weeklyCountries),previous=normalize(source.previousWeekCountries);
    if (!weekly.length && !previous.length) return false;
    setLayerData('youtube',weekly,previous,true);
    const detail={weeklyCountries:weekly.map(x=>({country:x.country,views:x.value})),previousWeekCountries:previous.map(x=>({country:x.country,views:x.value})),source:origin,loadedAt:Date.now()};
    window.__andrikLatestCountryGrowth=detail;
    window.dispatchEvent(new CustomEvent('andrik:country-growth-data',{detail}));
    if (active==='youtube') { render(); scheduleSync(); }
    return true;
  }
  async function loadYoutube(force=false){
    const cached=readCachedYoutube();
    if (!force && cached && ingestYoutube(cached,'cache')) return true;
    if (request && !force) return request;
    const key=readKey();
    if (!key) return false;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    request=fetch('/api/control/country-growth?refresh=1&v=55.00-r337',{headers:{accept:'application/json',authorization:`Bearer ${key}`},cache:'no-store',signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw new Error(data.details||data.error||`HTTP ${response.status}`);try{localStorage.setItem(CACHE_KEY,JSON.stringify({data,savedAt:Date.now()}))}catch(_){};ingestYoutube(data,'network');return true;})
      .catch(()=>false).finally(()=>{clearTimeout(timer);request=null;});
    return request;
  }

  function ingestLayerDetail(detail){
    const layer=String(detail?.layer||'youtube');
    active=layer;
    if (Array.isArray(detail?.weekly) || Array.isArray(detail?.previous)) setLayerData(layer,detail.weekly||[],detail.previous||[],true);
    updateHeading();
    if (isOpen()) render();
    scheduleSync();
  }

  const activate = event => {
    const now=performance.now();
    if (now-lastActivationAt<650) { event?.preventDefault?.();event?.stopImmediatePropagation?.();event?.stopPropagation?.();return; }
    lastActivationAt=now;
    event?.preventDefault?.();event?.stopImmediatePropagation?.();event?.stopPropagation?.();
    setOpen(!isOpen());
  };

  detachPanel();
  panel.tabIndex=-1;
  updateHeading();
  window.__andrikToggleCountryGrowth = event => { activate(event); return false; };
  close?.addEventListener('click',event=>{event.preventDefault();setOpen(false)});
  const captureActivation=event=>{if(event.target?.closest?.('#countryGrowthToggle'))activate(event)};
  document.addEventListener('pointerup',captureActivation,true);
  document.addEventListener('click',captureActivation,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen())setOpen(false)});
  window.addEventListener('andrik:ecosystem-layer-changed',event=>ingestLayerDetail(event.detail||{}));
  window.addEventListener('andrik:country-focus-changed',event=>{if(event.detail?.focused)setOpen(false);scheduleSync()});
  window.addEventListener('pageshow',()=>{detachPanel();updateHeading();scheduleSync();void loadYoutube(false)},{passive:true});
  new MutationObserver(scheduleSync).observe(list,{childList:true,subtree:true});

  const cached=readCachedYoutube();
  if (cached) ingestYoutube(cached,'cache');
  if (window.__andrikEcosystemLayerDetail) ingestLayerDetail(window.__andrikEcosystemLayerDetail);
  setTimeout(()=>void loadYoutube(false),350);
  setTimeout(scheduleSync,700);
})();
