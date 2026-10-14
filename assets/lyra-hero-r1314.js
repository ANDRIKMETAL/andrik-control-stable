import * as T from './vendor/three-r170.module.min.js';
import {createLyra,poseGuitar as propsPose} from './lyra-model-r1314.js';
import {animateLyra,motions} from './lyra-motion-r1314.js';
export {createLyra};
// One animation source for all seven worlds; gameplay owns position and damage.
export function poseGuitar(root,attack,combo,time,running,p={grounded:true},status={}){
 const u=root.userData,speed=Math.hypot(p.vx||0,p.vz||0);
 let mode=speed>.2?(running?'run':'walk'):'idle',clock=time;
 if(attack){
  mode=attack.kind==='punch'?(attack.upper?'uppercut':'cross'):attack.kind==='kick'?'kick':'guard';
  const q=T.MathUtils.clamp(attack.t/attack.duration,0,.9999);
  const contact=mode==='kick'?.48:mode==='uppercut'?.40:.40;
  const hit=T.MathUtils.clamp((attack.hitAt??attack.duration*.5)/attack.duration,.1,.9);
  const phase=q<=hit?q/hit*contact:contact+(q-hit)/(1-hit)*(1-contact);
  clock=phase*motions[mode].duration;
 }
 // Blend mode boundaries without changing the timing of damage/contact.
 const nodes=[u.body,u.head,...u.limbs.flatMap(l=>[l.arm,l.fore,l.hand,l.leg,l.shin,l.foot])];
 const cache=u.motionCache??={mode:null,start:time,from:null};
 if(cache.mode!==mode){cache.from=nodes.map(n=>({p:n.position.clone(),q:n.quaternion.clone()}));cache.start=time;cache.mode=mode;}
 animateLyra(root,mode,clock);
 if(!p.grounded&&!attack){
  // Actual vertical displacement already comes from physics: pose only, no second jump.
  u.body.position.y=0;u.body.rotation.x=.07;
  u.limbs.forEach((l,i)=>{l.leg.rotation.x=i?.30:-.55;l.shin.rotation.x=i?.75:.95;l.arm.rotation.x=-.8;l.fore.rotation.x=-.8;l.foot.rotation.x=-.15;});
 }
 if(attack&&['attack','scream'].includes(attack.kind))propsPose(root,attack,combo,time,running);
 const blend=T.MathUtils.smoothstep(time-cache.start,0,.10);
 if(cache.from&&blend<1)nodes.forEach((n,i)=>{n.position.lerpVectors(cache.from[i].p,n.position,blend);n.quaternion.slerpQuaternions(cache.from[i].q,n.quaternion,blend);});
 if(status.dead)u.body.rotation.z=Math.min(1.5,(1.6-status.dead)*2);
 u.syncDeform();
}
