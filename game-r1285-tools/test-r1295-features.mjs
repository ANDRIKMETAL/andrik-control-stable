import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three-r170.module.min.js';
import {State,MIRRORS} from '../assets/portrait-core-r1295.js';
import {CityState} from '../assets/city-core-r1295.js';
import {RuinsState,EPOCH_RELAYS} from '../assets/ruins-core-r1295.js';
import {createLyra,poseGuitar} from '../assets/lyra-hero-r1295.js';
for(const C of [State,CityState,RuinsState]){
 const s=new C();s.enemies=[];s.action('interact');assert.equal(s.attack.kind,'punch');assert.equal(s.attack.upper,false);
 s.attack.t=.15;s.action('punch');assert.equal(s.queued,'punch');for(let i=0;i<11;i++)s.update(.035);assert(s.attack.upper);assert.equal(s.attack.hand,0);
 s.attack=null;const foe=s.spawn('mask',s.p.x,s.p.z+1);s.attack={kind:'punch',upper:true};s.attackHit();assert(foe.airT>0,'uppercut launches');
}
const s=new State();s.load(2);s.enemies=[];for(let i=0;i<3;i++){Object.assign(s.p,MIRRORS[i]);s.attack=null;const old=s.angles[i];s.action('interact');assert.equal(s.angles[i],(old+1)%8);assert.equal(s.attack,null);}
const r=new RuinsState();r.load(2);Object.assign(r.p,EPOCH_RELAYS[0]);const old=r.relayAngles[0];r.action('interact');assert.equal(r.relayAngles[0],(old+1)%8);
const hero=createLyra();poseGuitar(hero,null,0,0,false);hero.updateMatrixWorld(true);
for(const l of hero.userData.limbs){const hand=l.hand.getWorldPosition(new T.Vector3());assert(hand.y<1.0,'hands down at rest');}
for(const upper of [false,true])for(let i=0;i<=60;i++){
 hero.userData.body.position.set(0,0,0);poseGuitar(hero,{kind:'punch',upper,t:i/60,duration:1},0,0,false);hero.updateMatrixWorld(true);hero.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
}
console.log('PASS right straight/left uppercut, queued punches, launch, all mirror interactions, ruins relay, boxing guard and finite poses');
const shout=new State();shout.enemies=[];shout.geo.walls=[];
const front=shout.spawn('statue',0,6),back=shout.spawn('statue',0,0),side=shout.spawn('statue',6,3);
shout.action('scream');assert.equal(shout.p.energy,50);shout.attackHit();assert.equal(front.hp,45);assert.equal(back.hp,110);assert.equal(side.hp,110);assert(front.z>=12);assert(front.airT>0);
const micHero=createLyra();poseGuitar(micHero,{kind:'scream',t:.68,duration:1.45},0,0,false);micHero.updateMatrixWorld(true);
assert(micHero.userData.microphone.visible);assert(micHero.userData.vocalMouth.visible);
assert(micHero.userData.limbs[0].hand.getWorldPosition(new T.Vector3()).distanceTo(micHero.userData.microphone.getWorldPosition(new T.Vector3()))<.01);
poseGuitar(micHero,null,0,0,false);assert(!micHero.userData.microphone.visible);
console.log('PASS scream cone, damage, knockback, energy, left-hand microphone grip and hide');
