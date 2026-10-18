import * as T from './vendor/three-r170.module.min.js';
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);},up=new T.Vector3(0,1,0);
export function createBatTrail(hero){
 const geometry=new T.BufferGeometry(),positions=new Float32Array(9*2*3),indices=[];geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 for(let i=0;i<8;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}geometry.setIndex(indices);geometry.setDrawRange(0,0);
 const trail=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xe6d4b1,transparent:true,opacity:.17,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));trail.name='Lyra-bat-swing-trail';trail.frustumCulled=false;trail.visible=false;hero.add(trail);hero.userData.batTrail=trail;hero.userData.batSamples=[];
}
export function animateBat(hero,attack,time,running,weapon,handAt){
 const u=hero.userData,g=u.bat;if(!g)return;g.visible=weapon?.selected==='bat'&&!['attack','scream','finish'].includes(attack?.kind);u.batTrail.visible=false;
 if(!g.visible){u.batSamples.length=0;u.batAttack=null;return;}if(u.blade)u.blade.visible=false;if(u.bladeTrace)u.bladeTrace.visible=false;
 const active=attack?.kind==='slash',step=attack?.step||0,side=step===1?-1:1,q=active?T.MathUtils.clamp(attack.t/attack.duration,0,1):0,hit=active?(attack.hitAt??attack.duration*.48)/attack.duration:.48;
 const rest={grip:new T.Vector3(.13,1.21,.27),axis:new T.Vector3(-.13,.96,.25),yaw:0,lean:0,bend:0};
 let wind={grip:new T.Vector3(side*.24,1.47,-.10),axis:new T.Vector3(side*.88,.35,-.30),yaw:-side*.65,lean:-.035,bend:.12},strike={grip:new T.Vector3(-side*.13,1.24,.40),axis:new T.Vector3(-side*.24,.05,.97),yaw:side*.16,lean:.09,bend:.22},follow={grip:new T.Vector3(-side*.26,1.22,.08),axis:new T.Vector3(-side*.94,.12,-.30),yaw:side*.95,lean:.07,bend:.13};
 if(step===2){wind={grip:new T.Vector3(.02,1.76,-.04),axis:new T.Vector3(.05,.65,-.76),yaw:-.10,lean:-.12,bend:.12};strike={grip:new T.Vector3(0,1.23,.40),axis:new T.Vector3(0,-.18,.98),yaw:.10,lean:.18,bend:.33};follow={grip:new T.Vector3(.04,1.08,.26),axis:new T.Vector3(.10,-.65,.76),yaw:.22,lean:.25,bend:.38};}
 let a=rest,b=rest,t=0;
 if(active){const loaded=hit*.53,end=Math.min(.82,hit+.21);if(q<loaded){a=rest;b=wind;t=smooth(q/loaded);}else if(q<hit){a=wind;b=strike;t=smooth((q-loaded)/(hit-loaded));}else if(q<end){a=strike;b=follow;t=smooth((q-hit)/(end-hit));}else{a=follow;b=rest;t=smooth((q-end)/(1-end));}}
 const grip=a.grip.clone().lerp(b.grip,t),axis=a.axis.clone().normalize().lerp(b.axis.clone().normalize(),t).normalize(),lean=T.MathUtils.lerp(a.lean,b.lean,t),bend=T.MathUtils.lerp(a.bend,b.bend,t);
 if(!active)grip.y+=Math.sin(time*(running?14:2))*(running?.018:.007);
 // Project the two actual grip points into both arms' reach, preserving a broad
 // hand path instead of pinning the hands to the centre of the chest.
 for(let pass=0;pass<20;pass++)for(const [index,offset]of [[1,-.08],[0,.08]]){const hand=grip.clone().addScaledVector(axis,offset),delta=hand.clone().sub(u.limbs[index].arm.position),length=delta.length();if(length>.60)grip.addScaledVector(delta,-(length-.60)/length);else if(length<.095)grip.addScaledVector(length>1e-6?delta:new T.Vector3(0,0,1),(.095-length)/(length||1));}
 g.position.copy(grip).addScaledVector(axis,-.165);g.quaternion.setFromUnitVectors(up,axis);g.updateMatrix();
 if(active||!attack){u.body.rotation.y=active&&step===3?Math.PI*2*smooth((q-hit*.35)/(.92-hit*.35)):T.MathUtils.lerp(a.yaw,b.yaw,t);u.body.rotation.x=active?lean:running?.12:0;u.body.rotation.z=active?-side*.055*Math.sin(Math.PI*q):0;}if(active)u.body.position.y-=bend*.12;
 for(const [i,l]of u.limbs.entries()){if(active){l.leg.rotation.x-=(i?.32:.16)*bend;l.shin.rotation.x+=bend;l.leg.rotation.y+=(i?1:-1)*Math.sin(Math.PI*q)*.12;}l.hand.scale.setScalar(1);}
 handAt(u.limbs[1],new T.Vector3(0,.085,0).applyMatrix4(g.matrix),1);handAt(u.limbs[0],new T.Vector3(0,.245,0).applyMatrix4(g.matrix),-1);
 const trace=active&&q>hit*.55&&q<Math.min(.84,hit+.22);
 if(u.batAttack!==attack||!trace){u.batSamples.length=0;u.batAttack=attack;u.batSampleAt=-1;}
 if(trace){u.body.updateMatrix();const matrix=u.body.matrix.clone().multiply(g.matrix);if(u.batSampleAt!==attack.t){u.batSamples.push([new T.Vector3(0,.48,0).applyMatrix4(matrix),new T.Vector3(0,1.13,0).applyMatrix4(matrix)]);if(u.batSamples.length>9)u.batSamples.shift();u.batSampleAt=attack.t;}
  const attr=u.batTrail.geometry.attributes.position;for(let i=0;i<u.batSamples.length;i++)for(let j=0;j<2;j++){const p=u.batSamples[i][j];attr.setXYZ(i*2+j,p.x,p.y,p.z);}attr.needsUpdate=true;u.batTrail.geometry.setDrawRange(0,Math.max(0,u.batSamples.length-1)*6);u.batTrail.visible=u.batSamples.length>1;
 }
}
