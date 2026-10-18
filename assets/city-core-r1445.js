import {constrainBikeChase} from './bike-chase-r1464.js?v=r1465';
/* R1445 — keep the streets inside their visible play area, including old saves. */
import {CityState as PreviousCityState,roadCenter} from './city-core-r1308.js?v=r1465';
export {CITY_SAVE,CITY_ZONES,roadCenter,RACE_HAZARDS,cityGeometry} from './city-core-r1308.js?v=r1465';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function cityPlayBounds(zone,length,z=3,mounted=false){
 const minZ=.65,maxZ=length-1.65,safeZ=clamp(Number.isFinite(z)?z:3,minZ,maxZ);
 const center=zone===3?roadCenter(safeZ):0;
 // Exterior facades begin at |x|=13.5; the bar has its own wider interior.
 const half=zone===3?(mounted?5.7:5.5):zone===2?15.55:12.95;
 return{minX:center-half,maxX:center+half,minZ,maxZ};
}
export class CityState extends PreviousCityState{
 constrainPlayer(){
  const p=this.p;if(!p||!this.geo)return;if(constrainBikeChase(this))return;
  const b=cityPlayBounds(this.zone,this.geo.length,p.z,!!this.race?.mounted);
  const x=clamp(Number.isFinite(p.x)?p.x:0,b.minX,b.maxX),z=clamp(Number.isFinite(p.z)?p.z:3,b.minZ,b.maxZ);
  if(x!==p.x)p.vx=0;if(z!==p.z)p.vz=0;p.x=x;p.z=z;
  // City zones have continuous floors: an underground position is invalid here.
  if(!Number.isFinite(p.y)||p.y<-.05||p.y>12){p.y=0;p.vy=0;p.grounded=true;p.coyote=.12;this.jumps=2;}
  for(const key of ['vx','vz','vy'])if(!Number.isFinite(p[key]))p[key]=0;
 }
 load(zone){super.load(zone);this.constrainPlayer();}
 restore(saved){
  let safe=saved;
  if(saved?.p&&Number.isFinite(saved.p.y)&&(saved.p.y<0||saved.p.y>12)){
   // Keep completed quests, enemies, inventory and checkpoint when repairing a bad position.
   safe={...saved,p:{...saved.p,y:0,vy:0,grounded:true,coyote:.12}};
  }
  super.restore(safe);this.constrainPlayer();
 }
 update(dt,input={}){
  this.constrainPlayer();super.update(dt,input);this.constrainPlayer();
 }
}
