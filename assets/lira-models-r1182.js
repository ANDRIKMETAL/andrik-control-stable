import * as T from './vendor/three-r170.module.min.js';
const cache=new Map();
export function material(color,roughness=.66,metalness=.1,emission=0){const key=[color,roughness,metalness,emission].join(':');if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color,roughness,metalness,emissive:color,emissiveIntensity:emission}));return cache.get(key);}
const boxGeo=new T.BoxGeometry(1,1,1), sphereGeo=new T.SphereGeometry(1,16,12), cylGeo=new T.CylinderGeometry(1,1,1,12), coneGeo=new T.ConeGeometry(1,1,12);
export function mesh(parent,geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function box(p,x,y,z,w,h,d,c,rough=.7,metal=.1){return mesh(p,boxGeo,typeof c==='object'?c:material(c,rough,metal),x,y,z,w,h,d);}
export function sphere(p,x,y,z,w,h,d,c){return mesh(p,sphereGeo,typeof c==='object'?c:material(c),x,y,z,w,h,d);}
export function cylinder(p,x,y,z,r,h,c){return mesh(p,cylGeo,typeof c==='object'?c:material(c),x,y,z,r,h,r);}
export function cone(p,x,y,z,r,h,c){return mesh(p,coneGeo,typeof c==='object'?c:material(c),x,y,z,r,h,r);}
export function ring(p,x,y,z,r,t,c){return mesh(p,new T.TorusGeometry(r,t,7,32),typeof c==='object'?c:material(c,.25,.7),x,y,z);}
const skin=material('#bb8c78',.68,0),leather=material('#151820',.42,.23),denim=material('#202731',.88,.04),boots=material('#080d13',.35,.3),silver=material('#aebecb',.24,.82),hair=material('#111117',.57,.06);
export function character(kind='lira'){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const lira=kind==='lira',boss=kind==='boss',roman=kind==='roman',police=kind==='police'||kind==='riot';
 const suit=lira?leather:material(roman?'#73645b':police?'#27364c':boss?'#354454':'#39252d',.55,.25);
 const headSkin=roman?material('#88786b'):skin;
 const waist=sphere(body,0,29,0,lira?6.4:8,5,4.4,suit);
 sphere(body,0,40,0,lira?8.5:10.3,11.3,4.9,suit);
 if(lira){sphere(body,0,31,1,5.8,2.7,4.5,skin);box(body,0,27,0,13,2,9,leather);box(body,0,27,4.7,3,2.2,.7,silver);}
 cylinder(body,0,52,0,2.2,6,headSkin);
 const head=new T.Group();head.position.y=60;head.scale.setScalar(.86);body.add(head);
 sphere(head,0,0,0,6,7.6,5.3,headSkin);
 sphere(head,0,-2,3.65,4,4.5,2,headSkin);
 sphere(head,0,-.2,5,1.05,1.75,1.3,headSkin);
 for(const side of [-1,1]){
  sphere(head,side*2.3,.7,4.9,1.35,.56,.23,material('#d2d4ce'));
  sphere(head,side*2.3,.65,5.15,.52,.53,.15,material(lira?'#97aeb2':'#b99283'));
  sphere(head,side*2.3,.65,5.28,.25,.36,.1,boots);
  const brow=box(head,side*2.3,2.3,4.8,3,.55,.5,hair);brow.rotation.z=side*-.11;
  sphere(head,side*5.5,-.2,0,1,2.1,1.3,headSkin);
  if(lira)ring(head,side*5.8,-2.4,1,1,.18,silver);
 }
 box(head,0,-3.7,5.18,2.8,.6,.45,material(lira?'#78414a':'#614747',.65));
 if(lira){
  sphere(head,0,3.6,-1.2,6.55,6.2,5.9,hair);
  const cap=sphere(head,-3,4.4,1.2,4.5,4.2,5.3,hair);cap.rotation.z=.35;
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI*1.9;const x=Math.cos(a)*5.7,z=-1.4+Math.sin(a)*4.2;
   if(z>1.4&&Math.abs(x)<4)continue;
   const lock=sphere(head,x,-7.2-(i%3)*1.3,z,2.4,12.4+(i%3)*2,2.1,hair);lock.rotation.z=x*.025;
  }
  for(const side of [-1,1]){const lock=sphere(head,side*6.4,-8.8,.5,2.2,11,2.7,hair);lock.rotation.z=side*.09;}
 }else if(roman||police||boss){sphere(head,0,3,-1,6.7,6,5.8,suit);box(head,0,1.5,5.5,13,2,2,boots);if(roman)box(head,0,10,-1,2,9,11,material('#754441'));}
 else{sphere(head,0,4,-1,6.5,4.7,5.6,hair);for(let i=0;i<5;i++)cone(head,0,10,-4+i*2,1.9,6,material('#80414b'));}
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*(lira?9:11),46,0);body.add(arm);
  sphere(arm,0,-1,0,2.8,3.7,3,headSkin);
  cylinder(arm,0,-7,0,2.2,12,lira?skin:suit);
  const fore=new T.Group();fore.position.y=-13;arm.add(fore);
  cylinder(fore,0,-4,0,1.8,8,headSkin);cylinder(fore,0,-7.6,0,2.2,4,boots);
  sphere(fore,0,-11,0,2.25,3,2.1,headSkin);
  if(lira){for(let i=0;i<3;i++)box(fore,side*1.9,-6.8-i*.85,0,.9,.6,3,silver);}
  const leg=new T.Group();leg.position.set(side*3.8,28,0);body.add(leg);
  cylinder(leg,0,-7,0,2.95,14,lira?denim:suit);
  const shin=new T.Group();shin.position.y=-14;leg.add(shin);
  cylinder(shin,0,-5,0,2.5,10,lira?denim:suit);
  box(shin,0,-10,1.5,6,8,9,boots);box(shin,0,-13.5,1.8,6.4,1.5,9.5,boots);
  if(lira){box(leg,0,-9,2.94,4,1.25,.2,skin);box(leg,0,-11.5,2.94,3,1.1,.2,skin);box(shin,0,-1,2.5,4.1,1.3,.15,skin);}
  limbs.push({arm,fore,leg,shin});
 }
 // Eye medallion and chain, part of Líra's established design.
 if(lira){const necklace=ring(body,0,46,4.8,3.3,.22,silver);necklace.scale.y=1.2;const med=ring(body,0,40,5.5,2.1,.5,silver);med.scale.y=.62;sphere(body,0,40,5.7,.8,.8,.45,material('#c0ac76',.3,.75));}
 if(roman||kind==='riot'){const shield=new T.Group();shield.position.set(-13,38,5);box(shield,0,0,0,11,22,3,suit);box(shield,0,0,1.6,1.4,20,.6,silver);sphere(shield,0,0,2.1,2.5,2.5,1.3,silver);body.add(shield);}
 const sword=new T.Group();limbs[1].fore.add(sword);sword.position.set(0,-11,0);sword.rotation.z=-Math.PI/2;
 box(sword,0,-4,0,2.1,8,2,boots);box(sword,0,-8,0,9,1.2,2,material('#b59b68',.3,.65));box(sword,0,-26,0,3,34,.75,silver);box(sword,.9,-26,.5,.8,32,.25,material('#b8e7ed',.15,.4,.4));cone(sword,0,-45,0,1.5,5,silver).rotation.z=Math.PI;sword.visible=false;
 const guitar=new T.Group();guitar.position.set(0,0,-1);guitar.rotation.z=-.44;body.add(guitar);
 sphere(guitar,-4,34,-6,6.5,9,2.4,material('#2b1c24',.28,.5));sphere(guitar,1,39,-6,5,6,2.2,leather);box(guitar,0,51,-6,2.8,27,1.8,material('#70584b'));box(guitar,0,66,-6,4,6,2,boots);
 for(let i=0;i<4;i++)box(guitar,-.75+i*.5,49,-4.9,.13,32,.13,silver);
 guitar.visible=lira;
 root.userData={body,head,limbs,sword,guitar,kind};
 if(boss)root.scale.setScalar(1.55);
 batch(root);
 return root;
}
export function animateCharacter(root,p,time,opts={}){
 const d=root.userData,walking=opts.walking??(Math.abs(p.vx||0)+Math.abs(p.vy||0)>8),phase=p.walkPhase||time*9;
 const stride=walking?Math.sin(phase)*.53:0;const air=(p.z||0)>2||opts.air;
 root.rotation.y=(p.face??p.dir??1)*.55;
 d.body.position.y=walking?Math.abs(Math.sin(phase))*.9:Math.sin(time*2)*.4;
 d.body.rotation.z=0;d.head.rotation.y=Math.sin(time*.7)*.035;
 d.limbs.forEach((a,i)=>{a.arm.rotation.set(i?stride:-stride,0,(i?-.1:.1));a.fore.rotation.x=-.18;a.leg.rotation.x=i?-stride:stride;a.leg.rotation.z=0;a.shin.rotation.x=air?.55:Math.max(0,(i?stride:-stride)*.7);if(air)a.leg.rotation.x=i?-.75:.45;});
 const atk=p.attack,kind=atk?.kind||opts.attack;
 d.sword.visible=!!kind&&/sword/i.test(kind);d.guitar.rotation.z=-.44;
 if(kind){const t=atk?Math.min(1,atk.t/atk.duration):.45,q=Math.sin(t*Math.PI),right=(p.face||1)>0?1:0,arm=d.limbs[right];
  if(/kick|sweep/i.test(kind)){d.limbs[right].leg.rotation.z=-(p.face||1)*q*1.25;d.limbs[right].shin.rotation.x=.1;d.body.rotation.z=(p.face||1)*q*.14;}
  else if(/guitar|super/i.test(kind)){d.limbs.forEach(a=>{a.arm.rotation.z=q*1.3;a.arm.rotation.x=-q*1.5;});d.guitar.rotation.z=-.44+q*2.2;}
  else{arm.arm.rotation.z=-(p.face||1)*q*1.5;arm.arm.rotation.x=-q*.5;arm.fore.rotation.x=-.1;d.body.rotation.z=-(p.face||1)*q*.08;}
 }
 if(opts.ride){d.limbs.forEach(a=>{a.leg.rotation.x=-1.3;a.shin.rotation.x=1.4;a.arm.rotation.x=-.9;});d.body.rotation.x=.15;}else d.body.rotation.x=0;
 if(p.alive===false||p.dead){d.body.rotation.z=(p.face||1)*-1.4;d.body.position.y=-13;}
 root.visible=!((p.invuln||0)>0&&Math.floor(time*15)%3===0);
}
export function dog(){const g=new T.Group();sphere(g,0,16,0,15,8,6,material('#30313a'));sphere(g,14,22,0,7,7,5,material('#252630'));sphere(g,20,20,2,6,3,4,material('#44424a'));for(const x of [-9,9])for(const z of [-4,4])cylinder(g,x,7,z,2,14,'#202530');cone(g,12,31,-3,2.5,8,'#151921');cone(g,16,31,3,2.5,8,'#151921');sphere(g,18,24,4,1,.8,.5,material('#dfae6c',.3,0,1));const tail=cylinder(g,-19,18,0,1.5,16,'#202530');tail.rotation.z=-.8;return g;}
export function motorcycle(police=false){const g=new T.Group(),rubber=material('#0b1017',.88),metal=material('#53626e',.32,.78),paint=material(police?'#d5d5cf':'#5e2834',.27,.52);
 for(const x of [-22,24]){const tire=ring(g,x,10,0,10,3,rubber);tire.scale.z=.8;ring(g,x,10,0,6.7,1.2,metal);cylinder(g,x,10,0,2,8,metal).rotation.x=Math.PI/2;}
 box(g,0,16,0,38,5,8,metal);sphere(g,5,27,0,13,7,6,paint);box(g,-12,27,0,22,3,10,rubber);const fork=box(g,22,22,0,3,28,4,metal);fork.rotation.z=.24;box(g,23,34,0,3,3,21,metal);box(g,-5,9,-4,27,3,3,metal);sphere(g,29,28,0,3,4,5,material('#fbe4b0',.25,.2,2));
 if(police){sphere(g,-20,32,4,3,2,3,material('#a53142',.25,.2,1));sphere(g,-20,32,-4,3,2,3,material('#417ba7',.25,.2,1));}return g;}
export function ship(kind='lira'){const g=new T.Group(),friendly=kind==='lira',shell=material(friendly?'#809ca8':'#593d50',.32,.7);
 sphere(g,0,0,0,19,8,9,shell);sphere(g,2,4,5,8,4,4,material(friendly?'#264f63':'#983c46',.2,.4,.3));
 for(const z of [-1,1]){const wing=box(g,-5,-2,z*14,24,2,17,shell);wing.rotation.y=z*.35;box(g,-16,0,z*13,12,5,4,material('#273442',.3,.8));sphere(g,-23,0,z*13,6,2.5,2.5,material(friendly?'#98dae0':'#e69b67',.2,0,3));}
 sphere(g,18,0,0,7,3,4,shell);return g;}
export function collectible(kind='star'){const g=new T.Group();let geom;
 if(kind==='star'){const s=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?2.8:6.4;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();geom=new T.ExtrudeGeometry(s,{depth:2,bevelEnabled:true,bevelSize:.7,bevelThickness:.6,bevelSegments:1,steps:1});mesh(g,geom,material('#dbb76d',.25,.75,.28));}
 else if(kind==='heart'||kind==='life'){const c=kind==='life'?'#b9d5b9':'#c95970';sphere(g,-2.8,2,0,4.2,4.2,2.8,material(c,.3,.2,.25));sphere(g,2.8,2,0,4.2,4.2,2.8,material(c,.3,.2,.25));const b=box(g,0,-2,0,7,7,4,material(c,.3,.2,.25));b.rotation.z=Math.PI/4;}
 else{mesh(g,new T.OctahedronGeometry(6),material('#7ebcc9',.25,.55,.4));}
 return g;}
export function crate(){const g=new T.Group();box(g,0,10,0,23,20,18,'#67513e');for(const x of [-10,10])box(g,x,10,10,2.5,21,2,'#a78a60');for(const y of [1,19])box(g,0,y,10,23,2,2,'#a78a60');const b=box(g,0,10,10,24,2,2,'#9b7c54');b.rotation.z=.62;return g;}
export function barrel(){const g=new T.Group();cylinder(g,0,13,0,9,26,'#514440');for(const y of [2,13,24])cylinder(g,0,y,0,9.5,1.5,silver);return g;}
export function sign(parent,text,x,y,z,width=90,color='#dec18a',height=22){
 const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d');c.fillStyle='#0c131e';c.fillRect(0,0,512,128);c.strokeStyle='#53616b';c.lineWidth=4;c.strokeRect(3,3,506,122);c.fillStyle=color;c.font='600 46px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,66,475);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tx,toneMapped:false}));m.position.set(x,y,z);parent.add(m);return m;
}

export function release(root){const shared=new Set([boxGeo,sphereGeo,cylGeo,coneGeo]);root.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))o.geometry.dispose();});}
// Merge rigid pieces by material while keeping articulated joints independent.
export function batch(group){
 for(const child of [...group.children])if(child.isGroup)batch(child);
 const sets=new Map();
 for(const child of group.children){if(!child.isMesh||child.userData.keep||Array.isArray(child.material)||child.material.map)continue;let list=sets.get(child.material);if(!list){list=[];sets.set(child.material,list);}list.push(child);}
 for(const [mat,list]of sets){if(list.length<2)continue;const positions=[],normals=[],uvs=[];
  for(const child of list){child.updateMatrix();const clone=(child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix);positions.push(...clone.attributes.position.array);normals.push(...clone.attributes.normal.array);if(clone.attributes.uv)uvs.push(...clone.attributes.uv.array);clone.dispose();group.remove(child);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));if(uvs.length===positions.length/3*2)geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));const m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);
 }
 return group;
}
