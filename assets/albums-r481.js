/* ANDRIK R447 — public album ZIP availability */
(()=>{'use strict';
  const buttons=[...document.querySelectorAll('[data-album-download]')];if(!buttons.length)return;
  const lang=(document.documentElement.lang||'ru').toLowerCase();
  const copy={
    ru:{ready:'⬇ Скачать альбом целиком',wait:'ZIP готовится',size:'ZIP'},
    uk:{ready:'⬇ Завантажити альбом повністю',wait:'ZIP готується',size:'ZIP'},
    sk:{ready:'⬇ Stiahnuť celý album',wait:'ZIP sa pripravuje',size:'ZIP'},
    en:{ready:'⬇ Download full album',wait:'ZIP is being prepared',size:'ZIP'}
  }[lang]||{ready:'⬇ Download full album',wait:'ZIP is being prepared',size:'ZIP'};
  const fmt=n=>{n=Number(n||0);if(!n)return '';const mb=n/1024/1024;return mb>=1024?(mb/1024).toFixed(1)+' GB':mb.toFixed(mb>=100?0:1)+' MB'};
  buttons.forEach(b=>{b.classList.add('is-disabled');b.removeAttribute('href');b.textContent=copy.wait});
  fetch('/api/music/albums/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))).then(d=>{
    const map=new Map((d.albums||[]).map(a=>[a.slug,a]));
    buttons.forEach(b=>{const a=map.get(b.dataset.albumDownload),z=a?.zip;if(z?.exists){b.classList.remove('is-disabled');b.href=z.downloadUrl||('/api/music/album-download?album='+encodeURIComponent(a.slug));b.textContent=copy.ready;b.title=z.size?`${copy.size}: ${fmt(z.size)}`:copy.ready}else{b.classList.add('is-disabled');b.removeAttribute('href');b.textContent=copy.wait}});
  }).catch(()=>{});
})();

/* R481 — floating player button intentionally removed from Albums. */
