const tr = key => (window.andrikPlayerT ? window.andrikPlayerT(key) : key);
const COLLECTIONS = {
  ocean: {
    type: 'playlist',
    id: 'PLOWKqAipKxhk',
    label: tr('oceanLabel'),
    name: 'OCEAN',
    note: tr('oceanNote'),
    placeholder: '/assets/ocean-cover-v50.webp',
    url: 'https://youtube.com/playlist?list=PLOWKqAipKxhk',
    positionLabel: 'PLAYLIST'
  },
  hits: {
    type: 'playlist',
    id: 'PLVEjOX_ujSMc',
    label: tr('hitsLabel'),
    name: tr('hitsName'),
    note: tr('hitsNote'),
    placeholder: '/assets/andrik-ocean-poster-v50.webp',
    url: 'https://youtube.com/playlist?list=PLVEjOX_ujSMc',
    positionLabel: 'HITS'
  },
  videos: {
    type: 'video',
    id: 'wcfmPOWZZEg',
    label: tr('videoLabel'),
    name: tr('videoName'),
    note: tr('videoNote'),
    placeholder: '/assets/ya-est-video-wide-v51.webp',
    cardArt: '/assets/ya-est-video-v51.webp',
    url: 'https://youtu.be/wcfmPOWZZEg',
    positionLabel: 'VIDEO'
  },
  prosnis: {
    type: 'video',
    id: '414QuYnbP8s',
    label: tr('prosnisLabel'),
    name: tr('prosnisName'),
    note: tr('prosnisNote'),
    placeholder: '/assets/prosnis-cover-v25-square.webp',
    url: 'https://youtube.com/shorts/414QuYnbP8s',
    positionLabel: 'SHORT'
  },
  illusion: {
    type: 'playlist',
    id: 'PLf3D55CqULs8',
    label: tr('illusionLabel'),
    name: 'Illusion of Life',
    note: tr('illusionNote'),
    placeholder: '/assets/illusion-of-life-v50.webp',
    url: 'https://youtube.com/playlist?list=PLf3D55CqULs8',
    positionLabel: 'PLAYLIST'
  }
};

const app = document.getElementById('app');
const playerShell = document.getElementById('playerShell');
const cards = [...document.querySelectorAll('.collection-card')];
const collectionGrid = document.querySelector('.collection-grid');
const collectionPrevBtn = document.getElementById('collectionPrevBtn');
const collectionNextBtn = document.getElementById('collectionNextBtn');
const artMain = document.getElementById('artMain');
const artBg = document.getElementById('artBg');
const youtubeStage = document.getElementById('youtubeStage');
const miniCollection = document.getElementById('miniCollection');
const miniTitle = document.getElementById('miniTitle');
const miniAuthor = document.getElementById('miniAuthor');
const collectionLabel = document.getElementById('collectionLabel');
const trackTitle = document.getElementById('trackTitle');
const trackAuthor = document.getElementById('trackAuthor');
const stateText = document.getElementById('stateText');
const playlistPos = document.getElementById('playlistPos');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const collectionName = document.getElementById('collectionName');
const collectionNote = document.getElementById('collectionNote');
const collectionLink = document.getElementById('collectionLink');
const collectionSelectR125 = document.getElementById('collectionSelectR125');
const errorBox = document.getElementById('errorBox');
collectionSelectR125?.addEventListener('change',()=>{
  const key=collectionSelectR125.value;
  if(!COLLECTIONS[key]||key===currentKey)return;
  const autoplay=Boolean(app?.classList.contains('playing'));
  loadCollection(key,true,autoplay);
});
const shareBtn = document.getElementById('shareBtn');
const visualizer = document.getElementById('visualizer');
const homeBrand = document.getElementById('homeBrand');
const homeBtn = document.getElementById('homeBtn');
const minimizePlayerBtn = document.getElementById('minimizePlayerBtn');
const siteView = document.getElementById('siteView');
const siteFrame = document.getElementById('siteFrame');
const expandPlayerBtn = document.getElementById('expandPlayerBtn');
const closeMiniPlayerBtn = document.getElementById('closeMiniPlayerBtn');
const wakeLockBtn = document.getElementById('wakeLockBtn');
const coverWrap = document.querySelector('.cover-wrap');
const libraryToggleBtn = document.getElementById('libraryToggleBtn');
const librarySection = document.getElementById('librarySection');
const lyricsToggleBtn = document.getElementById('lyricsToggleBtn');
const lyricsToggleText = document.getElementById('lyricsToggleText');
const lyricsPanel = document.getElementById('lyricsPanel');
const lyricsCloseBtn = document.getElementById('lyricsCloseBtn');
const lyricsMeta = document.getElementById('lyricsMeta');
const lyricsEmpty = document.getElementById('lyricsEmpty');
const lyricsLines = document.getElementById('lyricsLines');
const lyricsScroll = document.getElementById('lyricsScroll');
const lyricsCopyright = document.getElementById('lyricsCopyright');
const lyricsTrackTitle = document.getElementById('lyricsTrackTitle');
const lyricsBadge = document.getElementById('lyricsBadge');
const lyricsOfficialTab = document.getElementById('lyricsOfficialTab');
const lyricsYoutubeTab = document.getElementById('lyricsYoutubeTab');
const commentsTrackBtn = document.getElementById('commentsTrackBtn');
const commentsTrackText = document.getElementById('commentsTrackText');


const ANDRIK_CONTROL_ORIGIN = 'https://control.andrikmetal.com';
const ANDRIK_PLAYER_COOKIE = 'andrik_player_state';
const isAllowedShellMessageOrigin = origin => origin === location.origin || origin === ANDRIK_CONTROL_ORIGIN;
const embeddedFrameOrigin = () => {
  try { return new URL(siteFrame?.src || location.origin, location.href).origin; }
  catch (_) { return location.origin; }
};

let carouselIndex = 0;
let carouselGestureStartY = null;
let carouselGesturePointerId = null;
let carouselSuppressClickUntil = 0;
let carouselAnimating = false;
let carouselAnimationFrame = 0;

function collectionCardHeight(){
  const card = cards[0];
  return card ? Math.max(1, Math.round(card.getBoundingClientRect().height)) : 1;
}

function clampCarouselIndex(index){
  return Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
}

function updateCollectionCarouselControls(){
  if (collectionPrevBtn) collectionPrevBtn.disabled = carouselIndex <= 0;
  if (collectionNextBtn) collectionNextBtn.disabled = carouselIndex >= cards.length - 1;
}

function animateCollectionScroll(targetTop, duration = 240){
  if (!collectionGrid) return;
  if (carouselAnimationFrame) cancelAnimationFrame(carouselAnimationFrame);
  const startTop = collectionGrid.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1 || duration <= 0) {
    collectionGrid.scrollTop = targetTop;
    carouselAnimating = false;
    return;
  }
  const startedAt = performance.now();
  carouselAnimating = true;
  const tick = now => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    collectionGrid.scrollTop = startTop + distance * eased;
    if (progress < 1) carouselAnimationFrame = requestAnimationFrame(tick);
    else {
      carouselAnimationFrame = 0;
      carouselAnimating = false;
      collectionGrid.scrollTop = targetTop;
    }
  };
  carouselAnimationFrame = requestAnimationFrame(tick);
}

function moveCollectionCarousel(index, behavior = 'smooth'){
  if (!collectionGrid || !cards.length) return;
  carouselIndex = clampCarouselIndex(index);
  const card = cards[carouselIndex];
  cards.forEach((item, itemIndex) => item.classList.toggle('carousel-current', itemIndex === carouselIndex));
  updateCollectionCarouselControls();
  const rawTop = card.offsetTop - Math.max(0, (collectionGrid.clientHeight - card.getBoundingClientRect().height) / 2);
  const maxTop = Math.max(0, collectionGrid.scrollHeight - collectionGrid.clientHeight);
  const top = Math.max(0, Math.min(maxTop, Math.round(rawTop)));
  if (behavior === 'smooth') animateCollectionScroll(top, 240);
  else {
    if (carouselAnimationFrame) cancelAnimationFrame(carouselAnimationFrame);
    carouselAnimationFrame = 0;
    carouselAnimating = false;
    collectionGrid.scrollTop = top;
  }
}

function syncCollectionCarousel(key, behavior = 'smooth'){
  const index = cards.findIndex(card => card.dataset.collection === key);
  if (index >= 0) moveCollectionCarousel(index, behavior);
}

function setupCollectionCarousel(){
  if (!collectionGrid || !cards.length) return;

  const begin = event => {
    if (!window.matchMedia('(max-width:760px)').matches) return;
    carouselGesturePointerId = event.pointerId;
    carouselGestureStartY = event.clientY;
    collectionGrid.classList.add('is-dragging');
    try { collectionGrid.setPointerCapture(event.pointerId); } catch (error) {}
  };

  const finish = event => {
    if (carouselGestureStartY === null) return;
    if (carouselGesturePointerId !== null && event.pointerId !== carouselGesturePointerId) return;
    const deltaY = event.clientY - carouselGestureStartY;
    const swiped = Math.abs(deltaY) >= 28;
    collectionGrid.classList.remove('is-dragging');
    try { collectionGrid.releasePointerCapture(event.pointerId); } catch (error) {}
    carouselGestureStartY = null;
    carouselGesturePointerId = null;

    if (swiped) {
      carouselSuppressClickUntil = Date.now() + 360;
      moveCollectionCarousel(carouselIndex + (deltaY < 0 ? 1 : -1), 'smooth');
    } else {
      moveCollectionCarousel(carouselIndex, 'smooth');
    }
  };

  collectionGrid.addEventListener('pointerdown', begin);
  collectionGrid.addEventListener('pointerup', finish);
  collectionGrid.addEventListener('pointercancel', finish);
  collectionGrid.addEventListener('click', event => {
    if (Date.now() < carouselSuppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  collectionGrid.addEventListener('wheel', event => {
    if (!window.matchMedia('(max-width:760px)').matches || Math.abs(event.deltaY) < 8 || carouselAnimating) return;
    event.preventDefault();
    carouselSuppressClickUntil = Date.now() + 350;
    moveCollectionCarousel(carouselIndex + (event.deltaY > 0 ? 1 : -1), 'smooth');
  }, { passive:false });

  collectionPrevBtn?.addEventListener('click', () => moveCollectionCarousel(carouselIndex - 1, 'smooth'));
  collectionNextBtn?.addEventListener('click', () => moveCollectionCarousel(carouselIndex + 1, 'smooth'));
  updateCollectionCarouselControls();

  window.addEventListener('resize', () => moveCollectionCarousel(carouselIndex, 'auto'));
}


const playerParams = new URLSearchParams(location.search);
const sanitizeEmbeddedSiteUrl = value => {
  try {
    const url = new URL(String(value || ''), location.origin);
    if (![location.origin, ANDRIK_CONTROL_ORIGIN].includes(url.origin)) return null;
    if (url.origin === location.origin && /\/player(?:\.html)?$/.test(url.pathname)) return null;
    ['player-shell','returnScroll','_updated','v'].forEach(key => url.searchParams.delete(key));
    return url;
  } catch (_) { return null; }
};
const requestedCollection = playerParams.get('collection');
const requestedEmbeddedSiteUrl = sanitizeEmbeddedSiteUrl(playerParams.get('site'));
const controlShellRequested = requestedEmbeddedSiteUrl?.origin === ANDRIK_CONTROL_ORIGIN;
document.body.classList.toggle('control-shell-mode', Boolean(controlShellRequested));

let controlShellDetected=Boolean(controlShellRequested);

function detectControlShell(){
  if(controlShellDetected)return true;
  try{
    controlShellDetected=new URL(siteFrame?.src||'',location.href).origin===ANDRIK_CONTROL_ORIGIN;
  }catch(_){}
  return controlShellDetected;
}

function forceControlShellSurface(){
  if(!detectControlShell())return false;
  document.body.classList.add('control-shell-mode','site-mode','player-dismissed');
  document.body.classList.toggle('background-playing',app?.classList.contains('playing'));
  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';

  if(siteView){
    Object.assign(siteView.style,{
      position:'fixed',
      inset:'0',
      width:'100vw',
      height:'100vh',
      minHeight:'100vh',
      zIndex:'2147483647',
      opacity:'1',
      visibility:'visible',
      pointerEvents:'auto',
      background:'#02070b',
      transform:'none'
    });
    siteView.classList.add('active','ready');
    siteView.setAttribute('aria-hidden','false');
  }

  if(siteFrame){
    Object.assign(siteFrame.style,{
      display:'block',
      width:'100%',
      height:'100%',
      minHeight:'100%',
      border:'0',
      opacity:'1',
      visibility:'visible',
      background:'#02070b'
    });
  }

  if(playerShell){
    Object.assign(playerShell.style,{
      position:'fixed',
      left:'-30000px',
      top:'-30000px',
      right:'auto',
      bottom:'auto',
      width:'1px',
      minWidth:'1px',
      maxWidth:'1px',
      height:'1px',
      minHeight:'1px',
      maxHeight:'1px',
      overflow:'hidden',
      opacity:'0.001',
      visibility:'visible',
      pointerEvents:'none',
      transform:'none',
      zIndex:'1'
    });
  }
  return true;
}

const standaloneMode = playerParams.get('standalone') === '1';
const requestedReturnTarget = playerParams.get('return');
const requestedReturnPathRaw = playerParams.get('returnPath') || '';
const requestedReturnHashRaw = playerParams.has('returnHash') ? (playerParams.get('returnHash') || '') : '';
const RETURN_TARGETS = new Set(['video','prosnis','album-ocean','album-illusion','discography']);
const DEFAULT_RETURN_TARGETS = { videos:'video', prosnis:'prosnis', ocean:'album-ocean', illusion:'album-illusion' };
const returnTarget = RETURN_TARGETS.has(requestedReturnTarget) ? requestedReturnTarget : (DEFAULT_RETURN_TARGETS[requestedCollection] || 'discography');
const requestedReturnScroll = Number.parseInt(playerParams.get('scroll') || '', 10);
const returnScroll = Number.isFinite(requestedReturnScroll) && requestedReturnScroll >= 0 ? requestedReturnScroll : null;
const RESUME_STATE_KEY = 'andrik-player-resume-v1';
function readResumeState(){
  try {
    const value = JSON.parse(localStorage.getItem(RESUME_STATE_KEY) || 'null');
    if (!value || !COLLECTIONS[value.collection]) return null;
    return value;
  } catch (error) { return null; }
}
const storedResumeState = readResumeState();
const resumeRequested = playerParams.get('resume') === '1';
const savedCollection = localStorage.getItem('andrik-player-last-collection');
let currentKey = COLLECTIONS[requestedCollection]
  ? requestedCollection
  : (resumeRequested && storedResumeState && COLLECTIONS[storedResumeState.collection])
    ? storedResumeState.collection
    : (COLLECTIONS[savedCollection] ? savedCollection : 'ocean');
let pendingResumeState = resumeRequested && storedResumeState?.collection === currentKey ? storedResumeState : null;
let lastResumePersistAt = 0;
let player = null;
let ready = false;
let pendingCollection = currentKey;
let pendingAutoplay = playerParams.get('autoplay') === '1';
let progressTimer = null;
let equalizerTimer = null;
let visualizerThemeTimer = null;
let visualizerTheme = 1;
let seeking = false;
let shuffleEnabled = false;
let currentVideoId = '';
let lastLoadedCollectionKey = '';
let lyricsPanelOpen = false;
let lyricsDataCache = new Map();
let currentLyricsData = null;
let currentLyricsVideoId = '';
let activeLyricsLineIndex = -1;
let activeLyricsWordIndex = -1;
let lyricsFetchToken = 0;
let lyricsLoadingState = false;
const firedLyricsTracking = new Set();
let manualLyricsStaticPromise = null;
let lyricsSourceMode = 'official';
let currentOfficialLyricsData = null;
let currentYoutubeLyricsData = null;
let youtubeLyricsLoadingState = false;
const youtubeLyricsDataCache = new Map();
let playlistSwitchToken = 0;
let playlistSwitchRetryKey = '';
let apiRequested = false;
let apiRetryCount = 0;
let initStarted = false;
let playerBuildAttempt = 0;
let apiPollTimer = null;
let apiWatchdogTimer = null;
let playerReadyWatchdog = null;
let siteModeActive = false;
let collectionAfterSiteExit = null;
let wakeLockHandle = null;
let wakeLockWanted = false;
let embeddedSiteReady = false;
let miniPlayerDismissed = false;
let preservePlaybackOnSiteReturn = false;
let embeddedNavigationPending = false;
let lastEmbeddedNavigationRequest = '';

const PLAYER_DOCUMENT_TITLE = document.title;
const HOME_DOCUMENT_TITLE = tr('homeDoc');
const PLAYER_LANG = window.ANDRIK_PLAYER_LANG || 'ru';
const PLAYER_HOME_PATH = PLAYER_LANG === 'ru' ? '/' : `/${PLAYER_LANG}/`;
function sanitizeReturnPath(value){
  try {
    const url = new URL(value || PLAYER_HOME_PATH, location.origin);
    if (url.origin !== location.origin || /\/player(?:\.html)?$/.test(url.pathname)) return PLAYER_HOME_PATH;
    ['player-shell','returnScroll','_updated','v'].forEach(key => url.searchParams.delete(key));
    return `${url.pathname}${url.search}` || PLAYER_HOME_PATH;
  } catch (_) { return PLAYER_HOME_PATH; }
}
function sanitizeReturnHash(value){
  const raw = String(value || '').trim();
  if (raw.startsWith('#') && raw.length < 180) return raw;
  return '';
}
let activeReturnPath = sanitizeReturnPath(requestedReturnPathRaw || PLAYER_HOME_PATH);
let activeReturnTarget = returnTarget;
let activeReturnHash = sanitizeReturnHash(requestedReturnHashRaw) || (!requestedReturnPathRaw && activeReturnTarget ? `#${activeReturnTarget}` : '');
let activeReturnScroll = returnScroll;
function buildSiteUrl({ frame = false } = {}){
  const url = requestedEmbeddedSiteUrl
    ? new URL(requestedEmbeddedSiteUrl.href)
    : new URL(activeReturnPath || PLAYER_HOME_PATH, location.origin);
  ['player-shell','returnScroll','_updated','v'].forEach(key => url.searchParams.delete(key));
  if (frame) {
    url.searchParams.set('player-shell','1');
    url.searchParams.set('v','55.00-r141');
    if (!requestedEmbeddedSiteUrl && activeReturnScroll !== null) url.searchParams.set('returnScroll', String(activeReturnScroll));
  }
  if (!requestedEmbeddedSiteUrl) url.hash = activeReturnHash || '';
  return frame || url.origin !== location.origin
    ? url.href
    : `${url.pathname}${url.search}${url.hash}`;
}
const buildSiteHistoryUrl = () => buildSiteUrl({ frame:false });
const buildHomeFrameUrl = () => buildSiteUrl({ frame:true });
// Keep the parent shell on the language home URL while chapters are rendered
// inside its iframe. Android WebView became unstable when the parent document
// (still player.html in memory) was rewritten to /comments.html or /trika.html.
const buildStableShellAddress = () => PLAYER_HOME_PATH;

function comparableEmbeddedPath(value){
  try {
    const url = new URL(value || '', location.origin);
    ['player-shell','returnScroll','_updated','v'].forEach(key => url.searchParams.delete(key));
    return `${url.pathname}${url.search}`;
  } catch (_) { return ''; }
}

function currentEmbeddedPath(){
  try { return comparableEmbeddedPath(siteFrame?.contentWindow?.location?.href || siteFrame?.src || ''); }
  catch (_) { return comparableEmbeddedPath(siteFrame?.src || ''); }
}

function loadEmbeddedSite({ force = false } = {}){
  if (!siteFrame) return false;
  const desiredUrl = buildHomeFrameUrl();
  const desiredKey = comparableEmbeddedPath(desiredUrl);
  const currentKey = currentEmbeddedPath();
  if (!force && desiredKey && currentKey === desiredKey) {
    embeddedNavigationPending = false;
    return false;
  }
  embeddedNavigationPending = true;
  // Exactly one navigation owner. Assigning src is sufficient; no load-event
  // retry and no restoration callback may assign it again.
  siteFrame.src = desiredUrl;
  return true;
}

function navigateEmbeddedSite(path, hash = '', { historyMode = 'replace', showSite = true } = {}){
  activeReturnPath = sanitizeReturnPath(path || PLAYER_HOME_PATH);
  activeReturnHash = sanitizeReturnHash(hash || '');
  activeReturnTarget = '';
  activeReturnScroll = null;
  clearShellNavigationTimer();

  const state = makeSiteHistoryState();
  const address = buildStableShellAddress();
  try {
    if (historyMode === 'push') history.pushState(state, '', address);
    else history.replaceState(state, '', address);
  } catch (_) {}

  loadEmbeddedSite();
  if (showSite) {
    if (!siteModeActive) applySiteMode();
    else {
      document.body.classList.toggle('player-dismissed', miniPlayerDismissed);
      siteView?.classList.add('active', 'ready');
      siteView?.setAttribute('aria-hidden', 'false');
      document.title = HOME_DOCUMENT_TITLE;
      syncEmbeddedSitePadding();
    }
  }
}

function buildStandaloneReturnUrl(){
  const url = requestedEmbeddedSiteUrl
    ? new URL(requestedEmbeddedSiteUrl.href)
    : new URL(activeReturnPath || PLAYER_HOME_PATH, location.origin);
  ['player-shell','returnScroll','_updated','v'].forEach(key => url.searchParams.delete(key));
  if (!requestedEmbeddedSiteUrl && activeReturnScroll !== null) url.searchParams.set('returnScroll', String(activeReturnScroll));
  if (!requestedEmbeddedSiteUrl) url.hash = activeReturnHash || '';
  return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
}
const SHELL_HISTORY_KEY = 'andrik-player-shell-v51.79';
let shellNavigationTimer = null;
const WAKE_LOCK_SUPPORTED = 'wakeLock' in navigator;
const BOOTSTRAP_VIDEO_ID = COLLECTIONS.videos.id;
const MEDIA_SESSION_SUPPORTED = 'mediaSession' in navigator && 'MediaMetadata' in window;
let mediaSessionReady = false;
const FAVORITES_KEY = 'andrik-player-favorites-v2';
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); } catch { favorites = new Set(); }

const bars = [];
for (let i = 0; i < 42; i += 1) {
  const bar = document.createElement('span');
  bar.className = 'bar';
  bar.style.height = `${10 + (i % 7) * 2}%`;
  bar.style.setProperty('--i', i);
  visualizer.appendChild(bar);
  bars.push(bar);
}

function absoluteAssetUrl(src) {
  try { return new URL(src, location.origin).href; }
  catch (error) { return `${location.origin}/assets/andrik-eye-v22-512.png`; }
}

function setMediaSessionAction(action, handler) {
  if (!MEDIA_SESSION_SUPPORTED) return;
  try { navigator.mediaSession.setActionHandler(action, handler); }
  catch (error) {}
}

function updateMediaSessionMetadata(title, author = 'ANDRIK') {
  if (!MEDIA_SESSION_SUPPORTED) return;
  const collection = COLLECTIONS[currentKey];
  const cover = absoluteAssetUrl(collection.placeholder);
  const fallback = absoluteAssetUrl('/assets/andrik-eye-v22-512.png');
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || collection.name,
      artist: author || 'ANDRIK',
      album: collection.name,
      artwork: [
        { src: cover },
        { src: fallback, sizes: '512x512', type: 'image/png' }
      ]
    });
  } catch (error) {}
}

function updateMediaSessionPosition() {
  if (!MEDIA_SESSION_SUPPORTED || !ready || !player || typeof navigator.mediaSession.setPositionState !== 'function') return;
  try {
    const duration = Number(player.getDuration?.()) || 0;
    const position = Number(player.getCurrentTime?.()) || 0;
    const playbackRate = Number(player.getPlaybackRate?.()) || 1;
    if (duration > 0 && Number.isFinite(duration)) {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(Math.max(position, 0), duration)
      });
    }
  } catch (error) {}
}

function updateMediaSessionPlaybackState(state) {
  if (!MEDIA_SESSION_SUPPORTED) return;
  try { navigator.mediaSession.playbackState = state; }
  catch (error) {}
}

function setupMediaSession() {
  if (!MEDIA_SESSION_SUPPORTED || mediaSessionReady) return;
  mediaSessionReady = true;

  setMediaSessionAction('play', () => {
    if (!ready || !player) {
      pendingCollection = currentKey;
      ensureYouTubeApi(true);
      return;
    }
    try { player.playVideo?.(); } catch (error) {}
  });

  setMediaSessionAction('pause', () => {
    try { player?.pauseVideo?.(); } catch (error) {}
  });

  setMediaSessionAction('previoustrack', () => {
    if (ready && player && COLLECTIONS[currentKey].type === 'playlist') {
      try { player.previousVideo?.(); } catch (error) {}
      window.setTimeout(updateTrack, 250);
    }
  });

  setMediaSessionAction('nexttrack', () => {
    if (ready && player && COLLECTIONS[currentKey].type === 'playlist') {
      try { player.nextVideo?.(); } catch (error) {}
      window.setTimeout(updateTrack, 250);
    }
  });

  setMediaSessionAction('seekbackward', details => {
    if (!ready || !player) return;
    const skip = Number(details?.seekOffset) || 10;
    const current = Number(player.getCurrentTime?.()) || 0;
    try { player.seekTo?.(Math.max(0, current - skip), true); } catch (error) {}
  });

  setMediaSessionAction('seekforward', details => {
    if (!ready || !player) return;
    const skip = Number(details?.seekOffset) || 10;
    const current = Number(player.getCurrentTime?.()) || 0;
    const duration = Number(player.getDuration?.()) || current + skip;
    try { player.seekTo?.(Math.min(duration, current + skip), true); } catch (error) {}
  });

  setMediaSessionAction('seekto', details => {
    if (!ready || !player || typeof details?.seekTime !== 'number') return;
    try { player.seekTo?.(details.seekTime, details.fastSeek !== true); } catch (error) {}
  });

  setMediaSessionAction('stop', () => {
    try {
      player?.pauseVideo?.();
      player?.seekTo?.(0, true);
    } catch (error) {}
    setPlaying(false);
    stateText.textContent = tr('stopped');
    updateMediaSessionPlaybackState('none');
  });

  updateMediaSessionMetadata(COLLECTIONS[currentKey].name, 'ANDRIK');
  updateMediaSessionPlaybackState('none');
}

function syncWakeLockButton() {
  if (!wakeLockBtn) return;
  const active = Boolean(wakeLockHandle && !wakeLockHandle.released);
  wakeLockBtn.classList.toggle('active', active);
  wakeLockBtn.classList.toggle('unsupported', !WAKE_LOCK_SUPPORTED);
  wakeLockBtn.setAttribute('aria-pressed', String(active));
  wakeLockBtn.disabled = !WAKE_LOCK_SUPPORTED;
  wakeLockBtn.title = !WAKE_LOCK_SUPPORTED
    ? tr('unsupported')
    : active
      ? tr('allowScreenOff')
      : tr('keepScreen');
  wakeLockBtn.setAttribute('aria-label', wakeLockBtn.title);
}

async function acquireWakeLock() {
  if (!WAKE_LOCK_SUPPORTED || document.visibilityState !== 'visible' || !wakeLockWanted) return;
  try {
    wakeLockHandle = await navigator.wakeLock.request('screen');
    
if(controlShellRequested){
  window.addEventListener('resize',forceControlShellSurface,{passive:true});
  window.addEventListener('orientationchange',()=>{
    window.setTimeout(forceControlShellSurface,80);
    window.setTimeout(forceControlShellSurface,420);
  },{passive:true});
  window.setInterval(forceControlShellSurface,700);
}

syncWakeLockButton();
    wakeLockHandle.addEventListener('release', () => {
      wakeLockHandle = null;
      syncWakeLockButton();
    }, { once: true });
  } catch (error) {
    wakeLockHandle = null;
    wakeLockWanted = false;
    syncWakeLockButton();
    stateText.textContent = tr('lockFailed');
  }
}

async function toggleWakeLock() {
  if (!WAKE_LOCK_SUPPORTED) {
    stateText.textContent = tr('browserNoLock');
    return;
  }
  if (wakeLockWanted) {
    wakeLockWanted = false;
    try { await wakeLockHandle?.release?.(); } catch (error) {}
    wakeLockHandle = null;
    syncWakeLockButton();
    stateText.textContent = tr('screenMayOff');
    return;
  }
  wakeLockWanted = true;
  await acquireWakeLock();
  if (wakeLockHandle) stateText.textContent = tr('screenStaysOn');
}

function addEmbeddedSiteFallbacks() {
  try {
    const frameDocument = siteFrame?.contentDocument;
    if (!frameDocument) return;
    const styleId = 'andrik-player-shell-padding';
    if (!frameDocument.getElementById(styleId)) {
      const style = frameDocument.createElement('style');
      style.id = styleId;
      style.textContent = 'body{padding-bottom:170px!important}.reveal{opacity:1!important;transform:none!important;transition:none!important}@media(max-width:760px){body{padding-bottom:125px!important}}';
      frameDocument.head.appendChild(style);
    }
    frameDocument.addEventListener('click', event => {
      if (event.defaultPrevented) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor) return;
      const url = new URL(anchor.href, siteFrame.contentWindow.location.href);
      if (url.origin === location.origin && (url.pathname === '/player' || url.pathname === '/player.html')) {
        event.preventDefault();
        requestFullPlayer(url.searchParams.get('collection'));
      }
    }, { capture: true });
  } catch (error) {}
}

function makeSiteHistoryState() {
  return {
    andrikShell: SHELL_HISTORY_KEY,
    view: 'site',
    andrikSiteMode: true,
    collection: currentKey,
    returnPath: activeReturnPath,
    returnHash: activeReturnHash,
    returnTarget: activeReturnTarget,
    returnScroll: activeReturnScroll
  };
}

function makePlayerHistoryState() {
  return {
    andrikShell: SHELL_HISTORY_KEY,
    view: 'player',
    andrikSiteMode: false,
    collection: currentKey,
    returnPath: activeReturnPath,
    returnHash: activeReturnHash,
    returnTarget: activeReturnTarget,
    returnScroll: activeReturnScroll
  };
}

function applyReturnContext(source = {}){
  if (!source || typeof source !== 'object') return;
  if (source.returnPath) activeReturnPath = sanitizeReturnPath(source.returnPath);
  if (RETURN_TARGETS.has(source.returnTarget)) activeReturnTarget = source.returnTarget;
  const suppliedHash = sanitizeReturnHash(source.returnHash);
  if (suppliedHash || source.returnHash === '') activeReturnHash = suppliedHash;
  const scroll = Number(source.returnScroll);
  if (Number.isFinite(scroll) && scroll >= 0) activeReturnScroll = Math.round(scroll);
}

function isShellHistoryState(state, view = null) {
  if (!state || state.andrikShell !== SHELL_HISTORY_KEY) return false;
  return view ? state.view === view : true;
}

function playerHistoryUrl() {
  const params = new URLSearchParams();
  params.set('collection', currentKey);
  params.set('lang', PLAYER_LANG);
  if (standaloneMode) params.set('standalone', '1');
  if (activeReturnTarget) params.set('return', activeReturnTarget);
  if (activeReturnScroll !== null) params.set('scroll', String(activeReturnScroll));
  if (activeReturnPath) params.set('returnPath', activeReturnPath);
  if (activeReturnHash) params.set('returnHash', activeReturnHash);
  return `/player.html?${params.toString()}`;
}

function clearShellNavigationTimer() {
  if (shellNavigationTimer) window.clearTimeout(shellNavigationTimer);
  shellNavigationTimer = null;
}

let controlBridgeLastPostAt = 0;
function currentControlPlayerState(){
  const collection = COLLECTIONS[currentKey] || {};
  const current = Math.max(0, Number(player?.getCurrentTime?.()) || 0);
  const duration = Math.max(0, Number(player?.getDuration?.()) || 0);
  return {
    collection: currentKey,
    collectionName: collection.name || currentKey || 'ANDRIK',
    title: trackTitle?.textContent || collection.name || 'ANDRIK Player',
    author: trackAuthor?.textContent || 'ANDRIK',
    playing: Boolean(app.classList.contains('playing')),
    ready: Boolean(ready && player),
    currentTime: current,
    duration,
    progress: duration > 0 ? Math.max(0, Math.min(1, current / duration)) : 0,
    artwork: artMain?.src || collection.placeholder || '',
    updatedAt: Date.now()
  };
}

function writeSharedPlayerCookie(force = false){
  const now = Date.now();
  if (!force && now - controlBridgeLastPostAt < 850) return;
  const state = currentControlPlayerState();
  try {
    document.cookie = `${ANDRIK_PLAYER_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Domain=.andrikmetal.com; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
  } catch (_) {}
}

function postControlPlayerState(force = false){
  const now = Date.now();
  if (!force && now - controlBridgeLastPostAt < 450) return;
  controlBridgeLastPostAt = now;
  writeSharedPlayerCookie(true);
  if (!siteModeActive || embeddedFrameOrigin() !== ANDRIK_CONTROL_ORIGIN) return;
  try {
    siteFrame?.contentWindow?.postMessage({
      type:'andrik-player-state',
      state:currentControlPlayerState()
    }, ANDRIK_CONTROL_ORIGIN);
  } catch (_) {}
}

function syncEmbeddedSitePadding() {
  const targetOrigin = embeddedFrameOrigin();
  try {
    siteFrame?.contentWindow?.postMessage({
      type: 'andrik-mini-player-visibility',
      visible: Boolean(siteModeActive && !miniPlayerDismissed),
      dismissed: Boolean(siteModeActive && miniPlayerDismissed),
      playing: Boolean(app.classList.contains('playing'))
    }, targetOrigin);
  } catch (error) {}
  postControlPlayerState(true);
}

function bootstrapShellHistory() {
  if (isShellHistoryState(history.state)) return;

  // The current browser entry becomes the in-site home view, and a new entry
  // is placed above it for the full player. Therefore the first browser Back
  // press collapses the player without destroying the live YouTube iframe.
  history.replaceState(makeSiteHistoryState(), '', buildStableShellAddress());
  history.pushState(makePlayerHistoryState(), '', playerHistoryUrl());
}

function embeddedSiteIsTrika() {
  try { return /\/trika\.html$/.test(siteFrame?.contentWindow?.location?.pathname || ''); }
  catch (error) { return false; }
}

function resetEmbeddedTrikaTop() {
  if (!embeddedSiteIsTrika()) return false;
  try {
    const frameWindow = siteFrame?.contentWindow;
    const frameDocument = siteFrame?.contentDocument;
    if (frameWindow?.history && 'scrollRestoration' in frameWindow.history) frameWindow.history.scrollRestoration = 'manual';
    frameDocument?.documentElement?.style?.setProperty('overflow-anchor', 'none');
    frameDocument?.body?.style?.setProperty('overflow-anchor', 'none');
    const forceTop = () => frameWindow?.scrollTo(0, 0);
    forceTop();
    requestAnimationFrame(forceTop);
    window.setTimeout(forceTop, 100);
  } catch (error) {}
  return true;
}

function restoreEmbeddedHomePosition() {
  try {
    const frameWindow = siteFrame?.contentWindow;
    const frameDocument = siteFrame?.contentDocument;
    if (!frameWindow) return;
    const targetUrl = new URL(activeReturnPath || PLAYER_HOME_PATH, location.origin);
    let currentComparable = '';
    try {
      const currentUrl = new URL(frameWindow.location.href);
      ['player-shell','returnScroll','_updated','v'].forEach(key => currentUrl.searchParams.delete(key));
      currentComparable = `${currentUrl.pathname}${currentUrl.search}`;
    } catch (_) {}
    const targetComparable = `${targetUrl.pathname}${targetUrl.search}`;
    if (currentComparable && currentComparable !== targetComparable) {
      // Navigation is performed only by navigateEmbeddedSite/popstate. A scroll
      // restoration callback must never reload the iframe.
      return;
    }
    if (activeReturnScroll !== null) {
      frameWindow.scrollTo({ top: activeReturnScroll, left: 0, behavior: 'auto' });
      return;
    }
    if (resetEmbeddedTrikaTop()) return;
    const target = activeReturnTarget ? frameDocument?.getElementById(activeReturnTarget) : null;
    if (target) {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      return;
    }
    if (activeReturnHash) frameWindow.location.hash = activeReturnHash;
  } catch (error) {}
}

function applySiteMode() {
  if (detectControlShell()) forceControlShellSurface();
  if (siteModeActive) {
    document.body.classList.toggle('player-dismissed', miniPlayerDismissed);
    document.body.classList.toggle('background-playing', app.classList.contains('playing'));
    siteView?.classList.add('active', 'ready');
    restoreEmbeddedHomePosition();
    syncEmbeddedSitePadding();
    return;
  }
  siteModeActive = true;
  // Keep the existing YouTube iframe alive. Only collapse its controls into the
  // round restore button; never pause, reload or recreate the active track.
  miniPlayerDismissed = true;
  document.body.classList.add('site-mode', 'player-dismissed');
  document.body.classList.toggle('background-playing', app.classList.contains('playing'));
  siteView?.classList.add('active', 'ready');
  siteView?.setAttribute('aria-hidden', 'false');
  document.title = HOME_DOCUMENT_TITLE;
  if (siteFrame) {
    const frameSrc = siteFrame.getAttribute('src');
    if (!frameSrc || frameSrc === 'about:blank') loadEmbeddedSite();
  }
  restoreEmbeddedHomePosition();
  requestAnimationFrame(restoreEmbeddedHomePosition);
  window.setTimeout(restoreEmbeddedHomePosition, 120);
  syncEmbeddedSitePadding();
}

function applyPlayerMode(updateAddress = false) {
  preservePlaybackOnSiteReturn = false;
  siteModeActive = false;
  miniPlayerDismissed = false;
  document.body.classList.remove('site-mode', 'player-dismissed', 'mini-playing');
  siteView?.classList.remove('active');
  siteView?.setAttribute('aria-hidden', 'true');
  syncEmbeddedSitePadding();
  document.title = PLAYER_DOCUMENT_TITLE;
  if (updateAddress) {
    history.replaceState(makePlayerHistoryState(), '', playerHistoryUrl());
  }
  const collection = collectionAfterSiteExit;
  collectionAfterSiteExit = null;
  if (collection && COLLECTIONS[collection]) loadCollection(collection, false);
}

function navigateToSiteMode() {
  if (standaloneMode) { location.href = buildStandaloneReturnUrl(); return; }
  preservePlaybackOnSiteReturn = true;
  if (siteModeActive) return;
  miniPlayerDismissed = false;
  clearShellNavigationTimer();

  if (isShellHistoryState(history.state, 'player')) {
    history.back();
    shellNavigationTimer = window.setTimeout(() => {
      if (!siteModeActive) {
        history.pushState(makeSiteHistoryState(), '', buildStableShellAddress());
        applySiteMode();
      }
    }, 700);
    return;
  }

  history.pushState(makeSiteHistoryState(), '', buildStableShellAddress());
  applySiteMode();
}

function requestFullPlayer(collection = null, returnContext = null) {
  miniPlayerDismissed = false;
  document.body.classList.remove('player-dismissed');
  clearShellNavigationTimer();

  if (returnContext) {
    applyReturnContext(returnContext);
    if (isShellHistoryState(history.state, 'site')) {
      history.replaceState(makeSiteHistoryState(), '', buildStableShellAddress());
    }
  }
  if (collection && COLLECTIONS[collection]) collectionAfterSiteExit = collection;

  // Always force the visible full-player state. This also repairs Android
  // back-forward-cache restores where the CSS class and JS flag could disagree.
  if (!isShellHistoryState(history.state, 'player') || location.pathname !== '/player.html') {
    history.pushState(makePlayerHistoryState(), '', playerHistoryUrl());
  }
  applyPlayerMode(false);
}

function handleHomeRequest(event) {
  event?.preventDefault?.();
  if (standaloneMode) { location.href = buildStandaloneReturnUrl(); return; }
  navigateToSiteMode();
}

async function closeMiniPlayer() {
  // Collapse only: never pause, stop, reload or recreate the live YouTube player.
  const playerStateBeforeCollapse = ready && player?.getPlayerState ? player.getPlayerState() : null;
  const playbackIsActive = playerStateBeforeCollapse === 1 || app.classList.contains('playing');
  miniPlayerDismissed = true;
  document.body.classList.add('player-dismissed');
  document.body.classList.toggle('background-playing', playbackIsActive);
  document.body.classList.toggle('mini-playing', playbackIsActive && siteModeActive);
  if (siteModeActive) syncEmbeddedSitePadding();

  // Some Android WebViews briefly pause the iframe while the mini-player is hidden.
  // Resume only when it was already playing before the collapse.
  if (playbackIsActive && ready && player?.playVideo) {
    requestAnimationFrame(() => {
      try {
        if (player.getPlayerState?.() !== 1) player.playVideo();
      } catch (error) {}
    });
    window.setTimeout(() => {
      try {
        if (player.getPlayerState?.() !== 1) player.playVideo();
      } catch (error) {}
    }, 180);
  }
  stateText.textContent = playbackIsActive ? tr('playing') : tr('miniClosed');
}

function restoreMiniPlayer() {
  if (!siteModeActive) return;

  // R130: в Control оболочке видимой остаётся только зелёная круглая кнопка
  // внутри Control. Встроенный mini-player не должен показывать обложку
  // поверх административных страниц.
  if (controlShellRequested) {
    miniPlayerDismissed = true;
    document.body.classList.add('player-dismissed');
    syncEmbeddedSitePadding();
    return;
  }

  miniPlayerDismissed = false;
  document.body.classList.remove('player-dismissed');
  syncEmbeddedSitePadding();
  stateText.textContent = ready ? tr('ready') : tr('connecting');
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function chooseVisualizerTheme(force = false) {
  let next = visualizerTheme;
  while (next === visualizerTheme) next = 1 + Math.floor(Math.random() * 10);
  if (force || next !== visualizerTheme) {
    visualizer.classList.remove(`viz-theme-${visualizerTheme}`);
    visualizerTheme = next;
    visualizer.classList.add(`viz-theme-${visualizerTheme}`);
  }
}

function startThemeRotation() {
  if (visualizerThemeTimer) window.clearInterval(visualizerThemeTimer);
  chooseVisualizerTheme(true);
  visualizerThemeTimer = window.setInterval(() => chooseVisualizerTheme(), 6500 + Math.floor(Math.random() * 3500));
}

function stopThemeRotation() {
  if (visualizerThemeTimer) window.clearInterval(visualizerThemeTimer);
  visualizerThemeTimer = null;
}

function persistResumeState(force = false) {
  if (!ready || !player) return;
  const now = Date.now();
  if (!force && now - lastResumePersistAt < 1400) return;
  lastResumePersistAt = now;
  try {
    const data = player.getVideoData?.() || {};
    const currentTime = Math.max(0, Number(player.getCurrentTime?.()) || 0);
    const duration = Math.max(0, Number(player.getDuration?.()) || 0);
    const playlistIndex = COLLECTIONS[currentKey].type === 'playlist'
      ? Math.max(0, Number(player.getPlaylistIndex?.()) || 0)
      : 0;
    localStorage.setItem(RESUME_STATE_KEY, JSON.stringify({
      collection: currentKey,
      videoId: data.video_id || currentVideoId || '',
      playlistIndex,
      currentTime,
      duration,
      updatedAt: now,
      hasMedia: Boolean(data.video_id || currentVideoId || duration > 0)
    }));
    writeSharedPlayerCookie(force);
  } catch (error) {}
}

function setPlaying(isPlaying) {
  app.classList.toggle('playing', isPlaying);
  document.body.classList.toggle('mini-playing', Boolean(isPlaying && siteModeActive));
  if (siteModeActive) syncEmbeddedSitePadding();
  playBtn.setAttribute('aria-label', isPlaying ? tr('pause') : tr('play'));
  playIcon.innerHTML = isPlaying ? '<path d="M6 5h4v14H6Zm8 0h4v14h-4Z"/>' : '<path d="M8 5v14l11-7Z"/>';
  if (isPlaying) {
    stateText.textContent = tr('playing');
    startEqualizer();
    startThemeRotation();
    updateMediaSessionPlaybackState('playing');
    updateMediaSessionPosition();
  } else {
    stopEqualizer();
    stopThemeRotation();
    updateMediaSessionPlaybackState(ready ? 'paused' : 'none');
  }
  window.setTimeout(() => persistResumeState(true), 80);
  postControlPlayerState(true);
}

function startEqualizer() {
  stopEqualizer(false);
  equalizerTimer = window.setInterval(() => {
    const t = Date.now();
    bars.forEach((bar, index) => {
      const waveA = (Math.sin(t / 165 + index * .68) + 1) * 22;
      const waveB = (Math.cos(t / 245 + index * .31) + 1) * 12;
      const center = 1 - Math.abs(index - (bars.length - 1) / 2) / ((bars.length - 1) / 2);
      const height = Math.min(98, 8 + waveA + waveB + center * 16 + Math.random() * 13);
      bar.style.height = `${height}%`;
      bar.style.opacity = String(.58 + Math.random() * .4);
    });
  }, 105);
}

function stopEqualizer(reset = true) {
  if (equalizerTimer) window.clearInterval(equalizerTimer);
  equalizerTimer = null;
  if (reset) bars.forEach((bar, index) => {
    bar.style.height = `${10 + (index % 7) * 2}%`;
    bar.style.opacity = '.58';
  });
}

function refreshFavorite() {
  const active = Boolean(currentVideoId && favorites.has(currentVideoId));
  favoriteBtn.classList.toggle('favorite-on', active);
  favoriteBtn.setAttribute('aria-pressed', String(active));
  favoriteBtn.setAttribute('aria-label', active ? tr('removeFavorite') : tr('addFavorite'));
}

function setArtwork(src, alt = '') {
  artMain.classList.add('changing');
  window.setTimeout(() => {
    artMain.onerror = () => {
      artMain.onerror = null;
      const fallback = COLLECTIONS[currentKey].placeholder;
      artMain.src = fallback;
      artBg.src = fallback;
    };
    artMain.src = src;
    artMain.alt = alt;
    artBg.src = src;
    artMain.classList.remove('changing');
  }, 130);
}

function setVideoMode(collection) {
  const isVideo = collection.type === 'video';
  app.classList.toggle('video-mode', isVideo);
  youtubeStage.style.backgroundImage = `linear-gradient(rgba(1,5,8,.2),rgba(1,5,8,.45)),url("${collection.placeholder}")`;
  youtubeStage.setAttribute('aria-hidden', String(!isVideo));
}


function escapeHtml(value){
  return String(value || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function normalizeLyricsTitle(title){
  return cleanTitle(title)
    .toLowerCase()
    .replace(/\([^)]*\)/g,' ')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function parseTimedTextPayload(payload){
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const lines = [];
  events.forEach(event => {
    const raw = Array.isArray(event?.segs) ? event.segs.map(seg => seg?.utf8 || '').join('') : '';
    const text = raw.replace(/\s+/g,' ').replace(/♪/g,'').trim();
    if (!text) return;
    if (/^\[[^\]]+\]$/u.test(text)) return;
    const startMs = Number(event?.tStartMs || 0);
    lines.push({ startMs, text });
  });
  return lines;
}

async function fetchYoutubeLyrics(videoId){
  const lang = (window.ANDRIK_PLAYER_LANG || 'ru').toLowerCase();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7200);
  try {
    const url = new URL('/api/youtube-captions', location.origin);
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('lang', lang);
    const response = await fetch(url.toString(), {
      headers:{ accept:'application/json' },
      cache:'no-store',
      signal:controller.signal
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.status === 'available' && Array.isArray(payload.lines) && payload.lines.length) {
        return {
          status:'available',
          source:'youtube',
          synced:true,
          languageCode:payload.languageCode || '',
          lines:payload.lines.map(item => ({
            startMs:Math.max(0, Number(item?.startMs || 0)),
            text:String(item?.text || '').trim()
          })).filter(item => item.text)
        };
      }
    }
  } catch (_) {
  } finally {
    window.clearTimeout(timeout);
  }

  // Last-resort direct timed-text request for browsers where YouTube allows CORS.
  const preferred = [lang, 'ru', 'en', 'uk', 'sk'].filter((item,index,list)=>item && list.indexOf(item)===index);
  for (const code of preferred) {
    for (const kind of ['','asr']) {
      const direct = `https://www.youtube.com/api/timedtext?fmt=json3&v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(code)}${kind ? `&kind=${kind}` : ''}`;
      try {
        const response = await fetch(direct, { mode:'cors', credentials:'omit', cache:'no-store' });
        if (!response.ok) continue;
        const payload = await response.json();
        const lines = parseTimedTextPayload(payload);
        if (lines.length) return { status:'available', source:'youtube', synced:true, lines };
      } catch (_) {}
    }
  }
  return { status:'unavailable', lines:[] };
}

function splitLyricsWords(text){
  return String(text||'').trim().split(/\s+/).filter(Boolean);
}

function normalizeLyricsWords(words,lineStartMs){
  return (Array.isArray(words)?words:[]).map(word=>({
    startMs:Number.isFinite(Number(word?.startMs))?Math.max(0,Math.round(Number(word.startMs))):null,
    text:String(word?.text||'').trim()
  })).filter(word=>word.text&&Number.isFinite(word.startMs)&&(!Number.isFinite(lineStartMs)||word.startMs>=lineStartMs));
}

function deriveLyricsWords(line,nextStartMs){
  if(!Number.isFinite(line?.startMs))return [];
  const words=splitLyricsWords(line.text);
  if(!words.length)return [];
  const start=Math.max(0,Math.round(line.startMs));
  const fallback=Math.max(1500,Math.min(7000,words.length*430));
  const end=Number.isFinite(nextStartMs)&&nextStartMs>start+300?Math.round(nextStartMs):start+fallback;
  const usable=Math.max(450,end-start-90);
  const weights=words.map(word=>Math.max(1.2,Math.min(8,String(word).replace(/[^\p{L}\p{N}]/gu,'').length*.72+1)));
  const total=weights.reduce((sum,value)=>sum+value,0)||words.length;
  let cursor=start;
  return words.map((word,index)=>{
    const result={text:word,startMs:Math.round(cursor)};
    cursor+=usable*(weights[index]/total);
    return result;
  });
}

function ensureLyricsWordTimings(lines){
  return lines.map((line,index)=>{
    const saved=normalizeLyricsWords(line.words,line.startMs);
    return {...line,words:saved.length?saved:deriveLyricsWords(line,lines[index+1]?.startMs)};
  });
}

function lyricsLineMarkup(line){
  const words=Array.isArray(line?.words)?line.words:[];
  if(!words.length)return escapeHtml(line?.text||'');
  return words.map((word,index)=>`<span class="lyrics-word" data-word-index="${index}" data-word-start-ms="${Number(word.startMs)}">${escapeHtml(word.text)}</span>`).join('');
}

function normalizeManualLyricsPayload(payload){
  if (!payload || payload.status !== 'available' || !Array.isArray(payload.lines)) return null;
  const lines = ensureLyricsWordTimings(payload.lines.map(item => ({
    startMs: Number.isFinite(Number(item?.startMs)) ? Number(item.startMs) : null,
    text: String(item?.text || '').trim(),
    words: normalizeLyricsWords(item?.words, Number.isFinite(Number(item?.startMs)) ? Number(item.startMs) : null)
  })).filter(item => item.text));
  if (!lines.length) return null;
  return {
    status:'available',
    source:payload.source || 'manual',
    synced:payload.synced === true || lines.every(item => Number.isFinite(item.startMs)),
    title:payload.title || '',
    artist:payload.artist || 'ANDRIK',
    languageCode:payload.languageCode || '',
    copyright:payload.copyright || '',
    trackingPixelUrl:payload.trackingPixelUrl || '',
    trackingScriptUrl:payload.trackingScriptUrl || '',
    updatedAt:payload.updatedAt || '',
    lines
  };
}

async function loadStaticManualLyrics(){
  if (!manualLyricsStaticPromise) {
    manualLyricsStaticPromise = fetch('/assets/lyrics-manual-v51.json', { cache:'no-store' })
      .then(response => response.ok ? response.json() : { entries:[] })
      .catch(() => ({ entries:[] }));
  }
  return manualLyricsStaticPromise;
}

async function fetchOfficialLyrics(videoId, title, artist, duration){
  try {
    const url = new URL('/api/lyrics', location.origin);
    if (videoId) url.searchParams.set('videoId', videoId);
    if (title) url.searchParams.set('title', title);
    if (artist) url.searchParams.set('artist', artist);
    if (Number.isFinite(Number(duration)) && Number(duration) > 0) url.searchParams.set('duration', String(Math.round(Number(duration))));
    const response = await fetch(url.toString(), { headers:{ accept:'application/json' }, cache:'no-store' });
    if (response.ok) {
      const payload = normalizeManualLyricsPayload(await response.json());
      if (payload) return payload;
    }
  } catch (_) {}

  try {
    const local = JSON.parse(localStorage.getItem('andrik-manual-lyrics-v1') || '{}');
    const localEntry = local?.[videoId] || local?.[normalizeLyricsTitle(title)];
    const payload = normalizeManualLyricsPayload(localEntry);
    if (payload) return payload;
  } catch (_) {}

  const staticData = await loadStaticManualLyrics();
  const entries = Array.isArray(staticData?.entries) ? staticData.entries : [];
  const normalizedTitle = normalizeLyricsTitle(title);
  const entry = entries.find(item => item?.videoId === videoId || normalizeLyricsTitle(item?.title || '') === normalizedTitle);
  const payload = normalizeManualLyricsPayload(entry ? { ...entry, status:'available' } : null);
  return payload || { status:'unavailable', source:'manual', synced:false, lines:[] };
}

function closeLyricsPanel(){
  lyricsPanelOpen = false;
  playerShell?.classList.remove('has-open-lyrics');
  if (visualizer) visualizer.style.removeProperty('display');
  lyricsPanel?.setAttribute('hidden','');
  lyricsPanel?.classList.remove('is-open');
  lyricsToggleBtn?.classList.remove('is-active');
  lyricsToggleBtn?.setAttribute('aria-expanded','false');
}

function fireLyricsTracking(){
  const url = String(currentLyricsData?.trackingPixelUrl || '');
  if (!url || firedLyricsTracking.has(url)) return;
  firedLyricsTracking.add(url);
  try {
    const pixel = new Image();
    pixel.referrerPolicy = 'no-referrer';
    pixel.src = url;
  } catch (_) {}
}

function openLyricsPanel(){
  if (!currentVideoId) return;
  lyricsPanelOpen = true;
  playerShell?.classList.add('has-open-lyrics');
  if (visualizer) visualizer.style.setProperty('display','none','important');
  lyricsPanel?.removeAttribute('hidden');
  lyricsPanel?.classList.add('is-open');
  lyricsToggleBtn?.classList.add('is-active');
  lyricsToggleBtn?.setAttribute('aria-expanded','true');
  fireLyricsTracking();
}

function renderLyricsPanel(){
  if (!lyricsToggleBtn || !lyricsLines || !lyricsEmpty || !lyricsMeta) return;
  lyricsOfficialTab?.classList.toggle('active', lyricsSourceMode === 'official');
  lyricsOfficialTab?.setAttribute('aria-selected', String(lyricsSourceMode === 'official'));
  lyricsYoutubeTab?.classList.toggle('active', lyricsSourceMode === 'youtube');
  lyricsYoutubeTab?.setAttribute('aria-selected', String(lyricsSourceMode === 'youtube'));
  lyricsOfficialTab?.classList.toggle('has-data', Boolean(currentOfficialLyricsData?.lines?.length));
  lyricsYoutubeTab?.classList.toggle('has-data', Boolean(currentYoutubeLyricsData?.lines?.length));
  lyricsYoutubeTab?.classList.toggle('is-loading', Boolean(youtubeLyricsLoadingState));
  if (lyricsBadge) lyricsBadge.textContent = lyricsSourceMode === 'youtube' ? 'АВТОСУБТИТРЫ' : 'ТЕКСТ ПЕСНИ';
  const activeLyricsLoading = lyricsSourceMode === 'youtube' ? youtubeLyricsLoadingState : lyricsLoadingState;
  const hasTrack = Boolean(currentVideoId);
  const hasLyrics = currentLyricsData && currentLyricsData.status === 'available' && Array.isArray(currentLyricsData.lines) && currentLyricsData.lines.length;
  lyricsToggleBtn.hidden = false;
  lyricsToggleBtn.disabled = !hasTrack;
  lyricsToggleBtn.classList.toggle('has-lyrics', Boolean(hasLyrics));
  lyricsToggleBtn.classList.toggle('is-loading', Boolean(activeLyricsLoading));
  lyricsToggleBtn.classList.toggle('is-unavailable', hasTrack && !activeLyricsLoading && !hasLyrics);
  if (lyricsToggleText) lyricsToggleText.textContent = activeLyricsLoading ? tr('lyricsLoadingShort') : tr('lyrics');
  if (lyricsCopyright) {
    const copyright = hasLyrics ? String(currentLyricsData.copyright || '').trim() : '';
    lyricsCopyright.textContent = copyright;
    lyricsCopyright.hidden = !copyright;
  }
  if (!hasLyrics) {
    lyricsLines.innerHTML = '';
    lyricsEmpty.textContent = activeLyricsLoading ? (lyricsSourceMode === 'youtube' ? 'Запрашиваем автосубтитры YouTube…' : tr('lyricsLoading')) : (lyricsSourceMode === 'youtube' ? 'Автосубтитры YouTube для этого видео недоступны.' : tr('lyricsUnavailable'));
    lyricsMeta.textContent = activeLyricsLoading ? (lyricsSourceMode === 'youtube' ? 'YouTube Captions API / автоматическая дорожка' : tr('lyricsSearchingSources')) : (lyricsSourceMode === 'youtube' ? 'Субтитры показываются отдельно и не заменяют официальный текст ANDRIK' : tr('lyricsUnavailableMeta'));
    if (!hasTrack) closeLyricsPanel();
    return;
  }
  lyricsEmpty.textContent = '';
  if (currentLyricsData.source === 'manual') lyricsMeta.textContent = currentLyricsData.synced ? tr('lyricsManualSynced') : tr('lyricsManual');
  else lyricsMeta.textContent = tr('lyricsAuto');
  if (lyricsTrackTitle) lyricsTrackTitle.textContent = currentLyricsData.title || trackTitle?.textContent || miniTitle?.textContent || 'ANDRIK';
  lyricsLines.innerHTML = currentLyricsData.lines.map((line, index) => `<button class="lyrics-line" type="button" data-line-index="${index}" data-start-ms="${Number.isFinite(line.startMs) ? line.startMs : ''}">${lyricsLineMarkup(line)}</button>`).join('');
  if (lyricsPanelOpen) openLyricsPanel();
  activeLyricsLineIndex = -1;
  activeLyricsWordIndex = -1;
  updateLyricsHighlight(player && ready && player.getCurrentTime ? player.getCurrentTime() : 0);
}

async function refreshLyricsForCurrentTrack(force = false){
  if (!lyricsToggleBtn || !currentVideoId) {
    currentLyricsData = null;
    currentOfficialLyricsData = null;
    currentYoutubeLyricsData = null;
    currentLyricsVideoId = '';
    lyricsLoadingState = false;
    youtubeLyricsLoadingState = false;
    renderLyricsPanel();
    return;
  }
  const trackChanged = currentLyricsVideoId !== currentVideoId;
  if (trackChanged) {
    currentLyricsVideoId = currentVideoId;
    currentOfficialLyricsData = null;
    currentYoutubeLyricsData = youtubeLyricsDataCache.get(currentVideoId) || null;
    activeLyricsLineIndex = -1;
    activeLyricsWordIndex = -1;
  }
  if (!force && !trackChanged && currentOfficialLyricsData) {
    if (lyricsSourceMode === 'official') currentLyricsData = currentOfficialLyricsData;
    lyricsLoadingState = false;
    renderLyricsPanel();
    return;
  }
  const token = ++lyricsFetchToken;
  lyricsLoadingState = true;
  if (lyricsSourceMode === 'official') currentLyricsData = null;
  renderLyricsPanel();
  if (!force && lyricsDataCache.has(currentVideoId)) {
    currentOfficialLyricsData = lyricsDataCache.get(currentVideoId);
    if (lyricsSourceMode === 'official') currentLyricsData = currentOfficialLyricsData;
    lyricsLoadingState = false;
    renderLyricsPanel();
    return;
  }
  const title = trackTitle?.textContent || miniTitle?.textContent || '';
  if (lyricsTrackTitle) lyricsTrackTitle.textContent = title || 'ANDRIK';
  const artist = trackAuthor?.textContent || miniAuthor?.textContent || 'ANDRIK';
  const duration = ready && player?.getDuration ? player.getDuration() : 0;
  const result = await fetchOfficialLyrics(currentVideoId, title, artist, duration);
  if (token !== lyricsFetchToken) return;
  currentOfficialLyricsData = result || { status:'unavailable', source:'manual', synced:false, lines:[] };
  lyricsDataCache.set(currentVideoId, currentOfficialLyricsData);
  lyricsLoadingState = false;
  if (lyricsSourceMode === 'official') currentLyricsData = currentOfficialLyricsData;
  renderLyricsPanel();
}

async function loadYoutubeCaptionsForCurrentTrack(force = false){
  if (!currentVideoId) return;
  const videoId = currentVideoId;
  if (!force && youtubeLyricsDataCache.has(videoId)) {
    currentYoutubeLyricsData = youtubeLyricsDataCache.get(videoId);
    if (lyricsSourceMode === 'youtube') currentLyricsData = currentYoutubeLyricsData;
    renderLyricsPanel();
    return;
  }
  youtubeLyricsLoadingState = true;
  if (lyricsSourceMode === 'youtube') currentLyricsData = null;
  renderLyricsPanel();
  const result = await fetchYoutubeLyrics(videoId);
  if (videoId !== currentVideoId) return;
  if (result?.status === 'available' && Array.isArray(result.lines)) {
    currentYoutubeLyricsData = {
      ...result,
      lines: ensureLyricsWordTimings(result.lines.map(item => ({
        startMs:Number.isFinite(Number(item?.startMs))?Number(item.startMs):null,
        text:String(item?.text||'').trim(),
        words:normalizeLyricsWords(item?.words,Number.isFinite(Number(item?.startMs))?Number(item.startMs):null)
      })).filter(item=>item.text))
    };
  } else currentYoutubeLyricsData = result || { status:'unavailable', source:'youtube', synced:false, lines:[] };
  youtubeLyricsDataCache.set(videoId, currentYoutubeLyricsData);
  youtubeLyricsLoadingState = false;
  if (lyricsSourceMode === 'youtube') currentLyricsData = currentYoutubeLyricsData;
  renderLyricsPanel();
}

function switchLyricsSource(mode){
  lyricsSourceMode = mode === 'youtube' ? 'youtube' : 'official';
  activeLyricsLineIndex = -1;
  activeLyricsWordIndex = -1;
  if (lyricsSourceMode === 'youtube') {
    currentLyricsData = currentYoutubeLyricsData;
    renderLyricsPanel();
    if (!currentYoutubeLyricsData || currentYoutubeLyricsData.status !== 'available') loadYoutubeCaptionsForCurrentTrack(false);
  } else {
    currentLyricsData = currentOfficialLyricsData;
    renderLyricsPanel();
    if (!currentOfficialLyricsData) refreshLyricsForCurrentTrack(false);
  }
}

function updateLyricsHighlight(currentSeconds){
  if (!currentLyricsData || currentLyricsData.status !== 'available' || !Array.isArray(currentLyricsData.lines) || !currentLyricsData.lines.length || !lyricsLines) return;
  if (!currentLyricsData.synced) {
    [...lyricsLines.querySelectorAll('.lyrics-line')].forEach(item => item.classList.remove('active','past'));
    [...lyricsLines.querySelectorAll('.lyrics-word')].forEach(item => item.classList.remove('is-active','is-past'));
    activeLyricsLineIndex = -1;
    activeLyricsWordIndex = -1;
    return;
  }
  const currentMs = Math.max(0, Math.round((Number(currentSeconds) || 0) * 1000));
  let nextIndex = 0;
  for (let i = 0; i < currentLyricsData.lines.length; i += 1) {
    if (currentLyricsData.lines[i].startMs <= currentMs) nextIndex = i;
    else break;
  }
  const lineChanged = nextIndex !== activeLyricsLineIndex;
  if (lineChanged) {
    activeLyricsLineIndex = nextIndex;
    activeLyricsWordIndex = -1;
    const items = [...lyricsLines.querySelectorAll('.lyrics-line')];
    items.forEach((item, index) => {
      item.classList.toggle('active', index === nextIndex);
      item.classList.toggle('past', index < nextIndex);
    });
    if (lyricsPanelOpen) {
      const active = lyricsLines.querySelector('.lyrics-line.active');
      if (active && lyricsScroll) {
        const target = Math.max(0, active.offsetTop - Math.round(lyricsScroll.clientHeight * 0.32));
        lyricsScroll.scrollTo({ top: target, behavior: 'smooth' });
      }
    }
  }
  const line=currentLyricsData.lines[nextIndex];
  const words=Array.isArray(line?.words)?line.words:[];
  if(!words.length)return;
  let wordIndex=0;
  for(let i=0;i<words.length;i+=1){if(words[i].startMs<=currentMs)wordIndex=i;else break}
  if(wordIndex===activeLyricsWordIndex&&!lineChanged)return;
  activeLyricsWordIndex=wordIndex;
  const activeLine=lyricsLines.querySelector(`.lyrics-line[data-line-index="${nextIndex}"]`);
  if(!activeLine)return;
  [...activeLine.querySelectorAll('.lyrics-word')].forEach((word,index)=>{
    word.classList.toggle('is-active',index===wordIndex);
    word.classList.toggle('is-past',index<wordIndex);
  });
}

function updateCollectionUI(key) {
  const collection = COLLECTIONS[key];
  setVideoMode(collection);
  cards.forEach(card => {
    const active = card.dataset.collection === key;
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', String(active));
  });
  collectionLabel.textContent = collection.label;
  miniCollection.textContent = collection.label;
  collectionName.textContent = collection.name;
  if(collectionSelectR125 && collectionSelectR125.querySelector(`option[value="${key}"]`)) collectionSelectR125.value = key;
  collectionNote.textContent = collection.note;
  collectionLink.href = collection.url;
  collectionLink.dataset.webUrl = collection.url;
  collectionLink.dataset.forceApp = 'youtube';
  miniTitle.textContent = collection.name;
  miniAuthor.textContent = 'ANDRIK';
  updateMediaSessionMetadata(collection.name, 'ANDRIK');
  trackTitle.textContent = collection.type === 'video' ? collection.name : tr('loadingCollection');
  trackAuthor.textContent = 'ANDRIK';
  playlistPos.textContent = collection.type === 'video' ? (collection.positionLabel || 'VIDEO') : '— / —';
  progress.value = 0;
  progress.style.setProperty('--value', '0%');
  currentTimeEl.textContent = '0:00';
  durationEl.textContent = '0:00';
  setArtwork(collection.placeholder, collection.name);
  const single = collection.type === 'video';
  prevBtn.disabled = single;
  nextBtn.disabled = single;
  shuffleBtn.disabled = single;
  shuffleBtn.hidden = single;
  shuffleBtn.classList.toggle('is-unavailable', single);
  if (single) {
    shuffleEnabled = false;
    shuffleBtn.classList.remove('active');
    shuffleBtn.setAttribute('aria-pressed', 'false');
  }
  chooseVisualizerTheme(true);
  if (librarySection && !librarySection.hidden) syncCollectionCarousel(key, 'smooth');
  currentLyricsData = null;
  currentLyricsVideoId = '';
  renderLyricsPanel();
}


function cleanTitle(title) {
  return String(title || '')
    .replace(/^ANDRIK\s*[|–—-]\s*/i, '')
    .replace(/\s*[|–—-]\s*(?:Official\s+(?:Audio|Music Video|Video)|Lyrics?\s*Video|Visualizer|Официальн(?:ое|ый)\s+(?:аудио|клип|видео)).*$/i, '')
    .replace(/\s*\((?:Official\s+(?:Audio|Video)|Lyrics?\s*Video|Visualizer|Официальн(?:ое|ый)\s+(?:аудио|клип|видео))\)\s*$/i, '')
    .trim();
}

const COMMENT_SLUG_BY_TITLE = new Map([
  ['исток','istok'],
  ['пробуждение','probuzhdenie'],
  ['holy void','holy-void'],
  ['я есть','ya-est'],
  ['бескрайняя любовь','beskrainyaya-lyubov'],
  ['axis mundi','axis-mundi'],
  ['похититель свободы','pohititel-svobody'],
  ['священный разрушитель','svyashchennyy-razrushitel'],
  ['живой свет','zhivoy-svet'],
  ['спасибо','spasibo'],
  ['спасибо штормам','spasibo'],
  ['интро','intro'],
  ['последний свет','posledniy-svet'],
  ['крик в пустоту','krik-v-pustotu'],
  ['это ты','eto-ty'],
  ['река','reka'],
  ['обычный человек','obychnyy-chelovek'],
  ['время','vremya'],
  ['кто смотрит','kto-smotrit'],
  ['взгляд','vzglyad'],
  ['я здесь','ya-zdes'],
  ['illusion of life','illusion-of-life'],
  ['проснись','prosnis'],
  ['мир затих','mir-zatih'],
  ['плен иллюзий','plen-illyuziy'],
  ['битва теней','bitva-teney'],
  ['не думай о том','ne-dumay-o-tom'],
  ['жидкий как ртуть','zhidkiy-kak-rtut'],
  ['свет проектора','svet-proektora'],
  ['персонаж','personazh'],
  ['темная ночь души','temnaya-noch-dushi'],
  ['тёмная ночь души','temnaya-noch-dushi'],
  ['другой путь','drugoy-put'],
  ['белый холст','belyy-holst']
]);

function commentSubjectForTitle(title){
  const normalized = cleanTitle(title).toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
  return COMMENT_SLUG_BY_TITLE.get(normalized) || 'project';
}

function localizedCommentsPath(slug='project'){
  const base = PLAYER_LANG === 'ru' ? '/comments.html' : `/${PLAYER_LANG}/comments.html`;
  return `${base}?song=${encodeURIComponent(slug)}&auth=1`;
}

function updateTrackDiscussion(title){
  if(!commentsTrackBtn) return;
  const slug = commentSubjectForTitle(title);
  commentsTrackBtn.href = `${localizedCommentsPath(slug)}#page-top`;
  commentsTrackBtn.dataset.song = slug;
  commentsTrackBtn.dataset.title = title || 'ANDRIK';
  commentsTrackBtn.title = `${tr('comments')}: ${title || 'ANDRIK'}`;
  commentsTrackBtn.setAttribute('aria-label', `${tr('commentsForTrack')} ${title || 'ANDRIK'}`);
  if(commentsTrackText) commentsTrackText.textContent = tr('comments');
}

function openTrackDiscussion(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const slug = commentsTrackBtn?.dataset?.song || commentSubjectForTitle(trackTitle?.textContent || '');
  const path = localizedCommentsPath(slug);
  if(standaloneMode){
    // R328: in the standalone/PWA player go straight to the requested
    // comments page. buildStandaloneReturnUrl() was designed for Home return
    // state and could replace /comments.html with the stored main-page URL.
    location.assign(`${path}#page-top`);
    return;
  }
  // Do not call history.back() here. The previous history entry still contains
  // the old Home path and can overwrite the requested comments page mid-load.
  navigateEmbeddedSite(path, '#page-top', {
    historyMode: siteModeActive ? 'replace' : 'push',
    showSite: true
  });
}

function updateTrack() {
  if (!ready || !player) return;
  const collection = COLLECTIONS[currentKey];
  const data = player.getVideoData ? player.getVideoData() : {};
  currentVideoId = data.video_id || '';
  const title = cleanTitle(data.title) || collection.name;
  const author = data.author || 'ANDRIK';
  trackTitle.textContent = title;
  trackAuthor.textContent = author;
  miniTitle.textContent = title;
  miniAuthor.textContent = author;
  updateMediaSessionMetadata(title, author);
  refreshFavorite();
  refreshLyricsForCurrentTrack();
  updateTrackDiscussion(title);

  if (currentVideoId) {
    const max = `https://i.ytimg.com/vi/${currentVideoId}/maxresdefault.jpg`;
    if (collection.type !== 'video') setArtwork(max, `Обложка ${title}`);
  }

  if (collection.type === 'playlist') {
    const list = player.getPlaylist ? player.getPlaylist() : [];
    const index = player.getPlaylistIndex ? player.getPlaylistIndex() : -1;
    playlistPos.textContent = list && list.length && index >= 0 ? `${index + 1} / ${list.length}` : collection.positionLabel;
  } else {
    playlistPos.textContent = collection.positionLabel || 'VIDEO';
  }
  persistResumeState(true);
  postControlPlayerState(true);
}

function updateProgress() {
  if (!ready || !player || seeking) return;
  const current = player.getCurrentTime ? player.getCurrentTime() : 0;
  const duration = player.getDuration ? player.getDuration() : 0;
  const value = duration ? Math.round(current / duration * 1000) : 0;
  progress.value = value;
  progress.style.setProperty('--value', `${value / 10}%`);
  currentTimeEl.textContent = formatTime(current);
  durationEl.textContent = formatTime(duration);
  updateLyricsHighlight(current);
  updateMediaSessionPosition();
  persistResumeState(false);
  postControlPlayerState(false);
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.remove('show');
}

function showSoftError(message) {
  errorBox.textContent = message;
  errorBox.classList.add('show');
}

function stopApiWatchdogs() {
  if (apiPollTimer) window.clearInterval(apiPollTimer);
  if (apiWatchdogTimer) window.clearTimeout(apiWatchdogTimer);
  apiPollTimer = null;
  apiWatchdogTimer = null;
}

function stopPlayerReadyWatchdog() {
  if (playerReadyWatchdog) window.clearTimeout(playerReadyWatchdog);
  playerReadyWatchdog = null;
}


function samePlaylistItems(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length || a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function verifyPlaylistSwitch(key, previousItems, token, autoplay) {
  window.setTimeout(() => {
    if (token !== playlistSwitchToken || currentKey !== key || !ready || !player) return;
    const collection = COLLECTIONS[key];
    if (!collection || collection.type !== 'playlist') return;
    let currentItems = [];
    try { currentItems = player.getPlaylist?.() || []; } catch (error) {}

    // If YouTube kept the previous playlist (the issue seen with Official Audio),
    // rebuild the iframe once and load the requested playlist from a clean state.
    if (previousItems.length && samePlaylistItems(previousItems, currentItems) && playlistSwitchRetryKey !== key) {
      playlistSwitchRetryKey = key;
      pendingCollection = key;
      pendingAutoplay = autoplay;
      pendingResumeState = null;
      rebuildPlayer(tr('reconnecting'));
      return;
    }

    if (currentItems.length) {
      playlistSwitchRetryKey = '';
      lastLoadedCollectionKey = key;
      updateTrack();
      updateProgress();
    }
  }, 1500);
}

function cueCollection(key, autoplay = false, resumeData = null) {
  const collection = COLLECTIONS[key];
  if (!player || !collection) return;
  try {
    const canResume = Boolean(resumeData && resumeData.collection === key);
    const resumeIndex = canResume ? Math.max(0, Number(resumeData.playlistIndex) || 0) : 0;
    const resumeSeconds = canResume ? Math.max(0, Number(resumeData.currentTime) || 0) : 0;
    let previousPlaylistItems = [];
    try { previousPlaylistItems = player.getPlaylist?.() || []; } catch (error) {}

    if (collection.type === 'playlist') {
      // Stop the old playlist first. This prevents YouTube from retaining OCEAN
      // when the user selects the separate Official Audio collection.
      try { player.stopVideo?.(); } catch (error) {}
      if (autoplay && typeof player.loadPlaylist === 'function') {
        player.loadPlaylist({ listType: 'playlist', list: collection.id, index: resumeIndex, startSeconds: resumeSeconds });
      } else if (typeof player.cuePlaylist === 'function') {
        player.cuePlaylist({ listType: 'playlist', list: collection.id, index: resumeIndex, startSeconds: resumeSeconds });
      } else if (typeof player.loadPlaylist === 'function') {
        player.loadPlaylist({ listType: 'playlist', list: collection.id, index: resumeIndex, startSeconds: resumeSeconds });
        if (!autoplay) player.pauseVideo?.();
      }
      playlistSwitchToken += 1;
      verifyPlaylistSwitch(key, previousPlaylistItems, playlistSwitchToken, autoplay);
    } else if (autoplay && typeof player.loadVideoById === 'function') {
      player.loadVideoById({ videoId: collection.id, startSeconds: resumeSeconds });
    } else if (typeof player.cueVideoById === 'function') {
      player.cueVideoById({ videoId: collection.id, startSeconds: resumeSeconds });
    } else {
      player.loadVideoById?.({ videoId: collection.id, startSeconds: resumeSeconds });
      if (!autoplay) player.pauseVideo?.();
    }
    lastLoadedCollectionKey = key;
    stateText.textContent = autoplay ? tr('starting') : tr('ready');
    if (autoplay) {
      window.setTimeout(() => {
        try { player.playVideo?.(); } catch (error) {}
      }, 160);
      window.setTimeout(() => {
        try { player.playVideo?.(); } catch (error) {}
      }, 480);
    } else if (canResume && resumeSeconds > 0) {
      window.setTimeout(() => {
        try {
          player.seekTo?.(resumeSeconds, true);
          player.pauseVideo?.();
          updateProgress();
        } catch (error) {}
      }, 520);
    }
    window.setTimeout(updateTrack, 420);
  } catch (error) {
    stateText.textContent = tr('openCollection');
    showSoftError(tr('embedFailed'));
  }
}

function loadCollection(key, returnToPlayer = false, autoplay = false) {
  if (!COLLECTIONS[key]) return;
  currentKey = key;
  pendingCollection = key;
  pendingAutoplay = autoplay;
  localStorage.setItem('andrik-player-last-collection', key);
  const state = siteModeActive ? makeSiteHistoryState() : makePlayerHistoryState();
  const nextUrl = siteModeActive ? buildStableShellAddress() : playerHistoryUrl();
  history.replaceState(state, '', nextUrl);
  currentVideoId = '';
  refreshFavorite();
  refreshLyricsForCurrentTrack();
  setPlaying(false);
  updateCollectionUI(key);
  stateText.textContent = ready && player ? (autoplay ? tr('starting') : tr('preparing')) : tr('connecting');
  if (returnToPlayer && window.matchMedia('(max-width:760px)').matches) {
    window.setTimeout(() => playerShell.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  if (!ready || !player) {
    ensureYouTubeApi(true);
    return;
  }
  cueCollection(key, autoplay);
  pendingAutoplay = false;
}

function rebuildPlayer(reason = '') {
  ready = false;
  initStarted = false;
  try { player?.destroy?.(); } catch (error) {}
  player = null;
  stopPlayerReadyWatchdog();
  if (reason) stateText.textContent = reason;
  ensureYouTubeApi(true);
}

function handlePlayerError(code) {
  const collection = COLLECTIONS[currentKey];
  const label = collection?.type === 'playlist' ? tr('playlist') : tr('video');
  setPlaying(false);
  if ([2, 5, 100, 101, 150].includes(code)) {
    stateText.textContent = tr('openOnYoutube');
    showSoftError(`YouTube не дал встроенно открыть этот ${label}. Используйте кнопку «Открыть на YouTube».`);
  } else {
    stateText.textContent = tr('youtubeError');
    showSoftError(tr('youtubeUnavailable'));
  }
}

function initPlayerInstance(force = false) {
  if (!(window.YT && YT.Player)) return;
  if (initStarted && !force) return;
  initStarted = true;
  stopApiWatchdogs();
  stopPlayerReadyWatchdog();
  playerBuildAttempt += 1;
  clearError();
  stateText.textContent = tr('launching');

  const mount = document.getElementById('yt-player');
  if (mount) mount.innerHTML = '';
  try { player?.destroy?.(); } catch (error) {}

  player = new YT.Player('yt-player', {
    height: '390',
    width: '640',
    videoId: BOOTSTRAP_VIDEO_ID,
    host: 'https://www.youtube.com',
    playerVars: {
      rel: 0,
      playsinline: 1,
      modestbranding: 1,
      controls: 0,
      disablekb: 1,
      fs: 1,
      autoplay: 0,
      enablejsapi: 1,
      origin: location.origin,
      widget_referrer: location.href
    },
    events: {
      onReady: () => {
        ready = true;
        initStarted = false;
        apiRetryCount = 0;
        stopPlayerReadyWatchdog();
        clearError();
        stateText.textContent = tr('ready');
        setupMediaSession();
        updateMediaSessionPlaybackState('paused');
        if (progressTimer) window.clearInterval(progressTimer);
        progressTimer = window.setInterval(updateProgress, 500);
        cueCollection(pendingCollection || currentKey, pendingAutoplay, pendingResumeState);
        pendingResumeState = null;
        pendingAutoplay = false;
        updateTrack();
        updateProgress();
      },
      onStateChange: event => {
        const YTPS = window.YT?.PlayerState;
        const isPlaying = YTPS && event.data === YTPS.PLAYING;
        setPlaying(Boolean(isPlaying));
        if (YTPS && event.data === YTPS.PAUSED) stateText.textContent = tr('pause');
        if (YTPS && event.data === YTPS.BUFFERING) stateText.textContent = tr('buffering');
        if (YTPS && (event.data === YTPS.CUED || event.data === YTPS.UNSTARTED)) stateText.textContent = tr('ready');
        if (YTPS && event.data === YTPS.ENDED) stateText.textContent = tr('ended');
        window.setTimeout(updateTrack, 150);
        window.setTimeout(updateProgress, 150);
      },
      onError: event => handlePlayerError(event?.data)
    }
  });

  playerReadyWatchdog = window.setTimeout(() => {
    if (!ready && playerBuildAttempt < 4) {
      rebuildPlayer(tr('reconnecting'));
    } else if (!ready) {
      stateText.textContent = tr('clickYoutube');
      showSoftError(tr('initFailed'));
    }
  }, 10000);
}

window.onYouTubeIframeAPIReady = () => {
  initPlayerInstance(true);
};

function ensureYouTubeApi(force = false) {
  if (ready && player) return;
  if (window.YT && YT.Player) {
    initPlayerInstance(force);
    return;
  }

  stateText.textContent = apiRetryCount > 0 ? tr('reconnecting') : tr('connecting');

  if (force) {
    const old = document.getElementById('yt-iframe-api');
    if (old) old.remove();
    stopApiWatchdogs();
    apiRequested = false;
    initStarted = false;
  }

  if (apiRequested) return;
  apiRequested = true;

  const api = document.createElement('script');
  api.id = 'yt-iframe-api';
  api.src = 'https://www.youtube.com/iframe_api';
  api.async = true;
  api.onload = () => {
    apiRequested = false;
    if (window.YT && YT.Player) {
      initPlayerInstance(true);
    }
  };
  api.onerror = () => {
    apiRequested = false;
    stopApiWatchdogs();
    if (apiRetryCount < 4) {
      apiRetryCount += 1;
      window.setTimeout(() => ensureYouTubeApi(true), 900 * apiRetryCount);
    } else {
      stateText.textContent = tr('youtubeTemp');
      showSoftError(tr('youtubeTempHelp'));
    }
  };
  document.head.appendChild(api);

  apiPollTimer = window.setInterval(() => {
    if (window.YT && YT.Player) {
      apiRequested = false;
      stopApiWatchdogs();
      initPlayerInstance(true);
    }
  }, 300);

  apiWatchdogTimer = window.setTimeout(() => {
    stopApiWatchdogs();
    apiRequested = false;
    if (!ready && apiRetryCount < 4) {
      apiRetryCount += 1;
      ensureYouTubeApi(true);
    } else if (!ready) {
      stateText.textContent = tr('clickYoutube');
      showSoftError(tr('scriptFailed'));
    }
  }, 9000);
}

function togglePlayback() {
  if (!player || !ready) {
    pendingCollection = currentKey;
    ensureYouTubeApi(true);
    stateText.textContent = tr('connecting');
    return;
  }

  try {
    const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
    const YTPS = window.YT?.PlayerState;
    if (YTPS && state === YTPS.PLAYING) {
      player.pauseVideo();
      return;
    }

    if (lastLoadedCollectionKey !== currentKey) {
      cueCollection(currentKey);
      window.setTimeout(() => {
        try { player.playVideo(); } catch (error) {}
      }, 180);
    } else {
      player.playVideo();
    }

    stateText.textContent = tr('starting');
    window.setTimeout(() => {
      try { player.playVideo(); } catch (error) {}
    }, 320);
  } catch (error) {
    pendingCollection = currentKey;
    rebuildPlayer(tr('reconnecting'));
  }
}

cards.forEach(card => card.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  const key = event.currentTarget?.dataset?.collection;
  if (!key || !COLLECTIONS[key]) return;
  clearError();
  loadCollection(key, true, true);
}));
playBtn.addEventListener('click', togglePlayback);
prevBtn.addEventListener('click', () => {
  if (ready && player && COLLECTIONS[currentKey].type === 'playlist') {
    player.previousVideo?.();
    window.setTimeout(updateTrack, 250);
  }
});
nextBtn.addEventListener('click', () => {
  if (ready && player && COLLECTIONS[currentKey].type === 'playlist') {
    player.nextVideo?.();
    window.setTimeout(updateTrack, 250);
  }
});
shuffleBtn.addEventListener('click', () => {
  if (!ready || !player || COLLECTIONS[currentKey].type !== 'playlist') return;
  shuffleEnabled = !shuffleEnabled;
  shuffleBtn.classList.toggle('active', shuffleEnabled);
  shuffleBtn.setAttribute('aria-pressed', String(shuffleEnabled));
  if (player.setShuffle) player.setShuffle(shuffleEnabled);
  stateText.textContent = shuffleEnabled ? tr('shuffleOn') : tr('shuffleOff');
});
commentsTrackBtn?.addEventListener('click', openTrackDiscussion);
lyricsToggleBtn?.addEventListener('click', () => {
  if (lyricsPanelOpen) closeLyricsPanel();
  else openLyricsPanel();
});
lyricsCloseBtn?.addEventListener('click', closeLyricsPanel);
lyricsOfficialTab?.addEventListener('click', () => switchLyricsSource('official'));
lyricsYoutubeTab?.addEventListener('click', () => switchLyricsSource('youtube'));
lyricsLines?.addEventListener('click', event => {
  const line = event.target.closest?.('[data-start-ms]');
  const rawStart = line?.dataset?.startMs;
  if (rawStart === undefined || rawStart === '') return;
  const startMs = Number(rawStart);
  if (!Number.isFinite(startMs) || !ready || !player?.seekTo) return;
  player.seekTo(Math.max(0, startMs / 1000), true);
  player.playVideo?.();
});
favoriteBtn.addEventListener('click', () => {
  if (!currentVideoId) return;
  favorites.has(currentVideoId) ? favorites.delete(currentVideoId) : favorites.add(currentVideoId);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  refreshFavorite();
  refreshLyricsForCurrentTrack();
});
progress.addEventListener('input', () => {
  seeking = true;
  const duration = ready && player ? player.getDuration() : 0;
  const value = Number(progress.value);
  progress.style.setProperty('--value', `${value / 10}%`);
  currentTimeEl.textContent = formatTime(duration * value / 1000);
});
progress.addEventListener('change', () => {
  if (ready && player) player.seekTo(player.getDuration() * Number(progress.value) / 1000, true);
  seeking = false;
  window.setTimeout(() => persistResumeState(true), 100);
});

shareBtn?.addEventListener('click', async () => {
  const collection = COLLECTIONS[currentKey];
  const shareUrl = new URL(location.href);
  shareUrl.searchParams.set('collection', currentKey);
  const payload = { title: `ANDRIK — ${collection.name}`, text: collection.note, url: shareUrl.toString() };
  try {
    if (navigator.share) await navigator.share(payload);
    else {
      await navigator.clipboard.writeText(payload.url);
      stateText.textContent = tr('copied');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') stateText.textContent = tr('shareFailed');
  }
});


function libraryToggleCopy(expanded){
  const lang = window.ANDRIK_PLAYER_LANG || 'ru';
  const labels = {
    ru: expanded ? 'Свернуть список' : 'Листайте ниже и выбирайте',
    uk: expanded ? 'Згорнути список' : 'Гортайте нижче та вибирайте',
    sk: expanded ? 'Zbaliť zoznam' : 'Posuňte sa nižšie a vyberte si',
    en: expanded ? 'Collapse list' : 'Scroll down and choose'
  };
  return labels[lang] || labels.ru;
}

function setLibraryExpanded(expanded, shouldScroll = true){
  if(!libraryToggleBtn || !librarySection) return;
  libraryToggleBtn.setAttribute('aria-expanded', String(expanded));
  librarySection.hidden = !expanded;
  const label = libraryToggleCopy(expanded);
  const textNode = libraryToggleBtn.querySelector('span');
  if(textNode) textNode.textContent = label;
  libraryToggleBtn.setAttribute('aria-label', label);

  if(!shouldScroll) return;
  requestAnimationFrame(() => {
    if(expanded){
      librarySection.scrollIntoView({behavior:'smooth', block:'start'});
      window.setTimeout(() => syncCollectionCarousel(currentKey, 'auto'), 120);
    }else{
      const targetTop = Math.max(0, playerShell.getBoundingClientRect().top + window.scrollY - 12);
      window.scrollTo({top:targetTop, behavior:'smooth'});
    }
  });
}

libraryToggleBtn?.addEventListener('click', () => {
  const expanded = libraryToggleBtn.getAttribute('aria-expanded') === 'true';
  setLibraryExpanded(!expanded, true);
});

setLibraryExpanded(false, false);
renderLyricsPanel();
setupCollectionCarousel();
window.setTimeout(() => syncCollectionCarousel(currentKey, 'auto'), 0);

document.addEventListener('keydown', event => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePlayback();
  }
  if (event.key === 'ArrowLeft' && ready && player && COLLECTIONS[currentKey].type === 'playlist') player.previousVideo?.();
  if (event.key === 'ArrowRight' && ready && player && COLLECTIONS[currentKey].type === 'playlist') player.nextVideo?.();
  if (event.key.toLowerCase() === 'f') favoriteBtn.click();
});

window.addEventListener('online', () => {
  if (!ready) ensureYouTubeApi(true);
});

homeBrand?.addEventListener('click', handleHomeRequest);
homeBtn?.addEventListener('click', handleHomeRequest);
minimizePlayerBtn?.addEventListener('click', navigateToSiteMode);
expandPlayerBtn?.addEventListener('click', () => requestFullPlayer());
coverWrap?.addEventListener('click', () => {
  if (siteModeActive) requestFullPlayer();
});
closeMiniPlayerBtn?.addEventListener('click', closeMiniPlayer);
wakeLockBtn?.addEventListener('click', toggleWakeLock);
siteFrame?.addEventListener('load', () => {
  if (embeddedFrameOrigin() === ANDRIK_CONTROL_ORIGIN) {
    controlShellDetected=true;
    forceControlShellSurface();
  }
  const loadedKey = currentEmbeddedPath();
  const desiredKey = comparableEmbeddedPath(buildHomeFrameUrl());
  // Never force a second load from the load event. A second assignment was the
  // remaining source of the Comments/Trika reload loop on Android.
  if (loadedKey && desiredKey && loadedKey === desiredKey) embeddedNavigationPending = false;
  embeddedSiteReady = true;
  siteView?.classList.add('ready');
  addEmbeddedSiteFallbacks();
  const trikaOpen = embeddedSiteIsTrika();
  if (trikaOpen) {
    miniPlayerDismissed = true;
    document.body.classList.add('player-dismissed');
    if (activeReturnScroll === null) resetEmbeddedTrikaTop();
  }
  if (siteModeActive) {
    restoreEmbeddedHomePosition();
    requestAnimationFrame(restoreEmbeddedHomePosition);
  }
  syncEmbeddedSitePadding();
  window.setTimeout(() => postControlPlayerState(true), 180);
});

window.addEventListener('message', event => {
  if (!isAllowedShellMessageOrigin(event.origin) || !event.data) return;
  if(event.origin===ANDRIK_CONTROL_ORIGIN){
    controlShellDetected=true;
    forceControlShellSurface();
  }
  if (event.origin === ANDRIK_CONTROL_ORIGIN && event.source !== siteFrame?.contentWindow) return;
  if (event.data.type === 'andrik-site-ready') {
    embeddedSiteReady = true;
    siteView?.classList.add('ready');
    syncEmbeddedSitePadding();
  }
  if (event.data.type === 'andrik-open-player') {
    requestFullPlayer(event.data.collection || null, event.data);
  }
  if (event.data.type === 'andrik-site-navigate') {
    const requestId = String(event.data.requestId || '');
    if (requestId && requestId === lastEmbeddedNavigationRequest) return;
    if (requestId) lastEmbeddedNavigationRequest = requestId;
    navigateEmbeddedSite(
      event.data.path || PLAYER_HOME_PATH,
      event.data.hash || '',
      { historyMode: 'replace', showSite: true }
    );
  }
  if (event.data.type === 'andrik-restore-mini-player') {
    restoreMiniPlayer();
  }
  if (event.data.type === 'andrik-control-player-ready') {
    if (controlShellRequested) applySiteMode();
    postControlPlayerState(true);
  }
  if (event.data.type === 'andrik-control-player-toggle') {
    if (!ready || !player) {
      pendingAutoplay = true;
      ensureYouTubeApi(true);
    } else if (app.classList.contains('playing')) player.pauseVideo?.();
    else player.playVideo?.();
  }
  if (event.data.type === 'andrik-control-player-prev') {
    if (ready && player) player.previousVideo?.();
  }
  if (event.data.type === 'andrik-control-player-next') {
    if (ready && player) player.nextVideo?.();
  }
  if (event.data.type === 'andrik-control-player-open') {
    requestFullPlayer();
  }
});

window.addEventListener('popstate', event => {
  if (standaloneMode) return;
  clearShellNavigationTimer();
  if (isShellHistoryState(event.state, 'site')) {
    applyReturnContext(event.state);
    loadEmbeddedSite();
    applySiteMode();
    return;
  }
  if (isShellHistoryState(event.state, 'player')) {
    applyReturnContext(event.state);
    applyPlayerMode(false);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistResumeState(true);
  if (document.visibilityState === 'visible' && wakeLockWanted && !wakeLockHandle) {
    acquireWakeLock();
  }
});

if (standaloneMode) {
  document.body.classList.add('standalone-player');
  document.body.classList.remove('site-mode', 'player-dismissed', 'mini-playing');
  siteView?.classList.remove('active', 'ready');
  siteView?.setAttribute('aria-hidden', 'true');
  history.replaceState({ andrikStandalone: true, collection: currentKey }, '', playerHistoryUrl());
} else {
  if (siteFrame && (!siteFrame.getAttribute('src') || siteFrame.getAttribute('src') === 'about:blank')) loadEmbeddedSite();
  if (controlShellRequested) {
    controlShellDetected=true;
    history.replaceState(makeSiteHistoryState(), '', buildStableShellAddress());
    applySiteMode();
    forceControlShellSurface();
  } else {
    bootstrapShellHistory();
    applyPlayerMode(false);
  }
}

window.addEventListener('pageshow', () => {
  if (standaloneMode) return;
  if(detectControlShell())forceControlShellSurface();
  if (isShellHistoryState(history.state)) applyReturnContext(history.state);
  if (isShellHistoryState(history.state, 'site') || location.pathname !== '/player.html') {
    loadEmbeddedSite();
    applySiteMode();
  } else applyPlayerMode(false);
});

syncWakeLockButton();
setupMediaSession();
updateCollectionUI(currentKey);
ensureYouTubeApi();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?v=55.00-r486', { updateViaCache: 'none' }).catch(() => {});
window.setTimeout(() => {
  if (!ready) stateText.textContent = tr('pressPlay');
}, 14000);
window.addEventListener('beforeunload', () => {
  persistResumeState(true);
  if (progressTimer) window.clearInterval(progressTimer);
  stopEqualizer(false);
  stopThemeRotation();
  stopApiWatchdogs();
  stopPlayerReadyWatchdog();
  clearShellNavigationTimer();
  wakeLockWanted = false;
  try { wakeLockHandle?.release?.(); } catch (error) {}
});
