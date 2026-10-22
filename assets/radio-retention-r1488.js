/* R1488: delayed per-video watch time and geography, shared by both radio screens. */
(() => {
  'use strict';
  const root=document.getElementById('radioRetentionR1488'),geo=document.getElementById('radioGeographyR1488');
  if(!root||!geo||window.AndrikRadioRetentionR1488)return;
  const VIDEO='U0bzXBNBs2Y',TIME_ZONE='America/Los_Angeles';
  const q=selector=>root.querySelector(selector),g=selector=>geo.querySelector(selector);
  const text=(element,value)=>{if(element)element.textContent=value;};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>value==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const duration=value=>{
    if(value==null||!Number.isFinite(Number(value)))return '—';
    const seconds=Math.max(0,Math.round(Number(value))),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
    return h?`${h} ч ${m} мин ${s} с`:`${m} мин ${s} с`;
  };
  const dayLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value))?value.split('-').reverse().join('.'):'—';
  const dayNumber=value=>Date.parse(String(value)+'T12:00:00Z')/86400000;
  const shiftDay=(day,delta)=>new Date((dayNumber(day)+delta)*86400000).toISOString().slice(0,10);
  const today=()=>{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const timeLabel=value=>{
    const raw=String(value||''),stamp=Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)?raw.replace(' ','T')+'Z':raw);
    return Number.isFinite(stamp)?new Date(stamp).toLocaleString('ru-RU',{timeZone:'Europe/Bratislava',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):'—';
  };
  const regionNames=(()=>{try{return new Intl.DisplayNames(['ru'],{type:'region'});}catch(_){return null;}})();
  const countryName=value=>{if(!/^[A-Z]{2}$/.test(value)||value==='ZZ')return 'Страна не определена';try{return regionNames?.of(value)||value;}catch(_){return value;}};
  const cityName=value=>!value||/^(?:not set|unknown|\(not set\))$/i.test(value)?'Город не определён':/^\d+$/.test(value)?'Код города '+value:value;
  const badge=(element,label,kind='')=>{text(element,label);if(element)element.dataset.kind=kind;};
  const COORDS_R1488={"BJ":[2.2847,9.1889],"UY":[-55.8183,-32.5312],"AE":[53.9882,24.2762],"PG":[148.5101,-6.5762],"SZ":[31.3741,-26.473],"OM":[55.904,21.5235],"BS":[-77.99,25.375],"LV":[24.6163,56.7926],"DK":[10.39,56.265],"HR":[16.5237,44.4919],"BD":[90.3786,23.5587],"ET":[40.3718,9.1907],"UG":[32.3077,1.4033],"DE":[10.5028,51.1428],"RW":[29.9205,-2.0263],"PR":[-66.4167,18.2336],"KP":[127.5228,40.3272],"KR":[127.7929,36.5011],"TZ":[34.8283,-6.3355],"UA":[31.0832,48.3483],"GL":[-42.7528,71.8409],"TJ":[71.2111,38.8492],"AU":[133.4542,-27.1514],"LT":[23.822,55.1391],"DZ":[1.6576,28.0879],"AF":[67.8432,33.9024],"MY":[109.6338,3.8506],"IT":[12.6151,41.8677],"NC":[165.5748,-21.2528],"LR":[-9.4893,6.4484],"MD":[28.322,46.9777],"IN":[82.7896,21.7298],"SO":[46.0575,5.1707],"CA":[-96.8229,62.4542],"JO":[37.059,31.2881],"BR":[-54.3586,-14.2619],"NO":[18.1427,69.368],"LK":[80.7416,7.8962],"SB":[159.445,-8.7129],"ML":[-3.9503,17.5355],"JM":[-77.2687,18.1127],"IQ":[43.6802,33.2421],"KZ":[66.9132,48.0238],"DO":[-70.1315,18.7417],"PH":[121.8558,12.0431],"AL":[20.1623,41.1566],"NE":[8.0994,17.5659],"BA":[17.6749,43.9419],"BF":[-1.6467,12.3635],"BW":[24.6638,-22.2452],"ZA":[24.5876,-28.4552],"LA":[103.8403,18.1729],"PL":[19.0523,51.9395],"MW":[34.23,-13.016],"FK":[-59.475,-51.7],"BG":[25.4693,42.7347],"GA":[11.6117,-0.826],"KH":[104.9813,12.5286],"TH":[101.4825,13.0546],"ZW":[29.057,-18.8897],"KW":[47.4924,29.2926],"SE":[17.4654,62.234],"SY":[39.0252,34.7714],"TW":[121.0287,23.633],"LS":[28.1622,-29.6463],"VN":[105.7529,15.9759],"PT":[-7.9578,39.5594],"CY":[33.1308,34.8725],"SA":[45.1495,24.2544],"LY":[17.2421,26.3587],"MZ":[35.4775,-18.5296],"TT":[-61.4225,10.445],"PE":[-75.038,-9.2026],"FJ":[178.7459,-17.1544],"EG":[30.7831,26.7928],"MA":[-9.0725,28.5904],"SS":[29.5925,7.8786],"TF":[69.64,-49.2],"SN":[-14.5465,14.4652],"BZ":[-88.668,17.1935],"SI":[15.1315,46.1524],"BN":[114.8274,4.7277],"NI":[-85.4079,12.8716],"SR":[-56.0014,3.9215],"GQ":[10.2953,1.647],"ES":[-3.1767,39.8476],"GM":[-15.3432,13.5034],"GY":[-58.9748,4.8176],"CI":[-5.5825,7.4312],"AZ":[47.5934,40.0655],"VU":[167.237,-15.6122],"LU":[5.9584,49.7854],"JP":[137.4758,38.2905],"BY":[27.9466,53.7443],"EE":[25.7357,58.5428],"BI":[29.8886,-3.4242],"GE":[43.2965,42.3088],"NL":[5.2035,52.1571],"UZ":[64.4922,41.3659],"SK":[19.7191,48.665],"HT":[-73.0414,18.9733],"ER":[39.7022,15.2269],"FR":[2.4838,46.2643],"TN":[9.5066,33.8288],"MG":[46.8654,-18.821],"PK":[69.3559,30.4125],"AT":[13.2298,47.7354],"LB":[35.8689,33.867],"NP":[84.1316,28.4103],"QA":[51.1753,25.3355],"GN":[-11.4812,9.9476],"MK":[21.7078,41.5815],"SL":[-11.7383,8.4164],"US":[-119.3779,45.137],"ID":[118.1634,-2.4401],"AM":[45.0442,39.9947],"CZ":[15.5466,49.8363],"BE":[4.3351,50.5023],"SV":[-88.9095,13.7866],"GT":[-90.2271,15.7773],"BT":[90.459,27.5079],"GH":[-1.0921,7.9044],"CD":[21.6782,-4.0006],"GR":[23.3771,38.3734],"VE":[-66.5316,6.4434],"CL":[-71.3022,-36.5959],"TL":[126.1523,-8.8333],"GF":[-53.0913,3.905],"IS":[-18.968,65.0116],"ZM":[27.6868,-13.0997],"EH":[-12.8643,24.3281],"FI":[26.0808,65.0053],"CN":[104.3508,35.8282],"AR":[-63.5219,-38.5412],"TG":[0.9077,8.4738],"BM":[-64.7656,32.3174],"EC":[-78.1007,-1.7891],"MR":[-10.9934,21.0063],"KG":[74.8624,41.2889],"TM":[59.5243,39.0111],"HU":[19.4564,47.1917],"IE":[-8.005,53.4005],"GB":[-2.9453,54.2975],"TR":[35.4187,38.9815],"NA":[18.4093,-22.9934],"BO":[-63.5444,-16.3175],"RO":[24.9234,45.9547],"MN":[103.762,46.8224],"RU":[104.8805,61.2009],"DJ":[42.4898,11.8133],"CH":[8.2327,46.8039],"PA":[-80.1042,8.4161],"MT":[14.3733,35.948],"MX":[-101.9699,23.6298],"NG":[8.6344,9.0533],"HN":[-86.2503,14.4951],"NZ":[172.5131,-40.546],"SD":[30.1734,15.3099],"TD":[18.7136,15.4158],"GW":[-15.189,11.8343],"PY":[-58.489,-23.4456],"YE":[47.8567,15.793],"KE":[37.8743,0.4146],"CO":[-72.9336,4.0696],"CM":[12.2508,7.2935],"CU":[-79.5765,21.522],"AO":[17.86,-11.1843],"CG":[14.7734,-0.6549],"CF":[20.9168,6.705],"IR":[53.7129,32.3956],"IL":[35.0509,31.3894],"CR":[-84.244,9.7211]};
  let report=null,metric='duration',selectedDay='',selectedIndex=-1,generation=0,controller=null;
  let selectedPreset=28,modal=null,cityWindow=60,cityGeneration=0,cityController=null,lastCityLoad=0;
  let lastOnline=null,lastOnlineAt='',onlineKnown=false;
  const startInput=q('[data-r1488-start]'),endInput=q('[data-r1488-end]');
  endInput.value=today();startInput.value=shiftDay(endInput.value,-27);startInput.max=endInput.max=endInput.value;
  const compact=root.dataset.layout==='compact';
  const compactLink=q('[data-r1488-compact-link]');if(compactLink)compactLink.hidden=!compact;
  function authHeaders(){
    let key='';try{key=localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||'';}catch(_){}
    return {accept:'application/json',...(key&&!key.startsWith('__ANDRIK_OWNER_SESSION')?{authorization:'Bearer '+key}:{})};
  }
  async function api(path,signal){
    await Promise.resolve(window.AndrikOwnerSession?.ready?.()).catch(()=>null);
    const response=await fetch(path,{credentials:'include',cache:'no-store',headers:authHeaders(),signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw Object.assign(new Error(data.message||'Не удалось получить данные: HTTP '+response.status),{detail:data.detail||data.error||'',status:response.status,reconnectSuggested:data.reconnectSuggested});
    if(data.videoId!==VIDEO)throw new Error('Отклонены данные другого эфира.');
    return data;
  }
  function setMessage(message,kind='',detail='',reconnect=false){
    const box=q('[data-r1488-message]');text(box,message);box.dataset.kind=kind;
    const fold=q('[data-r1488-errors]');fold.hidden=!detail;text(fold.querySelector('pre'),detail);
    q('[data-r1488-auth]').hidden=!reconnect;
  }
  function clearRange(){
    report=null;selectedDay='';selectedIndex=-1;
    text(q('[data-r1488-average]'),'—');text(q('[data-r1488-hours]'),'—');text(q('[data-r1488-summary]'),'Получаю обработанные данные текущего эфира…');
    for(const element of [q('[data-r1488-chart]'),g('[data-r1488-countries]'),g('[data-r1488-cities]')])if(element)element.innerHTML='<div class="r1488-empty">Получаю отчёт…</div>';
    text(q('[data-r1488-freshness]'),'Дата обработанного отчёта появится после ответа YouTube.');
    g('[data-r1488-map-layer]').replaceChildren();
    text(g('[data-r1488-geo-period]'),'Получаю географию выбранного периода…');
    text(q('[data-r1488-readout]'),'Нажми на точку: дата → время просмотра.');
    if(modal?.open)drawChart(modal.querySelector('[data-r1488-modal-chart]'),true);
  }
  function table(rows,kind){
    return `<div class="r1488-table-wrap"><table class="r1488-table"><thead><tr><th>${kind==='countries'?'Страна':'Город / страна'}</th><th>Просмотры</th><th>Часы</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escape(kind==='countries'?countryName(row.country):cityName(row.city))}${kind==='cities'?'<small>'+escape(countryName(row.country))+'</small>':''}</td><td>${escape(number(row.views))}</td><td>${escape(number(row.watchHours))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderGeography(data){
    const geography=data.geography||{},through=geography.throughDate;
    text(g('[data-r1488-geo-period]'),through?`${dayLabel(data.requestedStart)}–${dayLabel(through)} · выбранный эфир YouTube${data.stale?' · сохранённый отчёт':''}`:'YouTube пока не вернул обработанную географию за этот период.');
    for(const kind of ['countries','cities']){
      const rows=Array.isArray(geography[kind])?geography[kind]:[],target=g(`[data-r1488-${kind}]`),state=geography[kind+'State'];
      target.innerHTML=rows.length?table(rows,kind):`<div class="r1488-empty">${state==='error'?'Не удалось получить '+(kind==='countries'?'страны':'города')+' YouTube. Причина показана в отчёте выше.':kind==='countries'?'YouTube пока не раскрыл страны этого эфира за выбранный период.':'YouTube пока не раскрыл города этого эфира за выбранный период.'}</div>`;
    }
    badge(g('[data-r1488-geo-state]'),!through?'Жду отчёт':data.stale?'Сохранённые данные':geography.countriesState==='error'||geography.citiesState==='error'?'Частичный отчёт':'За период',data.stale||!through||geography.countriesState==='error'||geography.citiesState==='error'?'warn':'ok');
    const layer=g('[data-r1488-map-layer]');layer.replaceChildren();
    for(const row of geography.countries||[]){
      const coordinates=COORDS_R1488[row.country];if(!coordinates||!row.views)continue;
      const [lon,lat]=coordinates,point=document.createElement('button');point.type='button';
      point.style.left=(Math.max(0,Math.min(100,(lon+180)/360*100)))+'%';point.style.top=(Math.max(0,Math.min(100,(85-lat)/145*100)))+'%';
      point.title=`${countryName(row.country)} · ${number(row.views)} просмотров · ${number(row.watchHours)} ч`;
      point.setAttribute('aria-label',point.title);point.addEventListener('click',()=>text(g('[data-r1488-map-readout]'),point.title+' · за обработанный период'));
      layer.appendChild(point);
    }
  }
  function valueFor(row){return metric==='hours'?row.watchHours:row.averageViewDurationSeconds==null?null:row.averageViewDurationSeconds/60;}
  function plotPoints(){return (report?.series||[]).filter(row=>valueFor(row)!=null&&Number.isFinite(valueFor(row)));}
  function drawChart(target,expanded=false){
    if(!target)return;target.dataset.metric=metric;
    const points=plotPoints();
    if(!points.length){target.innerHTML='<div class="r1488-empty">'+(report?.status==='empty'?'За выбранный период YouTube пока не вернул отчёт. Пустые дни не означают нулевое время просмотра.':'Нет доступных значений этого показателя за выбранный период.')+'</div>';return;}
    const width=Math.round(Math.max(280,Math.min(1100,target.getBoundingClientRect().width||window.innerWidth-80))),height=expanded?410:300,left=62,right=20,top=30,bottom=54,plotW=width-left-right,plotH=height-top-bottom;
    const first=dayNumber(report.requestedStart),last=dayNumber(report.requestedEnd),span=Math.max(1,last-first),singleDate=last===first;
    const x=row=>singleDate?left+plotW/2:left+(dayNumber(row.day)-first)/span*plotW;
    const maximum=Math.max(...points.map(valueFor),0.01),rawStep=maximum/4,power=10**Math.floor(Math.log10(rawStep));
    const step=[1,2,5,10].map(n=>n*power).find(n=>n>=rawStep)||power*10,yMax=Math.ceil(maximum/step)*step;
    const y=row=>top+plotH-valueFor(row)/yMax*plotH;
    const grid=[];
    for(let v=0;v<=yMax+step/100;v+=step){const py=top+plotH-v/yMax*plotH;grid.push(`<line class="r1488-grid" x1="${left}" x2="${width-right}" y1="${py}" y2="${py}"/><text class="axis-text" x="${left-9}" y="${py+4}" text-anchor="end">${escape(number(v))}</text>`);}
    const ticks=new Set([first,last]);for(let i=1;i<4;i++)ticks.add(Math.round(first+(last-first)*i/4));
    for(const day of [...ticks].sort((a,b)=>a-b)){const date=new Date(day*86400000).toISOString().slice(0,10),px=singleDate?left+plotW/2:left+(day-first)/span*plotW;grid.push(`<text class="axis-text" x="${px}" y="${height-29}" text-anchor="middle">${escape(dayLabel(date).slice(0,5))}</text>`);}
    const paths=[];let segment=[];
    const finish=()=>{if(segment.length>1)paths.push(`<path class="data-line" d="${segment.map((row,i)=>(i?'L':'M')+x(row).toFixed(2)+' '+y(row).toFixed(2)).join(' ')}"/>`);segment=[];};
    for(const row of report.series){if(valueFor(row)==null){finish();continue;}if(segment.length&&dayNumber(row.day)-dayNumber(segment[segment.length-1].day)>1)finish();segment.push(row);}finish();
    const dots=points.map(row=>`<circle class="data-dot${row.day===selectedDay?' is-selected':''}" cx="${x(row).toFixed(2)}" cy="${y(row).toFixed(2)}" r="${row.day===selectedDay?6:4}"><title>${escape(dayLabel(row.day)+' · '+duration(row.averageViewDurationSeconds)+' · '+number(row.watchHours)+' ч · '+number(row.views)+' просмотров')}</title></circle>`).join('');
    target.innerHTML=`<svg viewBox="0 0 ${width} ${height}" tabindex="0" role="img" aria-label="${metric==='hours'?'Часы просмотра':'Среднее время просмотра'} по дням. Стрелки влево и вправо выбирают день." data-r1488-svg data-plot-left="${left}" data-plot-width="${plotW}" data-svg-width="${width}"><text class="axis-text" x="${left}" y="17">${metric==='hours'?'Часы просмотра':'Среднее время, мин'}</text>${grid.join('')}<path class="r1488-axis" d="M ${left} ${top} V ${height-bottom} H ${width-right}"/>${paths.join('')}${dots}</svg>`;
  }
  function redraw(){
    if(!compact)drawChart(q('[data-r1488-chart]'));
    if(modal?.open)drawChart(modal.querySelector('[data-r1488-modal-chart]'),true);
    root.querySelectorAll('[data-r1488-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.r1488Metric===metric)));
    modal?.querySelectorAll('[data-r1488-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.r1488Metric===metric)));
  }
  function choosePoint(row){
    if(!row)return;selectedDay=row.day;selectedIndex=plotPoints().findIndex(point=>point.day===row.day);
    const message=`${dayLabel(row.day)} · среднее ${duration(row.averageViewDurationSeconds)} · ${number(row.watchHours)} ч суммарно · ${number(row.views)} просмотров`;
    text(q('[data-r1488-readout]'),message);if(modal)text(modal.querySelector('[data-r1488-readout]'),message);redraw();
  }
  function handleChartPointer(event){
    const svg=event.target.closest?.('[data-r1488-svg]');if(!svg||!report)return;
    const bounds=svg.getBoundingClientRect(),unit=(event.clientX-bounds.left)/Math.max(1,bounds.width)*Number(svg.dataset.svgWidth);
    const ratio=Math.max(0,Math.min(1,(unit-Number(svg.dataset.plotLeft))/Number(svg.dataset.plotWidth)));
    const at=dayNumber(report.requestedStart)+(dayNumber(report.requestedEnd)-dayNumber(report.requestedStart))*ratio;
    const row=plotPoints().reduce((best,item)=>!best||Math.abs(dayNumber(item.day)-at)<Math.abs(dayNumber(best.day)-at)?item:best,null);choosePoint(row);
  }
  function handleChartKey(event){
    if(!event.target.matches?.('[data-r1488-svg]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const points=plotPoints();if(!points.length)return;event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,(selectedIndex<0?points.length-1:selectedIndex)+(event.key==='ArrowLeft'?-1:1)));
    choosePoint(points[next]);
    const scope=modal?.open?modal:root;scope.querySelector('[data-r1488-svg]')?.focus?.();
  }
  function render(data){
    report=data;startInput.max=endInput.max=data.today;startInput.value=data.requestedStart;endInput.value=data.requestedEnd;
    text(q('[data-r1488-average]'),duration(data.totals?.averageViewDurationSeconds));text(q('[data-r1488-hours]'),number(data.totals?.watchHours));
    text(q('[data-r1488-summary]'),data.lastAvailableDate?`${number(data.totals?.views)} просмотров в обработанном отчёте · ${number(data.reportedDays)} дней с данными`:'Для этого периода обработанный отчёт ещё не получен.');
    const warnings=data.warnings||[],errors=warnings.map(item=>item.section+': '+item.detail).join('\n');
    if(data.stale){badge(q('[data-r1488-state]'),'Сохранённый отчёт','warn');setMessage('Новый запрос не прошёл. Показан сохранённый отчёт с датой ниже.','warn',data.refreshError?.detail||'',data.refreshError?.reconnectSuggested);}
    else if(data.status==='empty'){badge(q('[data-r1488-state]'),'Жду отчёт YouTube','warn');setMessage('YouTube пока не вернул данные за выбранный период. Это не нулевое время просмотра.','warn');}
    else if(warnings.length){badge(q('[data-r1488-state]'),'Частичный отчёт','warn');setMessage('Часть данных временно недоступна. Полученные значения и график сохранены.','warn',errors,warnings.some(item=>item.reconnectSuggested));}
    else{badge(q('[data-r1488-state]'),data.lagging?'Есть задержка':'Отчёт получен',data.lagging?'warn':'ok');setMessage(data.lagging?'Последние дни ещё не вошли в отчёт YouTube.':'Получены официальные показатели выбранного эфира.');}
    text(q('[data-r1488-freshness]'),`${data.lastAvailableDate?'Данные по '+dayLabel(data.lastAvailableDate):'Дата обработанных данных пока неизвестна'} · получено ${timeLabel(data.fetchedAt)}${data.cached?' · сохранённый ответ':''}`);
    renderGeography(data);redraw();
    window.dispatchEvent(new CustomEvent('andrik:radio-retention-r1488',{detail:data}));
  }
  async function load(refresh=false){
    const start=startInput.value,end=endInput.value;
    if(!start||!end||start>end||end>today()||dayNumber(end)-dayNumber(start)>365){setMessage('Выбери корректный период: до 366 дней, не позднее сегодняшнего дня YouTube.','error');return;}
    const mine=++generation;controller?.abort();controller=new AbortController();const current=controller;
    const timer=setTimeout(()=>current.abort(),40000);
    root.setAttribute('aria-busy','true');q('[data-r1488-refresh]').disabled=true;
    if(report?.requestedStart!==start||report?.requestedEnd!==end)clearRange();
    badge(q('[data-r1488-state]'),'Запрашиваю отчёт');setMessage('Получаю обработанный отчёт YouTube…');
    try{
      const query=new URLSearchParams({start,end,...(refresh?{refresh:'1'}:{})});
      const data=await api('/api/control/radio-retention-r1488?'+query,current.signal);if(mine===generation)render(data);
    }catch(error){
      if(mine!==generation)return;
      const message=error.name==='AbortError'?'YouTube не ответил за 40 секунд. Можно повторить запрос.':error.message;
      badge(q('[data-r1488-state]'),'Отчёт недоступен','error');setMessage(message,'error',error.detail||'',error.reconnectSuggested||error.status===401);
      if(!report){for(const element of [q('[data-r1488-chart]'),g('[data-r1488-countries]'),g('[data-r1488-cities]')])if(element)element.innerHTML='<div class="r1488-empty">'+escape(message)+'</div>';badge(g('[data-r1488-geo-state]'),'Отчёт недоступен','error');}
    }finally{clearTimeout(timer);if(mine===generation){root.setAttribute('aria-busy','false');q('[data-r1488-refresh]').disabled=false;}}
  }
  async function loadSiteCities(){
    const mine=++cityGeneration;cityController?.abort();cityController=new AbortController();const current=cityController,timer=setTimeout(()=>current.abort(),15000);
    g('[data-r1488-site-cities]').innerHTML='<div class="r1488-empty">Получаю переходы с сайта…</div>';
    try{
      const data=await api('/api/control/radio-city-clicks-r1488?minutes='+cityWindow,current.signal);if(mine!==cityGeneration)return;
      lastCityLoad=Date.now();
      g('[data-r1488-site-cities]').innerHTML=data.cities.length?`<div class="r1488-table-wrap"><table class="r1488-table"><thead><tr><th>Город / страна</th><th>Посетители</th><th>Переходы</th></tr></thead><tbody>${data.cities.map(row=>`<tr><td>${escape(cityName(row.city))}<small>${escape(countryName(row.country))} · последний ${escape(timeLabel(row.lastClickAt))}</small></td><td>${number(row.visitors)}</td><td>${number(row.opens)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="r1488-empty">Переходов в текущий эфир с сайта за этот период нет.</div>';
      text(g('[data-r1488-site-stamp]'),`${cityWindow===60?'Последние 60 минут':'Последние 24 часа'} · обновлено ${timeLabel(data.endsAt)} · это клики с сайта, не онлайн YouTube`);
    }catch(error){if(mine===cityGeneration)g('[data-r1488-site-cities]').innerHTML='<div class="r1488-empty">'+escape(error.name==='AbortError'?'Запрос городов с сайта не ответил вовремя.':error.message)+'</div>';}
    finally{clearTimeout(timer);}
  }
  function renderOnline(){
    const age=Date.now()-Date.parse(lastOnlineAt||''),fresh=onlineKnown&&age>=-10000&&age<=3*60000;
    text(g('[data-r1488-online]'),fresh&&lastOnline!=null?number(lastOnline):'—');
    text(g('[data-r1488-online-at]'),fresh?(lastOnline==null?'YouTube не передал онлайн · ':'Замер ')+timeLabel(lastOnlineAt):'Жду свежий замер YouTube');
  }
  function receiveOnline(data){
    if(data?.videoId!==VIDEO)return;lastOnline=data.concurrentViewers??null;lastOnlineAt=data.updatedAt||'';onlineKnown=true;renderOnline();
  }
  function showModal(){
    if(!modal){modal=document.createElement('dialog');modal.className='r1488-dialog';modal.setAttribute('aria-label','Увеличенный график времени просмотра');modal.innerHTML='<div class="r1488-head"><h2>Время просмотра по дням</h2><button type="button" data-r1488-close>✕ Закрыть</button></div><div class="r1488-toolbar"><button type="button" data-r1488-metric="duration">Среднее время</button><button type="button" data-r1488-metric="hours">Часы просмотра</button></div><div class="r1488-chart" data-r1488-modal-chart></div><p class="r1488-chart-readout" data-r1488-readout aria-live="polite">Нажми на точку: дата → время просмотра.</p><p class="r1488-note">Дни YouTube · Лос-Анджелес. Пропущенные дни не считаются нулём.</p>';document.body.appendChild(modal);
      modal.addEventListener('click',event=>{if(event.target.closest('[data-r1488-close]'))modal.close();const button=event.target.closest('[data-r1488-metric]');if(button){metric=button.dataset.r1488Metric;redraw();}});
      modal.addEventListener('pointerdown',handleChartPointer);modal.addEventListener('keydown',handleChartKey);
    }
    modal.showModal();redraw();
  }
  root.addEventListener('click',event=>{
    const preset=event.target.closest('[data-r1488-days]');if(preset){selectedPreset=Number(preset.dataset.r1488Days);endInput.value=today();startInput.value=shiftDay(endInput.value,1-selectedPreset);root.querySelectorAll('[data-r1488-days]').forEach(button=>button.setAttribute('aria-pressed',String(button===preset)));load();}
    if(event.target.closest('[data-r1488-refresh]'))load(true);
    const button=event.target.closest('[data-r1488-metric]');if(button){metric=button.dataset.r1488Metric;selectedIndex=-1;selectedDay='';redraw();}
    if(event.target.closest('[data-r1488-expand]'))showModal();
  });
  root.addEventListener('pointerdown',handleChartPointer);root.addEventListener('keydown',handleChartKey);
  q('[data-r1488-dates]').addEventListener('submit',event=>{event.preventDefault();selectedPreset=0;root.querySelectorAll('[data-r1488-days]').forEach(button=>button.setAttribute('aria-pressed','false'));load();});
  geo.addEventListener('click',event=>{const button=event.target.closest('[data-r1488-site-window]');if(button){cityWindow=Number(button.dataset.r1488SiteWindow);geo.querySelectorAll('[data-r1488-site-window]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));loadSiteCities();}});
  const siteDetails=g('.r1488-site-cities');siteDetails.addEventListener('toggle',()=>{if(siteDetails.open&&Date.now()-lastCityLoad>60000)loadSiteCities();});
  window.addEventListener('andrik:radio-metrics-r1488',event=>receiveOnline(event.detail));receiveOnline(window.AndrikRadioMetricsR1488);
  let reportTimer,onlineTimer,siteTimer;
  function armTimers(){clearInterval(reportTimer);clearInterval(onlineTimer);clearInterval(siteTimer);reportTimer=setInterval(()=>{if(!document.hidden)load();},15*60000);onlineTimer=setInterval(renderOnline,30000);siteTimer=setInterval(()=>{if(!document.hidden&&siteDetails.open)loadSiteCities();},2*60000);}
  armTimers();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderOnline();if(report&&Date.now()-Date.parse(report.fetchedAt||'')>15*60000)load();if(siteDetails.open&&Date.now()-lastCityLoad>2*60000)loadSiteCities();}});
  window.addEventListener('pagehide',()=>{controller?.abort();cityController?.abort();clearInterval(reportTimer);clearInterval(onlineTimer);clearInterval(siteTimer);});
  window.addEventListener('pageshow',event=>{if(event.persisted){armTimers();renderOnline();load();}});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(redraw,100);});
  window.AndrikRadioRetentionR1488={load,get data(){return report;},get metric(){return metric;}};
  load();
})();
