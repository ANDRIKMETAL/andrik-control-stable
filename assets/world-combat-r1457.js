import {blocked} from './portrait-core-r1295.js?v=r1472';
import {attackSlot,facesTarget} from './encounters-r1448.js?v=r1472';
import {downedEnemyR1447} from './combat-r1447.js?v=r1472';
import {routeFloor,navigateRoute,tickRouteJump,walkRoute} from './world-route-r1457.js?v=r1472';
import {knockPlayer} from './player-impact-r1457.js?v=r1472';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function shot(state,e,target,{speed=10,damage=7,spread=0,laser=false}={}){
 const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||1,y=e.y||0,angle=Math.atan2(dx,dz)+spread;
 state.shots.push({x:e.x+Math.sin(angle)*.65,z:e.z+Math.cos(angle)*.65,y,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,vy:((target.y||0)-y)/Math.max(.25,d/speed),life:2.8,reflectable:true,source:e.id,damage,kind:laser?'laser':'plasma'});
 state.emit('laserShot',{x:e.x,z:e.z});
}
export function spaceEnemy(state,e,dt){
 if(e.kind==='boss')return worldBoss(state,e,dt);
 e.hit=Math.max(0,(e.hit||0)-dt);if(e.hp<=0){e.dead=Math.max(0,(e.dead||0)-dt);return;}
 if(e.navJump){downedEnemyR1447(state,e,dt);tickRouteJump(state,e,dt);return;}
 if(downedEnemyR1447(state,e,dt))return;
 const p=state.p,d=dist(e,p),height=Math.abs((e.y||0)-p.y),los=!blocked(e,p,state.geo.walls);e.t+=dt;e.cd=Math.max(0,(e.cd||0)-dt);
 if(e.mode==='stagger'){if(e.t>.34){e.mode='chase';e.t=0;}return;}
 if(e.mode==='aim'){
  if(e.t>=.85){e.mode='throw';e.t=0;e.round=0;e.fireAt=0;}return;
 }
 if(e.mode==='throw'){
  if(e.round<e.rounds&&e.t>=e.fireAt){shot(state,e,e.lock,{speed:e.kind==='drone'?12:10,damage:e.kind==='drone'?6:7,spread:(e.round%2?1:-1)*.018,laser:e.kind==='drone'});e.round++;e.fireAt+=.18;}
  if(e.t>e.rounds*.18+.50){e.mode='retreat';e.t=0;e.cd=e.kind==='drone'?2.4:2.1;}return;
 }
 if(e.mode==='windup'){if(e.t>.7){e.mode='strike';e.t=0;e.contact=false;}return;}
 if(e.mode==='strike'){if(!e.contact&&e.t>.16){e.contact=true;if(d<2.55&&height<1.6&&los&&facesTarget(e,p,.4))state.damage(e.kind==='robot'?15:10);}if(e.t>.45){e.mode='retreat';e.t=0;e.cd=1.2;}return;}
 if(e.mode==='retreat'&&e.t<.65){const angle=Math.atan2(p.x-e.x,p.z-e.z)+(e.id%2?1:-1)*Math.PI/2;walkRoute(state,e,{x:e.x+Math.sin(angle)*2,z:e.z+Math.cos(angle)*2},2.3,dt);return;}
 e.yaw=Math.atan2(p.x-e.x,p.z-e.z);
 const ranged=e.kind==='astronaut'||e.kind==='drone';
 if(ranged&&d<14&&d>2.2&&height<6&&los&&e.cd<=0&&attackSlot(state,e)){e.mode='aim';e.t=0;e.lock={x:p.x,z:p.z,y:p.y};e.rounds=e.kind==='drone'?3:2;state.emit('aimWarn',{x:e.x,z:e.z});return;}
 if(d<2.15&&height<1.5&&e.cd<=0&&los&&attackSlot(state,e)){e.mode='windup';e.t=0;e.attackKind=e.id%2?'right':'kick';return;}
 e.mode=d<34?'chase':'patrol';if(d<34&&(d>(ranged?5:1.7)||height>1.5))navigateRoute(state,e,p,dt,e.kind==='drone'?4.5:e.kind==='robot'?3.2:3.5);
 else if(d>=34){const f=routeFloor(state,e);if(f)walkRoute(state,e,{x:f.x+Math.sin(state.time+e.id),z:f.z+Math.cos(state.time+e.id)},1.3,dt);}
}
function stepBoss(state,e,target,speed,dt){
 const arena=e.arena||state.geo.platforms.at(-1),d=dist(e,target)||1;e.x+=(target.x-e.x)/d*Math.min(d,speed*dt);e.z+=(target.z-e.z)/d*Math.min(d,speed*dt);
 const pad=e.bossType==='octopus'?3:1.3;e.x=clamp(e.x,arena.x-arena.w/2+pad,arena.x+arena.w/2-pad);e.z=clamp(e.z,arena.z-arena.d/2+pad,arena.z+arena.d/2-pad);
}
export function worldBoss(state,e,dt){
 e.hit=Math.max(0,(e.hit||0)-dt);if(e.hp<=0){e.dead=Math.max(0,(e.dead||0)-dt);e.airLift=0;return;}
 const p=state.p,d=dist(e,p),base=e.homeY||0,oct=e.bossType==='octopus',mech=e.bossType==='warMech',rage=e.hp<e.max*.45;state.bossOpen=1;e.t+=dt;e.cd=Math.max(0,(e.cd||0)-dt);let a=e.worldAction;
 if(a){
  a.t+=dt;e.mode=a.t<a.wind?'windup':a.t<a.wind+a.active?'strike':'recover';e.yaw=a.yaw;
  if(a.t<a.wind){e.mark={x:a.target.x,z:a.target.z,y:a.target.y,r:a.kind==='leap'?4.2:a.kind==='slam'?5:2.8};return;}
  e.mark=null;
  if(a.kind==='leap'){
   const u=clamp((a.t-a.wind)/a.active,0,1);if(u<1){e.x=a.start.x+(a.target.x-a.start.x)*u;e.z=a.start.z+(a.target.z-a.start.z)*u;e.airLift=Math.sin(u*Math.PI)*(oct?5.2:4.2);}
   else if(!a.hit){a.hit=true;e.x=a.target.x;e.z=a.target.z;e.airLift=0;state.waves.push({x:e.x,z:e.z,y:base,r:.1,life:2.4,hit:false});if(dist(e,p)<4.2&&Math.abs(p.y-base)<1.05)knockPlayer(state,e,oct?22:20,6);state.emit('bossStrike',{x:e.x,z:e.z});}
  }else if(a.kind==='burst'||a.kind==='ink'){
   const rounds=a.kind==='burst'?(rage?8:6):5;
   if(a.round<rounds&&a.t-a.wind>=a.round*(a.kind==='burst'?.16:.18)){
    const spread=a.kind==='burst'?(a.round%2?1:-1)*.026:(a.round-2)*.13;
    shot(state,e,a.target,{speed:mech?13:8.2,damage:mech?7:9,spread,laser:mech});a.round++;
   }
  }else if(!a.hit){
   a.hit=true;
   if(a.kind==='slam'){state.waves.push({x:e.x,z:e.z,y:base,r:.1,life:2.6,hit:false});if(d<5&&Math.abs(p.y-base)<1)knockPlayer(state,e,20,5);}
   else if(a.kind==='sweep'){if(dist(p,a.target)<3.3&&Math.abs(p.y-base)<1.1)knockPlayer(state,e,18,4.8);}
   else if(a.kind==='teleport'){const angle=(e.step||0)*2.4;const arena=e.arena;e.x=arena.x+Math.sin(angle)*5;e.z=arena.z+Math.cos(angle)*5;for(let k=0;k<5;k++)shot(state,e,p,{spread:(k-2)*.16,speed:9,damage:8,laser:true});}
   state.emit('bossStrike',{x:e.x,z:e.z});
  }
  if(a.t>=a.wind+a.active+a.recover){e.worldAction=null;e.mode='chase';e.airLift=0;e.cd=rage?.7:1.1;}
  return;
 }
 e.mark=null;e.yaw=Math.atan2(p.x-e.x,p.z-e.z);if(d>29){e.mode='patrol';return;}
 if(d>(oct?5.0:3.2)){e.mode='chase';stepBoss(state,e,p,rage?3.6:2.7,dt);}
 if(e.cd<=0&&d<23&&Math.abs(p.y-base)<6){
  const kinds=oct?['sweep','leap','ink','slam']:mech?['burst','leap','burst','slam']:e.bossType==='architect'?['teleport','slam','leap']:['slam','leap','sweep'];const kind=kinds[(e.step||0)%kinds.length];e.step=(e.step||0)+1;
  const arena=e.arena,pad=oct?3:1.5,target={x:clamp(p.x,arena.x-arena.w/2+pad,arena.x+arena.w/2-pad),z:clamp(p.z,arena.z-arena.d/2+pad,arena.z+arena.d/2-pad),y:base};
  if(['burst','ink'].includes(kind))target.y=p.y;
  e.worldAction={kind,t:0,wind:kind==='leap'?1.2:kind==='burst'?1.0:.95,active:kind==='leap'?.85:kind==='burst'?1.5:kind==='ink'?1.0:.35,recover:rage?1.35:1.9,yaw:e.yaw,target,start:{x:e.x,z:e.z},hit:false,round:0};
  e.mode='windup';e.t=0;state.emit('bossWindup',{kind});if(kind==='leap')state.emit('notice',{text:oct?'Восьмирукий прыгает! Уходи из круга, затем перепрыгни волну.':'Реактивный прыжок! Уходи из круга, затем контратакуй.'});
 }
}
