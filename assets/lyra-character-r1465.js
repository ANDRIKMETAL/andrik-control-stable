import * as T from './vendor/three-r170.module.min.js';
import {addBlade} from './lyra-blade-r1455.js?v=r1467';
import {createBat} from './weapon-view-r1458.js?v=r1467';

const clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const gauss=(x,y,cx,cy,wx,wy)=>Math.exp(-(((x-cx)/wx)**2+((y-cy)/wy)**2));

// Monotone interpolation keeps anatomical sections smooth without the overshoot
// of an unconstrained lathe spline. Rows are [height, half-width, front, back].
function section(rows,y){
 let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;
 const a=rows[i],b=rows[i+1],h=b[0]-a[0],t=clamp((y-a[0])/h,0,1),out=[y];
 for(let k=1;k<a.length;k++){
  const slope=(b[k]-a[k])/h;
  const tangent=j=>{
   if(j===0)return (rows[1][k]-rows[0][k])/(rows[1][0]-rows[0][0]);
   if(j===rows.length-1)return (rows[j][k]-rows[j-1][k])/(rows[j][0]-rows[j-1][0]);
   const left=(rows[j][k]-rows[j-1][k])/(rows[j][0]-rows[j-1][0]);
   const right=(rows[j+1][k]-rows[j][k])/(rows[j+1][0]-rows[j][0]);
   return left*right<=0?0:2*left*right/(left+right);
  };
  const limit=m=>slope===0?0:Math.sign(slope)*Math.min(Math.abs(m),Math.abs(slope)*3);
  const ma=limit(tangent(i)),mb=limit(tangent(i+1));
  out.push((2*t*t*t-3*t*t+1)*a[k]+(t*t*t-2*t*t+t)*h*ma+(-2*t*t*t+3*t*t)*b[k]+(t*t*t-t*t)*h*mb);
 }return out;
}
function surface(columns,rows,point){
 const p=[],uv=[],idx=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){p.push(...point(i/columns,j/rows));uv.push(i/columns,j/rows);}
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const k=j*(columns+1)+i;idx.push(k,k+1,k+columns+1,k+1,k+columns+2,k+columns+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function loft(rows,columns=36,levels=40,deform=null){
 return surface(columns,levels,(u,v)=>{const y=rows[0][0]+v*(rows.at(-1)[0]-rows[0][0]),q=section(rows,y),a=u*Math.PI*2,c=Math.cos(a),p=[Math.sin(a)*q[1],y,c*(c>=0?q[2]:q[3])];return deform?deform(p,a,v):p;});
}

export function createCharacter({mirror=false}={}){
 const root=new T.Group(),body=new T.Group();root.name=mirror?'Lyra-mirror-red-eyes':'Lyra-unmasked';root.add(body);
 const mat=(name,color,roughness=.65,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness});m.name=name;return m;};
 const skin=mat('Lyra-skin','#c7a08d',.68),lip=mat('Lyra-lips','#884f59',.62),leather=mat('Lyra-jacket-leather','#151a20',.49,.05),inner=mat('Lyra-corset','#11161e',.76),denim=mat('Lyra-denim','#1d2530',.93),boot=mat('Lyra-boots','#10151c',.48,.06),sole=mat('Lyra-boot-sole','#161b23',.92),hairMat=mat('Lyra-black-hair','#17131a',.64),red=mat('Lyra-burgundy-locks','#542334',.68),silver=mat('Lyra-brushed-metal','#9ba8ae',.35,.78),white=mat('Lyra-eye-white','#d2d1c8',.39),iris=mat('Lyra-iris','#647e76',.34),dark=mat('Lyra-shadow','#201820',.85),brow=mat('Lyra-eyebrow','#2a1c22',.90);
 const eyeWhite=mirror?mat('Lyra-mirror-eye-white','#ff172a',.35):white,eyeIris=mirror?mat('Lyra-mirror-iris','#ff051a',.35):iris;
 if(mirror)for(const m of [eyeWhite,eyeIris]){m.emissive.set('#ff071b');m.emissiveIntensity=2.8;m.toneMapped=false;}
 // Small deterministic textures, unique to this actor and owned by its scene.
 const texture=(w,h,pixel)=>{const a=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=pixel(x,y);a.set([c,c,c,255],(y*w+x)*4);}const t=new T.DataTexture(a,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;return t;};
 let seed=1465;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>16)/65535;};
 const skinDetail=texture(64,64,()=>118+Math.round(noise()*22));skinDetail.repeat.set(7,7);skin.bumpMap=skinDetail;skin.bumpScale=.00022;
 const leatherDetail=texture(64,64,(x,y)=>117+Math.round(noise()*18+7*Math.sin(x*1.7+Math.sin(y*.9))));leatherDetail.repeat.set(5,5);leather.bumpMap=boot.bumpMap=leatherDetail;leather.bumpScale=.00065;boot.bumpScale=.00045;
 const weave=texture(64,64,(x,y)=>118+(x%3===0?12:0)+(y%3===0?7:0)+Math.round(noise()*8));weave.repeat.set(9,9);denim.bumpMap=inner.bumpMap=weave;denim.bumpScale=.00065;inner.bumpScale=.00035;
 const hairTexture=texture(128,256,(x,y)=>103+Math.round(24*Math.sin(x*1.92+Math.sin(y*.018)*.7)+16*Math.sin(x*9.7+y*.025)+noise()*8));hairTexture.repeat.set(7,1);hairMat.map=red.map=hairTexture;hairMat.bumpMap=red.bumpMap=hairTexture;hairMat.bumpScale=red.bumpScale=.00075;hairMat.side=red.side=T.DoubleSide;
 const ball=new T.SphereGeometry(1,20,14),box=new T.BoxGeometry(1,1,1);
 const put=(parent,g,m,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,name='')=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const ell=(p,m,x,y,z,sx,sy=sx,sz=sx,name='')=>put(p,ball,m,x,y,z,sx,sy,sz,name);
 const curve=(p,points,r,m,name='')=>put(p,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(q=>new T.Vector3(...q))),Math.max(8,points.length*4),r,5,false),m,0,0,0,1,1,1,name);
 const torso=(name,m,rows,deform=null)=>put(body,loft(rows,36,Math.max(6,Math.ceil((rows.at(-1)[0]-rows[0][0])/.008)),deform),m,0,0,0,1,1,1,name);
 // Realistic adult silhouette: a single pelvis, no separate spherical hips.
 torso('Lyra-abdomen',skin,[[1.025,.152,.092,.097],[1.08,.144,.094,.094],[1.14,.146,.099,.096],[1.20,.161,.105,.100],[1.24,.170,.107,.102]],(p,a)=>{if(Math.cos(a)>0)p[2]-=.004*gauss(p[0],p[1],0,1.087,.018,.024);return p;});
 torso('Lyra-fitted-corset',inner,[[1.19,.160,.108,.103],[1.24,.164,.111,.108],[1.31,.175,.116,.112],[1.38,.179,.119,.111],[1.438,.164,.109,.102]],(p,a)=>{const front=Math.max(0,Math.cos(a));p[2]+=.031*gauss(Math.abs(p[0]),p[1],.078,1.365,.065,.061)*front;p[1]-=.019*Math.exp(-Math.pow(p[0]/.082,2))*smooth((p[1]-1.40)/.038)*front;return p;});
 torso('Lyra-clavicle-and-shoulders',skin,[[1.403,.178,.104,.102],[1.452,.194,.096,.097],[1.476,.171,.080,.082],[1.505,.067,.055,.054]],(p,a)=>{if(Math.cos(a)>0)p[2]-=.004*gauss(Math.abs(p[0]),p[1],.105,1.473,.050,.012);return p;});
 torso('Lyra-neck',skin,[[1.48,.062,.050,.051],[1.515,.046,.042,.044],[1.565,.041,.040,.045],[1.605,.045,.044,.049]],p=>{p[2]-=.022;return p;});
 // Open, fitted motorcycle jacket. Its opening follows the torso rather than
 // placing a flat rectangle across the chest. The sleeves are skinned below.
 const jacketRows=[[1.095,.153,.105,.108],[1.15,.159,.115,.118],[1.24,.178,.130,.128],[1.34,.195,.148,.133],[1.415,.199,.129,.126],[1.472,.202,.101,.109],[1.492,.166,.077,.085]];
 const jacket=surface(48,44,(u,v)=>{const y=1.095+v*.397,q=section(jacketRows,y),gap=.26+.79*smooth((y-1.28)/.21),a=gap+u*(Math.PI*2-2*gap),c=Math.cos(a);return [Math.sin(a)*q[1],y,c*(c>=0?q[2]:q[3])];});
 put(body,jacket,leather,0,0,0,1,1,1,'Lyra-fitted-leather-jacket');leather.side=T.DoubleSide;
 for(const s of [-1,1]){
  const lapel=surface(5,10,(u,v)=>{const y=1.29+v*.202,x=s*(.064+.075*v+u*(.042-.017*v)),z=.148-.061*v+.011*Math.sin(u*Math.PI);return [x,y,z];});
  put(body,lapel,leather,0,0,0,1,1,1,'Lyra-folded-lapel-'+s);
  curve(body,[[s*.047,1.105,.103],[s*.054,1.22,.126],[s*.066,1.31,.153],[s*.119,1.438,.115]],.0016,silver);
  curve(body,[[s*.176,1.445,-.055],[s*.182,1.33,-.117],[s*.158,1.12,-.093]],.0011,inner);
  curve(body,[[s*.077,1.185,.121],[s*.144,1.22,.121]],.0016,silver);
  ell(body,silver,s*.133,1.444,.124,.004,.004,.002);
 }
 torso('Lyra-jacket-waist-hem',leather,[[1.090,.153,.105,.108],[1.104,.155,.107,.109]]);
 // A slim belt and sewn fly replace the square belt blocks from the old model.
 torso('Lyra-belt',boot,[[1.029,.159,.098,.104],[1.051,.149,.095,.101]]);
 put(body,box,silver,0,1.039,.102,.030,.023,.006);
 curve(body,[[0,1.016,.103],[0,.938,.110],[.013,.908,.106]],.0011,boot);
 for(const s of [-1,1]){curve(body,[[s*.126,1.019,.087],[s*.136,.983,.088],[s*.164,.968,.076]],.0011,boot);put(body,box,boot,s*.113,1.041,.085,.012,.033,.009);}

 const head=new T.Group();head.name='Lyra-head-r1465';head.position.set(0,1.691,0);body.add(head);
 const faceGeo=new T.SphereGeometry(1,72,56),pa=faceGeo.attributes.position,colors=[];
 const baseSkin=new T.Color('#c9a28f'),cheek=new T.Color('#b77c79'),eyeShade=new T.Color('#8e7b80');
 for(let i=0;i<pa.count;i++){
  const nx=pa.getX(i),ny=pa.getY(i),nz=pa.getZ(i),jaw=ny<-.12?1+(ny+.12)*.39:1;
  let x=nx*.094*jaw,y=ny*.128,z=nz*(nz>0?.090:.095)-.004;
  if(nz>0){const f=Math.min(1,nz*3);z+=f*(.013*gauss(x,y,0,.002,.014,.038)+.023*gauss(x,y,0,-.027,.015,.013)+.0045*gauss(Math.abs(x),y,.058,-.020,.028,.026)-.002*gauss(Math.abs(x),y,.038,.019,.022,.015)+.004*gauss(Math.abs(x),y,.035,.044,.030,.013)+.010*gauss(x,y,0,-.083,.035,.020)+.006*gauss(x,y,0,-.057,.031,.018));}
  pa.setXYZ(i,x,y,z);
  const c=baseSkin.clone().lerp(cheek,nz>0?.20*gauss(Math.abs(x),y,.057,-.029,.027,.018):0).lerp(eyeShade,nz>0?.15*gauss(Math.abs(x),y,.038,.015,.023,.014):0);colors.push(c.r,c.g,c.b);
 }
 faceGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));faceGeo.computeVertexNormals();const faceSkin=skin.clone();faceSkin.name='Lyra-face-skin';faceSkin.color.set('#ffffff');faceSkin.vertexColors=true;
 put(head,faceGeo,faceSkin,0,0,0,1,1,1,'Lyra-anatomical-face');
 const lid=mat('Lyra-eyelid','#aa847b',.74),crease=mat('Lyra-mouth-crease','#5a343e',.83);
 for(const s of [-1,1]){
  ell(head,skin,s*.098,-.009,-.009,.013,.027,.015);
  curve(head,[[s*.103,.009,-.001],[s*.110,-.002,.002],[s*.108,-.022,.001]],.002,lip);
  ell(head,eyeWhite,s*.0385,.018,.0790,.0163,.0064,.0047,'Lyra-eye-white-'+s);
  ell(head,eyeIris,s*.0385,.018,.0840,.0056,.0058,.0017,'Lyra-eye-iris-'+s);
  ell(head,dark,s*.0385,.018,.0858,.0026,.0037,.0008);
  ell(head,white,s*.037,.020,.0868,.0013,.0013,.0006);
  curve(head,[[s*.0225,.017,.0815],[s*.031,.024,.085],[s*.043,.025,.084],[s*.0545,.019,.078]],.0022,lid);
  curve(head,[[s*.023,.018,.082],[s*.032,.023,.086],[s*.043,.024,.085],[s*.054,.019,.079]],.00065,dark);
  curve(head,[[s*.0225,.017,.0815],[s*.036,.012,.084],[s*.048,.014,.080],[s*.0545,.019,.078]],.0014,lid);
  curve(head,[[s*.020,.041,.092],[s*.037,.046,.092],[s*.060,.040,.079]],.0021,brow);
  ell(head,crease,s*.0078,-.031,.109,.0024,.0013,.0013);
 }
 // Shaped upper and lower lips: shallow cupid's bow, no painted mouth ring.
 for(const upper of [true,false]){
  const g=surface(24,5,(u,v)=>{const x=(u-.5)*.041,a=Math.abs(x)/.0205,w=Math.sqrt(Math.max(0,1-a*a)),seam=-.058-.0012*Math.cos(a*Math.PI),edge=upper?seam+w*(.0032+.0016*Math.sin(a*Math.PI*2)):seam-w*.0044;return [x,seam+(edge-seam)*v,.0885+.0088*w+.0022*Math.sin(v*Math.PI)*w];});
  if(!upper){const ix=g.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.computeVertexNormals();}
  put(head,g,lip,0,0,0,1,1,1,upper?'Lyra-upper-lip':'Lyra-lower-lip');
 }
 curve(head,[[-.0205,-.059,.089],[0,-.059,.098],[.0205,-.059,.089]],.00055,crease);
 const vocalMouth=ell(head,dark,0,-.061,.098,.013,.014,.002);vocalMouth.visible=false;

 const hair=new T.Group(),lengths=new T.Group();hair.name='Lyra-hair';head.add(hair);hair.add(lengths);
 const hairSurface=(parent,name,cols,rows,point,m=hairMat)=>put(parent,surface(cols,rows,point),m,0,0,0,1,1,1,name);
 hairSurface(hair,'Lyra-continuous-scalp',56,28,(u,v)=>{const a=u*Math.PI*2,limit=1.20+1.25*(1-Math.cos(a))/2,theta=v*limit,ridge=.0011*Math.sin(a*27+theta*2)*Math.sin(theta),part=.003*Math.exp(-Math.pow((Math.sin(a)*Math.sin(theta)+.17)/.085,2));return [Math.sin(a)*Math.sin(theta)*(.105+ridge),Math.cos(theta)*.134+.004-part,Math.cos(a)*Math.sin(theta)*(.100+ridge)-.008];});
 hairSurface(lengths,'Lyra-full-back-hair',56,32,(u,t)=>{const a=.66+u*(Math.PI*2-1.32),spread=Math.sin(Math.min(1,t*2.2)*Math.PI/2),wave=Math.sin(t*6+u*27)*.0022*t;return [Math.sin(a)*(.093+.024*spread)+wave,.072-t*(.49+.015*Math.sin(u*29)),Math.cos(a)*(.088+.025*spread)-.015-.015*t];});
 // Curved ribbons follow a side part; varied tips and shallow strand relief
 // avoid both a helmet rim and hundreds of alpha-blended hair cards.
 for(const s of [-1,1])for(let i=0;i<9;i++){
  const w=i/8,m=i===6?red:hairMat;
  hairSurface(lengths,'Lyra-face-framing-lock-'+s+'-'+i,3,22,(u,t)=>{const a=s*(.02+.09*smooth(t/.45)+w*.008),y=.130-t*(.34+w*.11),z=t<.35?.016+.080*Math.sin(t/.35*Math.PI/2):.096-.035*smooth((t-.35)/.65),width=.007*(1-.72*t);return [a+(u-.5)*width+Math.sin(t*6+i)*.002*t,y,z];},m);
 }
 for(let i=0;i<12;i++){
  const a=.77+i/11*(Math.PI*2-1.54);
  hairSurface(lengths,'Lyra-back-lock-'+i,2,18,(u,t)=>{const radius=.098+.023*Math.sin(Math.min(1,t*2)*Math.PI/2);return [Math.sin(a+(u-.5)*.075)*radius+Math.sin(t*7+i)*.002*t,.07-t*(.50+(i%3)*.009),Math.cos(a+(u-.5)*.075)*radius-.017-.016*t];},i%7===2?red:hairMat);
 }
 // Eye medallion stays visible inside the open collar.
 curve(body,[[-.042,1.572,.035],[-.064,1.499,.078],[0,1.405,.148],[.064,1.499,.078],[.042,1.572,.035]],.0023,dark);
 const eye=new T.Group();eye.name='eye-pendant-on-cord';eye.position.set(0,1.401,.151);body.add(eye);
 curve(eye,[[-.025,0,0],[0,.012,0],[.025,0,0],[0,-.012,0],[-.025,0,0]],.0022,silver);
 ell(eye,white,0,0,0,.019,.008,.003);ell(eye,mat('Lyra-medallion-iris','#b09856',.38,.35),0,0,.004,.0075,.0075,.003);ell(eye,dark,0,0,.007,.0027,.005,.0015);

 const limbs=[],skeletons=[],pelvis=new T.Bone();pelvis.name='Lyra-pelvis';body.add(pelvis);
 const skinned=(name,geometry,material,bones,weights)=>{
  const si=[],sw=[],p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const w=weights(p.getY(i));if(Array.isArray(w)){si.push(0,1,2,0);sw.push(...w,0);}else{const q=clamp(w,0,1);si.push(0,1,0,0);sw.push(1-q,q,0,0);}}
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
  const mesh=new T.SkinnedMesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;body.add(mesh);root.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);mesh.bind(skeleton);skeletons.push(skeleton);return mesh;
 };
 for(const s of [-1,1]){
  const arm=new T.Bone();arm.name='Lyra-shoulder-'+s;arm.position.set(s*.204,1.455,0);body.add(arm);
  const fore=new T.Bone();fore.name='Lyra-elbow-'+s;fore.position.y=-.32;arm.add(fore);
  const sleeveGeo=loft([[-.588,.026,.026,.026],[-.55,.029,.030,.029],[-.45,.036,.036,.034],[-.375,.039,.039,.037],[-.32,.034,.034,.034],[-.24,.039,.040,.040],[-.12,.049,.049,.048],[-.035,.056,.055,.054],[.026,.040,.041,.040],[.054,.004,.004,.004]],32,52,(p,a)=>{p[0]+=s*.204;p[1]+=1.455;const elbow=p[1]-1.135;p[2]+=.002*Math.sin(a*5)*Math.exp(-Math.pow(elbow/.07,2));return p;});
  skinned('Lyra-seamless-jacket-sleeve-'+s,sleeveGeo,leather,[arm,fore],y=>smooth((1.192-y)/.115));
  put(fore,loft([[-.266,.026,.026,.026],[-.243,.029,.029,.029],[-.229,.028,.028,.028]],24,6),boot);
  curve(fore,[[s*.023,-.06,.025],[s*.026,-.15,.026],[s*.022,-.23,.021]],.0011,silver);
  const hand=new T.Group();hand.name='Lyra-hand-'+s;hand.position.set(0,-.30,0);fore.add(hand);
  ell(hand,skin,0,-.001,0,.027,.040,.017);
  ell(hand,boot,0,.010,-.007,.0275,.027,.014);
  const fingers=[];for(let j=0;j<4;j++){const f=ell(hand,skin,(j-1.5)*.011,-.032,.010,.0058,.022-(j===3?.005:0),.0075);f.name='Lyra-finger-'+s+'-'+j;fingers.push(f);}hand.userData.fingers=fingers;
  const thumb=ell(hand,skin,-s*.024,.001,.016,.008,.022,.009);thumb.rotation.z=s*.43;hand.userData.thumb=thumb;
  const leg=new T.Bone();leg.name='Lyra-hip-'+s;leg.position.set(s*.103,.94,0);body.add(leg);
  const shin=new T.Bone();shin.name='Lyra-knee-'+s;shin.position.y=-.42;leg.add(shin);
  const pantsRows=[[-.75,.031,.031,.032],[-.65,.042,.043,.043],[-.535,.052,.050,.053],[-.45,.045,.043,.047],[-.41,.044,.045,.044],[-.32,.052,.052,.054],[-.21,.069,.069,.075],[-.09,.084,.079,.088],[.015,.082,.080,.085],[.125,.072,.070,.075]];
  const hipRows=[[.85,.173,.086,.104],[.905,.185,.095,.118],[.956,.191,.100,.121],[1.015,.170,.096,.109],[1.065,.145,.090,.097]];
  const legGeo=loft(pantsRows,40,68,(p,a)=>{
   const y=p[1]+.94,outer=smooth((y-.89)/.15),inner=smooth((y-.855)/.055),towardInner=Math.max(0,-s*Math.sin(a)),blend=outer+(inner-outer)*towardInner*towardInner;
   const hip=section(hipRows,clamp(y,.85,1.065)),hipX=Math.sin(a)*s>=0?Math.sin(a)*hip[1]:0,hipZ=Math.cos(a)*(Math.cos(a)>=0?hip[2]:hip[3]);
   return [T.MathUtils.lerp(p[0]+s*.103,hipX,blend),y,T.MathUtils.lerp(p[2],hipZ,blend)];
  });
  skinned('Lyra-seamless-jeans-leg-'+s,legGeo,denim,[pelvis,leg,shin],y=>{const waist=smooth((y-.924)/.106),knee=smooth((.582-y)/.13);return [waist,(1-waist)*(1-knee),(1-waist)*knee];});
  put(shin,loft([[-.409,.038,.038,.041],[-.35,.040,.041,.042],[-.24,.047,.047,.048],[-.155,.051,.049,.051],[-.135,.050,.048,.050]],28,22),boot,0,0,0,1,1,1,'Lyra-fitted-boot-shaft-'+s);
  const foot=new T.Group();foot.name='Lyra-boot';foot.position.y=-.405;shin.add(foot);
  const shoeRows=[[-.061,.014,.062],[-.047,.038,.126],[.005,.044,.126],[.07,.048,.080],[.133,.047,.064],[.157,.027,.043],[.166,.004,.023]];
  const shoe=bottom=>{const g=surface(28,28,(u,v)=>{const z=-.061+v*.227,q=section(shoeRows,z),a=u*Math.PI*2;return [Math.sin(a)*q[1],-.096+(bottom?.015:q[2])*(Math.cos(a)+1)/2,z];});const ix=g.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.computeVertexNormals();return g;};
  put(foot,shoe(false),boot,0,0,0,1,1,1,'Lyra-shaped-boot-upper-'+s);put(foot,shoe(true),sole,0,-.006,0,1.025,1,1.015);
  put(foot,box,sole,0,-.087,-.027,.063,.030,.060);
  for(let j=0;j<5;j++)curve(shin,[[-.021,-.20-j*.034,.043],[0,-.208-j*.034,.047],[.021,-.20-j*.034,.043]],.0012,silver);
  limbs.push({arm,fore,hand,leg,shin,foot});
 }
 // A flat, bevelled electric guitar, rather than three intersecting ellipsoids.
 const guitar=new T.Group();guitar.name='guitar-neck-grip';body.add(guitar);const paint=mat('Lyra-guitar-finish','#4a1c2e',.34,.28);
 const outline=new T.Shape();outline.moveTo(-.027,-.292);outline.bezierCurveTo(-.060,-.270,-.098,-.258,-.105,-.292);outline.bezierCurveTo(-.118,-.333,-.056,-.365,-.081,-.396);outline.bezierCurveTo(-.158,-.450,-.144,-.581,-.066,-.597);outline.bezierCurveTo(-.020,-.608,.020,-.608,.066,-.597);outline.bezierCurveTo(.144,-.581,.158,-.450,.081,-.396);outline.bezierCurveTo(.056,-.365,.093,-.343,.080,-.319);outline.bezierCurveTo(.065,-.296,.036,-.336,.027,-.314);outline.closePath();
 const guitarBody=new T.ExtrudeGeometry(outline,{depth:.025,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.005,bevelThickness:.004,curveSegments:18});guitarBody.translate(0,0,-.013);
 put(guitar,guitarBody,paint,0,0,0,1,1,1,'Lyra-flat-electric-guitar-body');
 put(guitar,box,mat('Lyra-guitar-neck','#54443d',.75),0,-.101,0,.036,.493,.019);put(guitar,box,boot,0,.180,0,.052,.100,.023);
 for(let j=0;j<13;j++)put(guitar,box,silver,0,-.32+j*.035,.037,.0016,.003);
 for(let j=0;j<6;j++)put(guitar,box,silver,(j-2.5)*.0045,-.19,.022,.0007,.70,.0007);
 for(const y of [-.415,-.490])put(guitar,box,boot,0,y,.022,.069,.017,.006);
 put(guitar,box,silver,0,-.541,.023,.065,.015,.007);
 for(const s of [-1,1])for(let j=0;j<3;j++)ell(guitar,silver,s*.034,.149+j*.024,0,.008,.004,.006);
 for(const y of [-.483,-.532])ell(guitar,silver,.071,y,.023,.006,.006,.004);
 curve(body,[[-.165,1.47,-.069],[-.129,1.50,-.108],[.103,1.275,-.159],[.148,1.145,-.133]],.009,boot);
 const microphone=new T.Group();microphone.name='Lyra-left-microphone';microphone.visible=false;body.add(microphone);
 put(microphone,new T.CylinderGeometry(.012,.015,.12,12),boot,0,-.015,0);ell(microphone,silver,0,.061,0,.026,.034,.026);
 const face=new T.Group();face.visible=false;
 root.userData={body,head,hair,hairLengths:lengths,face,limbs,guitar,eye,microphone,vocalMouth,skeletons,kind:'lira',mirrorLyra:mirror,characterRevision:1465};
 addBlade(root.userData);
 const sheath=body.getObjectByName('Lyra-sword-sheath');sheath.geometry.dispose();sheath.geometry=new T.CapsuleGeometry(.026,.79,4,10);sheath.scale.z=.56;sheath.position.set(-.195,.61,-.14);sheath.rotation.set(.10,0,-.12);
 createBat(root);batchRigid(root);return root;
}

// Merge the static details under each pivot/material. Hands, eyes, weapons and
// skinned surfaces retain their identity for animation and mirror-eye effects.
function batchRigid(root){
 const original=new Set();root.traverse(o=>{if(o.geometry)original.add(o.geometry);});
 const protectedNames=/^(Lyra-eye-|Lyra-finger-|Lyra-seamless-|Lyra-anatomical-face|Lyra-continuous-scalp|Lyra-full-back-hair|Lyra-fitted-leather-jacket|Lyra-flat-electric-guitar-body)/;
 const containers=[];root.traverse(p=>{if(!p.isMesh)containers.push(p);});
 for(const parent of containers){
  const buckets=new Map();for(const o of parent.children){if(!o.isMesh||o.isSkinnedMesh||o.name&&protectedNames.test(o.name)||!o.visible||o.material.transparent)continue;if(parent.userData.fingers?.includes(o)||parent.userData.thumb===o||root.userData.vocalMouth===o)continue;const key=o.material;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);}
  for(const [material,objects]of buckets){if(objects.length<2)continue;const p=[],n=[],uv=[];let complete=true;for(const o of objects){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),a=g.attributes.position,b=g.attributes.normal,c=g.attributes.uv;if(!a||!b){complete=false;g.dispose();break;}const normal=new T.Matrix3().getNormalMatrix(o.matrix);for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrix),vn=new T.Vector3().fromBufferAttribute(b,i).applyMatrix3(normal).normalize();p.push(v.x,v.y,v.z);n.push(vn.x,vn.y,vn.z);uv.push(c?.getX(i)||0,c?.getY(i)||0);}g.dispose();}if(!complete)continue;
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(n,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));const merged=new T.Mesh(geometry,material);merged.name='Lyra-batched-'+material.name;merged.castShadow=merged.receiveShadow=true;parent.add(merged);for(const o of objects)parent.remove(o);
  }
 }
 // Temporary source geometry from merged pieces is no longer scene-owned.
 const used=new Set();root.traverse(o=>{if(o.geometry)used.add(o.geometry);});
 for(const geometry of original)if(!used.has(geometry))geometry.dispose();
}

export function poseCharacterSurface(root,attack,time,running){
 const u=root.userData;if(!u.hairLengths)return;u.hair.rotation.set(0,0,0);
 const movement=running?1:0,stroke=attack?Math.sin(clamp(attack.t/attack.duration,0,1)*Math.PI):0;
 u.hairLengths.rotation.set(.012*Math.sin(time*2.2)+.045*movement+stroke*.035,0,.010*Math.sin(time*2.6)+stroke*.035);
 for(const l of u.limbs){const closed=l.hand.userData.fingers[0].position.y>-.028;for(const [j,f]of l.hand.userData.fingers.entries()){f.rotation.x=closed?-.70:-.10-j*.025;f.rotation.z=(j-1.5)*.035;}if(l.hand.userData.thumb)l.hand.userData.thumb.rotation.x=closed?-.35:0;}
}

export function trackCharacter(root,geometries,materials,textures,skeletons){
 root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const key of ['map','bumpMap','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap'])if(m[key])textures.add(m[key]);}});
}
