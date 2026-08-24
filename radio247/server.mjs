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
const STREAM_URL = STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '';
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const CACHE_DIR = process.env.RADIO_CACHE_DIR || '/tmp/andrik-radio-r611';
const AUDIO_CACHE_DIR = `${CACHE_DIR}/audio`;
const MAX_CACHED_TRACKS = 7;
const VISUAL_TIME_ZONE = process.env.VISUAL_TIME_ZONE || 'Europe/Bratislava';
const DAY_VISUAL = process.env.DAY_VISUAL || new URL('./assets/stream-day-r607.mp4', import.meta.url).pathname;
const EVENING_VISUAL = process.env.EVENING_VISUAL || new URL('./assets/stream-evening-r607.mp4', import.meta.url).pathname;
const NIGHT_VISUAL = process.env.NIGHT_VISUAL || new URL('./assets/stream-night-r607.mp4', import.meta.url).pathname;
const QR_OVERLAY = process.env.QR_OVERLAY || new URL('../assets/andrik-qr-r612.png', import.meta.url).pathname;
const OUTPUT_TIMESHIFT_SECONDS = Number(process.env.OUTPUT_TIMESHIFT_SECONDS || 6);
const TIMESTAMP_GUARD_SECONDS = Number(process.env.TIMESTAMP_GUARD_SECONDS || 0.06);
const VIDEO_BITRATE = process.env.VIDEO_BITRATE || '1000k';
const AUDIO_BITRATE = process.env.AUDIO_BITRATE || '128k';
const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));
const DISABLED_ALBUM_PREFIXES = Object.freeze([
  'albums/illusion-of-life/',
  'albums/ocean/'
]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R616-AUTO-SINGLES-PUBLISH-DEDUPE-TIMESTAMP-CONTINUITY',
  mode: 'AUTO SINGLES + RELEASE PUBLISH + EXTENSION-SAFE CROSS-CATALOG DEDUPE / TIMESTAMP CONTINUITY FIX / 480p24 ~1.15Mbps / 6s OUTPUT FIFO / RTMPS RECOVERY / LOCAL MP3 CACHE + 2-TRACK PREFETCH / DAYPART VISUALS + QR',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'QR TOP-LEFT / YELLOW NOW / MULTIPLATFORM CTA TICKER',
  audioMode: 'LOCAL MP3 CACHE + 2-TRACK PREFETCH / AAC-LC 48kHz stereo 128kbps',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  libraryTracks: 0,
  libraryAlbumTracks: 0,
  librarySingleTracks: 0,
  duplicateSinglesSkipped: 0,
  libraryVideos: 0,
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
let library = [];
let queue = [];
let queueIndex = 0;
let timelineOffset = 0;
let running = false;
let stopping = false;
let lastPlayed = null;
const prefetchJobs = new Map();

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
  state.libraryVideos=0;
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

  const played=queue.slice(0,queueIndex);
  const playedIds=new Set();
  played.forEach(item=>addIdentityCandidates(playedIds,item));
  const liveByUrl=new Map(library.map(item=>[item.url,item]));
  const remaining=[];
  const remainingIds=new Set();

  for(const oldItem of queue.slice(queueIndex)){
    const live=liveByUrl.get(oldItem.url);
    if(!live)continue;
    if(identityAlreadySeen(playedIds,live)||identityAlreadySeen(remainingIds,live))continue;
    remaining.push(live);
    addIdentityCandidates(remainingIds,live);
  }

  const additions=[];
  for(const item of library){
    if(identityAlreadySeen(playedIds,item)||identityAlreadySeen(remainingIds,item))continue;
    additions.push(item);
    addIdentityCandidates(remainingIds,item);
  }

  queue=[...played,...shuffle([...remaining,...additions])];
  state.queueLength=queue.length;
}

function buildQueue(){
  const out=shuffle(library);
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

function ffFilterPath(path){
  return String(path).replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
}

function prepareCacheDir(){
  mkdirSync(CACHE_DIR,{recursive:true});
  mkdirSync(AUDIO_CACHE_DIR,{recursive:true});
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

async function ensureScheduledVisual(){
  prepareCacheDir();
  const period=visualPeriodForHour(localHourInTimeZone());
  const path=period==='day' ? DAY_VISUAL : period==='evening' ? EVENING_VISUAL : NIGHT_VISUAL;
  if(!existsSync(path) || statSync(path).size<500000){
    throw new Error(`R615 ${period} visual missing or too small: ${path}`);
  }
  state.visualPeriod=period;
  state.visualPath=path;
  return path;
}

function trackLabel(item,fallback='—'){
  if(!item)return fallback;
  const title=shortText(item.title||'ANDRIK',48);
  const album=shortText(item.album||'',24);
  return album ? `${title} (${album})` : title;
}

function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }

  const args=[
    '-hide_banner','-loglevel','warning',
    '-fflags','+genpts+discardcorrupt',
    '-analyzeduration','5000000','-probesize','5000000',
    '-thread_queue_size','8192',
    '-i','pipe:0',
    '-map','0:v:0','-map','0:a:0',
    '-c:v','copy','-c:a','copy',
    '-tag:v','7','-tag:a','10',
    '-tcp_nodelay','1',
    '-f','fifo',
    '-fifo_format','flv',
    '-queue_size','4096',
    '-timeshift',`${Math.max(0,OUTPUT_TIMESHIFT_SECONDS)}s`,
    '-drop_pkts_on_overflow','1',
    '-attempt_recovery','1',
    '-recover_any_error','1',
    '-recovery_wait_time','1',
    '-restart_with_keyframe','1',
    STREAM_URL
  ];

  publisher=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});
  state.publisherRunning=true;
  state.streamStartedAt=new Date().toISOString();

  publisher.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe/i.test(line))state.lastError=line.slice(-700);
      console.error('[publisher]',line);
    }
  });

  publisher.on('exit',(code,signal)=>{
    state.publisherRunning=false;
    state.lastExit={layer:'publisher',code,signal,at:new Date().toISOString()};
    publisher=null;
    if(!stopping)setTimeout(()=>process.exit(code||22),2500).unref();
  });

  publisher.on('error',err=>{state.lastError=String(err);});
  return true;
}

function producerArgs(item,duration,offset,visualPath,previous,next){
  prepareCacheDir();
  const key=createHash('sha1').update([previous?.url||'',item?.url||'',next?.url||'',Date.now()].join('|')).digest('hex').slice(0,12);
  const currentFile=`${CACHE_DIR}/current-live-${key}.txt`;
  const tickerFile=`${CACHE_DIR}/ticker-live-${key}.txt`;

  writeFileSync(currentFile,`СЕЙЧАС: ${trackLabel(item,'ANDRIK')}`,'utf8');
  const unit=`ANDRIK METAL RADIO 24/7   •   СЕЙЧАС: ${trackLabel(item,'ANDRIK')}   •   ДАЛЬШЕ: ${trackLabel(next,'—')}   •   СЛУШАЙТЕ ANDRIK: SPOTIFY • APPLE MUSIC • AMAZON MUSIC • YOUTUBE   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ • И ПРОСТО КАЙФУЙТЕ   •   ANDRIKMETAL.COM   •   `;
  writeFileSync(tickerFile,unit.repeat(8),'utf8');

  const font=chooseFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const curPath=ffFilterPath(currentFile), tickerPath=ffFilterPath(tickerFile);

  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000){
    throw new Error(`R615 QR overlay missing or too small: ${QR_OVERLAY}`);
  }

  const baseVf=[
    'scale=854:480:force_original_aspect_ratio=decrease',
    'pad=854:480:(ow-iw)/2:(oh-ih)/2',
    'setsar=1',
    'fps=24',
    `tpad=stop_mode=clone:stop_duration=${Math.ceil(duration)+10}`,
    'format=yuv420p',
    'drawbox=x=0:y=ih-118:w=iw:h=118:color=black@0.56:t=fill',
    'drawbox=x=iw*0.10:y=ih-91:w=iw*0.80:h=43:color=black@0.90:t=fill',
    'drawbox=x=iw*0.10:y=ih-91:w=iw*0.80:h=43:color=yellow@0.55:t=2',
    `drawtext=${fontPart}textfile='${curPath}':fontcolor=yellow:fontsize=27:x=(w-text_w)/2:y=h-84:shadowcolor=black@1:shadowx=2:shadowy=2`,
    'drawbox=x=0:y=ih-40:w=iw:h=40:color=black@0.88:t=fill',
    `drawtext=${fontPart}textfile='${tickerPath}':fontcolor=white:fontsize=19:x='w-mod(t*92,text_w/8+w)':y=h-33:shadowcolor=black@1:shadowx=1:shadowy=1`
  ].join(',');
  const filterComplex=`[1:v]${baseVf}[base];[2:v]scale=128:128:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=16:16:format=yuv420[outv]`;

  const inputArgs=[
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','4096','-re','-i',item.localAudioPath||item.url,
    '-thread_queue_size','4096','-stream_loop','-1','-i',visualPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY,
    '-filter_complex',filterComplex,
    '-map','[outv]','-map','0:a:0'
  ];

  return {tempFiles:[currentFile,tickerFile],args:[
    ...inputArgs,
    '-t',duration.toFixed(3),
    '-c:v','libx264','-preset','superfast','-tune','zerolatency',
    '-profile:v','main','-level:v','3.0',
    '-b:v',VIDEO_BITRATE,'-minrate',VIDEO_BITRATE,'-maxrate',VIDEO_BITRATE,'-bufsize','2000k',
    '-x264-params','nal-hrd=cbr:force-cfr=1:repeat-headers=1',
    '-g','48','-keyint_min','48','-sc_threshold','0','-r','24','-threads','2','-pix_fmt','yuv420p',
    '-af','aresample=48000:async=1:first_pts=0',
    '-c:a','aac','-profile:a','aac_low','-b:a',AUDIO_BITRATE,'-ar','48000','-ac','2',
    '-flush_packets','1',
    '-muxdelay','0','-muxpreload','0',
    '-output_ts_offset',offset.toFixed(6),'-mpegts_flags','+resend_headers+initial_discontinuity','-f','mpegts','pipe:1'
  ]};
}

async function playItem(previous,item,next,following,localAudioPath){
  const playableItem={...item,localAudioPath};
  const duration=await probeDuration(localAudioPath||item.url);
  const visualPath=await ensureScheduledVisual();
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  state.producerRunning=true;
  const spec=producerArgs(playableItem,duration,timelineOffset,visualPath,previous,next);
  producer=spawn('ffmpeg',spec.args,{stdio:['ignore','pipe','pipe']});
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid/i.test(line))state.lastError=line.slice(-700);
      console.error('[producer]',line);
    }
  });

  try{
    await new Promise((resolve,reject)=>{
      if(!publisher?.stdin)return reject(new Error('publisher stdin unavailable'));
      producer.stdout.pipe(publisher.stdin,{end:false});
      producer.once('error',reject);
      producer.once('exit',(code,signal)=>{
        state.producerRunning=false;
        producer=null;
        if(code===0||signal==='SIGTERM')resolve();
        else reject(new Error(`producer exit ${code||signal}`));
      });
    });
  }finally{
    for(const path of spec.tempFiles){try{unlinkSync(path);}catch(_){ }}
  }

  // R614: keep every new MPEG-TS segment strictly after the previous one.
  // MP3 duration can be estimated a few milliseconds short and AAC/H.264 packet grids
  // can otherwise overlap at a track boundary, producing Non-monotonic DTS in FLV/RTMPS.
  timelineOffset += duration + TIMESTAMP_GUARD_SECONDS;
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  if(!startPublisher())return;

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

      const localAudioPath=await downloadTrackToCache(item);
      prefetchTrack(next);
      prefetchTrack(following);
      pruneAudioCache([localAudioPath,audioCachePath(next||{}),audioCachePath(following||{})]);

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

      await sleep(5000);

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
    qrOverlay:QR_OVERLAY,
    visualTimeZone:state.visualTimeZone,
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
  console.log(`ANDRIK Radio R615-AUTO-SINGLES-DEDUPE listening on :${PORT}`);
  radioLoop();
});

function shutdown(){
  stopping=true;
  if(producer&&producer.exitCode===null)producer.kill('SIGTERM');
  if(publisher&&publisher.exitCode===null)publisher.kill('SIGTERM');
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),5000).unref();
}

process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
