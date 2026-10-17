const clamp=v=>Math.max(0,Math.min(1,v));
export function poseArenaBoss(root,e,state){
 const u=root.userData;if(!u?.limbs||e.hp<=0||!e.bossRevision)return;
 const a=state.bossAction,wind=!!a&&a.t<a.wind,progress=a?clamp(wind?a.t/a.wind:(a.t-a.wind)/(a.duration-a.wind)):0;
 const stride=Math.hypot(e.vx||0,e.vz||0)>.15?Math.sin(state.time*8)*.48:0;
 u.body.rotation.set(0,0,0);u.head.rotation.set(0,0,0);
 for(const [i,l]of u.limbs.entries()){
  const side=i?1:-1;l.leg.rotation.set(side*stride,0,0);l.shin.rotation.set(Math.max(0,-side*stride)*.65+.12,0,0);
  l.arm.rotation.set(-.55-side*stride*.35,0,side*.15);l.fore.rotation.set(-1.1,0,0);
 }
 if(state.bossOpen>0){u.body.rotation.x=.16;u.head.rotation.x=.12;for(const l of u.limbs){l.arm.rotation.x=.14;l.fore.rotation.x=-.3;l.leg.rotation.x=-.1;l.shin.rotation.x=.22;}return;}
 if(!a)return;
 const pulse=wind?progress:Math.sin(Math.PI*progress),side=a.kind==='left'?0:1,l=u.limbs[side];
 if(a.kind==='right'||a.kind==='left'){
  u.body.rotation.y=(side?1:-1)*(wind?-.4*progress:.65*pulse);u.body.rotation.x=wind?-.13*progress:.27*pulse;
  l.arm.rotation.x=wind?-.7-.65*progress:-1.55*pulse;l.fore.rotation.x=wind?-1.4:-(1-pulse)*1.2;
 }else if(a.kind==='kick'){
  u.body.rotation.y=(wind?-1.0*progress:Math.PI*1.4*pulse);u.body.rotation.x=-.18*pulse;
  l.leg.rotation.x=wind?-.7*progress:-1.7*pulse;l.shin.rotation.x=wind?1.6*progress:.15+1.3*(1-pulse);
 }else if(a.kind==='slam'){
  for(const arm of u.limbs){arm.arm.rotation.x=wind?-2.7*progress:-2.7+3.4*clamp(progress*2);arm.fore.rotation.x=wind?-.8:0;arm.leg.rotation.x=-.2*pulse;arm.shin.rotation.x=.45*pulse;}
  u.body.rotation.x=wind?-.18*progress:.58*pulse;
 }else if(a.kind==='charge'){
  u.body.rotation.x=wind?-.15*progress:.42;for(const arm of u.limbs){arm.arm.rotation.x=-1.05;arm.fore.rotation.x=-1.0;}
 }else if(a.kind==='volley'){
  for(const arm of u.limbs){arm.arm.rotation.x=-1.45*pulse;arm.fore.rotation.x=-.6*(1-pulse);}u.body.rotation.x=-.12*pulse;
 }
}
