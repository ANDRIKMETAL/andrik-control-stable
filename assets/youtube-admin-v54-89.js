(() => {
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const CACHE_KEY='andrik-control-youtube-pane-v54-89';
  const MONITOR_CACHE_KEY='andrik-control-youtube-monitor-v54-85';
  const INTEGRATED=document.body.classList.contains('analytics-swipe-page');
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const number=value=>new Intl.NumberFormat('ru-RU').format(Number(value||0));
  const formatDuration=value=>{const total=Math.max(0,Math.round(Number(value||0)));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`};
  const dateTime=value=>{try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch(_){return value||'—'}};
  const shortDate=value=>{const s=String(value||'').replaceAll('-','');return /^\d{8}$/.test(s)?`${s.slice(6,8)}.${s.slice(4,6)}`:s};
  const COUNTRY_MAP={US:'США',SK:'Словакия',CN:'Китай',CA:'Канада',FR:'Франция',NL:'Нидерланды',GB:'Великобритания',DE:'Германия',UA:'Украина',RU:'Россия',CZ:'Чехия',PL:'Польша',AT:'Австрия',ES:'Испания',IT:'Италия',BR:'Бразилия',AU:'Австралия',JP:'Япония',IN:'Индия',KZ:'Казахстан',BY:'Беларусь',UZ:'Узбекистан'};
  const SHARING_MAP={WHATS_APP:'WhatsApp',FACEBOOK:'Facebook',COPY_TO_CLIPBOARD:'Копирование ссылки',COPY_PASTE:'Копирование ссылки',OTHER:'Другое',TEXT_MESSAGE:'SMS',EMAIL:'Email',MESSENGER:'Messenger',FACEBOOK_MESSENGER:'Facebook Messenger',TELEGRAM:'Telegram',X:'X / Twitter',VKONTAKTE:'ВКонтакте',ODNOKLASSNIKI:'Одноклассники',UNKNOWN:'Другое'};
  const EVENT_ICONS={'youtube-comment':'💬','youtube-like':'👍','youtube-subscriber':'👥','youtube-subscriber-count':'👥','site-subscriber':'👥','comment-live':'💬','comment-pending':'💬'};
  const ageLabels={'age13-17':'13–17','age18-24':'18–24','age25-34':'25–34','age35-44':'35–44','age45-54':'45–54','age55-64':'55–64','age65-':'65+'};
  const genderLabels={male:'Мужчины',female:'Женщины',user_specified:'Другое'};
  const translateCountry=value=>{const raw=String(value||'').trim();return COUNTRY_MAP[raw.toUpperCase()]||raw||'—'};
  const translateSharing=value=>{const raw=String(value||'').trim();return SHARING_MAP[raw]||SHARING_MAP[raw.toUpperCase()]||raw||'—'};
  async function api(path,options={}){const response=await fetch(path,{...options,headers:{accept:'application/json',authorization:`Bearer ${getKey()}`,...(options.headers||{})},cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.details||data.error||`HTTP ${response.status}`);return data}
  function readCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null')}catch(_){return null}}
  function saveCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({data,savedAt:Date.now()}))}catch(_){}}
  function readMonitorCache(){try{return JSON.parse(localStorage.getItem(MONITOR_CACHE_KEY)||'null')}catch(_){return null}}
  function saveMonitorCache(data){try{localStorage.setItem(MONITOR_CACHE_KEY,JSON.stringify({data,savedAt:Date.now()}))}catch(_){}}
  let manualMonitorCheck=false;
  const successfulStatus=value=>['success','seeded'].includes(String(value||''));
  const effectiveMonitor=incoming=>{
    const next=incoming&&typeof incoming==='object'?incoming:{};
    const cached=readMonitorCache()?.data||null;
    if(!manualMonitorCheck&&cached&&successfulStatus(cached.status)&&(!next.status||['running','never'].includes(String(next.status))))return cached;
    return next;
  };
  function authState(ok,text){$('youtubeAuthStrip')?.classList.toggle('is-ready',ok);if($('youtubeAuthText'))$('youtubeAuthText').textContent=text}
  function kpi(icon,value,label,detail,tone=''){return `<article class="analytics-kpi ${tone?`is-${tone}`:''}"><span class="analytics-kpi-icon">${icon}</span><div class="analytics-kpi-copy"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><em>${escapeHtml(detail)}</em></div></article>`}
  function renderList(id,items,valueKey,labelKey){const box=$(id);if(!box)return;if(!items?.length){box.innerHTML='<div class="admin-empty">Данных пока нет.</div>';return}const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));box.innerHTML=items.map((item,index)=>`<article class="analytics-list-row"><span class="analytics-list-index">${index+1}</span><div><strong>${escapeHtml(item[labelKey]||'Без названия')}</strong><i><b style="width:${Math.max(3,Number(item[valueKey]||0)/max*100)}%"></b></i></div><em>${number(item[valueKey])}</em></article>`).join('')}
  function renderPercentList(id,items,labelKey,labelMap={}){const box=$(id);if(!box)return;if(!items?.length){box.innerHTML='<div class="admin-empty">Недостаточно данных.</div>';return}const max=Math.max(1,...items.map(x=>Number(x.viewerPercentage||0)));box.innerHTML=items.map((item,index)=>`<article class="analytics-list-row"><span class="analytics-list-index">${index+1}</span><div><strong>${escapeHtml(labelMap[item[labelKey]]||item[labelKey]||'—')}</strong><i><b style="width:${Math.max(3,Number(item.viewerPercentage||0)/max*100)}%"></b></i></div><em>${Number(item.viewerPercentage||0).toLocaleString('ru-RU',{maximumFractionDigits:1})}%</em></article>`).join('')}
  function renderYoutubeTrend(rows=[]){const box=$('youtubeStudioTrend');if(!box)return;if(!rows.length){box.innerHTML='<div class="admin-empty">За этот период данных пока нет.</div>';return}const maxViews=Math.max(1,...rows.map(r=>Number(r.views||0))),maxReactions=Math.max(1,...rows.map(r=>Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0)));box.innerHTML=`<div class="analytics-bars youtube-bars">${rows.map((r,i)=>{const reactions=Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0),h=Math.max(3,Math.round(Number(r.views||0)/maxViews*100)),rh=Math.max(2,Math.round(reactions/maxReactions*100)),show=i===0||i===rows.length-1||i%5===0;return `<div class="analytics-day" title="${escapeHtml(r.day)}: ${number(r.views)} просмотров"><div class="analytics-day-bars"><i style="height:${h}%"></i><b style="height:${rh}%"></b></div><small>${show?escapeHtml(shortDate(r.day)):''}</small></div>`}).join('')}</div><div class="analytics-chart-key"><span><i class="is-users"></i>Просмотры</span><span><i class="is-views"></i>Реакции</span></div>`}
  function showStudioDisconnected(status={}){
    const gate=$('youtubeStudioGate'),section=$('youtubeStudioSection'),audience=$('youtubeAudienceSection'),trendCard=$('youtubeStudioTrendCard');
    if(section)section.hidden=true;if(audience)audience.hidden=true;if(trendCard)trendCard.hidden=true;
    const clientMissing=!status.clientConfigured||status.error==='youtube-oauth-client-not-configured';
    const label=clientMissing?'Настроить OAuth':'Подключить Studio';
    if(gate)gate.innerHTML=`<div class="youtube-studio-inline-disconnected"><button class="youtube-studio-connect-button" id="youtubeStudioConnect" type="button">${label}</button><small class="youtube-studio-connect-help">Авторизация Google сохранит серверный refresh token в Cloudflare/D1.</small></div>`;
  }
  function showStudioConnected(){
    const gate=$('youtubeStudioGate');
    if(gate)gate.innerHTML='<div class="youtube-studio-status-connected" title="Refresh token проверен сервером Cloudflare"><i></i><span>Studio подключён</span></div>';
  }
  let oauthStatusRequest=null;
  async function loadStudioAuthStatus(verify=true){
    if(oauthStatusRequest)return oauthStatusRequest;
    const request=api(`/api/control/youtube-oauth/status${verify?'?verify=1':''}`);
    oauthStatusRequest=request;
    try{
      const status=await request;
      if(status.connected)showStudioConnected();else showStudioDisconnected(status);
      return status;
    }catch(error){
      showStudioDisconnected({error:error.message});
      return null;
    }finally{if(oauthStatusRequest===request)oauthStatusRequest=null}
  }
  function renderYoutube(yt={}){
    const ready=yt.configured&&!yt.error;
    $('analyticsYoutube').innerHTML=ready?[kpi('▶️',number(yt.views),'Просмотры канала',yt.title||'ANDRIK','youtube'),kpi('👥',yt.hiddenSubscribers?'—':number(yt.subscribers),yt.hiddenSubscribers?'Подписчики скрыты':'Подписчиков',yt.handle||'@andrikmetal','youtube'),kpi('🎬',number(yt.videos),'Видео на канале','YouTube Data API','youtube')].join(''):`<div class="admin-empty">YouTube: ${escapeHtml(yt.error||'API не подключён')}</div>`;
    const studio=yt.studio||{},gate=$('youtubeStudioGate'),section=$('youtubeStudioSection'),audience=$('youtubeAudienceSection'),trendCard=$('youtubeStudioTrendCard');
    if(!studio.connected){
      showStudioDisconnected(studio);
      return
    }
    showStudioConnected();
    if(trendCard)trendCard.hidden=false;
    section.hidden=false;audience.hidden=false;
    const x=studio.summary||{};
    $('youtubeStudioKpis').innerHTML=[kpi('👀',number(x.views),'Просмотры за 28 дней',`${number(x.estimatedMinutesWatched)} минут просмотра`,'youtube'),kpi('👍',number(x.likes),'Лайки',`${number(x.comments)} комментариев`,'youtube'),kpi('↗️',number(x.shares),'Поделились',`${number(x.subscribersGained)} новых подписчиков`,'youtube'),kpi('⏱️',formatDuration(x.averageViewDuration),'Средний просмотр',`${number(x.subscribersLost)} отписок`,'youtube')].join('');
    renderYoutubeTrend(studio.trend||[]);
    renderPercentList('youtubeStudioAge',studio.age,'ageGroup',ageLabels);
    renderPercentList('youtubeStudioGender',studio.gender,'gender',genderLabels);
    renderList('youtubeStudioSharing',(studio.sharing||[]).map(item=>({...item,sharingService:translateSharing(item.sharingService)})),'shares','sharingService');
  }
  function renderYoutubeMonitor(monitor={}){
    monitor=effectiveMonitor(monitor);
    const statusMap={success:['Работает','is-good'],warning:['Есть предупреждение','is-warning'],seeded:['Работает','is-good'],running:['Проверяем…','is-running'],failed:['Нужна проверка','is-error'],never:['Ещё не запускался','is-warning']};
    const [label,cls]=statusMap[monitor.status]||statusMap.never;
    const summary=monitor.summary||{};
    const box=$('youtubeMonitor');
    if(!box)return;
    box.innerHTML=`<div class="youtube-monitor-head ${cls}"><span></span><strong>${escapeHtml(label)}</strong><em>${monitor.lastCheckAt?dateTime(monitor.lastCheckAt):'нет запуска'}</em></div><div class="youtube-monitor-grid"><span><b>${monitor.configured?'✓':'—'}</b>Data API</span><span><b>${monitor.oauthConnected?'✓':'—'}</b>Studio OAuth</span><span><b>${monitor.ownerPushConfigured?'✓':'—'}</b>Push</span></div><p>${escapeHtml(monitor.limitations||'')}</p>${summary.error?`<small class="youtube-monitor-error">${escapeHtml(summary.error)}</small>`:''}`;
    if(monitor&&(successfulStatus(monitor.status)||monitor.status==='failed'||monitor.status==='warning'))saveMonitorCache(monitor);
  }
  function renderEvents(events=[]){const box=$('youtubeEventFeed');if(!events.length){box.innerHTML='<div class="admin-empty">Новые события появятся после первой проверки.</div>';return}box.innerHTML=events.filter(item=>String(item.type||'').startsWith('youtube-')).map(item=>{const icon=EVENT_ICONS[item.type]||'•';const title=item.title||item.videoTitle||'Событие YouTube';const message=item.message||item.videoTitle||'';const body=`<span class="youtube-event-icon">${icon}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p><small>${dateTime(item.createdAt)}</small></div><em>›</em>`;return item.url?`<a class="youtube-event-row" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${body}</a>`:`<article class="youtube-event-row">${body}</article>`}).join('')||'<div class="admin-empty">Событий YouTube пока нет.</div>'}
  function renderAlbums(albums=[]){const box=$('albumStats');if(!box)return;box.innerHTML=albums.map(item=>{const planned=item.status==='planned';const body=`<span class="control-album-badge">${planned?'⏳':'💿'}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.releaseDate)}${item.tracks?` · ${item.tracks} треков`:''}</small></div><span class="control-album-state ${planned?'is-planned':'is-live'}">${planned?'план':'вышел'}</span>`;return item.youtubeUrl?`<a class="control-album-card" href="${escapeHtml(item.youtubeUrl)}" target="_blank" rel="noopener">${body}</a>`:`<article class="control-album-card">${body}</article>`}).join('')}
  function renderPayload(data={}){
    renderYoutube(data.youtube||{});
    renderYoutubeMonitor(data.youtubeMonitor||{});
    renderAlbums(data.albums||[]);
    saveCache(data);
    void loadStudioAuthStatus(true);
  }

  async function connectYoutubeStudio(){
    const button=$('youtubeStudioConnect');
    if(!getKey()){
      authState(false,'Сначала сохраните ключ владельца в разделе «Служебное».');
      location.href='/service-admin.html?return=youtube&v=54.89';
      return;
    }
    if(button){button.disabled=true;button.textContent='Открываем Google…'}
    try{
      const result=await api('/api/control/youtube-oauth/start');
      if(!result?.url)throw new Error('Ссылка авторизации не получена');
      location.assign(result.url);
    }catch(error){
      const message=String(error?.message||error);
      if(button){button.disabled=false;button.textContent='Подключить Studio'}
      if(message.includes('youtube-oauth-client-not-configured')){
        alert('В Cloudflare нужны секреты YOUTUBE_OAUTH_CLIENT_ID и YOUTUBE_OAUTH_CLIENT_SECRET. После их сохранения нажмите кнопку ещё раз.');
      }else alert(`YouTube Studio: ${message}`);
    }
  }

  async function finishYoutubeOAuth(){
    authState(true,'Studio подключён · обновляем полную статистику…');
    showStudioConnected();
    try{
      await api('/api/control/snapshots/refresh',{method:'POST'});
      if(INTEGRATED&&typeof window.andrikRefreshAudience==='function')await window.andrikRefreshAudience();
      else await load();
      authState(true,'YouTube Studio подключён и статистика обновлена');
    }catch(error){
      authState(true,`Studio подключён · снимок обновится Cron: ${error.message}`);
    }
  }

  async function runYoutubeEvents(){
    const button=$('youtubeEventsRun');
    manualMonitorCheck=true;
    if(button){button.disabled=true;button.textContent='Проверяем…'}
    const previous=readMonitorCache()?.data||{};
    renderYoutubeMonitor({...previous,status:'running',lastCheckAt:new Date().toISOString()});
    try{
      const result=await api('/api/push/check-youtube-events',{method:'POST'});
      const returned=result.youtubeMonitor||result.monitor||{};
      const successMonitor={
        ...previous,
        ...returned,
        status:'success',
        lastCheckAt:returned.lastCheckAt||result.checkedAt||result.updatedAt||new Date().toISOString(),
        configured:returned.configured??previous.configured??true,
        oauthConnected:returned.oauthConnected??previous.oauthConnected??true,
        ownerPushConfigured:returned.ownerPushConfigured??previous.ownerPushConfigured??true
      };
      saveMonitorCache(successMonitor);
      renderYoutubeMonitor(successMonitor);
      const pieces=[];
      if(result.seeded)pieces.push('Первый запуск: старые события запомнены без уведомлений.');
      else pieces.push(`Комментарии: ${result.newComments||0}, подписки: ${result.subscriberDelta||0}, лайки: +${result.likeChanges||0}.`);
      if(result.warnings?.length)pieces.push(result.warnings.join(' · '));
      alert(pieces.join('\n'));
      manualMonitorCheck=false;
      if(INTEGRATED&&typeof window.andrikRefreshAudience==='function')await window.andrikRefreshAudience();else await load();
      renderYoutubeMonitor(successMonitor);
    }catch(error){
      manualMonitorCheck=false;
      const failed={...previous,status:'failed',lastCheckAt:new Date().toISOString(),summary:{...(previous.summary||{}),error:error.message}};
      renderYoutubeMonitor(failed);
      alert(`YouTube-события: ${error.message}`);
    }finally{
      manualMonitorCheck=false;
      if(button){button.disabled=false;button.textContent='Проверить сейчас'}
    }
  }
  let refreshTimer=null;
  async function load(){
    if(!getKey()){authState(false,'Сначала сохраните ключ в разделе «Служебное».');return}
    authState(true,'Доступ подтверждён');
    if(INTEGRATED){
      const latest=window.__andrikLatestAudienceData;
      if(latest){renderPayload(latest);return}
      try{
        if(window.__andrikAudiencePromise){const data=await window.__andrikAudiencePromise;if(data)renderPayload(data)}
      }catch(_){ }
      return;
    }
    try{const data=await api('/api/control/audience');renderPayload(data)}
    catch(error){authState(error.message!=='unauthorized',error.message==='unauthorized'?'Ключ не принят':`Ошибка: ${error.message}`)}
  }
  $('youtubeEventsRun')?.addEventListener('click',runYoutubeEvents);
  document.addEventListener('click',event=>{if(event.target.closest?.('#youtubeStudioConnect'))connectYoutubeStudio()});
  const oauthState=new URLSearchParams(location.search).get('youtube');
  if(oauthState==='connected'){
    void finishYoutubeOAuth();
    try{history.replaceState(null,'',location.pathname+(INTEGRATED?'?page=youtube&v=54.89':'?v=54.89'))}catch(_){}
  }
  const cachedMonitor=readMonitorCache();
  if(cachedMonitor?.data){try{renderYoutubeMonitor(cachedMonitor.data);authState(true,'Сохранённый статус · обновляем…')}catch(_){}}
  const cached=readCache();
  if(cached?.data){try{renderPayload(cached.data);authState(true,'Данные из быстрого кэша · обновляем…')}catch(_){}}
  window.addEventListener('andrik:audience-data',event=>{if(event.detail){authState(true,'Доступ подтверждён');renderPayload(event.detail)}});
  window.addEventListener('andrik:audience-error',event=>{if(INTEGRATED&&!cached?.data)authState(false,`Ошибка: ${event.detail?.message||'данные недоступны'}`)});
  window.addEventListener('andrik:youtube-pane-visible',()=>{if(!cached?.data&&!window.__andrikLatestAudienceData)load()});
  setTimeout(load,INTEGRATED?40:20);
  setTimeout(()=>loadStudioAuthStatus(true),120);
  if(!INTEGRATED)refreshTimer=setInterval(()=>{if(!document.hidden)load()},120000);
  window.addEventListener('beforeunload',()=>refreshTimer&&clearInterval(refreshTimer));
})();
