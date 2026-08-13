(() => {
  'use strict';
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const formatDate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch(_){return value}};
  const formatTime=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch(_){return value}};
  const formatUpdatedCompact=value=>{if(!value)return '—';try{const d=new Date(value),date=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d),time=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(d);return `${date} · ${time}`}catch(_){return value}};
  const fmt=value=>Number(value||0).toLocaleString('ru-RU');
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  const statusText={good:'Работает',warning:'Внимание',error:'Ошибка'};
  const healthIcon={worker:'⚙️',database:'🗄️',cron:'⏱️',site:'🌐','native-monitor':'📡'};
  let monitorRange='24h';

  async function api(path,options={}){
    const key=getKey();
    if(!key)throw new Error('Сначала сохраните ADMIN_KEY в разделе «Служебное».');
    const response=await fetch(path,{...options,headers:{accept:'application/json',authorization:`Bearer ${key}`,...(options.headers||{})},cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok&&response.status!==207)throw new Error(data.details||data.error||`HTTP ${response.status}`);
    return data;
  }

  function renderHealth(health={}){
    const summary=document.getElementById('observabilityHealthSummary');
    const box=document.getElementById('observabilityHealthGrid');
    const overall=health.status||'degraded';
    if(summary){summary.className=`observability-overall is-${overall}`;summary.textContent=overall==='ok'?'🟢 Всё доступно':overall==='down'?'🔴 Есть недоступная служба':'🟡 Есть предупреждение'}
    if(!box)return;
    box.innerHTML=(health.checks||[]).map(item=>`<article class="observability-check is-${escapeHtml(item.status||'warning')}"><span class="observability-check-icon-r415" aria-hidden="true">${healthIcon[item.id]||'🔧'}</span><div><strong>${escapeHtml(item.label||item.id)}</strong><small>${escapeHtml(item.detail||'Нет данных')}</small><em>${escapeHtml(statusText[item.status]||'Проверить')}</em></div></article>`).join('')||'<div class="admin-empty">Нет данных проверки.</div>';
  }

  function renderErrors(data={}){
    const counts=data.errors24h||{};
    set('observabilityErrors',fmt(counts.errors));
    set('observabilityWarnings',fmt(counts.warnings));
    set('observabilityEvents',fmt(counts.total));
    const list=document.getElementById('observabilityIssues');
    if(!list)return;
    const rows=data.recentIssues||[];
    list.innerHTML=rows.length?rows.map(item=>`<article class="observability-issue is-${escapeHtml(item.level||'warning')}"><div><strong>${item.level==='error'?'Ошибка':'Предупреждение'} · ${escapeHtml(item.scope||'system')}</strong><small>${escapeHtml(item.message||item.event||'Без описания')}</small></div><time>${escapeHtml(formatDate(item.createdAt))}</time></article>`).join(''):'<div class="observability-empty-good">✅ Ошибок и предупреждений в журнале нет.</div>';
  }

  function renderQuota(quota={}){
    const data=quota.dataApi||{};
    const analytics=quota.analyticsApi||{};
    set('observabilityQuotaUsed',fmt(data.units));
    set('observabilityQuotaRemaining',fmt(data.remaining));
    set('observabilityQuotaRequests',fmt(data.requests));
    set('observabilityAnalyticsRequests',fmt(analytics.requests));
    set('observabilityQuotaDate',quota.dateKey||'—');
    const bar=document.getElementById('observabilityQuotaBar');
    if(bar)bar.style.width=`${Math.max(0,Math.min(100,Number(data.percent||0)))}%`;
    set('observabilityQuotaPercent',`${Number(data.percent||0).toLocaleString('ru-RU')}%`);
    const note=document.getElementById('observabilityQuotaNote');
    if(note)note.textContent=quota.trackedSince?`Учёт включён с ${formatDate(quota.trackedSince)}. Значение приблизительное, но безопасно показывает реальный расход запросов Control.`:'Учёт начинается после установки этой версии. Значение приблизительное.';
  }

  function renderHealthEndpoint(external={}){
    const input=document.getElementById('observabilityHealthUrl');
    if(input)input.value=external.healthUrl||`${location.origin}/api/health`;
    const state=document.getElementById('observabilityExternalState');
    if(state){state.textContent='Встроено';state.className='service-monitor-ready is-connected'}
    set('observabilityExternalNote',external.note||'ANDRIK Monitor использует этот адрес автоматически.');
  }

  function monitorStatusClass(item={}){
    if(item.status==='good')return 'is-good';
    if(item.status==='error')return 'is-error';
    return 'is-warning';
  }

  function renderMonitorChart(data={}){
    const chart=document.getElementById('andrikMonitorChart');
    const legend=document.getElementById('andrikMonitorLegend');
    if(!chart||!legend)return;
    const samples=Array.isArray(data.samples)?data.samples:[];
    const targets=Array.isArray(data.targets)?data.targets:[];
    if(!samples.length){
      chart.innerHTML='<div class="uptime-empty-chart">График появится после первой встроенной проверки.</div>';
      legend.innerHTML='';
      return;
    }
    const width=760,height=250,padX=34,padTop=22,padBottom=32;
    const times=samples.map(item=>Date.parse(item.checkedAt||'')).filter(Number.isFinite);
    if(!times.length){chart.innerHTML='<div class="uptime-empty-chart">Нет корректных точек времени.</div>';legend.innerHTML='';return}
    const minTime=Math.min(...times),maxTime=Math.max(...times);
    const maxResponse=Math.max(100,...samples.map(item=>Number(item.responseTimeMs||0)));
    const byTarget=new Map();
    samples.forEach(item=>{const id=String(item.targetId||'');if(!byTarget.has(id))byTarget.set(id,[]);byTarget.get(id).push(item)});
    const x=value=>padX+((Date.parse(value)-minTime)/Math.max(1,maxTime-minTime))*(width-padX*2);
    const y=value=>padTop+(1-Math.min(1,Number(value||0)/maxResponse))*(height-padTop-padBottom);
    const grid=[0,.25,.5,.75,1].map(step=>{const yy=padTop+step*(height-padTop-padBottom);return `<line x1="${padX}" y1="${yy}" x2="${width-padX}" y2="${yy}" class="uptime-grid-line"/>`}).join('');
    const lines=[...byTarget.entries()].map(([id,rows],index)=>{
      rows.sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt));
      const points=rows.map(row=>`${x(row.checkedAt).toFixed(1)},${y(row.responseTimeMs).toFixed(1)}`).join(' ');
      const errors=rows.filter(row=>row.status==='error').map(row=>`<circle cx="${x(row.checkedAt).toFixed(1)}" cy="${height-padBottom}" r="5" class="uptime-down-dot"/>`).join('');
      const warnings=rows.filter(row=>row.status==='warning').map(row=>`<circle cx="${x(row.checkedAt).toFixed(1)}" cy="${y(row.responseTimeMs).toFixed(1)}" r="4" class="uptime-warning-dot"/>`).join('');
      return `<polyline points="${points}" class="uptime-line uptime-line-${index%5}"/>${warnings}${errors}`;
    }).join('');
    const startLabel=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(minTime));
    const endLabel=new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(maxTime));
    chart.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="График времени ответа ANDRIK Monitor">${grid}${lines}<text x="${padX}" y="${height-8}" class="uptime-axis-label">${escapeHtml(startLabel)}</text><text x="${width-padX}" y="${height-8}" text-anchor="end" class="uptime-axis-label">${escapeHtml(endLabel)}</text><text x="${padX}" y="15" class="uptime-axis-label">до ${fmt(maxResponse)} мс</text></svg>`;
    legend.innerHTML=targets.map((target,index)=>`<span><i class="uptime-legend-dot uptime-line-${index%5}"></i>${escapeHtml(target.targetName||`Проверка ${index+1}`)}</span>`).join('');
  }

  function renderMonitor(data={}){
    const state=document.getElementById('andrikMonitorState');
    const errors=Number(data.errorCount||0);
    const warnings=Number(data.warningCount||0);
    if(state){
      state.className=`service-access-state ${errors?'is-error':warnings?'':'is-ready'}`;
      state.textContent=errors?`Сбой: ${errors}`:warnings?`Внимание: ${warnings}`:data.connected?'Работает':'Ожидает данных';
    }
    set('andrikMonitorUpdated',data.lastSyncAt?formatTime(data.lastSyncAt):'—');
    set('andrikMonitorCount',fmt(data.monitorCount||0));
    set('andrikMonitorErrorCount',fmt(errors));
    const list=document.getElementById('andrikMonitorTargets');
    if(list){
      const rows=data.targets||[];
      list.innerHTML=rows.length?rows.map(item=>`<article class="uptime-monitor ${monitorStatusClass(item)}"><div><strong>${escapeHtml(item.targetName||'Проверка')}</strong><small>${escapeHtml(item.targetUrl||'')}</small></div><div class="uptime-monitor-numbers"><b>${escapeHtml(statusText[item.status]||'Проверить')}</b><span>${fmt(item.responseTimeMs)} мс · HTTP ${fmt(item.httpStatus)}</span><span>${Number(item.availability||0).toLocaleString('ru-RU',{maximumFractionDigits:3})}% доступность</span></div></article>`).join(''):'<div class="admin-empty">Проверки пока не выполнены.</div>';
    }
    const incidents=document.getElementById('andrikMonitorIncidents');
    if(incidents){
      const rows=data.incidents||[];
      incidents.innerHTML=rows.length?rows.slice(0,20).map(item=>`<article class="uptime-incident is-${escapeHtml(item.eventType||'warning')}"><div><strong>${item.eventType==='recovery'?'Восстановление':item.eventType==='down'?'Сбой':'Замедление'} · ${escapeHtml(item.targetName||'Проверка')}</strong><small>${escapeHtml(item.reason||item.targetUrl||'Без описания')}</small></div><time>${escapeHtml(formatDate(item.startedAt))}</time></article>`).join(''):'<div class="observability-empty-good">Инцидентов пока нет ✅</div>';
    }
    document.querySelectorAll('[data-monitor-range]').forEach(button=>button.classList.toggle('is-active',button.dataset.monitorRange===data.range));
    renderMonitorChart(data);
  }

  async function loadMonitor({refresh=false}={}){
    const button=document.getElementById('andrikMonitorRefresh');
    if(button)button.disabled=true;
    set('andrikMonitorMessage',refresh?'Проверяем сайт, Control и Worker…':'Загружаем историю…');
    try{
      const data=await api(`/api/control/monitor?range=${encodeURIComponent(monitorRange)}${refresh?'&refresh=1':''}&t=${Date.now()}`);
      renderMonitor(data);
      window.dispatchEvent(new Event('andrik-control-system-refresh'));
      set('andrikMonitorMessage',data.errorCount?`Обнаружено недоступных точек: ${data.errorCount}`:data.warningCount?`Есть медленные ответы: ${data.warningCount}`:'Встроенный монитор обновлён ✅');
      return data;
    }catch(error){set('andrikMonitorMessage',`Мониторинг: ${error.message}`);return null}
    finally{if(button)button.disabled=false}
  }

  async function load({refreshMonitor=true}={}){
    const button=document.getElementById('observabilityRefresh');
    if(button)button.disabled=true;
    set('observabilityMessage','Проверяем сайт, Worker, D1, Cron и журналы…');
    try{
      await loadMonitor({refresh:refreshMonitor});
      const data=await api(`/api/control/observability?refresh=1&t=${Date.now()}`);
      renderHealth(data.health||{});
      renderErrors(data);
      renderQuota(data.youtubeQuota||{});
      renderHealthEndpoint(data.externalMonitor||{});
      set('observabilityUpdated',formatUpdatedCompact(data.updatedAt));
      set('observabilityMessage','Мониторинг обновлён ✅');
    }catch(error){
      set('observabilityMessage',`Ошибка: ${error.message}`);
      const summary=document.getElementById('observabilityHealthSummary');
      if(summary){summary.className='observability-overall is-down';summary.textContent='🔴 Данные не загружены'}
    }finally{if(button)button.disabled=false}
  }

  document.getElementById('observabilityRefresh')?.addEventListener('click',()=>load({refreshMonitor:true}));
  document.getElementById('andrikMonitorRefresh')?.addEventListener('click',()=>loadMonitor({refresh:true}));
  document.querySelectorAll('[data-monitor-range]').forEach(button=>button.addEventListener('click',()=>{monitorRange=button.dataset.monitorRange||'24h';loadMonitor({refresh:false})}));
  document.getElementById('observabilityCopyHealth')?.addEventListener('click',async()=>{
    const value=document.getElementById('observabilityHealthUrl')?.value||'';
    try{await navigator.clipboard.writeText(value);set('observabilityExternalMessage','Адрес health check скопирован ✅')}
    catch(_){const input=document.getElementById('observabilityHealthUrl');input?.select();document.execCommand('copy');set('observabilityExternalMessage','Адрес выделен и скопирован ✅')}
  });
  document.getElementById('observabilityOpenHealth')?.addEventListener('click',()=>{
    const value=document.getElementById('observabilityHealthUrl')?.value||`${location.origin}/api/health`;
    window.open(value,'_blank','noopener,noreferrer');
  });

  let touchStartY=0;
  document.addEventListener('touchstart',event=>{if(scrollY<=2)touchStartY=event.touches?.[0]?.clientY||0},{passive:true});
  document.addEventListener('touchend',event=>{const end=event.changedTouches?.[0]?.clientY||0;if(scrollY<=2&&touchStartY&&end-touchStartY>85)load({refreshMonitor:true});touchStartY=0},{passive:true});
  load({refreshMonitor:true});
})();
