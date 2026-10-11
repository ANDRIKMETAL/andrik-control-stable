import {State,clamp,blocked,move} from './portrait-core-r1285.js';
export const RUINS_ZONES=['Врата забытого времени','Стражи песков','Три механизма эпох','Мосты над бездной','Хранитель эпох'];
export class RuinsState extends State {
 load(zone){super.load(zone);this.isRuins=true;this.chronos=[false,false,false];this.jumps=2;this.shrines=[];this.laser=null;
 // Open-air ruins use real X/Z navigation. The last room is a broad arena.
 this.geo.walls=this.geo.walls.filter(w=>w.z===-1||w.x!==0);
 if(zone===0){this.enemies=[];this.spawn('mask',-4,21);this.spawn('shadow',5,30);this.spawn('statue',0,43);}
 if(zone===2){this.enemies=[];this.spawn('shadow',-5,17);this.spawn('double',5,27);}
 }
 get exitOpen(){return this.zone===0?!this.living.length:this.zone===2?this.chronos.every(Boolean)&&!this.living.length:super.exitOpen;}
 interact(){if(this.zone===2){const points=[{x:-6,z:10},{x:6,z:19},{x:-5,z:29}];for(let i=0;i<3;i++)if(!this.chronos[i]&&Math.hypot(this.p.x-points[i].x,this.p.z-points[i].z)<2.6){this.chronos[i]=true;this.p.energy=Math.min(100,this.p.energy+20);this.emit('notice',{text:'Механизм '+(i+1)+' включён · '+this.chronos.filter(Boolean).length+'/3'});return;}}
 if(this.exitOpen&&this.p.z>this.geo.length-7&&Math.abs(this.p.x)<4){this.checkpoint=this.zone+1;this.load(this.checkpoint);this.emit('checkpoint');}}
 action(kind){if(kind==='jump'&&!this.dead&&!this.finale&&!this.won){if(this.p.grounded){this.jumps=1;return super.action(kind);}if(this.jumps>0){this.jumps=0;this.p.vy=7.7;this.jumpBuffer=0;this.emit('jump');return true;}return false;}return super.action(kind);}
 update(dt,input){super.update(dt,input);this.laser=null;if(this.p.grounded)this.jumps=2;}
 enemy(e,dt){if(e.kind!=='double'||e.hp<=0){super.enemy(e,dt);return;}e.cd-=dt;e.t+=dt;e.yaw=Math.atan2(this.p.x-e.x,this.p.z-e.z);const d=Math.hypot(this.p.x-e.x,this.p.z-e.z);
 if(e.mode==='stagger'){if(e.t>.35)e.mode='chase';return;}
 if(e.mode==='windup'){if(e.t>.9){this.shots.push({x:e.x,z:e.z,vx:Math.sin(e.yaw)*6,vz:Math.cos(e.yaw)*6,life:6,reflectable:true});e.mode='retreat';e.t=0;e.cd=2.4;}return;}
 if(e.mode==='retreat'){if(e.t<.8&&d>0.1)move(e,-Math.sin(e.yaw)*dt*2,-Math.cos(e.yaw)*dt*2,this.geo.walls);else e.mode='chase';return;}
 if(d<16&&!blocked(e,this.p,this.geo.walls)&&e.cd<=0){e.mode='windup';e.t=0;return;}
 if(d>9)move(e,Math.sin(e.yaw)*dt*1.8,Math.cos(e.yaw)*dt*1.8,this.geo.walls);
 }
 attackHit(){super.attackHit();if(this.attack?.kind==='attack')for(const s of this.shots){if(!s.reflectable||Math.hypot(s.x-this.p.x,s.z-this.p.z)>3.1)continue;const target=this.living.filter(e=>e.kind!=='boss').sort((a,b)=>Math.hypot(a.x-s.x,a.z-s.z)-Math.hypot(b.x-s.x,b.z-s.z))[0];if(target&&!blocked(this.p,target,this.geo.walls)){this.hit(target,35,1);s.life=0;this.emit('notice',{text:'Снаряд отражён · 35 урона'});}}}
 snapshot(){return {...super.snapshot(),chronos:this.chronos,jumps:this.jumps,ruins3d:1};}
 restore(s){super.restore(s);this.chronos=Array.isArray(s.chronos)&&s.chronos.length===3?s.chronos.map(Boolean):[false,false,false];this.jumps=clamp(Number(s.jumps)||0,0,2);}
}
