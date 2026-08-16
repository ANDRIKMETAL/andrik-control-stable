/* R471 — native R2 promo video loader */
(() => {
  'use strict';
  const MEDIA_URL = '/api/media/promo/lyra-trika.mp4';
  async function initOne(shell){
    const video=shell.querySelector('video[data-r2-promo]');
    if(!video)return;
    try{
      const response=await fetch(MEDIA_URL,{method:'HEAD',cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      video.src=MEDIA_URL;
      shell.classList.remove('is-missing');
    }catch(_){
      shell.classList.add('is-missing');
      video.removeAttribute('src');
    }
  }
  const run=()=>document.querySelectorAll('.andrik-promo-video-r471').forEach(initOne);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
