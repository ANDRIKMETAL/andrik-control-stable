(()=>{
'use strict';
const root=document.getElementById('youtubeRadioR565');
if(!root)return;

const streamId='jBDuQ45RbeE';
const libraryUrl='/api/music/downloads';
const KEY_SESSION='andrik-comments-admin-key';
const KEY_LOCAL='andrik-comments-admin-key-persistent';

const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
const $=id=>document.getElementById(id);
const text=(id,value)=>{const el=$(id);if(el)el.textContent=value};
const safe=v=>String(v??'').trim();
const number=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));

function setLive(live,label){
  const pill=$('youtubeRadioLiveR565');
  if(!pill)return;
  pill.classList.toggle('is-live',Boolean(live));
  const span=pill.querySelector('span');
  if(span)span.textContent=label||(live?'ЭФИР ИДЁТ':'ОЖИДАЕТ СИГНАЛ');
}

function healthLabel(data){
  const health=safe(data?.healthStatus).toLowerCase();
  const stream=safe(data?.streamStatus).toLowerCase();
  const life=safe(data?.lifeCycleStatus).toLowerCase();
  if(['good','ok'].includes(health))return 'ОТЛИЧНО';
  if(health)return health.toUpperCase();
  if(stream)return stream.toUpperCase();
  if(life)return life.toUpperCase();
  return 'ЖДЁТ СИГНАЛ';
}

async function loadLibrary(){
  try{
    const res=await fetch(libraryUrl+'?ts='+Date.now(),{cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();
    const tracks=(Array.isArray(data?.tracks)?data.tracks:[]).filter(item=>{
      const key=String(item?.key||'');
      const url=String(item?.url||'');
      return /^albums\//i.test(key)&&/\.mp3(?:$|\?)/i.test(url);
    });
    text('youtubeRadioTracksR565',number(tracks.length));
    text('youtubeRadioModeR565','MP3 ONLY');
    text('youtubeRadioCycleR565','AUTO');
    text('youtubeRadioUptimeR565','24/7');
  }catch(_){
    text('youtubeRadioTracksR565','—');
  }
}

function renderYoutube(data){
  const life=safe(data?.lifeCycleStatus).toLowerCase();
  const stream=safe(data?.streamStatus).toLowerCase();
  const live=life==='live'||stream==='active';

  setLive(live,live?'ЭФИР ИДЁТ':'ОЖИДАЕТ СИГНАЛ');

  text('youtubeRadioViewersR565',number(data?.concurrentViewers));
  text('youtubeRadioViewsR565',number(data?.views));
  text('youtubeRadioLikesR565',number(data?.likes));
  text('youtubeRadioHealthR565',healthLabel(data));

  text(
    'youtubeRadioNowTitleR565',
    live?'ANDRIK METAL RADIO 24/7':'Радио готово к запуску'
  );
  text(
    'youtubeRadioNowMetaR565',
    live?'R2 MP3 → FREE VM → FFmpeg → YouTube':'MP3 ONLY · сервер без Cloudflare Containers'
  );
  text(
    'youtubeRadioNextR565',
    'Дальше: MP3 из albums/* в случайном порядке'
  );

  const note=$('youtubeRadioNoteR565');
  if(note){
    const parts=[safe(data?.lifeCycleStatus),safe(data?.streamStatus),safe(data?.privacyStatus)].filter(Boolean);
    const issues=Array.isArray(data?.healthIssues)?data.healthIssues:[];
    note.textContent=issues.length
      ?`YouTube: ${parts.join(' • ')} · ${issues[0]?.reason||issues[0]?.description||'есть предупреждение'}`
      :`R568 FREE VM · YouTube: ${parts.join(' • ')||'готов'} · ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  }
}

async function loadYoutube(){
  const key=getKey();
  if(!key){
    setLive(false,'НУЖЕН ADMIN_KEY');
    return;
  }
  try{
    const res=await fetch(`/api/control/youtube-live-r565?id=${encodeURIComponent(streamId)}&ts=${Date.now()}`,{
      headers:{accept:'application/json',authorization:`Bearer ${key}`},
      cache:'no-store'
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'HTTP '+res.status);
    renderYoutube(data);
  }catch(_){
    setLive(false,'НЕТ ДАННЫХ YOUTUBE');
    text('youtubeRadioHealthR565','НЕТ ДАННЫХ');
    text('youtubeRadioNowTitleR565','Проверяем YouTube');
    text('youtubeRadioNowMetaR565','Cloudflare Container больше не используется');
  }
}

function loadAll(){loadLibrary();loadYoutube();}
loadAll();
setInterval(loadAll,15000);
})();