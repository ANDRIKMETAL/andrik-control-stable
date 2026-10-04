(()=>{
'use strict';
if(window.__ANDRIK_RADIO_AUDIENCE_R1235__)return;
window.__ANDRIK_RADIO_AUDIENCE_R1235__=true;
const root=document.getElementById('radioAudienceR1156');if(!root)return;
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Math.max(0,Number(n)||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent';
const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
const headers=()=>{const h={accept:'application/json'};const k=getKey();if(k){h['x-admin-key']=k;h.authorization=`Bearer ${k}`}return h};
const dateInput=$('radioAudienceDateR1156'),prevBtn=$('radioAudiencePrevR1156'),nextBtn=$('radioAudienceNextR1156'),todayBtn=$('radioAudienceTodayR1156');
const status=$('radioAudienceStateR1156'),viewersChart=$('radioAudienceViewersChartR1235'),launchesChart=$('radioAudienceLaunchesChartR1235'),events=$('radioAudienceEventsR1156'),siteEvents=$('radioAudienceSiteEventsR1156');
let currentData=null,serverToday='';
function dateBratislava(d=new Date()){const parts={};for(const p of new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d))if(p.type!=='literal')parts[p.type]=p.value;return `${parts.year}-${parts.month}-${parts.day}`}
function shiftDate(text,days){const m=String(text||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return dateBratislava();const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+days,12));return d.toISOString().slice(0,10)}
function localTime(raw){if(!raw)return'—';let s=String(raw);if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s))s=s.replace(' ','T')+'Z';const d=new Date(s);if(!Number.isFinite(d.getTime()))return'—';return d.toLocaleTimeString('ru-RU',{timeZone:'Europe/Bratislava',hour:'2-digit',minute:'2-digit'})}
function dateLabel(text){const m=String(text||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:text}
function setState(text,kind=''){if(!status)return;status.textContent=text;status.dataset.kind=kind}
function setText(id,value){const el=$(id);if(el)el.textContent=value}
function effectiveToday(){return serverToday||dateBratislava()}
function updateDateButtons(){const today=effectiveToday();if(nextBtn)nextBtn.disabled=!dateInput?.value||dateInput.value>=today;if(todayBtn)todayBtn.disabled=dateInput?.value===today}
function minuteOf(r,i,total){const m=String(r.minute||'').match(/^(\d{2}):(\d{2})$/);return m?Math.max(0,Math.min(1439,+m[1]*60 + +m[2])):Math.round(i*1440/Math.max(1,total-1))}
function pointsFrom(series=[]){return series.map((r,i)=>({...r,minuteOfDay:minuteOf(r,i,series.length),launches:Math.max(0,Number(r.launches)||0),online:r.concurrentViewers==null?null:Math.max(0,Number(r.concurrentViewers)||0)}))}
function timeLabel(minute){const m=Math.max(0,Math.min(1440,Math.round(minute)));const h=Math.floor(m/60)%24,mm=m%60;return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}
function spanFor(points){
const mins=points.map(p=>p.minuteOfDay).filter(Number.isFinite);if(!mins.length)return {start:0,end:120};
const max=Math.max(...mins);let end;
if(max<=120)end=Math.max(120,Math.ceil((max+10)/30)*30);
else if(max<=360)end=Math.ceil((max+20)/60)*60;
else if(max<=720)end=Math.ceil((max+30)/120)*120;
else end=Math.min(1440,Math.ceil((max+60)/240)*240);
return {start:0,end:Math.max(120,Math.min(1440,end))};
}
function xTicksFor(end){let step=end<=180?30:end<=360?60:end<=720?120:240;const arr=[];for(let v=0;v<=end;v+=step)arr.push(v);if(arr[arr.length-1]!==end)arr.push(end);return arr}
function yTicks(maxVal,target=4){const ceiling=Math.max(1,Math.ceil(maxVal));let step=Math.max(1,Math.ceil(ceiling/target));const nice=[1,2,5,10,20,50,100];step=nice.find(n=>n>=step)||step;const top=Math.max(step,Math.ceil(ceiling/step)*step);const ticks=[];for(let v=0;v<=top;v+=step)ticks.push(v);return {top,ticks}}
function buildViewerSvg(series=[]){
const pts=pointsFrom(series).filter(p=>p.online!=null);if(!pts.length)return '<div class="r1156-chart-empty">Пока нет замеров зрителей.</div>';
const W=720,H=330,L=58,R=18,T=18,B=48,plotW=W-L-R,plotH=H-T-B;const span=spanFor(pts);const xt=xTicksFor(span.end);
const maxOnline=Math.max(0,...pts.map(p=>p.online));const ys=yTicks(Math.max(2,maxOnline),4);const x=m=>L+((m-span.start)/(span.end-span.start))*plotW;const y=v=>T+plotH-(v/ys.top)*plotH;
const vgrid=xt.map((m,i)=>`<line class="grid" x1="${x(m).toFixed(1)}" y1="${T}" x2="${x(m).toFixed(1)}" y2="${T+plotH}"/><text class="axis-text" x="${x(m).toFixed(1)}" y="${H-13}" text-anchor="${i===0?'start':i===xt.length-1?'end':'middle'}">${timeLabel(m)}</text>`).join('');
const hgrid=ys.ticks.map(v=>`<line class="grid" x1="${L}" y1="${y(v).toFixed(1)}" x2="${W-R}" y2="${y(v).toFixed(1)}"/><text class="axis-text axis-y" x="${L-8}" y="${(y(v)+5).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');
const line=pts.map((p,i)=>`${i?'L':'M'} ${x(p.minuteOfDay).toFixed(1)} ${y(p.online).toFixed(1)}`).join(' ');const first=pts[0],last=pts[pts.length-1];
const area=`${line} L ${x(last.minuteOfDay).toFixed(1)} ${T+plotH} L ${x(first.minuteOfDay).toFixed(1)} ${T+plotH} Z`;
const dots=pts.map((p,i)=>{const current=i===pts.length-1;return `<circle class="viewer-point${current?' current':''}" cx="${x(p.minuteOfDay).toFixed(1)}" cy="${y(p.online).toFixed(1)}" r="${current?6.5:3.1}"><title>${esc(p.minute||'—')} · ${fmt(p.online)} зр.</title></circle>`}).join('');
const lx=Math.min(W-R-26,Math.max(L+18,x(last.minuteOfDay)+12)),ly=Math.max(T+20,y(last.online)-12);
return `<svg class="r1235-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Зрители по времени"><defs><linearGradient id="r1235ViewerArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff526e" stop-opacity=".26"/><stop offset="100%" stop-color="#ff526e" stop-opacity=".015"/></linearGradient></defs>${vgrid}${hgrid}<line class="axis-line" x1="${L}" y1="${T}" x2="${L}" y2="${T+plotH}"/><line class="axis-line" x1="${L}" y1="${T+plotH}" x2="${W-R}" y2="${T+plotH}"/><path class="viewer-area" d="${area}"/><path class="viewer-line" d="${line}"/>${dots}<text class="viewer-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${fmt(last.online)}</text></svg>`;
}
function launchBucketMinutes(end){return end<=240?10:end<=480?20:end<=720?30:60}
function buildLaunchSvg(series=[]){
const pts=pointsFrom(series);if(!pts.length)return '<div class="r1156-chart-empty">Пока нет данных о новых запусках.</div>';
const span=spanFor(pts),bucketMin=launchBucketMinutes(span.end),bucketCount=Math.ceil(span.end/bucketMin),buckets=Array.from({length:bucketCount},(_,i)=>({start:i*bucketMin,value:0}));
for(const p of pts){const i=Math.min(bucketCount-1,Math.max(0,Math.floor(p.minuteOfDay/bucketMin)));buckets[i].value+=p.launches}
const W=720,H=330,L=58,R=18,T=18,B=48,plotW=W-L-R,plotH=H-T-B,xt=xTicksFor(span.end);const maxLaunch=Math.max(0,...buckets.map(b=>b.value));const ys=yTicks(Math.max(4,maxLaunch),4);
const x=m=>L+(m/span.end)*plotW,y=v=>T+plotH-(v/ys.top)*plotH;
const vgrid=xt.map((m,i)=>`<line class="grid" x1="${x(m).toFixed(1)}" y1="${T}" x2="${x(m).toFixed(1)}" y2="${T+plotH}"/><text class="axis-text" x="${x(m).toFixed(1)}" y="${H-13}" text-anchor="${i===0?'start':i===xt.length-1?'end':'middle'}">${timeLabel(m)}</text>`).join('');
const hgrid=ys.ticks.map(v=>`<line class="grid" x1="${L}" y1="${y(v).toFixed(1)}" x2="${W-R}" y2="${y(v).toFixed(1)}"/><text class="axis-text axis-y" x="${L-8}" y="${(y(v)+5).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');
const slot=plotW/bucketCount,barW=Math.max(5,Math.min(28,slot*.68));const nonzero=buckets.filter(b=>b.value>0).length;let labelsShown=0;
const bars=buckets.map((b,i)=>{if(b.value<=0)return'';const cx=x(b.start+bucketMin/2),yy=y(b.value),hh=T+plotH-yy,tone=i%2?'orange':'gold';const showLabel=nonzero<=28||b.value===maxLaunch||labelsShown<2;if(showLabel)labelsShown++;return `<rect class="launch-bar ${tone}" x="${(cx-barW/2).toFixed(1)}" y="${yy.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(3,hh).toFixed(1)}"><title>${timeLabel(b.start)}–${timeLabel(Math.min(span.end,b.start+bucketMin))} · +${fmt(b.value)}</title></rect>${showLabel?`<text class="launch-value ${tone}" x="${cx.toFixed(1)}" y="${Math.max(T+14,yy-7).toFixed(1)}" text-anchor="middle">+${fmt(b.value)}</text>`:''}`}).join('');
return `<svg class="r1235-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Новые запуски по времени"><defs><linearGradient id="r1235LaunchGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe58b"/><stop offset="55%" stop-color="#f6c84b"/><stop offset="100%" stop-color="#b47d0a"/></linearGradient><linearGradient id="r1235LaunchOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd29a"/><stop offset="55%" stop-color="#f39a31"/><stop offset="100%" stop-color="#a75208"/></linearGradient></defs>${vgrid}${hgrid}<line class="axis-line" x1="${L}" y1="${T}" x2="${L}" y2="${T+plotH}"/><line class="axis-line" x1="${L}" y1="${T+plotH}" x2="${W-R}" y2="${T+plotH}"/>${bars}</svg>`;
}
function launchBucketStats(series=[]){const pts=pointsFrom(series);if(!pts.length)return {bucketMin:10,total:0,peak:0};const span=spanFor(pts),bucketMin=launchBucketMinutes(span.end),n=Math.ceil(span.end/bucketMin),a=Array(n).fill(0);for(const p of pts)a[Math.min(n-1,Math.floor(p.minuteOfDay/bucketMin))]+=p.launches;return {bucketMin,total:a.reduce((x,y)=>x+y,0),peak:Math.max(0,...a)}}
function renderArrivalList(series=[]){const rows=series.filter(r=>Number(r.launches)>0).slice().reverse();if(!rows.length)return '<div class="r1156-event-empty">За выбранный день новые запуски пока не зафиксированы.</div>';return rows.slice(0,120).map(r=>`<article class="r1156-event"><time>${esc(r.minute||'—')}</time><div><strong>YouTube · новые запуски</strong><small>замер ≈ 2 минуты · онлайн ${r.concurrentViewers==null?'—':fmt(r.concurrentViewers)}</small></div><b>+${fmt(r.launches)}</b></article>`).join('')}
function renderSiteList(rows=[]){if(!rows.length)return '<div class="r1156-event-empty">Переходов в LIVE через andrikmetal.com за этот день пока нет.</div>';return rows.slice().reverse().slice(0,120).map(r=>{const place=[r.city,r.country].filter(Boolean).join(' · ')||'гео не определено';return `<article class="r1156-event is-site"><time>${esc(localTime(r.createdAt))}</time><div><strong>Переход в LIVE через сайт</strong><small>${esc(place)}</small></div><b>+1</b></article>`}).join('')}
function render(data){
currentData=data;if(data?.today)serverToday=String(data.today);if(dateInput){if(serverToday)dateInput.max=serverToday;if(data?.date)dateInput.value=String(data.date)}
const s=data.summary||{},series=Array.isArray(data.series)?data.series:[],online=series.filter(r=>r.concurrentViewers!=null).map(r=>Math.max(0,Number(r.concurrentViewers)||0));const current=online.length?online[online.length-1]:Math.max(0,Number(s.currentConcurrent)||0),peak=online.length?Math.max(0,...online):Math.max(0,Number(s.peakConcurrent)||0),avg=online.length?online.reduce((a,b)=>a+b,0)/online.length:0;const lb=launchBucketStats(series);
setText('radioAudienceLaunchesR1156',fmt(s.launches??lb.total));setText('radioAudiencePeakR1156',fmt(s.peakConcurrent??peak));setText('radioAudienceCurrentR1156',fmt(s.currentConcurrent??current));setText('radioAudienceSiteR1156',fmt(s.siteVisitors));setText('radioAudienceDayLabelR1156',dateLabel(data.date));
setText('r1235ViewerCurrent',fmt(current));setText('r1235ViewerPeak',fmt(peak));setText('r1235ViewerAverage',avg.toFixed(avg<10?1:0).replace('.',','));setText('r1235LaunchTotal',fmt(lb.total));setText('r1235LaunchPeak',`+${fmt(lb.peak)}`);setText('r1235LaunchBucketLabel',`Интервал ${lb.bucketMin} мин`);
if(viewersChart)viewersChart.innerHTML=buildViewerSvg(series);if(launchesChart)launchesChart.innerHTML=buildLaunchSvg(series);if(events)events.innerHTML=renderArrivalList(series);if(siteEvents)siteEvents.innerHTML=renderSiteList(data.exactOpens||[]);
const collected=$('radioAudienceCollectionR1156');if(collected){if(data.samples){const first=series?.[0]?.minute||'—',last=series?.[series.length-1]?.minute||'—';collected.textContent=`${data.samples} замеров · ${first}–${last} · Europe/Bratislava`;}else if(data?.collector?.warning)collected.textContent=`Свежий LIVE-замер не получен · ${data.collector.warning}`;else collected.textContent='Жду первый LIVE-замер.'}
setState(data.date===data.today?'Сегодня':'Архив','ok');updateDateButtons();
}
async function load(explicitDate){const date=explicitDate===undefined?(dateInput?.value||''):String(explicitDate||'');setState('Загрузка…','loading');try{const qs=new URLSearchParams();if(date)qs.set('date',date);qs.set('ts',String(Date.now()));const res=await fetch(`/api/control/radio-audience-r1157?${qs.toString()}`,{credentials:'include',cache:'no-store',headers:headers()});const data=await res.json().catch(()=>({}));if(!res.ok||data?.ok===false)throw new Error(data?.error||`HTTP ${res.status}`);render(data)}catch(error){setState('Ошибка','error');const msg=`<div class="r1156-chart-empty">Не удалось получить статистику: ${esc(error?.message||error)}</div>`;if(viewersChart)viewersChart.innerHTML=msg;if(launchesChart)launchesChart.innerHTML=msg}}
function setDate(value){if(!dateInput)return;const today=effectiveToday();dateInput.value=value>today?today:value;updateDateButtons();load(dateInput.value)}
if(dateInput){dateInput.value='';dateInput.addEventListener('change',()=>{const today=effectiveToday();if(dateInput.value>today)dateInput.value=today;updateDateButtons();load(dateInput.value)})}
prevBtn?.addEventListener('click',()=>setDate(shiftDate(dateInput?.value||effectiveToday(),-1)));nextBtn?.addEventListener('click',()=>setDate(shiftDate(dateInput?.value||effectiveToday(),1)));todayBtn?.addEventListener('click',()=>setDate(effectiveToday()));updateDateButtons();load('');
setInterval(()=>{if(!document.hidden&&dateInput?.value===effectiveToday())load(dateInput.value)},120000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dateInput?.value===effectiveToday())load(dateInput.value)});
window.AndrikRadioAudienceR1235={refresh:()=>load(dateInput?.value||''),get data(){return currentData}};
})();
