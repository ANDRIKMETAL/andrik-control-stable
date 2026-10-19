import * as T from './vendor/three-r170.module.min.js';
const clamp=T.MathUtils.clamp,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},down=new T.Vector3(0,-1,0);
function handAt(l,target,side){
 const start=l.arm.position,d=target.clone().sub(start),len=clamp(d.length(),.04,.619);d.normalize();
 const along=(.32*.32-.30*.30+len*len)/(2*len),height=Math.sqrt(Math.max(0,.32*.32-along*along)),pole=new T.Vector3(side,-.35,-.2);pole.addScaledVector(d,-pole.dot(d)).normalize();
 const elbow=start.clone().addScaledVector(d,along).addScaledVector(pole,height),end=start.clone().addScaledVector(d,len);
 l.arm.quaternion.setFromUnitVectors(down,elbow.clone().sub(start).normalize());l.fore.quaternion.setFromUnitVectors(down,end.sub(elbow).applyQuaternion(l.arm.quaternion.clone().invert()).normalize());
 for(const f of l.hand.userData.fingers||[]){f.rotation.x=-.8;f.position.y=-.02;f.position.z=.025;}
}
export function poseTraversalAndThrow(hero,s){
 const u=hero.userData,h=s.traversal?.ledge,a=s.throwables?.pose,held=s.throwables?.held;if(!u?.limbs)return;
 if(!h&&!a&&(!held||s.attack))return;
 for(const key of ['bat','batTrail','blade','bladeTrace','microphone'])if(u[key])u[key].visible=false;
 if(h){
  const pull=h.phase==='pull'?smooth(h.t/.64):0;u.body.rotation.set(.07+Math.sin(pull*Math.PI)*.25,0,0);u.body.position.set(0,-.015,0);u.head.rotation.x=-.25;
  const height=clamp(h.f.h-s.p.y+.04,1.06,1.88),reach=.33-Math.sin(pull*Math.PI)*.12;
  for(const [i,l]of u.limbs.entries()){handAt(l,new T.Vector3(i?.20:-.20,height,reach),i?1:-1);l.leg.rotation.set(-.22-Math.sin(pull*Math.PI)*(i?.9:.4),0,i?.04:-.04);l.shin.rotation.set(.48+Math.sin(pull*Math.PI)*.8,0,0);}
 }else if(a){
  const q=clamp(a.t/a.duration,0,1),wind=smooth(q/.30),release=smooth((q-.30)/.22),recover=smooth((q-.67)/.33),w=wind*(1-recover);
  const target=new T.Vector3(.24*(1-release)-.12*release,1.65-.31*release,.05+.53*release);
  handAt(u.limbs[1],new T.Vector3(.22,1.18,.22).lerp(target,w),1);u.body.rotation.y=-.38*w+.66*release*(1-recover);u.body.rotation.x=.12*release*(1-recover);u.limbs[0].arm.rotation.set(-.35*w,0,-.3*w);u.limbs[0].fore.rotation.x=-.75*w;
 }else handAt(u.limbs[1],new T.Vector3(.24,1.18,.25),1);
}
export function createActionView(scene,geometries,materials){
 const root=new T.Group();root.name='Loose-objects-and-thrown-weapons';root.userData.dynamic=true;scene.add(root);
 const box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,10),ring=new T.TorusGeometry(1,.025,4,18);[box,cylinder,ring].forEach(g=>geometries.add(g));
 const mat=(color,glow=0)=>{const m=new T.MeshStandardMaterial({color,roughness:.48,metalness:.3,emissive:color,emissiveIntensity:glow});materials.add(m);return m;};
 const steel=mat('#c3deed',.15),handle=mat('#303443'),glass=mat('#589c79',.25),label=mat('#d4c5a3'),brick=mat('#936e64'),halo=mat('#7de4dc',.45),pool=new Map();
 function part(g,geo,m,x,y,z,w,h,d){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;g.add(o);return o;}
 function make(type){const g=new T.Group();g.name='Throwable-'+type;
  if(type==='knife'){part(g,box,steel,0,.11,0,.065,.34,.017);part(g,box,handle,0,-.15,0,.05,.16,.04);part(g,box,steel,0,-.065,0,.11,.025,.045);}
  else if(type==='bottle'){part(g,cylinder,glass,0,0,0,.065,.25,.065);part(g,cylinder,glass,0,.19,0,.028,.14,.028);part(g,cylinder,steel,0,.265,0,.033,.025,.033);part(g,cylinder,label,0,-.015,0,.066,.10,.066);}
  else part(g,box,brick,0,0,0,.28,.15,.19);
  return g;
 }
 function object(key,type,used){let o=pool.get(key);if(o&&o.userData.type!==type){root.remove(o);pool.delete(key);o=null;}if(!o){o=make(type);o.userData.type=type;pool.set(key,o);root.add(o);}used.add(key);o.visible=true;o.scale.setScalar(1);return o;}
 function handPosition(actor){actor.updateMatrixWorld(true);const u=actor.userData,l=u.limbs?.[1];return(l?.hand||l?.fore||actor).getWorldPosition(new T.Vector3());}
 return {update(s,hero,foes){
  const used=new Set(),api=s.throwables;root.visible=!s.vehicleActive&&!s.race?.mounted;
  if(!root.visible||!api){for(const o of pool.values())o.visible=false;return;}
  for(const q of api.ground){const o=object(q.id,q.type,used);o.position.set(q.x,q.y+.12,q.z);o.rotation.set(Math.PI/2,0,q.type==='knife'?.3:1.2);if(!o.userData.marker){const marker=part(o,ring,halo,0,0,-.085,.28,.28,.28);marker.castShadow=false;marker.name='Pickup-ring';o.userData.marker=marker;}o.userData.marker.visible=true;}
  for(const q of api.flights){const o=object(q.id,q.type,used);o.position.set(q.x,q.y,q.z);o.rotation.set(q.age*(q.type==='knife'?14:9),Math.atan2(q.vx,q.vz),.2);if(o.userData.marker)o.userData.marker.visible=false;}
  if(api.held&&(!s.attack||api.pose)&&!s.traversal?.ledge){const o=object('player-hand',api.held,used);o.position.copy(handPosition(hero));o.quaternion.copy(hero.quaternion);o.rotateX(-.35);o.scale.setScalar(.9);}
  for(const e of s.living){const a=e.throwVisual1471,actor=foes?.get(e.id),u=actor?.userData;if(!a||!u?.limbs||!['windup','strike'].includes(e.tactic?.phase))continue;
   const right=u.limbs[1],wind=e.tactic.phase==='windup',q=wind?clamp(a.t/(a.wind||.7),0,1):clamp(a.t/.36,0,1);right.arm.rotation.x=wind?-1.2-q*1.25:-2.45+q*2.3;right.fore.rotation.x=wind?-.9:-.9*(1-q);u.body.rotation.y=wind?-.20:.2*q;
   if(wind||a.t<.10){const o=object('enemy-hand-'+e.id,a.type,used);o.position.copy(handPosition(actor));o.rotation.set(-.45,e.yaw,0);}
  }
  for(const [key,o]of pool)if(!used.has(key)){root.remove(o);pool.delete(key);}
 },dispose(){root.clear();pool.clear();root.removeFromParent();}};
}
