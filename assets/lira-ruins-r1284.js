/* ANDRIK GAME R1282 — isolated procedural 3D art for Ruins of Epochs only.
   All geometry is genuine Three.js; player navigation remains 2.5D. */
import * as T from './vendor/three-r170.module.min.js';
export const RUINS_GAPS_R1283=[[1024,1088],[1536,1600],[2048,2112],[2624,2688],[3104,3168]];
const mats={};const geo={};
function mat(color,metal=.08,rough=.83,emissive=null){const key=color+metal+rough+(emissive||'');return mats[key]??(mats[key]=new T.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive:emissive||'#000000',emissiveIntensity:emissive?.65:0,flatShading:color==='#675441'}));}
const sandstone=mat('#8f7757'),stone=mat('#675441'),light=mat('#b8a17a'),dark=mat('#352e2b'), bronze=mat('#775537',.64,.4),bronze2=mat('#b98b50',.7,.34),obsidian=mat('#14191c',.24,.58),amber=mat('#ffaa45',.32,.3,'#9f4d08'),teal=mat('#56c6b9',.22,.35,'#124b48'),sand=mat('#c09a6b'),cloth=mat('#252021'),red=mat('#6a2a21');
function cached(kind,...params){const key=kind+'_'+params.join('_');if(!geo[key])geo[key]=kind==='box'?new T.BoxGeometry(...params):kind==='cyl'?new T.CylinderGeometry(...params):kind==='torus'?new T.TorusGeometry(...params):kind==='sphere'?new T.IcosahedronGeometry(...params):new T.ConeGeometry(...params);return geo[key];}
function add(g,mesh,x=0,y=0,z=0){mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function b(g,x,y,z,w,h,d,m){return add(g,new T.Mesh(cached('box',1,1,1),m),x,y,z).scale.set(w,h,d),g.children[g.children.length-1];}
function c(g,x,y,z,r1,r2,h,m,seg=9){return add(g,new T.Mesh(cached('cyl',r1,r2,h,seg),m),x,y,z);}
function orb(g,x,y,z,r,m){return add(g,new T.Mesh(cached('sphere',r,1),m),x,y,z);}
function hoop(g,x,y,z,r,t,m,tilt=0){const o=add(g,new T.Mesh(cached('torus',r,t,6,56),m),x,y,z);o.rotation.set(0,tilt,0);return o;}
function rubble(g,x,z,seed){for(let j=0;j<4;j++){const n=orb(g,x+(j-1.4)*9,2+(j%2)*3,z+((seed*7+j*17)%39)-19,4+(j%3)*3,j%2?stone:sand);n.scale.set(1.5,.35,1.1);n.rotation.y=j*.71;}}
function gate(g,x,idx){const side=idx%2?1:-1,z=side*103;
 c(g,x,45,z,10,17,90,sandstone);const cap=b(g,x,90,z,31,10,31,light);cap.rotation.y=.12;
 for(let j=0;j<2;j++){const p=b(g,x+(j?14:-14),57,z,7,65,7,bronze);p.rotation.z=(j?1:-1)*.10;}
 const r=hoop(g,x,115,z,42,5,bronze,idx*.16);r.rotation.z=idx%2?.41:-.37;
 c(g,x,4,z+idx%3*7,30,31,8,stone,12);rubble(g,x+28,z,idx);return r;}
function glyph(g,x,y,z,size=8){const h=hoop(g,x,y,z,size,1.2,amber);h.rotation.z=.45;const bar=b(g,x,y,z+1,1.5,size*1.7,2,bronze2);bar.rotation.z=.38;}
function giantDial(g,x,z,r,tilt=0){const group=new T.Group();group.position.set(x,105,z);group.rotation.y=tilt;g.add(group);
 hoop(group,0,0,0,r,7,bronze);hoop(group,0,0,0,r-11,2,amber);for(let i=0;i<12;i++){const a=i*Math.PI/6,cx=Math.sin(a)*(r-14),cy=Math.cos(a)*(r-14);const spoke=b(group,cx,cy,2,3,12,3,light);spoke.rotation.z=-a;}
 const hand=b(group,0,14,5,3,42,3,bronze2);hand.rotation.z=.34;return group;}
function bridge(g,x,len,variant=0){const thickness=8;const seg=Math.max(3,Math.floor(len/32));for(let i=0;i<seg;i++){const xx=x+(i-(seg-1)/2)*32;if(RUINS_GAPS_R1283.some(([a,z])=>xx+15>a&&xx-15<z))continue;const slab=b(g,xx,-1,(i%2?0:2),30,thickness,136,i%5===2?stone:sandstone);slab.rotation.y=(i%5-2)*.025;
 for(let j=0;j<3;j++)if((i+j+variant)%4===0){const line=b(g,xx+((j-1)*7),3,-61+j*52,2.4,.55,15,dark);line.rotation.z=.28;}}
 // Reinforcing structures and supporting broken pieces outside the playable path
 for(const side of [-1,1])for(let j=0;j<3;j++){const zz=side*(83+j*27),xx=x+(j-1)*41;const p=b(g,xx,-13-j*2,zz,34,7,23,stone);p.rotation.z=(j-1)*.15;}
}
function columnFragment(g,x,z,y=0){const h=35+(Math.abs(Math.floor(x))%4)*10;const foot=c(g,x,4,z,14,18,10,sandstone);foot.rotation.z=.05;const shaft=c(g,x,y+h/2+8,z,8,10,h,stone);shaft.rotation.z=Math.sin(x)*.18;const top=c(g,x,y+h+8,z,15,15,7,light);top.rotation.z=.23;}
function farRuins(g){for(let i=0;i<18;i++){const x=-170+i*260,z=-440-(i%4)*90;const group=new T.Group();group.position.set(x,0,z);g.add(group);
 const h=100+(i*47)%170,bb=b(group,0,h/2,0,60+(i%3)*25,h,70,mat(['#38312d','#493d32','#55483a'][i%3]));bb.rotation.y=i*.28;
 if(i%3===0){const r=hoop(group,6,h+35,12,37,4,bronze,i*.2);r.rotation.z=.4;}
 if(i%2===0)for(let j=0;j<3;j++)columnFragment(group,-58+j*44,-20-j*14);}
}
function instanceStaticArchitecture(root){
 root.updateMatrixWorld(true);
 const categories=new Map();
 root.traverse(o=>{
  if(!o.isMesh || o.userData?.keepMotion)return;
  for(let q=o.parent;q&&q!==root;q=q.parent)if(q.userData?.keepMotion)return;
  const key=o.geometry.uuid+'|'+o.material.uuid;
  if(!categories.has(key))categories.set(key,[]);
  categories.get(key).push(o);
 });
 let calls=0,instances=0;
 for(const list of categories.values()){
  const batch=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);
  batch.receiveShadow=true;batch.frustumCulled=false;
  for(let i=0;i<list.length;i++){
   batch.setMatrixAt(i,list[i].matrixWorld);
   list[i].parent.remove(list[i]);instances++;
  }
  batch.instanceMatrix.needsUpdate=true;
  root.add(batch);calls++;
 }
 return {calls,instances};
}
export function animateRuinsWorld(world,time){
 const a=world?.group?.userData?.ruins;if(!a)return;
 a.wheel.rotation.z=Math.sin(time*.32)*.19;
 a.pend.rotation.z=Math.sin(time*.77)*.32;
}
export function buildRuinsWorld(){const group=new T.Group();const particles=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:'#cdaa70',size:1.4,transparent:true,opacity:.42}));
 const pts=new Float32Array(310*3);for(let i=0;i<310;i++){pts[3*i]=(i*79.31)%4050;pts[3*i+1]=22+(i*97.31)%225;pts[3*i+2]=-165-(i*43.17)%260;}particles.geometry.setAttribute('position',new T.BufferAttribute(pts,3));group.add(particles);
 // Stable collision-compatible main walkway: decorative chasms are beyond +/-75 world Z.
 for(let i=0;i<24;i++){bridge(group,80+i*160,160,i);if(i%5===2)rubble(group,80+i*160,55,i);}
 for(let i=0;i<25;i++){const x=i*160+12;if(RUINS_GAPS_R1283.some(([a,z])=>x>a-2&&x<z+2))continue;const stripe=b(group,x,.12,0,1,.32,124,i%2?stone:bronze);stripe.rotation.y=.09;}for(const [a,z] of RUINS_GAPS_R1283){for(const edge of [a,z]){b(group,edge,-4,0,4,11,142,dark);const warning=b(group,edge,2,0,3,1,136,amber);warning.material=amber;}for(let j=0;j<3;j++){const spl=b(group,(a+z)/2+(j-1)*14,-19-j*5,80+j*15,17,5,47,stone);spl.rotation.z=.26+j*.3;}}
 farRuins(group);
 // A: Gates of halted time
 for(let i=0;i<5;i++)gate(group,110+i*150,i);giantDial(group,275,-270,84,.3);giantDial(group,640,-240,56,-.35);
 for(let i=0;i<6;i++)rubble(group,100+i*119,-65,i);
 // B: Bridge of vanished epochs
 for(let i=0;i<6;i++){const x=980+i*185;const r=hoop(group,x,126,-190,35+i%3*12,5,i%2?bronze:stone);r.rotation.z=(i%2?1:-1)*.48;const shard=b(group,x+28,90+(i%2)*27,-180-i%3*11,63,9,43,sandstone);shard.rotation.z=.3+i*.08;}
 for(let i=0;i<8;i++){const x=940+i*171;const c1=c(group,x,105,-173,4,4,115,bronze2);c1.rotation.z=.10;const anchor=orb(group,x,164,-175,8,obsidian);anchor.scale.y=.55;}
 // C: Chronograph hall with gear stacks, pendulum, readable activators
 for(let i=0;i<7;i++){const x=2170+i*155;const r=hoop(group,x,115,-190,57+(i%3)*10,8,bronze);r.rotation.y=i*.19;r.rotation.z=i%2?.2:-.23;
 for(let j=0;j<10;j++){const a=j*Math.PI/5,t=b(group,x+Math.cos(a)*60,115+Math.sin(a)*60,-188,13,9,12,bronze2);t.rotation.z=a;}}
 for(const x of [2360,2620,2870]){const p=c(group,x,32,57,15,17,65,sandstone);c(group,x,65,57,19,21,9,bronze2);orb(group,x,74,57,9,amber);glyph(group,x,83,70);}
 const pend=new T.Group();pend.position.set(2740,280,-185);group.add(pend);b(pend,0,-91,0,4,183,5,bronze);orb(pend,0,-184,0,21,bronze2);pend.userData.keepMotion=true;
 // D: Rift heart arena; a broad round visual dial under compatible flat collision
 const arena=c(group,3580,-8,0,200,200,18,stone,44);arena.scale.z=.45;
 const outer=hoop(group,3575,2,0,185,7,bronze2);outer.rotation.x=Math.PI/2;outer.scale.y=.50;
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const marker=b(group,3575+Math.cos(a)*174,2,Math.sin(a)*70,18,1,5,light);marker.rotation.y=a;}
 const wheel=giantDial(group,3670,-215,124,.20);wheel.position.y=152;wheel.userData.keepMotion=true;
 for(let i=0;i<9;i++){const x=3350+i*53, zz=i%2?145:-155;columnFragment(group,x,zz);}
 const fissure=b(group,3490,1,-80,280,1,5,teal);fissure.rotation.y=.4;
 // Huge black abyss everywhere outside the narrow stable playable path; does not disguise passable collisions.
 b(group,2020,-35,-470,4190,4,690,obsidian);b(group,2020,-35,460,4190,4,690,obsidian);
 const batching=instanceStaticArchitecture(group);
 group.userData.ruins={wheel,pend,chronos:[2360,2620,2870],batching};
 return {group,mode:'ruins',tiles:[],animated:[],particles};}
function limbSegments(g,m,ax,ay,heavy=false){const out=[];for(const side of [-1,1]){const a=new T.Group();a.position.set(side*ax,ay,0);g.add(a);const upper=orb(a,0,-12,0,heavy?15:8,m);upper.scale.set(heavy?.9:.64,1.8,.85);const joint=orb(a,0,-28,0,heavy?10:6,bronze2);const fore=new T.Group();fore.position.y=-29;a.add(fore);orb(fore,0,-14,2,heavy?13:7,m).scale.set(.8,1.8,.8);orb(fore,0,-29,4,heavy?12:6,m);out.push({a,fore,side});}return out;}
function legs(g,m,spread=13,h=40){for(const side of [-1,1]){const q=orb(g,side*spread,h*.40,0,spread*.66,m);q.scale.set(.85,2.1,1);const knee=orb(g,side*spread,h*.22,3,spread*.58,bronze);knee.scale.y=.8;const foot=orb(g,side*spread,5,9,spread*.8,obsidian);foot.scale.set(.92,.52,1.7);}}
function armorPlates(g,m,w,h){for(const side of [-1,1]){const plate=orb(g,side*w*.34,h*.65,9,w*.30,m);plate.scale.set(1,1.6,.55);}for(let i=0;i<3;i++){const p=orb(g,(i-1)*w*.25,h*.34,12,w*.17,bronze);p.scale.set(1,.4,.44);}}
export function makeRuinsEnemy(kind){const g=new T.Group(),k=kind||'stone';let arms=[];
 if(k==='stone'){
  legs(g,stone,14,39);orb(g,0,43,0,24,sandstone).scale.set(1.24,1.27,.87);
  armorPlates(g,bronze,39,57);const neck=orb(g,0,72,1,12,stone);const head=orb(g,0,83,3,15,sandstone);head.scale.set(1,.88,.82);
  for(const side of [-1,1]){const eye=orb(g,side*6,83,14,2.2,amber);orb(g,side*8,100,-3,5,bronze);}
  arms=limbSegments(g,stone,29,68,true);const shield=orb(g,-40,38,16,26,bronze);shield.scale.set(.30,1.05,.9);hoop(g,-44,38,22,16,2,bronze2);
  g.userData.shield=shield;
 }else if(k==='sand'){
  legs(g,cloth,8,39);orb(g,0,51,0,15,cloth).scale.set(.8,2,.7);
  const hood=orb(g,0,86,0,14,stone);hood.scale.set(.80,1.25,.9);
  orb(g,0,84,12,8,obsidian).scale.set(.9,1.1,.42);
  const cloak=add(g,new T.Mesh(cached('cone',28,72,9),cloth),0,34,-11);cloak.rotation.x=-.17;
  for(let i=0;i<5;i++)orb(g,(i-2)*6,23-(i%2)*10,-18,5,sand).scale.set(.5,1.7,.6);
  arms=limbSegments(g,cloth,16,64,false);orb(g,0,86,21,3,amber);
 }else if(k==='watcher'){
  // Recognisable bronze flying automaton: six mechanical vanes, central iris, no humanoid cabinet shape.
  const shell=orb(g,0,68,0,22,bronze);shell.scale.set(1.15,.82,.74);
  const face=orb(g,0,68,17,15,bronze2);face.scale.set(.95,.80,.30);
  orb(g,0,68,23,8,amber);hoop(g,0,68,28,11,2,obsidian);hoop(g,0,68,0,32,3,bronze2,.35);
  const band=hoop(g,0,68,0,39,3,teal,-.50);band.rotation.x=.5;
  for(let j=0;j<6;j++){const a=j*Math.PI/3,blade=orb(g,Math.cos(a)*37,68+Math.sin(a)*29,1,12,bronze);blade.scale.set(.42,1.5,.55);blade.rotation.z=a;}
  const tail=add(g,new T.Mesh(cached('cone',8,31,10),bronze),0,34,-2);tail.rotation.z=Math.PI;
  g.userData.iris=face;
 }else{
  legs(g,stone,23,60);orb(g,0,71,0,35,stone).scale.set(1.18,1.45,.9);
  armorPlates(g,sandstone,59,110);const head=orb(g,0,123,0,20,stone);head.scale.set(.95,1.18,.88);
  for(let i=0;i<5;i++)orb(g,(i-2)*12,82+i%2*8,32,4,amber);
  arms=limbSegments(g,bronze,47,107,true);orb(g,-49,29,3,22,stone).scale.set(1,1.6,.85);
 }
 g.userData={...g.userData,kind:k,arms,baseScale:1};return g;
}
export function poseRuinsEnemy(g,e,t){const u=g.userData,k=u.kind,phase=Math.sin(t*(k==='sand'?13:8)+(e.x||0)*.035);g.rotation.y=e.face<0?-.95:.95;
 const anim=e.attackAnimR1185,hit=anim?Math.sin(Math.min(1,anim.t/Math.max(.2,anim.duration))*Math.PI):0;
 if(u.arms)u.arms.forEach(({a,fore,side})=>{a.rotation.z=side*(.10+Math.abs(phase)*.13+hit*.9);fore.rotation.z=side*(-.14+hit*.6);});
 if(u.iris)u.iris.scale.z=.30+hit*.18;
 if(e.jumpDirR1284){g.rotation.z=-e.jumpDirR1284*.10;for(const a of u.arms||[]){a.a.rotation.z=a.side*.65;a.fore.rotation.z=-a.side*.45;}}
 if(e.fallingR1284){g.rotation.z=.28;}

 g.position.y+=k==='watcher'?12+Math.sin(t*3+e.x)*5:Math.abs(phase)*.65;
 if(!e.alive){const d=Math.max(.01,e.deathTimer||0);g.scale.setScalar(Math.min(1,d/.8));g.rotation.z=(1-Math.min(1,d/.8))*.5;}
}
export function makeRuinsBoss(){const g=new T.Group();g.name='KeeperOfEpochs';const arms=[];
 // 3x Lyra, no anthropomorphic scaled-up stock enemy
 for(const side of [-1,1]){b(g,side*25,35,1,35,70,35,stone);b(g,side*25,7,12,37,13,54,obsidian);}
 b(g,0,116,0,104,115,61,stone);b(g,0,174,0,90,35,60,bronze);b(g,0,205,0,54,37,37,sandstone);b(g,0,222,2,59,13,32,bronze);
 const core=orb(g,0,126,36,24,amber);core.scale.z=.64;hoop(g,0,126,55,30,5,bronze2);for(let j=0;j<7;j++)b(g,(j-3)*14,145+(j%2)*9,33,8,6,6,bronze2);
 const ring=hoop(g,0,169,-45,101,10,bronze2);ring.rotation.y=.25;const ring2=hoop(g,0,169,-48,83,4,amber);ring2.rotation.y=-.3;
 for(const side of [-1,1]){const a=new T.Group();a.position.set(side*60,175,0);g.add(a);b(a,side*9,-29,0,36,71,40,side===-1?stone:bronze);const elbow=new T.Group();elbow.position.set(side*10,-62,0);a.add(elbow);b(elbow,0,-33,4,side===-1?49:32,72,39,side===-1?stone:bronze2);const fist=b(elbow,0,-73,8,side===-1?55:40,31,42,stone);arms.push({a,elbow,side});}
 g.userData={arms,ring,ring2,core};return g;}
export function poseRuinsBoss(g,e,t){const u=g.userData;const phase=e.phase||1;const state=e.state||'idle',p=Math.min(1,(e.stateTime||0)/Math.max(.001,e.stateDuration||1));const ease=Math.sin(Math.PI*p);
 g.rotation.y=e.face<0?-.75:.75;g.position.y=Math.sin(t*1.4)*.45;
 u.ring.rotation.z=t*(.13+phase*.06);u.ring2.rotation.z=-t*.11;
 u.arms.forEach(({a,elbow,side})=>{a.rotation.z=side*(.2+Math.sin(t*1.2)*.045);
 if(state==='telegraph'){a.rotation.z+=side*(.4+ease*.4);elbow.rotation.x=-ease*.4;}
 if(state==='active'){a.rotation.z+=side*(1.4*ease);elbow.rotation.x=-.6*ease;}
 if(state==='stunned'||state==='recover')a.rotation.z+=side*.12;});
 u.core.material=state==='vulnerable'||state==='stunned'?amber:phase>=3?teal:bronze2;
 if(state==='death'){g.rotation.z=Math.min(.5,p*.5);g.position.y=-p*32;u.ring.rotation.x=p*.9;}
}
