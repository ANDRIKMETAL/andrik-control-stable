(()=>{'use strict';
const root=document.getElementById('andrikSinglesList');if(!root)return;
const limit=Number(root.dataset.limit||0);
const pretty=s=>{try{return decodeURIComponent(String(s||''))}catch(_){return String(s||'')}};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback=t=>String(t||'').replace(/\b\w/g,c=>c.toUpperCase());
const copyLink=async(url,btn)=>{try{await navigator.clipboard.writeText(url);const old=btn.textContent;btn.textContent='✓ Ссылка скопирована';setTimeout(()=>btn.textContent=old,1600)}catch(_){window.prompt('Скопируйте ссылку для браузера',url)}};
fetch('/api/music/singles',{cache:'no-store'}).then(r=>r.json()).then(d=>{
 let a=Array.isArray(d.tracks)?d.tracks:[];if(limit)a=a.slice(0,limit);
 if(!a.length){root.innerHTML='<div class="andrik-singles-empty">Синглы скоро появятся.</div>';return}
 root.innerHTML=a.map((x,i)=>{const title=pretty(x.title).trim()||fallback(x.name);return `<article class="andrik-track"><div class="andrik-track-title">${esc(title)}</div><div class="andrik-track-actions"><button type="button" data-play="${i}">▶ Слушать</button><a href="${esc(x.url)}" download>↓ Скачать MP3</a></div><button class="andrik-track-share" type="button" data-share="${esc(x.url)}">🔗 Поделиться ссылкой</button><audio class="andrik-audio" data-audio="${i}" controls preload="none" hidden src="${esc(x.url)}"></audio></article>`}).join('');
 root.addEventListener('click',e=>{const share=e.target.closest('[data-share]');if(share){copyLink(share.dataset.share,share);return}const b=e.target.closest('[data-play]');if(!b)return;const a=root.querySelector(`[data-audio="${b.dataset.play}"]`);if(!a)return;a.hidden=false;if(a.paused){root.querySelectorAll('audio').forEach(o=>{if(o!==a)o.pause()});a.play().catch(()=>{});b.textContent='❚❚ Пауза'}else{a.pause();b.textContent='▶ Слушать'}})
}).catch(()=>root.innerHTML='<div class="andrik-singles-empty">Не удалось загрузить список синглов.</div>')})();
