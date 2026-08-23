import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://andrikmetal.com/api/music/downloads';
const AUDIO_VISUAL = process.env.AUDIO_VISUAL || '/app/assets/audio-visual-loop-r566.webm';
const STREAM_KEY = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const STREAM_URL = STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '';
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const TICKER_FILE = '/tmp/andrik-radio-ticker.txt';


const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R568',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  libraryTracks: 0,
  playbackMode: 'MP3 ONLY',
  cycle: 0,
  queueLength: 0,
  queuePosition: 0,
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
let titleSerial = 0;

fs.writeFileSync(TICKER_FILE, 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   YOUTUBE   •   SPOTIFY   •   APPLE MUSIC   •   AMAZON MUSIC   •   NEW MUSIC • MP3 RADIO • RU / EN', 'utf8');


function ensureLocalVisuals(){
  if(!fs.existsSync(AUDIO_VISUAL)||fs.statSync(AUDIO_VISUAL).size<1000)throw new Error('audio visual loop missing');
}

function shuffle(items){
  const list=[...items];
  for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list;
}
function cleanText(value){return String(value||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();}
function uniqueByUrl(items){const seen=new Set();return items.filter(item=>{if(!item.url||seen.has(item.url))return false;seen.add(item.url);return true;});}
function albumName(item){
  const album=cleanText(item.album||'');
  if(album)return album;
  const key=String(item.key||'');
  const m=/^albums\/([^/]+)\//i.exec(key);
  return m?m[1].replace(/[_-]+/g,' '):'ANDRIK';
}

async function loadLibrary(){
  const url=`${PLAYLIST_URL}${PLAYLIST_URL.includes('?')?'&':'?'}ts=${Date.now()}`;
  const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R568'}});
  if(!response.ok)throw new Error(`R2 library HTTP ${response.status}`);
  const data=await response.json();
  const source=Array.isArray(data.tracks)?data.tracks:[];
  const albums=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    const url=String(item?.url||'');
    return /^albums\//i.test(key)&&/^https:\/\//i.test(url)&&/\.mp3(?:$|\?)/i.test(url);
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
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error(`${command} timeout`));},timeoutMs);
    child.stdout.on('data',d=>out+=String(d));
    child.stderr.on('data',d=>err+=String(d));
    child.once('error',e=>{clearTimeout(timer);reject(e);});
    child.once('exit',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error(`${command} exit ${code}: ${err.slice(-500)}`));});
  });
}

async function probeMedia(item){
  const raw=await runCapture('ffprobe',['-v','error','-show_entries','format=duration:stream=index,codec_type','-of','json',item.url],{timeoutMs:25000});
  const data=JSON.parse(raw||'{}');
  const duration=Math.max(1,Number(data?.format?.duration||0));
  const streams=Array.isArray(data?.streams)?data.streams:[];
  return {duration,hasVideo:streams.some(s=>s.codec_type==='video'),hasAudio:streams.some(s=>s.codec_type==='audio')};
}

function writeTextFile(prefix,text){
  const path=`/tmp/${prefix}-${process.pid}-${++titleSerial}.txt`;
  fs.writeFileSync(path,cleanText(text),'utf8');
  return path;
}

function audioProducerArgs(item,probe,offset){
  const titleFile=writeTextFile('title',item.title);
  const subFile=writeTextFile('sub',`${item.album}${item.track?` • TRACK ${item.track}`:''}`);
  const duration=probe.duration.toFixed(3);
  const filter=`[1:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,format=yuv420p[bg];`+
    `[bg]drawbox=x=0:y=568:w=1280:h=104:color=black@0.52:t=fill[tmp];`+
    `[tmp]drawtext=fontfile=${FONT_BOLD}:text='NOW PLAYING':x=42:y=582:fontsize=19:fontcolor=0x8ed8ff:shadowx=2:shadowy=2[tmp2];`+
    `[tmp2]drawtext=fontfile=${FONT_BOLD}:textfile=${titleFile}:x=42:y=610:fontsize=34:fontcolor=white:shadowx=2:shadowy=2[tmp3];`+
    `[tmp3]drawtext=fontfile=${FONT}:textfile=${subFile}:x=780:y=620:fontsize=19:fontcolor=0xd5deea:shadowx=2:shadowy=2[tmp4];`+
    `[tmp4]drawbox=x=0:y=672:w=1280:h=48:color=black@0.76:t=fill[tmp5];`+
    `[tmp5]drawtext=fontfile=${FONT_BOLD}:textfile=${TICKER_FILE}:x=w-mod(t*125\,w+tw):y=685:fontsize=21:fontcolor=white[v]`;
  return [
    '-hide_banner','-loglevel','warning','-re','-i',item.url,
    '-stream_loop','-1','-i',AUDIO_VISUAL,
    '-filter_complex',filter,
    '-map','[v]','-map','0:a:0',
    '-t',duration,'-shortest',
    '-r','30','-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-profile:v','main','-level','3.1','-pix_fmt','yuv420p','-b:v','2600k','-maxrate','3200k','-bufsize','5200k','-g','60','-keyint_min','60',
    '-c:a','aac','-b:a','160k','-ar','44100','-ac','2',
    '-output_ts_offset',offset.toFixed(3),'-mpegts_flags','+initial_discontinuity','-f','mpegts','pipe:1'
  ];
}

function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured yet';
    setTimeout(()=>process.exit(21),60000).unref();
    return false;
  }
  const args=['-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-i','pipe:0','-map','0:v:0','-map','0:a:0','-c','copy','-f','flv',STREAM_URL];
  publisher=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});
  state.publisherRunning=true;
  state.streamStartedAt=new Date().toISOString();
  publisher.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe/i.test(line))state.lastError=line.slice(-700);console.error('[publisher]',line);}
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

async function playItem(item,next){
  const probe=await probeMedia(item);
  state.current={type:item.type,title:item.title,album:item.album||'',label:item.label||'',url:item.url,startedAt:new Date().toISOString(),duration:probe.duration};
  state.next=next?{type:next.type,title:next.title,album:next.album||'',label:next.label||''}:null;
  state.producerRunning=true;
  const args=audioProducerArgs(item,probe,timelineOffset);
  producer=spawn('ffmpeg',args,{stdio:['ignore','pipe','pipe']});
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid/i.test(line))state.lastError=line.slice(-700);console.error('[producer]',line);}
  });
  const pipePromise=new Promise((resolve,reject)=>{
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
  await pipePromise;
  timelineOffset += probe.duration + 0.04;
}

async function radioLoop(){
  if(running)return;
  running=true;
  try{ensureLocalVisuals();}catch(error){state.lastError=String(error);setTimeout(()=>process.exit(23),60000).unref();return;}
  if(!startPublisher())return;
  while(!stopping){
    try{
      if(!library.length||Date.now()-Date.parse(state.lastLibraryRefresh||0)>30*60*1000)await loadLibrary();
      if(!queue.length||queueIndex>=queue.length){queue=buildQueue();queueIndex=0;}
      const item=queue[queueIndex];
      const next=queue[queueIndex+1]||null;
      state.queuePosition=queueIndex+1;
      await playItem(item,next);
      queueIndex++;
      state.lastError='';
    }catch(error){
      state.lastError=String(error?.stack||error).slice(-1200);
      console.error('[radio]',error);
      if(producer&&producer.exitCode===null)producer.kill('SIGTERM');
      producer=null;state.producerRunning=false;
      await new Promise(r=>setTimeout(r,5000));
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
    publisherRunning:state.publisherRunning,
    producerRunning:state.producerRunning,
    libraryTracks:state.libraryTracks,
    playbackMode:state.playbackMode,
    cycle:state.cycle,
    queueLength:state.queueLength,
    queuePosition:state.queuePosition,
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

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'};
  if(url.pathname==='/'||url.pathname==='/health'||url.pathname==='/status'){
    res.writeHead(200,headers);res.end(JSON.stringify(publicStatus()));return;
  }
  if(url.pathname==='/library'){
    res.writeHead(200,headers);res.end(JSON.stringify({ok:true,tracks:library.length,mode:'MP3 ONLY',current:state.current,next:state.next}));return;
  }
  res.writeHead(404,headers);res.end(JSON.stringify({ok:false,error:'not-found'}));
});

server.listen(PORT,'0.0.0.0',()=>{console.log(`ANDRIK Radio R568 listening on :${PORT}`);radioLoop();});

function shutdown(){
  stopping=true;
  if(producer&&producer.exitCode===null)producer.kill('SIGTERM');
  if(publisher&&publisher.exitCode===null)publisher.kill('SIGTERM');
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),5000).unref();
}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
