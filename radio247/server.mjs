import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';

const PORT = Number(process.env.PORT || 8080);
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://andrikmetal.com/api/music/downloads';
const AUDIO_VISUAL = process.env.AUDIO_VISUAL || new URL('./assets/audio-visual-loop-r569-h264.mp4', import.meta.url).pathname;
const STREAM_KEY = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const STREAM_URL = STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '';
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const VISUAL_TRIM_END = Math.max(0, Number(process.env.VISUAL_TRIM_END || '0.55') || 0.55);
const CACHE_DIR = process.env.RADIO_CACHE_DIR || '/tmp/andrik-radio-r573';
const CLEAN_VISUAL = `${CACHE_DIR}/visual-seamless.mp4`;

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R573-SEAMLESS',
  mode: 'MP3 ONLY / SEAMLESS VISUAL + LIVE OVERLAY',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'LIVE TICKER / NO 10s RESET',
  visualTrimEnd: VISUAL_TRIM_END,
  libraryTracks: 0,
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
let cleanVisualPromise = null;

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
  const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R573-SEAMLESS'}});
  if(!response.ok)throw new Error(`R2 library HTTP ${response.status}`);

  const data=await response.json();
  const source=Array.isArray(data.tracks)?data.tracks:[];
  const albums=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    const url=String(item?.url||'');
    return /^albums\//i.test(key) && /^https:\/\//i.test(url) && /\.mp3(?:$|\?)/i.test(url);
  }).map(item=>({
    type:'track',
    title:cleanText(item.title||item.name||'ANDRIK'),
    album:albumName(item),
    track:cleanText(item.track||''),
    key:String(item.key||''),
    url:String(item.url||'')
  })));

  if(!albums.length)throw new Error('R2 album library is empty');
  library=albums;
  state.libraryTracks=albums.length;
  state.lastLibraryRefresh=new Date().toISOString();
  return albums;
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


async function ensureCleanVisual(){
  if(cleanVisualPromise)return cleanVisualPromise;
  cleanVisualPromise=(async()=>{
    prepareCacheDir();
    if(existsSync(CLEAN_VISUAL) && statSync(CLEAN_VISUAL).size>20000)return CLEAN_VISUAL;
    const sourceDuration=await probeDuration(AUDIO_VISUAL);
    const cleanDuration=Math.max(2,sourceDuration-VISUAL_TRIM_END);
    const filter=[
      `[0:v]trim=duration=${cleanDuration.toFixed(3)},setpts=PTS-STARTPTS,fps=24,format=yuv420p,split=2[f][r]`,
      `[r]reverse,setpts=PTS-STARTPTS[rr]`,
      `[f][rr]concat=n=2:v=1:a=0,format=yuv420p[v]`
    ].join(';');
    const args=[
      '-y','-hide_banner','-loglevel','warning','-i',AUDIO_VISUAL,
      '-filter_complex',filter,'-map','[v]','-an',
      '-c:v','libx264','-preset','veryfast','-crf','25',
      '-g','48','-keyint_min','48','-sc_threshold','0',
      '-pix_fmt','yuv420p','-movflags','+faststart',CLEAN_VISUAL
    ];
    await runCapture('ffmpeg',args,{timeoutMs:90000});
    return CLEAN_VISUAL;
  })().catch(error=>{cleanVisualPromise=null;throw error;});
  return cleanVisualPromise;
}

function trackLabel(item,fallback='—'){
  if(!item)return fallback;
  const title=shortText(item.title||'ANDRIK',46);
  const album=shortText(item.album||'',24);
  return album ? `${title} · ${album}` : title;
}

function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }

  const args=[
    '-hide_banner','-loglevel','warning',
    '-fflags','+genpts+discardcorrupt',
    '-i','pipe:0',
    '-map','0:v:0','-map','0:a:0',
    '-c','copy',
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
  const previousFile=`${CACHE_DIR}/prev-live-${key}.txt`;
  const currentFile=`${CACHE_DIR}/current-live-${key}.txt`;
  const nextFile=`${CACHE_DIR}/next-live-${key}.txt`;
  const tickerFile=`${CACHE_DIR}/ticker-live-${key}.txt`;
  writeFileSync(previousFile,`← ${trackLabel(previous,'СТАРТ ЭФИРА')}`,'utf8');
  writeFileSync(currentFile,`▶ СЕЙЧАС: ${trackLabel(item,'ANDRIK')}`,'utf8');
  writeFileSync(nextFile,`${trackLabel(next,'ДАЛЬШЕ — НОВЫЙ ЦИКЛ')} →`,'utf8');
  const unit=`ANDRIK METAL RADIO 24/7   •   СЕЙЧАС: ${trackLabel(item,'ANDRIK')}   •   ДАЛЬШЕ: ${trackLabel(next,'—')}   •   ANDRIKMETAL.COM   •   `;
  writeFileSync(tickerFile,unit.repeat(8),'utf8');
  const font=chooseFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const prevPath=ffFilterPath(previousFile), curPath=ffFilterPath(currentFile), nextPath=ffFilterPath(nextFile), tickerPath=ffFilterPath(tickerFile);
  const vf=[
    'fps=24','format=yuv420p',
    'drawbox=x=0:y=ih-150:w=iw:h=150:color=black@0.58:t=fill',
    `drawtext=${fontPart}textfile='${prevPath}':fontcolor=white@0.92:fontsize=20:x=28:y=h-118:shadowcolor=black@0.8:shadowx=2:shadowy=2`,
    `drawtext=${fontPart}textfile='${curPath}':fontcolor=white:fontsize=25:x=(w-text_w)/2:y=h-100:shadowcolor=black@0.9:shadowx=2:shadowy=2`,
    `drawtext=${fontPart}textfile='${nextPath}':fontcolor=white@0.92:fontsize=20:x=w-text_w-28:y=h-62:shadowcolor=black@0.8:shadowx=2:shadowy=2`,
    'drawbox=x=0:y=ih-34:w=iw:h=34:color=black@0.82:t=fill',
    `drawtext=${fontPart}textfile='${tickerPath}':fontcolor=white:fontsize=19:x=w-mod(t*110\,text_w/8+w):y=h-27:shadowcolor=black@0.9:shadowx=1:shadowy=1`
  ].join(',');
  return {tempFiles:[previousFile,currentFile,nextFile,tickerFile],args:[
    '-hide_banner','-loglevel','warning','-re','-i',item.url,
    '-stream_loop','-1','-re','-i',visualPath,
    '-map','1:v:0','-map','0:a:0','-t',duration.toFixed(3),
    '-vf',vf,
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-crf','30',
    '-maxrate','1800k','-bufsize','3600k','-g','48','-keyint_min','48','-sc_threshold','0','-threads','2','-pix_fmt','yuv420p',
    '-c:a','aac','-b:a','128k','-ar','44100','-ac','2',
    '-output_ts_offset',offset.toFixed(3),'-mpegts_flags','+initial_discontinuity','-f','mpegts','pipe:1'
  ]};
}


async function playItem(previous,item,next,following){
  const duration=await probeDuration(item.url);
  const visualPath=await ensureCleanVisual();
  state.previous=previous?{type:'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.current={type:'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date().toISOString(),duration};
  state.next=next?{type:'track',title:next.title,album:next.album||'',url:next.url||''}:null;
  state.producerRunning=true;
  const spec=producerArgs(item,duration,timelineOffset,visualPath,previous,next);
  producer=spawn('ffmpeg',spec.args,{stdio:['ignore','pipe','pipe']});
  producer.stderr.on('data',d=>{const line=String(d||'').trim();if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid/i.test(line))state.lastError=line.slice(-700);console.error('[producer]',line);}});
  try{
    await new Promise((resolve,reject)=>{
      if(!publisher?.stdin)return reject(new Error('publisher stdin unavailable'));
      producer.stdout.pipe(publisher.stdin,{end:false});
      producer.once('error',reject);
      producer.once('exit',(code,signal)=>{state.producerRunning=false;producer=null;if(code===0||signal==='SIGTERM')resolve();else reject(new Error(`producer exit ${code||signal}`));});
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
    visualTrimEnd:state.visualTrimEnd,
    publisherRunning:state.publisherRunning,
    producerRunning:state.producerRunning,
    libraryTracks:state.libraryTracks,
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
      tracks:library.length,
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
  console.log(`ANDRIK Radio R573-SEAMLESS listening on :${PORT}`);
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
