/* ANDRIK R326 — reliable R2 MP3 download button for the current player track. */
(()=>{'use strict';
const titleEl=document.getElementById('trackTitle');
const albumEl=document.getElementById('collectionName');
const posEl=document.getElementById('playlistPos');
const btn=document.getElementById('trackMp3DownloadR322');
if(!titleEl||!btn)return;
let tracks=[],loaded=false,loading=null,lastKey='',retryTimer=0,retries=0;
const norm=s=>String(s||'').toLocaleLowerCase('ru-RU').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ё/g,'е').replace(/\([^)]*(official|audio|video|lyrics|клип)[^)]*\)/gi,' ').replace(/\[[^\]]*(official|audio|video|lyrics|клип)[^\]]*\]/gi,' ').replace(/\b(andrik|official\s*audio|official\s*video|music\s*video)\b/gi,' ').replace(/[–—_\-:|]+/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
function currentTrackNumber(){const m=String(posEl?.textContent||'').match(/^\s*(\d+)\s*\/\s*\d+/);return m?String(Number(m[1])):''}
function folderAlbumScore(t,currentAlbum){
 const a=norm(t.album),f=String(t.folder||'').toLowerCase(),c=norm(currentAlbum);
 if(!c)return 0;
 if(a&&a===c)return 5;
 if(c.includes('ocean')&&(a.includes('ocean')||f==='albums/ocean'))return 4;
 if(c.includes('illusion')&&(a.includes('illusion')||f==='albums/illusion-of-life'))return 4;
 if(c.includes('трика')&&(a.includes('трика')||f==='albums/trika'))return 4;
 return f==='singles'?0:0;
}
async function load(force=false){
 if(force){loaded=false;tracks=[]}
 if(loaded)return tracks;if(loading)return loading;
 loading=fetch('/api/music/downloads?ts='+Date.now(),{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||('HTTP '+r.status));tracks=Array.isArray(d.tracks)?d.tracks:[];loaded=true;retries=0;return tracks}).catch(e=>{console.warn('MP3 map unavailable',e);tracks=[];loaded=false;if(retries<3){retries++;clearTimeout(retryTimer);retryTimer=setTimeout(()=>sync(true),1200*retries)}return tracks}).finally(()=>loading=null);
 return loading;
}
function chooseMatch(rawTitle,currentAlbum,currentNo){
 const n=norm(rawTitle);let best=null,bestScore=-1;
 for(const t of tracks){
   const albumScore=folderAlbumScore(t,currentAlbum);if(!albumScore)continue;
   const tn=norm(t.title);let score=-1;
   if(tn&&tn===n)score=100;
   else if(tn&&n&&(tn.includes(n)||n.includes(tn)))score=70;
   const trackNo=String(Number(String(t.track||'').match(/\d+/)?.[0]||0)||'');
   if(currentNo&&trackNo&&currentNo===trackNo)score=Math.max(score,90);
   if(score<0)continue;
   score+=albumScore;
   if(score>bestScore){best=t;bestScore=score}
 }
 return best;
}
async function sync(force=false){
 const rawTitle=titleEl.textContent||'',n=norm(rawTitle);
 if(!n||/загрузка|loading/.test(n)){btn.hidden=true;lastKey='';return}
 await load(force);
 const currentAlbum=albumEl?.textContent||'';
 const currentNo=currentTrackNumber();
 const best=chooseMatch(rawTitle,currentAlbum,currentNo);
 if(!best){btn.hidden=true;btn.removeAttribute('href');lastKey='';return}
 if(lastKey!==best.key){btn.href='/api/music/download?key='+encodeURIComponent(best.key);btn.removeAttribute('download');btn.title='Скачать MP3: '+(best.title||rawTitle);btn.setAttribute('aria-label','Скачать MP3: '+(best.title||rawTitle));lastKey=best.key}
 btn.hidden=false;
}
const obs=new MutationObserver(()=>sync());
obs.observe(titleEl,{childList:true,characterData:true,subtree:true});
if(albumEl)obs.observe(albumEl,{childList:true,characterData:true,subtree:true});
if(posEl)obs.observe(posEl,{childList:true,characterData:true,subtree:true});
window.addEventListener('pageshow',()=>sync(true),{passive:true});
window.addEventListener('focus',()=>sync(true),{passive:true});
btn.addEventListener('click',()=>{
  if(btn.hidden||!btn.getAttribute('href'))return;
  const label=btn.querySelector('span:last-child');
  if(label){label.textContent='СКАЧАТЬ';setTimeout(()=>{if(label)label.textContent='MP3'},1800)}
});

sync(true);
})();
