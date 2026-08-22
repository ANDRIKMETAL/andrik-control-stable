/* ANDRIK R559 — fast long-form video playback: direct R2 first, byte-range API fallback. */
(()=>{'use strict';
const R2='https://music.andrikmetal.com/';
const sources={
  'joy-of-being':{direct:R2+'clips/joy-of-being-official-2026.mp4',fallback:'/api/media/video/joy-of-being.mp4'},
  'lyra-promo':{direct:R2+'promo/lyra-trika-2026.mp4',fallback:'/api/media/promo/lyra-trika.mp4'},
  'ya-est':{direct:R2+'clips/ya-est-official-2026.mp4',fallback:'/api/media/video/ya-est.mp4'},
  'prosnis':{direct:R2+'clips/prosnis-fragment-2026.mp4',fallback:'/api/media/video/prosnis-fragment.mp4'}
};
function activate(video,card,src,isFallback=false){
  if(!src)return;
  video.dataset.r2FallbackUsed=isFallback?'1':'0';
  video.src=src;
  video.preload='metadata';
  try{video.load()}catch(_){}
}
document.querySelectorAll('video[data-r2-clip-r557]').forEach(video=>{
  const id=video.dataset.r2ClipR557||'',cfg=sources[id],card=video.closest('[data-clip-card-r557]');
  if(!cfg||!card)return;
  let fallbackTimer=0;
  const ready=()=>{
    clearTimeout(fallbackTimer);
    card.classList.add('is-ready');
    const missing=card.querySelector('.clip-missing-r483');
    if(missing)missing.hidden=true;
  };
  const fallback=()=>{
    if(video.dataset.r2FallbackUsed==='1')return;
    clearTimeout(fallbackTimer);
    activate(video,card,cfg.fallback,true);
  };
  video.addEventListener('loadedmetadata',ready,{passive:true});
  video.addEventListener('canplay',ready,{passive:true});
  video.addEventListener('error',fallback,{passive:true});
  video.addEventListener('play',()=>{
    if(video.readyState<2 && video.dataset.r2FallbackUsed!=='1'){
      clearTimeout(fallbackTimer);
      fallbackTimer=setTimeout(()=>{if(video.readyState<2)fallback()},6500);
    }
  },{passive:true});
  // Do not HEAD-probe a cross-origin R2 object. Let the media element request
  // only the metadata/ranges it needs; this is much faster for 70–300 MB MP4s.
  activate(video,card,cfg.direct,false);
});
document.addEventListener('play',e=>{
  const t=e.target;if(!(t instanceof HTMLMediaElement))return;
  document.querySelectorAll('audio,video').forEach(m=>{if(m!==t&&!m.paused){try{m.pause()}catch(_){}}});
},true);
})();
