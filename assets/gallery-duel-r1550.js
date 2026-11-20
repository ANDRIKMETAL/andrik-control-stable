import {State,move,blocked,clamp} from './portrait-core-r1295.js?v=r1472';
import {enemyRouteDirection} from './enemy-navigation-r1446.js?v=r1472';
import {downedEnemyR1447} from './combat-r1447.js?v=r1472';

export const mirror={x:0,z:36};
const pillars=[{x:-4,z:24},{x:4,z:30}];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const face=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
// kind, wind-up, reach, damage. All attacks have a locked facing and a punish window.
const moves=[
 ['slash',.44,2.8,10],['attack',.62,3.5,13],['slash',.42,2.9,10],
 ['punch',.30,2,6],['kick',.40,2.5,9],['backfist',.39,2.3,8],
 ['slash',.56,3,13],['airKick',.5,2.6,10],['airCleave',.72,3,15],
 ['scream',.82,7,13],['palm',.35,2.3,8],['slash',.55,3.2,13],
 ['meteor',.76,3.1,15],['rage',.62,3,7],['punch',.42,2.2,8],['finish',.82,2.8,14]
];
export class GalleryState extends State{
 load(zone){
  super.load(zone);this.duelWon=false;
  if(zone===1)for(const p of pillars)this.geo.walls.push({...p,w:2.2,d:2.2,h:3.5});
  if(zone===2)this.enemies=this.enemies.filter(e=>e.kind!=='double');
 }
 get exitOpen(){return this.zone===1?this.duelWon&&super.exitOpen:super.exitOpen;}
 snapshot(){return {...super.snapshot(),duelWon:this.duelWon};}
 restore(raw){super.restore(raw);this.duelWon=raw?.duelWon===true;
  if(this.zone===2)this.enemies=this.enemies.filter(e=>e.kind!=='double');
 }
 update(dt,input){
  super.update(dt,input);
  if(this.zone!==1||this.wave!==3||this.dead||this.duelWon)return;
  const rival=this.enemies.find(e=>e.duel);
  if(rival){if(rival.hp<=0){this.duelWon=true;this.emit('duelWon');}return;}
  if(this.living.length)return;
  const e=this.spawn('double',mirror.x,mirror.z);e.max=e.hp=220;
  e.duel={phase:'sealed',t:0,index:0,pattern:0,swings:0,evadeCD:1,side:1};
  this.emit('notice',{text:'В глубине зала треснуло зеркало…'});
 }
}
function walk(s,e,to,speed,dt){
 const dir=enemyRouteDirection(e,to,s.geo,s.time),x=e.x,z=e.z;
 move(e,dir.x*speed*dt,dir.z*speed*dt,s.geo.walls,.45);
 e.x=clamp(e.x,-9.45,9.45);e.z=clamp(e.z,.55,s.geo.length-.55);
 e.vx=(e.x-x)/Math.max(.001,dt);e.vz=(e.z-z)/Math.max(.001,dt);
}
function phase(d,name){d.phase=name;d.t=0;}
function retreat(s,e){
 const d=e.duel;
 const spots=pillars.map(q=>{const a=face(s.p,q);return{x:q.x+2.3*Math.sin(a),z:q.z+2.3*Math.cos(a)};});
 d.target=spots.sort((a,b)=>dist(e,a)-dist(e,b))[0];phase(d,'retreat');
}
export function currentPose(e){
 const d=e.duel;if(!d||d.phase!=='attack')return null;
 const [kind,wind]=moves[d.index],duration=kind==='rage'?1.92:wind+.48;
 return {kind,t:d.t,duration,hitAt:wind,step:d.step||0,upper:d.index===14,
  phase:d.t<wind*.55?'load':d.t<wind+.08?'cut':'recover',phaseT:d.t<wind*.55?d.t:d.t<wind+.08?d.t-wind*.55:d.t-wind-.08,finishWeapon:'bat',rageCount:5};
}
export function attachDuel(s){
 const enemy=s.enemy.bind(s),hit=s.hit.bind(s);
 s.hit=function(e,...args){if(e.duel&&['sealed','entrance'].includes(e.duel.phase))return;return hit(e,...args);};
 s.enemy=function(e,dt){
  const d=e.duel;if(!d||e.hp<=0)return enemy(e,dt);
  e.vx=e.vz=0;e.hit=Math.max(0,e.hit-dt);const p=s.p,r=dist(e,p);
  if(d.phase==='sealed'){if(r<=17||p.z>mirror.z){phase(d,'entrance');s.emit('duelCrack',{x:mirror.x,z:mirror.z});}return;}
  d.t+=dt;
  if(d.phase==='entrance'){
   e.yaw=Math.PI;e.z=mirror.z-2.2*clamp((d.t-.55)/1,0,1);
   if(d.t>=.55&&!d.broken){d.broken=true;s.emit('duelGlass',{x:mirror.x,z:mirror.z});}
   if(d.t>1.8)phase(d,'ready');return;
  }
  if(downedEnemyR1447(s,e,dt)){phase(d,'recover');return;}
  if(e.tactic.stun>0){e.tactic.stun=Math.max(0,e.tactic.stun-dt);phase(d,'recover');return;}
  d.evadeCD=Math.max(0,d.evadeCD-dt);
  if(d.phase==='attack'){
   const pose=currentPose(e),[kind,wind,range,n]=moves[d.index];
   e.mode=d.t<wind?'windup':'strike';e.yaw=d.yaw;
   const hits=kind==='rage'?[wind,.95,1.29,1.65]:[wind];
   if(d.contacts<hits.length&&d.t>=hits[d.contacts]){
    d.contacts++;const wide=kind==='attack'||kind==='slash'&&pose.step>=2;
    if(r<range&&Math.abs(p.y-(e.y||0))<1.6&&(wide||Math.cos(face(e,p)-e.yaw)>.25)&&!blocked(e,p,s.geo.walls))s.damage(n);
    s.emit('duelStrike',{x:e.x,z:e.z,kind});
   }
   if(d.t>=pose.duration){phase(d,'recover');d.swings++;}return;
  }
  e.yaw=face(e,p);
  if(d.phase==='recover'){e.mode='recover';if(d.t>.54){if(d.swings>=3){d.swings=0;retreat(s,e);}else phase(d,'ready');}return;}
  if(d.phase==='evade'){e.mode='evade';walk(s,e,d.target,7,dt);if(d.t>.34)phase(d,'recover');return;}
  if(d.phase==='retreat'){e.mode='retreat';walk(s,e,d.target,5.8,dt);if(dist(e,d.target)<.65||d.t>2.8)phase(d,'hide');return;}
  if(d.phase==='hide'){e.mode='recover';if(d.t>.9||r<2)phase(d,'ready');return;}
  if(s.attack&&s.attack.t<.2&&r<3.8&&d.evadeCD<=0){
   d.side*=-1;d.target={x:clamp(e.x+2.5*Math.cos(e.yaw)*d.side,-9,9),z:clamp(e.z-2.5*Math.sin(e.yaw)*d.side,1,42)};
   d.evadeCD=3;phase(d,'evade');return;
  }
  const next=d.pattern%moves.length;
  if(r<moves[next][2]-.15&&!blocked(e,p,s.geo.walls)){
   d.index=next;d.pattern++;d.step=[0,2,6,11].indexOf(next);d.step=Math.max(0,d.step);d.contacts=0;d.yaw=e.yaw;
   phase(d,'attack');e.mode='windup';return;
  }
  e.mode='chase';walk(s,e,p,4.2,dt);
 };
 return s;
}
