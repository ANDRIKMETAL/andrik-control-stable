(()=>{
'use strict';
const root=document.getElementById('youtubeRadioR565');
if(!root)return;
const libraryUrl='/api/music/downloads';
const disabledAlbums=['albums/illusion-of-life/','albums/ocean/'];
const KEY_SESSION='andrik-comments-admin-key';
const KEY_LOCAL='andrik-comments-admin-key-persistent';
const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
const $=id=>document.getElementById(id);
const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
const safe=v=>String(v??'').trim();
const number=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));
let liveStartedAt='';
function uptimeLabel(value){const start=Date.parse(value||'');if(!Number.isFinite(start))return '—';const sec=Math.max(0,Math.floor((Date.now()-start)/1000));const d=Math.floor(sec/86400),h=Math.floor((sec%86400)/3600),m=Math.floor((sec%3600)/60);if(d>0)return `${d} д ${h} ч ${m} мин`;if(h>0)return `${h} ч ${m} мин`;return `${m} мин`;}
function refreshUptime(){text('youtubeRadioUptimeR565',liveStartedAt?uptimeLabel(liveStartedAt):'—')}
function setLive(live,label){const pill=$('youtubeRadioLiveR565');if(!pill)return;pill.classList.toggle('is-live',Boolean(live));const span=pill.querySelector('span');if(span)span.textContent=label||(live?'ЭФИР ИДЁТ':'ОЖИДАЕТ СИГНАЛ')}
function healthLabel(data){const health=safe(data?.healthStatus).toLowerCase();const stream=safe(data?.streamStatus).toLowerCase();const life=safe(data?.lifeCycleStatus).toLowerCase();const issues=Array.isArray(data?.healthIssues)?data.healthIssues:[];if(['good','ok','live','excellent'].includes(health))return'ОТЛИЧНО';if(['bad','error','poor','critical','failed'].includes(health))return'ПЛОХО';if(life==='live'&&stream==='active'&&!issues.length)return'ОТЛИЧНО';if(issues.length)return'ПЛОХО';if(stream==='active')return'ОТЛИЧНО';if(life==='live')return'ОТЛИЧНО';return'ЖДЁТ СИГНАЛ'}
async function loadLibrary(){
text('youtubeRadioModeR565','MP3 + КЛИП');text('youtubeRadioCycleR565','AUTO');refreshUptime();
}
function updateLinks(data){const opener=$('radioOpenLiveR943');const validId=/^[A-Za-z0-9_-]{11}$/.test(safe(data?.videoId))&&data?.active===true?safe(data.videoId):'';const watch=validId?`https://www.youtube.com/live/${validId}`:'';if(opener){if(watch){opener.href=watch;opener.setAttribute('data-web-url',watch);opener.setAttribute('data-youtube-live-id',validId);}opener.setAttribute('data-force-app','youtube');opener.setAttribute('data-youtube-live-auto','1');opener.setAttribute('data-web-fallback','https://www.youtube.com/live/eN3ljx6_6dA');}const map=[['youtubeRadioStudioR576','studioUrl'],['youtubeRadioAnalyticsR576','analyticsUrl'],['youtubeRadioWatchR576','watchUrl']];for(const [id,key] of map){const el=$(id);if(el&&data?.[key]){el.href=data[key];if(id==='youtubeRadioWatchR576')el.setAttribute('data-web-url',data[key])}}}
function renderYoutube(data){
const life=safe(data?.lifeCycleStatus).toLowerCase();
const stream=safe(data?.streamStatus).toLowerCase();
const live=Boolean(data?.active)||life==='live';
const signal=Boolean(data?.signalActive)||stream==='active';
liveStartedAt=live?safe(data?.actualStartTime):'';
refreshUptime();
setLive(live,live?'ЭФИР ИДЁТ':signal?'СИГНАЛ ЕСТЬ — НАЖМИ СТАРТ':'ОЖИДАЕТ СИГНАЛ');
text('youtubeRadioViewersR565',data?.concurrentViewers==null?'—':number(data.concurrentViewers));
// The day's observed delta is loaded independently. Raw API viewCount is NOT daily activity.
text('youtubeRadioStartsR947','—');
const visibleCandidates=[data?.visibleViews,data?.displayViews,data?.studioViews,data?.engagedViews]
.map(v=>v==null?null:Number(v))
.filter(v=>Number.isFinite(v)&&v>0);
let visible=visibleCandidates.length?visibleCandidates[0]:null;
const visibleKey=`andrik-radio-visible-views-r948:${safe(data?.videoId)||'live'}`;
try{
const old=Number(localStorage.getItem(visibleKey)||0);
const starts=Number(data?.views);
if(visible!=null&&Number.isFinite(visible)&&visible>0){
const keep=Math.max(visible,Number.isFinite(old)?old:0);
if(!Number.isFinite(starts)||starts<=0||keep<=starts){visible=keep;localStorage.setItem(visibleKey,String(keep));}
}else if(Number.isFinite(old)&&old>0&&(!Number.isFinite(starts)||starts<=0||old<=starts))visible=old;
}catch(_){}
text('youtubeRadioViewsR565',visible==null?'—':number(visible));
const viewsCard=$('youtubeRadioViewsCardR947');
if(viewsCard){
const bits=['Публичный счётчик YouTube / YouTube Studio текущего LIVE (не число зрителей онлайн)'];
if(data?.visibleViewsSource)bits.push(data.visibleViewsSource);
else if(data?.studioViewsSource)bits.push(data.studioViewsSource);
if(data?.visibleViewsUpdatedAt)bits.push('обновлено '+new Date(data.visibleViewsUpdatedAt).toLocaleString('ru-RU'));
if(data?.visibleViewsText)bits.push('YouTube: '+safe(data.visibleViewsText));
if(data?.visibleViewsError)bits.push('fallback: '+safe(data.visibleViewsError));
else if(data?.studioViewsUpdatedAt)bits.push('обновлено '+new Date(data.studioViewsUpdatedAt).toLocaleString('ru-RU'));
viewsCard.title=bits.join(' · ');
}
const startsCard=$('youtubeRadioStartsCardR947');
if(startsCard)startsCard.title='Изменение YouTube Data API viewCount между замерами за текущий день. Первый замер задаёт базу; это не одновременные зрители и не общий счётчик.';
text('youtubeRadioLikesR565',data?.likes==null?'—':number(data.likes));
text('youtubeRadioHealthR565',live?healthLabel(data):signal?'СИГНАЛ ЕСТЬ':healthLabel(data));
text('youtubeRadioNowTitleR565',(live||signal)?(safe(data?.title)||'ANDRIK METAL RADIO 24/7'):'Радио готово к запуску');
text('youtubeRadioNowMetaR565',live?'R2 MP3 → OVH VPS → FFmpeg → YouTube Live':signal?'OVH уже передаёт видео и звук. Открой Studio и нажми «Начать трансляцию».':'Ищем текущую трансляцию YouTube');
text('youtubeRadioNextR565','В эфире: активные MP3 · OCEAN и Illusion of Life выключены');
updateLinks(data);
const note=$('youtubeRadioNoteR565');
if(note){
const parts=[safe(data?.lifeCycleStatus),safe(data?.streamStatus),safe(data?.privacyStatus)].filter(Boolean);
const issues=Array.isArray(data?.healthIssues)?data.healthIssues:[];
note.textContent=issues.length?`YouTube: ${parts.join(' • ')} · ${issues.slice(0,2).map(x=>[safe(x?.type),safe(x?.reason),safe(x?.description)].filter(Boolean).join(' — ')).join(' · ')||'есть предупреждение'}`:`R1045 · ${live?'LIVE':signal?'СИГНАЛ ПРИНЯТ, ЭФИР ЕЩЁ НЕ НАЧАТ':'ЖДЁТ СИГНАЛ'} · YouTube: ${parts.join(' • ')||'—'} · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
}
}
async function loadAudienceFallbackR1264(){
try{
const k=getKey();const r=await fetch(`/api/control/radio-audience-r1157?ts=${Date.now()}`,{credentials:'include',cache:'no-store',headers:{accept:'application/json',...(k?{'x-admin-key':k,'authorization':`Bearer ${k}`}:{})}});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.ok)return false;const q=d.summary||{};
if(q.currentConcurrent!=null)text('youtubeRadioViewersR565',number(q.currentConcurrent));
// Daily totals come only from the audience collector, never from lifetime API viewCount.
if(q.launches!=null)text('youtubeRadioStartsR947',number(q.launches));
// Do NOT overwrite YouTube's visible view count with the collector's API counter.
const viewsEl=$('youtubeRadioViewsR565');
if(viewsEl&&viewsEl.textContent.trim()==='—'&&q.lastCumulativeViews!=null&&Number(q.lastCumulativeViews)>=0)text('youtubeRadioViewsR565',number(q.lastCumulativeViews));
const a=$('youtubeRadioStartsCardR947');if(a)a.title='Fallback: локальная статистика эфира из двухминутных YouTube-сэмплов';
const v=$('youtubeRadioViewsCardR947');if(v&&v.textContent.trim()==='—')v.title='Резерв: последнее сохранённое значение API viewCount; публичный счётчик YouTube может отличаться';
return true;
}catch(_){return false}
}
async function loadTransportFallbackR1264(reason=''){
try{
const k=getKey();const r=await fetch(`/api/control/radio-remote-r627/status?ts=${Date.now()}`,{credentials:'include',cache:'no-store',headers:{accept:'application/json',...(k?{'x-admin-key':k,'authorization':`Bearer ${k}`}:{})}});const d=await r.json().catch(()=>({}));if(!r.ok)return false;const s=d?.agent?.status||{};const service=['active','running'].includes(safe(s.service).toLowerCase());const publisher=Boolean(s.publisher);const video=Boolean(s.videoFeederRunning);const transport=s.transportHealthy!==false;const expected=Math.max(1,Number(s.rtmpsExpectedConnectionsR792||2)||2);const lanes=Math.max(0,Number(s.rtmpsEstablishedConnectionsR792||0));const online=Boolean(d?.online)||service;const good=online&&service&&publisher&&video&&transport&&lanes>=expected;
text('youtubeRadioHealthR565',good?'СИГНАЛ OK':'СИГНАЛ ПЛОХО');
const h=$('youtubeRadioHealthR565');if(h)h.title=`OVH master: service=${service?'OK':'OFF'} · publisher=${publisher?'OK':'OFF'} · video=${video?'OK':'OFF'} · transport=${transport?'OK':'BAD'} · RTMPS ${lanes}/${expected}${reason?' · YouTube API: '+safe(reason):''}`;
return true;
}catch(_){return false}
}
async function loadYoutube(){
try{
const k=getKey();const res=await fetch(`/api/control/youtube-live-r565?active=1&fresh=1&ts=${Date.now()}`,{credentials:'include',headers:{accept:'application/json',...(k?{'x-admin-key':k,'authorization':`Bearer ${k}`}:{})},cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'HTTP '+res.status);renderYoutube(data);await loadAudienceFallbackR1264();return;
}catch(error){
let publicRendered=false;
try{const r=await fetch(`/api/public/youtube-live-target?ts=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json'}});const d=await r.json().catch(()=>({}));if(r.ok&&d?.active){renderYoutube({...d,signalActive:Boolean(d?.signalActive||d?.active),healthStatus:d?.healthStatus||'LIVE'});publicRendered=true}}catch(_){}
const [audience,transport]=await Promise.all([loadAudienceFallbackR1264(),loadTransportFallbackR1264(error?.message||'')]);
if(!transport){text('youtubeRadioHealthR565',publicRendered?'ОТЛИЧНО':'ПЛОХО');const h=$('youtubeRadioHealthR565');if(h)h.title=publicRendered?'Public LIVE доступен; Control YouTube API временно недоступен':safe(error?.message)||'YouTube API недоступен'}
if(!publicRendered)text('youtubeRadioNowMetaR565',safe(error?.message)||'YouTube Data API временно недоступен; показаны локальные данные OVH/аудитории');
}
}
let youtubeTimer=null,libraryTimer=null;
function armNetworkTimers(){
if(youtubeTimer)clearInterval(youtubeTimer);if(libraryTimer)clearInterval(libraryTimer);
youtubeTimer=libraryTimer=null;
if(document.hidden)return;
youtubeTimer=setInterval(()=>{if(!document.hidden)loadYoutube()},30000);
libraryTimer=setInterval(()=>{if(!document.hidden)loadLibrary()},300000);
}
loadLibrary();loadYoutube();setTimeout(()=>{if(!document.hidden)loadYoutube()},2500);armNetworkTimers();
document.addEventListener('visibilitychange',()=>{
if(document.hidden){if(youtubeTimer)clearInterval(youtubeTimer);if(libraryTimer)clearInterval(libraryTimer);youtubeTimer=libraryTimer=null;return;}
loadLibrary();loadYoutube();armNetworkTimers();
});
setInterval(refreshUptime,30000);
})();
