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
function healthLabel(data){const health=safe(data?.healthStatus).toLowerCase();const stream=safe(data?.streamStatus).toLowerCase();const life=safe(data?.lifeCycleStatus).toLowerCase();if(['good','ok'].includes(health))return'ОТЛИЧНО';if(health)return health.toUpperCase();if(stream)return stream.toUpperCase();if(life)return life.toUpperCase();return'ЖДЁТ СИГНАЛ'}
async function loadLibrary(){try{const res=await fetch(libraryUrl+'?ts='+Date.now(),{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);const data=await res.json();const tracks=(Array.isArray(data?.tracks)?data.tracks:[]).filter(item=>{const key=String(item?.key||'').toLowerCase();return /^albums\//i.test(key)&&!disabledAlbums.some(prefix=>key.startsWith(prefix))&&/\.mp3(?:$|\?)/i.test(String(item?.url||''))});text('youtubeRadioTracksR565',number(tracks.length));text('youtubeRadioModeR565','MP3 + КЛИП');text('youtubeRadioCycleR565','AUTO');refreshUptime()}catch(_){text('youtubeRadioTracksR565','—')}}
function updateLinks(data){const map=[['youtubeRadioStudioR576','studioUrl'],['youtubeRadioAnalyticsR576','analyticsUrl'],['youtubeRadioWatchR576','watchUrl']];for(const [id,key] of map){const el=$(id);if(el&&data?.[key]){el.href=data[key];if(id==='youtubeRadioWatchR576')el.setAttribute('data-web-url',data[key])}}}
function renderYoutube(data){const life=safe(data?.lifeCycleStatus).toLowerCase();const stream=safe(data?.streamStatus).toLowerCase();const live=Boolean(data?.active)||life==='live';const signal=Boolean(data?.signalActive)||stream==='active';liveStartedAt=live?safe(data?.actualStartTime):'';refreshUptime();setLive(live,live?'ЭФИР ИДЁТ':signal?'СИГНАЛ ЕСТЬ — НАЖМИ СТАРТ':'ОЖИДАЕТ СИГНАЛ');text('youtubeRadioViewersR565',number(data?.concurrentViewers));text('youtubeRadioViewsR565',number(data?.views));text('youtubeRadioLikesR565',number(data?.likes));text('youtubeRadioHealthR565',live?healthLabel(data):signal?'СИГНАЛ ЕСТЬ':healthLabel(data));text('youtubeRadioNowTitleR565',(live||signal)?(safe(data?.title)||'ANDRIK METAL RADIO 24/7'):'Радио готово к запуску');text('youtubeRadioNowMetaR565',live?'R2 MP3 → OVH VPS → FFmpeg → YouTube Live':signal?'OVH уже передаёт видео и звук. Открой Studio и нажми «Начать трансляцию».':'Ищем текущую трансляцию YouTube');text('youtubeRadioNextR565','В эфире: активные MP3 · OCEAN и Illusion of Life выключены');updateLinks(data);const note=$('youtubeRadioNoteR565');if(note){const parts=[safe(data?.lifeCycleStatus),safe(data?.streamStatus),safe(data?.privacyStatus)].filter(Boolean);const issues=Array.isArray(data?.healthIssues)?data.healthIssues:[];note.textContent=issues.length?`YouTube: ${parts.join(' • ')} · ${issues.slice(0,2).map(x=>[safe(x?.type),safe(x?.reason),safe(x?.description)].filter(Boolean).join(' — ')).join(' · ')||'есть предупреждение'}`:`R793 · ${live?'LIVE':signal?'СИГНАЛ ПРИНЯТ, ЭФИР ЕЩЁ НЕ НАЧАТ':'ЖДЁТ СИГНАЛ'} · YouTube: ${parts.join(' • ')||'—'} · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`}}
async function loadYoutube(){const key=getKey();if(!key){setLive(false,'НУЖЕН ADMIN_KEY');return}try{const res=await fetch(`/api/control/youtube-live-r565?active=1&ts=${Date.now()}`,{headers:{accept:'application/json',authorization:`Bearer ${key}`},cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'HTTP '+res.status);renderYoutube(data)}catch(error){setLive(false,'НЕТ ДАННЫХ YOUTUBE');text('youtubeRadioHealthR565','НЕТ ДАННЫХ');text('youtubeRadioNowTitleR565','Не удалось получить статус эфира');text('youtubeRadioNowMetaR565',safe(error?.message)||'YouTube API недоступен')}}
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
