(()=>{
  'use strict';
  if(window.__ANDRIK_RADIO_AUDIENCE_R1157__)return;
  window.__ANDRIK_RADIO_AUDIENCE_R1157__=true;
  const root=document.getElementById('radioAudienceR1156');
  if(!root)return;

  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(n)||0));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const headers=()=>{const h={accept:'application/json'};const k=getKey();if(k){h['x-admin-key']=k;h.authorization=`Bearer ${k}`}return h};
  const dateInput=$('radioAudienceDateR1156'),prevBtn=$('radioAudiencePrevR1156'),nextBtn=$('radioAudienceNextR1156'),todayBtn=$('radioAudienceTodayR1156');
  const status=$('radioAudienceStateR1156'),chart=$('radioAudienceChartR1156'),events=$('radioAudienceEventsR1156'),siteEvents=$('radioAudienceSiteEventsR1156');
  let currentData=null,timer=null,serverToday='';

  function dateBratislava(d=new Date()){
    const parts={};
    for(const p of new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d))if(p.type!=='literal')parts[p.type]=p.value;
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function shiftDate(text,days){const m=String(text||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return dateBratislava();const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+days,12));return d.toISOString().slice(0,10)}
  function localTime(raw){if(!raw)return'—';let s=String(raw);if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'Z';const d=new Date(s);if(!Number.isFinite(d.getTime()))return'—';return d.toLocaleTimeString('ru-RU',{timeZone:'Europe/Bratislava',hour:'2-digit',minute:'2-digit'})}
  function dateLabel(text){const m=String(text||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:text}
  function setState(text,kind=''){if(!status)return;status.textContent=text;status.dataset.kind=kind}
  function setText(id,value){const el=$(id);if(el)el.textContent=value}
  function effectiveToday(){return serverToday||dateBratislava()}
  function updateDateButtons(){const today=effectiveToday();if(nextBtn)nextBtn.disabled=!dateInput?.value||dateInput.value>=today;if(todayBtn)todayBtn.disabled=dateInput?.value===today}

  function buildSvg(series){
    if(!Array.isArray(series)||!series.length)return '<div class="r1156-chart-empty">История YouTube за выбранный день ещё не накоплена.<br>Для сегодняшнего дня R1157 сам запрашивает свежий LIVE-замер, если фоновая история устарела.</div>';
    const W=720,H=245,L=42,R=12,T=14,B=30,plotW=W-L-R,plotH=H-T-B;
    const points=series.map((r,i)=>{
      const m=String(r.minute||'').match(/^(\d{2}):(\d{2})$/);const minute=m?(+m[1]*60 + +m[2]):Math.round(i*1440/Math.max(1,series.length-1));
      return {...r,minuteOfDay:Math.max(0,Math.min(1439,minute)),launches:Math.max(0,Number(r.launches)||0),online:r.concurrentViewers==null?null:Math.max(0,Number(r.concurrentViewers)||0)};
    });
    const actualMaxLaunch=Math.max(0,...points.map(p=>p.launches));
    const actualMaxOnline=Math.max(0,...points.map(p=>p.online==null?0:p.online));
    const maxLaunch=Math.max(1,actualMaxLaunch);
    const maxOnline=Math.max(1,actualMaxOnline);
    const x=m=>L+(m/1440)*plotW;
    const yOnline=v=>T+plotH-(Math.max(0,v)/maxOnline)*plotH;
    const yLaunch=v=>T+plotH-(Math.max(0,v)/maxLaunch)*(plotH*.45);
    const ticks=[0,240,480,720,960,1200,1440];
    const grid=ticks.map((m,i)=>`<line class="grid" x1="${x(m).toFixed(1)}" y1="${T}" x2="${x(m).toFixed(1)}" y2="${T+plotH}"/><text class="axis" x="${x(m).toFixed(1)}" y="${H-9}" text-anchor="${i===0?'start':i===ticks.length-1?'end':'middle'}">${String(Math.floor(m/60)%24).padStart(2,'0')}:00</text>`).join('');
    const bars=points.filter(p=>p.launches>0).map(p=>{const bx=x(p.minuteOfDay),by=yLaunch(p.launches),bh=T+plotH-by;return `<rect class="bar" x="${(bx-1.8).toFixed(1)}" y="${by.toFixed(1)}" width="3.6" height="${Math.max(2,bh).toFixed(1)}" rx="1.5"><title>${esc(p.minute)} · +${p.launches} запусков</title></rect>`}).join('');
    const online=points.filter(p=>p.online!=null);
    const line=online.length?online.map((p,i)=>`${i?'L':'M'} ${x(p.minuteOfDay).toFixed(1)} ${yOnline(p.online).toFixed(1)}`).join(' '):'';
    const area=online.length?`${line} L ${x(online[online.length-1].minuteOfDay).toFixed(1)} ${T+plotH} L ${x(online[0].minuteOfDay).toFixed(1)} ${T+plotH} Z`:'';
    const last=online[online.length-1];
    return `<svg class="r1156-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="График запусков YouTube и зрителей онлайн за сутки">${grid}<line class="baseline" x1="${L}" y1="${T+plotH}" x2="${W-R}" y2="${T+plotH}"/>${bars}${area?`<path class="area" d="${area}"/>`:''}${line?`<path class="line" d="${line}"/>`:''}${last?`<circle class="point" cx="${x(last.minuteOfDay).toFixed(1)}" cy="${yOnline(last.online).toFixed(1)}" r="4"><title>${esc(last.minute)} · ${last.online} смотрят</title></circle>`:''}<text class="axis" x="${L+3}" y="${T+11}">пик онлайн ${fmt(actualMaxOnline)}</text><text class="axis" x="${W-R-3}" y="${T+11}" text-anchor="end">макс. +${fmt(actualMaxLaunch)} / ~2 мин</text></svg>`;
  }

  function renderArrivalList(series=[]){
    const rows=series.filter(r=>Number(r.launches)>0).slice().reverse();
    if(!rows.length)return '<div class="r1156-event-empty">За выбранный день прирост запусков между замерами пока не зафиксирован.</div>';
    return rows.slice(0,120).map(r=>`<article class="r1156-event"><time>${esc(r.minute||'—')}</time><div><strong>YouTube · новые запуски</strong><small>интервал измерения ≈ 2 минуты · онлайн ${r.concurrentViewers==null?'—':fmt(r.concurrentViewers)}</small></div><b>+${fmt(r.launches)}</b></article>`).join('');
  }
  function renderSiteList(rows=[]){
    if(!rows.length)return '<div class="r1156-event-empty">Переходов в LIVE через andrikmetal.com за этот день пока нет.</div>';
    return rows.slice().reverse().slice(0,120).map(r=>{const place=[r.city,r.country].filter(Boolean).join(' · ')||'гео не определено';return `<article class="r1156-event is-site"><time>${esc(localTime(r.createdAt))}</time><div><strong>Переход в LIVE через сайт</strong><small>${esc(place)}</small></div><b>+1</b></article>`}).join('');
  }

  function render(data){
    currentData=data;
    if(data?.today)serverToday=String(data.today);
    if(dateInput){
      if(serverToday)dateInput.max=serverToday;
      if(data?.date)dateInput.value=String(data.date);
    }
    const s=data.summary||{};
    setText('radioAudienceLaunchesR1156',fmt(s.launches));
    setText('radioAudiencePeakR1156',fmt(s.peakConcurrent));
    setText('radioAudienceCurrentR1156',fmt(s.currentConcurrent));
    setText('radioAudienceSiteR1156',fmt(s.siteVisitors));
    setText('radioAudienceDayLabelR1156',dateLabel(data.date));
    if(chart)chart.innerHTML=buildSvg(data.series||[]);
    if(events)events.innerHTML=renderArrivalList(data.series||[]);
    if(siteEvents)siteEvents.innerHTML=renderSiteList(data.exactOpens||[]);
    const collected=$('radioAudienceCollectionR1156');
    if(collected){
      if(data.samples){const first=data.series?.[0]?.minute||'—',last=data.series?.[data.series.length-1]?.minute||'—';collected.textContent=`${data.samples} замеров · ${first}–${last} · Europe/Bratislava`;}
      else if(data?.collector?.warning)collected.textContent=`Свежий LIVE-замер не получен · ${data.collector.warning}`;
      else collected.textContent='Жду первый LIVE-замер. Для сегодняшнего дня контролька пробует получить его автоматически.';
    }
    const note=$('radioAudienceNoteR1156');
    if(note)note.textContent=data.samples
      ? 'Жёлтые столбики — новые запуски YouTube между соседними замерами (~2 мин). Красная линия — сколько смотрят одновременно. Точные личности зрителей YouTube не передаёт.'
      : (data?.date===data?.today
        ? 'Сегодня данных пока нет. R1157 уже проверяет активный LIVE и запишет первый доступный замер; прошлую поминутную историю YouTube задним числом восстановить нельзя.'
        : 'Для выбранного архивного дня поминутных YouTube-замеров нет. История начинает накапливаться только после установки сборщика.');
    setState(data.date===data.today?'Сегодня':'Архив','ok');
    updateDateButtons();
  }

  async function load(explicitDate){
    const date=explicitDate===undefined?(dateInput?.value||''):String(explicitDate||'');
    setState('Загрузка…','loading');
    try{
      const qs=new URLSearchParams();
      if(date)qs.set('date',date);
      qs.set('ts',String(Date.now()));
      const res=await fetch(`/api/control/radio-audience-r1157?${qs.toString()}`,{credentials:'include',cache:'no-store',headers:headers()});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${res.status}`);
      render(data);
    }catch(error){
      setState('Ошибка','error');
      if(chart)chart.innerHTML=`<div class="r1156-chart-empty">Не удалось получить историю эфира: ${esc(error?.message||error)}</div>`;
    }
  }

  function setDate(value){if(!dateInput)return;const today=effectiveToday();dateInput.value=value>today?today:value;updateDateButtons();load(dateInput.value)}
  if(dateInput){dateInput.value='';dateInput.addEventListener('change',()=>{const today=effectiveToday();if(dateInput.value>today)dateInput.value=today;updateDateButtons();load(dateInput.value)})}
  prevBtn?.addEventListener('click',()=>setDate(shiftDate(dateInput?.value||effectiveToday(),-1)));
  nextBtn?.addEventListener('click',()=>setDate(shiftDate(dateInput?.value||effectiveToday(),1)));
  todayBtn?.addEventListener('click',()=>setDate(effectiveToday()));
  updateDateButtons();
  // First request intentionally sends no client date. The Worker is the source of truth
  // for Europe/Bratislava, avoiding Android/WebView timezone/ICU day mismatches.
  load('');
  timer=setInterval(()=>{if(!document.hidden&&dateInput?.value===effectiveToday())load(dateInput.value)},120000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dateInput?.value===effectiveToday())load(dateInput.value)});
  window.AndrikRadioAudienceR1157={refresh:()=>load(dateInput?.value||''),get data(){return currentData}};
})();
