import {routeFloor as oceanFloor,navigateRoute as pursue,walkRoute as walk,tickRouteJump as jumpEnemy} from './world-route-r1457.js?v=r1462';
import {worldBoss} from './world-combat-r1457.js?v=r1462';
export {routeFloor as oceanFloor} from './world-route-r1457.js?v=r1462';
import {move,blocked} from './portrait-core-r1295.js?v=r1462';
import {attackSlot,facesTarget} from './encounters-r1448.js?v=r1448';
import {downedEnemyR1447} from './combat-r1447.js?v=r1462';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inside=(f,p,margin=.05)=>Math.abs(p.x-f.x)<f.w/2-margin&&Math.abs(p.z-f.z)<f.d/2-margin;
const nearest=(list,p)=>list.slice().sort((a,b)=>distance(a,p)-distance(b,p))[0];


export function buildOcean(state,zone){
 const platforms=[],links=[],docks=[];
 const add=(x,z,w,d,h=0,extra={})=>{const f={x,z,w,d,h,node:platforms.length,...extra};platforms.push(f);return f;};
 const connect=(a,b,jump=false)=>links.push({a:a.node,b:b.node,jump});
 const hs=[[0,.4,.8,1.2,.8,.4,.9,1.4,1.8,1.2,.6,1.1,1.6,.8,0],[0,.3,.9,1.3,1.6,1,.4,.8,1.2,1.8,1.2,.6,.9,.4,0],[0,.7,1.4,.8,.2,.8,1.6,2.2,1.5,.8,1.4,.7,.1,0,0]][zone];
 const xs=Array.from({length:15},(_,i)=>i===14?0:Math.sin(i*(zone===1?.91:.65)+zone)*3);
 for(let i=0;i<15;i++){
  const last=docks.at(-1);let bridge;const gap=[4,9,12].includes(i);
  if(last&&!gap)bridge=add((last.x+xs[i])/2,i*10-5,Math.abs(xs[i]-last.x)+3.4,3.4,(last.h+hs[i])/2,{bridge:true,route:i-.5});
  const arena=zone===2&&i===14;const dock=add(xs[i],i*10,arena?28:10,arena?26:8,hs[i],{dock:i,route:i,arena});docks.push(dock);
  if(last){if(bridge){connect(last,bridge,Math.abs(last.h-bridge.h)>.28);connect(bridge,dock,Math.abs(dock.h-bridge.h)>.28);}else connect(last,dock,true);}
 }
 for(const n of [2,7,11]){const f=docks[n],safe=add(f.x+3.2,f.z,2.8,2.8,f.h+1.2,{refuge:true,route:n});connect(f,safe,true);}
 const gateDock=docks[8];state.geo={length:158,walls:[...(zone===1?[{x:gateDock.x,z:80,w:13,d:.65,h:gateDock.h+3.5,oceanGate:true}]:[]),...platforms.filter(f=>f.refuge).map(f=>({x:f.x,z:f.z,w:f.w,d:f.d,h:f.h,refugeNode:f.node}))],platforms};
 const indices=zone===2?[3,8,13]:[3,8,12];
 state.switches=indices.map((n,id)=>({x:docks[n].x-2,z:zone===1&&id===1?77.2:docks[n].z+1,w:1,d:1,h:docks[n].h,id,active:false,hp:42,maxHp:42,label:zone===0?'Линза '+(id+1):zone===1?['Насос','Шлюз','Сигнал спасателям'][id]:'Печать '+(id+1)}));
 state.exit={x:0,z:zone===2?149:142,y:0};
 state.ocean={version:2,links,docks:docks.map(f=>f.node),safeRoute:0,pump:{started:false,remaining:16,done:false},gateOpen:false};state.routeLinks=links;
 const guardNodes=zone===0?[2,3,4,6,7,8,10,11,12,13]:zone===1?[2,4,5,6,8,9,11,12,13]:[2,3,5,7,8,10,11,12];
 for(const [i,n]of guardNodes.entries()){const f=docks[n],e=state.spawn(i%3===1?'shadow':i%4===0?'double':'diver',f.x+(i%2?1.4:-1.4),f.z);const objectiveId=zone===0?n===3?0:n===8?1:n===12?2:-1:-1;Object.assign(e,{y:f.h,homeY:f.h,navPlatform:f.node,objectiveId,oceanRevision:2,worldRevision:1457,role:i%3===1?'harpoon':'diver'});}
 if(zone===2){const f=docks[14],e=state.spawn('boss',f.x+2,f.z+1);Object.assign(e,{y:f.h,homeY:f.h,navPlatform:f.node,oceanRevision:2,worldRevision:1457,bossType:'octopus',name:'Бездна · Восьмирукий',hurtRadius:2.0,hp:480,max:480,mode:'chase',cd:2,arena:f});state.bossOpen=1;}

 return docks;
}

export function oceanEnemy(state,e,dt){
 if(e.kind==='boss'){worldBoss(state,e,dt);return;}
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
 for(const index of [2,4,5]){const f=state.geo.platforms[state.ocean.docks[index]],e=state.spawn(index===2?'diver':index===4?'shadow':'double',f.x,f.z);Object.assign(e,{y:f.h,homeY:f.h,navPlatform:f.node,oceanRaider:true,oceanRevision:1,mode:'chase',cd:1.2});}
}
export function oceanInteract(state,q){
 if(!q||q.active)return false;
 if(state.zone===0){
  if(state.living.some(e=>e.objectiveId===q.id)){state.emit('notice',{text:'Сначала победи стража этой линзы. B — меч, удержание B — гитара.'});return true;}
  activate(state,q);return true;
 }
 if(state.zone===1){
  if(q.id===0){activate(state,q);state.ocean.pump={started:true,remaining:16,done:false};spawnRaiders(state);state.emit('notice',{text:'Насос запущен. Отбей нападающих, пока откачивается вода.'});return true;}
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
  if(q.hp<=0){activate(state,q);state.emit('notice',{text:'Печать разрушена: '+state.flags.length+'/3. Броня Восьмирукого ослабевает.'});}
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
 const boss=state.living.find(e=>e.kind==='boss');return boss?'Восьмирукий · броня снята':'Маяк восстановлен — C у портала';
}
export function oceanTarget(state){
 if(state.zone===1&&state.ocean.pump.started&&!state.ocean.pump.done){const e=nearest(state.living.filter(e=>e.oceanRaider),state.p);return e?{...e,label:'Нападающий'}:{...state.switches[0],label:'Защита насоса'};}
 const q=state.switches.find(q=>!q.active);
 if(q){const guard=state.zone===0?state.living.find(e=>e.objectiveId===q.id):null;return guard?{...guard,label:'Страж линзы '+(q.id+1)}:{...q,label:q.label};}
 const enemy=nearest(state.living,state.p);return enemy?{...enemy,label:enemy.kind==='boss'?'Восьмирукий':'Страж причала'}:{...state.exit,label:'Выход'};
}
export function updateOcean(state,dt){
 const pump=state.ocean.pump;
 if(pump.started&&!pump.done){pump.remaining=Math.max(0,pump.remaining-dt);if(pump.remaining===0&&!state.living.some(e=>e.oceanRaider)){pump.done=true;state.emit('notice',{text:'Вода откачана. Иди к шлюзу и нажми C.'});state.emit('puzzle');}}
 for(const q of state.switches)q.flash=Math.max(0,(q.flash||0)-dt);
 if(state.p.grounded){const floor=oceanFloor(state,state.p);if(floor&&floor.route>=state.ocean.safeRoute){state.ocean.safeRoute=floor.route;state.safe={x:state.p.x,y:state.p.y,z:state.p.z};state.safeIndex=floor.node;}}
 if(state.zone!==2){const phase=state.time%18,warn=phase<1.8,active=phase>=1.8&&phase<12.8;state.surge={warn,active,z:active?-3+(phase-1.8)*14:-3};if(active&&Math.abs(state.p.z-state.surge.z)<.9&&state.p.y<(oceanFloor(state,state.p)?.h||0)+1.05&&!oceanFloor(state,state.p)?.refuge)state.damage(12);}
 else state.surge=null;
}

export function restoreOcean(state,saved){
 const old=!saved?.oceanR1451;
 const data=saved?.oceanR1451;
 if(data?.version===1){state.ocean.safeRoute=clamp(Number(data.safeRoute)||0,0,14);const p=data.pump||{};state.ocean.pump={started:!!p.started,remaining:clamp(Number(p.remaining)||0,0,16),done:!!p.done};for(const q of state.switches){const hp=data.anchorHp?.[q.id];if(Number.isFinite(hp))q.hp=clamp(hp,0,42);if(q.active)q.hp=0;}}
 else if(state.zone===1&&state.flags.includes(0))state.ocean.pump={started:true,remaining:0,done:true};
 if(state.zone===1&&state.flags.includes(1)){state.ocean.gateOpen=true;state.geo.walls=state.geo.walls.filter(w=>!w.oceanGate);}
 for(const e of state.enemies){
  delete e.anchor;e.navJump=null;e.routeUntil=0;e.oceanAction=null;
  if(e.kind==='boss'){
   if(e.worldRevision!==1457){const fraction=e.hp/Math.max(1,e.max||380);e.hp=Math.max(0,Math.round(fraction*480));e.max=480;const f=state.geo.platforms[state.ocean.docks.at(-1)];e.x=f.x+2;e.z=f.z+1;}
   e.arena=state.geo.platforms[state.ocean.docks.at(-1)];
  }
  const f=oceanFloor(state,e)||nearest(state.geo.platforms.filter(f=>!f.bridge&&!f.refuge),e);if(f){if(!inside(f,e)){e.x=f.x;e.z=f.z;}e.y=e.homeY=f.h;e.navPlatform=f.node;}e.oceanRevision=2;e.worldRevision=1457;if(e.kind==='boss'){e.bossType='octopus';e.name='Бездна · Восьмирукий';e.hurtRadius=2.0;}
 }
 if(old&&!state.layoutR1457&&state.zone===0){const targets=state.enemies.filter(e=>e.kind!=='boss').sort((a,b)=>a.z-b.z);for(let i=0;i<3;i++){const e=targets[i];if(e)e.objectiveId=i;}}
 const floor=oceanFloor(state,state.p);if(!floor||Math.abs(floor.h-state.p.y)>.3){const f=nearest(state.geo.platforms.filter(f=>!f.refuge&&!f.bridge),state.p);Object.assign(state.p,{x:f.x,z:f.z,y:f.h,vy:0,vx:0,vz:0,grounded:true,inv:2});}
 const safe=oceanFloor(state,state.safe);if(!safe)state.safe={x:state.p.x,y:state.p.y,z:state.p.z};
 if(state.zone===1&&state.ocean.pump.started&&!state.ocean.pump.done&&!state.enemies.some(e=>e.oceanRaider))spawnRaiders(state);
}
export function oceanSnapshot(state){return{version:1,safeRoute:state.ocean.safeRoute,pump:{...state.ocean.pump},anchorHp:state.switches.map(q=>q.hp)};}
