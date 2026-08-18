/* ANDRIK R487 — Site + Instagram + YouTube unified 28-day analytics. */
(()=>{
  'use strict';
  if(window.__ANDRIK_SOCIAL_OVERVIEW_R487__)return;
  window.__ANDRIK_SOCIAL_OVERVIEW_R487__=true;
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const num=value=>(value===null||value===undefined||value==='')?'—':Number.isFinite(Number(value))?new Intl.NumberFormat('ru-RU',{notation:Number(value)>=10000?'compact':'standard',maximumFractionDigits:1}).format(Number(value)):'—';
  const fullNum=value=>(value===null||value===undefined||value==='')?'—':Number.isFinite(Number(value))?new Intl.NumberFormat('ru-RU').format(Number(value)):'—';
  const shortDay=value=>{const m=String(value||'').match(/^\d{4}-(\d{2})-(\d{2})$/);return m?`${m[2]}.${m[1]}`:String(value||'')};
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  let request=null;
  async function waitOwner(maxWait=7000){
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
    const timer=setTimeout(()=>controller.abort(),16000);
    try{
      const response=await fetch(`/api/control/social-overview${refresh?'?refresh=1':''}`,{headers,credentials:'include',cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.details||data?.error||`HTTP ${response.status}`);
      return data;
    }finally{clearTimeout(timer)}
  }
  function formatUpdated(value){
    if(!value)return'—';
    try{return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch(_){return value}
  }
  function lineSegments(rows,key,x,y){
    const segments=[];let current=[];
    rows.forEach((row,index)=>{
      const value=row?.[key];
      if(value===null||value===undefined||!Number.isFinite(Number(value))){if(current.length){segments.push(current);current=[]}return}
      current.push([x(index),y(Number(value)),Number(value),row.day]);
    });
    if(current.length)segments.push(current);
    return segments;
  }
  function renderChart(data){
    const box=$('socialOverviewChartR487');if(!box)return;
    const rows=Array.isArray(data?.trend)?data.trend:[];
    if(!rows.length){box.innerHTML='<div class="social-overview-r487-empty">Данных за 28 дней пока нет.</div>';return}
    const keys=['site','instagram','youtube'];
    const values=rows.flatMap(row=>keys.map(key=>row?.[key]).filter(value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))).map(Number));
    if(!values.length){box.innerHTML='<div class="social-overview-r487-empty">Сайт, Instagram и YouTube пока не отдали временной ряд.</div>';return}
    const W=760,H=258,L=48,R=15,T=14,B=34,plotW=W-L-R,plotH=H-T-B;
    const max=Math.max(1,...values);
    const roundedMax=max<=10?10:Math.ceil(max/(10**Math.floor(Math.log10(max))))*(10**Math.floor(Math.log10(max)));
    const x=i=>L+(rows.length<=1?plotW/2:(i/(rows.length-1))*plotW);
    const y=v=>T+plotH-(Math.max(0,v)/roundedMax)*plotH;
    const grid=[];
    for(let i=0;i<=4;i++){
      const value=roundedMax*(1-i/4),yy=T+plotH*(i/4);
      grid.push(`<line class="social-overview-r487-grid" x1="${L}" y1="${yy.toFixed(1)}" x2="${W-R}" y2="${yy.toFixed(1)}"/><text class="social-overview-r487-axis-label" x="${L-6}" y="${(yy+3).toFixed(1)}" text-anchor="end">${esc(num(value))}</text>`);
    }
    const paths=[];const dots=[];
    keys.forEach(key=>{
      lineSegments(rows,key,x,y).forEach(segment=>{
        if(segment.length===1){const p=segment[0];dots.push(`<circle class="social-overview-r487-dot is-${key}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"><title>${esc(shortDay(p[3]))}: ${esc(fullNum(p[2]))}</title></circle>`);return}
        const d=segment.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        paths.push(`<path class="social-overview-r487-path is-${key}" d="${d}"/>`);
        segment.forEach((p,i)=>{if(i===0||i===segment.length-1||i%7===0)dots.push(`<circle class="social-overview-r487-dot is-${key}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.8"><title>${esc(shortDay(p[3]))}: ${esc(fullNum(p[2]))}</title></circle>`)})
      });
    });
    const labelIndexes=[0,7,14,21,rows.length-1].filter((v,i,a)=>v>=0&&v<rows.length&&a.indexOf(v)===i);
    const labels=labelIndexes.map(i=>`<text class="social-overview-r487-date-label" x="${x(i).toFixed(1)}" y="${H-9}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(shortDay(rows[i]?.day))}</text>`).join('');
    box.innerHTML=`<svg class="social-overview-r487-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Просмотры сайта, Instagram и YouTube за 28 дней">${grid.join('')}${paths.join('')}${dots.join('')}${labels}</svg>`;
  }
  function render(data){
    const totals=data?.totals||{};const platforms=data?.platforms||{};const ig=platforms.instagram||{};const summary=ig.summary||{};
    const kpis=$('socialOverviewKpisR487');
    if(kpis)kpis.innerHTML=`
      <div class="social-overview-r487-kpi is-site"><span>Сайт</span><strong>${esc(num(totals.site))}</strong><small>просмотров страниц</small></div>
      <div class="social-overview-r487-kpi is-instagram"><span>Instagram</span><strong>${esc(num(totals.instagram))}</strong><small>${ig.connected?'просмотров':'ждёт подключения'}</small></div>
      <div class="social-overview-r487-kpi is-youtube"><span>YouTube</span><strong>${esc(num(totals.youtube))}</strong><small>просмотров видео</small></div>`;
    renderChart(data);
    const extra=$('socialOverviewInstagramExtraR487');
    if(extra){
      extra.innerHTML=ig.connected?`<span>Instagram · охват <b>${esc(fullNum(summary.reach))}</b></span><span>профиль <b>${esc(fullNum(summary.profileViews))}</b></span><span>взаимодействия <b>${esc(fullNum(summary.totalInteractions))}</b></span>`:'';
    }
    const meta=$('socialOverviewMetaR487');
    if(meta){
      const period=data?.period||{};
      meta.innerHTML=`<span><strong>${esc(shortDay(period.startDate))} — ${esc(shortDay(period.endDate))}</strong> · одинаковое окно для трёх платформ</span><span>обновлено ${esc(formatUpdated(data?.updatedAt))}</span>`;
    }
    const warning=$('socialOverviewWarningR487');
    if(warning){
      if(!ig.configured){warning.hidden=false;warning.textContent='Instagram готов в R487, но Worker ждёт секрет INSTAGRAM_ACCESS_TOKEN.'}
      else if(!ig.connected){warning.hidden=false;warning.textContent=`Instagram: ${ig.error||'данные пока не получены'}`}
      else if(Array.isArray(ig.partialErrors)&&ig.partialErrors.length){warning.hidden=false;warning.textContent='Instagram подключён. Часть дополнительных метрик временно недоступна; просмотры графика сохранены.'}
      else{warning.hidden=true;warning.textContent=''}
    }
  }
  async function load(refresh=false){
    if(request&&!refresh)return request;
    const button=$('socialOverviewRefreshR487');
    if(button){button.disabled=true;button.textContent=refresh?'Обновляем…':'Загрузка…'}
    const task=api(refresh);
    request=task;
    try{const data=await task;render(data);return data}
    catch(error){const box=$('socialOverviewChartR487');if(box)box.innerHTML=`<div class="social-overview-r487-empty">${esc(error?.message||'Не удалось загрузить общий график')}</div>`;return null}
    finally{if(request===task)request=null;if(button){button.disabled=false;button.textContent='Обновить'}}
  }
  const boot=()=>{
    $('socialOverviewRefreshR487')?.addEventListener('click',()=>load(true));
    window.addEventListener('andrik:google-analytics-data',()=>load(false));
    load(false);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
