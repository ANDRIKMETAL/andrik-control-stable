import * as T from './vendor/three-r170.module.min.js';
import {poseGuitar as propsPose} from './lyra-model.js';
export const motions={guitar:{name:'Удар гитарой',duration:1.2},microphone:{name:'Крик в микрофон',duration:1.5},idle:{name:'Спокойная стойка',duration:4},guard:{name:'Боксёрская стойка',duration:2},walk:{name:'Ходьба',duration:1.12},run:{name:'Бег',duration:.70},jump:{name:'Прыжок',duration:1.25},jab:{name:'Левый джеб',duration:.8},cross:{name:'Правый прямой',duration:.95},hook:{name:'Левый хук',duration:1.05},uppercut:{name:'Левый апперкот',duration:1.05},kick:{name:'Удар ногой',duration:1.4},combo:{name:'Джеб → прямой → апперкот',duration:2.65}};
const v=(x,y,z)=>new T.Vector3(x,y,z),down=v(0,-1,0),smooth=t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
function track(points,t){for(let i=1;i<points.length;i++)if(t<=points[i][0]){const a=points[i-1],b=points[i],u=smooth((t-a[0])/(b[0]-a[0]));return a[1].clone().lerp(b[1],u);}return points.at(-1)[1].clone();}
function scalar(points,t){return track(points.map(([a,b])=>[a,v(b,0,0)]),t).x;}
// Anatomical two-bone solver: direction and bend plane are independently specified.
// Pole points keep elbows below the fists and knees forward, not sideways.
function solve(first,second,target,pole,L1,L2){
 const start=first.position,delta=target.clone().sub(start),length=T.MathUtils.clamp(delta.length(),.03,L1+L2-.008),axis=delta.normalize();
 const along=(L1*L1-L2*L2+length*length)/(2*length),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const bend=pole.clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<1e-8)bend.set(1,0,0);bend.normalize();
 const elbow=start.clone().addScaledVector(axis,along).addScaledVector(bend,height),end=start.clone().addScaledVector(axis,length);
 first.quaternion.setFromUnitVectors(down,elbow.clone().sub(start).normalize());
 const inverse=first.quaternion.clone().invert();second.quaternion.setFromUnitVectors(down,end.sub(elbow).applyQuaternion(inverse).normalize());
}
export function animateLyra(root,mode,time){
 const u=root.userData,body=u.body;let duration=motions[mode]?.duration||4,p=(time%duration)/duration;
 if(mode==='combo'){const t=time%duration;if(t<.8){mode='jab';p=t/.8;}else if(t<1.65){mode='cross';p=(t-.8)/.85;}else{mode='uppercut';p=(t-1.65);}}
 body.position.set(0,0,0);body.rotation.set(0,0,0);u.head.rotation.set(0,0,0);u.hair.rotation.set(0,0,0);u.eye.rotation.set(0,0,0);u.microphone.visible=u.vocalMouth.visible=false;
 for(const l of u.limbs){l.arm.rotation.set(0,0,0);l.fore.rotation.set(0,0,0);l.hand.rotation.set(0,0,0);l.leg.rotation.set(0,0,0);l.shin.rotation.set(0,0,0);l.foot.rotation.set(0,0,0);}
 const combat=['guard','jab','cross','hook','uppercut','kick'].includes(mode);
 let feet=[v(-.14,.10,combat?.13:0),v(.14,.10,combat?-.15:0)],hands=[v(-.255,.86,.045),v(.255,.86,.045)];
 const guard=[v(-.125,1.57,.245),v(.115,1.59,.19)];
 if(combat){body.position.y=-.045;body.rotation.y=.13;hands=guard.map(h=>h.clone());u.head.rotation.x=.06;u.head.rotation.y=-.10;}
 if(mode==='idle'){
  body.position.y=Math.sin(time*1.7)*.003;body.rotation.z=Math.sin(time*.6)*.008;
  hands.forEach((h,i)=>{h.z+=Math.sin(time*1.7+i)*.005;});
 }
 if(mode==='guard'){
  body.position.y+=Math.sin(time*5)*.008;body.position.x=Math.sin(time*2)*.012;
 }
 if(mode==='walk'||mode==='run'){
  const run=mode==='run',phase=p*Math.PI*2;
  body.position.y=(run?.012:-.014)+(run?.035:.012)*Math.cos(phase*2);body.rotation.x=run?.13:.025;body.rotation.y=Math.sin(phase)*.045;body.rotation.z=Math.sin(phase)*(run?.035:.02);
  for(let i=0;i<2;i++){
   const q=phase+i*Math.PI,lift=Math.max(0,Math.sin(q));
   feet[i]=v(i?.115:-.115,.10+lift*(run?.23:.095),Math.cos(q)*(run?.30:.20));
   hands[i]=v(i?.255:-.255,run?1.14:.91,(run?.13:.02)-Math.cos(q)*(run?.23:.15));
  }
  u.hair.rotation.x=Math.sin(phase*2)*(run?.045:.015);u.eye.rotation.x=Math.sin(phase*2)*.06;
 }
 if(mode==='jump'){
  const crouch=scalar([[0,0],[.17,-.13],[.27,0],[.78,0],[.90,-.12],[1,0]],p),air=p>.24&&p<.79,flight=T.MathUtils.clamp((p-.24)/.55,0,1),height=air?4*.62*flight*(1-flight):0;
  body.position.y=crouch+height;body.rotation.x=air?.08:0;
  const tuck=air?Math.sin(flight*Math.PI):0;
  feet=[v(-.13,.10+height+.15*tuck,.12*tuck),v(.13,.10+height+.25*tuck,-.15*tuck)];
  const arm=scalar([[0,0],[.17,-.16],[.30,.50],[.60,.33],[.84,-.02],[1,0]],p);
  hands=[v(-.27,.89+height+arm,.12),v(.27,.89+height+arm,.12)];u.hair.rotation.x=-tuck*.10;
 }
 const isPunch=['jab','cross','hook','uppercut'].includes(mode);
 if(isPunch){
  const right=mode==='cross',index=right?1:0,contact=.36;
  const turn=scalar([[0,0],[.16,-.08],[contact,1],[.60,.25],[.86,0],[1,0]],p);
  body.rotation.y=.13+(right?-.43:.25)*turn;body.position.z=.045*turn;
  if(mode==='uppercut')body.position.y+=scalar([[0,0],[.18,-.065],[.38,.035],[.72,0],[1,0]],p);
  if(mode==='hook')body.rotation.y=.13+.52*turn;
  if(right)feet[1].y+=.027*Math.max(0,turn); // heel pivot transfers force from rear foot
  let path;
  if(mode==='jab')path=[[0,guard[0]],[.12,v(-.13,1.57,.23)],[.34,v(-.055,1.57,.585)],[.46,v(-.055,1.57,.585)],[.75,guard[0]],[1,guard[0]]];
  if(mode==='cross')path=[[0,guard[1]],[.16,v(.13,1.57,.16)],[.36,v(.02,1.55,.60)],[.44,v(.02,1.55,.60)],[.80,guard[1]],[1,guard[1]]];
  if(mode==='hook')path=[[0,guard[0]],[.18,v(-.30,1.50,.25)],[.29,v(-.30,1.53,.45)],[.40,v(.08,1.53,.49)],[.53,v(.11,1.53,.40)],[.83,guard[0]],[1,guard[0]]];
  if(mode==='uppercut')path=[[0,guard[0]],[.17,v(-.17,1.23,.22)],[.29,v(-.11,1.36,.38)],[.40,v(-.025,1.70,.40)],[.50,v(-.025,1.70,.40)],[.80,guard[0]],[1,guard[0]]];
  hands[index]=track(path,p);u.head.rotation.y=-body.rotation.y*.7;u.head.rotation.x=.07;
 }
 if(mode==='kick'){
  const turn=scalar([[0,0],[.24,.3],[.44,1],[.57,1],[.78,.25],[1,0]],p);
  body.rotation.y=.13+.65*turn;body.rotation.z=.12*turn;body.position.x=-.08*turn;body.position.y-=.015*turn;
  feet[1]=track([[0,feet[1]],[.20,v(.15,.42,.13)],[.32,v(.20,.78,.21)],[.46,v(.28,1.12,.62)],[.55,v(.28,1.12,.62)],[.70,v(.18,.73,.18)],[.88,v(.14,.10,-.15)],[1,v(.14,.10,-.15)]],p);
  hands[1].x+=.13*turn;hands[1].y-=.12*turn;hands[0].z+=.02*turn;u.head.rotation.y=-body.rotation.y*.7;
 }
 body.updateMatrix();const inv=body.matrix.clone().invert();
 for(let i=0;i<2;i++){
  const l=u.limbs[i],side=i?1:-1,hand=hands[i].clone().applyMatrix4(inv),foot=feet[i].clone().applyMatrix4(inv);
  solve(l.arm,l.fore,hand,v(side*.25,1.05,.13),.32,.30);
  // Align knuckles with the strike direction, while the wrist stays straight at contact.
  l.hand.rotation.set(0,0,0);
  for(let j=0;j<4;j++){const finger=l.hand.children[j+2];if(finger){finger.scale.y=combat?.012:.023;finger.position.y=combat?-.024:-.032;finger.position.z=combat?.020:.010;finger.rotation.x=combat?.8:0;}}
  solve(l.leg,l.shin,foot,v(side*.13,.55,.65),.42,.42);
  const worldQ=body.quaternion.clone().multiply(l.leg.quaternion).multiply(l.shin.quaternion);
  l.foot.quaternion.copy(worldQ.invert());
  l.foot.rotateY(side*.07+(mode==='kick'&&i===0?body.rotation.y*.7:0));
  if(mode==='kick'&&i===1)l.foot.rotateX(-.45*Math.sin(p*Math.PI));
 }
 u.guitar.position.set(.13,1.37,-.20);u.guitar.rotation.set(.08,0,-.45);u.guitar.position.y+=Math.sin(time*(mode==='run'?18:3))*.008;
 if(mode==='guitar'||mode==='microphone')propsPose(root,{kind:mode==='guitar'?'attack':'scream',t:p*duration,duration},0,time,false);
 u.syncDeform();root.updateMatrixWorld(true);
 return {mode,phase:p,hands,feet,combat};
}
