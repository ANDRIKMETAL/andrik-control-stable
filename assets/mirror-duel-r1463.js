const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
export const isMirrorDuel=(s,e)=>e.kind==='double'&&!s.isCity&&!s.isRuins&&!s.world;

function beginSlash(s,e,second=false){
 const t=e.tactic;t.duelStep=((t.duelStep??-1)+1)%3;t.phase='windup';t.kind='melee';t.t=0;
 t.wind=t.duelStep===2?.62:second?.30:.46;t.active=.20;t.recovery=t.duelStep===2?.70:.38;
 t.contact=false;t.missed=false;t.yaw=angle(e,s.p);t.chainLeft=second?0:t.duelStep===2?0:1;
 e.yaw=t.yaw;e.mode='windup';e.attackKind='sword';e.t=0;
 s.emit('tacticWarn',{enemy:e.id,role:'duelist',x:e.x,y:e.y||0,z:e.z});
}
// Uses the same sword poses and contact range as Lyra. No ranged attack exists here.
export function updateMirrorDuel(s,e,dt,{travel,blocked,attackSlot}){
 const t=e.tactic,p=s.p,d=distance(e,p),los=!blocked(e,p,s.geo.walls);
 t.dodgeCD=Math.max(0,(t.dodgeCD||0)-dt);t.parryCD=Math.max(0,(t.parryCD||0)-dt);
 t.stamina=Math.min(60,(t.stamina??60)+dt*9);
 if(t.phase==='evade'){
  e.mode='evade';travel(s,e,t.evadeTarget,5.4,dt);e.yaw=angle(e,p);
  if(t.t>=.24){t.phase='recover';t.t=0;t.recovery=.42;t.chainLeft=0;t.exposed=.24;}
  return;
 }
 if(t.phase==='windup'){
  e.mode='windup';e.yaw=t.yaw;
  if(t.t>=t.wind){t.phase='strike';t.t=0;e.t=0;e.mode='strike';}
  return;
 }
 if(t.phase==='strike'){
  e.mode='strike';e.yaw=t.yaw;
  if(!t.contact&&t.t>=.08){
   t.contact=true;const hp=p.hp,front=d<.1||Math.cos(angle(e,p)-t.yaw)>.12;
   if(d<2.85&&Math.abs(p.y-(e.y||0))<1.6&&front&&los)s.damage(t.duelStep===2?15:11);
   t.missed=p.hp===hp;s.emit('mirrorSlash',{enemy:e.id,x:e.x,y:e.y||0,z:e.z,step:t.duelStep});
  }
  if(t.t>=t.active){t.phase='recover';t.t=0;e.t=0;e.mode='recover';t.counterUsed=false;t.exposed=t.missed?t.recovery:0;if(t.exposed)s.emit('counterOpen',{enemy:e.id,x:e.x,y:e.y||0,z:e.z});}
  return;
 }
 if(t.phase==='recover'){
  e.mode='recover';if(t.t<t.recovery)return;
  if(t.chainLeft>0&&d<3.1&&los&&attackSlot(s,e)){beginSlash(s,e,true);return;}
  t.phase='ready';t.t=0;t.exposed=0;e.cd=.62;
 }
 e.yaw=angle(e,p);
 if(s.attack?.kind==='slash'&&s.attack.t<.18&&d>2.1&&d<3.6&&los&&t.dodgeCD<=0&&t.stamina>=20){
  const side=t.side,yaw=angle(e,p);t.evadeTarget={x:e.x+Math.cos(yaw)*side*1.3,z:e.z-Math.sin(yaw)*side*1.3,y:e.y||0};
  t.phase='evade';t.kind='evade';t.t=0;t.dodgeCD=2.6;t.stamina-=20;e.mode='evade';return;
 }
 if(d<2.6&&los&&Math.abs(p.y-(e.y||0))<1.4&&e.cd<=0&&attackSlot(s,e)){beginSlash(s,e);return;}
 const yaw=angle(p,e)+t.side*.24;
 const goal=d<3.5?{x:p.x+Math.sin(yaw)*2.05,z:p.z+Math.cos(yaw)*2.05,y:p.y}:p;
 e.mode=d<3.5?'circle':'chase';if(d>1.65)travel(s,e,goal,d>5?3.7:2.7,dt);
}
export function mirrorParry(s,e){
 const t=e.tactic,a=s.attack;
 if(t?.role!=='duelist'||a?.kind!=='slash'||a.step>=2||s.weaponStats?.selected==='bat'||e.down>0||t.stun>0||t.phase!=='windup'||t.t>.30||t.parryCD>0||t.stamina<25||Math.cos(angle(e,s.p)-(e.yaw||0))<.5)return false;
 t.stamina-=25;t.parryCD=2.4;t.phase='recover';t.t=0;t.recovery=.72;t.chainLeft=0;t.exposed=.72;t.counterUsed=false;
 s.emit('bladeParry',{enemy:e.id,x:e.x,y:e.y||0,z:e.z});return true;
}
export function mirrorDuelPose(e){
 const t=e.tactic;if(t?.role!=='duelist'||t.kind!=='melee'||!['windup','strike','recover'].includes(t.phase))return null;
 const elapsed=t.phase==='windup'?t.t:t.phase==='strike'?t.wind+t.t:t.wind+t.active+t.t;
 return {kind:'slash',step:t.duelStep||0,t:elapsed,duration:t.wind+t.active+t.recovery,hitAt:t.wind+.08};
}
