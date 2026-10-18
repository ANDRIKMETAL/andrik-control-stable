import {attackSlot} from './encounters-r1448.js?v=r1448';
import {downedEnemyR1447} from './combat-r1447.js?v=r1465';
import {State,clamp,blocked,move} from './portrait-core-r1295.js?v=r1465';
export const RUINS_ZONES=['Врата забытого времени','Стражи песков','Три механизма эпох','Мосты над бездной','Хранитель эпох'];
export const EPOCH_RELAYS=[{x:-6,z:10},{x:6,z:19},{x:-5,z:29}];
export const EPOCH_SOURCE={x:-6,z:3},EPOCH_RECEIVER={x:0,z:37};
export function epochBeam(angles){
 const segments=[[EPOCH_SOURCE,EPOCH_RELAYS[0]]],lit=[false,false,false];
 for(let i=0;i<3;i++){const a=EPOCH_RELAYS[i],b=EPOCH_RELAYS[i+1]||EPOCH_RECEIVER;
 const target=Math.atan2(b.x-a.x,b.z-a.z),angle=target+angles[i]*Math.PI/4;
 const dx=b.x-a.x,dz=b.z-a.z,along=dx*Math.sin(angle)+dz*Math.cos(angle),off=Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle));
 const hit=along>0&&off<.45;lit[i]=hit;
 segments.push([a,hit?b:{x:a.x+Math.sin(angle)*12,z:a.z+Math.cos(angle)*12}]);if(!hit)break;
 }return {segments,lit,solved:lit.every(Boolean)};
}
export class RuinsState extends State {
 load(zone){super.load(zone);this.isRuins=true;this.relayAngles=[2,5,3];this.chronos=[false,false,false];this.jumps=2;this.shrines=[];this.laser=null;
 // Open-air ruins use real X/Z navigation. The last room is a broad arena.
 this.geo.walls=[];
 if(zone<3){const end=this.geo.length;const cuts=zone===0?[[15,17.2],[35,37.2]]:zone===1?[[8,10.2]]:zone===2?[[13,15.2],[23,25.2]]:[];this.geo.platforms=[];let start=-1;for(const [lo,hi] of [...cuts,[end+1,end+1]]){this.geo.platforms.push({x:0,z:(start+lo)/2,w:zone===4?19:18,d:lo-start,h:0});start=hi;}}
 
 if(zone===0){this.enemies=[];this.spawn('mask',-4,21);this.spawn('shadow',5,30);this.spawn('statue',0,43);}
 if(zone===2){this.enemies=[];this.spawn('shadow',-5,17);this.spawn('double',5,27);}
 }
 get exitOpen(){return this.zone===0?!this.living.length:this.zone===2?this.puzzle.solved&&!this.living.length:super.exitOpen;}
 get puzzle(){return epochBeam(this.relayAngles);}
 get nearbyRelay(){return EPOCH_RELAYS.findIndex(q=>Math.hypot(this.p.x-q.x,this.p.z-q.z)<2.8);}
 get canInteract(){return this.nearbyRelay>=0||(this.p.z>this.geo.length-7&&Math.abs(this.p.x)<4);}
 interact(){if(this.zone===2){const i=this.nearbyRelay;if(i>=0){this.relayAngles[i]=(this.relayAngles[i]+1)%8;this.chronos=this.puzzle.lit;this.emit('notice',{text:this.puzzle.solved?(this.living.length?'Луч достиг двери. Победи оставшихся стражей.':'Луч достиг двери — проход открыт!'):'Отражатель '+(i+1)+' повёрнут · '+(this.relayAngles[i]+1)+'/8'});this.emit('puzzle');return;}
 if(!this.exitOpen&&this.p.z>this.geo.length-7){this.emit('notice',{text:this.puzzle.solved?'Победи оставшихся стражей':'Поверни три отражателя: луч должен дойти до двери'});return;}}
 if(this.exitOpen&&this.p.z>this.geo.length-7&&Math.abs(this.p.x)<4){this.checkpoint=this.zone+1;this.load(this.checkpoint);this.emit('checkpoint');}}
 update(dt,input){super.update(dt,input);this.laser=null;}
 enemy(e,dt){
 if(e.kind==='double'&&downedEnemyR1447(this,e,dt))return;
 if(e.hp>0&&e.kind!=='boss'&&e.kind!=='double'){
  if(e.hop){e.hop.t+=dt;const u=Math.min(1,e.hop.t/.7);e.x=e.hop.x+(e.hop.tx-e.hop.x)*u;e.z=e.hop.z+(e.hop.tz-e.hop.z)*u;e.y=Math.sin(u*Math.PI)*1.7;if(u===1){e.hop=null;e.y=0;}return;}
  const ox=e.x,oz=e.z;super.enemy(e,dt);
  if(!this.support(e.x,e.z)){
   const dx=e.x-ox,dz=e.z-oz,len=Math.hypot(dx,dz);let landing=null;
   if(len>.00001)for(let d=.3;d<=3.6;d+=.15){const x=ox+dx/len*d,z=oz+dz/len*d;if(this.support(x,z,.15)){landing={x,z};break;}}
   e.x=ox;e.z=oz;if(landing)e.hop={x:ox,z:oz,tx:landing.x,tz:landing.z,t:0};
  }return;
 }
 if(e.kind!=='double'||e.hp<=0){super.enemy(e,dt);return;}e.cd-=dt;e.t+=dt;if(e.mode!=='windup')e.yaw=Math.atan2(this.p.x-e.x,this.p.z-e.z);const d=Math.hypot(this.p.x-e.x,this.p.z-e.z);
 if(e.mode==='stagger'){if(e.t>.35)e.mode='chase';return;}
 if(e.mode==='windup'){if(e.t>.9){this.shots.push({x:e.x,z:e.z,vx:Math.sin(e.yaw)*6,vz:Math.cos(e.yaw)*6,life:6,reflectable:true});e.mode='retreat';e.t=0;e.cd=2.0;}return;}
 if(e.mode==='retreat'){if(e.t<.8&&d>0.1)move(e,-Math.sin(e.yaw)*dt*2,-Math.cos(e.yaw)*dt*2,this.geo.walls);else e.mode='chase';return;}
 if(d<16&&!blocked(e,this.p,this.geo.walls)&&e.cd<=0&&attackSlot(this,e)){e.mode='windup';e.t=0;return;}
 if(d>9)move(e,Math.sin(e.yaw)*dt*2.4,Math.cos(e.yaw)*dt*2.4,this.geo.walls);
 }
 attackHit(){super.attackHit();if(this.attack?.kind==='attack')for(const s of this.shots){if(!s.reflectable||s.friendly||Math.hypot(s.x-this.p.x,s.z-this.p.z)>3.1)continue;const target=this.living.filter(e=>e.kind!=='boss').sort((a,b)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(b.x-s.x,b.z-s.z))[0];if(target&&!blocked(this.p,target,this.geo.walls)){this.hit(target,35,1);s.life=0;this.emit('notice',{text:'Снаряд отражён · 35 урона'});}}}
 support(x,z,margin=0){return this.geo.platforms.some(f=>!f.gone&&Math.abs(x-f.x)<f.w/2-margin&&Math.abs(z-f.z)<f.d/2-margin);}
 snapshot(){return {...super.snapshot(),chronos:this.puzzle.lit,relayAngles:[...this.relayAngles],jumps:this.jumps,ruins3d:3};}
 restore(s){super.restore(s);this.chronos=Array.isArray(s.chronos)&&s.chronos.length===3?s.chronos.map(Boolean):[false,false,false];this.relayAngles=Array.isArray(s.relayAngles)&&s.relayAngles.length===3?s.relayAngles.map(a=>((Math.trunc(Number(a)||0)%8)+8)%8):this.chronos.map((v,i)=>v?0:[2,5,3][i]);this.chronos=this.puzzle.lit;if(!this.support(this.p.x,this.p.z)&&this.p.y<.1){this.p.x=0;this.p.z=3;this.p.y=0;this.p.vy=0;}if((s.ruins3d||1)<2&&this.zone<3)this.geo.platforms.forEach(f=>{f.gone=false;f.fragile=false;});}
}
