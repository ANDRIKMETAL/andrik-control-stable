#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import {spawn,spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const CONFIG='/etc/andrik-radio-web-r627.json';
const AGENT_VERSION_R803='R803';
const DIAG_DIR_R803='/var/cache/andrik-radio-r622/diagnostics';
const DIAG_AGENT_LOG_R803=DIAG_DIR_R803+'/r803-agent-events.ndjson';
const DIAG_AGENT_MAX_BYTES_R803=1024*1024;
const DIAG_AGENT_RING_LIMIT_R803=12;
const CONFIG_CANDIDATES=[CONFIG,'/etc/andrik-radio-web.json','/etc/andrik-radio-web-r629.json','/etc/andrik-radio-web-r630.json','/etc/andrik-radio-web-r631.json'];
const TICKER_FILE='/var/cache/andrik-radio-r622/live-ticker.txt';
const VISUAL_DIR='/var/cache/andrik-radio-r622/visuals';
const VISUAL_PROTECT_FILES=[`${VISUAL_DIR}/.protect-local-visuals-r656`,`${VISUAL_DIR}/.protect-local-visuals-r655`];
function visualsProtected(){return VISUAL_PROTECT_FILES.some(path=>fs.existsSync(path));}
const RADIO_ENV='/etc/andrik-radio.env';
const VISUAL_MANUAL_MARKER='/var/cache/andrik-radio-r622/visuals/.manual-visual-r658';
const VISUAL_AUTO_R658='/usr/local/sbin/andrik-visual-auto-r703';
const VISUAL_FILES=Object.freeze({morning:'stream-morning-master-r703.mp4',day:'stream-day-master-r620.mp4',evening:'stream-evening-master-r620.mp4',night:'stream-night-master-r620.mp4'});
const DEFAULT_TICKER='ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';
const BASE=process.env.ANDRIK_CONTROL_BASE||'https://andrikmetal.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').trim();
let agentDiagRingR803=[];
let previousObservedR803=null;
let lastIncidentFingerprintR803='';
let lastIncidentAtR803=0;
function diagSanitizeR803(value,max=1400){
  let text=String(value??'').replace(/[\r\t]+/g,' ').replace(/\n+/g,' | ').replace(/\s+/g,' ').trim();
  text=text.replace(/rtmps:\/\/[^\s"']+/gi,'rtmps://[redacted]');
  text=text.replace(/(?:Bearer\s+)[A-Za-z0-9._~+\/-]+/gi,'Bearer [redacted]');
  text=text.replace(/\/var\/cache\/andrik-radio-r622\/[^\s"']+/g,m=>'<cache>/'+m.split('/').pop());
  text=text.replace(/\/opt\/andrik-radio\/[^\s"']+/g,m=>'<app>/'+m.split('/').pop());
  return text.slice(0,max);
}
function loadAgentDiagR803(){
  try{
    if(!fs.existsSync(DIAG_AGENT_LOG_R803))return;
    const lines=fs.readFileSync(DIAG_AGENT_LOG_R803,'utf8').trim().split(/\n+/).slice(-DIAG_AGENT_RING_LIMIT_R803);
    agentDiagRingR803=lines.map(x=>{try{return JSON.parse(x)}catch(_){return null}}).filter(Boolean);
  }catch(_){}
}
function appendAgentDiagR803(event,data={}){
  try{
    fs.mkdirSync(DIAG_DIR_R803,{recursive:true});
    const safe={};
    for(const [k,v] of Object.entries(data||{})){
      if(v===null||v===undefined||typeof v==='boolean'||typeof v==='number')safe[k]=v;
      else safe[k]=diagSanitizeR803(v,k==='journal'?1600:900);
    }
    const rec={at:new Date().toISOString(),event:diagSanitizeR803(event,80),agentPid:process.pid,...safe};
    agentDiagRingR803.push(rec);
    if(agentDiagRingR803.length>DIAG_AGENT_RING_LIMIT_R803)agentDiagRingR803=agentDiagRingR803.slice(-DIAG_AGENT_RING_LIMIT_R803);
    try{
      if(fs.existsSync(DIAG_AGENT_LOG_R803)&&fs.statSync(DIAG_AGENT_LOG_R803).size>DIAG_AGENT_MAX_BYTES_R803){
        try{fs.unlinkSync(DIAG_AGENT_LOG_R803+'.previous')}catch(_){}
        fs.renameSync(DIAG_AGENT_LOG_R803,DIAG_AGENT_LOG_R803+'.previous');
      }
    }catch(_){}
    fs.appendFileSync(DIAG_AGENT_LOG_R803,JSON.stringify(rec)+'\n','utf8');
    return rec;
  }catch(_){return null}
}
function snapshotR803(status,reason){
  const ff=run('ps',['-C','ffmpeg','-o','pid=,ppid=,%cpu=,%mem=,stat=,etime=','--sort=-%cpu'],10000);
  const svc=run('systemctl',['show','andrik-radio.service','-p','MainPID','-p','TasksCurrent','-p','MemoryCurrent','-p','CPUUsageNSec','--no-pager'],10000);
  const journal=run('journalctl',['-u','andrik-radio.service','--since','-25 seconds','--no-pager','-o','short-iso','-n','60'],12000);
  return {
    reason,
    service:status?.service||'',producer:Boolean(status?.producer),publisher:Boolean(status?.publisher),
    videoFeederRunning:Boolean(status?.videoFeederRunning),clipActive:Boolean(status?.clipActive),
    current:status?.current||'',next:status?.next||'',rtmps:Number(status?.rtmpsEstablishedConnectionsR792||0),
    transportHealthy:status?.transportHealthy!==false,lastError:status?.lastError||'',lastFfmpegLine:status?.lastFfmpegLine||'',
    load:run('uptime',[],8000).output,ffmpeg:ff.output,serviceStats:svc.output,journal:journal.output
  };
}
function mergeDiagnosticsR803(serverDiag){
  const server=serverDiag&&typeof serverDiag==='object'?serverDiag:{};
  const serverEvents=Array.isArray(server.events)?server.events:[];
  const all=[...serverEvents,...agentDiagRingR803]
    .filter(x=>x&&x.at)
    .sort((a,b)=>String(a.at).localeCompare(String(b.at)))
    .slice(-30);
  return {version:'R803',lastEventAt:all.at(-1)?.at||server.lastEventAt||null,latest:all.at(-1)||server.latest||null,events:all,logFile:'r803-agent-events.ndjson + r802-events.ndjson'};
}
function observeStatusR803(status){
  const prev=previousObservedR803;
  const err=clean(status?.lastError||'');
  const ff=clean(status?.lastFfmpegLine||'');
  const severe=/visual feeder exit|packet corrupt|invalid nal|missing picture|corrupt input|broken pipe|non-monoton|timestamp|restart|ffmpeg/i.test(err+' '+ff);
  const stateDrop=Boolean(prev)&&(prev.publisher&&!status.publisher||prev.producer&&!status.producer||prev.videoFeederRunning&&!status.videoFeederRunning||prev.service==='active'&&status.service!=='active');
  const changedError=Boolean(err)&&(!prev||err!==prev.lastError);
  if((severe&&changedError)||stateDrop){
    const reason=stateDrop?'runtime-state-drop':'error-change';
    const fingerprint=[reason,err,ff,status?.service,status?.publisher,status?.producer,status?.videoFeederRunning].join('|');
    const now=Date.now();
    if(fingerprint!==lastIncidentFingerprintR803||now-lastIncidentAtR803>30000){
      appendAgentDiagR803('agent-incident',snapshotR803(status,reason));
      lastIncidentFingerprintR803=fingerprint;lastIncidentAtR803=now;
    }
  }
  previousObservedR803={service:status?.service||'',publisher:Boolean(status?.publisher),producer:Boolean(status?.producer),videoFeederRunning:Boolean(status?.videoFeederRunning),lastError:err,lastFfmpegLine:ff};
  const merged=mergeDiagnosticsR803(status?.diagnosticsR802);
  status.diagnosticsR803=merged;
  status.diagnosticsR802=merged; // backward-compatible public R802 endpoint until site deploy catches up
  return status;
}
loadAgentDiagR803();
let busy=null;
let lastYoutubeEnsureAtR721=0;

async function maybeEnsureYoutubeLiveR721(headers,status){
  if(!status || status.service!=='active' || !status.publisher)return null;
  const now=Date.now();
  // R720: check YouTube LIVE every ~60 s while the encoder is publishing, so the public LIVE badge
  // is recovered quickly after a transient YouTube/API state drop.
  if(now-lastYoutubeEnsureAtR721<60000)return null;
  lastYoutubeEnsureAtR721=now;
  try{
    const d=await jsonFetch(BASE+'/api/radio-agent-r721/youtube-ensure',{method:'POST',headers,body:'{}'});
    const live=Boolean(d?.active)||String(d?.lifeCycleStatus||'').toLowerCase()==='live';
    if(!live && d?.pending)lastYoutubeEnsureAtR721=Date.now()-40000; // retry in ~20 s while YouTube moves CREATED/READY/TESTING -> LIVE
    if(d?.recovered || !live || d?.ok===false){
      console.log(new Date().toISOString(),'YouTube LIVE self-heal:',JSON.stringify(d));
    }
    return d;
  }catch(e){
    lastYoutubeEnsureAtR721=Date.now()-40000; // retry in ~20 s after temporary Control/API failure
    console.error(new Date().toISOString(),'YouTube LIVE self-heal:',e.message||e);
    return null;
  }
}

function migrateConfig(){
  if(fs.existsSync(CONFIG))return;
  for(const candidate of CONFIG_CANDIDATES.slice(1)){
    try{const d=JSON.parse(fs.readFileSync(candidate,'utf8'));if(clean(d?.token)){fs.copyFileSync(candidate,CONFIG);fs.chmodSync(CONFIG,0o600);return;}}catch(_){}
  }
}
function readConfig(){migrateConfig();try{return JSON.parse(fs.readFileSync(CONFIG,'utf8'))}catch(_){return {}}}
function writeConfig(data){fs.writeFileSync(CONFIG,JSON.stringify(data,null,2)+'\n',{mode:0o600});try{fs.chmodSync(CONFIG,0o600)}catch(_){}}
async function jsonFetch(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(clean(d.error||d.message||`HTTP ${r.status}`));return d}
async function localControlR721(path){return jsonFetch('http://127.0.0.1:8080'+path,{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-Radio-Web-Agent-R803'}})}
function run(cmd,args=[],timeout=30000){const r=spawnSync(cmd,args,{encoding:'utf8',timeout,maxBuffer:1024*1024*2});const out=[r.stdout,r.stderr].filter(Boolean).join('\n').trim();return {ok:r.status===0,output:out||`${cmd} exit ${r.status}`,status:r.status};}
function runAsync(cmd,args=[],timeout=240000){
  return new Promise(resolve=>{
    const child=spawn(cmd,args,{stdio:['ignore','pipe','pipe']});
    let out='',err='',done=false;
    const finish=(ok,status)=>{if(done)return;done=true;clearTimeout(timer);resolve({ok,output:[out,err].filter(Boolean).join('\n').trim()||`${cmd} exit ${status}`,status});};
    const timer=setTimeout(()=>{try{child.kill('SIGTERM')}catch(_){};setTimeout(()=>{try{child.kill('SIGKILL')}catch(_){}},2500).unref();finish(false,'timeout');},timeout);
    child.stdout.on('data',d=>{out=(out+String(d)).slice(-150000)});
    child.stderr.on('data',d=>{err=(err+String(d)).slice(-150000)});
    child.once('error',e=>finish(false,e.code||1));
    child.once('exit',(code,signal)=>finish(code===0,code??signal??1));
  });
}
function currentTicker(){try{return clean(fs.readFileSync(TICKER_FILE,'utf8'))}catch(_){return DEFAULT_TICKER}}
function writeTicker(text){const value=clean(text).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').slice(0,240).trim();fs.mkdirSync('/var/cache/andrik-radio-r622',{recursive:true});const tmp=TICKER_FILE+'.tmp';fs.writeFileSync(tmp,value,'utf8');fs.renameSync(tmp,TICKER_FILE);return value;}
async function localStatus(){
  try{
    const r=await fetch('http://127.0.0.1:8080/status',{signal:AbortSignal.timeout(2500)});const d=await r.json();const c=d.current||{},n=d.next||{};
    const status={service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:Boolean(d.producerRunning),publisher:Boolean(d.publisherRunning),videoFeederRunning:Boolean(d.videoFeederRunning),clipActive:Boolean(d.clipActive),current:c.title||'',next:n.title||'',audio:d.audioMode||'',version:d.version||'',visualPeriod:d.visualPeriod||'',visualPath:d.visualPath||'',forceVisualSlot:d.forceVisualSlot||'',visualAutoSchedule:Boolean(d.visualAutoSchedule),visualProtected:visualsProtected(),lastError:clean(d.lastError||''),lastFfmpegLine:clean(d.lastFfmpegLine||''),lastExit:d.lastExit||null,diagnosticsR802:d.diagnosticsR802||null,rtmpsEstablishedConnectionsR792:Number(d.rtmpsEstablishedConnectionsR792||0),transportHealthy:d.transportHealthy!==false,streamStartedAt:d.streamStartedAt||'',libraryTracks:Number(d.libraryTracks||0),libraryAlbumTracks:Number(d.libraryAlbumTracks||0),librarySingleTracks:Number(d.librarySingleTracks||0),duplicateSinglesSkipped:Number(d.duplicateSinglesSkipped||0),libraryVideos:Number(d.libraryVideos||0),libraryBumpers:Number(d.libraryBumpers||0),librarySpecial:Number(d.librarySpecial||0),librarySpecial30:Number(d.librarySpecial30||0),librarySpecial60:Number(d.librarySpecial60||0),lastLibraryRefresh:d.lastLibraryRefresh||'',inventoryTelemetry:'R805-LIVE-LIBRARY-COUNTERS',ticker:currentTicker(),busy:busy?{id:busy.id,action:busy.action,since:busy.since}:null};
    return observeStatusR803(status);
  }catch(error){
    const status={service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:false,publisher:false,videoFeederRunning:false,clipActive:false,current:'',next:'',libraryTracks:0,libraryAlbumTracks:0,librarySingleTracks:0,duplicateSinglesSkipped:0,libraryVideos:0,libraryBumpers:0,librarySpecial:0,librarySpecial30:0,librarySpecial60:0,lastLibraryRefresh:'',inventoryTelemetry:'R805-LIVE-LIBRARY-COUNTERS',ticker:currentTicker(),busy:busy?{id:busy.id,action:busy.action,since:busy.since}:null,error:'local-status-unavailable',lastError:clean(error?.message||error),lastFfmpegLine:'',diagnosticsR802:null,rtmpsEstablishedConnectionsR792:0,transportHealthy:false};
    return observeStatusR803(status);
  }
}
async function pair(code){code=clean(code).toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<8)throw new Error('Нужен короткий аварийный код привязки.');const d=await jsonFetch(BASE+'/api/radio-agent-r627/pair/consume',{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-Radio-Web-Agent-R803'},body:JSON.stringify({code})});writeConfig({token:d.token,pairedAt:new Date().toISOString(),base:BASE,version:AGENT_VERSION_R803});console.log('ГОТОВО ✅ OVH привязан.');}
function normalizeSlot(value){const slot=clean(value).toLowerCase();return Object.prototype.hasOwnProperty.call(VISUAL_FILES,slot)?slot:'';}
function updateForceVisualSlot(slot=''){
  slot=normalizeSlot(slot);
  let src='';try{src=fs.readFileSync(RADIO_ENV,'utf8')}catch(_){}
  const lines=src.split(/\r?\n/).filter(line=>!/^\s*FORCE_VISUAL_SLOT\s*=/.test(line));
  if(slot)lines.push(`FORCE_VISUAL_SLOT=${slot}`);
  const tmp=RADIO_ENV+'.r650.tmp';
  fs.writeFileSync(tmp,lines.filter((x,i,a)=>i<a.length-1||x!=='').join('\n').replace(/\n*$/,'')+'\n',{mode:0o600});
  fs.renameSync(tmp,RADIO_ENV);try{fs.chmodSync(RADIO_ENV,0o600)}catch(_){}
  return slot;
}
function updateVisualAutoScheduleR658(enabled){
  let src='';try{src=fs.readFileSync(RADIO_ENV,'utf8')}catch(_){}
  const lines=src.split(/\r?\n/).filter(line=>!/^\s*VISUAL_AUTO_SCHEDULE_R658\s*=/.test(line));
  lines.push(`VISUAL_AUTO_SCHEDULE_R658=${enabled?'1':'0'}`);
  const tmp=RADIO_ENV+'.r658-auto.tmp';
  fs.writeFileSync(tmp,lines.filter((x,i,a)=>i<a.length-1||x!=='').join('\n').replace(/\n*$/,'')+'\n',{mode:0o600});
  fs.renameSync(tmp,RADIO_ENV);try{fs.chmodSync(RADIO_ENV,0o600)}catch(_){}
}
function localVisualInfo(slot){
  slot=normalizeSlot(slot);if(!slot)return null;
  const final=`${VISUAL_DIR}/${VISUAL_FILES[slot]}`;
  try{
    const st=fs.statSync(final);if(st.size<2*1024*1024)return null;
    const probe=run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,display_aspect_ratio','-of','default=nw=1',final],20000);
    if(!probe.ok)return null;
    return {slot,size:st.size,probe:probe.output,path:final,kept:true};
  }catch(_){return null;}
}
async function downloadVisualR650(slot,headers,{force=false}={}){
  slot=normalizeSlot(slot);if(!slot)throw new Error('invalid visual slot');
  fs.mkdirSync(VISUAL_DIR,{recursive:true});
  const existing=localVisualInfo(slot);
  // R658: normal sync/bootstrap MUST NOT replace any working local MORNING/DAY/EVENING/NIGHT master.
  // Only an explicit "visual-now" request may force a replacement.
  if(!force && visualsProtected() && existing)return existing;
  const final=`${VISUAL_DIR}/${VISUAL_FILES[slot]}`;const tmp=`${final}.r658-${process.pid}-${Date.now()}.part`;
  const r=await fetch(`${BASE}/api/radio-agent-r650/visual?slot=${encodeURIComponent(slot)}&download=1`,{headers:{authorization:headers.authorization,'user-agent':'ANDRIK-Radio-Web-Agent-R803'},signal:AbortSignal.timeout(180000)});
  if(!r.ok){
    if(slot==='morning' && r.status===404)return {slot,size:0,probe:'not assigned yet · DAY fallback 06:00-12:00',path:final,kept:true,optional:true};
    throw new Error(`R2 ${slot}: HTTP ${r.status}`);
  }
  if(!r.body)throw new Error(`R2 ${slot}: empty body`);
  try{
    await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(tmp,{mode:0o600}));
    const st=fs.statSync(tmp);if(st.size<2*1024*1024)throw new Error(`R2 ${slot}: file too small (${st.size})`);
    const probe=run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,display_aspect_ratio','-of','default=nw=1',tmp],20000);
    if(!probe.ok)throw new Error(`R2 ${slot}: ffprobe failed`);
    fs.renameSync(tmp,final);return {slot,size:st.size,probe:probe.output,path:final,kept:false};
  }catch(e){try{fs.unlinkSync(tmp)}catch(_){}throw e;}
}
async function syncVisualsR650(headers){const out=[];for(const slot of ['morning','day','evening','night'])out.push(await downloadVisualR650(slot,headers,{force:false}));return out;}
async function execute(action,command={},headers={}){
  // R665 OVH-native control. No /usr/local/sbin/andrik-youtube dependency.
  if(action==='encoder-stop'||action==='stop'){
    const r=await runAsync('systemctl',['stop','andrik-radio.service'],90000);
    return {ok:r.ok,output:`OVH ENCODER STOP ${r.ok?'✅':'❌'}\n${r.output}`};
  }
  if(action==='encoder-start'||action==='start'){
    const r=await runAsync('systemctl',['start','andrik-radio.service'],90000);
    return {ok:r.ok,output:`OVH ENCODER START ${r.ok?'✅':'❌'}\n${r.output}`};
  }
  if(action==='recover'||action==='restart'||action==='auto-safe'){
    const r=await runAsync('systemctl',['restart','andrik-radio.service'],90000);
    return {ok:r.ok,output:`OVH ENCODER RESTART ${r.ok?'✅':'❌'}\n${r.output}`};
  }
  if(action==='full-fit'){
    try{
      const d=await localControlR721('/control/full-fit');
      return {ok:true,output:`FULL FRAME FIT / NO CROP ✅\nR721 feeder reloaded · RTMPS publisher NOT restarted\n${JSON.stringify(d)}`};
    }catch(e){return {ok:false,output:`FULL FRAME FIT ❌\n${e.message||e}`};}
  }
  if(action==='status'){
    const svc=run('systemctl',['is-active','andrik-radio.service'],10000);
    let local='';
    try{local=JSON.stringify(await localStatus(),null,2)}catch(e){local=String(e?.message||e)}
    return {ok:/^active$/m.test(svc.output.trim()),output:`OVH RADIO STATUS\nservice: ${svc.output.trim()}\n\n${local}`};
  }
  if(action==='visual-sync'){
    const rows=await syncVisualsR650(headers);
    return {ok:true,output:'VISUAL SYNC OK ✅\n'+rows.map(x=>`${x.slot}: ${(x.size/1024/1024).toFixed(1)} MB · ${x.probe.replace(/\n/g,' · ')}`).join('\n')};
  }
  if(action==='visual-now'){
    const slot=normalizeSlot(command.slot);if(!slot)return {ok:false,output:'Неверный visual slot'};
    const x=await downloadVisualR650(slot,headers,{force:true});
    try{fs.mkdirSync(VISUAL_DIR,{recursive:true});fs.writeFileSync(VISUAL_MANUAL_MARKER,slot+'\n',{mode:0o600})}catch(_){}
    updateVisualAutoScheduleR658(false);
    updateForceVisualSlot(slot);
    try{
      const d=await localControlR721(`/control/visual-now?slot=${encodeURIComponent(slot)}`);
      return {ok:true,output:`VISUAL NOW ${slot.toUpperCase()} ✅ · MANUAL MODE\n${(x.size/1024/1024).toFixed(1)} MB\n${x.probe}\n\nRTMPS НЕ ПЕРЕЗАПУСКАЛСЯ · ${JSON.stringify(d)}`};
    }catch(e){return {ok:false,output:`VISUAL NOW ${slot.toUpperCase()} ❌\n${e.message||e}`};}
  }
  if(action==='visual-auto'){
    try{fs.unlinkSync(VISUAL_MANUAL_MARKER)}catch(_){}
    updateVisualAutoScheduleR658(true);
    updateForceVisualSlot('');
    try{
      const d=await localControlR721('/control/visual-auto');
      return {ok:true,output:`VISUAL AUTO R721 ✅\nMORNING/DAY/EVENING/NIGHT switches inside the live feeder · RTMPS stays open\n${JSON.stringify(d)}`};
    }catch(e){return {ok:false,output:`VISUAL AUTO R721 ❌\n${e.message||e}`};}
  }
  return {ok:false,output:'Неизвестная команда: '+action};
}
async function submitResult(headers,id,result){
  const after=await localStatus();
  await jsonFetch(BASE+'/api/radio-agent-r627/result',{method:'POST',headers,body:JSON.stringify({id,ok:result.ok,output:result.output,status:after})});
}
async function daemon(){
  appendAgentDiagR803('agent-r803-start',{agentVersion:AGENT_VERSION_R803,serviceUnit:process.env.SYSTEMD_UNIT||''});
  while(true){
    try{
      const cfg=readConfig();
      if(!cfg.token){console.error(new Date().toISOString(),'agent: paired token not found; waiting');await sleep(10000);continue;}
      const headers={'content-type':'application/json','authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R803'};
      const status=await localStatus();
      // Heartbeat always continues, even while start/recover is running.
      const d=await jsonFetch(BASE+'/api/radio-agent-r627/poll',{method:'POST',headers,body:JSON.stringify({version:AGENT_VERSION_R803,status})});
      if(d.ticker && typeof d.ticker.text==='string' && clean(d.ticker.text)!==clean(status.ticker))writeTicker(d.ticker.text);
      await maybeEnsureYoutubeLiveR721(headers,status);
      if(d.command && !busy){
        const {id,action}=d.command;
        busy={id,action,since:new Date().toISOString()};
        console.log(new Date().toISOString(),'command start',action,id);
        execute(action,d.command,headers).then(async result=>{
          try{await submitResult(headers,id,result);console.log(new Date().toISOString(),'command end',action,result.ok?'OK':'ERROR')}catch(e){console.error(new Date().toISOString(),'result:',e.message||e)}finally{busy=null;}
        }).catch(e=>{console.error(new Date().toISOString(),'command:',e.message||e);busy=null;});
      }
    }catch(e){console.error(new Date().toISOString(),'agent:',e.message||e)}
    await sleep(4000);
  }
}
async function bootstrapVisuals(){
  const cfg=readConfig();if(!cfg.token)throw new Error('OVH agent token not found — R627 pairing is required');
  const headers={'authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R803'};
  const rows=await syncVisualsR650(headers);
  let d;
  if(fs.existsSync(VISUAL_MANUAL_MARKER)){
    let slot='';try{slot=normalizeSlot(fs.readFileSync(VISUAL_MANUAL_MARKER,'utf8'))}catch(_){}
    d=slot?await localControlR721(`/control/visual-now?slot=${encodeURIComponent(slot)}`):await localControlR721('/control/visual-auto');
  }else d=await localControlR721('/control/visual-auto');
  console.log('R2 VISUALS ✅',rows.map(x=>`${x.slot} ${(x.size/1024/1024).toFixed(1)}MB${x.kept?' KEEP':''}`).join(' · '));
  console.log('R721 runtime switch ✅',JSON.stringify(d));
}
async function main(){
  const cmd=clean(process.argv[2]||'status').toLowerCase();
  if(cmd==='pair')return pair(process.argv[3]);
  if(cmd==='daemon')return daemon();
  if(cmd==='bootstrap-visuals')return bootstrapVisuals();
  if(cmd==='visual-now' || cmd==='visual-auto' || cmd==='visual-sync'){
    const cfg=readConfig();if(!cfg.token)throw new Error('OVH agent token not found — pairing is required');
    const headers={'content-type':'application/json','authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R803'};
    const result=await execute(cmd,{slot:process.argv[3]||''},headers);
    console.log(result.output);if(!result.ok)process.exitCode=4;return;
  }
  if(cmd==='status'){const cfg=readConfig();console.log(cfg.token?'PAIRED ✅':'NOT PAIRED ❌');console.log(await localStatus());return}
  console.log('ANDRIK Radio Web Agent R803 · commands: daemon | status | bootstrap-visuals | visual-sync | visual-now <morning|day|evening|night> | visual-auto');
}
main().catch(e=>{console.error('ОШИБКА:',e.message||e);process.exitCode=1});
