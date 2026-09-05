// R926 AIR CONTROL · PROVEN SCREEN RESTORE RETURNED
(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v))}catch(_){return String(v)}};
  const num=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));
  const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let busy=false,timer=null,tickerTimer=null,tickerSaving=false,lastServerTicker='',lastRemote=null;

  async function api(path,opts={}){
    const r=await fetch(path,{...opts,credentials:'include',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache',...(opts.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(d.message||d.error||`HTTP ${r.status}`);e.data=d;e.status=r.status;throw e}
    return d;
  }
  function setMsg(text,kind=''){document.querySelectorAll('[data-radio-remote-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind})}
  function setTickerMsg(text,kind=''){document.querySelectorAll('[data-radio-ticker-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind})}
  function setResult(text){document.querySelectorAll('[data-radio-result]').forEach(el=>el.textContent=String(text||'').trim()||'Последний результат появится здесь.')}
  function setWatch(url=''){document.querySelectorAll('[data-radio-watch]').forEach(a=>{a.hidden=!url;if(url)a.href=url})}
  function tickerTextFrom(data){return String(data?.ticker?.text ?? data?.agent?.status?.ticker ?? '').trim()}
  function ytLife(data){return String(data?.lifeCycleStatus||'').toLowerCase().replace(/[^a-z]/g,'')}
  function ytStream(data){return String(data?.streamStatus||'').toLowerCase()}
  function agentVersion(data=lastRemote){return String(data?.agent?.version||'').trim()}
  function agentNumber(data=lastRemote){const m=agentVersion(data).match(/R(\d{3})/i);return m?Number(m[1]):0}
  function hasR665Agent(data=lastRemote){return agentNumber(data)>=665}
  function hasR867Agent(data=lastRemote){return agentNumber(data)>=867}
  function hasR926Agent(data=lastRemote){return agentNumber(data)>=926}

  function render(data){
    lastRemote=data||null;
    const online=Boolean(data?.online),paired=Boolean(data?.paired),agent=data?.agent||{},s=agent.status||{},cmd=data?.command||{},rawRes=data?.result||{};
    const legacyFullFit=String(cmd?.action||rawRes?.action||'').toLowerCase()==='full-fit'||/full-fit/i.test(String(rawRes?.output||''));
    const res=legacyFullFit?{}:rawRes;
    const version=String(agent.version||'').trim();
    document.querySelectorAll('[data-radio-remote-state]').forEach(el=>{
      el.textContent=!paired?'OVH не привязан':online?'OVH ONLINE':'OVH OFFLINE';
      el.className='service-access-state '+(online?'is-ready':paired?'':'is-error');
    });
    document.querySelectorAll('[data-radio-remote-detail]').forEach(el=>{
      const err=String(s.lastError||'').trim();
      el.innerHTML=`<b>${online?'🟢':'⚪'} OVH:</b> ${online?'на связи':'нет свежего heartbeat'} · ${esc(fmt(agent.lastSeen))}${version?` · <b>Agent:</b> ${esc(version)}`:''}<br><b>Radio:</b> ${esc(s.service||'—')} · producer ${s.producer?'✅':'—'} · publisher ${s.publisher?'✅':'—'}<br><b>Сейчас:</b> ${esc(s.current||'—')}<br><b>Дальше:</b> ${esc(s.next||'—')}${err?`<br><b style="color:#ff8080">FFmpeg:</b> ${esc(err)}`:''}`;
    });
    // R805: exact LIVE library counters come from the running radio itself via the single R803 agent.
    // This avoids guessing from R2 and reflects duplicate-single suppression + disabled albums exactly.
    const inventoryReady=String(s.inventoryTelemetry||'').startsWith('R805-') || Number(s.libraryTracks||0)>0;
    if(inventoryReady){
      setText('youtubeRadioSongsR805',num(s.libraryTracks));
      setText('youtubeRadioTracksR565',num(s.libraryAlbumTracks));
      setText('youtubeRadioSinglesR805',num(s.librarySingleTracks));
      setText('youtubeRadioVideosR805',num(s.libraryVideos));
      setText('youtubeRadioStationR805',num(Number(s.libraryBumpers||0)+Number(s.librarySpecial||0)));
    }
    const commandState=String(cmd?.state||'');
    const commandStarted=Date.parse(cmd?.claimedAt||cmd?.createdAt||'')||0;
    const commandAge=commandStarted?Date.now()-commandStarted:0;
    const activeRaw=!legacyFullFit&&['queued','running'].includes(commandState);
    const active=activeRaw&&commandAge<185000;
    const stale=activeRaw&&commandAge>=185000;
    const r867Only=new Set(['gold-restore','cache-clean','soft-restart']);
    const r926Only=new Set(['screen-restore']);
    document.querySelectorAll('[data-radio-action]').forEach(b=>{
      const action=String(b.dataset.radioAction||'');
      const needsR867=r867Only.has(action),needsR926=r926Only.has(action);
      b.disabled=busy||active||!online||(needsR867&&!hasR867Agent(data))||(needsR926&&!hasR926Agent(data));
      b.title=!online?'OVH Agent offline':needsR926&&!hasR926Agent(data)?'Нужен OVH Agent R926':needsR867&&!hasR867Agent(data)?'Нужен OVH Agent R867':' ';
    });
    document.querySelectorAll('[data-radio-command-state]').forEach(el=>{
      el.textContent=stale?`⚠ ${cmd.action||'команда'} зависла — управление разблокировано`:active?`OVH: ${cmd.action} · ${cmd.state==='queued'?'в очереди':'выполняется…'}`:res?.finishedAt?`${res.ok?'✅':'❌'} ${res.action||''} · ${fmt(res.finishedAt)}`:'Готов к команде';
    });
    if(stale)setMsg('⚠ Предыдущая команда зависла больше 3 минут. Кнопки разблокированы.','bad');
    const out=String(res.output||'').trim();
    if(out&&!busy)setResult(out);
    const watch=out.match(/https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+/)?.[0]||'';
    if(watch)setWatch(watch);
    const ticker=tickerTextFrom(data);lastServerTicker=ticker;
    document.querySelectorAll('[data-radio-ticker-input]').forEach(el=>{if(document.activeElement!==el&&el.value!==ticker)el.value=ticker});
    document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=ticker||'—');
  }

  async function refresh(){
    try{const d=await api('/api/control/radio-remote-r627/status');render(d);return d}
    catch(e){setMsg(e.status===401?'Нужен вход владельца.':`OVH статус: ${e.message}`,'bad');return null}
  }

  async function waitAgent(action,createdAt,id){
    const createdMs=Date.parse(createdAt||'')||Date.now();
    const until=Date.now()+105000;
    while(Date.now()<until){
      await sleep(1700);
      const d=await refresh();if(!d)continue;
      const r=d.result||{},c=d.command||{};
      const doneAt=Date.parse(r.finishedAt||'')||0;
      if(r.action===action&&doneAt>=createdMs-1500){
        if(!r.ok)throw new Error(String(r.output||`${action} failed`).trim());
        return d;
      }
      if(c.id===id&&['queued','running'].includes(String(c.state||'')))continue;
    }
    throw new Error(`OVH не завершил ${action} за 105 сек.`);
  }

  async function agentAction(action){
    const d=await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});
    const c=d.command||{};
    return waitAgent(action,c.createdAt,c.id);
  }

  async function youtubeState(){return api(`/api/control/youtube-live-r565?active=1&fresh=1&t=${Date.now()}`)}

  async function ensureAutoStartWhenEditable(state){
    const life=ytLife(state),stream=ytStream(state);
    if(!['created','ready'].includes(life)||stream==='active')return {skipped:true,life,stream};
    try{return await api('/api/control/youtube-live-r609/auto',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})}
    catch(e){if(e.status===409)return {skipped:true,life,stream,message:e.message};throw e}
  }

  async function transitionLive(){
    let last=null;
    for(let i=0;i<13;i++){
      try{
        const d=await api('/api/control/youtube-live-r609/start',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
        last=d;if(d.watchUrl)setWatch(d.watchUrl);
        if(d.ok||['live','livestarting'].includes(ytLife(d)))return d;
      }catch(e){
        last=e.data||{error:e.message};
        const recoverable=e.status===409&&/inactive|encoder/i.test(`${e.data?.error||''} ${e.message||''}`);
        if(!recoverable)throw e;
      }
      setMsg(`OVH encoder запущен. Жду сигнал YouTube… ${i+1}/13`,'work');
      await sleep(5000);
    }
    const err=new Error(last?.message||last?.error||'YouTube не увидел encoder за 65 секунд.');err.data=last;throw err;
  }

  async function ensureLiveR689(){
    let last=null,lastData=null;
    for(let i=0;i<36;i++){
      try{
        const d=await api('/api/control/youtube-live-r689/ensure',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
        lastData=d;
        if(d.watchUrl)setWatch(d.watchUrl);
        const life=ytLife(d);
        if(d.ok||life==='live')return d;
        if(d.pending){
          const stage=String(d.stage||'').toLowerCase();
          const label=life==='testing'||stage==='live'?'TESTING готов ✅ Перевожу в LIVE…':
            life==='teststarting'||stage==='testing'?'Сигнал есть ✅ Перевожу READY → TESTING…':
            life==='ready'?'Сигнал есть ✅ Запускаю TESTING перед LIVE…':
            life==='created'?'Broadcast создан. Жду READY после привязки…':
            'YouTube запускает эфир…';
          setMsg(`${label} ${i+1}/36`,'work');
          await sleep(3000);
          continue;
        }
        throw new Error(d.message||d.error||`YouTube не запустился. Статус: ${d.lifeCycleStatus||'unknown'}`);
      }catch(e){
        last=e;
        const waiting=e.status===409&&['youtube-active-stream-not-found','youtube-stream-binding-pending'].includes(String(e.data?.error||''));
        if(!waiting)throw e;
        setMsg(`OVH encoder работает. Жду ACTIVE stream / bind на YouTube… ${i+1}/36`,'work');
        await sleep(3000);
      }
    }
    const state=lastData?.lifeCycleStatus||last?.data?.lifeCycleStatus||'unknown';
    throw last||new Error(`YouTube не перешёл в LIVE. Последний статус: ${state}.`);
  }

  async function startSequence({recover=false}={}){
    if(busy)return;busy=true;render(lastRemote||{});
    try{
      setMsg(recover?'Восстанавливаю эфир R715…':'Запускаю эфир R715…','work');
      const before=await youtubeState().catch(()=>null);
      if(before&&ytLife(before)==='live'&&ytStream(before)==='active'&&!recover){
        if(before.watchUrl)setWatch(before.watchUrl);
        setResult(`YouTube уже LIVE ✅${before.watchUrl?`\n${before.watchUrl}`:''}`);
        setMsg('Эфир уже идёт ✅','ok');return;
      }

      const modern=hasR665Agent();
      if(modern){
        // R867: START must not bounce an already healthy encoder. systemctl start is idempotent.
        setMsg('Запускаю OVH encoder без stop/restart…','work');
        await agentAction('encoder-start');
      }else{
        setMsg(`${agentVersion()||'Старый агент'}: запускаю OVH encoder…`,'work');
        await agentAction('start');
      }

      setMsg('OVH encoder запущен. Нахожу ACTIVE stream, bind и запускаю YouTube LIVE…','work');
      await sleep(2500);
      const live=await ensureLiveR689();
      const url=live.watchUrl||'';if(url)setWatch(url);
      const mode=live.mode==='create-and-bind'?'создан новый эфир + bind':live.mode==='rebind-existing'?'существующий эфир перепривязан':live.mode==='reuse-bound'?'активная связка восстановлена':(live.mode||'готово');
      setResult(`R689 START ✅\n${mode}\nYouTube: ${live.lifeCycleStatus||'LIVE'}\nStream: ${live.streamStatus||'active'}${live.streamId?`\nStream ID: ${live.streamId}`:''}${url?`\n${url}`:''}`);
      setMsg('YouTube LIVE ✅ · ACTIVE stream найден и привязан','ok');
    }catch(e){
      const reconnect=e.status===403&&/oauth|scope|permission/i.test(`${e.data?.error||''} ${e.data?.reason||''} ${e.message||''}`);
      setResult(`R689 START ERROR\n${String(e.message||e)}${e.data?.reason?`\nReason: ${e.data.reason}`:''}`);
      setMsg(reconnect?'YouTube OAuth требует переподключения. Нажми кнопку ниже.':`Ошибка запуска R715: ${e.message||e}`,'bad');
    }finally{busy=false;await refresh()}
  }

  async function stopSequence(){
    if(busy)return;if(!confirm('Завершить YouTube LIVE и остановить OVH encoder?'))return;
    busy=true;render(lastRemote||{});
    try{
      setMsg('Завершаю YouTube LIVE…','work');
      const yt=await api('/api/control/youtube-live-r665/stop',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
      if(yt.watchUrl)setWatch(yt.watchUrl);
      setMsg('Останавливаю OVH encoder…','work');
      await agentAction(hasR665Agent()?'encoder-stop':'stop');
      setResult(`R665 STOP ✅\nYouTube: ${yt.lifeCycleStatus||'не LIVE'}\nOVH encoder: stopped`);
      setMsg('Эфир остановлен ✅','ok');
    }catch(e){
      const oldAgent=/ENOENT|andrik-youtube|Неизвестная команда/i.test(String(e.message||e));
      setResult(`R665 STOP ERROR\n${String(e.message||e)}${oldAgent?'\n\nУстанови OVH Agent R665 одной командой из инструкции.':''}`);
      setMsg(oldAgent?'Нужен OVH Agent R665 — одна команда на сервере.':`Ошибка остановки: ${e.message||e}`,'bad');
    }finally{busy=false;await refresh()}
  }

  async function statusSequence(){
    if(busy)return;busy=true;render(lastRemote||{});
    try{
      const [remote,yt]=await Promise.all([refresh(),youtubeState()]);
      const s=remote?.agent?.status||{};const url=yt.watchUrl||'';if(url)setWatch(url);
      setResult(`R665 STATUS\nOVH Agent: ${agentVersion(remote)||'—'}\nOVH service: ${s.service||'—'}\nproducer: ${s.producer?'YES':'NO'}\npublisher: ${s.publisher?'YES':'NO'}\nYouTube life: ${yt.lifeCycleStatus||'—'}\nYouTube stream: ${yt.streamStatus||'—'}\nHealth: ${yt.healthStatus||'—'}${s.lastError?`\nFFmpeg: ${s.lastError}`:''}${url?`\n${url}`:''}`);
      setMsg(ytLife(yt)==='live'?'YouTube LIVE ✅':'Статус обновлён.','ok');
    }catch(e){setMsg(`Проверка: ${e.message||e}`,'bad');setResult(`STATUS ERROR\n${e.message||e}`)}finally{busy=false;await refresh()}
  }

  async function autoSequence(){
    if(busy)return;busy=true;render(lastRemote||{});
    try{
      if(hasR665Agent()){
        setMsg('Останавливаю encoder для настройки Auto-start…','work');
        await agentAction('encoder-stop');await sleep(2500);
        const st=await youtubeState();const d=await ensureAutoStartWhenEditable(st);
        setResult(`AUTO-START R665 ✅\nenableAutoStart: ${d.enableAutoStart===true?'ON':d.skipped?'без изменений':'—'}\nenableAutoStop: ${d.enableAutoStop===false?'OFF':'—'}\nOVH encoder оставлен STOP — нажми «ЗАПУСТИТЬ СТРИМ».`);
        setMsg('Auto-start настроен ✅ · encoder остановлен','ok');
      }else{
        const st=await youtubeState();
        if(ytStream(st)==='active')throw new Error('Старый агент не умеет безопасно остановить encoder. Сначала установи OVH Agent R665.');
        const d=await ensureAutoStartWhenEditable(st);
        setResult(`AUTO-START ✅\nenableAutoStart: ${d.enableAutoStart===true?'ON':'—'}\nenableAutoStop: ${d.enableAutoStop===false?'OFF':'—'}`);
        setMsg('Auto-start настроен ✅','ok');
      }
    }catch(e){setMsg(`Auto-start: ${e.message||e}`,'bad');setResult(`AUTO-START ERROR\n${e.message||e}`)}finally{busy=false;await refresh()}
  }


  async function softRestart(){
    if(busy)return;busy=true;render(lastRemote||{});
    try{
      if(!confirm('Мягко перезапустить radio service? YouTube RTMPS переподключится автоматически.'))return;
      setMsg('Мягкий рестарт радио…','work');
      const d=await agentAction('soft-restart');
      setResult(String(d?.result?.output||'SOFT RESTART ✅'));
      setMsg('Мягкий рестарт завершён ✅','ok');
    }catch(e){setMsg(`Мягкий рестарт: ${e.message||e}`,'bad');setResult(`SOFT RESTART ERROR\n${e.message||e}`)}
    finally{busy=false;await refresh()}
  }

  async function cacheClean(){
    if(busy)return;if(!confirm('Очистить ТОЛЬКО пересобираемый кэш заставок / SPECIAL? MP3 и visual masters не удаляются.'))return;
    busy=true;render(lastRemote||{});
    try{
      setMsg('Очищаю безопасный station-кэш…','work');
      const d=await agentAction('cache-clean');
      setResult(String(d?.result?.output||'CACHE CLEAN ✅'));
      setMsg('Кэш заставок очищен ✅ · эфир не перезапускался','ok');
    }catch(e){setMsg(`Очистка кэша: ${e.message||e}`,'bad');setResult(`CACHE CLEAN ERROR\n${e.message||e}`)}
    finally{busy=false;await refresh()}
  }

  async function airRestore(){
    if(busy)return;if(!confirm('♻️ ВОССТАНОВИТЬ ЭФИР из сохранённого проверенного GOLD? Текущий server.mjs будет сохранён, затем вернётся эталон и радио один раз перезапустится.'))return;
    busy=true;render(lastRemote||{});
    try{
      setMsg('♻️ Восстанавливаю эфир из проверенного GOLD…','work');
      const d=await agentAction('gold-restore');
      setResult(String(d?.result?.output||'ЭФИР ВОССТАНОВЛЕН ✅'));
      setMsg('Эфир восстановлен ✅ · жду стабильный сигнал…','ok');
      await sleep(5000);
      // R870 SAFE: GOLD recovery never creates/rebinds a YouTube broadcast automatically.
      // The owner may use the explicit START button only if the stream is really stopped.
      await refresh();
    }catch(e){setMsg(`Восстановление эфира: ${e.message||e}`,'bad');setResult(`AIR RESTORE ERROR\n${e.message||e}`)}
    finally{busy=false;await refresh()}
  }

  async function screenRestore(){
    if(busy)return;if(!confirm('🖥 ВОССТАНОВИТЬ ЭКРАН? Будет возвращён доказанно стабильный server.mjs ДО R937G/R937F, текущий server.mjs сохранится в backup. R2, MP3, visual-файлы, station-кэш и env НЕ трогаются. Радио один раз перезапустится.'))return;
    busy=true;render(lastRemote||{});
    try{
      setMsg('🖥 Возвращаю доказанно стабильный видеотракт…','work');
      const d=await agentAction('screen-restore');
      setResult(String(d?.result?.output||'ЭКРАН ВОССТАНОВЛЕН ✅'));
      setMsg('Экран восстановлен ✅ · проверяю сигнал…','ok');
      await sleep(5000);
      await refresh();
    }catch(e){setMsg(`Восстановление экрана: ${e.message||e}`,'bad');setResult(`SCREEN RESTORE ERROR\n${e.message||e}`)}
    finally{busy=false;await refresh()}
  }

  async function saveTicker(text){
    if(tickerSaving)return;
    text=String(text??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
    if(text===lastServerTicker)return;
    tickerSaving=true;setTickerMsg('Передаю текст на OVH…','work');
    try{const d=await api('/api/control/radio-remote-r627/ticker',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});lastServerTicker=String(d?.ticker?.text||text);setTickerMsg('✅ Обновлено. На экране эфира появится в течение ~5 секунд.','ok');document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=lastServerTicker||'—')}
    catch(e){setTickerMsg(`Ошибка строки: ${e.message}`,'bad')}
    finally{tickerSaving=false}
  }

  function setYoutubeOauthMessage(text,kind=''){
    document.querySelectorAll('[data-radio-youtube-oauth-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind});
  }

  async function reconnectYoutube(){
    const button=document.querySelector('[data-radio-youtube-oauth-connect]');
    if(button){button.disabled=true;button.textContent='ОТКРЫВАЮ GOOGLE…'}
    setYoutubeOauthMessage('Готовлю одноразовую ссылку Google…','work');
    try{
      const result=await api('/api/control/youtube-oauth/start');
      if(!result?.url)throw new Error('Ссылка Google не получена');
      setYoutubeOauthMessage('Открываю Google. Выбери аккаунт канала ANDRIK Metal и подтверди разрешения.','ok');
      // Same-tab navigation is deliberate on Android: no popup blocker and no embedded iframe.
      window.location.assign(result.url);
    }catch(e){
      setYoutubeOauthMessage(`YouTube OAuth: ${e.message||e}`,'bad');
      if(button){button.disabled=false;button.textContent='🔐 ПЕРЕПОДКЛЮЧИТЬ YOUTUBE'}
    }
  }

  document.addEventListener('click',e=>{
    const oauth=e.target.closest('[data-radio-youtube-oauth-connect]');if(oauth){e.preventDefault();reconnectYoutube();return}
    const b=e.target.closest('[data-radio-action]');
    if(b){e.preventDefault();const a=b.dataset.radioAction;if(a==='start')startSequence();else if(a==='gold-restore')airRestore();else if(a==='screen-restore')screenRestore();else if(a==='cache-clean')cacheClean();else if(a==='soft-restart')softRestart();else if(a==='stop')stopSequence();else if(a==='status')statusSequence();else if(a==='auto-safe')autoSequence();return}
    const t=e.target.closest('[data-radio-ticker-apply]');if(t){e.preventDefault();const input=document.querySelector('[data-radio-ticker-input]');if(input)saveTicker(input.value)}
  });
  document.addEventListener('input',e=>{
    const input=e.target.closest?.('[data-radio-ticker-input]');if(!input)return;
    document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=input.value||'—');
    clearTimeout(tickerTimer);tickerTimer=setTimeout(()=>saveTicker(input.value),850);
  });

  window.AndrikRadioRemoteR926={refresh,start:()=>startSequence(),airRestore,goldRestore:airRestore,screenRestore,cacheClean,softRestart,stop:stopSequence,status:statusSequence,saveTicker};window.AndrikRadioRemoteR925=window.AndrikRadioRemoteR926;window.AndrikRadioRemoteR870=window.AndrikRadioRemoteR926;window.AndrikRadioRemoteR867=window.AndrikRadioRemoteR926;window.AndrikRadioRemoteR687=window.AndrikRadioRemoteR926;window.AndrikRadioRemoteR665=window.AndrikRadioRemoteR926;
  const arm=()=>{if(timer)clearInterval(timer);timer=null;if(document.hidden)return;timer=setInterval(refresh,15000)};
  const boot=()=>{if(!document.hidden)refresh();arm()};
  if(window.AndrikOwnerSession?.ready)window.AndrikOwnerSession.ready().finally(boot);else boot();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer)clearInterval(timer);timer=null;return}refresh();arm()});
})();
