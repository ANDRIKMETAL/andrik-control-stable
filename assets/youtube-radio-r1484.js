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
const LIVE_ID_R1483='U0bzXBNBs2Y';
const number=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));
function explainRadioStatsR1484(value){
 const raw=safe(value);
 if(/^unauthorized$|HTTP 401/i.test(raw))return 'Нужен вход владельца в контрольку.';
 if(/quota|dailyLimit/i.test(raw))return 'Исчерпана квота YouTube API.';
 if(/invalid_grant|expired|revoked|oauth-not-connected|oauth-client-not-configured/i.test(raw))return 'Нужно проверить подключение YouTube для статистики.';
 if(/API.key.not.valid|API_KEY_INVALID|keyInvalid/i.test(raw))return 'YouTube отклонил API-ключ.';
 if(/sample-not-saved|sample-not-written|D1|database|binding/i.test(raw))return 'Не удалось сохранить замер статистики.';
 if(/concurrentViewers-missing/i.test(raw))return 'YouTube API не вернул число зрителей онлайн.';
 if(/viewCount-missing/i.test(raw))return 'YouTube API не вернул счётчик просмотров.';
 if(/video-not-returned/i.test(raw))return 'YouTube не вернул данные выбранного эфира.';
 return raw||'Нет ответа от YouTube API.';
}
function statsDiagnosticR1484(kind,message,details=''){
 let box=$('radioStatsDiagnosticR1484');
 if(!box){
  box=document.createElement('div');box.id='radioStatsDiagnosticR1484';box.setAttribute('role','status');
  Object.assign(box.style,{marginTop:'10px',padding:'10px',border:'1px solid #3c4b61',borderRadius:'12px',fontSize:'12px',lineHeight:'1.45',wordBreak:'break-word',background:'#090e16'});
  root.appendChild(box);
 }
 box.dataset.kind=kind;box.style.color=kind==='ok'?'#a3e5bf':kind==='warn'?'#ffd786':'#ff9cae';
 const title=document.createElement('div');title.textContent=message;box.replaceChildren(title);
 if(details){
  const fold=document.createElement('details'),summary=document.createElement('summary'),reason=document.createElement('div');
  summary.textContent='Причина / источник';reason.textContent=details;reason.style.marginTop='6px';fold.append(summary,reason);box.appendChild(fold);
 }
 if(kind!=='ok'&&/oauth|invalid_grant|token|expired|revoked/i.test(details)){
  const link=document.createElement('a');link.href='/youtube-device-auth-admin.html';link.textContent='Проверить подключение YouTube';link.style.color='#b8dfff';box.appendChild(link);
 }
}
let lastAudienceDataR1484=null,currentViewsR1484=null,freshMetricsR1484=false;

let liveStartedAt='',currentLiveIdR1446='',hasVisibleViewsR1446=false,currentOnlineR1446=null;
function uptimeLabel(value){const start=Date.parse(value||'');if(!Number.isFinite(start))return '—';const sec=Math.max(0,Math.floor((Date.now()-start)/1000));const d=Math.floor(sec/86400),h=Math.floor((sec%86400)/3600),m=Math.floor((sec%3600)/60);if(d>0)return `${d} д ${h} ч ${m} мин`;if(h>0)return `${h} ч ${m} мин`;return `${m} мин`;}
function refreshUptime(){text('youtubeRadioUptimeR565',liveStartedAt?uptimeLabel(liveStartedAt):'—')}
function setLive(live,label){const pill=$('youtubeRadioLiveR565');if(!pill)return;pill.classList.toggle('is-live',Boolean(live));const span=pill.querySelector('span');if(span)span.textContent=label||(live?'ЭФИР ИДЁТ':'ОЖИДАЕТ СИГНАЛ')}
function healthLabel(data){const health=safe(data?.healthStatus).toLowerCase();const stream=safe(data?.streamStatus).toLowerCase();const life=safe(data?.lifeCycleStatus).toLowerCase();const issues=Array.isArray(data?.healthIssues)?data.healthIssues:[];if(['bad','error','poor','critical','failed'].includes(health)||issues.length)return'ПЛОХО';if(['good','ok','excellent'].includes(health))return'ОТЛИЧНО';if(stream==='active')return'СИГНАЛ ОК';if(life==='live'||data?.active)return'ЭФИР ИДЁТ';return'ЖДЁТ СИГНАЛ'}
async function loadLibrary(){
text('youtubeRadioModeR565','MP3 + КЛИП');text('youtubeRadioCycleR565','AUTO');refreshUptime();
}
function updateLinks(data){const opener=$('radioOpenLiveR943');const validId=/^[A-Za-z0-9_-]{11}$/.test(safe(data?.videoId))&&data?.active===true?safe(data.videoId):'';const watch=validId?`https://www.youtube.com/live/${validId}`:'';if(opener){if(watch){opener.href=watch;opener.setAttribute('data-web-url',watch);opener.setAttribute('data-youtube-live-id',validId);}opener.setAttribute('data-force-app','youtube');opener.setAttribute('data-youtube-live-auto','1');opener.setAttribute('data-web-fallback','https://www.youtube.com/@andrikmetal/live');}const map=[['youtubeRadioStudioR576','studioUrl'],['youtubeRadioAnalyticsR576','analyticsUrl'],['youtubeRadioWatchR576','watchUrl']];for(const [id,key] of map){const el=$(id);if(el&&data?.[key]){el.href=data[key];if(id==='youtubeRadioWatchR576')el.setAttribute('data-web-url',data[key])}}}
function renderYoutube(data){
currentLiveIdR1446=safe(data?.videoId);
currentOnlineR1446=data?.concurrentViewers??null;
currentViewsR1484=data?.views??null;freshMetricsR1484=true;
const life=safe(data?.lifeCycleStatus).toLowerCase();
const stream=safe(data?.streamStatus).toLowerCase();
const live=Boolean(data?.active)||life==='live';
const signal=Boolean(data?.signalActive)||stream==='active';
liveStartedAt=live?safe(data?.actualStartTime):'';
refreshUptime();
setLive(live,live?'ЭФИР ИДЁТ':signal?'СИГНАЛ ЕСТЬ — НАЖМИ СТАРТ':'ОЖИДАЕТ СИГНАЛ');
text('youtubeRadioViewersR565',data?.concurrentViewers==null?'—':number(data.concurrentViewers));
// Daily starts come from dated D1 deltas, never from lifetime viewCount.
text('youtubeRadioStartsR947','—');
// An old browser cache must not override a current API response.
const visibleCandidates=[data?.visibleViews,data?.displayViews,data?.studioViews,data?.engagedViews].map(v=>v==null?null:Number(v)).filter(v=>Number.isFinite(v)&&v>=0);
const visible=visibleCandidates.length?visibleCandidates[0]:null;
hasVisibleViewsR1446=visible!=null;
text('youtubeRadioViewsR565',visible==null?(data?.views==null?'—':number(data.views)):number(visible));
const viewsCard=$('youtubeRadioViewsCardR947');
if(viewsCard)viewsCard.title=visible!=null?'Просмотры текущего LIVE · YouTube':'YouTube Data API · viewCount текущего LIVE; возможна задержка YouTube';
const startsCard=$('youtubeRadioStartsCardR947');
if(startsCard)startsCard.title='YouTube Data API · playback starts / viewCount';
text('youtubeRadioLikesR565',data?.likes==null?'—':number(data.likes));
text('youtubeRadioHealthR565',live?healthLabel(data):signal?'СИГНАЛ ЕСТЬ':healthLabel(data));
text('youtubeRadioNowTitleR565',(live||signal)?(safe(data?.title)||'ANDRIK METAL RADIO 24/7'):'Радио готово к запуску');
text('youtubeRadioNowMetaR565',live?'R2 MP3 → OVH VPS → FFmpeg → YouTube Live':signal?'OVH уже передаёт видео и звук. Открой Studio и нажми «Начать трансляцию».':'Ищем текущую трансляцию YouTube');
text('youtubeRadioNextR565','В эфире: активные MP3 · OCEAN и Illusion of Life выключены');
updateLinks(data);
const numericStatsR1484=[data?.views,data?.concurrentViewers,data?.likes].some(v=>v!=null&&Number.isFinite(Number(v)));
const sampleR1484=data?.audienceSampleR1484||data?.audienceSampleR1446;
const warningR1484=safe(data?.statisticsWarning||(sampleR1484?.ok===false?sampleR1484.warning:''));
const attemptsR1484=(data?.statisticsAttempts||[]).map(a=>safe(a.mode)+': '+safe(a.error)).join(' | ');
const stampR1484=data?.updatedAt?new Date(data.updatedAt).toLocaleTimeString('ru-RU',{timeZone:'Europe/Bratislava',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
statsDiagnosticR1484(numericStatsR1484?(warningR1484?'warn':'ok'):'error',
 numericStatsR1484?(warningR1484?explainRadioStatsR1484(warningR1484):'Статистика получена · '+stampR1484):'Нет данных статистики YouTube',
 [data?.statisticsSource||data?.source,warningR1484,attemptsR1484,sampleR1484?.sampledAt?'Сохранён замер: '+sampleR1484.sampledAt:''].filter(Boolean).join(' · '));
const note=$('youtubeRadioNoteR565');
if(note){
const parts=[safe(data?.lifeCycleStatus),safe(data?.streamStatus),safe(data?.privacyStatus)].filter(Boolean);
const issues=Array.isArray(data?.healthIssues)?data.healthIssues:[];
note.textContent=issues.length?`YouTube: ${parts.join(' • ')} · ${issues.slice(0,2).map(x=>[safe(x?.type),safe(x?.reason),safe(x?.description)].filter(Boolean).join(' — ')).join(' · ')||'есть предупреждение'}`:`R1045 · ${live?'LIVE':signal?'СИГНАЛ ПРИНЯТ, ЭФИР ЕЩЁ НЕ НАЧАТ':'ЖДЁТ СИГНАЛ'} · YouTube: ${parts.join(' • ')||'—'} · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
}
}
async function loadAudienceFallbackR1264(){
try{
const d=await window.AndrikRadioDataR1483.load('');if(!d?.ok)return false;lastAudienceDataR1484=d;const q=d.summary||{};
const sameLive=!currentLiveIdR1446||d.videoId===currentLiveIdR1446||q.lastViewsVideoId===currentLiveIdR1446;
if(sameLive&&!freshMetricsR1484&&currentOnlineR1446==null)text('youtubeRadioViewersR565',q.currentConcurrent==null?'—':number(q.currentConcurrent));
if(sameLive)text('youtubeRadioStartsR947',q.viewSamples?number(q.launches):'—');
if(sameLive&&currentViewsR1484==null&&!hasVisibleViewsR1446&&q.lastCumulativeViews!=null)text('youtubeRadioViewsR565',number(q.lastCumulativeViews));
window.dispatchEvent(new CustomEvent('andrik:radio-audience-r1446',{detail:d}));
const a=$('youtubeRadioStartsCardR947');if(a)a.title='Fallback: локальная статистика эфира из двухминутных YouTube-сэмплов';
const v=$('youtubeRadioViewsCardR947');if(v&&currentViewsR1484==null&&!hasVisibleViewsR1446)v.title='YouTube API: последнее сохранённое суммарное viewCount текущего LIVE';
return true;
}catch(_){return false}
}
async function loadTransportFallbackR1264(reason=''){
try{
const k=getKey();const r=await fetch(`/api/control/radio-remote-r627/status?ts=${Date.now()}`,{credentials:'include',cache:'no-store',headers:{accept:'application/json',...(k?{'x-admin-key':k,'authorization':`Bearer ${k}`}:{})}});const d=await r.json().catch(()=>({}));if(!r.ok)return false;const s=d?.agent?.status||{};const service=['active','running'].includes(safe(s.service).toLowerCase());const publisher=Boolean(s.publisher);const video=Boolean(s.videoFeederRunning);const transport=s.transportHealthy!==false;const expected=Math.max(1,Number(s.rtmpsExpectedConnectionsR792||2)||2);const lanes=Math.max(0,Number(s.rtmpsEstablishedConnectionsR792||0));const online=Boolean(d?.online)||service;const good=online&&service&&publisher&&video&&transport&&lanes>=expected;
text('youtubeRadioHealthR565',good?'СИГНАЛ ОК':'СИГНАЛ ПЛОХО');
const h=$('youtubeRadioHealthR565');if(h)h.title=`OVH master: service=${service?'OK':'OFF'} · publisher=${publisher?'OK':'OFF'} · video=${video?'OK':'OFF'} · transport=${transport?'OK':'BAD'} · RTMPS ${lanes}/${expected}${reason?' · YouTube API: '+safe(reason):''}`;
return true;
}catch(_){return false}
}
async function loadYoutube(){
try{
const k=getKey();const res=await fetch(`/api/control/radio-metrics-r1484?id=${LIVE_ID_R1483}&ts=${Date.now()}`,{credentials:'include',headers:{accept:'application/json',...(k?{'x-admin-key':k,'authorization':`Bearer ${k}`}:{})},cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||data.error||'HTTP '+res.status);if(data?.videoId&&data.videoId!==LIVE_ID_R1483)throw new Error('Статистика другого эфира отклонена');renderYoutube(data);await loadAudienceFallbackR1264();return;
}catch(error){
freshMetricsR1484=false;currentOnlineR1446=null;currentViewsR1484=null;hasVisibleViewsR1446=false;
for(const id of ['youtubeRadioViewersR565','youtubeRadioViewsR565','youtubeRadioLikesR565','youtubeRadioStartsR947'])text(id,'—');
let publicRendered=false;
try{const r=await fetch(`/api/public/youtube-live-target?ts=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json'}});const d=await r.json().catch(()=>({}));if(r.ok&&d?.active&&d.videoId===LIVE_ID_R1483){renderYoutube({...d,signalActive:Boolean(d?.signalActive||d?.active),healthStatus:d?.healthStatus||'LIVE'});publicRendered=true}}catch(_){}
const [audience,transport]=await Promise.all([loadAudienceFallbackR1264(),loadTransportFallbackR1264(error?.message||'')]);
if(!transport){text('youtubeRadioHealthR565',publicRendered?'ЭФИР ИДЁТ':'НЕТ ДАННЫХ');const h=$('youtubeRadioHealthR565');if(h)h.title=publicRendered?'Public LIVE доступен; Control YouTube API временно недоступен':safe(error?.message)||'YouTube API недоступен'}
if(!publicRendered)text('youtubeRadioNowMetaR565',safe(error?.message)||'YouTube Data API временно недоступен; показаны локальные данные OVH/аудитории');
const q=lastAudienceDataR1484?.summary||{};
const saved=Number(q.viewSamples)>0||Number(q.viewerSamples)>0;
const publicStats=publicRendered&&[currentOnlineR1446,currentViewsR1484].some(v=>v!=null&&Number.isFinite(Number(v)));
const cause=[safe(error?.message),safe(lastAudienceDataR1484?.collector?.warning)].filter(Boolean).join(' | ');
statsDiagnosticR1484(saved||publicStats?'warn':'error',saved?'Свежая статистика недоступна; показаны сохранённые замеры.':publicStats?'Основной запрос статистики недоступен; показан резервный ответ.':explainRadioStatsR1484(cause),cause);

}
}
let youtubeTimer=null,libraryTimer=null;
function armNetworkTimers(){
if(youtubeTimer)clearInterval(youtubeTimer);if(libraryTimer)clearInterval(libraryTimer);
youtubeTimer=libraryTimer=null;
if(document.hidden)return;
youtubeTimer=setInterval(()=>{if(!document.hidden)loadYoutube()},60000);
libraryTimer=setInterval(()=>{if(!document.hidden)loadLibrary()},300000);
}
loadLibrary();loadYoutube();setTimeout(()=>{if(!document.hidden)loadYoutube()},2500);armNetworkTimers();
document.addEventListener('visibilitychange',()=>{
if(document.hidden){if(youtubeTimer)clearInterval(youtubeTimer);if(libraryTimer)clearInterval(libraryTimer);youtubeTimer=libraryTimer=null;return;}
loadLibrary();loadYoutube();armNetworkTimers();
});
setInterval(refreshUptime,30000);
})();
