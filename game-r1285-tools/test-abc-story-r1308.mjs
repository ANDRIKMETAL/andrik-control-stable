import assert from 'node:assert/strict';
import {CityState} from '../assets/city-core-r1308.js';
import {attachProgressR1301} from '../assets/lira-progress-r1301.js';
import {createABC} from '../assets/abc-controls-r1308.js';
const s=attachProgressR1301(new CityState(),null,'city'),c=createABC(s);
for(const expected of [0,1,2]){
 assert.equal(s.zone,expected);
 for(const q of [...s.cityItems]){s.p.x=q.x;s.p.z=q.z;c.down('C',0);}
 for(const e of [...s.living])s.hit(e,1000,0);
 assert(s.exitOpen);s.p.x=0;s.p.z=s.geo.length-4;c.down('C',1);c.tick(2);
}
assert.equal(s.zone,4,'bar leads to boss');
const boss=s.living.find(e=>e.kind==='boss');boss.hp=10;s.bossOpen=5;s.p.x=boss.x;s.p.z=boss.z-1.5;s.p.yaw=0;s.p.inv=100;
s.action('punch');for(let i=0;i<40;i++)s.update(1/60,{});
assert.equal(s.zone,3,'real timed punch transitions to race without null attack');assert(s.race.postBoss);
s.p.x=0;s.p.z=9;c.down('C',3);assert(s.race.mounted);s.race.countdown=0;s.p.z=s.geo.length-4;s.update(1/60,{});assert(s.race.finished);c.down('C',4);
for(let i=0;i<500;i++)s.update(1/60,{});assert(s.won);console.log('PASS uninterrupted key → power → bar → timed boss kill → motorcycle → finish → victory');
const actions=[],fake={zone:0,action(k){actions.push(k);return true;},canInteract:false};const b=createABC(fake);
b.down('A',0);b.down('A',100);assert.deepEqual(actions.splice(0),['jump','jump']);
for(let t=0;t<3;t++){b.down('B',t*250);b.up('B',t*250+60);}assert.deepEqual(actions.splice(0),['punch','punch','kick']);
b.down('B',1000);b.tick(1400);b.up('B',1500);assert.deepEqual(actions.splice(0),['attack']);
b.down('B',1600);b.reset();b.up('B',1700);assert.equal(actions.length,0);
b.down('C',1800);fake.canInteract=true;b.down('C',1900);assert.deepEqual(actions.splice(0),['scream','interact']);
fake.race={mounted:true,finished:false};b.down('B',2000);b.up('B',2100);assert.deepEqual(actions.splice(0),['dash']);
fake.race=null;fake.attack={kind:'punch'};b.down('B',2200);b.up('B',2250);assert.equal(actions.length,0);fake.attack=null;b.tick(2300);assert.equal(actions.length,1);
console.log('PASS ABC double jump, combo, hold, cancellation, contextual C, motorcycle boost and buffered attack');
