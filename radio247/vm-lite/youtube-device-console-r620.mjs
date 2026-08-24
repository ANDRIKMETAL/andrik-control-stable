#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import readline from 'node:readline/promises';

const AUTH_FILE=process.env.ANDRIK_YOUTUBE_DEVICE_AUTH_FILE||'/etc/andrik-youtube-device-r620.json';
const SCOPE='https://www.googleapis.com/auth/youtube';
const DEVICE_CODE_URL='https://oauth2.googleapis.com/device/code';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const API='https://www.googleapis.com/youtube/v3';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').trim();

function readAuth(){try{return JSON.parse(fs.readFileSync(AUTH_FILE,'utf8'))}catch(_){return {}}}
function writeAuth(data){fs.writeFileSync(AUTH_FILE,JSON.stringify(data,null,2)+'\n',{mode:0o600});try{fs.chmodSync(AUTH_FILE,0o600)}catch(_){}}
async function promptSecret(label){const rl=readline.createInterface({input:process.stdin,output:process.stdout});try{return clean(await rl.question(label))}finally{rl.close()}}
async function jsonFetch(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(clean(d?.error_description||d?.error?.message||d?.error||`HTTP ${r.status}`));e.status=r.status;e.payload=d;throw e}return d}
async function apiFetch(token,path,params={},options={}){const u=new URL(API+path);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const headers=new Headers(options.headers||{});headers.set('authorization','Bearer '+token);headers.set('accept','application/json');if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');return jsonFetch(u,{...options,headers});}

async function ensureClient({forcePrompt=false}={}){
  const a=readAuth();
  let clientId=clean(process.env.YOUTUBE_DEVICE_CLIENT_ID||a.clientId);
  let clientSecret=clean(process.env.YOUTUBE_DEVICE_CLIENT_SECRET||a.clientSecret);
  if(forcePrompt||!clientId){
    console.log('\nСоздай в Google Cloud OAuth client типа: TVs and Limited Input devices.');
    clientId=await promptSecret('TV/Device Client ID: ');
  }
  if(forcePrompt||!clientSecret)clientSecret=await promptSecret('TV/Device Client Secret: ');
  if(!clientId||!clientSecret)throw new Error('device-oauth-client-empty');
  return {...a,clientId,clientSecret};
}

async function auth(){
  const base=await ensureClient({forcePrompt:process.argv.includes('--new-client')});
  const body=new URLSearchParams({client_id:base.clientId,scope:SCOPE});
  const d=await jsonFetch(DEVICE_CODE_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const verify=clean(d.verification_url||d.verification_uri||'https://www.google.com/device');
  console.log('\n============================================================');
  console.log('1) Открой:',verify);
  console.log('2) Введи код:',d.user_code);
  console.log('3) Разреши доступ аккаунту, который владеет каналом ANDRIK.');
  console.log('Жду подтверждение здесь автоматически…');
  console.log('============================================================\n');
  let interval=Math.max(5,Number(d.interval||5));
  const deadline=Date.now()+Math.max(60,Number(d.expires_in||1800))*1000;
  while(Date.now()<deadline){
    await sleep(interval*1000);
    const pollBody=new URLSearchParams({client_id:base.clientId,client_secret:base.clientSecret,device_code:d.device_code,grant_type:'urn:ietf:params:oauth:grant-type:device_code'});
    const r=await fetch(TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:pollBody});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.access_token){
      const refresh=clean(j.refresh_token||base.refreshToken);
      if(!refresh)throw new Error('refresh-token-missing');
      writeAuth({clientId:base.clientId,clientSecret:base.clientSecret,refreshToken:refresh,scope:clean(j.scope||SCOPE),authorizedAt:new Date().toISOString()});
      console.log('ГОТОВО ✅ Консоль YouTube авторизована. Токен хранится только на AWS в',AUTH_FILE);
      await status();
      return;
    }
    const err=clean(j.error);
    if(err==='authorization_pending')continue;
    if(err==='slow_down'){interval+=5;continue}
    if(err==='access_denied')throw new Error('Доступ отклонён в Google.');
    if(err==='expired_token')throw new Error('Код истёк. Запусти auth ещё раз.');
    throw new Error(clean(j.error_description||err||`token HTTP ${r.status}`));
  }
  throw new Error('device-code-expired');
}

async function accessToken(){
  const a=readAuth();
  if(!a.clientId||!a.clientSecret||!a.refreshToken)throw new Error('Сначала: sudo andrik-youtube auth');
  const body=new URLSearchParams({client_id:a.clientId,client_secret:a.clientSecret,refresh_token:a.refreshToken,grant_type:'refresh_token'});
  const d=await jsonFetch(TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  return d.access_token;
}

function life(x){return clean(x?.status?.lifeCycleStatus).toLowerCase()}
async function current(token){
  const d=await apiFetch(token,'/liveBroadcasts',{part:'id,snippet,status,contentDetails',mine:'true',maxResults:'25'});
  const items=Array.isArray(d.items)?d.items:[];
  const rank={live:100,livestarting:95,testing:90,teststarting:85,ready:80,created:70};
  const candidates=items.filter(x=>!['complete','revoked'].includes(life(x))).sort((a,b)=>{
    const r=(rank[life(b)]||0)-(rank[life(a)]||0);if(r)return r;
    const at=Date.parse(a?.snippet?.scheduledStartTime||a?.snippet?.actualStartTime||0)||0;
    const bt=Date.parse(b?.snippet?.scheduledStartTime||b?.snippet?.actualStartTime||0)||0;
    return bt-at;
  });
  const b=candidates[0]||null;if(!b)return {broadcast:null,stream:null,streamStatus:''};
  const sid=clean(b?.contentDetails?.boundStreamId);let stream=null;
  if(sid){const x=await apiFetch(token,'/liveStreams',{part:'id,status,cdn,snippet',id:sid});stream=Array.isArray(x.items)?x.items[0]||null:null}
  return {broadcast:b,stream,streamStatus:clean(stream?.status?.streamStatus).toLowerCase()};
}

function printState(x){
  const b=x.broadcast;if(!b){console.log('YouTube: активный/готовый broadcast не найден.');return}
  console.log('YouTube:',clean(b?.snippet?.title)||'ANDRIK');
  console.log('videoId:',b.id);
  console.log('broadcast:',life(b)||'?',' stream:',x.streamStatus||'?');
  console.log('autoStart:',Boolean(b?.contentDetails?.enableAutoStart),' autoStop:',Boolean(b?.contentDetails?.enableAutoStop));
  console.log('watch: https://www.youtube.com/watch?v='+b.id);
}
async function status(){const token=await accessToken();const x=await current(token);printState(x);return x}

function updateBody(b){
  const sn=b?.snippet||{},cd=b?.contentDetails||{},m=cd?.monitorStream||{};
  const snippet={title:clean(sn.title)||'ANDRIK METAL RADIO — LIVE 24/7',description:String(sn.description||''),scheduledStartTime:sn.scheduledStartTime};
  if(sn.scheduledEndTime)snippet.scheduledEndTime=sn.scheduledEndTime;if(sn.categoryId)snippet.categoryId=String(sn.categoryId);
  const contentDetails={monitorStream:{enableMonitorStream:Boolean(m.enableMonitorStream),broadcastStreamDelayMs:Math.max(0,Number(m.broadcastStreamDelayMs||0))},enableAutoStart:true,enableAutoStop:false};
  for(const k of ['enableEmbed','enableDvr','recordFromStart'])if(typeof cd[k]==='boolean')contentDetails[k]=cd[k];
  if(cd.closedCaptionsType)contentDetails.closedCaptionsType=cd.closedCaptionsType;if(cd.projection)contentDetails.projection=cd.projection;if(cd.latencyPreference)contentDetails.latencyPreference=cd.latencyPreference;else if(typeof cd.enableLowLatency==='boolean')contentDetails.enableLowLatency=cd.enableLowLatency;
  return {id:b.id,snippet,contentDetails};
}

async function autostart(){
  const token=await accessToken(),x=await current(token);if(!x.broadcast)throw new Error('broadcast-not-found');
  const l=life(x.broadcast);if(!['created','ready'].includes(l))throw new Error('Auto-start меняется только в created/ready. Сейчас: '+l);
  if(x.streamStatus==='active')throw new Error('Сначала останови encoder: sudo systemctl stop andrik-radio');
  const updated=await apiFetch(token,'/liveBroadcasts',{part:'snippet,contentDetails'},{method:'PUT',body:JSON.stringify(updateBody(x.broadcast))});
  console.log('ГОТОВО ✅ Auto-start ON · Auto-stop OFF');
  console.log('videoId:',updated.id);
}

async function transition(token,id,status){return apiFetch(token,'/liveBroadcasts/transition',{broadcastStatus:status,id,part:'id,status,contentDetails'},{method:'POST'})}
async function waitLife(token,id,expected,timeoutMs=35000){const end=Date.now()+timeoutMs;let last='';while(Date.now()<end){const d=await apiFetch(token,'/liveBroadcasts',{part:'id,status,contentDetails',id});const b=Array.isArray(d.items)?d.items[0]||null:null;last=life(b);if(expected.includes(last))return last;await sleep(2500)}return last}
async function start(){
  const token=await accessToken();let x=await current(token);if(!x.broadcast)throw new Error('broadcast-not-found');
  const id=x.broadcast.id;let l=life(x.broadcast);if(l==='live'){console.log('Уже LIVE ✅ https://www.youtube.com/watch?v='+id);return}
  if(x.streamStatus!=='active')throw new Error('Encoder ещё не дошёл до YouTube. Перезапусти radio и проверь publisherRunning:true.');
  const monitor=Boolean(x.broadcast?.contentDetails?.monitorStream?.enableMonitorStream);
  if(l==='teststarting')l=await waitLife(token,id,['testing'],30000);
  if(['created','ready'].includes(l)&&monitor){await transition(token,id,'testing');l=await waitLife(token,id,['testing'],30000)}
  if(l==='testing'||(['created','ready'].includes(l)&&!monitor))await transition(token,id,'live');
  l=await waitLife(token,id,['live','livestarting'],35000);
  if(!['live','livestarting'].includes(l))throw new Error('YouTube не перешёл в LIVE. Статус: '+l);
  console.log('ГОТОВО 🔴',l.toUpperCase(),'https://www.youtube.com/watch?v='+id);
}

async function recover(){
  const token=await accessToken(),x=await current(token);printState(x);if(!x.broadcast)throw new Error('broadcast-not-found');
  if(life(x.broadcast)==='live'){console.log('Ничего делать не надо — эфир уже LIVE ✅');return}
  if(x.streamStatus!=='active'){console.log('Сигнала нет. Сначала: sudo systemctl restart andrik-radio');return}
  console.log('Сигнал есть, broadcast не LIVE → запускаю transition…');
  await start();
}

async function main(){
  const cmd=clean(process.argv[2]||'status').toLowerCase();
  if(cmd==='auth')return auth();
  if(cmd==='status')return status();
  if(cmd==='autostart'||cmd==='auto')return autostart();
  if(cmd==='start')return start();
  if(cmd==='recover'||cmd==='fix')return recover();
  console.log('ANDRIK YouTube Console R620');
  console.log('Команды: auth | status | autostart | start | recover');
}
main().catch(e=>{console.error('ОШИБКА:',e.message||e);process.exitCode=1});
