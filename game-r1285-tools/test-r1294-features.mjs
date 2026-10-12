import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three-r170.module.min.js';
import {State,MIRRORS} from '../assets/portrait-core-r1294.js';
import {CityState} from '../assets/city-core-r1294.js';
import {RuinsState,EPOCH_RELAYS} from '../assets/ruins-core-r1294.js';
import {createLyra,poseGuitar} from '../assets/lyra-hero-r1294.js';
for(const C of [State,CityState,RuinsState]){
 const s=new C();s.enemies=[];s.action('interact');assert.equal(s.attack.kind,'punch');assert.equal(s.attack.upper,false);
 s.attack.t=.15;s.action('punch');assert.equal(s.queued,'punch');for(let i=0;i<11;i++)s.update(.035);assert(s.attack.upper);assert.equal(s.attack.hand,0);
 s.attack=null;const foe=s.spawn('mask',s.p.x,s.p.z+1);s.attack={kind:'punch',upper:true};s.attackHit();assert(foe.airT>0,'uppercut launches');
}
const s=new State();s.load(2);s.enemies=[];for(let i=0;i<3;i++){Object.assign(s.p,MIRRORS[i]);s.attack=null;const old=s.angles[i];s.action('interact');assert.equal(s.angles[i],(old+1)%8);assert.equal(s.attack,null);}
const r=new RuinsState();r.load(2);Object.assign(r.p,EPOCH_RELAYS[0]);const old=r.relayAngles[0];r.action('interact');assert.equal(r.relayAngles[0],(old+1)%8);
const hero=createLyra();poseGuitar(hero,null,0,0,false);hero.updateMatrixWorld(true);
for(const l of hero.userData.limbs){const hand=l.hand.getWorldPosition(new T.Vector3());assert(hand.y>1.60&&hand.y<1.7);assert(hand.z>.2);}
for(const upper of [false,true])for(let i=0;i<=60;i++){
 hero.userData.body.position.set(0,0,0);poseGuitar(hero,{kind:'punch',upper,t:i/60,duration:1},0,0,false);hero.updateMatrixWorld(true);hero.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
}
console.log('PASS right straight/left uppercut, queued punches, launch, all mirror interactions, ruins relay, boxing guard and finite poses');
