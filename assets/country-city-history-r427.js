/* ANDRIK R427 — global city list + frame-bound landscape dialog. */
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_CITY_HISTORY_R427__)return;
  window.__ANDRIK_COUNTRY_CITY_HISTORY_R427__=true;
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
      controller?.abort?.();controller=null;modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('country-city-history-open-r418');modal.style.removeProperty('--r427-city-panel-top');modal.style.removeProperty('--r427-city-panel-height');
    }
  };
  const render=payload=>{
    const rows=Array.isArray(payload?.rows)?payload.rows:[];
    const total=Math.max(0,Number(payload?.total||0));
    $('countryCityHistoryTitleR418').textContent=`🏙 ${name||country}`;
    $('countryCityHistoryDateR418').textContent=pretty(date);
    $('countryCityHistoryNextR418').disabled=date>=localDate();
    $('countryCityHistorySummaryR418').textContent=rows.length?`${fmt(total)} включений · ${fmt(rows.length)} городов / регионов`:(mode==='all'?'Пока нет сохранённых городов для этой страны':'За эту дату городов не зафиксировано');
    $('countryCityHistoryListR418').innerHTML=rows.length?rows.map((r,i)=>{const place=String(r.city||r.region||'Город / регион'),region=String(r.region||'').trim(),sub=region&&region.toLowerCase()!==place.toLowerCase()?`<small>${esc(region)}</small>`:'';const days=mode==='all'&&Number(r.days||0)>1?`<small>Дней активности: ${fmt(r.days)}</small>`:'';return `<div class="country-city-history-row-r418"><b>${i+1}</b><div><strong>${esc(place)}</strong>${sub||days}</div><em>${fmt(r.opens)}</em></div>`}).join(''):'<div class="admin-empty">Нет активности с доступной географией.</div>';
  };
  const load=async()=>{
    if(loading||!country)return;loading=true;controller?.abort?.();controller=new AbortController();const timer=setTimeout(()=>controller?.abort?.(),12000);
    $('countryCityHistorySummaryR418').textContent='Загружаем историю…';$('countryCityHistoryListR418').innerHTML='<div class="admin-empty">Загрузка…</div>';
    try{
      const headers={accept:'application/json'};const token=key();if(token)headers.authorization=`Bearer ${token}`;
      const qs=new URLSearchParams({country,mode,v:'55.00-r427'});if(mode==='daily')qs.set('date',date);
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
