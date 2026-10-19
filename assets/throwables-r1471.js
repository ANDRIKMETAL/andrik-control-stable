import {blocked} from './portrait-core-r1295.js?v=r1471';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),types=['knife','bottle','brick'];
export const THROWABLE_NAMES={knife:'Нож',bottle:'Бутылка',brick:'Обломок'};
const finite=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
function floor(s,p){return s.geo.platforms.filter(f=>!f.gone&&!f.objectTop&&Math.abs(p.x-f.x)<f.w/2-.08&&Math.abs(p.z-f.z)<f.d/2-.08&&f.h<=p.y+.1).sort((a,b)=>b.h-a.h)[0];}
function segmentDistance(a,b,p){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,n=dx*dx+dy*dy+dz*dz,t=n?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/n,0,1):0;return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y,a.z+dz*t-p.z);}
export function attachThrowables(s,{saved=null}={}){
 if(s.throwables)return s;const base={load:s.load.bind(s),restore:s.restore.bind(s),snapshot:s.snapshot.bind(s),update:s.update.bind(s),action:s.action.bind(s),enemy:s.enemy.bind(s),emit:s.emit.bind(s)};
 let serial=0,ground=[],flights=[],held=null,pose=null,lastZone=s.zone;
 const active=()=>!s.dead&&!s.won&&!s.finale&&!s.vehicleActive&&!s.race?.mounted;
 function spawnGround(type,p,id){if(ground.length>=24||!finite(p)||!types.includes(type))return null;const f=floor(s,{...p,y:p.y+.5});if(!f)return null;const q={id:id||'loose-'+(++serial),type,x:p.x,y:f.h,z:p.z};ground.push(q);return q;}
 function reset(data){
  serial=0;ground=[];flights=[];held=null;pose=null;lastZone=s.zone;
  if(s.isCity&&s.zone===3)return;
  const record=data?.throwablesR1471;
  if(record?.version===1&&record.zone===s.zone){
   for(const q of (record.ground||[]).slice(0,24))if(finite(q))spawnGround(q.type,q,typeof q.id==='string'?q.id.slice(0,80):undefined);
   held=types.includes(record.held)?record.held:null;serial=Math.max(24,Number(record.serial)||0);return;
  }
  const platforms=s.geo.platforms.filter(f=>!f.gone&&!f.objectTop&&!f.weaponCrate&&!f.stair&&f.w>2.5&&f.d>2.5);
  for(let i=0;i<6&&platforms.length;i++){
   const f=platforms[Math.min(platforms.length-1,Math.floor(platforms.length*(i+.5)/6))],single=platforms.length<3;
   const p={x:single?(i%2?1:-1)*Math.min(f.w*.28,5):f.x+(i%2?-.7:.7),y:f.h,z:single?Math.max(6,Math.min(s.geo.length-5,s.geo.length*(i+1)/8)):f.z};
   // Large floor rectangles need their local centre for non-city worlds.
   if(single&&!s.isCity)p.x+=f.x;
   const wall=s.geo.walls.some(w=>!w.towerRing&&p.y<w.h&&p.x>w.x-w.w/2-.25&&p.x<w.x+w.w/2+.25&&p.z>w.z-w.d/2-.25&&p.z<w.z+w.d/2+.25);
   if(!wall)spawnGround(types[i%3],p,'placed-'+i);
  }
 }
 function launch(type,from,target,friendly,source){
  if(flights.length>=14)return false;const len=distance(from,target),time=clamp(len/(friendly?15:11),.28,1.35),gravity=type==='knife'?5:12;
  const q={id:'flight-'+(++serial),type,x:from.x,y:from.y,z:from.z,vx:(target.x-from.x)/time,vz:(target.z-from.z)/time,vy:(target.y-from.y+.5*gravity*time*time)/time,gravity,age:0,life:2.8,friendly,source,damage:type==='knife'?friendly?32:12:type==='bottle'?friendly?24:10:friendly?38:15};
  flights.push(q);s.emit('objectThrow',{...from,kind:type,friendly,source});return true;
 }
 function nearby(){return ground.filter(q=>distance(q,s.p)<1.65&&Math.abs(q.y-s.p.y)<.8).sort((a,b)=>distance(a,s.p)-distance(b,s.p))[0]||null;}
 function useC(){
  if(!active()||s.p.down>0||s.attack||pose||s.traversal?.ledge)return false;
  if(s.canInteract)return base.action('interact');
  if(held){
   const p=s.p,direction={x:Math.sin(p.yaw),z:Math.cos(p.yaw)},candidates=s.living.filter(e=>{const d=distance(e,p);return d<20&&d>1&&((e.x-p.x)*direction.x+(e.z-p.z)*direction.z)/d>.78&&Math.abs((e.y||0)-p.y)<4&&!blocked({...p,y:p.y+1},{...e,y:(e.y||0)+1},s.geo.walls);}).sort((a,b)=>distance(a,p)-distance(b,p));
   const target=candidates[0],aim=target?{x:target.x,y:(target.y||0)+1.05,z:target.z}:{x:p.x+direction.x*16,y:p.y+.95,z:p.z+direction.z*16};
   pose={t:0,duration:.62,released:false,type:held,aim,yaw:p.yaw};s.emit('notice',{text:THROWABLE_NAMES[held]+' · бросок'});return true;
  }
  const item=nearby();if(item){held=item.type;ground=ground.filter(q=>q!==item);s.emit('objectPickup',{...item});s.emit('notice',{text:THROWABLE_NAMES[held]+' в руке · C: метнуть'});return true;}
  return base.action('scream');
 }
 const api=s.throwables={version:1,get ground(){return ground;},get flights(){return flights;},get held(){return held;},get pose(){return pose;},get nearby(){return nearby();},useC};
 s.action=function(kind){if(kind==='contextC')return useC();if(pose&&kind!=='dodge')return false;if(kind==='dodge'&&pose){pose=null;}return base.action(kind);};
 s.load=function(...args){const r=base.load(...args);reset();return r;};
 s.restore=function(data){const r=base.restore(data);reset(data);return r;};
 s.snapshot=function(){
  // A flying knife is restored on the ground, never re-hits somebody on reload.
  const settled=[...ground];for(const q of flights){if(q.type==='bottle')continue;const f=floor(s,q);if(f)settled.push({id:q.id,type:q.type,x:q.x,y:f.h,z:q.z});}
  return {...base.snapshot(),throwablesR1471:{version:1,zone:s.zone,serial,ground:settled.slice(0,24),held}};
 };
 // Human ranged fighters use their existing wind-up, attack slot and cooldown.
 // Converting immediately here keeps the old orb from hitting the player too.
 s.enemy=function(e,dt){
  const physical=!s.world&&!s.isRuins||s.isCity,eligible=physical&&['mask','shadow','double'].includes(e.kind)&&e.tactic?.role!=='duelist';
  const before=new Set(s.shots);const r=base.enemy(e,dt);
  if(!eligible)return r;
  const t=e.tactic;if(t?.kind==='shot'&&['windup','strike'].includes(t.phase)){e.throwVisual1471={type:e.id%2?'knife':'bottle',t:t.t,phase:t.phase,wind:t.wind};}else e.throwVisual1471=null;
  for(const q of s.shots.filter(q=>!before.has(q)&&(!q.source||q.source===e.id))){
   s.shots=s.shots.filter(x=>x!==q);const item=ground.find(item=>distance(e,item)<2.5&&Math.abs(item.y-(e.y||0))<.8),type=item?.type||(e.id%2?'knife':'bottle');if(item)ground=ground.filter(x=>x!==item);
   const yaw=t?.yaw??e.yaw,from={x:e.x+Math.sin(yaw)*.65,y:(e.y||0)+1.3,z:e.z+Math.cos(yaw)*.65};
   const d=Math.max(3,distance(e,s.p));launch(type,from,{x:e.x+Math.sin(yaw)*d,y:(t?.lock?.y??s.p.y)+1.0,z:e.z+Math.cos(yaw)*d},false,e.id);
  }
  return r;
 };
 s.emit=function(type,data={}){base.emit(type,data);if(['smashR1301','weaponCacheBreak','decorBreak'].includes(type)&&finite({x:data.x,y:data.y||0,z:data.z}))spawnGround(serial%2?'brick':'bottle',{x:data.x+.4,y:data.y||0,z:data.z+.2});};
 function settle(q,impact=false){
  q.life=0;if(q.type==='bottle'&&impact){s.emit('objectBreak',{x:q.x,y:q.y,z:q.z,kind:q.type});return;}
  spawnGround(q.type,q,q.id);
 }
 s.update=function(dt,input={}){
  dt=clamp(Number(dt)||0,0,.035);base.update(dt,input);if(lastZone!==s.zone){reset();return;}
  if(!active()){if(s.dead){pose=null;if(held){spawnGround(held,{x:s.p.x,y:s.p.y,z:s.p.z});held=null;}}return;}
  if(pose){pose.t+=dt;if(!pose.released&&pose.t>=.24){pose.released=true;const p=s.p,yaw=pose.yaw;if(launch(pose.type,{x:p.x+Math.sin(yaw)*.6,y:p.y+1.43,z:p.z+Math.cos(yaw)*.6},pose.aim,true,0))held=null;}if(pose.t>=pose.duration)pose=null;}
  for(const q of flights){
   const old={x:q.x,y:q.y,z:q.z};q.age+=dt;q.life-=dt;q.vy-=q.gravity*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
   if(blocked(old,q,s.geo.walls)){q.x=old.x;q.y=old.y;q.z=old.z;settle(q,true);continue;}
   const targets=q.friendly?s.living:[s.p];let hit=false;
   for(const e of targets){if(q.age<.05)continue;const centre={x:e.x,y:(e.y||0)+(q.friendly&&e.kind==='boss'?1.55:1.0),z:e.z};
    if(segmentDistance(old,q,centre)>(q.friendly&&e.kind==='boss'?1.5:.56))continue;
    if(q.friendly){const attack=s.attack;s.attack={kind:'throw',t:0,duration:1,type:q.type};try{s.hit(e,q.damage,.65);}finally{s.attack=attack;}}
    else{s.damage(q.damage);s.emit('objectNearHit',{x:q.x,y:q.y,z:q.z,source:q.source});}
    settle(q,true);hit=true;break;
   }
   if(hit)continue;const f=floor(s,{...q,y:Math.max(old.y,q.y)+.3});if(f&&q.vy<0&&q.y<=f.h+.1){q.y=f.h;settle(q,true);}else if(q.life<=0||q.y< -20)settle(q,false);
  }
  flights=flights.filter(q=>q.life>0);
 };
 reset(saved);return s;
}
