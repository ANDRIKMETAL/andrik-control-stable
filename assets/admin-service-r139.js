(() => {
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const keyInput=document.getElementById('serviceAdminKey');
  const remember=document.getElementById('serviceRemember');
  const state=document.getElementById('serviceAccessState');
  const msg=document.getElementById('serviceAccessMessage');
  const IS_CONTROL_HOST=location.hostname.toLowerCase()==='control.andrikmetal.com';
  const MAIN_PUSH_ADMIN_URL='https://control.andrikmetal.com/push-repair-r768.html?v=55.00-r768';
  let installPrompt=null;
  let lastDiagnosticText='';
  let lastSystemText='';
  const installButton=document.getElementById('adminInstallButton');
  const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  try{const p=localStorage.getItem(KEY_LOCAL)||'';const ss=sessionStorage.getItem(KEY_SESSION)||'';keyInput.value=p||ss;remember.checked=Boolean(p)}catch(_){}
  const getKey=()=>keyInput.value.trim();
  const set=(id,text)=>{const el=document.getElementById(id);if(el)el.textContent=text};
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const formatDate=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch(_){return value}};
  function saveKey(){const key=getKey();try{sessionStorage.setItem(KEY_SESSION,key);if(remember.checked)localStorage.setItem(KEY_LOCAL,key);else localStorage.removeItem(KEY_LOCAL)}catch(_){}}
  async function api(path,options={}){
    const response=await fetch(path,{...options,headers:{accept:'application/json',authorization:`Bearer ${getKey()}`,...(options.headers||{})},cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const detail=data.details||data.error||`HTTP ${response.status}`;const error=new Error(typeof detail==='string'?detail:JSON.stringify(detail));error.data=data;error.status=response.status;throw error}
    return data;
  }
  function access(ok,text){state.className=`service-access-state ${ok?'is-ready':'is-error'}`;state.textContent=ok?'Доступ подтверждён':'Доступ не подтверждён';msg.textContent=text||''}
  async function verify(){if(!getKey()){access(false,'Введите ключ администратора.');return}const rawKey=getKey();msg.textContent='Создаём защищённую сессию…';try{await window.AndrikOwnerSession?.establish(rawKey);keyInput.value=window.AndrikOwnerSession?.sentinel||'__ANDRIK_OWNER_SESSION__';saveKey();await api('/api/control/access');access(true,'Доступ подтверждён. ADMIN_KEY удалён из памяти страницы и заменён защищённой HttpOnly-сессией на 90 дней. ✅')}catch(error){access(false,error.message==='unauthorized'?'Ключ неверный.':error.status===429?'Слишком много попыток. Подожди 10 минут.':`Ошибка: ${error.message}`)}}
  async function loadYoutubeOauthStatus(){
    const stateEl=document.getElementById('serviceYoutubeOauthState');
    const messageEl=document.getElementById('serviceYoutubeOauthMessage');
    const button=document.getElementById('serviceYoutubeOauthConnect');
    if(!stateEl||!button)return null;
    if(!getKey()){stateEl.className='service-access-state is-error';stateEl.textContent='Нужен ADMIN_KEY';messageEl.textContent='Сначала сохраните ключ владельца.';return null}
    try{
      const data=await api('/api/control/youtube-oauth/status?verify=1');
      if(data.connected){
        const manage=Boolean(data.canManageLive);
        stateEl.className=`service-access-state ${manage?'is-ready':'is-error'}`;
        stateEl.textContent=manage?'Подключено · LIVE API':'Нужно переподключить';
        button.textContent='Переподключить YouTube Studio';
        messageEl.textContent=manage?'Готово: статистика + управление эфиром разрешены.':'Старый OAuth только для чтения. Нажмите «Переподключить YouTube Studio» и подтвердите Google-доступ к управлению эфиром.';
      }else{
        stateEl.className='service-access-state is-error';stateEl.textContent=data.clientConfigured?'Не подключено':'OAuth не настроен';button.textContent=data.clientConfigured?'Подключить YouTube Studio':'Настроить OAuth';
        messageEl.textContent=data.clientConfigured?'Нажмите кнопку и подтвердите доступ Google.':'В Cloudflare Pages нужны YOUTUBE_OAUTH_CLIENT_ID и YOUTUBE_OAUTH_CLIENT_SECRET.';
      }
      return data;
    }catch(error){stateEl.className='service-access-state is-error';stateEl.textContent='Ошибка';messageEl.textContent=`YouTube Studio: ${error.message}`;return null}
  }
  async function connectYoutubeOauth(){
    if(!getKey()){set('serviceYoutubeOauthMessage','Сначала сохраните ADMIN_KEY.');return}
    saveKey();
    const button=document.getElementById('serviceYoutubeOauthConnect');if(button){button.disabled=true;button.textContent='Открываем Google…'}
    try{const data=await api('/api/control/youtube-oauth/start');if(!data.url)throw new Error('Ссылка авторизации не получена');try{window.top.location.assign(data.url)}catch(_){location.assign(data.url)}}
    catch(error){set('serviceYoutubeOauthMessage',`YouTube Studio: ${error.message}`);if(button){button.disabled=false;button.textContent='Подключить YouTube Studio'}}
  }

  async function configureYoutubeLiveAuto(){
    if(!getKey()){set('serviceYoutubeOauthMessage','Сначала сохраните ADMIN_KEY.');return}
    const button=document.getElementById('serviceYoutubeAutoConfig');if(button)button.disabled=true;
    set('serviceYoutubeOauthMessage','Настраиваем Auto-start ON / Auto-stop OFF… Encoder должен быть остановлен.');
    try{const data=await api('/api/control/youtube-live-r609/auto',{method:'POST'});set('serviceYoutubeOauthMessage',`Готово ✅ Auto-start ${data.enableAutoStart?'ON':'OFF'} · Auto-stop ${data.enableAutoStop?'ON':'OFF'}.`)}
    catch(error){const reconnect=error.data?.error==='youtube-oauth-write-scope-required';set('serviceYoutubeOauthMessage',reconnect?'Нужно переподключить YouTube Studio и подтвердить новое разрешение Google.':`Не получилось: ${error.message}`)}
    finally{if(button)button.disabled=false}
  }
  async function startYoutubeLiveNow(){
    if(!getKey()){set('serviceYoutubeOauthMessage','Сначала сохраните ADMIN_KEY.');return}
    const button=document.getElementById('serviceYoutubeStartNow');if(button)button.disabled=true;
    set('serviceYoutubeOauthMessage','Команда запуска отправлена YouTube…');
    try{const data=await api('/api/control/youtube-live-r609/start',{method:'POST'});set('serviceYoutubeOauthMessage',data.alreadyLive?'Эфир уже LIVE ✅':`YouTube: ${data.lifeCycleStatus||'команда принята'} ✅`)}
    catch(error){set('serviceYoutubeOauthMessage',error.data?.error==='youtube-stream-inactive'?'Сначала запусти encoder на OVH.':error.data?.error==='youtube-oauth-write-scope-required'?'Нужно переподключить YouTube Studio.':`Запуск: ${error.message}`)}
    finally{if(button)button.disabled=false}
  }

  function renderSearchConsoleDiagnostic(sc={}){
    const stateEl=document.getElementById('serviceSearchConsoleState');
    const detailsEl=document.getElementById('serviceSearchConsoleDetails');
    if(!stateEl||!detailsEl)return;
    const error=String(sc.friendlyError||sc.error||'').trim();
    const stale=Boolean(sc.stale||error);
    const connected=Boolean(sc.connected)&&!stale;
    const configured=Boolean(sc.configured);
    const email=String(sc.serviceAccountEmail||'').trim();
    const site=String(sc.siteUrl||'sc-domain:andrikmetal.com');
    const lastSuccess=String(sc.lastSuccessfulAt||sc.updatedAt||'').trim();
    stateEl.className=`service-access-state ${connected?'is-ready':configured?'is-error':'is-error'}`;
    stateEl.textContent=connected?'Подключено':configured?'НЕ ОБНОВЛЯЕТСЯ':'Не настроено';
    detailsEl.className=`service-search-console-details ${connected?'is-good':'is-error'}`;
    if(connected){
      detailsEl.innerHTML=`<strong>Search Console работает ✅</strong>${escapeHtml(site)} · ${Number(sc.clicks||0).toLocaleString('ru-RU')} кликов · ${Number(sc.impressions||0).toLocaleString('ru-RU')} показов${sc.updatedAt?`<br>Обновлено: ${escapeHtml(formatDate(sc.updatedAt))}`:''}`;
      return;
    }
    const message=error||'Свежие данные Search Console не получены.';
    const saved=(Number(sc.clicks||0)||Number(sc.impressions||0)||lastSuccess)?`<br>Последний сохранённый снимок: ${Number(sc.clicks||0).toLocaleString('ru-RU')} кликов · ${Number(sc.impressions||0).toLocaleString('ru-RU')} показов${lastSuccess?` · ${escapeHtml(formatDate(lastSuccess))}`:''}`:'';
    detailsEl.innerHTML=`<strong>${escapeHtml(message)}</strong>${email?`Service account: ${escapeHtml(email)}<br>`:''}Ресурс: ${escapeHtml(site)}${saved}`;
  }
  async function loadSearchConsoleDiagnostic(force=false){
    if(!getKey()){renderSearchConsoleDiagnostic({configured:false,error:'Сначала сохраните ADMIN_KEY.'});return null}
    const button=document.getElementById('serviceSearchConsoleRefresh');
    if(button)button.disabled=true;
    try{
      const data=await api(`/api/control/search-console${force?'?refresh=1':''}`);
      renderSearchConsoleDiagnostic(data.searchConsole||data||{});
      return data;
    }catch(error){renderSearchConsoleDiagnostic({configured:true,error:error.message});return null}
    finally{if(button)button.disabled=false}
  }

  async function sendPush(audience,title,message,url,statusId){if(!getKey()){set(statusId,'Сначала сохраните ключ.');return}saveKey();set(statusId,'Отправка…');try{const data=await api('/api/push/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({audience,title,message,url})});set(statusId,data.oneSignalId?`OneSignal принял сообщение ✅ ID: ${data.oneSignalId}`:'Отправлено ✅');await loadDiagnosticLog()}catch(error){set(statusId,`Ошибка: ${translatePushError(error.message)}`);await loadDiagnosticLog()}}
  function translatePushError(value){const text=String(value||'');if(text.includes('no-subscribers-matched'))return 'OneSignal не нашёл активных подписчиков. Переподключите уведомления на телефонах и повторите тест.';if(text.includes('owner-device-not-registered'))return 'Телефон владельца не зарегистрирован.';if(text.includes('owner-subscription-invalid'))return 'Старая push-подписка телефона недействительна. Нажмите «Подключить мой телефон» ещё раз.';if(text.includes('push-not-configured'))return 'OneSignal не настроен.';return text}
  async function registerOwnerPush(){
    const button=document.getElementById('adminPushRegister');
    if(button){button.disabled=true;button.classList.add('is-busy')}
    try{
      if(!IS_CONTROL_HOST){
        set('adminPushStatus','Возвращаюсь в Control для защищённой привязки владельца…');
        location.replace(MAIN_PUSH_ADMIN_URL);
        return;
      }
      if(!getKey()){set('adminPushStatus','Сначала подтверди доступ владельца выше.');return}
      saveKey();
      set('adminPushStatus','Создаю безопасный мост на основной домен OneSignal…');
      const data=await api('/api/control/push-owner-bind-token-r768',{method:'POST'});
      if(!data?.repairUrl)throw new Error('owner-bridge-url-missing');
      location.replace(data.repairUrl+'&v=55.00-r768');
    }catch(error){
      set('adminPushStatus',`Ошибка подключения телефона: ${translatePushError(error.message)}`);
    }finally{
      if(button){button.disabled=false;button.classList.remove('is-busy')}
    }
  }

  function pushAttemptLabel(attempt){if(!attempt)return 'Попыток автоматической отправки пока нет';if(attempt.status==='sent'&&attempt.oneSignalId)return `Принято OneSignal · ID ${attempt.oneSignalId}`;if(attempt.error==='no-subscribers-matched')return 'Не доставлено: активные подписчики не найдены';if(attempt.status==='failed')return `Ошибка: ${attempt.error||'неизвестно'}`;return `${attempt.status||'—'}${attempt.error?` · ${attempt.error}`:''}`}
  function renderYoutubeDiagnostics(data={}){
    const box=document.getElementById('adminPlaylistDiagnostics');if(!box)return;
    const latest=data.latestItem||null,lastSeen=data.lastSeenItem||null,attempt=data.latestPushAttempt||null;
    const diagnosticState=document.getElementById('adminYoutubeDiagnosticState');
    if(diagnosticState){diagnosticState.className=`service-access-state ${Number(data.wouldNotify||0)>0?'is-error':'is-ready'}`;diagnosticState.textContent=Number(data.wouldNotify||0)>0?`Новых: ${data.wouldNotify}`:'Новых нет'}
    const spoiler=document.getElementById("adminPlaylistDiagnosticsSpoiler");
    box.innerHTML=[
      `<article><small>Последнее видео YouTube</small><strong>${escapeHtml(latest?.title||'Не найдено')}</strong><span>${escapeHtml(latest?.publishedAt?formatDate(latest.publishedAt):'—')}</span>${latest?.url?`<a href="${escapeHtml(latest.url)}" target="_blank" rel="noopener">Открыть видео ↗</a>`:''}</article>`,
      `<article><small>Последнее сохранённое системой</small><strong>${escapeHtml(lastSeen?.title||'Пока не сохранено')}</strong><span>${escapeHtml(lastSeen?.publishedAt?formatDate(lastSeen.publishedAt):'—')}</span></article>`,
      `<article><small>Последняя попытка push</small><strong>${escapeHtml(pushAttemptLabel(attempt))}</strong><span>${escapeHtml(attempt?.createdAt?formatDate(attempt.createdAt):'—')}</span></article>`,
      `<article><small>Результат безопасной проверки</small><strong>${Number(data.wouldNotify||0)>0?`Будет отправлено: ${Number(data.wouldNotify)}`:'Рассылка не требуется'}</strong><span>${escapeHtml(data.mode||'YouTube')} · проверено ${Number(data.checked||0)}</span></article>`
    ].join('');
  }
  async function inspectPlaylist({preserveStatus=false}={}){if(!getKey()){set('adminPlaylistStatus','Сначала сохраните ключ.');return null}saveKey();if(!preserveStatus)set('adminPlaylistStatus','Безопасно проверяем YouTube без рассылки…');try{const data=await api('/api/push/inspect-playlist',{method:'POST'});renderYoutubeDiagnostics(data);if(!preserveStatus){const warning=(data.warnings||[]).length?` Предупреждения: ${(data.warnings||[]).join(' · ')}`:'';set('adminPlaylistStatus',Number(data.wouldNotify||0)>0?`Найдено новых видео: ${data.wouldNotify}. Ничего не отправлено.${warning}`:`Всё в порядке: новых видео нет, ничего не отправлено.${warning}`)}return data}catch(error){set('adminPlaylistStatus',`Ошибка диагностики: ${error.message}`);return null}}
  function showBattleResult(title,text,tone='info'){
    const box=document.getElementById('adminPlaylistBattleResult');if(!box)return;box.hidden=false;box.className=`youtube-battle-result is-${tone}`;box.innerHTML=`<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;
  }
  async function checkPlaylist(){if(!getKey()){set('adminPlaylistStatus','Сначала сохраните ключ.');return}if(!confirm('Запустить БОЕВУЮ проверку? Если YouTube найдёт новое видео, уведомление будет отправлено всем подписчикам.'))return;saveKey();const button=document.getElementById('adminPlaylistCheck');if(button)button.disabled=true;set('adminPlaylistStatus','Боевая проверка выполняется… дождитесь результата.');showBattleResult('Проверка запущена','Получаем список видео и сравниваем его с базой.','running');try{const data=await api('/api/push/check-playlist',{method:'POST'});const errors=[...(data.warnings||[]),...(data.failedItems||[]).map(item=>`${item.title}: ${translatePushError(item.error)}`)];const resultText=data.seeded?`Первый запуск: запомнено ${data.checked} видео без рассылки.`:`Проверено ${data.checked}. Новых ${Number((data.newItems||[]).length)}. OneSignal принял ${Number(data.notified||0)}.${errors.length?` Ошибки: ${errors.join(' · ')}`:''}`;showBattleResult(data.notified>0?'Push принят OneSignal ✅':errors.length?'Push не отправлен ⚠️':'Новых видео нет',resultText,data.notified>0?'success':errors.length?'error':'info');set('adminPlaylistStatus',resultText);await inspectPlaylist({preserveStatus:true});await loadDiagnosticLog()}catch(error){const text=translatePushError(error.message);showBattleResult('Боевая проверка завершилась ошибкой',text,'error');set('adminPlaylistStatus',`Ошибка: ${text}`);await loadDiagnosticLog()}finally{if(button)button.disabled=false}}
  async function retryLatestPush(){if(!getKey()){set('adminPlaylistStatus','Сначала сохраните ключ.');return}if(!confirm('Повторно отправить уведомление о самом последнем видео всем активным подписчикам?'))return;const button=document.getElementById('adminPlaylistRetryLatest');if(button)button.disabled=true;set('adminPlaylistStatus','Повторно отправляем уведомление о последнем видео…');showBattleResult('Повторный push запущен','Ожидаем ответ OneSignal.','running');try{const data=await api('/api/push/retry-latest',{method:'POST'});const text=`«${data.video?.title||'Последнее видео'}» · OneSignal ID: ${data.oneSignalId||'—'}`;showBattleResult('OneSignal принял push ✅',text,'success');set('adminPlaylistStatus',text);await inspectPlaylist({preserveStatus:true});await loadDiagnosticLog()}catch(error){const text=translatePushError(error.message);showBattleResult('Push не отправлен',text,'error');set('adminPlaylistStatus',`Ошибка: ${text}`);await loadDiagnosticLog()}finally{if(button)button.disabled=false}}
  function renderCronResult(data={}){
    const box=document.getElementById('serviceCronResult');if(!box)return;
    const tasks=data.tasks||{};
    const labels={releases:'🎵 Релизы YouTube',youtubeEvents:'👍💬👤 Реакции YouTube',snapshots:'📊 Снимки статистики',backup:'🛡️ Резервная копия'};
    const rows=Object.entries(labels).map(([key,label])=>{
      const item=tasks[key]||{};
      const ok=Boolean(item.ok||item.httpOk||item.skipped);
      const note=item.skipped?'Пропущено: свежие данные':item.error||item.details||(ok?'Готово':'Нет результата');
      return `<article class="service-system-item ${ok?'is-good':'is-error'}"><span class="system-service-icon">${ok?'✅':'⚠️'}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small><em class="system-state"><i aria-hidden="true"></i>${ok?'Готово':'Проверить'}</em></div></article>`;
    });
    box.hidden=false;box.innerHTML=rows.join('');
  }
  async function runCentralCron(){
    if(!getKey()){set('serviceCronMessage','Сначала сохраните ключ владельца.');return}
    saveKey();
    const button=document.getElementById('serviceCronRun');const stateEl=document.getElementById('serviceCronState');
    if(button)button.disabled=true;if(stateEl){stateEl.className='service-access-state';stateEl.textContent='Выполняется…'}
    set('serviceCronMessage','Запускаем все задачи. Это может занять до минуты…');
    try{
      const data=await api('/api/automation/run',{method:'POST'});
      renderCronResult(data);
      const errors=Array.isArray(data.errors)?data.errors:[];
      if(stateEl){stateEl.className=`service-access-state ${errors.length?'is-error':'is-ready'}`;stateEl.textContent=errors.length?'Выполнено частично':'Все задачи готовы'}
      set('serviceCronMessage',errors.length?`Завершено ${Number(data.successful||0)}/${Number(data.total||0)}. ${errors.join(' · ')}`:`Все ${Number(data.total||4)} задачи завершены ✅`);
      await Promise.allSettled([loadSystem(),loadDiagnosticLog()]);
    }catch(error){
      if(stateEl){stateEl.className='service-access-state is-error';stateEl.textContent='Ошибка запуска'}
      set('serviceCronMessage',`Ошибка: ${error.message}`);
    }finally{if(button)button.disabled=false}
  }
  function statusMeta(status='warning'){const map={good:{label:'Работает',symbol:'🟢'},warning:{label:'Внимание',symbol:'🟡'},error:{label:'Ошибка',symbol:'🔴'},optional:{label:'Отложено',symbol:'🟡'}};return map[status]||map.warning}
  function serviceStatusCard(icon,title,detail,status='warning'){const meta=statusMeta(status);return `<article class="service-system-item is-${escapeHtml(status)}"><span class="system-service-icon">${icon}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small><em class="system-state"><i aria-hidden="true"></i>${escapeHtml(meta.label)}</em></div></article>`}
  async function loadSystem(){if(!getKey()){set('serviceSystemMessage','Сначала сохраните ключ.');return}const button=document.getElementById('serviceSystemRefresh');if(button)button.disabled=true;set('serviceSystemMessage','Проверяем службы…');try{const data=await api('/api/control/system');const s=data.services||{};const cronState=document.getElementById('serviceCronState');if(cronState){const cron=s.cron||{};cronState.className=`service-access-state ${cron.status==='good'?'is-ready':cron.status==='error'?'is-error':''}`;cronState.textContent=cron.status==='good'?'Автоматизация работает':cron.health==='never'?'Ожидает первого запуска':'Требует проверки'}const ordered=[['🔔','OneSignal',s.oneSignal],['👥','Push-аудитория',s.pushAudience],['📨','Последний push',s.lastPush],['▶️','YouTube',s.youtube],['🌅','Сводка 06:00',s.dailySummary],['🛡️','R2 / Backup',s.backups],['📊','Аналитика',s.analytics],['🔎','Search Console',s.searchConsole]];const ownerCount=Number(s.pushAudience?.counts?.owners||0);const ownerState=document.getElementById('ownerPushDeviceState');const ownerCard=document.getElementById('ownerPushDeviceCard');if(ownerState){ownerState.className=`service-access-state ${ownerCount>0?'is-ready':'is-error'}`;ownerState.textContent=ownerCount>0?`Подключён · ${ownerCount}`:'НЕ ПОДКЛЮЧЕН';}if(ownerCard)ownerCard.classList.toggle('is-error',ownerCount===0);if(ownerCount===0)set('adminPushStatus','⚠ Сейчас личные push некуда отправлять. Нажми «Подключить через основной сайт» и разреши уведомления.');else if(!document.getElementById('adminPushStatus')?.textContent)set('adminPushStatus','✅ Телефон владельца зарегистрирован.');document.getElementById('serviceSystemGrid').innerHTML=ordered.map(([icon,title,item])=>serviceStatusCard(icon,title,item?.label||'Нет данных',item?.status||'warning')).join('');const critical=ordered;const good=critical.filter(([, ,item])=>item?.status==='good').length;const errors=critical.filter(([, ,item])=>item?.status==='error').length;const warnings=critical.length-good-errors;const summary=document.getElementById('serviceSystemSummary');if(summary){summary.className=`system-overall ${errors?'is-error':warnings?'is-warning':'is-good'}`;summary.textContent=errors?`🔴 Ошибок: ${errors}`:warnings?`🟡 Работает ${good}/${critical.length}`:`🟢 Всё работает ${good}/${critical.length}`;}lastSystemText=[`ANDRIK Control v${data.version||'54.03'} — состояние системы`,`Обновлено: ${formatDate(data.updatedAt)}`,'',...ordered.map(([,title,item])=>`${statusMeta(item?.status).symbol} ${title}: ${item?.label||'Нет данных'}`)].join('\n');set(
      'serviceSystemMessage',
      data.partial
        ? `Состояние загружено частично. Остальные службы показаны ✅`
        : 'Состояние обновлено. Секретные значения не выводятся ✅'
    )}catch(error){set('serviceSystemMessage',`Ошибка: ${error.message}`)}finally{if(button)button.disabled=false}}
  async function copySystemStatus(){if(!lastSystemText)await loadSystem();try{await navigator.clipboard.writeText(lastSystemText);set('serviceSystemMessage','Состояние системы скопировано ✅')}catch(_){const area=document.createElement('textarea');area.value=lastSystemText;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();set('serviceSystemMessage','Состояние системы скопировано ✅')}}
  async function loadDiagnosticLog(){const box=document.getElementById('adminDiagnosticLogText');if(!box)return;if(!getKey()){box.value='Сначала сохраните ключ администратора.';return}const button=document.getElementById('adminDiagnosticLogRefresh');if(button)button.disabled=true;set('adminDiagnosticLogMessage','Собираем журнал и отчёты OneSignal…');try{const data=await api('/api/push/diagnostic-log?limit=120');lastDiagnosticText=data.text||'';box.value=lastDiagnosticText;set('adminDiagnosticLogMessage',`Журнал обновлён: ${formatDate(data.generatedAt)} ✅`);set('adminDiagnosticLogState','Обновлён')}catch(error){box.value=`Не удалось загрузить журнал: ${error.message}`;set('adminDiagnosticLogMessage',`Ошибка: ${error.message}`)}finally{if(button)button.disabled=false}}
  async function copyDiagnosticLog(){if(!lastDiagnosticText)await loadDiagnosticLog();const text=lastDiagnosticText||document.getElementById('adminDiagnosticLogText')?.value||'';try{await navigator.clipboard.writeText(text);set('adminDiagnosticLogMessage','Технический журнал скопирован ✅')}catch(_){const box=document.getElementById('adminDiagnosticLogText');box?.focus();box?.select();document.execCommand('copy');set('adminDiagnosticLogMessage','Технический журнал выделен и скопирован ✅')}}
  function downloadDiagnosticLog(){const text=lastDiagnosticText||document.getElementById('adminDiagnosticLogText')?.value||'';const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`andrik-diagnostic-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);set('adminDiagnosticLogMessage','TXT-файл сохранён ✅')}
  document.getElementById('serviceVerify')?.addEventListener('click',verify);
  keyInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();verify()}});
  remember?.addEventListener('change',saveKey);
  document.getElementById('serviceForget')?.addEventListener('click',async()=>{await window.AndrikOwnerSession?.clear?.();keyInput.value='';remember.checked=false;try{sessionStorage.removeItem(KEY_SESSION);localStorage.removeItem(KEY_LOCAL)}catch(_){}access(false,'Защищённая сессия удалена с этого устройства.');});
  const ownerButton=document.getElementById('adminPushRegister');if(ownerButton)ownerButton.textContent='Восстановить PUSH на этом телефоне';
  document.getElementById('adminPushRegister')?.addEventListener('click',registerOwnerPush);
  // R768: owner repair is now a signed Control→main-origin bridge; no ADMIN_KEY crosses origins.
  document.getElementById('adminPushTestOwner')?.addEventListener('click',()=>sendPush('owner','ANDRIK Control','Тестовое уведомление владельца работает.','https://andrikmetal.com/','adminPushStatus'));
  document.getElementById('adminPlaylistInspect')?.addEventListener('click',()=>inspectPlaylist());
  document.getElementById('adminPlaylistCheck')?.addEventListener('click',checkPlaylist);
  document.getElementById('adminPlaylistRetryLatest')?.addEventListener('click',retryLatestPush);
  document.getElementById('adminDiagnosticLogRefresh')?.addEventListener('click',loadDiagnosticLog);
  document.getElementById('adminDiagnosticLogCopy')?.addEventListener('click',copyDiagnosticLog);
  document.getElementById('adminDiagnosticLogDownload')?.addEventListener('click',downloadDiagnosticLog);
  document.getElementById('serviceSystemRefresh')?.addEventListener('click',loadSystem);
  document.getElementById('serviceSystemCopy')?.addEventListener('click',copySystemStatus);
  document.getElementById('serviceCronRun')?.addEventListener('click',runCentralCron);
  document.getElementById('serviceCronRefresh')?.addEventListener('click',loadSystem);
  document.getElementById('serviceCacheReset')?.addEventListener('click',()=>{
    if(!confirm('Очистить старый кэш Control и открыть свежую версию? ADMIN_KEY и push-подписка сохранятся.'))return;
    set('serviceCacheResetMessage','Открываем безопасную очистку…');
    location.href=`/cache-reset.html?manual=1&force=1&fresh=${Date.now()}`;
  });
  if(IS_CONTROL_HOST&&'serviceWorker'in navigator)navigator.serviceWorker.register('/service-worker.js?v=55.00-r487',{scope:'/',updateViaCache:'none'}).catch(()=>{});
  if(installButton){installButton.hidden=!IS_CONTROL_HOST;if(IS_CONTROL_HOST&&isStandalone()){installButton.hidden=false;installButton.disabled=true;installButton.textContent='ANDRIK Control установлен'}}
  window.addEventListener('beforeinstallprompt',event=>{if(!IS_CONTROL_HOST)return;event.preventDefault();installPrompt=event;if(installButton&&!isStandalone()){installButton.hidden=false;installButton.disabled=false;installButton.textContent='Установить ANDRIK Control'}});
  installButton?.addEventListener('click',async()=>{if(isStandalone()){msg.textContent='Приложение уже установлено.';return}if(!installPrompt){msg.textContent='Откройте меню Chrome и выберите «Установить приложение».';return}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null});
  if(getKey()){verify();setTimeout(()=>{loadSystem();loadYoutubeOauthStatus();loadSearchConsoleDiagnostic(false);inspectPlaylist();loadDiagnosticLog()},250)}else access(false,'Ключ ещё не сохранён.');
})();
