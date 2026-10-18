import {createBat,poseBat} from './weapon-view-r1458.js?v=r1462';
import * as T from './vendor/three-r170.module.min.js';
import {addBlade,poseBlade} from './lyra-blade-r1455.js?v=r1462';
// Metre-scale articulated mesh. Geometry belongs to the scene and is disposed on exit.
export function createLyra({mirror=false}={}){
 const root=new T.Group(),body=new T.Group();root.name=mirror?'Lyra-mirror-red-eyes':'Lyra-unmasked';root.add(body);
 const mat=(color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const skin=mat('#bd9587',.72),lip=mat('#94616a',.82),leather=mat('#151923',.48,.08),denim=mat('#202632',.88),boot=mat('#10141c',.42,.12),hairMat=mat('#1b171f',.88),red=mat('#4a2432',.90),silver=mat('#a9adb8',.3,.7),white=mat('#dfd9ce',.72),iris=mat('#657e77',.5),dark=mat('#17151b',.7);
 const eyeWhite=mirror?mat('#ff172a',.35):white,eyeIris=mirror?mat('#ff051a',.35):iris;if(mirror)for(const m of [eyeWhite,eyeIris]){m.emissive.set('#ff071b');m.emissiveIntensity=2.8;m.toneMapped=false;}
 // Fine material relief, generated once; no downloaded texture dependencies.
 const grain=new Uint8Array(128*128*4);let seed=195;
 for(let i=0;i<128*128;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=115+(seed>>>27);grain.set([value,value,value,255],i*4);}
 const detail=new T.DataTexture(grain,128,128,T.RGBAFormat);detail.wrapS=detail.wrapT=T.RepeatWrapping;detail.repeat.set(6,6);detail.needsUpdate=true;
 skin.bumpMap=detail;skin.bumpScale=.00055;skin.roughness=.68;
 leather.bumpMap=detail;leather.bumpScale=.0016;leather.roughness=.43;
 denim.bumpMap=detail;denim.bumpScale=.0012;
 const ball=new T.SphereGeometry(1,24,18),box=new T.BoxGeometry(1,1,1);
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
  const volume=.087*Math.exp(-Math.pow((Math.abs(x)-.089)/.074,2)-Math.pow((y-1.365)/.078,2))*Math.min(1,front*1.5);
  const neckline=.038*Math.exp(-Math.pow(x/.10,2))*Math.max(0,(y-1.42)/.06)*front;
  tp.setXYZ(i,x,y-neckline,z+volume);
 }top.geometry.computeVertexNormals();
 profile(body,skin,[[.19,1.42],[.195,1.455],[.172,1.485],[.072,1.52]],0,0,-.015,.60);
 for(const side of [-1,1]){
  strand(body,[[side*.15,1.40,.095],[side*.18,1.475,.08],[side*.17,1.50,-.03],[side*.145,1.44,-.115]],.014,leather);
  ell(body,denim,side*.115,.928,-.014,.115,.146,.116);
 }
 profile(body,leather,[[.16,1.005],[.167,1.013],[.163,1.04],[.152,1.045]],0,0,0,.75);
 put(body,box,silver,0,1.025,.123,.045,.036,.009);
 profile(body,skin,[[0,1.47],[.062,1.49],[.053,1.55],[.048,1.60],[.046,1.63],[0,1.64]],0,0,0,.92);
 const head=new T.Group();head.position.set(0,1.715,0);body.add(head);
 // Adult proportions; inset eyes, a small nose bridge and curved lips.
 const faceGeo=new T.SphereGeometry(1,80,64),attr=faceGeo.attributes.position;
 const gauss=(x,y,cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2)-(((y-cy)/wy)**2));
 const colors=[];const baseSkin=new T.Color('#c7a293'),blush=new T.Color('#b57977');
 for(let i=0;i<attr.count;i++){
  const nx=attr.getX(i),ny=attr.getY(i),nz=attr.getZ(i);
  const jaw=ny<-.12?1+(ny+.12)*.30:1;
  let x=nx*.106*jaw,y=ny*.140,z=nz*.103;
  if(nz>0){
   const front=Math.min(1,nz*3);
   // The bridge, cheekbones, eye sockets and chin belong to a single smooth skin surface.
   z+=front*(.013*gauss(x,y,0,-.005,.015,.038)+.016*gauss(x,y,0,-.025,.016,.013)
     +.0045*gauss(Math.abs(x),y,.063,-.026,.034,.035)
     -.006*gauss(Math.abs(x),y,.043,.020,.026,.017)
     +.006*gauss(Math.abs(x),y,.040,.049,.030,.013)
     +.009*gauss(x,y,0,-.093,.036,.022));
  }
  attr.setXYZ(i,x,y,z);
  const c=baseSkin.clone().lerp(blush,nz>0?.12*gauss(Math.abs(x),y,.064,-.036,.030,.021):0);colors.push(c.r,c.g,c.b);
 }
 faceGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));faceGeo.computeVertexNormals();
 const faceSkin=skin.clone();faceSkin.color.set('#ffffff');faceSkin.vertexColors=true;
 put(head,faceGeo,faceSkin,0,0,0);
 
 for(const s of [-1,1]){
  ell(head,skin,s*.105,-.012,-.004,.018,.035,.019);
  ell(head,skin,s*.044,.020,.089,.025,.012,.006);
  ell(head,eyeWhite,s*.044,.020,.094,.018,.0060,.0035).name='Lyra-eye-white-'+s;
  ell(head,eyeIris,s*.044,.020,.100,.0056,.0057,.0022).name='Lyra-eye-iris-'+s;
  ell(head,dark,s*.044,.020,.103,.0028,.0041,.0016);
  ell(head,white,s*.042,.022,.105,.0013,.0013,.0008);
  strand(head,[[s*.018,.048,.098],[s*.043,.052,.100],[s*.071,.046,.084]],.0023,hairMat);
  
 }

 for(const s of [-1,1])ell(head,lip,s*.009,-.025,.114,.004,.002,.004);
 strand(head,[[-.025,-.067,.101],[-.012,-.065,.110],[0,-.067,.113],[.012,-.065,.110],[.025,-.067,.101]],.0024,lip);
 ell(head,lip,0,-.071,.109,.021,.003,.004);
 const vocalMouth=ell(head,dark,0,-.070,.108,.016,.018,.004);vocalMouth.visible=false;
 const hair=new T.Group();head.add(hair);
 hairMat.side=red.side=T.DoubleSide;
 // Layered hair roots, eyelid shadows and subtle cheeks make the face readable at gameplay distance.
 const shadowMat=mat('#775454',.93),upperLid=mat('#302631',.83),cheekMat=mat('#c29a8d',.78);
 for(const side of [-1,1]){

   strand(head,[[side*.027,.024,.103],[side*.045,.027,.104],[side*.062,.024,.098]],.0011,upperLid);
   // Soft orbital shaping comes from the continuous face mesh.
 }
 // Jaw is part of the face mesh: no second chin overlay.


 // A matte continuous scalp and curved back curtain cover every old nape gap.
 // Fine strand relief breaks the plastic dome without adding alpha sorting.
 const hairPixels=new Uint8Array(128*256*4);
 for(let y=0;y<256;y++)for(let x=0;x<128;x++){
  const n=Math.sin(x*1.71+Math.sin(y*.022)*.9)*.5+.5,grain=Math.sin(x*12.91+y*.79)*.5+.5;
  const v=112+Math.round(n*75+grain*13),i=(y*128+x)*4;hairPixels.set([v,v,v,255],i);
 }
 const hairTexture=new T.DataTexture(hairPixels,128,256,T.RGBAFormat);hairTexture.wrapS=hairTexture.wrapT=T.RepeatWrapping;hairTexture.needsUpdate=true;
 hairMat.map=hairTexture;hairMat.bumpMap=hairTexture;hairMat.bumpScale=.0014;red.bumpMap=hairTexture;red.bumpScale=.0010;
 function hairSurface(name,columns,rows,point){
  const positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){positions.push(...point(i/columns,j/rows));uv.push(i/columns*8,j/rows);}
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const k=j*(columns+1)+i;indices.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=put(hair,geometry,hairMat,0,0,0);mesh.name=name;return mesh;
 }
 hairSurface('Lyra-continuous-scalp',72,30,(u,v)=>{
  const a=u*Math.PI*2,limit=1.05+1.23*(1-Math.cos(a))/2+.025*Math.sin(a*7)*Math.max(0,Math.cos(a)),theta=v*limit;
  const ridge=.0015*Math.sin(a*35+theta*2)*Math.sin(theta);
  return [Math.sin(a)*Math.sin(theta)*(.114+ridge),Math.cos(theta)*.151+.003,Math.cos(a)*Math.sin(theta)*(.111+ridge)-.006];
 });
 hairSurface('Lyra-full-back-hair',72,36,(u,t)=>{
  const a=.64+u*(Math.PI*2-1.28),wave=Math.sin(t*6+u*19)*.003*t;
  const spread=Math.sin(Math.min(1,t*2.4)*Math.PI/2),radiusX=.093+.035*spread,radiusZ=.092+.035*spread;
  return [Math.sin(a)*radiusX+wave,.086-t*(.50+.025*Math.sin(u*13)),Math.cos(a)*radiusZ-.010-.012*t];
 });
 for(let i=0;i<30;i++){
  const a=.69+i/29*(Math.PI*2-1.38),x=Math.sin(a)*.115,z=Math.cos(a)*.112-.01;
  const root=[x*.83,.092,z*.83],middle=[x*1.10,-.14,z*1.10-.008],end=[x*1.08+Math.sin(i)*.004,-.40-(i%4)*.009,z*1.14-.018];
  strand(hair,[root,middle,end],i%9===1?.0022:.0012,i%9===1?red:hairMat);
 }
 // Parted front locks follow the head and frame the temples, leaving the forehead open.
 for(const side of [-1,1])for(let i=0;i<6;i++){
  const w=i/5;strand(hair,[[side*.012,.151,-.004],[side*(.030+w*.045),.132,.070],[side*(.073+w*.022),.063,.090],[side*(.095+w*.020),-.10-w*.055,.081]],.0020,i===4?red:hairMat);
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
  const arm=new T.Group();arm.position.set(s*.223,1.455,0);body.add(arm);ell(arm,skin,0,-.012,0,.054,.063,.052);
  profile(arm,skin,[[0,.043],[.045,.03],[.058,-.02],[.048,-.13],[.036,-.27],[.033,-.32],[0,-.346]]);
  const fore=new T.Group();fore.position.y=-.32;arm.add(fore);ell(fore,skin,0,.002,0,.033,.035,.032);
  profile(fore,skin,[[0,.028],[.034,.015],[.039,-.065],[.032,-.17],[.024,-.245],[0,-.267]]);
  profile(fore,boot,[[.025,-.206],[.029,-.214],[.029,-.254],[.025,-.259]]);
  const hand=new T.Group();hand.position.set(0,-.30,0);fore.add(hand);
  ell(hand,skin,0,0,0,.031,.044,.021);ell(hand,boot,0,.014,-.008,.033,.026,.018);
  const fingers=[];for(let j=0;j<4;j++)fingers.push(ell(hand,skin,(j-1.5)*.012,-.032,.01,.007,.023,.009));hand.userData.fingers=fingers;
  ell(hand,skin,-s*.026,.005,.02,.010,.026,.011).rotation.z=s*.4;
  const leg=new T.Group();leg.position.set(s*.113,.94,0);body.add(leg);
  profile(leg,denim,[[0,.051],[.092,.025],[.097,-.07],[.083,-.19],[.055,-.34],[.048,-.42],[0,-.446]],0,0,0,.89);
  const shin=new T.Group();shin.position.y=-.42;leg.add(shin);
  profile(shin,denim,[[0,.029],[.047,.02],[.056,-.07],[.048,-.17],[.035,-.29],[0,-.345]],0,0,0,.90);
  profile(shin,boot,[[0,-.14],[.053,-.145],[.052,-.21],[.043,-.31],[.046,-.385],[0,-.405]],0,0,0,.93);
  const foot=new T.Group();foot.name='Lyra-boot';foot.position.y=-.405;shin.add(foot);
  ell(foot,boot,0,-.023,.045,.052,.065,.106);
  ell(foot,boot,0,-.075,.048,.053,.016,.111);
  for(let j=0;j<4;j++)strand(shin,[[-.024,-.23-j*.04,.044],[.024,-.25-j*.04,.044]],.0025,silver);
  for(const side of [-1,1])strand(leg,[[side*.075,-.03,.035],[side*.069,-.18,.035],[side*.045,-.37,.024]],.0013,boot);
  for(let j=0;j<3;j++)strand(leg,[[-.035,-.29-j*.023,.047],[0,-.285-j*.023,.052],[.035,-.29-j*.023,.047]],.0012,boot);
  limbs.push({arm,fore,hand,leg,shin,foot});
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
 const microphone=new T.Group();microphone.name='Lyra-left-microphone';body.add(microphone);microphone.visible=false;
 put(microphone,new T.CylinderGeometry(.012,.015,.12,16),boot,0,-.015,0);
 ell(microphone,silver,0,.061,0,.026,.034,.026);
 for(let i=0;i<5;i++)put(microphone,new T.TorusGeometry(.024*Math.sin((i+1)/6*Math.PI),.0012,4,16),dark,0,.039+i*.011,0).rotation.x=Math.PI/2;
 const face=new T.Group();face.visible=false;
 root.userData={body,head,hair,face,limbs,guitar,eye,microphone,vocalMouth,kind:'lira',mirrorLyra:mirror};
 addBlade(root.userData);
 createBat(root);return root;
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
export function poseGuitar(root,attack,combo,time,running,weapon=null){
 const u=root.userData,g=u.guitar,active=attack?.kind==='attack',punch=attack?.kind==='punch';
 for(const l of u.limbs){l.hand.scale.setScalar(1);l.foot.scale.setScalar(1);const closed=active||attack?.kind==='slash'||weapon?.selected==='bat'&&!['attack','scream','finish'].includes(attack?.kind)||punch||attack?.kind==='backfist'||attack?.kind==='finish';for(const f of l.hand.userData.fingers){f.position.y=closed?-.021:-.032;f.position.z=closed?.028:.01;f.scale.y=closed?.011:.023;}}
 // Grip pose returns smoothly after both attacks. Body and legs remain free to move.
 const rest=new T.Vector3(.16,1.34,-.19),p=active?T.MathUtils.clamp(attack.t/attack.duration,0,1):0;
 g.position.copy(rest);g.rotation.set(.10,0,-.48);
 u.microphone.visible=attack?.kind==='scream';u.vocalMouth.visible=u.microphone.visible&&attack.t>.27&&attack.t<1.2;
 if(u.microphone.visible){
  const t=attack.t/attack.duration,w=smooth(t/.22)*(1-smooth((t-.80)/.20));
  const grip=new T.Vector3(-.24,.90,.05).lerp(new T.Vector3(-.034,1.60,.23),w);
  u.microphone.position.copy(grip);u.microphone.rotation.set(.20,0,-.15);
  handAt(u.limbs[0],grip,-1);u.head.rotation.x=-.06*w;
 }
 // Relaxed boxing guard; walking still comes from the scene animation.
 if(punch){
  const guard=[new T.Vector3(-.105,1.66,.225),new T.Vector3(.11,1.64,.24)];
  for(let i=0;i<2;i++)handAt(u.limbs[i],guard[i],i?1:-1);
  if(!running){u.body.position.y-=.028;for(const [i,l] of u.limbs.entries()){l.leg.rotation.x-=.15;l.shin.rotation.x+=.29;l.leg.rotation.z=i?-.04:.04;}}
  if(punch){
   const q=T.MathUtils.clamp(attack.t/attack.duration,0,1),upper=attack.upper,side=upper?-1:1,index=upper?0:1;
   const wind=smooth(q/.22),drive=smooth((q-.22)/.32),recover=smooth((q-.57)/.43);
   const start=guard[index],loaded=upper?new T.Vector3(-.19,1.22,.21):new T.Vector3(.14,1.60,.20);
   const end=upper?new T.Vector3(-.04,1.81,.45):new T.Vector3(.055,1.59,.58);
   const goal=start.clone().lerp(loaded,wind).lerp(end,drive).lerp(start,recover);
   const impact=Math.exp(-Math.pow((q-(upper?.50:.50))/.15,2));u.limbs[index].hand.scale.setScalar(1+1.05*impact);
   handAt(u.limbs[index],goal,side);u.body.rotation.y=side*.22*Math.sin(q*Math.PI);u.body.rotation.x=upper?-.045*Math.sin(q*Math.PI):.06*Math.sin(q*Math.PI);
  }
 }
 if(attack?.kind==='backfist'){
  const q=T.MathUtils.clamp(attack.t/attack.duration,0,1),turn=smooth(q/.55),reach=smooth((q-.22)/.26)*(1-smooth((q-.59)/.34));
  u.body.rotation.y=Math.PI*2*turn;u.body.rotation.x=.08*reach;u.body.position.y-=.035*Math.sin(Math.PI*q);
  handAt(u.limbs[0],new T.Vector3(-.12,1.64,.24),-1);
  handAt(u.limbs[1],new T.Vector3(.13-.05*reach,1.61,.23+.36*reach),1);
  u.limbs[1].hand.scale.setScalar(1+1.1*Math.exp(-Math.pow((q-.49)/.14,2)));
  for(const [i,l]of u.limbs.entries()){l.leg.rotation.x+=(i?.10:-.16)*reach;l.shin.rotation.x+=.22*reach;}
 }
 if(attack?.kind==='kick'){
  const t=attack.t/attack.duration,pulse=Math.exp(-Math.pow((t-.63)/.15,2));u.limbs[1].foot.scale.setScalar(1+.78*pulse);u.body.rotation.y=Math.PI*2*smooth(t/.64);
 }
 if(attack?.kind==='finish'){
  const q=attack.t/attack.duration,lift=smooth(q/.32)*(1-smooth((q-.48)/.20)),slam=smooth((q-.45)/.18)*(1-smooth((q-.72)/.28));
  const right=u.limbs[1];right.leg.rotation.set(-1.35*lift,0,.09*lift);right.shin.rotation.x=1.75*lift;
  right.foot.scale.setScalar(1+.65*slam);u.body.position.y+=.10*lift-.11*slam;u.body.rotation.x=.22*slam;u.body.rotation.y=0;
  handAt(u.limbs[0],new T.Vector3(-.17,1.53,.20),-1);handAt(u.limbs[1],new T.Vector3(.16,1.56,.22),1);
 }
 if(active){
  const enter=smooth(p/.18),recover=smooth((p-.83)/.17),weight=enter*(1-recover),turn=smooth((p-.16)/.70);
  g.position.lerp(new T.Vector3(.10,1.25,.36),weight);
  g.rotation.set(.12*weight,0,-.48+(1.48+.48)*weight);
  u.body.rotation.y=Math.PI*4*turn;
  u.body.rotation.x=-.035*weight;u.body.position.y-=.045*weight;
  for(const [i,l]of u.limbs.entries()){
   l.leg.rotation.x+=Math.sin(turn*Math.PI*4+(i?Math.PI:0))*.20*weight;
   l.shin.rotation.x+=.18*weight;
  }
  g.updateMatrix();const right=new T.Vector3(0,.015,.005).applyMatrix4(g.matrix),left=new T.Vector3(0,-.105,.005).applyMatrix4(g.matrix);
  handAt(u.limbs[1],right,1);handAt(u.limbs[0],left,-1);
 }else{
  if(running){g.position.y+=Math.sin(time*15)*.025;if(!attack)u.body.rotation.x=.12;}
  g.updateMatrix(); // both arms remain free while guitar stays attached to the back
 }
 if(weapon?.selected==='bat'){u.blade.visible=false;u.bladeTrace.visible=false;}else poseBlade(root,attack,time,running,handAt);poseBat(root,attack,time,running,weapon,handAt);
}
