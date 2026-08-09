/* ANDRIK R337 — independent monthly archive + graph for every ecosystem map layer. */
(() => {
  'use strict';
  if (window.__ANDRIK_MAP_MONTHLY_R337__) return;
  window.__ANDRIK_MAP_MONTHLY_R337__ = true;

  const openButton=document.getElementById('mapMonthlyOpen');
  const modal=document.getElementById('mapMonthlyModal');
  const backdrop=document.getElementById('mapMonthlyBackdrop');
  const closeButton=document.getElementById('mapMonthlyClose');
  const listNode=document.getElementById('mapMonthlyList');
  const chartNode=document.getElementById('mapMonthlyChart');
  const captionNode=document.getElementById('mapMonthlyChartCaption');
  const titleNode=document.getElementById('mapMonthlyTitle');
  if(!openButton||!modal||!listNode||!chartNode)return;

  const STORAGE_KEY='andrik-control-map-monthly-archive-r337';
  const LEGACY_YOUTUBE_KEY='andrik-control-map-monthly-archive-v1';
  const LAYERS=['all','site','youtube','music','push'];
  const KNOWN_YOUTUBE_MAXIMUMS=Object.freeze({'2026-07':16564});
  const numberFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
  const monthFormat=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'});
  const shortMonthFormat=new Intl.DateTimeFormat('ru-RU',{month:'short'});
  let archives=readArchives();
  let activeLayer=String(window.__andrikEcosystemActiveLayer||'youtube');
  let returnFocus=null;

  const metaFor=layer=>window.__andrikEcosystemLayerMeta?.(layer)||({
    monthlyEyeline:'АРХИВ · YOUTUBE',monthlyTitle:'Динамика просмотров YouTube',monthlyDescription:'Сохраняется максимальное значение просмотров карты YouTube, достигнутое в каждом месяце.',monthlyMetric:'просмотров',calendarTitle:'График просмотров YouTube по месяцам'
  });
  const monthKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const dateFromKey=key=>{const [year,month]=String(key).split('-').map(Number);return new Date(year||2026,Math.max(0,(month||1)-1),1)};
  const safeText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const readNumber=text=>{const value=Number(String(text||'').replace(/[^\d-]/g,''));return Number.isFinite(value)?value:0};
  const formatMonth=key=>{const label=monthFormat.format(dateFromKey(key));return label.charAt(0).toUpperCase()+label.slice(1)};
  const formatShortMonth=key=>shortMonthFormat.format(dateFromKey(key)).replace('.','');
  const niceCeiling=value=>{if(value<=0)return 100;const power=Math.pow(10,Math.max(0,Math.floor(Math.log10(value))-1));return Math.ceil(value/power)*power};

  function normalizeArchive(items,layer){
    const known=layer==='youtube'?KNOWN_YOUTUBE_MAXIMUMS:{};
    const normalized=(Array.isArray(items)?items:[]).map(item=>{
      const key=String(item?.key||'');
      const legacy=Math.max(0,Number(item?.maxValue??item?.value)||0);
      const floor=Math.max(0,Number(known[key])||0);
      const value=Math.max(legacy,floor);
      return {key,value,maxValue:value,savedAt:String(item?.maxAt||item?.savedAt||''),maxAt:String(item?.maxAt||item?.savedAt||''),checkedAt:String(item?.checkedAt||item?.savedAt||''),final:Boolean(item?.final)};
    }).filter(item=>/^\d{4}-\d{2}$/.test(item.key)&&item.value>0);
    for(const [key,value] of Object.entries(known))if(!normalized.some(item=>item.key===key)&&value>0)normalized.push({key,value,maxValue:value,savedAt:'',maxAt:'',checkedAt:'',final:false});
    return normalized.sort((a,b)=>a.key.localeCompare(b.key)).slice(-48);
  }

  function readArchives(){
    const empty=Object.fromEntries(LAYERS.map(layer=>[layer,[]]));
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))for(const layer of LAYERS)empty[layer]=normalizeArchive(parsed[layer],layer);
    }catch(_){}
    if(!empty.youtube.length){
      try{const legacy=JSON.parse(localStorage.getItem(LEGACY_YOUTUBE_KEY)||'[]');empty.youtube=normalizeArchive(legacy,'youtube')}catch(_){}
    }
    return empty;
  }
  function writeArchives(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(archives))}catch(_){}}

  function rememberCurrentTotal(total,layer=activeLayer){
    if(!LAYERS.includes(layer))layer='youtube';
    const liveValue=Math.max(0,Number(total)||0);if(!liveValue)return;
    const now=new Date(),nowIso=now.toISOString(),key=monthKey(now),lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    const knownFloor=layer==='youtube'?Math.max(0,Number(KNOWN_YOUTUBE_MAXIMUMS[key])||0):0;
    const candidate=Math.max(liveValue,knownFloor);
    const archive=archives[layer]||(archives[layer]=[]);
    const existing=archive.find(item=>item.key===key);
    if(existing){
      const previousMaximum=Math.max(0,Number(existing.maxValue??existing.value)||0),monthlyMaximum=Math.max(previousMaximum,candidate);
      existing.value=monthlyMaximum;existing.maxValue=monthlyMaximum;existing.checkedAt=nowIso;existing.final=Boolean(existing.final||now.getDate()===lastDay);
      if(monthlyMaximum>previousMaximum||!existing.maxAt){existing.maxAt=nowIso;existing.savedAt=nowIso}
    }else archive.push({key,value:candidate,maxValue:candidate,savedAt:nowIso,maxAt:nowIso,checkedAt:nowIso,final:now.getDate()===lastDay});
    archives[layer]=archive.sort((a,b)=>a.key.localeCompare(b.key)).slice(-48);writeArchives();
    if(!modal.hidden&&layer===activeLayer)render();
  }

  function updateHeading(){
    const meta=metaFor(activeLayer);
    const heading=titleNode?.parentElement;
    const eyebrow=heading?.querySelector('span');
    const description=heading?.querySelector('p');
    if(eyebrow)eyebrow.textContent=meta.monthlyEyeline;
    if(titleNode)titleNode.textContent=meta.monthlyTitle;
    if(description)description.textContent=meta.monthlyDescription;
    openButton.title=meta.calendarTitle;openButton.setAttribute('aria-label',meta.calendarTitle);
    modal.dataset.ecosystemLayer=activeLayer;
  }

  function renderList(entries){
    const currentKey=monthKey(),meta=metaFor(activeLayer);
    if(!entries.length){listNode.innerHTML=`<div class="map-monthly-empty">Первый месячный снимок «${safeText(meta.monthlyTitle)}» появится после загрузки этого слоя карты.</div>`;return}
    listNode.innerHTML=[...entries].reverse().map(item=>{
      const current=item.key===currentKey,saved=item.maxAt?new Date(item.maxAt):item.savedAt?new Date(item.savedAt):null;
      const status=current?'Максимум месяца · обновляется автоматически':item.final?'Максимум за месяц · зафиксирован':saved&&!Number.isNaN(saved.getTime())?`Максимум месяца · ${saved.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})}`:'Максимум месяца';
      return `<article class="map-month-row${current?' is-current':''}"><i class="map-month-dot" aria-hidden="true"></i><div class="map-month-copy"><strong>${safeText(formatMonth(item.key))}</strong><small>${safeText(status)}</small></div><b class="map-month-value">${safeText(numberFormat.format(item.value))}</b></article>`;
    }).join('');
  }
  function renderChart(entries){
    const meta=metaFor(activeLayer);
    const chartHead=chartNode.closest('.map-monthly-chart-card')?.querySelector('.map-monthly-chart-head span');
    if(chartHead)chartHead.textContent=`ДИНАМИКА · ${String(activeLayer).toUpperCase()}`;
    if(!entries.length){chartNode.innerHTML='<div class="map-monthly-empty">График начнётся с первого сохранённого месяца.</div>';chartNode.setAttribute('aria-label','Месячных данных пока нет');if(captionNode)captionNode.textContent='Ожидаем первый месяц';return}
    const graphEntries=entries.slice(-12),maxValue=Math.max(...graphEntries.map(item=>item.value),1),ceiling=niceCeiling(maxValue),axis=[ceiling,Math.round(ceiling*.75),Math.round(ceiling*.5),Math.round(ceiling*.25),0];
    const columns=graphEntries.map((item,index)=>{const height=Math.max(4,Math.min(100,item.value/ceiling*100));return `<div class="map-month-column" style="--bar-height:${height.toFixed(2)}%;grid-column:${index+1}"><em>${safeText(numberFormat.format(item.value))}</em><i class="map-month-bar" style="height:${height.toFixed(2)}%;animation-delay:${(index*.055).toFixed(3)}s"></i><small>${safeText(formatShortMonth(item.key))}</small></div>`}).join('');
    chartNode.innerHTML=`<div class="map-monthly-axis">${axis.map(value=>`<span>${safeText(numberFormat.format(value))}</span>`).join('')}</div><div class="map-monthly-bars map-monthly-bars-r38">${columns}</div>`;
    chartNode.setAttribute('aria-label',graphEntries.map(item=>`${formatMonth(item.key)}, максимум ${meta.monthlyMetric}: ${numberFormat.format(item.value)}`).join('. '));
    if(captionNode)captionNode.textContent=graphEntries.length===1?`Первый максимум · ${meta.monthlyMetric}`:`${graphEntries.length} месяцев · ${meta.monthlyMetric} · максимумы`;
  }
  function render(){updateHeading();const entries=(archives[activeLayer]||[]).filter(item=>item.value>0).sort((a,b)=>a.key.localeCompare(b.key));renderList(entries);renderChart(entries)}

  function openModal(){
    activeLayer=String(window.__andrikEcosystemActiveLayer||document.getElementById('worldMap')?.dataset.ecosystemLayer||activeLayer||'youtube');
    const liveValue=readNumber(document.getElementById('worldMapTotalValue')?.textContent);if(liveValue)rememberCurrentTotal(liveValue,activeLayer);
    returnFocus=document.activeElement;render();modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('is-map-monthly-open');closeButton?.focus({preventScroll:true});
  }
  function closeModal(){if(modal.hidden)return;modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('is-map-monthly-open');if(returnFocus&&typeof returnFocus.focus==='function')returnFocus.focus({preventScroll:true})}

  window.__andrikOpenMapMonthly=openModal;
  openButton.addEventListener('click',openModal);backdrop?.addEventListener('click',closeModal);closeButton?.addEventListener('click',closeModal);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)closeModal()});
  window.addEventListener('andrik:map-total-updated',event=>{const layer=String(window.__andrikEcosystemActiveLayer||activeLayer);rememberCurrentTotal(event.detail?.total,layer)});
  window.addEventListener('andrik:ecosystem-layer-changed',event=>{
    const detail=event.detail||{};activeLayer=String(detail.layer||activeLayer||'youtube');rememberCurrentTotal(detail.total,activeLayer);updateHeading();if(!modal.hidden)render();
  });
  const initial=readNumber(document.getElementById('worldMapTotalValue')?.textContent);if(initial)rememberCurrentTotal(initial,activeLayer);updateHeading();
})();
