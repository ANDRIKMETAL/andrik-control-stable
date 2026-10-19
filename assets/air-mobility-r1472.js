import {blocked} from './portrait-core-r1295.js?v=r1472';
import {towerRayHit} from './tower-entry-r1459.js?v=r1472';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// These colliders match the large visible columns. They are physics only: the
// scene already draws the stone, so rendering them again would cause flicker.
export function registerJumpDecor(s){
 const g=s.geo;if(!g||g.jumpDecor1472||s.isCity||s.world)return;
 g.jumpDecor1472=true;
 const column=(x,z,radius,base,h,id)=>g.walls.push({x,z,radius,w:radius*2,d:radius*2,base,h,roundSolid:true,jumpDecor:true,jumpId:id});
 if(s.isRuins){for(let z=6;z<g.length;z+=8)for(const side of [-1,1])column(side*8,z,.65,0,3.6,'ruins-'+side+'-'+z);}
 else if(s.zone===3){for(let i=0;i<16;i++)column(Math.sin(i*2)*15,i*5,.8,-6.5,2.5,'broken-column-'+i);}
 else{for(let z=4;z<g.length;z+=7)for(const side of [-1,1])column(side*9,z,.38,0,8,'gallery-'+side+'-'+z);}
}

export function findJumpWall(s,input={}){
 const p=s.p,len=Math.hypot(input.x||0,input.z||0);if(len<.2)return null;
 const ix=(input.x||0)/len,iz=(input.z||0)/len,chest=p.y+1.05;let best=null;
 for(const [index,w]of s.geo.walls.entries()){
  if(chest<(w.base??-Infinity)+.05||chest>w.h-.1)continue;
  let nx,nz,d;
  if(w.towerRing||w.roundSolid){
   const x=p.x-w.x,z=p.z-w.z,r=Math.hypot(x,z);if(r<.01)continue;
   const inside=w.towerRing&&r<(w.inner+w.outer)/2,face=inside?w.inner:w.towerRing?w.outer:w.radius,side=inside?-1:1;
   nx=x/r*side;nz=z/r*side;d=(r-face)*side;
   if(w.towerRing&&towerRayHit({x:p.x,y:chest,z:p.z},{x:p.x-nx*.7,y:chest,z:p.z-nz*.7},w)===null)continue;
  }else{
   const x=p.x-clamp(p.x,w.x-w.w/2,w.x+w.w/2),z=p.z-clamp(p.z,w.z-w.d/2,w.z+w.d/2);d=Math.hypot(x,z);if(d<.01)continue;nx=x/d;nz=z/d;
  }
  if(d<.18||d>.64||ix*nx+iz*nz>-.25)continue;
  if(!best||d<best.distance)best={nx,nz,distance:d,id:w.jumpId??index,wall:w};
 }
 return best;
}

export function attachAirMobility(s){
 if(s.airMobility)return s;
 const base={action:s.action.bind(s),update:s.update.bind(s),load:s.load.bind(s),restore:s.restore.bind(s),attackHit:s.attackHit.bind(s)};
 let input={},kick=null,armed=0,used=new Set(),cleaved=false,cooldown=0;
 const eligible=()=>!s.dead&&!s.won&&!s.finale&&!s.vehicleActive&&!s.race?.mounted&&!(s.p.down>0)&&!s.traversal?.ledge&&!s.dodge1460;
 function reset(){kick=null;armed=0;cooldown=0;used.clear();cleaved=false;input={};registerJumpDecor(s);}
 function wallKick(w){
  if(!w||cooldown>0||used.has(w.id)||used.size>=2)return false;
  used.add(w.id);armed=0;cooldown=.28;kick={x:w.nx,z:w.nz,t:0,duration:.27};
  Object.assign(s.p,{vx:w.nx*7.2,vz:w.nz*7.2,vy:s.world===3?6.8:8.1,grounded:false,coyote:0});s.jumps=0;s.jumpBuffer=0;
  s.emit('wallJump',{x:s.p.x,y:s.p.y,z:s.p.z,nx:w.nx,nz:w.nz});s.emit('jump');return true;
 }
 s.airMobility={get kick(){return kick;},get cleaveReady(){return eligible()&&!s.p.grounded&&s.jumps===0&&!cleaved&&!s.attack;}};
 s.load=function(...args){const r=base.load(...args);reset();return r;};
 s.restore=function(...args){const r=base.restore(...args);reset();return r;};
 s.action=function(kind){
  if(kind==='jump'&&eligible()&&!s.p.grounded&&(s.p.coyote||0)<=0&&(s.jumps>0||used.size>0)&&!s.jumpBuffer){
   if(wallKick(findJumpWall(s,input)))return true;
   const jumps=s.jumps,r=base.action(kind);if(r&&jumps>0&&s.jumps===0)armed=.48;return r;
  }
  if(['slash','slashReverse','slashSpin','kick'].includes(kind)&&s.airMobility.cleaveReady){
   cleaved=true;armed=0;kick=null;s.queued=false;
   s.attack={kind:'airCleave',t:0,duration:2,hitAt:Infinity,hit:false,phase:'load',phaseT:0,finishWeapon:s.weaponStats?.selected||'sword',victims:new Set(),crates:new Set()};
   s.lastAttack=s.time;s.emit('airCleaveStart');return true;
  }
  return base.action(kind);
 };
 s.attackHit=function(){
  const a=s.attack;if(a?.kind!=='airCleave')return base.attackHit();
  const p=s.p,bat=a.finishWeapon==='bat',range=2.75+(s.weaponStats?.rangeBonus||0),damage=Math.round((bat?39:32)*(s.growthStats?.bladeDamage||1)*(s.weaponStats?.damage||1));
  for(const e of s.living){
   const d=dist(e,p),dot=((e.x-p.x)*Math.sin(p.yaw)+(e.z-p.z)*Math.cos(p.yaw))/Math.max(.01,d),height=(e.y||0)+(e.airT>0?Math.max(0,e.airHeight||0)*.45:0)-p.y;
   if(a.victims.has(e)||d>range+(e.hurtRadius||0)||(d>.55&&dot<.1)||height< -1.65||height>1.55||blocked(p,e,s.geo.walls))continue;
   a.victims.add(e);s.hit(e,damage,bat?2.7:1.5);
  }
  for(const q of s.weaponCrates||[]){
   const d=dist(q,p),dot=((q.x-p.x)*Math.sin(p.yaw)+(q.z-p.z)*Math.cos(p.yaw))/Math.max(.01,d);
   if(q.broken||a.crates.has(q.id)||d>range||(d>.55&&dot<.05)||Math.abs(q.y-p.y)>1.65||blocked(p,q,s.geo.walls.filter(w=>w.weaponCrateId!==q.id)))continue;
   a.crates.add(q.id);s.damageWeaponCrate(q.id,damage);
  }
 };
 s.update=function(dt,moveInput={}){
  dt=clamp(Number(dt)||0,0,.035);input=moveInput;cooldown=Math.max(0,cooldown-dt);armed=Math.max(0,armed-dt);
  if(s.p.grounded){used.clear();cleaved=false;armed=0;kick=null;}
  const zone=s.zone,a=s.attack;
  if(eligible()&&!s.p.grounded&&armed>0)wallKick(findJumpWall(s,input));
  let control=moveInput;
  if(kick){kick.t+=dt;if(kick.t>=kick.duration)kick=null;else control={...moveInput,x:kick.x,z:kick.z,run:true};}
  if(a?.kind==='airCleave'){
   a.phaseT+=dt;
   if(!eligible()){s.attack=null;}
   else{
    control={...control,x:(control.x||0)*.32,z:(control.z||0)*.32,run:false};
    if(a.phase==='load'&&a.phaseT>=.18){a.phase='cut';a.phaseT=0;s.emit('swing',{kind:'slash'});}
    if(a.phase==='cut')s.p.vy=Math.min(s.p.vy,-8.6);
   }
  }
  base.update(dt,control);
  if(zone!==s.zone||s.dead||s.won||s.finale){kick=null;armed=0;return;}
  if(s.traversal?.ledge){kick=null;armed=0;return;}
  if(a?.kind==='airCleave'&&s.attack===a){
   if(a.phase==='cut'&&a.phaseT>=.08)s.attackHit();
   if(a.phase==='cut'&&s.p.grounded){a.phase='recover';a.phaseT=0;s.emit('airCleaveLand',{x:s.p.x,y:s.p.y,z:s.p.z});}
   if(a.phase==='recover'&&a.phaseT>.32||a.phase==='cut'&&a.phaseT>.95){s.attack=null;s.queued=false;}
  }
 };
 reset();return s;
}
