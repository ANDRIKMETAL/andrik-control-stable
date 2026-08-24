(()=>{
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(v))}catch(_){return v}};
  let busy=false,timer=null;
  async function api(path,opts={}){const r=await fetch(path,{...opts,credentials:'include',cache:'no-store',headers:{accept:'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||d.message||`HTTP ${r.status}`);e.data=d;e.status=r.status;throw e}return d}
  function setMsg(text,kind=''){document.querySelectorAll('[data-radio-remote-message]').forEach(el=>{el.textContent=text;el.dataset.kind=kind})}
  function setPairCode(data){document.querySelectorAll('[data-radio-pair-box]').forEach(box=>{box.hidden=!data});document.querySelectorAll('[data-radio-pair-code]').forEach(el=>el.textContent=data?.code||'');document.querySelectorAll('[data-radio-pair-command]').forEach(el=>el.textContent=data?.command||'')}
  function render(data){
    const online=Boolean(data.online),paired=Boolean(data.paired),agent=data.agent||{},s=agent.status||{},cmd=data.command||{},res=data.result||{};
    document.querySelectorAll('[data-radio-remote-state]').forEach(el=>{el.textContent=!paired?'AWS не привязан':online?'AWS ONLINE':'AWS OFFLINE';el.className='service-access-state '+(online?'is-ready':paired?'':'is-error')});
    document.querySelectorAll('[data-radio-remote-detail]').forEach(el=>{el.innerHTML=`<b>${online?'🟢':'⚪'} AWS:</b> ${online?'на связи':'нет свежего heartbeat'} · ${esc(fmt(agent.lastSeen))}<br><b>Radio:</b> ${esc(s.service||'—')} · producer ${s.producer?'✅':'—'} · publisher ${s.publisher?'✅':'—'}<br><b>Сейчас:</b> ${esc(s.current||'—')}<br><b>Дальше:</b> ${esc(s.next||'—')}`});
    const active=cmd&&['queued','running'].includes(cmd.state);
    document.querySelectorAll('[data-radio-action]').forEach(b=>b.disabled=busy||active||!online);
    document.querySelectorAll('[data-radio-command-state]').forEach(el=>{el.textContent=active?`Команда ${cmd.action}: ${cmd.state==='queued'?'в очереди':'выполняется…'}`:res?.finishedAt?`${res.ok?'✅':'❌'} ${res.action||''} · ${fmt(res.finishedAt)}`:'Готов к команде'});
    document.querySelectorAll('[data-radio-result]').forEach(el=>{const out=String(res.output||'').trim();el.textContent=out||'Последний результат появится здесь.'});
    const watch=String(res.output||'').match(/https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+/)?.[0]||'';
    document.querySelectorAll('[data-radio-watch]').forEach(a=>{a.hidden=!watch;if(watch)a.href=watch});
  }
  async function refresh(){try{const d=await api('/api/control/radio-remote-r627/status');render(d);return d}catch(e){setMsg(e.status===401?'Нужен вход владельца.':`Статус: ${e.message}`,'bad');return null}}
  async function command(action){if(busy)return;if(action==='stop'&&!confirm('Завершить LIVE и остановить encoder?'))return;busy=true;setMsg(action==='start'?'Запускаю радио: Auto-start ON → encoder → LIVE…':`Команда: ${action}…`,'work');try{const d=await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});setMsg('Команда принята AWS ✅','ok');await refresh()}catch(e){setMsg(e.message==='command-busy'?'Предыдущая команда ещё выполняется.':`Ошибка: ${e.message}`,'bad')}finally{busy=false}}
  async function pair(){setMsg('Создаю короткий код подключения AWS…','work');try{const d=await api('/api/control/radio-remote-r627/pair/create',{method:'POST'});setPairCode(d);setMsg('Код готов. Это единственный раз, когда понадобится AWS-консоль.','ok')}catch(e){setMsg(`Код: ${e.message}`,'bad')}}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-radio-action]');if(b){e.preventDefault();command(b.dataset.radioAction)}const p=e.target.closest('[data-radio-pair-create]');if(p){e.preventDefault();pair()}const c=e.target.closest('[data-radio-pair-copy]');if(c){e.preventDefault();const txt=document.querySelector('[data-radio-pair-command]')?.textContent||'';navigator.clipboard?.writeText(txt).then(()=>setMsg('Команда подключения скопирована ✅','ok')).catch(()=>{})}});
  window.AndrikRadioRemoteR627={refresh,command,pair};
  refresh();timer=setInterval(refresh,5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
