import {move,blocked} from './portrait-core-r1295.js?v=r1466';
import {attackSlot,facesTarget} from './encounters-r1448.js?v=r1448';
import {downedEnemyR1447} from './combat-r1447.js?v=r1466';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inside=(f,p,margin=.05)=>Math.abs(p.x-f.x)<f.w/2-margin&&Math.abs(p.z-f.z)<f.d/2-margin;
const nearest=(list,p)=>list.slice().sort((a,b)=>distance(a,p)-distance(b,p))[0];
export function oceanFloor(state,p){return state.geo.platforms.filter(f=>inside(f,p)).sort((a,b)=>Math.abs(a.h-(p.y||0))-Math.abs(b.h-(p.y||0)))[0]||null;}

export function buildOcean(state,zone){
 const platforms=[],links=[],docks=[];
 const add=(x,z,w,d,h=0,extra={})=>{const f={x,z,w,d,h,node:platforms.length,...extra};platforms.push(f);return f;};
 const connect=(a,b,jump=false)=>links.push({a:a.node,b:b.node,jump});
 const xs=[[-2,2,-1,3,-2,2,-2,2,0],[0,-3,2,-2,3,-1,2,-2,0],[0,2,-2,2,-1,2,0,0,0]][zone];
 for(let i=0;i<9;i++){
  const last=docks.at(-1);let bridge;
  if(last&&![3,6].includes(i))bridge=add((last.x+xs[i])/2,i*10-5,Math.abs(xs[i]-last.x)+3.4,3.4,0,{bridge:true,route:i-.5});
  const dock=add(xs[i],i*10,zone===2&&i===8?22:10,zone===2&&i===8?22:8,0,{dock:i,route:i});docks.push(dock);
  if(last){if(bridge){connect(last,bridge);connect(bridge,dock);}else connect(last,dock,true);}
 }
 for(const n of [1,4,7]){const f=docks[n],safe=add(f.x+3.2,f.z,2.8,2.8,1.2,{refuge:true,route:n});connect(f,safe,true);}
 state.geo={length:94,walls:[...(zone===1?[{x:docks[4].x,z:40,w:13,d:.65,h:3.5,oceanGate:true}]:[]),...platforms.filter(f=>f.refuge).map(f=>({x:f.x,z:f.z,w:f.w,d:f.d,h:f.h,refugeNode:f.node}))],platforms};
 const indices=zone===2?[2,5,8]:[2,4,7];
 state.switches=indices.map((n,id)=>({x:docks[n].x-2,z:zone===1&&id===1?37.2:docks[n].z+1,w:1,d:1,h:0,id,active:false,hp:42,maxHp:42,label:zone===0?'Линза '+(id+1):zone===1?['Насос','Шлюз','Сигнал спасателям'][id]:'Печать '+(id+1)}));
 state.exit={x:0,z:86,y:0};
 state.ocean={version:1,links,docks:docks.map(f=>f.node),safeRoute:0,pump:{started:false,remaining:12,done:false},gateOpen:false};
 const guards=zone===0?[[2,'mask',0],[3,'shadow',-1],[5,'double',1],[7,'mask',2]]:zone===1?[[3,'shadow',-1],[6,'double',-1],[7,'mask',-1]]:[[3,'mask',-1],[6,'shadow',-1]];
 for(const [n,kind,objectiveId]of guards){const f=docks[n],e=state.spawn(kind,f.x+1.3,f.z);Object.assign(e,{y:0,homeY:0,navPlatform:f.node,objectiveId,oceanRevision:1});}
 if(zone===2){const f=docks[8],e=state.spawn('boss',f.x+2,f.z+1);Object.assign(e,{y:0,homeY:0,navPlatform:f.node,oceanRevision:1,hp:380,max:380,mode:'chase',cd:1.2,arena:f});state.bossOpen=1;}
 return docks;
}

function route(state,start,goal){
 const previous=new Map([[start,null]]),queue=[start];
 for(let index=0;index<queue.length;index++){
  const node=queue[index];if(node===goal)break;
  for(const edge of state.ocean.links){const next=edge.a===node?edge.b:edge.b===node?edge.a:null;if(next===null||previous.has(next))continue;
   const a=state.geo.platforms[node],b=state.geo.platforms[next],walls=state.geo.walls.filter(w=>w.refugeNode!==node&&w.refugeNode!==next);if(blocked(a,b,walls))continue;
   previous.set(next,node);queue.push(next);
  }
 }
 if(!previous.has(goal))return [];
 const path=[];for(let node=goal;node!==null;node=previous.get(node))path.unshift(node);return path;
}
function edgePoint(from,to){const dx=to.x-from.x,dz=to.z-from.z,n=Math.hypot(dx,dz)||1,x=dx/n,z=dz/n,t=Math.min(Math.abs(x)>.001?(from.w/2-.55)/Math.abs(x):Infinity,Math.abs(z)>.001?(from.d/2-.55)/Math.abs(z):Infinity);return{x:from.x+x*t,z:from.z+z*t,y:from.h};}
function jumpPoints(from,to){
 if(Math.abs(from.h-to.h)>.2&&inside(from,to,-.1)){
  return from.h<to.h?{from:{x:to.x,z:to.z-1.9,y:from.h},to:{x:to.x,z:to.z,y:to.h}}:{from:{x:from.x,z:from.z,y:from.h},to:{x:from.x,z:from.z+2.1,y:to.h}};
 }
 return{from:edgePoint(from,to),to:edgePoint(to,from)};
}
function walk(state,e,target,speed,dt){
 const d=distance(e,target);if(d<.04)return;
 const old={x:e.x,z:e.z};move(e,(target.x-e.x)/d*Math.min(d,speed*dt),(target.z-e.z)/d*Math.min(d,speed*dt),state.geo.walls,.4);
 const floor=oceanFloor(state,e);if(!floor||Math.abs(floor.h-(e.y||0))>.3){e.x=old.x;e.z=old.z;}else{e.y=floor.h;e.navPlatform=floor.node;}
}
function pursue(state,e,target,dt,speed=3.1){
 const current=oceanFloor(state,e)||state.geo.platforms[e.navPlatform],goal=oceanFloor(state,target)||nearest(state.geo.platforms.filter(f=>!f.refuge),target);
 if(!current||!goal)return;
 if(current.node===goal.node){walk(state,e,target,speed,dt);return;}
 if(e.routeGoal!==goal.node||e.routeStart!==current.node||state.time>(e.routeUntil||0)){
  e.routeGoal=goal.node;e.routeStart=current.node;e.routeUntil=state.time+.65;e.route=route(state,current.node,goal.node);
 }
 const next=state.geo.platforms[e.route?.[1]];if(!next)return;
 const edge=state.ocean.links.find(q=>q.a===current.node&&q.b===next.node||q.b===current.node&&q.a===next.node);
 if(edge?.jump){
  const points=jumpPoints(current,next);
  if(distance(e,points.from)>.28){walk(state,e,points.from,speed,dt);return;}
  const gap=distance(points.from,points.to),walls=state.geo.walls.filter(w=>w.refugeNode!==current.node&&w.refugeNode!==next.node);if(gap>4.6||blocked(points.from,points.to,walls))return;
  e.navJump={from:{x:e.x,z:e.z,y:e.y||0},to:points.to,node:next.node,t:0,duration:.52+gap/8};e.mode='leap';e.t=0;
 }else walk(state,e,next,speed,dt);
}
function jumpEnemy(state,e,dt){
 const jump=e.navJump;if(!jump)return false;
 jump.t+=dt;const u=clamp(jump.t/jump.duration,0,1);
 e.x=jump.from.x+(jump.to.x-jump.from.x)*u;e.z=jump.from.z+(jump.to.z-jump.from.z)*u;e.y=jump.from.y+(jump.to.y-jump.from.y)*u+Math.sin(Math.PI*u)*1.5;e.mode='leap';
 if(u>=1){e.y=jump.to.y;e.navPlatform=jump.node;e.navJump=null;e.routeUntil=0;e.mode='chase';e.cd=Math.max(.4,e.cd||0);}
 return true;
}

export function oceanEnemy(state,e,dt){
 if(e.kind==='boss'){oceanBoss(state,e,dt);return;}
 e.hit=Math.max(0,(e.hit||0)-dt);
 if(e.hp<=0){e.dead=Math.max(0,(e.dead||0)-dt);return;}
 if(e.navJump){downedEnemyR1447(state,e,dt);e.cd-=dt;e.t+=dt;jumpEnemy(state,e,dt);return;}
 if(downedEnemyR1447(state,e,dt))return;
 e.cd-=dt;e.t+=dt;e.throwCD=(Number.isFinite(e.throwCD)?e.throwCD:2+e.id*.12)-dt;
 if(jumpEnemy(state,e,dt))return;
 if(e.airT>0){e.airT=Math.max(0,e.airT-dt);e.airHeight=Math.max(0,(e.airHeight||0)-dt*3.2);return;}
 const p=state.p,d=distance(e,p),height=Math.abs((e.y||0)-p.y),los=!blocked(e,p,state.geo.walls);
 if(!['windup','strike','aim','throw'].includes(e.mode))e.yaw=Math.atan2(p.x-e.x,p.z-e.z);
 if(e.mode==='stagger'){if(e.t>.35){e.mode='chase';e.t=0;}return;}
 if(e.mode==='aim'){
  if(e.t>=.65){const angle=e.throwAim;state.shots.push({x:e.x+Math.sin(angle)*.7,z:e.z+Math.cos(angle)*.7,y:e.y||0,vx:Math.sin(angle)*7.5,vz:Math.cos(angle)*7.5,life:3.2,reflectable:true,source:e.id,damage:11});e.mode='throw';e.t=0;e.throwCD=3.6;state.emit('throw',{x:e.x,z:e.z});}return;
 }
 if(e.mode==='throw'&&e.t<.45)return;
 if(e.mode==='windup'){if(e.t>.72){e.mode='strike';e.t=0;e.contact=false;}return;}
 if(e.mode==='strike'){
  if(!e.contact&&e.t>.16){e.contact=true;if(d<(e.attackKind==='kick'?2.7:2.2)&&height<1.4&&los&&facesTarget(e,p,.45))state.damage(e.attackKind==='kick'?17:e.kind==='double'?16:12);}
  if(e.t>.48){e.mode='retreat';e.t=0;e.cd=1.15;}return;
 }
 if(e.mode==='retreat'&&e.t<.45){walk(state,e,{x:e.x+(e.x-p.x)/Math.max(.1,d)*2,z:e.z+(e.z-p.z)/Math.max(.1,d)*2},2.4,dt);return;}
 if(d<2.05&&height<1.35&&los&&e.cd<=0&&attackSlot(state,e)){
  e.attackStep=(e.attackStep||0)+1;e.attackKind=e.attackStep%3===0?'kick':e.attackStep%2?'right':'left';e.mode='windup';e.t=0;e.yaw=Math.atan2(p.x-e.x,p.z-e.z);return;
 }
 if(e.kind==='shadow'&&d>4.5&&d<11.5&&height<1.5&&los&&e.throwCD<=0&&attackSlot(state,e)){
  e.throwAim=e.yaw;e.mode='aim';e.t=0;state.emit('aimWarn',{x:e.x,z:e.z});return;
 }
 if(d<28){e.mode='chase';if(d>1.5||height>1.35)pursue(state,e,p,dt,e.kind==='shadow'?3.5:3.15);}
 else{e.mode='patrol';const f=state.geo.platforms[e.navPlatform]||oceanFloor(state,e);if(f)walk(state,e,{x:f.x+Math.sin(state.time*.6+e.id)*1.3,z:f.z+Math.cos(state.time*.6+e.id)*1.3},1.35,dt);}
}

function activate(state,q){
 if(q.active)return;
 q.active=true;q.hp=0;state.flags.push(q.id);state.p.hp=Math.min(100,state.p.hp+12);state.p.energy=Math.min(100,state.p.energy+20);state.crystals+=4;state.emit('puzzle');state.emit('notice',{text:q.label+' · готово · +4 кристалла'});
}
function spawnRaiders(state){
 for(const index of [1,3]){const f=state.geo.platforms[state.ocean.docks[index]],e=state.spawn(index===1?'mask':'double',f.x,f.z);Object.assign(e,{y:f.h,homeY:f.h,navPlatform:f.node,oceanRaider:true,oceanRevision:1,mode:'chase',cd:1.2});}
}
export function oceanInteract(state,q){
 if(!q||q.active)return false;
 if(state.zone===0){
  if(state.living.some(e=>e.objectiveId===q.id)){state.emit('notice',{text:'Сначала победи стража этой линзы. B — меч, удержание B — гитара.'});return true;}
  activate(state,q);return true;
 }
 if(state.zone===1){
  if(q.id===0){activate(state,q);state.ocean.pump={started:true,remaining:12,done:false};spawnRaiders(state);state.emit('notice',{text:'Насос запущен. Отбей нападающих, пока откачивается вода.'});return true;}
  if(q.id===1&&!state.ocean.pump.done){state.emit('notice',{text:state.ocean.pump.started?'Насос ещё работает: отбей нападающих.':'Сначала запусти насос на первом причале.'});return true;}
  if(q.id===2&&!state.switches[1].active){state.emit('notice',{text:'Сначала открой шлюз.'});return true;}
  activate(state,q);if(q.id===1){state.ocean.gateOpen=true;state.geo.walls=state.geo.walls.filter(w=>!w.oceanGate);}return true;
 }
 state.emit('notice',{text:'Разруби печать мечом: короткое B. Удержание B — гитара.'});return true;
}
export function strikeOceanObjects(state,attack,damage,range){
 if(state.world!==2||state.zone!==2)return;
 for(const q of state.switches){
  const d=distance(state.p,q),dot=((q.x-state.p.x)*Math.sin(state.p.yaw)+(q.z-state.p.z)*Math.cos(state.p.yaw))/Math.max(.01,d);
  if(q.active||d>range||Math.abs(state.p.y-q.h)>1.6||!attack.bladeSpin&&dot<.05||blocked(state.p,q,state.geo.walls))continue;
  attack.objects??=new Set();if(attack.objects.has(q.id))continue;attack.objects.add(q.id);
  q.hp=Math.max(0,q.hp-damage);q.flash=.2;state.emit('hit',{x:q.x,z:q.z,damage,kind:'slash',strength:.65,enemy:'anchor-'+q.id});
  if(q.hp<=0){activate(state,q);state.emit('notice',{text:'Печать разрушена: '+state.flags.length+'/3. Броня Смотрителя ослабевает.'});}
 }
}

export function oceanObjective(state){
 if(state.zone===0)return state.flags.length<3?'Верни линзы маяка: '+state.flags.length+'/3 · победи стражей, затем C':state.living.length?'Причалы: осталось стражей '+state.living.length:'Линзы собраны — к воротам маяка';
 if(state.zone===1){const pump=state.ocean.pump;
  if(!pump.started)return 'Запусти насос · C у первого пульта';
  if(!pump.done)return 'Защити насос: '+Math.ceil(pump.remaining)+' с · нападающих '+state.living.filter(e=>e.oceanRaider).length;
  if(!state.switches[1].active)return 'Насос готов — открой шлюз кнопкой C';
  if(!state.switches[2].active)return 'Подай сигнал спасателям · C у последнего пульта';
  return state.living.length?'Путь к маяку: осталось стражей '+state.living.length:'Спасатели в пути — выход открыт';
 }
 if(state.flags.length<3)return 'Разруби печати: '+state.flags.length+'/3 · короткое B — меч';
 const boss=state.living.find(e=>e.kind==='boss');return boss?'Смотритель прилива · броня снята':'Маяк восстановлен — C у портала';
}
export function oceanTarget(state){
 if(state.zone===1&&state.ocean.pump.started&&!state.ocean.pump.done){const e=nearest(state.living.filter(e=>e.oceanRaider),state.p);return e?{...e,label:'Нападающий'}:{...state.switches[0],label:'Защита насоса'};}
 const q=state.switches.find(q=>!q.active);
 if(q){const guard=state.zone===0?state.living.find(e=>e.objectiveId===q.id):null;return guard?{...guard,label:'Страж линзы '+(q.id+1)}:{...q,label:q.label};}
 const enemy=nearest(state.living,state.p);return enemy?{...enemy,label:enemy.kind==='boss'?'Смотритель прилива':'Страж причала'}:{...state.exit,label:'Выход'};
}
export function updateOcean(state,dt){
 const pump=state.ocean.pump;
 if(pump.started&&!pump.done){pump.remaining=Math.max(0,pump.remaining-dt);if(pump.remaining===0&&!state.living.some(e=>e.oceanRaider)){pump.done=true;state.emit('notice',{text:'Вода откачана. Иди к шлюзу и нажми C.'});state.emit('puzzle');}}
 for(const q of state.switches)q.flash=Math.max(0,(q.flash||0)-dt);
 if(state.p.grounded){const floor=oceanFloor(state,state.p);if(floor&&floor.route>=state.ocean.safeRoute){state.ocean.safeRoute=floor.route;state.safe={x:state.p.x,y:state.p.y,z:state.p.z};state.safeIndex=floor.node;}}
 if(state.zone!==2){const phase=state.time%15,warn=phase<1.8,active=phase>=1.8&&phase<7.8;state.surge={warn,active,z:active?-3+(phase-1.8)*15:-3};if(active&&Math.abs(state.p.z-state.surge.z)<.9&&state.p.y<1.05)state.damage(12);}
 else state.surge=null;
}

function bossStep(state,e,target,speed,dt){const arena=e.arena||state.geo.platforms[state.ocean.docks[8]],d=distance(e,target);if(d>.02){e.x+=(target.x-e.x)/d*Math.min(speed*dt,d);e.z+=(target.z-e.z)/d*Math.min(speed*dt,d);}e.x=clamp(e.x,arena.x-arena.w/2+1.1,arena.x+arena.w/2-1.1);e.z=clamp(e.z,arena.z-arena.d/2+1.1,arena.z+arena.d/2-1.1);}
function oceanBoss(state,e,dt){
 e.hit=Math.max(0,(e.hit||0)-dt);if(e.hp<=0){e.dead=Math.max(0,(e.dead||0)-dt);return;}
 state.bossOpen=1;e.t+=dt;e.cd=Math.max(0,(e.cd||0)-dt);const p=state.p,d=distance(e,p),rage=e.hp<e.max*.45;let a=e.oceanAction;
 if(a){
  a.t+=dt;e.mode=a.t<a.wind?'windup':a.t<a.wind+a.active?'strike':'recover';
  if(a.t<a.wind){e.mark={x:a.kind==='slam'?e.x:e.x+Math.sin(a.yaw)*2.8,z:a.kind==='slam'?e.z:e.z+Math.cos(a.yaw)*2.8,y:0,r:a.kind==='slam'?3.8:1.7};return;}
  e.mark=null;
  if(!a.hit){a.hit=true;
   if(a.kind==='slam'){state.waves.push({x:e.x,z:e.z,r:.1,life:2.3,hit:false});if(d<3.4&&p.y<.8)state.damage(22);state.emit('bossStrike',{x:e.x,z:e.z});}
   if(a.kind==='volley')for(const offset of [-.22,0,.22])state.shots.push({x:e.x,z:e.z,y:0,vx:Math.sin(a.yaw+offset)*7.8,vz:Math.cos(a.yaw+offset)*7.8,life:3.2,reflectable:true,source:e.id,damage:12});
   if(a.kind==='cut'&&d<3.1&&p.y<1.2&&facesTarget(e,p,.45))state.damage(20);
  }
  if(a.kind==='charge'&&a.t<a.wind+a.active){bossStep(state,e,{x:e.x+Math.sin(a.yaw)*10,z:e.z+Math.cos(a.yaw)*10},rage?11:9.5,dt);if(!a.contact&&distance(e,p)<2.15&&p.y<1.1){a.contact=true;state.damage(22);}}
  if(a.t>=a.wind+a.active+a.recover){e.oceanAction=null;e.mode='chase';e.cd=rage?.7:1.15;}
  return;
 }
 e.mark=null;e.yaw=Math.atan2(p.x-e.x,p.z-e.z);if(d>22){e.mode='patrol';return;}
 if(d>3.0){e.mode='chase';bossStep(state,e,p,rage?3.6:2.8,dt);}
 if(e.cd<=0&&d<15){const step=(e.oceanStep||0)+1;e.oceanStep=step;const kind=step%4===0?'volley':d>7?'charge':step%3===0?'slam':'cut';e.attackKind=kind==='cut'?'right':kind==='charge'?'kick':'left';e.oceanAction={kind,t:0,yaw:e.yaw,wind:kind==='charge'?1:kind==='slam'?1.05:.82,active:kind==='charge'?.56:.28,recover:rage?1.15:1.5,hit:false};e.mode='windup';e.t=0;state.emit('bossWindup',{kind});}
}

export function restoreOcean(state,saved){
 const old=!saved?.oceanR1451;
 const data=saved?.oceanR1451;
 if(data?.version===1){state.ocean.safeRoute=clamp(Number(data.safeRoute)||0,0,8);const p=data.pump||{};state.ocean.pump={started:!!p.started,remaining:clamp(Number(p.remaining)||0,0,12),done:!!p.done};for(const q of state.switches){const hp=data.anchorHp?.[q.id];if(Number.isFinite(hp))q.hp=clamp(hp,0,42);if(q.active)q.hp=0;}}
 else if(state.zone===1&&state.flags.includes(0))state.ocean.pump={started:true,remaining:0,done:true};
 if(state.zone===1&&state.flags.includes(1)){state.ocean.gateOpen=true;state.geo.walls=state.geo.walls.filter(w=>!w.oceanGate);}
 for(const e of state.enemies){
  delete e.anchor;e.navJump=null;e.routeUntil=0;e.oceanAction=null;
  if(e.kind==='boss'){
   if(!e.oceanRevision){const fraction=e.hp/Math.max(1,e.max||320);e.hp=Math.max(0,Math.round(fraction*380));e.max=380;const f=state.geo.platforms[state.ocean.docks[8]];e.x=f.x+2;e.z=f.z+1;}
   e.arena=state.geo.platforms[state.ocean.docks[8]];
  }
  const f=oceanFloor(state,e)||nearest(state.geo.platforms.filter(f=>!f.bridge&&!f.refuge),e);if(f){if(!inside(f,e)){e.x=f.x;e.z=f.z;}e.y=e.homeY=f.h;e.navPlatform=f.node;}e.oceanRevision=1;
 }
 if(old&&state.zone===0){const targets=state.enemies.filter(e=>e.kind!=='boss').sort((a,b)=>a.z-b.z);for(let i=0;i<3;i++){const e=targets[i];if(e)e.objectiveId=i;}}
 const floor=oceanFloor(state,state.p);if(!floor||Math.abs(floor.h-state.p.y)>.3){const f=nearest(state.geo.platforms.filter(f=>!f.refuge&&!f.bridge),state.p);Object.assign(state.p,{x:f.x,z:f.z,y:f.h,vy:0,vx:0,vz:0,grounded:true,inv:2});}
 const safe=oceanFloor(state,state.safe);if(!safe)state.safe={x:state.p.x,y:state.p.y,z:state.p.z};
 if(state.zone===1&&state.ocean.pump.started&&!state.ocean.pump.done&&!state.enemies.some(e=>e.oceanRaider))spawnRaiders(state);
}
export function oceanSnapshot(state){return{version:1,safeRoute:state.ocean.safeRoute,pump:{...state.ocean.pump},anchorHp:state.switches.map(q=>q.hp)};}
