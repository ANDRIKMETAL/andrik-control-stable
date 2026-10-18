import {poseArenaBoss} from './boss-poses-r1448.js?v=r1448';
import {poseOceanBoss} from './ocean-poses-r1455.js?v=r1462';
/* Animation operates in each actor's existing local scale. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function poseEnemyCombat(root,e,state){
 const u=root.userData;if(!u?.limbs||u.isDog)return;
 const metres=Math.max(.001,root.scale.x),unit=root.scale.x<.1?1/metres:1;
 if(e.hp>0&&e.down>0){
  const fall=clamp((e.downAge||0)/.22,0,1)*clamp(e.down/.40,0,1),side=e.id%2?1:-1;
  u.body.rotation.set(0,0,side*1.46*fall);u.body.position.y=.40*unit*fall;u.head.rotation.x=.15*fall;
  for(const [i,l]of u.limbs.entries()){l.leg.rotation.x=(i?-.24:.38)*fall;l.shin.rotation.x=.5*fall;l.arm.rotation.x=-.5*fall;l.fore.rotation.x=-.8*fall;}return;
 }
 if(e.kind==='boss'){if(state){if(e.oceanRevision)poseOceanBoss(root,e,state);else poseArenaBoss(root,e,state);}return;}if(e.hp<=0)return;
 const wind=e.mode==='windup',strike=e.mode==='strike';if(!wind&&!strike)return;
 const progress=clamp(e.t/(wind?.7:.34),0,1),pulse=wind?progress:Math.sin(Math.PI*progress);
 if(e.attackKind==='kick'){
  const l=u.limbs[e.id%2?0:1];l.leg.rotation.x=wind?-.55*progress:-1.55*Math.sin(Math.PI*progress);
  l.shin.rotation.x=wind?1.45*progress:.25+1.15*(1-progress);u.body.rotation.x=-.16*pulse;
  for(const [i,a]of u.limbs.entries()){a.arm.rotation.set(-.5,0,(i?1:-1)*.36);a.fore.rotation.x=-1.15;}
 }else{
  const index=e.attackKind==='left'?0:1,other=u.limbs[1-index],l=u.limbs[index];
  other.arm.rotation.set(-.65,0,index?-.18:.18);other.fore.rotation.x=-1.35;
  l.arm.rotation.set(wind?-.45-progress*.7:-1.3*Math.sin(Math.PI*progress),0,index?-.12:.12);
  l.fore.rotation.x=wind?-1.25:-(1-progress)*1.1;
  u.body.rotation.y=(index?1:-1)*.24*(wind?-progress:Math.sin(Math.PI*progress));
 }
}
