(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v))}catch(_){return String(v)}};
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
  function hasR665Agent(data=lastRemote){return /R(?:665|687|688|689|69\d|70\d|71\d|72\d)/i.test(agentVersion(data))}

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
    const commandState=String(cmd?.state||'');
    const commandStarted=Date.parse(cmd?.claimedAt||cmd?.createdAt||'')||0;
    const commandAge=commandStarted?Date.now()-commandStarted:0;
    const activeRaw=!legacyFullFit&&['queued','running'].includes(commandState);
    const active=activeRaw&&commandAge<185000;
    const stale=activeRaw&&commandAge>=185000;
    document.querySelectorAll('[data-radio-action]').forEach(b=>b.disabled=busy||active||!online);
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
        setMsg('R715: перезапускаю OVH encoder чисто…','work');
        await agentAction('encoder-stop');
        await sleep(1800);
        await agentAction('encoder-start');
      }else{
        // R658-safe path: the old agent can restart the systemd radio service.
        // R689 no longer depends on the obsolete /usr/local/sbin/andrik-youtube helper
        // for START. Cloudflare discovers the ACTIVE YouTube stream and binds it itself.
        setMsg(`${agentVersion()||'Старый агент'}: перезапускаю OVH encoder…`,'work');
        await agentAction('restart');
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
      await agentAction('stop');
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


  async function restartOnly(){
    if(busy)return;busy=true;render(lastRemote||{});
    try{setMsg('Перезапускаю OVH encoder…','work');await agentAction('restart');setMsg('OVH encoder перезапущен ✅','ok');setResult('OVH encoder restart ✅')}
    catch(e){setMsg(`Restart: ${e.message||e}`,'bad');setResult(`RESTART ERROR\n${e.message||e}`)}finally{busy=false;await refresh()}
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
    if(b){e.preventDefault();const a=b.dataset.radioAction;if(a==='start')startSequence();else if(a==='recover')startSequence({recover:true});else if(a==='stop')stopSequence();else if(a==='status')statusSequence();else if(a==='auto-safe')autoSequence();else if(a==='restart')restartOnly();return}
    const t=e.target.closest('[data-radio-ticker-apply]');if(t){e.preventDefault();const input=document.querySelector('[data-radio-ticker-input]');if(input)saveTicker(input.value)}
  });
  document.addEventListener('input',e=>{
    const input=e.target.closest?.('[data-radio-ticker-input]');if(!input)return;
    document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=input.value||'—');
    clearTimeout(tickerTimer);tickerTimer=setTimeout(()=>saveTicker(input.value),850);
  });

  window.AndrikRadioRemoteR687={refresh,start:()=>startSequence(),recover:()=>startSequence({recover:true}),stop:stopSequence,status:statusSequence,saveTicker};window.AndrikRadioRemoteR665=window.AndrikRadioRemoteR687;
  const arm=()=>{if(timer)clearInterval(timer);timer=null;if(document.hidden)return;timer=setInterval(refresh,5000)};
  const boot=()=>{if(!document.hidden)refresh();arm()};
  if(window.AndrikOwnerSession?.ready)window.AndrikOwnerSession.ready().finally(boot);else boot();
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer)clearInterval(timer);timer=null;return}refresh();arm()});
})();
