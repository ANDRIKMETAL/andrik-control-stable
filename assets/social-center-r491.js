/* ANDRIK R491 — Social Center controller: accurate Instagram metrics + YouTube OAuth recovery. */
(()=>{
  'use strict';
  if(window.__ANDRIK_SOCIAL_CENTER_R491__)return;
  window.__ANDRIK_SOCIAL_CENTER_R491__=true;
  const RELEASE='R491';
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
    instagram:{name:'Instagram',icon:'◎',label:'просмотров'},
    tiktok:{name:'TikTok',icon:'♪',label:'следующее подключение'},
    facebook:{name:'Facebook',icon:'f',label:'следующее подключение'},
    threads:{name:'Threads',icon:'@',label:'следующее подключение'}
  };
  const state={active:{site:true,youtube:true,instagram:true},data:null,loading:false};

  async function waitOwner(maxWait=6500){
    const started=Date.now();
    while(!window.AndrikOwnerSession&&Date.now()-started<maxWait)await new Promise(r=>setTimeout(r,50));
    const owner=window.AndrikOwnerSession;
    if(!owner)return false;
    if(owner.isActive?.())return true;
    try{const ready=await owner.ready?.();if(ready?.owner||owner.isActive?.())return true}catch(_){}
    try{const status=await owner.status?.();return Boolean(status?.owner||owner.isActive?.())}catch(_){return false}
  }
  async function api(refresh=false){
    await waitOwner();
    const key=String(getKey()||'').trim();
    const headers={accept:'application/json'};
    if(key&&!/^__ANDRIK_OWNER_SESSION_/i.test(key))headers.authorization=`Bearer ${key}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),40000);
    try{
      const response=await fetch(`/api/control/social-overview${refresh?'?refresh=1':''}`,{headers,credentials:'include',cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.details||data?.error||`HTTP ${response.status}`);
      return data;
    }finally{clearTimeout(timer)}
  }
  async function youtubeReconnectR490(button){
    if(button){button.disabled=true;button.textContent='Открываем Google…'}
    try{
      await waitOwner();
      const key=String(getKey()||'').trim();const headers={accept:'application/json'};
      if(key&&!/^__ANDRIK_OWNER_SESSION_/i.test(key))headers.authorization=`Bearer ${key}`;
      const response=await fetch('/api/control/youtube-oauth/start',{headers,credentials:'include',cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data?.url)throw new Error(data?.error||'Не удалось открыть авторизацию YouTube');
      location.assign(data.url);
    }catch(error){
      if(button){button.disabled=false;button.textContent='Переподключить YouTube'}
      const warning=$('socialCenterWarningR488');if(warning){warning.hidden=false;warning.textContent=`YouTube: ${error?.message||'ошибка авторизации'}`}
    }
  }
  function connected(key,data){
    if(key==='site')return Boolean(data?.platforms?.site?.configured&&data?.totals?.site!==null);
    return Boolean(data?.platforms?.[key]?.connected&&data?.totals?.[key]!==null);
  }
  function graphConnected(key,data){
    if(!connected(key,data))return false;
    if(key==='instagram'&&data?.platforms?.instagram?.trendConnected===false)return false;
    return true;
  }
  function renderPlatforms(data){
    const box=$('socialCenterPlatformsR488');if(!box)return;
    const keys=['site','youtube','instagram','tiktok','facebook','threads'];
    box.innerHTML=keys.map(key=>{
      const def=platformDefs[key];const future=['tiktok','facebook','threads'].includes(key);const live=!future&&connected(key,data);
      const total=!future?data?.totals?.[key]:null;const meta=data?.platforms?.[key]||{};
      const status=future?'готовим':live?'подключено':(key==='youtube'&&meta.reconnectRequired?'нужен вход':'ожидает');
      let detail=future?def.label:(live?def.label:'данных пока нет');
      let sub='';let href='';let action='';
      if(key==='instagram'){
        detail=live?(meta.metricLabel||'Instagram Insights'):(meta.configured?'токен есть · нажми обновить':'нужен Worker Secret');
        sub=`<span class="social-center-r488-account">@${esc(meta.username||'andrikmetal')}</span>`;
        href=meta.profileUrl||'https://www.instagram.com/andrikmetal/';
      }else if(key==='youtube'){
        sub=`<span class="social-center-r488-account">${esc(meta.handle||'@andrikmetal')}</span>`;
        if(!live&&meta.reconnectRequired){
          detail='Google OAuth отозван — переподключи один раз';
          action='<button class="social-center-r490-reconnect" type="button" data-youtube-reconnect-r490>Переподключить YouTube</button>';
        }else{
          href='https://www.youtube.com/@andrikmetal';
          if(!live&&meta.error)detail='Studio: '+String(meta.error).slice(0,75);
        }
      }else if(key==='site')href='https://andrikmetal.com/';
      const inner=`<div class="social-center-r488-platform-top"><span class="social-center-r488-platform-icon">${esc(def.icon)}</span><span class="social-center-r488-status">${esc(status)}</span></div><h3>${esc(def.name)}</h3>${sub}<strong>${future?'—':esc(total===null?'—':num(total))}</strong><small>${esc(detail)}</small>${action}${href&&!future?'<em>Открыть ↗</em>':''}`;
      return href&&!future?`<a class="social-center-r488-platform is-${key}${future?' is-future':''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`:`<article class="social-center-r488-platform is-${key}${future?' is-future':''}">${inner}</article>`;
    }).join('');
    box.querySelectorAll('[data-youtube-reconnect-r490]').forEach(button=>button.addEventListener('click',()=>youtubeReconnectR490(button)));
  }
  function renderToggles(data){
    const box=$('socialCenterTogglesR488');if(!box)return;
    const liveKeys=['site','youtube','instagram'];
    const futureKeys=['tiktok','facebook','threads'];
    box.innerHTML=liveKeys.map(key=>`<button type="button" class="social-center-r488-toggle is-${key}${state.active[key]?' is-active':''}" data-social-toggle="${key}" ${graphConnected(key,data)?'':'disabled'}>${esc(platformDefs[key].name)}</button>`).join('')+
      futureKeys.map(key=>`<button type="button" class="social-center-r488-toggle" disabled>${esc(platformDefs[key].name)} · скоро</button>`).join('');
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
    const keys=['site','youtube','instagram'].filter(key=>state.active[key]&&graphConnected(key,data));
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
      if(tip){const lines=keys.map(key=>{const label=key==='instagram'?(data?.platforms?.instagram?.metricLabel||platformDefs[key].name):platformDefs[key].name;return `<span>${esc(label)} <b>${esc(full(row[key]))}</b></span>`}).join('');tip.innerHTML=`<strong>${esc(day(row.day))}</strong>${lines}`;tip.hidden=false;const host=box.getBoundingClientRect();tip.style.left=`${box.offsetLeft+Math.max(8,Math.min(host.width-160,(cx/W)*host.width-70))}px`;tip.style.top=`${box.offsetTop+42}px`}
    };
    svg.addEventListener('pointerdown',showTip);svg.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')showTip(event)});svg.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){cross?.setAttribute('hidden','');if(tip)tip.hidden=true}});
  }
  function renderShares(data){
    const box=$('socialCenterSharesR488');if(!box)return;
    const keys=['site','youtube','instagram'].filter(key=>connected(key,data)&&state.active[key]);
    const total=keys.reduce((sum,key)=>sum+n(data?.totals?.[key]),0);
    if(!keys.length||!total){box.innerHTML='<div class="social-center-r488-empty">Нет данных для долей.</div>';return}
    box.innerHTML=keys.map(key=>{const value=n(data.totals[key]);const pct=Math.max(0,Math.min(100,value/total*100));return `<div class="social-center-r488-share-row"><span>${esc(platformDefs[key].name)}</span><div class="social-center-r488-share-track"><div class="social-center-r488-share-fill is-${key}" style="width:${pct.toFixed(2)}%"></div></div><b>${esc(num(value))}</b></div>`}).join('');
  }
  function renderRecord(data){
    const box=$('socialCenterRecordR488');if(!box)return;
    const keys=['site','youtube','instagram'].filter(key=>graphConnected(key,data));
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
    grid.innerHTML=metrics.map(([label,value])=>`<div class="social-center-r488-ig-metric${present(value)?'':' is-unavailable'}"><span>${esc(label)}</span><strong>${esc(full(value))}</strong></div>`).join('');
  }
  function renderWarning(data){
    const box=$('socialCenterWarningR488');if(!box)return;
    const ig=data?.platforms?.instagram||{};const yt=data?.platforms?.youtube||{};const messages=[];
    if(!ig.configured)messages.push('Instagram: Worker ждёт Secret INSTAGRAM_ACCESS_TOKEN.');
    else if(!ig.connected)messages.push(`Instagram: ${ig.error||'токен есть, но Insights пока не вернул дневной ряд'}`);
    else if(ig.trendConnected===false)messages.push('Instagram подключён, итог получен, но Meta пока не вернула дневной ряд для графика.');
    else if(Array.isArray(ig.partialErrors)&&ig.partialErrors.length)messages.push('Instagram подключён; часть дополнительных метрик Meta пока не возвращает.');
    if(!yt.connected)messages.push(yt.reconnectRequired?'YouTube: доступ Google был отозван. Нажми «Переподключить YouTube» в карточке выше.':`YouTube: ${yt.error||'Studio OAuth пока не вернул дневной ряд. Нажми ↻ для живого обновления.'}`);
    box.hidden=!messages.length;box.textContent=messages.join(' · ');
  }
  function render(data){
    state.data=data;const totals=data?.totals||{};const keys=['site','youtube','instagram'].filter(key=>connected(key,data));const grand=keys.reduce((sum,key)=>sum+n(totals[key]),0);
    const total=$('socialCenterTotalR488');if(total){const igLabel=data?.platforms?.instagram?.metricLabel||'просмотры';total.innerHTML=`<span>Общий итог</span><strong>${esc(full(grand))}</strong><small>${keys.length} из 6 · Instagram: ${esc(igLabel)}</small>`;}
    const period=$('socialCenterPeriodR488');if(period)period.textContent=`${day(data?.period?.startDate)} — ${day(data?.period?.endDate)}`;
    renderPlatforms(data);renderToggles(data);renderChart(data);renderShares(data);renderRecord(data);renderInstagram(data);renderWarning(data);const note=document.querySelector('.social-center-r488-chart-note');if(note){const igLabel=data?.platforms?.instagram?.metricLabel||'просмотры';note.textContent=`Сайт — визиты/просмотры страниц (GA4 + Live Web AI), YouTube — просмотры видео, Instagram — ${igLabel}. Нажми на платформу выше, чтобы скрыть или вернуть линию.`;}
  }
  async function load(refresh=false){
    if(state.loading)return;state.loading=true;const button=$('socialCenterRefreshR488');if(button){button.disabled=true;button.textContent='…'}
    try{const data=await api(refresh);render(data)}catch(error){const chart=$('socialCenterChartR488');if(chart)chart.innerHTML=`<div class="social-center-r488-empty">${esc(error?.message||'Не удалось загрузить центр соцсетей')}</div>`;const warning=$('socialCenterWarningR488');if(warning){warning.hidden=false;warning.textContent=error?.message||'Ошибка загрузки'}}finally{state.loading=false;if(button){button.disabled=false;button.textContent='↻'}}
  }
  const boot=()=>{$('socialCenterRefreshR488')?.addEventListener('click',()=>load(true));load(false)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
