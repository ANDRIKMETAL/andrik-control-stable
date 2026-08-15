/* ANDRIK R448 — public album ZIP availability */
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


/* R448 — floating player access on the dedicated albums page. */
(()=>{
  'use strict';
  if(window.self!==window.top)return;
  const make=()=>{
    if(document.getElementById('andrik-standalone-resume-player')||document.getElementById('albumsPlayerFabR446'))return;
    const lang=(document.documentElement.lang||'ru').toLowerCase();
    const label={ru:'Открыть плеер ANDRIK',uk:'Відкрити плеєр ANDRIK',sk:'Otvoriť prehrávač ANDRIK',en:'Open ANDRIK player'}[lang]||'Открыть плеер ANDRIK';
    const a=document.createElement('a');
    a.id='albumsPlayerFabR446';a.className='albums-player-fab-r446';a.href=`/player.html?lang=${encodeURIComponent(lang)}&collection=illusion&from=albums`;
    a.setAttribute('aria-label',label);a.title=label;
    a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8L18.5 12 8 5.6Z"/></svg>';
    document.body.appendChild(a);
  };
  const schedule=()=>setTimeout(make,180);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
