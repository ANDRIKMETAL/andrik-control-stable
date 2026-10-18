import {blocked,move} from './portrait-core-r1295.js?v=r1467';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const linkable=new Set(['slash','kick','palm','airKick','meteor']);
function floor(s,p,margin=.42){return s.geo.platforms.find(f=>!f.gone&&!f.objectTop&&!f.weaponCrate&&Math.abs(p.x-f.x)<f.w/2-margin&&Math.abs(p.z-f.z)<f.d/2-margin&&Math.abs((p.y||0)-f.h)<.32);}
function movable(e){return e.hp>0&&e.tactic&&e.tactic.role!=='duelist'&&e.kind!=='drone'&&!(e.down>0)&&!e.navJump&&e.cityHopPhase==null&&!e.tactic.hop;}
// Distinct approach lanes on a broad shared floor. Narrow platforms and roofs
// retain their existing navigation, including jumps and obstacle avoidance.
export function crowdApproach(s,e,target){
 if(target!==s.p||!movable(e)||e.tactic.role==='shooter'||dist(e,s.p)>11)return target;
 const f=floor(s,s.p,.9);if(!f||f.w<7||f.d<7||Math.abs((e.y||0)-s.p.y)>.35)return target;
 const peers=s.living.filter(q=>movable(q)&&q.tactic.role!=='shooter'&&dist(q,s.p)<11&&Math.abs((q.y||0)-s.p.y)<.35).sort((a,b)=>a.id-b.id).slice(0,6);
 if(peers.length<2||!peers.includes(e))return target;
 if(!Number.isFinite(e.tactic.lane1467)){
  const first=peers[0],base=Math.atan2(first.x-s.p.x,first.z-s.p.z);
  for(const [i,q]of peers.entries())if(!Number.isFinite(q.tactic.lane1467))q.tactic.lane1467=base+i*Math.PI*2/peers.length;
 }
 const radius=e.tactic.role==='heavy'?2.35:1.80,a=e.tactic.lane1467,p={x:s.p.x+Math.sin(a)*radius,y:s.p.y,z:s.p.z+Math.cos(a)*radius};
 if(!floor(s,p,.55)||blocked(e,p,s.geo.walls))return target;return p;
}
function safeShift(s,e,x,z){const old={x:e.x,y:e.y||0,z:e.z};move(e,x,z,s.geo.walls,.4);if(!floor(s,e,.16)){e.x=old.x;e.z=old.z;}}
function separate(s,dt){
 const list=s.living.filter(e=>movable(e)&&dist(e,s.p)<12&&floor(s,e,.18));
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],b=list[j];if(Math.abs((a.y||0)-(b.y||0))>.35)continue;const d=dist(a,b);if(d>=.90)continue;
  const angle=d>.001?Math.atan2(a.x-b.x,a.z-b.z):(a.id-b.id)*2.39996,amount=Math.min((.90-d)*.5,dt*1.8);
  if(!['windup','strike'].includes(a.tactic.phase))safeShift(s,a,Math.sin(angle)*amount,Math.cos(angle)*amount);
  if(!['windup','strike'].includes(b.tactic.phase))safeShift(s,b,-Math.sin(angle)*amount,-Math.cos(angle)*amount);
 }
}
export function incomingThreat(s,yaw){
 if(s.dead||s.won||s.finale||s.vehicleActive||s.race?.mounted||s.p.down>0)return null;
 let best=null;for(const e of s.living){const t=e.tactic;if(!t||t.stun>0||e.down>0||!['windup','strike'].includes(t.phase)||Math.abs((e.y||0)-s.p.y)>1.6)continue;
  const d=dist(e,s.p),shot=t.kind==='shot',relative=wrap(Math.atan2(e.x-s.p.x,e.z-s.p.z)-yaw);if(d>(shot?14:4.3)||Math.abs(relative)<.82||blocked(e,s.p,s.geo.walls))continue;
  if(t.lock&&dist(t.lock,s.p)>1.7)continue;const remaining=t.phase==='windup'?Math.max(0,t.wind-t.t):0;
  if(!best||remaining<best.remaining){const rear=Math.abs(relative)>2.25,side=relative>0?'слева':'справа';best={id:e.id,remaining,active:t.phase==='strike',arrow:rear?'↓':relative>0?'↙':'↘',text:(shot?'Выстрел ':'Удар ')+(rear?'сзади':side)};}
 }return best;
}
export function attachCombatFeel(s){
 if(s.combatFeel)return s;const base={action:s.action.bind(s),update:s.update.bind(s),damage:s.damage.bind(s),load:s.load.bind(s),restore:s.restore.bind(s)};let hurt=0;
 const eligible=()=>!s.dead&&!s.won&&!s.finale&&!s.vehicleActive&&!s.race?.mounted&&!(s.p.down>0)&&!s.dodge1460;
 s.combatFeel={get hurt(){return hurt;},get canChain(){const a=s.attack;return !!(eligible()&&a&&linkable.has(a.kind)&&a.hit&&a.t>=Math.max(a.hitAt+.12,a.duration*.74));},chain(kind){if(!this.canChain||!['slash','slashReverse','slashSpin','kick','palm','airKick','meteor'].includes(kind))return false;const old=s.attack,queued=s.queued;s.attack=null;s.queued=false;if(s.action(kind))return true;s.attack=old;s.queued=queued;return false;}};
 s.action=function(kind){if(s.p.down>0&&!s.vehicleActive)return false;return base.action(kind);};
 s.damage=function(n){const hp=s.p.hp,result=base.damage(n);if(s.p.hp<hp)hurt=.20;return result;};
 s.update=function(dt,input={}){hurt=Math.max(0,hurt-clamp(dt,0,.035));const geo=s.geo;base.update(dt,input);if(eligible()&&s.geo===geo)separate(s,clamp(dt,0,.035));};
 function clear(){hurt=0;for(const e of s.enemies)if(e.tactic)delete e.tactic.lane1467;}
 s.load=function(...args){const result=base.load(...args);clear();return result;};s.restore=function(...args){const result=base.restore(...args);clear();return result;};return s;
}
