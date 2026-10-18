import {move,blocked} from './portrait-core-r1295.js?v=r1466';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const inside=(f,p,margin=.05)=>Math.abs(p.x-f.x)<f.w/2-margin&&Math.abs(p.z-f.z)<f.d/2-margin;
const nearest=(list,p)=>list.slice().sort((a,b)=>distance(a,p)-distance(b,p))[0];
export function routeFloor(state,p){return state.geo.platforms.filter(f=>!f.gone&&inside(f,p)).sort((a,b)=>Math.abs(a.h-(p.y||0))-Math.abs(b.h-(p.y||0)))[0]||null;}
export function routePath(state,start,goal){return route(state,start,goal)}
export function routeJumpPoints(from,to){return jumpPoints(from,to)}
function route(state,start,goal){
 const previous=new Map([[start,null]]),queue=[start];
 for(let index=0;index<queue.length;index++){
  const node=queue[index];if(node===goal)break;
  for(const edge of state.routeLinks){const next=edge.a===node?edge.b:edge.b===node?edge.a:null;if(next===null||previous.has(next))continue;
   const af=state.geo.platforms[node],bf=state.geo.platforms[next],a={...af,y:af.h},b={...bf,y:bf.h},walls=state.geo.walls.filter(w=>!w.weaponCrate&&w.refugeNode!==node&&w.refugeNode!==next&&!(w.oceanGate&&(node===goal||next===goal)));if(blocked(a,b,walls))continue;
   previous.set(next,node);queue.push(next);
  }
 }
 if(!previous.has(goal))return [];
 const path=[];for(let node=goal;node!==null;node=previous.get(node))path.unshift(node);return path;
}
function edgePoint(from,to){const dx=to.x-from.x,dz=to.z-from.z,n=Math.hypot(dx,dz)||1,x=dx/n,z=dz/n,t=Math.min(Math.abs(x)>.001?(from.w/2-.55)/Math.abs(x):Infinity,Math.abs(z)>.001?(from.d/2-.55)/Math.abs(z):Infinity);return{x:from.x+x*t,z:from.z+z*t,y:from.h};}
function jumpPoints(from,to){
 const a=edgePoint(from,to),b=edgePoint(to,from),dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
 const sourceReach=Math.min(Math.abs(ux)>.001?from.w/2/Math.abs(ux):Infinity,Math.abs(uz)>.001?from.d/2/Math.abs(uz):Infinity);
 const reach=Math.min(Math.abs(ux)>.001?to.w/2/Math.abs(ux):Infinity,Math.abs(uz)>.001?to.d/2/Math.abs(uz):Infinity),entry=len-reach;
 if(sourceReach<entry)return{from:a,to:b};
 // Overlapping decks need a short jump across their shared edge, not two
 // reversed edge points on opposite sides of the arena.
 const start=Math.max(0,Math.min(sourceReach-.65,len*.45,entry-.9)),end=Math.min(len+reach-.65,Math.max(entry+.7,to.h<=from.h+.36?sourceReach+.65:0));
 return{from:{x:from.x+ux*start,z:from.z+uz*start,y:from.h},to:{x:from.x+ux*end,z:from.z+uz*end,y:to.h}};
}
export function walkRoute(state,e,target,speed,dt){
 const d=distance(e,target);if(d<.04)return;
 const old={x:e.x,z:e.z};move(e,(target.x-e.x)/d*Math.min(d,speed*dt),(target.z-e.z)/d*Math.min(d,speed*dt),state.geo.walls,.4);
 const floor=routeFloor(state,e);if(!floor||Math.abs(floor.h-(e.y||0))>.36){e.x=old.x;e.z=old.z;}else{e.y=floor.h;e.navPlatform=floor.node;}
}
export function navigateRoute(state,e,target,dt,speed=3.1){
 const current=routeFloor(state,e)||state.geo.platforms[e.navPlatform],goal=routeFloor(state,target)||nearest(state.geo.platforms.filter(f=>!f.refuge),target);
 if(!current||!goal)return;
 if(current.node===goal.node){walkRoute(state,e,target,speed,dt);return;}
 if(e.routeGoal!==goal.node||e.routeStart!==current.node||state.time>(e.routeUntil||0)){
  e.routeGoal=goal.node;e.routeStart=current.node;e.routeUntil=state.time+.65;e.route=route(state,current.node,goal.node);
 }
 const next=state.geo.platforms[e.route?.[1]];if(!next)return;
 const edge=state.routeLinks.find(q=>q.a===current.node&&q.b===next.node||q.b===current.node&&q.a===next.node);
 if(edge?.jump){
  const points=jumpPoints(current,next);
  if(distance(e,points.from)>.28){walkRoute(state,e,points.from,speed,dt);return;}
  const gap=distance(points.from,points.to),walls=state.geo.walls.filter(w=>w.refugeNode!==current.node&&w.refugeNode!==next.node&&!(w.weaponCrateId&&w.weaponCrateId===next.weaponCrateId));if(gap>5.3||Math.abs(points.to.y-points.from.y)>2.1||blocked(points.from,points.to,walls))return;
  e.navJump={from:{x:e.x,z:e.z,y:e.y||0},to:points.to,node:next.node,t:0,duration:.52+gap/8};e.mode='leap';e.t=0;
 }else walkRoute(state,e,next.node===goal.node?target:jumpPoints(current,next).to,speed,dt);
}
export function tickRouteJump(state,e,dt){
 const jump=e.navJump;if(!jump)return false;
 jump.t+=dt;const u=clamp(jump.t/jump.duration,0,1);
 e.x=jump.from.x+(jump.to.x-jump.from.x)*u;e.z=jump.from.z+(jump.to.z-jump.from.z)*u;e.y=jump.from.y+(jump.to.y-jump.from.y)*u+Math.sin(Math.PI*u)*(1.5+Math.max(0,jump.to.y-jump.from.y)*.7);e.mode='leap';
 if(u>=1){e.y=jump.to.y;e.navPlatform=jump.node;e.navJump=null;e.routeUntil=0;e.mode='chase';e.cd=Math.max(.4,e.cd||0);}
 return true;
}

