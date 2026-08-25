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
const CLIP_CACHE_DIR = `${CACHE_DIR}/clips`;
const MAX_CACHED_TRACKS = 7;
const VISUAL_TIME_ZONE = process.env.VISUAL_TIME_ZONE || 'Europe/Bratislava';
const FORCE_VISUAL_SLOT = ['day','evening','night'].includes(String(process.env.FORCE_VISUAL_SLOT||'').trim().toLowerCase()) ? String(process.env.FORCE_VISUAL_SLOT).trim().toLowerCase() : '';
// R651: DAY / EVENING / NIGHT are owner-selected R2 videos cached locally on AWS.
// IMPORTANT: preserve the exact working R649 hotfix behavior: direct 1920x1080 scale,
// no crop and no pad. This intentionally fills the whole 16:9 frame every time.
const DAY_VISUAL = process.env.DAY_VISUAL || `${VISUAL_CACHE_DIR}/stream-day-master-r620.mp4`;
const EVENING_VISUAL = process.env.EVENING_VISUAL || `${VISUAL_CACHE_DIR}/stream-evening-master-r620.mp4`;
const NIGHT_VISUAL = process.env.NIGHT_VISUAL || `${VISUAL_CACHE_DIR}/stream-night-master-r620.mp4`;
const DAY_VISUAL_URL = process.env.DAY_VISUAL_URL || DAY_VISUAL;
const EVENING_VISUAL_URL = process.env.EVENING_VISUAL_URL || EVENING_VISUAL;
const NIGHT_VISUAL_URL = process.env.NIGHT_VISUAL_URL || NIGHT_VISUAL;
const EMERGENCY_VISUAL = process.env.EMERGENCY_VISUAL || new URL('../assets/live-eye-r223.mp4', import.meta.url).pathname;
const QR_OVERLAY = process.env.QR_OVERLAY || new URL('../assets/andrik-qr-r612.png', import.meta.url).pathname;
const OUTPUT_TIMESHIFT_SECONDS = 6; // R637: network recovery cushion; packets are NEVER dropped
const VIDEO_BITRATE = '4500k'; // R637: 1080p25 low-motion radio visual, bounded CBR
const AUDIO_BITRATE = '128k'; // YouTube Live recommendation for stereo AAC
const AUDIO_SAMPLE_RATE = 44100; // YouTube Live recommendation for stereo
const VIDEO_FPS = 25;
const VIDEO_GOP = 50; // exactly 2 seconds at 25 fps
const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));
const LIVE_TICKER_FILE = process.env.LIVE_TICKER_FILE || `${CACHE_DIR}/live-ticker.txt`;
const LIVE_CURRENT_FILE = process.env.LIVE_CURRENT_FILE || `${CACHE_DIR}/current-live.txt`;
const DEFAULT_LIVE_TICKER = 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';
const DISABLED_ALBUM_PREFIXES = Object.freeze([
  'albums/illusion-of-life/',
  'albums/ocean/'
]);

// R654: the two full native ANDRIK music videos from R2. They are inserted
// between songs all day, never back-to-back, and cached locally before playback.
const CLIPS = Object.freeze([
  { type:'clip', sourceType:'clip', title:'JOY OF BEING', album:'OFFICIAL MUSIC VIDEO', key:'clips/joy-of-being-official-2026.mp4', url:'https://music.andrikmetal.com/clips/joy-of-being-official-2026.mp4' },
  { type:'clip', sourceType:'clip', title:'Я ЕСТЬ', album:'OFFICIAL MUSIC VIDEO', key:'clips/ya-est-official-2026.mp4', url:'https://music.andrikmetal.com/clips/ya-est-official-2026.mp4' }
]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R654-R653-PUSH-R649-FULLSCREEN-TWO-R2-CLIPS-CONTINUOUS-AUDIO',
  mode: 'R654 + R653 PUSH / TWO NATIVE R2 CLIPS BETWEEN SONGS / R649 FULLSCREEN DAY-EVENING-NIGHT / ONE LONG-LIVED AAC CLOCK / NO PACKET DROP / LIVE TICKER + QR',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'R649 DIRECT 1920x1080 BACKGROUND + FULL 1920x1080 R2 CLIPS / NO CROP / NO PAD / QR / YELLOW TRACK + LIVE TICKER',
  audioMode: 'MP3 + R2 CLIP AUDIO → PCM 44.1kHz / ONE LONG-LIVED AAC-LC 128kbps ENCODER / CONTINUOUS SAMPLE CLOCK',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  libraryTracks: 0,
  libraryAlbumTracks: 0,
  librarySingleTracks: 0,
  duplicateSinglesSkipped: 0,
  libraryVideos: CLIPS.length,
  videoSourceMode: 'background',
  cycle: 0,
  queueLength: 0,
  queuePosition: 0,
  previous: null,
  current: null,
  next: null,
  lastLibraryRefresh: null,
  lastExit: null,
  lastError: '',
  lastFfmpegLine: ''
};

let publisher = null;
let producer = null;
let visualProducer = null;
let visualSwitching = false;
let library = [];
let queue = [];
let queueIndex = 0;
let running = false;
let stopping = false;
let lastPlayed = null;
const prefetchJobs = new Map();
const clipPrefetchJobs = new Map();

const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  return cleanText(value).replace(/(?:\.(?:mp3|wav))+$/ig,'')
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
    .replace(/(?:\.mp3)+$/ig,'')
    .replace(/[_-]+/g,' ');
}

function identityCandidates(item){
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

async function loadLibrary(){
  const previousSignature=librarySignature(library);
  const url=`${PLAYLIST_URL}${PLAYLIST_URL.includes('?')?'&':'?'}ts=${Date.now()}`;
  const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R616'}});
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
  state.libraryTracks=library.length;
  state.libraryAlbumTracks=albums.length;
  state.librarySingleTracks=merged.singles.length;
  state.duplicateSinglesSkipped=merged.skipped;
  state.libraryVideos=CLIPS.length;
  state.lastLibraryRefresh=new Date().toISOString();
  const changed=previousSignature!==librarySignature(library);
  return {library,changed};
}

function addIdentityCandidates(target,item){
  for(const id of identityCandidates(item))target.add(id);
  if(!identityCandidates(item).length)target.add(primaryIdentity(item));
}

function identityAlreadySeen(target,item){
  const ids=identityCandidates(item);
  return ids.length ? ids.some(id=>target.has(id)) : target.has(primaryIdentity(item));
}

function reconcileQueueWithLibrary(){
  if(!queue.length)return;

  // Preserve the already played prefix. For the remainder, rebuild a fresh
  // interleaved cycle so newly uploaded songs appear quickly and the two clips
  // stay between songs rather than being randomly adjacent.
  const played=queue.slice(0,queueIndex);
  const playedTrackIds=new Set();
  played.filter(item=>item.type!=='clip').forEach(item=>addIdentityCandidates(playedTrackIds,item));
  const remainingTracks=library.filter(item=>!identityAlreadySeen(playedTrackIds,item));
  const tail=buildInterleavedQueue(remainingTracks,false);
  queue=[...played,...tail];
  state.queueLength=queue.length;
}

function buildInterleavedQueue(trackSource=library,countCycle=true){
  const audio=shuffle(trackSource);
  const clips=shuffle(CLIPS);
  const out=[];
  if(!audio.length)return out;

  // One appearance of each full clip per music cycle. The gap adapts to the
  // library size and is never below 3 songs, so videos never run back-to-back.
  const baseGap=Math.max(3,Math.floor(audio.length/(clips.length+1)));
  let clipIndex=0;
  let untilClip=baseGap+Math.floor(Math.random()*3);
  for(const track of audio){
    out.push(track);
    untilClip--;
    if(untilClip<=0 && clipIndex<clips.length){
      out.push(clips[clipIndex++]);
      untilClip=baseGap+Math.floor(Math.random()*3);
    }
  }
  while(clipIndex<clips.length){
    // If too few tracks remain, put the clip before the final song when possible.
    const clip=clips[clipIndex++];
    if(out.length>1 && out[out.length-1]?.type==='track') out.splice(out.length-1,0,clip);
    else out.push(clip);
  }
  if(countCycle)state.cycle++;
  state.queueLength=out.length;
  return out;
}

function buildQueue(){
  return buildInterleavedQueue(library,true);
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
        renameSync(tmp,dest);
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

function clipCachePath(item){
  const id=createHash('sha1').update(String(item?.url||'')).digest('hex').slice(0,24);
  return `${CLIP_CACHE_DIR}/${id}.mp4`;
}

async function downloadClipToCache(item){
  prepareCacheDir();
  const dest=clipCachePath(item);
  try{
    if(existsSync(dest) && statSync(dest).size>2*1024*1024)return dest;
  }catch(_){}
  if(clipPrefetchJobs.has(dest))return clipPrefetchJobs.get(dest);

  const job=(async()=>{
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      const tmp=`${dest}.part-${process.pid}-${Date.now()}-${attempt}`;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),5*60*1000);
      try{
        const response=await fetch(item.url,{headers:{'user-agent':'ANDRIK-Radio-R654-ClipCache'},signal:controller.signal});
        if(!response.ok)throw new Error(`clip cache HTTP ${response.status}`);
        if(!response.body)throw new Error('clip cache empty response body');
        await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
        if(!existsSync(tmp) || statSync(tmp).size<2*1024*1024)throw new Error('clip cache file too small');
        renameSync(tmp,dest);
        return dest;
      }catch(error){
        lastError=error;
        try{unlinkSync(tmp);}catch(_){}
        if(attempt<3)await sleep(1500*attempt);
      }finally{clearTimeout(timer)}
    }
    throw lastError||new Error('clip cache download failed');
  })();
  clipPrefetchJobs.set(dest,job);
  try{return await job;}finally{clipPrefetchJobs.delete(dest)}
}

function prefetchClip(item){
  if(item?.type!=='clip' || !item?.url)return;
  downloadClipToCache(item).catch(error=>console.error('[clip-prefetch]',cleanText(error?.message||error)));
}

function prefetchClips(){
  CLIPS.forEach(prefetchClip);
}

function prefetchItem(item){
  if(!item?.url)return;
  if(item.type==='clip')prefetchClip(item);
  else prefetchTrack(item);
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
  if(hour>=8 && hour<17)return 'day';
  if(hour>=17 && hour<22)return 'evening';
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
  for(const period of ['day','evening','night']){
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
    state.visualPeriod=FORCE_VISUAL_SLOT?`manual-${period}`:period;
    state.visualPath=path;
    return path;
  }catch(error){
    if(existsSync(EMERGENCY_VISUAL) && statSync(EMERGENCY_VISUAL).size>300000){
      state.lastError=`R622 ${period} local visual fallback: ${cleanText(error?.message||error)}`;
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

function masterVideoFilter(){
  const font=chooseFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const curPath=ffFilterPath(LIVE_CURRENT_FILE);
  const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
  return [
    // Incoming source is already full-frame, but keep the R649 direct stretch as
    // the final safety net for both background videos and official clips.
    'scale=1920:1080:flags=lanczos',
    'setsar=1',
    `fps=${VIDEO_FPS}`,
    `setpts=N/(${VIDEO_FPS}*TB)`,
    'format=yuv420p',
    `drawtext=${fontPart}textfile='${curPath}':reload=${VIDEO_FPS}:fontcolor=yellow:fontsize=44:x=(w-text_w)/2:y=h-148:borderw=4:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`,
    `drawtext=${fontPart}textfile='${tickerPath}':reload=${VIDEO_FPS}:fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
  ].join(',');
}

function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }
  prepareCacheDir();
  if(!existsSync(LIVE_TICKER_FILE)) writeFileSync(LIVE_TICKER_FILE,DEFAULT_LIVE_TICKER,'utf8');
  if(!existsSync(LIVE_CURRENT_FILE)) writeFileSync(LIVE_CURRENT_FILE,'ANDRIK','utf8');
  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000) throw new Error(`QR overlay missing: ${QR_OVERLAY}`);

  const filterComplex=`[0:v]${masterVideoFilter()}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=24:24:format=yuv420[outv]`;

  // R654 keeps the R637 audio guarantee intact: one master owns AAC for the
  // entire broadcast. Video also enters through one long-lived pipe, allowing
  // a background loop or an official clip to be swapped without restarting RTMPS.
  const args=[
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','8192','-f','rawvideo','-pixel_format','yuv420p','-video_size','1920x1080','-framerate',String(VIDEO_FPS),'-i','pipe:4',
    '-loop','1','-framerate','1','-i',QR_OVERLAY,
    '-thread_queue_size','8192','-f','s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-i','pipe:3',
    '-filter_complex',filterComplex,
    '-map','[outv]','-map','2:a:0',
    '-shortest',
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

  publisher=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe','pipe','pipe']});
  state.publisherRunning=true;
  state.streamStartedAt=new Date().toISOString();
  for(const [name,sink] of [['audio',publisher.stdio[3]],['video',publisher.stdio[4]]]){
    sink.on('error',err=>{
      if(!stopping && !/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(err?.code||err?.message||err))) state.lastError=`${name}-pipe: ${String(err)}`;
    });
  }
  publisher.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe|non-monoton|continuity/i.test(line))state.lastError=line.slice(-700);
      console.error('[master]',line);
    }
  });
  publisher.on('exit',(code,signal)=>{
    state.publisherRunning=false;
    state.lastExit={layer:'master',code,signal,at:new Date().toISOString()};
    publisher=null;
    if(!stopping)setTimeout(()=>process.exit(code||22),1500).unref();
  });
  publisher.on('error',err=>{state.lastError=String(err);});
  return true;
}

function sourceVideoArgs(path,{loop=false}={}){
  const args=['-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re'];
  if(loop)args.push('-stream_loop','-1');
  args.push('-i',path,
    '-map','0:v:0','-an','-sn','-dn',
    '-vf',`scale=1920:1080:flags=lanczos,setsar=1,fps=${VIDEO_FPS},format=yuv420p`,
    '-pix_fmt','yuv420p','-f','rawvideo','pipe:1');
  return args;
}

function startBackgroundVisual(visualPath){
  const videoSink=publisher?.stdio?.[4];
  if(!publisher || publisher.exitCode!==null || !videoSink || videoSink.destroyed) throw new Error('master video pipe unavailable');
  if(!existsSync(visualPath) || statSync(visualPath).size<300000)throw new Error(`visual missing: ${visualPath}`);

  visualSwitching=false;
  state.videoSourceMode='background';
  state.visualPath=visualPath;
  visualProducer=spawn('ffmpeg',sourceVideoArgs(visualPath,{loop:true}),{stdio:['pipe','pipe','pipe']});
  const source=visualProducer.stdout;
  source.pipe(videoSink,{end:false});
  visualProducer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line && /error|fail|invalid|corrupt/i.test(line))state.lastError=line.slice(-700);
  });
  visualProducer.once('exit',(code,signal)=>{
    try{source.unpipe(videoSink)}catch(_){}
    visualProducer=null;
    if(!stopping && !visualSwitching && state.videoSourceMode==='background'){
      state.lastExit={layer:'background-video',code,signal,at:new Date().toISOString()};
      setTimeout(()=>process.exit(code||23),1200).unref();
    }
  });
  visualProducer.once('error',err=>{state.lastError=`background-video: ${String(err)}`});
  return true;
}

async function stopBackgroundVisual(){
  const active=visualProducer;
  if(!active || active.exitCode!==null){visualProducer=null;return;}
  visualSwitching=true;
  // Keep stdout connected while SIGTERM is handled so FFmpeg completes the
  // current raw-video frame. Unpiping first could cut a 3,110,400-byte frame
  // in half and permanently shift every following frame.
  try{active.stdin?.write('q\n');}catch(_){}
  let clean=await waitChildExit(active,2200);
  if(!clean && active.exitCode===null){active.kill('SIGTERM');clean=await waitChildExit(active,900);}
  if(!clean && active.exitCode===null){active.kill('SIGKILL');await waitChildExit(active,500);}
  try{active.stdout?.unpipe(publisher?.stdio?.[4])}catch(_){}
  visualProducer=null;
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

function clipProducerArgs(localClipPath){
  return [
    '-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',localClipPath,
    '-map','0:v:0','-an','-sn','-dn',
    '-vf',`scale=1920:1080:flags=lanczos,setsar=1,fps=${VIDEO_FPS},format=yuv420p`,
    '-pix_fmt','yuv420p','-f','rawvideo','pipe:1',
    '-map','0:a:0','-vn','-sn','-dn','-af',`aresample=${AUDIO_SAMPLE_RATE}`,
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-f','s16le','pipe:3'
  ];
}

function setNowPlaying(previous,item,next,duration){
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  writeFileSync(LIVE_CURRENT_FILE,item.type==='clip'?`${item.title} • OFFICIAL MUSIC VIDEO`:trackLabel(item,'ANDRIK'),'utf8');
}

async function playTrack(previous,item,next,localAudioPath){
  const duration=await probeDuration(localAudioPath||item.url);
  setNowPlaying(previous,item,next,duration);

  const audioSink=publisher?.stdio?.[3];
  if(!publisher || publisher.exitCode!==null || !audioSink || audioSink.destroyed) throw new Error('master audio pipe unavailable');
  if(!visualProducer || visualProducer.exitCode!==null){
    const background=await ensureScheduledVisual();
    startBackgroundVisual(background);
  }

  state.producerRunning=true;
  producer=spawn('ffmpeg',decoderArgs(localAudioPath),{stdio:['ignore','pipe','pipe']});
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|corrupt/i.test(line))state.lastError=line.slice(-700);
      console.error('[decoder]',line);
    }
  });

  await new Promise((resolve,reject)=>{
    const source=producer.stdout;
    source.pipe(audioSink,{end:false});
    producer.once('error',reject);
    producer.once('exit',(code,signal)=>{
      try{source.unpipe(audioSink)}catch(_){}
      state.producerRunning=false;
      producer=null;
      if(code===0 || stopping)resolve();
      else reject(new Error(`decoder exit ${code||signal}`));
    });
  });
}

async function playClip(previous,item,next,localClipPath){
  const duration=await probeDuration(localClipPath||item.url);
  setNowPlaying(previous,item,next,duration);

  const audioSink=publisher?.stdio?.[3];
  const videoSink=publisher?.stdio?.[4];
  if(!publisher || publisher.exitCode!==null || !audioSink || audioSink.destroyed || !videoSink || videoSink.destroyed)throw new Error('master media pipes unavailable');

  await stopBackgroundVisual();
  state.videoSourceMode='clip';
  visualSwitching=true;
  state.producerRunning=true;
  producer=spawn('ffmpeg',clipProducerArgs(localClipPath),{stdio:['ignore','pipe','pipe','pipe']});
  const videoSource=producer.stdout;
  const audioSource=producer.stdio[3];
  videoSource.pipe(videoSink,{end:false});
  audioSource.pipe(audioSink,{end:false});
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|corrupt/i.test(line))state.lastError=line.slice(-700);
      console.error('[clip]',line);
    }
  });

  let clipError=null;
  await new Promise((resolve,reject)=>{
    producer.once('error',reject);
    producer.once('exit',(code,signal)=>{
      try{videoSource.unpipe(videoSink)}catch(_){}
      try{audioSource.unpipe(audioSink)}catch(_){}
      state.producerRunning=false;
      producer=null;
      if(code===0 || stopping)resolve();
      else reject(new Error(`clip decoder exit ${code||signal}`));
    });
  }).catch(error=>{clipError=error});

  // Resume the currently selected day/evening/night video immediately after the clip.
  const background=await ensureScheduledVisual();
  visualSwitching=false;
  startBackgroundVisual(background);
  if(clipError)throw clipError;
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  prefetchAllVisuals();
  prefetchClips();
  const startupVisual=await ensureScheduledVisual();
  if(!startPublisher())return;
  startBackgroundVisual(startupVisual);

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

      prefetchItem(next);
      prefetchItem(following);
      if(item.type==='clip'){
        const localClipPath=await downloadClipToCache(item);
        await playClip(lastPlayed,item,next,localClipPath);
      }else{
        const localAudioPath=await downloadTrackToCache(item);
        const keep=[localAudioPath];
        if(next?.type!=='clip')keep.push(audioCachePath(next||{}));
        if(following?.type!=='clip')keep.push(audioCachePath(following||{}));
        pruneAudioCache(keep);
        await playTrack(lastPlayed,item,next,localAudioPath);
      }
      lastPlayed=item;
      queueIndex++;
      state.lastError='';
    }catch(error){
      state.lastError=String(error?.stack||error).slice(-1200);
      console.error('[radio]',error);

      if(producer && producer.exitCode===null)producer.kill('SIGTERM');
      producer=null;
      state.producerRunning=false;
      if(state.videoSourceMode==='clip'){
        try{
          const background=await ensureScheduledVisual();
          visualSwitching=false;
          if(!visualProducer)startBackgroundVisual(background);
        }catch(_){}
      }

      await sleep(1000);

      if(/library|HTTP|empty/i.test(String(error)))library=[];
      else queueIndex++;
    }
  }
}

function publicStatus(){
  const now=Date.now();
  return {
    ok:Boolean(state.publisherRunning&&state.producerRunning),
    service:state.service,
    version:state.version,
    mode:state.mode,
    overlayMode:state.overlayMode,
    audioMode:state.audioMode,
    outputTimeshiftSeconds:OUTPUT_TIMESHIFT_SECONDS,
    videoBitrate:VIDEO_BITRATE,
    audioBitrate:AUDIO_BITRATE,
    audioSampleRate:AUDIO_SAMPLE_RATE,
    videoFps:VIDEO_FPS,
    videoGop:VIDEO_GOP,
    qrOverlay:QR_OVERLAY,
    visualTimeZone:state.visualTimeZone,
    forceVisualSlot:FORCE_VISUAL_SLOT||null,
    visualPeriod:state.visualPeriod,
    visualPath:state.visualPath,
    publisherRunning:state.publisherRunning,
    producerRunning:state.producerRunning,
    libraryTracks:state.libraryTracks,
    libraryAlbumTracks:state.libraryAlbumTracks,
    librarySingleTracks:state.librarySingleTracks,
    duplicateSinglesSkipped:state.duplicateSinglesSkipped,
    libraryRefreshSeconds:Math.round(LIBRARY_REFRESH_MS/1000),
    libraryVideos:state.libraryVideos,
    videoSourceMode:state.videoSourceMode,
    clips:CLIPS.map(({title,url})=>({title,url})),
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
      clips:CLIPS.map(({title,url})=>({title,url})),
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
  console.log(`ANDRIK Radio R654 TWO-R2-CLIPS + CONTINUOUS-AUDIO listening on :${PORT}`);
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
  try{server.close();}catch(_){}

  // Stop current song/clip producer and the background video source first.
  const activeDecoder=producer;
  if(activeDecoder&&activeDecoder.exitCode===null)activeDecoder.kill('SIGTERM');
  await waitChildExit(activeDecoder,2500);
  const activeVisual=visualProducer;
  visualSwitching=true;
  if(activeVisual&&activeVisual.exitCode===null)activeVisual.kill('SIGTERM');
  await waitChildExit(activeVisual,1800);

  // EOF on both persistent media pipes lets the single AAC/H.264 master flush
  // FLV naturally, preserving the clean YouTube archive stop path.
  const activeMaster=publisher;
  try{
    for(const sink of [activeMaster?.stdio?.[3],activeMaster?.stdio?.[4]]){
      if(sink && !sink.destroyed && !sink.writableEnded)sink.end();
    }
  }catch(_){}
  let clean=await waitChildExit(activeMaster,9000);
  if(!clean && activeMaster&&activeMaster.exitCode===null){
    activeMaster.kill('SIGTERM');
    clean=await waitChildExit(activeMaster,2500);
  }
  process.exit(0);
}

process.once('SIGTERM',()=>{shutdown().catch(()=>process.exit(0));});
process.once('SIGINT',()=>{shutdown().catch(()=>process.exit(0));});
