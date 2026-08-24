#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import {spawn,spawnSync} from 'node:child_process';

const CONFIG='/etc/andrik-radio-web-r627.json';
const CONFIG_CANDIDATES=[CONFIG,'/etc/andrik-radio-web.json','/etc/andrik-radio-web-r629.json','/etc/andrik-radio-web-r630.json','/etc/andrik-radio-web-r631.json'];
const TICKER_FILE='/var/cache/andrik-radio-r622/live-ticker.txt';
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
    return {service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:Boolean(d.producerRunning),publisher:Boolean(d.publisherRunning),current:c.title||'',next:n.title||'',audio:d.audioMode||'',version:d.version||'',ticker:currentTicker(),busy:busy?{id:busy.id,action:busy.action,since:busy.since}:null};
  }catch(_){return {service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:false,publisher:false,current:'',next:'',ticker:currentTicker(),busy:busy?{id:busy.id,action:busy.action,since:busy.since}:null,error:'local-status-unavailable'};}
}
async function pair(code){code=clean(code).toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<8)throw new Error('Нужен короткий аварийный код привязки.');const d=await jsonFetch(BASE+'/api/radio-agent-r627/pair/consume',{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-Radio-Web-Agent-R633'},body:JSON.stringify({code})});writeConfig({token:d.token,pairedAt:new Date().toISOString(),base:BASE,version:'R633'});console.log('ГОТОВО ✅ AWS привязан.');}
async function execute(action){
  if(action==='start'||action==='auto-safe')return runAsync('/usr/local/sbin/andrik-youtube',['auto-safe'],240000);
  if(action==='recover')return runAsync('/usr/local/sbin/andrik-youtube',['recover'],240000);
  if(action==='stop')return runAsync('/usr/local/sbin/andrik-youtube',['end'],150000);
  if(action==='restart')return runAsync('systemctl',['restart','andrik-radio.service'],90000);
  if(action==='status'){
    const y=await runAsync('/usr/local/sbin/andrik-youtube',['status'],90000);const s=run('systemctl',['is-active','andrik-radio.service'],10000);
    return {ok:y.ok,output:`RADIO SERVICE: ${s.output}\n\n${y.output}`};
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
      const headers={'content-type':'application/json','authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R633'};
      const status=await localStatus();
      // Heartbeat always continues, even while start/recover is running.
      const d=await jsonFetch(BASE+'/api/radio-agent-r627/poll',{method:'POST',headers,body:JSON.stringify({version:'R633',status})});
      if(d.ticker && typeof d.ticker.text==='string' && clean(d.ticker.text)!==clean(status.ticker))writeTicker(d.ticker.text);
      if(d.command && !busy){
        const {id,action}=d.command;
        busy={id,action,since:new Date().toISOString()};
        console.log(new Date().toISOString(),'command start',action,id);
        execute(action).then(async result=>{
          try{await submitResult(headers,id,result);console.log(new Date().toISOString(),'command end',action,result.ok?'OK':'ERROR')}catch(e){console.error(new Date().toISOString(),'result:',e.message||e)}finally{busy=null;}
        }).catch(e=>{console.error(new Date().toISOString(),'command:',e.message||e);busy=null;});
      }
    }catch(e){console.error(new Date().toISOString(),'agent:',e.message||e)}
    await sleep(4000);
  }
}
async function main(){const cmd=clean(process.argv[2]||'status').toLowerCase();if(cmd==='pair')return pair(process.argv[3]);if(cmd==='daemon')return daemon();if(cmd==='status'){const cfg=readConfig();console.log(cfg.token?'PAIRED ✅':'NOT PAIRED ❌');console.log(await localStatus());return}console.log('ANDRIK Radio Web Agent R633 · commands: daemon | status');}
main().catch(e=>{console.error('ОШИБКА:',e.message||e);process.exitCode=1});
