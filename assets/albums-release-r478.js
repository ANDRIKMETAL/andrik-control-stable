/* ANDRIK R478 — album release countdown + native R2 clip. */
(()=>{'use strict';
  const pad=n=>String(Math.max(0,Math.floor(n))).padStart(2,'0');
  const tick=()=>{
    document.querySelectorAll('.trika-release-r478[data-release]').forEach(box=>{
      const target=Date.parse(box.dataset.release||''); if(!Number.isFinite(target))return;
      const diff=target-Date.now(),grid=box.querySelector('.trika-countdown-grid-r478'),done=box.querySelector('.trika-countdown-done-r478');
      if(diff<=0){if(grid)grid.hidden=true;if(done)done.hidden=false;const card=box.closest('.album-trika-r478');const badge=card?.querySelector('.album-trika-soon-badge-r478');if(badge)badge.hidden=true;return}
      if(grid)grid.hidden=false;if(done)done.hidden=true;
      let s=Math.floor(diff/1000);const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);const sec=s%60;
      const vals={days:d,hours:h,minutes:m,seconds:sec};Object.entries(vals).forEach(([k,v])=>{const el=box.querySelector(`[data-unit="${k}"]`);if(el)el.textContent=pad(v)});
    });
  }; tick(); setInterval(tick,1000);
  const video=document.querySelector('video[data-ya-est-r2]'), card=video?.closest('.iam-video-card-r478');
  if(video&&card){
    const url='/api/media/video/ya-est.mp4';
    fetch(url,{method:'HEAD',cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('not-ready');video.src=url;card.classList.add('is-ready');video.load();}).catch(()=>card.classList.remove('is-ready'));
    video.addEventListener('play',()=>document.querySelectorAll('audio').forEach(a=>{if(!a.paused)a.pause()}));
    document.addEventListener('play',e=>{if(e.target instanceof HTMLAudioElement&&!video.paused)video.pause()},true);
  }
})();
