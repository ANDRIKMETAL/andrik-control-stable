(()=>{
  'use strict';

  const STATUS_API='/api/control/radio-remote-r627/status';
  const COMMAND_API='/api/control/radio-remote-r627/command';
  const PUBLIC_STATUS_API='/api/public/radio-diagnostics-r802';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
  const txt=v=>String(v??'').trim();
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const humanBytesR1015=v=>{const x=Math.max(0,n(v)),g=1024**3,m=1024**2;return x>=g?`${Math.round(x/g)}G`:x>=m?`${Math.round(x/m)}M`:`${Math.round(x/1024)}K`};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const FRESH_EVENT_WINDOW_MS_R870=2*60*60*1000;
  const eventMs=e=>Date.parse(e?.at||'')||0;
  const freshEventsR870=events=>events.filter(e=>eventMs(e)&&Date.now()-eventMs(e)<=FRESH_EVENT_WINDOW_MS_R870);

  let lastFullText='';
  let hiddenBefore=0;
  let timer=null;
  let safeGoldBusy=false,lastData=null,onlyProblems=false,archiveWarning='';
  let fpsWindowR1227=[];
  const HISTORY_KEY='andrik-radio-diagnostics-r1183';
  const critical=e=>/error|stall|recycle|unexpected|incident|timeout|no-progress|freeze|frozen/i.test(e.event||'');
  function redact(value,key='',depth=0){
    if(/token|password|secret|authorization|stream.?key/i.test(key))return '[redacted]';
    if(depth>7)return '[nested]';
    if(typeof value==='string')return value.replace(/rtmps?:\/\/[^\s"']+/gi,'rtmps://[redacted]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]').replace(/(token|password|secret|stream[_-]?key)([=:\s]+)[^\s,;"']+/gi,'$1$2[redacted]').slice(0,16000);
    if(Array.isArray(value))return value.slice(-1000).map(v=>redact(v,'',depth+1));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,100).map(([k,v])=>[k,redact(v,k,depth+1)]));
    return value;
  }
  let archive={events:[],samples:[]};
  try{const saved=JSON.parse(localStorage.getItem(HISTORY_KEY)||'null');if(saved&&Array.isArray(saved.events)&&Array.isArray(saved.samples))archive=redact(saved)}catch(_){}
  const fmt=v=>v===null||v===undefined?'нет данных':typeof v==='object'?JSON.stringify(v):String(v);
  function persist(){
    archive.events=archive.events.slice(-500);archive.samples=archive.samples.slice(-960);
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(archive));archiveWarning=''}catch(_){archiveWarning='Браузер не сохранил историю на диск. Скачай JSON до закрытия страницы.'}
  }
  function eventKeyR1219(e){
    const snap=e?.snapshot||{};
    return [e?.at||'',e?.event||'',e?.reason||snap?.reason||'',e?.current||snap?.current||'',e?.lastError||snap?.lastError||'',e?.lastFfmpegLine||snap?.lastFfmpegLine||''].map(txt).join('\u001f');
  }
  function ingest(data){
    lastData=redact(data);const s=lastData?.agent?.status||{};
    // R1219: R803 is canonical. Older names were aliases of the SAME ring and caused
    // the journal to ingest up to four copies of every incident on every refresh.
    const diag=s.diagnosticsR803||s.diagnosticsR802||s.diagnosticsR814||s.diagnosticsR813||{};
    const incoming=Array.isArray(diag?.events)?diag.events:[];
    const beforeCount=archive.events.length;
    const merged=[...archive.events,...incoming].filter(e=>e&&e.at);
    archive.events=[...new Map(merged.map(e=>[eventKeyR1219(e),e])).values()].sort((a,b)=>eventMs(a)-eventMs(b)).slice(-500);
    const journalChanged=archive.events.length!==beforeCount||merged.length!==archive.events.length;
    const now=Date.now(),m=s.metricsR1183||{},r=s.runtimeMetricsR1160K||{};
    const sample={at:m.capturedAt||lastData?.agent?.lastSeen||new Date().toISOString(),receivedAt:new Date().toISOString(),current:s.current,clip:s.clipActive,publisherPid:r.publisherPid??null,videoPid:r.videoPid??null,nodePid:r.nodePid??null,nodeUptimeSeconds:r.nodeUptimeSeconds??null,hostCpuPercent:m.hostCpuPercent??null,cores:m.cores??null,load:m.load??null,availableMemoryBytes:m.availableMemoryBytes??null,nodeRss:r.memoryBytes?.rss??null,audioBytes:r.audioBytesSubmitted??null,videoFrames:r.actualVideoFramesSubmitted??null,audioQueued:r.audioPipeQueuedBytes??null,videoQueued:r.videoPipeQueuedBytes??null,audioNeedsDrain:r.audioPipeNeedsDrain??null,videoNeedsDrain:r.videoPipeNeedsDrain??null,submittedLeadMs:r.submittedLeadMs??null,phaseOffsetFrames:r.phaseOffsetFrames??null,drops:s.audioMasterVideoDropsR1085??null,duplicates:s.audioMasterVideoDuplicatesR1085??null,rtmps:s.rtmpsEstablishedConnectionsR792};
    const prev=ingest.previous,dt=prev?(Date.parse(sample.at)-Date.parse(prev.at))/1000:0;
    if(prev&&dt>0&&dt<90&&sample.publisherPid&&sample.publisherPid===prev.publisherPid&&Number.isFinite(sample.videoFrames)&&Number.isFinite(prev.videoFrames)&&sample.videoFrames>=prev.videoFrames){sample.inputFps=Math.round((sample.videoFrames-prev.videoFrames)/dt*10)/10;sample.audioInputRate=Number.isFinite(sample.audioBytes)&&Number.isFinite(prev.audioBytes)?Math.round((sample.audioBytes-prev.audioBytes)/176400/dt*100)/100:null;}
    if(prev&&dt===0){sample.inputFps=prev.inputFps;sample.audioInputRate=prev.audioInputRate;}
    ingest.previous=sample;ingest.latest=sample;
    if(!archive.samples.length||now-Date.parse(archive.samples.at(-1).receivedAt||archive.samples.at(-1).at)>=60000){archive.samples.push(sample);persist()}
    else if(journalChanged||critical(archive.events.at(-1)||{}))persist();
  }
  function downloadLog(json){
    const body=json?JSON.stringify({version:'R1183',exportedAt:new Date().toISOString(),agentLastSeen:lastData?.agent?.lastSeen,latest:ingest.latest,status:reportStatus(),...archive},null,2):lastFullText;
    const url=URL.createObjectURL(new Blob([body],{type:json?'application/json':'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ANDRIK-RADIO-'+new Date().toISOString().replace(/[:.]/g,'-')+(json?'.json':'.txt');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function reportStatus(){const s=lastData?.agent?.status||{};return redact({agent:lastData?.agent?.version,lastSeen:lastData?.agent?.lastSeen,service:s.service,revision:s.auditRevisionR1160L,radio:s.version,runtime:s.runtimeMetricsR1160K,metrics:s.metricsR1183,watchdog:s.watchdogR1293,transportWatchdogMode:s.transportWatchdogMode,selfHeal:{pending:s.transportSelfHealPending,count:s.transportSelfHealCount,lastFatalAt:s.lastTransportFatalAt,lastFatalReason:s.lastTransportFatalReason},ffmpeg:s.ffmpegLogCountersR1160K,lastError:s.lastError,lastFfmpegLine:s.lastFfmpegLine,lastPostVideoPhase:s.lastPostVideoPhaseR1160L});}
  function markIncident(){archive.events.push({at:new Date().toISOString(),event:'viewer-video-slow-incident',current:lastData?.agent?.status?.current,metrics:ingest.latest||null,note:'Пользователь отметил торможение картинки'});persist();if(lastData)renderDiagnostics(lastData);}


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
      .r908-diag-copy-main{width:100%;min-height:52px;margin-top:12px;border:0;border-radius:14px;font-weight:900;font-size:14px}
      .r908-diag-spoiler{margin-top:10px;border:1px solid #2a3647;border-radius:14px;background:#070b11;overflow:hidden}
      .r908-diag-spoiler>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;list-style:none;padding:14px 15px;color:#dce5f1;font-weight:900}
      .r908-diag-spoiler>summary::-webkit-details-marker{display:none}
      .r908-diag-spoiler>summary::after{content:'⌄';font-size:22px;color:#9ba8ba;transition:transform .18s ease}
      .r908-diag-spoiler[open]>summary::after{transform:rotate(180deg)}
      .r908-diag-spoiler .r813-diag-log{margin:0 10px 10px}
      .r908-diag-spoiler .r813-diag-actions{grid-template-columns:1fr 1fr;margin:0 10px 10px}
      .r908-diag-spoiler .r813-diag-actions button{width:100%}
      .r1293-watch-spoiler{margin:12px 0 0;border:1px solid #2a3647;border-radius:14px;background:#0a1017;overflow:hidden}
      .r1293-watch-spoiler>summary{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;cursor:pointer;list-style:none;padding:11px 12px;color:#f0c75a;font-weight:900;font-size:.72rem;letter-spacing:.04em;text-transform:uppercase}
      .r1293-watch-spoiler>summary::-webkit-details-marker{display:none}
      .r1293-watch-spoiler>summary::after{content:'▾';color:#aebbd0;font-size:1rem;line-height:1}
      .r1293-watch-spoiler[open]>summary::after{content:'▴'}
      .r1293-watch-brief{justify-self:end;color:#7fe29a;font-size:.61rem;letter-spacing:0;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
      .r1293-watch-body{padding:0 8px 8px}
      .r1293-watch-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
      .r1293-watch-grid .youtube-radio-stat-r565{min-height:68px!important;padding:8px 9px!important;border-radius:12px!important;align-content:start}
      .r1293-watch-grid .youtube-radio-stat-r565 small{font-size:.47rem!important;line-height:1.12!important;letter-spacing:.055em!important;word-break:break-word}
      .r1293-watch-grid .youtube-radio-stat-r565 strong{display:block;margin-top:2px;font-size:.67rem!important;line-height:1.22!important;white-space:pre-line!important;overflow:visible!important;text-overflow:clip!important;word-break:break-word}
      .r1293-watch-help{margin:7px 0 0;border:1px solid rgba(145,208,255,.09);border-radius:12px;background:rgba(255,255,255,.025);overflow:hidden}
      .r1293-watch-help>summary{cursor:pointer;list-style:none;padding:8px 10px;color:#aebbd0;font-size:11px;font-weight:800}
      .r1293-watch-help>summary::-webkit-details-marker{display:none}
      .r1293-watch-help>summary::after{content:' ▾';color:#7f91a4}
      .r1293-watch-help[open]>summary::after{content:' ▴'}
      .r1293-watch-help-body{padding:0 10px 9px;color:#aebbd0;font-size:11px;line-height:1.38}
      .r1293-watch-help-body b{color:#eef8ff}
      .r1293-watch-ok{color:#66df8a!important}.r1293-watch-warn{color:#f5c84b!important}.r1293-watch-bad{color:#ff8080!important}
      @media(max-width:420px){.r1293-watch-grid .youtube-radio-stat-r565 strong{font-size:.64rem!important}.r1293-watch-brief{max-width:120px;font-size:.56rem}}
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
    if(ey)ey.textContent='ANDRIK RADIO CONTROL · R1138 SAFE OPS · RTMPS 2/2';

    const gold=document.querySelector('[data-radio-action="gold-restore"]');
    if(gold){
      gold.textContent='🚑 GOLD CORE · ВОССТАНОВИТЬ';
      gold.title='Восстанавливает только radio server.mjs из /opt/andrik-radio/GOLD/GOLD-CURRENT. Текущий server.mjs сохраняется, radio service перезапускается один раз.';
    }
    const start=document.querySelector('[data-radio-action="start"]');
    if(start)start.title='Ручной запуск. Использовать только когда эфир действительно остановлен.';

    const controlCard=gold?.closest('.card');
    if(controlCard&&!document.getElementById('r870SafetyNote')){
      const note=document.createElement('div');
      note.id='r870SafetyNote';note.className='r870-safe-note';
      note.innerHTML='<b>R1138 SAFE OPS:</b> «Переподнять видео» только переоткрывает текущий visual feeder без рестарта radio service. «GOLD CORE» возвращает server.mjs из GOLD-CURRENT с автоматическим rollback и не откатывает Control/Agent/Loudness.';
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

    const profile=document.getElementById('r813Profile');
    if(profile&&!document.getElementById('r1293WatchGrid')){
      const spoiler=document.createElement('details');
      spoiler.id='r1293WatchSpoiler';spoiler.className='r1293-watch-spoiler';
      spoiler.innerHTML='<summary><span>🛡 Ватчдог</span><span class="r1293-watch-brief" id="r1293WatchBrief">ждём данные</span></summary><div class="r1293-watch-body"></div>';
      profile.insertAdjacentElement('afterend',spoiler);
      const body=spoiler.querySelector('.r1293-watch-body');
      const wg=document.createElement('div');wg.id='r1293WatchGrid';wg.className='youtube-radio-stats-r565 r1293-watch-grid';
      wg.innerHTML=`
        <div class="youtube-radio-stat-r565"><small>RTMPS</small><strong id="r1293WatchTransport">ждём данные</strong></div>
        <div class="youtube-radio-stat-r565"><small>ОСНОВНОЙ / РЕЗЕРВ</small><strong id="r1293WatchLanes">—</strong></div>
        <div class="youtube-radio-stat-r565"><small>МАСТЕР-ПОТОК</small><strong id="r1293WatchMaster">—</strong></div>
        <div class="youtube-radio-stat-r565"><small>САМОИСПРАВЛЕНИЕ</small><strong id="r1293WatchHeal">—</strong></div>
        <div class="youtube-radio-stat-r565"><small>MP3 PCM</small><strong id="r1293WatchReservoir">—</strong></div>
        <div class="youtube-radio-stat-r565"><small>SAFE HOLD</small><strong id="r1293WatchHold">—</strong></div>
        <div class="youtube-radio-stat-r565"><small>FPS · ПОСЛЕДНИЕ 60 С</small><strong id="r1293WatchFps">—</strong></div>
        <div class="youtube-radio-stat-r565"><small>ПОСЛЕДНЕЕ СОБЫТИЕ</small><strong id="r1293WatchEvent">—</strong></div>`;
      body.appendChild(wg);
      const help=document.createElement('details');
      help.id='r1293WatchHelp';help.className='r1293-watch-help';
      help.innerHTML='<summary>Что означают показатели?</summary><div class="r1293-watch-help-body"><b>RTMPS</b> — две линии YouTube. <b>Основной / резерв</b> — когда по каждой линии последний раз шли данные. <b>Мастер-поток</b> — внутренний затор перед отправкой. <b>MP3 PCM</b> — запас звука и реальные просадки. <b>FPS 60 с</b> — средняя фактическая подача кадров за последнюю минуту. <b>Последнее событие</b> — последнее действие/ошибка watchdog с временем и причиной. <b>Safe Hold</b> — защита при замене server.mjs.</div>';
      body.appendChild(help);
    }

    if(!document.getElementById('r813Diagnostics')){
      const main=document.querySelector('main.wrap');
      const card=document.createElement('section');card.id='r813Diagnostics';card.className='card r813-diag-card';
      card.innerHTML=`
        <div class="r813-diag-head"><h2>🧾 Журнал эфира</h2><span class="r813-diag-badge" id="r813DiagBadge">R1183 · ждём данные</span></div>
        <div class="r813-diag-summary" id="r813DiagSummary">Загружаю статус и свежие события…</div>
        <button type="button" class="r813-diag-copy r908-diag-copy-main" id="r813CopyLog">📋 СКОПИРОВАТЬ ВЕСЬ ЛОГ</button>
        <div class="r813-diag-actions"><button type="button" class="r813-diag-refresh" id="r1183Mark">Картинка тормозит</button><button type="button" class="r813-diag-refresh" id="r1183Txt">Скачать TXT</button><button type="button" class="r813-diag-refresh" id="r1183Json">Скачать JSON</button></div>
        <label style="display:block;margin-top:12px"><input type="checkbox" id="r1183Problems"> Только ошибки и восстановления</label>
        <details class="r908-diag-spoiler" id="r908DiagSpoiler">
          <summary><span>Показать журнал эфира</span></summary>
          <pre class="r813-diag-log" id="r813DiagLog">Загружаю…</pre>
          <div class="r813-diag-actions"><button type="button" class="r813-diag-refresh" id="r813RefreshLog">↻ Обновить</button><button type="button" class="r813-diag-clear" id="r813ClearLog">Очистить вид</button></div>
          <p class="small" style="margin:9px 12px 13px">История этого браузера: до 500 событий и 960 минутных снимков. Сбор идёт, пока страница открыта и видима; промежутки без данных остаются в истории. На VPS агент R1183 отдельно хранит до 16 часов метрик.</p>
        </details>`;
      if(main)main.appendChild(card);
      document.getElementById('r813CopyLog')?.addEventListener('click',copyAll);
      document.getElementById('r1183Mark')?.addEventListener('click',markIncident);
      document.getElementById('r1183Txt')?.addEventListener('click',()=>downloadLog(false));
      document.getElementById('r1183Json')?.addEventListener('click',()=>downloadLog(true));
      document.getElementById('r1183Problems')?.addEventListener('change',e=>{onlyProblems=e.target.checked;if(lastData)renderDiagnostics(lastData)});
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

  function ageTextR1293(value){const ms=Date.parse(value||'')||0;if(!ms)return '—';const age=Math.max(0,Date.now()-ms);return age<10000?`${Math.round(age/1000)}с`:`${Math.round(age/1000)}с назад`}
  function setWatchClassR1293(id,kind=''){const el=document.getElementById(id);if(!el)return;el.classList.remove('r1293-watch-ok','r1293-watch-warn','r1293-watch-bad');if(kind)el.classList.add('r1293-watch-'+kind)}
  function fmtClockR1227(value){
    const ms=Date.parse(value||'')||0;
    if(!ms)return '—';
    try{return new Date(ms).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(_){return new Date(ms).toISOString().slice(11,19)}
  }
  function avgFpsR1227(){
    const now=Date.now();
    fpsWindowR1227=fpsWindowR1227.filter(x=>now-x.at<=65000&&Number.isFinite(x.fps));
    if(!fpsWindowR1227.length)return null;
    return Math.round((fpsWindowR1227.reduce((a,x)=>a+x.fps,0)/fpsWindowR1227.length)*10)/10;
  }
  function lastWatchEventR1227(s){
    const all=Array.isArray(archive.events)?archive.events:[];
    const matched=all.filter(e=>/watchdog|recycle|transport|self-heal|recovery|stall|no-progress|fatal/i.test(`${e?.event||''} ${e?.reason||''}`));
    let ev=matched.at(-1)||null;
    const fatalAt=s?.lastTransportFatalAt||s?.watchdogR1293?.selfHeal?.lastFatalAt;
    const fatalReason=s?.lastTransportFatalReason||s?.watchdogR1293?.selfHeal?.lastFatalReason;
    if(fatalAt&&(!ev||Date.parse(fatalAt)>eventMs(ev)))ev={at:fatalAt,event:'transport',reason:fatalReason||'ошибка транспорта'};
    return ev;
  }
  function renderWatchdogR1293(s){
    const w=s?.watchdogR1293||{},r=w?.r1125||{},p=r?.primary||{},b=r?.backup||{},rr=w?.r792||{},m=w?.r751||{},h=w?.selfHeal||{};
    const rt=n(s?.rtmpsEstablishedConnectionsR792)||n(rr.lanes),exp=n(s?.rtmpsExpectedConnectionsR792)||n(rr.expected)||2;
    const pSock=p.socket===true,bSock=b.socket===true;
    const transportOk=s?.transportHealthy!==false&&rt>=exp&&(pSock||!p.pid)&&(bSock||!b.pid);
    const tEl=document.getElementById('r1293WatchTransport');if(tEl){tEl.textContent=w?.mode?`${transportOk?'НОРМА':'ПРОВЕРЬ'} · ${w.mode.replace('R1125-LANE-ACK-WATCHDOG','R1125 ACK')}`:(s?.transportHealthy!==false?`Норма · RTMPS ${rt}/${exp}`:'Проверь RTMPS');setWatchClassR1293('r1293WatchTransport',transportOk?'ok':'warn')}
    const currentFps=Number(ingest.latest?.inputFps);
    if(Number.isFinite(currentFps)&&currentFps>=0){fpsWindowR1227.push({at:Date.now(),fps:currentFps});fpsWindowR1227=fpsWindowR1227.slice(-8)}
    const avgFps=avgFpsR1227();
    const source=s?.clipActive?'клип':s?.videoFeederRunning?'MP3':'источник';
    set('r1293WatchFps',avgFps===null?'собираю 30–60 с':`${avgFps.toFixed(1)} кадр/с\n${source}`);
    setWatchClassR1293('r1293WatchFps',avgFps===null?'':avgFps>=24.5?'ok':avgFps>=23?'warn':'bad');
    const lastEv=lastWatchEventR1227(s);
    if(lastEv){
      const reason=txt(lastEv.reason)||txt(lastEv.event)||'событие';
      set('r1293WatchEvent',`${fmtClockR1227(lastEv.at)}\n${reason.slice(0,72)}`);
      setWatchClassR1293('r1293WatchEvent',/error|fatal|stall|no-progress|recycle/i.test(`${lastEv.event||''} ${reason}`)?'warn':'ok');
    }else{
      set('r1293WatchEvent','Нет событий\nза доступный период');
      setWatchClassR1293('r1293WatchEvent','ok');
    }
    const brief=document.getElementById('r1293WatchBrief');
    if(brief)brief.textContent=`${transportOk?'НОРМА':'ПРОВЕРЬ'} · ${rt}/${exp}${avgFps===null?'':` · ${avgFps.toFixed(1)} fps`}`;
    const laneText=`Осн.: ${pSock?'● есть сигнал':'○ нет сигнала'}\nобновление ${ageTextR1293(p.lastProgressAt)}\nРезерв: ${bSock?'● есть сигнал':'○ нет сигнала'}\nобновление ${ageTextR1293(b.lastProgressAt)}`;set('r1293WatchLanes',laneText);setWatchClassR1293('r1293WatchLanes',transportOk?'ok':'warn');
    const bp=Boolean(m.backpressureSince||s?.publisherBackpressureSince);const rec=n(m.recoveries)||n(s?.publisherBackpressureRecoveries);set('r1293WatchMaster',bp?`Есть backpressure\nвосстановлений: ${rec}`:`Норма\nвосстановлений: ${rec}`);setWatchClassR1293('r1293WatchMaster',bp?'warn':'ok');
    const pending=Boolean(h.pending||s?.transportSelfHealPending),healCount=n(h.count)||n(s?.transportSelfHealCount);set('r1293WatchHeal',pending?`Ожидает восстановления\nциклов: ${healCount}`:`Норма\nциклов: ${healCount}`);setWatchClassR1293('r1293WatchHeal',pending?'warn':'ok');
    const rm=s?.runtimeMetricsR1160K||{},buf=n(rm.mp3AudioReservoirBufferedBytesR1293),hi=n(rm.mp3AudioReservoirHighWaterBytesR1293),und=n(rm.mp3PcmLastTrueUnderrunMsR1293),maxUnd=n(rm.mp3PcmMaxTrueUnderrunMsR1293);
    const pct=hi>0?Math.round(buf/hi*100):0;set('r1293WatchReservoir',hi>0?`Буфер ${humanBytesR1015(buf)}/${humanBytesR1015(hi)} · ${pct}%\nпросадка ${und} мс · максимум ${maxUnd} мс`:'Телеметрия R1293 —');setWatchClassR1293('r1293WatchReservoir',maxUnd>=120?'warn':'ok');
    const hold=Boolean(s?.safeRestartBackupHoldActiveR1287);set('r1293WatchHold',hold?'Включено\nрезерв удерживается':'Выключено\nобычный режим 2/2');setWatchClassR1293('r1293WatchHold',hold?'warn':'ok');
  }

  function oneLine(v,max=900){return txt(v).replace(/\s+/g,' ').slice(0,max)}
  function eventText(e,index){
    const safe=redact(e),parts=[`#${index+1}  ${txt(safe.at)||'—'}  ${txt(safe.event)||'event'}`];
    for(const [key,value] of Object.entries(safe)){if(key==='at'||key==='event'||value===undefined)continue;parts.push(`  ${key}: ${fmt(value).replace(/\n/g,'\n    ')}`)}
    return parts.join('\n');
  }
  function diagParts(data){
    const s=data?.agent?.status||{},allEvents=archive.events,fresh=freshEventsR870(allEvents),latest=allEvents.at(-1)||null;
    return {s,allEvents,fresh,latest,latestAgeMs:latest?Math.max(0,Date.now()-eventMs(latest)):0};
  }
  function buildText(data){
    const {s,allEvents,fresh}=diagParts(data);const p=s.streamProfileR814||s.streamProfileR813||{};const exp=expectedLanes(s,p.transport||{});
    const hdr=['ANDRIK RADIO R1183 DIAGNOSTIC COPY',`captured: ${new Date().toISOString()}`,`agent: ${txt(data?.agent?.version)||'—'} · radio: ${txt(s.version)||'—'}`,
      `service: ${txt(s.service)||'—'} · producer=${Boolean(s.producer)} · publisher=${Boolean(s.publisher)} · videoFeeder=${Boolean(s.videoFeederRunning)} · clip=${Boolean(s.clipActive)}`,
      `current: ${txt(s.current)||'—'}`,`next: ${txt(s.next)||'—'}`,`RTMPS: ${n(s.rtmpsEstablishedConnectionsR792)}/${exp} · transportHealthy=${s.transportHealthy!==false}`,
      `handoff: ${txt(s.videoHandoffMode)||txt(p?.handoff?.mode)||'—'} · cleanCount=${n(s.r813CleanHandoffCount)||n(p?.handoff?.cleanCount)}`,
      `video: ${txt(p?.video?.codec)||'H.264 / AVC'} · ${n(p?.video?.width)||1920}x${n(p?.video?.height)||1080} · ${n(p?.video?.fps)||25}fps · ${txt(p?.video?.bitrate)||'6000k'} · GOP ${n(p?.video?.gopFrames)||50} · B=${Number.isFinite(Number(p?.video?.bFrames))?Number(p.video.bFrames):0}`,
      `audio: ${txt(p?.audio?.codec)||'AAC-LC'} · ${n(p?.audio?.sampleRate)||44100}Hz · ${txt(p?.audio?.channelLayout)||'stereo'} · ${txt(p?.audio?.bitrate)||'160k'}`,
      `disk: ${txt(s?.diskRootR1015?.filesystem)||'—'} · total ${humanBytesR1015(s?.diskRootR1015?.totalBytes)} · used ${humanBytesR1015(s?.diskRootR1015?.usedBytes)} · free ${humanBytesR1015(s?.diskRootR1015?.availableBytes)} · usage ${n(s?.diskRootR1015?.usedPercent)}%`,
      `recovery: screen=${Boolean(s?.recoveryR1015?.screenReady)} · safeR974=${Boolean(s?.recoveryR1015?.safeR974)} · gold=${Boolean(s?.recoveryR1015?.goldReady)} · latest=${txt(s?.recoveryR1015?.latestGold)||'—'}`,
      `lastError: ${txt(s.lastError)||'—'}`,`lastFfmpegLine: ${txt(s.lastFfmpegLine)||'—'}`,'',`EVENT HISTORY (${allEvents.length}/500 · fresh2h=${fresh.length}; normal events are included)`];
    return hdr.concat(['AGENT LAST SEEN: '+fmt(data?.agent?.lastSeen),'RUNTIME / ERROR DETAILS\n'+JSON.stringify(reportStatus(),null,2),'LATEST SAMPLE\n'+JSON.stringify(ingest.latest||{},null,2),'METRIC HISTORY (minute samples; gaps are not interpolated)\n'+archive.samples.map(x=>JSON.stringify(x)).join('\n'),'Submitted lead is the input-queue relationship, NOT viewer A/V latency. Input FPS is NOT measured YouTube playback FPS.'],allEvents.map((e,i)=>eventText(e,i))).join('\n\n');
  }

  function renderDiagnostics(data){
    const {s,allEvents}=diagParts(data),m=ingest.latest||{},rt=n(s.rtmpsEstablishedConnectionsR792),exp=expectedLanes(s,s.streamProfileR814?.transport||{});
    const seen=Date.parse(data?.agent?.lastSeen||'')||0,age=seen?Math.max(0,Date.now()-seen):null,stale=age===null||age>75000;
    const incident=allEvents.filter(critical).at(-1),recent=incident&&Date.now()-eventMs(incident)<120000;
    const stalled=Number.isFinite(m.inputFps)&&m.inputFps<20,transport=s.transportHealthy===true&&rt>=exp;
    const badge=document.getElementById('r813DiagBadge');if(badge){badge.textContent=stale?'Данные устарели':stalled?'Подача видео замедлена':recent?'Недавнее восстановление / ошибка':transport?'Транспорт подключён':'Проверь транспорт';badge.className='r813-diag-badge '+(stale||stalled||recent?'r813-warn':transport?'r813-ok':'r813-bad')}
    const summary=document.getElementById('r813DiagSummary');
    if(summary)summary.innerHTML=`<b>R1183 · ${esc(s.auditRevisionR1160L||s.version||'версия не передана')}</b><br>RTMPS ${rt}/${exp} · путь видео: ${s.clipActive?'клип / заставка':s.videoFeederRunning?'MP3-фон':'не подтверждён'} · возраст данных: ${age===null?'неизвестен':Math.round(age/1000)+' с'}<br>Подача видео: <b>${esc(fmt(m.inputFps))}</b> кадров/с · CPU VPS: ${esc(fmt(m.hostCpuPercent))}${m.hostCpuPercent===null?'':'%'} · ядер: ${esc(fmt(m.cores))}<br>Очереди: audio ${esc(fmt(m.audioQueued))} B / video ${esc(fmt(m.videoQueued))} B · пропуски ${esc(fmt(m.drops))} / повторы ${esc(fmt(m.duplicates))}<br>PID кодировщика ${esc(fmt(m.publisherPid))} · PID фона ${esc(fmt(m.videoPid))} · память Node ${m.nodeRss===null?'нет данных':esc(humanBytesR1015(m.nodeRss))}<br>Load average ${esc(fmt(m.load))} · входная фаза ${esc(fmt(m.submittedLeadMs))} мс (это не задержка у зрителя)<br>${incident?'Последний инцидент: '+esc(incident.at)+' · '+esc(incident.event):'В доступной истории инцидентов нет.'}<br>Watchdog: ${esc(txt(s?.watchdogR1293?.mode)||txt(s?.transportWatchdogMode)||'—')} · self-heal ${Boolean(s?.transportSelfHealPending||s?.watchdogR1293?.selfHeal?.pending)?'PENDING':'OK'} · recovery ${n(s?.transportSelfHealCount)||n(s?.watchdogR1293?.selfHeal?.count)}<br>MP3 reservoir: ${esc(fmt(s?.runtimeMetricsR1160K?.mp3AudioReservoirBufferedBytesR1293))}/${esc(fmt(s?.runtimeMetricsR1160K?.mp3AudioReservoirHighWaterBytesR1293))} B · true underrun ${esc(fmt(s?.runtimeMetricsR1160K?.mp3PcmLastTrueUnderrunMsR1293))} ms<br>${!s.runtimeMetricsR1160K?'Для очередей и счётчиков нужны server R1160L и агент R1183. ':''}RTMPS-соединение само по себе не подтверждает плавность картинки.${archiveWarning?'<br>'+esc(archiveWarning):''}`;
    lastFullText=buildText(data);
    const view=allEvents.filter(e=>(!hiddenBefore||eventMs(e)>=hiddenBefore)&&(!onlyProblems||critical(e)));
    const log=document.getElementById('r813DiagLog');if(log)log.textContent='Обновлено: '+new Date().toISOString()+'\n\n'+(view.length?view.map(eventText).join('\n\n'):'Нет событий по выбранному фильтру. Полная история доступна в TXT / JSON.');
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
    if(!confirm('🚑 GOLD CORE: восстановить server.mjs из /opt/andrik-radio/GOLD/GOLD-CURRENT?\n\nТекущий server.mjs будет сохранён. Control/Agent/Loudness не откатываются. Radio service перезапустится один раз.'))return;
    safeGoldBusy=true;const b=document.querySelector('[data-radio-action="gold-restore"]');const old=b?.textContent||'';if(b){b.disabled=true;b.textContent='🚑 ВОССТАНАВЛИВАЮ…'};setRemoteMessage('🚑 Восстанавливаю radio core из GOLD-CURRENT…','work');
    try{const d=await runAgentActionR870('gold-restore');setRemoteResult(`${String(d.result?.output||'GOLD CORE RESTORE ✅')}\n\nR1138 SAFE OPS: control-agent и loudness не откатываются; при ошибке helper возвращает предыдущий server.mjs.`);setRemoteMessage('GOLD восстановлен ✅ · проверяю статус OVH','ok');await sleep(3500);await window.AndrikRadioRemoteR867?.refresh?.().catch?.(()=>{});await refresh(false)}
    catch(e){setRemoteResult(`GOLD RESTORE ERROR\n${e.message||e}`);setRemoteMessage(`GOLD restore: ${e.message||e}`,'bad')}
    finally{safeGoldBusy=false;if(b){b.disabled=false;b.textContent=old||'🚑 GOLD CORE · ВОССТАНОВИТЬ'}}
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
    ensureUi();const badge=document.getElementById('r813DiagBadge');if(manual&&badge)badge.textContent='R1183 · обновляю…';
    try{const d=await api(STATUS_API);ingest(d);const s=lastData?.agent?.status||{};renderProfile(s);renderWatchdogR1293(s);renderDiagnostics(lastData);tunePanelR870();return d}
    catch(error){
      try{
        const p=await api(PUBLIC_STATUS_API);
        const d={ok:true,publicFallback:true,agent:{version:p.agentVersion||'PUBLIC',lastSeen:p.lastSeen||null,status:p}};
        ingest(d);const s=lastData?.agent?.status||{};renderProfile(s);renderWatchdogR1293(s);renderDiagnostics(lastData);tunePanelR870();
        if(badge){badge.textContent='R1293 · PUBLIC FALLBACK';badge.className='r813-diag-badge r813-warn'}
        return d;
      }catch(publicError){
        if(badge){badge.textContent='R1293 · нет данных';badge.className='r813-diag-badge r813-bad'}const log=document.getElementById('r813DiagLog');if(log)log.textContent=`Диагностика недоступна: ${error?.message||error}; fallback: ${publicError?.message||publicError}`;const summary=document.getElementById('r813DiagSummary');if(summary)summary.textContent='Свежий статус недоступен. Последний сохранённый лог можно скачать; его данные не подтверждают текущее состояние эфира.';return null
      }
    }
  }

  function arm(){if(timer)clearInterval(timer);timer=null;if(document.hidden)return;timer=setInterval(()=>refresh(false),15000)}
  const boot=()=>{installSafetyCapture();ensureUi();refresh(false);arm()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer)clearInterval(timer);timer=null}else{refresh(false);arm()}});
  window.AndrikRadioObservabilityR870={refresh,safeGoldRestoreR870};
})();
