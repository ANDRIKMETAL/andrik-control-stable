import * as T from './vendor/three-r170.module.min.js';
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const axis=new T.Vector3(0,1,0);
export function addBlade(u){
 const steel=new T.MeshStandardMaterial({color:0xc0d6df,metalness:.86,roughness:.23}),dark=new T.MeshStandardMaterial({color:0x15202b,metalness:.22,roughness:.56}),gold=new T.MeshStandardMaterial({color:0xb99761,metalness:.73,roughness:.3});
 const blade=new T.Group();blade.name='Lyra-steel-sword';u.body.add(blade);
 const piece=(geometry,material,x,y,z)=>{const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);blade.add(mesh);return mesh;};
 const edge=piece(new T.CylinderGeometry(.002,.055,.86,4),steel,0,.57,0);edge.scale.z=.26;
 piece(new T.CylinderGeometry(.017,.02,.21,10),dark,0,0,0);
 piece(new T.CylinderGeometry(.035,.025,.035,8),gold,0,-.125,0);
 piece(new T.BoxGeometry(.23,.033,.045),gold,0,.12,0);
 piece(new T.BoxGeometry(.006,.75,.003),new T.MeshStandardMaterial({color:0x87dcd9,metalness:.6,roughness:.3,emissive:0x246a72,emissiveIntensity:.25}),0,.54,.012);
 const sheath=new T.Mesh(new T.BoxGeometry(.072,.87,.032),dark);sheath.name='Lyra-sword-sheath';sheath.position.set(-.19,.61,-.12);sheath.rotation.z=-.15;u.body.add(sheath);
 const traceMaterial=new T.MeshBasicMaterial({color:0xb3edf4,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
 const trace=new T.Mesh(new T.RingGeometry(.91,1.035,32,1,-1.3,2.6),traceMaterial);trace.name='Lyra-sword-trail';trace.visible=false;u.body.add(trace);
 u.blade=blade;u.bladeTrace=trace;
}
export function poseBlade(root,attack,time,running,handAt){
 const u=root.userData,blade=u.blade,trace=u.bladeTrace;if(!blade)return;
 blade.visible=!['attack','scream','finish'].includes(attack?.kind);trace.visible=false;
 if(!blade.visible)return;
 const legacy=attack?.kind==='punch'||attack?.kind==='backfist',slashing=attack?.kind==='slash'||legacy;
 const step=legacy?(attack.kind==='backfist'?3:attack.upper?1:0):attack?.step||0;
 const rest=new T.Vector3(.27,1.08,.15),restDirection=new T.Vector3(.16,-.95,.20),grip=rest.clone(),direction=restDirection.clone();
 u.limbs[1].hand.scale.setScalar(1);
 for(const finger of u.limbs[1].hand.userData.fingers){finger.position.y=-.021;finger.position.z=.028;finger.scale.y=.011;}
 if(slashing){
  const q=T.MathUtils.clamp(attack.t/attack.duration,0,1),load=smooth(q/.22),cut=smooth((q-.18)/.34),recover=smooth((q-.59)/.41),weight=load*(1-recover);
  const wind=step===2?new T.Vector3(.10,1.92,.08):step===1?new T.Vector3(-.08,1.49,.32):new T.Vector3(.30,1.52,.09);
  const end=step===2?new T.Vector3(.12,1.10,.40):step===1?new T.Vector3(.42,1.30,.25):new T.Vector3(-.04,1.28,.45);
  const windDirection=step===2?new T.Vector3(.04,1,.05):step===1?new T.Vector3(-.95,.10,.25):new T.Vector3(.95,.15,-.12);
  const endDirection=step===2?new T.Vector3(.05,-.55,.85):step===1?new T.Vector3(.86,-.12,.47):new T.Vector3(-.87,-.13,.46);
  grip.lerp(wind,load).lerp(end,cut).lerp(rest,recover);direction.lerp(windDirection,load).lerp(endDirection,cut).lerp(restDirection,recover);
  if(step===3){
   grip.lerp(new T.Vector3(.45,1.32,.25),weight);direction.lerp(new T.Vector3(.90,.10,.35),weight);
   u.body.rotation.y=Math.PI*2*smooth(q/.80);u.body.rotation.x=.06*weight;
  }else{u.body.rotation.y=(step===1?-1:1)*(.35*load-.85*cut)*(1-recover);u.body.rotation.x=step===2?.14*weight:.045*weight;}
  if(!running){u.body.position.y-=.035*weight;for(const limb of u.limbs){limb.leg.rotation.x-=.13*weight;limb.shin.rotation.x+=.24*weight;}}
  handAt(u.limbs[0],new T.Vector3(-.20,1.48,.20),-1);
  trace.visible=q>.20&&q<.78;trace.material.opacity=.32*Math.sin(Math.PI*T.MathUtils.clamp((q-.20)/.58,0,1));
  trace.position.set(0,step===2?1.45:1.28,.24);trace.rotation.set(step===2?0:Math.PI/2,step===2?.3:0,step===1?Math.PI:0);trace.scale.set(step===3?1.5:1,step===3?1.5:1,1);
 }else if(attack?.kind==='kick'){grip.set(.30,1.38,.13);direction.set(.65,.20,-.45);}
 else if(running){grip.y+=Math.sin(time*13)*.018;}
 blade.position.copy(grip);blade.quaternion.setFromUnitVectors(axis,direction.normalize());handAt(u.limbs[1],grip,1);
}
