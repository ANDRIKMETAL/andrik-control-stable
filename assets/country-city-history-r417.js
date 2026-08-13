/* ANDRIK R417 — persistent city list/history for the selected country. */
(()=>{
  'use strict';
  if(window.__ANDRIK_COUNTRY_CITY_HISTORY_R417__)return;
  window.__ANDRIK_COUNTRY_CITY_HISTORY_R417__=true;
  const $=id=>document.getElementById(id),map=$('worldMap'),list=$('worldCountries'),openBtn=$('countryCityHistoryOpenR417');
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
  let date=localDate(),country='',name='',loading=false;
  const syncButton=()=>{country=selectedCode();name=selectedName();const visible=Boolean(country&&document.body.classList.contains('is-country-deep-active')&&document.body.dataset.analyticsPage==='map');openBtn.hidden=!visible;openBtn.setAttribute('aria-hidden',visible?'false':'true');if(visible)openBtn.textContent=`🏙 Города · ${name||country}`};
  const setOpen=value=>{const modal=$('countryCityHistoryModalR417');if(!modal)return;if(value){country=selectedCode()||country;name=selectedName()||name;date=localDate();modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('country-city-history-open-r417');load();}else{modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('country-city-history-open-r417')}};
  const render=payload=>{
    const rows=Array.isArray(payload?.rows)?payload.rows:[];$('countryCityHistoryTitleR417').textContent=`🏙 ${name||country}`;$('countryCityHistoryDateR417').textContent=pretty(date);
    $('countryCityHistoryNextR417').disabled=date>=localDate();
    $('countryCityHistorySummaryR417').textContent=rows.length?`${fmt(payload.total)} включений · ${fmt(rows.length)} городов / регионов`:'За эту дату городов не зафиксировано';
    $('countryCityHistoryListR417').innerHTML=rows.length?rows.map((r,i)=>{const place=String(r.city||r.region||'Город / регион'),region=String(r.region||'').trim(),sub=region&&region.toLowerCase()!==place.toLowerCase()?`<small>${esc(region)}</small>`:'';return `<div class="country-city-history-row-r417"><b>${i+1}</b><div><strong>${esc(place)}</strong>${sub}</div><em>${fmt(r.opens)}</em></div>`}).join(''):'<div class="admin-empty">Нет активности с доступной географией.</div>';
  };
  const load=async()=>{if(loading||!country)return;loading=true;$('countryCityHistorySummaryR417').textContent='Загружаем историю…';$('countryCityHistoryListR417').innerHTML='<div class="admin-empty">Загрузка…</div>';try{const headers={accept:'application/json'};const token=key();if(token)headers.authorization=`Bearer ${token}`;const r=await fetch(`/api/control/country-city-history?country=${encodeURIComponent(country)}&date=${encodeURIComponent(date)}&v=55.00-r417`,{cache:'no-store',credentials:'include',headers});const data=await r.json().catch(()=>({}));if(!r.ok||data.ok===false)throw new Error(data.error||`HTTP ${r.status}`);render(data)}catch(e){$('countryCityHistorySummaryR417').textContent='История временно недоступна';$('countryCityHistoryListR417').innerHTML=`<div class="admin-empty">${esc(e.message||'Ошибка загрузки')}</div>`}finally{loading=false}};
  openBtn.addEventListener('click',()=>setOpen(true));$('countryCityHistoryCloseR417')?.addEventListener('click',()=>setOpen(false));$('countryCityHistoryBackdropR417')?.addEventListener('click',()=>setOpen(false));
  $('countryCityHistoryPrevR417')?.addEventListener('click',()=>{date=shift(date,-1);load()});$('countryCityHistoryNextR417')?.addEventListener('click',()=>{if(date<localDate()){date=shift(date,1);load()}});$('countryCityHistoryTodayR417')?.addEventListener('click',()=>{date=localDate();load()});$('countryCityHistoryYesterdayR417')?.addEventListener('click',()=>{date=shift(localDate(),-1);load()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('countryCityHistoryModalR417')?.hidden)setOpen(false)});
  ['andrik:country-focus-changed','andrik:country-deep-changed','andrik:analytics-page-changed'].forEach(ev=>addEventListener(ev,()=>setTimeout(syncButton,0),{passive:true}));
  new MutationObserver(syncButton).observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});
  syncButton();setTimeout(syncButton,250);
})();
