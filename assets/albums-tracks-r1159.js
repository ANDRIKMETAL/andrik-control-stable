/* ANDRIK R1159 — native fast players + per-track MP3 downloads for every album */
(()=>{'use strict';
const LANG=String(document.documentElement.lang||'ru').toLowerCase().split('-')[0];
const C={
 ru:{summary:'Треки альбома · слушать / скачать',loading:'Загружаем треки из R2…',empty:'MP3 этого альбома ещё не загружены в R2.',download:'↓ MP3'},
 uk:{summary:'Треки альбому · слухати / завантажити',loading:'Завантажуємо треки з R2…',empty:'MP3 цього альбому ще не завантажені в R2.',download:'↓ MP3'},
 sk:{summary:'Skladby albumu · počúvať / stiahnuť',loading:'Načítavam skladby z R2…',empty:'MP3 tohto albumu ešte nie sú v R2.',download:'↓ MP3'},
 en:{summary:'Album tracks · listen / download',loading:'Loading tracks from R2…',empty:'This album has no MP3 files in R2 yet.',download:'↓ MP3'}
}[LANG]||null;
const slugFor=id=>id==='album-illusion'?'illusion-of-life':String(id||'').replace(/^album-/,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const articles=[...document.querySelectorAll('#discography article.album-card[id^="album-"]')];if(!articles.length)return;
const nodes=new Map();
for(const article of articles){const slug=slugFor(article.id),info=article.querySelector('.album-info');if(!slug||!info)continue;const d=document.createElement('details');d.className='album-track-spoiler-r1159';d.dataset.albumTracks=slug;d.innerHTML=`<summary>${C.summary}</summary><div class="album-track-list-r1159"><div class="album-track-empty-r1159">${C.loading}</div></div>`;info.appendChild(d);nodes.set(slug,d)}
const stopOthers=audio=>document.querySelectorAll('.album-track-spoiler-r1159 audio').forEach(a=>{if(a!==audio&&!a.paused)a.pause()});
document.addEventListener('play',e=>{if(e.target instanceof HTMLAudioElement&&e.target.closest('.album-track-spoiler-r1159'))stopOthers(e.target)},true);
fetch('/api/music/albums/status?r1159='+Date.now(),{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}).then(data=>{
 const by=new Map((data.albums||[]).map(a=>[String(a.slug||''),a]));
 for(const [slug,d] of nodes){const list=d.querySelector('.album-track-list-r1159'),a=by.get(slug),tracks=Array.isArray(a?.tracks)?a.tracks:[];if(!tracks.length){list.innerHTML=`<div class="album-track-empty-r1159">${C.empty}</div>`;continue}list.innerHTML=tracks.map((t,i)=>{const n=String(t.track||i+1).padStart(2,'0'),title=t.title||t.key||`Track ${i+1}`,src=t.url||('https://music.andrikmetal.com/'+String(t.key||'')),dl=t.downloadUrl||('/api/music/download?key='+encodeURIComponent(t.key||''));return `<div class="album-track-row-r1159"><div class="album-track-name-r1159"><b>${esc(n)}.</b> ${esc(title)}</div><a class="album-track-download-r1159" href="${esc(dl)}">${C.download}</a><audio controls preload="none" src="${esc(src)}"></audio></div>`}).join('')}
}).catch(()=>{for(const d of nodes.values()){const list=d.querySelector('.album-track-list-r1159');if(list)list.innerHTML=`<div class="album-track-empty-r1159">${C.empty}</div>`}});
})();
