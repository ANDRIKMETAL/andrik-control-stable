import assert from 'node:assert/strict';
import {State} from '../assets/portrait-core-r1288.js';
import {RuinsState,epochBeam,EPOCH_RELAYS} from '../assets/ruins-core-r1288.js';
import {createLyra,poseGuitar} from '../assets/lyra-hero-r1288.js';
import * as T from '../assets/vendor/three-r170.module.min.js';
const step=(s,n,input={})=>{for(let i=0;i<n;i++)s.update(1/60,input);};
for(const Class of [State,RuinsState]){
 const s=new Class();s.enemies=[];s.action('jump');step(s,8);const before=s.p.y;assert(s.action('jump'));assert.equal(s.jumps,0);assert(!s.action('jump'));step(s,8);assert(s.p.y>before);step(s,100);assert(s.p.grounded);assert.equal(s.jumps,2);
 const walking=new Class(),running=new Class();walking.enemies=[];running.enemies=[];step(walking,45,{z:1});step(running,45,{z:1,run:true});assert(running.p.z-walking.p.z>1.5);
 s.load(0);s.enemies=[];s.action('attack');assert.equal(s.combo,0);step(s,7);s.action('attack');step(s,37);assert.equal(s.combo,1,'queued right-handed follow-up');assert.equal(s.attack.kind,'attack');step(s,40);assert.equal(s.attack,null);
 s.action('attack');assert.equal(s.combo,0,'combo restarts after delay');
}
let solved=0;for(let a=0;a<8;a++)for(let b=0;b<8;b++)for(let c=0;c<8;c++)if(epochBeam([a,b,c]).solved)solved++;assert.equal(solved,1);
const r=new RuinsState();r.load(2);r.enemies.forEach(e=>e.hp=0);assert(!r.exitOpen,'enemy kills alone do not bypass light puzzle');
for(let i=0;i<3;i++){Object.assign(r.p,EPOCH_RELAYS[i]);let n=0;while(!r.puzzle.lit[i]&&n++<8)r.interact();assert(r.puzzle.lit[i]);}
assert(r.exitOpen);assert(new RuinsState(r.snapshot()).exitOpen);r.relayAngles[1]=1;assert(!r.exitOpen);r.relayAngles[1]=0;
const old=r.snapshot();delete old.relayAngles;old.chronos=[true,true,true];assert(new RuinsState(old).exitOpen,'legacy solved switch save remains open');
old.chronos=[true,false,false];assert(!new RuinsState(old).exitOpen);
Object.assign(r.p,{x:0,z:34});r.interact();assert.equal(r.zone,3);assert.equal(r.checkpoint,3);
const hero=createLyra();assert.equal(hero.userData.face.visible,false);assert(hero.getObjectByName('eye-pendant-on-cord'));
let maxError=0;
for(const combo of [0,1])for(let n=0;n<=100;n++){
 const a={kind:'attack',t:n/100,duration:1};poseGuitar(hero,a,combo,0,false);hero.updateMatrixWorld(true);
 const target=new T.Vector3().applyMatrix4(hero.userData.guitar.matrixWorld),hand=hero.userData.limbs[1].hand.getWorldPosition(new T.Vector3());maxError=Math.max(maxError,hand.distanceTo(target));
 if(combo===0&&n>=22&&n<=73){const leftTarget=new T.Vector3(0,-.105,.005).applyMatrix4(hero.userData.guitar.matrixWorld),left=hero.userData.limbs[0].hand.getWorldPosition(new T.Vector3());assert(left.distanceTo(leftTarget)<.015,'left hand grips neck during two-handed strike');}
}
assert(maxError<.015,'right hand must remain on guitar neck');
console.log('PASS both levels: jump limit/landing reset, sprint, queued two-hit combo; all 512 light configurations, door, old/new saves, checkpoint; neck grip IK error',maxError);
