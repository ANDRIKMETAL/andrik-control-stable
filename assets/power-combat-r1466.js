import {blocked} from './portrait-core-r1295.js?v=r1466';
import {bossDamage,modernBoss} from './encounters-r1448.js?v=r1448';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function comboSequence(s){const n=s.growthStats?.comboLevel||0;return ['slash','slashReverse','kick','slashSpin','palm','airKick','meteor'].slice(0,n>=6?7:n>=5?6:n>=4?5:n>0?4:3);}
export function mechanicalEnemy(s,e){return e.kind==='robot'||e.kind==='drone'||['warMech','clockwork'].includes(e.bossType)||s.world===4||s.world===5||s.isRuins&&!s.isCity&&!s.world&&e.kind!=='dog';}
export function attachPowerCombat(s,{saved=null}={}){
 if(s.powerCombat)return s;const base={action:s.action.bind(s),attackHit:s.attackHit.bind(s),update:s.update.bind(s),hit:s.hit.bind(s),load:s.load.bind(s),snapshot:s.snapshot.bind(s),restore:s.restore.bind(s)};
 let cd=clamp(Number(saved?.powerR1466?.rageCD)||0,0,24),serial=0;s.effects1466=[];
 const eligible=()=>!s.dead&&!s.won&&!s.finale&&!s.vehicleActive&&!s.race?.mounted&&!(s.p.down>0);
 const boss=()=>s.living.find(e=>e.kind==='boss'&&distance(e,s.p)<4.1+(e.hurtRadius||0)&&Math.abs((e.y||0)-s.p.y)<2&&!blocked(s.p,e,s.geo.walls)&&Math.cos(Math.atan2(e.x-s.p.x,e.z-s.p.z)-s.p.yaw)>.1);
 s.powerCombat={get rageCD(){return cd;},get rageReady(){return eligible()&&!s.attack&&s.growthStats.comboLevel>=4&&cd<=0&&s.p.energy>=45&&!!boss();}};
 function effect(type,e){s.effects1466.push({id:++serial,type,x:e.x,y:(e.y||0)+.7,z:e.z,t:0});if(s.effects1466.length>6)s.effects1466.shift();}
 s.action=function(kind){
  if(kind==='rage'){
   if(!s.powerCombat.rageReady)return false;const target=boss();s.p.energy-=45;cd=24;
   s.attack={kind:'rage',target:target.id,t:0,duration:1.92,hitAt:.28,hit:false,rounds:0,rageCount:s.growthStats.comboLevel>=6?5:4,finishWeapon:s.weaponStats.selected};s.lastAttack=s.time;s.emit('rageStart');s.emit('notice',{text:'ЯРОСТЬ · серия ударов по боссу'});return true;
  }
  if(['palm','airKick','meteor'].includes(kind)){
   const need=kind==='palm'?4:kind==='airKick'?5:6;if(!eligible()||s.attack||s.growthStats.comboLevel<need)return false;
   if(s.finisherTarget)return s.action('slash');
   if(kind!=='palm'&&s.p.grounded){s.p.vy=kind==='meteor'?5.6:6.1;s.p.grounded=false;s.p.coyote=0;s.jumps=1;s.emit('jump');}
   s.attack={kind,t:0,duration:kind==='palm'?.59:kind==='airKick'?.86:1.05,hitAt:kind==='palm'?.27:kind==='airKick'?.39:.46,hit:false,finishWeapon:s.weaponStats.selected,victims:new Set()};s.lastAttack=s.time;s.emit('powerStart',{kind});return true;
  }
  const previous=s.attack,result=base.action(kind);if(result&&s.attack!==previous&&s.attack?.kind==='finish')s.attack.finishWeapon=s.weaponStats.selected;return result;
 };
 s.attackHit=function(){
  const a=s.attack;if(!a||!['palm','airKick','meteor','rage'].includes(a.kind))return base.attackHit();
  const rage=a.kind==='rage',round=rage?a.rounds||0:0,baseDamage=rage?[15,17,21,29,36][round]:a.kind==='palm'?19:a.kind==='airKick'?28:43;
  const range=a.kind==='palm'?2.35:a.kind==='airKick'?3.1:3.4,mult=a.kind==='palm'||a.kind==='airKick'?1+(s.growthStats.comboLevel-3)*.10:s.growthStats.bladeDamage*s.weaponStats.damage*(rage?1+(s.growthStats.comboLevel-4)*.10:1);
  for(const e of s.living){
   const d=distance(e,s.p),dot=((e.x-s.p.x)*Math.sin(s.p.yaw)+(e.z-s.p.z)*Math.cos(s.p.yaw))/Math.max(.01,d);if(rage&&e.id!==a.target||!rage&&a.victims.has(e.id)||d>(e.kind==='boss'?4.1+(e.hurtRadius||0):range)||dot<.1||Math.abs((e.y||0)-s.p.y)>(a.kind==='palm'?1.6:2.2)||blocked(s.p,e,s.geo.walls))continue;
   if(e.kind==='boss'&&!modernBoss(s)&&s.bossOpen<=0){s.emit('blocked');continue;}
   if(!rage)a.victims.add(e.id);s.hit(e,bossDamage(s,e,Math.round(baseDamage*mult)),e.kind==='boss'?0:a.kind==='palm'?.7:3.0);
  }
  if(rage)a.rounds=round+1;s.emit('swing',{kind:a.kind});
 };
 s.hit=function(e,n,knock){const hp=e.hp;const result=base.hit(e,n,knock);
  if(hp>0&&e.hp<=0&&mechanicalEnemy(s,e)&&!e.mechanicalBurst1466&&(e.id%2===0||e.kind==='boss'||s.attack?.kind==='finish')){e.mechanicalBurst1466=true;effect('mechanical',e);s.emit('mechanicalBurst',{x:e.x,y:e.y||0,z:e.z,enemy:e.id});}
  return result;
 };
 s.update=function(dt,input={}){
  const before=s.attack,zone=s.zone;cd=Math.max(0,cd-clamp(dt,0,.035));base.update(dt,before?.kind==='rage'?{...input,x:(input.x||0)*.35,z:(input.z||0)*.35}:input);
  if(s.zone===zone&&s.attack===before&&before?.kind==='rage'&&!s.dead&&!s.finale){const times=[.28,.61,.95,1.30,1.63],count=s.growthStats.comboLevel>=6?5:4;while((before.rounds||0)<count&&before.t>=times[before.rounds||0])s.attackHit();}
  for(const fx of s.effects1466)fx.t+=clamp(dt,0,.035);s.effects1466=s.effects1466.filter(f=>f.t<1.05);
 };
 s.load=function(...args){const result=base.load(...args);s.effects1466=[];return result;};
 s.snapshot=function(){return {...base.snapshot(),powerR1466:{version:1,rageCD:cd}};};
 s.restore=function(raw){const result=base.restore(raw);cd=Math.max(cd,clamp(Number(raw?.powerR1466?.rageCD)||0,0,24));s.effects1466=[];return result;};
 return s;
}
