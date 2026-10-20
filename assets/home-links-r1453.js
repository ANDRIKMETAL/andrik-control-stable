/* R1453: current radio URL and independent automatic last-video discovery. */
(()=>{'use strict';
const LIVE_ID='-cEMOdUUAYg';
const LIVE_URL='https://www.youtube.com/live/'+LIVE_ID;
const SINGLE_URL='/singles?view=all&v=1453';
// The main page uses the existing /api/public/youtube-latest discovery. Do not
// replace it: a NEW non-radio upload must automatically become the latest card.
const isRadioTitle=(title)=>/(?:\bradio\b|\blive\s*24\s*\/\s*7\b|\b24\s*\/\s*7\b|радио\s*24|прямой\s*эфир|радіо\s*24)/i.test(title||'');
function fixRadioCard(){
  const a=document.getElementById('homeLatestVideo');
  const h=document.getElementById('homeVideoTitle');
  if(!a||!h||!isRadioTitle(h.textContent))return;
  if(a.getAttribute('href')!==LIVE_URL)a.setAttribute('href',LIVE_URL);
  if(a.dataset.webUrl!==LIVE_URL)a.dataset.webUrl=LIVE_URL;
  // This card opens the YouTube app on Android, exactly like before.
  a.setAttribute('data-force-app','youtube');
}
function boot(){
  // The latest-video loader in home-r1308.js/home-r1192.js is kept intact.
  const latest=document.getElementById('homeLatestVideo');
  const title=document.getElementById('homeVideoTitle');
  if(latest&&title){
    const obs=new MutationObserver(fixRadioCard);
    obs.observe(latest,{attributes:true,attributeFilter:['href','data-web-url']});
    obs.observe(title,{characterData:true,childList:true,subtree:true});
    fixRadioCard();
    window.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
  }
  // Keep the catalogue button above native audio chrome and other visual layers.
  document.querySelectorAll('#singles .andrik-singles-more').forEach(a=>{
    a.href=SINGLE_URL;
    a.setAttribute('aria-label',(a.textContent||'Все синглы').trim());
  });
}
let going=false;
function openSingles(e){
  const target=e.target?.closest?.('a.andrik-singles-more');
  if(!target)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(going)return;
  going=true;
  const go=new URL(SINGLE_URL,window.location.origin).href;
  try { if(window.top&&window.top!==window)window.top.location.assign(go); else window.location.assign(go); }
  catch(_) { window.location.href=go; }
}
// Capture before global music playback listeners, including on mobile.
document.addEventListener('click',openSingles,true);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
