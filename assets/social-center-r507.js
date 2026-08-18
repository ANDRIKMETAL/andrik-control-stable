/* ANDRIK R507 — instant cached Social Center: Site + YouTube + Instagram + TikTok only.
   Paints the last good snapshot immediately, then refreshes sources in separate Worker invocations. */
(()=>{
  'use strict';
  if(window.__ANDRIK_SOCIAL_CENTER_R506__)return;
  window.__ANDRIK_SOCIAL_CENTER_R506__=true;
  const RELEASE='R506';
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const present=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  const num=value=>present(value)?new Intl.NumberFormat('ru-RU',{notation:Math.abs(Number(value))>=10000?'compact':'standard',maximumFractionDigits:1}).format(Number(value)):'—';
  const full=value=>present(value)?new Intl.NumberFormat('ru-RU').format(Math.round(Number(value))):'—';
  const day=value=>{const m=String(value||'').match(/^\d{4}-(\d{2})-(\d{2})$/);return m?`${m[2]}.${m[1]}`:String(value||'—')};
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const platformDefs={
    site:{name:'Сайт',icon:'⌂',label:'визитов/просмотров страниц'},
    youtube:{name:'YouTube',icon:'▶',label:'просмотров видео'},
    instagram:{name:'Instagram',icon:'◎',label:'просмотров/охвата'},
    tiktok:{name:'TikTok',icon:'TT',label:'просмотров видео'}
  };
  const TIKTOK_MODE_KEY='andrik-tiktok-oauth-mode-r506';
  const DATA_CACHE_KEY='andrik-social-center-data-r506';
  const normalizeTikTokMode=value=>String(value||'').toLowerCase()==='production'?'production':'sandbox';
  const readTikTokMode=()=> 'sandbox';
  const saveTikTokMode=mode=>{const value=normalizeTikTokMode(mode);try{localStorage.setItem(TIKTOK_MODE_KEY,value)}catch(_){}return value};
  const state={active:{site:true,youtube:true,instagram:true,tiktok:true},data:null,loading:false,background:false,tiktokMode:readTikTokMode()};

  const readCachedData=()=>{try{const parsed=JSON.parse(localStorage.getItem(DATA_CACHE_KEY)||'null');return parsed&&parsed.ok?parsed:null}catch(_){return null}};
  const saveCachedData=data=>{if(!data?.ok)return;try{localStorage.setItem(DATA_CACHE_KEY,JSON.stringify(data))}catch(_){}};
  const ageMinutes=value=>{const ms=Date.parse(value||'');return Number.isFinite(ms)?Math.max(0,(Date.now()-ms)/60000):Infinity};

  async function waitOwner(maxWait=6500){
    const started=Date.now();
    while(!window.AndrikOwnerSession&&Date.now()-started<maxWait)await new Promise(r=>setTimeout(r,50));
    const owner=window.AndrikOwnerSession;
    if(!owner)return false;
    if(owner.isActive?.())return true;
    try{const ready=await owner.ready?.();if(ready?.owner||owner.isActive?.())return true}catch(_){}
    try{const status=await owner.status?.();return Boolean(status?.owner||owner.isActive?.())}catch(_){return false}
  }
  async function api({fast=false,source=''}={}){
    await waitOwner();
    const key=String(getKey()||'').trim();
    const headers={accept:'application/json'};
    if(key&&!/^__ANDRIK_OWNER_SESSION_/i.test(key))headers.authorization=`Bearer ${key}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),source?30000:12000);
    try{
      const params=new URLSearchParams({tiktok_mode:state.tiktokMode});
      if(fast)params.set('fast','1');
      if(source)params.set('refresh_source',source);
      const response=await fetch(`/api/control/social-overview?${params.toString()}`,{headers,credentials:'include',cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.details||data?.error||`HTTP ${response.status}`);
      return data;
    }finally{clearTimeout(timer)}
  }
  async function ownerHeaders(){
    await waitOwner();
    const key=String(getKey()||'').trim();
    const headers={accept:'application/json'};
    if(key&&!/^__ANDRIK_OWNER_SESSION_/i.test(key))headers.authorization=`Bearer ${key}`;
    return headers;
  }
  async function connectTikTok(){
    const button=document.querySelector('[data-tiktok-connect-r503]');
    if(button){button.disabled=true;button.textContent='Открываем TikTok…'}
    try{
      const response=await fetch(`/api/control/tiktok-oauth/start?mode=${encodeURIComponent(state.tiktokMode)}`,{headers:await ownerHeaders(),credentials:'include',cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.url)throw new Error(data?.error||`HTTP ${response.status}`);
      location.assign(data.url);
    }catch(error){
      const warning=$('socialCenterWarningR488');if(warning){warning.hidden=false;warning.textContent=`TikTok ${state.tiktokMode}: ${error?.message||'не удалось начать авторизацию'}`}
      if(button){button.disabled=false;button.textContent='Подключить TikTok'}
    }
  }
  function switchTikTokMode(mode){
    const next=saveTikTokMode(mode);if(next===state.tiktokMode)return;
    state.tiktokMode=next;state.data=null;loadInitial();
  }
  function tiktokModeSwitchHtml(){ return ''; }
  function accountConnected(key,data){
    if(key==='site')return Boolean(data?.platforms?.site?.configured);
    if(key==='tiktok')return Boolean(data?.platforms?.tiktok?.oauthConnected&&data?.platforms?.tiktok?.connected);
    return Boolean(data?.platforms?.[key]?.connected);
  }
  function connected(key,data){
    if(key==='site')return Boolean(data?.platforms?.site?.configured&&data?.totals?.site!==null);
    return Boolean(data?.platforms?.[key]?.connected&&data?.totals?.[key]!==null);
  }
  function graphConnected(key,data){
    if(key==='tiktok')return Boolean(data?.platforms?.tiktok?.oauthConnected&&data?.platforms?.tiktok?.trendConnected&&data?.totals?.tiktok!==null);
    if(!connected(key,data))return false;
    if(key==='instagram'&&data?.platforms?.instagram?.trendConnected===false)return false;
    return true;
  }
  function renderPlatforms(data){
    const box=$('socialCenterPlatformsR488');if(!box)return;
    const keys=['site','youtube','instagram','tiktok'];
    box.innerHTML=keys.map(key=>{
      const def=platformDefs[key];const live=accountConnected(key,data);
      const total=data?.totals?.[key]??null;const meta=data?.platforms?.[key]||{};
      const status=live?'подключено':(meta.configured?'готово':'ожидает');
      let detail=live?def.label:(meta.configured?'ждём данные':'готово к подключению');
      let sub='';let href='';let action='';let cardValue=total;
      if(key==='site'){
        href='https://andrikmetal.com/';
        detail=live?'28 дней · визиты':'данные сайта';
      }else if(key==='instagram'){
        sub=`<span class="social-center-r488-account">@${esc(meta.username||'andrikmetal')}</span>`;
        href=meta.profileUrl||'https://www.instagram.com/andrikmetal/';
        detail=live?`28 дней · ${meta.metricLabel||'охват'}`:(meta.configured?'Instagram Insights':'ждём OAuth');
      }else if(key==='youtube'){
        sub=`<span class="social-center-r488-account">${esc(meta.handle||'@andrikmetal')}</span>`;
        href='https://www.youtube.com/@andrikmetal';
        if(live) detail='28 дней · просмотры';
        else if(meta.oauthConnected) detail='OAuth · обновляем';
        else if(meta.reconnectRequired) detail='нужно обновить доступ';
        else detail='ждём YouTube OAuth';
      }else if(key==='tiktok'){
        const summary=meta.summary||{};
        sub=`<span class="social-center-r488-account">${esc(meta.handle||'@andrikmetal')}</span>`;
        if(live){
          href=meta.profileUrl||'https://www.tiktok.com/@andrikmetal';
          cardValue=present(total)?total:(present(summary.totalVideoViews)?summary.totalVideoViews:null);
          const sample=Number(summary.fetchedVideos||0);
          detail=meta.trendConnected?'дневной прирост · история':`текущий срез · ${sample||'—'} роликов`;
        }else if(meta.configured){
          detail='Sandbox готов · подключи аккаунт';
          action='<button type="button" class="social-center-r503-connect" data-tiktok-connect-r503>Подключить TikTok</button>';
        }else{
          detail='нужны Sandbox Client Key + Secret';
        }
      }
      const inner=`<div class="social-center-r488-platform-top"><span class="social-center-r488-platform-icon">${esc(def.icon)}</span><span class="social-center-r488-status">${esc(status)}</span></div><h3>${esc(def.name)}</h3>${sub}<strong>${esc(cardValue===null?'—':num(cardValue))}</strong><small class="social-center-r506-card-detail">${esc(detail)}</small>${action}`;
      return href?`<a class="social-center-r488-platform is-${key}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(def.name)}">${inner}</a>`:`<article class="social-center-r488-platform is-${key}${live?'':' is-future'}">${inner}</article>`;
    }).join('');
    box.querySelector('[data-tiktok-connect-r503]')?.addEventListener('click',connectTikTok);
  }
  function renderToggles(data){
    const box=$('socialCenterTogglesR488');if(!box)return;
    const keys=['site','youtube','instagram','tiktok'];
    box.innerHTML=keys.map(key=>{const ready=graphConnected(key,data);const meta=data?.platforms?.[key]||{};let wait=' · ждёт';if(key==='tiktok'&&meta.oauthConnected)wait=' · копим историю';return `<button type="button" class="social-center-r488-toggle is-${key}${state.active[key]?' is-active':''}" data-social-toggle="${key}" ${ready?'':'disabled'}>${esc(platformDefs[key].name)}${ready?'':wait}</button>`}).join('');
    box.querySelectorAll('[data-social-toggle]').forEach(button=>button.addEventListener('click',()=>{
      const key=button.dataset.socialToggle;if(!key)return;
      state.active[key]=!state.active[key];
      if(!Object.entries(state.active).some(([k,v])=>v&&graphConnected(k,data)))state.active[key]=true;
      renderToggles(data);renderChart(data);renderShares(data);
    }));
  }
  function makeSegments(rows,key,x,y){
    const segments=[];let current=[];
    rows.forEach((row,index)=>{
      const value=row?.[key];
      if(value===null||value===undefined||!Number.isFinite(Number(value))){if(current.length){segments.push(current);current=[]}return}
      current.push([x(index),y(Number(value)),Number(value),row.day,index]);
    });
    if(current.length)segments.push(current);return segments;
  }
  function renderChart(data){
    const box=$('socialCenterChartR488');if(!box)return;
    const rows=Array.isArray(data?.trend)?data.trend:[];
    const keys=['site','youtube','instagram','tiktok'].filter(key=>state.active[key]&&graphConnected(key,data));
    if(!rows.length||!keys.length){box.innerHTML='<div class="social-center-r488-empty">Нет активных линий для графика.</div>';return}
    const values=rows.flatMap(row=>keys.map(key=>row?.[key]).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number));
    if(!values.length){box.innerHTML='<div class="social-center-r488-empty">Дневной ряд пока не получен.</div>';return}
    const W=820,H=292,L=50,R=16,T=18,B=38,plotW=W-L-R,plotH=H-T-B;
    const maxRaw=Math.max(1,...values);const pow=10**Math.floor(Math.log10(maxRaw));const rounded=Math.ceil(maxRaw/pow)*pow;
    const x=i=>L+(rows.length<=1?plotW/2:(i/(rows.length-1))*plotW);const y=v=>T+plotH-(Math.max(0,v)/rounded)*plotH;
    const grid=[];for(let i=0;i<=4;i++){const value=rounded*(1-i/4);const yy=T+plotH*(i/4);grid.push(`<line class="social-center-r488-grid-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="social-center-r488-axis" x="${L-7}" y="${yy+3}" text-anchor="end">${esc(num(value))}</text>`) }
    const paths=[];const dots=[];
    keys.forEach(key=>makeSegments(rows,key,x,y).forEach(segment=>{
      if(segment.length>1){paths.push(`<path class="social-center-r488-line is-${key}" d="${segment.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}"/>`)}
      segment.forEach((p,i)=>{if(i===0||i===segment.length-1||i%7===0)dots.push(`<circle class="social-center-r488-dot is-${key}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`)})
    }));
    const labelIdx=[0,7,14,21,rows.length-1].filter((v,i,a)=>v>=0&&v<rows.length&&a.indexOf(v)===i);
    const labels=labelIdx.map(i=>`<text class="social-center-r488-date" x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(day(rows[i]?.day))}</text>`).join('');
    box.innerHTML=`<svg class="social-center-r488-svg" viewBox="0 0 ${W} ${H}" data-l="${L}" data-r="${R}" data-w="${W}" role="img" aria-label="Общий график соцсетей за 28 дней">${grid.join('')}${paths.join('')}${dots.join('')}<line id="socialCenterCrossR488" class="social-center-r488-cross" x1="0" y1="${T}" x2="0" y2="${T+plotH}" hidden/>${labels}</svg>`;
    const svg=box.querySelector('svg');if(!svg)return;
    const tip=$('socialCenterTooltipR488');const cross=svg.querySelector('#socialCenterCrossR488');
    const showTip=event=>{
      const rect=svg.getBoundingClientRect();const px=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
      const viewX=(px/Math.max(1,rect.width))*W;const idx=Math.max(0,Math.min(rows.length-1,Math.round(((viewX-L)/plotW)*(rows.length-1))));const row=rows[idx];if(!row)return;
      const cx=x(idx);cross?.removeAttribute('hidden');if(cross){cross.setAttribute('x1',cx);cross.setAttribute('x2',cx)}
      if(tip){const lines=keys.map(key=>{const label=data?.platforms?.[key]?.metricLabel||platformDefs[key].name;return `<span>${esc(label)} <b>${esc(full(row[key]))}</b></span>`}).join('');tip.innerHTML=`<strong>${esc(day(row.day))}</strong>${lines}`;tip.hidden=false;const host=box.getBoundingClientRect();tip.style.left=`${box.offsetLeft+Math.max(8,Math.min(host.width-160,(cx/W)*host.width-70))}px`;tip.style.top=`${box.offsetTop+42}px`}
    };
    svg.addEventListener('pointerdown',showTip);svg.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')showTip(event)});svg.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){cross?.setAttribute('hidden','');if(tip)tip.hidden=true}});
  }
  function renderShares(data){
    const box=$('socialCenterSharesR488');if(!box)return;
    const keys=['site','youtube','instagram','tiktok'].filter(key=>state.active[key]&&(connected(key,data)||(key==='tiktok'&&accountConnected(key,data))));
    const numericKeys=keys.filter(key=>data?.totals?.[key]!==null&&data?.totals?.[key]!==undefined);
    const total=numericKeys.reduce((sum,key)=>sum+n(data?.totals?.[key]),0);
    if(!keys.length){box.innerHTML='<div class="social-center-r488-empty">Нет данных за период.</div>';return}
    box.innerHTML=keys.map(key=>{
      const raw=data?.totals?.[key];const pending=raw===null||raw===undefined;const value=pending?0:n(raw);const pct=total>0&&!pending?Math.max(0,Math.min(100,value/total*100)):0;
      const valueLabel=pending&&key==='tiktok'?'копим':num(value);
      return `<div class="social-center-r488-share-row${pending?' is-pending':''}"><span>${esc(platformDefs[key].name)}</span><div class="social-center-r488-share-track"><div class="social-center-r488-share-fill is-${key}" style="width:${pct.toFixed(2)}%"></div></div><b>${esc(valueLabel)}</b></div>`;
    }).join('');
  }
  function renderRecord(data){
    const box=$('socialCenterRecordR488');if(!box)return;
    const keys=['site','youtube','instagram','tiktok'].filter(key=>graphConnected(key,data));
    const rows=(Array.isArray(data?.trend)?data.trend:[]).map(row=>({day:row.day,total:keys.reduce((sum,key)=>sum+n(row?.[key]),0)}));
    const best=rows.reduce((acc,row)=>!acc||row.total>acc.total?row:acc,null);
    box.innerHTML=best?`<strong>${esc(full(best.total))}</strong><span>${esc(day(best.day))}</span><small>по сумме подключённых платформ</small>`:'<strong>—</strong><span>—</span><small>данных пока нет</small>';
  }
  function renderInstagram(data){
    const section=$('socialCenterInstagramR488');const grid=$('socialCenterInstagramGridR488');if(!section||!grid)return;
    const ig=data?.platforms?.instagram||{};if(!ig.connected){section.hidden=true;return}section.hidden=false;
    const s=ig.summary||{};const a=ig.summaryAvailability||{};
    const metrics=[
      ['Просмотры',a.views?s.views:null],['Охват',a.reach?s.reach:null],['Профиль',a.profileViews?s.profileViews:null],
      ['Взаимодействия',a.totalInteractions?s.totalInteractions:null],['Лайки',a.likes?s.likes:null],['Комментарии',a.comments?s.comments:null],
      ['Репосты',a.shares?s.shares:null],['Сохранения',a.saves?s.saves:null],['Вовлечённые',a.accountsEngaged?s.accountsEngaged:null]
    ];
    const availableMetrics=metrics.filter(([,value])=>present(value));
    grid.innerHTML=availableMetrics.length
      ? availableMetrics.map(([label,value])=>`<div class="social-center-r488-ig-metric"><span>${esc(label)}</span><strong>${esc(full(value))}</strong></div>`).join('')
      : '<div class="social-center-r488-empty">Meta пока не вернула дополнительные метрики вовлечённости.</div>';
  }
  function renderTikTok(data){
    const section=$('socialCenterTikTokR503');const grid=$('socialCenterTikTokGridR503');if(!section||!grid)return;
    const tt=data?.platforms?.tiktok||{};if(!tt.oauthConnected||!tt.connected){section.hidden=true;return}section.hidden=false;section.dataset.tiktokMode=tt.mode||state.tiktokMode;
    const v=tt.summary||{};
    const metrics=[
      ['Подписчики',v.followerCount],['Подписки',v.followingCount],['Лайки профиля',v.profileLikes],['Видео',v.videoCount],
      ['Просмотры видео',v.totalVideoViews],['Лайки видео',v.totalVideoLikes],['Комментарии',v.totalVideoComments],['Репосты',v.totalVideoShares]
    ];
    grid.innerHTML=metrics.map(([label,value])=>`<div class="social-center-r503-tt-metric${present(value)?'':' is-unavailable'}"><span>${esc(label)}</span><strong>${esc(full(value))}</strong></div>`).join('');
    const note=$('socialCenterTikTokNoteR503');if(note){const count=Number(v.fetchedVideos||0);note.textContent=v.allVideosFetched?`Срез по всем ${count} публичным роликам · дневная история копится автоматически.`:`Срез по последним ${count} роликам · дневная история копится автоматически.`}
  }
  function renderWarning(data){
    const box=$('socialCenterWarningR488');if(!box)return;
    const ig=data?.platforms?.instagram||{};const yt=data?.platforms?.youtube||{};const messages=[];
    if(!ig.configured)messages.push('Instagram: Worker ждёт Secret INSTAGRAM_ACCESS_TOKEN.');
    else if(!ig.connected)messages.push(`Instagram: ${ig.error||'токен есть, но Insights пока не вернул дневной ряд'}`);
    else if(ig.trendConnected===false)messages.push('Instagram подключён, итог получен, но Meta пока не вернула дневной ряд для графика.');
    else if(Array.isArray(ig.partialErrors)&&ig.partialErrors.length)messages.push('Instagram подключён; часть дополнительных метрик Meta пока не возвращает.');
    if(!yt.connected){
      const realError=yt.error||(Array.isArray(yt.partialErrors)&&yt.partialErrors.length?yt.partialErrors[0]:'');
      if(yt.reconnectRequired)messages.push('YouTube: доступ Google требует обновления. После изменения доступа нажми ↻.');
      else if(yt.oauthConnected)messages.push(`YouTube OAuth подключён${realError?` · ${realError}`:' · дневная аналитика ещё не пришла'}. Нажми ↻ для повторного запроса.`);
      else messages.push(`YouTube: ${realError||'нужна авторизация Studio'}.`);
    }
    const tt=data?.platforms?.tiktok||{};
    if(tt.configured&&!tt.oauthConnected)messages.push(`TikTok ${String(tt.mode||state.tiktokMode).toUpperCase()}: OAuth настроен. Нажми «Подключить TikTok» в карточке.`);
    else if(tt.oauthConnected&&!tt.connected)messages.push(`TikTok ${String(tt.mode||state.tiktokMode).toUpperCase()}: ${tt.error||'OAuth есть, но API пока не вернул данные'}`);
    const ttErrors=(Array.isArray(tt.partialErrors)?tt.partialErrors:[]).filter(message=>!/too many subrequests|single worker invocation|developers\.cloudflare\.com\/workers\/wrangler/i.test(String(message||'')));
    if(ttErrors.length)messages.push(`TikTok: часть данных пока недоступна · ${ttErrors[0]}`);
    box.hidden=!messages.length;box.textContent=messages.join(' · ');
  }
  function render(data){
    state.data=data;const totals=data?.totals||{};const keys=['site','youtube','instagram','tiktok'].filter(key=>connected(key,data));const grand=keys.reduce((sum,key)=>sum+n(totals[key]),0);
    const total=$('socialCenterTotalR488');if(total){const ttPending=accountConnected('tiktok',data)&&!connected('tiktok',data);total.innerHTML=`<span>Итог за 28 дней</span><strong>${esc(full(grand))}</strong><small>${keys.length} платформ с историей${ttPending?' · TikTok копим':''}</small>`;}
    const period=$('socialCenterPeriodR488');if(period)period.textContent=`${day(data?.period?.startDate)} — ${day(data?.period?.endDate)}`;
    renderPlatforms(data);renderToggles(data);renderChart(data);renderShares(data);renderRecord(data);renderInstagram(data);renderTikTok(data);renderWarning(data);saveCachedData(data);const note=document.querySelector('.social-center-r488-chart-note');if(note){const igLabel=data?.platforms?.instagram?.metricLabel||'просмотры';const tt=data?.platforms?.tiktok||{};note.textContent=`Сайт — визиты, YouTube — просмотры, Instagram — ${igLabel}, TikTok — ${tt.trendConnected?'прирост просмотров':'линия появится после накопления снимков'}. Цвета: зелёный / красный / жёлтый / розовый.`;}
  }
  async function refreshSource(source,{button=false}={}){
    try{const data=await api({source});render(data);return data}catch(error){
      const warning=$('socialCenterWarningR488');if(warning&&!state.data){warning.hidden=false;warning.textContent=error?.message||'Ошибка обновления'}
      return null;
    }
  }
  function staleSources(data){
    const out=[];const p=data?.platforms||{};
    const push=(name,enabled,updatedAt,minutes=30)=>{if(enabled&&(!updatedAt||ageMinutes(updatedAt)>minutes))out.push(name)};
    push('tiktok',Boolean(p.tiktok?.oauthConnected),p.tiktok?.updatedAt,25);
    push('instagram',Boolean(p.instagram?.configured),p.instagram?.updatedAt,30);
    push('youtube',Boolean(p.youtube?.configured),p.youtube?.updatedAt,30);
    push('site',Boolean(p.site?.configured),p.site?.updatedAt,30);
    return out;
  }
  async function backgroundRefresh(data){
    if(state.background)return;const sources=staleSources(data);if(!sources.length)return;state.background=true;
    try{for(const source of sources){await refreshSource(source);await new Promise(r=>setTimeout(r,120))}}finally{state.background=false}
  }
  async function loadInitial(){
    if(state.loading)return;state.loading=true;const button=$('socialCenterRefreshR488');
    try{
      const data=await api({fast:true});render(data);
      setTimeout(()=>backgroundRefresh(data),80);
    }catch(error){
      if(!state.data){const chart=$('socialCenterChartR488');if(chart)chart.innerHTML=`<div class="social-center-r488-empty">${esc(error?.message||'Не удалось загрузить центр соцсетей')}</div>`;const warning=$('socialCenterWarningR488');if(warning){warning.hidden=false;warning.textContent=error?.message||'Ошибка загрузки'}}
    }finally{state.loading=false;if(button){button.disabled=false;button.textContent='↻'}}
  }
  async function manualRefresh(){
    if(state.loading||state.background)return;const button=$('socialCenterRefreshR488');if(button){button.disabled=true;button.textContent='…'}state.background=true;
    try{
      const p=state.data?.platforms||{};const sources=[];
      if(p.tiktok?.oauthConnected)sources.push('tiktok');
      if(p.instagram?.configured)sources.push('instagram');
      if(p.youtube?.configured)sources.push('youtube');
      if(p.site?.configured)sources.push('site');
      for(const source of sources){await refreshSource(source);await new Promise(r=>setTimeout(r,120))}
      if(!sources.length)await loadInitial();
    }finally{state.background=false;if(button){button.disabled=false;button.textContent='↻'}}
  }
  const boot=()=>{
    $('socialCenterRefreshR488')?.addEventListener('click',manualRefresh);
    const cached=readCachedData();if(cached)render(cached);
    const params=new URLSearchParams(location.search);const requestedMode=params.get('tiktok_mode');if(requestedMode){state.tiktokMode=saveTikTokMode(requestedMode)}const youtubeConnected=params.get('youtube')==='connected';const tiktokState=params.get('tiktok')||'';const oauthEvent=youtubeConnected||Boolean(tiktokState);
    if(youtubeConnected){const warning=$('socialCenterWarningR488');if(warning){warning.hidden=false;warning.textContent='YouTube OAuth обновлён. Получаем свежую аналитику…'}}
    if(tiktokState){const warning=$('socialCenterWarningR488');const reason=params.get('reason')||params.get('sync')||'';if(warning){warning.hidden=false;warning.textContent=tiktokState==='connected'?`TikTok ${state.tiktokMode.toUpperCase()} OAuth подключён. Загружаем первый реальный срез…`:`TikTok ${state.tiktokMode.toUpperCase()} OAuth: ${reason||tiktokState}`}}
    if(oauthEvent){try{history.replaceState(null,'',location.pathname)}catch(_){}}
    loadInitial();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
