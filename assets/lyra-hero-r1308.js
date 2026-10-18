import {posePowerCombat} from './power-poses-r1466.js?v=r1467';
import {poseBat} from './weapon-view-r1458.js?v=r1467';
import * as T from './vendor/three-r170.module.min.js';
import {poseBlade} from './lyra-blade-r1455.js?v=r1467';
import {createCharacter,poseCharacterSurface,trackCharacter} from './lyra-character-r1465.js?v=r1467';
export const createLyra=createCharacter;
export const trackLyra=trackCharacter;
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const down=new T.Vector3(0,-1,0);
function handAt(limb,target,side){
 const start=limb.arm.position,L1=.32,L2=.30,d=target.clone().sub(start),len=T.MathUtils.clamp(d.length(),.035,L1+L2-.001);d.normalize();
 const along=(L1*L1-L2*L2+len*len)/(2*len),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const pole=new T.Vector3(side,-.5,-.25);pole.addScaledVector(d,-pole.dot(d)).normalize();
 const elbow=start.clone().addScaledVector(d,along).addScaledVector(pole,height),end=start.clone().addScaledVector(d,len);
 limb.arm.quaternion.setFromUnitVectors(down,elbow.clone().sub(start).normalize());
 const inverse=limb.arm.quaternion.clone().invert();limb.fore.quaternion.setFromUnitVectors(down,end.sub(elbow).applyQuaternion(inverse).normalize());
}
export function poseGuitar(root,attack,combo,time,running,weapon=null){
 const u=root.userData,g=u.guitar,active=attack?.kind==='attack',punch=attack?.kind==='punch';
 for(const l of u.limbs){l.hand.scale.setScalar(1);l.foot.scale.setScalar(1);const closed=active||attack?.kind==='slash'||weapon?.selected==='bat'&&!['attack','scream','finish'].includes(attack?.kind)||punch||attack?.kind==='backfist'||attack?.kind==='finish';for(const f of l.hand.userData.fingers){f.position.y=closed?-.021:-.032;f.position.z=closed?.028:.01;f.scale.y=closed?.011:.023;}}
 // Grip pose returns smoothly after both attacks. Body and legs remain free to move.
 const rest=new T.Vector3(.10,1.46,-.175),p=active?T.MathUtils.clamp(attack.t/attack.duration,0,1):0;
 g.position.copy(rest);g.rotation.set(.10,0,-.38);
 u.microphone.visible=attack?.kind==='scream';u.vocalMouth.visible=u.microphone.visible&&attack.t>.27&&attack.t<1.2;
 if(u.microphone.visible){
  const t=attack.t/attack.duration,w=smooth(t/.22)*(1-smooth((t-.80)/.20));
  const grip=new T.Vector3(-.24,.90,.05).lerp(new T.Vector3(-.034,1.60,.23),w);
  u.microphone.position.copy(grip);u.microphone.rotation.set(.20,0,-.15);
  handAt(u.limbs[0],grip,-1);u.head.rotation.x=-.06*w;
 }
 // Relaxed boxing guard; walking still comes from the scene animation.
 if(punch){
  const guard=[new T.Vector3(-.105,1.66,.225),new T.Vector3(.11,1.64,.24)];
  for(let i=0;i<2;i++)handAt(u.limbs[i],guard[i],i?1:-1);
  if(!running){u.body.position.y-=.028;for(const [i,l] of u.limbs.entries()){l.leg.rotation.x-=.15;l.shin.rotation.x+=.29;l.leg.rotation.z=i?-.04:.04;}}
  if(punch){
   const q=T.MathUtils.clamp(attack.t/attack.duration,0,1),upper=attack.upper,side=upper?-1:1,index=upper?0:1;
   const wind=smooth(q/.22),drive=smooth((q-.22)/.32),recover=smooth((q-.57)/.43);
   const start=guard[index],loaded=upper?new T.Vector3(-.19,1.22,.21):new T.Vector3(.14,1.60,.20);
   const end=upper?new T.Vector3(-.04,1.81,.45):new T.Vector3(.055,1.59,.58);
   const goal=start.clone().lerp(loaded,wind).lerp(end,drive).lerp(start,recover);
   const impact=Math.exp(-Math.pow((q-(upper?.50:.50))/.15,2));u.limbs[index].hand.scale.setScalar(1+1.05*impact);
   handAt(u.limbs[index],goal,side);u.body.rotation.y=side*.22*Math.sin(q*Math.PI);u.body.rotation.x=upper?-.045*Math.sin(q*Math.PI):.06*Math.sin(q*Math.PI);
  }
 }
 if(attack?.kind==='backfist'){
  const q=T.MathUtils.clamp(attack.t/attack.duration,0,1),turn=smooth(q/.55),reach=smooth((q-.22)/.26)*(1-smooth((q-.59)/.34));
  u.body.rotation.y=Math.PI*2*turn;u.body.rotation.x=.08*reach;u.body.position.y-=.035*Math.sin(Math.PI*q);
  handAt(u.limbs[0],new T.Vector3(-.12,1.64,.24),-1);
  handAt(u.limbs[1],new T.Vector3(.13-.05*reach,1.61,.23+.36*reach),1);
  u.limbs[1].hand.scale.setScalar(1+1.1*Math.exp(-Math.pow((q-.49)/.14,2)));
  for(const [i,l]of u.limbs.entries()){l.leg.rotation.x+=(i?.10:-.16)*reach;l.shin.rotation.x+=.22*reach;}
 }
 if(attack?.kind==='kick'){
  const t=attack.t/attack.duration,pulse=Math.exp(-Math.pow((t-.63)/.15,2));u.limbs[1].foot.scale.setScalar(1+.78*pulse);u.body.rotation.y=Math.PI*2*smooth(t/.64);
 }
 if(active){
  const enter=smooth(p/.18),recover=smooth((p-.83)/.17),weight=enter*(1-recover),turn=smooth((p-.16)/.70);
  g.position.lerp(new T.Vector3(.10,1.25,.36),weight);
  g.rotation.set(.12*weight,0,-.48+(1.48+.48)*weight);
  u.body.rotation.y=Math.PI*4*turn;
  u.body.rotation.x=-.035*weight;u.body.position.y-=.045*weight;
  for(const [i,l]of u.limbs.entries()){
   l.leg.rotation.x+=Math.sin(turn*Math.PI*4+(i?Math.PI:0))*.20*weight;
   l.shin.rotation.x+=.18*weight;
  }
  g.updateMatrix();const right=new T.Vector3(0,.015,.005).applyMatrix4(g.matrix),left=new T.Vector3(0,-.105,.005).applyMatrix4(g.matrix);
  handAt(u.limbs[1],right,1);handAt(u.limbs[0],left,-1);
 }else{
  if(running){g.position.y+=Math.sin(time*15)*.025;if(!attack)u.body.rotation.x=.12;}
  g.updateMatrix(); // both arms remain free while guitar stays attached to the back
 }
 if(weapon?.selected==='bat'){u.blade.visible=false;u.bladeTrace.visible=false;}else poseBlade(root,attack,time,running,handAt);poseBat(root,attack,time,running,weapon,handAt);poseCharacterSurface(root,attack,time,running);posePowerCombat(root,attack,time,weapon,handAt);
}
