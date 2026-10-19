// Local battle style and world records. Never grants currency or changes old score/save keys.
import {blocked} from './portrait-core-r1295.js?v=r1472';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,max=9999999)=>clamp(Number(v)||0,0,max),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const RANKS=['C','B','A','S'];
export const RANK_COLORS={C:'#a9bfd2',B:'#6ce6d3',A:'#bb9bff',S:'#f8d68b'};
export const ratingWorld=s=>s.isCity?'city':s.world|| (s.isRuins?'ruins':'portrait');
export function styleRank(meter,variety){return meter>=80&&variety>=4?'S':meter>=50&&variety>=3?'A':meter>=24&&variety>=2?'B':'C';}
function memoryDefault(){try{return localStorage;}catch{return null;}}
function read(storage,key){try{return JSON.parse(storage?.getItem(key)||'null');}catch{return null;}}
function empty(){return{version:1,seconds:0,points:0,kills:0,deaths:0,damage:0,contacts:0,dodges:0,finishers:0,maxChain:0,bestRank:'C',secrets:[],result:null};}
function normalize(raw){const q=empty();if(raw?.version!==1)return q;for(const k of ['seconds','points','kills','deaths','damage','contacts','dodges','finishers','maxChain'])q[k]=num(raw[k]);q.secrets=Array.isArray(raw.secrets)?[...new Set(raw.secrets.filter(x=>typeof x==='string'&&x.length<100))].slice(0,100):[];q.bestRank=RANKS.includes(raw.bestRank)?raw.bestRank:'C';return q;}
function attackTag(s,a){
 if(!a)return{key:'reflection',label:'Отражение',gain:13};
 if(a.kind==='slash')return{key:(s.weaponStats?.selected||'sword')+':'+(a.step||0),label:a.step===2?'Круговая рубка':s.weaponStats?.selected==='bat'?'Размашистый удар':'Рубка мечом',gain:13};
 const labels={airCleave:'Рубящий удар сверху',throw:'Меткий бросок',kick:'Удар ногой',palm:'Ладонь',airKick:'Нога в прыжке',meteor:'Рубка в прыжке',attack:'Круговая гитара',scream:'Голос Лиры',rage:'Яростная серия',finish:'Добивание',punch:'Удар рукой',backfist:'С разворота'};
 return{key:a.kind,label:labels[a.kind]||'Попадание',gain:a.kind==='finish'?23:a.kind==='rage'?16:14};
}
export function attachBattleRating(s,{storage=memoryDefault(),saved=null}={}){
 if(s.battle)return s;
 const base={hit:s.hit.bind(s),damage:s.damage.bind(s),action:s.action.bind(s),emit:s.emit.bind(s),update:s.update.bind(s),load:s.load.bind(s),restore:s.restore.bind(s),snapshot:s.snapshot.bind(s)};
 let run=normalize(saved?.battleR1468),meter=0,chain=0,history=[],last=-100,clock=0,label='',labelUntil=0,serial=0,insideUpdate=0,restoring=0,deathCounted=false,world=ratingWorld(s),difficulty=s.r1301?.difficulty||'normal',pendingDodge=null;
 let credited=new WeakMap();const dodged=new WeakMap();
 const eligible=()=>!s.dead&&!s.won&&!s.finale&&!s.vehicleActive&&!(s.race?.mounted&&!s.race.finished);
 const variety=()=>new Set(history).size;
 const key=()=> 'andrik-battle-best-r1468-'+world+'-'+difficulty;
 function award(tag,gain=tag.gain,points=45,force=false){
  if(!force&&!eligible())return;
  const repeats=history.filter(x=>x===tag.key).length,repeated=history.at(-1)===tag.key;
  const factor=repeated?Math.max(.08,.42/(repeats+1)):repeats>=2?.55:1;
  meter=clamp(meter+gain*factor,0,100);chain=clock-last<=4?chain+1:1;last=clock;
  history.push(tag.key);if(history.length>8)history.shift();run.points+=Math.round(points*factor);run.maxChain=Math.max(run.maxChain,chain);
  const rank=styleRank(meter,variety());if(RANKS.indexOf(rank)>RANKS.indexOf(run.bestRank)){run.bestRank=rank;base.emit('battleRank',{rank});}
  label=repeated?'Меняй приёмы':tag.label;labelUntil=clock+1.8;serial++;
 }
 function secret(id){if(!run.secrets.includes(id)&&run.secrets.length<100){run.secrets.push(id);run.points+=100;}}
 function finish(){
  if(run.result)return run.result;
  const score=Math.max(0,Math.round(run.points+500-run.deaths*150-run.damage*2));
  const prev=read(storage,key()),previousScore=prev?.version===1?num(prev.score):0;
  const result={version:1,world,difficulty,score,grade:run.bestRank,seconds:Math.max(1,Math.round(run.seconds)),kills:Math.floor(run.kills),deaths:Math.floor(run.deaths),secrets:run.secrets.length,dodges:Math.floor(run.dodges),finishers:Math.floor(run.finishers),maxChain:Math.floor(run.maxChain),previousScore,newBest:!prev||score>previousScore,saved:false};
  if(result.newBest){try{if(storage){storage.setItem(key(),JSON.stringify({...result,saved:true}));result.saved=true;}}catch{}}else result.saved=true;
  result.bestScore=Math.max(previousScore,score);run.result=result;return result;
 }
 function clearBattle(){meter=0;chain=0;history=[];last=-100;label='';labelUntil=0;pendingDodge=null;credited=new WeakMap();}
 function reset(){run=empty();clock=0;world=ratingWorld(s);difficulty=s.r1301?.difficulty||'normal';deathCounted=false;clearBattle();}
 function evadeReward(){if(!pendingDodge||pendingDodge.rewarded)return;pendingDodge.rewarded=true;run.dodges++;award({key:'dodge',label:'Точное уклонение',gain:17},17,85);}
 function danger(){
  const list=[];
  for(const e of s.living){const t=e.tactic,a=e.boss1468?.action;
   if(t?.phase==='windup'&&t.wind-t.t<.40&&t.wind-t.t>=0&&dist(e,s.p)<(t.kind==='shot'?4:3.8)&&Math.abs((e.y||0)-s.p.y)<1.5&&!blocked(e,s.p,s.geo.walls))list.push({ref:t,stamp:t.attackSerial1468||0,wind:t.wind,t:t.t});
   if(a&&a.kind!=='evade'&&a.wind-a.t<.42&&a.wind-a.t>=0&&Math.abs((e.y||0)-s.p.y)<1.5&&!blocked(e,s.p,s.geo.walls)){
    const targeted=['leap','tentacle','tentaclePair','lattice'].includes(a.kind),d=dist(targeted?a.target:e,s.p);if(d<(targeted?a.range>9?3.5:a.range:Math.min(5,a.range+1)))list.push({ref:a,wind:a.wind,t:a.t});
   }
  }
  for(const q of [...s.shots,...(s.throwables?.flights||[])]){if(q.life<=0||q.friendly||dist(q,s.p)>4||Math.abs((q.y||0)-s.p.y)>1.5)continue;const vx=q.vx||0,vz=q.vz||0,dot=(s.p.x-q.x)*vx+(s.p.z-q.z)*vz;if(dot<=0)continue;const hit=dot/Math.max(1,vx*vx+vz*vz),cross=Math.hypot(q.x+vx*hit-s.p.x,q.z+vz*hit-s.p.z);if(hit<.35&&cross<.9)list.push({ref:q,shot:true});}
  return list.filter(q=>dodged.get(q.ref)!==(q.stamp||0));
 }
 s.action=function(kind){const risks=['dodge','dash'].includes(kind)&&eligible()?danger():[],before=s.dodge1460,hp=s.p.hp,p={x:s.p.x,z:s.p.z};const result=base.action(kind);
  if(result&&s.dodge1460&&s.dodge1460!==before)pendingDodge={t:0,hp,p,risks,rewarded:false};return result;
 };
 s.hit=function(e,...args){
  const active=eligible(),hp=e.hp,a=this.attack,result=base.hit(e,...args),actual=hp-e.hp;if(actual<=0||!active)return result;
  run.contacts++;
  if(a){const round=a.kind==='rage'?a.rounds||0:0;if(credited.get(a)!==round){credited.set(a,round);const tag=attackTag(this,a);award(tag,actual<=2?2:tag.gain,a.kind==='finish'?180:45,true);if(a.kind==='finish')run.finishers++;}}
  else award(attackTag(this,null),13,60,true);
  if(e.hp<=0){run.kills++;run.points+=e.kind==='boss'?350:90;}
  return result;
 };
 s.damage=function(n){const hp=s.p.hp,result=base.damage(n),actual=hp-s.p.hp;
  if(actual>0){run.damage+=actual;meter=Math.max(0,meter*.48-5);chain=0;history=[];label='Серия прервана';labelUntil=clock+1.3;serial++;}
  else if(pendingDodge&&s.dodge1460&&s.p.inv>0&&pendingDodge.risks.length)evadeReward();
  return result;
 };
 s.emit=function(type,data={}){
  if(['death','fall'].includes(type)&&!deathCounted){deathCounted=true;run.deaths++;clearBattle();}
  if(type==='respawn')deathCounted=false;
  if(type==='secretR1301')secret(this.zone+':picture:'+data.x+':'+data.z);
  if(type==='momentDone')secret('moment:'+world);
  if(type==='won')finish();
  if(['counterHit','shieldBreak','armorBreak','parryR1301'].includes(type)){
   const descriptions={counterHit:'Контратака',shieldBreak:'Щит разбит',armorBreak:'Броня разбита',parryR1301:'Отражение'};
   award({key:type,label:descriptions[type],gain:10},10,65);
  }
  return base.emit(type,data);
 };
 s.update=function(dt,input={}){
  dt=clamp(Number(dt)||0,0,.035);const active=eligible();if(!s.dead&&!s.won&&!s.finale)run.seconds+=dt;if(active){clock+=dt;if(s.r1301?.difficulty&&s.r1301.difficulty!==difficulty)difficulty='mixed';}
  insideUpdate++;try{base.update(dt,input);}finally{insideUpdate--;}
  if(pendingDodge){const q=pendingDodge;q.t+=dt;if(q.t>=.34){
    if(!q.rewarded&&q.risks.length&&s.p.hp>=q.hp&&!s.dead&&dist(s.p,q.p)>.65){const passed=q.risks.some(r=>r.shot||r.ref.t>=r.wind||r.ref.phase!=='windup'&&'phase'in r.ref);if(passed)evadeReward();}
    if(q.rewarded)for(const risk of q.risks)dodged.set(risk.ref,risk.stamp||0);pendingDodge=null;
   }}
  if(active&&clock-last>3.5){meter=Math.max(0,meter-dt*6);if(clock-last>5){chain=0;history=[];}}
  for(const q of s.loot||[])if(q.taken)secret(s.zone+':cache:'+q.id);
  for(const id of s.echoes||[])secret('echo:'+id);
  if(s.won)finish();
 };
 s.load=function(...args){const result=base.load(...args);if(!restoring&&!insideUpdate&&args[0]===0)reset();else clearBattle();return result;};
 s.restore=function(raw){restoring++;try{const result=base.restore(raw);run=normalize(raw?.battleR1468);clearBattle();return result;}finally{restoring--;}};
 s.snapshot=function(){return{...base.snapshot(),battleR1468:{...run,result:undefined,difficulty}};};
 s.battle={get meter(){return meter;},get rank(){return styleRank(meter,variety());},get chain(){return chain;},get label(){return clock<labelUntil?label:'';},get serial(){return serial;},get visible(){return eligible()&&clock-last<6;},get stats(){return{...run,secrets:run.secrets.length};},get result(){return s.won?finish():null;},get record(){return read(storage,key());},reset};
 // Existing saves gain the new UI without changing HP, objectives or wallets.
 if(saved?.battleR1468?.difficulty)difficulty=['easy','normal','hard','mixed'].includes(saved.battleR1468.difficulty)?saved.battleR1468.difficulty:difficulty;
 if(saved&&!saved.battleR1468&&s.r1301){const q=s.r1301;run.seconds=q.activeSeconds||0;run.kills=q.kills||0;run.deaths=q.deaths||0;run.damage=q.damageTaken||0;}
 return s;
}
