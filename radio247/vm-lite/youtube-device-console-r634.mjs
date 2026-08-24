#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const AUTH_FILE=process.env.ANDRIK_YOUTUBE_DEVICE_AUTH_FILE||'/etc/andrik-youtube-device.json';
const LEGACY_AUTH_FILE='/etc/andrik-youtube-device-r620.json';
const SCOPE='https://www.googleapis.com/auth/youtube';
const DEVICE_CODE_URL='https://oauth2.googleapis.com/device/code';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const API='https://www.googleapis.com/youtube/v3';
const PAIR_URL='https://andrikmetal.com/api/control/youtube-device-pair-r625/consume';
const WEB_SYNC_URL='https://andrikmetal.com/api/control/youtube-device-web-r626/consume';
const RADIO_SERVICE='andrik-radio.service';
const RADIO_ENV='/etc/andrik-radio.env';
const DEFAULT_TITLE='ANDRIK METAL RADIO — LIVE 24/7';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=v=>String(v??'').trim();

function migrateLegacy(){
  try{
    if(!fs.existsSync(AUTH_FILE)&&fs.existsSync(LEGACY_AUTH_FILE)){
      fs.copyFileSync(LEGACY_AUTH_FILE,AUTH_FILE);
      fs.chmodSync(AUTH_FILE,0o600);
    }
  }catch(_){}
}
function readAuth(){migrateLegacy();try{return JSON.parse(fs.readFileSync(AUTH_FILE,'utf8'))}catch(_){return {}}}
function writeAuth(data){fs.writeFileSync(AUTH_FILE,JSON.stringify(data,null,2)+'\n',{mode:0o600});try{fs.chmodSync(AUTH_FILE,0o600)}catch(_){}}
async function promptVisible(label){const rl=readline.createInterface({input:process.stdin,output:process.stdout});try{return clean(await rl.question(label))}finally{rl.close()}}
async function jsonFetch(url,options={}){const r=await fetch(url,options);const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(clean(d?.error_description||d?.error?.message||d?.error||`HTTP ${r.status}`));e.status=r.status;e.payload=d;throw e}return d}
async function apiFetch(token,path,params={},options={}){const u=new URL(API+path);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));const headers=new Headers(options.headers||{});headers.set('authorization','Bearer '+token);headers.set('accept','application/json');if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');return jsonFetch(u,{...options,headers});}

async function ensureClient({forcePrompt=false}={}){
  const a=readAuth();
  let clientId=clean(process.env.YOUTUBE_DEVICE_CLIENT_ID||a.clientId);
  let clientSecret=clean(process.env.YOUTUBE_DEVICE_CLIENT_SECRET||a.clientSecret);
  if(forcePrompt||!clientId){
    console.log('\nНужен ОТДЕЛЬНЫЙ OAuth Client: “TVs and Limited Input devices”.');
    console.log('Обычный Web client сюда не подходит.');
    clientId=await promptVisible('TV/Device Client ID: ');
  }
  if(forcePrompt||!clientSecret)clientSecret=await promptVisible('TV/Device Client Secret: ');
  if(!clientId||!clientSecret)throw new Error('TV/Device Client ID или Secret пустой.');
  return {...a,clientId,clientSecret};
}

async function pair(){
  let code=clean(process.argv[3]||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!code)code=clean(await promptVisible('Код с сайта: ')).toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length<8)throw new Error('Код слишком короткий. Создай новый на странице YouTube Device OAuth → AWS.');
  console.log('Получаю OAuth Client по одноразовому коду…');
  const d=await jsonFetch(PAIR_URL,{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-AWS-YouTube-Pair-R625'},body:JSON.stringify({code})});
  const clientId=clean(d.clientId),clientSecret=clean(d.clientSecret);
  if(!clientId||!clientSecret)throw new Error('Сайт не вернул Client ID/Secret.');
  writeAuth({clientId,clientSecret,refreshToken:'',pairedAt:new Date().toISOString(),source:'R625 one-time website pairing'});
  console.log('ГОТОВО ✅ OAuth Client получен. Код уже уничтожен на сайте.');
  console.log('Запускаю Google Device OAuth…');
  return auth();
}

async function auth(){
  const base=await ensureClient({forcePrompt:process.argv.includes('--new-client')});
  const body=new URLSearchParams({client_id:base.clientId,scope:SCOPE});
  const d=await jsonFetch(DEVICE_CODE_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const verify=clean(d.verification_url||d.verification_uri||'https://www.google.com/device');
  console.log('\n============================================================');
  console.log('1) Открой на телефоне:',verify);
  console.log('2) Введи код:',d.user_code);
  console.log('3) Выбери аккаунт-владелец канала ANDRIK и нажми Разрешить.');
  console.log('4) Ничего больше в AWS не нажимай — здесь идёт автоматическое ожидание.');
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
      if(!refresh)throw new Error('Google не вернул refresh token.');
      writeAuth({clientId:base.clientId,clientSecret:base.clientSecret,refreshToken:refresh,scope:clean(j.scope||SCOPE),authorizedAt:new Date().toISOString()});
      console.log('ГОТОВО ✅ YouTube Console авторизована.');
      console.log('Токен хранится только на AWS:',AUTH_FILE,'(0600)');
      await status();
      return;
    }
    const err=clean(j.error);
    if(err==='authorization_pending')continue;
    if(err==='slow_down'){interval+=5;continue}
    if(err==='access_denied')throw new Error('Доступ отклонён в Google.');
    if(err==='expired_token')throw new Error('Код истёк. Запусти auth ещё раз.');
    if(err==='invalid_client')throw new Error('Неверный тип OAuth Client. Нужен именно “TVs and Limited Input devices”.');
    throw new Error(clean(j.error_description||err||`token HTTP ${r.status}`));
  }
  throw new Error('Код авторизации истёк.');
}

async function syncWebAuth({quiet=false}={}){
  const a=readAuth();
  if(!a.clientId||!a.clientSecret){if(!quiet)console.log('На AWS ещё нет OAuth Client ID/Secret. Сначала один раз используй R625 pair или введи их на сайте R626.');return false}
  try{
    const d=await jsonFetch(WEB_SYNC_URL,{method:'POST',headers:{'content-type':'application/json','user-agent':'ANDRIK-AWS-YouTube-Web-Sync-R626'},body:JSON.stringify({clientId:a.clientId,clientSecret:a.clientSecret})});
    const refresh=clean(d.refreshToken);
    if(!refresh)throw new Error('Сайт не вернул refresh token.');
    writeAuth({clientId:clean(d.clientId)||a.clientId,clientSecret:clean(d.clientSecret)||a.clientSecret,refreshToken:refresh,scope:clean(d.scope||SCOPE),authorizedAt:clean(d.authorizedAt)||new Date().toISOString(),source:'R626 website Device OAuth auto-sync'});
    console.log('ГОТОВО ✅ YouTube token автоматически забран с сайта и сохранён на AWS.');
    return true;
  }catch(e){
    if(!quiet && !/authorized-package-not-found|HTTP 404/i.test(String(e?.message||e)))console.log('Web sync:',e.message||e);
    return false;
  }
}

async function accessToken(){
  let a=readAuth();
  if(!a.clientId||!a.clientSecret)throw new Error('Нет OAuth Client на AWS. Открой https://andrikmetal.com/youtube-device-auth-admin.html');
  if(!a.refreshToken){
    console.log('Refresh token на AWS ещё нет → пробую забрать готовую веб-авторизацию R626…');
    const synced=await syncWebAuth({quiet:false});
    if(!synced)throw new Error('Авторизация ещё не готова. Открой https://andrikmetal.com/youtube-device-auth-admin.html и дождись зелёной галочки.');
    a=readAuth();
  }
  const body=new URLSearchParams({client_id:a.clientId,client_secret:a.clientSecret,refresh_token:a.refreshToken,grant_type:'refresh_token'});
  const d=await jsonFetch(TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  return d.access_token;
}

function configuredStreamKey(){
  try{
    const raw=fs.readFileSync(RADIO_ENV,'utf8');
    const line=raw.split(/\r?\n/).find(x=>/^\s*YOUTUBE_STREAM_KEY\s*=/.test(x));
    if(!line)return '';
    return clean(line.split('=').slice(1).join('=')).replace(/^['"]|['"]$/g,'');
  }catch(_){return ''}
}
function streamStatus(x){return clean(x?.status?.streamStatus).toLowerCase()}
async function chooseRadioStream(token){
  const d=await apiFetch(token,'/liveStreams',{part:'id,snippet,status,cdn',mine:'true',maxResults:'50'});
  const items=Array.isArray(d.items)?d.items:[];
  if(!items.length)throw new Error('На канале не найден ни один YouTube Live stream key.');
  const key=configuredStreamKey();
  if(key){
    const exact=items.find(x=>clean(x?.cdn?.ingestionInfo?.streamName)===key);
    if(exact)return exact;
    throw new Error('Stream key из /etc/andrik-radio.env не найден среди Live Streams этого YouTube-аккаунта. Проверь, что авторизован владелец канала ANDRIK.');
  }
  const rank={active:100,ready:80,inactive:50,error:10};
  return [...items].sort((a,b)=>(rank[streamStatus(b)]||0)-(rank[streamStatus(a)]||0))[0];
}
async function streamById(token,id){
  if(!clean(id))return null;
  const d=await apiFetch(token,'/liveStreams',{part:'id,status,cdn,snippet',id:clean(id)});
  return Array.isArray(d.items)?d.items[0]||null:null;
}
async function broadcastById(token,id){
  if(!clean(id))return {broadcast:null,stream:null,streamStatus:''};
  const d=await apiFetch(token,'/liveBroadcasts',{part:'id,snippet,status,contentDetails',id:clean(id)});
  const b=Array.isArray(d.items)?d.items[0]||null:null;
  if(!b)return {broadcast:null,stream:null,streamStatus:''};
  const sid=clean(b?.contentDetails?.boundStreamId);
  const stream=sid?await streamById(token,sid):null;
  return {broadcast:b,stream,streamStatus:streamStatus(stream)};
}
async function waitSpecificStream(token,streamId,wanted='active',timeoutMs=90000){
  const end=Date.now()+timeoutMs;let last='';
  while(Date.now()<end){
    const stream=await streamById(token,streamId);
    last=streamStatus(stream);
    if(last===wanted)return stream;
    await sleep(2500);
  }
  throw new Error(`Stream ${streamId} не стал ${wanted}. Последний статус: ${last||'unknown'}`);
}
async function createBroadcast(token){
  const stream=await chooseRadioStream(token);
  console.log('Создаю новый YouTube broadcast и привязываю к текущему stream key…');
  const body={
    snippet:{
      title:DEFAULT_TITLE,
      description:'ANDRIK Metal Radio 24/7 — original music, singles and albums. andrikmetal.com',
      scheduledStartTime:new Date(Date.now()+15000).toISOString()
    },
    status:{privacyStatus:'public',selfDeclaredMadeForKids:false},
    contentDetails:{
      enableAutoStart:true,
      enableAutoStop:false,
      enableDvr:true,
      recordFromStart:true,
      monitorStream:{enableMonitorStream:false,broadcastStreamDelayMs:0}
    }
  };
  let b;
  try{
    b=await apiFetch(token,'/liveBroadcasts',{part:'id,snippet,status,contentDetails'},{method:'POST',body:JSON.stringify(body)});
  }catch(e){
    const fallback=structuredClone(body);
    delete fallback.contentDetails.enableAutoStart;
    delete fallback.contentDetails.enableAutoStop;
    b=await apiFetch(token,'/liveBroadcasts',{part:'id,snippet,status,contentDetails'},{method:'POST',body:JSON.stringify(fallback)});
  }
  await apiFetch(token,'/liveBroadcasts/bind',{part:'id,snippet,status,contentDetails',id:b.id,streamId:stream.id},{method:'POST'});
  console.log('Новый broadcast ✅ videoId:',b.id);
  console.log('Привязан stream:',clean(stream?.snippet?.title)||stream.id);
  let exact=null;
  for(let i=0;i<8;i++){
    await sleep(i===0?1500:1200);
    exact=await broadcastById(token,b.id);
    if(exact.broadcast && exact.stream && clean(exact?.broadcast?.contentDetails?.boundStreamId)===clean(stream.id))return exact;
  }
  if(!exact?.broadcast)throw new Error('Новый broadcast не найден после создания.');
  if(clean(exact?.broadcast?.contentDetails?.boundStreamId)!==clean(stream.id))throw new Error('Новый broadcast не привязался к выбранному stream key.');
  throw new Error('YouTube не вернул привязанный Live Stream после bind.');
}
async function ensureBroadcast(token){
  let x=await current(token);
  if(!x.broadcast)return createBroadcast(token);
  if(life(x.broadcast)==='live')return x;

  const target=await chooseRadioStream(token);
  const sid=clean(x?.broadcast?.contentDetails?.boundStreamId);
  if(sid===clean(target.id) && x.stream && clean(x.stream.id)===clean(target.id))return x;

  if(['created','ready'].includes(life(x.broadcast))){
    try{
      console.log('Старый broadcast имеет битую/чужую привязку → перепривязываю к текущему ANDRIK stream key…');
      await apiFetch(token,'/liveBroadcasts/bind',{part:'id,snippet,status,contentDetails',id:x.broadcast.id,streamId:target.id},{method:'POST'});
      await sleep(1200);
      const exact=await broadcastById(token,x.broadcast.id);
      if(exact.broadcast && exact.stream && clean(exact?.broadcast?.contentDetails?.boundStreamId)===clean(target.id)){
        console.log('Binding восстановлен ✅ stream:',clean(target?.snippet?.title)||target.id);
        return exact;
      }
    }catch(e){
      console.log('Старый broadcast не удалось починить:',clean(e?.message||e));
    }
  }

  console.log('Старый broadcast непригоден → создаю НОВЫЙ чистый broadcast.');
  return createBroadcast(token);
}
function life(x){return clean(x?.status?.lifeCycleStatus).toLowerCase()}
async function current(token){
  const d=await apiFetch(token,'/liveBroadcasts',{part:'id,snippet,status,contentDetails',mine:'true',maxResults:'25'});
  const items=Array.isArray(d.items)?d.items:[];
  const rank={live:100,livestarting:95,testing:90,teststarting:85,ready:80,created:70};
  const candidates=items.filter(x=>!['complete','revoked'].includes(life(x))).sort((a,b)=>{
    const r=(rank[life(b)]||0)-(rank[life(a)]||0);if(r)return r;
    const abound=Boolean(clean(a?.contentDetails?.boundStreamId));
    const bbound=Boolean(clean(b?.contentDetails?.boundStreamId));
    if(abound!==bbound)return bbound?1:-1;
    const at=Date.parse(a?.snippet?.scheduledStartTime||a?.snippet?.actualStartTime||0)||0;
    const bt=Date.parse(b?.snippet?.scheduledStartTime||b?.snippet?.actualStartTime||0)||0;
    return bt-at;
  });
  // If any usable broadcast is already bound, never let a stale unbound 'created' item win.
  const bound=candidates.filter(x=>clean(x?.contentDetails?.boundStreamId));
  const b=(bound[0]||candidates[0]||null);if(!b)return {broadcast:null,stream:null,streamStatus:''};
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
  const snippet={title:clean(sn.title)||DEFAULT_TITLE,description:String(sn.description||''),scheduledStartTime:sn.scheduledStartTime};
  if(sn.scheduledEndTime)snippet.scheduledEndTime=sn.scheduledEndTime;if(sn.categoryId)snippet.categoryId=String(sn.categoryId);
  const contentDetails={monitorStream:{enableMonitorStream:Boolean(m.enableMonitorStream),broadcastStreamDelayMs:Math.max(0,Number(m.broadcastStreamDelayMs||0))},enableAutoStart:true,enableAutoStop:false};
  for(const k of ['enableEmbed','enableDvr','recordFromStart'])if(typeof cd[k]==='boolean')contentDetails[k]=cd[k];
  if(cd.closedCaptionsType)contentDetails.closedCaptionsType=cd.closedCaptionsType;if(cd.projection)contentDetails.projection=cd.projection;if(cd.latencyPreference)contentDetails.latencyPreference=cd.latencyPreference;else if(typeof cd.enableLowLatency==='boolean')contentDetails.enableLowLatency=cd.enableLowLatency;
  return {id:b.id,snippet,contentDetails};
}
async function configureAutostart(token,x){
  if(!x.broadcast)throw new Error('broadcast-not-found');
  const l=life(x.broadcast);
  if(!['created','ready'].includes(l))throw new Error('Auto-start меняется только в created/ready. Сейчас: '+l);
  if(x.streamStatus==='active')throw new Error('Stream ещё active. Сначала останови encoder.');
  const updated=await apiFetch(token,'/liveBroadcasts',{part:'snippet,contentDetails'},{method:'PUT',body:JSON.stringify(updateBody(x.broadcast))});
  console.log('ГОТОВО ✅ Auto-start ON · Auto-stop OFF');
  console.log('videoId:',updated.id);
  return updated;
}
async function autostart(){const token=await accessToken(),x=await current(token);return configureAutostart(token,x)}
async function transition(token,id,status){return apiFetch(token,'/liveBroadcasts/transition',{broadcastStatus:status,id,part:'id,status,contentDetails'},{method:'POST'})}
async function waitLife(token,id,expected,timeoutMs=35000){const end=Date.now()+timeoutMs;let last='';while(Date.now()<end){const d=await apiFetch(token,'/liveBroadcasts',{part:'id,status,contentDetails',id});const b=Array.isArray(d.items)?d.items[0]||null:null;last=life(b);if(expected.includes(last))return last;await sleep(2500)}return last}
async function waitStream(token,wanted='active',timeoutMs=60000){
  const end=Date.now()+timeoutMs;let last='';let repaired=false;
  while(Date.now()<end){
    let x=await current(token);last=x.streamStatus;
    if(last===wanted)return x;
    if(!repaired && !last && x.broadcast && !clean(x?.broadcast?.contentDetails?.boundStreamId)){
      repaired=true;
      x=await ensureBroadcast(token);last=x.streamStatus;
      if(last===wanted)return x;
    }
    await sleep(2500);
  }
  throw new Error(`Stream не стал ${wanted}. Последний статус: ${last||'unknown'}`);
}
async function startWithToken(token,x=null){
  x=x||await ensureBroadcast(token);
  const id=x.broadcast.id;let l=life(x.broadcast);if(l==='live'){console.log('Уже LIVE ✅ https://www.youtube.com/watch?v='+id);return x}
  if(x.streamStatus!=='active')throw new Error('Encoder ещё не дошёл до YouTube.');
  const monitor=Boolean(x.broadcast?.contentDetails?.monitorStream?.enableMonitorStream);
  if(l==='teststarting')l=await waitLife(token,id,['testing'],30000);
  if(['created','ready'].includes(l)&&monitor){await transition(token,id,'testing');l=await waitLife(token,id,['testing'],30000)}
  if(l==='testing'||(['created','ready'].includes(l)&&!monitor))await transition(token,id,'live');
  l=await waitLife(token,id,['live','livestarting'],45000);
  if(!['live','livestarting'].includes(l))throw new Error('YouTube не перешёл в LIVE. Статус: '+l);
  console.log('ГОТОВО 🔴',l.toUpperCase(),'https://www.youtube.com/watch?v='+id);
  return current(token);
}
async function start(){const token=await accessToken();return startWithToken(token)}
function serviceActive(){const r=spawnSync('systemctl',['is-active','--quiet',RADIO_SERVICE]);return r.status===0}
async function launch(){
  const token=await accessToken();
  let x=await ensureBroadcast(token);
  printState(x);
  if(life(x.broadcast)==='live'){console.log('Эфир уже LIVE ✅');return}
  if(!serviceActive()){
    console.log('Запускаю encoder ANDRIK Radio…');
    systemctl('start',RADIO_SERVICE);
  }else if(x.streamStatus!=='active'){
    console.log('Radio service активен, но сигнала YouTube ещё нет → перезапускаю encoder…');
    systemctl('restart',RADIO_SERVICE);
  }
  x=await waitStream(token,'active',90000);
  console.log('Сигнал YouTube ACTIVE ✅');
  await startWithToken(token,x);
}
function systemctl(...args){const r=spawnSync('systemctl',args,{stdio:'inherit'});if(r.status!==0)throw new Error('systemctl '+args.join(' ')+' failed')}
function serviceState(){const r=spawnSync('systemctl',['is-active',RADIO_SERVICE],{encoding:'utf8'});return clean(r.stdout||r.stderr).toLowerCase()||'unknown'}
async function stopRadioFast(){
  const before=serviceState();
  if(['inactive','failed','unknown'].includes(before))return;
  console.log('Останавливаю encoder без зависания…');
  spawnSync('systemctl',['stop','--no-block',RADIO_SERVICE],{stdio:'inherit'});
  for(let i=0;i<16;i++){
    await sleep(500);
    const st=serviceState();
    if(['inactive','failed','unknown'].includes(st)){
      spawnSync('systemctl',['reset-failed',RADIO_SERVICE],{stdio:'ignore'});
      console.log('Encoder остановлен ✅');
      return;
    }
  }
  console.log('systemd завис в '+serviceState()+' → принудительно завершаю процессы encoder…');
  spawnSync('systemctl',['kill','--kill-who=all','--signal=SIGKILL',RADIO_SERVICE],{stdio:'ignore'});
  await sleep(1200);
  spawnSync('systemctl',['reset-failed',RADIO_SERVICE],{stdio:'ignore'});
  const after=serviceState();
  if(!['inactive','failed','unknown'].includes(after))throw new Error('Не удалось остановить encoder. systemd: '+after);
  console.log('Encoder принудительно остановлен ✅');
}
async function autoSafe(){
  const token=await accessToken();
  let existing=await current(token);
  if(life(existing.broadcast)==='live'){
    printState(existing);
    console.log('Эфир уже LIVE — ничего не трогаю ✅');
    return;
  }

  // R634: never wait on an old created/unknown broadcast again.
  // Stop the encoder first, then create a brand-new broadcast bound to the exact reusable stream key.
  const radioState=serviceState();
  if(serviceActive() || ['active','activating','deactivating','reloading'].includes(radioState)){
    await stopRadioFast();
    const target=await chooseRadioStream(token).catch(()=>null);
    if(target)await waitSpecificStream(token,target.id,'inactive',12000).catch(()=>sleep(1500));
  }

  console.log('R634: создаю новый чистый broadcast вместо зависшего created/unknown…');
  let x=await createBroadcast(token);
  printState(x);
  await configureAutostart(token,x);
  const broadcastId=x.broadcast.id;
  const streamId=clean(x?.broadcast?.contentDetails?.boundStreamId);
  if(!streamId)throw new Error('R634: у нового broadcast нет boundStreamId.');

  console.log('Запускаю ANDRIK Radio…');
  systemctl('start',RADIO_SERVICE);
  await waitSpecificStream(token,streamId,'active',100000);
  console.log('Сигнал YouTube ACTIVE ✅');

  let lifeNow=await waitLife(token,broadcastId,['live','livestarting'],30000);
  if(!['live','livestarting'].includes(lifeNow)){
    console.log('Auto-start не сработал сам → выполняю безопасный transition именно нового broadcast.');
    x=await broadcastById(token,broadcastId);
    await startWithToken(token,x);
  }else{
    console.log('ГОТОВО 🔴 YouTube запустился автоматически.');
  }
}
async function recover(){
  const token=await accessToken();const x=await current(token);printState(x);
  if(life(x.broadcast)==='live'){
    if(!serviceActive()){console.log('LIVE найден, encoder остановлен → запускаю encoder…');systemctl('start',RADIO_SERVICE)}
    else console.log('Ничего делать не надо — эфир уже LIVE ✅');
    return;
  }
  console.log('R634 recovery: старый created/unknown не используем → выполняю чистый старт.');
  return autoSafe();
}
async function endLive(){
  const token=await accessToken();const x=await current(token);
  if(x.broadcast && ['live','livestarting','testing','teststarting'].includes(life(x.broadcast))){
    await transition(token,x.broadcast.id,'complete');
    console.log('YouTube broadcast завершён ✅');
  }else console.log('Активного LIVE broadcast нет.');
  if(serviceActive() || ['active','activating','deactivating','reloading'].includes(serviceState()))await stopRadioFast()
}
async function main(){
  const cmd=clean(process.argv[2]||'status').toLowerCase();
  if(cmd==='pair')return pair();
  if(cmd==='sync'||cmd==='sync-web'||cmd==='web-sync')return syncWebAuth({quiet:false});
  if(cmd==='auth')return auth();
  if(cmd==='status')return status();
  if(cmd==='autostart'||cmd==='auto')return autostart();
  if(cmd==='auto-safe'||cmd==='autosafe'||cmd==='setup-live')return autoSafe();
  if(cmd==='create')return createBroadcast(await accessToken());
  if(cmd==='start')return start();
  if(cmd==='launch'||cmd==='go'||cmd==='live')return launch();
  if(cmd==='recover'||cmd==='fix')return recover();
  if(cmd==='end'||cmd==='stop-live')return endLive();
  console.log('ANDRIK YouTube Console R634');
  console.log('Команды: sync | pair CODE | auth | status | create | launch | auto | auto-safe | start | recover | end');
}
main().catch(e=>{console.error('ОШИБКА:',e.message||e);process.exitCode=1});
