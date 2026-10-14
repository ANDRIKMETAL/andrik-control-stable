import assert from 'node:assert/strict';
import {WorldState} from '../assets/worlds-core-r1306.js';
for(const world of [2,3,4,5]){
 for(let zone=0;zone<3;zone++){
 const s=new WorldState(world);s.load(zone);assert.equal(s.exitOpen,false);assert.equal(s.geo.platforms.length>0,true);
 if(world===5){Object.assign(s.p,{...s.switches[2],y:0});s.interact();assert.equal(s.flags.length,0);}
 for(const q of s.switches){Object.assign(s.p,{x:q.x,z:q.z,y:q.h});s.action('interact');assert(q.active);}
 assert.equal(s.flags.length,3);assert(!s.exitOpen);s.enemies.forEach(e=>s.hit(e,10000));assert(s.exitOpen);assert(!s.won,'boss death does not bypass final exit');
 const copy=new WorldState(world,s.snapshot());assert.equal(copy.flags.length,3);assert(copy.exitOpen);assert.equal(copy.zone,zone);
 Object.assign(copy.p,copy.exit);copy.action('interact');if(zone===2)assert(copy.won);else assert.equal(copy.zone,zone+1);
 }
 console.log('PASS objectives, combat gate, save/resume and exit for world',world);
}
// Traverse each platform using the real movement/gravity/jump update, without teleports.
for(const world of [2,3,4])for(const zone of [0,1,2]){
 const s=new WorldState(world);s.load(zone);s.enemies=[];s.damage=()=>{};const step=.02;
 for(let i=1;i<s.geo.platforms.length;i++){
  const q=s.geo.platforms[i];s.action('jump');let usedSecond=false,reached=false;
  for(let t=0;t<4;t+=step){const dx=q.x-s.p.x,dz=q.z-s.p.z,d=Math.hypot(dx,dz);if(!usedSecond&&s.p.vy<.8&&!s.p.grounded){s.action('jump');usedSecond=true;}
   const speed=d<.25?0:Math.min(1,d/1.3);s.update(step,{x:dx/Math.max(.01,d)*speed,z:dz/Math.max(.01,d)*speed,run:true});
   if(s.p.grounded&&s.p.y>=q.h-.1&&s.p.y<=q.h+1.3&&Math.abs(s.p.x-q.x)<q.w/2-.2&&Math.abs(s.p.z-q.z)<q.d/2-.2){reached=true;break;}
  }
  assert(reached,`world ${world} platform ${i} unreachable; at ${JSON.stringify(s.p)} target ${JSON.stringify(q)}`);
 }
 console.log('PASS continuous traversal',world);
}
const b=new WorldState(5);b.enemies=[];b.p.inv=0;b.hazards=[{x:b.p.x,z:b.p.z,t:0,hit:false}];for(let i=0;i<39;i++)b.update(.035);assert.equal(b.p.hp,100);b.update(.035);b.update(.035);assert.equal(b.p.hp,78);for(let i=0;i<40;i++)b.update(.035);assert.equal(b.p.hp,78);
console.log('PASS falling block warning and single impact');
