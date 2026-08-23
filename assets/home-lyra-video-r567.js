(()=>{
'use strict';
const video=document.getElementById('lyraHeroVideoR567');
const hero=document.querySelector('.lyra-hero-r567');
if(!video||!hero)return;
video.muted=true;
video.defaultMuted=true;
video.playsInline=true;
video.setAttribute('muted','');
video.setAttribute('playsinline','');
const markPlaying=()=>hero.classList.add('video-playing');
const tryPlay=()=>{
  try{
    const p=video.play();
    if(p&&typeof p.then==='function')p.then(markPlaying).catch(()=>{});
  }catch(_){ }
};
video.addEventListener('playing',markPlaying,{passive:true});
video.addEventListener('canplay',tryPlay,{passive:true});
video.addEventListener('loadeddata',tryPlay,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tryPlay();},{passive:true});
['pointerdown','touchstart','click'].forEach(type=>document.addEventListener(type,tryPlay,{once:true,passive:true}));
if(video.readyState>=2)tryPlay();
else { try{video.load()}catch(_){ } setTimeout(tryPlay,120); setTimeout(tryPlay,900); }
})();
