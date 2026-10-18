import {towerRayHit} from './tower-entry-r1459.js?v=r1459';
function boxHit(a,b,box,r){let lo=0,hi=1;for(const k of ['x','y','z']){const d=b[k]-a[k],min=box.min[k]-r,max=box.max[k]+r;if(Math.abs(d)<1e-9){if(a[k]<min||a[k]>max)return null;}else{let u=(min-a[k])/d,v=(max-a[k])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}}return lo>=0&&lo<=1?lo:null;}
// A small camera sphere checks walls, raised decks, undersides and the curved
// Tower doorway. Run again after interpolation to avoid cutting through corners.
export function clipCamera(geo,target,position,r=.18){
 let first=1;const test=b=>{const t=boxHit(target,position,b,r);if(t!==null)first=Math.min(first,t);};
 for(const w of geo.walls||[]){if(w.towerRing){const t=towerRayHit(target,position,w,r);if(t!==null)first=Math.min(first,t);}else if(Number.isFinite(w.w)&&Number.isFinite(w.d))test({min:{x:w.x-w.w/2,y:w.base??0,z:w.z-w.d/2},max:{x:w.x+w.w/2,y:w.h??9,z:w.z+w.d/2}});}
 for(const f of geo.platforms||[]){if(f.gone)continue;test({min:{x:f.x-f.w/2,y:f.h-.7,z:f.z-f.d/2},max:{x:f.x+f.w/2,y:f.h,z:f.z+f.d/2}});}
 const length=Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z),t=first<1?Math.max(0,first-.035/Math.max(.01,length)):1;
 return{x:target.x+(position.x-target.x)*t,y:target.y+(position.y-target.y)*t,z:target.z+(position.z-target.z)*t};
}
