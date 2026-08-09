
(function(){
  var root=document.documentElement;
  var timer=0;
  function lock(){
    clearTimeout(timer);
    root.classList.add('live-web-ai-resume-lock');
    timer=setTimeout(function(){
      requestAnimationFrame(function(){requestAnimationFrame(function(){root.classList.remove('live-web-ai-resume-lock');});});
    },720);
  }
  window.__liveWebAiResumeLock=lock;
  lock();
  window.addEventListener('pageshow',lock,{passive:true});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)lock();},{passive:true});
})();
