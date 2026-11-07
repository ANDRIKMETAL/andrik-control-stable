(() => {
'use strict';
const isAndroid = /Android/i.test(navigator.userAgent || '');
const selector = 'a[data-force-app="youtube"][data-web-url]';
const LIVE_TARGET_API = '/api/public/youtube-live-target';
// R1266: fresh check on each revalidation; markup contains a working seed until discovery succeeds.
let cachedLive = null;
let liveFetch = null;
function youtubeVideoId(rawUrl) {
try {
const u = new URL(rawUrl, location.href);
const host = u.hostname.toLowerCase();
if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] || '';
if (host.endsWith('youtube.com')) {
const watch = u.searchParams.get('v');
if (watch) return watch;
const parts = u.pathname.split('/').filter(Boolean);
if (parts[0] === 'live' || parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] || '';
}
} catch (_) {}
return '';
}
function navigationWatch() {
let left = false;
const mark = () => { left = true; };
document.addEventListener('visibilitychange', () => { if (document.hidden) mark(); }, {once:true});
window.addEventListener('pagehide', mark, {once:true});
window.addEventListener('blur', mark, {once:true});
return () => left || document.hidden;
}
function genericYoutubeIntent(webUrl, id='') {
try {
// A direct Android intent with the official YouTube package preserves the
// actual tap gesture. The earlier delayed generic intent opened a webview.
const u = new URL(id ? `https://www.youtube.com/watch?v=${id}` : webUrl,location.href);
const path = `${u.pathname || '/'}${u.search || ''}${u.hash || ''}`.replace(/^\//,'');
return `intent://${u.host}/${path}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
} catch (_) { return webUrl; }
}
function launchAppFirst(webUrl,id) {
const intent=genericYoutubeIntent(webUrl,id);
try { window.location.assign(intent); } catch (_) { window.location.assign(webUrl); }
}
async function fetchCurrentLiveTarget() {
if (cachedLive?.id && Date.now() - cachedLive.at < 20000) return cachedLive;
if (liveFetch) return liveFetch;
liveFetch = (async () => {
try {
const res = await fetch(`${LIVE_TARGET_API}?fresh=1&ts=${Date.now()}`, {
cache:'no-store',
credentials:'include',
headers:{accept:'application/json','cache-control':'no-cache'}
});
const data = await res.json().catch(() => ({}));
const direct = String(data?.watchUrl || '');
const id = String(data?.videoId || '') || youtubeVideoId(direct);
if (res.ok && /^[A-Za-z0-9_-]{11}$/.test(id) && data?.active === true) {
cachedLive = {
id,
url: direct || `https://www.youtube.com/live/${encodeURIComponent(id)}`,
at: Date.now()
};
return cachedLive;
}
} catch (_) {}
cachedLive=null;
return null;
})().finally(() => { liveFetch = null; });
return liveFetch;
}
function applyLive(link, live) {
if (!link || !live?.id) return;
link.dataset.youtubeLiveId = live.id;
link.dataset.webUrl = live.url;
link.href = live.url;
}
function prepare(root = document) {
root.querySelectorAll(selector).forEach(link => {
const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
if (!webUrl) return;
link.setAttribute('href', webUrl);
link.setAttribute('rel', 'noopener noreferrer external');
if (isAndroid) link.removeAttribute('target');
});
}
async function preloadLive() {
if(document.hidden) return;
const links = [...document.querySelectorAll(selector)]
.filter(link => link.dataset.youtubeLiveAuto === '1');
if (!links.length) return;
const live = await fetchCurrentLiveTarget();
if (!live?.id){links.forEach(link=>{link.href='https://www.youtube.com/@andrikmetal/live';link.dataset.webUrl=link.href;delete link.dataset.youtubeLiveId;});return;}
links.forEach(link => applyLive(link, live));
}
function openYoutubeFromRealTap(event, link) {
if (!isAndroid) return;
const webUrl = link.getAttribute('data-web-url') || link.href || '';
const knownId =
link.getAttribute('data-youtube-live-id') ||
youtubeVideoId(webUrl) ||
'';
if (knownId) {
event.preventDefault();
event.stopPropagation();
launchAppFirst(webUrl, knownId);
return;
}
event.preventDefault();
event.stopPropagation();
try { window.location.assign(genericYoutubeIntent(webUrl)); }
catch (_) { window.location.assign(webUrl); }
}
const boot = () => {
prepare();
preloadLive();
setInterval(preloadLive, 60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)preloadLive();});
};
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot, {once:true});
} else {
boot();
}
document.addEventListener('click', event => {
const link = event.target.closest?.(selector);
if (!link) return;
openYoutubeFromRealTap(event, link);
}, true);
})();
