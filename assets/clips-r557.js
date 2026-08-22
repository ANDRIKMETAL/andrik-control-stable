/* ANDRIK R557 — dedicated R2 video library: JOY OF BEING + Lyra promo + archive clips. */
(()=>{'use strict';
const sources={
  'joy-of-being':'/api/media/video/joy-of-being.mp4',
  'lyra-promo':'/api/media/promo/lyra-trika.mp4',
  'ya-est':'/api/media/video/ya-est.mp4',
  'prosnis':'/api/media/video/prosnis-fragment.mp4'
};
document.querySelectorAll('video[data-r2-clip-r557]').forEach(video=>{
  const id=video.dataset.r2ClipR557||'',url=sources[id],card=video.closest('[data-clip-card-r557]');
  if(!url||!card)return;
  fetch(url,{method:'HEAD',cache:'no-store'}).then(r=>{
    if(!r.ok)throw new Error('not-ready');
    video.src=url;card.classList.add('is-ready');
    const dl=card.querySelector('[data-clip-download-r557]');
    if(dl)dl.href=dl.dataset.r2DownloadR557||dl.href;
    video.load();
  }).catch(()=>card.classList.remove('is-ready'));
});
document.addEventListener('play',e=>{
  const t=e.target;if(!(t instanceof HTMLMediaElement))return;
  document.querySelectorAll('audio,video').forEach(m=>{if(m!==t&&!m.paused){try{m.pause()}catch(_){}}});
},true);
})();
