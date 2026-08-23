(()=>{
'use strict';
const root=document.getElementById('youtubeRadioR566');
if(!root)return;
const statusUrl='https://radio.andrikmetal.com/status';
const streamId='jBDuQ45RbeE';
const KEY_SESSION='andrik-comments-admin-key';
const KEY_LOCAL='andrik-comments-admin-key-persistent';
const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
const $=id=>document.getElementById(id);
const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
const safe=v=>String(v??'').trim();
const number=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));
function clock(sec){const n=Math.max(0,Number(sec)||0);if(n<60)return Math.round(n)+' сек';const h=Math.floor(n/3600),m=Math.floor((n%3600)/60);return h?`${h} ч ${m} мин`:`${m} мин`;}
function renderRadio(data){
  const live=Boolean(data?.ok&&data?.publisherRunning);
  const pill=$('youtubeRadioLiveR566');
  if(pill){pill.classList.toggle('is-live',live);pill.querySelector('span').textContent=live?'ЭФИР ИДЁТ':'ОЖИДАЕТ ЗАПУСКА';}
  text('youtubeRadioTracksR566',number(data?.libraryTracks));
  text('youtubeRadioClipsR566',number(data?.clipCount||4));
  text('youtubeRadioCycleR566',String(data?.cycle||0));
  text('youtubeRadioUptimeR566',clock(data?.uptimeSeconds||0));
  const cur=data?.current||{};
  text('youtubeRadioNowTitleR566',safe(cur.title)||'Поток ещё не стартовал');
  text('youtubeRadioNowMetaR566',[safe(cur.album),cur.type==='clip'?'КЛИП':'MP3 ИЗ R2'].filter(Boolean).join(' • ')||'R2 → YouTube');
  const next=data?.next||{};
  text('youtubeRadioNextR566',safe(next.title)?`Дальше: ${next.title}`:'Дальше: очередь формируется');
  const note=$('youtubeRadioNoteR566');
  if(note)note.textContent=data?.lastError?`Radio: ${String(data.lastError).slice(0,220)}`:`R2/FFmpeg: OK · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
}
function healthLabel(data){
  const health=safe(data?.healthStatus).toLowerCase(), stream=safe(data?.streamStatus).toLowerCase(), life=safe(data?.lifeCycleStatus).toLowerCase();
  if(['good','ok'].includes(health))return 'ОТЛИЧНО';
  if(health)return health.toUpperCase();
  if(stream)return stream.toUpperCase();
  if(life)return life.toUpperCase();
  return 'ЖДЁТ СИГНАЛ';
}
function renderYoutube(data){
  text('youtubeRadioViewersR566',number(data?.concurrentViewers));
  text('youtubeRadioViewsR566',number(data?.views));
  text('youtubeRadioLikesR566',number(data?.likes));
  text('youtubeRadioHealthR566',healthLabel(data));
  const note=$('youtubeRadioNoteR566');
  if(note&&data?.ok){
    const parts=[safe(data.lifeCycleStatus),safe(data.streamStatus),safe(data.privacyStatus)].filter(Boolean);
    const issues=Array.isArray(data.healthIssues)?data.healthIssues:[];
    note.textContent=issues.length?`YouTube: ${parts.join(' • ')} · ${issues[0].reason||issues[0].description||'есть предупреждение'}`:`YouTube: ${parts.join(' • ')||'готов'} · обновлено ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  }
}
async function loadRadio(){
  try{const res=await fetch(statusUrl+'?ts='+Date.now(),{cache:'no-store',mode:'cors'});if(!res.ok)throw new Error('HTTP '+res.status);renderRadio(await res.json());}
  catch(_){const pill=$('youtubeRadioLiveR566');if(pill){pill.classList.remove('is-live');pill.querySelector('span').textContent='РАДИО НЕ ПОДКЛЮЧЕНО';}text('youtubeRadioNowTitleR566','Ожидаем deploy radio.andrikmetal.com');text('youtubeRadioNowMetaR566','Cloudflare Container ещё не отвечает');}
}
async function loadYoutube(){
  const key=getKey();if(!key)return;
  try{const res=await fetch(`/api/control/youtube-live-r565?id=${encodeURIComponent(streamId)}&ts=${Date.now()}`,{headers:{accept:'application/json',authorization:`Bearer ${key}`},cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'HTTP '+res.status);renderYoutube(data);}
  catch(error){text('youtubeRadioHealthR566','НЕТ ДАННЫХ');}
}
function loadAll(){loadRadio();loadYoutube();}
loadAll();setInterval(loadAll,15000);
})();
