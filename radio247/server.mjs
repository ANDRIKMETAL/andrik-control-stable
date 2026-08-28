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
const CTA_PERIOD_SECONDS_R722 = 300; // every 5 minutes during the normal radio visual
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
  version: 'R723-GREEN-QR-R722-PRESERVED',
  mode: 'R723 CLEAN GREEN QR / R722 SUBSCRIBE-LIKE / R721 PERSISTENT LIVE / TRUE NO-CROP FIT / RED TITLE / EXACT EQ',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'R723 CLEAN GREEN QR / NO BLACK FRAME + R722 CTA + RED TITLE + EQ',
  audioMode: 'R721 PERSISTENT PCM CLOCK + AAC-LC 128kbps / ONE RTMPS SESSION / 4500k H264 RELAY / 6s FIFO',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  visualInsetCrop: '',
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
  equalizerPeriod: null,
  equalizerStyle: null,
  equalizerEngine: 'R721-EXACT-PERIODIC-QTRLE-FEEDER-4-SLOT'
};

let publisher = null;
let producer = null;
let library = [];
let clipLibrary = JOY_OF_BEING_CLIP_ENABLED ? [JOY_OF_BEING_CLIP] : [];
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
const clipPrefetchJobs = new Map();
const prefetchJobs = new Map();

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
  const builtIn=JOY_OF_BEING_CLIP_ENABLED?[prepareClip(JOY_OF_BEING_CLIP)]:[];
  try{
    const url=`${RADIO_CLIPS_URL_R691}${RADIO_CLIPS_URL_R691.includes('?')?'&':'?'}ts=${Date.now()}`;
    const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R691-Clips'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`R2 radio clips HTTP ${response.status}`);
    const data=await response.json();
    const dynamic=(Array.isArray(data?.clips)?data.clips:[])
      .filter(item=>/^https:\/\//i.test(String(item?.url||'')) && /\.mp4(?:$|\?)/i.test(String(item?.url||'')))
      .map(prepareClip);
    const byUrl=new Map();
    for(const clip of [...builtIn,...dynamic])if(clip.url&&!byUrl.has(clip.url))byUrl.set(clip.url,clip);
    clipLibrary=[...byUrl.values()];
  }catch(error){
    console.error('[radio-clips]',cleanText(error?.message||error));
    if(!clipLibrary.length)clipLibrary=builtIn;
    else{
      const dynamic=clipLibrary.filter(item=>!item.builtIn);
      clipLibrary=[...builtIn,...dynamic.filter(item=>item.url!==JOY_OF_BEING_CLIP_URL)];
    }
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

function titleOverlayFiltersR721(){
  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const curPath=ffFilterPath(LIVE_CURRENT_FILE);
  const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
  return [
    // R721: keep every source pixel. 16:9 fills 1920x1080; any other aspect is padded.
    'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
    'setsar=1',
    `fps=${VIDEO_FPS}`,
    'format=yuv420p',
    // The requested HEAVY STREAM title treatment from the reference screenshot:
    // translucent black strip, red separator, black outer stroke, red inner stroke.
    'drawbox=x=0:y=ih-204:w=iw:h=88:color=black@0.38:t=fill',
    'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill',
    `drawtext=${titleFontPart}textfile='${curPath}':reload=${VIDEO_FPS}:fontcolor=white@0.01:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=8:bordercolor=black@0.92`,
    `drawtext=${titleFontPart}textfile='${curPath}':reload=${VIDEO_FPS}:fontcolor=0xF8F4EE:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1:shadowx=4:shadowy=4`,
    `drawtext=${fontPart}textfile='${tickerPath}':reload=${VIDEO_FPS}:fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
  ].join(',');
}

function normalVideoFilterComplexR721(){
  const vf=titleOverlayFiltersR721();
  // R722: keep the R721 seamless EQ and add one compact SUBSCRIBE + thumbs-up LIKE card.
  // It is visible for 8 seconds every 5 minutes. The CTA is intentionally NOT burned
  // into owner video clips, so short official clips remain clean and unobstructed.
  const ctaEnable=`lt(mod(t\,${CTA_PERIOD_SECONDS_R722})\,${CTA_SHOW_SECONDS_R722})`;
  return `[0:v]${vf}[base];[2:v]fps=${VIDEO_FPS},setpts=N/(${VIDEO_FPS}*TB),format=argb[eqv];[base][eqv]overlay=x=(W-w)/2:y=H-h-64:shortest=0:format=auto,format=yuv420p[eqbase];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[eqbase][qr]overlay=24:24:shortest=0:format=auto,format=yuv420p[qrbase];[3:v]format=rgba[cta];[qrbase][cta]overlay=x=(W-w)/2:y=46:shortest=0:format=auto:enable='${ctaEnable}',format=yuv420p[outv]`;
}

function clipFilterComplexR721(){
  const vf=titleOverlayFiltersR721();
  return `[0:v]${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=24:24:shortest=1:format=auto,format=yuv420p[outv]`;
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
    '-thread_queue_size','1024','-fflags','+genpts+discardcorrupt','-framerate',String(VIDEO_FPS),'-f','h264','-i','pipe:4',
    '-thread_queue_size','8192','-f','s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-i','pipe:3',
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
      console.error('[master]',line);
    }
  });
  thisPublisher.on('exit',(code,signal)=>{
    const isCurrent=publisher===thisPublisher;
    if(isCurrent){publisher=null;state.publisherRunning=false;}
    if(isCurrent && !stopping){
      state.lastExit={layer:'persistent-master',code,signal,at:new Date().toISOString()};
      // An actual RTMPS/master failure is the only reason the service exits/restarts.
      setTimeout(()=>process.exit(code||22),900).unref();
    }
  });
  thisPublisher.on('error',err=>{if(publisher===thisPublisher)state.lastError=String(err);});
  return true;
}

function normalVideoFeederArgsR721(visualPath,eqPath){
  return [
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','64','-re','-stream_loop','-1','-i',visualPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY,
    '-thread_queue_size','32','-re','-stream_loop','-1','-i',eqPath,
    '-loop','1','-framerate','1','-i',CTA_OVERLAY_R722,
    '-filter_complex',normalVideoFilterComplexR721(),
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
}

function startNormalVideoFeederR721(visualPath){
  if(stopping || clipActive)return false;
  const videoSink=publisher?.stdio?.[4];
  if(!publisher || publisher.exitCode!==null || !videoSink || videoSink.destroyed || videoSink.writableEnded)throw new Error('R721 persistent video pipe unavailable');
  const eq=equalizerSpecR721();
  if(!existsSync(visualPath) || statSync(visualPath).size<300000)throw new Error(`visual missing: ${visualPath}`);
  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000)throw new Error(`QR overlay missing: ${QR_OVERLAY}`);
  if(!existsSync(CTA_OVERLAY_R722) || statSync(CTA_OVERLAY_R722).size<5000)throw new Error(`R722 CTA overlay missing: ${CTA_OVERLAY_R722}`);
  if(!existsSync(eq.path) || statSync(eq.path).size<20000)throw new Error(`equalizer missing: ${eq.path}`);

  const child=spawn('ffmpeg',normalVideoFeederArgsR721(visualPath,eq.path),{stdio:['ignore','pipe','pipe']});
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

async function ensureNormalVideoFeederR721({force=false}={}){
  if(stopping || clipActive)return true;
  const visual=await ensureScheduledVisual();
  const period=activeVisualPeriodR721();
  if(!force && videoFeeder && videoFeeder.exitCode===null && videoFeederPath===visual && videoFeederPeriod===period)return true;
  visualSwitching=true;
  try{
    await stopNormalVideoFeederR721();
    if(stopping || clipActive)return true;
    return startNormalVideoFeederR721(visual);
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
  try{
    const raw=await runCapture('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=index','-of','csv=p=0',path],{timeoutMs:15000});
    return /\d/.test(String(raw));
  }catch(_){return false}
}

function clipFeederArgsR721(clipPath,{hasAudio=true,duration=0}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',clipPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY
  ];
  if(!hasAudio)args.push('-f','lavfi','-i',`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`);
  args.push(
    '-filter_complex',clipFilterComplexR721(),
    '-map','[outv]','-an','-sn','-dn',
    ...h264EncoderArgsR721(),
    '-f','h264','pipe:1',
    '-map',hasAudio?'0:a:0':'2:a:0','-vn','-sn','-dn',
    '-af',`aresample=${AUDIO_SAMPLE_RATE}`,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
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

async function playVideoClipR691(previous,item,next){
  let clipPath='';
  try{clipPath=await downloadRadioClipR691(item)}
  catch(error){
    state.lastError=`VIDEO clip cache: ${cleanText(error?.message||error)}`;
    console.error('[video-clip]',state.lastError);
    return false;
  }
  const duration=await probeDuration(clipPath).catch(()=>0);
  const hasAudio=await probeHasAudioR721(clipPath);
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:'clip',title:item.title,album:item.album,url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  writeFileSync(LIVE_CURRENT_FILE,`КЛИП • ANDRIK — ${shortText(item.title||'VIDEO',34)}`,'utf8');

  let child=null,videoSink=null,audioSink=null,stallTimer=null,forcedReason='';
  try{
    if(!publisher || publisher.exitCode!==null)throw new Error('R721 persistent master unavailable before clip');
    clipActive=true;
    await stopNormalVideoFeederR721();
    if(stopping)return false;
    videoSink=publisher?.stdio?.[4];
    audioSink=publisher?.stdio?.[3];
    if(!videoSink || videoSink.destroyed || videoSink.writableEnded || !audioSink || audioSink.destroyed || audioSink.writableEnded)throw new Error('R721 persistent A/V pipes unavailable before clip');

    child=spawn('ffmpeg',clipFeederArgsR721(clipPath,{hasAudio,duration}),{stdio:['ignore','pipe','pipe','pipe','pipe']});
    clipPublisher=child;
    state.producerRunning=true;
    child.stdout.pipe(videoSink,{end:false});
    child.stdio[3].pipe(audioSink,{end:false});
    child.stdout.on('error',()=>{});child.stdio[3].on('error',()=>{});

    let progressBuffer='',lastProgressAt=Date.now(),lastOutTime=0;
    const startedAt=Date.now();
    child.stdio[4].on('data',d=>{
      progressBuffer+=String(d||'');
      const lines=progressBuffer.split(/\r?\n/);progressBuffer=lines.pop()||'';
      for(const line of lines){
        const m=/^out_time_(?:us|ms)=(\d+)/.exec(line.trim());
        if(m){const value=Number(m[1]||0);if(value>lastOutTime){lastOutTime=value;lastProgressAt=Date.now();}}
      }
    });
    child.stderr.on('data',d=>{
      const line=String(d||'').trim();
      if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);console.error('[clip-feed]',line);}
    });
    stallTimer=setInterval(()=>{
      if(!child || child.exitCode!==null || stopping)return;
      const now=Date.now();
      if(now-startedAt>3500 && now-lastProgressAt>2500){
        forcedReason='progress-stall';
        state.lastError='R721 clip feeder stalled >2.5s — returning to MP3 without RTMPS reconnect';
        try{child.kill('SIGKILL')}catch(_){ }
      }
    },250);stallTimer.unref?.();

    const clipExit=new Promise(resolve=>{
      child.once('error',error=>resolve({kind:'error',error}));
      child.once('exit',(code,signal)=>resolve({kind:'exit',code,signal}));
    });
    const hardBoundaryMs=duration>1?Math.max(1800,Math.ceil((duration+1.2)*1000)):120000;
    let ended=await Promise.race([clipExit,sleep(hardBoundaryMs).then(()=>({kind:'deadline'}))]);
    if(ended?.kind==='deadline'){
      forcedReason='duration-deadline';
      state.lastError='R721 clip duration deadline — returning to MP3 without RTMPS reconnect';
      if(child.exitCode===null){try{child.kill('SIGKILL')}catch(_){ }}
      await waitChildExit(child,200);
      ended={kind:'exit',code:child.exitCode,signal:child.signalCode};
    }
    if(ended?.kind==='error'&&!forcedReason)throw ended.error;
    if(ended?.kind==='exit'&&ended.code!==0&&!stopping&&!forcedReason)throw new Error(`R721 clip feeder exit ${ended.code??ended.signal}`);
    return !stopping;
  }catch(error){
    state.lastError=`VIDEO clip R721: ${cleanText(error?.message||error)}`;
    console.error('[video-clip]',error);
    return false;
  }finally{
    if(stallTimer)clearInterval(stallTimer);
    await stopClipFeederR721(child,videoSink,audioSink);
    if(clipPublisher===child)clipPublisher=null;
    state.producerRunning=false;
    clipActive=false;
    if(!stopping){
      try{await ensureNormalVideoFeederR721({force:true});}catch(error){state.lastError=`R721 resume visual: ${cleanText(error?.message||error)}`;}
      await sleep(20);
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
  state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  writeFileSync(LIVE_CURRENT_FILE,`ANDRIK — ${shortText(item.title||'TRACK',42)}`,'utf8');

  const audioSink=publisher?.stdio?.[3];
  if(!publisher || publisher.exitCode!==null || !audioSink || audioSink.destroyed) throw new Error('master audio pipe unavailable');

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
    ok:Boolean(state.publisherRunning && (clipActive || (videoFeeder && videoFeeder.exitCode===null))),
    service:state.service,
    version:state.version,
    mode:state.mode,
    overlayMode:state.overlayMode,
    audioMode:state.audioMode,
    engine:'R721-PERSISTENT-H264-RELAY-SETTS',
    videoPipeline:'R723 R722 R721 PERSISTENT SETTS H264 RELAY + CLEAN GREEN QR + PERIODIC CTA (NO CROP / NO CLIP RECONNECT / NO MJPEG)',
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
    producerRunning:state.producerRunning,
    videoFeederRunning:Boolean(videoFeeder&&videoFeeder.exitCode===null),
    clipActive,
    clipBoundaryReconnect:false,
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

  if(req.method==='POST' && url.pathname.startsWith('/control/')){
    const remote=String(req.socket?.remoteAddress||'');
    const loopback=remote==='127.0.0.1'||remote==='::1'||remote==='::ffff:127.0.0.1';
    if(!loopback){res.writeHead(403,headers);res.end(JSON.stringify({ok:false,error:'local-control-only'}));return;}
    (async()=>{
      let result;
      if(url.pathname==='/control/visual-now')result=await applyVisualModeR721({slot:url.searchParams.get('slot')||''});
      else if(url.pathname==='/control/visual-auto')result=await applyVisualModeR721({auto:true});
      else if(url.pathname==='/control/full-fit')result=await ensureNormalVideoFeederR721({force:true}).then(()=>({ok:true,noCrop:true,restartedPublisher:false}));
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
  console.log(`ANDRIK Radio R723-GREEN-QR / R721-PERSISTENT-LIVE listening on :${PORT}`);
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
  stopping=true;
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
