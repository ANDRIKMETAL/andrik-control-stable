/* ANDRIK R1177 — Covers from uploaded R2 ZIP + share links + autoplay sequence. */
(()=>{'use strict';
const root=document.getElementById('coversArchiveListR1176');if(!root)return;
const now=document.getElementById('coversNowR1176'),nowTitle=now?.querySelector('strong');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let audios=[];
function setNow(track){if(!now||!nowTitle)return;now.hidden=false;nowTitle.textContent=`${String(track.track).padStart(2,'0')}. ${track.title}`}
async function shareTrack(track,button){
  const shareUrl=String(track.shareUrl||track.streamUrl||track.downloadUrl||location.href).trim();
  const title=`ANDRIK METAL — ${String(track.track).padStart(2,'0')}. ${track.title}`;
  const text=`Слушай трек ANDRIK METAL: ${track.title}`;
  try{
    if(navigator.share){
      await navigator.share({title,text,url:shareUrl});
    }else if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(shareUrl);
      const old=button.textContent;
      button.textContent='✓ Ссылка скопирована';
      button.classList.add('is-done');
      await wait(1800);
      button.textContent=old;
      button.classList.remove('is-done');
    }else{
      window.prompt('Скопируйте ссылку для браузера',shareUrl);
    }
  }catch(error){
    if(String(error?.name||'')==='AbortError') return;
    try{window.prompt('Скопируйте ссылку для браузера',shareUrl);}catch(_){}}
}
function bind(tracks){
  audios=[...root.querySelectorAll('audio[data-cover-track]')];
  audios.forEach((audio,index)=>{
    audio.addEventListener('play',()=>{audios.forEach(other=>{if(other!==audio&&!other.paused)other.pause()});setNow(tracks[index])});
    audio.addEventListener('ended',()=>{const next=audios[index+1];if(!next)return;next.play().catch(()=>{});next.closest('.covers-track')?.scrollIntoView({behavior:'smooth',block:'center'})});
  });
  root.querySelectorAll('[data-share-cover]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const track=tracks.find(t=>String(Number(t.track)||0)===btn.getAttribute('data-share-cover'));
      if(track) shareTrack(track,btn);
    });
  });
}
async function load(){try{
  const response=await fetch(`/api/music/covers-archive?r1177=${Date.now()}`,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.message||data.error||`HTTP ${response.status}`);
  const tracks=Array.isArray(data.tracks)?data.tracks:[];if(!tracks.length)throw new Error('В архиве не найдены MP3.');
  root.innerHTML=tracks.map(t=>`<article class="covers-track" data-track="${Number(t.track)||0}"><div class="covers-track-head"><span class="covers-track-no">${String(Number(t.track)||0).padStart(2,'0')}</span><div class="covers-track-title">${esc(t.title)}</div></div><audio class="covers-native" data-cover-track="${Number(t.track)||0}" controls preload="metadata" src="${esc(t.streamUrl)}"></audio><button class="covers-share" type="button" data-share-cover="${Number(t.track)||0}">🔗 Поделиться ссылкой</button></article>`).join('');
  bind(tracks);
}catch(error){root.innerHTML=`<div class="covers-status">Не удалось открыть архив каверов.<br>${esc(error.message||error)}</div>`}}
load();
})();
