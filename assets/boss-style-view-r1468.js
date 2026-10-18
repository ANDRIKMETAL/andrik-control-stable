import * as T from './vendor/three-r170.module.min.js';
const clamp=n=>Math.max(0,Math.min(1,n));
export function poseBossStyle(root,e,state){
 const u=root.userData,b=e.boss1468,a=b?.action;if(!b||e.hp<=0||!u.body)return;
 const wind=a&&a.t<a.wind,q=a?clamp(wind?a.t/a.wind:(a.t-a.wind)/a.active):0,pulse=wind?q:Math.sin(q*Math.PI),time=state.time;
 if(u.worldShape==='octopus'){
  u.body.rotation.y=a?.kind==='spin'&&!wind?q*Math.PI*1.7:0;
  u.body.rotation.x=a?.kind==='leap'?(wind?-.16*q:.18*Math.sin(q*Math.PI)):0;
  for(const [i,arm]of u.tentacles.entries())for(const [j,g]of arm.joints.entries()){
   const selected=a?.kind==='tentacle'?i===1:a?.kind==='tentaclePair'?(i===1||i===6):a?.kind==='slam'?i<4:a?.kind==='ink'?i>=2&&i<=5:false;
   const hit=a?.kind==='tentaclePair'&&!wind?Math.sin(clamp((q-(i===6?.45:0))*2)*Math.PI):pulse;
   g.rotation.x=Math.sin(time*1.7-i*.7-j*.5)*.17+(j>3?-.10:0)+(selected?(wind?-.52*q:j<4?.8*hit:0):0);
   g.rotation.y=Math.sin(time+i+j*.3)*.13+(selected&&!wind?(i===6?-1:1)*.20*hit:0);
   g.rotation.z=Math.sin(time*1.2+i-j*.3)*.08;
  }
  return;
 }
 if(u.worldShape==='architect'){
  const casting=!!a&&a.kind!=='evade';u.body.rotation.y=time*(casting?1.1:.45);u.body.scale.setScalar(a?.kind==='blink'&&wind ? .86+.14*Math.abs(Math.cos(q*Math.PI*2)) : 1);
  for(const [i,o]of u.orbit.entries()){o.rotation.z=time*(casting?1.35:.7)+i*Math.PI/3;o.rotation.y=time*.4+(casting?pulse*.8:0);}return;
 }
 if(!u.limbs?.length)return;
 const stride=Math.hypot(e.vx||0,e.vz||0)>.12?Math.sin(time*8)*.45:0;
 u.body.rotation.set(e.hit>0?.10:0,0,0);u.head?.rotation.set(0,0,0);
 if(u.worldShape)u.body.position.y=e.airLift||0;else root.position.y=(e.y||0)+(e.airLift||0);
 for(const [i,l]of u.limbs.entries()){const side=i?1:-1;l.leg.rotation.set(side*stride,0,0);l.shin.rotation.set(.12+Math.max(0,-side*stride)*.7,0,0);l.arm.rotation.set(-.5-side*stride*.35,0,side*.16);l.fore.rotation.set(-1.1,0,0);}
 if(e.mode==='open'){u.body.rotation.x=.16;u.head.rotation.x=.12;for(const l of u.limbs){l.arm.rotation.x=.1;l.fore.rotation.x=-.4;}return;}
 if(!a)return;
 const limbs=u.limbs,right=limbs[1],left=limbs[0];
 if(a.kind==='evade'){u.body.rotation.z=b.side*.24;u.body.rotation.x=.18;for(const l of limbs){l.leg.rotation.x=-.35;l.shin.rotation.x=.7;}return;}
 if(['charge','jetDash','lunge'].includes(a.kind)){u.body.rotation.x=wind?-.12*q:.45;for(const [i,l]of limbs.entries()){l.arm.rotation.x=-1.0;l.fore.rotation.x=-1.25;l.leg.rotation.x=wind?-.15:Math.sin(time*18+i*Math.PI)*.8;}return;}
 if(['leap','slam','stomp'].includes(a.kind)){
  const jump=a.kind==='leap';u.body.rotation.x=wind?-.15*q:jump?-.18:.62*pulse;
  for(const [i,l]of limbs.entries()){l.arm.rotation.x=wind?-2.6*q:jump?-1.2:-2.6+3.25*clamp(q*2);l.fore.rotation.x=-.65*(1-q);l.leg.rotation.x=jump&&!wind?-.85:wind?-.24*q:0;l.shin.rotation.x=jump&&!wind?1.35:.35*pulse;}
  if(a.kind==='stomp'){right.leg.rotation.x=wind?-1.15*q:.1;right.shin.rotation.x=wind?1.5*q:.18;}return;
 }
 if(['spin','pendulum','kick'].includes(a.kind)){
  u.body.rotation.y=wind?-.9*q:q*Math.PI*1.9;u.body.rotation.x=-.15*pulse;
  if(a.kind==='kick'){right.leg.rotation.x=wind?-.65*q:-1.65*pulse;right.shin.rotation.x=wind?1.4*q:.12+.5*(1-pulse);}
  else for(const [i,l]of limbs.entries()){l.arm.rotation.x=-1.3;l.arm.rotation.z=(i?1:-1)*(.5+.35*pulse);l.fore.rotation.x=-.25;}return;
 }
 if(['burst','laserSweep','shards','gearFan'].includes(a.kind)){
  const recoil=!wind?Math.max(0,Math.sin((a.t-a.wind)*40))*.09:0;right.arm.rotation.x=-1.45+recoil;right.fore.rotation.x=-.10;left.arm.rotation.x=a.kind==='burst'?-.9:-1.4;left.fore.rotation.x=-.3;u.body.rotation.x=.08+recoil;u.body.rotation.y=a.kind==='laserSweep'&&!wind?-.28+.56*q:0;return;
 }
 const side=a.kind==='combo'&&!wind?Math.min(2,Math.floor(q*3))%2:0,l=side?left:right;
 u.body.rotation.y=(side?-1:1)*(wind?-.45*q:.7*pulse);u.body.rotation.x=wind?-.12*q:.24*pulse;
 l.arm.rotation.x=wind?-.65-.65*q:-1.65*Math.sin(clamp(a.kind==='combo'?(q*3)%1:q)*Math.PI);l.fore.rotation.x=wind?-1.35:-.20;
 if(a.kind==='feint'&&wind){left.arm.rotation.x=-1.2*q;left.fore.rotation.x=-1.2;}
}
export function createBossTelegraphs(scene,geometries,materials){
 const ring=new T.RingGeometry(.94,1,48),box=new T.BoxGeometry(1,1,1);geometries.add(ring);geometries.add(box);
 const amber=new T.MeshBasicMaterial({color:'#f2bd6f',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}),red=amber.clone();red.color.set('#ff758b');materials.add(amber);materials.add(red);
 const group=new T.Group();group.name='Boss-telegraphs-R1468';scene.add(group);const circles=[],lanes=[];
 for(let i=0;i<2;i++){const o=new T.Mesh(ring,amber);o.rotation.x=-Math.PI/2;o.visible=false;group.add(o);circles.push(o);}
 for(let i=0;i<3;i++){const o=new T.Mesh(box,amber);o.visible=false;group.add(o);lanes.push(o);}
 function circle(i,q,r,y,m){const o=circles[i];o.visible=true;o.material=m;o.position.set(q.x,y+.075,q.z);o.scale.setScalar(r);}
 return{update(state){
  for(const o of group.children)o.visible=false;
  const e=state.living.find(e=>e.kind==='boss'&&e.boss1468),a=e?.boss1468.action;if(!e||!a||a.kind==='evade'||state.dead||state.finale||state.won||a.t>=a.duration)return;
  const wind=a.t<a.wind,m=wind?amber:red,y=e.y||0,radial=['slam','stomp','spin','pendulum'].includes(a.kind),r=state.world===2&&a.kind==='spin'?8:a.range;
  if(['charge','jetDash','lunge','burst','laserSweep','ink','shards','gearFan'].includes(a.kind)){
   const charge=!!a.destination,length=charge?Math.hypot(a.destination.x-a.start.x,a.destination.z-a.start.z)+1.5:14;
   for(let i=0;i<(charge?1:3);i++){const o=lanes[i],yaw=a.yaw+(charge?0:(i-1)*.33);o.visible=true;o.material=m;o.position.set(e.x+Math.sin(yaw)*length/2,y+.065,e.z+Math.cos(yaw)*length/2);o.rotation.y=yaw;o.scale.set(charge?1.3:.10,.022,length);}
  }else{const targeted=['leap','tentacle','tentaclePair','lattice'].includes(a.kind);circle(0,targeted?a.target:e,radial?r:a.kind==='leap'?3.7:Math.min(3.8,r),y,m);if(a.second)circle(1,a.second,Math.min(3.5,r),y,m);}
 },dispose(){group.removeFromParent();}};
}
