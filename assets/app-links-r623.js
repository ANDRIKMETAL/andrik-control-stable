(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const RADIO_GO = '/radio-live';
  const CHANNEL_LIVE_RE = /^https:\/\/(?:www\.|m\.)?youtube\.com\/@andrikmetal\/live(?:[/?#]|$)/i;
  let liveTargetCache={url:'',id:'',at:0};

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  function androidYoutubeIntent(videoId, webUrl) {
    const fallback=encodeURIComponent(webUrl);
    // No package is pinned: Android can use official YouTube, ReVanced/RVX or any
    // other registered YouTube handler. Browser is only the final fallback.
    return `intent://www.youtube.com/watch?v=${encodeURIComponent(videoId)}#Intent;scheme=https;S.browser_fallback_url=${fallback};end`;
  }

  async function fetchOneLiveTarget(fresh=true) {
    try {
      const res = await fetch(`${LIVE_TARGET_API}?fresh=${fresh?'1':'0'}&ts=${Date.now()}`, {
        cache:'no-store', headers:{accept:'application/json'}
      });
      const data = await res.json().catch(() => ({}));
      const direct = String(data?.watchUrl || '');
      const id = String(data?.videoId || youtubeVideoId(direct) || '').trim();
      if (res.ok && id && data?.active === true) {
        const url = direct && youtubeVideoId(direct) === id ? direct : `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
        liveTargetCache={url,id,at:Date.now()};
        return liveTargetCache;
      }
    } catch (_) {}
    return null;
  }

  async function fetchCurrentLiveTarget({fresh=false,retry=false}={}) {
    if(!fresh && liveTargetCache.id && Date.now()-liveTargetCache.at < 20000) return liveTargetCache;
    const waits = retry ? [0,450,900] : [0];
    for (const wait of waits) {
      if(wait) await sleep(wait);
      const found=await fetchOneLiveTarget(true);
      if(found) return found;
    }
    return {url:'',id:'',at:Date.now()};
  }

  function updateLiveLinks(target){
    if(!target?.id)return;
    document.querySelectorAll(selector).forEach(link=>{
      if(link.dataset.youtubeLiveAuto==='1'){
        link.setAttribute('data-web-url',target.url);
        link.setAttribute('href',target.url);
        link.setAttribute('data-youtube-live-id',target.id);
      }
    });
  }

  async function openYoutubeFromRealTap(event, link) {
    const isLiveAuto=link.dataset.youtubeLiveAuto==='1';
    if (!isLiveAuto && !isAndroid) return;
    event.preventDefault();

    if(!isLiveAuto){
      const webUrl=link.getAttribute('data-web-url')||link.href;
      const id=youtubeVideoId(webUrl);
      if(isAndroid && id){ location.href=androidYoutubeIntent(id,webUrl); return; }
      location.href=webUrl; return;
    }

    // R623: never hand Android /@andrikmetal/live or an old cached id.
    // Resolve the actually LIVE video on the tap and retry briefly for a just-created stream.
    link.setAttribute('aria-busy','true');
    const current=await fetchCurrentLiveTarget({fresh:true,retry:true});
    link.removeAttribute('aria-busy');
    if(current.id){
      updateLiveLinks(current);
      if(isAndroid){ location.href=androidYoutubeIntent(current.id,current.url); return; }
      location.href=current.url; return;
    }

    // One last server-side resolution. If YouTube has not exposed a LIVE id yet,
    // /radio-live opens the channel Streams page — never an obsolete recording.
    location.href=`${RADIO_GO}?ts=${Date.now()}`;
  }

  function prepare(root = document) {
    root.querySelectorAll(selector).forEach(link => {
      const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
      if (!webUrl) return;
      if(CHANNEL_LIVE_RE.test(webUrl) || link.hasAttribute('data-youtube-live-auto')) link.dataset.youtubeLiveAuto='1';
      if(link.dataset.youtubeLiveAuto==='1'){
        link.setAttribute('href',RADIO_GO);
        link.setAttribute('data-web-url',RADIO_GO);
      }else{
        link.setAttribute('href',webUrl);
      }
      link.setAttribute('rel', 'noopener noreferrer external');
      if (isAndroid) link.removeAttribute('target');
    });
  }

  async function preloadCurrentLiveTarget() {
    const links = [...document.querySelectorAll(selector)].filter(link => link.dataset.youtubeLiveAuto==='1');
    if (!links.length) return;
    const current=await fetchCurrentLiveTarget({fresh:false,retry:false});
    updateLiveLinks(current);
  }

  const boot = () => {
    prepare();
    preloadCurrentLiveTarget();
    setInterval(preloadCurrentLiveTarget, 30000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    void openYoutubeFromRealTap(event, link);
  }, true);
})();
