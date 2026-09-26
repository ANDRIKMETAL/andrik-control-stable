/* ANDRIK R1176 — Covers are read directly from the already uploaded R2 ZIP. */
(()=>{'use strict';
const root=document.getElementById('coversArchiveListR1176');if(!root)return;
const now=document.getElementById('coversNowR1176'),nowTitle=now?.querySelector('strong');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let audios=[];
function setNow(track){if(!now||!nowTitle)return;now.hidden=false;nowTitle.textContent=`${String(track.track).padStart(2,'0')}. ${track.title}`}
function bind(tracks){audios=[...root.querySelectorAll('audio[data-cover-track]')];audios.forEach((audio,index)=>{
  audio.addEventListener('play',()=>{audios.forEach(other=>{if(other!==audio&&!other.paused)other.pause()});setNow(tracks[index])});
  audio.addEventListener('ended',()=>{const next=audios[index+1];if(!next)return;next.play().catch(()=>{});next.closest('.covers-track')?.scrollIntoView({behavior:'smooth',block:'center'})});
});}
async function load(){try{
  const response=await fetch(`/api/music/covers-archive?r1176=${Date.now()}`,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.message||data.error||`HTTP ${response.status}`);
  const tracks=Array.isArray(data.tracks)?data.tracks:[];if(!tracks.length)throw new Error('В архиве не найдены MP3.');
  root.innerHTML=tracks.map(t=>`<article class="covers-track" data-track="${Number(t.track)||0}"><div class="covers-track-head"><span class="covers-track-no">${String(Number(t.track)||0).padStart(2,'0')}</span><div class="covers-track-title">${esc(t.title)}</div></div><audio class="covers-native" data-cover-track="${Number(t.track)||0}" controls preload="metadata" src="${esc(t.streamUrl)}"></audio><a class="covers-download" href="${esc(t.downloadUrl)}">↓ Скачать MP3</a></article>`).join('');
  bind(tracks);
}catch(error){root.innerHTML=`<div class="covers-status">Не удалось открыть архив каверов.<br>${esc(error.message||error)}</div>`}}
load();
})();
