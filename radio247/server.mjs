import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const PORT = Number(process.env.PORT || 8080);
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://andrikmetal.com/api/music/downloads';
const STREAM_KEY = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const STREAM_URL = String(process.env.STREAM_URL_OVERRIDE || '').trim() || (STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '');
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const CACHE_DIR = process.env.RADIO_CACHE_DIR || '/var/cache/andrik-radio-r622';
const AUDIO_CACHE_DIR = `${CACHE_DIR}/audio`;
const VISUAL_CACHE_DIR = `${CACHE_DIR}/visuals`;
const MAX_CACHED_TRACKS = 10;
const VISUAL_TIME_ZONE = process.env.VISUAL_TIME_ZONE || 'Europe/Bratislava';
const FORCE_VISUAL_SLOT = ['morning','day','evening','night'].includes(String(process.env.FORCE_VISUAL_SLOT||'').trim().toLowerCase()) ? String(process.env.FORCE_VISUAL_SLOT).trim().toLowerCase() : '';
const VISUAL_AUTO_SCHEDULE_R658 = String(process.env.VISUAL_AUTO_SCHEDULE_R658||'').trim()==='1';
// R651: DAY / EVENING / NIGHT are owner-selected R2 videos cached locally on AWS.
// IMPORTANT: preserve the exact working R649 hotfix behavior: direct 1920x1080 scale,
// no crop and no pad. This intentionally fills the whole 16:9 frame every time.
const MORNING_VISUAL = process.env.MORNING_VISUAL || `${VISUAL_CACHE_DIR}/stream-morning-master-r703.mp4`;
const DAY_VISUAL = process.env.DAY_VISUAL || `${VISUAL_CACHE_DIR}/stream-day-master-r620.mp4`;
const EVENING_VISUAL = process.env.EVENING_VISUAL || `${VISUAL_CACHE_DIR}/stream-evening-master-r620.mp4`;
const NIGHT_VISUAL = process.env.NIGHT_VISUAL || `${VISUAL_CACHE_DIR}/stream-night-master-r620.mp4`;
const MORNING_VISUAL_URL = process.env.MORNING_VISUAL_URL || MORNING_VISUAL;
const DAY_VISUAL_URL = process.env.DAY_VISUAL_URL || DAY_VISUAL;
const EVENING_VISUAL_URL = process.env.EVENING_VISUAL_URL || EVENING_VISUAL;
const NIGHT_VISUAL_URL = process.env.NIGHT_VISUAL_URL || NIGHT_VISUAL;
const EMERGENCY_VISUAL = process.env.EMERGENCY_VISUAL || new URL('../assets/live-eye-r223.mp4', import.meta.url).pathname;
const QR_OVERLAY = process.env.QR_OVERLAY || new URL('../assets/andrik-qr-r612.png', import.meta.url).pathname;
const CTA_OVERLAY_R722 = process.env.CTA_OVERLAY_R722 || new URL('../assets/subscribe-like-r722.png', import.meta.url).pathname;
const CTA_SHOW_SECONDS_R722 = 8;
const CTA_PERIOD_SECONDS_R722 = 120; // R725: every 2 minutes during the normal radio visual
const TITLE_HANDOFF_DELAY_MS_R724 = 0; // R730: title changes only on the real media handoff
const BUMPER_MIN_SONGS_R724 = 4;
const BUMPER_MAX_SONGS_R724 = 6;
const SPECIAL_INTERVAL_MS_R726 = Math.max(10*60*1000, Number(process.env.SPECIAL_INTERVAL_MS_R726 || 30*60*1000));
const SPECIAL_HOURLY_INTERVAL_MS_R727 = Math.max(30*60*1000, Number(process.env.SPECIAL_HOURLY_INTERVAL_MS_R727 || 60*60*1000));
const NEXT_PREVIEW_SECONDS_R726 = 8;
const NEXT_PREVIEW_HIDE_BEFORE_END_R726 = 0.30; // R731: keep PREVIOUS/NEXT visible almost to the handoff
const TRACK_HISTORY_LIMIT_R726 = 20;
const TRACK_AUDIO_TARGET_I_R726 = -14;
const TRACK_AUDIO_TRUE_PEAK_R726 = -1.5;
const TRACK_AUDIO_LRA_R726 = 11;
const TRACK_AUDIO_FADE_IN_R726 = 0.55;
const TRACK_AUDIO_FADE_OUT_R726 = 1.25; // R743: clearly audible but short old-track fade-out
const VIDEO_FADE_SECONDS_R726 = 0.65; // R736: short cinematic fade-out on the OLD track
const VIDEO_FADE_IN_SECONDS_R736 = 0.30; // R736: same-feeder recovery so black can never hang into the new song
const VIDEO_BLACK_HOLD_SECONDS_R736 = 0.05; // almost no dead-black hold
const VIDEO_FADE_LEAD_SECONDS_R735 = 2.40; // R743: restore empirically correct pre-boundary lead from R735
const TITLE_VISUAL_LEAD_SECONDS_R738 = 3.20; // compensate persistent video path latency; CURRENT is preloaded early but appears at the real handoff
const CLIP_PRE_DRAIN_MS_R738 = 900; // let the bounded MP3 PCM queue drain while the normal visual keeps running
const CLIP_POST_DRAIN_MS_R738 = 650; // let the clip PCM/video tail drain before the next MP3 feeder starts
const VIDEO_TIMELINE_COMP_DEFAULT_R739 = 0.0; // R743: disable R739 global compensation; it hid/late-shifted proven R732 boundary UI
const CLIP_PREP_NICE_R742 = 12; // background clip preparation yields CPU to the live stream
const CLIP_PREP_TIMEOUT_MS_R742 = 45*60*1000;
const CLIP_PREP_MIN_BYTES_R742 = 500000; // prepared 1080p H264+AAC cache sanity check
const VIDEO_PIPELINE_LEAD_SECONDS_R745 = Math.max(2,Math.min(15,Number(process.env.VIDEO_PIPELINE_LEAD_SECONDS_R745 || process.env.VIDEO_PIPELINE_LEAD_SECONDS_R744 || 10.0))); // R745: 10s default after real viewer-side test; keeps backward env compatibility
const VIDEO_BOUNDARY_FADE_SECONDS_R744 = 0.80;
const CLIP_END_GUARD_MARGIN_MS_R745 = Math.max(8000,Number(process.env.CLIP_END_GUARD_MARGIN_MS_R745 || 15000)); // watchdog margin after measured clip duration
const TRANSPORT_FATAL_RESTART_DELAY_MS_R746 = Math.max(1500,Math.min(15000,Number(process.env.TRANSPORT_FATAL_RESTART_DELAY_MS_R746 || 3500))); // R746: restart whole service when FFmpeg/FIFO keeps a dead RTMPS/TLS session alive
const TRANSPORT_FATAL_REGEX_R746 = /the specified session has been invalidated|error in the pull function|io error:\s*end of file|server returned 4\d\d|connection reset by peer|broken pipe/i;
// R721 keeps the proven 100-frame / 4-second exact-periodic QTRLE loops from R720.
// The EQ is encoded inside the current local H264 feeder, while the YouTube RTMPS
// publisher stays open permanently across MP3, clip and visual-period switches.
const EQUALIZER_FILES_R721 = Object.freeze({
  morning: new URL('../assets/equalizer-morning-r720.mov', import.meta.url).pathname,
  day: new URL('../assets/equalizer-day-r720.mov', import.meta.url).pathname,
  evening: new URL('../assets/equalizer-evening-r720.mov', import.meta.url).pathname,
  night: new URL('../assets/equalizer-night-r720.mov', import.meta.url).pathname
});
const OUTPUT_TIMESHIFT_SECONDS = 6; // R637: network recovery cushion; packets are NEVER dropped
const VIDEO_BITRATE = '4500k'; // R637: 1080p25 low-motion radio visual, bounded CBR
const AUDIO_BITRATE = '128k'; // YouTube Live recommendation for stereo AAC
const AUDIO_SAMPLE_RATE = 44100; // YouTube Live recommendation for stereo
const VIDEO_FPS = 25;
const VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024; // exact R729/R721 proven H264 input cushion
const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8; // ~0.74 s FFmpeg raw-packet cushion; ~1 s incl. pipe; prevents 20–30 s title/audio drift
const VIDEO_GOP = 50; // exactly 2 seconds at 25 fps
const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));
const LIVE_TICKER_FILE = process.env.LIVE_TICKER_FILE || `${CACHE_DIR}/live-ticker.txt`;
const LIVE_CURRENT_FILE = process.env.LIVE_CURRENT_FILE || `${CACHE_DIR}/current-live.txt`;
const LIVE_PREVIOUS_FILE_R726 = process.env.LIVE_PREVIOUS_FILE_R726 || `${CACHE_DIR}/previous-live-r726.txt`;
const LIVE_NEXT_FILE_R726 = process.env.LIVE_NEXT_FILE_R726 || `${CACHE_DIR}/next-live-r726.txt`;
const CLIP_CACHE_DIR = `${CACHE_DIR}/clips`;
const RADIO_CLIPS_URL_R691 = process.env.RADIO_CLIPS_URL_R691 || 'https://andrikmetal.com/api/music/radio-clips-r691';
const RADIO_SPECIAL_KEY_R726 = 'radio/clips/radio-special-30min.mp4';
const RADIO_SPECIAL_HOURLY_KEY_R727 = 'radio/clips/radio-special-60min.mp4';
const JOY_OF_BEING_CLIP_URL = process.env.JOY_OF_BEING_CLIP_URL || 'https://music.andrikmetal.com/clips/joy-of-being-official-2026.mp4';
const JOY_OF_BEING_CLIP_ENABLED = String(process.env.JOY_OF_BEING_CLIP_ENABLED || '1').trim() !== '0';
const JOY_OF_BEING_CLIP_PATH = `${CLIP_CACHE_DIR}/joy-of-being-official-2026.mp4`;
const YA_EST_CLIP_URL_R724 = process.env.YA_EST_CLIP_URL_R724 || 'https://music.andrikmetal.com/clips/ya-est-official-2026.mp4';
const JOY_OF_BEING_CLIP = Object.freeze({
  type:'clip', sourceType:'r2-video', title:'JOY OF BEING', album:'OFFICIAL MUSIC VIDEO',
  key:'clips/joy-of-being-official-2026.mp4', url:JOY_OF_BEING_CLIP_URL, identity:'clip:joy-of-being', builtIn:true
});
const YA_EST_CLIP_R724 = Object.freeze({
  type:'clip', sourceType:'r2-video', title:'Я ЕСТЬ', album:'OFFICIAL MUSIC VIDEO',
  key:'clips/ya-est-official-2026.mp4', url:YA_EST_CLIP_URL_R724, identity:'clip:ya-est', builtIn:true
});
const DEFAULT_LIVE_TICKER = 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';
const DISABLED_ALBUM_PREFIXES = Object.freeze([
  'albums/illusion-of-life/',
  'albums/ocean/'
]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R746-RTMPS-TLS-SELFHEAL-R745-PRESERVED',
  mode: 'R746 R745 PRESERVED + RTMPS/TLS FATAL SELF-HEAL + CLIP EOF WATCHDOG + TRUE PREVIOUS + 10s VIDEO LEAD',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'R746 PRESERVES R745 TRUE CURRENT/PREVIOUS/NEXT + R744 VIDEO-PREROLL + SAFE 0.80s BOUNDARY FADE',
  audioMode: 'R732 R729 PCM TRANSPORT + AUDIO QUEUE 8 + R726 LOUDNORM -14 LUFS / ONE RTMPS',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  visualInsetCrop: '',
  libraryTracks: 0,
  libraryAlbumTracks: 0,
  librarySingleTracks: 0,
  duplicateSinglesSkipped: 0,
  libraryVideos: JOY_OF_BEING_CLIP_ENABLED ? 2 : 1,
  libraryBumpers: 0,
  librarySpecial: 0,
  librarySpecial30: 0,
  librarySpecial60: 0,
  specialIntervalSeconds: Math.round(SPECIAL_INTERVAL_MS_R726/1000),
  specialHourlyIntervalSeconds: Math.round(SPECIAL_HOURLY_INTERVAL_MS_R727/1000),
  lastSpecialPlayedAt: null,
  lastSpecialHourlyPlayedAt: null,
  songsSinceBumper: 0,
  nextBumperAfterSongs: 0,
  lastBumperSlot: 0,
  cycle: 0,
  queueLength: 0,
  queuePosition: 0,
  previous: null,
  current: null,
  next: null,
  lastLibraryRefresh: null,
  lastExit: null,
  lastError: '',
  lastFfmpegLine: '',
  equalizerPeriod: null,
  equalizerStyle: null,
  equalizerEngine: 'R721-EXACT-PERIODIC-QTRLE-FEEDER-4-SLOT',
  visualLoopOffsetSeconds: 0,
  visualContinuityMode: 'R735-WALLCLOCK-SEEK-CONTINUITY',
  clipAvSyncMode: 'R738-PTS0-ASYNC-FIRSTPTS0',
  clipPreDrainMs: CLIP_PRE_DRAIN_MS_R738,
  clipPostDrainMs: CLIP_POST_DRAIN_MS_R738,
  videoTimelineCompensationSeconds: VIDEO_TIMELINE_COMP_DEFAULT_R739,
  videoTimelineCompensationMode: 'R743-DISABLED-FOR-MP3-BOUNDARY',
  clipPlaybackMode: 'R742-PREPARED-H264-COPY',
  clipPreparationMode: 'R742-SERIAL-NICE12-ONE-THREAD',
  preparedClipReady: 0,
  preparedClipPending: 0,
  preparedClipLast: '',
  videoPipelineLeadSeconds: VIDEO_PIPELINE_LEAD_SECONDS_R745,
  videoHandoffMode: 'R744-PREROLL-SOURCE-SWITCH',
  clipAvSyncMode: 'R744-SPLIT-VIDEO-PREROLL-AUDIO-AT-BOUNDARY',
  suppressedVideoInsert: '',
  transportHealthy: false,
  transportSelfHealPending: false,
  transportSelfHealCount: 0,
  lastTransportFatalAt: null,
  lastTransportFatalReason: ''
};

let publisher = null;
let producer = null;
let library = [];
let clipLibrary = JOY_OF_BEING_CLIP_ENABLED ? [JOY_OF_BEING_CLIP,YA_EST_CLIP_R724] : [YA_EST_CLIP_R724];
let bumperLibrary = [];
let specialInsertR726 = null;
let specialHourlyInsertR727 = null;
let queue = [];
let queueIndex = 0;
let running = false;
let stopping = false;
let lastPlayed = null;
let clipPublisher = null;
let videoFeeder = null;
let videoFeederPath = '';
let videoFeederPeriod = '';
let clipActive = false;
let visualSwitching = false;
let scheduleTimerR721 = null;
let runtimeForceVisualSlot = FORCE_VISUAL_SLOT;
let runtimeVisualAutoSchedule = VISUAL_AUTO_SCHEDULE_R658;
let liveTitleTimerR724 = null;
let liveTitleGenerationR724 = 0;
let songsSinceBumperR724 = 0;
let bumperAfterSongsR724 = BUMPER_MIN_SONGS_R724 + Math.floor(Math.random()*(BUMPER_MAX_SONGS_R724-BUMPER_MIN_SONGS_R724+1));
let lastBumperSlotR724 = 0;
let lastSpecialPlayedAtR726 = Date.now();
let lastSpecialHourlyPlayedAtR727 = Date.now();
let nextPreviewShowTimerR726 = null;
let nextPreviewHideTimerR726 = null;
const recentTrackIdsR726 = [];
let lastClipIdentityR726 = '';
let previousTrackForPreviewR726 = null;
let trackUiGenerationR730 = 0;
const clipPrefetchJobs = new Map();
const prefetchJobs = new Map();
const visualContinuityR735 = new Map();
let videoTimelineCompR739 = VIDEO_TIMELINE_COMP_DEFAULT_R739;
let videoPipelineLeadR744 = VIDEO_PIPELINE_LEAD_SECONDS_R745;
const preparedClipJobsR742 = new Map();
let preparedClipSerialR742 = Promise.resolve();
let preparedClipPendingR742 = 0;
let clipVideoPrerollR744 = null;
let clipVideoPrerollIdentityR744 = '';
let videoFeederTrackIdentityR744 = '';
let videoFeederPrerolledR744 = false;
let suppressedVideoIdentityR744 = '';
let videoHandoffGenerationR744 = 0;
let transportFatalTimerR746 = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));
function promiseTimeout(promise,ms,label='operation'){
  let timer=null;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timeout ${ms}ms`)),ms);})
  ]).finally(()=>{if(timer)clearTimeout(timer);});
}
const cleanText = value => String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const shortText = (value, max = 52) => {
  const s = cleanText(value);
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trim()}…`;
};

function setLiveTitleR724(text,{delayMs=0}={}){
  liveTitleGenerationR724++;
  const generation=liveTitleGenerationR724;
  if(liveTitleTimerR724){clearTimeout(liveTitleTimerR724);liveTitleTimerR724=null;}
  const commit=()=>{
    if(generation!==liveTitleGenerationR724||stopping)return;
    try{writeFileSync(LIVE_CURRENT_FILE,text,'utf8')}catch(error){state.lastError=`R724 title write: ${cleanText(error?.message||error)}`;}
  };
  if(delayMs>0)liveTitleTimerR724=setTimeout(()=>{liveTitleTimerR724=null;commit();},delayMs);
  else commit();
}
function bumperSlotR724(item){
  const m=/^radio\/clips\/radio-bumper-([123])\.mp4$/i.exec(String(item?.key||''));
  return m?Number(m[1]):0;
}
function isSpecialInsertR726(item){
  return Boolean(item?.special30min) || String(item?.key||'').toLowerCase()===RADIO_SPECIAL_KEY_R726;
}
function isSpecialHourlyInsertR727(item){
  return Boolean(item?.special60min) || String(item?.key||'').toLowerCase()===RADIO_SPECIAL_HOURLY_KEY_R727;
}
function isAnySpecialInsertR727(item){return isSpecialInsertR726(item)||isSpecialHourlyInsertR727(item);}
function rememberTrackR726(item){
  const id=primaryIdentity(item);
  if(!id)return;
  const i=recentTrackIdsR726.indexOf(id);
  if(i>=0)recentTrackIdsR726.splice(i,1);
  recentTrackIdsR726.push(id);
  while(recentTrackIdsR726.length>TRACK_HISTORY_LIMIT_R726)recentTrackIdsR726.shift();
}
function antiRepeatTrackOrderR726(tracks){
  const recent=new Set(recentTrackIdsR726);
  const fresh=shuffle(tracks.filter(x=>!recent.has(primaryIdentity(x))));
  const old=tracks.filter(x=>recent.has(primaryIdentity(x))).sort((a,b)=>recentTrackIdsR726.indexOf(primaryIdentity(a))-recentTrackIdsR726.indexOf(primaryIdentity(b)));
  return [...fresh,...old];
}
function antiRepeatClipOrderR726(clips){
  const out=shuffle(clips);
  if(out.length>1 && primaryIdentity(out[0])===lastClipIdentityR726){
    const swapIndex=out.findIndex((x,i)=>i>0&&primaryIdentity(x)!==lastClipIdentityR726);
    if(swapIndex>0)[out[0],out[swapIndex]]=[out[swapIndex],out[0]];
  }
  return out;
}
function writeOverlayFileR726(path,text=''){
  try{writeFileSync(path,String(text||''),'utf8')}catch(error){state.lastError=`R726 overlay file: ${cleanText(error?.message||error)}`;}
}
function previousTrackFallbackR733(previous){
  if(previousTrackForPreviewR726?.type==='track')return previousTrackForPreviewR726;
  if(previous?.type==='track')return previous;
  // After a service restart the in-memory previous-track pointer is empty, but
  // current-live.txt still contains the title that was on air before the restart.
  // Reuse only a normal ANDRIK track title, never a clip/station label.
  try{
    const raw=cleanText(readFileSync(LIVE_CURRENT_FILE,'utf8'));
    const m=/^ANDRIK\s+[—-]\s+(.+)$/i.exec(raw);
    if(m&&m[1])return {type:'track',title:cleanText(m[1]),album:'',url:'',identity:`r733-file:${cleanText(m[1]).toLowerCase()}`};
  }catch(_){ }
  return null;
}
function clearNextPreviewR726({invalidate=false}={}){
  if(invalidate)trackUiGenerationR730++;
  if(nextPreviewShowTimerR726){clearTimeout(nextPreviewShowTimerR726);nextPreviewShowTimerR726=null;}
  if(nextPreviewHideTimerR726){clearTimeout(nextPreviewHideTimerR726);nextPreviewHideTimerR726=null;}
  writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,'');
  writeOverlayFileR726(LIVE_NEXT_FILE_R726,'');
}
function scheduleNextPreviewR726(previousTrack,nextTrack,duration,currentIdentity,generation){
  clearNextPreviewR726();
  if(!Number.isFinite(duration)||duration<=NEXT_PREVIEW_SECONDS_R726+1)return;
  const showMs=Math.max(0,(duration-NEXT_PREVIEW_SECONDS_R726)*1000);
  const hideMs=Math.max(showMs+300,(duration-NEXT_PREVIEW_HIDE_BEFORE_END_R726)*1000);
  const stillCurrent=()=>generation===trackUiGenerationR730 && state.current?.type==='track' && primaryIdentity(state.current)===currentIdentity;
  nextPreviewShowTimerR726=setTimeout(()=>{
    nextPreviewShowTimerR726=null;
    if(!stillCurrent())return;
    if(previousTrack?.type==='track')writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,`РАНЕЕ • ANDRIK — ${shortText(previousTrack.title||'TRACK',32)}`);
    if(nextTrack?.type==='track')writeOverlayFileR726(LIVE_NEXT_FILE_R726,`NEXT • ANDRIK — ${shortText(nextTrack.title||'TRACK',32)}`);
  },showMs);
  nextPreviewShowTimerR726.unref?.();
  nextPreviewHideTimerR726=setTimeout(()=>{
    nextPreviewHideTimerR726=null;
    if(!stillCurrent())return;
    writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,'');
    writeOverlayFileR726(LIVE_NEXT_FILE_R726,'');
  },hideMs);
  nextPreviewHideTimerR726.unref?.();
}
function remainingTrackSecondsR726(){
  if(state.current?.type!=='track'||!state.current?.startedAt||!Number(state.current?.duration))return 0;
  return Math.max(0,Number(state.current.duration)-(Date.now()-Date.parse(state.current.startedAt))/1000);
}
function randomBumperGapR724(){return BUMPER_MIN_SONGS_R724+Math.floor(Math.random()*(BUMPER_MAX_SONGS_R724-BUMPER_MIN_SONGS_R724+1));}
function nextBumperR724(){
  const available=[...bumperLibrary].sort((a,b)=>bumperSlotR724(a)-bumperSlotR724(b));
  if(!available.length)return null;
  let idx=available.findIndex(x=>bumperSlotR724(x)>lastBumperSlotR724);
  if(idx<0)idx=0;
  const item=available[idx];
  lastBumperSlotR724=bumperSlotR724(item)||lastBumperSlotR724;
  state.lastBumperSlot=lastBumperSlotR724;
  return item;
}
function moveUpcomingClipAfterTrackR724(){
  if(queue[queueIndex]?.type!=='clip')return;
  const trackPos=queue.findIndex((x,i)=>i>queueIndex&&x?.type==='track');
  if(trackPos>queueIndex)[queue[queueIndex],queue[trackPos]]=[queue[trackPos],queue[queueIndex]];
}

function shuffle(items){
  const list=[...items];
  for(let i=list.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [list[i],list[j]]=[list[j],list[i]];
  }
  return list;
}

function uniqueByUrl(items){
  const seen=new Set();
  return items.filter(item=>{
    if(!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function albumName(item){
  const album=cleanText(item.album||'');
  if(album)return album;
  const key=String(item.key||'');
  if(/^singles\//i.test(key))return 'СИНГЛ';
  const m=/^albums\/([^/]+)\//i.exec(key);
  return m ? m[1].replace(/[_-]+/g,' ') : 'ANDRIK';
}

function identityText(value){
  return cleanText(value).replace(/(?:\.(?:mp3|wav|mp4))+$/ig,'')
    .replace(/\s*[\[(]\s*(?:beyond|trika|трика|ocean|illusion of life|синглы andrik|singles andrik)\s*[\])]\s*$/iu,'')
    .replace(/^andrik\s*[-–—:|]\s*/iu,'')
    .normalize('NFKD')
    .replace(/\p{M}+/gu,'')
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function keyBaseName(item){
  return String(item?.key||'')
    .split('/')
    .pop()
    .replace(/(?:\.(?:mp3|mp4))+$/ig,'')
    .replace(/[_-]+/g,' ');
}

function identityCandidates(item){
  if(item?.type==='clip'){
    const key=cleanText(item?.key||item?.url||item?.title||'clip');
    return [`clip:${key}`];
  }
  const out=[];
  const title=identityText(item?.title||item?.name||'');
  const base=identityText(keyBaseName(item));
  if(title && !/^track \d+$/i.test(title))out.push(`title:${title}`);
  if(base && !/^track \d+$/i.test(base))out.push(`file:${base}`);
  return [...new Set(out)];
}

function primaryIdentity(item){
  return identityCandidates(item)[0] || `url:${String(item?.url||'')}`;
}

function prepareTrack(item,sourceType){
  const track={
    type:'track',
    sourceType,
    title:cleanText(item.title||item.name||'ANDRIK'),
    album:albumName(item),
    track:cleanText(item.track||''),
    key:String(item.key||''),
    url:String(item.url||'')
  };
  track.identity=primaryIdentity(track);
  return track;
}

function prepareClip(item){
  const clip={
    type:'clip',
    sourceType:'r2-video',
    title:cleanText(item?.title||item?.name||'ANDRIK VIDEO'),
    album:cleanText(item?.album||'OFFICIAL VIDEO'),
    key:String(item?.key||''),
    url:String(item?.url||''),
    builtIn:Boolean(item?.builtIn),
    bumperSlot:Number(item?.bumperSlot)||0,
    special30min:Boolean(item?.special30min),
    special60min:Boolean(item?.special60min)
  };
  clip.identity=primaryIdentity(clip);
  return clip;
}

function mergeAlbumsAndSingles(albums,singles){
  // Album copy wins over the single copy. This means a single can play immediately
  // after upload, but once the same song appears in an active album it is heard only once.
  const albumIds=new Set(albums.flatMap(identityCandidates));
  const singleIds=new Set();
  const keptSingles=[];
  let skipped=0;

  for(const item of singles){
    const ids=identityCandidates(item);
    if(ids.some(id=>albumIds.has(id)) || ids.some(id=>singleIds.has(id))){
      skipped++;
      continue;
    }
    ids.forEach(id=>singleIds.add(id));
    keptSingles.push(item);
  }
  return {tracks:[...albums,...keptSingles],singles:keptSingles,skipped};
}

function librarySignature(items){
  return items.map(item=>`${item.url}|${item.identity}`).sort().join('\n');
}

async function loadRadioClipsR691(){
  const builtIn=[];
  if(JOY_OF_BEING_CLIP_ENABLED)builtIn.push(prepareClip(JOY_OF_BEING_CLIP));
  builtIn.push(prepareClip(YA_EST_CLIP_R724));
  try{
    const url=`${RADIO_CLIPS_URL_R691}${RADIO_CLIPS_URL_R691.includes('?')?'&':'?'}ts=${Date.now()}`;
    const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R724-Clips-Bumpers'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`R2 radio clips HTTP ${response.status}`);
    const data=await response.json();
    const dynamic=(Array.isArray(data?.clips)?data.clips:[])
      .filter(item=>/^https:\/\//i.test(String(item?.url||'')) && /\.mp4(?:$|\?)/i.test(String(item?.url||'')))
      .map(item=>prepareClip({...item,bumperSlot:Number(item?.bumperSlot)||bumperSlotR724(item),special30min:Boolean(item?.special30min)||isSpecialInsertR726(item),special60min:Boolean(item?.special60min)||isSpecialHourlyInsertR727(item)}));
    const bumpersBySlot=new Map();
    specialInsertR726=null;
    specialHourlyInsertR727=null;
    for(const item of dynamic){
      const slot=bumperSlotR724(item)||Number(item.bumperSlot)||0;
      if(slot>=1&&slot<=3&&!bumpersBySlot.has(slot))bumpersBySlot.set(slot,{...item,bumperSlot:slot,sourceType:'radio-bumper'});
      else if(isSpecialInsertR726(item)&&!specialInsertR726)specialInsertR726={...item,special30min:true,sourceType:'radio-special-30',title:'ANDRIK METAL RADIO • SPECIAL 30'};
      else if(isSpecialHourlyInsertR727(item)&&!specialHourlyInsertR727)specialHourlyInsertR727={...item,special60min:true,sourceType:'radio-special-60',title:'ANDRIK METAL RADIO • SPECIAL 60'};
    }
    bumperLibrary=[...bumpersBySlot.values()].sort((a,b)=>a.bumperSlot-b.bumperSlot);
    const normalDynamic=dynamic.filter(item=>!bumperSlotR724(item)&&!Number(item.bumperSlot)&&!isAnySpecialInsertR727(item));
    const byUrl=new Map();
    for(const clip of [...builtIn,...normalDynamic])if(clip.url&&!byUrl.has(clip.url))byUrl.set(clip.url,clip);
    clipLibrary=[...byUrl.values()];
  }catch(error){
    console.error('[radio-clips-r724]',cleanText(error?.message||error));
    const existingDynamic=clipLibrary.filter(item=>!item.builtIn&&!bumperSlotR724(item)&&!isAnySpecialInsertR727(item));
    clipLibrary=[...builtIn,...existingDynamic.filter(item=>!builtIn.some(b=>b.url===item.url))];
  }
  state.libraryVideos=clipLibrary.length;
  state.libraryBumpers=bumperLibrary.length;
  state.librarySpecial=(specialInsertR726?1:0)+(specialHourlyInsertR727?1:0);
  state.librarySpecial30=specialInsertR726?1:0;
  state.librarySpecial60=specialHourlyInsertR727?1:0;
  clipLibrary.forEach(prefetchClip); // download only; prepare normal clips only when they approach the queue
  bumperLibrary.forEach(prefetchPreparedClipR742); // short station inserts are cheap to prepare ahead
  if(specialInsertR726)prefetchPreparedClipR742(specialInsertR726);
  if(specialHourlyInsertR727)prefetchPreparedClipR742(specialHourlyInsertR727);
  return clipLibrary;
}

async function loadLibrary(){
  const previousSignature=librarySignature([...library,...clipLibrary,...bumperLibrary,...(specialInsertR726?[specialInsertR726]:[]),...(specialHourlyInsertR727?[specialHourlyInsertR727]:[])]);
  const url=`${PLAYLIST_URL}${PLAYLIST_URL.includes('?')?'&':'?'}ts=${Date.now()}`;
  const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R691'}});
  if(!response.ok)throw new Error(`R2 library HTTP ${response.status}`);

  const data=await response.json();
  const source=Array.isArray(data.tracks)?data.tracks:[];
  const validMp3=item=>{
    const url=String(item?.url||'');
    return /^https:\/\//i.test(url) && /\.mp3(?:$|\?)/i.test(url);
  };

  const albums=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    const keyLower=key.toLowerCase();
    const disabled=DISABLED_ALBUM_PREFIXES.some(prefix=>keyLower.startsWith(prefix));
    return /^albums\//i.test(key) && !disabled && validMp3(item);
  }).map(item=>prepareTrack(item,'album')));

  const singles=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    return /^singles\/[^/]+\.mp3$/i.test(key) && validMp3(item);
  }).map(item=>prepareTrack(item,'single')));

  const merged=mergeAlbumsAndSingles(albums,singles);
  if(!merged.tracks.length)throw new Error('R2 active MP3 library is empty');

  library=merged.tracks;
  await loadRadioClipsR691();
  state.libraryTracks=library.length;
  state.libraryAlbumTracks=albums.length;
  state.librarySingleTracks=merged.singles.length;
  state.duplicateSinglesSkipped=merged.skipped;
  state.libraryVideos=clipLibrary.length;
  state.libraryBumpers=bumperLibrary.length;
  state.lastLibraryRefresh=new Date().toISOString();
  state.librarySpecial=(specialInsertR726?1:0)+(specialHourlyInsertR727?1:0);
  state.librarySpecial30=specialInsertR726?1:0;
  state.librarySpecial60=specialHourlyInsertR727?1:0;
  const changed=previousSignature!==librarySignature([...library,...clipLibrary,...bumperLibrary,...(specialInsertR726?[specialInsertR726]:[]),...(specialHourlyInsertR727?[specialHourlyInsertR727]:[])]);
  return {library,clipLibrary,bumperLibrary,specialInsertR726,specialHourlyInsertR727,changed};
}

function addIdentityCandidates(target,item){
  for(const id of identityCandidates(item))target.add(id);
  if(!identityCandidates(item).length)target.add(primaryIdentity(item));
}

function identityAlreadySeen(target,item){
  const ids=identityCandidates(item);
  return ids.length ? ids.some(id=>target.has(id)) : target.has(primaryIdentity(item));
}

function mixTracksAndClipsR691(tracks,clips){
  const shuffledTracks=antiRepeatTrackOrderR726(tracks);
  const shuffledClips=antiRepeatClipOrderR726(clips);
  if(!shuffledTracks.length)return shuffledClips;
  if(!shuffledClips.length||shuffledTracks.length<2)return [...shuffledTracks,...shuffledClips];
  const gapCount=shuffledTracks.length-1;
  const gaps=shuffle(Array.from({length:gapCount},(_,i)=>i));
  const buckets=Array.from({length:gapCount},()=>[]);
  shuffledClips.forEach((clip,i)=>buckets[gaps[i%gapCount]].push(clip));
  const out=[];
  shuffledTracks.forEach((track,i)=>{
    out.push(track);
    if(i<gapCount&&buckets[i].length)out.push(...buckets[i]);
  });
  return out;
}

function reconcileQueueWithLibrary(){
  if(!queue.length)return;
  const played=queue.slice(0,queueIndex);
  const playedIds=new Set();
  played.forEach(item=>addIdentityCandidates(playedIds,item));
  const candidates=[];
  const seen=new Set();
  for(const item of [...library,...clipLibrary]){
    if(identityAlreadySeen(playedIds,item)||identityAlreadySeen(seen,item))continue;
    candidates.push(item);
    addIdentityCandidates(seen,item);
  }
  const fresh=mixTracksAndClipsR691(candidates.filter(x=>x.type!=='clip'),candidates.filter(x=>x.type==='clip'));
  queue=[...played,...fresh];
  state.queueLength=queue.length;
}

function buildQueue(){
  const out=mixTracksAndClipsR691(library,clipLibrary);
  state.cycle++;
  state.queueLength=out.length;
  return out;
}

function runCapture(command,args,{timeoutMs=20000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    let out='',err='';
    const timer=setTimeout(()=>{
      child.kill('SIGKILL');
      reject(new Error(`${command} timeout`));
    },timeoutMs);

    child.stdout.on('data',d=>out+=String(d));
    child.stderr.on('data',d=>err+=String(d));
    child.once('error',e=>{
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit',code=>{
      clearTimeout(timer);
      code===0 ? resolve(out) : reject(new Error(`${command} exit ${code}: ${err.slice(-900)}`));
    });
  });
}

async function probeDuration(url){
  const raw=await runCapture(
    'ffprobe',
    ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',url],
    {timeoutMs:25000}
  );
  const duration=Math.max(1,Number(String(raw).trim()||0));
  if(!Number.isFinite(duration))throw new Error('Invalid media duration');
  return duration;
}

function chooseFont(){
  const candidates=[
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
  ];
  return candidates.find(existsSync)||'';
}

function chooseTitleFont(){
  // R695: use a condensed heavy italic face already present on standard Ubuntu/OVH
  // installs. It stays readable in Cyrillic/Latin and visually matches the sharper
  // ANDRIK metal artwork better than the old plain yellow system font.
  const candidates=[
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  ];
  return candidates.find(existsSync)||chooseFont();
}

function ffFilterPath(path){
  return String(path).replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
}

function prepareCacheDir(){
  mkdirSync(CACHE_DIR,{recursive:true});
  mkdirSync(AUDIO_CACHE_DIR,{recursive:true});
  mkdirSync(VISUAL_CACHE_DIR,{recursive:true});
  mkdirSync(CLIP_CACHE_DIR,{recursive:true});
  if(!existsSync(LIVE_PREVIOUS_FILE_R726))writeFileSync(LIVE_PREVIOUS_FILE_R726,'','utf8');
  if(!existsSync(LIVE_NEXT_FILE_R726))writeFileSync(LIVE_NEXT_FILE_R726,'','utf8');
}

function audioCachePath(item){
  const id=createHash('sha1').update(String(item?.url||'')).digest('hex').slice(0,24);
  return `${AUDIO_CACHE_DIR}/${id}.mp3`;
}

function cachedAudioPathR712(item){
  if(!item?.url)return '';
  const path=audioCachePath(item);
  try{return existsSync(path)&&statSync(path).size>256000?path:''}catch(_){return ''}
}

async function ensureNextTrackReadyR712(item){
  if(item?.type!=='track')return '';
  const ready=cachedAudioPathR712(item);
  if(ready)return ready;
  return promiseTimeout(downloadTrackToCache(item),5000,'next MP3 preload');
}

function pruneAudioCache(keepPaths=[]){
  prepareCacheDir();
  const keep=new Set(keepPaths.filter(Boolean));
  let files=[];
  try{
    files=readdirSync(AUDIO_CACHE_DIR)
      .filter(name=>name.endsWith('.mp3'))
      .map(name=>{
        const path=`${AUDIO_CACHE_DIR}/${name}`;
        try{return {path,mtime:statSync(path).mtimeMs,size:statSync(path).size};}catch(_){return null;}
      })
      .filter(Boolean)
      .sort((a,b)=>b.mtime-a.mtime);
  }catch(_){return;}
  let kept=0;
  for(const file of files){
    if(keep.has(file.path)){kept++;continue;}
    if(kept<MAX_CACHED_TRACKS){kept++;continue;}
    try{unlinkSync(file.path);}catch(_){ }
  }
}

async function downloadTrackToCache(item){
  prepareCacheDir();
  const dest=audioCachePath(item);
  try{
    if(existsSync(dest) && statSync(dest).size>256000){
      return dest;
    }
  }catch(_){ }

  if(prefetchJobs.has(dest))return prefetchJobs.get(dest);

  const job=(async()=>{
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      const tmp=`${dest}.part-${process.pid}-${Date.now()}-${attempt}`;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),45000);
      try{
        const response=await fetch(item.url,{
          headers:{'user-agent':'ANDRIK-Radio-24-7-R612-AntiBuffer'},
          signal:controller.signal
        });
        if(!response.ok)throw new Error(`MP3 cache HTTP ${response.status}`);
        if(!response.body)throw new Error('MP3 cache empty response body');
        await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
        if(!existsSync(tmp) || statSync(tmp).size<256000)throw new Error('MP3 cache file too small');

        // R693: some source MP3 files contain an attached cover whose ID3 metadata says PNG
        // while the actual bytes are JPEG (FF D8 FF E0). FFmpeg then prints misleading
        // "Invalid PNG signature" even though the QR overlay is a valid PNG. Strip every
        // attached-picture/video stream once while caching; audio is copied bit-for-bit.
        const cleanTmp=`${dest}.clean-${process.pid}-${Date.now()}-${attempt}.mp3`; // R713: valid output suffix, prevents ffmpeg exit 234/EINVAL
        try{
          await runCapture('ffmpeg',[
            '-hide_banner','-loglevel','error','-y','-i',tmp,
            '-map','0:a:0','-vn','-sn','-dn','-c:a','copy','-map_metadata','0','-f','mp3',cleanTmp
          ],{timeoutMs:30000});
          if(!existsSync(cleanTmp) || statSync(cleanTmp).size<256000)throw new Error('MP3 audio-only cache file too small');
          unlinkSync(tmp);
          renameSync(cleanTmp,dest);
        }catch(error){
          try{if(existsSync(cleanTmp))unlinkSync(cleanTmp)}catch(_){ }
          throw error;
        }
        pruneAudioCache([dest]);
        return dest;
      }catch(error){
        lastError=error;
        try{unlinkSync(tmp);}catch(_){ }
        if(attempt<3)await sleep(900*attempt);
      }finally{
        clearTimeout(timer);
      }
    }
    throw lastError||new Error('MP3 cache download failed');
  })();

  prefetchJobs.set(dest,job);
  try{return await job;}finally{prefetchJobs.delete(dest);}
}

function prefetchTrack(item){
  if(!item?.url)return;
  downloadTrackToCache(item).catch(error=>{
    console.error('[prefetch]',cleanText(error?.message||error));
  });
}

function clipCachePathR691(item){
  if(String(item?.url||'')===JOY_OF_BEING_CLIP_URL)return JOY_OF_BEING_CLIP_PATH;
  const base=String(item?.key||item?.title||'clip').split('/').pop().replace(/\.mp4$/i,'')
    .normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,56)||'clip';
  const hash=createHash('sha1').update(String(item?.url||item?.key||item?.title||base)).digest('hex').slice(0,10);
  return `${CLIP_CACHE_DIR}/${base}-${hash}.mp4`;
}

async function downloadRadioClipR691(item){
  if(!item?.url)throw new Error('radio clip URL missing');
  prepareCacheDir();
  const dest=clipCachePathR691(item);
  try{if(existsSync(dest)&&statSync(dest).size>500000)return dest}catch(_){ }
  if(clipPrefetchJobs.has(dest))return clipPrefetchJobs.get(dest);
  const job=(async()=>{
    const tmp=`${dest}.part-${process.pid}-${Date.now()}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),240000);
    try{
      const response=await fetch(item.url,{headers:{'user-agent':'ANDRIK-Radio-R691-Clip'},signal:controller.signal});
      if(!response.ok)throw new Error(`clip HTTP ${response.status}`);
      if(!response.body)throw new Error('clip empty response');
      await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
      if(!existsSync(tmp)||statSync(tmp).size<500000)throw new Error('clip file too small');
      renameSync(tmp,dest);
      return dest;
    }finally{
      clearTimeout(timer);
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
    }
  })();
  clipPrefetchJobs.set(dest,job);
  try{return await job}finally{clipPrefetchJobs.delete(dest)}
}

function prefetchClip(item){
  if(!item?.url)return;
  downloadRadioClipR691(item).catch(error=>console.error('[clip-prefetch]',cleanText(error?.message||error)));
}


function preparedClipPathR742(sourcePath){
  return String(sourcePath).replace(/\.mp4$/i,'')+'.r742-ready.mp4';
}
function preparedClipExpectedTitleR745(item){
  const stationInsert=item?.sourceType==='radio-bumper'||String(item?.sourceType||'').startsWith('radio-special');
  return stationInsert?'ANDRIK METAL RADIO':`КЛИП • ANDRIK — ${shortText(item?.title||'VIDEO',34)}`;
}
function preparedClipValidR742(sourcePath,readyPath=preparedClipPathR742(sourcePath),item=null){
  try{
    if(!existsSync(sourcePath)||!existsSync(readyPath))return false;
    const src=statSync(sourcePath), out=statSync(readyPath);
    if(!(out.size>CLIP_PREP_MIN_BYTES_R742 && out.mtimeMs>=src.mtimeMs))return false;
    // R745: a prepared MP4 has the title burned into the pixels. If API metadata was
    // corrected later, do not reuse the old numeric-title cache — rebuild it once.
    if(item){
      const titleFile=preparedClipTitleFileR742(readyPath);
      if(!existsSync(titleFile))return false;
      const cachedTitle=cleanText(readFileSync(titleFile,'utf8'));
      if(cachedTitle!==preparedClipExpectedTitleR745(item))return false;
    }
    return true;
  }catch(_){return false}
}
function preparedClipTitleFileR742(readyPath){return readyPath+'.title.txt';}
function preparedClipTickerFileR742(readyPath){return readyPath+'.ticker.txt';}
function preparedClipFilterComplexR742(titleFile,tickerFile,{stationInsert=false}={}){
  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const titlePath=ffFilterPath(titleFile);
  const tickerPath=ffFilterPath(tickerFile);
  const base=[
    'setpts=PTS-STARTPTS',
    'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
    'setsar=1',`fps=${VIDEO_FPS}`,'format=yuv420p'
  ];
  if(!stationInsert){
    base.push(
      'drawbox=x=0:y=ih-204:w=iw:h=88:color=black@0.38:t=fill',
      'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill',
      `drawtext=${titleFontPart}textfile='${titlePath}':fontcolor=white@0.01:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=8:bordercolor=black@0.92`,
      `drawtext=${titleFontPart}textfile='${titlePath}':fontcolor=0xF8F4EE:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1:shadowx=4:shadowy=4`,
      `drawtext=${fontPart}textfile='${tickerPath}':fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
    );
  }
  return `[0:v]${base.join(',')}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-24:y=24:shortest=1:format=yuv420,format=yuv420p[outv]`;
}
async function buildPreparedClipR742(item,sourcePath){
  const readyPath=preparedClipPathR742(sourcePath);
  if(preparedClipValidR742(sourcePath,readyPath,item))return readyPath;
  const hasAudio=await probeHasAudioR721(sourcePath);
  const stationInsert=item?.sourceType==='radio-bumper'||String(item?.sourceType||'').startsWith('radio-special');
  if(stationInsert&&!hasAudio)throw new Error(`R742 station insert audio missing: ${shortText(item?.title||'INSERT',40)}`);
  const duration=await probeDuration(sourcePath);
  const titleFile=preparedClipTitleFileR742(readyPath);
  const tickerFile=preparedClipTickerFileR742(readyPath);
  try{writeFileSync(titleFile,preparedClipExpectedTitleR745(item),'utf8')}catch(_){ }
  let ticker=DEFAULT_LIVE_TICKER;
  try{ticker=cleanText(readFileSync(LIVE_TICKER_FILE,'utf8'))||DEFAULT_LIVE_TICKER}catch(_){ }
  try{writeFileSync(tickerFile,ticker,'utf8')}catch(_){ }
  const tmp=readyPath+`.part-${process.pid}-${Date.now()}.mp4`;
  const args=[
    '-hide_banner','-loglevel','warning','-y','-filter_complex_threads','1','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-i',sourcePath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY
  ];
  if(!hasAudio)args.push('-f','lavfi','-i',`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`);
  args.push(
    '-filter_complex',preparedClipFilterComplexR742(titleFile,tickerFile,{stationInsert}),
    '-map','[outv]',...h264EncoderArgsR721(),'-threads','1',
    '-map',hasAudio?'0:a:0':'2:a:0','-af',`aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,
    '-c:a','aac','-profile:a','aac_low','-b:a',AUDIO_BITRATE,'-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-t',String(Math.max(0.5,duration)),'-movflags','+faststart','-max_muxing_queue_size','4096',tmp
  );
  try{
    await runCapture('nice',['-n',String(CLIP_PREP_NICE_R742),'ffmpeg',...args],{timeoutMs:CLIP_PREP_TIMEOUT_MS_R742});
    if(!existsSync(tmp)||statSync(tmp).size<CLIP_PREP_MIN_BYTES_R742)throw new Error('R742 prepared clip too small');
    renameSync(tmp,readyPath);
    state.preparedClipLast=shortText(item?.title||sourcePath.split('/').pop(),52);
    return readyPath;
  }finally{
    try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
  }
}
async function ensurePreparedClipR742(item){
  const sourcePath=await downloadRadioClipR691(item);
  const readyPath=preparedClipPathR742(sourcePath);
  if(preparedClipValidR742(sourcePath,readyPath,item))return readyPath;
  if(preparedClipJobsR742.has(readyPath))return preparedClipJobsR742.get(readyPath);
  preparedClipPendingR742++;
  state.preparedClipPending=preparedClipPendingR742;
  const job=preparedClipSerialR742=preparedClipSerialR742.catch(()=>{}).then(()=>buildPreparedClipR742(item,sourcePath));
  preparedClipJobsR742.set(readyPath,job);
  try{return await job}
  finally{
    preparedClipJobsR742.delete(readyPath);
    preparedClipPendingR742=Math.max(0,preparedClipPendingR742-1);
    state.preparedClipPending=preparedClipPendingR742;
    try{
      state.preparedClipReady=readdirSync(CLIP_CACHE_DIR).filter(n=>n.endsWith('.r742-ready.mp4')).length;
    }catch(_){ }
  }
}
function prefetchPreparedClipR742(item){
  if(!item?.url)return;
  ensurePreparedClipR742(item).catch(error=>console.error('[clip-prepare-r742]',cleanText(error?.message||error)));
}
function preparedClipReadyNowR742(item){
  try{
    const sourcePath=clipCachePathR691(item);
    const readyPath=preparedClipPathR742(sourcePath);
    return preparedClipValidR742(sourcePath,readyPath,item)?readyPath:'';
  }catch(_){return ''}
}
function clipPreparedFeederArgsR742(readyPath,{hasAudio=true,duration=0}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',readyPath,
    '-map','0:v:0','-an','-sn','-dn','-c:v','copy','-bsf:v','h264_mp4toannexb','-f','h264','pipe:1',
    '-map',hasAudio?'0:a:0':'0:a:0','-vn','-sn','-dn',
    '-af',`aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
  ];
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','s16le','pipe:3');
  return args;
}


function videoLeadForDurationR744(duration){
  const d=Math.max(0,Number(duration)||0);
  return Math.max(0.75,Math.min(videoPipelineLeadR744,Math.max(0.75,d-0.75)));
}
function clipPreparedVideoOnlyArgsR744(readyPath,{duration=0}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',readyPath,
    '-map','0:v:0','-an','-sn','-dn','-c:v','copy','-bsf:v','h264_mp4toannexb'
  ];
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','h264','pipe:1');
  return args;
}
function clipPreparedAudioOnlyArgsR744(readyPath,{duration=0}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',readyPath,
    '-map','0:a:0','-vn','-sn','-dn',
    '-af',`aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
  ];
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','s16le','pipe:1');
  return args;
}
async function stopPreparedVideoPrerollR744(){
  const child=clipVideoPrerollR744;
  if(!child){clipVideoPrerollIdentityR744='';return;}
  const videoSink=publisher?.stdio?.[4];
  try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
  if(child.exitCode===null){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,500))&&child.exitCode===null){
      try{child.kill('SIGKILL')}catch(_){ }
      await waitChildExit(child,150);
    }
  }
  if(clipVideoPrerollR744===child)clipVideoPrerollR744=null;
  clipVideoPrerollIdentityR744='';
}
async function startPreparedVideoPrerollR744(item,readyPath,duration){
  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!videoSink||videoSink.destroyed||videoSink.writableEnded)throw new Error('R744 persistent video pipe unavailable');
  visualSwitching=true;
  try{
    await stopNormalVideoFeederR721();
    await stopPreparedVideoPrerollR744();
    clipActive=true;
    const child=spawn('ffmpeg',clipPreparedVideoOnlyArgsR744(readyPath,{duration}),{stdio:['ignore','pipe','pipe']});
    clipVideoPrerollR744=child;
    clipVideoPrerollIdentityR744=primaryIdentity(item);
    child.stdout.pipe(videoSink,{end:false});
    child.stdout.on('error',()=>{});
    child.stderr.on('data',d=>{
      const line=String(d||'').trim();
      if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);console.error('[r744-video-preroll]',line);}
    });
    child.on('exit',()=>{
      try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
      if(clipVideoPrerollR744===child)clipVideoPrerollR744=null;
    });
    state.videoHandoffMode='R744-PREROLLED-VIDEO-INSERT';
    return true;
  }finally{visualSwitching=false;}
}
async function startNormalVideoPrerollR744(item,duration){
  const visual=await ensureScheduledVisual();
  const period=activeVisualPeriodR721();
  const identity=primaryIdentity(item);
  visualSwitching=true;
  try{
    await stopPreparedVideoPrerollR744();
    clipActive=false;
    await stopNormalVideoFeederR721();
    writeOverlayFileR726(LIVE_CURRENT_FILE,currentOverlayTextR738(item));
    const visualOffsetSeconds=await visualLoopOffsetR735(visual);
    const ok=startNormalVideoFeederR721(visual,{fadeIn:false,trackDuration:duration,visualOffsetSeconds});
    videoFeederPath=visual;
    videoFeederPeriod=period;
    videoFeederTrackIdentityR744=identity;
    videoFeederPrerolledR744=true;
    state.videoHandoffMode='R744-PREROLLED-NORMAL';
    return ok;
  }finally{visualSwitching=false;}
}
function fallbackAfterVideoR744(actualNext,next,following){
  if(!actualNext)return null;
  if(actualNext.type==='clip' && primaryIdentity(actualNext)===primaryIdentity(next))return following||null;
  return next||following||null;
}
async function prerollItemR744(item,{duration=0}={}){
  if(!item)return false;
  if(item.type==='track'){
    const local=await ensureNextTrackReadyR712(item);
    const d=Number(duration)>0?Number(duration):await probeDuration(local||item.url);
    return startNormalVideoPrerollR744(item,d);
  }
  const ready=preparedClipReadyNowR742(item);
  if(!ready)throw new Error(`R744 prepared video not ready: ${shortText(item.title||'VIDEO',40)}`);
  const d=Number(duration)>0?Number(duration):await probeDuration(ready);
  return startPreparedVideoPrerollR744(item,ready,d);
}
function scheduleTrackVideoHandoffR744(currentItem,actualNext,next,following,duration){
  const generation=++videoHandoffGenerationR744;
  const lead=videoLeadForDurationR744(duration);
  const delayMs=Math.max(0,Math.round((Math.max(0,Number(duration)||0)-lead)*1000));
  if(actualNext?.type!=='track')prefetchPreparedClipR742(actualNext);
  setTimeout(async()=>{
    if(stopping||generation!==videoHandoffGenerationR744)return;
    if(primaryIdentity(state.current)!==primaryIdentity(currentItem))return;
    try{
      await prerollItemR744(actualNext);
      suppressedVideoIdentityR744='';
      state.suppressedVideoInsert='';
    }catch(error){
      const badId=primaryIdentity(actualNext);
      if(actualNext && actualNext.type!=='track'){
        suppressedVideoIdentityR744=badId;
        state.suppressedVideoInsert=shortText(actualNext.title||'VIDEO',40);
        const fallback=fallbackAfterVideoR744(actualNext,next,following);
        if(fallback){
          writeOverlayFileR726(LIVE_NEXT_FILE_R726,nextOverlayTextR736(fallback));
          await prerollItemR744(fallback);
        }
      }else{
        state.lastError=`R744 preroll: ${cleanText(error?.message||error)}`;
      }
    }
  },delayMs).unref?.();
  return lead;
}

function localHourInTimeZone(timeZone=VISUAL_TIME_ZONE){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone,
    hour:'2-digit',
    hourCycle:'h23'
  }).formatToParts(new Date());
  const hour=Number(parts.find(part=>part.type==='hour')?.value||0);
  return Number.isFinite(hour)?hour:0;
}

function visualPeriodForHour(hour){
  if(hour>=6 && hour<12)return 'morning';
  if(hour>=12 && hour<18)return 'day';
  if(hour>=18)return 'evening';
  return 'night';
}

async function downloadVisualToCache(url,dest,label){
  prepareCacheDir();
  try{
    if(existsSync(dest) && statSync(dest).size>2*1024*1024)return dest;
  }catch(_){}
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    const tmp=`${dest}.part-${process.pid}-${Date.now()}-${attempt}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),120000);
    try{
      const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R621-VisualCache'},signal:controller.signal});
      if(!response.ok)throw new Error(`${label} visual HTTP ${response.status}`);
      if(!response.body)throw new Error(`${label} visual empty response`);
      await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
      if(!existsSync(tmp) || statSync(tmp).size<2*1024*1024)throw new Error(`${label} visual file too small`);
      renameSync(tmp,dest);
      return dest;
    }catch(error){
      lastError=error;
      try{unlinkSync(tmp)}catch(_){}
      if(attempt<3)await sleep(1200*attempt);
    }finally{clearTimeout(timer)}
  }
  throw lastError||new Error(`${label} visual download failed`);
}

function visualSpecForPeriod(period){
  if(period==='morning')return {period,path:MORNING_VISUAL,url:MORNING_VISUAL_URL};
  if(period==='day')return {period,path:DAY_VISUAL,url:DAY_VISUAL_URL};
  if(period==='evening')return {period,path:EVENING_VISUAL,url:EVENING_VISUAL_URL};
  return {period:'night',path:NIGHT_VISUAL,url:NIGHT_VISUAL_URL};
}

async function ensureVisualSpec(spec){
  try{
    if(existsSync(spec.path) && statSync(spec.path).size>2*1024*1024)return spec.path;
  }catch(_){}
  if(/^https:\/\//i.test(spec.url||''))return downloadVisualToCache(spec.url,spec.path,spec.period);
  if(existsSync(spec.url||'') && statSync(spec.url).size>500000)return spec.url;
  throw new Error(`R622 ${spec.period} visual unavailable: ${spec.url||spec.path}`);
}

function prefetchAllVisuals(){
  for(const period of ['morning','day','evening','night']){
    const spec=visualSpecForPeriod(period);
    ensureVisualSpec(spec).catch(error=>console.error('[visual-prefetch]',cleanText(error?.message||error)));
  }
}

async function ensureScheduledVisual(){
  prepareCacheDir();
  const scheduled=visualPeriodForHour(localHourInTimeZone());
  const period=runtimeForceVisualSlot || scheduled;
  const spec=visualSpecForPeriod(period);
  try{
    const path=await ensureVisualSpec(spec);
    state.visualPeriod=runtimeVisualAutoSchedule?`auto-${period}`:(runtimeForceVisualSlot?`manual-${period}`:period);
    state.visualPath=path;
    state.visualInsetCrop='';
    return path;
  }catch(error){
    if(period==='morning'){
      try{
        const fallback=await ensureVisualSpec(visualSpecForPeriod('day'));
        state.lastError=`R721 morning not assigned yet — temporary DAY fallback: ${cleanText(error?.message||error)}`;
        state.visualPeriod=runtimeVisualAutoSchedule?'auto-morning-fallback-day':'morning-fallback-day';
        state.visualPath=fallback;
        state.visualInsetCrop='';
        return fallback;
      }catch(_){ }
    }
    if(existsSync(EMERGENCY_VISUAL) && statSync(EMERGENCY_VISUAL).size>300000){
      state.lastError=`R721 ${period} local visual fallback: ${cleanText(error?.message||error)}`;
      state.visualPeriod=`${period}-emergency`;
      state.visualPath=EMERGENCY_VISUAL;
      state.visualInsetCrop='';
      return EMERGENCY_VISUAL;
    }
    throw error;
  }
}

function activeVisualPeriodR721(){
  return runtimeForceVisualSlot || visualPeriodForHour(localHourInTimeZone());
}

function equalizerSpecR721(){
  const period=activeVisualPeriodR721();
  const specs={
    morning:{name:'morning-soft-gold-seamless-r721',path:EQUALIZER_FILES_R721.morning},
    day:{name:'day-steel-seamless-r721',path:EQUALIZER_FILES_R721.day},
    evening:{name:'evening-amber-seamless-r721',path:EQUALIZER_FILES_R721.evening},
    night:{name:'night-blue-seamless-r721',path:EQUALIZER_FILES_R721.night}
  };
  const spec=specs[period]||specs.day;
  state.equalizerPeriod=period;
  state.equalizerStyle=spec.name;
  return {period,...spec};
}

function trackLabel(item,fallback='—'){
  if(!item)return fallback;
  const title=shortText(item.title||'ANDRIK',48);
  const album=shortText(item.album||'',24);
  return album ? `${title} (${album})` : title;
}

function titleOverlayFiltersR721({dynamicTitle=true,showPreview=false,previewDuration=0}={}){
  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const curPath=ffFilterPath(LIVE_CURRENT_FILE);
  const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
  const prevPath=ffFilterPath(LIVE_PREVIOUS_FILE_R726);
  const nextPath=ffFilterPath(LIVE_NEXT_FILE_R726);
  const titleReload=dynamicTitle?`:reload=1`:'';
  const d=Math.max(0,Number(previewDuration)||0);
  // R743: restore the proven R732/R733 frame-bound window. PREVIOUS/NEXT are
  // visible during the ACTUAL final 8 seconds of this feeder, with no guessed global offset.
  const previewStart=Math.max(0,d-NEXT_PREVIEW_SECONDS_R726);
  const previewEnd=Math.max(previewStart+0.25,d-NEXT_PREVIEW_HIDE_BEFORE_END_R726);
  const previewEnable=showPreview&&d>NEXT_PREVIEW_SECONDS_R726+0.5
    ? `:enable='between(t\,${previewStart.toFixed(3)}\,${previewEnd.toFixed(3)})'`
    : `:enable='0'`;
  return [
    // R721: keep every source pixel. 16:9 fills 1920x1080; any other aspect is padded.
    'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
    'setsar=1',
    `fps=${VIDEO_FPS}`,
    'format=yuv420p',
    // R731: normal-track textfiles are loaded ONCE by this feeder. Their timing is then
    // physically bound to video-frame t, so wall-clock timers cannot flash stale titles.
    'drawbox=x=0:y=ih-204:w=iw:h=88:color=black@0.38:t=fill',
    'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill',
    `drawtext=${titleFontPart}textfile='${curPath}'${titleReload}:fontcolor=white@0.01:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=8:bordercolor=black@0.92`,
    `drawtext=${titleFontPart}textfile='${curPath}'${titleReload}:fontcolor=0xF8F4EE:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1:shadowx=4:shadowy=4`,
    `drawtext=${fontPart}textfile='${prevPath}':reload=1:fontcolor=white@1:fontsize=32:x=58:y=h-305:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${previewEnable}`,
    `drawtext=${fontPart}textfile='${nextPath}':reload=1:fontcolor=white@1:fontsize=32:x=w-text_w-58:y=h-305:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${previewEnable}`,
    `drawtext=${fontPart}textfile='${tickerPath}':reload=${VIDEO_FPS}:fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
  ].join(',');
}

function normalVideoFilterComplexR721({fadeIn=false,trackDuration=0}={}){
  const vf=titleOverlayFiltersR721({dynamicTitle:false,showPreview:true,previewDuration:trackDuration}); // R743: freeze CURRENT for this MP3; next feeder owns next title
  // R726: CTA remains tied to wall-clock phase even though the normal feeder is restarted
  // at song boundaries to produce a real fade-to-black / fade-from-black transition.
  const ctaPhase=(Date.now()/1000)%CTA_PERIOD_SECONDS_R722;
  const ctaEnable=`lt(mod(t+${ctaPhase.toFixed(3)}\,${CTA_PERIOD_SECONDS_R722})\,${CTA_SHOW_SECONDS_R722})`;
  // R738/R737: NEVER run fade filters on the real video. R738 only shifts the safe mask earlier. The R736 black-screen bug was
  // caused by fading the already-darkened base stream back "in". Instead generate a
  // separate opaque BLACK mask whose ALPHA alone rises/falls, then overlay that mask
  // over the untouched live picture. Even if the mask chain misbehaves, the base video
  // is never destructively changed and the next feeder always starts full-bright.
  let maskChain='';
  let finalChain='[ctabase]format=yuv420p[outv]';
  if(Number(trackDuration)>VIDEO_BOUNDARY_FADE_SECONDS_R744+1){
    // R744: the feeder itself is produced VIDEO_PIPELINE_LEAD_SECONDS_R744 ahead of audio.
    // Therefore its own t=trackDuration lands on the audible boundary at the viewer.
    // Fade only an alpha mask over the untouched base; if a handoff ever fails, the
    // mask automatically recovers after the planned boundary instead of hanging black.
    const outAt=Math.max(0,Number(trackDuration)-VIDEO_BOUNDARY_FADE_SECONDS_R744);
    const recoverAt=Number(trackDuration)+0.05;
    maskChain=`color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_BOUNDARY_FADE_SECONDS_R744.toFixed(2)}:alpha=1,fade=t=out:st=${recoverAt.toFixed(3)}:d=0.20:alpha=1[blackmask];`;
    finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]';
  }
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[2:v]fps=${VIDEO_FPS},setpts=N/(${VIDEO_FPS}*TB),format=yuva420p[eqv];[base][eqv]overlay=x=(W-w)/2:y=H-h-64:shortest=0:format=yuv420,format=yuv420p[eqbase];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[eqbase][qr]overlay=x=W-w-24:y=24:shortest=0:format=yuv420,format=yuv420p[qrbase];[3:v]format=yuva420p[cta];[qrbase][cta]overlay=x=(W-w)/2:y=46:shortest=0:format=yuv420:enable='${ctaEnable}'[ctabase];${maskChain}${finalChain}`;
}

function clipFilterComplexR721(){
  const vf=titleOverlayFiltersR721({dynamicTitle:true,showPreview:false});
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-24:y=24:shortest=1:format=yuv420,format=yuv420p[outv]`;
}

function bumperFilterComplexR724(){
  const vf=[
    `scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos`,
    `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black`,
    `setsar=1`,`fps=${VIDEO_FPS}`
  ].join(',');
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-24:y=24:shortest=1:format=yuv420,format=yuv420p[outv]`;
}

function h264EncoderArgsR721(){
  // B-frames are deliberately disabled. The persistent relay assigns one exact 1/25s
  // timestamp per H264 packet, so DTS=PTS remains valid across every feeder switch.
  return [
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
    '-profile:v','high','-level:v','4.1',
    '-b:v',VIDEO_BITRATE,'-minrate',VIDEO_BITRATE,'-maxrate',VIDEO_BITRATE,'-bufsize','9000k',
    '-x264-params',`nal-hrd=cbr:force-cfr=1:repeat-headers=1:keyint=${VIDEO_GOP}:min-keyint=${VIDEO_GOP}:scenecut=0`,
    '-g',String(VIDEO_GOP),'-keyint_min',String(VIDEO_GOP),'-sc_threshold','0','-bf','0','-refs','1','-coder','1',
    '-r',String(VIDEO_FPS),'-pix_fmt','yuv420p'
  ];
}

function scheduleTransportSelfHealR746(rawLine,thisPublisher){
  if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return false;
  const line=cleanText(rawLine);
  if(!line || !TRANSPORT_FATAL_REGEX_R746.test(line))return false;
  state.transportHealthy=false;
  state.transportSelfHealPending=true;
  state.transportSelfHealCount=Number(state.transportSelfHealCount||0)+1;
  state.lastTransportFatalAt=new Date().toISOString();
  state.lastTransportFatalReason=line.slice(-900);
  state.lastError=`R746 RTMPS/TLS fatal: ${line.slice(-650)}`;
  if(transportFatalTimerR746)return true;
  console.error('[r746-transport-watchdog] fatal RTMPS/TLS detected; full service self-heal scheduled:',line);
  transportFatalTimerR746=setTimeout(()=>{
    transportFatalTimerR746=null;
    if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return;
    state.lastExit={layer:'r746-rtmps-tls-watchdog',code:75,signal:null,at:new Date().toISOString()};
    console.error('[r746-transport-watchdog] exiting with code 75 so systemd rebuilds RTMPS/TLS session');
    process.exit(75);
  },TRANSPORT_FATAL_RESTART_DELAY_MS_R746);
  transportFatalTimerR746.unref?.();
  return true;
}

function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }
  if(publisher && publisher.exitCode===null)return true;
  prepareCacheDir();
  if(!existsSync(LIVE_TICKER_FILE)) writeFileSync(LIVE_TICKER_FILE,DEFAULT_LIVE_TICKER,'utf8');
  if(!existsSync(LIVE_CURRENT_FILE)) writeFileSync(LIVE_CURRENT_FILE,'ANDRIK','utf8');

  // R721 transport: video feeders encode the final 1920x1080 frame to Annex-B H264.
  // This ONE master never closes at MP3<->clip or MORNING/DAY/EVENING/NIGHT boundaries.
  // The setts bitstream filter gives every incoming frame a monotonically increasing
  // 1/25-second timestamp, independent of feeder process restarts. No video re-encode here.
  const args=[
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size',String(VIDEO_INPUT_QUEUE_PACKETS_R732),'-fflags','+genpts+discardcorrupt','-framerate',String(VIDEO_FPS),'-f','h264','-i','pipe:4',
    '-thread_queue_size',String(AUDIO_INPUT_QUEUE_PACKETS_R732),'-f','s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-i','pipe:3',
    '-map','0:v:0','-map','1:a:0',
    '-c:v','copy',
    '-bsf:v',`setts=time_base=1/${VIDEO_FPS}:pts=N:dts=N:duration=1`,
    '-c:a','aac','-profile:a','aac_low','-b:a',AUDIO_BITRATE,'-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-max_muxing_queue_size','4096','-flush_packets','1',
    '-f','fifo','-fifo_format','flv','-queue_size','8192',
    '-timeshift',`${OUTPUT_TIMESHIFT_SECONDS}s`,
    '-drop_pkts_on_overflow','0',
    '-attempt_recovery','1','-recover_any_error','1','-recovery_wait_time','1','-restart_with_keyframe','1',
    STREAM_URL
  ];

  const thisPublisher=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe','pipe','pipe']});
  publisher=thisPublisher;
  state.publisherRunning=true;
  state.transportHealthy=true;
  state.transportSelfHealPending=false;
  if(!state.streamStartedAt)state.streamStartedAt=new Date().toISOString();
  const audioSink=thisPublisher.stdio[3];
  const videoSink=thisPublisher.stdio[4];
  for(const [label,sink] of [['audio',audioSink],['video',videoSink]]){
    sink.on('error',err=>{
      if(!stopping && !/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(err?.code||err?.message||err)))state.lastError=`${label}-pipe: ${String(err)}`;
    });
  }
  thisPublisher.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      // A repeated timestamp error is a hard regression in R721 and must be visible.
      if(/error|fail|invalid|broken pipe|non-monoton|unset in a packet/i.test(line))state.lastError=line.slice(-700);
      scheduleTransportSelfHealR746(line,thisPublisher);
      console.error('[master]',line);
    }
  });
  thisPublisher.on('exit',(code,signal)=>{
    const isCurrent=publisher===thisPublisher;
    if(isCurrent){publisher=null;state.publisherRunning=false;state.transportHealthy=false;state.transportSelfHealPending=false;if(transportFatalTimerR746){clearTimeout(transportFatalTimerR746);transportFatalTimerR746=null;}}
    if(isCurrent && !stopping){
      state.lastExit={layer:'persistent-master',code,signal,at:new Date().toISOString()};
      // An actual RTMPS/master failure is the only reason the service exits/restarts.
      setTimeout(()=>process.exit(code||22),900).unref();
    }
  });
  thisPublisher.on('error',err=>{if(publisher===thisPublisher)state.lastError=String(err);});
  return true;
}

async function visualLoopOffsetR735(visualPath){
  const now=Date.now();
  let st=null;
  try{st=statSync(visualPath);}catch(_){return 0;}
  let rec=visualContinuityR735.get(visualPath);
  const changed=!rec || rec.size!==st.size || rec.mtimeMs!==st.mtimeMs;
  if(changed){
    let duration=0;
    try{duration=await probeDuration(visualPath);}catch(_){duration=0;}
    rec={anchorMs:now,duration,size:st.size,mtimeMs:st.mtimeMs};
    visualContinuityR735.set(visualPath,rec);
    state.visualLoopOffsetSeconds=0;
    return 0;
  }
  if(!Number.isFinite(rec.duration)||rec.duration<=0)return 0;
  const offset=Math.max(0,((now-rec.anchorMs)/1000)%rec.duration);
  state.visualLoopOffsetSeconds=Number(offset.toFixed(3));
  return offset;
}

function normalVideoFeederArgsR721(visualPath,eqPath,{fadeIn=false,trackDuration=0,visualOffsetSeconds=0}={}){
  const visualSeek=Number(visualOffsetSeconds)>0.05 ? ['-ss',Number(visualOffsetSeconds).toFixed(3)] : [];
  return [
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','64','-re','-stream_loop','-1',...visualSeek,'-i',visualPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY,
    '-thread_queue_size','32','-re','-stream_loop','-1','-i',eqPath,
    '-loop','1','-framerate','1','-i',CTA_OVERLAY_R722,
    '-filter_complex',normalVideoFilterComplexR721({fadeIn,trackDuration}),
    '-map','[outv]','-an','-sn','-dn',
    ...h264EncoderArgsR721(),
    '-f','h264','pipe:1'
  ];
}

async function stopNormalVideoFeederR721(){
  const active=videoFeeder;
  if(!active)return;
  const videoSink=publisher?.stdio?.[4];
  try{if(active.stdout&&videoSink)active.stdout.unpipe(videoSink)}catch(_){ }
  if(active.exitCode===null){
    try{active.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(active,1800)) && active.exitCode===null){
      try{active.kill('SIGKILL')}catch(_){ }
      await waitChildExit(active,250);
    }
  }
  if(videoFeeder===active)videoFeeder=null;
  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;
}

function startNormalVideoFeederR721(visualPath,{fadeIn=false,trackDuration=0,visualOffsetSeconds=0}={}){
  if(stopping || clipActive)return false;
  const videoSink=publisher?.stdio?.[4];
  if(!publisher || publisher.exitCode!==null || !videoSink || videoSink.destroyed || videoSink.writableEnded)throw new Error('R721 persistent video pipe unavailable');
  const eq=equalizerSpecR721();
  if(!existsSync(visualPath) || statSync(visualPath).size<300000)throw new Error(`visual missing: ${visualPath}`);
  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000)throw new Error(`QR overlay missing: ${QR_OVERLAY}`);
  if(!existsSync(CTA_OVERLAY_R722) || statSync(CTA_OVERLAY_R722).size<5000)throw new Error(`R722 CTA overlay missing: ${CTA_OVERLAY_R722}`);
  if(!existsSync(eq.path) || statSync(eq.path).size<20000)throw new Error(`equalizer missing: ${eq.path}`);

  const child=spawn('ffmpeg',normalVideoFeederArgsR721(visualPath,eq.path,{fadeIn,trackDuration,visualOffsetSeconds}),{stdio:['ignore','pipe','pipe']});
  videoFeeder=child;
  videoFeederPath=visualPath;
  videoFeederPeriod=eq.period;
  child.stdout.pipe(videoSink,{end:false});
  child.stdout.on('error',()=>{});
  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);
      console.error('[video-feed]',line);
    }
  });
  child.on('exit',(code,signal)=>{
    const isCurrent=videoFeeder===child;
    try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
    if(isCurrent)videoFeeder=null;
    if(isCurrent && !stopping && !clipActive && !visualSwitching){
      state.lastError=`R721 visual feeder exit ${code??signal}; restarting without RTMPS reconnect`;
      setTimeout(()=>ensureNormalVideoFeederR721({force:true}).catch(err=>{state.lastError=`R721 visual feeder restart: ${cleanText(err?.message||err)}`;}),120).unref();
    }
  });
  child.on('error',err=>{if(videoFeeder===child)state.lastError=`R721 visual feeder: ${String(err)}`;});
  return true;
}

async function ensureNormalVideoFeederR721({force=false,fadeIn=false,trackDuration=null}={}){
  if(stopping || clipActive)return true;
  const visual=await ensureScheduledVisual();
  const period=activeVisualPeriodR721();
  if(!force && videoFeeder && videoFeeder.exitCode===null && videoFeederPath===visual && videoFeederPeriod===period)return true;
  visualSwitching=true;
  try{
    await stopNormalVideoFeederR721();
    if(stopping || clipActive)return true;
    const plannedDuration=trackDuration===null ? remainingTrackSecondsR726() : Math.max(0,Number(trackDuration)||0);
    // R735: song boundaries still restart only the overlay/timing feeder, but the selected
    // MORNING/DAY/EVENING/NIGHT MP4 resumes at its wall-clock loop position instead of 0:00.
    // This preserves FFmpeg-frame-timed NEXT/PREVIOUS without visually restarting the background.
    const visualOffsetSeconds=await visualLoopOffsetR735(visual);
    return startNormalVideoFeederR721(visual,{fadeIn,trackDuration:plannedDuration,visualOffsetSeconds});
  }finally{
    visualSwitching=false;
  }
}

async function scheduleVisualTickR721(){
  if(stopping || clipActive || !runtimeVisualAutoSchedule || runtimeForceVisualSlot)return;
  const wanted=visualPeriodForHour(localHourInTimeZone());
  if(videoFeederPeriod!==wanted){
    try{await ensureNormalVideoFeederR721({force:true});state.lastError='';}
    catch(error){state.lastError=`R721 AUTO visual switch: ${cleanText(error?.message||error)}`;}
  }
}

async function applyVisualModeR721({slot='',auto=false,forceReload=false}={}){
  if(auto){
    runtimeForceVisualSlot='';
    runtimeVisualAutoSchedule=true;
  }else if(slot){
    const clean=String(slot).trim().toLowerCase();
    if(!['morning','day','evening','night'].includes(clean))throw new Error('invalid visual slot');
    runtimeForceVisualSlot=clean;
    runtimeVisualAutoSchedule=false;
  }
  if(!clipActive)await ensureNormalVideoFeederR721({force:true});
  return {ok:true,slot:runtimeForceVisualSlot||null,auto:runtimeVisualAutoSchedule,visualPeriod:state.visualPeriod,visualPath:state.visualPath};
}

async function probeHasAudioR721(path){
  // R738: two-stage probe. Some short R2 station IDs have odd metadata and the old
  // single ffprobe query could return no index even though FFmpeg can decode audio.
  try{
    const raw=await runCapture('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_type,channels,sample_rate','-of','csv=p=0',path],{timeoutMs:15000});
    if(/audio|\d/i.test(String(raw)))return true;
  }catch(_){ }
  try{
    await runCapture('ffmpeg',['-hide_banner','-loglevel','error','-i',path,'-map','0:a:0','-t','0.10','-f','null','-'],{timeoutMs:15000});
    return true;
  }catch(_){return false}
}

function clipFeederArgsR721(clipPath,{hasAudio=true,duration=0,isStationInsert=false}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',clipPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY
  ];
  if(!hasAudio)args.push('-f','lavfi','-i',`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`);
  args.push(
    '-filter_complex',isStationInsert?bumperFilterComplexR724():clipFilterComplexR721(),
    '-map','[outv]','-an','-sn','-dn',
    ...h264EncoderArgsR721(),
    '-f','h264','pipe:1',
    '-map',hasAudio?'0:a:0':'2:a:0','-vn','-sn','-dn',
    '-af',`aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
  );
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','s16le','pipe:3');
  return args;
}

async function stopClipFeederR721(child,videoSink,audioSink){
  if(!child)return;
  try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
  try{if(child.stdio?.[3]&&audioSink)child.stdio[3].unpipe(audioSink)}catch(_){ }
  if(child.exitCode===null){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,350)) && child.exitCode===null){
      try{child.kill('SIGKILL')}catch(_){ }
      await waitChildExit(child,150);
    }
  }
}

async function ensureVideoSourceAfterClipR745(next=null){
  if(stopping)return true;
  const preparedAlive=Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null);
  const normalAlive=Boolean(videoFeeder&&videoFeeder.exitCode===null);
  if(preparedAlive||normalAlive)return true;
  // A failed/late preroll used to leave the persistent master with no H264 input.
  // The master process stayed alive but YouTube eventually reported NODATA. Force a
  // normal visual immediately so the ONE RTMPS publisher never starves at clip EOF.
  clipActive=false;
  await stopPreparedVideoPrerollR744().catch(()=>{});
  await ensureNormalVideoFeederR721({force:true,fadeIn:false});
  state.videoHandoffMode='R745-CLIP-END-FORCED-NORMAL-RECOVERY';
  state.lastClipGuardRecovery={at:new Date().toISOString(),next:shortText(next?.title||'',52)};
  return true;
}

async function playVideoClipR691(previous,item,next){
  const itemId=primaryIdentity(item);
  if(suppressedVideoIdentityR744 && suppressedVideoIdentityR744===itemId){
    suppressedVideoIdentityR744='';
    state.suppressedVideoInsert='';
    state.lastError='';
    console.error('[r744-video-skip] skipped unprepared insert after safe fallback:',shortText(item?.title||'VIDEO',40));
    return false;
  }

  let readyPath='';
  try{
    readyPath=preparedClipReadyNowR742(item);
    if(!readyPath){
      prefetchPreparedClipR742(item);
      state.lastError=`R744 clip deferred: prepared cache not ready: ${shortText(item?.title||'VIDEO',40)}`;
      return false;
    }
  }catch(error){
    state.lastError=`R744 clip cache: ${cleanText(error?.message||error)}`;
    return false;
  }

  const duration=await probeDuration(readyPath).catch(()=>0);
  const hasAudio=await probeHasAudioR721(readyPath);
  const stationInsert=item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special');
  if(!hasAudio){
    state.lastError=`R744 video insert skipped: audio stream missing in ${shortText(item.title||'INSERT',40)}`;
    console.error('[r744-insert-audio]',state.lastError);
    return false;
  }

  // R744 safety rule: never start a clip/bumper picture at the audio boundary. Its
  // video must already have been pre-rolled through the 1024-packet master queue.
  // Otherwise the old failure returns: voice first, picture several seconds later.
  if(!clipVideoPrerollR744 || clipVideoPrerollIdentityR744!==itemId){
    state.lastError=`R744 video insert skipped: no aligned video preroll for ${shortText(item.title||'VIDEO',40)}`;
    console.error('[r744-no-preroll]',state.lastError);
    return false;
  }

  clearNextPreviewR726({invalidate:true});
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:String(item.sourceType||'').startsWith('radio-special')?'special':(item.sourceType==='radio-bumper'?'bumper':'clip'),title:item.title,album:item.album,url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  setLiveTitleR724(stationInsert?'ANDRIK METAL RADIO':`КЛИП • ANDRIK — ${shortText(item.title||'VIDEO',34)}`,{delayMs:0});

  const audioSink=publisher?.stdio?.[3];
  if(!publisher||publisher.exitCode!==null||!audioSink||audioSink.destroyed||audioSink.writableEnded){
    state.lastError='R744 persistent audio pipe unavailable before video insert';
    return false;
  }

  // Start only the audio at the REAL boundary. Video t=0 was sent lead-seconds earlier,
  // so the viewer receives video t=0 now, together with this audio t=0.
  let audioChild=null;
  const generation=++videoHandoffGenerationR744;
  try{
    clipActive=true;
    audioChild=spawn('ffmpeg',clipPreparedAudioOnlyArgsR744(readyPath,{duration}),{stdio:['ignore','pipe','pipe']});
    clipPublisher=audioChild;
    producer=audioChild;
    state.producerRunning=true;
    state.clipPlaybackMode='R744-PREPARED-VIDEO-PREROLL+AUDIO-BOUNDARY';
    audioChild.stdout.pipe(audioSink,{end:false});
    audioChild.stdout.on('error',()=>{});
    audioChild.stderr.on('data',d=>{
      const line=String(d||'').trim();
      if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);console.error('[r744-clip-audio]',line);}
    });

    // Before this clip becomes audible-finished, send the NEXT picture into the video
    // queue. The current prepared video process naturally represents exactly this clip.
    if(next && duration>1){
      if(next.type!=='track')prefetchPreparedClipR742(next);
      const lead=videoLeadForDurationR744(duration);
      const delayMs=Math.max(0,Math.round((duration-lead)*1000));
      setTimeout(async()=>{
        if(stopping||generation!==videoHandoffGenerationR744)return;
        if(primaryIdentity(state.current)!==itemId)return;
        try{
          await prerollItemR744(next);
          suppressedVideoIdentityR744='';
          state.suppressedVideoInsert='';
        }catch(error){
          if(next.type!=='track'){
            suppressedVideoIdentityR744=primaryIdentity(next);
            state.suppressedVideoInsert=shortText(next.title||'VIDEO',40);
          }
          state.lastError=`R744 next-video preroll: ${cleanText(error?.message||error)}`;
        }
      },delayMs).unref?.();
    }

    const clipExitPromise=new Promise((resolve,reject)=>{
      audioChild.once('error',reject);
      audioChild.once('exit',(code,signal)=>{
        try{audioChild.stdout.unpipe(audioSink)}catch(_){ }
        if(code===0||stopping)resolve(); else reject(new Error(`R745 clip audio exit ${code||signal}`));
      });
    });
    // R745: malformed/odd MP4 EOF must never freeze the radio loop forever.
    // Give FFmpeg the measured clip duration plus a generous margin, then kill only
    // this clip decoder; the persistent RTMPS master remains untouched.
    const guardMs=Math.max(12000,Math.round(Math.max(1,Number(duration)||1)*1000)+CLIP_END_GUARD_MARGIN_MS_R745);
    try{
      await promiseTimeout(clipExitPromise,guardMs,`R745 clip EOF ${shortText(item.title||'VIDEO',40)}`);
    }catch(error){
      state.lastError=`R745 clip EOF guard: ${cleanText(error?.message||error)}`;
      if(audioChild&&audioChild.exitCode===null){
        try{audioChild.kill('SIGTERM')}catch(_){ }
        if(!(await waitChildExit(audioChild,1200))&&audioChild.exitCode===null){try{audioChild.kill('SIGKILL')}catch(_){ }await waitChildExit(audioChild,250);}
      }
      await ensureVideoSourceAfterClipR745(next).catch(recoveryError=>{state.lastError+=` | recovery: ${cleanText(recoveryError?.message||recoveryError)}`;});
      return false;
    }
    if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;
    state.lastError='';
    return !stopping;
  }catch(error){
    state.lastError=`R744 VIDEO/AUDIO handoff: ${cleanText(error?.message||error)}`;
    console.error('[r744-video-clip]',error);
    return false;
  }finally{
    if(audioChild){
      try{audioChild.stdout?.unpipe(audioSink)}catch(_){ }
      if(audioChild.exitCode===null){try{audioChild.kill('SIGTERM')}catch(_){ }}
    }
    if(clipPublisher===audioChild)clipPublisher=null;
    if(producer===audioChild)producer=null;
    state.producerRunning=false;

    // If no next source took over early, cleanly return to the normal visual. Never
    // leave a stale prepared-video writer attached to the master pipe.
    if(clipVideoPrerollIdentityR744===itemId){
      await stopPreparedVideoPrerollR744();
      clipActive=false;
    }
    if(!stopping){
      try{await ensureVideoSourceAfterClipR745(next);}catch(error){state.lastError=`R745 resume visual: ${cleanText(error?.message||error)}`;}
    }
  }
}

function decoderArgs(localAudioPath,duration){
  const outStart=Math.max(0,Number(duration||0)-TRACK_AUDIO_FADE_OUT_R726);
  const af=[
    `loudnorm=I=${TRACK_AUDIO_TARGET_I_R726}:LRA=${TRACK_AUDIO_LRA_R726}:TP=${TRACK_AUDIO_TRUE_PEAK_R726}`,
    `afade=t=in:st=0:d=${TRACK_AUDIO_FADE_IN_R726}`,
    `afade=t=out:st=${outStart.toFixed(3)}:d=${TRACK_AUDIO_FADE_OUT_R726}`,
    `aresample=${AUDIO_SAMPLE_RATE}`
  ].join(',');
  return [
    '-hide_banner','-loglevel','warning',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',localAudioPath,
    '-map','0:a:0','-vn','-sn','-dn',
    '-af',af,
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-f','s16le','pipe:1'
  ];
}

function peekNextBumperR736(){
  const available=[...bumperLibrary].sort((a,b)=>bumperSlotR724(a)-bumperSlotR724(b));
  if(!available.length)return null;
  let idx=available.findIndex(x=>bumperSlotR724(x)>lastBumperSlotR724);
  if(idx<0)idx=0;
  return available[idx]||null;
}
function predictedImmediateNextR736(next,durationSeconds=0){
  const endAt=Date.now()+Math.max(0,Number(durationSeconds)||0)*1000;
  // Use the same priority as the real post-song scheduler: 60m special -> 30m special -> bumper -> queue item.
  if(specialHourlyInsertR727 && endAt-lastSpecialHourlyPlayedAtR727>=SPECIAL_HOURLY_INTERVAL_MS_R727)return specialHourlyInsertR727;
  if(specialInsertR726 && endAt-lastSpecialPlayedAtR726>=SPECIAL_INTERVAL_MS_R726)return specialInsertR726;
  if(bumperLibrary.length && songsSinceBumperR724+1>=bumperAfterSongsR724)return peekNextBumperR736()||next||null;
  return next||null;
}
function nextOverlayTextR736(item){
  if(!item)return '';
  const title=shortText(item.title||'ANDRIK',32);
  if(isSpecialHourlyInsertR727(item))return `NEXT • СПЕЦ 60 • ${title}`;
  if(isSpecialInsertR726(item))return `NEXT • СПЕЦ 30 • ${title}`;
  if(item.sourceType==='radio-bumper')return `NEXT • ЗАСТАВКА • ${title}`;
  if(item.type==='clip')return `NEXT • КЛИП • ${title}`;
  return `NEXT • ANDRIK — ${title}`;
}
function previousOverlayTextR745(item){
  if(!item)return '';
  const title=shortText(item.title||'ANDRIK',32);
  if(isSpecialHourlyInsertR727(item))return `PREVIOUS • СПЕЦ 60 • ${title}`;
  if(isSpecialInsertR726(item))return `PREVIOUS • СПЕЦ 30 • ${title}`;
  if(item.sourceType==='radio-bumper'||item.type==='bumper')return `PREVIOUS • ЗАСТАВКА • ${title}`;
  if(item.type==='clip')return `PREVIOUS • КЛИП • ${title}`;
  return `PREVIOUS • ANDRIK — ${title}`;
}
function currentOverlayTextR738(item){
  if(!item)return 'ANDRIK';
  if(item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special'))return 'ANDRIK METAL RADIO';
  if(item.type==='clip')return `КЛИП • ANDRIK — ${shortText(item.title||'VIDEO',34)}`;
  return `ANDRIK — ${shortText(item.title||'TRACK',42)}`;
}
function isVideoHandoffR738(item){
  return Boolean(item && (item.type==='clip'||item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special')));
}

async function playItem(previous,item,next,following,localAudioPath,nextTrackPreview=null){
  const duration=await probeDuration(localAudioPath||item.url);
  const actualNextR736=predictedImmediateNextR736(next,duration);
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.next=actualNextR736?{type:actualNextR736.sourceType?.startsWith('radio-special')?'special':(actualNextR736.sourceType==='radio-bumper'?'bumper':(actualNextR736.type||'track')),title:actualNextR736.title,album:actualNextR736.album||'',url:actualNextR736.url||''}:null;

  // R732: write the exact three labels BEFORE spawning this song's feeder.
  // The bounded raw-audio input queue prevents the radio loop from getting tens of seconds
  // ahead of what the listener actually hears. PREVIOUS/NEXT remain FFmpeg-frame-timed; R736 NEXT is the actual immediate item.
  // R731: write the exact three labels BEFORE spawning this song's feeder. Normal
  // feeders load them once and FFmpeg itself reveals PREVIOUS/NEXT only at T-8s.
  // No Node wall-clock timer can get ahead of the audio anymore.
  clearNextPreviewR726({invalidate:true});
  // R745: PREVIOUS must mean the item that ACTUALLY played immediately before this one.
  // The old R733 track-only fallback could show an older song after a clip and therefore lie.
  const previousForOverlayR745=previous||previousTrackFallbackR733(previous);
  writeOverlayFileR726(LIVE_CURRENT_FILE,`ANDRIK — ${shortText(item.title||'TRACK',42)}`);
  writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,previousOverlayTextR745(previousForOverlayR745));
  // R736: NEXT means literally the item that will play immediately after this MP3.
  // It may be an MP3, normal clip, 30/60-minute special, or the 4–6-song station bumper.
  writeOverlayFileR726(LIVE_NEXT_FILE_R726,nextOverlayTextR736(actualNextR736));

  // R744: if this track's video feeder was already started by the previous item,
  // keep it. Otherwise start it now with a shortened production lifetime so its
  // final T-8s preview/fade still reaches the viewer at this track's audible end.
  const currentIdentityR744=primaryIdentity(item);
  const currentVideoPrerolledR744=Boolean(
    videoFeeder && videoFeeder.exitCode===null && videoFeederTrackIdentityR744===currentIdentityR744 && videoFeederPrerolledR744
  );
  if(!currentVideoPrerolledR744){
    const effectiveVideoDurationR744=Math.max(1,Number(duration)-videoLeadForDurationR744(duration));
    await ensureNormalVideoFeederR721({force:true,fadeIn:false,trackDuration:effectiveVideoDurationR744});
    videoFeederTrackIdentityR744=currentIdentityR744;
    videoFeederPrerolledR744=false;
  }

  const audioSink=publisher?.stdio?.[3];
  if(!publisher || publisher.exitCode!==null || !audioSink || audioSink.destroyed) throw new Error('master audio pipe unavailable');

  const mediaStartedAt=Date.now();
  state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date(mediaStartedAt).toISOString(),duration};
  const currentIdentity=primaryIdentity(state.current);
  setLiveTitleR724(`ANDRIK — ${shortText(item.title||'TRACK',42)}`,{delayMs:0});
  if(actualNextR736){
    scheduleTrackVideoHandoffR744(item,actualNextR736,next,following,duration);
  }
  // R743: NEVER preload the future CURRENT into the old song. The next track/clip
  // writes its own CURRENT exactly when its feeder is created. This restores the
  // R732 behavior that previously matched the audible handoff.
  // PREVIOUS/NEXT remain FFmpeg-frame-timed in the final 8 seconds.

  state.producerRunning=true;
  producer=spawn('ffmpeg',decoderArgs(localAudioPath,duration),{stdio:['ignore','pipe','pipe']});
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      const brokenArtProbe=/Invalid PNG signature|Could not find codec parameters for stream 1 \(Video: png/i.test(line);
      if(!brokenArtProbe && /error|fail|invalid|corrupt/i.test(line))state.lastError=line.slice(-700);
      if(!brokenArtProbe)console.error('[decoder]',line);
    }
  });

  let playedOkR726=false;
  try{
    await new Promise((resolve,reject)=>{
      const source=producer.stdout;
      source.pipe(audioSink,{end:false});
      producer.once('error',reject);
      producer.once('exit',(code,signal)=>{
        try{source.unpipe(audioSink);}catch(_){}
        state.producerRunning=false;
        producer=null;
        if(code===0 || stopping) resolve();
        else reject(new Error(`decoder exit ${code||signal}`));
      });
    });
    playedOkR726=true;
  }finally{
    clearNextPreviewR726({invalidate:true});
  }
  if(playedOkR726){rememberTrackR726(item);previousTrackForPreviewR726=item;}
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  prefetchAllVisuals();
  await ensureScheduledVisual();
  if(!startPublisher())return;
  await ensureNormalVideoFeederR721({force:true});
  scheduleTimerR721=setInterval(()=>{scheduleVisualTickR721().catch(error=>{state.lastError=`R721 schedule: ${cleanText(error?.message||error)}`;});},30000);
  scheduleTimerR721.unref?.();

  while(!stopping){
    try{
      const refreshAt=Date.parse(state.lastLibraryRefresh||0);
      if(!library.length || !refreshAt || Date.now()-refreshAt>LIBRARY_REFRESH_MS){
        const refreshed=await loadLibrary();
        if(refreshed.changed && queue.length)reconcileQueueWithLibrary();
      }

      if(!queue.length || queueIndex>=queue.length){
        queue=buildQueue();
        queueIndex=0;
      }

      const item=queue[queueIndex];
      const next=queue[queueIndex+1]||queue[0]||null;
      const following=queue[queueIndex+2]||queue[1]||queue[0]||null;
      const nextTrackPreview=queue.slice(queueIndex+1).find(x=>x?.type==='track')||queue.find(x=>x?.type==='track')||null;
      state.queuePosition=queueIndex+1;

      if(item?.type==='clip'){
        if(next?.type==='track'){
          try{
            await ensureNextTrackReadyR712(next);
          }catch(error){
            state.lastError=`R712 clip deferred: next MP3 not ready: ${cleanText(error?.message||error)}`;
            console.error('[clip-deferred]',state.lastError);
            queueIndex++;
            continue;
          }
        }
        if(following?.type==='track')prefetchTrack(following);else if(following?.type==='clip')prefetchPreparedClipR742(following);
        const clipPlayed=await playVideoClipR691(lastPlayed,item,next);
        lastPlayed=item;
        queueIndex++;
        if(clipPlayed)state.lastError='';
        continue;
      }

      const localAudioPath=await downloadTrackToCache(item);
      if(next?.type==='track')prefetchTrack(next);else if(next?.type==='clip')prefetchPreparedClipR742(next);
      if(following?.type==='track')prefetchTrack(following);else if(following?.type==='clip')prefetchPreparedClipR742(following);
      const keep=[localAudioPath];
      if(next?.type==='track')keep.push(audioCachePath(next));
      if(following?.type==='track')keep.push(audioCachePath(following));
      pruneAudioCache(keep);

      await playItem(lastPlayed,item,next,following,localAudioPath,nextTrackPreview);
      lastPlayed=item;
      queueIndex++;
      songsSinceBumperR724++;
      state.songsSinceBumper=songsSinceBumperR724;
      state.nextBumperAfterSongs=bumperAfterSongsR724;

      let specialPlayedR726=false;
      let specialHourlyPlayedR727=false;
      const nowSpecialR727=Date.now();
      if(!stopping && specialHourlyInsertR727 && nowSpecialR727-lastSpecialHourlyPlayedAtR727>=SPECIAL_HOURLY_INTERVAL_MS_R727){
        // R727: hourly station ID has priority at the hour mark so 30min + 60min never play back-to-back.
        moveUpcomingClipAfterTrackR724();
        const afterSpecial=queue[queueIndex]||null;
        if(afterSpecial?.type==='track'){
          try{await ensureNextTrackReadyR712(afterSpecial)}catch(error){console.error('[special60-prefetch]',cleanText(error?.message||error));}
        }
        specialHourlyPlayedR727=await playVideoClipR691(item,specialHourlyInsertR727,afterSpecial);
        if(specialHourlyPlayedR727){
          lastPlayed=specialHourlyInsertR727;
          lastSpecialHourlyPlayedAtR727=Date.now();
          state.lastSpecialHourlyPlayedAt=new Date(lastSpecialHourlyPlayedAtR727).toISOString();
          lastSpecialPlayedAtR726=lastSpecialHourlyPlayedAtR727;
          state.lastSpecialPlayedAt=new Date(lastSpecialPlayedAtR726).toISOString();
          state.lastError='';
        }
      }
      if(!specialHourlyPlayedR727 && !stopping && specialInsertR726 && Date.now()-lastSpecialPlayedAtR726>=SPECIAL_INTERVAL_MS_R726){
        // R726/R727: 30-minute station ID is inserted only BETWEEN songs, never interrupts music.
        moveUpcomingClipAfterTrackR724();
        const afterSpecial=queue[queueIndex]||null;
        if(afterSpecial?.type==='track'){
          try{await ensureNextTrackReadyR712(afterSpecial)}catch(error){console.error('[special30-prefetch]',cleanText(error?.message||error));}
        }
        specialPlayedR726=await playVideoClipR691(item,specialInsertR726,afterSpecial);
        if(specialPlayedR726){
          lastPlayed=specialInsertR726;
          lastSpecialPlayedAtR726=Date.now();
          state.lastSpecialPlayedAt=new Date(lastSpecialPlayedAtR726).toISOString();
          state.lastError='';
        }
      }

      if(!specialHourlyPlayedR727 && !specialPlayedR726 && !stopping && bumperLibrary.length && songsSinceBumperR724>=bumperAfterSongsR724){
        // Keep a station bumper between SONGS, never bumper -> normal clip back-to-back.
        moveUpcomingClipAfterTrackR724();
        const bumper=nextBumperR724();
        const afterBumper=queue[queueIndex]||null;
        if(bumper){
          if(afterBumper?.type==='track'){
            try{await ensureNextTrackReadyR712(afterBumper)}catch(error){console.error('[bumper-prefetch]',cleanText(error?.message||error));}
          }
          const bumperPlayed=await playVideoClipR691(item,bumper,afterBumper);
          if(bumperPlayed){
            lastPlayed=bumper;
            songsSinceBumperR724=0;
            bumperAfterSongsR724=randomBumperGapR724();
            state.songsSinceBumper=0;
            state.nextBumperAfterSongs=bumperAfterSongsR724;
            state.lastError='';
          }
        }
      }
      state.lastError='';
    }catch(error){
      state.lastError=String(error?.stack||error).slice(-1200);
      console.error('[radio]',error);

      if(producer && producer.exitCode===null)producer.kill('SIGTERM');
      producer=null;
      state.producerRunning=false;

      await sleep(1000);

      if(/library|HTTP|empty/i.test(String(error)))library=[];
      else queueIndex++;
    }
  }
}

function publicStatus(){
  const now=Date.now();
  return {
    ok:Boolean(state.publisherRunning && state.transportHealthy!==false && (clipActive || (videoFeeder && videoFeeder.exitCode===null))),
    service:state.service,
    version:state.version,
    mode:state.mode,
    overlayMode:state.overlayMode,
    audioMode:state.audioMode,
    engine:'R746-R745-PERSISTENT-H264-RELAY-RTMPS-TLS-SELFHEAL',
    videoPipeline:'R746 R745 SOURCE PREROLL + CLIP EOF WATCHDOG + VIDEO SOURCE RECOVERY + RTMPS/TLS SELF-HEAL',
    outputTimeshiftSeconds:OUTPUT_TIMESHIFT_SECONDS,
    videoBitrate:VIDEO_BITRATE,
    audioBitrate:AUDIO_BITRATE,
    audioSampleRate:AUDIO_SAMPLE_RATE,
    videoFps:VIDEO_FPS,
    videoGop:VIDEO_GOP,
    qrOverlay:QR_OVERLAY,
    subscribeLikeOverlay:CTA_OVERLAY_R722,
    subscribeLikeShowSeconds:CTA_SHOW_SECONDS_R722,
    subscribeLikePeriodSeconds:CTA_PERIOD_SECONDS_R722,
    titleHandoffDelayMs:TITLE_HANDOFF_DELAY_MS_R724,
    videoInputQueuePackets:VIDEO_INPUT_QUEUE_PACKETS_R732,
    audioInputQueuePackets:AUDIO_INPUT_QUEUE_PACKETS_R732,
    overlayPixelPath:'YUV420-NO-ARGB-R732',
    trackUiClock:'ffmpeg-frame-bound-R732-audio-lead-bounded',
    nextPreviewSeconds:NEXT_PREVIEW_SECONDS_R726,
    nextPreviewTiming:'R745-TRUE-PREVIOUS-NEXT-FINAL-8S-WITH-VIDEO-PREROLL',
    mp3BoundaryMode:'R745-R744-VIDEO-PREROLL-BOUNDARY',
    currentTitleHandoff:'R745-TRUE-PREVIOUS-NEXT-FEEDER-PREROLLED',
    nextPreviewHideBeforeEndSeconds:NEXT_PREVIEW_HIDE_BEFORE_END_R726,
    audioNormalizationTargetLufs:TRACK_AUDIO_TARGET_I_R726,
    audioTruePeakDb:TRACK_AUDIO_TRUE_PEAK_R726,
    audioFadeInSeconds:TRACK_AUDIO_FADE_IN_R726,
    audioFadeOutSeconds:TRACK_AUDIO_FADE_OUT_R726,
    videoFadeSeconds:VIDEO_FADE_SECONDS_R726,
      videoFadeStrategy:'R744-SAFE-ALPHA-LAST-0.80S-OF-PREROLLED-FEEDER',
      videoFadeInEnabled:false,
      videoBaseNeverFaded:true,
      videoOverlayMask:'BLACK_ALPHA_ONLY_R738',
      videoFadeInSeconds:0,
      videoBlackHoldSeconds:0,
      videoFadeLeadSeconds:0,
      titleVisualLeadSeconds:videoPipelineLeadR744,
      videoTimelineCompensationSeconds:0,
      videoTimelineCompensationMode:'R744-SOURCE-PREROLL-NOT-FILTER-SHIFT',
      clipAvSyncMode:'R744-SPLIT-VIDEO-PREROLL-AUDIO-AT-BOUNDARY',
      clipPreDrainMs:0,
      clipPostDrainMs:0,
      stationInsertAudioRequired:true,
      nextPreviewSource:'ACTUAL_IMMEDIATE_ITEM_R738',
      clipPlaybackMode:state.clipPlaybackMode||'R742-PREPARED-H264-COPY',
      clipPreparationMode:state.clipPreparationMode||'R742-SERIAL-NICE12-ONE-THREAD',
      preparedClipReady:state.preparedClipReady||0,
      preparedClipPending:state.preparedClipPending||0,
      preparedClipLast:state.preparedClipLast||'',
      clipLiveVideoCodec:'copy-video-only-prerolled',
      clipPreparedVideoCodec:'libx264-ultrafast-no-bframes',
      videoPipelineLeadSeconds:videoPipelineLeadR744,
      videoHandoffMode:state.videoHandoffMode||'R744-PREROLL-SOURCE-SWITCH',
      clipVideoPrerollRunning:Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null),
      clipVideoPrerollIdentity:clipVideoPrerollIdentityR744||'',
      videoFeederTrackIdentity:videoFeederTrackIdentityR744||'',
      videoFeederPrerolled:Boolean(videoFeederPrerolledR744),
      suppressedVideoInsert:state.suppressedVideoInsert||'',
    visualTimelineAnchor:'PTS-STARTPTS-R733',
    visualContinuityMode:state.visualContinuityMode,
    visualLoopOffsetSeconds:state.visualLoopOffsetSeconds,
    previousPreviewFallback:'R745-ACTUAL-PREVIOUS-ITEM-THEN-R733-RESTART-FALLBACK',
    antiRepeatTrackHistory:TRACK_HISTORY_LIMIT_R726,
    qrPosition:'top-right',
    visualTimeZone:state.visualTimeZone,
    forceVisualSlot:runtimeForceVisualSlot||null,
    visualAutoSchedule:runtimeVisualAutoSchedule,
    visualPeriod:state.visualPeriod,
    visualPath:state.visualPath,
    visualInsetCrop:state.visualInsetCrop||'',
    equalizerPeriod:state.equalizerPeriod,
    equalizerStyle:state.equalizerStyle,
    equalizerEngine:state.equalizerEngine,
    publisherRunning:state.publisherRunning,
    transportHealthy:state.transportHealthy!==false,
    transportWatchdogMode:'R746-FATAL-RTMPS-TLS-SIGNATURE-SYSTEMD-SELFHEAL',
    transportSelfHealDelayMs:TRANSPORT_FATAL_RESTART_DELAY_MS_R746,
    transportSelfHealPending:Boolean(state.transportSelfHealPending),
    transportSelfHealCount:Number(state.transportSelfHealCount||0),
    lastTransportFatalAt:state.lastTransportFatalAt||null,
    lastTransportFatalReason:state.lastTransportFatalReason||'',
    producerRunning:state.producerRunning,
    videoFeederRunning:Boolean(videoFeeder&&videoFeeder.exitCode===null),
    clipActive,
    clipBoundaryReconnect:false,
    clipEndGuardMode:'R745-DURATION-WATCHDOG-PLUS-VIDEO-SOURCE-RECOVERY',
    clipEndGuardMarginMs:CLIP_END_GUARD_MARGIN_MS_R745,
    lastClipGuardRecovery:state.lastClipGuardRecovery||null,
    libraryTracks:state.libraryTracks,
    libraryAlbumTracks:state.libraryAlbumTracks,
    librarySingleTracks:state.librarySingleTracks,
    duplicateSinglesSkipped:state.duplicateSinglesSkipped,
    libraryRefreshSeconds:Math.round(LIBRARY_REFRESH_MS/1000),
    libraryVideos:state.libraryVideos,
    libraryBumpers:state.libraryBumpers,
    librarySpecial:state.librarySpecial,
    librarySpecial30:state.librarySpecial30,
    librarySpecial60:state.librarySpecial60,
    specialIntervalSeconds:Math.round(SPECIAL_INTERVAL_MS_R726/1000),
    specialHourlyIntervalSeconds:Math.round(SPECIAL_HOURLY_INTERVAL_MS_R727/1000),
    specialLoaded:Boolean(specialInsertR726),
    specialHourlyLoaded:Boolean(specialHourlyInsertR727),
    lastSpecialPlayedAt:state.lastSpecialPlayedAt,
    lastSpecialHourlyPlayedAt:state.lastSpecialHourlyPlayedAt,
    specialDueInSeconds:specialInsertR726?Math.max(0,Math.ceil((SPECIAL_INTERVAL_MS_R726-(Date.now()-lastSpecialPlayedAtR726))/1000)):null,
    specialHourlyDueInSeconds:specialHourlyInsertR727?Math.max(0,Math.ceil((SPECIAL_HOURLY_INTERVAL_MS_R727-(Date.now()-lastSpecialHourlyPlayedAtR727))/1000)):null,
    bumperSlots:bumperLibrary.map(x=>x.bumperSlot||bumperSlotR724(x)).filter(Boolean),
    songsSinceBumper:songsSinceBumperR724,
    nextBumperAfterSongs:bumperAfterSongsR724,
    lastBumperSlot:lastBumperSlotR724,
    cycle:state.cycle,
    queueLength:state.queueLength,
    queuePosition:state.queuePosition,
    previous:state.previous,
    current:state.current,
    next:state.next,
    startedAt:state.startedAt,
    streamStartedAt:state.streamStartedAt,
    uptimeSeconds:Math.max(0,Math.round((now-Date.parse(state.startedAt))/1000)),
    lastLibraryRefresh:state.lastLibraryRefresh,
    lastExit:state.lastExit,
    lastError:state.lastError,
    lastFfmpegLine:state.lastFfmpegLine,
    youtubeLiveUrl:YOUTUBE_LIVE_URL
  };
}


function setTimelineCompensationR739(seconds){
  const value=Number(seconds);
  if(!Number.isFinite(value))throw new Error('timeline seconds must be numeric');
  // R744 backward-compatible control: the old endpoint now tunes the REAL video
  // pre-roll lead instead of shifting drawtext/fade filters inside the wrong clock.
  videoPipelineLeadR744=Math.max(2,Math.min(15,value));
  state.videoPipelineLeadSeconds=videoPipelineLeadR744;
  state.videoTimelineCompensationSeconds=0;
  return Promise.resolve({
    ok:true,
    seconds:videoPipelineLeadR744,
    mode:'R745-VIDEO-PREROLL-LEAD',
    publisherRestarted:false,
    audioRestarted:false
  });
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*'
  };

  if(url.pathname==='/'||url.pathname==='/health'||url.pathname==='/status'){
    res.writeHead(200,headers);
    res.end(JSON.stringify(publicStatus()));
    return;
  }

  if(req.method==='POST' && url.pathname.startsWith('/control/')){
    const remote=String(req.socket?.remoteAddress||'');
    const loopback=remote==='127.0.0.1'||remote==='::1'||remote==='::ffff:127.0.0.1';
    if(!loopback){res.writeHead(403,headers);res.end(JSON.stringify({ok:false,error:'local-control-only'}));return;}
    (async()=>{
      let result;
      if(url.pathname==='/control/visual-now')result=await applyVisualModeR721({slot:url.searchParams.get('slot')||''});
      else if(url.pathname==='/control/visual-auto')result=await applyVisualModeR721({auto:true});
      else if(url.pathname==='/control/full-fit')result=await ensureNormalVideoFeederR721({force:true}).then(()=>({ok:true,noCrop:true,restartedPublisher:false}));
      else if(url.pathname==='/control/timeline-offset')result=await setTimelineCompensationR739(url.searchParams.get('seconds'));
      else throw new Error('unknown local control');
      res.writeHead(200,headers);res.end(JSON.stringify(result));
    })().catch(error=>{res.writeHead(500,headers);res.end(JSON.stringify({ok:false,error:cleanText(error?.message||error)}));});
    return;
  }

  if(url.pathname==='/library'){
    res.writeHead(200,headers);
    res.end(JSON.stringify({
      ok:true,
      tracks:state.libraryTracks,
      albumTracks:state.libraryAlbumTracks,
      singleTracks:state.librarySingleTracks,
      duplicateSinglesSkipped:state.duplicateSinglesSkipped,
      libraryRefreshSeconds:Math.round(LIBRARY_REFRESH_MS/1000),
      videos:state.libraryVideos,
      bumpers:state.libraryBumpers,
      special30min:state.librarySpecial30,
      special60min:state.librarySpecial60,
      specialLoaded:Boolean(specialInsertR726),
      specialHourlyLoaded:Boolean(specialHourlyInsertR727),
      specialDueInSeconds:specialInsertR726?Math.max(0,Math.ceil((SPECIAL_INTERVAL_MS_R726-(Date.now()-lastSpecialPlayedAtR726))/1000)):null,
      specialHourlyDueInSeconds:specialHourlyInsertR727?Math.max(0,Math.ceil((SPECIAL_HOURLY_INTERVAL_MS_R727-(Date.now()-lastSpecialHourlyPlayedAtR727))/1000)):null,
      bumperSlots:bumperLibrary.map(x=>x.bumperSlot||bumperSlotR724(x)).filter(Boolean),
      songsSinceBumper:songsSinceBumperR724,
      nextBumperAfterSongs:bumperAfterSongsR724,
      total:library.length,
      mode:state.mode,
      previous:state.previous,
      current:state.current,
      next:state.next
    }));
    return;
  }

  res.writeHead(404,headers);
  res.end(JSON.stringify({ok:false,error:'not-found'}));
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`ANDRIK Radio R746 R745-PRESERVED + RTMPS-TLS-SELFHEAL listening on :${PORT}`);
  radioLoop();
});

let shutdownStarted=false;
function waitChildExit(child,timeoutMs){
  return new Promise(resolve=>{
    if(!child || child.exitCode!==null)return resolve(true);
    let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(false),timeoutMs);
    child.once('exit',()=>finish(true));
  });
}

async function shutdown(){
  if(shutdownStarted)return;
  shutdownStarted=true;
  stopping=true;if(transportFatalTimerR746){clearTimeout(transportFatalTimerR746);transportFatalTimerR746=null;}
  if(liveTitleTimerR724){clearTimeout(liveTitleTimerR724);liveTitleTimerR724=null;}
  if(scheduleTimerR721)clearInterval(scheduleTimerR721);
  try{server.close();}catch(_){ }

  const activeClip=clipPublisher;
  if(activeClip&&activeClip.exitCode===null){try{activeClip.kill('SIGTERM')}catch(_){ }}
  await waitChildExit(activeClip,1500);

  await stopNormalVideoFeederR721();

  const activeDecoder=producer;
  if(activeDecoder&&activeDecoder.exitCode===null){try{activeDecoder.kill('SIGTERM')}catch(_){ }}
  await waitChildExit(activeDecoder,1800);

  // Only systemctl stop/restart closes the persistent master. Normal MP3, clip and
  // time-of-day transitions never execute this path and therefore never drop LIVE.
  const activeMaster=publisher;
  try{
    const audioSink=activeMaster?.stdio?.[3];
    const videoSink=activeMaster?.stdio?.[4];
    if(audioSink&&!audioSink.destroyed&&!audioSink.writableEnded)audioSink.end();
    if(videoSink&&!videoSink.destroyed&&!videoSink.writableEnded)videoSink.end();
  }catch(_){ }
  let clean=await waitChildExit(activeMaster,9000);
  if(!clean&&activeMaster&&activeMaster.exitCode===null){try{activeMaster.kill('SIGTERM')}catch(_){ }clean=await waitChildExit(activeMaster,2500);}
  if(!clean&&activeMaster&&activeMaster.exitCode===null){try{activeMaster.kill('SIGKILL')}catch(_){ }}
  process.exit(0);
}

process.once('SIGTERM',()=>{shutdown().catch(()=>process.exit(0));});
process.once('SIGINT',()=>{shutdown().catch(()=>process.exit(0));});
