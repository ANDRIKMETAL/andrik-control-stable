import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
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
// MORNING / DAY / EVENING / NIGHT are owner-selected R2 videos cached locally on OVH.
// R707 preserves R706 true-motion equalizers and the R703 four-period schedule.
// R707 also hard-syncs the on-screen track title to the actual PCM handoff and prevents raw-audio queue drift.
// R702 permanent rule is preserved: every source is auto-FIT into 1920x1080 with the complete
// source frame preserved. The user never has to stretch MP4 manually; crop/cover is OFF.
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
const OUTPUT_TIMESHIFT_SECONDS = 1; // one persistent publisher, minimal recovery cushion
const AUDIO_INPUT_QUEUE_PACKETS = 16; // R707: bounded raw-PCM queue; prevents title/audio drift over long uptime
const VIDEO_BITRATE = '4500k'; // R637: 1080p25 low-motion radio visual, bounded CBR
const AUDIO_BITRATE = '128k'; // YouTube Live recommendation for stereo AAC
const AUDIO_SAMPLE_RATE = 44100; // YouTube Live recommendation for stereo
const VIDEO_FPS = 25;
const VIDEO_GOP = 50; // exactly 2 seconds at 25 fps
const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));
const LIVE_TICKER_FILE = process.env.LIVE_TICKER_FILE || `${CACHE_DIR}/live-ticker.txt`;
const LIVE_CURRENT_FILE = process.env.LIVE_CURRENT_FILE || `${CACHE_DIR}/current-live.txt`;
const CLIP_CACHE_DIR = `${CACHE_DIR}/clips`;
const RADIO_CLIPS_URL_R691 = process.env.RADIO_CLIPS_URL_R691 || 'https://andrikmetal.com/api/music/radio-clips-r691';
const JOY_OF_BEING_CLIP_URL = process.env.JOY_OF_BEING_CLIP_URL || 'https://music.andrikmetal.com/clips/joy-of-being-official-2026.mp4';
const JOY_OF_BEING_CLIP_ENABLED = String(process.env.JOY_OF_BEING_CLIP_ENABLED || '1').trim() !== '0';
const JOY_OF_BEING_CLIP_PATH = `${CLIP_CACHE_DIR}/joy-of-being-official-2026.mp4`;
const JOY_OF_BEING_CLIP = Object.freeze({
  type:'clip', sourceType:'r2-video', title:'JOY OF BEING', album:'OFFICIAL MUSIC VIDEO',
  key:'clips/joy-of-being-official-2026.mp4', url:JOY_OF_BEING_CLIP_URL, identity:'clip:joy-of-being', builtIn:true
});
const DEFAULT_LIVE_TICKER = 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';
const DISABLED_ALBUM_PREFIXES = Object.freeze([
  'albums/illusion-of-life/',
  'albums/ocean/'
]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R707-EXACT-TITLE-SYNC-MORNING-SLOT-R706-PRESERVED',
  mode: 'R707 EXACT TRACK-TITLE SYNC / 4-SLOT MORNING-DAY-EVENING-NIGHT / R706 TRUE-MOTION EQ / R702 MP3+CLIP PRESERVED',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'R707 EXACT TITLE HANDOFF / R706 TRUE-MOTION 4-SLOT EQ / BETWEEN TITLE + TICKER / AUTO FIT NO CROP',
  audioMode: 'R707 BOUNDED PCM QUEUE / EXACT TITLE AT AUDIO PIPE / PERSISTENT RTMPS / AAC-LC 128kbps',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  libraryTracks: 0,
  libraryAlbumTracks: 0,
  librarySingleTracks: 0,
  duplicateSinglesSkipped: 0,
  libraryVideos: JOY_OF_BEING_CLIP_ENABLED ? 1 : 0,
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
  phase: 'startup',
  audioBridgeRunning: false,
  handoffCount: 0,
  lastHandoffMs: null,
  mp3CacheFailures: 0,
  equalizerPeriod: null,
  equalizerStyle: null,
  equalizerEngine: 'R706-GEQ-FRAME-ANIMATED'
};

let publisher = null;
let producer = null;
let silenceProducer = null; // R702 keeps the master audio clock alive between finite sources
let library = [];
let clipLibrary = JOY_OF_BEING_CLIP_ENABLED ? [JOY_OF_BEING_CLIP] : [];
let queue = [];
let queueIndex = 0;
let running = false;
let stopping = false;
let lastPlayed = null;
let clipPublisher = null; // R702: finite clip A/V feeder; the YouTube publisher remains persistent
let visualProducer = null;
let visualProducerPath = '';
let clipActive = false;
let visualSwitching = false;
let intentionalPublisherSwitch = false;
const clipPrefetchJobs = new Map();
const prefetchJobs = new Map();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanText = value => String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const shortText = (value, max = 52) => {
  const s = cleanText(value);
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trim()}…`;
};

function childAlive(child){
  return Boolean(child && child.exitCode===null && child.signalCode===null);
}

function promiseTimeout(promise,ms,label='operation'){
  let timer=null;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timeout ${ms}ms`)),ms);})
  ]).finally(()=>{if(timer)clearTimeout(timer);});
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
    builtIn:Boolean(item?.builtIn)
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
  const fallbackBuiltIn=JOY_OF_BEING_CLIP_ENABLED?[prepareClip(JOY_OF_BEING_CLIP)]:[];
  try{
    const url=`${RADIO_CLIPS_URL_R691}${RADIO_CLIPS_URL_R691.includes('?')?'&':'?'}ts=${Date.now()}`;
    const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R702-Clips'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`R2 radio clips HTTP ${response.status}`);
    const data=await response.json();
    const remoteBuiltIn=(JOY_OF_BEING_CLIP_ENABLED && Array.isArray(data?.builtIn)?data.builtIn:[])
      .filter(item=>/^https:\/\//i.test(String(item?.url||'')) && /\.mp4(?:$|\?)/i.test(String(item?.url||'')))
      .map(item=>prepareClip({...item,builtIn:true}));
    const builtIn=remoteBuiltIn.length?remoteBuiltIn:fallbackBuiltIn;
    const dynamic=(Array.isArray(data?.clips)?data.clips:[])
      .filter(item=>/^https:\/\//i.test(String(item?.url||'')) && /\.mp4(?:$|\?)/i.test(String(item?.url||'')))
      .map(prepareClip);
    const byIdentity=new Map();
    for(const clip of [...builtIn,...dynamic]){
      const key=String(clip.key||clip.url||clip.identity||'');
      if(key&&!byIdentity.has(key))byIdentity.set(key,clip);
    }
    clipLibrary=[...byIdentity.values()];
  }catch(error){
    console.error('[radio-clips]',cleanText(error?.message||error));
    if(!clipLibrary.length)clipLibrary=fallbackBuiltIn;
  }
  state.libraryVideos=clipLibrary.length;
  clipLibrary.forEach(prefetchClip);
  return clipLibrary;
}

async function loadLibrary(){
  const previousSignature=librarySignature([...library,...clipLibrary]);
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
  state.lastLibraryRefresh=new Date().toISOString();
  const changed=previousSignature!==librarySignature([...library,...clipLibrary]);
  return {library,clipLibrary,changed};
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
  const shuffledTracks=shuffle(tracks);
  const shuffledClips=shuffle(clips);
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

async function probeVideoDurationR702(path){
  try{
    const raw=await runCapture(
      'ffprobe',
      ['-v','error','-select_streams','v:0','-show_entries','stream=duration','-of','default=noprint_wrappers=1:nokey=1',path],
      {timeoutMs:12000}
    );
    const duration=Number(String(raw).trim());
    if(Number.isFinite(duration) && duration>0.1)return duration;
  }catch(_){ }
  return probeDuration(path);
}

async function probeVideoSize(path){
  const raw=await runCapture(
    'ffprobe',
    ['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=s=x:p=0',path],
    {timeoutMs:25000}
  );
  const match=/^(\d+)x(\d+)$/m.exec(String(raw).trim());
  if(!match)throw new Error('Invalid video dimensions');
  return {width:Number(match[1]),height:Number(match[2])};
}

async function detectInsetBlackFrameCrop(path){
  // R697: remove ONLY a very large, stable, symmetric black canvas around a smaller
  // picture. Normal footage, dark edges, cinematic bars and ordinary 16:9 clips must
  // never be cropped. After this optional recovery every clip is FIT into 1920x1080.
  let size;
  try{size=await probeVideoSize(path)}catch(_){return ''}
  if(!size.width||!size.height)return '';
  const stderr=await new Promise(resolve=>{
    const child=spawn('ffmpeg',[
      '-hide_banner','-loglevel','info','-ss','0.35','-i',path,
      '-an','-sn','-dn','-vf','cropdetect=limit=4:round=2:reset=0',
      '-frames:v','48','-f','null','-'
    ],{stdio:['ignore','ignore','pipe']});
    let err='';
    const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch(_){}},9000);
    child.stderr.on('data',d=>{err=(err+String(d)).slice(-180000)});
    child.once('error',()=>{clearTimeout(timer);resolve('')});
    child.once('exit',()=>{clearTimeout(timer);resolve(err)});
  });
  const matches=[...String(stderr).matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  if(!matches.length)return '';
  const counts=new Map();
  for(const m of matches.slice(-28)){
    const key=`${m[1]}:${m[2]}:${m[3]}:${m[4]}`;
    counts.set(key,(counts.get(key)||0)+1);
  }
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const best=ranked[0]?.[0]||'';
  const bestCount=ranked[0]?.[1]||0;
  // R697: refuse cropdetect unless the same crop dominates most sampled frames.
  if(bestCount<18)return '';
  const parts=best.split(':').map(Number);
  if(parts.length!==4||parts.some(v=>!Number.isFinite(v)))return '';
  const [cw,ch,x,y]=parts;
  const right=size.width-cw-x,bottom=size.height-ch-y;
  if(cw<=0||ch<=0||x<0||y<0||right<0||bottom<0)return '';
  const cutX=size.width-cw,cutY=size.height-ch;
  const symmetricX=Math.abs(x-right)<=Math.max(10,Math.round(size.width*0.035));
  const symmetricY=Math.abs(y-bottom)<=Math.max(10,Math.round(size.height*0.035));
  // Total removed canvas must be at least 24% on BOTH axes. This still fixes the
  // tiny-picture-in-black-canvas upload, but prevents cropdetect from shaving real clips.
  const largeInsetX=cutX>=Math.round(size.width*0.24);
  const largeInsetY=cutY>=Math.round(size.height*0.24);
  const enoughVisible=cw>=Math.round(size.width*0.50)&&ch>=Math.round(size.height*0.50);
  const srcRatio=size.width/size.height, cropRatio=cw/ch;
  const ratioPreserved=Math.abs(cropRatio-srcRatio)/srcRatio<=0.035;
  if(!(symmetricX&&symmetricY&&largeInsetX&&largeInsetY&&enoughVisible&&ratioPreserved))return '';
  return `crop=${cw}:${ch}:${x}:${y}`;
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
}

function audioCachePath(item){
  const id=createHash('sha1').update(String(item?.url||'')).digest('hex').slice(0,24);
  return `${AUDIO_CACHE_DIR}/${id}.mp3`;
}

function cachedAudioPathR702(item){
  if(!item?.url)return '';
  const path=audioCachePath(item);
  try{return existsSync(path)&&statSync(path).size>256000?path:''}catch(_){return ''}
}

async function ensureNextTrackReadyR702(item){
  if(item?.type!=='track')return '';
  const ready=cachedAudioPathR702(item);
  if(ready)return ready;
  // The normal previous track has already been prefetching this file. We only grant a
  // short grace here; a clip is never allowed to start unless the following MP3 is local.
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
        const cleanTmp=`${dest}.clean-${process.pid}-${Date.now()}-${attempt}.mp3`; // R702: valid MP3 output suffix
        try{
          await runCapture('ffmpeg',[
            '-hide_banner','-loglevel','quiet','-y','-i',tmp,
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
        state.mp3CacheFailures++;
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
  const period=FORCE_VISUAL_SLOT || scheduled;
  const spec=visualSpecForPeriod(period);
  try{
    const path=await ensureVisualSpec(spec);
    state.visualPeriod=VISUAL_AUTO_SCHEDULE_R658?`auto-${period}`:(FORCE_VISUAL_SLOT?`manual-${period}`:period);
    state.visualPath=path;
    return path;
  }catch(error){
    // R703 safe rollout: until MORNING is uploaded, 06:00-12:00 temporarily uses DAY.
    // This lets the four-slot build be deployed before the new MP4 exists without breaking radio.
    if(period==='morning'){
      try{
        const fallback=await ensureVisualSpec(visualSpecForPeriod('day'));
        state.lastError=`R703 morning not assigned yet — temporary DAY fallback: ${cleanText(error?.message||error)}`;
        state.visualPeriod=VISUAL_AUTO_SCHEDULE_R658?'auto-morning-fallback-day':'morning-fallback-day';
        state.visualPath=fallback;
        return fallback;
      }catch(_){ }
    }
    if(existsSync(EMERGENCY_VISUAL) && statSync(EMERGENCY_VISUAL).size>300000){
      state.lastError=`R703 ${period} local visual fallback: ${cleanText(error?.message||error)}`;
      state.visualPeriod=`${period}-emergency`;
      state.visualPath=EMERGENCY_VISUAL;
      return EMERGENCY_VISUAL;
    }
    throw error;
  }
}

function trackLabel(item,fallback='—'){
  if(!item)return fallback;
  const title=shortText(item.title||'ANDRIK',48);
  const album=shortText(item.album||'',24);
  return album ? `${title} (${album})` : title;
}

function silenceFeederArgsR702(){
  return [
    '-hide_banner','-loglevel','error',
    '-re','-f','lavfi','-i',`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`,
    '-map','0:a:0','-vn','-sn','-dn',
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-f','s16le','pipe:1'
  ];
}

async function stopSilenceBridgeR702(){
  const active=silenceProducer;
  if(!active){state.audioBridgeRunning=false;return;}
  const audioSink=publisher?.stdio?.[3];
  try{if(active.stdout&&audioSink)active.stdout.unpipe(audioSink)}catch(_){ }
  if(childAlive(active)){
    try{active.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(active,180)) && childAlive(active)){
      try{active.kill('SIGKILL')}catch(_){ }
      await waitChildExit(active,120);
    }
  }
  if(silenceProducer===active)silenceProducer=null;
  state.audioBridgeRunning=false;
}

function startSilenceBridgeR702(){
  if(stopping || clipActive || childAlive(producer))return false;
  const audioSink=publisher?.stdio?.[3];
  if(!childAlive(publisher)||!audioSink||audioSink.destroyed||audioSink.writableEnded)return false;
  if(childAlive(silenceProducer)){state.audioBridgeRunning=true;return true;}
  const child=spawn('ffmpeg',silenceFeederArgsR702(),{stdio:['ignore','pipe','pipe']});
  silenceProducer=child;
  state.audioBridgeRunning=true;
  child.stdout.pipe(audioSink,{end:false});
  child.stdout.on('error',()=>{});
  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line)console.error('[silence-bridge]',line);
  });
  child.on('exit',()=>{
    if(silenceProducer===child)silenceProducer=null;
    state.audioBridgeRunning=false;
  });
  child.on('error',err=>{
    if(silenceProducer===child)state.lastError=`R702 silence bridge: ${cleanText(err?.message||err)}`;
  });
  return true;
}

// R706: four genuinely frame-animated procedural equalizers.
// R704/R705 used drawbox expressions containing t. On the deployed FFmpeg path those
// box dimensions are effectively resolved at filter init, so the shape can look frozen.
// R706 moves animation into GEQ, where N is evaluated for every generated frame.
// This is still synthetic/non-audio-reactive by design: it never touches the stable R702 audio path.
function equalizerPeriodR704(){
  return FORCE_VISUAL_SLOT || visualPeriodForHour(localHourInTimeZone());
}

function equalizerStyleR704(period){
  const styles={
    morning:{name:'morning-soft-gold-motion',span:1500,layerH:58,spacing:34,barWidth:6,minH:7,ampH:38,nSpeed:0.095,nSpeed2:0.041,xPhase:0.047,xPhase2:0.020,r:255,g:226,b:184,barAlpha:220,lineAlpha:175},
    day:{name:'day-steel-motion',span:1510,layerH:60,spacing:31,barWidth:6,minH:8,ampH:42,nSpeed:0.145,nSpeed2:0.061,xPhase:0.052,xPhase2:0.024,r:238,g:245,b:250,barAlpha:230,lineAlpha:190},
    evening:{name:'evening-amber-motion',span:1500,layerH:62,spacing:33,barWidth:6,minH:8,ampH:44,nSpeed:0.118,nSpeed2:0.049,xPhase:0.049,xPhase2:0.022,r:245,g:183,b:104,barAlpha:232,lineAlpha:190},
    night:{name:'night-blue-motion',span:1480,layerH:56,spacing:36,barWidth:5,minH:6,ampH:35,nSpeed:0.078,nSpeed2:0.033,xPhase:0.044,xPhase2:0.018,r:186,g:221,b:246,barAlpha:210,lineAlpha:165}
  };
  return styles[period]||styles.day;
}

function liveEqualizerFilterComplexR706(period){
  const s=equalizerStyleR704(period);
  const baselineY=s.layerH-3;
  // Two slow waves multiply together so neighboring bars breathe at different heights.
  // N is the generated-frame index, therefore this changes on every frame in FFmpeg.
  const h=`${s.minH}+${s.ampH}*(0.50+0.50*sin(N*${s.nSpeed.toFixed(4)}+X*${s.xPhase.toFixed(4)}))*(0.72+0.28*(0.50+0.50*sin(N*${s.nSpeed2.toFixed(4)}+X*${s.xPhase2.toFixed(4)}+1.17)))`;
  const bars=`lt(mod(X,${s.spacing}),${s.barWidth})*gte(Y,${baselineY}-(${h}))*lte(Y,${baselineY})`;
  const baseline=`lt(abs(Y-${baselineY}),1.35)`;
  const alpha=`if(${baseline},${s.lineAlpha},if(${bars},${s.barAlpha},0))`;
  const overlayTop=88+s.layerH-3; // keeps baseline exactly at y=ih-88, same safe R705 position
  return `
[0:v]scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuv420p[bg];
nullsrc=s=${s.span}x${s.layerH}:r=${VIDEO_FPS},setpts=PTS-STARTPTS,format=rgba,geq=r='${s.r}':g='${s.g}':b='${s.b}':a='${alpha}'[eq];
[bg][eq]overlay=x=(W-w)/2:y=H-${overlayTop}:shortest=1:format=auto,format=yuvj420p[outv]`.replace(/\n/g,'');
}

function normalVideoProducerArgs(visualPath,period=equalizerPeriodR704()){
  const graph=liveEqualizerFilterComplexR706(period);
  return [
    '-hide_banner','-loglevel','warning',
    '-re','-stream_loop','-1','-i',visualPath,
    '-an','-sn','-dn',
    '-filter_complex',graph,
    '-map','[outv]',
    '-c:v','mjpeg','-q:v','5','-pix_fmt','yuvj420p',
    '-f','mjpeg','pipe:1'
  ];
}

async function stopNormalVisualProducerR701(){
  const active=visualProducer;
  if(!active)return;
  const videoSink=publisher?.stdio?.[4];
  try{if(active.stdout && videoSink)active.stdout.unpipe(videoSink)}catch(_){ }
  if(childAlive(active)){
    try{active.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(active,120)) && childAlive(active)){
      try{active.kill('SIGKILL')}catch(_){ }
      await waitChildExit(active,100);
    }
  }
  if(visualProducer===active)visualProducer=null;
}

function startNormalVisualProducerR701(visualPath){
  if(stopping || clipActive)return false;
  const videoSink=publisher?.stdio?.[4];
  if(!childAlive(publisher) || !videoSink || videoSink.destroyed || videoSink.writableEnded){
    throw new Error('R702 master video pipe unavailable');
  }
  if(childAlive(visualProducer) && visualProducerPath===visualPath)return true;

  const eqPeriod=equalizerPeriodR704();
  const eqStyle=equalizerStyleR704(eqPeriod);
  state.equalizerPeriod=eqPeriod;
  state.equalizerStyle=eqStyle.name;
  const child=spawn('ffmpeg',normalVideoProducerArgs(visualPath,eqPeriod),{stdio:['ignore','pipe','pipe']});
  visualProducer=child;
  visualProducerPath=visualPath;
  child.stdout.pipe(videoSink,{end:false});
  child.stdout.on('error',err=>{
    if(!stopping && !/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(err?.code||err?.message||err)))state.lastError=`visual-pipe: ${String(err)}`;
  });
  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe/i.test(line))state.lastError=line.slice(-700);
      console.error('[visual-feed]',line);
    }
  });
  child.on('exit',(code,signal)=>{
    const isCurrent=visualProducer===child;
    if(isCurrent)visualProducer=null;
    try{if(child.stdout && videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
    if(isCurrent && !stopping && !clipActive && !visualSwitching){
      state.lastError=`R702 visual feeder exit ${code??signal}; restarting`;
      setTimeout(()=>ensureNormalVisualProducerR701().catch(err=>{state.lastError=`R702 visual restart: ${cleanText(err?.message||err)}`;}),120).unref();
    }
  });
  child.on('error',err=>{
    if(visualProducer===child)state.lastError=`R702 visual feeder: ${String(err)}`;
  });
  return true;
}

async function ensureNormalVisualProducerR701(){
  if(stopping || clipActive)return true;
  const visual=await ensureScheduledVisual();
  const desiredEqPeriod=equalizerPeriodR704();
  if(childAlive(visualProducer) && visualProducerPath===visual && state.equalizerPeriod===desiredEqPeriod)return true;
  visualSwitching=true;
  try{
    await stopNormalVisualProducerR701();
    if(stopping || clipActive)return true;
    return startNormalVisualProducerR701(visual);
  }finally{
    visualSwitching=false;
  }
}

function startPublisher(visualPath){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }
  prepareCacheDir();
  if(!existsSync(LIVE_TICKER_FILE)) writeFileSync(LIVE_TICKER_FILE,DEFAULT_LIVE_TICKER,'utf8');
  if(!existsSync(LIVE_CURRENT_FILE)) writeFileSync(LIVE_CURRENT_FILE,'ANDRIK','utf8');
  if(!existsSync(visualPath) || statSync(visualPath).size<300000) throw new Error(`visual missing: ${visualPath}`);
  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000) throw new Error(`QR overlay missing: ${QR_OVERLAY}`);

  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const curPath=ffFilterPath(LIVE_CURRENT_FILE);
  const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
  const vf=[
    'setsar=1',
    `fps=${VIDEO_FPS}`,
    'format=yuv420p',
    `drawtext=${titleFontPart}textfile='${curPath}':reload=${VIDEO_FPS}:fontcolor=red@0.01:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=8:bordercolor=red@0.58`,
    `drawtext=${titleFontPart}textfile='${curPath}':reload=${VIDEO_FPS}:fontcolor=0xF3EFE8:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=3:bordercolor=black@1:shadowcolor=black@0.95:shadowx=3:shadowy=3:box=1:boxcolor=black@0.36:boxborderw=18`,
    `drawtext=${fontPart}textfile='${tickerPath}':reload=${VIDEO_FPS}:fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
  ].join(',');
  const filterComplex=`[0:v]${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=24:24:format=yuv420[outv]`;

  // R702: YouTube sees ONE publisher for the whole broadcast. Neither MP3→CLIP
  // nor CLIP→MP3 closes RTMPS anymore. A lightweight local MJPEG video feeder
  // and raw PCM audio feeder are swapped behind this permanent master instead.
  const args=[
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','2048','-f','mjpeg','-framerate',String(VIDEO_FPS),'-i','pipe:4',
    '-loop','1','-framerate','1','-i',QR_OVERLAY,
    '-thread_queue_size',String(AUDIO_INPUT_QUEUE_PACKETS),'-probesize','32','-analyzeduration','0','-f','s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-i','pipe:3',
    '-filter_complex',filterComplex,
    '-map','[outv]','-map','2:a:0',
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
    '-profile:v','high','-level:v','4.1',
    '-b:v',VIDEO_BITRATE,'-minrate',VIDEO_BITRATE,'-maxrate',VIDEO_BITRATE,'-bufsize','9000k',
    '-x264-params',`nal-hrd=cbr:force-cfr=1:repeat-headers=1:keyint=${VIDEO_GOP}:min-keyint=${VIDEO_GOP}:scenecut=0`,
    '-g',String(VIDEO_GOP),'-keyint_min',String(VIDEO_GOP),'-sc_threshold','0','-bf','2','-refs','1','-coder','1','-r',String(VIDEO_FPS),'-pix_fmt','yuv420p',
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
      if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);
      console.error('[master]',line);
    }
  });
  thisPublisher.on('exit',(code,signal)=>{
    const isCurrent=publisher===thisPublisher;
    if(isCurrent){state.publisherRunning=false;publisher=null;}
    if(isCurrent && !stopping)state.lastExit={layer:'master',code,signal,at:new Date().toISOString()};
    if(isCurrent && !stopping)setTimeout(()=>process.exit(code||22),900).unref();
  });
  thisPublisher.on('error',err=>{if(publisher===thisPublisher)state.lastError=String(err);});
  state.phase='idle-bridge';
  startSilenceBridgeR702();
  return true;
}

async function ensureMasterForTrackR701(){
  const audioSink=publisher?.stdio?.[3];
  const videoSink=publisher?.stdio?.[4];
  if(childAlive(publisher) && audioSink && !audioSink.destroyed && !audioSink.writableEnded && videoSink && !videoSink.destroyed && !videoSink.writableEnded){
    await ensureNormalVisualProducerR701();
    return true;
  }

  await stopNormalVisualProducerR701();
  const stale=publisher;
  if(childAlive(stale)){
    try{stale.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(stale,180)) && childAlive(stale)){try{stale.kill('SIGKILL')}catch(_){ }}
    await waitChildExit(stale,120);
    if(publisher===stale)publisher=null;
  }
  const visual=await ensureScheduledVisual();
  if(!startPublisher(visual))throw new Error('R702 persistent master restart failed');
  startNormalVisualProducerR701(visual);
  for(let i=0;i<8;i++){
    const current=publisher;
    const a=current?.stdio?.[3],v=current?.stdio?.[4];
    if(childAlive(current) && a && !a.destroyed && !a.writableEnded && v && !v.destroyed && !v.writableEnded)return true;
    await sleep(35);
  }
  throw new Error('R702 master A/V pipes unavailable after restart');
}

function clipFeederArgsR701(clipPath){
  return [
    '-hide_banner','-loglevel','warning',
    '-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',clipPath,
    '-filter_complex',`[0:v]scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${VIDEO_FPS},format=yuvj420p[v]`,
    '-map','[v]','-an','-sn','-dn','-c:v','mjpeg','-q:v','5','-pix_fmt','yuvj420p','-f','mjpeg','pipe:1',
    '-map','0:a:0?','-vn','-sn','-dn','-af',`aresample=${AUDIO_SAMPLE_RATE}`,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-f','s16le','pipe:3'
  ];
}

async function stopClipFeederR701(child,videoSink,audioSink){
  if(!child)return;
  try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
  try{if(child.stdio?.[3]&&audioSink)child.stdio[3].unpipe(audioSink)}catch(_){ }
  if(childAlive(child)){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,100)) && childAlive(child)){
      try{child.kill('SIGKILL')}catch(_){ }
      await waitChildExit(child,90);
    }
  }
}

async function playVideoClipR691(previous,item,next){
  let clipPath='';
  try{clipPath=await downloadRadioClipR691(item)}
  catch(error){
    state.lastError=`VIDEO clip cache: ${cleanText(error?.message||error)}`;
    console.error('[video-clip]',state.lastError);
    return false;
  }
  const duration=await probeVideoDurationR702(clipPath).catch(()=>0);
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:'clip',title:item.title,album:item.album,url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  writeFileSync(LIVE_CURRENT_FILE,`КЛИП • ANDRIK — ${shortText(item.title||'VIDEO',34)}`,'utf8');
  state.phase='clip';

  let stallTimer=null;
  let child=null;
  let videoSink=null;
  let audioSink=null;
  let forcedReason='';
  try{
    await ensureMasterForTrackR701();
    await stopSilenceBridgeR702();
    clipActive=true;
    await stopNormalVisualProducerR701();
    if(stopping)return false;

    videoSink=publisher?.stdio?.[4];
    audioSink=publisher?.stdio?.[3];
    if(!childAlive(publisher) || !videoSink || videoSink.destroyed || videoSink.writableEnded || !audioSink || audioSink.destroyed || audioSink.writableEnded){
      throw new Error('R701 persistent master pipes unavailable before clip');
    }

    // R702: the clip is only a LOCAL feeder. YouTube RTMPS stays open in the
    // permanent master, so there is no reconnect/frozen-last-frame handoff.
    child=spawn('ffmpeg',clipFeederArgsR701(clipPath),{stdio:['ignore','pipe','pipe','pipe','pipe']});
    clipPublisher=child;
    state.publisherRunning=true;
    state.producerRunning=true;
    child.stdout.pipe(videoSink,{end:false});
    child.stdio[3].pipe(audioSink,{end:false});
    child.stdout.on('error',()=>{});
    child.stdio[3].on('error',()=>{});

    let progressBuffer='';
    let lastProgressAt=Date.now();
    let lastOutTime=0;
    let lastVideoFrameAt=Date.now();
    let lastVideoFrame=0;
    const startedAt=Date.now();
    child.stdio[4].on('data',d=>{
      progressBuffer+=String(d||'');
      const lines=progressBuffer.split(/\r?\n/);
      progressBuffer=lines.pop()||'';
      for(const line of lines){
        const text=line.trim();
        const fm=/^frame=(\d+)/.exec(text);
        if(fm){
          const frame=Number(fm[1]||0);
          if(frame>lastVideoFrame){lastVideoFrame=frame;lastVideoFrameAt=Date.now();}
        }
        const m=/^out_time_(?:us|ms)=(\d+)/.exec(text);
        if(m){
          const value=Number(m[1]||0);
          if(value>lastOutTime){lastOutTime=value;lastProgressAt=Date.now();}
        }
      }
    });
    child.stderr.on('data',d=>{
      const line=String(d||'').trim();
      if(line){
        state.lastFfmpegLine=line.slice(-1000);
        if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);
        console.error('[clip-feed]',line);
      }
    });

    // If decode/pipe progress stops in the MIDDLE of a clip, do not wait for its
    // nominal duration. Cut the broken local feeder after 2.2 s and move to MP3.
    stallTimer=setInterval(()=>{
      if(!childAlive(child) || stopping)return;
      const now=Date.now();
      const videoStopped=now-startedAt>3000 && now-lastVideoFrameAt>1400;
      const allStopped=now-startedAt>3500 && now-lastProgressAt>2200;
      if(videoStopped || allStopped){
        forcedReason=videoStopped?'video-frame-stall':'progress-stall';
        state.lastError=`R702 clip ${forcedReason} — forcing immediate MP3 handoff`;
        try{child.kill('SIGKILL')}catch(_){ }
      }
    },250);
    stallTimer.unref?.();

    const clipExit=new Promise(resolve=>{
      child.once('error',error=>resolve({kind:'error',error}));
      child.once('exit',(code,signal)=>resolve({kind:'exit',code,signal}));
    });
    const hardBoundaryMs=duration>1?Math.max(1800,Math.ceil((duration+0.25)*1000)):120000;
    let ended=await Promise.race([clipExit,sleep(hardBoundaryMs).then(()=>({kind:'deadline'}))]);
    if(ended?.kind==='deadline'){
      forcedReason='duration-deadline';
      state.lastError='R702 clip video duration reached — forcing MP3 handoff';
      if(childAlive(child)){try{child.kill('SIGKILL')}catch(_){ }}
      await waitChildExit(child,120);
      ended={kind:'exit',code:child.exitCode,signal:child.signalCode};
    }
    if(ended?.kind==='error' && !forcedReason)throw ended.error;
    if(ended?.kind==='exit' && ended.code!==0 && !stopping && !forcedReason){
      throw new Error(`R702 clip feeder exit ${ended.code??ended.signal}`);
    }

    return !stopping;
  }catch(error){
    state.lastError=`VIDEO clip R702: ${cleanText(error?.message||error)}`;
    console.error('[video-clip]',error);
    return false;
  }finally{
    const handoffStarted=Date.now();
    if(stallTimer)clearInterval(stallTimer);
    await stopClipFeederR701(child,videoSink,audioSink);
    if(clipPublisher===child)clipPublisher=null;
    state.producerRunning=false;
    clipActive=false;
    if(!stopping){
      startSilenceBridgeR702();
      // R707: never announce the next MP3 before its PCM actually enters the master.
      // Keep a neutral handoff label; playItem() switches the title at the real audio pipe boundary.
      state.current={type:'handoff',title:'',album:'',url:'',startedAt:null,duration:null,pending:true};
      writeFileSync(LIVE_CURRENT_FILE,'ANDRIK METAL RADIO 24/7','utf8');
      state.phase='clip-to-track';
      try{await ensureNormalVisualProducerR701();}catch(error){state.lastError=`R702 resume visual: ${cleanText(error?.message||error)}`;}
      state.handoffCount++;
      state.lastHandoffMs=Date.now()-handoffStarted;
      await sleep(10);
    }
  }
}

function decoderArgs(localAudioPath){
  return [
    '-hide_banner','-loglevel','warning',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',localAudioPath,
    '-map','0:a:0','-vn','-sn','-dn',
    '-af',`aresample=${AUDIO_SAMPLE_RATE}`,
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-f','s16le','pipe:1'
  ];
}

async function playItem(previous,item,next,following,localAudioPath){
  const duration=await probeDuration(localAudioPath||item.url);
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;

  // R707: prepare every layer first. The visible title is changed only when the
  // corresponding PCM feeder is about to be connected to the persistent master.
  await ensureMasterForTrackR701();
  await stopSilenceBridgeR702();
  const audioSink=publisher?.stdio?.[3];
  if(!childAlive(publisher) || !audioSink || audioSink.destroyed || audioSink.writableEnded) throw new Error('R707 master audio pipe unavailable');

  state.producerRunning=true;
  producer=spawn('ffmpeg',decoderArgs(localAudioPath),{stdio:['ignore','pipe','pipe']});
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      const brokenArtProbe=/Invalid PNG signature|Could not find codec parameters for stream 1 \(Video: png/i.test(line);
      if(!brokenArtProbe && /error|fail|invalid|corrupt/i.test(line))state.lastError=line.slice(-700);
      if(!brokenArtProbe)console.error('[decoder]',line);
    }
  });

  try{
    await new Promise((resolve,reject)=>{
      const source=producer.stdout;

      // R707 exact boundary: no next-title pre-roll. With the raw PCM input queue
      // bounded to 16 packets, video text and audible audio cannot drift apart over time.
      state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date().toISOString(),duration};
      state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
      state.phase='track';
      writeFileSync(LIVE_CURRENT_FILE,`ANDRIK — ${shortText(item.title||'TRACK',42)}`,'utf8');
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
  }finally{
    if(!stopping){state.phase='idle-bridge';startSilenceBridgeR702();}
  }
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  prefetchAllVisuals();
  const startupVisual=await ensureScheduledVisual();
  if(!startPublisher(startupVisual))return;
  startNormalVisualProducerR701(startupVisual);

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

      let item=queue[queueIndex];
      // R697: never allow two video clips back-to-back. If reconciliation or an
      // earlier failed track creates adjacency, pull the nearest MP3 forward.
      if(item?.type==='clip' && lastPlayed?.type==='clip'){
        const trackPos=queue.findIndex((x,i)=>i>queueIndex&&x?.type!=='clip');
        if(trackPos>queueIndex){
          [queue[queueIndex],queue[trackPos]]=[queue[trackPos],queue[queueIndex]];
          item=queue[queueIndex];
        }else{
          queue=buildQueue();
          queueIndex=0;
          item=queue[0];
        }
      }
      if(item?.type==='clip' && queue[queueIndex+1]?.type==='clip'){
        const trackPos=queue.findIndex((x,i)=>i>queueIndex+1&&x?.type!=='clip');
        if(trackPos>queueIndex+1)[queue[queueIndex+1],queue[trackPos]]=[queue[trackPos],queue[queueIndex+1]];
      }
      const next=queue[queueIndex+1]||queue[0]||null;
      const following=queue[queueIndex+2]||queue[1]||queue[0]||null;
      state.queuePosition=queueIndex+1;

      if(item?.type==='clip'){
        if(next?.type==='track'){
          state.phase='prepare-clip-next-mp3';
          try{
            await ensureNextTrackReadyR702(next);
          }catch(error){
            // Never enter a clip if its following MP3 is not ready. The clip is deferred
            // for this cycle and the next item gets a normal chance to play.
            state.lastError=`R702 clip deferred: next MP3 not ready: ${cleanText(error?.message||error)}`;
            console.error('[clip-deferred]',state.lastError);
            queueIndex++;
            continue;
          }
        }
        if(following?.type==='track')prefetchTrack(following);else if(following?.type==='clip')prefetchClip(following);
        const clipPlayed=await playVideoClipR691(lastPlayed,item,next);
        lastPlayed=item;
        queueIndex++;
        if(clipPlayed)state.lastError='';
        continue;
      }

      const localAudioPath=await downloadTrackToCache(item);
      if(next?.type==='track')prefetchTrack(next);else if(next?.type==='clip')prefetchClip(next);
      if(following?.type==='track')prefetchTrack(following);else if(following?.type==='clip')prefetchClip(following);
      const keep=[localAudioPath];
      if(next?.type==='track')keep.push(audioCachePath(next));
      if(following?.type==='track')keep.push(audioCachePath(following));
      pruneAudioCache(keep);

      await playItem(lastPlayed,item,next,following,localAudioPath);
      lastPlayed=item;
      queueIndex++;
      state.lastError='';
    }catch(error){
      state.lastError=String(error?.stack||error).slice(-1200);
      console.error('[radio]',error);

      if(childAlive(producer))producer.kill('SIGTERM');
      producer=null;
      state.producerRunning=false;

      await sleep(1000);

      if(/library|HTTP|empty/i.test(String(error)))library=[];
      else if(/R70[27] master|master audio pipe|publisher|clip feeder/i.test(String(error))){
        // Transition errors retry the SAME MP3 after a short recovery. Do not
        // skip the whole MP3 queue and race back to the same video clip.
        await sleep(180);
      }else queueIndex++;
    }
  }
}

function publicStatus(){
  const now=Date.now();
  return {
    ok:Boolean(state.publisherRunning&&(state.producerRunning||state.audioBridgeRunning)),
    service:state.service,
    version:state.version,
    mode:state.mode,
    overlayMode:state.overlayMode,
    audioMode:state.audioMode,
    outputTimeshiftSeconds:OUTPUT_TIMESHIFT_SECONDS,
    videoBitrate:VIDEO_BITRATE,
    audioBitrate:AUDIO_BITRATE,
    audioSampleRate:AUDIO_SAMPLE_RATE,
    audioInputQueuePackets:AUDIO_INPUT_QUEUE_PACKETS,
    videoFps:VIDEO_FPS,
    videoGop:VIDEO_GOP,
    qrOverlay:QR_OVERLAY,
    visualTimeZone:state.visualTimeZone,
    forceVisualSlot:FORCE_VISUAL_SLOT||null,
    visualAutoSchedule:VISUAL_AUTO_SCHEDULE_R658,
    visualPeriod:state.visualPeriod,
    visualPath:state.visualPath,
    equalizerPeriod:state.equalizerPeriod,
    equalizerStyle:state.equalizerStyle,
    equalizerEngine:state.equalizerEngine,
    publisherRunning:state.publisherRunning,
    producerRunning:state.producerRunning,
    audioBridgeRunning:state.audioBridgeRunning,
    phase:state.phase,
    handoffCount:state.handoffCount,
    lastHandoffMs:state.lastHandoffMs,
    mp3CacheFailures:state.mp3CacheFailures,
    libraryTracks:state.libraryTracks,
    libraryAlbumTracks:state.libraryAlbumTracks,
    librarySingleTracks:state.librarySingleTracks,
    duplicateSinglesSkipped:state.duplicateSinglesSkipped,
    libraryRefreshSeconds:Math.round(LIBRARY_REFRESH_MS/1000),
    libraryVideos:state.libraryVideos,
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
  console.log(`ANDRIK Radio R702-MP3-HANDOFF-AUTO-FIT listening on :${PORT}`);
  radioLoop();
});

let shutdownStarted=false;
function waitChildExit(child,timeoutMs){
  return new Promise(resolve=>{
    if(!childAlive(child))return resolve(true);
    let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(false),timeoutMs);
    child.once('exit',()=>finish(true));
  });
}

async function shutdown(){
  if(shutdownStarted)return;
  shutdownStarted=true;
  stopping=true;
  try{server.close();}catch(_){}

  // R702: stop local feeders first; the single YouTube publisher is stopped last.
  const activeClip=clipPublisher;
  if(childAlive(activeClip)){try{activeClip.kill('SIGTERM')}catch(_){ }}
  await waitChildExit(activeClip,1000);

  await stopNormalVisualProducerR701();
  await stopSilenceBridgeR702();

  const activeDecoder=producer;
  if(childAlive(activeDecoder))activeDecoder.kill('SIGTERM');
  await waitChildExit(activeDecoder,1000);

  const activeMaster=publisher;
  try{
    const audioSink=activeMaster?.stdio?.[3];
    const videoSink=activeMaster?.stdio?.[4];
    if(audioSink && !audioSink.destroyed && !audioSink.writableEnded)audioSink.end();
    if(videoSink && !videoSink.destroyed && !videoSink.writableEnded)videoSink.end();
  }catch(_){}
  let clean=await waitChildExit(activeMaster,1200);
  if(!clean && childAlive(activeMaster)){
    try{activeMaster.kill('SIGTERM')}catch(_){ }
    clean=await waitChildExit(activeMaster,700);
  }
  if(!clean && childAlive(activeMaster)){try{activeMaster.kill('SIGKILL')}catch(_){ }}
  process.exit(0);
}

process.once('SIGTERM',()=>{shutdown().catch(()=>process.exit(0));});
process.once('SIGINT',()=>{shutdown().catch(()=>process.exit(0));});
