/* R1453: current radio URL and independent automatic last-video discovery. */
(()=>{'use strict';
const LIVE_URL='https://www.youtube.com/@andrikmetal/live';
let currentRadioUrl=LIVE_URL;
async function refreshRadioUrl(){try{const response=await fetch('/api/public/youtube-live-target?fresh=1&ts='+Date.now(),{cache:'no-store'});const data=await response.json();const id=String(data?.videoId||'');currentRadioUrl=response.ok&&data?.active===true&&/^[A-Za-z0-9_-]{11}$/.test(id)?'https://www.youtube.com/watch?v='+id:LIVE_URL;fixRadioCard()}catch(_){currentRadioUrl=LIVE_URL;fixRadioCard()}}
const SINGLE_URL='/singles?view=all&v=1453';
// The main page uses the existing /api/public/youtube-latest discovery. Do not
// replace it: a NEW non-radio upload must automatically become the latest card.
const isRadioTitle=(title)=>/(?:\bradio\b|\blive\s*24\s*\/\s*7\b|\b24\s*\/\s*7\b|радио\s*24|прямой\s*эфир|радіо\s*24)/i.test(title||'');
function fixRadioCard(){
  const a=document.getElementById('homeLatestVideo');
  const h=document.getElementById('homeVideoTitle');
  if(!a||!h||!isRadioTitle(h.textContent))return;
  if(a.getAttribute('href')!==currentRadioUrl)a.setAttribute('href',currentRadioUrl);
  if(a.dataset.webUrl!==currentRadioUrl)a.dataset.webUrl=currentRadioUrl;
  const id=/[?&]v=([A-Za-z0-9_-]{11})/.exec(currentRadioUrl)?.[1]||'';
  if(id)a.dataset.youtubeLiveId=id;else delete a.dataset.youtubeLiveId;
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
    fixRadioCard();refreshRadioUrl();
    window.setInterval(()=>{if(!document.hidden)refreshRadioUrl()},60000);
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
