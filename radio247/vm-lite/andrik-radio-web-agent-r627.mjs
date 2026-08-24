#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import {spawnSync} from 'node:child_process';

const CONFIG='/etc/andrik-radio-web-r627.json';
const BASE=process.env.ANDRIK_CONTROL_BASE||'https://andrikmetal.com';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').trim();

function readConfig(){try{return JSON.parse(fs.readFileSync(CONFIG,'utf8'))}catch(_){return {}}}
function writeConfig(data){fs.writeFileSync(CONFIG,JSON.stringify(data,null,2)+'\n',{mode:0o600});try{fs.chmodSync(CONFIG,0o600)}catch(_){}}
async function jsonFetch(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(clean(d.error||d.message||`HTTP ${r.status}`));return d}
function run(cmd,args=[],timeout=180000){const r=spawnSync(cmd,args,{encoding:'utf8',timeout,maxBuffer:1024*1024*2});const out=[r.stdout,r.stderr].filter(Boolean).join('\n').trim();return {ok:r.status===0,output:out||`${cmd} exit ${r.status}`,status:r.status};}
async function localStatus(){
  try{const r=await fetch('http://127.0.0.1:8080/status',{signal:AbortSignal.timeout(2500)});const d=await r.json();const c=d.current||{},n=d.next||{};return {service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:Boolean(d.producerRunning),publisher:Boolean(d.publisherRunning),current:c.title||'',next:n.title||'',audio:d.audioMode||'',version:d.version||''};}
  catch(_){return {service:run('systemctl',['is-active','andrik-radio.service'],8000).output.trim(),producer:false,publisher:false,current:'',next:'',error:'local-status-unavailable'};}
}
async function pair(code){
  code=clean(code).toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<8)throw new Error('Нужен короткий код с страницы управления радио.');
  const d=await jsonFetch(BASE+'/api/radio-agent-r627/pair/consume',{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-Radio-Web-Agent-R627'},body:JSON.stringify({code})});
  writeConfig({token:d.token,pairedAt:new Date().toISOString(),base:BASE,version:'R627'});
  console.log('ГОТОВО ✅ AWS привязан к веб-контрольке R627.');
  run('systemctl',['enable','--now','andrik-radio-web-control.service'],20000);
  console.log('Теперь запуск/остановка доступны кнопками на сайте.');
}
function execute(action){
  if(action==='start')return run('/usr/local/sbin/andrik-youtube',['auto-safe'],210000);
  if(action==='recover')return run('/usr/local/sbin/andrik-youtube',['recover'],210000);
  if(action==='stop')return run('/usr/local/sbin/andrik-youtube',['end'],120000);
  if(action==='restart')return run('systemctl',['restart','andrik-radio.service'],60000);
  if(action==='auto-safe')return run('/usr/local/sbin/andrik-youtube',['auto-safe'],210000);
  if(action==='status'){
    const y=run('/usr/local/sbin/andrik-youtube',['status'],60000);
    const s=run('systemctl',['is-active','andrik-radio.service'],10000);
    return {ok:y.ok,output:`RADIO SERVICE: ${s.output}\n\n${y.output}`};
  }
  return {ok:false,output:'Неизвестная команда: '+action};
}
async function daemon(){
  const cfg=readConfig();if(!cfg.token)throw new Error('AWS ещё не привязан. Сначала: sudo andrik-radio-web pair КОД');
  const headers={'content-type':'application/json','authorization':'Bearer '+cfg.token,'user-agent':'ANDRIK-Radio-Web-Agent-R627'};
  console.log('ANDRIK Radio Web Agent R627 started');
  while(true){
    try{
      const status=await localStatus();
      const d=await jsonFetch(BASE+'/api/radio-agent-r627/poll',{method:'POST',headers,body:JSON.stringify({version:'R627',status})});
      if(d.command){
        const {id,action}=d.command;console.log(new Date().toISOString(),'command',action,id);
        const result=execute(action);
        const after=await localStatus();
        await jsonFetch(BASE+'/api/radio-agent-r627/result',{method:'POST',headers,body:JSON.stringify({id,ok:result.ok,output:result.output,status:after})});
        console.log(new Date().toISOString(),action,result.ok?'OK':'ERROR');
      }
    }catch(e){console.error(new Date().toISOString(),'agent:',e.message||e)}
    await sleep(4000);
  }
}
async function main(){const cmd=clean(process.argv[2]||'status').toLowerCase();if(cmd==='pair')return pair(process.argv[3]);if(cmd==='daemon')return daemon();if(cmd==='status'){const cfg=readConfig();console.log(cfg.token?'PAIRED ✅':'NOT PAIRED ❌');console.log(await localStatus());return}console.log('Использование: sudo andrik-radio-web pair КОД | status');}
main().catch(e=>{console.error('ОШИБКА:',e.message||e);process.exitCode=1});
