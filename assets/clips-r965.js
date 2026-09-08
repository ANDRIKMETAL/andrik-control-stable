/* ANDRIK R965 — render every public full R2 clip with lazy preview + real MP4 download. */
(()=>{'use strict';
const API='/api/music/clips-r965';
const targets=[...document.querySelectorAll('[data-clips-r965]')];if(!targets.length)return;
const lang=(document.documentElement.lang||'ru').toLowerCase().slice(0,2);
const L={
 ru:{loading:'Загружаю все клипы из R2…',empty:'В R2 пока нет клипов.',err:'Не удалось загрузить видеотеку.',kicker:'ПОЛНЫЙ КЛИП · R2',preview:'Быстрый просмотр',tap:'Нажми — видео откроется прямо здесь',dl:'MP4 ↓',full:'полный файл',ready:'R2 · полный MP4'},
 uk:{loading:'Завантажую всі кліпи з R2…',empty:'У R2 поки немає кліпів.',err:'Не вдалося завантажити відеотеку.',kicker:'ПОВНИЙ КЛІП · R2',preview:'Швидкий перегляд',tap:'Натисни — відео відкриється тут',dl:'MP4 ↓',full:'повний файл',ready:'R2 · повний MP4'},
 sk:{loading:'Načítavam všetky klipy z R2…',empty:'V R2 zatiaľ nie sú klipy.',err:'Videotéku sa nepodarilo načítať.',kicker:'CELÝ KLIP · R2',preview:'Rýchly náhľad',tap:'Ťukni — video sa otvorí priamo tu',dl:'MP4 ↓',full:'celý súbor',ready:'R2 · celý MP4'},
 en:{loading:'Loading every video from R2…',empty:'No videos are in R2 yet.',err:'Could not load the video library.',kicker:'FULL VIDEO · R2',preview:'Quick preview',tap:'Tap to play the full video here',dl:'MP4 ↓',full:'full file',ready:'R2 · full MP4'}
}[lang]||null;
const T=L||({loading:'Загружаю все клипы из R2…',empty:'В R2 пока нет клипов.',err:'Не удалось загрузить видеотеку.',kicker:'ПОЛНЫЙ КЛИП · R2',preview:'Быстрый просмотр',tap:'Нажми — видео откроется прямо здесь',dl:'MP4 ↓',full:'полный файл',ready:'R2 · полный MP4'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const fmt=n=>{n=Number(n)||0;if(n<1024)return n+' B';if(n<1024**2)return (n/1024).toFixed(1)+' KB';if(n<1024**3)return (n/1024**2).toFixed(n<10*1024**2?1:0)+' MB';return (n/1024**3).toFixed(2)+' GB'};
const date=v=>{const d=new Date(v||0);return Number.isFinite(d.getTime())?d.toLocaleDateString(lang==='en'?'en-US':lang==='sk'?'sk-SK':lang==='uk'?'uk-UA':'ru-RU',{year:'numeric',month:'short',day:'numeric'}):''};
const dur=s=>{s=Math.max(0,Math.floor(Number(s)||0));const m=Math.floor(s/60),r=s%60;return `${m}:${String(r).padStart(2,'0')}`};
function card(c,home){const file=String(c.name||c.key.split('/').pop()||'ANDRIK-video.mp4');return `<article class="clip-r965-card" data-r965-card data-key="${attr(c.key)}">
 <div class="clip-r965-head"><div class="clip-r965-copy"><span class="clip-r965-kicker">${T.kicker}</span><h3 class="clip-r965-title">${esc(c.title||file)}</h3><p class="clip-r965-meta" data-r965-meta>${esc(fmt(c.size))}${c.uploaded?' · '+esc(date(c.uploaded)):''} · ${esc(T.full)}</p></div><a class="clip-r965-download" href="${attr(c.downloadUrl)}" download="${attr(file)}">${T.dl}</a></div>
 <div class="clip-r965-stage" data-r965-stage><video controls playsinline preload="none" aria-label="${attr(c.title||file)}"></video><button class="clip-r965-cover" type="button" data-r965-preview><span><span class="clip-r965-play">▶</span><strong>${esc(c.title||file)}</strong><small>${T.preview} · ${T.tap}</small></span></button></div>
 <div class="clip-r965-foot"><span class="clip-r965-badge">${T.ready}</span><span class="clip-r965-key">${esc(c.key)}</span></div>
 </article>`}
function wire(root,clips){const byKey=new Map(clips.map(c=>[String(c.key||''),c]));root.querySelectorAll('[data-r965-card]').forEach((el,i)=>{const c=byKey.get(String(el.dataset.key||''))||clips[i],video=el.querySelector('video'),cover=el.querySelector('[data-r965-preview]'),stage=el.querySelector('[data-r965-stage]'),meta=el.querySelector('[data-r965-meta]');if(!c||!video||!cover)return;
 const load=()=>{if(!video.src){video.src=c.url;video.load()}cover.hidden=true;video.play().catch(()=>{});};cover.addEventListener('click',load);
 video.addEventListener('loadedmetadata',()=>{if(video.videoHeight>video.videoWidth)stage.classList.add('is-vertical');const bits=[fmt(c.size),c.uploaded?date(c.uploaded):'',dur(video.duration),T.full].filter(Boolean);meta.textContent=bits.join(' · ');},{passive:true});
 video.addEventListener('play',()=>{document.querySelectorAll('audio,video').forEach(m=>{if(m!==video&&!m.paused){try{m.pause()}catch(_){}}});},{passive:true});
 video.addEventListener('error',()=>{cover.hidden=false;cover.querySelector('small').textContent=T.err;},{passive:true});
 });}
async function run(){targets.forEach(t=>t.innerHTML=`<div class="clips-r965-status">${T.loading}</div>`);try{const r=await fetch(API+'?ts='+Date.now(),{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.message||d.error||('HTTP '+r.status));const clips=Array.isArray(d.clips)?d.clips:[];targets.forEach(t=>{if(!clips.length){t.innerHTML=`<div class="clips-r965-status">${T.empty}</div>`;return}const home=t.dataset.mode==='home';t.innerHTML=`<div class="clips-r965-grid">${clips.map(c=>card(c,home)).join('')}</div>`;wire(t,clips)});}catch(e){console.warn('[R965 clips]',e);targets.forEach(t=>t.innerHTML=`<div class="clips-r965-status">${T.err}</div>`);}}
run();
})();
