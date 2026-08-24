(()=>{'use strict';
const root=document.getElementById('andrikSinglesList');if(!root)return;
const lang=String(document.documentElement.lang||'ru').toLowerCase().split('-')[0];
const I={
 ru:{loading:'Загружаем синглы…',empty:'Синглы скоро появятся.',play:'▶ Слушать',pause:'❚❚ Пауза',download:'↓ Скачать MP3',share:'🔗 Поделиться ссылкой',copied:'✓ Ссылка скопирована',copyPrompt:'Скопируйте ссылку для браузера',error:'Не удалось загрузить список синглов.'},
 uk:{loading:'Завантажуємо сингли…',empty:'Сингли скоро з’являться.',play:'▶ Слухати',pause:'❚❚ Пауза',download:'↓ Завантажити MP3',share:'🔗 Поділитися посиланням',copied:'✓ Посилання скопійовано',copyPrompt:'Скопіюйте посилання для браузера',error:'Не вдалося завантажити список синглів.'},
 sk:{loading:'Načítavame single…',empty:'Single sa čoskoro objavia.',play:'▶ Počúvať',pause:'❚❚ Pauza',download:'↓ Stiahnuť MP3',share:'🔗 Zdieľať odkaz',copied:'✓ Odkaz skopírovaný',copyPrompt:'Skopírujte odkaz pre prehliadač',error:'Zoznam singlov sa nepodarilo načítať.'},
 en:{loading:'Loading singles…',empty:'Singles are coming soon.',play:'▶ Listen',pause:'❚❚ Pause',download:'↓ Download MP3',share:'🔗 Share link',copied:'✓ Link copied',copyPrompt:'Copy this link for your browser',error:'Could not load the singles list.'}
};
const t=I[lang]||I.ru,limit=Math.max(0,Number(root.dataset.limit||0));
let fingerprint='',loading=false;
const pretty=s=>{try{return decodeURIComponent(String(s||''))}catch(_){return String(s||'')}};
const cleanTitle=s=>pretty(s).replace(/(?:\.(?:mp3|wav))+$/ig,'').trim();
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback=s=>String(s||'').replace(/\b\w/g,c=>c.toUpperCase());
const copyLink=async(url,btn)=>{try{await navigator.clipboard.writeText(url);const old=btn.textContent;btn.textContent=t.copied;setTimeout(()=>btn.textContent=old,1600)}catch(_){window.prompt(t.copyPrompt,url)}};
function render(tracks){
 let a=Array.isArray(tracks)?tracks:[];if(limit)a=a.slice(0,limit);
 if(!a.length){root.innerHTML=`<div class="andrik-singles-empty">${t.empty}</div>`;return}
 root.innerHTML=a.map((x,i)=>{const title=cleanTitle(x.title).trim()||fallback(cleanTitle(x.name));return `<article class="andrik-track" data-key="${esc(x.key||'')}"><div class="andrik-track-title">${esc(title)}</div><div class="andrik-track-actions"><button type="button" data-play="${i}">${t.play}</button><a href="${esc(x.url)}" download>${t.download}</a></div><button class="andrik-track-share" type="button" data-share="${esc(x.url)}">${t.share}</button><audio class="andrik-audio" data-audio="${i}" controls preload="none" hidden src="${esc(x.url)}"></audio></article>`}).join('');
}
async function load({force=false}={}){
 if(loading)return;loading=true;
 try{
   const r=await fetch(`/api/music/singles?r616=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}});
   const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);
   const tracks=Array.isArray(d.tracks)?d.tracks:[];
   const next=tracks.map(x=>`${x.key}|${x.publishedAt||x.uploaded||''}|${x.title||''}`).join('\n');
   if(force||next!==fingerprint){fingerprint=next;render(tracks)}
 }catch(_){if(!fingerprint)root.innerHTML=`<div class="andrik-singles-empty">${t.error}</div>`}
 finally{loading=false}
}
root.innerHTML=`<div class="andrik-singles-empty">${t.loading}</div>`;
root.addEventListener('click',e=>{
 const share=e.target.closest('[data-share]');if(share){copyLink(share.dataset.share,share);return}
 const b=e.target.closest('[data-play]');if(!b)return;
 const a=root.querySelector(`[data-audio="${b.dataset.play}"]`);if(!a)return;
 a.hidden=false;
 if(a.paused){root.querySelectorAll('audio').forEach(o=>{if(o!==a)o.pause()});root.querySelectorAll('[data-play]').forEach(x=>x.textContent=t.play);a.play().catch(()=>{});b.textContent=t.pause}
 else{a.pause();b.textContent=t.play}
});
load({force:true});
const interval=setInterval(()=>{if(!document.hidden)load()},limit?20000:60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load({force:true})});
window.addEventListener('storage',e=>{if(e.key==='andrik-single-r616')load({force:true})});
try{const bc=new BroadcastChannel('andrik-music-r616');bc.addEventListener('message',()=>load({force:true}));window.addEventListener('pagehide',()=>bc.close(),{once:true})}catch(_){}
window.addEventListener('pagehide',()=>clearInterval(interval),{once:true});
})();
