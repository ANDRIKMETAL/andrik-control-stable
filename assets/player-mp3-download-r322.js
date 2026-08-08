/* ANDRIK R322 — attach the current YouTube track to an MP3 already stored in R2. */
(()=>{'use strict';
const titleEl=document.getElementById('trackTitle'),albumEl=document.getElementById('collectionName'),btn=document.getElementById('trackMp3DownloadR322');
if(!titleEl||!btn)return;
let tracks=[],loaded=false,loading=null,lastKey='';
const norm=s=>String(s||'').toLocaleLowerCase('ru-RU').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\([^)]*(official|audio|video|lyrics|клип)[^)]*\)/gi,' ').replace(/\[[^\]]*(official|audio|video|lyrics|клип)[^\]]*\]/gi,' ').replace(/\b(andrik|official\s*audio|official\s*video|music\s*video)\b/gi,' ').replace(/[–—_\-:|]+/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
async function load(){
 if(loaded)return tracks;if(loading)return loading;
 loading=fetch('/api/music/downloads',{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('HTTP '+r.status));tracks=Array.isArray(d.tracks)?d.tracks:[];loaded=true;return tracks}).catch(e=>{console.warn('MP3 map unavailable',e);tracks=[];loaded=true;return tracks}).finally(()=>loading=null);
 return loading;
}
function albumScore(t,currentAlbum){
 const a=norm(t.album),f=String(t.folder||'').toLowerCase(),c=norm(currentAlbum);
 if(!c)return 0;
 if(a&&a===c)return 3;
 if(c.includes('ocean')&&(a.includes('ocean')||f.includes('/ocean')))return 2;
 if(c.includes('illusion')&&(a.includes('illusion')||f.includes('illusion-of-life')))return 2;
 if(c.includes('трика')&&(a.includes('трика')||f.includes('/trika')))return 2;
 if(f==='singles')return 0;
 return 0;
}
async function sync(){
 const rawTitle=titleEl.textContent||'',n=norm(rawTitle);
 if(!n||/загрузка|loading/.test(n)){btn.hidden=true;lastKey='';return}
 await load();
 const currentAlbum=albumEl?.textContent||'';
 let best=null,bestScore=-1;
 for(const t of tracks){
   const tn=norm(t.title);
   let score=0;
   if(tn===n)score=10;
   else if(tn&&n&&(tn.includes(n)||n.includes(tn)))score=6;
   else continue;
   score+=albumScore(t,currentAlbum);
   if(score>bestScore){best=t;bestScore=score}
 }
 if(!best){btn.hidden=true;btn.removeAttribute('href');lastKey='';return}
 if(lastKey!==best.key){btn.href=best.url;btn.download=(best.key.split('/').pop()||'ANDRIK.mp3');btn.title='Скачать MP3: '+(best.title||rawTitle);lastKey=best.key}
 btn.hidden=false;
}
const obs=new MutationObserver(()=>sync());obs.observe(titleEl,{childList:true,characterData:true,subtree:true});
if(albumEl)obs.observe(albumEl,{childList:true,characterData:true,subtree:true});
window.addEventListener('pageshow',()=>{loaded=false;tracks=[];sync()},{passive:true});
sync();
})();