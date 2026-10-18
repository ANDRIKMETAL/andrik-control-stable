const states=new WeakMap(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function poseLocomotion(root,s,dt){
 const u=root.userData,p=s.p;if(!u?.limbs)return;let v=states.get(root);if(!v||v.geo!==s.geo){v={phase:0,weight:0,direction:1,geo:s.geo};states.set(root,v);}dt=clamp(dt,0,.1);
 const speed=Math.hypot(p.vx||0,p.vz||0),target=clamp(speed/4.3,0,1),blend=1-Math.exp(-dt*12);v.weight+=(target-v.weight)*blend;v.phase+=speed*dt*2.3;
 const forward=((p.vx||0)*Math.sin(p.yaw)+(p.vz||0)*Math.cos(p.yaw))/Math.max(.01,speed),side=((p.vx||0)*Math.cos(p.yaw)-(p.vz||0)*Math.sin(p.yaw))/Math.max(.01,speed),stride=Math.sin(v.phase)*v.weight*(.52+.21*clamp((speed-4.3)/2.9,0,1)),a=s.attack;v.direction+=((forward<-.2?-.72:1)-v.direction)*blend;
 if(!a){u.body.rotation.set(0,0,-side*.035*v.weight);u.body.position.y=Math.abs(Math.sin(v.phase))*.025*v.weight;u.body.position.x=0;}
 for(const [i,l]of u.limbs.entries()){
  const sign=i?1:-1;l.leg.rotation.set(sign*stride*v.direction,-side*.12*v.weight,sign*stride*side*.34);l.shin.rotation.set(Math.max(0,-sign*stride)*.65+.035*v.weight,0,0);
  l.arm.rotation.set(-sign*stride*.55,0,sign*.10);l.fore.rotation.set(-.15,0,0);
 }
 if(!p.grounded){const rise=clamp((p.vy||0)/7,-1,1);u.limbs[0].leg.rotation.x=-.48-.16*Math.max(0,rise);u.limbs[1].leg.rotation.x=.22;for(const l of u.limbs)l.shin.rotation.x=.56+.16*Math.max(0,rise);}
 if(a?.kind==='kick'){const q=clamp(a.t/a.duration,0,1),w=Math.sin(q*Math.PI);u.limbs[1].leg.rotation.x=-1.70*w;u.limbs[1].shin.rotation.x=1.6*Math.max(0,1-q/.55)*w;u.limbs[0].shin.rotation.x=.20*w;}
}
export function poseCombatFlinch(root,s){
 if(s.p.down>0||!s.combatFeel?.hurt)return;const q=1-s.combatFeel.hurt/.20,w=Math.sin(q*Math.PI);root.userData.body.rotation.x-=.13*w;root.userData.head.rotation.x-=.07*w;
}
