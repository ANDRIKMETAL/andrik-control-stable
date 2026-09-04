(() => {
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const CACHE_KEY='andrik-control-youtube-pane-r910-artist';
  const MONITOR_CACHE_KEY='andrik-control-youtube-monitor-r910-artist';
  const INTEGRATED=document.body.classList.contains('analytics-swipe-page');
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const number=value=>new Intl.NumberFormat('ru-RU').format(Number(value||0));
  const formatDuration=value=>{const total=Math.max(0,Math.round(Number(value||0)));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`};
  const dateTime=value=>{try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch(_){return value||'—'}};
  const shortDate=value=>{const s=String(value||'').replaceAll('-','');return /^\d{8}$/.test(s)?`${s.slice(6,8)}.${s.slice(4,6)}`:s};
  const COUNTRY_MAP={US:'США',SK:'Словакия',CN:'Китай',CA:'Канада',FR:'Франция',NL:'Нидерланды',GB:'Великобритания',DE:'Германия',UA:'Украина',RU:'Россия',CZ:'Чехия',PL:'Польша',AT:'Австрия',ES:'Испания',IT:'Италия',BR:'Бразилия',AU:'Австралия',JP:'Япония',IN:'Индия',KZ:'Казахстан',BY:'Беларусь',UZ:'Узбекистан',BG:'Болгария',KG:'Кыргызстан',AE:'ОАЭ',IR:'Иран',LT:'Литва',LV:'Латвия',PR:'Пуэрто-Рико'};
  const SHARING_MAP={WHATS_APP:'WhatsApp',FACEBOOK:'Facebook',COPY_TO_CLIPBOARD:'Копирование ссылки',COPY_PASTE:'Копирование ссылки',OTHER:'Другое',TEXT_MESSAGE:'SMS',SMS:'SMS',EMAIL:'Gmail',GMAIL:'Gmail',MESSENGER:'Messenger',FACEBOOK_MESSENGER:'Facebook Messenger',TELEGRAM:'Telegram',X:'X / Twitter',VKONTAKTE:'ВКонтакте',ODNOKLASSNIKI:'Одноклассники',DIRECT_SYSTEM_ACTIVITY_DIALOG:'Системное меню Android',ANDROID_SYSTEM_SHARE_DIALOG:'Системное меню Android',DIRECT_SYSTEM:'Системное меню Android',UNKNOWN:'Другое'};
  const YOUTUBE_PRODUCT_MAP={CORE:'YouTube',MUSIC:'YouTube Music',KIDS:'YouTube Kids',GAMING:'YouTube Gaming',UNKNOWN:'Другое'};
  const CONTENT_TYPE_MAP={SHORTS:'Shorts',VIDEO_ON_DEMAND:'Обычные видео',LIVE_STREAM:'Live',STORY:'Истории',UNSPECIFIED:'Другое'};
  const SUB_STATUS_MAP={SUBSCRIBED:'Подписчики',UNSUBSCRIBED:'Не подписаны'};
  const TRAFFIC_MAP={ADVERTISING:'Реклама',ANNOTATION:'Аннотации',END_SCREEN:'Конечные заставки',EXT_URL:'Внешние сайты / Google',HASHTAGS:'Хэштеги',LIVE_REDIRECT:'Live Redirect',NO_LINK_EMBEDDED:'Встроенные плееры',NO_LINK_OTHER:'Прямые / приложения',NOTIFICATION:'Уведомления',PLAYLIST:'Плейлисты',PRODUCT_PAGE:'Страница товара',PROMOTED:'Продвижение YouTube',RELATED_VIDEO:'Похожие видео',SHORTS:'Лента Shorts',SOUND_PAGE:'Страница звука',SUBSCRIBER:'Лента подписок',YT_CHANNEL:'Страницы каналов',YT_OTHER_PAGE:'Другие страницы YouTube',YT_SEARCH:'Поиск YouTube',VIDEO_REMIXES:'Ремиксы Shorts',WATCH_WITH:'Watch With'};
  const EVENT_ICONS={'youtube-comment':'💬','youtube-like':'👍','youtube-subscriber':'👥','youtube-subscriber-count':'👥','site-subscriber':'👥','comment-live':'💬','comment-pending':'💬'};
  const ageLabels={'age13-17':'13–17','age18-24':'18–24','age25-34':'25–34','age35-44':'35–44','age45-54':'45–54','age55-64':'55–64','age65-':'65+'};
  const genderLabels={male:'Мужчины',female:'Женщины',user_specified:'Другое'};
  const translateCountry=value=>{const raw=String(value||'').trim(),code=raw.toUpperCase();if(COUNTRY_MAP[code])return COUNTRY_MAP[code];if(/^[A-Z]{2}$/.test(code)){try{return new Intl.DisplayNames(['ru'],{type:'region'}).of(code)||raw}catch(_){}}return raw||'—'};
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
  const percent=(value,total)=>total>0?`${(100*Number(value||0)/Number(total)).toLocaleString('ru-RU',{maximumFractionDigits:1})}%`:'—';
  function renderArtistBreakdown(id,items=[],dimensionKey,labelMap={}){
    const box=$(id);if(!box)return;
    const rows=(Array.isArray(items)?items:[]).filter(row=>Number(row?.views||0)>0).slice().sort((a,b)=>Number(b.views||0)-Number(a.views||0));
    if(!rows.length){box.innerHTML='<div class="admin-empty">YouTube пока не вернул данные за 28 дней.</div>';return}
    const max=Math.max(1,...rows.map(row=>Number(row.views||0)));
    const total=rows.reduce((sum,row)=>sum+Number(row.views||0),0);
    box.innerHTML=rows.slice(0,12).map((row,index)=>`<article class="analytics-list-row artist-list-row"><span class="analytics-list-index">${index+1}</span><div><strong>${escapeHtml(labelMap[row[dimensionKey]]||row[dimensionKey]||'Другое')}</strong><i><b style="width:${Math.max(3,Number(row.views||0)/max*100)}%"></b></i><small>${number(row.estimatedMinutesWatched||0)} мин просмотра</small></div><em>${number(row.views)} <small>${percent(row.views,total)}</small></em></article>`).join('');
  }
  let artistRefreshR910Promise=null,artistExtrasR910Promise=null,artistExtrasLoadedR910=0;
  function artistHasMissingBreakdownsR910(studio={}){
    const views=Number(studio?.summary?.views||0);
    if(views<=0)return false;
    return !Array.isArray(studio.products28)||!studio.products28.length||!Array.isArray(studio.contentTypes28)||!studio.contentTypes28.length||!Array.isArray(studio.trafficSources28)||!studio.trafficSources28.length||!Array.isArray(studio.subscriptionStatus28)||!studio.subscriptionStatus28.length;
  }
  async function forceArtistRefreshR910(reason='manual'){
    if(!getKey())return;
    if(artistRefreshR910Promise)return artistRefreshR910Promise;
    artistRefreshR910Promise=(async()=>{
      const button=$('youtubeArtistRefresh');
      if(button){button.disabled=true;button.textContent='Обновляем…'}
      try{
        await api('/api/control/snapshots/refresh',{method:'POST'});
        try{sessionStorage.setItem('andrik-r910-artist-refresh-ok',String(Date.now()))}catch(_){ }
        if(INTEGRATED&&typeof window.andrikRefreshAudience==='function')await window.andrikRefreshAudience();else await load();
      }catch(error){
        const status=$('youtubeArtistRefreshStatus');if(status)status.textContent=`Не удалось обновить: ${error.message}`;
      }finally{
        if(button){button.disabled=false;button.textContent='↻ Обновить данные артиста'}
        artistRefreshR910Promise=null;
      }
    })();
    return artistRefreshR910Promise;
  }
  function maybeAutoRefreshArtistR910(studio={}){
    const version=String(studio?.artistAnalytics?.version||'');
    if(version==='r910'&&!artistHasMissingBreakdownsR910(studio))return;
    let last=0;try{last=Number(sessionStorage.getItem('andrik-r910-artist-auto-refresh')||0)}catch(_){ }
    if(Date.now()-last<10*60*1000)return;
    try{sessionStorage.setItem('andrik-r910-artist-auto-refresh',String(Date.now()))}catch(_){ }
    setTimeout(()=>void forceArtistRefreshR910('auto'),350);
  }
  function renderArtistTracksR910(data={}){
    const box=$('youtubeArtistPopularTracks');if(!box)return;
    const rows=Array.isArray(data.tracks)?data.tracks:[];
    if(!rows.length){
      const href=escapeHtml(data.channelUrl||'https://www.youtube.com/@andrikmetal');
      box.innerHTML=`<div class="admin-empty">YouTube не отдал публичную полку автоматически. <a href="${href}" target="_blank" rel="noopener">Открыть канал ↗</a></div>`;
      return;
    }
    box.innerHTML=rows.slice(0,6).map((row,index)=>`<a class="youtube-artist-track-row" href="${escapeHtml(row.url||data.channelUrl||'#')}" target="_blank" rel="noopener"><img src="${escapeHtml(row.thumbnail||'')}" alt=""><span><small>#${index+1} · OAC</small><strong>${escapeHtml(row.title||'Трек')}</strong></span><em>↗</em></a>`).join('');
  }
  function renderArtistShortsInlineR910(data={}){
    const box=$('youtubeArtistTopShortsInline');if(!box)return;
    const rows=Array.isArray(data.shorts)?data.shorts:[];
    if(!rows.length){box.innerHTML='<div class="admin-empty">YouTube пока не вернул топ Shorts.</div>';return}
    box.innerHTML=rows.slice(0,4).map((row,index)=>`<a class="youtube-artist-track-row" href="${escapeHtml(row.url||('#'))}" target="_blank" rel="noopener"><img src="${escapeHtml(row.thumbnail||'')}" alt=""><span><small>#${index+1} · ${number(row.views||0)} просмотров</small><strong>${escapeHtml(row.title||'Shorts')}</strong></span><em>↗</em></a>`).join('');
  }
  async function loadArtistExtrasR910(force=false){
    if(!getKey())return;
    if(!force&&Date.now()-artistExtrasLoadedR910<5*60*1000)return;
    if(artistExtrasR910Promise)return artistExtrasR910Promise;
    artistExtrasR910Promise=(async()=>{
      try{
        const [shelf,top]=await Promise.all([
          api('/api/control/youtube-oac-shelf?v=55.00-r910').catch(error=>({available:false,error:error.message,tracks:[],channelUrl:'https://www.youtube.com/@andrikmetal'})),
          api('/api/control/youtube-top-content?v=55.00-r910').catch(error=>({available:false,error:error.message,shorts:[]}))
        ]);
        renderArtistTracksR910(shelf||{});renderArtistShortsInlineR910(top||{});artistExtrasLoadedR910=Date.now();
      }finally{artistExtrasR910Promise=null}
    })();
    return artistExtrasR910Promise;
  }
  function renderArtistStudio(yt={},studio={}){
    const section=$('youtubeArtistSection');if(!section)return;
    if(!studio.connected){section.hidden=true;return}
    section.hidden=false;
    const products=Array.isArray(studio.products28)?studio.products28:[];
    const types=Array.isArray(studio.contentTypes28)?studio.contentTypes28:[];
    const music=products.find(row=>String(row.youtubeProduct||'').toUpperCase()==='MUSIC')||{};
    const shorts=types.find(row=>String(row.creatorContentType||'').toUpperCase()==='SHORTS')||{};
    const vod=types.find(row=>String(row.creatorContentType||'').toUpperCase()==='VIDEO_ON_DEMAND')||{};
    const live=types.find(row=>String(row.creatorContentType||'').toUpperCase()==='LIVE_STREAM')||{};
    const kpis=$('youtubeArtistKpis');
    if(kpis)kpis.innerHTML=[kpi('🎵',number(music.views),'YouTube Music · 28 дней',`${number(music.estimatedMinutesWatched)} минут просмотра`,'youtube'),kpi('⚡',number(shorts.views),'Shorts · 28 дней',`${number(shorts.engagedViews)} вовлечённых просмотров`,'youtube'),kpi('🎬',number(vod.views),'Видео · 28 дней',`${number(vod.estimatedMinutesWatched)} минут просмотра`,'youtube'),kpi('🔴',number(live.views),'Live · 28 дней',`${number(live.estimatedMinutesWatched)} минут просмотра`,'youtube')].join('');
    renderArtistBreakdown('youtubeArtistProducts',products,'youtubeProduct',YOUTUBE_PRODUCT_MAP);
    renderArtistBreakdown('youtubeArtistFormats',types,'creatorContentType',CONTENT_TYPE_MAP);
    renderArtistBreakdown('youtubeArtistTraffic',studio.trafficSources28||[],'insightTrafficSourceType',TRAFFIC_MAP);
    renderArtistBreakdown('youtubeArtistSubscriptions',studio.subscriptionStatus28||[],'subscribedStatus',SUB_STATUS_MAP);
    const status=$('youtubeArtistRefreshStatus');
    if(status){const errors=Array.isArray(studio.partialErrors)?studio.partialErrors:[];status.textContent=errors.length?`Часть artist-запросов: ${errors[0]}`:`Снимок: ${studio.updatedAt?dateTime(studio.updatedAt):'обновляется'}`;}
    maybeAutoRefreshArtistR910(studio);
    void loadArtistExtrasR910(false);
    const link=$('youtubeArtistStudioLink');if(link){const channelId=String(yt.channelId||studio.channelId||'').trim();link.href=channelId?`https://studio.youtube.com/channel/${encodeURIComponent(channelId)}/analytics/tab-overview/period-default`:'https://studio.youtube.com/';}
  }
  const youtubeTrendState={field:'views',rows:[]};
  const YOUTUBE_TREND_OPTIONS=[
    {field:'views',label:'Просмотры'},
    {field:'estimatedMinutesWatched',label:'Время'},
    {field:'likes',label:'Лайки'},
    {field:'comments',label:'Комменты'},
    {field:'shares',label:'Репосты'},
    {field:'subscribersNet',label:'Подписчики'}
  ];
  function renderYoutubeTrend(rows=[]){
    const box=$('youtubeStudioTrend'),tog=$('youtubeStudioTrendToggles');if(!box)return;
    youtubeTrendState.rows=(Array.isArray(rows)?rows:[]).map(r=>({...r,subscribersNet:Number(r.subscribersGained||0)-Number(r.subscribersLost||0)}));
    const usable=YOUTUBE_TREND_OPTIONS.filter(option=>youtubeTrendState.rows.some(r=>Number.isFinite(Number(r?.[option.field]))));
    if(!usable.length){if(tog)tog.innerHTML='';box.innerHTML='<div class="admin-empty">За этот период данных пока нет.</div>';return}
    if(!usable.some(o=>o.field===youtubeTrendState.field))youtubeTrendState.field=usable[0].field;
    if(tog){tog.innerHTML=usable.map(o=>`<button type="button" class="youtube-trend-toggle${o.field===youtubeTrendState.field?' is-active':''}" data-youtube-trend="${escapeHtml(o.field)}">${escapeHtml(o.label)}</button>`).join('');tog.querySelectorAll('[data-youtube-trend]').forEach(button=>button.addEventListener('click',()=>{youtubeTrendState.field=button.dataset.youtubeTrend||'views';renderYoutubeTrend(youtubeTrendState.rows)}));}
    const field=youtubeTrendState.field;
    const vals=youtubeTrendState.rows.map(r=>Number(r?.[field]||0));
    const max=Math.max(1,...vals.map(v=>Math.max(0,v))),min=Math.min(0,...vals);
    const span=Math.max(1,max-min);
    box.innerHTML=`<div class="analytics-bars youtube-bars youtube-single-bars">${youtubeTrendState.rows.map((r,i)=>{const value=Number(r?.[field]||0);const normalized=Math.max(0,value-min);const h=Math.max(3,Math.round(normalized/span*100));const show=i===0||i===youtubeTrendState.rows.length-1||i%5===0;return `<div class="analytics-day" title="${escapeHtml(r.day)}: ${number(value)}"><div class="analytics-day-bars"><i style="height:${h}%"></i></div><small>${show?escapeHtml(shortDate(r.day)):''}</small></div>`}).join('')}</div>`;
  }
  function dateLabel(value){try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit'}).format(new Date(value))}catch(_){return ''}}
  function renderVideoList(items=[],sectionId='youtubeTopVideosSection',boxId='youtubeTopVideos',mode='views'){
    const section=$(sectionId),box=$(boxId);if(!section||!box)return;
    const list=(Array.isArray(items)?items:[]).filter(item=>item&&item.title);
    if(!list.length){section.hidden=true;box.innerHTML='';return}
    section.hidden=false;
    box.innerHTML=list.slice(0,6).map((item,index)=>{
      const views=Math.max(0,Number(item.views||0)),likes=Math.max(0,Number(item.likes||0)),comments=Math.max(0,Number(item.comments||0)),shares=Math.max(0,Number(item.shares||0));
      const interactions=likes+comments+shares;
      const er=Number.isFinite(Number(item.engagementRate))?Number(item.engagementRate):(views?100*interactions/views:0);
      const meta=[dateLabel(item.publishedAt),`${number(views)} просмотров`].filter(Boolean).join(' · ');
      const badge=mode==='engagement'?`ER ${er.toLocaleString('ru-RU',{maximumFractionDigits:1})}%`:(mode==='28d'?'28 дней':'всё время');
      const open=item.url?`<a class="youtube-video-open" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Открыть ↗</a>`:'';
      return `<article class="youtube-video-row"><div class="youtube-video-rank">#${index+1}</div><div class="youtube-video-copy"><strong>${escapeHtml(item.title||`Видео #${index+1}`)}</strong><p>${escapeHtml(meta)}</p><div class="youtube-video-stats"><span>${escapeHtml(badge)}</span><span>👍 ${number(likes)}</span><span>💬 ${number(comments)}</span>${shares?`<span>↗ ${number(shares)}</span>`:''}</div></div>${open}</article>`;
    }).join('');
  }

  let youtubeTopContentR544Promise=null,youtubeTopContentR544LoadedAt=0;
  function hideTopContentR544(){
    ['youtubeTopShortsSection','youtubeTopVideosRegularSection'].forEach(id=>{const el=$(id);if(el)el.hidden=true;});
  }
  async function loadTopContentR544(force=false){
    if(!getKey())return;
    if(!force&&Date.now()-youtubeTopContentR544LoadedAt<120000)return;
    if(youtubeTopContentR544Promise)return youtubeTopContentR544Promise;
    youtubeTopContentR544Promise=(async()=>{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
      try{
        const response=await fetch('/api/control/youtube-top-content?v=55.00-r544',{headers:{accept:'application/json',authorization:`Bearer ${getKey()}`},cache:'no-store',signal:controller.signal});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
        if(!data.available){hideTopContentR544();return;}
        renderVideoList((data.shorts||[]).slice(0,4),'youtubeTopShortsSection','youtubeTopShorts','28d');
        renderVideoList((data.videos||[]).slice(0,4),'youtubeTopVideosRegularSection','youtubeTopVideosRegular','28d');
        youtubeTopContentR544LoadedAt=Date.now();
      }catch(_){hideTopContentR544();}
      finally{clearTimeout(timer);youtubeTopContentR544Promise=null;}
    })();
    return youtubeTopContentR544Promise;
  }
  function renderCountryGrowth(studio={}){
    const section=$('youtubeCountryGrowthSection'),box=$('youtubeCountryGrowth');if(!section||!box)return;
    const rows=Array.isArray(studio.weeklyCountries)?studio.weeklyCountries:[];
    if(!rows.length){section.hidden=true;box.innerHTML='';return}
    const prev=new Map((Array.isArray(studio.previousWeekCountries)?studio.previousWeekCountries:[]).map(r=>[String(r.country||'').toUpperCase(),Number(r.views||0)]));
    const max=Math.max(1,...rows.map(r=>Number(r.views||0)));
    section.hidden=false;
    box.innerHTML=rows.slice(0,10).map((r,index)=>{const current=Math.max(0,Number(r.views||0)),before=Math.max(0,Number(prev.get(String(r.country||'').toUpperCase())||0)),delta=current-before;const sign=delta>0?'+':'';return `<article class="analytics-list-row"><span class="analytics-list-index">${index+1}</span><div><strong>${escapeHtml(translateCountry(r.country))}</strong><i><b style="width:${Math.max(3,current/max*100)}%"></b></i><small>${before?`прошлая неделя ${number(before)}`:'новая страна'}</small></div><em>${number(current)} <small class="youtube-country-delta${delta>0?' is-up':delta<0?' is-down':''}">${sign}${number(delta)}</small></em></article>`}).join('');
  }
  function updateProfileLink(yt={}){const link=$('youtubeProfileLink');if(!link)return;const handle=String(yt.handle||'@andrikmetal').trim();const url=handle?`https://www.youtube.com/${handle.startsWith('@')?handle:'@'+handle}`:'https://www.youtube.com/@andrikmetal';link.href=url;}
  function showStudioDisconnected(status={}){
    const gate=$('youtubeStudioGate'),section=$('youtubeStudioSection'),audience=$('youtubeAudienceSection'),trendCard=$('youtubeStudioTrendCard'),artist=$('youtubeArtistSection');
    if(section)section.hidden=true;if(audience)audience.hidden=true;if(trendCard)trendCard.hidden=true;if(artist)artist.hidden=true;
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
    updateProfileLink(yt);
    const ready=yt.configured&&!yt.error;
    $('analyticsYoutube').innerHTML=ready?[kpi('▶️',number(yt.views),'Просмотры канала',yt.title||'ANDRIK','youtube'),kpi('👥',yt.hiddenSubscribers?'—':number(yt.subscribers),yt.hiddenSubscribers?'Подписчики скрыты':'Подписчиков',yt.handle||'@andrikmetal','youtube'),kpi('🎬',number(yt.videos),'Видео на канале','YouTube Data API','youtube')].join(''):`<div class="admin-empty">YouTube: ${escapeHtml(yt.error||'API не подключён')}</div>`;
    const studio=yt.studio||{},gate=$('youtubeStudioGate'),section=$('youtubeStudioSection'),audience=$('youtubeAudienceSection'),trendCard=$('youtubeStudioTrendCard');
    const topVideos=(Array.isArray(yt.topVideos)&&yt.topVideos.length?yt.topVideos:(Array.isArray(yt.recentVideos)?yt.recentVideos:[])).slice().sort((a,b)=>Number(b.views||0)-Number(a.views||0)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
    renderVideoList(topVideos,'youtubeTopVideosSection','youtubeTopVideos','all');
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
    renderArtistStudio(yt,studio);
    renderVideoList(studio.topVideos28||[],'youtubeTop28Section','youtubeTop28','28d');
    renderVideoList(studio.engagementVideos28||[],'youtubeEngagement28Section','youtubeEngagement28','engagement');
    renderCountryGrowth(studio);
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
    setTimeout(()=>void loadTopContentR544(false),250);
  }

  async function connectYoutubeStudio(){
    const button=$('youtubeStudioConnect');
    if(!getKey()){
      authState(false,'Сначала сохраните ключ владельца в разделе «Служебное».');
      location.href='/service-admin.html?return=youtube&v=55.00j-r544';
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
    try{const data=await api('/api/control/audience?refresh=1&v=55.00d');renderPayload(data)}
    catch(error){authState(error.message!=='unauthorized',error.message==='unauthorized'?'Ключ не принят':`Ошибка: ${error.message}`)}
  }
  $('youtubeEventsRun')?.addEventListener('click',runYoutubeEvents);
  document.addEventListener('click',event=>{if(event.target.closest?.('#youtubeStudioConnect'))connectYoutubeStudio();if(event.target.closest?.('#youtubeArtistRefresh'))void forceArtistRefreshR910('manual');});
  const oauthState=new URLSearchParams(location.search).get('youtube');
  if(oauthState==='connected'){
    void finishYoutubeOAuth();
    try{history.replaceState(null,'',location.pathname+(INTEGRATED?'?page=youtube&v=55.00d':'?v=55.00j-r544'))}catch(_){}
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
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!INTEGRATED)load()});
  window.addEventListener('beforeunload',()=>refreshTimer&&clearInterval(refreshTimer));
})();
