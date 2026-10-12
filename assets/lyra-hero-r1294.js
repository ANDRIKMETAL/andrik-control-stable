import * as T from './vendor/three-r170.module.min.js';
// Metre-scale articulated mesh. Geometry belongs to the scene and is disposed on exit.
export function createLyra(){
 const root=new T.Group(),body=new T.Group();root.name='Lyra-unmasked';root.add(body);
 const mat=(color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const skin=mat('#bd9587',.72),lip=mat('#845259',.7),leather=mat('#151923',.48,.08),denim=mat('#202632',.88),boot=mat('#10141c',.42,.12),hairMat=mat('#15111b',.48),red=mat('#652238',.5),silver=mat('#a9adb8',.3,.7),white=mat('#bdb8b1',.6),iris=mat('#657e77',.5),dark=mat('#17151b',.7);
 const ball=new T.SphereGeometry(1,32,24),box=new T.BoxGeometry(1,1,1);
 function put(p,g,m,x,y,z,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 const ell=(p,m,x,y,z,sx,sy=sx,sz=sx)=>put(p,ball,m,x,y,z,sx,sy,sz);
 function profile(p,m,rows,x=0,y=0,z=0,depth=1){const curve=new T.SplineCurve([...rows].sort((a,b)=>a[1]-b[1]).map(([r,h])=>new T.Vector2(r,h)));const g=new T.LatheGeometry(curve.getPoints(40),24);g.computeVertexNormals();return put(p,g,m,x,y,z,1,1,depth);}
 function strand(p,points,r,m){return put(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(q=>new T.Vector3(...q))),20,r,6,false),m,0,0,0);}
 // Continuous tapered waist, abdomen and upper torso instead of stacked blocks.
 profile(body,denim,[[0,.83],[.14,.85],[.215,.94],[.195,1.02],[.145,1.075],[0,1.08]],0,0,0,.72);
 profile(body,skin,[[0,1.015],[.145,1.04],[.138,1.10],[.142,1.17],[.166,1.225],[0,1.23]],0,0,0,.72);
 ell(body,lip,0,1.09,.102,.009,.014,.004);
 // One continuous clothed torso: shaped front, shallow sweetheart neckline.
 const top=profile(body,leather,[[0,1.19],[.155,1.20],[.182,1.29],[.199,1.39],[.198,1.455],[.185,1.48]],0,0,0,.68);
 const tp=top.geometry.attributes.position;
 for(let i=0;i<tp.count;i++){
  const x=tp.getX(i),y=tp.getY(i),z=tp.getZ(i),front=Math.max(0,z/.20);
  const volume=.043*Math.exp(-Math.pow((Math.abs(x)-.083)/.066,2)-Math.pow((y-1.365)/.087,2))*front;
  const neckline=.052*Math.exp(-Math.pow(x/.10,2))*Math.max(0,(y-1.42)/.06)*front;
  tp.setXYZ(i,x,y-neckline,z+volume);
 }top.geometry.computeVertexNormals();
 profile(body,skin,[[.19,1.42],[.195,1.455],[.172,1.485],[.072,1.52]],0,0,-.015,.60);
 for(const side of [-1,1]){
  strand(body,[[side*.15,1.40,.095],[side*.18,1.475,.08],[side*.17,1.50,-.03],[side*.145,1.44,-.115]],.022,leather);
  ell(body,denim,side*.115,.928,-.014,.115,.146,.116);
 }
 profile(body,leather,[[.16,1.005],[.167,1.013],[.163,1.04],[.152,1.045]],0,0,0,.75);
 put(body,box,silver,0,1.025,.123,.045,.036,.009);
 profile(body,skin,[[0,1.47],[.062,1.49],[.053,1.55],[.048,1.60],[.046,1.63],[0,1.64]],0,0,0,.92);
 const head=new T.Group();head.position.set(0,1.735,0);body.add(head);
 // Adult proportions; inset eyes, a small nose bridge and curved lips.
 const faceGeo=ball.clone();const attr=faceGeo.attributes.position;
 for(let i=0;i<attr.count;i++){let x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);const jaw=y<-.15?1+(y+.15)*.27:1;attr.setXYZ(i,x*.112*jaw,y*.146,z*.103+(z>0&&y<-.3?-.009*(-y):0));}
 faceGeo.computeVertexNormals();put(head,faceGeo,skin,0,0,0);
 
 for(const s of [-1,1]){
  ell(head,skin,s*.105,-.012,-.004,.018,.035,.019);
  ell(head,lip,s*.044,.022,.090,.029,.012,.006);
  ell(head,white,s*.044,.020,.096,.022,.007,.004);
  ell(head,iris,s*.044,.020,.100,.007,.007,.003);
  ell(head,dark,s*.044,.020,.103,.004,.006,.002);
  ell(head,white,s*.041,.023,.105,.002,.002,.001);
  strand(head,[[s*.016,.052,.098],[s*.043,.057,.100],[s*.071,.048,.084]],.0038,hairMat);
  
 }
 ell(head,skin,0,.001,.099,.010,.025,.011);
 ell(head,skin,0,-.018,.108,.011,.009,.010);
 for(const s of [-1,1])ell(head,lip,s*.009,-.025,.114,.004,.002,.004);
 strand(head,[[-.028,-.066,.098],[-.013,-.061,.109],[0,-.064,.113],[.013,-.061,.109],[.028,-.066,.098]],.0037,lip);
 ell(head,lip,0,-.071,.107,.023,.004,.006);
 const hair=new T.Group();head.add(hair);
 // Layered hair roots, eyelid shadows and subtle cheeks make the face readable at gameplay distance.
 const shadowMat=mat('#775454',.93),upperLid=mat('#302631',.83),cheekMat=mat('#c29a8d',.78);
 for(const side of [-1,1]){
   ell(head,cheekMat,side*.075,-.032,.056,.035,.027,.019);
   strand(head,[[side*.018,.036,.103],[side*.045,.031,.112],[side*.069,.033,.097]],.0032,upperLid);
   ell(head,shadowMat,side*.054,-.019,.09,.019,.003,.003);
 }
 // Jaw is part of the face mesh: no second chin overlay.

 // Open cap leaves the face uncovered. Thin wavy locks overlap into long hair.
 put(hair,new T.SphereGeometry(1,28,18,0,Math.PI*2,0,Math.PI*.52),hairMat,0,.035,-.008,.117,.124,.111);
 for(let i=0;i<48;i++){
  const a=.48+i/(47)*(Math.PI*2-.96),x=Math.sin(a)*.109,z=Math.cos(a)*.104;
  const end=.41+(i%6)*.022;
  strand(hair,[[x,.05,z],[x*1.12,-.06,z],[x*1.15+Math.sin(i)*.008,-.21,z-.008],[x*1.24,-end*.78,z-.018],[x*1.13,-end,z-.035]],.0055+(i%3)*.0015,i%7===1?red:hairMat);
 }
 for(const s of [-1,1])strand(hair,[[s*.022,.139,.006],[s*.077,.106,.073],[s*.104,.037,.074],[s*.114,-.09,.07],[s*.123,-.25,.04]],.019,hairMat);
 // Fine tapered fringe, keeping eyes and cheeks visible.
 for(let i=0;i<16;i++){
  const side=i<8?-1:1,t=(i%8)/7;
  strand(hair,[[side*.012,.145,-.005],[side*(.025+t*.055),.112,.082],[side*(.022+t*.081),.061,.100],[side*(.020+t*.098),.038-t*.055,.096]],.0035,i%6===0?red:hairMat);
 }
 // Cord lies on the neckline; the eye pendant hangs from it, not from a large hoop.
 strand(body,[[-.054,1.585,.022],[-.082,1.50,.09],[-.056,1.459,.142],[0,1.435,.163],[.056,1.459,.142],[.082,1.50,.09],[.054,1.585,.022]],.0035,dark);
 const eye=new T.Group();eye.name='eye-pendant-on-cord';eye.position.set(0,1.405,.166);eye.scale.setScalar(1.28);body.add(eye);
 strand(eye,[[-.032,0,0],[0,.017,0],[.032,0,0],[0,-.017,0],[-.032,0,0]],.003,silver);
 ell(eye,white,0,0,0,.025,.012,.004);ell(eye,mat('#a38b52',.3,.3),0,0,.006,.011,.011,.005);ell(eye,dark,0,0,.011,.004,.007,.002);
 for(let i=0;i<9;i++){
  const x=(i-4)*.007;
  strand(eye,[[x,-.016,0],[x*1.12,-.023-Math.abs(x)*.10,0]],.0015,silver);
 }
 ell(eye,white,-.004,.004,.015,.003,.003,.001);
 // Corset seams, belt loops and asymmetrical gear detail without heavy textures.
 for(const side of [-1,1]){
   strand(body,[[side*.165,1.47,.075],[side*.164,1.36,.126],[side*.153,1.21,.089]],.0045,silver);
   put(body,box,boot,side*.118,1.022,.128,.034,.042,.012);
 }
 strand(body,[[-.08,1.12,.112],[0,1.105,.138],[.08,1.12,.112]],.0025,shadowMat);
 const limbs=[];
 for(const s of [-1,1]){
  const arm=new T.Group();arm.position.set(s*.223,1.455,0);body.add(arm);
  profile(arm,skin,[[0,.043],[.045,.03],[.058,-.02],[.048,-.13],[.036,-.27],[.033,-.32],[0,-.346]]);
  const fore=new T.Group();fore.position.y=-.32;arm.add(fore);
  profile(fore,skin,[[0,.028],[.034,.015],[.039,-.065],[.032,-.17],[.024,-.245],[0,-.267]]);
  profile(fore,boot,[[.025,-.206],[.029,-.214],[.029,-.254],[.025,-.259]]);
  const hand=new T.Group();hand.position.set(0,-.30,0);fore.add(hand);
  ell(hand,skin,0,0,0,.031,.047,.021);
  for(let j=0;j<4;j++)ell(hand,skin,(j-1.5)*.012,-.032,.01,.007,.023,.009);
  ell(hand,skin,-s*.026,.005,.02,.010,.026,.011).rotation.z=s*.4;
  const leg=new T.Group();leg.position.set(s*.113,.94,0);body.add(leg);
  profile(leg,denim,[[0,.051],[.092,.025],[.097,-.07],[.083,-.19],[.055,-.34],[.048,-.42],[0,-.446]],0,0,0,.89);
  const shin=new T.Group();shin.position.y=-.42;leg.add(shin);
  profile(shin,denim,[[0,.029],[.047,.02],[.056,-.07],[.048,-.17],[.035,-.29],[0,-.345]],0,0,0,.90);
  profile(shin,boot,[[0,-.14],[.053,-.145],[.052,-.21],[.043,-.31],[.046,-.385],[0,-.405]],0,0,0,.93);
  ell(shin,boot,0,-.428,.045,.052,.065,.106);
  ell(shin,boot,0,-.480,.048,.053,.016,.111);
  for(let j=0;j<4;j++)strand(shin,[[-.024,-.23-j*.04,.044],[.024,-.25-j*.04,.044]],.0025,silver);
  limbs.push({arm,fore,hand,leg,shin});
 }
 // Shoulder strap secures the guitar while both hands are free for punches.
 const strap=mat('#281b23',.54,.08);
 strand(body,[[-.17,1.47,-.055],[-.13,1.52,-.10],[.12,1.30,-.19],[.17,1.17,-.12]],.017,strap);
 const guitar=new T.Group();guitar.name='guitar-neck-grip';body.add(guitar);
 const paint=mat('#551e32',.28,.35);
 ell(guitar,paint,-.066,-.47,0,.102,.14,.034);ell(guitar,paint,.066,-.47,0,.102,.14,.034);ell(guitar,paint,0,-.355,0,.10,.095,.033);
 put(guitar,box,mat('#54443e'),0,-.10,0,.044,.52,.024);put(guitar,box,boot,0,.18,0,.065,.11,.027);
 for(let j=0;j<11;j++)put(guitar,box,silver,0,-.32+j*.041,.014,.045,.003,.004);
 for(let j=0;j<6;j++)put(guitar,box,silver,(j-2.5)*.005,-.19,.036,.001,.72,.001);
 for(const y of [-.41,-.49])put(guitar,box,boot,0,y,.038,.084,.018,.010);
 for(const s of [-1,1])for(let j=0;j<3;j++)ell(guitar,silver,s*.04,.145+j*.028,0,.013,.006,.01);
 const face=new T.Group();face.visible=false;
 root.userData={body,head,hair,face,limbs,guitar,eye,kind:'lira'};
 return root;
}
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const down=new T.Vector3(0,-1,0);
function handAt(limb,target,side){
 const start=limb.arm.position,L1=.32,L2=.30,d=target.clone().sub(start),len=T.MathUtils.clamp(d.length(),.035,L1+L2-.001);d.normalize();
 const along=(L1*L1-L2*L2+len*len)/(2*len),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 const pole=new T.Vector3(side,-.5,-.25);pole.addScaledVector(d,-pole.dot(d)).normalize();
 const elbow=start.clone().addScaledVector(d,along).addScaledVector(pole,height),end=start.clone().addScaledVector(d,len);
 limb.arm.quaternion.setFromUnitVectors(down,elbow.clone().sub(start).normalize());
 const inverse=limb.arm.quaternion.clone().invert();limb.fore.quaternion.setFromUnitVectors(down,end.sub(elbow).applyQuaternion(inverse).normalize());
}
export function poseGuitar(root,attack,combo,time,running){
 const u=root.userData,g=u.guitar,active=attack?.kind==='attack',punch=attack?.kind==='punch';
 // Grip pose returns smoothly after both attacks. Body and legs remain free to move.
 const rest=new T.Vector3(.16,1.34,-.19),p=active?T.MathUtils.clamp(attack.t/attack.duration,0,1):0;
 g.position.copy(rest);g.rotation.set(.10,0,-.48);
 // Relaxed boxing guard; walking still comes from the scene animation.
 if(!active&&(!attack||punch)){
  const guard=[new T.Vector3(-.105,1.66,.225),new T.Vector3(.11,1.64,.24)];
  for(let i=0;i<2;i++)handAt(u.limbs[i],guard[i],i?1:-1);
  if(!running){u.body.position.y-=.028;for(const [i,l] of u.limbs.entries()){l.leg.rotation.x-=.15;l.shin.rotation.x+=.29;l.leg.rotation.z=i?-.04:.04;}}
  if(punch){
   const q=T.MathUtils.clamp(attack.t/attack.duration,0,1),upper=attack.upper,side=upper?-1:1,index=upper?0:1;
   const wind=smooth(q/.22),drive=smooth((q-.22)/.32),recover=smooth((q-.57)/.43);
   const start=guard[index],loaded=upper?new T.Vector3(-.19,1.22,.21):new T.Vector3(.14,1.60,.20);
   const end=upper?new T.Vector3(-.04,1.81,.45):new T.Vector3(.055,1.59,.58);
   const goal=start.clone().lerp(loaded,wind).lerp(end,drive).lerp(start,recover);
   handAt(u.limbs[index],goal,side);u.body.rotation.y=side*.22*Math.sin(q*Math.PI);u.body.rotation.x=upper?-.045*Math.sin(q*Math.PI):.06*Math.sin(q*Math.PI);
  }
 }
 if(active){
  const enter=smooth(p/.22),swing=smooth((p-.28)/.36),recover=smooth((p-.73)/.27),weight=enter*(1-recover);
  if(combo===0){
   g.position.lerp(new T.Vector3(.16-.32*swing,1.64-.49*swing,.24+.12*Math.sin(swing*Math.PI)),weight);
   g.rotation.set((2.35-3.20*swing)*weight,.18*weight,(-.28+.56*swing)*weight);
   u.body.rotation.y=(-.28+.56*swing)*weight;u.body.rotation.x=.10*weight*swing;
  }else if(combo===2){
   g.position.lerp(new T.Vector3(.04,1.02+.62*swing,.33),weight);
   g.rotation.set((-.45+2.4*swing)*weight,.16*weight,(-.6+.3*swing)*weight);
   u.body.rotation.x=-.18*weight;
  }else{
   g.position.lerp(new T.Vector3(.34-.44*swing,1.35-.18*swing,.27+.12*Math.sin(swing*Math.PI)),weight);
   g.rotation.set((1.0-2.1*swing)*weight,(-.8+1.6*swing)*weight,(-1.1+2.0*swing)*weight);
   u.body.rotation.y=(-.38+.8*swing)*weight;
  }
  g.updateMatrix();
  const right=new T.Vector3(0,0,0).applyMatrix4(g.matrix);handAt(u.limbs[1],right,1);
  if(true){const left=new T.Vector3(0,-.105,.005).applyMatrix4(g.matrix);left.lerp(new T.Vector3(-.25,.86,.08),1-weight);handAt(u.limbs[0],left,-1);}
  else {u.limbs[0].arm.rotation.set(-.55,0,-.55*weight);u.limbs[0].fore.rotation.x=-.75;}
 }else{
  if(running){g.position.y+=Math.sin(time*15)*.025;if(!attack)u.body.rotation.x=.12;}
  g.updateMatrix(); // both arms remain free while guitar stays attached to the back
 }
}
