/* ANDRIK R437 — global city list + tap-to-show GA4 traffic source. */
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_CITY_HISTORY_R437__)return;
  window.__ANDRIK_COUNTRY_CITY_HISTORY_R437__=true;
  const $=id=>document.getElementById(id),map=$('worldMap'),list=$('worldCountries'),openBtn=$('countryCityHistoryOpenR418');
  if(!map||!list||!openBtn)return;
  const runtime=window.__andrikWorldMapRuntime||{};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=n=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(n||0)));
  const key=()=>{try{return localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||''}catch(_){return''}};
  const selectedButton=()=>list.querySelector('.world-country-button.is-selected,.world-country-selected-card.is-selected,[aria-pressed="true"]');
  const selectedName=()=>String(runtime.getSelection?.()||map.dataset.focusCountry||'').trim();
  const selectedCode=()=>{
    const button=String(selectedButton()?.dataset?.code||'').trim();
    const direct=String(runtime.resolveCountryCode?.(button)||button).trim().toUpperCase();if(/^[A-Z]{2}$/.test(direct))return direct;
    const raw=selectedName();const rt=String(runtime.resolveCountryCode?.(raw)||'').trim().toUpperCase();if(/^[A-Z]{2}$/.test(rt))return rt;
    const aliases={'россия':'RU','russia':'RU','украина':'UA','ukraine':'UA','словакия':'SK','slovakia':'SK','австрия':'AT','austria':'AT','чехия':'CZ','czechia':'CZ','сша':'US','united states':'US'};
    return aliases[raw.toLowerCase()]||'';
  };
  const localDate=()=>{try{const parts={};new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(p=>{if(p.type!=='literal')parts[p.type]=p.value});return `${parts.year}-${parts.month}-${parts.day}`}catch(_){return new Date().toISOString().slice(0,10)}};
  const shift=(d,n)=>{const m=String(d||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return localDate();const x=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+n));return x.toISOString().slice(0,10)};
  const pretty=d=>{try{return new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',weekday:'short',day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${d}T12:00:00Z`))}catch(_){return d}};
  let date=localDate(),country='',name='',loading=false,controller=null,mode='all';
  const sourceCache=new Map();let openedSourceKey='';
  const sourceLabel=(row={})=>String(row.label||row.source||'Источник').trim()||'Источник';
  const sourceMeta=(row={})=>{
    const medium=String(row.medium||'').trim(),channel=String(row.channel||'').trim();
    const bits=[];if(medium&&medium!=='(none)')bits.push(medium);if(channel&&!/direct/i.test(channel))bits.push(channel);return bits.join(' · ');
  };
  const renderSourceRows=(rows=[],kind='ga4')=>rows.slice(0,7).map(r=>{
    const count=kind==='ga4'?Number(r.sessions||0):Number(r.events||0);const users=Number(r.activeUsers??r.users??0);const meta=sourceMeta(r);
    const unit=kind==='ga4'?'сес.':'виз.';return `<div class="country-city-source-line-r437"><span class="country-city-source-icon-r437">${esc(r.icon||'↗️')}</span><div><strong>${esc(sourceLabel(r))}</strong>${meta?`<small>${esc(meta)}</small>`:''}</div><em>${fmt(count)} ${unit}${users>0?`<small>${fmt(users)} чел.</small>`:''}</em></div>`;
  }).join('');
  const renderSourceDetail=(payload,place)=>{
    const ga=payload?.ga4||{},fp=payload?.firstParty||{},gaRows=Array.isArray(ga.rows)?ga.rows:[],fpRows=Array.isArray(fp.rows)?fp.rows:[];
    const usefulFp=fpRows.filter(r=>String(r.source||'').trim()&&!/^\(unknown\)$/i.test(String(r.source||'')));
    if(gaRows.length){
      const direct=gaRows.some(r=>String(r.key||'')==='direct');
      return `<div class="country-city-source-head-r437"><strong>↗ Откуда пришли · ${esc(place)}</strong><small>GA4 · ${esc(payload?.range?.label||'')}</small></div>${renderSourceRows(gaRows,'ga4')}${direct?'<p class="country-city-source-note-r437">Direct может означать прямой вход или переход из приложения, которое не передало источник.</p>':''}`;
    }
    if(usefulFp.length){
      return `<div class="country-city-source-head-r437"><strong>↗ Откуда пришли · ${esc(place)}</strong><small>ANDRIK Live · с R437</small></div>${renderSourceRows(usefulFp,'first')}`;
    }
    const err=ga.error?`<small>${esc(ga.error)}</small>`:'';
    return `<div class="country-city-source-empty-r437"><strong>Источник пока не определён</strong>${err}<small>Для новых посещений R437 параллельно сохраняет источник в ANDRIK Live.</small></div>`;
  };
  const loadSource=async row=>{
    const city=String(row.dataset.city||'').trim(),region=String(row.dataset.region||'').trim(),place=city||region||'Город';
    const cacheKey=[country,city,region,mode,mode==='daily'?date:'all'].join('|');
    if(openedSourceKey===cacheKey){row.nextElementSibling?.classList?.contains('country-city-source-r437')&&row.nextElementSibling.remove();openedSourceKey='';return;}
    document.querySelectorAll('#countryCityHistoryListR418 .country-city-source-r437').forEach(el=>el.remove());openedSourceKey=cacheKey;
    const box=document.createElement('div');box.className='country-city-source-r437';box.innerHTML='<div class="country-city-source-loading-r437">Определяем источник перехода…</div>';row.insertAdjacentElement('afterend',box);
    const cached=sourceCache.get(cacheKey);if(cached){box.innerHTML=renderSourceDetail(cached,place);return;}
    try{
      const headers={accept:'application/json'};const token=key();if(token)headers.authorization=`Bearer ${token}`;
      const qs=new URLSearchParams({country,city,region,mode,v:'55.00-r437'});if(mode==='daily')qs.set('date',date);
      const r=await fetch(`/api/control/city-traffic-source?${qs.toString()}`,{cache:'no-store',credentials:'include',headers});const data=await r.json().catch(()=>({}));
      if(!r.ok||data.ok===false)throw new Error(data.error||`HTTP ${r.status}`);sourceCache.set(cacheKey,data);if(openedSourceKey===cacheKey)box.innerHTML=renderSourceDetail(data,place);
    }catch(e){if(openedSourceKey===cacheKey)box.innerHTML=`<div class="country-city-source-empty-r437"><strong>Не удалось получить источник</strong><small>${esc(e?.message||'Ошибка')}</small></div>`}
  };
  const isLandscape=()=>matchMedia('(orientation: landscape)').matches;
  const placeOpenButton=()=>{if(openBtn.parentElement!==map)map.appendChild(openBtn)};
  const syncLandscapePanelBounds=()=>{
    const modal=$('countryCityHistoryModalR418');if(!modal)return;
    if(!isLandscape()){modal.style.removeProperty('--r427-city-panel-top');modal.style.removeProperty('--r427-city-panel-height');return;}
    const frame=document.getElementById('landscapeMapFrameR69Final');
    const rect=frame?.getBoundingClientRect?.();
    if(!rect||rect.width<200||rect.height<160)return;
    const inset=8;
    const top=Math.max(0,Math.round(rect.top+inset));
    const bottom=Math.min(innerHeight,Math.round(rect.bottom-inset));
    const height=Math.max(160,bottom-top);
    modal.style.setProperty('--r427-city-panel-top',`${top}px`);
    modal.style.setProperty('--r427-city-panel-height',`${height}px`);
  };
  const syncButton=()=>{
    placeOpenButton();country=selectedCode();name=selectedName();
    const visible=Boolean(country&&document.body.classList.contains('is-country-deep-active')&&document.body.dataset.analyticsPage==='map');
    openBtn.hidden=!visible;openBtn.setAttribute('aria-hidden',visible?'false':'true');openBtn.textContent='🏙 Города';
  };
  const syncModeUi=()=>{
    const isAll=mode==='all';
    $('countryCityHistoryAllR419')?.classList.toggle('is-active',isAll);
    $('countryCityHistoryCalendarR419')?.classList.toggle('is-active',!isAll);
    $('countryCityHistoryModeLabelR419').textContent=isAll?'Общий список по всем сохранённым данным':'Список за выбранный день';
    $('countryCityHistoryDateWrapR419')?.classList.toggle('country-city-history-hidden-r419',isAll);
    $('countryCityHistoryQuickWrapR419')?.classList.toggle('country-city-history-hidden-r419',isAll);
  };
  const setOpen=value=>{
    const modal=$('countryCityHistoryModalR418');if(!modal)return;
    if(value){
      country=selectedCode()||country;name=selectedName()||name;if(!country)return;
      date=localDate();mode='all';syncModeUi();modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('country-city-history-open-r418');
      requestAnimationFrame(()=>{syncLandscapePanelBounds();load();});
    }else{
      controller?.abort?.();controller=null;openedSourceKey='';modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('country-city-history-open-r418');modal.style.removeProperty('--r427-city-panel-top');modal.style.removeProperty('--r427-city-panel-height');
    }
  };
  const render=payload=>{
    openedSourceKey='';
    const rows=Array.isArray(payload?.rows)?payload.rows:[];
    const total=Math.max(0,Number(payload?.total||0));
    $('countryCityHistoryTitleR418').textContent=`🏙 ${name||country}`;
    $('countryCityHistoryDateR418').textContent=pretty(date);
    $('countryCityHistoryNextR418').disabled=date>=localDate();
    $('countryCityHistorySummaryR418').textContent=rows.length?`${fmt(total)} включений · ${fmt(rows.length)} городов / регионов`:(mode==='all'?'Пока нет сохранённых городов для этой страны':'За эту дату городов не зафиксировано');
    $('countryCityHistoryListR418').innerHTML=rows.length?rows.map((r,i)=>{const place=String(r.city||r.region||'Город / регион'),region=String(r.region||'').trim(),sub=region&&region.toLowerCase()!==place.toLowerCase()?`<small>${esc(region)}</small>`:'';const days=mode==='all'&&Number(r.days||0)>1?`<small>Дней активности: ${fmt(r.days)}</small>`:'';return `<div class="country-city-history-row-r418 country-city-source-trigger-r437" role="button" tabindex="0" aria-label="Показать источник перехода: ${esc(place)}" data-city="${esc(String(r.city||''))}" data-region="${esc(region)}"><b>${i+1}</b><div><strong>${esc(place)}</strong>${sub||days}</div><em>${fmt(r.opens)}<small class="country-city-source-tap-r437">↗</small></em></div>`}).join(''):'<div class="admin-empty">Нет активности с доступной географией.</div>';
  };
  const load=async()=>{
    if(loading||!country)return;loading=true;controller?.abort?.();controller=new AbortController();const timer=setTimeout(()=>controller?.abort?.(),12000);
    $('countryCityHistorySummaryR418').textContent='Загружаем историю…';$('countryCityHistoryListR418').innerHTML='<div class="admin-empty">Загрузка…</div>';
    try{
      const headers={accept:'application/json'};const token=key();if(token)headers.authorization=`Bearer ${token}`;
      const qs=new URLSearchParams({country,mode,v:'55.00-r437'});if(mode==='daily')qs.set('date',date);
      const r=await fetch(`/api/control/country-city-history?${qs.toString()}`,{cache:'no-store',credentials:'include',headers,signal:controller.signal});
      const data=await r.json().catch(()=>({}));if(!r.ok||data.ok===false)throw new Error(data.error||`HTTP ${r.status}`);render(data);
    }catch(e){
      const msg=e?.name==='AbortError'?'Превышено время ожидания':(e?.message||'Ошибка загрузки');
      $('countryCityHistorySummaryR418').textContent='История временно недоступна';$('countryCityHistoryListR418').innerHTML=`<div class="admin-empty">${esc(msg)}</div>`;
    }finally{clearTimeout(timer);loading=false;controller=null}
  };
  openBtn.addEventListener('pointerdown',e=>e.stopPropagation(),true);
  openBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setOpen(true)},true);
  $('countryCityHistoryCloseR418')?.addEventListener('click',()=>setOpen(false));$('countryCityHistoryBackdropR418')?.addEventListener('click',()=>setOpen(false));
  $('countryCityHistoryPrevR418')?.addEventListener('click',()=>{date=shift(date,-1);load()});$('countryCityHistoryNextR418')?.addEventListener('click',()=>{if(date<localDate()){date=shift(date,1);load()}});
  $('countryCityHistoryTodayR418')?.addEventListener('click',()=>{date=localDate();if(mode!=='daily'){mode='daily';syncModeUi()}load()});$('countryCityHistoryYesterdayR418')?.addEventListener('click',()=>{date=shift(localDate(),-1);if(mode!=='daily'){mode='daily';syncModeUi()}load()});
  $('countryCityHistoryAllR419')?.addEventListener('click',()=>{if(mode!=='all'){mode='all';syncModeUi();load()}});
  $('countryCityHistoryCalendarR419')?.addEventListener('click',()=>{mode=mode==='daily'?'all':'daily';if(mode==='daily'&&!date)date=localDate();syncModeUi();load()});
  $('countryCityHistoryListR418')?.addEventListener('click',e=>{const row=e.target?.closest?.('.country-city-source-trigger-r437');if(row)loadSource(row)});
  $('countryCityHistoryListR418')?.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target?.classList?.contains('country-city-source-trigger-r437')){e.preventDefault();loadSource(e.target)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('countryCityHistoryModalR418')?.hidden)setOpen(false)});
  document.addEventListener('click',e=>{
    const link=e.target?.closest?.('#mapFocusActions .map-focus-action');if(!link)return;
    const page=link.classList.contains('is-activity')?'activity':link.classList.contains('is-daily')?'summary':'';if(!page)return;
    e.preventDefault();e.stopImmediatePropagation();location.replace(`/control-home.html?page=${page}&source=country-map-action&v=55.00-r418`);
  },true);
  const forceLandscapeList=()=>{
    const modal=$('countryCityHistoryModalR418');
    if(!isLandscape()||!modal||modal.hidden)return;
    if(mode!=='all'){mode='all';syncModeUi();load();}
  };
  addEventListener('orientationchange',()=>setTimeout(()=>{forceLandscapeList();syncLandscapePanelBounds();},140),{passive:true});
  matchMedia('(orientation: landscape)').addEventListener?.('change',()=>setTimeout(()=>{forceLandscapeList();syncLandscapePanelBounds();},80));
  addEventListener('resize',()=>{if(!$('countryCityHistoryModalR418')?.hidden)requestAnimationFrame(syncLandscapePanelBounds);},{passive:true});
  ['andrik:country-focus-changed','andrik:country-deep-changed','andrik:analytics-page-changed'].forEach(ev=>addEventListener(ev,()=>setTimeout(syncButton,0),{passive:true}));
  new MutationObserver(syncButton).observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});
  new MutationObserver(()=>{if(openBtn.parentElement!==map)map.appendChild(openBtn);syncButton()}).observe(map,{childList:true});
  syncButton();syncModeUi();setTimeout(syncButton,180);setTimeout(syncButton,700);
})();
