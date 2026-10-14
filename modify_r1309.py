from pathlib import Path
r=Path('/mnt/data/r1309work')
p=r/'assets/lyra-hero-r1308.js'
s=p.read_text()
def rep(a,b):
 global s
 if a not in s: raise ValueError('Not found: '+a[:120])
 s=s.replace(a,b,1)
# less helmet; rear cap layer + head contour; bangs split, front skin visible
rep("put(hair,new T.SphereGeometry(1,28,18,0,Math.PI*2,0,Math.PI*.52),hairMat,0,.035,-.008,.117,.124,.111);", """// Rear crown only. Old forward-facing black hemisphere hid the entire forehead.
 const rearCrown=put(hair,new T.SphereGeometry(1,32,20,0,Math.PI*2,0,Math.PI*.59),hairMat,0,.055,-.066,.116,.110,.068);
 rearCrown.name='rear-crown-no-helmet';
 // Crown parting: small separate roots, forehead stays skin-coloured.
 const rootHighlight=mat('#30232b',.56),strandHighlight=mat('#3a1828',.54);
 for(const side of [-1,1])hairLock([[side*.008,.157,-.020],[side*.044,.147,-.010],[side*.091,.098,.013],[side*.109,.005,-.005]],.013,side<0?rootHighlight:hairMat);
 // Overlapping back curtain hides scalp holes when camera is over the right shoulder.
 for(let j=0;j<22;j++){
  const side=(j-10.5)/10.5;
  const x=side*.105;
  hairLock([[x,.113,-.071],[x*1.13,.048,-.124],[x*1.17,-.115,-.133],[x*1.2,-.255,-.13],[x*1.24,-.400,-.106]],.010+(j%4)*.0024,j%8===3?strandHighlight:hairMat);
 }""")
rep("const end=.41+(i%6)*.022;", "const end=.44+(i%6)*.018;")
# change front locks density length, no fringe over forehead
rep("[side*(.022+t*.081),.061,.100],[side*(.020+t*.098),.038-t*.055,.096]", "[side*(.040+t*.075),.088,.090],[side*(.056+t*.080),.041-t*.037,.081]")
# shape material, chest
rep("const volume=.043*", "const volume=.061*")
rep(" const neckline=.052*", " const neckline=.039*")
# add more subtle shaped chest high reflectance instead of skin ell spheres which currently look cutouts
rep("const tp=top.geometry.attributes.position;", "const tp=top.geometry.attributes.position;")
# revise hands: no 4 protruding rigid fingers; close fists while punching, open hands otherwise
rep("ell(hand,skin,0,0,0,.031,.044,.021);ell(hand,boot,0,.014,-.008,.033,.026,.018);\n  for(let j=0;j<4;j++)ell(hand,skin,(j-1.5)*.012,-.032,.01,.007,.023,.009);\n  ell(hand,skin,-s*.026,.005,.02,.010,.026,.011).rotation.z=s*.4;", """// A defined palm, curled fingers and thumb (not the four hanging finger rods).
  ell(hand,skin,0,-.008,.004,.039,.046,.029);
  const knuckles=ell(hand,skin,0,-.041,.018,.043,.024,.030);
  knuckles.name='boxing-knuckles';
  for(let j=0;j<4;j++)ell(hand,skin,(j-1.5)*.017,-.037,.038,.008,.015,.008);
  ell(hand,skin,-s*.036,-.007,.025,.013,.021,.020).rotation.z=-s*.30;
  const glove=ell(hand,boot,0,.026,-.004,.040,.022,.035);glove.name='wrist-wrap';""")
rep("ell(shin,boot,0,-.428,.045,.052,.065,.106);\n  ell(shin,boot,0,-.480,.048,.053,.016,.111);", """const toe=ell(shin,boot,0,-.428,.045,.052,.065,.106);
  toe.name='impact-boot-toe';
  ell(shin,boot,0,-.480,.048,.053,.016,.111);""")
rep("limbs.push({arm,fore,hand,leg,shin});", "limbs.push({arm,fore,hand,knuckles,toe,leg,shin});")
# face forehead need change eyebrow fine shadow no plate hair
rep("for(const s of [-1,1]){\n  ell(head,skin,s*.105", "for(const s of [-1,1]){\n  ell(head,skin,s*.105")
rep("strand(head,[[s*.016,.052,.098],[s*.043,.057,.100],[s*.071,.048,.084]],.0038,hairMat);", """strand(head,[[s*.016,.059,.090],[s*.042,.062,.095],[s*.071,.055,.077]],.0030,hairMat);
  // Soft brow instead of a black block crossing the forehead.
  ell(head,skin,s*.042,.072,.066,.038,.005,.005);""")
# rework poseGuitar entire method from export to EOF
where=s.index('export function poseGuitar(')
s=s[:where]+'''export function poseGuitar(root,attack,combo,time,running){
 const u=root.userData,g=u.guitar;
 const strike=attack?.kind==='attack',punch=attack?.kind==='punch',kick=attack?.kind==='kick';
 const q=attack?T.MathUtils.clamp(attack.t/Math.max(.001,attack.duration),0,1):0;
 const phase=(start,end)=>smooth((q-start)/(end-start));
 const impact=phase(.30,.48)*(1-phase(.66,.90));
 // Important: geometry proportions always return to their original dimensions.
 for(const l of u.limbs){
  l.hand.scale.setScalar(1);
  l.toe.scale.set(1,1,1);
 }
 g.visible=true;
 g.position.set(.16,1.34,-.19);g.rotation.set(.1,0,-.48);
 u.microphone.visible=attack?.kind==='scream';
 u.vocalMouth.visible=u.microphone.visible&&attack.t>.27&&attack.t<1.2;
 if(u.microphone.visible){
  const w=phase(0,.22)*(1-phase(.75,.95));
  const grip=new T.Vector3(-.24,.90,.05).lerp(new T.Vector3(-.034,1.60,.23),w);
  u.microphone.position.copy(grip);u.microphone.rotation.set(.2,0,-.15);
  handAt(u.limbs[0],grip,-1);u.head.rotation.x=-.06*w;
 }
 if(punch){
  // B: left guard remains at the cheek; right straight cross and left uppercut
  // have separate load, extension and recovery. Fists turn into the strike.
  const guard=[new T.Vector3(-.12,1.58,.19),new T.Vector3(.12,1.59,.20)];
  const upper=Boolean(attack.upper),index=upper?0:1,side=index?1:-1;
  for(let i=0;i<2;i++)handAt(u.limbs[i],guard[i],i?1:-1);
  const load=phase(0,.21),drive=phase(.21,.56),release=phase(.66,1);
  const cock=upper?new T.Vector3(-.205,1.24,.08):new T.Vector3(.19,1.55,.075);
  const hit=upper?new T.Vector3(-.075,1.78,.46):new T.Vector3(.08,1.57,.59);
  const target=guard[index].clone().lerp(cock,load).lerp(hit,drive).lerp(guard[index],release);
  handAt(u.limbs[index],target,side);
  u.limbs[index].hand.rotation.set(upper?-.4:Math.PI/2,0,upper?.18:0);
  const pop=phase(.37,.56)*(1-phase(.67,.88));
  u.limbs[index].hand.scale.setScalar(1+.24*pop);
  u.body.rotation.y=side*.27*Math.sin(q*Math.PI);
  u.body.rotation.x=upper?-.045*pop:.07*pop;
  if(!running){u.body.position.y-=.022;for(const [i,l] of u.limbs.entries()){
   l.leg.rotation.x-=.10;l.shin.rotation.x+=.18;l.leg.rotation.z=i?-.04:.04;
  }}
 }else if(kick){
  // Boot only scales briefly on contact, leg/shin animation stays in the scene.
  const pop=phase(.27,.49)*(1-phase(.62,.82));
  u.limbs[1].toe.scale.set(1+.20*pop,1+.12*pop,1+.28*pop);
  for(const [i,l] of u.limbs.entries())l.hand.scale.setScalar(1);
 }else if(strike){
  // Full two-handed guitar overhead: reach behind right shoulder, raise,
  // descend vertically and follow through towards the opponent.
  const load=phase(0,.20),raise=phase(.20,.46),down=phase(.46,.70),recover=phase(.79,1);
  const rest=new T.Vector3(.16,1.34,-.19);
  const backswing=new T.Vector3(.27,1.46,-.22);
  const above=new T.Vector3(.09,1.91,.12);
  const finish=new T.Vector3(.18,1.17,.43);
  const position=rest.clone().lerp(backswing,load).lerp(above,raise).lerp(finish,down).lerp(rest,recover);
  g.position.copy(position);
  const a0=new T.Vector3(.10,0,-.48),a1=new T.Vector3(-.80,.05,-.75),a2=new T.Vector3(1.95,.10,-.30),a3=new T.Vector3(-.35,0,.52);
  const r=a0.clone().lerp(a1,load).lerp(a2,raise).lerp(a3,down).lerp(a0,recover);
  g.rotation.set(r.x,r.y,r.z);
  g.updateMatrix();
  // Both wrists grip positions on the rigid guitar, not disconnected arms.
  const right=new T.Vector3(.01,.02,.01).applyMatrix4(g.matrix);
  const left=new T.Vector3(0,-.17,.018).applyMatrix4(g.matrix);
  handAt(u.limbs[1],right,1);handAt(u.limbs[0],left,-1);
  u.limbs[0].hand.rotation.set(.05,0,-.12);
  u.limbs[1].hand.rotation.set(.05,0,.12);
  u.body.rotation.y=.23*(raise-down)+.19*down*(1-recover);
  u.body.rotation.x=.16*down*(1-recover)-.09*raise;
  u.body.position.y-=.055*impact;
 }else{
  if(running){g.position.y+=Math.sin(time*15)*.025;if(!attack)u.body.rotation.x=.12;}
 }
}
'''
# write new file
p2=r/'assets/lyra-hero-r1309.js'
p2.write_text(s)
# imports patches to prevent cache issues; 3D worlds other unaffected
for base in ['city-3d','portrait']:
 file=r/'assets'/f'{base}-r1308.js'
 st=file.read_text().replace("./lyra-hero-r1308.js","./lyra-hero-r1309.js")
 st=st.replace('3D R1308','3D R1309')
 (r/'assets'/f'{base}-r1309.js').write_text(st)
# main loader and boot files
p=r/'assets/lira-3d-r1308.js'
s=p.read_text().replace("./city-3d-r1308.js?v=r1308","./city-3d-r1309.js?v=r1309").replace("./portrait-r1308.js?v=r1308","./portrait-r1309.js?v=r1309")
(r/'assets/lira-3d-r1309.js').write_text(s)
p=r/'assets/lira-boot-r1308.js'
s=p.read_text().replace("./lira-3d-r1308.js?v=r1308","./lira-3d-r1309.js?v=r1309")
(r/'assets/lira-boot-r1309.js').write_text(s)
p=r/'dreaming-of-lira.html'
s=p.read_text().replace('/assets/lira-boot-r1308.js?v=r1308','/assets/lira-boot-r1309.js?v=r1309')
p.write_text(s)
p=r/'index.html'
s=p.read_text().replace('/dreaming-of-lira.html?v=r1308','/dreaming-of-lira.html?v=r1309')
p.write_text(s)
print('created')
