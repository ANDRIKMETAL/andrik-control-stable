(() => {
  'use strict';

  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const selector = 'a[data-force-app="youtube"][data-web-url]';
  const LIVE_TARGET_API = '/api/public/youtube-live-target';
  const CHANNEL_LIVE_RE = /^https:\/\/(?:www\.|m\.)?youtube\.com\/@andrikmetal\/live(?:[/?#]|$)/i;
  let liveTargetCache={url:'',id:'',at:0};

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

  function genericYoutubeIntent(webUrl) {
    try {
      const u = new URL(webUrl, location.href);
      const host = u.hostname || 'www.youtube.com';
      const path = `${u.pathname}${u.search}${u.hash}`.replace(/^\//, '');
      return `intent://${host}/${path}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
    } catch (_) {
      return webUrl;
    }
  }

  function markNavigationWatch() {
    let leftPage = false;
    const markLeft = () => { leftPage = true; };
    document.addEventListener('visibilitychange', () => { if (document.hidden) markLeft(); }, {once:true});
    window.addEventListener('pagehide', markLeft, {once:true});
    window.addEventListener('blur', markLeft, {once:true});
    return () => leftPage || document.hidden;
  }

  async function fetchCurrentLiveTarget({fresh=false}={}) {
    if(!fresh && liveTargetCache.id && Date.now()-liveTargetCache.at < 45000) return liveTargetCache;
    try {
      const res = await fetch(`${LIVE_TARGET_API}?fresh=${fresh?'1':'0'}&ts=${Date.now()}`, {cache:'no-store', headers:{accept:'application/json'}});
      const data = await res.json().catch(() => ({}));
      const direct = String(data?.watchUrl || '');
      const id = youtubeVideoId(direct);
      if (res.ok && id && data?.active !== false) {
        liveTargetCache={url:direct,id,at:Date.now()};
        return liveTargetCache;
      }
    } catch (_) {}
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
    if (!isAndroid && !isLiveAuto) return;
    event.preventDefault();

    let webUrl = link.getAttribute('data-web-url') || link.href;
    let videoId = youtubeVideoId(webUrl);

    // R620: Resolve the radio target again on the actual tap on EVERY platform.
    // A completed broadcast is never reused; the API accepts only eventType=live.
    if(isLiveAuto){
      const current=await fetchCurrentLiveTarget({fresh:true});
      if(current.id){
        webUrl=current.url;
        videoId=current.id;
        updateLiveLinks(current);
      } else {
        // Channel /live is only a final browser fallback when YouTube's live search
        // has not exposed the new id yet. Never pass an old cached video id here.
        webUrl='https://www.youtube.com/@andrikmetal/live';
        videoId='';
      }
    }

    if (!isAndroid) {
      window.location.href=webUrl;
      return;
    }

    const didLeave = markNavigationWatch();
    if (videoId) {
      try { window.location.href = `vnd.youtube:${videoId}`; } catch (_) {}
      setTimeout(() => {
        if (!didLeave()) window.location.href = webUrl;
      }, 1300);
      return;
    }

    // No verified active video id: use the browser channel-live resolver instead of
    // handing a stale video id to YouTube / ReVanced / RVX.
    window.location.href = webUrl;
  }

  function prepare(root = document) {
    root.querySelectorAll(selector).forEach(link => {
      const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
      if (!webUrl) return;
      if(CHANNEL_LIVE_RE.test(webUrl) || link.hasAttribute('data-youtube-live-auto')) link.dataset.youtubeLiveAuto='1';
      link.setAttribute('href', webUrl);
      link.setAttribute('rel', 'noopener noreferrer external');
      if (isAndroid) link.removeAttribute('target');
    });
  }

  async function preloadCurrentLiveTarget() {
    const links = [...document.querySelectorAll(selector)].filter(link => link.dataset.youtubeLiveAuto==='1');
    if (!links.length) return;
    const current=await fetchCurrentLiveTarget({fresh:false});
    updateLiveLinks(current);
  }

  const boot = () => {
    prepare();
    preloadCurrentLiveTarget();
    setInterval(preloadCurrentLiveTarget, 60000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  document.addEventListener('click', event => {
    const link = event.target.closest?.(selector);
    if (!link) return;
    void openYoutubeFromRealTap(event, link);
  }, true);
})();
