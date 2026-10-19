// Seven encounter personalities. Simulation time only; no timers, random rolls or new summons.
import {enemyRouteDirection} from './enemy-navigation-r1446.js?v=r1471';
import {move,blocked} from './portrait-core-r1295.js?v=r1471';
import {knockPlayer,updatePlayerImpact} from './player-impact-r1457.js?v=r1471';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),angle=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
export const BOSS_STYLES={
 city:{name:'Ночной надзиратель',speed:3.5,range:2.8,evade:5.4,patterns:['combo','charge','kick','leap','cross','spin']},
 portrait:{name:'Пустой портрет',speed:3.8,range:3.0,evade:4.6,patterns:['feint','lunge','blink','spin','combo','leap']},
 ruins:{name:'Хранитель эпох',speed:2.8,range:3.7,evade:7.0,patterns:['slam','charge','stomp','shards','cross','leap']},
 2:{name:'Восьмирукий',speed:3.0,range:6.5,evade:6.2,patterns:['tentacle','ink','spin','leap','tentaclePair','slam']},
 3:{name:'АРЕС',speed:3.6,range:7.0,evade:4.8,patterns:['burst','jetDash','laserSweep','leap','cross','slam']},
 4:{name:'Сердце часового механизма',speed:3.2,range:3.3,evade:5.8,patterns:['pendulum','stomp','charge','gearFan','leap','cross']},
 5:{name:'Архитектор',speed:3.8,range:6.2,evade:4.6,patterns:['blink','lattice','laserSweep','lunge','leap','spin']}
};
export const BOSS_MOVES={
 combo:{label:'Серия из трёх ударов',hint:'Отступи или обойди сбоку',wind:.82,active:.88,recover:1.65,range:3.3,damage:11},
 cross:{label:'Тяжёлый боковой удар',hint:'Уклонись в сторону',wind:.78,active:.32,recover:1.65,range:3.8,damage:17},
 kick:{label:'Удар с разворота',hint:'Отойди или уклонись',wind:.78,active:.36,recover:1.65,range:4,damage:17},
 charge:{label:'Таран',hint:'Уходи поперёк рывка',wind:1.08,active:.72,recover:2.0,range:2.3,damage:18},
 lunge:{label:'Выпад',hint:'Уклонись в сторону',wind:.86,active:.42,recover:1.65,range:3,damage:16},
 leap:{label:'Прыжок на Лиру',hint:'Из круга, затем прыгай через волну',wind:1.2,active:.90,recover:2.15,range:3.7,damage:20},
 spin:{label:'Круговая атака',hint:'Отойди за кольцо',wind:1.05,active:.65,recover:1.85,range:4.5,damage:17},
 slam:{label:'Удар сверху',hint:'Из круга или прыгай',wind:1.18,active:.38,recover:2.15,range:4.8,damage:20},
 stomp:{label:'Ударная волна',hint:'Перепрыгни кольцо',wind:1.10,active:.32,recover:1.85,range:3.3,damage:17},
 feint:{label:'Обманный замах',hint:'Следи за повторной отметкой',wind:1.12,active:.36,recover:1.75,range:3.8,damage:16},
 blink:{label:'Смена позиции',hint:'Следи за новым кругом',wind:1.15,active:.42,recover:1.85,range:3.7,damage:16},
 tentacle:{label:'Хлыст щупальцем',hint:'Уйди с отмеченного места',wind:1.05,active:.40,recover:1.65,range:3.1,damage:18},
 tentaclePair:{label:'Двойной удар щупальцами',hint:'Два круга — продолжай двигаться',wind:1.18,active:.72,recover:1.95,range:3.1,damage:14},
 ink:{label:'Чернильный веер',hint:'Уходи вбок или отражай гитарой',wind:1.08,active:1.05,recover:1.75,range:14,damage:8},
 shards:{label:'Осколки эпох',hint:'Обойди веер или отрази',wind:1.12,active:.75,recover:1.85,range:16,damage:8},
 burst:{label:'Пулемётная очередь',hint:'Уйди с линии огня',wind:1.05,active:1.3,recover:1.85,range:18,damage:7},
 laserSweep:{label:'Лазерная дуга',hint:'Пройди за спину роботу',wind:1.2,active:1.15,recover:1.95,range:18,damage:7},
 jetDash:{label:'Реактивный таран',hint:'Уклонись поперёк',wind:1.05,active:.65,recover:1.9,range:2.6,damage:18},
 pendulum:{label:'Маятниковый разворот',hint:'Отступи и контратакуй',wind:1.05,active:.65,recover:1.9,range:4.6,damage:17},
 gearFan:{label:'Веер шестерён',hint:'Обойди сектор или отрази',wind:1.15,active:.70,recover:1.9,range:16,damage:8},
 lattice:{label:'Разлом сетки',hint:'Уйди из обоих квадратов',wind:1.25,active:.72,recover:2.0,range:3,damage:17}
};
export const bossWorld=s=>s.isCity?'city':s.world|| (s.isRuins?'ruins':'portrait');
export const bossAction=(s,e)=>e?.boss1468?.action||null;
function floorAt(s,q,margin=.15){return s.geo.platforms.find(f=>!f.gone&&!f.objectTop&&!f.weaponCrate&&Math.abs(q.x-f.x)<=f.w/2-margin&&Math.abs(q.z-f.z)<=f.d/2-margin&&Math.abs((q.y||0)-f.h)<.5);}
function bounds(s,e){
 if(e.arena)return e.arena;
 const fs=s.geo.platforms.filter(f=>!f.gone&&!f.objectTop&&!f.weaponCrate&&Math.abs(f.h-(e.y||0))<.4);
 if(!fs.length)return {x:e.x,z:e.z,w:18,d:24,h:e.y||0};
 const left=Math.min(...fs.map(f=>f.x-f.w/2)),right=Math.max(...fs.map(f=>f.x+f.w/2)),back=Math.min(...fs.map(f=>f.z-f.d/2)),front=Math.max(...fs.map(f=>f.z+f.d/2));
 return{x:(left+right)/2,z:(back+front)/2,w:right-left,d:front-back,h:e.y||0};
}
function safePoint(s,e,q){const f=bounds(s,e),pad=e.bossType==='octopus'?2.4:1.1;const p={x:clamp(q.x,f.x-f.w/2+pad,f.x+f.w/2-pad),z:clamp(q.z,f.z-f.d/2+pad,f.z+f.d/2-pad),y:e.y||0};return floorAt(s,p)&&!s.geo.walls.some(w=>!w.towerRing&&(p.y<w.h)&&Math.abs(p.x-w.x)<w.w/2+.7&&Math.abs(p.z-w.z)<w.d/2+.7)?p:{x:e.x,z:e.z,y:e.y||0};}
function walk(s,e,q,speed,dt,route=false){const p=safePoint(s,e,q),d=dist(e,p),old={x:e.x,z:e.z},dir=route?enemyRouteDirection(e,p,s.geo,s.time):{x:(p.x-e.x)/Math.max(.01,d),z:(p.z-e.z)/Math.max(.01,d)};if(d>.03)move(e,dir.x*Math.min(d,speed*dt),dir.z*Math.min(d,speed*dt),s.geo.walls,.72);if(!floorAt(s,e,.10)){e.x=old.x;e.z=old.z;}e.vx=(e.x-old.x)/Math.max(.001,dt);e.vz=(e.z-old.z)/Math.max(.001,dt);}
function publishAction(s,e,a){if(s.world)e.worldAction=a;else s.bossAction=a;}
function fire(s,e,a,spread=0){
 if(s.shots.length>=48||blocked(e,a.target,s.geo.walls))return;
 const laser=[3,5].includes(s.world),speed=laser?12:8,yaw=angle(e,a.target)+spread,d=dist(e,a.target),y=e.y||0;
 s.shots.push({x:e.x+Math.sin(yaw)*1.0,z:e.z+Math.cos(yaw)*1.0,y,vx:Math.sin(yaw)*speed,vz:Math.cos(yaw)*speed,vy:((a.target.y||0)-y)/Math.max(.3,d/speed),life:2.8,damage:a.damage,reflectable:true,tactical:true,source:e.id,kind:laser?'laser':s.world===2?'water':'plasma'});s.emit(laser?'laserShot':'throw',{x:e.x,z:e.z,enemy:e.id});
}
function touch(s,e,a,center=e,r=a.range,damage=a.damage,knock=false,radial=false){
 const p=s.p,d=dist(center,p),height=Math.abs(p.y-(e.y||0)),facing=radial||d<.1||Math.cos(angle(e,p)-a.yaw)>.15;
 if(d<r&&height<(radial?.85:1.65)&&facing&&!blocked(e,p,s.geo.walls)){
  if(knock)knockPlayer(s,e,damage,4.5);else s.damage(damage);
 }
}
function start(s,e,kind){
 const b=e.boss1468,def=BOSS_MOVES[kind],phase=e.hp/e.max<.4?3:e.hp/e.max<.7?2:1;
 const target=safePoint(s,e,s.p),a={...def,kind,t:0,wind:Math.max(.65,def.wind-(phase-1)*.06),target:{...target,y:s.p.y},start:{x:e.x,z:e.z},yaw:angle(e,s.p),round:0,hit:false,x:target.x,z:target.z};
 if(kind==='leap')a.target.y=e.y||0;
 a.duration=a.wind+a.active;b.action=a;e.attackKind=kind;e.yaw=a.yaw;e.mode='windup';e.t=0;
 if(['charge','jetDash','lunge'].includes(kind)){const travel=Math.min(kind==='lunge'?4:9,Math.max(2,dist(e,target)-1));a.destination=safePoint(s,e,{x:e.x+Math.sin(a.yaw)*travel,z:e.z+Math.cos(a.yaw)*travel});}
 if(['blink','feint'].includes(kind)){const yaw=angle(s.p,e)+b.side*1.7;a.destination=safePoint(s,e,{x:s.p.x+Math.sin(yaw)*3.4,z:s.p.z+Math.cos(yaw)*3.4});}
 if(['tentaclePair','lattice'].includes(kind))a.second=safePoint(s,e,{x:target.x+Math.cos(a.yaw)*3.8*b.side,z:target.z-Math.sin(a.yaw)*3.8*b.side});
 publishAction(s,e,a);s.bossOpen=0;s.emit('bossWindup',{kind,enemy:e.id,x:e.x,z:e.z});
}
function tick(s,e,dt){
 const b=e.boss1468,profile=BOSS_STYLES[b.profile];e.hit=Math.max(0,(e.hit||0)-dt);e.vx=e.vz=0;
 if(e.hp<=0){e.dead=Math.max(0,(e.dead||0)-dt);e.airLift=0;e.mark=null;b.action=null;publishAction(s,e,null);return;}
 const p=s.p,d=dist(e,p);b.dodgeCD=Math.max(0,b.dodgeCD-dt);e.t=(e.t||0)+dt;
 const phase=e.hp/e.max<.4?3:e.hp/e.max<.7?2:1;if(s.phase!==phase){s.phase=phase;s.emit('phase');}
 // A scream may interrupt a telegraph. Honour the existing combat hook.
 if(b.action&&!s.world&&s.bossAction!==b.action){b.action=null;b.recover=Math.max(b.recover,s.bossOpen||1.8);}
 let a=b.action;
 if(a){
  a.t+=dt;e.t=a.t;e.yaw=a.yaw;e.mode=a.kind==='evade'?'evade':a.t<a.wind?'windup':'strike';s.bossOpen=0;
  if(a.kind==='evade'){walk(s,e,a.target,7,dt);e.yaw=angle(e,p);if(a.t>=.28){b.action=null;publishAction(s,e,null);b.cd=.30;}return;}
  if(a.t<a.wind){
   if(['blink','feint'].includes(a.kind)&&a.t>=a.wind*.40&&!a.shifted){a.shifted=true;const old={x:e.x,z:e.z};if(a.kind==='blink'&&!blocked(e,a.destination,s.geo.walls)){e.x=a.destination.x;e.z=a.destination.z;}else walk(s,e,a.destination,7,dt);a.yaw=angle(e,p);e.yaw=a.yaw;a.target=safePoint(s,e,p);a.target.y=p.y;a.x=a.target.x;a.z=a.target.z;s.emit('bossFeint',{enemy:e.id,x:old.x,z:old.z,kind:a.kind});}
   if(a.kind==='feint'&&a.shifted)walk(s,e,a.destination,3,dt);
   e.mark={...a.target,r:['spin','pendulum','slam','stomp'].includes(a.kind)?a.range:a.kind==='leap'?3.7:a.range>9?2.2:a.range};return;
  }
  e.mark=null;const u=clamp((a.t-a.wind)/a.active,0,1),elapsed=a.t-a.wind;
  if(['charge','jetDash','lunge'].includes(a.kind)){
   walk(s,e,a.destination,dist(a.start,a.destination)/a.active,dt);
   if(!a.hit&&dist(e,p)<a.range&&Math.abs(p.y-(e.y||0))<1.5&&!blocked(e,p,s.geo.walls)){a.hit=true;touch(s,e,a,e,a.range,a.damage,a.kind!=='lunge');}
  }else if(a.kind==='leap'){
   const q={x:a.start.x+(a.target.x-a.start.x)*u,z:a.start.z+(a.target.z-a.start.z)*u};e.x=q.x;e.z=q.z;e.airLift=Math.sin(u*Math.PI)*(s.world===2?4.8:3.4);
   if(u>=1&&!a.hit){a.hit=true;e.airLift=0;touch(s,e,a,e,3.7,a.damage,true,true);s.waves.push({x:e.x,z:e.z,y:e.y||0,r:.1,life:1.8,hit:false});s.emit('bossStrike',{kind:a.kind,enemy:e.id,x:e.x,z:e.z});}
  }else if(['burst','ink','laserSweep','shards','gearFan'].includes(a.kind)){
   const count=a.kind==='burst'?(phase===3?8:6):5,interval=a.active/(count+1);
   while(a.round<count&&elapsed>=a.round*interval){const spread=a.kind==='burst'?(a.round%2?1:-1)*.025:(a.round-(count-1)/2)*(a.kind==='laserSweep'?.17:.15);fire(s,e,a,spread);a.round++;}
  }else{
   const times=a.kind==='combo'?[.04,.32,.65]:['tentaclePair','lattice'].includes(a.kind)?[.03,.43]:['spin','pendulum'].includes(a.kind)?[.06,.38]:[.04];
   while(a.round<times.length&&elapsed>=times[a.round]){
    const i=a.round++,target=i&&a.second?a.second:a.target,radial=['spin','pendulum','slam','stomp'].includes(a.kind),targeted=['tentacle','tentaclePair','lattice'].includes(a.kind);
    touch(s,e,a,targeted?target:e,a.kind==='spin'&&s.world===2?8:a.range,a.damage,['slam','tentacle','tentaclePair','pendulum'].includes(a.kind),radial||targeted);
    if(['slam','stomp'].includes(a.kind))s.waves.push({x:e.x,z:e.z,y:e.y||0,r:.1,life:1.9,hit:false});
    a.hit=true;s.emit('bossStrike',{kind:a.kind,round:i,enemy:e.id,x:targeted?target.x:e.x,z:targeted?target.z:e.z});
   }
  }
  if(a.t>=a.duration){b.action=null;publishAction(s,e,null);e.airLift=0;b.recover=a.recover;b.cd=.55;e.mode='open';s.bossOpen=b.recover;s.emit('bossOpen',{enemy:e.id,x:e.x,z:e.z});}
  return;
 }
 e.mark=null;e.airLift=0;e.yaw=angle(e,p);
 if(b.recover>0){b.recover=Math.max(0,b.recover-dt);s.bossOpen=b.recover;e.mode='open';if(d<profile.range*.6){const yaw=angle(p,e);walk(s,e,{x:e.x+Math.sin(yaw),z:e.z+Math.cos(yaw)},.65,dt);}return;}
 s.bossOpen=0;b.cd=Math.max(0,b.cd-dt);
 if(d>30||Math.abs(p.y-(e.y||0))>7){e.mode='patrol';return;}
 if(s.attack&&s.attack.t<Math.min(.2,s.attack.hitAt||.2)&&d>2.0&&d<5.5&&b.dodgeCD<=0&&!blocked(e,p,s.geo.walls)){
  const yaw=e.yaw+b.side*Math.PI/2,target=safePoint(s,e,{x:e.x+Math.sin(yaw)*1.6,z:e.z+Math.cos(yaw)*1.6});
  b.side*=-1;b.dodgeCD=profile.evade;if(dist(e,target)>.65){b.action={kind:'evade',label:s.world===2?'Скольжение':s.world===3?'Рывок на тяге':'Шаг в сторону',hint:'Догони после рывка',t:0,wind:0,active:.28,duration:.28,target,yaw:e.yaw};publishAction(s,e,b.action);e.mode='evade';return;}
 }
 const yaw=angle(p,e)+b.side*.32,goal=d>profile.range+1.2?p:{x:p.x+Math.sin(yaw)*profile.range,z:p.z+Math.cos(yaw)*profile.range};
 e.mode=d>profile.range+1.2?'chase':'circle';walk(s,e,goal,profile.speed*(phase===3?1.12:1),dt,true);
 if(b.cd<=0&&d<22&&Math.abs(p.y-(e.y||0))<5&&!blocked(e,p,s.geo.walls)){
  let kind=profile.patterns[b.step++%profile.patterns.length];
  if(d>10&&!['leap','burst','laserSweep','ink','shards','gearFan','lattice','tentacle','tentaclePair'].includes(kind))kind=profile.patterns.find(k=>['charge','jetDash','leap','blink'].includes(k))||'leap';
  start(s,e,kind);
 }
}
export function attachBossStyles(s){
 if(s.bossStyles)return s;
 const base={enemy:s.enemy.bind(s),boss:s.boss.bind(s),load:s.load.bind(s),restore:s.restore.bind(s),hit:s.hit.bind(s),update:s.update.bind(s)};
 function configure(){for(const e of s.enemies){if(e.kind!=='boss'||e.hp<=0)continue;const key=bossWorld(s),profile=BOSS_STYLES[key];if(!profile)continue;
  if(e.bossRevision!==1468){const ratio=clamp(e.hp/Math.max(1,e.max||e.hp),0,1),max=key==='city'?480:key==='portrait'?520:key==='ruins'?600:e.max;e.max=max;e.hp=Math.max(1,Math.round(max*ratio));}
  const old=e.boss1468;e.bossRevision=1468;e.name=profile.name;e.boss1468={version:1,profile:key,step:clamp(Number(old?.step)||0,0,1e6),side:old?.side===-1?-1:1,dodgeCD:Math.max(2,clamp(Number(old?.dodgeCD)||0,0,8)),cd:1.2,recover:1.5,action:null};e.airLift=0;e.mark=null;e.mode='chase';
  s.bossAction=null;e.worldAction=null;s.bossOpen=1.5;
  // Old ruins snapshots could leave crumbling boss-floor tiles behind.
  if(key==='ruins')for(const f of s.geo.platforms){f.gone=false;f.fragile=false;f.age=0;}
 }}
 s.enemy=function(e,dt){if(e.kind!=='boss')return base.enemy(e,dt);if(!e.boss1468)configure();tick(this,e,clamp(dt,0,.035));};
 s.boss=function(e,dt){if(!e.boss1468)return base.boss(e,dt);tick(this,e,clamp(dt,0,.035));};
 s.hit=function(e,...args){if(e.kind==='boss'&&e.airLift>2.5)return;return base.hit(e,...args);};
 s.update=function(dt,input={}){const down=!this.world&&updatePlayerImpact(this,clamp(dt,0,.035));return base.update(dt,down?{...input,x:0,z:0,run:false}:input);};
 s.load=function(...args){const result=base.load(...args);configure();return result;};
 s.restore=function(...args){const result=base.restore(...args);configure();return result;};
 s.bossStyles={version:1,configure,profile:()=>BOSS_STYLES[bossWorld(s)]};configure();return s;
}
