(()=>{
  'use strict';

  const STATUS_API='/api/control/radio-remote-r627/status';
  const COMMAND_API='/api/control/radio-remote-r627/command';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const txt=v=>String(v??'').trim();
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const FRESH_EVENT_WINDOW_MS_R870=2*60*60*1000;
  const eventMs=e=>Date.parse(e?.at||'')||0;
  const freshEventsR870=events=>events.filter(e=>eventMs(e)&&Date.now()-eventMs(e)<=FRESH_EVENT_WINDOW_MS_R870);

  let lastFullText='';
  let hiddenBefore=0;
  let timer=null;
  let safeGoldBusy=false;

  function addStyle(){
    if(document.getElementById('r870ObservabilityStyle'))return;
    const s=document.createElement('style');
    s.id='r870ObservabilityStyle';
    s.textContent=`
      .r813-profile-title{margin:12px 0 7px;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:#9ba8ba;font-weight:900}
      .r813-profile{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .r813-profile .youtube-radio-stat-r565 strong{font-size:.78rem!important;line-height:1.18!important;word-break:break-word}
      .r813-profile .youtube-radio-stat-r565 small{font-size:.48rem!important}
      .r813-diag-card{border-color:rgba(255,86,108,.25)!important}
      .r813-diag-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
      .r813-diag-head h2{margin:0}
      .r813-diag-badge{font:800 11px/1 system-ui;padding:7px 9px;border:1px solid #344052;border-radius:999px;color:#9ba8ba}
      .r813-diag-summary{margin-top:10px;padding:10px 12px;border:1px solid #2a3647;border-radius:12px;background:#090d13;color:#cdd6e2;font-size:12px;line-height:1.45}
      .r813-diag-log{margin:10px 0 0;max-height:410px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#05070a;border:1px solid #293546;border-radius:14px;padding:12px;font:11.5px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;color:#d8e1ed;-webkit-overflow-scrolling:touch}
      .r813-diag-actions{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-top:10px}
      .r813-diag-actions button{min-height:46px;border-radius:13px;padding:10px;font-size:12px}
      .r813-diag-copy{background:#f5c84b;color:#19140a}
      .r813-diag-refresh,.r813-diag-clear{background:#182130;color:#fff;border:1px solid #35445a}
      .r813-ok{color:#66df8a}.r813-bad{color:#ff8080}.r813-warn{color:#f5c84b}
      .r870-safe-note{margin:10px 2px 0;padding:10px 11px;border:1px solid #324055;border-radius:12px;background:#090d13;color:#aebbd0;font-size:12px;line-height:1.45}
      .r870-safe-note b{color:#66df8a}
      .r907-diag-copy-main{width:100%;min-height:52px;margin-top:12px;border:0;border-radius:14px;font-weight:900;font-size:14px}
      .r907-diag-spoiler{margin-top:10px;border:1px solid #2a3647;border-radius:14px;background:#070b11;overflow:hidden}
      .r907-diag-spoiler>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;list-style:none;padding:14px 15px;color:#dce5f1;font-weight:900}
      .r907-diag-spoiler>summary::-webkit-details-marker{display:none}
      .r907-diag-spoiler>summary::after{content:'⌄';font-size:22px;color:#9ba8ba;transition:transform .18s ease}
      .r907-diag-spoiler[open]>summary::after{transform:rotate(180deg)}
      .r907-diag-spoiler .r813-diag-log{margin:0 10px 10px}
      .r907-diag-spoiler .r813-diag-actions{grid-template-columns:1fr 1fr;margin:0 10px 10px}
      .r907-diag-spoiler .r813-diag-actions button{width:100%}
      @media(max-width:560px){.r813-profile{grid-template-columns:repeat(2,minmax(0,1fr))!important}.r813-diag-actions{grid-template-columns:1fr 1fr}.r813-diag-copy{grid-column:1/-1}}
    `;
    document.head.appendChild(s);
  }

  function set(id,value){const el=document.getElementById(id);if(el)el.textContent=String(value??'—')}

  function expectedLanes(s,tr={}){
    const lanes=n(tr?.lanes)||n(s?.rtmpsEstablishedConnectionsR792);
    const explicit=n(tr?.expectedLanes)||n(s?.rtmpsExpectedConnectionsR792);
    return explicit>0?explicit:Math.max(1,lanes||1);
  }

  function tunePanelR870(){
    const ey=document.querySelector('.head .ey');
    if(ey)ey.textContent='ANDRIK RADIO CONTROL · R870 SAFE · RTMPS 2/2';

    const gold=document.querySelector('[data-radio-action="gold-restore"]');
    if(gold){
      gold.textContent='🚑 АВАРИЙНЫЙ GOLD + РЕСТАРТ';
      gold.title='Восстанавливает локальный GOLD и один раз перезапускает radio service. R870 не создаёт YouTube broadcast автоматически.';
    }
    const start=document.querySelector('[data-radio-action="start"]');
    if(start)start.title='Ручной запуск. Использовать только когда эфир действительно остановлен.';

    const controlCard=gold?.closest('.card');
    if(controlCard&&!document.getElementById('r870SafetyNote')){
      const note=document.createElement('div');
      note.id='r870SafetyNote';note.className='r870-safe-note';
      note.innerHTML='<b>R870 SAFE:</b> рабочий режим VPS — RTMPS 2/2. GOLD делает restart, но панель после него только проверяет статус: автоматическое создание/перепривязка YouTube broadcast отключено.';
      controlCard.appendChild(note);
    }

    const countryKpi=document.querySelector('[data-radio-country-count]')?.parentElement?.querySelector('span');
    if(countryKpi)countryKpi.textContent='стран YouTube';
    const cityTitle=txt(document.querySelector('[data-radio-city-title]')?.textContent).toLowerCase();
    const cityKpi=document.querySelector('[data-radio-city-count]')?.parentElement?.querySelector('span');
    if(cityKpi){
      cityKpi.textContent=cityTitle.includes('live')?'LIVE-городов · 60 мин':cityTitle.includes('переход')?'городов переходов · 24 ч':'городов сайта · 24 ч';
    }
    const mapCard=document.getElementById('radioCountriesCardR662');
    if(mapCard&&!document.getElementById('r870MapExplain')){
      const p=document.createElement('p');p.id='r870MapExplain';p.className='radio-map-note';
      p.textContent='ℹ️ Страны и города — разные источники и периоды: страны берутся из YouTube (день/28 дней), города — из переходов на эфир или аудитории сайта за 24 часа. Поэтому 21 страна и 4 города не противоречат друг другу.';
      mapCard.appendChild(p);
    }
  }

  function ensureUi(){
    addStyle();tunePanelR870();
    const radio=document.getElementById('youtubeRadioR565');
    if(radio&&!document.getElementById('r813Profile')){
      const firstStats=radio.querySelector('.youtube-radio-stats-r565');
      if(firstStats){
        const title=document.createElement('div');title.className='r813-profile-title';title.id='r813ProfileTitle';title.textContent='Параметры эфира';
        const grid=document.createElement('div');grid.id='r813Profile';grid.className='youtube-radio-stats-r565 r813-profile';
        grid.innerHTML=`
          <div class="youtube-radio-stat-r565"><small>ВИДЕО КОДЕК</small><strong id="r813VideoCodec">H.264 / AVC</strong></div>
          <div class="youtube-radio-stat-r565"><small>КАРТИНКА</small><strong id="r813VideoGeometry">1920×1080 · 25 fps</strong></div>
          <div class="youtube-radio-stat-r565"><small>ВИДЕО БИТРЕЙТ</small><strong id="r813VideoBitrate">6000 kb/s</strong></div>
          <div class="youtube-radio-stat-r565"><small>GOP / B-FRAMES</small><strong id="r813VideoGop">50 / 0</strong></div>
          <div class="youtube-radio-stat-r565"><small>АУДИО КОДЕК</small><strong id="r813AudioCodec">AAC-LC</strong></div>
          <div class="youtube-radio-stat-r565"><small>АУДИО</small><strong id="r813AudioFormat">44.1 kHz · stereo</strong></div>
          <div class="youtube-radio-stat-r565"><small>АУДИО БИТРЕЙТ</small><strong id="r813AudioBitrate">160 kb/s</strong></div>
          <div class="youtube-radio-stat-r565"><small>ТРАНСПОРТ</small><strong id="r813Transport">FLV · RTMPS × —</strong></div>`;
        firstStats.insertAdjacentElement('afterend',title);title.insertAdjacentElement('afterend',grid);
      }
    }

    if(!document.getElementById('r813Diagnostics')){
      const main=document.querySelector('main.wrap');
      const card=document.createElement('section');card.id='r813Diagnostics';card.className='card r813-diag-card';
      card.innerHTML=`
        <div class="r813-diag-head"><h2>🧾 Журнал эфира</h2><span class="r813-diag-badge" id="r813DiagBadge">R907 · ждём данные</span></div>
        <div class="r813-diag-summary" id="r813DiagSummary">Загружаю статус и свежие события…</div>
        <button type="button" class="r813-diag-copy r907-diag-copy-main" id="r813CopyLog">📋 СКОПИРОВАТЬ ВЕСЬ ЛОГ</button>
        <details class="r907-diag-spoiler" id="r907DiagSpoiler">
          <summary><span>Показать журнал эфира</span></summary>
          <pre class="r813-diag-log" id="r813DiagLog">Загружаю…</pre>
          <div class="r813-diag-actions"><button type="button" class="r813-diag-refresh" id="r813RefreshLog">↻ Обновить</button><button type="button" class="r813-diag-clear" id="r813ClearLog">Очистить вид</button></div>
          <p class="small" style="margin:9px 12px 13px">Журнал скрыт по умолчанию. Кнопка копирования работает без раскрытия и копирует всю доступную историю (до 30 событий).</p>
        </details>`;
      if(main)main.appendChild(card);
      document.getElementById('r813CopyLog')?.addEventListener('click',copyAll);
      document.getElementById('r813RefreshLog')?.addEventListener('click',()=>refresh(true));
      document.getElementById('r813ClearLog')?.addEventListener('click',()=>{hiddenBefore=Date.now();const log=document.getElementById('r813DiagLog');if(log)log.textContent='Вид очищен. Новые события появятся автоматически.'});
    }
  }

  function bitrate(v,fallback){const s=txt(v)||fallback;return /k$/i.test(s)?`${s.replace(/k$/i,'')} kb/s`:s}

  function renderProfile(s){
    const p=s?.streamProfileR814||s?.streamProfileR813||{};const v=p.video||{},a=p.audio||{},tr=p.transport||{};
    const fps=n(v.fps)||25,w=n(v.width)||1920,h=n(v.height)||1080,sr=n(a.sampleRate)||44100;
    const lanes=n(tr.lanes)||n(s?.rtmpsEstablishedConnectionsR792),expected=expectedLanes(s,tr);
    set('r813VideoCodec',txt(v.codec)||'H.264 / AVC');set('r813VideoGeometry',`${w}×${h} · ${fps} fps`);set('r813VideoBitrate',bitrate(v.bitrate,'6000k'));
    set('r813VideoGop',`${n(v.gopFrames)||50} / ${Number.isFinite(Number(v.bFrames))?Number(v.bFrames):0}`);set('r813AudioCodec',txt(a.codec)||'AAC-LC');
    set('r813AudioFormat',`${(sr/1000).toFixed(sr%1000?1:0)} kHz · ${txt(a.channelLayout)||'stereo'}`);set('r813AudioBitrate',bitrate(a.bitrate,'160k'));
    set('r813Transport',`${txt(tr.container)||'FLV'} · ${txt(tr.protocol)||'RTMPS'} × ${lanes}/${expected}`);
  }

  function oneLine(v,max=900){return txt(v).replace(/\s+/g,' ').slice(0,max)}
  function eventText(e,index){
    const parts=[`#${index+1}  ${txt(e?.at)||'—'}  ${txt(e?.event)||txt(e?.reason)||'event'}`];
    for(const k of ['current','next','service','publisher','producer','videoFeederRunning','clipActive','rtmps','transportHealthy','oldPid','candidatePid','bootstrapBytes','readyMs','totalMs','sinkDrained','oldClosed','reason','lastError','lastFfmpegLine']){
      if(e?.[k]!==undefined&&e?.[k]!==null&&txt(e[k])!=='')parts.push(`  ${k}: ${oneLine(e[k],1200)}`);
    }
    if(e?.ffmpeg)parts.push(`  ffmpeg:\n${txt(e.ffmpeg).split('\n').slice(-12).map(x=>'    '+x).join('\n')}`);
    if(e?.serviceStats)parts.push(`  service:\n${txt(e.serviceStats).split('\n').slice(-8).map(x=>'    '+x).join('\n')}`);
    if(e?.journal)parts.push(`  journal:\n${txt(e.journal).split('\n').slice(-24).map(x=>'    '+x).join('\n')}`);
    return parts.join('\n');
  }

  function diagParts(data){
    const s=data?.agent?.status||{};const diag=s.diagnosticsR814||s.diagnosticsR813||s.diagnosticsR803||s.diagnosticsR802||{};
    const allEvents=(Array.isArray(diag.events)?diag.events:[]).filter(e=>!hiddenBefore||eventMs(e)>=hiddenBefore).slice(-30);
    const fresh=freshEventsR870(allEvents);const latest=allEvents.at(-1)||null;const latestAgeMs=latest?Math.max(0,Date.now()-eventMs(latest)):0;
    return {s,allEvents,fresh,latest,latestAgeMs};
  }

  function buildText(data){
    const {s,allEvents,fresh}=diagParts(data);const p=s.streamProfileR814||s.streamProfileR813||{};const exp=expectedLanes(s,p.transport||{});
    const hdr=['ANDRIK RADIO R907 DIAGNOSTIC COPY',`captured: ${new Date().toISOString()}`,`agent: ${txt(data?.agent?.version)||'—'} · radio: ${txt(s.version)||'—'}`,
      `service: ${txt(s.service)||'—'} · producer=${Boolean(s.producer)} · publisher=${Boolean(s.publisher)} · videoFeeder=${Boolean(s.videoFeederRunning)} · clip=${Boolean(s.clipActive)}`,
      `current: ${txt(s.current)||'—'}`,`next: ${txt(s.next)||'—'}`,`RTMPS: ${n(s.rtmpsEstablishedConnectionsR792)}/${exp} · transportHealthy=${s.transportHealthy!==false}`,
      `handoff: ${txt(s.videoHandoffMode)||txt(p?.handoff?.mode)||'—'} · cleanCount=${n(s.r813CleanHandoffCount)||n(p?.handoff?.cleanCount)}`,
      `video: ${txt(p?.video?.codec)||'H.264 / AVC'} · ${n(p?.video?.width)||1920}x${n(p?.video?.height)||1080} · ${n(p?.video?.fps)||25}fps · ${txt(p?.video?.bitrate)||'6000k'} · GOP ${n(p?.video?.gopFrames)||50} · B=${Number.isFinite(Number(p?.video?.bFrames))?Number(p.video.bFrames):0}`,
      `audio: ${txt(p?.audio?.codec)||'AAC-LC'} · ${n(p?.audio?.sampleRate)||44100}Hz · ${txt(p?.audio?.channelLayout)||'stereo'} · ${txt(p?.audio?.bitrate)||'160k'}`,
      `lastError: ${txt(s.lastError)||'—'}`,`lastFfmpegLine: ${txt(s.lastFfmpegLine)||'—'}`,'',`EVENT HISTORY (${allEvents.length}/30 · fresh2h=${fresh.length})`];
    return hdr.concat(allEvents.map((e,i)=>eventText(e,i))).join('\n\n');
  }

  function renderDiagnostics(data){
    const {s,allEvents,fresh,latest,latestAgeMs}=diagParts(data);const bad=txt(s.lastError);const rt=n(s.rtmpsEstablishedConnectionsR792),exp=expectedLanes(s,s.streamProfileR814?.transport||s.streamProfileR813?.transport||{});
    const healthy=s.transportHealthy!==false&&rt>0;const badge=document.getElementById('r813DiagBadge');
    if(badge){badge.textContent=`R907 · ${fresh.length} свежих / ${allEvents.length} в истории`;const laneWarn=exp>1&&rt>0&&rt<exp;badge.className='r813-diag-badge '+(healthy?(laneWarn?'r813-warn':'r813-ok'):'r813-bad')}
    const summary=document.getElementById('r813DiagSummary');
    if(summary)summary.innerHTML=`<b>${healthy?'🟢':'🔴'} transport:</b> ${healthy?'healthy':'problem'} · <b>RTMPS:</b> ${rt}/${exp} · <b>video feeder:</b> ${s.videoFeederRunning?'✅':'❌'} · <b>handoff:</b> ${esc(txt(s.videoHandoffMode)||'—')}<br><b>Журнал:</b> ${fresh.length?`${fresh.length} свежих событий за 2 ч`:(latest?`свежих аварий нет · последняя запись ${Math.round(latestAgeMs/60000)} мин назад`:'аварийных событий ещё нет')}${bad?`<br><b class="r813-bad">lastError:</b> ${esc(bad)}`:''}`;
    lastFullText=buildText(data);
    const log=document.getElementById('r813DiagLog');
    if(log){
      const live=`LIVE STATUS · ${new Date().toLocaleTimeString('ru-RU')}\nservice=${txt(s.service)||'—'} · RTMPS=${rt}/${exp} · transportHealthy=${s.transportHealthy!==false} · videoFeeder=${Boolean(s.videoFeederRunning)}\ncurrent=${txt(s.current)||'—'}\nlastError=${bad||'—'}`;
      log.textContent=fresh.length?live+'\n\n────────────────────────────────────────\n\n'+fresh.map((e,i)=>eventText(e,i)).join('\n\n────────────────────────────────────────\n\n'):live+(latest?`\n\nСвежих событий за 2 часа нет. Последняя архивная запись: ${txt(latest.at)||'—'} · ${txt(latest.event)||'event'}`:'\n\nСвежих аварийных событий нет — это нормально для стабильного эфира.');
    }
  }

  async function api(path,opts={}){
    const r=await fetch(path,{...opts,credentials:'include',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(d.message||d.error||`HTTP ${r.status}`);e.data=d;e.status=r.status;throw e}return d;
  }

  function setRemoteMessage(text,kind=''){document.querySelectorAll('[data-radio-remote-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind})}
  function setRemoteResult(text){document.querySelectorAll('[data-radio-result]').forEach(el=>el.textContent=String(text||'').trim())}

  async function runAgentActionR870(action){
    const d=await api(COMMAND_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const c=d.command||{};const createdMs=Date.parse(c.createdAt||'')||Date.now();const until=Date.now()+140000;
    while(Date.now()<until){await sleep(1700);const st=await api(STATUS_API);const r=st.result||{},cmd=st.command||{};const done=Date.parse(r.finishedAt||'')||0;if(r.action===action&&done>=createdMs-1500){if(!r.ok)throw new Error(String(r.output||`${action} failed`).trim());return {status:st,result:r}};if(cmd.id===c.id&&['queued','running'].includes(String(cmd.state||'')))continue}
    throw new Error(`OVH не завершил ${action} за 140 секунд.`);
  }

  async function safeGoldRestoreR870(){
    if(safeGoldBusy)return;
    if(!confirm('🚑 АВАРИЙНЫЙ GOLD: восстановить сохранённый server + env и ОДИН раз перезапустить radio service?\n\nR870 НЕ будет автоматически создавать или перепривязывать YouTube broadcast после восстановления.'))return;
    safeGoldBusy=true;const b=document.querySelector('[data-radio-action="gold-restore"]');const old=b?.textContent||'';if(b){b.disabled=true;b.textContent='🚑 ВОССТАНАВЛИВАЮ…'};setRemoteMessage('🚑 Восстанавливаю GOLD. YouTube broadcast автоматически не создаю…','work');
    try{const d=await runAgentActionR870('gold-restore');setRemoteResult(`${String(d.result?.output||'FULLSCREEN GOLD RESTORE ✅')}\n\nR870 SAFE: YouTube auto-create/rebind после GOLD НЕ запускался.`);setRemoteMessage('GOLD восстановлен ✅ · проверяю только статус, без YouTube auto-create','ok');await sleep(3500);await window.AndrikRadioRemoteR867?.refresh?.().catch?.(()=>{});await refresh(false)}
    catch(e){setRemoteResult(`GOLD RESTORE ERROR\n${e.message||e}`);setRemoteMessage(`GOLD restore: ${e.message||e}`,'bad')}
    finally{safeGoldBusy=false;if(b){b.disabled=false;b.textContent=old||'🚑 АВАРИЙНЫЙ GOLD + РЕСТАРТ'}}
  }

  function installSafetyCapture(){
    if(window.__ANDRIK_R870_GOLD_CAPTURE__)return;window.__ANDRIK_R870_GOLD_CAPTURE__=true;
    document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-radio-action="gold-restore"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();safeGoldRestoreR870()},true);
  }

  async function copyAll(){
    const b=document.getElementById('r813CopyLog');const original=b?.textContent||'📋 СКОПИРОВАТЬ ВЕСЬ ЛОГ';
    try{if(!lastFullText)await refresh(true);if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(lastFullText);else{const ta=document.createElement('textarea');ta.value=lastFullText;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}if(b)b.textContent='✅ СКОПИРОВАНО'}catch(_){if(b)b.textContent='❌ НЕ СКОПИРОВАЛО'}setTimeout(()=>{if(b)b.textContent=original},1600);
  }

  async function refresh(manual=false){
    ensureUi();const badge=document.getElementById('r813DiagBadge');if(manual&&badge)badge.textContent='R907 · обновляю…';
    try{const d=await api(STATUS_API);const s=d?.agent?.status||{};renderProfile(s);renderDiagnostics(d);tunePanelR870();return d}
    catch(error){if(badge){badge.textContent='R907 · нет данных';badge.className='r813-diag-badge r813-bad'}const log=document.getElementById('r813DiagLog');if(log)log.textContent=`Диагностика недоступна: ${error?.message||error}`;return null}
  }

  function arm(){if(timer)clearInterval(timer);timer=null;if(document.hidden)return;timer=setInterval(()=>refresh(false),15000)}
  const boot=()=>{installSafetyCapture();ensureUi();refresh(false);arm()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer)clearInterval(timer);timer=null}else{refresh(false);arm()}});
  window.AndrikRadioObservabilityR870={refresh,safeGoldRestoreR870};
})();
