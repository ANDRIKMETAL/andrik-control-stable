import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';

const PORT = Number(process.env.PORT || 8080);
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://andrikmetal.com/api/music/downloads';
const STREAM_KEY = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const STREAM_URL = STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '';
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const CACHE_DIR = process.env.RADIO_CACHE_DIR || '/tmp/andrik-radio-r607';
const VISUAL_TIME_ZONE = process.env.VISUAL_TIME_ZONE || 'Europe/Bratislava';
const DAY_VISUAL = process.env.DAY_VISUAL || new URL('./assets/stream-day-r607.mp4', import.meta.url).pathname;
const EVENING_VISUAL = process.env.EVENING_VISUAL || new URL('./assets/stream-evening-r607.mp4', import.meta.url).pathname;
const NIGHT_VISUAL = process.env.NIGHT_VISUAL || new URL('./assets/stream-night-r607.mp4', import.meta.url).pathname;
const DISABLED_ALBUM_PREFIXES = Object.freeze([
  'albums/illusion-of-life/',
  'albums/ocean/'
]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R607-DAYPART-MP3-ONLY',
  mode: 'MP3 ONLY / DAY-EVENING-NIGHT VISUALS / AAC-LC 48kHz STEREO',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'YELLOW NOW / MULTIPLATFORM CTA TICKER',
  audioMode: 'AAC-LC 48kHz stereo 160kbps / async normalized at producer + publisher',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  libraryTracks: 0,
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
  const m=/^albums\/([^/]+)\//i.exec(key);
  return m ? m[1].replace(/[_-]+/g,' ') : 'ANDRIK';
}

async function loadLibrary(){
  const url=`${PLAYLIST_URL}${PLAYLIST_URL.includes('?')?'&':'?'}ts=${Date.now()}`;
  const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R607'}});
  if(!response.ok)throw new Error(`R2 library HTTP ${response.status}`);

  const data=await response.json();
  const source=Array.isArray(data.tracks)?data.tracks:[];
  const albums=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    const url=String(item?.url||'');
    const keyLower=key.toLowerCase();
    const disabled=DISABLED_ALBUM_PREFIXES.some(prefix=>keyLower.startsWith(prefix));
    return /^albums\//i.test(key) && !disabled && /^https:\/\//i.test(url) && /\.mp3(?:$|\?)/i.test(url);
  }).map(item=>({
    type:'track',
    title:cleanText(item.title||item.name||'ANDRIK'),
    album:albumName(item),
    track:cleanText(item.track||''),
    key:String(item.key||''),
    url:String(item.url||'')
  })));

  if(!albums.length)throw new Error('R2 active MP3 library is empty');

  library=albums;
  state.libraryTracks=albums.length;
  state.libraryVideos=0;
  state.lastLibraryRefresh=new Date().toISOString();
  return library;
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
    throw new Error(`R607 ${period} visual missing or too small: ${path}`);
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
    '-i','pipe:0',
    '-map','0:v:0','-map','0:a:0',
    '-c:v','copy',
    '-af','aresample=48000:async=1000:first_pts=0',
    '-c:a','aac','-profile:a','aac_low','-b:a','160k','-ar','48000','-ac','2',
    '-flvflags','no_duration_filesize',
    '-flush_packets','1',
    '-muxdelay','0','-muxpreload','0',
    '-rtmp_live','live',
    '-f','flv',
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

  const vf=[
    'scale=1280:720:force_original_aspect_ratio=decrease',
    'pad=1280:720:(ow-iw)/2:(oh-ih)/2',
    'setsar=1',
    'fps=24',
    `tpad=stop_mode=clone:stop_duration=${Math.ceil(duration)+10}`,
    'format=yuv420p',
    'drawbox=x=0:y=ih-165:w=iw:h=165:color=black@0.56:t=fill',
    'drawbox=x=iw*0.12:y=ih-126:w=iw*0.76:h=56:color=black@0.90:t=fill',
    'drawbox=x=iw*0.12:y=ih-126:w=iw*0.76:h=56:color=yellow@0.55:t=2',
    `drawtext=${fontPart}textfile='${curPath}':fontcolor=yellow:fontsize=36:x=(w-text_w)/2:y=h-116:shadowcolor=black@1:shadowx=2:shadowy=2`,
    'drawbox=x=0:y=ih-52:w=iw:h=52:color=black@0.88:t=fill',
    `drawtext=${fontPart}textfile='${tickerPath}':fontcolor=white:fontsize=25:x='w-mod(t*120,text_w/8+w)':y=h-44:shadowcolor=black@1:shadowx=1:shadowy=1`
  ].join(',');

  const inputArgs=['-hide_banner','-loglevel','warning','-re','-i',item.url,'-stream_loop','-1','-re','-i',visualPath,'-map','1:v:0','-map','0:a:0'];

  return {tempFiles:[currentFile,tickerFile],args:[
    ...inputArgs,
    '-t',duration.toFixed(3),
    '-vf',vf,
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
    '-profile:v','main','-level:v','3.1',
    '-b:v','3000k','-minrate','3000k','-maxrate','3000k','-bufsize','6000k',
    '-x264-params','nal-hrd=cbr:force-cfr=1:repeat-headers=1',
    '-g','48','-keyint_min','48','-sc_threshold','0','-r','24','-threads','2','-pix_fmt','yuv420p',
    '-af','aresample=48000:async=1:first_pts=0',
    '-c:a','aac','-profile:a','aac_low','-b:a','160k','-ar','48000','-ac','2',
    '-output_ts_offset',offset.toFixed(3),'-mpegts_flags','+initial_discontinuity+resend_headers','-f','mpegts','pipe:1'
  ]};
}

async function playItem(previous,item,next,following){
  const duration=await probeDuration(item.url);
  const visualPath=await ensureScheduledVisual();
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  state.producerRunning=true;
  const spec=producerArgs(item,duration,timelineOffset,visualPath,previous,next);
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

  timelineOffset += duration + 0.04;
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  if(!startPublisher())return;

  while(!stopping){
    try{
      const refreshAt=Date.parse(state.lastLibraryRefresh||0);
      if(!library.length || !refreshAt || Date.now()-refreshAt>30*60*1000){
        await loadLibrary();
      }

      if(!queue.length || queueIndex>=queue.length){
        queue=buildQueue();
        queueIndex=0;
      }

      const item=queue[queueIndex];
      const next=queue[queueIndex+1]||queue[0]||null;
      const following=queue[queueIndex+2]||queue[1]||queue[0]||null;
      state.queuePosition=queueIndex+1;

      await playItem(lastPlayed,item,next,following);
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
    visualTimeZone:state.visualTimeZone,
    visualPeriod:state.visualPeriod,
    visualPath:state.visualPath,
    publisherRunning:state.publisherRunning,
    producerRunning:state.producerRunning,
    libraryTracks:state.libraryTracks,
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
  console.log(`ANDRIK Radio R607-DAYPART-MP3-ONLY listening on :${PORT}`);
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
