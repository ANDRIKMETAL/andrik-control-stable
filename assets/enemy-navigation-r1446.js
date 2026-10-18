/* Small visibility graph. Routes are cached per enemy, never saved with the game. */
const maps=new WeakMap(),routes=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function intersects(a,b,w,r){
 let lo=0,hi=1;
 for(const [axis,size]of [['x','w'],['z','d']]){
  const delta=b[axis]-a[axis],min=w[axis]-w[size]/2-r,max=w[axis]+w[size]/2+r;
  if(Math.abs(delta)<1e-8){if(a[axis]<min||a[axis]>max)return false;}
  else{let u=(min-a[axis])/delta,v=(max-a[axis])/delta;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return false;}
 }
 return hi>=0&&lo<=1;
}
function floorAt(p,geo,height){
 const floors=geo.platforms||[];
 if(!floors.length)return true;
 return floors.some(f=>!f.gone&&Math.abs((f.h||0)-height)<1.25&&Math.abs(p.x-f.x)<=f.w/2-.14&&Math.abs(p.z-f.z)<=f.d/2-.14);
}
function clear(a,b,geo,height,r=.52){
 if(geo.walls.some(w=>(w.h??10)>=height+.1&&intersects(a,b,w,r)))return false;
 const length=distance(a,b),steps=Math.max(1,Math.ceil(length/.45));
 for(let i=0;i<=steps;i++)if(!floorAt({x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps},geo,height))return false;
 return true;
}
function freePoint(p,geo,height){return floorAt(p,geo,height)&&!geo.walls.some(w=>(w.h??10)>=height+.1&&intersects(p,p,w,.52));}
function outsidePadding(p,geo,height,towards){
 if(freePoint(p,geo,height))return p;
 const choices=[];
 if(!floorAt(p,geo,height))for(const f of geo.platforms||[]){
  if(f.gone||Math.abs((f.h||0)-height)>.36||f.w<.5||f.d<.5)continue;
  choices.push({x:Math.max(f.x-f.w/2+.20,Math.min(f.x+f.w/2-.20,p.x)),z:Math.max(f.z-f.d/2+.20,Math.min(f.z+f.d/2-.20,p.z))});
 }
 for(const w of geo.walls)if((w.h??10)>=height+.1&&intersects(p,p,w,.52)){
  choices.push({x:w.x-w.w/2-.56,z:p.z},{x:w.x+w.w/2+.56,z:p.z},{x:p.x,z:w.z-w.d/2-.56},{x:p.x,z:w.z+w.d/2+.56});
 }
 const valid=choices.filter(q=>distance(p,q)<2.5&&freePoint(q,geo,height));
 valid.sort((a,b)=>(distance(p,a)+distance(a,towards)*.015)-(distance(p,b)+distance(b,towards)*.015));
 return valid[0]||null;
}
function graph(geo,height){
 const key=(Math.round(height*4)/4)+'|'+geo.walls.map(w=>[w.x,w.z,w.w,w.d,w.h].join(',')).join(';')+'|'+(geo.platforms||[]).map(f=>f.gone?'0':'1').join('');
 let bank=maps.get(geo);if(!bank){bank=new Map();maps.set(geo,bank);}let cache=bank.get(key);if(cache)return cache;
 const points=[];
 for(const w of geo.walls){
  if((w.h??10)<height+.1)continue;
  for(const x of [w.x-w.w/2-.62,w.x+w.w/2+.62])for(const z of [w.z-w.d/2-.62,w.z+w.d/2+.62]){
   const p={x,z};if(floorAt(p,geo,height)&&!geo.walls.some(q=>(q.h??10)>=height+.1&&intersects(p,p,q,.52)))points.push(p);
  }
 }
 // These levels contain a few dozen rectangular obstacles. Keep a hard bound.
 const nodes=points.slice(0,192),edges=nodes.map(()=>[]);
 for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)if(clear(nodes[i],nodes[j],geo,height)){
  const d=distance(nodes[i],nodes[j]);edges[i].push([j,d]);edges[j].push([i,d]);
 }
 cache={key,nodes,edges};bank.set(key,cache);if(bank.size>8)bank.delete(bank.keys().next().value);return cache;
}
function plan(start,goal,geo,height){
 const base=graph(geo,height),nodes=[...base.nodes,{x:start.x,z:start.z},{x:goal.x,z:goal.z}],n=nodes.length,s=n-2,t=n-1;
 const edges=base.edges.map(e=>e.slice());edges.push([],[]);
 for(const i of [s,t])for(let j=0;j<i;j++)if(clear(nodes[i],nodes[j],geo,height)){
  const d=distance(nodes[i],nodes[j]);edges[i].push([j,d]);edges[j].push([i,d]);
 }
 const cost=Array(n).fill(Infinity),prev=Array(n).fill(-1),closed=new Set();cost[s]=0;
 for(let pass=0;pass<n;pass++){
  let u=-1,best=Infinity;
  for(let i=0;i<n;i++)if(!closed.has(i)){const score=cost[i]+distance(nodes[i],goal);if(score<best){best=score;u=i;}}
  if(u<0||u===t)break;closed.add(u);
  for(const [v,d]of edges[u])if(cost[u]+d<cost[v]){cost[v]=cost[u]+d;prev[v]=u;}
 }
 if(!Number.isFinite(cost[t]))return [];
 const path=[];for(let v=t;v!==s&&v>=0;v=prev[v])path.unshift(nodes[v]);return path;
}
export function enemyRouteDirection(entity,goal,geo,time=0){
 const height=Number(entity.homeY??entity.y)||0;
 // Physical bodies use a .4 m radius; the route graph reserves .52 m.
 // A hit, spawn or rounded corner can leave a valid body inside that padding.
 const escape=outsidePadding(entity,geo,height,goal);
 if(escape&&escape!==entity){routes.delete(entity);const d=distance(entity,escape)||1;return{x:(escape.x-entity.x)/d*Math.min(1,d/.1),z:(escape.z-entity.z)/d*Math.min(1,d/.1)};}
 goal=outsidePadding(goal,geo,height,entity)||goal;
 if(clear(entity,goal,geo,height)){routes.delete(entity);const d=distance(entity,goal)||1;return{x:(goal.x-entity.x)/d,z:(goal.z-entity.z)/d};}
 let route=routes.get(entity);
 const map=graph(geo,height);
 if(!route||route.key!==map.key||time>=route.until||distance(route.goal,goal)>1.5){
  route={key:map.key,goal:{...goal},until:time+.65,path:plan(entity,goal,geo,height)};routes.set(entity,route);
 }
 while(route.path.length&&distance(entity,route.path[0])<.035)route.path.shift();
 // Skip only waypoints that have become directly reachable, preserving corners.
 while(route.path.length>1&&clear(entity,route.path[1],geo,height))route.path.shift();
 const next=route.path[0];if(!next)return{x:0,z:0};
 const d=distance(entity,next)||1,speed=Math.min(1,d/.10);
 return{x:(next.x-entity.x)/d*speed,z:(next.z-entity.z)/d*speed};
}
