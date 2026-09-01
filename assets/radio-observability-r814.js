(()=>{
  'use strict';

  const API='/api/control/radio-remote-r627/status';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txt=v=>String(v??'').trim();
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  let lastFullText='';
  let hiddenBefore=0;
  let timer=null;

  function addStyle(){
    if(document.getElementById('r813ObservabilityStyle'))return;
    const s=document.createElement('style');
    s.id='r813ObservabilityStyle';
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
      @media(max-width:560px){.r813-profile{grid-template-columns:repeat(2,minmax(0,1fr))!important}.r813-diag-actions{grid-template-columns:1fr 1fr}.r813-diag-copy{grid-column:1/-1}}
    `;
    document.head.appendChild(s);
  }

  function ensureUi(){
    addStyle();

    const radio=document.getElementById('youtubeRadioR565');
    if(radio&&!document.getElementById('r813Profile')){
      const firstStats=document.getElementById('radioInventoryR835')||radio.querySelector('.youtube-radio-stats-r565:not(.youtube-radio-youtube-stats-r565)');
      if(firstStats){
        const title=document.createElement('div');
        title.className='r813-profile-title';
        title.id='r813ProfileTitle';
        title.textContent='Параметры эфира';
        const grid=document.createElement('div');
        grid.id='r813Profile';
        grid.className='youtube-radio-stats-r565 r813-profile';
        grid.innerHTML=`
          <div class="youtube-radio-stat-r565"><small>ВИДЕО КОДЕК</small><strong id="r813VideoCodec">H.264 / AVC</strong></div>
          <div class="youtube-radio-stat-r565"><small>КАРТИНКА</small><strong id="r813VideoGeometry">1920×1080 · 25 fps</strong></div>
          <div class="youtube-radio-stat-r565"><small>ВИДЕО БИТРЕЙТ</small><strong id="r813VideoBitrate">6000 kb/s</strong></div>
          <div class="youtube-radio-stat-r565"><small>GOP / B-FRAMES</small><strong id="r813VideoGop">50 / 0</strong></div>
          <div class="youtube-radio-stat-r565"><small>АУДИО КОДЕК</small><strong id="r813AudioCodec">AAC-LC</strong></div>
          <div class="youtube-radio-stat-r565"><small>АУДИО</small><strong id="r813AudioFormat">44.1 kHz · stereo</strong></div>
          <div class="youtube-radio-stat-r565"><small>АУДИО БИТРЕЙТ</small><strong id="r813AudioBitrate">160 kb/s</strong></div>
          <div class="youtube-radio-stat-r565"><small>ТРАНСПОРТ</small><strong id="r813Transport">FLV · RTMPS × —</strong></div>
        `;
        firstStats.insertAdjacentElement('afterend',title);
        title.insertAdjacentElement('afterend',grid);
      }
    }

    if(!document.getElementById('r813Diagnostics')){
      const main=document.querySelector('main.wrap');
      const card=document.createElement('section');
      card.id='r813Diagnostics';
      card.className='card r813-diag-card';
      card.innerHTML=`
        <div class="r813-diag-head">
          <h2>🧾 Журнал эфира</h2>
          <span class="r813-diag-badge" id="r813DiagBadge">R814 · ждём данные</span>
        </div>
        <div class="r813-diag-summary" id="r813DiagSummary">Загружаю последние ошибки и handoff-события…</div>
        <pre class="r813-diag-log" id="r813DiagLog">Загружаю…</pre>
        <div class="r813-diag-actions">
          <button type="button" class="r813-diag-copy" id="r813CopyLog">📋 СКОПИРОВАТЬ ВЕСЬ ЛОГ</button>
          <button type="button" class="r813-diag-refresh" id="r813RefreshLog">↻ Обновить</button>
          <button type="button" class="r813-diag-clear" id="r813ClearLog">Очистить вид</button>
        </div>
        <p class="small" style="margin:9px 2px 0">Очистить вид не удаляет журнал на OVH. Stream key и RTMPS-адреса в диагностике скрываются агентом.</p>
      `;
      if(main)main.appendChild(card);

      document.getElementById('r813CopyLog')?.addEventListener('click',copyAll);
      document.getElementById('r813RefreshLog')?.addEventListener('click',()=>refresh(true));
      document.getElementById('r813ClearLog')?.addEventListener('click',()=>{
        hiddenBefore=Date.now();
        const log=document.getElementById('r813DiagLog');
        if(log)log.textContent='Вид очищен. Новые события появятся автоматически.';
      });
    }
  }

  function set(id,value){
    const el=document.getElementById(id);
    if(el)el.textContent=String(value??'—');
  }

  function bitrate(v,fallback){
    const s=txt(v)||fallback;
    return /k$/i.test(s)?`${s.replace(/k$/i,'')} kb/s`:s;
  }

  function renderProfile(s){
    const p=s?.streamProfileR814||s?.streamProfileR813||{};
    const v=p.video||{};
    const a=p.audio||{};
    const tr=p.transport||{};
    const fps=n(v.fps)||25;
    const w=n(v.width)||1920,h=n(v.height)||1080;
    const sr=n(a.sampleRate)||44100;
    const lanes=n(tr.lanes)||n(s?.rtmpsEstablishedConnectionsR792);
    const expected=n(tr.expectedLanes)||n(s?.rtmpsExpectedConnectionsR792)||2;

    set('r813VideoCodec',txt(v.codec)||'H.264 / AVC');
    set('r813VideoGeometry',`${w}×${h} · ${fps} fps`);
    set('r813VideoBitrate',bitrate(v.bitrate,'6000k'));
    set('r813VideoGop',`${n(v.gopFrames)||50} / ${Number.isFinite(Number(v.bFrames))?Number(v.bFrames):0}`);
    set('r813AudioCodec',txt(a.codec)||'AAC-LC');
    set('r813AudioFormat',`${(sr/1000).toFixed(sr%1000?1:0)} kHz · ${txt(a.channelLayout)||'stereo'}`);
    set('r813AudioBitrate',bitrate(a.bitrate,'160k'));
    set('r813Transport',`${txt(tr.container)||'FLV'} · ${txt(tr.protocol)||'RTMPS'} × ${lanes}/${expected}`);
  }

  function oneLine(v,max=900){
    return txt(v).replace(/\s+/g,' ').slice(0,max);
  }

  function eventText(e,index){
    const at=txt(e?.at)||'—';
    const event=txt(e?.event)||txt(e?.reason)||'event';
    const parts=[`#${index+1}  ${at}  ${event}`];
    for(const k of ['current','next','service','publisher','producer','videoFeederRunning','clipActive','rtmps','transportHealthy','oldPid','candidatePid','bootstrapBytes','readyMs','totalMs','sinkDrained','oldClosed','reason','lastError','lastFfmpegLine']){
      if(e?.[k]!==undefined && e?.[k]!==null && txt(e[k])!=='')parts.push(`  ${k}: ${oneLine(e[k],1200)}`);
    }
    if(e?.ffmpeg)parts.push(`  ffmpeg:\n${txt(e.ffmpeg).split('\n').slice(-12).map(x=>'    '+x).join('\n')}`);
    if(e?.serviceStats)parts.push(`  service:\n${txt(e.serviceStats).split('\n').slice(-8).map(x=>'    '+x).join('\n')}`);
    if(e?.journal)parts.push(`  journal:\n${txt(e.journal).split('\n').slice(-24).map(x=>'    '+x).join('\n')}`);
    return parts.join('\n');
  }

  function buildText(data){
    const s=data?.agent?.status||{};
    const diag=s.diagnosticsR814||s.diagnosticsR813||s.diagnosticsR803||s.diagnosticsR802||{};
    const events=(Array.isArray(diag.events)?diag.events:[])
      .filter(e=>!hiddenBefore || Date.parse(e?.at||0)>=hiddenBefore)
      .slice(-30);
    const p=s.streamProfileR814||s.streamProfileR813||{};
    const hdr=[
      'ANDRIK RADIO R814 DIAGNOSTIC COPY',
      `captured: ${new Date().toISOString()}`,
      `agent: ${txt(data?.agent?.version)||'—'} · radio: ${txt(s.version)||'—'}`,
      `service: ${txt(s.service)||'—'} · producer=${Boolean(s.producer)} · publisher=${Boolean(s.publisher)} · videoFeeder=${Boolean(s.videoFeederRunning)} · clip=${Boolean(s.clipActive)}`,
      `current: ${txt(s.current)||'—'}`,
      `next: ${txt(s.next)||'—'}`,
      `RTMPS: ${n(s.rtmpsEstablishedConnectionsR792)}/${n(s.rtmpsExpectedConnectionsR792)||2} · transportHealthy=${s.transportHealthy!==false}`,
      `handoff: ${txt(s.videoHandoffMode)||txt(p?.handoff?.mode)||'—'} · cleanCount=${n(s.r813CleanHandoffCount)||n(p?.handoff?.cleanCount)}`,
      `video: ${txt(p?.video?.codec)||'H.264 / AVC'} · ${n(p?.video?.width)||1920}x${n(p?.video?.height)||1080} · ${n(p?.video?.fps)||25}fps · ${txt(p?.video?.bitrate)||'6000k'} · GOP ${n(p?.video?.gopFrames)||50} · B=${Number.isFinite(Number(p?.video?.bFrames))?Number(p.video.bFrames):0}`,
      `audio: ${txt(p?.audio?.codec)||'AAC-LC'} · ${n(p?.audio?.sampleRate)||44100}Hz · ${txt(p?.audio?.channelLayout)||'stereo'} · ${txt(p?.audio?.bitrate)||'160k'}`,
      `lastError: ${txt(s.lastError)||'—'}`,
      `lastFfmpegLine: ${txt(s.lastFfmpegLine)||'—'}`,
      '',
      `EVENTS (${events.length}/30)`
    ];
    return hdr.concat(events.map((e,i)=>eventText(e,i))).join('\n\n');
  }

  function renderDiagnostics(data){
    const s=data?.agent?.status||{};
    const diag=s.diagnosticsR814||s.diagnosticsR813||s.diagnosticsR803||s.diagnosticsR802||{};
    const events=(Array.isArray(diag.events)?diag.events:[])
      .filter(e=>!hiddenBefore || Date.parse(e?.at||0)>=hiddenBefore)
      .slice(-30);
    const bad=txt(s.lastError);
    const rt=n(s.rtmpsEstablishedConnectionsR792), exp=n(s.rtmpsExpectedConnectionsR792)||2;
    const badge=document.getElementById('r813DiagBadge');
    if(badge){
      badge.textContent=`R814 · ${events.length} событий`;
      badge.className='r813-diag-badge '+(s.transportHealthy!==false&&rt>0?'r813-ok':'r813-bad');
    }
    const summary=document.getElementById('r813DiagSummary');
    if(summary){
      const liveHealthy=(s.transportHealthy!==false&&rt>0);
      summary.innerHTML=`<b>${liveHealthy?'🟢':'🔴'} transport:</b> ${liveHealthy?'healthy':'problem'} · <b>RTMPS:</b> ${rt}/${exp} · <b>video feeder:</b> ${s.videoFeederRunning?'✅':'❌'} · <b>handoff:</b> ${esc(txt(s.videoHandoffMode)||'—')}${bad?`<br><b class="r813-bad">lastError:</b> ${esc(bad)}`:''}`;
    }
    lastFullText=buildText(data);
    const log=document.getElementById('r813DiagLog');
    if(log){
      if(!events.length)log.textContent='Свежих аварийных событий нет. Текущий статус всё равно попадёт в «Скопировать весь лог».';
      else log.textContent=events.map((e,i)=>eventText(e,i)).join('\n\n────────────────────────────────────────\n\n');
    }
  }

  async function copyAll(){
    const b=document.getElementById('r813CopyLog');
    const original=b?.textContent||'📋 СКОПИРОВАТЬ ВЕСЬ ЛОГ';
    try{
      if(!lastFullText)await refresh(true);
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(lastFullText);
      else{
        const ta=document.createElement('textarea');
        ta.value=lastFullText;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
        document.execCommand('copy');ta.remove();
      }
      if(b)b.textContent='✅ СКОПИРОВАНО';
    }catch(_){
      if(b)b.textContent='❌ НЕ СКОПИРОВАЛО';
    }
    setTimeout(()=>{if(b)b.textContent=original},1600);
  }

  async function refresh(manual=false){
    ensureUi();
    const badge=document.getElementById('r813DiagBadge');
    if(manual&&badge)badge.textContent='R814 · обновляю…';
    try{
      const r=await fetch(API,{credentials:'include',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache'}});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.message||d.error||`HTTP ${r.status}`);
      const s=d?.agent?.status||{};
      renderProfile(s);
      renderDiagnostics(d);
    }catch(error){
      if(badge){badge.textContent='R814 · нет данных';badge.className='r813-diag-badge r813-bad'}
      const log=document.getElementById('r813DiagLog');
      if(log)log.textContent=`Диагностика недоступна: ${error?.message||error}`;
    }
  }

  function arm(){
    if(timer)clearInterval(timer);
    timer=null;
    if(document.hidden)return;
    timer=setInterval(()=>refresh(false),5000);
  }

  const boot=()=>{ensureUi();refresh(false);arm()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer)clearInterval(timer);timer=null}else{refresh(false);arm()}});
})();
