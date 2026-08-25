#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import {spawn,spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const CONFIG='/etc/andrik-radio-web-r627.json';
const CONFIG_CANDIDATES=[CONFIG,'/etc/andrik-radio-web.json','/etc/andrik-radio-web-r629.json','/etc/andrik-radio-web-r630.json','/etc/andrik-radio-web-r631.json'];
const TICKER_FILE='/var/cache/andrik-radio-r622/live-ticker.txt';
const VISUAL_DIR='/var/cache/andrik-radio-r622/visuals';
const VISUAL_PROTECT_FILES=[`${VISUAL_DIR}/.protect-local-visuals-r656`,`${VISUAL_DIR}/.protect-local-visuals-r655`];
function visualsProtected(){return VISUAL_PROTECT_FILES.some(path=>fs.existsSync(path));}
const RADIO_ENV='/etc/andrik-radio.env';
const VISUAL_MANUAL_MARKER='/var/cache/andrik-radio-r622/visuals/.manual-visual-r658';
const VISUAL_AUTO_R658='/usr/local/sbin/andrik-visual-auto-r658';
const VISUAL_FILES=Object.freeze({day:'stream-day-master-r620.mp4',evening:'stream-evening-master-r620.mp4',night:'stream-night-master-r620.mp4'});
const DEFAULT_TICKER='ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';
const BASE=process.env.ANDRIK_CONTROL_BASE||'https://andrikmetal.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').trim();
let busy=null;

function migrateConfig(){
  if(fs.existsSync(CONFIG))return;
  for(const candidate of CONFIG_CANDIDATES.slice(1)){
    try{const d=JSON.parse(fs.readFileSync(candidate,'utf8'));if(clean(d?.token)){fs.copyFileSync(candidate,CONFIG);fs.chmodSync(CONFIG,0o600);return;}}catch(_){}
  }
}
function readConfig(){migrateConfig();try{return JSON.parse(fs.readFileSync(CONFIG,'utf8'))}catch(_){return {}}}
function writeConfig(data){fs.writeFileSync(CONFIG,JSON.stringify(data,null,2)+'\n',{mode:0o600});try{fs.chmodSync(CONFIG,0o600)}catch(_){}}
async function jsonFetch(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(clean(d.error||d.message||`HTTP ${r.status}`));return d}
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
    return {service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:Boolean(d.producerRunning),publisher:Boolean(d.publisherRunning),current:c.title||'',next:n.title||'',audio:d.audioMode||'',version:d.version||'',visualPeriod:d.visualPeriod||'',visualPath:d.visualPath||'',forceVisualSlot:d.forceVisualSlot||'',visualAutoSchedule:Boolean(d.visualAutoSchedule),visualProtected:visualsProtected(),lastError:clean(d.lastError||''),lastFfmpegLine:clean(d.lastFfmpegLine||''),streamStartedAt:d.streamStartedAt||'',ticker:currentTicker(),busy:busy?{id:busy.id,action:busy.action,since:busy.since}:null};
  }catch(_){return {service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:false,publisher:false,current:'',next:'',ticker:currentTicker(),busy:busy?{id:busy.id,action:busy.action,since:busy.since}:null,error:'local-status-unavailable'};}
}
async function pair(code){code=clean(code).toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<8)throw new Error('Нужен короткий аварийный код привязки.');const d=await jsonFetch(BASE+'/api/radio-agent-r627/pair/consume',{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-Radio-Web-Agent-R665'},body:JSON.stringify({code})});writeConfig({token:d.token,pairedAt:new Date().toISOString(),base:BASE,version:'R665'});console.log('ГОТОВО ✅ OVH привязан.');}
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
  // R658: normal sync/bootstrap MUST NOT replace any working local DAY/EVENING/NIGHT master.
  // Only an explicit "visual-now" request may force a replacement.
  if(!force && visualsProtected() && existing)return existing;
  const final=`${VISUAL_DIR}/${VISUAL_FILES[slot]}`;const tmp=`${final}.r658-${process.pid}-${Date.now()}.part`;
  const r=await fetch(`${BASE}/api/radio-agent-r650/visual?slot=${encodeURIComponent(slot)}&download=1`,{headers:{authorization:headers.authorization,'user-agent':'ANDRIK-Radio-Web-Agent-R665'},signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw new Error(`R2 ${slot}: HTTP ${r.status}`);if(!r.body)throw new Error(`R2 ${slot}: empty body`);
  try{
    await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(tmp,{mode:0o600}));
    const st=fs.statSync(tmp);if(st.size<2*1024*1024)throw new Error(`R2 ${slot}: file too small (${st.size})`);
    const probe=run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,display_aspect_ratio','-of','default=nw=1',tmp],20000);
    if(!probe.ok)throw new Error(`R2 ${slot}: ffprobe failed`);
    fs.renameSync(tmp,final);return {slot,size:st.size,probe:probe.output,path:final,kept:false};
  }catch(e){try{fs.unlinkSync(tmp)}catch(_){}throw e;}
}
async function syncVisualsR650(headers){const out=[];for(const slot of ['day','evening','night'])out.push(await downloadVisualR650(slot,headers,{force:false}));return out;}
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
    const r=await runAsync('systemctl',['restart','andrik-radio.service'],90000);
    return {ok:r.ok,output:`VISUAL NOW ${slot.toUpperCase()} ✅ · MANUAL MODE\n${(x.size/1024/1024).toFixed(1)} MB\n${x.probe}\n\n${r.output}`};
  }
  if(action==='visual-auto'){
    try{fs.unlinkSync(VISUAL_MANUAL_MARKER)}catch(_){}
    updateVisualAutoScheduleR658(true);
    const r=fs.existsSync(VISUAL_AUTO_R658)
      ? await runAsync(VISUAL_AUTO_R658,['force'],90000)
      : await runAsync('systemctl',['restart','andrik-radio.service'],90000);
    return {ok:r.ok,output:`VISUAL AUTO R658 ✅\nExact fullscreen scheduler · protected local masters\n${r.output}`};
  }
  return {ok:false,output:'Неизвестная команда: '+action};
}
async function submitResult(headers,id,result){
  const after=await localStatus();
  await jsonFetch(BASE+'/api/radio-agent-r627/result',{method:'POST',headers,body:JSON.stringify({id,ok:result.ok,output:result.output,status:after})});
}
async function daemon(){
  while(true){
    try{
      const cfg=readConfig();
      if(!cfg.token){console.error(new Date().toISOString(),'agent: paired token not found; waiting');await sleep(10000);continue;}
      const headers={'content-type':'application/json','authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R665'};
      const status=await localStatus();
      // Heartbeat always continues, even while start/recover is running.
      const d=await jsonFetch(BASE+'/api/radio-agent-r627/poll',{method:'POST',headers,body:JSON.stringify({version:'R665',status})});
      if(d.ticker && typeof d.ticker.text==='string' && clean(d.ticker.text)!==clean(status.ticker))writeTicker(d.ticker.text);
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
async function bootstrapVisuals(){const cfg=readConfig();if(!cfg.token)throw new Error('OVH agent token not found — R627 pairing is required');const headers={'authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R665'};const rows=await syncVisualsR650(headers);let r;if(fs.existsSync(VISUAL_AUTO_R658)&&!fs.existsSync(VISUAL_MANUAL_MARKER))r=await runAsync(VISUAL_AUTO_R658,['force'],90000);else r=await runAsync('systemctl',['restart','andrik-radio.service'],90000);console.log('R2 VISUALS ✅',rows.map(x=>`${x.slot} ${(x.size/1024/1024).toFixed(1)}MB${x.kept?' KEEP':''}`).join(' · '));console.log(r.output);if(!r.ok)process.exitCode=3;}
async function main(){const cmd=clean(process.argv[2]||'status').toLowerCase();if(cmd==='pair')return pair(process.argv[3]);if(cmd==='daemon')return daemon();if(cmd==='bootstrap-visuals')return bootstrapVisuals();if(cmd==='status'){const cfg=readConfig();console.log(cfg.token?'PAIRED ✅':'NOT PAIRED ❌');console.log(await localStatus());return}console.log('ANDRIK Radio Web Agent R665 · commands: daemon | status | bootstrap-visuals');}
main().catch(e=>{console.error('ОШИБКА:',e.message||e);process.exitCode=1});
