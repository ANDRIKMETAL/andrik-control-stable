import assert from 'node:assert/strict';
import {State} from '../assets/portrait-core-r1285.js';
import {RuinsState} from '../assets/ruins-core-r1285.js';
const step=(s,n=60,input={})=>{for(let i=0;i<n;i++)s.update(1/60,input);};
const s=new State();s.enemies=[];
for(let zone=0;zone<3;zone++){s.load(zone);s.enemies=[];const q=s.shrines[0];Object.assign(s.p,{x:q.x,z:q.z});s.interact();const c=s.crystals;s.interact();assert.equal(s.crystals,c,'no repeat reward');}
assert.equal(s.echoes.length,3);assert.equal(s.crystals,9);assert.equal(new State(s.snapshot()).echoes.length,3);
const fight=new State();fight.enemies=[];fight.laser=null;fight.isRuins=true;const e=fight.spawn('mask',0,4.5);e.cd=0;fight.p.inv=99;const hands=new Set();let retreat=false;
for(let i=0;i<240;i++){fight.update(1/60);if(e.mode==='strike')hands.add(e.hand);if(e.mode==='retreat')retreat=true;}
assert.deepEqual([...hands].sort(),[0,1]);assert(retreat,'two hands then retreat');
const r=new RuinsState();r.enemies=[];r.action('jump');step(r,8,{x:1,z:1});const y=r.p.y;r.action('jump');assert(r.p.vy>7);assert.equal(r.jumps,0);assert(!r.action('jump'));step(r,8);assert(r.p.y>y);assert(r.p.x>0&&r.p.z>3,'full X/Z motion');
r.load(2);r.enemies=[];assert(!r.exitOpen);for(const q of [{x:-6,z:10},{x:6,z:19},{x:-5,z:29}]){Object.assign(r.p,q);r.interact();}assert(r.exitOpen);assert(new RuinsState(r.snapshot()).exitOpen);Object.assign(r.p,{x:0,z:34});r.interact();assert.equal(r.zone,3);assert.equal(r.checkpoint,3);
r.load(2);r.enemies=[];const enemy=r.spawn('double',0,10);Object.assign(r.p,{x:0,z:3,yaw:0});r.shots=[{x:0,z:5,vx:0,vz:-6,life:6,reflectable:true}];r.attack={kind:'attack'};r.attackHit();assert.equal(enemy.hp,65);assert.equal(r.shots[0].life,0);
r.load(4);r.enemies[0].hp=690;step(r,1);assert.equal(r.phase,2);r.enemies[0].hp=340;step(r,1);assert.equal(r.phase,3);
console.log('PASS quests, rewards once, saved quest, alternating strikes and retreat, 3D motion, double jump limit, mechanisms, checkpoint, projectile reflection, boss phases');
