import {move} from './portrait-core-r1295.js?v=r1471';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function usable(f){return !f.gone&&!f.weaponCrate&&!f.objectTop&&f.w>1.3&&f.d>1.3;}
function clearTop(s,f,x,z){const probe={x,y:f.h+.04,z};move(probe,0,0,s.geo.walls,.28);return Math.hypot(probe.x-x,probe.z-z)<.035;}
export function findLedge(s){
 const p=s.p;if(p.grounded||s.jumps!==0||p.vy>3||p.vy< -12||p.down>0||s.attack?.kind==='finish')return null;
 let best=null;
 for(const f of s.geo.platforms){
  if(!usable(f)||f.h-p.y<1.10||f.h-p.y>1.96)continue;
  const lx=f.x-f.w/2,hx=f.x+f.w/2,lz=f.z-f.d/2,hz=f.z+f.d/2;
  const faces=[{x:lx,z:clamp(p.z,lz+.36,hz-.36),nx:1,nz:0},{x:hx,z:clamp(p.z,lz+.36,hz-.36),nx:-1,nz:0},{x:clamp(p.x,lx+.36,hx-.36),z:lz,nx:0,nz:1},{x:clamp(p.x,lx+.36,hx-.36),z:hz,nx:0,nz:-1}];
  for(const edge of faces){
   const d=Math.hypot(edge.x-p.x,edge.z-p.z),outside=(p.x-edge.x)*edge.nx+(p.z-edge.z)*edge.nz;
   if(d>.62||outside>.18||outside< -.65)continue;
   const vx=p.vx||0,vz=p.vz||0;if(vx*edge.nx+vz*edge.nz< -.8)continue;
   const top={x:edge.x+edge.nx*.52,y:f.h,z:edge.z+edge.nz*.52};
   if(!clearTop(s,f,top.x,top.z))continue;
   // A hand cannot reach through a second wall into the platform.
   const hand={x:p.x,y:f.h+.04,z:p.z};move(hand,edge.x-p.x,edge.z-p.z,s.geo.walls,.08);
   if(Math.hypot(hand.x-edge.x,hand.z-edge.z)>.16)continue;
   if(!best||d<best.distance)best={f,edge,top,distance:d,hang:{x:edge.x-edge.nx*.30,y:f.h-1.80,z:edge.z-edge.nz*.30},yaw:Math.atan2(edge.nx,edge.nz),phase:'hang',t:0};
  }
 }
 return best;
}
export function attachLedgeGrab(s){
 if(s.traversal)return s;const base={load:s.load.bind(s),restore:s.restore.bind(s),snapshot:s.snapshot.bind(s),action:s.action.bind(s),update:s.update.bind(s)};
 let hold=null,cooldown=0,lastSafe={x:s.p.x,y:s.p.y,z:s.p.z};
 const clear=()=>{hold=null;cooldown=0;lastSafe={x:s.p.x,y:s.p.y,z:s.p.z};};
 s.traversal={get ledge(){return hold;}};
 s.load=function(...args){const r=base.load(...args);clear();return r;};
 s.restore=function(...args){const r=base.restore(...args);clear();return r;};
 s.snapshot=function(){const q=base.snapshot();return hold?{...q,p:{...q.p,...lastSafe,vx:0,vz:0,vy:0,grounded:true,coyote:.12},jumps:2}:q;};
 s.action=function(kind){if(hold){if(kind==='jump'||kind==='interact'||kind==='contextC'){if(hold.phase==='hang'){hold.phase='pull';hold.t=0;}return true;}return false;}return base.action(kind);};
 s.update=function(dt,input={}){
  dt=clamp(Number(dt)||0,0,.035);cooldown=Math.max(0,cooldown-dt);
  if(hold){
   const h=hold,zone=s.zone;h.t+=dt;
   const away=(input.x||0)*h.edge.nx+(input.z||0)*h.edge.nz;
   if(h.f.gone||s.dead||s.won||s.finale||s.p.down>0||(h.phase==='hang'&&away< -.45)){
    hold=null;cooldown=.5;s.p.vy=-1.5;s.p.grounded=false;base.update(dt,input);return;
   }
   s.p.vx=s.p.vz=s.p.vy=0;s.p.grounded=false;s.attack=null;s.queued=false;
   base.update(dt,{x:0,z:0,facingYaw:h.yaw,run:false});
   if(s.zone!==zone||s.dead||s.p.down>0){hold=null;cooldown=.5;return;}
   if(h.phase==='hang'&&h.t>=.45){h.phase='pull';h.t=0;}
   const t=h.phase==='pull'?smooth(h.t/.64):0;
   // Lift first, then move the hips over the lip. Feet never tunnel through it.
   const lift=h.phase==='pull'?smooth(h.t/.44):0;
   Object.assign(s.p,{x:h.hang.x+(h.top.x-h.hang.x)*smooth((t-.40)/.60),z:h.hang.z+(h.top.z-h.hang.z)*smooth((t-.40)/.60),y:h.hang.y+(h.top.y-h.hang.y)*lift,yaw:h.yaw,vx:0,vz:0,vy:0,grounded:false,coyote:0});
   if(h.phase==='pull'&&h.t>=.64){
    if(clearTop(s,h.f,h.top.x,h.top.z)){Object.assign(s.p,h.top,{grounded:true,vy:0,coyote:.12});s.jumps=2;lastSafe={...h.top};s.emit('ledgeClimb',{...h.top});}
    else{s.p.vy=-1.5;s.p.grounded=false;}
    hold=null;cooldown=.45;
   }
   return;
  }
  const zone=s.zone;base.update(dt,input);
  if(s.p.grounded&&!s.dead){lastSafe={x:s.p.x,y:s.p.y,z:s.p.z};return;}
  if(zone!==s.zone||cooldown||s.dead||s.won||s.finale||s.vehicleActive||s.race?.mounted||s.dodge1460)return;
  hold=findLedge(s);if(hold){s.attack=null;s.queued=false;s.dash=0;Object.assign(s.p,hold.hang,{vx:0,vz:0,vy:0,grounded:false,yaw:hold.yaw,coyote:0});s.emit('ledgeCatch',{x:s.p.x,y:s.p.y,z:s.p.z});}
 };
 return s;
}
