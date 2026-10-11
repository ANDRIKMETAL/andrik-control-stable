/* ANDRIK GAME R1282 — isolated procedural 3D art for Ruins of Epochs only.
   All geometry is genuine Three.js; player navigation remains 2.5D. */
import * as T from './vendor/three-r170.module.min.js';
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
function bridge(g,x,len,variant=0){const thickness=8;const seg=Math.max(3,Math.floor(len/32));for(let i=0;i<seg;i++){const xx=x+(i-(seg-1)/2)*32;const slab=b(g,xx,-1,(i%2?0:2),30,thickness,136,i%5===2?stone:sandstone);slab.rotation.y=(i%5-2)*.025;
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
 for(let i=0;i<25;i++){const x=i*160+12;const stripe=b(group,x,.12,0,1,.32,124,i%2?stone:bronze);stripe.rotation.y=.09;}
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
function limbs(g,bodyY,m,armsX=20,armY=49){const arms=[];for(const side of [-1,1]){const a=new T.Group();a.position.set(side*armsX,armY,0);g.add(a);b(a,0,-13,0,9,27,11,m);const fore=new T.Group();fore.position.set(0,-24,0);a.add(fore);b(fore,0,-9,0,8,20,10,m);arms.push({a,fore,side});}return arms;}
function body(g,w,h,m){b(g,0,h/2,0,w,h,19,m);}
function walker(g,m,wide=12){for(const side of [-1,1]){const p=b(g,side*wide,17,0,14,34,17,m);b(g,side*wide,3,8,18,8,29,obsidian);}}
export function makeRuinsEnemy(kind){const g=new T.Group();const k=kind||'stone';let arms=[];
 if(k==='stone'){walker(g,stone,15);body(g,42,60,sandstone);b(g,0,65,0,35,18,17,stone);const head=orb(g,0,78,2,14,sandstone);head.scale.set(1.15,.83,.8);arms=limbs(g,55,stone,30,56);b(g,-37,36,11,12,43,31,bronze);orb(g,0,76,14,3,amber);}
 else if(k==='sand'){walker(g,cloth,7);body(g,19,67,cloth);const hood=orb(g,0,81,0,12,cloth);hood.scale.set(.8,1,.8);arms=limbs(g,51,cloth,15,55);const cape=b(g,0,37,-14,34,67,3,stone);cape.rotation.x=.12;orb(g,0,83,9,3,amber);}
 else if(k==='watcher'){const core=orb(g,0,64,0,15,bronze2);core.scale.y=.9;orb(g,0,66,15,8,amber);hoop(g,0,65,0,23,3,bronze).rotation.y=.6;hoop(g,0,65,0,28,2,teal).rotation.x=.6;}
 else {walker(g,stone,20);body(g,57,82,stone);const head=orb(g,0,102,0,16,sandstone);head.scale.y=1.15;arms=limbs(g,70,bronze,34,80);b(g,-39,36,0,23,49,23,stone);b(g,39,40,0,18,63,19,light);for(let i=0;i<3;i++)orb(g,-10+i*10,50,11,3,amber);}
 g.userData={kind:k,arms};return g;}
export function poseRuinsEnemy(g,e,t){const u=g.userData,k=u.kind,move=Math.sin(t*(k==='sand'?12:6)+(e.x||0)*.12);g.rotation.y=e.face<0?-0.95:0.95;
 const anim=e.attackAnimR1185,hit=anim?Math.sin(Math.min(1,anim.t/Math.max(.2,anim.duration))*Math.PI):0;
 if(u.arms)u.arms.forEach(({a,fore,side},i)=>{a.rotation.z=side*(.10+Math.abs(move)*.12)+side*hit*.9;fore.rotation.z=side*(-.12+hit*.65);});
 g.position.y+=k==='watcher'?9+Math.sin(t*3.5+e.x)*5:Math.abs(move)*.65;
 if(!e.alive){const d=Math.max(.01,e.deathTimer||0);g.scale.multiplyScalar(Math.min(1,d/.8));g.rotation.z=(1-Math.min(1,d/.8))*.5;}
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
