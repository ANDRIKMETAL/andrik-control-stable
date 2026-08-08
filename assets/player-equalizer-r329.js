/* ANDRIK R329 — equalizer state watchdog. */
(()=>{'use strict';
const app=document.querySelector('.app');
const visualizer=document.getElementById('visualizer');
const playBtn=document.getElementById('playBtn');
if(!app||!visualizer)return;
function sync(){
  const aria=String(playBtn?.getAttribute('aria-label')||'').toLowerCase();
  const playing=app.classList.contains('playing') || /pause|пауза/.test(aria);
  visualizer.classList.toggle('eq-playing-r329',playing);
}
const observer=new MutationObserver(sync);
observer.observe(app,{attributes:true,attributeFilter:['class']});
if(playBtn)observer.observe(playBtn,{attributes:true,attributeFilter:['aria-label']});
document.addEventListener('visibilitychange',sync,{passive:true});
window.addEventListener('pageshow',sync,{passive:true});
sync();
})();