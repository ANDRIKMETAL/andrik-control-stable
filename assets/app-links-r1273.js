(() => {
'use strict';
const isAndroid=/Android/i.test(navigator.userAgent||'');
const selector='a[data-force-app="youtube"][data-web-url]';
const LIVE_TARGET_API='/api/public/youtube-live-target';
let cachedLive=null,liveFetch=null;
function youtubeVideoId(rawUrl){
 try{const u=new URL(rawUrl,location.href),host=u.hostname.toLowerCase();if(host==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||'';if(host.endsWith('youtube.com')){const v=u.searchParams.get('v');if(v)return v;const p=u.pathname.split('/').filter(Boolean);if(['live','shorts','embed'].includes(p[0]))return p[1]||''}}catch(_){}return '';
}
function navigationWatch(){let left=false;const mark=()=>{left=true};document.addEventListener('visibilitychange',()=>{if(document.hidden)mark()},{once:true});window.addEventListener('pagehide',mark,{once:true});window.addEventListener('blur',mark,{once:true});return()=>left||document.hidden}
function genericYoutubeIntent(webUrl){try{const u=new URL(webUrl,location.href);const path=`${u.pathname||'/'}${u.search||''}${u.hash||''}`.replace(/^\//,'');return `intent://${u.host}/${path}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(u.href)};end`}catch(_){return webUrl}}
function launchAppFirst(webUrl,id){
 const clean=String(id||'').trim();
 if(!/^[A-Za-z0-9_-]{11}$/.test(clean)){try{window.location.href=genericYoutubeIntent(webUrl)}catch(_){window.location.href=webUrl}return}
 const didLeave=navigationWatch();
 // IMPORTANT R1273: launch synchronously inside the real tap. Android allows the app handoff.
 try{window.location.href=`vnd.youtube:${clean}`}catch(_){}
 setTimeout(()=>{if(!didLeave()){try{window.location.href=genericYoutubeIntent(webUrl||`https://www.youtube.com/watch?v=${clean}`)}catch(_){window.location.href=webUrl}}},1300);
}
async function fetchCurrentLiveTarget(force=false){
 if(!force&&cachedLive?.id&&Date.now()-cachedLive.at<15000)return cachedLive;
 if(liveFetch)return liveFetch;
 liveFetch=(async()=>{try{const res=await fetch(`${LIVE_TARGET_API}?fresh=1&ts=${Date.now()}`,{cache:'no-store',credentials:'include',headers:{accept:'application/json','cache-control':'no-cache'}});const data=await res.json().catch(()=>({}));const direct=String(data?.watchUrl||'');const id=String(data?.videoId||'')||youtubeVideoId(direct);if(res.ok&&/^[A-Za-z0-9_-]{11}$/.test(id)&&data?.active===true){cachedLive={id,url:direct||`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,at:Date.now()};return cachedLive}}catch(_){}return null})().finally(()=>{liveFetch=null});
 return liveFetch;
}
function applyLive(link,live){if(!link||!live?.id)return;link.dataset.youtubeLiveId=live.id;link.dataset.webUrl=live.url;link.href=live.url}
function prepare(root=document){root.querySelectorAll(selector).forEach(link=>{const webUrl=link.getAttribute('data-web-url')||link.getAttribute('href');if(!webUrl)return;link.setAttribute('href',webUrl);link.setAttribute('rel','noopener noreferrer external');if(isAndroid)link.removeAttribute('target')})}
async function preloadLive(){const links=[...document.querySelectorAll(selector)].filter(link=>link.dataset.youtubeLiveAuto==='1');if(!links.length)return;const live=await fetchCurrentLiveTarget(true);if(!live?.id)return;links.forEach(link=>applyLive(link,live))}
function openYoutubeFromRealTap(event,link){if(!isAndroid)return;const webUrl=link.getAttribute('data-web-url')||link.href||'';const knownId=link.getAttribute('data-youtube-live-id')||youtubeVideoId(webUrl)||cachedLive?.id||'';event.preventDefault();event.stopPropagation();if(knownId){launchAppFirst(webUrl,knownId);return}try{window.location.href=genericYoutubeIntent(webUrl)}catch(_){window.location.href=webUrl}}
const boot=()=>{prepare();preloadLive();setInterval(preloadLive,15000)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
document.addEventListener('click',event=>{const link=event.target.closest?.(selector);if(!link)return;openYoutubeFromRealTap(event,link)},true);
})();
