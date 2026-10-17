import * as T from './vendor/three-r170.module.min.js';
export function worldActors(geometries,materials){
 const shapes={ball:new T.SphereGeometry(1,18,12),cap:new T.CapsuleGeometry(1,1,5,10),cyl:new T.CylinderGeometry(1,1,1,12),ring:new T.TorusGeometry(1,.075,6,24),box:new T.BoxGeometry(1,1,1),core:new T.OctahedronGeometry(1,1)};Object.values(shapes).forEach(g=>geometries.add(g));
 const palette={};function mat(color,glow=0,metal=.3){const key=color+':'+glow+':'+metal;if(!palette[key]){const m=new T.MeshStandardMaterial({color,roughness:.46,metalness:metal,emissive:color,emissiveIntensity:glow});materials.add(m);palette[key]=m;}return palette[key];}
 function put(parent,shape,color,x,y,z,sx=1,sy=sx,sz=sx,glow=0){const m=new T.Mesh(shapes[shape],mat(color,glow));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
 function capsule(parent,color,x,y,z,r,length){return put(parent,'cap',color,x,y,z,r,length/3,r);}
 function humanoid(e,world){
  const root=new T.Group(),body=new T.Group(),head=new T.Group();root.add(body);head.position.y=1.72;body.add(head);
  const robot=e.kind==='robot'||e.bossType==='warMech',diver=world===2,clock=world===4,base=robot?0x394b63:diver?0x194858:clock?0x8f7450:world===5?0x695589:0xc5cbd0,accent=robot?0xff765d:clock?0xffd187:0x73e7ec;
  put(body,'ball',base,0,1.20,0,.32,.45,.23);put(body,'ball',0x172431,0,.80,0,.24,.18,.20);put(body,'ball',accent,0,1.32,.225,.10,.07,.035,.65);
  put(head,'ball',base,0,0,0,.255,.29,.245);put(head,'ball',0x091a2b,0,.025,.16,.235,.175,.13);put(head,'ball',accent,0,.015,.263,.16,.025,.012,.8);
  const seal=put(head,'ring',0x7a8d99,0,-.18,0,.23);seal.rotation.x=Math.PI/2;
  const backpack=put(body,'cap',robot?0x263445:diver?0x8b9b89:0xe0d9cd,0,1.20,-.26,.19,.24,.12);put(backpack,'ball',accent,0,.5,-.8,.25,.18,.1,.5);
  const limbs=[],arms=[];
  for(const side of [-1,1]){
   const arm=new T.Group();arm.position.set(side*.37,1.44,0);body.add(arm);put(arm,'ball',base,0,-.025,0,.16,.16,.16);capsule(arm,base,0,-.19,0,.10,.34);
   const fore=new T.Group();fore.position.y=-.35;arm.add(fore);put(fore,'ball',0x263445,0,0,0,.11,.11,.11);capsule(fore,base,0,-.15,0,.09,.27);put(fore,'ball',robot?0x273b4e:0x9faeb2,0,-.31,.01,.09,.12,.085);
   const leg=new T.Group();leg.position.set(side*.17,.76,0);body.add(leg);capsule(leg,base,0,-.18,0,.13,.38);
   const shin=new T.Group();shin.position.y=-.37;leg.add(shin);put(shin,'ball',robot?accent:0x8999a4,0,0,.02,.14,.14,.13);capsule(shin,base,0,-.15,0,.105,.29);put(shin,'ball',0x26313f,0,-.30,.085,.145,.10,.23);limbs.push({arm,fore,leg,shin});arms.push(arm);
   put(body,'ball',accent,side*.31,1.25,.08,.045,.065,.045,.45);
  }
  if(e.kind==='astronaut'||e.kind==='drone'||e.bossType==='warMech'){const arm=limbs[1].fore;const gun=new T.Group();gun.position.set(0,-.25,.18);arm.add(gun);put(gun,'cap',0x263445,0,0,.12,.09,.18,.09).rotation.x=Math.PI/2;put(gun,'cyl',accent,0,0,.35,.08,.08,.08,.8).rotation.x=Math.PI/2;root.userData.muzzle=gun;}
  if(e.bossType==='warMech'){
   root.scale.setScalar(1.8);for(const side of [-1,1]){const cannon=new T.Group();cannon.position.set(side*.48,1.46,.12);body.add(cannon);put(cannon,'ball',0x28394e,0,0,0,.22,.22,.25);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const barrel=put(cannon,'cyl',0x73859b,Math.sin(a)*.1,Math.cos(a)*.1,.33,.048,.55,.048);barrel.rotation.x=Math.PI/2;}put(cannon,'ball',0xffb96e,0,0,.62,.10,.10,.035,.8);}
  }
  if(clock){const crown=put(head,'ring',0xd8b570,0,.05,-.05,.37);for(let i=0;i<8;i++)put(crown,'ball',0xe5bf73,Math.sin(i*Math.PI/4),Math.cos(i*Math.PI/4),0,.13,.13,.14);}
  root.userData={...root.userData,body,head,limbs,arms,worldShape:'humanoid'};return root;
 }
 function drone(){const root=new T.Group(),body=new T.Group();root.add(body);put(body,'ball',0x263d53,0,1.2,0,.42,.15,.32);const lens=put(body,'ball',0xff536c,0,1.2,.3,.12,.12,.08,.7),rotors=[];
  for(const x of [-1,1])for(const z of [-1,1]){const arm=put(body,'cap',0x738a9d,x*.35,1.22,z*.32,.045,.23,.045);arm.rotation.z=x*Math.PI/2;arm.rotation.y=-z*.7;const g=new T.Group();g.position.set(x*.65,1.25,z*.60);body.add(g);const ring=put(g,'ring',0x4a6e82,0,0,0,.34);ring.rotation.x=Math.PI/2;for(const a of [0,Math.PI/2]){const blade=put(g,'box',0xa7c9cd,0,.02,0,.60,.018,.055);blade.rotation.y=a;}rotors.push(g);}
  root.userData={body,head:body,limbs:[],arms:[],rotors,lens,worldShape:'drone'};return root;
 }
 function octopus(){
  const root=new T.Group(),body=new T.Group();root.add(body);put(body,'ball',0x593a61,0,2.65,-.5,2.25,2.9,2.0);put(body,'ball',0x9c607a,0,1.35,.7,2.4,1.2,2.0);put(body,'ball',0x1e182b,0,.8,2.0,.54,.6,.3);
  for(const side of [-1,1]){put(body,'ball',0xd29a5a,side*1.67,2.65,1.05,.55,.61,.37);put(body,'ball',0x101829,side*1.67,2.65,1.37,.15,.43,.07);put(body,'ball',0xffe5a0,side*1.76,2.84,1.43,.09,.09,.035,.6);}
  const tentacles=[];
  for(let i=0;i<8;i++){
   const shoulder=new T.Group(),angle=i*Math.PI/4;shoulder.position.set(Math.sin(angle)*1.7,.8,Math.cos(angle)*1.7);shoulder.rotation.y=angle;body.add(shoulder);let parent=shoulder;const joints=[];
   for(let j=0;j<7;j++){const g=new T.Group();if(j)g.position.z=.78;parent.add(g);const radius=.43*(1-j*.11);const segment=put(g,'cap',j%2?0x79506c:0x925b77,0,0,.40,radius,.38,radius);segment.rotation.x=Math.PI/2;for(const x of [-1,1])put(g,'ball',0xd4a2a4,x*radius*.5,-radius*.72,.45,.12*(1-j*.09),.07,.12*(1-j*.09));parent=g;joints.push(g);}tentacles.push({root:shoulder,joints});
  }
  root.userData={body,head:body,limbs:[],arms:[],tentacles,worldShape:'octopus'};return root;
 }
 function architect(){const root=new T.Group(),body=new T.Group();root.add(body);put(body,'core',0x6a418d,0,2.0,0,1.35,1.6,1.35);put(body,'ball',0xb6ffff,0,2,.9,.45,.45,.3,1);const orbit=[];for(let i=0;i<6;i++){const g=new T.Group();g.position.y=2;g.rotation.z=i*Math.PI/3;body.add(g);put(g,'core',0x9a7ac0,2.0,0,0,.4,.6,.4);orbit.push(g);}root.userData={body,head:body,limbs:[],arms:[],orbit,worldShape:'architect'};return root;}
 return {create(e,world){const root=e.bossType==='octopus'?octopus():e.bossType==='architect'?architect():e.kind==='drone'?drone():humanoid(e,world);root.name='World-foe-'+e.id;return root;}};
}
export function poseWorldActor(root,e,state){
 const u=root.userData,a=e.worldAction,t=state.time;
 if(u.worldShape==='octopus'){
  u.body.position.y=e.hp<=0?-Math.min(4,(1.2-(e.dead||0))*3):Math.sin(t*1.3)*.12+(e.airLift||0);u.body.rotation.z=e.hp<=0?.18:Math.sin(t*.8)*.025;
  for(const [i,arm]of u.tentacles.entries())for(const [j,g]of arm.joints.entries()){const wind=a&&a.t<a.wind,pulse=a?Math.sin(Math.PI*Math.min(1,Math.max(0,(a.t-a.wind)/a.active))):0;g.rotation.x=Math.sin(t*1.8-i*.7-j*.5)*.18+(j>3?-.10:0)+(wind?-.3:j<3&&a?.kind==='sweep'?.55*pulse:0);g.rotation.y=Math.sin(t*.9+i+j*.3)*.15;g.rotation.z=Math.sin(t*1.4+i*.9-j*.4)*.10;}
  return true;
 }
 if(u.worldShape==='drone'){u.body.position.y=Math.sin(t*3+e.id)*.10;u.body.rotation.z=Math.sin(t*2+e.id)*.08;for(const r of u.rotors)r.rotation.y=t*25;u.lens.material.emissiveIntensity=e.mode==='aim'?1.8:.5;if(e.hp<=0)u.body.rotation.z=1.4;return true;}
 if(u.worldShape==='architect'){u.body.position.y=Math.sin(t*2)*.25+(e.airLift||0);u.body.rotation.y=t*.45;for(const [i,o]of u.orbit.entries()){o.rotation.z=t*.7+i*Math.PI/3;o.rotation.y=t*.4;}return true;}
 if(e.kind==='boss'){
  u.body.position.y=e.airLift||0;u.body.rotation.x=a?.kind==='burst'?.12:0;
  for(const [i,l]of u.limbs.entries()){const stride=e.mode==='chase'?Math.sin(t*8+i*Math.PI)*.45:0;l.leg.rotation.x=e.airLift>0?-.7:stride;l.shin.rotation.x=e.airLift>0?1:.15+Math.max(0,-stride);l.arm.rotation.x=a?.kind==='burst'?-1.4:a?.t<a?.wind?-1.0:-.35;l.fore.rotation.x=-.5;}
  return true;
 }
 return false;
}
