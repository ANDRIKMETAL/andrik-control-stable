import {modernBoss,bossDamage} from './encounters-r1448.js?v=r1448';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const isBladeAction=kind=>['slash','slashReverse','slashHeavy','slashSpin','punch','backfist'].includes(kind);
export function beginBlade(state,kind){
 if(state.dead||state.won||state.finale||state.attack)return false;
 let step=kind==='slashReverse'?1:kind==='slashHeavy'?2:kind==='slashSpin'||kind==='backfist'?3:0;
 if(kind==='punch'){step=state.nextUpper?1:0;state.nextUpper=!state.nextUpper;}
 if(!state.p.grounded&&step<2)step=2;
 if(step===3&&!(state.growthStats?.comboLevel>0))return false;
 const duration=[.58,.62,.78,1.04][step],hitAt=[.25,.28,.36,.33][step];
 state.attack={kind:'slash',step,t:0,duration,hitAt,hit:false,bladeSpin:step===3,victims:new Set()};state.lastAttack=state.time;
 state.emit('bladeStart',{step});return true;
}
export function bladeHit(state,blocked){
 const a=state.attack;if(a?.kind!=='slash')return;
 a.victims??=new Set();const stats=state.growthStats,range=stats?.bladeRange??2.85;
 const base=a.step===3?(stats?.bladeSpinDamage||36):[18,20,27][a.step],damage=Math.round(base*(stats?.bladeDamage??1));let connected=false;
 for(const e of state.living){
  const d=distance(e,state.p),dot=((e.x-state.p.x)*Math.sin(state.p.yaw)+(e.z-state.p.z)*Math.cos(state.p.yaw))/Math.max(.01,d);
  if(a.victims.has(e.id)||d>(e.kind==='boss'?3.9+range-2.85:range)||!a.bladeSpin&&dot<.12||Math.abs((e.y||0)-state.p.y)>1.6||blocked(state.p,e,state.geo.walls))continue;
  if(e.kind==='boss'&&!modernBoss(state)&&state.bossOpen<=0){if(!a.blocked){a.blocked=true;state.emit('blocked');}continue;}
  a.victims.add(e.id);state.hit(e,bossDamage(state,e,damage),e.kind==='boss'?0:a.bladeSpin?2.8:a.step===2?2.05:.65);connected=true;
 }
 for(const shot of state.shots){
  const d=distance(shot,state.p),dot=((shot.x-state.p.x)*Math.sin(state.p.yaw)+(shot.z-state.p.z)*Math.cos(state.p.yaw))/Math.max(.01,d);
  if(!shot.reflectable||shot.friendly||d>range||!a.bladeSpin&&dot<.12||Math.abs((shot.y||0)-state.p.y)>1.7||blocked(state.p,shot,state.geo.walls))continue;
  const foe=state.living.find(e=>e.id===shot.source)||state.living.find(e=>!blocked(shot,e,state.geo.walls));
  if(foe){const len=Math.max(.01,distance(foe,shot));shot.vx=(foe.x-shot.x)/len*12;shot.vz=(foe.z-shot.z)/len*12;shot.friendly=true;shot.life=Math.min(shot.life,2);state.emit('bladeParry',{x:shot.x,z:shot.z});}
 }
 state.strikeWorldObjects?.(a,damage,range);
 if(connected&&a.bladeSpin&&!a.refund&&stats?.bladeEnergyReturn){a.refund=true;state.p.energy=Math.min(100,state.p.energy+stats.bladeEnergyReturn);}
 if(!a.swingEmitted){a.swingEmitted=true;state.emit('swing',{kind:'slash'});}
}
