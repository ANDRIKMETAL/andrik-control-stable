/* ANDRIK R446 — public album ZIP availability */
(()=>{'use strict';
  const buttons=[...document.querySelectorAll('[data-album-download]')];if(!buttons.length)return;
  const lang=(document.documentElement.lang||'ru').toLowerCase();
  const copy={
    ru:{ready:'⬇ Скачать альбом ZIP',wait:'ZIP готовится',size:'ZIP'},
    uk:{ready:'⬇ Завантажити альбом ZIP',wait:'ZIP готується',size:'ZIP'},
    sk:{ready:'⬇ Stiahnuť album ZIP',wait:'ZIP sa pripravuje',size:'ZIP'},
    en:{ready:'⬇ Download album ZIP',wait:'ZIP is being prepared',size:'ZIP'}
  }[lang]||{ready:'⬇ Download album ZIP',wait:'ZIP is being prepared',size:'ZIP'};
  const fmt=n=>{n=Number(n||0);if(!n)return '';const mb=n/1024/1024;return mb>=1024?(mb/1024).toFixed(1)+' GB':mb.toFixed(mb>=100?0:1)+' MB'};
  buttons.forEach(b=>{b.classList.add('is-disabled');b.removeAttribute('href');b.textContent=copy.wait});
  fetch('/api/music/albums/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))).then(d=>{
    const map=new Map((d.albums||[]).map(a=>[a.slug,a]));
    buttons.forEach(b=>{const a=map.get(b.dataset.albumDownload),z=a?.zip;if(z?.exists){b.classList.remove('is-disabled');b.href=z.downloadUrl||('/api/music/album-download?album='+encodeURIComponent(a.slug));b.textContent=copy.ready+(z.size?' · '+fmt(z.size):'')}else{b.classList.add('is-disabled');b.removeAttribute('href');b.textContent=copy.wait}});
  }).catch(()=>{});
})();
