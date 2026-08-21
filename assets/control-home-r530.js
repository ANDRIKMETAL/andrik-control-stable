/* Control ANDRIK R511 — four-platform daily summary + direct Social Center detail routes. */
(() => {
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const number=value=>new Intl.NumberFormat('ru-RU').format(Number(value||0));
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const dateTime=value=>{try{return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}).format(new Date(value))}catch(_){return value||'—'}};
  const relative=value=>{const time=Date.parse(value||'');if(!Number.isFinite(time))return'—';const minutes=Math.max(0,Math.round((Date.now()-time)/60000));if(minutes<1)return'только что';if(minutes<60)return`${minutes} мин. назад`;const hours=Math.round(minutes/60);if(hours<24)return`${hours} ч. назад`;return dateTime(value)};
  const LOCATION_PARAMS=new URLSearchParams(location.search);
  const PUSH_SUMMARY_WINDOW_RAW=String(LOCATION_PARAMS.get('summaryWindow')||'');
  const PUSH_SUMMARY_WINDOW_KEY=/^\d{4}-\d{2}-\d{2}$/.test(PUSH_SUMMARY_WINDOW_RAW)?PUSH_SUMMARY_WINDOW_RAW:'';
  const PUSH_SUMMARY_SNAPSHOT_RAW=String(LOCATION_PARAMS.get('summarySnapshot')||'');
  const PUSH_SUMMARY_SNAPSHOT_ID=/^[a-z0-9][a-z0-9:_-]{5,119}$/i.test(PUSH_SUMMARY_SNAPSHOT_RAW)?PUSH_SUMMARY_SNAPSHOT_RAW:'';
  const IS_PUSH_SUMMARY_VIEW=LOCATION_PARAMS.get('source')==='push'&&Boolean(PUSH_SUMMARY_WINDOW_KEY);
  const IS_ARCHIVE_SUMMARY_VIEW=IS_PUSH_SUMMARY_VIEW&&LOCATION_PARAMS.get('archive')==='1';
  let runtimeArchiveWindowKeyR442=IS_ARCHIVE_SUMMARY_VIEW?PUSH_SUMMARY_WINDOW_KEY:'';
  const isArchiveViewR442=()=>Boolean(runtimeArchiveWindowKeyR442);
  const eventMeta=type=>({
    'youtube-like':['👍','Новый лайк YouTube'],
    'youtube-comment':['💬','Комментарий YouTube'],
    'youtube-comment-count':['💬','Новый комментарий YouTube'],
    'youtube-subscriber':['👤','Новый подписчик YouTube'],
    'youtube-subscriber-count':['👤','Рост подписчиков YouTube'],
    'site-subscriber':['👤','Новый подписчик сайта'],
    'comment-live':['💬','Новый комментарий'],
    'comment-pending':['💬','Комментарий на модерации'],
    'auto-release':['🎵','Новый релиз YouTube'],
    'auto-release-retry':['🎵','Новый релиз YouTube'],
    'release-publish':['🚀','Релиз опубликован']
  }[type]||['•','Событие ANDRIK']);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    history.scrollRestoration='manual';
    window.scrollTo(0,0);
    const prefetch=document.createElement('link');
    prefetch.rel='prefetch';
    prefetch.href='/analytics-admin.html?page=google&source=admin-hub-swipe&v=55.00-r420';
    document.head.appendChild(prefetch);
  }catch(_){}

  let allActivityEvents=[];
  let sourcePages=[];
  let dailyCityRowsR375=[];
  let mapCityRowsR395=[];
  let latestHomeDataR509=null;
  let latestSocialDataR509=null;
  let socialFetchPromiseR509=null;
  let socialFetchAtR509=0;
  const SOCIAL_CACHE_KEY_R509='andrik-social-center-data-r506';
  const HOME_CACHE_KEY_LIVE='andrik-control-home-last-good-r136';
  const HOME_CACHE_KEY_PUSH_BASE='andrik-control-home-push-r305';
  function activeViewWindowKey(){return IS_PUSH_SUMMARY_VIEW?PUSH_SUMMARY_WINDOW_KEY:currentSummaryWindowKey()}
  function homeCacheKey(){return IS_PUSH_SUMMARY_VIEW?`${HOME_CACHE_KEY_PUSH_BASE}:${activeViewWindowKey()}:${PUSH_SUMMARY_SNAPSHOT_ID||'legacy-r366'}`:HOME_CACHE_KEY_LIVE}
  function saveHomeCache(data){try{localStorage.setItem(homeCacheKey(),JSON.stringify({savedAt:new Date().toISOString(),data}))}catch(_){}}
  function readHomeCache(){try{const raw=localStorage.getItem(homeCacheKey());if(!raw)return null;const parsed=JSON.parse(raw);return parsed?.data?parsed:null}catch(_){return null}}

  const SUMMARY_AUTO_AT_KEY_R396='andrik-control-summary-auto-at-r396';
  const SUMMARY_MANUAL_AT_KEY_R396='andrik-control-summary-manual-at-r396';
  let lastAutoUpdatedAtR396='';
  let lastManualUpdatedAtR396='';
  function readStoredClockR396(key){try{return String(localStorage.getItem(key)||'')}catch(_){return ''}}
  function writeStoredClockR396(key,value){if(!value)return;try{localStorage.setItem(key,String(value))}catch(_){}}
  function compactClockR396(value){
    const ms=Date.parse(value||'');
    if(!Number.isFinite(ms))return '—';
    return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
  }
  function absorbUpdateTimesR396(data={}){
    const auto=String(data?.autoUpdatedAt||data?.accumulatorUpdatedAt||'').trim();
    const manual=String(data?.manualUpdatedAt||'').trim();
    if(auto){lastAutoUpdatedAtR396=auto;writeStoredClockR396(SUMMARY_AUTO_AT_KEY_R396,auto)}
    if(manual){lastManualUpdatedAtR396=manual;writeStoredClockR396(SUMMARY_MANUAL_AT_KEY_R396,manual)}
    if(!lastAutoUpdatedAtR396)lastAutoUpdatedAtR396=readStoredClockR396(SUMMARY_AUTO_AT_KEY_R396);
    if(!lastManualUpdatedAtR396)lastManualUpdatedAtR396=readStoredClockR396(SUMMARY_MANUAL_AT_KEY_R396);
  }
  function renderUpdateTimesR396({manualBusy=false}={}){
    const box=$('controlHomeUpdated');
    if(!box)return;
    if(!lastAutoUpdatedAtR396)lastAutoUpdatedAtR396=readStoredClockR396(SUMMARY_AUTO_AT_KEY_R396);
    if(!lastManualUpdatedAtR396)lastManualUpdatedAtR396=readStoredClockR396(SUMMARY_MANUAL_AT_KEY_R396);
    const auto=compactClockR396(lastAutoUpdatedAtR396);
    const manual=manualBusy?'…':compactClockR396(lastManualUpdatedAtR396);
    const archiveButton=$('controlSummaryArchiveR442');
    box.innerHTML=`<span class="summary-clock-r401"><b>Авто:</b> ${escapeHtml(auto)}</span><span class="summary-clock-r401"><b>Ручное:</b> ${escapeHtml(manual)}</span><span class="summary-calendar-slot-r442" aria-hidden="false"></span>`;
    if(archiveButton)box.querySelector('.summary-calendar-slot-r442')?.appendChild(archiveButton);
    box.title=`Последнее автообновление: ${auto}; последнее ручное обновление: ${manual}`;
  }


  function shiftSummaryDate(dateText,days){
    const match=String(dateText||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return'';
    const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])+Number(days||0)));
    return date.toISOString().slice(0,10);
  }
  function currentSummaryWindowKey(){
    const values={};
    try{
      for(const part of new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date())){
        if(part.type!=='literal')values[part.type]=part.value;
      }
      const date=`${values.year}-${values.month}-${values.day}`;
      const hour=Number(values.hour||0),minute=Number(values.minute||0);
      return hour>6||(hour===6&&minute>=5)?date:shiftSummaryDate(date,-1);
    }catch(_){
      const now=new Date();
      const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      return now.getHours()>6||(now.getHours()===6&&now.getMinutes()>=5)?date:shiftSummaryDate(date,-1);
    }
  }
  function emptySummaryPayload(){
    return {ok:true,period:'06:05-auto-cycle',windowKey:activeViewWindowKey(),updatedAt:new Date().toISOString(),summary:{websiteUsers:0,websiteViews:0,siteSubscribers:0,siteComments:0,siteLikes:0,youtubeComments:0,youtubeSubscribers:0,youtubeLikes:0,youtubeViews:0,youtubeViewDelta:0,releases:0,countryDeltas:[],totalCountries:0,countryDate:''},activity:[]};
  }
  function cachedForCurrentWindow(cached){return Boolean(cached?.data&&cached.data.windowKey===activeViewWindowKey())}
  function summaryHasSignalR375(data={}){
    const s=data?.summary||{};
    const keys=['websiteUsers','websiteViews','siteSubscribers','siteComments','siteLikes','youtubeComments','youtubeSubscribers','youtubeLikes','youtubeViews','youtubeViewDelta','releases'];
    return keys.some(key=>Number(s[key]||0)>0)
      || (Array.isArray(data?.activity)&&data.activity.length>0)
      || (Array.isArray(data?.cityActivity)&&data.cityActivity.some(item=>Number(item?.opens||0)>0));
  }

  const SUMMARY_NUMBER_KEYS_R213=['websiteUsers','websiteViews','siteSubscribers','siteComments','siteLikes','youtubeComments','youtubeSubscribers','youtubeLikes','youtubeViews','youtubeViewDelta','releases','totalCountries'];
  function mergeSummaryPayloadR213(previous,incoming){
    if(!previous||!incoming||previous.windowKey!==incoming.windowKey)return incoming;
    const merged={...incoming,summary:{...(incoming.summary||{})}};
    const old=previous.summary||{};
    for(const key of SUMMARY_NUMBER_KEYS_R213){
      merged.summary[key]=Math.max(0,Number(old[key]||0),Number(merged.summary[key]||0));
    }
    const oldCountries=Array.isArray(old.countryDeltas)?old.countryDeltas:[];
    const newCountries=Array.isArray(merged.summary.countryDeltas)?merged.summary.countryDeltas:[];
    if(oldCountries.length>newCountries.length)merged.summary.countryDeltas=oldCountries;
    if(!merged.summary.countryDate&&old.countryDate)merged.summary.countryDate=old.countryDate;
    const events=[...(Array.isArray(incoming.activity)?incoming.activity:[]),...(Array.isArray(previous.activity)?previous.activity:[])];
    const seen=new Set();
    merged.activity=events.filter(item=>{
      const id=String(item?.id||`${item?.type||''}|${item?.videoId||''}|${item?.createdAt||''}|${item?.title||''}`);
      if(seen.has(id))return false; seen.add(id); return true;
    }).slice(0,200);
    merged.summarySource=String(incoming.summarySource||'').includes('push')?incoming.summarySource:(previous.summarySource||incoming.summarySource||'high-water');
    const incomingCities=Array.isArray(incoming.cityActivity)?incoming.cityActivity:[];
    const oldCities=Array.isArray(previous.cityActivity)?previous.cityActivity:[];
    merged.cityActivity=mergeCityRowsR374(oldCities,incomingCities).slice(0,50);
    const incomingMapCities=Array.isArray(incoming.cityMapActivity)?incoming.cityMapActivity:[];
    const oldMapCities=Array.isArray(previous.cityMapActivity)?previous.cityMapActivity:[];
    merged.cityMapActivity=mergeCityRowsR374(oldMapCities,incomingMapCities).slice(0,80);
    return merged;
  }

  function activityRow(event,{modal=false}={}){
    const [icon,label]=eventMeta(event.type);
    const href=event.url||'/admin/';
    const external=/^https?:\/\//i.test(href)&&!href.includes('control.andrikmetal.com');
    const attrs=modal?' data-activity-modal-link="true"':'';
    return `<a class="control-home-activity-row${modal?' is-modal-row':''}" href="${escapeHtml(href)}"${external?' target="_blank" rel="noopener"':''}${attrs}><span class="control-home-activity-icon">${icon}</span><div><strong>${escapeHtml(event.title||label)}</strong><p>${escapeHtml(event.message||label)}</p><small>${escapeHtml(relative(event.createdAt))}</small></div><b>›</b></a>`;
  }

  function renderActivityModal(){
    const box=$('controlActivityModalList');
    if(!box)return;
    box.innerHTML=allActivityEvents.length
      ? allActivityEvents.map(event=>activityRow(event,{modal:true})).join('')
      : '<div class="admin-empty">За последние 24 часа новых событий пока нет. Тихая смена 🌙</div>';
  }

  function setActivityModal(open){
    const modal=$('controlActivityModal');
    const button=$('controlActivityOpen');
    if(!modal||!button)return;
    if(open){
      renderActivityModal();
      modal.hidden=false;
      modal.setAttribute('aria-hidden','false');
      button.classList.add('is-active');
      button.setAttribute('aria-expanded','true');
      document.body.classList.add('activity-modal-open');
      requestAnimationFrame(()=>$('controlActivityClose')?.focus());
    }else{
      modal.setAttribute('aria-hidden','true');
      modal.hidden=true;
      button.classList.remove('is-active');
      button.setAttribute('aria-expanded','false');
      document.body.classList.remove('activity-modal-open');
      button.focus();
    }
  }

  async function api(path,{timeoutMs=12000,method='GET',body=null,headers={}}={}){
    const key=getKey();
    if(!key)throw new Error('Ключ владельца не сохранён');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort('timeout'),timeoutMs);
    try{
      const requestHeaders={accept:'application/json',authorization:`Bearer ${key}`,...headers};
      let requestBody;
      if(body!==null&&body!==undefined){
        if(typeof body==='string')requestBody=body;
        else{
          requestBody=JSON.stringify(body);
          if(!requestHeaders['content-type']&&!requestHeaders['Content-Type'])requestHeaders['content-type']='application/json';
        }
      }
      const response=await fetch(path,{method,headers:requestHeaders,body:requestBody,cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.details||data.error||`HTTP ${response.status}`);
      return data;
    }catch(error){
      if(error?.name==='AbortError'||error==='timeout')throw new Error('Сервер сводки отвечает слишком долго');
      throw error;
    }finally{clearTimeout(timer)}
  }

  function summaryCard(icon,value,title,note,tone='',href=''){
    const tag=href?'a':'article';
    const link=href?` href="${escapeHtml(href)}"`:'';
    return `<${tag} class="control-home-summary-item ${tone?`is-${tone}`:''}"${link}><span>${icon}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(title)}</small><em>${escapeHtml(note)}</em></${tag}>`;
  }

  function finitePositiveR509(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?n:null;
  }
  function socialCacheR509(){
    try{const parsed=JSON.parse(localStorage.getItem(SOCIAL_CACHE_KEY_R509)||'null');return parsed?.ok?parsed:null}catch(_){return null}
  }
  function saveSocialCacheR509(data){if(!data?.ok)return;try{localStorage.setItem(SOCIAL_CACHE_KEY_R509,JSON.stringify(data))}catch(_){}}
  function platformMetricR509(value,label,prefix=''){
    const n=finitePositiveR509(value);
    if(n===null)return'';
    return `<div class="control-platform-metric-r509"><strong>${escapeHtml(prefix)}${escapeHtml(number(n))}</strong><small>${escapeHtml(label)}</small></div>`;
  }
  function platformCardR509({key,title,icon,scope,href,metrics=[]}){
    const cells=metrics.filter(Boolean).slice(0,4).join('');
    const body=cells||'<div class="control-platform-nochange-r509">Нет новых значимых данных</div>';
    const tag=href?'a':'article';
    const link=href?` href="${escapeHtml(href)}"`:'';
    return `<${tag} class="control-platform-card-r509 is-${escapeHtml(key)}"${link}><span class="control-platform-watermark-r509" aria-hidden="true">${icon}</span><header><span class="control-platform-icon-r509" aria-hidden="true">${icon}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(scope)}</small></div></header><div class="control-platform-metrics-r509">${body}</div></${tag}>`;
  }
  function nullableNumberR510(value,fallback=0){
    if(value===null||value===undefined||value==='')return Number(fallback||0);
    const n=Number(value);
    return Number.isFinite(n)?n:Number(fallback||0);
  }
  function renderPlatformSummaryR509(data={}){
    latestHomeDataR509=data||latestHomeDataR509;
    const box=$('controlHomeSummary');if(!box)return;
    const s=data?.summary||{};
    const archive=isArchiveViewR442()||IS_PUSH_SUMMARY_VIEW;
    const social=archive?null:(latestSocialDataR509||socialCacheR509());
    if(!latestSocialDataR509&&social)latestSocialDataR509=social;
    const ig=social?.platforms?.instagram?.summary||{};
    const tt=social?.platforms?.tiktok?.summary||{};
    const ytToday=data?.youtubeToday||{};
    // R510: null from the calendar-day helper means “no midnight baseline”, not zero.
    // Fall back to the stable daily summary so YouTube values do not flash and disappear.
    const ytViews=nullableNumberR510(ytToday?.views,s.youtubeViewDelta||s.youtubeViews||0);
    const ytSubs=nullableNumberR510(ytToday?.subscribers,s.youtubeSubscribers||0);
    const ytLikes=nullableNumberR510(ytToday?.likes,s.youtubeLikes||0);
    const ytComments=nullableNumberR510(ytToday?.comments,s.youtubeComments||0);
    const citySource=Array.isArray(data?.cityTodayActivity)?data.cityTodayActivity:(Array.isArray(data?.cityActivity)?data.cityActivity:[]);
    const cityCount=citySource.filter(row=>Number(row?.visitors||row?.opens||0)>0).length;
    const cards=[
      platformCardR509({key:'site',title:'Сайт',icon:'⌂',scope:archive?'24 часа':'сегодня',href:'/analytics-admin.html?page=google&source=admin-hub-swipe&v=55.00-r530',metrics:[
        platformMetricR509(s.websiteUsers,'посетители'),
        platformMetricR509(s.websiteViews,'просмотры'),
        platformMetricR509(cityCount,'города'),
        platformMetricR509(s.siteSubscribers,'новые подписчики','+')
      ]}),
      platformCardR509({key:'youtube',title:'YouTube',icon:'▶',scope:archive?'точный день':'с 00:00',href:'/youtube-admin.html?refresh=1&v=55.00-r530',metrics:[
        platformMetricR509(ytViews,'просмотры'),
        platformMetricR509(ytSubs,'подписчики','+'),
        platformMetricR509(ytLikes,'лайки'),
        platformMetricR509(ytComments,'комментарии')
      ]}),
      platformCardR509({key:'instagram',title:'Instagram',icon:'◎',scope:archive?'нет архивного среза':'свежий срез · 28 дней',href:'/instagram-admin.html?source=summary&v=55.00-r530',metrics:archive?[]:[
        platformMetricR509(ig.reach,'охват'),
        platformMetricR509(ig.totalInteractions,'взаимодействия'),
        platformMetricR509(ig.likes,'лайки'),
        platformMetricR509(ig.comments,'комментарии'),
        platformMetricR509(ig.saves,'сохранения'),
        platformMetricR509(ig.shares,'репосты')
      ]}),
      platformCardR509({key:'tiktok',title:'TikTok',icon:'♪',scope:archive?'нет архивного среза':'текущий срез',href:'/tiktok-admin.html?source=summary&v=55.00-r530',metrics:archive?[]:[
        platformMetricR509(tt.totalVideoViews,'просмотры'),
        platformMetricR509(tt.totalVideoLikes??tt.profileLikes,'лайки'),
        platformMetricR509(tt.totalVideoComments,'комментарии'),
        platformMetricR509(tt.followerCount,'подписчики'),
        platformMetricR509(tt.totalVideoShares,'репосты')
      ]})
    ];
    box.innerHTML=cards.join('');
  }
  async function hydrateSocialSummaryR509(data={}){
    if(isArchiveViewR442()||IS_PUSH_SUMMARY_VIEW)return;
    latestHomeDataR509=data||latestHomeDataR509;
    const cached=socialCacheR509();
    if(cached){latestSocialDataR509=cached;renderPlatformSummaryR509(latestHomeDataR509||data)}
    if(socialFetchPromiseR509)return socialFetchPromiseR509;
    if(Date.now()-socialFetchAtR509<30000)return null;
    socialFetchAtR509=Date.now();
    const mode=(()=>{try{return String(localStorage.getItem('andrik-tiktok-oauth-mode-r506')||'sandbox')}catch(_){return'sandbox'}})();
    socialFetchPromiseR509=api(`/api/control/social-overview?fast=1&tiktok_mode=${encodeURIComponent(mode)}&v=55.00-r530`,{timeoutMs:9000})
      .then(fresh=>{if(fresh?.ok){latestSocialDataR509=fresh;saveSocialCacheR509(fresh);renderPlatformSummaryR509(latestHomeDataR509||data)}return fresh})
      .catch(()=>null)
      .finally(()=>{socialFetchPromiseR509=null});
    return socialFetchPromiseR509;
  }

  function syncCarouselClones(){}

  function renderGeoDelta(summary={}){
    const box=$('controlHomeGeoDelta');
    if(!box)return;
    const deltas=Array.isArray(summary.countryDeltas)?summary.countryDeltas.filter(item=>Number(item?.delta||0)>0):[];
    if(!deltas.length){box.hidden=true;box.innerHTML='';return;}
    const line=deltas.slice(0,4).map(item=>`${escapeHtml(item.flag||'🌍')} ${escapeHtml(item.country||'Страна')} +${number(item.delta)}`).join(' • ');
    const extra=deltas.length>4?` · ещё +${deltas.length-4}`:'';
    box.hidden=false;
    box.innerHTML=`<strong>🌍 За сутки YouTube:</strong><span>${line}${escapeHtml(extra)}</span>${summary.totalCountries?`<small>Стран в аудитории YouTube за 28 дней: ${number(summary.totalCountries)}</small>`:''}`;
  }


  function countryFlagR370(code=''){
    const iso=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(iso))return '🌍';
    return String.fromCodePoint(...[...iso].map(ch=>127397+ch.charCodeAt(0)));
  }

  function cityCacheKeyR374(data={}){
    const key=String(data?.windowKey||activeViewWindowKey()||'').trim();
    return key?`andrik-control-city-highwater-r374:${key}`:'';
  }

  function mergeCityRowsR374(previous=[],incoming=[]){
    const merged=new Map();
    for(const item of [...previous,...incoming]){
      const city=String(item?.city||'').trim();
      const region=String(item?.region||'').trim();
      const country=String(item?.country||'').trim().toUpperCase();
      const label=String(item?.label||city||region||'Город / регион').trim();
      const key=`${country}|${city.toLocaleLowerCase('ru')}|${region.toLocaleLowerCase('ru')}`;
      const current=merged.get(key)||{city,region,country,label,opens:0,visitors:0,lastAt:'',trafficSources:[]};
      current.opens=Math.max(Number(current.opens||0),Number(item?.opens||0));
      current.visitors=Math.max(Number(current.visitors||0),Number(item?.visitors||0));
      if(String(item?.lastAt||'')>String(current.lastAt||''))current.lastAt=String(item.lastAt||'');
      if(city)current.city=city;
      if(region)current.region=region;
      if(country)current.country=country;
      if(label)current.label=label;
      const sourceMap=new Map((Array.isArray(current.trafficSources)?current.trafficSources:[]).map(src=>[String(src?.key||src?.label||'unknown'),{...src}]));
      for(const src of Array.isArray(item?.trafficSources)?item.trafficSources:[]){
        const sourceKey=String(src?.key||src?.label||'unknown');
        const old=sourceMap.get(sourceKey)||{};
        sourceMap.set(sourceKey,{
          key:sourceKey,
          label:String(src?.label||old.label||'Источник не сохранён'),
          icon:String(src?.icon||old.icon||'↗️'),
          events:Math.max(Number(old.events||0),Number(src?.events||0))
        });
      }
      current.trafficSources=[...sourceMap.values()].filter(src=>Number(src.events||0)>0).sort((a,b)=>Number(b.events||0)-Number(a.events||0));
      merged.set(key,current);
    }
    return [...merged.values()].filter(item=>Number(item.opens||0)>0)
      .sort((a,b)=>Number(b.visitors||0)-Number(a.visitors||0)||Number(b.opens||0)-Number(a.opens||0)||String(b.lastAt||'').localeCompare(String(a.lastAt||'')));
  }

  function readCityCacheR374(data={}){
    const key=cityCacheKeyR374(data);
    if(!key)return [];
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch(_){return []}
  }

  function writeCityCacheR374(data={},rows=[]){
    const key=cityCacheKeyR374(data);
    if(!key||!rows.length)return;
    try{localStorage.setItem(key,JSON.stringify(rows.slice(0,50)))}catch(_){}
  }

  function renderCityModalR375(){
    const box=$('controlCityModalListR375');
    if(!box)return;
    const title=$('controlCityModalTitleR375');
    const rows=dailyCityRowsR375.length?dailyCityRowsR375:mapCityRowsR395;
    if(title)title.textContent=dailyCityRowsR375.length?'📍 Города за день':'📍 Города на карте';
    if(!rows.length){
      box.innerHTML='<div class="admin-empty">Города с доступной географией пока не зафиксированы.</div>';
      return;
    }
    box.innerHTML=rows.map((item,index)=>{
      const place=String(item?.city||item?.label||item?.region||'Город / регион');
      const region=String(item?.region||'').trim();
      const regionLine=region&&region.toLocaleLowerCase('ru')!==place.toLocaleLowerCase('ru')?`<small>${escapeHtml(region)}</small>`:'';
      const traffic=(Array.isArray(item?.trafficSources)?item.trafficSources:[]).filter(src=>Number(src?.events||0)>0).slice(0,3);
      const sourceText=traffic.length
        ? traffic.map(src=>`${escapeHtml(src?.icon||'↗️')} ${escapeHtml(src?.label||'Источник')} ${number(src?.events||0)}`).join(' · ')
        : '↗ Источник не сохранён';
      const sourceClass=traffic.length?'control-city-source-inline-r447':'control-city-source-inline-r447 is-unknown';
      const people=Math.max(0,Number(item?.visitors||0))||Math.max(0,Number(item?.opens||0));
      return `<div class="control-city-modal-row-r375"><b>${number(index+1)}</b><span>${countryFlagR370(item?.country||'')}</span><div><strong>${escapeHtml(place)}</strong>${regionLine}<small class="${sourceClass}">${sourceText}</small></div><em>${number(people)} <small>чел.</small></em></div>`;
    }).join('');
  }

  function setCityModalR375(open){
    const modal=$('controlCityModalR375');
    if(!modal)return;
    if(open){
      renderCityModalR375();
      modal.hidden=false;
      modal.setAttribute('aria-hidden','false');
      document.body.classList.add('city-modal-r375-open');
      requestAnimationFrame(()=>$('controlCityCloseR375')?.focus());
    }else{
      modal.setAttribute('aria-hidden','true');
      modal.hidden=true;
      document.body.classList.remove('city-modal-r375-open');
      $('controlCitiesDayR375')?.focus();
    }
  }

  function renderDailyCitiesR370(data={}){
    const sourceRows=(!isArchiveViewR442()&&!IS_PUSH_SUMMARY_VIEW&&Array.isArray(data.cityTodayActivity))?data.cityTodayActivity:data.cityActivity;
    const incoming=Array.isArray(sourceRows)?sourceRows.filter(item=>Number(item?.opens||0)>0):[];
    const cached=readCityCacheR374(data);
    const rows=mergeCityRowsR374(cached,incoming);
    if(incoming.length)writeCityCacheR374(data,rows);
    dailyCityRowsR375=rows.slice(0,50);
    mapCityRowsR395=mergeCityRowsR374([],Array.isArray(data.cityMapActivity)?data.cityMapActivity:[]).slice(0,80);
    const visibleRows=dailyCityRowsR375.length?dailyCityRowsR375:mapCityRowsR395;
    const count=$('controlCityCountR375');
    if(count)count.textContent=number(visibleRows.length);
    const button=$('controlCitiesDayR375');
    if(button){button.classList.toggle('is-empty',visibleRows.length===0);const label=button.querySelector('small');if(label)label.textContent=dailyCityRowsR375.length?'Города за день':'Города на карте';}
    if(!$('controlCityModalR375')?.hidden)renderCityModalR375();
  }

  function renderSummary(data){
    const archiveView=isArchiveViewR442();
    const archiveKey=runtimeArchiveWindowKeyR442||PUSH_SUMMARY_WINDOW_KEY;
    const pushSnapshot=IS_PUSH_SUMMARY_VIEW||archiveView||data?.summaryView==='completed-push';
    if(archiveView&&archiveKey){
      const title=$('controlHomeTitle');
      if(title){const [y,m,d]=archiveKey.split('-');title.textContent=`Сводка за ${d}.${m}.${y}`;}
    }else if(!IS_PUSH_SUMMARY_VIEW){
      const title=$('controlHomeTitle');
      if(title)title.textContent='Сводка за сегодня';
    }
    document.body.classList.toggle('control-push-summary-view',pushSnapshot);
    const sourceBox=$('controlSummarySource');
    if(sourceBox){
      sourceBox.hidden=!pushSnapshot;
      sourceBox.textContent=pushSnapshot?(archiveView?'Архив сводок · завершённый период 06:05 → 06:05':'Сводка из push · данные этого уведомления'):'';
    }
    const s=data.summary||{};
    latestHomeDataR509=data;
    renderPlatformSummaryR509(data);
    const releaseValueR509=Math.max(0,Number(s.releases||0));
    const releaseCount=$('controlReleaseCountR375');
    if(releaseCount)releaseCount.textContent=number(releaseValueR509);
    const releaseButtonR509=$('controlReleasesDayR375');
    if(releaseButtonR509)releaseButtonR509.hidden=false;
    const dualR509=$('controlSummaryDualR375');
    if(dualR509)dualR509.classList.remove('has-single-r509');
    renderGeoDelta(s);
    renderDailyCitiesR370(data);
    if(!archiveView)absorbUpdateTimesR396(data);
    renderUpdateTimesR396();
    syncCarouselClones();
  }

  function renderActivity(events=[]){
    const box=$('controlHomeActivity');
    const foot=$('controlActivityFootnote');
    allActivityEvents=Array.isArray(events)?events:[];
    // R448: archive summary may be opened while the Activity pane is not mounted.
    // Never let a missing optional pane abort the whole archived-day render.
    if(!box){
      if(!$('controlActivityModal')?.hidden)renderActivityModal();
      return;
    }
    if(!allActivityEvents.length){
      box.innerHTML='<div class="admin-empty">За последние 24 часа новых событий пока нет. Тихая смена 🌙</div>';
      if(foot)foot.textContent=(IS_PUSH_SUMMARY_VIEW||isArchiveViewR442())?'← Завершённый период · «24 часа» — полный список':(summaryMode?'← Сводка за сегодня · «24 часа» — полный список':'← Сводка · «24 часа» — полный список');
      if(!$('controlActivityModal')?.hidden)renderActivityModal();
      syncCarouselClones();
      return;
    }
    box.innerHTML=allActivityEvents.slice(0,4).map(event=>activityRow(event)).join('');
    if(foot)foot.textContent=allActivityEvents.length>4?`Последние 4 из ${allActivityEvents.length}`:'Все события показаны';
    if(!$('controlActivityModal')?.hidden)renderActivityModal();
    syncCarouselClones();
  }

  let loading=false;
  let queuedLiveRefreshR390=false;
  let fastRetryCountR398=0;
  let activeSummaryWindowKey=activeViewWindowKey();
  async function load({silent=false,forceLive=false}={}){
    if(loading)return;
    // R442: once a calendar day is opened in-place it is immutable on this screen.
    // Background/visibility refreshes must not silently replace archive cards with live data.
    if(isArchiveViewR442()&&!IS_ARCHIVE_SUMMARY_VIEW)return;
    loading=true;
  if(summaryMode){
    const cached=IS_PUSH_SUMMARY_VIEW?null:readHomeCache();
    if(cachedForCurrentWindow(cached)&&summaryHasSignalR375(cached.data)){
      renderSummary(cached.data);
      renderActivity(cached.data.activity||[]);
    }else{
      if(!IS_PUSH_SUMMARY_VIEW){try{localStorage.removeItem(homeCacheKey())}catch(_){}}
      if($('controlHomeSummary'))$('controlHomeSummary').innerHTML='<div class="admin-empty">Собираем актуальные цифры…</div>';
      if($('controlReleaseCountR375'))$('controlReleaseCountR375').textContent='—';
      if($('controlCityCountR375'))$('controlCityCountR375').textContent='—';
      renderActivity([]);
    }
  }

  const shell=$('controlSwipeShell');
    const showRefreshEffect=!silent&&currentPageElement()?.dataset.page!=='menu';
    if(!silent)renderUpdateTimesR396();
    if(showRefreshEffect)shell?.classList.add('is-refreshing');
    else shell?.classList.remove('is-refreshing');
    try{
      let data;
      if(IS_ARCHIVE_SUMMARY_VIEW){
        // R441: archived days are immutable. Load the persisted day directly instead
        // of routing through /api/control/home and its live-refresh/schema path.
        const archiveQuery=new URLSearchParams({window:PUSH_SUMMARY_WINDOW_KEY,v:'55.00-r442',t:String(Date.now())});
        data=await api(`/api/control/daily-summary/archive/day?${archiveQuery.toString()}`,{timeoutMs:10000});
      }else{
        const query=new URLSearchParams({v:'55.00-r510'});
        if(forceLive||IS_PUSH_SUMMARY_VIEW)query.set('refresh','1');
        if(IS_PUSH_SUMMARY_VIEW){query.set('source','push');query.set('window',PUSH_SUMMARY_WINDOW_KEY);if(PUSH_SUMMARY_SNAPSHOT_ID)query.set('snapshot',PUSH_SUMMARY_SNAPSHOT_ID)}
        data=await api(`/api/control/home?${query.toString()}`,{timeoutMs:forceLive&&!IS_PUSH_SUMMARY_VIEW?20000:12000});
      }
      if(!forceLive&&!IS_PUSH_SUMMARY_VIEW){
        const summary=data?.summary||{};
        const numericKeys=['websiteUsers','websiteViews','siteSubscribers','siteComments','siteLikes','youtubeComments','youtubeSubscribers','youtubeLikes','youtubeViews','youtubeViewDelta','releases'];
        const allZero=numericKeys.every(key=>Number(summary[key]||0)===0);
        const noActivity=!Array.isArray(data?.activity)||data.activity.length===0;
        // R395: server explicitly reports accumulator freshness. First paint is always
        // immediate; a stale/missing current-window accumulator refreshes silently.
        if(data?.refreshNeeded===true || (allZero&&noActivity))queuedLiveRefreshR390=true;
      }
      if(data?.windowKey)activeSummaryWindowKey=data.windowKey;
      if(!IS_PUSH_SUMMARY_VIEW && ['push-fast-r390','push-fast-r395','fast-current-empty-r395'].includes(data?.summarySource)) queuedLiveRefreshR390=true;
      const previous=readHomeCache();
      const stable=IS_PUSH_SUMMARY_VIEW?data:(cachedForCurrentWindow(previous)?mergeSummaryPayloadR213(previous.data,data):data);
      if(IS_PUSH_SUMMARY_VIEW||summaryHasSignalR375(stable))saveHomeCache(stable);
      renderSummary(stable);
      hydrateSocialSummaryR509(stable);
      renderActivity(stable.activity||[]);
      if(summaryHasSignalR375(stable))fastRetryCountR398=0;
    }catch(error){
      const cached=readHomeCache();
      if(cachedForCurrentWindow(cached)){
        renderSummary(cached.data);
        hydrateSocialSummaryR509(cached.data);
        renderActivity(cached.data.activity||[]);
        renderUpdateTimesR396();
      }else{
        if($('controlHomeSummary'))$('controlHomeSummary').innerHTML=`<div class="admin-empty">${escapeHtml(error.message)}. Откройте «Служебное» и проверьте ключ владельца.</div>`;
        if($('controlHomeActivity'))$('controlHomeActivity').innerHTML='<div class="admin-empty"><a class="btn" href="/service-admin.html">Открыть Служебное</a></div>';
        renderUpdateTimesR396();
        if($('controlHomeGeoDelta')){$('controlHomeGeoDelta').hidden=true;$('controlHomeGeoDelta').innerHTML='';}
        syncCarouselClones();
      }
    }finally{
      loading=false;
      if(showRefreshEffect)setTimeout(()=>shell?.classList.remove('is-refreshing'),260);
      else shell?.classList.remove('is-refreshing');
      if(queuedLiveRefreshR390 && !IS_PUSH_SUMMARY_VIEW && fastRetryCountR398<1){
        queuedLiveRefreshR390=false;
        fastRetryCountR398+=1;
        // R398: background server checkpoints own freshness. Never turn a normal page open
        // into the heavy forceLive path; that was the source of the recurring spinner.
        setTimeout(()=>load({silent:true,forceLive:false}),5000);
      }
    }
  }

  const requestedRaw=(LOCATION_PARAMS.get('page')||'menu').toLowerCase();
  const requestedPage=['menu','summary','activity'].includes(requestedRaw)?requestedRaw:'menu';
  const summaryMode=requestedPage==='summary'||requestedPage==='activity';

  // Summary and Activity are now true standalone screens. Keeping both panels in
  // one transformed track caused Android WebView to preserve an in-between offset.
  // Remove every non-requested panel before measuring the shell, so the only panel
  // always starts at translateX(0) and can never become half-visible.
  if(requestedPage==='summary'){
    document.body.classList.add('control-report-standalone','control-summary-standalone');
    document.querySelector('.control-menu-page')?.remove();
    document.querySelector('.control-activity-page')?.remove();
    document.querySelectorAll('[data-page-index]').forEach(dot=>{
      if(dot.getAttribute('data-page-index')!=='0')dot.remove();
      else dot.dataset.pageIndex='0';
    });
  }else if(requestedPage==='activity'){
    document.body.classList.add('control-report-standalone','control-activity-standalone');
    document.querySelector('.control-summary-page')?.remove();
    document.querySelector('.control-menu-page')?.remove();
    document.querySelectorAll('[data-page-index]').forEach(dot=>{
      if(dot.getAttribute('data-page-index')!=='2')dot.remove();
      else dot.dataset.pageIndex='0';
    });
  }else{
    document.body.classList.add('control-menu-mode');
    document.querySelector('.control-summary-page')?.remove();
    document.querySelector('.control-activity-page')?.remove();
    document.querySelector('[data-page-index="0"]')?.remove();
    document.querySelector('[data-page-index="2"]')?.remove();
    const menuDot=document.querySelector('[data-page-index="1"]');
    if(menuDot)menuDot.dataset.pageIndex='0';
  }

  const shell=$('controlSwipeShell');
  const track=$('controlSwipeTrack');
  const dots=[...document.querySelectorAll('[data-page-index]')];
  sourcePages=track?[...track.children].filter(node=>node.classList.contains('control-swipe-page')):[];

  shell?.classList.add('is-finite-ready');

  let logicalPage=Math.max(0,sourcePages.findIndex(page=>page.dataset.page===(summaryMode?(requestedPage==='activity'?'activity':'summary'):'menu')));
  let physicalPage=logicalPage;
  let gesture=null;
  let moved=false;
  let animating=false;
  let pullDistance=0;
  let pullActive=false;
  const pageCount=Math.max(1,sourcePages.length);

  function updatePageState(){
    dots.forEach((dot,index)=>dot.classList.toggle('is-active',index===logicalPage));
    sourcePages.forEach((panel,index)=>{
      panel.setAttribute('aria-hidden',index===logicalPage?'false':'true');
      if('inert' in panel)panel.inert=index!==logicalPage;
    });
    const currentName=sourcePages[logicalPage]?.dataset.page||'';
    if(currentName==='summary'){
      const currentPanel=sourcePages[logicalPage];
      requestAnimationFrame(()=>{
        try{currentPanel.scrollTop=0}catch(_){}
        try{currentPanel.querySelector('.control-swipe-page-inner')?.scrollTo?.({top:0,left:0,behavior:'instant'})}catch(_){}
      });
    }
    document.body.classList.toggle('control-summary-visible',currentName==='summary');
    document.body.classList.toggle('control-menu-visible',currentName==='menu');
    const activityButton=$('controlActivityOpen');
    if(activityButton){
      const visible=currentName==='activity';
      activityButton.hidden=false;
      activityButton.setAttribute('aria-hidden',visible?'false':'true');
      activityButton.classList.toggle('is-visible',visible);
      document.body.classList.toggle('control-activity-visible',visible);
    }
  }

  function applyPosition({animate=true,dragX=0,pullY=0,physical=physicalPage}={}){
    if(!track||!shell)return;
    track.style.transition=animate?'transform .20s cubic-bezier(.22,.78,.23,1)':'none';
    const x=-(physical*shell.clientWidth)+dragX;
    track.style.transform=`translate3d(${x}px,${pullY}px,0)`;
  }

  function setLogicalPage(next,{animate=false}={}){
    logicalPage=Math.max(0,Math.min(pageCount-1,Number(next)||0));
    physicalPage=logicalPage;
    updatePageState();
    applyPosition({animate});
  }

  async function moveRelative(direction){
    if(animating||!direction)return;
    const targetLogical=logicalPage+direction;
    if(targetLogical<0||targetLogical>=pageCount){
      applyPosition({animate:true});
      return;
    }
    animating=true;
    physicalPage=targetLogical;
    track?.classList.remove('is-dragging','is-pulling');
    applyPosition({animate:true});
    await wait(225);
    logicalPage=targetLogical;
    updatePageState();
    requestAnimationFrame(()=>{if(track)track.style.transition=''});
    animating=false;
  }

  dots.forEach((dot,index)=>dot.addEventListener('click',()=>{
    if(index===logicalPage||animating)return;
    moveRelative(index>logicalPage?1:-1);
  }));



  let dailySummarySending=false;
  let dailySummaryPointer=null;
  let dailySummaryPointerHandledAt=0;

  async function sendDailySummary(){
    if(dailySummarySending)return;
    const button=$('controlSummaryRefresh');
    const label=button?.querySelector('[data-summary-refresh-label]');
    const key=getKey();
    if(!key){
      if(label)label.textContent='Нет доступа';
      setTimeout(()=>{if(label)label.textContent='Отправить сводку'},1800);
      return;
    }
    dailySummarySending=true;
    if(button){
      button.disabled=true;
      button.setAttribute('aria-busy','true');
      button.classList.remove('is-error','is-success','is-pressed');
      button.classList.add('is-loading');
    }
    if(label)label.textContent='Собираем данные…';
    renderUpdateTimesR396({manualBusy:true});
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),32000);
    try{
      const response=await fetch('/api/control/daily-summary/send',{
        method:'POST',
        headers:{accept:'application/json','content-type':'application/json',authorization:`Bearer ${key}`},
        cache:'no-store',
        body:'{}',
        signal:controller.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok===false)throw new Error(data.details||data.error||`HTTP ${response.status}`);
      if(data?.manualUpdatedAt||data?.sentAt){
        lastManualUpdatedAtR396=String(data.manualUpdatedAt||data.sentAt||'');
        writeStoredClockR396(SUMMARY_MANUAL_AT_KEY_R396,lastManualUpdatedAtR396);
      }

      if(data?.metrics&&typeof data.metrics==='object'){
        const m=data.metrics;
        const payload={
          ok:true,
          period:'06:05-auto-cycle',
          windowKey:m.windowKey||data.windowKey||activeSummaryWindowKey,
          updatedAt:data.sentAt||new Date().toISOString(),
          summarySource:data.sent?'push-direct':'prepared-live',
          summary:{
            websiteUsers:Number(m.siteUsers||0),
            websiteViews:Number(m.siteViews||0),
            siteSubscribers:Number(m.siteSubscribers||0),
            siteComments:Number(m.siteComments||0),
            siteLikes:Number(m.siteLikes||0),
            youtubeComments:Number(m.youtubeComments||0),
            youtubeSubscribers:Number(m.youtubeSubscribers||0),
            youtubeLikes:Number(m.youtubeLikes||0),
            youtubeViews:Number(m.youtubeViewDelta||0),
            youtubeViewDelta:Number(m.youtubeViewDelta||0),
            releases:Number(m.releases||0),
            countryDeltas:Array.isArray(m.countryDeltas)?m.countryDeltas:[],
            totalCountries:Number(m.totalCountries||0),
            countryDate:m.countryDate||''
          },
          activity:allActivityEvents
        };
        activeSummaryWindowKey=payload.windowKey||activeSummaryWindowKey;
        const previous=readHomeCache();
        const stable=cachedForCurrentWindow(previous)?mergeSummaryPayloadR213(previous.data,payload):payload;
        saveHomeCache(stable);
        renderSummary(stable);
      }

      if(data.sent){
        if(label)label.textContent='Push отправлен ✓';
        button?.classList.add('is-success');
        renderUpdateTimesR396();
      }else{
        const reason=String(data.error||'push не принят');
        if(label)label.textContent='Данные обновлены';
        button?.classList.add('is-error');
        renderUpdateTimesR396();
      }
      setTimeout(()=>{
        if(label)label.textContent='Отправить сводку';
        button?.classList.remove('is-success','is-error');
      },3200);
    }catch(error){
      if(label)label.textContent='Повторить';
      button?.classList.add('is-error');
      const message=error?.name==='AbortError'?'Сервер не ответил за 32 секунды':(error?.message||'Ошибка отправки');
      renderUpdateTimesR396();
      setTimeout(()=>button?.classList.remove('is-error'),2400);
    }finally{
      clearTimeout(timer);
      dailySummarySending=false;
      if(button){
        button.disabled=false;
        button.removeAttribute('aria-busy');
        button.classList.remove('is-loading','is-pressed');
      }
    }
  }

  const applyArchiveSummaryR448=(data,key)=>{
    const safe=/^\d{4}-\d{2}-\d{2}$/.test(String(key||''))?String(key):'';
    if(!safe||!data||typeof data!=='object')return false;
    runtimeArchiveWindowKeyR442=safe;
    activeSummaryWindowKey=safe;
    // R448: the summary is the required surface; Activity is optional.
    renderSummary(data);
    try{ renderActivity(Array.isArray(data.activity)?data.activity:[]); }catch(error){ console.warn('R448 archive activity skipped',error); }
    try{
      const url=new URL(location.href);
      url.searchParams.set('page','summary');
      url.searchParams.set('source','push');
      url.searchParams.set('archive','1');
      url.searchParams.set('summaryWindow',safe);
      url.searchParams.set('v','55.00-r442');
      history.replaceState({archive:true,summaryWindow:safe},'',url.pathname+url.search);
    }catch(_){}
    try{window.scrollTo({top:0,behavior:'auto'})}catch(_){window.scrollTo(0,0)}
    return true;
  };
  window.andrikApplyArchiveSummaryR448=applyArchiveSummaryR448;
  window.andrikApplyArchiveSummaryR442=applyArchiveSummaryR448;

  const dailySummaryButton=$('controlSummaryRefresh');
  if(dailySummaryButton){
    dailySummaryButton.addEventListener('pointerdown',event=>{
      if(event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
      dailySummaryPointer={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};
      dailySummaryButton.classList.add('is-pressed');
      try{dailySummaryButton.setPointerCapture?.(event.pointerId)}catch(_){ }
    },{passive:true});

    dailySummaryButton.addEventListener('pointerup',event=>{
      const press=dailySummaryPointer;
      dailySummaryPointer=null;
      dailySummaryButton.classList.remove('is-pressed');
      if(!press||press.id!==event.pointerId)return;
      try{dailySummaryButton.releasePointerCapture?.(event.pointerId)}catch(_){ }
      const distance=Math.hypot(event.clientX-press.x,event.clientY-press.y);
      const elapsed=performance.now()-press.at;
      if(distance>20||elapsed>1800)return;
      // Android WebView can lose a synthetic click when a fixed button changes state.
      // Execute on pointerup and suppress the duplicate click that follows.
      dailySummaryPointerHandledAt=Date.now();
      event.preventDefault();
      event.stopPropagation();
      sendDailySummary();
    },{passive:false});

    dailySummaryButton.addEventListener('pointercancel',()=>{
      dailySummaryPointer=null;
      dailySummaryButton.classList.remove('is-pressed');
    });

    dailySummaryButton.addEventListener('click',event=>{
      if(Date.now()-dailySummaryPointerHandledAt<900){
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      sendDailySummary();
    });
  }

  function isInteractive(target){return Boolean(target?.closest?.('a,button,input,textarea,select,label'))}
  function currentPageElement(){return sourcePages[logicalPage]||null}
  function canPullFrom(){
    const page=currentPageElement();
    const pageScroll=Number(page?.scrollTop||page?.querySelector?.('.control-swipe-page-inner')?.scrollTop||0);
    return pageScroll<=0;
  }

  function currentPullThreshold(){
    return currentPageElement()?.dataset.page==='menu'?52:68;
  }

  function updatePullUi(distance,{loading=false}={}){
    const indicator=$('controlPullIndicator');
    const text=$('controlPullText');
    if(!indicator||!text)return;
    const threshold=currentPullThreshold();
    const ready=distance>=threshold;
    const progress=Math.min(1,distance/threshold);
    const menuReturn=currentPageElement()?.dataset.page==='menu';
    indicator.style.setProperty('--pull-progress',String(progress));
    indicator.classList.toggle('is-visible',distance>4||loading);
    indicator.classList.toggle('is-ready',ready&&!loading);
    indicator.classList.toggle('is-loading',loading);
    text.textContent=menuReturn
      ?(ready?'Отпустите — админ-панель':'Потяните вниз — админ-панель')
      :(loading?'Обновляем…':ready?'Отпустите, чтобы обновить':'Потяните вниз, чтобы обновить');
  }

  function resetGesture(){
    gesture=null;
    pullDistance=0;
    pullActive=false;
    track?.classList.remove('is-dragging','is-pulling');
  }

  function pointerDown(event){
    if(animating||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
    moved=false;
    const menuGesture=currentPageElement()?.dataset.page==='menu';
    // R422: interactive controls must never enter the legacy swipe/pull recognizer.
    // Two recognizers were competing on the Admin hub and could cancel one of the quick links.
    if(isInteractive(event.target))return;
    const landscape=window.matchMedia?.('(orientation: landscape)')?.matches===true;
    const viewportWidth=Math.max(1,window.innerWidth||document.documentElement.clientWidth||1);
    const inLandscapeCenter=event.clientX>=viewportWidth*.34&&event.clientX<=viewportWidth*.66;
    const canLandscapeMenuPull=false; // R418: map opens only from the hub globe.
    gesture={
      id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,mode:null,
      canPull:(!menuGesture&&!landscape&&canPullFrom())||canLandscapeMenuPull,
      allowHorizontal:false,
      captured:false,landscapeCenterPull:canLandscapeMenuPull
    };
    // Do not capture immediately: Android must be free to start native vertical scrolling.
  }

  function pointerMove(event){
    if(!gesture||gesture.id!==event.pointerId||animating)return;
    gesture.lastX=event.clientX;
    gesture.lastY=event.clientY;
    const dx=gesture.lastX-gesture.x;
    const dy=gesture.lastY-gesture.y;
    if(Math.abs(dx)>7||Math.abs(dy)>7)moved=true;

    if(!gesture.mode&&Math.max(Math.abs(dx),Math.abs(dy))>8){
      if(gesture.canPull&&dy>0&&Math.abs(dy)>Math.abs(dx)*1.05)gesture.mode='pull';
      else if(gesture.allowHorizontal&&Math.abs(dx)>Math.abs(dy)*1.04)gesture.mode='horizontal';
      else gesture.mode='vertical';
    }

    if(gesture.mode==='pull'){
      if(!gesture.captured){try{shell?.setPointerCapture?.(event.pointerId);gesture.captured=true}catch(_){ }}
      event.preventDefault();
      pullActive=true;
      pullDistance=Math.min(112,Math.max(0,dy)*.58);
      track?.classList.add('is-pulling');
      applyPosition({animate:false,pullY:pullDistance});
      updatePullUi(pullDistance);
      return;
    }

    if(gesture.mode==='horizontal'){
      if(!gesture.captured){try{shell?.setPointerCapture?.(event.pointerId);gesture.captured=true}catch(_){ }}
      event.preventDefault();
      track?.classList.add('is-dragging');
      const atStart=logicalPage===0&&dx>0;
      const atEnd=logicalPage===pageCount-1&&dx<0;
      const dragX=(atStart||atEnd)?dx*.22:dx;
      applyPosition({animate:false,dragX});
    }
  }

  async function finishPull(){
    const indicator=$('controlPullIndicator');
    const menuReturn=currentPageElement()?.dataset.page==='menu';
    if(pullDistance>=currentPullThreshold()&&menuReturn){
      updatePullUi(72);
      track?.classList.remove('is-pulling');
      applyPosition({animate:true,pullY:42});
      await wait(35);
      location.replace(`/control-home.html?page=menu&source=menu-pull&v=55.00-r420&t=${Date.now()}`);
      return;
    }
    if(pullDistance>=currentPullThreshold()){
      updatePullUi(72,{loading:true});
      track?.classList.remove('is-pulling');
      applyPosition({animate:true,pullY:58});
      await Promise.all([load({forceLive:!IS_PUSH_SUMMARY_VIEW}),wait(520)]);
      applyPosition({animate:true,pullY:0});
      await wait(280);
      indicator?.classList.remove('is-visible','is-ready','is-loading');
      if($('controlPullText'))$('controlPullText').textContent='Потяните вниз, чтобы обновить';
    }else{
      track?.classList.remove('is-pulling');
      applyPosition({animate:true,pullY:0});
      await wait(220);
      indicator?.classList.remove('is-visible','is-ready','is-loading');
    }
  }

  async function pointerUp(event){
    if(!gesture||gesture.id!==event.pointerId)return;
    const dx=gesture.lastX-gesture.x;
    const dy=gesture.lastY-gesture.y;
    const mode=gesture.mode;
    if(gesture.captured){try{shell?.releasePointerCapture?.(event.pointerId)}catch(_){ }}

    if(mode==='pull'){
      await finishPull();
      resetGesture();
      return;
    }

    if(mode==='horizontal'&&Math.abs(dx)>52&&Math.abs(dx)>Math.abs(dy)*1.04){
      const direction=dx<0?1:-1;
      resetGesture();
      await moveRelative(direction);
      return;
    }

    applyPosition({animate:true});
    resetGesture();
  }

  shell?.addEventListener('pointerdown',pointerDown);
  shell?.addEventListener('pointermove',pointerMove,{passive:false});
  shell?.addEventListener('pointerup',pointerUp);
  shell?.addEventListener('pointercancel',()=>{applyPosition({animate:true});updatePullUi(0);resetGesture()});
  shell?.addEventListener('click',event=>{if(moved&&isInteractive(event.target)){event.preventDefault();event.stopPropagation()}moved=false},true);
  window.addEventListener('resize',()=>applyPosition({animate:false}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){updatePageState();if(summaryMode)load({silent:true,forceLive:false})}});
  if(summaryMode)window.setInterval(()=>{if(!document.hidden)load({silent:true,forceLive:false})},300000);
  if(summaryMode&&!IS_PUSH_SUMMARY_VIEW)window.setInterval(()=>{
    const nextKey=currentSummaryWindowKey();
    if(nextKey===activeSummaryWindowKey)return;
    activeSummaryWindowKey=nextKey;
    try{localStorage.removeItem(homeCacheKey())}catch(_){}
    const empty=emptySummaryPayload();
    renderSummary(empty);
    renderActivity([]);
    if(!document.hidden)load({silent:true,forceLive:false});
  },15000);

  $('controlActivityOpen')?.addEventListener('click',()=>{
    const modal=$('controlActivityModal');
    setActivityModal(Boolean(modal?.hidden));
  });
  $('controlActivityClose')?.addEventListener('click',()=>setActivityModal(false));
  $('controlActivityBackdrop')?.addEventListener('click',()=>setActivityModal(false));
  $('controlCitiesDayR375')?.addEventListener('click',()=>setCityModalR375(true));
  $('controlCityCloseR375')?.addEventListener('click',()=>setCityModalR375(false));
  $('controlCityBackdropR375')?.addEventListener('click',()=>setCityModalR375(false));
  $('controlActivityModal')?.addEventListener('click',event=>{if(event.target.closest('[data-activity-modal-link]'))setActivityModal(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('controlActivityModal')?.hidden)setActivityModal(false)});

  window.addEventListener('pageshow',()=>{
    moved=false; gesture=null; animating=false; pullDistance=0; pullActive=false;
    try{window.scrollTo(0,0)}catch(_){}
    const active=currentPageElement();
    if(active)active.scrollTop=0;
  
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!$('controlCityModalR375')?.hidden)setCityModalR375(false);
  });
  updatePageState();
  },{passive:true});
  syncCarouselClones();
  setLogicalPage(logicalPage,{animate:false});
  // R403: real automatic refresh while the summary page is in use.
  // Do not depend on the external Cloudflare Cron. The owner page asks the Worker
  // to refresh the accumulator, then reloads the fast summary. No push is sent.
  let summaryAutoRefreshBusyR403=false;
  let summaryAutoRefreshLastTryR403=0;
  async function runSummaryAutoRefreshR403({force=false}={}){
    if(!summaryMode || IS_PUSH_SUMMARY_VIEW || document.hidden || summaryAutoRefreshBusyR403)return;
    const now=Date.now();
    if(!force && now-summaryAutoRefreshLastTryR403<4.5*60*1000)return;
    summaryAutoRefreshLastTryR403=now;
    summaryAutoRefreshBusyR403=true;
    try{
      const refreshed=await api('/api/control/daily-summary/auto-refresh?v=55.00-r405',{method:'POST',body:{},timeoutMs:22000});
      absorbUpdateTimesR396(refreshed||{});
      renderUpdateTimesR396();

      // R405: the successful POST already contains the exact persisted summary.
      // Render it immediately instead of waiting for a second GET that can be stale/slow.
      if(refreshed?.summary && refreshed?.windowKey){
        activeSummaryWindowKey=refreshed.windowKey;
        const previous=readHomeCache();
        const stable=cachedForCurrentWindow(previous)
          ? mergeSummaryPayloadR213(previous.data,refreshed)
          : refreshed;
        if(summaryHasSignalR375(stable))saveHomeCache(stable);
        renderSummary(stable);
        renderActivity(stable.activity||[]);
        if(summaryHasSignalR375(stable))fastRetryCountR398=0;
      }

      // Fast GET is now only a synchronization safety-net and cannot block first data paint.
      setTimeout(()=>load({silent:true,forceLive:false}),450);
    }catch(_){
      // Keep the last truthful automatic time. A failed request must never fake freshness.
    }finally{
      summaryAutoRefreshBusyR403=false;
    }
  }
  setInterval(()=>runSummaryAutoRefreshR403(),5*60*1000);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)setTimeout(()=>runSummaryAutoRefreshR403({force:true}),250);
  },{passive:true});
  window.addEventListener('pageshow',()=>setTimeout(()=>runSummaryAutoRefreshR403({force:true}),650),{passive:true});
  // First real auto refresh shortly after the fast first paint.
  if(summaryMode && !IS_PUSH_SUMMARY_VIEW)setTimeout(()=>runSummaryAutoRefreshR403({force:true}),900);

  absorbUpdateTimesR396({});
  renderUpdateTimesR396();

  // R396: first paint always returns from the fast current-window endpoint; full refresh stays background.
  // If a push snapshot/high-water is available it is rendered first; full live refresh is queued afterwards.
  if(summaryMode)load({silent:true,forceLive:false});
})();
