import * as T from './vendor/three-r170.module.min.js';
import {createLyra as createBaseLyra,poseGuitar} from './lyra-hero-r1309.js';
/** R1313: real-time stage two beauty upgrade for the playable Three.js character.
    Keeps the original anatomical animation pivots and interactions unchanged.
    Face is a mapped CURVED MESH, not a billboard or a static sprite. */
export {poseGuitar};
const ball=new T.SphereGeometry(1,32,24);
const fade=(x)=>Math.max(0,Math.min(1,x));
function gaussian(x,y,cx,cy,wx,wy){return Math.exp(-(((x-cx)/wx)**2)-(((y-cy)/wy)**2));}
function sculptedFront(x,y){
 const n=Math.min(.997,Math.sqrt((x/.111)**2+(y/.146)**2));
 let z=.105*Math.sqrt(Math.max(0,1-n*n));
 const front=Math.min(1,z/.105*3);
 z+=front*(.013*gaussian(x,y,0,-.005,.015,.038)+.016*gaussian(x,y,0,-.025,.016,.013)
   +.009*gaussian(Math.abs(x),y,.063,-.026,.032,.030)
   -.006*gaussian(Math.abs(x),y,.043,.020,.026,.017)
   +.006*gaussian(Math.abs(x),y,.040,.049,.030,.013)
   +.009*gaussian(x,y,0,-.093,.036,.022));
 return z+.0046;
}
function softFaceMesh(){
 const radial=17,angular=72,positions=[],uv=[],normals=[],ids=[];
 for(let i=0;i<=radial;i++){
  const r=.001+(i/radial)*.991;
  for(let j=0;j<=angular;j++){
   const theta=j/angular*Math.PI*2;
   const x=Math.cos(theta)*.111*r,y=Math.sin(theta)*.146*r;
   positions.push(x,y,sculptedFront(x,y));
   uv.push(.5+x/.222, .5+y/.292);
  }
 }
 for(let i=0;i<radial;i++)for(let j=0;j<angular;j++){
  const a=i*(angular+1)+j,b=a+angular+1;
  ids.push(a,b,a+1,a+1,b,b+1);
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 g.setIndex(ids);g.computeVertexNormals();return g;
}
const faceGeometry=softFaceMesh();
function shapeHair(head,hair){
 const shadow=new T.MeshStandardMaterial({color:0x0b0a10,metalness:.09,roughness:.55,side:T.DoubleSide});
 const highlights=new T.MeshStandardMaterial({color:0x5c2031,metalness:.10,roughness:.42,side:T.DoubleSide});
 // No front hair helmet: strands originate on the natural crown, leaving visible forehead.
 for(let k=0;k<20;k++){
  const t=k/19,side=k%2===0?-1:1;
  const x=side*(.018+.083*t);
  const points=[new T.Vector3(x,.145,-.050),new T.Vector3(x*1.3,.106,-.096),
   new T.Vector3(x*1.5,-.063,-.148),new T.Vector3(x*1.48,-.255,-.140),
   new T.Vector3(x*1.42+(k%3-1)*.008,-.465,-.122)];
  const w=.004+(.008*Math.sin(Math.PI*(.15+t*.75)));
  const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),18,w,4,false), k%4===0?highlights:shadow);
  mesh.name='stage2-layered-back-hair';hair.add(mesh);
 }
 // Subtle parting and face-framing red locks avoid an opaque black fringe.
 for(const s of [-1,1]){
  const curve=new T.CatmullRomCurve3([
   new T.Vector3(s*.022,.15,.005),new T.Vector3(s*.082,.10,.052),
   new T.Vector3(s*.116,-.004,.056),new T.Vector3(s*.129,-.188,.036),
   new T.Vector3(s*.135,-.348,-.012)]);
  hair.add(new T.Mesh(new T.TubeGeometry(curve,28,.0045,5,false),highlights));
 }
}
function detailFashion(u){
 const body=u.body;
 const suit=new T.MeshStandardMaterial({color:0x1a171c,metalness:.13,roughness:.45});
 const thread=new T.MeshStandardMaterial({color:0x55505a,metalness:.35,roughness:.49});
 // Slightly tapered athletic hips and sculpted thighs: independent rounded surfaces,
 // not broad blocks that would disconnect during kicks.
 for(const s of [-1,1]){
  const hip=new T.Mesh(ball,suit);hip.position.set(s*.146,.916,-.018);hip.scale.set(.085,.113,.094);hip.castShadow=true;body.add(hip);
  // Jacket hem seams and stitching follow the waist without obscuring the pendant.
  const curve=new T.CatmullRomCurve3([new T.Vector3(s*.140,1.11,.035),
   new T.Vector3(s*.157,1.075,.053),new T.Vector3(s*.161,1.04,.030)]);
  body.add(new T.Mesh(new T.TubeGeometry(curve,12,.0019,4,false),thread));
 }
}
export function createLyra(){
 const root=createBaseLyra(),u=root.userData,head=u.head;
 root.name='LYRA-STAGE2-R1313';
 // Keep the base skinned geometry and action joints, hide low-poly floating face features.
 for(const child of [...head.children]){
  if(child===u.hair||child===u.vocalMouth||child.isGroup)continue;
  if(child.isMesh){
   const hasScannedSkin=Boolean(child.geometry?.getAttribute('color'));
   const ear=Math.abs(child.position.x)>.099&&child.position.z<.02;
   if(!hasScannedSkin&&!ear)child.visible=false;
  }
 }
 const tex=new T.TextureLoader().load('/assets/lyra-face-r1313.webp');
 tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
 const material=new T.MeshStandardMaterial({map:tex,color:0xffffff,roughness:.84,metalness:0,
   transparent:true,depthWrite:false,side:T.DoubleSide,alphaTest:.025,polygonOffset:true,polygonOffsetFactor:-1});
 const face=new T.Mesh(faceGeometry,material);face.name='R1313-sculpted-photo-face';
 head.add(face);u.stage2Face=face;u.stage2FaceTexture=tex;
 shapeHair(head,u.hair);
 detailFashion(u);
 // Reduce the grey mannequin effect through soft natural highlights.
 u.body.children.forEach(o=>{
  if(o.material?.color && o.material.roughness!==undefined && o.material.color.getHexString()==='bd9587'){
   o.material.roughness=.73;
  }
 });
 root.userData.beautyVersion='R1313';
 return root;
}
