import assert from 'node:assert/strict';
import {CityState,roadCenter,RACE_HAZARDS,CITY_SAVE} from '../assets/city-core-r1289.js';
const step=(s,n,input={})=>{for(let i=0;i<n;i++)s.update(1/60,input);};
const s=new CityState();assert.equal(CITY_SAVE,'andrik-city-3d-r1289');s.enemies=[];
step(s,30,{x:1});assert(s.p.x>1,'free lateral movement');step(s,30,{z:1});assert(s.p.z>4,'free forward movement');s.action('jump');step(s,5);assert(s.action('jump'));assert(!s.action('jump'));step(s,100);
for(let zone=0;zone<3;zone++){
 s.load(zone);assert(!s.exitOpen);for(const e of s.enemies)s.hit(e,e.hp,0);assert(!s.exitOpen,'quest also required');
 for(const q of s.cityItems){Object.assign(s.p,{x:q.x,z:q.z,y:0});s.interact();const n=s.crystals;s.interact();assert.equal(s.crystals,n,'quest cannot be farmed');}
 assert(s.exitOpen);const restored=new CityState(s.snapshot());assert(restored.exitOpen,'checkpoint objective persists');
 Object.assign(s.p,{x:0,z:s.geo.length-5});s.interact();assert.equal(s.zone,zone+1);assert.equal(s.checkpoint,zone+1);
}
s.load(0);s.enemies=[];Object.assign(s.p,{x:-6,z:14});step(s,60,{z:1});assert(s.p.z<15.6,'car collision');
s.load(2);s.enemies=[];Object.assign(s.p,{x:-9,z:11});step(s,60,{z:1});assert(s.p.z<14.2,'bar counter collision');
s.load(0);s.enemies=[];Object.assign(s.p,{x:0,z:61});step(s,60,{z:1});assert(s.p.z<63,'closed exit blocks character');
s.load(3);s.checkpoint=3;assert(!s.exitOpen);Object.assign(s.p,{x:0,z:9});s.interact();assert(s.race.mounted);step(s,100);assert.equal(s.p.z,9,'start countdown');step(s,100);assert(s.p.z>9);assert(s.action('jump'));assert(!s.action('jump'));step(s,10);assert(s.p.y>0);const restoreRace=new CityState(s.snapshot());assert(restoreRace.race.mounted);assert(restoreRace.p.z>9);
// Drive a safe line at the edge of the obstacle lanes, following the bends.
s.load(3);s.checkpoint=3;Object.assign(s.p,{x:0,z:9});s.interact();let n=0;
while(!s.race.finished&&n++<4500){const target=roadCenter(s.p.z+5)+4.5,x=Math.max(-1,Math.min(1,(target-s.p.x)*2));s.update(1/60,{x,run:true});}
assert(s.race.finished,'race can be completed with normal HP');assert(s.p.hp>0);assert(s.exitOpen);const reward=s.crystals;step(s,30);assert.equal(s.crystals,reward,'finish reward once');assert(new CityState(s.snapshot()).exitOpen);s.interact();assert.equal(s.zone,4);
// Crashes cause damage and death restarts the race checkpoint.
s.load(3);s.checkpoint=3;Object.assign(s.p,{x:0,z:9});s.interact();s.race.countdown=0;const hazard=RACE_HAZARDS[0];Object.assign(s.p,{x:hazard.x,z:hazard.z-.1,inv:0,hp:10});s.update(1/60,{});assert(s.dead>0);step(s,110);assert.equal(s.zone,3);assert(!s.race.mounted);
// Bullets cannot pass through a parked car.
s.load(0);s.enemies=[];s.shots=[{x:-6,z:15.79,vx:0,vz:8,life:5}];s.update(1/60);assert.equal(s.shots.length,0);
s.load(4);s.p.inv=1000;let sawSlam=false,sawVolley=false,sawOpen=false;for(let i=0;i<1000;i++){s.update(1/60);sawSlam ||= s.bossAction?.kind==='slam';sawVolley ||= s.bossAction?.kind==='volley';sawOpen ||= s.bossOpen>0;}assert(sawSlam&&sawVolley&&sawOpen);s.enemies[0].hp=399;step(s,1);assert.equal(s.phase,2);s.enemies[0].hp=199;step(s,1);assert.equal(s.phase,3);s.hit(s.enemies[0],999,0);step(s,500);assert(s.won);
console.log('PASS: city X/Z movement, double jump, all quests and gates, cars/bar collision, full race, jump/boost, crash respawn, saved progress, cover, boss phases and finale');
