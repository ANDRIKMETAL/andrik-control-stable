(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v))}catch(_){return v}};
  let busy=false,timer=null,tickerTimer=null,tickerSaving=false,lastServerTicker='';
  async function api(path,opts={}){const r=await fetch(path,{...opts,credentials:'include',cache:'no-store',headers:{accept:'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||d.message||`HTTP ${r.status}`);e.data=d;e.status=r.status;throw e}return d}
  function setMsg(text,kind=''){document.querySelectorAll('[data-radio-remote-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind})}
  function setTickerMsg(text,kind=''){document.querySelectorAll('[data-radio-ticker-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind})}
  function tickerTextFrom(data){return String(data?.ticker?.text ?? data?.agent?.status?.ticker ?? '').trim()}
  function render(data){
    const online=Boolean(data.online),paired=Boolean(data.paired),agent=data.agent||{},s=agent.status||{},cmd=data.command||{},res=data.result||{};
    document.querySelectorAll('[data-radio-remote-state]').forEach(el=>{el.textContent=!paired?'AWS не привязан':online?'AWS ONLINE':'AWS OFFLINE';el.className='service-access-state '+(online?'is-ready':paired?'':'is-error')});
    document.querySelectorAll('[data-radio-remote-detail]').forEach(el=>{el.innerHTML=`<b>${online?'🟢':'⚪'} AWS:</b> ${online?'на связи':'нет свежего heartbeat'} · ${esc(fmt(agent.lastSeen))}<br><b>Radio:</b> ${esc(s.service||'—')} · producer ${s.producer?'✅':'—'} · publisher ${s.publisher?'✅':'—'}<br><b>Сейчас:</b> ${esc(s.current||'—')}<br><b>Дальше:</b> ${esc(s.next||'—')}`});
    const commandState=String(cmd?.state||'');
    const commandStarted=Date.parse(cmd?.claimedAt||cmd?.createdAt||'')||0;
    const commandAge=commandStarted?Date.now()-commandStarted:0;
    const activeRaw=['queued','running'].includes(commandState);
    const active=activeRaw&&commandAge<185000;
    const stale=activeRaw&&commandAge>=185000;
    // R635: a dead/stale AWS command must NEVER brick the whole radio panel.
    // Backend already accepts a replacement command after ~180s, so unlock UI too.
    document.querySelectorAll('[data-radio-action]').forEach(b=>b.disabled=busy||active||!online);
    document.querySelectorAll('[data-radio-command-state]').forEach(el=>{
      el.textContent=stale?`⚠ ${cmd.action||'команда'} зависла — управление разблокировано`:active?`Команда ${cmd.action}: ${cmd.state==='queued'?'в очереди':'выполняется…'}`:res?.finishedAt?`${res.ok?'✅':'❌'} ${res.action||''} · ${fmt(res.finishedAt)}`:'Готов к команде';
    });
    if(stale)setMsg('⚠ Предыдущая команда зависла больше 3 минут. Кнопки разблокированы — можно запускать/восстанавливать снова.','bad');
    document.querySelectorAll('[data-radio-result]').forEach(el=>{const out=String(res.output||'').trim();el.textContent=out||'Последний результат появится здесь.'});
    const watch=String(res.output||'').match(/https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+/)?.[0]||'';
    document.querySelectorAll('[data-radio-watch]').forEach(a=>{a.hidden=!watch;if(watch)a.href=watch});
    const ticker=tickerTextFrom(data);lastServerTicker=ticker;
    document.querySelectorAll('[data-radio-ticker-input]').forEach(el=>{if(document.activeElement!==el && el.value!==ticker)el.value=ticker});
    document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=ticker||'—');
  }
  async function refresh(){try{const d=await api('/api/control/radio-remote-r627/status');render(d);return d}catch(e){setMsg(e.status===401?'Нужен вход владельца.':`Статус: ${e.message}`,'bad');return null}}
  async function command(action){if(busy)return;if(action==='stop'&&!confirm('Завершить LIVE и остановить encoder?'))return;busy=true;setMsg(action==='start'?'Запускаю радио: Auto-start ON → encoder → LIVE…':`Команда: ${action}…`,'work');try{await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});setMsg('Команда принята AWS ✅','ok');await refresh()}catch(e){setMsg(e.message==='command-busy'?'Предыдущая команда ещё выполняется.':`Ошибка: ${e.message}`,'bad')}finally{busy=false}}
  async function saveTicker(text){
    if(tickerSaving)return;
    text=String(text??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
    if(text===lastServerTicker)return;
    tickerSaving=true;setTickerMsg('Передаю текст в AWS…','work');
    try{const d=await api('/api/control/radio-remote-r627/ticker',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});lastServerTicker=String(d?.ticker?.text||text);setTickerMsg('✅ Обновлено. На экране эфира появится в течение ~5 секунд.','ok');document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=lastServerTicker||'—')}
    catch(e){setTickerMsg(`Ошибка строки: ${e.message}`,'bad')}
    finally{tickerSaving=false}
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-radio-action]');if(b){e.preventDefault();command(b.dataset.radioAction);return}
    const t=e.target.closest('[data-radio-ticker-apply]');if(t){e.preventDefault();const input=document.querySelector('[data-radio-ticker-input]');if(input)saveTicker(input.value)}
  });
  document.addEventListener('input',e=>{
    const input=e.target.closest?.('[data-radio-ticker-input]');if(!input)return;
    document.querySelectorAll('[data-radio-ticker-live]').forEach(el=>el.textContent=input.value||'—');
    clearTimeout(tickerTimer);tickerTimer=setTimeout(()=>saveTicker(input.value),850);
  });
  window.AndrikRadioRemoteR635={refresh,command,saveTicker};
  refresh();timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
