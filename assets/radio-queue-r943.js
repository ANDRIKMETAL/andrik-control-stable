(()=>{
'use strict';
const list=document.getElementById('radioQueueListR942');
if(!list)return;
const msg=document.getElementById('radioQueueMsgR942');
const cur=document.getElementById('radioCurrentTitleR942');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=t=>t==='clip'?'🎬':t==='bumper'?'📻':t==='special'?'⚡':'♪';
const fmtDur=v=>{v=Number(v)||0;if(v<=0)return'';const m=Math.floor(v/60),s=Math.floor(v%60);return `${m}:${String(s).padStart(2,'0')}`};
const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0))};
let rows=[],busy=false;
const MAX_VISIBLE=5;
const CACHE_KEY_R956='andrik-radio-queue-next5-r1127';
const adminKeyR1038=()=>{try{return localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||''}catch(_){return''}};
function currentTitleR1073(s){
 const v=s?.current;
 if(v&&typeof v==='object')return String(v.title||v.name||'').trim();
 return String(v??'').trim();
}
function applyCurrentAndLiveR1073(data){
 const s=data?.agent?.status||{};
 const lastSeenMs=Date.parse(data?.agent?.lastSeen||'')||0;
 const heartbeatFresh=Boolean(lastSeenMs&&Date.now()-lastSeenMs<90000);
 const serverCurrent=currentTitleR1073(s);
 if(cur)cur.textContent=serverCurrent||'LIVE · синхронизация названия…';
 const live=Boolean(heartbeatFresh&&s.publisher&&s.producer&&['active','running'].includes(String(s.service||'').toLowerCase()));
 const up=document.getElementById('youtubeRadioUptimeR565');
 if(up&&!heartbeatFresh)up.textContent='—';
 if(up&&live){
   const start=Date.parse(s.streamStartedAt||s.publisherStartedAt||s.startedAt||'')||0;
   if(start){const sec=Math.max(0,Math.floor((Date.now()-start)/1000)),d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60);up.textContent=d?`${d} д ${h} ч`:h?`${h} ч ${m} мин`:`${m} мин`;}
   else up.textContent='ДА · RTMPS 2/2';
 }
}
function saveCacheR956(){try{localStorage.setItem(CACHE_KEY_R956,JSON.stringify({at:Date.now(),rows:rows.slice(0,MAX_VISIBLE)}))}catch(_){} }
function loadCacheR956(){try{const d=JSON.parse(localStorage.getItem(CACHE_KEY_R956)||'null');if(d&&Array.isArray(d.rows)&&d.rows.length&&Date.now()-Number(d.at||0)<45000){rows=d.rows.slice(0,MAX_VISIBLE);render();if(msg)msg.textContent='Показываю последнюю очередь · обновляю с OVH…';return true}}catch(_){}return false}
async function api(path,opts={}){const k=adminKeyR1038();const r=await fetch(path,{credentials:'include',cache:'no-store',headers:{accept:'application/json',...(k?{'x-admin-key':k}:{}),...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.message||d.error||`HTTP ${r.status}`),{status:r.status,data:d});return d;}
function applyInventory(s){
 const ready=String(s?.inventoryTelemetry||'').startsWith('R805-')||Number(s?.libraryTracks||0)>0;
 if(!ready)return;
 set('youtubeRadioSongsR805',s.libraryTracks);set('youtubeRadioTracksR565',s.libraryAlbumTracks);set('youtubeRadioSinglesR805',s.librarySingleTracks);set('youtubeRadioVideosR805',s.libraryVideos);set('youtubeRadioStationR805',Number(s.libraryBumpers||0)+Number(s.librarySpecial||0));
 document.documentElement.dataset.radioLiveInventoryR943=String(Date.now());
}
function render(){
 if(!rows.length){list.innerHTML='<div class="radio-queue-empty-r942">Получаю очередь с OVH…</div>';return;}
 list.innerHTML=rows.slice(0,MAX_VISIBLE).map((r,i)=>`<div class="radio-queue-row-r942" data-qrow="${i}"><div class="radio-queue-num-r942">${i+1}</div><div class="radio-queue-icon-r942 radio-queue-type-${esc(r.type)}">${icon(r.type)}</div><div class="radio-queue-copy-r942"><b>${esc(r.title||'Без названия')}</b><small>${esc(r.type==='track'?'ANDRIK':r.type==='clip'?'КЛИП':r.type==='bumper'?'ЗАСТАВКА':'СПЕЦ')}</small></div><div class="radio-queue-dur-r942">${fmtDur(r.duration)}</div><button type="button" class="radio-queue-more-r942" data-qmore="${i}" aria-label="Действия">⋯</button><div class="radio-queue-menu-r942"><button type="button" data-qaction="next" data-qindex="${i}" ${i===0?'disabled':''}>⤒ Поставить следующей</button><button type="button" data-qaction="up" data-qindex="${i}" ${i===0?'disabled':''}>↑ Переместить выше</button><button type="button" data-qaction="down" data-qindex="${i}" ${i>=rows.length-1?'disabled':''}>↓ Переместить ниже</button></div></div>`).join('');
}
async function refresh(usePrefetch=false){
 try{let d=null;if(usePrefetch&&window.__ANDRIK_QUEUE_PREFETCH_R956__){const pref=await window.__ANDRIK_QUEUE_PREFETCH_R956__;if(pref?.ok)d=pref.data}if(!d)d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());const s=d?.agent?.status||{};applyInventory(s);const nextRows=Array.isArray(s.upcomingR943)&&s.upcomingR943.length?s.upcomingR943.slice(0,MAX_VISIBLE):Array.isArray(s.upcomingR942)&&s.upcomingR942.length?s.upcomingR942.slice(0,MAX_VISIBLE):Array.isArray(s.upcomingR934)?s.upcomingR934.slice(0,MAX_VISIBLE):[];applyCurrentAndLiveR1073(d);rows=nextRows;render();if(rows.length)saveCacheR956();}
 catch(e){if(msg)msg.textContent='Очередь: '+e.message;}
}
async function sendMove(offset,direction,itemId){
 return api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'queue-move',offset,direction,itemId:String(itemId||'')})});
}
async function move(index,direction){
 if(busy)return;const row=rows[index];if(!row)return;busy=true;if(msg)msg.textContent=direction==='down'?'Перемещаю ниже…':'Перемещаю выше…';
 try{await sendMove(index,direction,row.id);if(msg)msg.textContent='✅ Команда отправлена на OVH. Эфир не перезапускается.';setTimeout(refresh,1200);setTimeout(refresh,3200);setTimeout(refresh,6500);}
 catch(e){if(msg)msg.textContent='❌ '+(e.status===409?'OVH выполняет другую команду. Повтори через несколько секунд.':e.message);}
 finally{busy=false;}
}
async function makeNext(index){
 if(busy)return;const row=rows[index];if(!row||index<=0)return;busy=true;if(msg)msg.textContent='Ставлю следующей…';
 try{
   for(let step=index;step>0;step--){
     await sendMove(step,'up',row.id);
     if(step>1)await new Promise(r=>setTimeout(r,180));
   }
   if(msg)msg.textContent='✅ Элемент поставлен следующим.';
   setTimeout(refresh,1200);setTimeout(refresh,3200);setTimeout(refresh,6500);
 }catch(e){
   if(msg)msg.textContent='❌ '+(e.status===409?'OVH выполняет другую команду. Повтори через несколько секунд.':e.message);
 }finally{busy=false;}
}
list.addEventListener('click',e=>{
 const more=e.target.closest('[data-qmore]');
 if(more){const row=more.closest('.radio-queue-row-r942');document.querySelectorAll('.radio-queue-row-r942.open').forEach(x=>{if(x!==row)x.classList.remove('open')});row?.classList.toggle('open');return;}
 const b=e.target.closest('[data-qaction]');
 if(b&&!b.disabled){const row=b.closest('.radio-queue-row-r942');row?.classList.remove('open');const idx=Number(b.dataset.qindex)||0;const action=b.dataset.qaction;if(action==='next')makeNext(idx);else move(idx,action);}
});
document.addEventListener('click',e=>{if(!e.target.closest('.radio-queue-row-r942'))document.querySelectorAll('.radio-queue-row-r942.open').forEach(x=>x.classList.remove('open'))});
loadCacheR956();refresh(true);setInterval(()=>{if(!document.hidden)refresh()},7000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('andrik:radio-queue-refresh-r989',()=>{setTimeout(refresh,500);setTimeout(refresh,3500)});
})();
