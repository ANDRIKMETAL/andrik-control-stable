/* ANDRIK R482 — native clip library: R2-only media, no bundled video fallback. */
(()=>{'use strict';
  const sources={
    'ya-est':{primary:'/api/media/video/ya-est.mp4'},
    'prosnis':{primary:'/api/media/video/prosnis-fragment.mp4'}
  };
  const ready=(video,card,url,isFallback)=>{
    video.src=url; card.classList.add('is-ready'); if(isFallback)card.classList.add('is-local-fallback'); else card.classList.remove('is-local-fallback');
    const dl=card.querySelector('[data-clip-download-r481]');
    if(dl){
      const next=isFallback?(dl.dataset.localDownloadR481||url):(dl.dataset.r2DownloadR481||dl.getAttribute('href')||url);
      dl.href=next;
    }
    video.load();
  };
  document.querySelectorAll('video[data-r2-home-clip-r481]').forEach(video=>{
    const id=video.dataset.r2HomeClipR481||'',cfg=sources[id],card=video.closest('[data-clip-card-r481]');
    if(!cfg||!card)return;
    fetch(cfg.primary,{method:'HEAD',cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('not-ready');ready(video,card,cfg.primary,false);}).catch(()=>{
      if(cfg.fallback){ready(video,card,cfg.fallback,true);}else{card.classList.remove('is-ready');}
    });
  });
  document.addEventListener('play',e=>{
    const target=e.target;if(!(target instanceof HTMLMediaElement))return;
    document.querySelectorAll('audio,video').forEach(media=>{if(media!==target&&!media.paused){try{media.pause()}catch(_){}}});
  },true);
})();
