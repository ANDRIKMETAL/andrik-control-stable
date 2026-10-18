import {move} from './portrait-core-r1295.js?v=r1468';
import {enemyRouteDirection} from './enemy-navigation-r1446.js?v=r1468';
const plans=new WeakMap(),jumps=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inside=(f,p,m=.12)=>!f.gone&&Math.abs(p.x-f.x)<f.w/2-m&&Math.abs(p.z-f.z)<f.d/2-m;
function surface(s,p){return s.geo.platforms.filter(f=>inside(f,p,.05)&&f.h<=(p.y||0)+.25).sort((a,b)=>Math.abs(a.h-(p.y||0))-Math.abs(b.h-(p.y||0)))[0]||null;}
function clearPoint(s,p,r=.40){return !s.geo.walls.some(w=>{
 if(w.towerRing||(p.y||0)>=w.h-.025||Number.isFinite(w.base)&&(p.y||0)+1.78<w.base)return false;
 const x=Math.max(Math.abs(p.x-w.x)-w.w/2,0),z=Math.max(Math.abs(p.z-w.z)-w.d/2,0);return x*x+z*z<r*r-1e-5;
});}
function sampleJump(h,u){return{x:h.from.x+(h.to.x-h.from.x)*u,z:h.from.z+(h.to.z-h.from.z)*u,y:h.from.y+(h.to.y-h.from.y)*u+Math.sin(Math.PI*u)*(1.9+Math.max(0,h.to.y-h.from.y)*.5)};}
function validJump(s,from,to){
 if(distance(from,to)>5.1||Math.abs(to.y-from.y)>2.2)return false;
 const h={from,to};for(let i=0;i<=28;i++)if(!clearPoint(s,sampleJump(h,i/28)))return false;return true;
}
function bounds(s,f,height){
 const b={minX:f.x-f.w/2,maxX:f.x+f.w/2,minZ:f.z-f.d/2,maxZ:f.z+f.d/2};
 for(const w of s.geo.walls)if(w.h>height+.1&&w.h<=2.3&&Math.abs(w.x-f.x)<(w.w+f.w)/2+.1&&Math.abs(w.z-f.z)<(w.d+f.d)/2+.1){b.minX=Math.min(b.minX,w.x-w.w/2);b.maxX=Math.max(b.maxX,w.x+w.w/2);b.minZ=Math.min(b.minZ,w.z-w.d/2);b.maxZ=Math.max(b.maxZ,w.z+w.d/2);}
 return b;
}
function makePlan(s,e,current,goal){
 const rising=goal.h>current.h+.35,object=rising?goal:current,b=bounds(s,object,Math.min(goal.h,current.h)),a=e.id*2.399963;
 const roof={x:clamp(s.p.x+Math.sin(a)*.42,object.x-object.w/2+.47,object.x+object.w/2-.47),z:clamp(s.p.z+Math.cos(a)*.42,object.z-object.d/2+.47,object.z+object.d/2-.47),y:object.h};
 const ground=[{x:b.minX-1.15,z:roof.z},{x:b.maxX+1.15,z:roof.z},{x:roof.x,z:b.minZ-1.15},{x:roof.x,z:b.maxZ+1.15}].map(p=>({...p,y:rising?current.h:goal.h}));
 const candidates=ground.map(p=>({from:rising?p:{x:clamp(p.x,object.x-object.w/2+.48,object.x+object.w/2-.48),z:clamp(p.z,object.z-object.d/2+.48,object.z+object.d/2-.48),y:object.h},to:rising?roof:p})).filter(h=>surface(s,h.from)&&surface(s,h.to)&&validJump(s,h.from,h.to));
 candidates.sort((a,b)=>distance(e,a.from)-distance(e,b.from));
 for(const h of candidates){const dir=enemyRouteDirection(e,h.from,s.geo,s.time);if(distance(e,h.from)<.25||Math.hypot(dir.x,dir.z)>.01)return {...h,current,goal,geo:s.geo,until:s.time+.9};}
 return null;
}
function walk(s,e,target,speed,dt){
 const old={x:e.x,z:e.z,y:e.y||0},dir=enemyRouteDirection(e,target,s.geo,s.time),d=distance(e,target),step=Math.min(d,speed*dt);
 move(e,dir.x*step,dir.z*step,s.geo.walls,.40);
 const f=surface(s,e);if(!f||Math.abs(f.h-old.y)>.36){e.x=old.x;e.z=old.z;}else e.y=f.h;
 e.homeY=e.y||0;e.vx=(e.x-old.x)/Math.max(dt,.001);e.vz=(e.z-old.z)/Math.max(dt,.001);
}
export function settleCityEnemy(s,e){
 if(!s.isCity||e.kind==='boss')return;const f=surface(s,e);e.y=e.homeY=f?.h||0;move(e,0,0,s.geo.walls,.40);jumps.delete(e);plans.delete(e);e.cityHopPhase=null;
}
export function keepCitySupport(s,e,before){
 if(!s.isCity||jumps.has(e))return;const f=surface(s,e);
 if(!f||Math.abs(f.h-(e.y||0))>.36){e.x=before.x;e.z=before.z;e.y=before.y;}
}
export function tickCityJump(s,e,dt){
 const h=jumps.get(e);if(!h)return false;
 if(e.hp<=0){jumps.delete(e);settleCityEnemy(s,e);return false;}
 h.t+=dt;const u=clamp(h.t/h.duration,0,1),p=sampleJump(h,u);
 if(!clearPoint(s,p)){Object.assign(e,h.from);jumps.delete(e);e.cityHopPhase=null;e.mode='chase';return true;}
 const old={x:e.x,z:e.z};Object.assign(e,p);e.vx=(e.x-old.x)/Math.max(dt,.001);e.vz=(e.z-old.z)/Math.max(dt,.001);e.cityHopPhase=u;e.mode='leap';
 if(u>=1){e.y=e.homeY=h.to.y;e.cityHopPhase=null;jumps.delete(e);plans.delete(e);e.mode='chase';e.cd=Math.max(.35,e.cd||0);}
 return true;
}
export function navigateCityEnemy(s,e,target,speed,dt){
 const old={x:e.x,z:e.z};let current=surface(s,e);const goal=surface(s,s.p);
 if(!current||!goal)return;
 if(Math.abs(current.h-(e.y||0))>.36){e.y=e.homeY=current.h;move(e,0,0,s.geo.walls,.4);current=surface(s,e)||current;plans.delete(e);}
 const change=Math.abs(current.h-goal.h)>.36||current.objectTop&&current!==goal;
 if(change){
  let next=goal;if(current.objectTop&&goal.objectTop&&distance(current,goal)>5)next=s.geo.platforms.find(f=>f.h===0&&!f.objectTop)||goal;
  let plan=plans.get(e);if(!plan||plan.geo!==s.geo||plan.current!==current||plan.goal!==next||s.time>plan.until){plan=makePlan(s,e,current,next);if(plan)plans.set(e,plan);}
  if(plan){
   if(distance(e,plan.from)<.23&&validJump(s,{x:e.x,y:e.y||0,z:e.z},plan.to)){
    jumps.set(e,{from:{x:e.x,y:e.y||0,z:e.z},to:plan.to,t:0,duration:.62+distance(e,plan.to)/8});e.mode='leap';e.cityHopPhase=0;
   }else walk(s,e,plan.from,speed,dt);
   return;
  }
 }
 let dest={...target,y:current.h};
 if(current.objectTop){dest.x=clamp(dest.x,current.x-current.w/2+.42,current.x+current.w/2-.42);dest.z=clamp(dest.z,current.z-current.d/2+.42,current.z+current.d/2-.42);}
 else if(target===s.p&&s.living.length>1){
  const a=e.id*2.399963,point={x:target.x+Math.sin(a)*1.85,z:target.z+Math.cos(a)*1.85,y:current.h};if(clearPoint(s,point)&&inside(current,point))dest=point;
 }
 walk(s,e,dest,speed,dt);
 // Small collision-aware separation prevents an entire group occupying one point.
 for(const other of s.living){if(other===e||other.kind==='boss'||Math.abs((other.y||0)-(e.y||0))>.5)continue;const d=distance(e,other);if(d>.01&&d<.88){const x=e.x,z=e.z;move(e,(e.x-other.x)/d*dt*.9,(e.z-other.z)/d*dt*.9,s.geo.walls,.4);if(!inside(current,e,.10)){e.x=x;e.z=z;}}}
 e.vx=(e.x-old.x)/Math.max(dt,.001);e.vz=(e.z-old.z)/Math.max(dt,.001);
}
