const angle=(x,z)=>Math.atan2(x,z),delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function circleTimes(a,b,r){const dx=b.x-a.x,dz=b.z-a.z,A=dx*dx+dz*dz,B=2*(a.x*dx+a.z*dz),C=a.x*a.x+a.z*a.z-r*r,D=B*B-4*A*C;if(A<1e-12||D<0)return[];return[(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)].filter(t=>t>=0&&t<=1);}
function solid(w,p,padding=0){const r=Math.hypot(p.x-w.x,p.z-w.z);if(r<w.inner-padding||r>w.outer+padding||p.y<w.base-padding||p.y>w.h+padding)return false;return !(p.y< w.doorHeight-padding&&p.y>=-padding&&Math.abs(delta(angle(p.x-w.x,p.z-w.z),w.yaw))<w.doorHalf-padding/w.outer);}
// First intersection with the thick curved wall. Splitting at circles, heights
// and door jambs preserves the opening for both visibility and camera sweeps.
export function towerRayHit(a,b,w,padding=0){
 const localA={x:a.x-w.x,z:a.z-w.z},localB={x:b.x-w.x,z:b.z-w.z},times=[0,1,...circleTimes(localA,localB,w.inner-padding),...circleTimes(localA,localB,w.outer+padding)],dy=b.y-a.y;
 if(Math.abs(dy)>1e-9)for(const h of [w.base-padding,0,w.doorHeight-padding,w.h+padding]){const t=(h-a.y)/dy;if(t>0&&t<1)times.push(t);}
 const dx=b.x-a.x,dz=b.z-a.z;
 for(const side of [-1,1]){const yaw=w.yaw+side*(w.doorHalf-padding/w.outer),ux=Math.sin(yaw),uz=Math.cos(yaw),den=dx*uz-dz*ux;if(Math.abs(den)>1e-9){const t=-(localA.x*uz-localA.z*ux)/den;if(t>0&&t<1)times.push(t);}}
 times.sort((a,b)=>a-b);for(let i=0;i<times.length-1;i++){const start=times[i],end=times[i+1];if(end-start<1e-8)continue;const t=(start+end)/2,p={x:a.x+dx*t,y:a.y+dy*t,z:a.z+dz*t};if(solid(w,p,padding))return start;}return null;
}
export function resolveTowerWall(p,old,w,r=.4){
 const body=1.78;if(Math.min(old.y||0,p.y||0)>=w.h||Math.max(old.y||0,p.y||0)+body<w.base)return;
 const a={x:old.x,y:(old.y||0)+body*.5,z:old.z},b={x:p.x,y:(p.y||0)+body*.5,z:p.z},hit=towerRayHit(a,b,w,r);
 const radial=Math.hypot(p.x-w.x,p.z-w.z),door=Math.abs(delta(angle(p.x-w.x,p.z-w.z),w.yaw))<w.doorHalf-r/w.outer;
 if(door&&radial>w.inner-r&&radial<w.outer+r&&(old.y||0)+body<=w.doorHeight&&p.y+body>w.doorHeight){p.y=w.doorHeight-body-.02;p.vy=Math.min(0,p.vy||0);}
 if(hit===null)return;
 // The centre ray can pass the opening while the character's head meets its lintel.
 if(door&&p.y>=0&&p.y+body<w.doorHeight-.01)return;
 const oldR=Math.hypot(old.x-w.x,old.z-w.z),inner=w.inner-r-.025,outer=w.outer+r+.025,limit=oldR<(w.inner+w.outer)/2?inner:outer;
 const t=Math.max(0,hit-.002),x=old.x+(p.x-old.x)*t-w.x,z=old.z+(p.z-old.z)*t-w.z,n=Math.hypot(x,z)||1;p.x=w.x+x/n*limit;p.z=w.z+z/n*limit;
 const dot=(p.vx||0)*x/n+(p.vz||0)*z/n;if(dot*(oldR<(w.inner+w.outer)/2?1:-1)>0){p.vx=(p.vx||0)-dot*x/n;p.vz=(p.vz||0)-dot*z/n;}
}
export function addTowerEntry(state,main){const next=main[1],yaw=angle(next.x,next.z),w={towerRing:true,x:0,z:0,inner:2.60,outer:2.95,base:-13,h:29,doorHeight:3.2,doorHalf:.54,yaw};state.geo.walls.push(w);state.geo.tower=w;state.towerEntry={yaw,spawn:{x:0,z:0,y:0},door:{x:Math.sin(yaw)*2.8,z:Math.cos(yaw)*2.8,y:0}};return w;}
