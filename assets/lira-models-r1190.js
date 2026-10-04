import * as T from './vendor/three-r170.module.min.js';
const cache=new Map();
function brightColorR1190(value){const c=new T.Color(value),h={};c.getHSL(h);if(h.l>.006&&h.l<.65)c.setHSL(h.h,Math.min(.85,h.s*1.17),Math.min(.72,h.l*1.16+.006));return c;}
export function material(color,roughness=.66,metalness=.1,emission=0){const key=[color,roughness,metalness,emission].join(':');if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color:brightColorR1190(color),roughness,metalness,emissive:color,emissiveIntensity:emission}));return cache.get(key);}
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
if(lira){const necklace=ring(body,0,46,4.8,3.3,.22,silver);necklace.scale.y=1.2;const med=ring(body,0,40,5.5,2.1,.5,silver);med.scale.y=.62;sphere(body,0,40,5.7,.8,.8,.45,material('#c0ac76',.3,.75));}
if(roman||kind==='riot'){const shield=new T.Group();shield.position.set(-13,38,5);box(shield,0,0,0,11,22,3,suit);box(shield,0,0,1.6,1.4,20,.6,silver);sphere(shield,0,0,2.1,2.5,2.5,1.3,silver);body.add(shield);}
const sword=new T.Group();limbs[1].fore.add(sword);sword.position.set(0,-11,0);sword.rotation.z=-Math.PI/2;
box(sword,0,-4,0,2.1,8,2,boots);box(sword,0,-8,0,9,1.2,2,material('#b59b68',.3,.65));box(sword,0,-26,0,3,34,.75,silver);box(sword,.9,-26,.5,.8,32,.25,material('#b8e7ed',.15,.4,.4));cone(sword,0,-45,0,1.5,5,silver).rotation.z=Math.PI;sword.visible=false;
const stick=new T.Group();limbs[1].fore.add(stick);stick.position.set(0,-11,0);stick.rotation.z=-Math.PI/2;cylinder(stick,0,-25,0,2.2,48,material('#6f472d',.72,.05));cylinder(stick,0,-46,0,2.8,5,material('#38261c',.75,.02));stick.visible=false;
const guitar=new T.Group();guitar.position.set(0,36,-8);guitar.rotation.z=-.45;body.add(guitar);
const red=material('#642e3f',.27,.55);
sphere(guitar,-3,-2,0,5.6,8,2.1,red);sphere(guitar,3,-2,0,5.6,8,2.1,red);sphere(guitar,0,4,0,5.3,5.8,2,red);
box(guitar,0,17,0,2.8,27,1.7,material('#70584b'));box(guitar,0,32,0,4,6,1.9,boots);
box(guitar,0,-4,2.1,5,1.1,.65,silver);box(guitar,0,1,2.1,4,1.6,.5,boots);box(guitar,0,5,2.1,4,1.6,.5,boots);
for(let i=0;i<6;i++)box(guitar,-.85+i*.34,13,2.5,.08,35,.08,silver);
for(let i=0;i<11;i++)box(guitar,0,9+i*1.8,1.1,2.9,.16,.2,silver);
for(const side of [-1,1])for(let i=0;i<3;i++)sphere(guitar,side*2.6,30+i*1.5,0,.8,.55,.65,silver);
guitar.visible=lira;
const guitarFx=new T.Group();body.add(guitarFx);guitarFx.visible=false;
const flashMaterial=new T.MeshBasicMaterial({color:'#ffe2ab',transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
const flash=mesh(guitarFx,new T.SphereGeometry(1,12,8),flashMaterial,0,36,11,1,1,1);flash.castShadow=false;
const wave=ring(guitarFx,0,36,11,1,.028,flashMaterial);wave.castShadow=false;
const rays=[];for(let i=0;i<8;i++){const r=box(guitarFx,0,36,11,.7,1,.7,flashMaterial);r.castShadow=false;rays.push(r);}
guitarFx.traverse(o=>{if(o.isMesh)o.userData.keep=true;});
root.userData={body,head,limbs,sword,stick,guitar,kind,guitarFx,flash,wave,rays,flashMaterial};
if(boss)root.scale.setScalar(1.55);
batch(root);
return root;
}
const down=new T.Vector3(0,-1,0),attackDir=new T.Vector3(),jointQ=new T.Quaternion();
const ikD=new T.Vector3(),ikPole=new T.Vector3(),ikElbow=new T.Vector3(),ikTarget=new T.Vector3(),ikInv=new T.Quaternion();
const smooth=v=>{v=T.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
function handAt(limb,target,side){
const shoulder=limb.arm.position,L1=13,L2=11;
ikD.copy(target).sub(shoulder);const length=T.MathUtils.clamp(ikD.length(),2.1,23.8);ikD.normalize();
const along=(L1*L1-L2*L2+length*length)/(2*length),height=Math.sqrt(Math.max(0,L1*L1-along*along));
ikPole.set(side,-.65,.55).addScaledVector(ikD,-ikPole.dot(ikD)).normalize();
ikElbow.copy(shoulder).addScaledVector(ikD,along).addScaledVector(ikPole,height);
ikTarget.copy(shoulder).addScaledVector(ikD,length);
limb.arm.quaternion.setFromUnitVectors(down,ikElbow.clone().sub(shoulder).normalize());
ikInv.copy(limb.arm.quaternion).invert();
limb.fore.quaternion.setFromUnitVectors(down,ikTarget.sub(ikElbow).applyQuaternion(ikInv).normalize());
}
export function animateCharacter(root,p,time,opts={}){
const d=root.userData,walking=opts.walking??(Math.abs(p.vx||0)+Math.abs(p.vy||0)>8),phase=p.walkPhase||time*9;
const stride=walking?Math.sin(phase)*.53:0,air=(p.z||0)>2||opts.air,face=(p.face??p.dir??1)<0?-1:1;
root.rotation.y=opts.presentationYaw??face*1.12;
d.body.position.set(0,walking?Math.abs(Math.sin(phase))*.9:Math.sin(time*2)*.4,0);
d.body.rotation.set(0,0,0);d.head.rotation.set(0,Math.sin(time*.7)*.035,0);
d.limbs.forEach((a,i)=>{a.arm.rotation.set(i?stride:-stride,0,i?-.1:.1);a.fore.rotation.set(-.18,0,0);a.leg.rotation.set(i?-stride:stride,0,0);a.shin.rotation.set(air?.55:Math.max(0,(i?stride:-stride)*.7),0,0);if(air)a.leg.rotation.x=i?-.75:.45;});
const mount=opts.ride?1:T.MathUtils.clamp(Number(opts.mount)||0,0,1);
if(mount>0){d.limbs.forEach(a=>{a.leg.rotation.x=T.MathUtils.lerp(a.leg.rotation.x,-1.3,mount);a.shin.rotation.x=T.MathUtils.lerp(a.shin.rotation.x,1.4,mount);a.arm.rotation.x=T.MathUtils.lerp(a.arm.rotation.x,-1.08,mount);a.fore.rotation.x=-.36-.60*mount;});d.body.rotation.x=.18*mount;if(mount>.72){const q=smooth((mount-.72)/.28);const lh=new T.Vector3(-8.4,33.4,18.2),rh=new T.Vector3(8.4,33.4,18.2);handAt(d.limbs[0],lh,-1);handAt(d.limbs[1],rh,1);d.body.rotation.x=.22*q;}}
if(opts.retreat&&!p.attack){
const bounce=.5+.5*Math.sin(time*18);d.body.position.z=-2.5-bounce*1.2;d.body.rotation.x=-.10;
d.limbs.forEach((a,i)=>{a.leg.rotation.x=(i?1:-1)*(.18+bounce*.22);a.shin.rotation.x=.22+bounce*.16;a.arm.rotation.x=-.45;a.fore.rotation.x=-.65;});
}
if(opts.dance){
const a=opts.reduced?.28:1,beat=time*3.1,sway=Math.sin(beat),wave=(time%6.4)>3.6;
root.rotation.y=.18+Math.sin(beat*.5)*.18*a;
d.body.position.set(sway*3.3*a,Math.abs(Math.sin(beat))*2.3*a,0);d.body.rotation.z=-sway*.065*a;
d.head.rotation.set(.025*Math.sin(beat),-.10+sway*.06,sway*.06*a);
d.limbs.forEach((l,i)=>{const side=i?1:-1;l.leg.rotation.set(side*sway*.23*a,0,side*.035);l.shin.rotation.x=Math.max(0,side*sway)*.26*a;l.arm.rotation.set(-.28+side*sway*.16*a,0,side*(.25+Math.cos(beat)*.13*a));l.fore.rotation.x=-.65;});
if(wave){const right=d.limbs[1];right.arm.rotation.set(-.16,0,2.35+Math.sin(time*9)*.16*a);right.fore.rotation.set(-.32,0,.22+Math.sin(time*11)*.24*a);}
}
if(opts.look)d.head.rotation.x=-opts.look*.24;
const cue=opts.guitarCue,atk=cue||p.attack,kind=cue?'guitarSuper':(atk?.kind||opts.attack);
const t=atk?T.MathUtils.clamp(atk.t/(atk.duration||1),0,1):.45,q=Math.sin(t*Math.PI),arm=d.limbs[1];
d.sword.visible=!!kind&&/sword/i.test(kind);d.stick.visible=!!kind&&/stick/i.test(kind);d.guitar.position.set(0,36,-8);d.guitar.rotation.set(0,0,-.45);d.guitarFx.visible=false;d.flashMaterial.opacity=0;
if(kind){
if(/kick|sweep/i.test(kind)){
arm.leg.rotation.set(-q*1.53,0,0);arm.shin.rotation.x=.12*q;d.body.rotation.x=-q*.12;
d.limbs.forEach(a=>{a.arm.rotation.x=-.55;a.fore.rotation.x=-.8;});
}else if(/guitar|super/i.test(kind)&&d.kind==='lira'){
const draw=smooth((t-.12)/.30),put=smooth((t-.87)/.13),u=draw*(1-put);
root.rotation.y=face*(1.12-.65*u);
d.guitar.position.set(14*Math.sin(u*Math.PI),36+15*Math.sin(u*Math.PI)-u, -8+18*u);
d.guitar.rotation.set(-.18*Math.sin(u*Math.PI),.25*Math.sin(u*Math.PI),-.45+1.48*u);
d.guitar.updateMatrix();
const leftTarget=new T.Vector3(-.5,19,2.5).applyMatrix4(d.guitar.matrix);
const strum=t>.43&&t<.87?Math.sin((t-.43)*Math.PI*22)*2.4:0;
const rightTarget=new T.Vector3(1,-1+strum,3).lerp(new T.Vector3(0,23,2.5),1-smooth((t-.29)/.17)).applyMatrix4(d.guitar.matrix);
const reach=smooth(t/.12)*(1-put);
leftTarget.lerp(new T.Vector3(-10,23,4),1-reach);rightTarget.lerp(new T.Vector3(10,23,4),1-reach);
handAt(d.limbs[0],leftTarget,-1);handAt(d.limbs[1],rightTarget,1);
d.body.rotation.x=.06*u;d.head.rotation.x=.16*u;
const burst=T.MathUtils.clamp((t-.43)/.22,0,1),glow=t>=.43&&t<=.65?Math.sin(burst*Math.PI):0;
d.guitarFx.visible=glow>0;d.flashMaterial.opacity=glow*(opts.reduced?.25:.68);
d.flash.scale.setScalar((opts.reduced?3:8)*glow);d.wave.scale.setScalar(6+burst*(opts.reduced?13:44));
d.rays.forEach((r,i)=>{const a=i*Math.PI/4;r.position.set(Math.cos(a)*(8+burst*25),36+Math.sin(a)*(8+burst*25),11);r.rotation.z=a-Math.PI/2;r.scale.y=2+glow*7;});
}else if(/sword(Rise|Thrust|Cross)R1237/i.test(kind)){
const cut=smooth((t-.10)/.52),rise=/Rise/.test(kind),thrust=/Thrust/.test(kind);
arm.arm.rotation.set(thrust?-1.45:rise?-.7-1.9*cut:-2.1+1.2*cut,0,thrust?-.12:rise?.3:-.9+1.8*cut);
arm.fore.rotation.set(thrust?-.8+cut*.75:-.18,0,0);
d.limbs[0].arm.rotation.set(-.8,0,.45);d.limbs[0].fore.rotation.x=-.8;
attackDir.set(thrust?0:rise?.15:-.7+1.4*cut,thrust?-.04:rise?-.85+1.7*cut:.7-1.4*cut,thrust?1:.8).normalize();
jointQ.copy(arm.arm.quaternion).multiply(arm.fore.quaternion).invert();attackDir.applyQuaternion(jointQ);d.sword.quaternion.setFromUnitVectors(down,attackDir);
d.body.rotation.x=thrust?-.22*Math.sin(cut*Math.PI):.08*Math.sin(cut*Math.PI);d.body.rotation.y=thrust?0:face*(-.22+.44*cut);
}else if(/swordSideR1203/i.test(kind)){
const wind=smooth(t/.16),cut=smooth((t-.16)/.34),follow=smooth((t-.68)/.32);
arm.arm.rotation.set(-1.05-.18*wind,0,-1.05+2.20*cut-.55*follow);arm.fore.rotation.set(-.28,0,.30-.55*cut);
d.limbs[0].arm.rotation.set(-.72,0,.35);d.limbs[0].fore.rotation.x=-.55;
attackDir.set(T.MathUtils.lerp(-.90,.92,cut),-.10,T.MathUtils.lerp(.25,.75,cut)).normalize();
jointQ.copy(arm.arm.quaternion).multiply(arm.fore.quaternion).invert();attackDir.applyQuaternion(jointQ);
d.sword.quaternion.setFromUnitVectors(down,attackDir);d.body.rotation.y=face*(-.20+.40*cut);d.body.rotation.z=face*(-.08+.16*cut);
}else if(/swordSpinR1203/i.test(kind)){
const cut=smooth(t/.78);root.rotation.y=face*(Math.PI*2*cut);arm.arm.rotation.set(-1.36,0,.64);arm.fore.rotation.set(-.18,0,0);
attackDir.set(.76,-.12,.64).normalize();jointQ.copy(arm.arm.quaternion).multiply(arm.fore.quaternion).invert();attackDir.applyQuaternion(jointQ);d.sword.quaternion.setFromUnitVectors(down,attackDir);d.body.rotation.z=-face*.08*Math.sin(cut*Math.PI*2);
}else if(/stick/i.test(kind)){
const cut=smooth((t-.08)/.62);arm.arm.rotation.set(-1.18,0,-.95+1.90*cut);arm.fore.rotation.set(-.24,0,0);d.limbs[0].arm.rotation.set(-.92,0,.55-.8*cut);d.limbs[0].fore.rotation.x=-.5;
attackDir.set(T.MathUtils.lerp(-.75,.90,cut),-.05,.72).normalize();jointQ.copy(arm.arm.quaternion).multiply(arm.fore.quaternion).invert();attackDir.applyQuaternion(jointQ);d.stick.quaternion.setFromUnitVectors(down,attackDir);d.body.rotation.y=face*(-.16+.32*cut);
}else if(/sword/i.test(kind)){
const wind=smooth(t/.14),cut=smooth((t-.14)/.28),follow=smooth((t-.64)/.36);
const armAngle=T.MathUtils.lerp(-.40-2.25*wind,-1.48,cut)+follow*.85;
arm.arm.rotation.set(armAngle,0,-.06);arm.fore.rotation.set(-.12,0,0);
d.limbs[0].arm.rotation.x=-.65;d.limbs[0].fore.rotation.x=-.9;
attackDir.set(0,T.MathUtils.lerp(.8,-.65,cut)-follow*.2,T.MathUtils.lerp(-.6,1,cut)).normalize();
jointQ.copy(arm.arm.quaternion).multiply(arm.fore.quaternion).invert();attackDir.applyQuaternion(jointQ);
d.sword.quaternion.setFromUnitVectors(down,attackDir);d.body.rotation.x=-.06*wind*(1-cut)+.10*q;
}else{
const striking=/punch2/i.test(kind)?d.limbs[0]:arm;
striking.arm.rotation.set(-1.5*q,0,0);striking.fore.rotation.set(-.18*(1-q),0,0);d.body.rotation.x=.06*q;
}
}
if(p.alive===false||p.dead){
const duration=Math.max(.25,Number(p.deathDuration)||.95);
const fall=Number.isFinite(p.deathTimer)?smooth(1-p.deathTimer/duration):1;
const direction=(p.deathDir??p.face??1)<0?-1:1;
d.body.rotation.x=-direction*face*fall*1.42;d.body.position.y=-fall*14;
d.guitarFx.visible=false;d.sword.visible=false;d.stick.visible=false;
}
root.visible=!((p.invuln||0)>0&&Math.floor(time*15)%3===0);
}
export function dog(){const g=new T.Group();sphere(g,0,16,0,15,8,6,material('#30313a'));sphere(g,14,22,0,7,7,5,material('#252630'));sphere(g,20,20,2,6,3,4,material('#44424a'));for(const x of [-9,9])for(const z of [-4,4])cylinder(g,x,7,z,2,14,'#202530');cone(g,12,31,-3,2.5,8,'#151921');cone(g,16,31,3,2.5,8,'#151921');sphere(g,18,24,4,1,.8,.5,material('#dfae6c',.3,0,1));const tail=cylinder(g,-19,18,0,1.5,16,'#202530');tail.rotation.z=-.8;return g;}
export function motorcycle(police=false){const g=new T.Group(),rubber=material('#0b1017',.88),metal=material('#53626e',.32,.78),paint=material(police?'#d5d5cf':'#5e2834',.27,.52);
for(const x of [-22,24]){const tire=ring(g,x,10,0,10,3,rubber);tire.scale.z=.8;ring(g,x,10,0,6.7,1.2,metal);cylinder(g,x,10,0,2,8,metal).rotation.x=Math.PI/2;}
box(g,0,16,0,38,5,8,metal);sphere(g,4,24,0,7.3,4.3,4.4,paint);box(g,-12,26,0,20,3,9,rubber);const fork=box(g,22,22,0,3,28,4,metal);fork.rotation.z=.24;box(g,20,29,0,2.6,13,3,metal);box(g,12,33,0,20,2.4,3,metal);box(g,2,34,0,3,2.2,18,metal);cylinder(g,2,34,8,1.5,5,rubber).rotation.x=Math.PI/2;cylinder(g,2,34,-8,1.5,5,rubber).rotation.x=Math.PI/2;box(g,-5,9,-4,27,3,3,metal);sphere(g,29,28,0,3,4,5,material('#fbe4b0',.25,.2,2));
if(police){sphere(g,-20,32,4,3,2,3,material('#a53142',.25,.2,1));sphere(g,-20,32,-4,3,2,3,material('#417ba7',.25,.2,1));}return g;}
export function ship(kind='lira'){const g=new T.Group(),friendly=kind==='lira',shell=material(friendly?'#809ca8':'#593d50',.32,.7);
sphere(g,0,0,0,19,8,9,shell);sphere(g,2,4,5,8,4,4,material(friendly?'#264f63':'#983c46',.2,.4,.3));
for(const z of [-1,1]){const wing=box(g,-5,-2,z*14,24,2,17,shell);wing.rotation.y=z*.35;box(g,-16,0,z*13,12,5,4,material('#273442',.3,.8));sphere(g,-23,0,z*13,6,2.5,2.5,material(friendly?'#98dae0':'#e69b67',.2,0,3));}
sphere(g,18,0,0,7,3,4,shell);return g;}
export function collectible(kind='star'){const g=new T.Group();let geom;
if(kind==='ruby'){geom=new T.OctahedronGeometry(6,0);mesh(g,geom,material('#d31643',.18,.72,1.15));const halo=ring(g,0,0,0,8,.35,material('#ff355d',.2,.55,.75));halo.rotation.x=Math.PI/2;}
else if(kind==='star'){const s=new T.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?2.8:6.4;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();geom=new T.ExtrudeGeometry(s,{depth:2,bevelEnabled:true,bevelSize:.7,bevelThickness:.6,bevelSegments:1,steps:1});mesh(g,geom,material('#dbb76d',.25,.75,.28));}
else if(kind==='heart'||kind==='life'){const c=kind==='life'?'#b9d5b9':'#c95970';sphere(g,-2.8,2,0,4.2,4.2,2.8,material(c,.3,.2,.25));sphere(g,2.8,2,0,4.2,4.2,2.8,material(c,.3,.2,.25));const b=box(g,0,-2,0,7,7,4,material(c,.3,.2,.25));b.rotation.z=Math.PI/4;}
else{mesh(g,new T.OctahedronGeometry(6),material('#7ebcc9',.25,.55,.4));}
return g;}
export function crate(){const g=new T.Group();box(g,0,10,0,23,20,18,'#67513e');for(const x of [-10,10])box(g,x,10,10,2.5,21,2,'#a78a60');for(const y of [1,19])box(g,0,y,10,23,2,2,'#a78a60');const b=box(g,0,10,10,24,2,2,'#9b7c54');b.rotation.z=.62;return g;}
export function barrel(){const g=new T.Group();cylinder(g,0,13,0,9,26,'#514440');for(const y of [2,13,24])cylinder(g,0,y,0,9.5,1.5,silver);return g;}
export function sign(parent,text,x,y,z,width=90,color='#dec18a',height=22){
const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d');c.fillStyle='#0c131e';c.fillRect(0,0,512,128);c.strokeStyle='#53616b';c.lineWidth=4;c.strokeRect(3,3,506,122);c.fillStyle=color;c.font='600 46px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,66,475);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tx,toneMapped:false}));m.position.set(x,y,z);parent.add(m);return m;
}
export function release(root){root.userData?.flashMaterial?.dispose();const shared=new Set([boxGeo,sphereGeo,cylGeo,coneGeo]);root.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))o.geometry.dispose();if(o.userData.ownedMaterial)o.material.dispose();});}
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
export function bat(){
const g=new T.Group(),wings=[],hide=material('#794c70',.72,.08),membrane=material('#aa6a86',.66,.08);
sphere(g,0,0,0,4.2,6,3.5,hide);sphere(g,0,5,0,4.6,4,3.6,hide);
for(const side of [-1,1]){
cone(g,side*3,10,0,2,6,hide);sphere(g,side*1.9,5.7,3.2,.9,1,.6,material('#ffca78',.4,0,.8));
const pivot=new T.Group();pivot.position.set(side*3,1,0);g.add(pivot);
const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*6,8);shape.lineTo(side*21,4);shape.lineTo(side*14,-2);shape.lineTo(side*11,-7);shape.lineTo(side*6,-4);shape.lineTo(0,-5);shape.closePath();
mesh(pivot,new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1}),membrane);wings.push(pivot);
}
g.userData.wings=wings;return g;
}
export function animateBat(g,time,dead=false){g.userData.wings.forEach((w,i)=>w.rotation.y=(i?1:-1)*Math.sin(time*17)*.65);g.rotation.z=dead?time*7:Math.sin(time*4)*.10;}
export function abyssOctopus(){
const g=new T.Group(),skin=material('#285566',.42,.18,.12),underside=material('#82bdb7',.55,.04,.08);
sphere(g,0,92,-9,39,51,33,skin);sphere(g,0,54,0,32,24,29,skin);
for(const side of [-1,1]){sphere(g,side*18,70,24,10,9,6,material('#dfb665',.28,.1,.5));sphere(g,side*18,70,29,2.5,7,2,material('#080e17'));}
const arms=[];
for(let i=0;i<8;i++){
const angle=i*Math.PI/4,root=new T.Group();root.position.set(Math.cos(angle)*23,40,Math.sin(angle)*23);g.add(root);
const joints=[];let parent=root;
for(let j=0;j<6;j++){const joint=new T.Group();root.add(joint);const radius=8.5-j*1.22;cylinder(joint,0,-9,0,radius,19,skin);sphere(joint,0,0,0,radius,radius,radius,skin);if(j<5){for(const side of [-1,1])sphere(joint,side*radius*.43,-10,radius*.86,1.6,2.2,1,underside);}joints.push(joint);parent=joint;}
arms.push({root,joints,angle});
}
g.userData.arms=arms;batch(g);return g;
}
export function animateOctopus(g,e,time){
const attack=e.attack?Math.sin(Math.min(1,e.attack.t/(e.attack.duration||.5))*Math.PI):0;
g.rotation.y=.08*Math.sin(time*.8);g.position.y+=Math.sin(time*2)*2;
g.userData.arms.forEach(({root,joints,angle},i)=>{
root.rotation.set(0,0,0);
const point=q=>new T.Vector3(Math.cos(angle)*q*88+Math.sin(time*2.4+i+q*3)*q*9,Math.max(4,40*(1-q)*(1-q)+5*q+Math.sin(time*2+i+q*4)*q*5+(i<3?attack*q*27:0))-40,Math.sin(angle)*q*88+Math.cos(time*2+i+q*4)*q*8);
joints.forEach((j,k)=>{const a=point(k/6),b=point((k+1)/6),delta=b.clone().sub(a);j.position.copy(a);j.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),delta.clone().normalize());j.scale.set(1,delta.length()/18,1);});
});
if(e.alive===false){const f=Math.max(.03,Math.min(1,(e.deathTimer||0)/.7));g.scale.setScalar(f);g.rotation.z=(1-f)*.5;}else g.scale.setScalar(1);
}
export function gripHandlebars(root,bike,attacking=false){
const d=root.userData;root.updateMatrixWorld(true);bike.updateMatrixWorld(true);
d.limbs.forEach((a,i)=>{if(attacking&&i===1)return;const target=bike.localToWorld(new T.Vector3(2,34,i===0?8:-8));d.body.worldToLocal(target);handAt(a,target,i===0?-1:1);});root.updateMatrixWorld(true);
}
