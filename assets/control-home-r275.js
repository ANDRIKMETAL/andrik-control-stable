/* Control ANDRIK R276 — exact completed-period daily summary opened from push. */
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
  const IS_PUSH_SUMMARY_VIEW=LOCATION_PARAMS.get('source')==='push'&&Boolean(PUSH_SUMMARY_WINDOW_KEY);
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
    prefetch.href='/analytics-admin.html?source=prefetch&page=map&v=55.00n';
    document.head.appendChild(prefetch);
  }catch(_){}

  let allActivityEvents=[];
  let sourcePages=[];
  const HOME_CACHE_KEY_LIVE='andrik-control-home-last-good-r136';
  const HOME_CACHE_KEY_PUSH_BASE='andrik-control-home-push-r275';
  function activeViewWindowKey(){return IS_PUSH_SUMMARY_VIEW?PUSH_SUMMARY_WINDOW_KEY:currentSummaryWindowKey()}
  function homeCacheKey(){return IS_PUSH_SUMMARY_VIEW?`${HOME_CACHE_KEY_PUSH_BASE}:${activeViewWindowKey()}`:HOME_CACHE_KEY_LIVE}
  function saveHomeCache(data){try{localStorage.setItem(homeCacheKey(),JSON.stringify({savedAt:new Date().toISOString(),data}))}catch(_){}}
  function readHomeCache(){try{const raw=localStorage.getItem(homeCacheKey());if(!raw)return null;const parsed=JSON.parse(raw);return parsed?.data?parsed:null}catch(_){return null}}


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
    return {ok:true,period:'06:05-cycle',windowKey:activeViewWindowKey(),updatedAt:new Date().toISOString(),summary:{websiteUsers:0,websiteViews:0,siteSubscribers:0,siteComments:0,siteLikes:0,youtubeComments:0,youtubeSubscribers:0,youtubeLikes:0,youtubeViews:0,youtubeViewDelta:0,releases:0,countryDeltas:[],totalCountries:0,countryDate:''},activity:[]};
  }
  function cachedForCurrentWindow(cached){return Boolean(cached?.data&&cached.data.windowKey===activeViewWindowKey())}

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

  async function api(path,{timeoutMs=12000}={}){
    const key=getKey();
    if(!key)throw new Error('Ключ владельца не сохранён');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort('timeout'),timeoutMs);
    try{
      const response=await fetch(path,{headers:{accept:'application/json',authorization:`Bearer ${key}`},cache:'no-store',signal:controller.signal});
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

  function renderSummary(data){
    const pushSnapshot=IS_PUSH_SUMMARY_VIEW||data?.summaryView==='completed-push';
    document.body.classList.toggle('control-push-summary-view',pushSnapshot);
    const sourceBox=$('controlSummarySource');
    if(sourceBox){
      sourceBox.hidden=!pushSnapshot;
      sourceBox.textContent=pushSnapshot?'Сводка из push · завершённый период':'';
    }
    const s=data.summary||{};
    const yDelta=Number(s.youtubeViewDelta||0);
    const items=[
      ['👤',number(s.siteSubscribers),'Новых подписчиков сайта','за последние 24 часа','site','/analytics-admin.html?page=site'],
      ['👤',number(s.youtubeSubscribers),'Подписчиков YouTube','прирост за 24 часа','youtube','/youtube-admin.html?refresh=1&v=55.00n'],
      ['💬',number(s.siteComments),'Сообщений сообщества',`${number(s.siteLikes)} лайков`,'site','/comments-admin.html'],
      ['👍',number(s.youtubeLikes),'Лайков YouTube',`${number(s.youtubeComments)} комментариев`,'youtube','/youtube-admin.html?refresh=1&v=55.00n'],
      ['👀',number(s.websiteViews),'Просмотров сайта','за последние 24 часа','site','/analytics-admin.html?page=site'],
      ['▶️',number(yDelta),'Просмотров канала','за последние 24 часа','youtube','/youtube-admin.html?refresh=1&v=55.00n'],
      ['🚀',number(s.releases),'Релизных событий','за последние 24 часа','release','/lyrics-admin.html']
    ];
    const summaryBox=$('controlHomeSummary');
    if(summaryBox)summaryBox.innerHTML=items.map(item=>summaryCard(...item)).join('');
    renderGeoDelta(s);
    const updatedAt=Date.parse(data.updatedAt||'');
    const compactTime=Number.isFinite(updatedAt)
      ? new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(updatedAt))
      : 'сейчас';
    const updatedBox=$('controlHomeUpdated');
    if(updatedBox){
      if(pushSnapshot)updatedBox.textContent=`Сохранено в push · ${compactTime}`;
      else{
        const source=['push-merged','push-direct'].includes(data.summarySource)?' · сверено с push':'';
        updatedBox.textContent=`Обновлено ${compactTime}${source}`;
      }
    }
    syncCarouselClones();
  }

  function renderActivity(events=[]){
    const box=$('controlHomeActivity');
    const foot=$('controlActivityFootnote');
    allActivityEvents=Array.isArray(events)?events:[];
    if(!allActivityEvents.length){
      box.innerHTML='<div class="admin-empty">За последние 24 часа новых событий пока нет. Тихая смена 🌙</div>';
      if(foot)foot.textContent=IS_PUSH_SUMMARY_VIEW?'← Завершённый период · «24 часа» — полный список':(summaryMode?'← Сводка за сегодня · «24 часа» — полный список':'← Сводка · «24 часа» — полный список');
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
  let activeSummaryWindowKey=activeViewWindowKey();
  async function load({silent=false,forceLive=false}={}){
    if(loading)return;
    loading=true;
  if(summaryMode){
    const cached=readHomeCache();
    if(cachedForCurrentWindow(cached)){
      renderSummary(cached.data);
      renderActivity(cached.data.activity||[]);
    }else{
      try{localStorage.removeItem(homeCacheKey())}catch(_){}
      const empty=emptySummaryPayload();
      renderSummary(empty);
      renderActivity([]);
    }
  }

  const shell=$('controlSwipeShell');
    const showRefreshEffect=!silent&&currentPageElement()?.dataset.page!=='menu';
    if(!silent&&$('controlHomeUpdated'))$('controlHomeUpdated').textContent='Обновляем сводку…';
    if(showRefreshEffect)shell?.classList.add('is-refreshing');
    else shell?.classList.remove('is-refreshing');
    try{
      const query=new URLSearchParams({v:'55.00-r276'});
      if(forceLive&&!IS_PUSH_SUMMARY_VIEW)query.set('refresh','1');
      if(IS_PUSH_SUMMARY_VIEW){query.set('source','push');query.set('window',PUSH_SUMMARY_WINDOW_KEY)}
      const data=await api(`/api/control/home?${query.toString()}`,{timeoutMs:forceLive&&!IS_PUSH_SUMMARY_VIEW?13000:8000});
      if(data?.windowKey)activeSummaryWindowKey=data.windowKey;
      const previous=readHomeCache();
      const stable=IS_PUSH_SUMMARY_VIEW?data:(cachedForCurrentWindow(previous)?mergeSummaryPayloadR213(previous.data,data):data);
      saveHomeCache(stable);
      renderSummary(stable);
      renderActivity(stable.activity||[]);
    }catch(error){
      const cached=readHomeCache();
      if(cachedForCurrentWindow(cached)){
        renderSummary(cached.data);
        renderActivity(cached.data.activity||[]);
        if($('controlHomeUpdated'))$('controlHomeUpdated').textContent=`Последние сохранённые данные · ${dateTime(cached.savedAt)} · ${escapeHtml(error.message)}`;
      }else{
        if($('controlHomeSummary'))$('controlHomeSummary').innerHTML=`<div class="admin-empty">${escapeHtml(error.message)}. Откройте «Служебное» и проверьте ключ владельца.</div>`;
        if($('controlHomeActivity'))$('controlHomeActivity').innerHTML='<div class="admin-empty"><a class="btn" href="/service-admin.html">Открыть Служебное</a></div>';
        if($('controlHomeUpdated'))$('controlHomeUpdated').textContent='Сводка недоступна';
        if($('controlHomeGeoDelta')){$('controlHomeGeoDelta').hidden=true;$('controlHomeGeoDelta').innerHTML='';}
        syncCarouselClones();
      }
    }finally{
      loading=false;
      if(showRefreshEffect)setTimeout(()=>shell?.classList.remove('is-refreshing'),260);
      else shell?.classList.remove('is-refreshing');
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

  $('controlSummaryNext')?.addEventListener('click',()=>{
    const pushQuery=IS_PUSH_SUMMARY_VIEW?`&source=push&summaryWindow=${encodeURIComponent(PUSH_SUMMARY_WINDOW_KEY)}`:'';
    location.assign(`/control-home.html?page=activity${pushQuery}&v=55.00-r276&t=${Date.now()}`);
  });


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
    if(label)label.textContent='Отправляем…';
    if($('controlHomeUpdated'))$('controlHomeUpdated').textContent='Отправляем сводку…';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
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
      if(label)label.textContent='Push отправлен ✓';
      button?.classList.add('is-success');
      if(!IS_PUSH_SUMMARY_VIEW&&data?.metrics && typeof data.metrics==='object'){
        const m=data.metrics;
        const payload={
          ok:true,
          period:'06:05-cycle',
          windowKey:m.windowKey||activeSummaryWindowKey,
          updatedAt:data.sentAt||new Date().toISOString(),
          summarySource:'push-direct',
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
        const previous=readHomeCache();
        const stable=cachedForCurrentWindow(previous)?mergeSummaryPayloadR213(previous.data,payload):payload;
        saveHomeCache(stable);
        renderSummary(stable);
      }
      if($('controlHomeUpdated'))$('controlHomeUpdated').textContent='Сводка отправлена ✓';
      // R260: the push is only a checkpoint. Keep the accumulated high-water values on screen;
      // the normal 2-minute refresh will merge new events without repainting temporary zeros.
      setTimeout(()=>{
        if(label)label.textContent='Отправить сводку';
        button?.classList.remove('is-success');
      },2600);
    }catch(error){
      if(label)label.textContent='Повторить';
      button?.classList.add('is-error');
      if($('controlHomeUpdated'))$('controlHomeUpdated').textContent=error?.name==='AbortError'?'Сервер отвечает долго':'Ошибка отправки';
      setTimeout(()=>button?.classList.remove('is-error'),2200);
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
      ?(ready?'Отпустите — вернуться на карту':'Потяните вниз — вернуться на карту')
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
    if(isInteractive(event.target)&&!menuGesture)return;
    const landscape=window.matchMedia?.('(orientation: landscape)')?.matches===true;
    const viewportWidth=Math.max(1,window.innerWidth||document.documentElement.clientWidth||1);
    const inLandscapeCenter=event.clientX>=viewportWidth*.34&&event.clientX<=viewportWidth*.66;
    const canLandscapeMenuPull=landscape&&menuGesture&&inLandscapeCenter&&canPullFrom();
    gesture={
      id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,mode:null,
      canPull:(!landscape&&canPullFrom())||canLandscapeMenuPull,
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
      location.replace(`/analytics-admin.html?source=menu-pull&page=map&v=55.00n&t=${Date.now()}`);
      return;
    }
    if(pullDistance>=currentPullThreshold()){
      updatePullUi(72,{loading:true});
      track?.classList.remove('is-pulling');
      applyPosition({animate:true,pullY:58});
      await Promise.all([load(),wait(520)]);
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
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){updatePageState();if(summaryMode)load({silent:true})}});
  if(summaryMode)window.setInterval(()=>{if(!document.hidden)load({silent:true})},120000);
  if(summaryMode&&!IS_PUSH_SUMMARY_VIEW)window.setInterval(()=>{
    const nextKey=currentSummaryWindowKey();
    if(nextKey===activeSummaryWindowKey)return;
    activeSummaryWindowKey=nextKey;
    try{localStorage.removeItem(homeCacheKey())}catch(_){}
    const empty=emptySummaryPayload();
    renderSummary(empty);
    renderActivity([]);
    if(!document.hidden)load({silent:true});
  },15000);

  $('controlActivityOpen')?.addEventListener('click',()=>{
    const modal=$('controlActivityModal');
    setActivityModal(Boolean(modal?.hidden));
  });
  $('controlActivityClose')?.addEventListener('click',()=>setActivityModal(false));
  $('controlActivityBackdrop')?.addEventListener('click',()=>setActivityModal(false));
  $('controlActivityModal')?.addEventListener('click',event=>{if(event.target.closest('[data-activity-modal-link]'))setActivityModal(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('controlActivityModal')?.hidden)setActivityModal(false)});

  window.addEventListener('pageshow',()=>{
    try{window.scrollTo(0,0)}catch(_){}
    const active=currentPageElement();
    if(active)active.scrollTop=0;
    updatePageState();
  },{passive:true});
  syncCarouselClones();
  setLogicalPage(logicalPage,{animate:false});
  if(summaryMode)load({silent:true,forceLive:false});
})();
