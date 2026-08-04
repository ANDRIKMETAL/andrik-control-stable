(() => {
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const number=value=>new Intl.NumberFormat('ru-RU').format(Number(value||0));
  const dateTime=value=>{try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch(_){return value||'—'}};
  const shortDate=value=>{const s=String(value||'');return /^\d{8}$/.test(s)?`${s.slice(6,8)}.${s.slice(4,6)}`:s};
  const compactAxisDate=value=>{const s=String(value||'');const m=s.match(/^(?:\d{2})?(\d{2})[-.]?(\d{2})[-.]?(\d{2})$/);if(m)return`${m[2]}/${m[3]}`;const iso=s.match(/^\d{4}-(\d{2})-(\d{2})$/);return iso?`${iso[1]}/${iso[2]}`:shortDate(s).replace('.', '/');};
  const shiftAxisDate=(value,days)=>{const s=String(value||'');const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);const compact=s.match(/^(\d{4})(\d{2})(\d{2})$/);const parts=iso||compact;if(!parts)return s;const date=new Date(Date.UTC(Number(parts[1]),Number(parts[2])-1,Number(parts[3])+Number(days||0)));return date.toISOString().slice(0,10);};
  try{
    const prefetch=document.createElement('link');
    prefetch.rel='prefetch';
    prefetch.href='/control-home.html?page=menu&v=54.99b';
    document.head.appendChild(prefetch);
  }catch(_){}
  const COUNTRY_MAP={
    US:'США','UNITED STATES':'США','UNITED STATES OF AMERICA':'США',
    SK:'Словакия',SLOVAKIA:'Словакия',
    CN:'Китай',CHINA:'Китай',
    CA:'Канада',CANADA:'Канада',
    FR:'Франция',FRANCE:'Франция',
    NL:'Нидерланды',NETHERLANDS:'Нидерланды',
    GB:'Великобритания',UK:'Великобритания','UNITED KINGDOM':'Великобритания',
    DE:'Германия',GERMANY:'Германия',
    UA:'Украина',UKRAINE:'Украина',
    RU:'Россия',RUSSIA:'Россия','RUSSIAN FEDERATION':'Россия',
    CZ:'Чехия',CZECHIA:'Чехия','CZECH REPUBLIC':'Чехия',
    PL:'Польша',POLAND:'Польша',
    AT:'Австрия',AUSTRIA:'Австрия',
    ES:'Испания',SPAIN:'Испания',
    IT:'Италия',ITALY:'Италия',
    BR:'Бразилия',BRAZIL:'Бразилия',
    AU:'Австралия',AUSTRALIA:'Австралия',
    JP:'Япония',JAPAN:'Япония',
    IN:'Индия',INDIA:'Индия',
    SE:'Швеция',SWEDEN:'Швеция',
    NO:'Норвегия',NORWAY:'Норвегия',
    FI:'Финляндия',FINLAND:'Финляндия',
    RO:'Румыния',ROMANIA:'Румыния',
    HU:'Венгрия',HUNGARY:'Венгрия',
    BY:'Беларусь',BELARUS:'Беларусь',
    KR:'Южная Корея','SOUTH KOREA':'Южная Корея','REPUBLIC OF KOREA':'Южная Корея',KOREA:'Южная Корея',
    TW:'Тайвань',TAIWAN:'Тайвань',
    BG:'Болгария',BULGARIA:'Болгария',
    IE:'Ирландия',IRELAND:'Ирландия',
    CH:'Швейцария',SWITZERLAND:'Швейцария',
    BE:'Бельгия',BELGIUM:'Бельгия',
    DK:'Дания',DENMARK:'Дания',
    PT:'Португалия',PORTUGAL:'Португалия',
    GR:'Греция',GREECE:'Греция',
    HR:'Хорватия',CROATIA:'Хорватия',
    SI:'Словения',SLOVENIA:'Словения',
    RS:'Сербия',SERBIA:'Сербия',
    LT:'Литва',LITHUANIA:'Литва',
    LV:'Латвия',LATVIA:'Латвия',
    EE:'Эстония',ESTONIA:'Эстония',
    MD:'Молдова',MOLDOVA:'Молдова',
    TR:'Турция',TURKEY:'Турция',TÜRKIYE:'Турция',
    IL:'Израиль',ISRAEL:'Израиль',
    AE:'ОАЭ','UNITED ARAB EMIRATES':'ОАЭ',
    KZ:'Казахстан',KAZAKHSTAN:'Казахстан',
    GE:'Грузия',GEORGIA:'Грузия',
    AM:'Армения',ARMENIA:'Армения',
    AZ:'Азербайджан',AZERBAIJAN:'Азербайджан',
    MX:'Мексика',MEXICO:'Мексика',
    AR:'Аргентина',ARGENTINA:'Аргентина',
    CL:'Чили',CHILE:'Чили',
    CO:'Колумбия',COLOMBIA:'Колумбия',
    PE:'Перу',PERU:'Перу',
    ZA:'ЮАР','SOUTH AFRICA':'ЮАР',
    NZ:'Новая Зеландия','NEW ZEALAND':'Новая Зеландия',
    ID:'Индонезия',INDONESIA:'Индонезия',
    TH:'Таиланд',THAILAND:'Таиланд',
    VN:'Вьетнам',VIETNAM:'Вьетнам',
    PH:'Филиппины',PHILIPPINES:'Филиппины',
    MY:'Малайзия',MALAYSIA:'Малайзия',
    SG:'Сингапур',SINGAPORE:'Сингапур',
    HK:'Гонконг','HONG KONG':'Гонконг',
    UZ:'Узбекистан',UZBEKISTAN:'Узбекистан',
    ZZ:'(не задано)','(NOT SET)':'(не задано)','NOT SET':'(не задано)','(НЕ ЗАДАНО)':'(не задано)'
  };
  const SEARCH_CONSOLE_URL='https://search.google.com/search-console?resource_id=sc-domain%3Aandrikmetal.com&authuser=andrikmetal%40gmail.com';
  const AUDIENCE_CACHE_KEY='andrik-control-audience-v54-39';
  let audienceRequest=null;
  const COUNTRY_FLAGS={
    'США':'🇺🇸','Словакия':'🇸🇰','Китай':'🇨🇳','Канада':'🇨🇦','Франция':'🇫🇷','Нидерланды':'🇳🇱','Великобритания':'🇬🇧',
    'Германия':'🇩🇪','Украина':'🇺🇦','Россия':'🇷🇺','Чехия':'🇨🇿','Польша':'🇵🇱','Австрия':'🇦🇹','Испания':'🇪🇸','Италия':'🇮🇹',
    'Бразилия':'🇧🇷','Австралия':'🇦🇺','Япония':'🇯🇵','Индия':'🇮🇳','Швеция':'🇸🇪','Норвегия':'🇳🇴','Финляндия':'🇫🇮',
    'Румыния':'🇷🇴','Венгрия':'🇭🇺','Беларусь':'🇧🇾','Южная Корея':'🇰🇷','Тайвань':'🇹🇼','Болгария':'🇧🇬','Ирландия':'🇮🇪',
    'Швейцария':'🇨🇭','Бельгия':'🇧🇪','Дания':'🇩🇰','Португалия':'🇵🇹','Греция':'🇬🇷','Хорватия':'🇭🇷','Словения':'🇸🇮',
    'Сербия':'🇷🇸','Литва':'🇱🇹','Латвия':'🇱🇻','Эстония':'🇪🇪','Молдова':'🇲🇩','Турция':'🇹🇷','Израиль':'🇮🇱','ОАЭ':'🇦🇪',
    'Казахстан':'🇰🇿','Грузия':'🇬🇪','Армения':'🇦🇲','Азербайджан':'🇦🇿','Мексика':'🇲🇽','Аргентина':'🇦🇷','Чили':'🇨🇱',
    'Колумбия':'🇨🇴','Перу':'🇵🇪','ЮАР':'🇿🇦','Новая Зеландия':'🇳🇿','Индонезия':'🇮🇩','Таиланд':'🇹🇭','Вьетнам':'🇻🇳',
    'Филиппины':'🇵🇭','Малайзия':'🇲🇾','Сингапур':'🇸🇬','Гонконг':'🇭🇰','Узбекистан':'🇺🇿'
  };
  const DEVICE_MAP={desktop:'компьютер',mobile:'мобильный',tablet:'планшет',smarttv:'смарт-ТВ',tv:'ТВ',console:'консоль',wearable:'носимое устройство',unknown:'неизвестно','(not set)':'(не задано)'};
  const GEO={
    'США':[-98,39],'Канада':[-106,57],'Великобритания':[-3,55],'Франция':[2,46],'Германия':[10,51],'Нидерланды':[5.3,52.1],
    'Словакия':[19.5,48.7],'Украина':[31,49],'Россия':[90,61],'Китай':[104,35],'Чехия':[15.5,49.8],'Польша':[19,52],
    'Австрия':[14.5,47.5],'Испания':[-4,40],'Италия':[12.5,42.8],'Бразилия':[-51,-10],'Австралия':[134,-25],'Япония':[138,37],
    'Индия':[79,22],'Швеция':[16,62],'Норвегия':[9,62],'Финляндия':[26,64],'Румыния':[25,46],'Венгрия':[19,47],
    'Беларусь':[28,53],'Южная Корея':[127.8,36.4],'Тайвань':[121,23.7],'Болгария':[25.5,42.7],'Ирландия':[-8,53.2],
    'Швейцария':[8.2,46.8],'Бельгия':[4.7,50.7],'Дания':[10,56],'Португалия':[-8,39.5],'Греция':[22,39],
    'Хорватия':[16.4,45.1],'Словения':[14.8,46.1],'Сербия':[20.8,44],'Литва':[24,55.2],'Латвия':[24.6,57],
    'Эстония':[25.5,58.6],'Молдова':[28.5,47.2],'Турция':[35,39],'Израиль':[35,31.5],'ОАЭ':[54.3,24.4],
    'Казахстан':[68,48],'Грузия':[43.5,42],'Армения':[45,40.1],'Азербайджан':[47.5,40.4],'Мексика':[-102,23],
    'Аргентина':[-64,-34],'Чили':[-71,-33],'Колумбия':[-74,4],'Перу':[-76,-10],'ЮАР':[24,-29],
    'Новая Зеландия':[172,-41],'Индонезия':[118,-2],'Таиланд':[101,15],'Вьетнам':[108,16],'Филиппины':[122,13],
    'Малайзия':[102,4],'Сингапур':[103.8,1.35],'Гонконг':[114.2,22.3],'Узбекистан':[64.6,41.4]
  };
  const regionNames=(()=>{try{return new Intl.DisplayNames(['ru'],{type:'region'})}catch(_){return null}})();
  const translateCountry=value=>{const raw=String(value||'').trim();if(!raw)return'—';const upper=raw.toUpperCase();if(COUNTRY_MAP[upper]||COUNTRY_MAP[raw])return COUNTRY_MAP[upper]||COUNTRY_MAP[raw];if(/^[A-Z]{2}$/.test(upper)&&regionNames){try{return regionNames.of(upper)||raw}catch(_){}}return raw};
  const isoFlag=code=>{const upper=String(code||'').trim().toUpperCase();return /^[A-Z]{2}$/.test(upper)?String.fromCodePoint(...[...upper].map(char=>127397+char.charCodeAt(0))):''};
  const countryFlag=(name,code='')=>COUNTRY_FLAGS[String(name||'').trim()]||isoFlag(code)||'🏳️';
  const translateDevice=value=>{const raw=String(value||'').trim();return DEVICE_MAP[raw.toLowerCase()]||raw||'—'};
  const normalizePath=value=>{
    const raw=String(value||'').trim()||'/';
    if(raw==='/'||raw==='')return '/';
    return raw.replace(/\/+$/,'')||'/';
  };
  const pageSectionLabel=(path,title)=>{
    const clean=normalizePath(path);
    const map={
      '/':'Главная',
      '/en':'Главная',
      '/sk':'Главная',
      '/uk':'Главная',
      '/player.html':'Плеер',
      '/comments.html':'Сообщество',
      '/trika.html':'Трика',
      '/en/comments.html':'Сообщество',
      '/sk/comments.html':'Сообщество',
      '/uk/comments.html':'Сообщество',
      '/en/trika.html':'Трика',
      '/sk/trika.html':'Трика',
      '/uk/trika.html':'Трика',
      '/offline.html':'Офлайн-страница',
      '/cmd_sco':'Страница Search Console'
    };
    if(map[clean])return map[clean];
    const originalTitle=String(title||'').trim();
    const simplified=originalTitle.replace(/\s*[|｜].*$/,'').trim();
    const t=simplified.toLowerCase();
    if(t.includes('comment')||t.includes('community'))return'Сообщество';
    if(t.includes('player')||t.includes('плеер'))return'Плеер';
    if(t.includes('trika')||t.includes('трика'))return'Трика';
    return simplified||clean||'Страница';
  };
  const pageVersionLabel=path=>{
    const clean=normalizePath(path);
    const map={
      '/':'Русская версия · /',
      '/en':'Английская версия · /en/',
      '/sk':'Словацкая версия · /sk/',
      '/uk':'Украинская версия · /uk/',
      '/comments.html':'Сообщество · /comments.html',
      '/player.html':'Плеер · /player.html',
      '/trika.html':'Раздел Трика · /trika.html',
      '/cmd_sco':'Служебный маршрут · /cmd_sco'
    };
    return map[clean]||clean;
  };
  async function api(path,timeoutMs=9500){
    const controller=new AbortController();
    let timer=0;
    const network=fetch(path,{headers:{accept:'application/json',authorization:`Bearer ${getKey()}`},cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.details||data.error||`HTTP ${response.status}`);
        return data;
      });
    const hardTimeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        try{controller.abort()}catch(_){}
        reject(new Error('Сервер аналитики не ответил вовремя'));
      },Math.max(2500,Number(timeoutMs)||9500));
    });
    try{
      return await Promise.race([network,hardTimeout]);
    }catch(error){
      if(error?.name==='AbortError')throw new Error('Сервер аналитики не ответил вовремя');
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }
  function authState(ok,text){$('analyticsAuthStrip')?.classList.toggle('is-ready',ok);if($('analyticsAuthText'))$('analyticsAuthText').textContent=text}
  function kpi(icon,value,label,detail,tone=''){return `<article class="analytics-kpi ${tone?`is-${tone}`:''}"><span class="analytics-kpi-icon">${icon}</span><div class="analytics-kpi-copy"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><em>${escapeHtml(detail)}</em></div></article>`}
  function focusCard({id='',icon='•',name='Пункт',label='',metric='',state='pending',url=''}){
    const live=state==='live';
    const stateText=live?'подключено':state==='error'?'ошибка':state==='configured'?'проверка':'не подключено';
    const stateClass=live?'is-live':state==='error'?'is-error':'is-pending';
    const body=`<span class="control-platform-icon">${icon}</span><div class="control-platform-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(label)}</small>${metric?`<em>${escapeHtml(metric)}</em>`:''}</div><span class="control-platform-state ${stateClass}">${stateText}</span>${url?'<span class="control-platform-arrow">›</span>':''}`;
    if(url){const external=/^https?:/i.test(url);return `<a class="control-platform-card is-${escapeHtml(id)}" href="${escapeHtml(url)}"${external?' target="_blank" rel="noopener"':''}>${body}</a>`}
    return `<article class="control-platform-card is-${escapeHtml(id)}">${body}</article>`;
  }
  function renderSearchConsole(items=[],details={}){
    const box=$('searchConsoleHub');
    const trendBox=$('searchConsoleTrend');
    const openLink=$('searchConsoleOpen');
    if(!box&&!trendBox)return;
    const item=(items||[]).find(entry=>/google|search/i.test(String(entry.id||''))||/google|search/i.test(String(entry.name||'')));
    const connected=Boolean(details?.connected)||Boolean(item&&['live','connected'].includes(String(item.status||'')));
    const clicks=Number(details?.clicks??item?.metric??0);
    const impressions=Number(details?.impressions||0);
    const ctr=Number(details?.ctr||0);
    const position=Number(details?.position||0);
    if(openLink){openLink.hidden=false;openLink.href=SEARCH_CONSOLE_URL}
    if(!connected){
      const raw=String(details?.friendlyError||details?.error||item?.label||'Search Console пока не отдаёт данные.');
      const serviceEmail=String(details?.serviceAccountEmail||'').trim();
      const setup=/credentials|not-configured/i.test(raw)
        ?'В Cloudflare не найден ключ service account для Search Console.'
        :/snapshot-not-ready/i.test(raw)
          ?'Ключ найден. Выполняется первая серверная проверка Search Console.'
          :/no-access|permission|forbidden|does not have access/i.test(raw)
            ?`Выдайте service account доступ к ресурсу sc-domain:andrikmetal.com${serviceEmail?` — ${serviceEmail}`:''}.`
            :raw;
      const emailHint=serviceEmail?`<small>Service account: ${escapeHtml(serviceEmail)}</small>`:'';
      if(box)box.innerHTML=`<div class="search-console-message"><strong>Search Console ещё не передал данные</strong>${escapeHtml(setup)}${emailHint}<small>После выдачи доступа нажмите «Обновить» в Служебном — клики, показы, CTR, позиция и дневной график сохранятся автоматически.</small></div>`;
      if(trendBox)trendBox.innerHTML='<div class="admin-empty">Ждём первый снимок Search Console.</div>';
      return;
    }
    if(box)box.innerHTML=`<div class="search-console-kpis">
      <article class="search-console-kpi"><small>Клики</small><strong>${number(clicks)}</strong></article>
      <article class="search-console-kpi"><small>Показы</small><strong>${number(impressions)}</strong></article>
      <article class="search-console-kpi"><small>CTR</small><strong>${(ctr*100).toLocaleString('ru-RU',{maximumFractionDigits:1})}%</strong></article>
      <article class="search-console-kpi"><small>Средняя позиция</small><strong>${position?position.toLocaleString('ru-RU',{maximumFractionDigits:1}):'—'}</strong></article>
    </div>`;
    const rows=Array.isArray(details?.trend)?details.trend:[];
    if(!trendBox)return;
    if(!rows.length){trendBox.innerHTML='<div class="search-console-message">Сводные данные получены. Дневная динамика появится после следующего обновления API.</div>';return}
    const maxClicks=Math.max(1,...rows.map(row=>Number(row.clicks||0)));
    const maxImpressions=Math.max(1,...rows.map(row=>Number(row.impressions||0)));
    const axisIndices=[0,Math.floor((rows.length-1)/2),Math.max(0,rows.length-1)];
    const axisDates=axisIndices.map(index=>compactAxisDate(rows[index]?.date||''));
    trendBox.innerHTML=`<div class="search-console-trend" role="button" tabindex="0" aria-pressed="false" aria-label="Подсветить график Search Console"><div class="search-console-bars">${rows.map(row=>{
      const clicksHeight=Math.max(Number(row.clicks||0)>0?4:0,Math.round(Number(row.clicks||0)/maxClicks*100));
      const impressionsHeight=Math.max(Number(row.impressions||0)>0?4:0,Math.round(Number(row.impressions||0)/maxImpressions*100));
      const label=compactAxisDate(row.date||'');
      return `<div class="search-console-day" title="${escapeHtml(label)}: ${number(row.clicks)} кликов, ${number(row.impressions)} показов"><i style="height:${clicksHeight}%"></i><b style="height:${impressionsHeight}%"></b></div>`
    }).join('')}</div><div class="search-console-axis"><span>${escapeHtml(axisDates[0]||'')}</span><span>${escapeHtml(axisDates[1]||'')}</span><span>${escapeHtml(axisDates[2]||'')}</span></div></div><div class="search-console-key"><span><i></i>Клики</span><span><i class="is-impressions"></i>Показы</span><span>Данные Search Console поступают с задержкой около 2 дней</span></div>`;
    const chart=trendBox.querySelector('.search-console-trend');
    const toggleChart=()=>{const active=chart?.classList.toggle('is-chart-highlighted');chart?.setAttribute('aria-pressed',active?'true':'false')};
    chart?.addEventListener('click',toggleChart);
    chart?.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleChart()}});
  }
  function renderYoutubeFocus(platforms=[]){
    const box=$('youtubeHub');
    if(!box)return;
    const item=(platforms||[]).find(entry=>/youtube/i.test(String(entry.id||''))||/youtube/i.test(String(entry.name||'')));
    if(!item){
      box.innerHTML=focusCard({id:'youtube',icon:'▶️',name:'YouTube',label:'Канал и Studio',metric:'Данные пока недоступны',state:'pending',url:'/youtube-admin.html'});
      return;
    }
    const live=['live','connected','metadata'].includes(String(item.status||''));
    const metricValue=item.metric===null||item.metric===undefined?'':`${number(item.metric)} ${String(item.metricLabel||'').trim()}`.trim();
    box.innerHTML=focusCard({
      id:'youtube',
      icon:item.icon||'▶️',
      name:'YouTube',
      label:item.label||'Канал и Studio',
      metric:metricValue||'Открыть аналитику канала',
      state:live?'live':(String(item.status||'')==='error'?'error':String(item.status||'')==='configured'?'configured':'pending'),
      url:item.url||'/youtube-admin.html'
    });
  }
  function renderKpis(ga){
    $('analyticsKpis').innerHTML=[
      kpi('🟢',number(ga.realtime?.activeUsers),'Сейчас на сайте','последние 30 минут','live'),
      kpi('👥',number(ga.today?.activeUsers),'Пользователей сегодня',`${number(ga.today?.sessions)} сессий`,'site'),
      kpi('📄',number(ga.today?.screenPageViews),'Просмотров сегодня',`${number(ga.today?.eventCount)} событий`,'site'),
      kpi('📅',number(ga.week?.activeUsers),'За 7 дней',`${number(ga.week?.screenPageViews)} просмотров`,'week'),
      kpi('📈',number(ga.month?.activeUsers),'За 30 дней',`${number(ga.month?.sessions)} сессий`,'month'),
      kpi('🌐',number(ga.month?.screenPageViews),'Просмотров за 30 дней',`${number(ga.month?.eventCount)} событий`,'month')
    ].join('');
  }
  function renderTrend(rows=[]){const box=$('analyticsTrend');if(!box)return;if(!rows.length){box.innerHTML='<div class="admin-empty">За этот период данных пока нет.</div>';return}const max=Math.max(1,...rows.map(r=>Math.max(Number(r.activeUsers||0),Number(r.screenPageViews||0))));box.innerHTML=`<div class="analytics-bars">${rows.map((r,i)=>{const users=Math.max(3,Math.round(Number(r.activeUsers||0)/max*100)),views=Math.max(3,Math.round(Number(r.screenPageViews||0)/max*100)),show=i===0||i===rows.length-1||i%5===0;return `<div class="analytics-day" title="${escapeHtml(shortDate(r.date))}: ${number(r.activeUsers)} пользователей, ${number(r.screenPageViews)} просмотров"><div class="analytics-day-bars"><i style="height:${users}%"></i><b style="height:${views}%"></b></div><small>${show?escapeHtml(shortDate(r.date)):''}</small></div>`}).join('')}</div><div class="analytics-chart-key"><span><i class="is-users"></i>Пользователи</span><span><i class="is-views"></i>Просмотры</span></div>`}
  function listRows(items,valueKey,labelKey,subKey){
    const max=Math.max(1,...items.map(x=>Number(x[valueKey]||0)));
    return items.map((item,index)=>`<article class="analytics-list-row"><span class="analytics-list-index">${index+1}</span><div><strong>${escapeHtml(item[labelKey]||'Без названия')}</strong>${subKey&&item[subKey]?`<small>${escapeHtml(item[subKey])}</small>`:''}<i><b style="width:${Math.max(3,Number(item[valueKey]||0)/max*100)}%"></b></i></div><em>${number(item[valueKey])}</em></article>`).join('');
  }
  function renderList(id,items,valueKey,labelKey,subKey){
    const box=$(id);if(!box)return;
    if(!items?.length){box.innerHTML='<div class="admin-empty">Данных пока нет.</div>';return}
    box.innerHTML=listRows(items,valueKey,labelKey,subKey);
  }
  let countries30Expanded=false;
  function siteCountryItem(item,index){
    return `<article class="analytics-site-country-item"><span class="analytics-site-country-flag" aria-hidden="true">${escapeHtml(item.flag)}</span><div><strong>${escapeHtml(item.country)}</strong><small>пользователей</small></div><em>${number(item.activeUsers)}</em></article>`;
  }
  function renderCountrySpoiler(items=[]){
    const box=$('analyticsCountries');if(!box)return;
    const clean=(items||[])
      .map(item=>{
        const raw=String(item.country||'').trim();
        const country=translateCountry(raw);
        return {...item,country,flag:countryFlag(country,raw),activeUsers:Number(item.activeUsers||0)};
      })
      .filter(item=>item.country&&item.country!=='(не задано)')
      .sort((a,b)=>b.activeUsers-a.activeUsers||a.country.localeCompare(b.country,'ru'));
    if(!clean.length){box.innerHTML='<div class="admin-empty">Данных пока нет.</div>';return}
    const visible=clean.slice(0,6);
    const extra=clean.slice(6);
    box.innerHTML=`<div class="analytics-site-country-grid">${visible.map(siteCountryItem).join('')}</div>${extra.length?`<details class="analytics-country-spoiler analytics-site-country-spoiler" ${countries30Expanded?'open':''}><summary><span class="country-summary-closed">Показать все страны (${clean.length})</span><span class="country-summary-open">Скрыть список</span></summary><div class="analytics-site-country-grid analytics-site-country-extra">${extra.map(siteCountryItem).join('')}</div></details>`:''}`;
    const details=box.querySelector('details');
    details?.addEventListener('toggle',()=>{countries30Expanded=details.open});
  }
  const GA_CACHE_KEY='andrik-control-ga-cache-v54-06';
  const YT_MAP_CACHE_KEY='andrik-control-youtube-map-v54-24';
  let countriesExpanded=false;
  let selectedWorldCountry='';
  let selectedWorldCountryZoomStep=0;
  let selectedWorldCountryZoomDirection=1;
  const WORLD_ZOOM_LEVELS=[2.38];
  function cycleWorldCountrySelection(map,list,country){
    const next=String(country||'');
    if(!next){
      selectedWorldCountry='';
      selectedWorldCountryZoomStep=0;
      selectedWorldCountryZoomDirection=1;
      applyWorldCountrySelection(map,list,'');
      return;
    }
    if(next!==selectedWorldCountry){
      selectedWorldCountry=next;
      selectedWorldCountryZoomStep=1;
      selectedWorldCountryZoomDirection=1;
      applyWorldCountrySelection(map,list,next);
      return;
    }
    selectedWorldCountry='';
    selectedWorldCountryZoomStep=0;
    selectedWorldCountryZoomDirection=1;
    applyWorldCountrySelection(map,list,'');
  }
  function applyWorldCountrySelection(map,list,country){
    const next=String(country||'');
    if(next!==selectedWorldCountry){
      selectedWorldCountry=next;
      selectedWorldCountryZoomDirection=1;
      selectedWorldCountryZoomStep=next?1:0;
    }else if(next&&!selectedWorldCountryZoomStep)selectedWorldCountryZoomStep=1;
    const isZoomed=Boolean(selectedWorldCountry&&selectedWorldCountryZoomStep);
    const zoomLabel=isZoomed?2:1;
    const stage=map?.querySelector('.world-map-stage');
    map?.querySelectorAll('.world-map-dot[data-country]').forEach(marker=>{
      const active=decodeURIComponent(marker.dataset.country||'')===selectedWorldCountry;
      marker.classList.toggle('is-selected',active);
      marker.setAttribute('aria-current',active?'true':'false');
      marker.setAttribute('aria-label',active?`${decodeURIComponent(marker.dataset.country||'')} · увеличено`:(decodeURIComponent(marker.dataset.country||'')));
    });
    list?.querySelectorAll('.world-country-button[data-country]').forEach(button=>{
      const active=decodeURIComponent(button.dataset.country||'')===selectedWorldCountry;
      button.classList.toggle('is-selected',active);
      button.setAttribute('aria-pressed',String(active));
      button.title=active?'Нажмите ещё раз, чтобы уменьшить карту':'';
    });
    if(isZoomed&&stage&&GEO[selectedWorldCountry]){
      const marker=[...map.querySelectorAll('.world-map-dot[data-country]')].find(item=>decodeURIComponent(item.dataset.country||'')===selectedWorldCountry);
      const canvas=map.querySelector('.world-map-canvas');
      const zoom=WORLD_ZOOM_LEVELS[0];
      if(!marker||!canvas)return;

      // The marker's inline left/top percentages are its exact untransformed center.
      // Using getBoundingClientRect() here was wrong because the stage could already
      // be transformed from the previously selected country, which doubled the zoom
      // and sent the map sideways. Calculate only in the original stage coordinate space.
      const leftPercent=parseFloat(marker.style.left||'0');
      const topPercent=parseFloat(marker.style.top||'0');
      const stageWidth=stage.clientWidth||canvas.clientWidth||1;
      const stageHeight=stage.clientHeight||canvas.clientHeight||1;
      const markerX=stageWidth*(leftPercent/100);
      const markerY=stageHeight*(topPercent/100);
      // The stage itself is the visible map viewport inside the canvas.
      // Center the chosen marker in that viewport; canvas padding must not
      // participate in the translation calculation.
      const tx=(stageWidth/2)-(markerX*zoom);
      const ty=(stageHeight/2)-(markerY*zoom);

      map.classList.add('is-country-focused');
      map.dataset.zoomLevel=`X${zoomLabel}`;
      map.dataset.focusCountry=selectedWorldCountry;
      stage.style.setProperty('--focus-zoom',String(zoom));
      stage.style.setProperty('--focus-tx',`${tx.toFixed(2)}px`);
      stage.style.setProperty('--focus-ty',`${ty.toFixed(2)}px`);
    }else{
      map?.classList.remove('is-country-focused');
      map.dataset.zoomLevel='X1';
      delete map.dataset.focusCountry;
      stage?.style.removeProperty('--focus-x');
      stage?.style.removeProperty('--focus-y');
      stage?.style.removeProperty('--focus-tx');
      stage?.style.removeProperty('--focus-ty');
      stage?.style.removeProperty('--focus-zoom');
    }
  }
  function readGaCache(){try{return JSON.parse(localStorage.getItem(GA_CACHE_KEY)||'null')}catch(_){return null}}
  function saveGaCache(ga){try{localStorage.setItem(GA_CACHE_KEY,JSON.stringify({google:ga,savedAt:Date.now()}))}catch(_){}}
  function readYoutubeMapCache(){try{return JSON.parse(localStorage.getItem(YT_MAP_CACHE_KEY)||'null')}catch(_){return null}}
  function saveYoutubeMapCache(studio){try{localStorage.setItem(YT_MAP_CACHE_KEY,JSON.stringify({countries:studio?.countries||[],startDate:studio?.startDate||'',endDate:studio?.endDate||'',savedAt:Date.now()}))}catch(_){}}
  function renderWorldMap(countries=[],options={}){
    const map=$('worldMap'),list=$('worldCountries');
    if(!map||!list)return;
    if(options.source)map.dataset.mapSource=String(options.source);
    const clean=(countries||[])
      .map(item=>({...item,code:String(item.country||'').trim().toUpperCase(),name:translateCountry(item.country),value:Number(item.views??item.activeUsers??item.value??0)}))
      .filter(item=>item.name!=='(не задано)')
      .sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'ru'));
    const max=Math.max(1,...clean.map(x=>x.value));
    const markers=clean.filter(item=>GEO[item.name]).map(item=>{
      const [lon,lat]=GEO[item.name];
      const x=(lon+180)/360*100;
      const y=(85-lat)/145*100;
      const power=.5+item.value/max*.5;
      const size=8+Math.round(item.value/max*13);
      const encoded=encodeURIComponent(item.name);
      const selected=item.name===selectedWorldCountry?' is-selected':'';
      return `<span class="world-map-dot${selected}" data-country="${encoded}" data-code="${escapeHtml(item.code)}" aria-current="${selected?'true':'false'}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--power:${power};--dot:${size}px" title="${escapeHtml(item.name)}: ${number(item.value)}"><i></i></span>`;
    }).join('');
    const note=options.error?escapeHtml(options.error):(!clean.length?(options.loading?'Получаем географию YouTube…':'Страны появятся после получения данных'):'');
    map.innerHTML=`<div class="world-map-canvas" role="img" aria-label="Карта стран аудитории"><div class="world-map-stage"><img src="/assets/world-map-control-v52.webp?v=52.14" alt="Карта мира"/>${markers}</div>${note?`<span class="world-map-state ${options.error?'is-error':''}">${note}</span>`:''}</div>`;
    if(clean.length){
      const rows=clean.map((item,index)=>{
        const encoded=encodeURIComponent(item.name);
        const selected=item.name===selectedWorldCountry;
        const flag=countryFlag(item.name,item.code);
        return `<button type="button" class="world-country-button ${index>=4?'world-country-extra ':''}${selected?'is-selected':''}" data-country="${encoded}" data-code="${escapeHtml(item.code)}" aria-pressed="${selected?'true':'false'}"><span class="world-country-flag" aria-hidden="true">${flag}</span><span class="world-country-name"><span class="world-country-marquee">${escapeHtml(item.name)}</span></span><em>${number(item.value)}</em></button>`;
      }).join('');
      const toggleTop=clean.length>4&&countriesExpanded?`<button class="world-country-toggle is-top-toggle" data-country-toggle type="button" aria-expanded="true">Скрыть список</button>`:'';
      const toggleBottom=clean.length>4?`<button class="world-country-toggle" data-country-toggle type="button" aria-expanded="${countriesExpanded?'true':'false'}">${countriesExpanded?'Скрыть список':`Показать все страны (${clean.length})`}</button>`:'';
      list.classList.toggle('is-expanded',countriesExpanded);
      list.innerHTML=toggleTop+rows+toggleBottom;
      list.querySelectorAll('.world-country-button[data-country]').forEach(button=>{
        const marquee=button.querySelector('.world-country-marquee');
        if(marquee){
          requestAnimationFrame(()=>{
            const shift=Math.max(0,marquee.scrollWidth-marquee.clientWidth);
            button.classList.toggle('is-overflowing',shift>8);
            marquee.style.setProperty('--marquee-shift',shift+'px');
          });
        }
        button.addEventListener('click',()=>{
          const country=decodeURIComponent(button.dataset.country||'');
          cycleWorldCountrySelection(map,list,country);
        });
      });
      map.querySelectorAll('.world-map-dot[data-country]').forEach(marker=>marker.addEventListener('click',()=>{
        const country=decodeURIComponent(marker.dataset.country||'');
        cycleWorldCountrySelection(map,list,country);
      }));
      applyWorldCountrySelection(map,list,selectedWorldCountry);
      const pane=document.querySelector('.analytics-map-pane');
      const viewport=$('analyticsSwipeViewport');
      pane?.classList.toggle('is-country-expanded',countriesExpanded);
      viewport?.classList.toggle('is-country-list-open',countriesExpanded);
      list.querySelectorAll('[data-country-toggle]').forEach(toggleButton=>toggleButton.addEventListener('click',()=>{
        countriesExpanded=!countriesExpanded;
        renderWorldMap(clean,options);
        if(!countriesExpanded)pane?.scrollTo?.({top:0,behavior:'smooth'});
      }));
    }else{
      selectedWorldCountry='';
      selectedWorldCountryZoomStep=0;
      selectedWorldCountryZoomDirection=1;
      list.classList.remove('is-expanded');
      list.innerHTML=options.loading?'<span class="world-country-loading"><b>Получаем страны…</b><em>•••</em></span>':'';
      document.querySelector('.analytics-map-pane')?.classList.remove('is-country-expanded');
      $('analyticsSwipeViewport')?.classList.remove('is-country-list-open');
    }
  }
  function renderCachedMap(){
    const gaCached=readGaCache();
    const ytCached=readYoutubeMapCache();
    renderWorldMap(ytCached?.countries||[],ytCached?.countries?.length?{source:'cache'}:{loading:true,source:'loading'});
    if(gaCached?.google){
      try{renderKpis(gaCached.google);renderTrend(gaCached.google.trend||[])}catch(_){}
    }
  }
  function growthRowsFromPayload(data){
    const source=data?.weeklyCountries?data
      :data?.data?.weeklyCountries?data.data
      :data?.youtube?.studio?.weeklyCountries?data.youtube.studio
      :data?.youtube?.weeklyCountries?data.youtube
      :{};
    return (Array.isArray(source.weeklyCountries)?source.weeklyCountries:[])
      .map(item=>({country:String(item?.country||item?.code||'').trim().toUpperCase(),views:Number(item?.views??item?.value??0)}))
      .filter(item=>item.country&&item.views>0);
  }
  function renderGrowthMapFallback(data){
    const map=$('worldMap'),list=$('worldCountries');
    if(!map||!list)return false;
    const rows=growthRowsFromPayload(data);
    if(!rows.length)return false;
    const alreadyFull=(map.dataset.mapSource==='audience'||map.dataset.mapSource==='cache')&&Boolean(list.querySelector('.world-country-button'));
    if(alreadyFull)return false;
    renderWorldMap(rows,{source:'growth'});
    const period=$('worldMapPeriod');
    if(period)period.innerHTML='Карта по последним <span class="period-nowrap">7&nbsp;дням</span> · данные за 28 дней догружаются.';
    authState(true,'Доступ подтверждён');
    return true;
  }

  function setupAnalyticsSwipe(){
    if(window.__andrikAnalyticsSwipeReady)return;
    const viewport=$('analyticsSwipeViewport');
    const track=$('analyticsSwipeTrack');
    const dots=[...document.querySelectorAll('#analyticsSwipeDots [data-page]')];
    const panes=[...document.querySelectorAll('[data-analytics-page]')];
    const downIndicator=$('analyticsDownIndicator');
    if(!viewport||!track||panes.length<3)return;
    window.__andrikAnalyticsSwipeReady=true;
    const count=panes.length;
    const requested=String(new URLSearchParams(location.search).get('page')||'').toLowerCase();
    const requestedPage={google:0,ga:0,ga4:0,analytics:0,site:0,website:0,map:1,youtube:2}[requested];
    let page=Number.isInteger(requestedPage)?requestedPage:1;
    let gesture=null;
    let routeChanging=false;
    const wrap=value=>((Number(value)%count)+count)%count;
    const updateHeight=()=>{
      const topbar=document.querySelector('.control-topbar');
      const viewportHeight=window.visualViewport?.height||window.innerHeight;
      const topbarHeight=Math.ceil(topbar?.getBoundingClientRect().height||0);
      document.documentElement.style.setProperty('--analytics-swipe-height',`${Math.max(420,viewportHeight-topbarHeight)}px`);
      apply(false);
    };
    const announcePage=()=>{
      const pane=panes[page];
      document.body.dataset.analyticsPage=pane?.dataset.analyticsPage||'';
      window.dispatchEvent(new CustomEvent('andrik:analytics-page-changed',{detail:{page:document.body.dataset.analyticsPage}}));
      if(pane?.dataset.analyticsPage==='youtube')window.dispatchEvent(new CustomEvent('andrik:youtube-pane-visible'));
    };
    const apply=(animate=true,dragOffset=0,dragY=0)=>{
      track.style.transition=animate?'transform .20s cubic-bezier(.22,.75,.2,1)':'none';
      track.style.transform=`translate3d(${-page*viewport.clientWidth+dragOffset}px,${dragY}px,0)`;
      dots.forEach((dot,index)=>dot.classList.toggle('is-active',index===page));
      panes.forEach((pane,index)=>pane.setAttribute('aria-hidden',index===page?'false':'true'));
      announcePage();
      requestAnimationFrame(()=>{if(!animate)track.style.transition=''});
    };
    const resetMapViewport=()=>{
      const pane=panes.find(item=>item?.dataset?.analyticsPage==='map');
      if(!pane)return;
      pane.scrollTop=0;
      const inner=pane.querySelector('.analytics-pane-wrap');
      if(inner)inner.scrollTop=0;
      try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch(_){window.scrollTo(0,0)}
    };
    const setPage=(next,animate=true)=>{
      const raw=Number(next);
      const wrapped=wrap(raw);
      const circularJump=raw<0||raw>=count;
      page=wrapped;
      if(panes[page]?.dataset?.analyticsPage==='map') resetMapViewport();
      if(circularJump){
        viewport.classList.add('is-circular-jump');
        apply(false);
        requestAnimationFrame(()=>requestAnimationFrame(()=>viewport.classList.remove('is-circular-jump')));
      }else apply(animate);
    };
    const refreshPageLabel=()=>{
      const name=panes[page]?.dataset?.analyticsPage||'map';
      return name==='google'?'Google Analytics':name==='youtube'?'YouTube':'карту';
    };
    const setDownProgress=(distance=0,ready=false)=>{
      if(!downIndicator)return;
      downIndicator.classList.toggle('is-visible',distance>5);
      downIndicator.classList.toggle('is-ready',ready);
      downIndicator.style.setProperty('--down-progress',String(Math.min(1,distance/68)));
      const text=downIndicator.querySelector('span');
      const label=refreshPageLabel();
      if(text)text.textContent=ready?`Отпустите — обновить ${label}`:`Свайп сверху вниз — обновить ${label}`;
    };
    const refreshAnalyticsDashboard=async()=>{
      if(window.__andrikAnalyticsRefreshing)return;
      window.__andrikAnalyticsRefreshing=true;
      const text=downIndicator?.querySelector('span');
      if(text)text.textContent='Обновляем…';
      setDownProgress(96,true);
      apply(true,0,42);
      try{
        const name=panes[page]?.dataset?.analyticsPage||'map';
        if(name==='google')await load(true);
        else await loadPlatforms(true);
        if(text)text.textContent='Обновлено ✓';
      }finally{window.setTimeout(()=>{setDownProgress(0,false);apply(true);window.__andrikAnalyticsRefreshing=false;},720)}
    };
    const finishGesture=(event,cancelled=false)=>{
      if(!gesture)return;
      const dx=(event?.clientX??gesture.lastX??gesture.x)-gesture.x;
      const dy=(event?.clientY??gesture.lastY??gesture.y)-gesture.y;
      const elapsed=Date.now()-gesture.t;
      const mode=gesture.mode;
      gesture=null;
      if(!cancelled&&mode==='vertical-down'&&dy>56){
        refreshAnalyticsDashboard();
        return;
      }
      if(!cancelled&&mode==='vertical-up'&&dy<-52){
        if(routeChanging)return;
        routeChanging=true;
        setDownProgress(0,false);
        location.assign('/control-home.html?source=map-swipe&page=menu&v=54.99b');
        return;
      }
      setDownProgress(0,false);
      if(!cancelled&&mode==='horizontal'&&(Math.abs(dx)>46||(elapsed<420&&Math.abs(dx)>30))){
        setPage(page+(dx<0?1:-1));
        return;
      }
      apply(true);
    };
    viewport.addEventListener('pointerdown',event=>{
      if(event.isPrimary===false)return;
      const target=event.target;
      if(target?.closest?.('#countryGrowthPanel'))return;
      if(target?.closest?.('a,button,input,textarea,select,summary'))return;
      const pane=panes[page];
      const pageName=pane?.dataset.analyticsPage||'';
      const inner=pane?.querySelector?.('.analytics-pane-wrap');
      const paneTop=Number(pane?.scrollTop||0);
      const innerTop=Number(inner?.scrollTop||0);
      const atTop=paneTop<=2&&innerTop<=2&&Number(window.scrollY||0)<=2;
      const paneScrollable=Boolean(pane&&pane.scrollHeight>pane.clientHeight+8);
      const innerScrollable=Boolean(inner&&inner.scrollHeight>inner.clientHeight+8);
      const paneAtBottom=!paneScrollable||paneTop+Number(pane?.clientHeight||0)>=Number(pane?.scrollHeight||0)-4;
      const innerAtBottom=!innerScrollable||innerTop+Number(inner?.clientHeight||0)>=Number(inner?.scrollHeight||0)-4;
      const atBottom=paneAtBottom&&innerAtBottom;
      const scrollElement=innerScrollable?inner:pane;
      const mapGesturesEnabled=pageName==='map'&&!countriesExpanded&&atBottom;
      const viewportWidth=window.visualViewport?.width||window.innerWidth||document.documentElement.clientWidth||0;
      const viewportHeight=window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0;
      const rightScrollZone=event.clientX>=Math.max(0,viewportWidth-76);
      const bottomMenuZone=event.clientY>=Math.max(0,viewportHeight-118);
      const isLandscape=window.matchMedia?.('(orientation: landscape)')?.matches===true;
      const dedicatedZone=Boolean(target?.closest?.('#mapEndPullZone'));
      const canPullRefresh=['google','map','youtube'].includes(pageName)&&atTop&&(pageName!=='map'||!countriesExpanded);
      const canOpenSections=mapGesturesEnabled&&bottomMenuZone&&!rightScrollZone&&(!isLandscape||dedicatedZone);
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,t:Date.now(),mode:null,canPullRefresh,canOpenSections,pageName,scrollElement,scrollStart:Number(scrollElement?.scrollTop||0)};
      try{viewport.setPointerCapture(event.pointerId)}catch(_){}
    });
    viewport.addEventListener('pointermove',event=>{
      if(!gesture||gesture.id!==event.pointerId)return;
      gesture.lastX=event.clientX;
      gesture.lastY=event.clientY;
      const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
      if(!gesture.mode&&Math.max(Math.abs(dx),Math.abs(dy))>8){
        if(gesture.canPullRefresh&&dy>0&&Math.abs(dy)>Math.abs(dx)*1.05)gesture.mode='vertical-down';
        else if(gesture.canOpenSections&&dy<0&&Math.abs(dy)>Math.abs(dx)*1.05)gesture.mode='vertical-up';
        else if(Math.abs(dx)>Math.abs(dy)*1.05)gesture.mode='horizontal';
        else gesture.mode='vertical-scroll';
      }
      if(gesture.mode==='vertical-down'){
        event.preventDefault();
        const distance=Math.min(112,Math.max(0,dy));
        apply(false,0,distance*.42);
        setDownProgress(distance,distance>=56);
        return;
      }
      if(gesture.mode==='vertical-up'){
        event.preventDefault();
        const distance=Math.max(-112,Math.min(0,dy));
        apply(false,0,distance*.3);
        return;
      }
      if(gesture.mode==='vertical-scroll'){
        const scrollElement=gesture.scrollElement;
        if(scrollElement){
          event.preventDefault();
          const maxScroll=Math.max(0,Number(scrollElement.scrollHeight||0)-Number(scrollElement.clientHeight||0));
          scrollElement.scrollTop=Math.max(0,Math.min(maxScroll,gesture.scrollStart-dy));
        }
        return;
      }
      if(gesture.mode!=='horizontal')return;
      event.preventDefault();
      const circularEdge=(page===0&&dx>0)||(page===count-1&&dx<0);
      apply(false,circularEdge?0:dx);
    },{passive:false});
    viewport.addEventListener('pointerup',event=>finishGesture(event,false));
    viewport.addEventListener('pointercancel',event=>finishGesture(event,true));
    dots.forEach(dot=>dot.addEventListener('click',()=>setPage(Number(dot.dataset.page||1))));
    document.querySelectorAll('[data-swipe-go]').forEach(button=>button.addEventListener('click',()=>setPage(Number(button.dataset.swipeGo))));
    window.addEventListener('resize',()=>{updateHeight();if(selectedWorldCountry)applyWorldCountrySelection($('worldMap'),$('worldCountries'),selectedWorldCountry)},{passive:true});
    window.visualViewport?.addEventListener('resize',updateHeight,{passive:true});
    updateHeight();
    setPage(page,false);
    try{history.scrollRestoration='manual'}catch(_){}
    window.addEventListener('pageshow',event=>{
      if(panes[page]?.dataset?.analyticsPage==='map'){
        const pane=panes[page];
        pane.scrollTop=0;
        try{window.scrollTo(0,0)}catch(_){}
      }
      if(event.persisted)apply(false);
    },{passive:true});
    window.analyticsSetPage=setPage;
  }
  let refreshTimer=null;
  function renderGoogleData(ga,data={}){
    if((!ga?.configured||ga?.error)&&!ga?.liveCounter?.configured){
      if($('analyticsKpis'))$('analyticsKpis').innerHTML='<div class="admin-empty">Google Analytics пока не отдаёт данные.</div>';
      if($('analyticsTrend'))$('analyticsTrend').innerHTML=`<div class="admin-empty">${escapeHtml(ga?.error||'Не настроено')}</div>`;
      ['analyticsPages','analyticsCountries','analyticsDevices'].forEach(id=>{if($(id))$(id).innerHTML='<div class="admin-empty">Ожидаем подключение.</div>'});
      if($('analyticsMessage')){$('analyticsMessage').textContent=ga?.error||'GOOGLE_ANALYTICS_CREDENTIALS не настроен';$('analyticsMessage').className='control-analytics-status is-warning'}
      return;
    }
    renderKpis(ga);renderTrend(ga.trend||[]);
    renderList('analyticsPages',(ga.pages||[]).map(item=>({...item,pageLabel:pageSectionLabel(item.pagePath,item.pageTitle),pagePathLabel:pageVersionLabel(item.pagePath)})),'screenPageViews','pageLabel','pagePathLabel');
    renderCountrySpoiler(ga.countries||[]);
    renderList('analyticsDevices',(ga.devices||[]).map(item=>({...item,deviceCategory:translateDevice(item.deviceCategory)})),'activeUsers','deviceCategory');
    if($('analyticsPropertyLabel'))$('analyticsPropertyLabel').textContent=ga.propertyId?`${ga.propertyName||'andrikmetal.com'} · GA4 property ${ga.propertyId}`:`${ga.propertyName||'andrikmetal.com'} · живой счётчик`;
    if($('analyticsMessage')){const source=ga.liveCounter?.configured?'GA4 + мгновенный счётчик сайта':'Google Analytics';$('analyticsMessage').textContent=`${source} · автообновление каждые 2 минуты · ${dateTime(ga.updatedAt||data.updatedAt)}`;$('analyticsMessage').className='control-analytics-status is-good'}
    saveGaCache(ga);
  }
  function readAudienceCache(){try{return JSON.parse(localStorage.getItem(AUDIENCE_CACHE_KEY)||'null')}catch(_){return null}}
  function saveAudienceCache(data){try{localStorage.setItem(AUDIENCE_CACHE_KEY,JSON.stringify({data,savedAt:Date.now()}))}catch(_){}}
  function emitAudienceData(data){
    window.__andrikLatestAudienceData=data;
    window.dispatchEvent(new CustomEvent('andrik:audience-data',{detail:data}));
  }
  let searchConsoleRequest=null;
  async function loadSearchConsole(force=false){
    if(searchConsoleRequest&&!force)return searchConsoleRequest;
    if(!getKey())return null;
    const request=api(`/api/control/search-console${force?'?refresh=1':''}`,12500);
    searchConsoleRequest=request;
    try{
      const data=await request;
      renderSearchConsole([],(data&&data.searchConsole)||data||{});
      return data;
    }catch(error){
      renderSearchConsole([],{connected:false,error:error.message||'Search Console недоступен'});
      return null;
    }finally{
      if(searchConsoleRequest===request)searchConsoleRequest=null;
    }
  }

  async function loadPlatforms(force=false){
    if(audienceRequest&&!force)return audienceRequest;
    const request=api('/api/control/audience',18000);
    audienceRequest=request;
    window.__andrikAudiencePromise=request;
    try{
      const data=await request;
      authState(true,'Доступ подтверждён');
      saveAudienceCache(data);
      emitAudienceData(data);
      renderSearchConsole(data.searchEngines||[],data.searchConsole||{});
      void loadSearchConsole(force);
      const studio=data.youtube?.studio||{};
      const countries=Array.isArray(studio.countries)?studio.countries:[];
      if(countries.length){
        saveYoutubeMapCache(studio);
        renderWorldMap(countries,{source:'audience'});
        const period=$('worldMapPeriod');
        if(period)period.innerHTML='Просмотры YouTube по странам за последние <span class="period-nowrap">28&nbsp;дней.</span>';
      }else{
        const cached=readYoutubeMapCache();
        const growthFallbackActive=$('worldMap')?.dataset.mapSource==='growth'&&Boolean($('worldCountries')?.querySelector('.world-country-button'));
        if(cached?.countries?.length)renderWorldMap(cached.countries,{source:'cache'});
        else if(!growthFallbackActive)renderWorldMap([],{error:studio.connected?'География YouTube пока не получена':'Данные Studio ещё не собраны Worker',source:'error'});
      }
      return data;
    }catch(error){
      if(error?.message==='unauthorized')authState(false,'Ключ не принят');
      renderSearchConsole([],{});
      const cached=readYoutubeMapCache();
      const growthFallbackActive=$('worldMap')?.dataset.mapSource==='growth'&&Boolean($('worldCountries')?.querySelector('.world-country-button'));
      if(cached?.countries?.length)renderWorldMap(cached.countries,{source:'cache'});
      else if(!growthFallbackActive)renderWorldMap([],{error:error.message,source:'error'});
      else if(error?.message!=='unauthorized')authState(true,'Доступ подтверждён');
      window.dispatchEvent(new CustomEvent('andrik:audience-error',{detail:{message:error.message}}));
      return null;
    }finally{
      if(audienceRequest===request)audienceRequest=null;
    }
  }
  window.andrikRefreshAudience=()=>loadPlatforms(true);
  window.andrikRefreshAnalytics=()=>load(true);
  async function load(force=false){
    if(!getKey()){
      authState(false,'Сначала сохраните ключ в разделе «Служебное».');
      if($('analyticsMessage'))$('analyticsMessage').textContent='Доступ владельца не подтверждён.';
      renderSearchConsole([],{});
      renderWorldMap(readYoutubeMapCache()?.countries||[],{error:'Нужен ключ владельца',source:'error'});
      return;
    }
    const hasMapFallback=Boolean($('worldCountries')?.querySelector('.world-country-button'))&&['growth','cache','audience'].includes($('worldMap')?.dataset.mapSource||'');
    authState(hasMapFallback,hasMapFallback?'Доступ подтверждён · обновляем данные…':'Проверяем доступ…');
    if($('analyticsMessage'))$('analyticsMessage').textContent='Обновляем статистику…';
    const platformsPromise=loadPlatforms(force);
    try{
      const data=await api('/api/control/google-analytics',9000);
      const ga=data.google||data.website||{};
      authState(true,'Доступ подтверждён');
      renderGoogleData(ga,data);
    }catch(error){
      const unauthorized=error.message==='unauthorized';
      authState(!unauthorized,unauthorized?'Ключ не принят':'Доступ подтверждён');
      if($('analyticsMessage')){$('analyticsMessage').textContent=`Аналитика: ${error.message}`;$('analyticsMessage').className='control-analytics-status is-warning'}
    }
    // YouTube geography and Search Console update independently. A slow Worker
    // must never hold the whole map page or the pull-to-refresh gesture open.
    void platformsPromise;
  }
  if('caches' in window){
    caches.keys().then(keys=>Promise.all(keys.map(key=>caches.open(key).then(cache=>cache.delete('/assets/illusion-of-life-top-v50.webp'))))).catch(()=>{});
  }

  const startupWatchdog=setTimeout(()=>{
    const auth=$('analyticsAuthText');
    const state=$('worldMap')?.querySelector('.world-map-state');
    if(auth&&/Проверяем доступ/i.test(auth.textContent||''))authState(false,'Сервер отвечает медленно — повторите свайп вниз');
    if(state&&/Получаем|Обновляем/i.test(state.textContent||'')){
      const cached=readYoutubeMapCache();
      const growthFallbackActive=$('worldMap')?.dataset.mapSource==='growth'&&Boolean($('worldCountries')?.querySelector('.world-country-button'));
      if(cached?.countries?.length)renderWorldMap(cached.countries,{error:'Показаны последние сохранённые данные',source:'cache'});
      else if(!growthFallbackActive)renderWorldMap([],{error:'Не удалось получить карту. Потяните вниз для повторной проверки',source:'error'});
    }
  },10500);

  window.addEventListener('andrik:country-growth-data',event=>{
    renderGrowthMapFallback(event.detail||{});
  });
  if(window.__andrikLatestCountryGrowth)renderGrowthMapFallback(window.__andrikLatestCountryGrowth);

  renderCachedMap();
  const cachedAudience=readAudienceCache();
  if(cachedAudience?.data){renderSearchConsole(cachedAudience.data.searchEngines||[],cachedAudience.data.searchConsole||{});emitAudienceData(cachedAudience.data)}
  setupAnalyticsSwipe();
  setTimeout(load,20);
  refreshTimer=setInterval(()=>{if(!document.hidden)load()},120000);
  window.addEventListener('beforeunload',()=>{clearTimeout(startupWatchdog);if(refreshTimer)clearInterval(refreshTimer)});
})();
