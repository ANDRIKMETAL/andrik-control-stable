import {beginAim,updateAim} from './aim-assist-r1449.js?v=r1460';
import {isBladeAction,beginBlade,bladeHit} from './blade-r1455.js?v=r1460';
import {attackSlot,facesTarget,waitForAttack,modernBoss,bossDamage} from './encounters-r1448.js?v=r1448';
/* State-only combat additions. No renderer, assets, timers or save-key changes. */
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function downedEnemyR1447(state,e,dt){
 if(e.hp<=0||!(e.down>0)||e.kind==='boss')return false;
 const locked=state.attack?.kind==='finish'&&state.attack.target===e.id;
 if(!locked)e.down=Math.max(0,e.down-dt);
 e.downAge=(e.downAge||0)+dt;e.hit=Math.max(0,(e.hit||0)-dt);
 e.airT=Math.max(0,(e.airT||0)-dt);e.airHeight=Math.max(0,(e.airHeight||0)-dt*4);
 e.mode=e.down>.42?'down':'getup';e.cd=Math.max(.6,e.cd||0);
 if(e.down<=0){e.mode='chase';e.t=0;e.downAge=0;}
 return true;
}
export function installCombatR1447(State,{move,blocked,clamp,enemyRouteDirection}){
 const original={action:State.prototype.action,hit:State.prototype.hit,attackHit:State.prototype.attackHit,update:State.prototype.update,enemy:State.prototype.enemy};
 Object.defineProperty(State.prototype,'finisherTarget',{get(){
  if(!this.p.grounded)return null;
  return this.living.filter(e=>e.kind!=='boss'&&e.down>.42&&distance(e,this.p)<1.9&&Math.abs((e.y||0)-this.p.y)<1.2&&!blocked(this.p,e,this.geo.walls)).sort((a,b)=>distance(a,this.p)-distance(b,this.p))[0]||null;
 }});
 State.prototype.action=function(kind){
  if(kind==='interact'&&!this.canInteract)kind='slash';
  if(!this.dead&&!this.won&&!this.finale&&!this.attack&&(isBladeAction(kind)||kind==='kick')){
   const foe=this.finisherTarget;
   if(foe){this.p.yaw=Math.atan2(foe.x-this.p.x,foe.z-this.p.z);this.p.vx=this.p.vz=0;
    this.attack={kind:'finish',target:foe.id,t:0,duration:.92,hitAt:.55,hit:false};
    this.p.inv=Math.max(this.p.inv,.65);this.emit('finishStart',{enemy:foe.id});return true;}
  }
  if(isBladeAction(kind)){if(this.attack){if(this.attack.t>.08)this.queued=kind;return false;}const result=beginBlade(this,kind);if(result)beginAim(this,blocked);return result;}
  if(!this.dead&&!this.won&&!this.finale&&!this.attack&&kind==='attack'){
   this.attack={kind:'attack',t:0,duration:1.24,hitAt:.34,hit:false,spin:true,victims:new Set()};
   this.lastAttack=this.time;this.combo=0;this.emit('spinStart');return true;
  }
  const before=this.attack,result=original.action.call(this,kind);if(result&&this.attack!==before)beginAim(this,blocked);return result;
 };
 State.prototype.hit=function(e,n,knock=.5){
  if(e.hp<=0)return;const wasDown=e.down>0;
  original.hit.call(this,e,n,knock);
  const heavy=knock>=2.0||this.attack?.spin||this.attack?.bladeSpin||this.attack?.kind==='slash'&&this.attack.step===2||['kick','scream'].includes(this.attack?.kind);
  if(e.hp>0&&e.kind!=='boss'&&(wasDown||heavy)){
   e.down=wasDown?Math.max(e.down,1):2.65;e.downAge=wasDown?(e.downAge||0):0;
   e.mode='down';e.t=0;e.airT=Math.min(e.airT||0,.28);e.airHeight=Math.min(e.airHeight||0,.48);
   if(!wasDown)this.emit('knockdown',{x:e.x,z:e.z,enemy:e.id});
  }
 };
 State.prototype.attackHit=function(){
  const a=this.attack;if(!a)return;updateAim(this,this.aimInput1449,blocked,true);
  if(a.kind==='slash')return bladeHit(this,blocked);
  if(a.kind==='backfist'){
   for(const e of this.living){const d=distance(e,this.p),dot=((e.x-this.p.x)*Math.sin(this.p.yaw)+(e.z-this.p.z)*Math.cos(this.p.yaw))/Math.max(.01,d);
    if(d>(e.kind==='boss'?3.9:2.75)||dot<.45||Math.abs((e.y||0)-this.p.y)>1.6||blocked(this.p,e,this.geo.walls))continue;
    if(e.kind==='boss'&&!modernBoss(this)&&this.bossOpen<=0){this.emit('blocked');continue;}
    this.hit(e,bossDamage(this,e,this.growthStats?.backfistDamage??28),e.kind==='boss'?0:2.8);
   }this.emit('swing',{kind:'backfist'});return;
  }
  if(a.kind==='finish'){
   const target=this.enemies.find(e=>e.id===a.target);
   if(target?.hp>0&&target.down>0&&distance(target,this.p)<2.55&&Math.abs((target.y||0)-this.p.y)<1.2&&!blocked(this.p,target,this.geo.walls)){
    this.hit(target,Math.max(120,target.hp*2),0);this.emit('finishImpact',{x:target.x,z:target.z});
   }return;
  }
  if(a.kind==='attack'&&a.spin){
   if(!(a.victims instanceof Set))a.victims=new Set();
   for(const e of this.living){
    if(a.victims.has(e.id)||distance(e,this.p)>(this.growthStats?.guitarRange??3.55)+(e.hurtRadius||0)||Math.abs((e.y||0)-this.p.y)>1.8||blocked(this.p,e,this.geo.walls))continue;
    if(e.kind==='boss'&&!modernBoss(this)&&this.bossOpen<=0){if(!a.blocked){a.blocked=true;this.emit('blocked');}continue;}
    a.victims.add(e.id);this.hit(e,bossDamage(this,e,Math.round(26*(this.growthStats?.guitarDamage??1))),e.kind==='boss'?0:3.25);
   }
   for(const shot of this.shots){
    if(!shot.reflectable||shot.friendly||distance(shot,this.p)>(this.growthStats?.guitarRange??3.55))continue;
    const foe=this.living.find(e=>e.id===shot.source)||this.living.find(e=>!blocked(shot,e,this.geo.walls));
    if(foe){const d=Math.max(.01,distance(foe,shot));shot.vx=(foe.x-shot.x)/d*12;shot.vz=(foe.z-shot.z)/d*12;shot.friendly=true;shot.life=Math.min(shot.life,2);}
   }
   if(!a.swingEmitted){a.swingEmitted=true;this.emit('swing',{kind:'attack'});}return;
  }
  return original.attackHit.call(this);
 };
 State.prototype.enemy=function(e,dt){
  if(downedEnemyR1447(this,e,dt))return;
  if(e.kind==='dog'&&e.hp>0){
   e.hit=Math.max(0,e.hit-dt);e.cd-=dt;e.t+=dt;
   const d=distance(e,this.p),los=!blocked(e,this.p,this.geo.walls);if(!['windup','strike'].includes(e.mode))e.yaw=Math.atan2(this.p.x-e.x,this.p.z-e.z);
   if(e.mode==='stagger'){if(e.t>.3){e.mode='chase';e.t=0;}return;}
   if(e.mode==='windup'){if(e.t>.38){e.mode='strike';e.t=0;e.contact=false;}return;}
   if(e.mode==='strike'){
    if(!e.contact&&e.t>.13){e.contact=true;this.emit('dogBite',{x:e.x,z:e.z,enemy:e.id});if(d<1.8&&los&&this.p.y-(e.y||0)<.95&&facesTarget(e,this.p,.6))this.damage(9);}
    if(e.t>.38){e.mode='retreat';e.t=0;e.cd=1.2;}return;
   }
   if(e.mode==='retreat'&&e.t<.4){if(d>.01)move(e,(e.x-this.p.x)/d*dt*2.5,(e.z-this.p.z)/d*dt*2.5,this.geo.walls,.38);return;}
   if(d<3.6&&los&&!attackSlot(this,e)){waitForAttack(this,e,dt,move);return;}if(d<1.65&&los&&e.cd<=0&&attackSlot(this,e)){e.mode='windup';e.attackKind='bite';e.t=0;this.emit('dogWarn',{x:e.x,z:e.z,enemy:e.id});return;}
   const goal=d<20?this.p:{x:e.homeX,z:e.homeZ};const dir=enemyRouteDirection(e,goal,this.geo,this.time);
   e.mode=d<20?'chase':'patrol';if(d>1.15)move(e,dir.x*dt*4.45,dir.z*dt*4.45,this.geo.walls,.4);return;
  }
  if(e.mode==='windup'&&e.t===0&&e.kind!=='boss'&&e.kind!=='statue'){
   e.attackStep=(e.attackStep||0)+1;e.attackKind=e.attackStep%3===0?'kick':e.attackStep%2?'right':'left';e.hand=e.attackKind==='left'?1:0;
  }
  return original.enemy.call(this,e,dt);
 };
 State.prototype.update=function(dt,input={}){
  let controls=input;
  if(this.attack?.kind==='finish'){
   controls={...input,x:0,z:0,run:false};
   const target=this.enemies.find(e=>e.id===this.attack.target),d=target?distance(target,this.p):0;
   if(target&&d>1.0&&this.attack.t<.24){const step=Math.min(dt*2.5,d-1.0);move(this.p,(target.x-this.p.x)/d*step,(target.z-this.p.z)/d*step,this.geo.walls);}
   this.p.vx=this.p.vz=0;
  }
  else if(this.attack?.spin||this.attack?.bladeSpin)controls={...input,x:(input.x||0)*.55,z:(input.z||0)*.55};
  const current=this.attack;this.aimInput1449=controls;updateAim(this,controls,blocked);original.update.call(this,dt,controls);updateAim(this,controls,blocked);
  // Continuous 360-degree contact window; each enemy is struck at most once.
  if(this.attack===current&&current?.spin&&current.t>=.34&&current.t<=1.02)this.attackHit();
  if(this.attack===current&&current?.kind==='slash'&&current.t>=current.hitAt&&current.t<=current.hitAt+(current.bladeSpin?.50:.14))this.attackHit();
 };
}
