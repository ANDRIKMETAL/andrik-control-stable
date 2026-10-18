import * as T from './vendor/three-r170.module.min.js';
function shell(inner,outer,start,arc,bottom,top){
 const positions=[],indices=[];function quad(a,b,c,d){const n=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3);}const at=(r,a,y)=>[Math.sin(a)*r,y,Math.cos(a)*r],count=Math.ceil(arc*8);
 for(let i=0;i<count;i++){const a=start+i*arc/count,b=start+(i+1)*arc/count;quad(at(outer,a,bottom),at(outer,a,top),at(outer,b,top),at(outer,b,bottom));quad(at(inner,b,bottom),at(inner,b,top),at(inner,a,top),at(inner,a,bottom));quad(at(inner,a,top),at(inner,b,top),at(outer,b,top),at(outer,a,top));quad(at(outer,a,bottom),at(outer,b,bottom),at(inner,b,bottom),at(inner,a,bottom));}
 if(arc<Math.PI*2-.01){for(const [a,reverse]of [[start,false],[start+arc,true]]){const p=[at(inner,a,bottom),at(inner,a,top),at(outer,a,top),at(outer,a,bottom)];if(reverse)p.reverse();quad(...p);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function towerViewKit(geometries,materials){
 const cache=new Map(),wall=new T.MeshStandardMaterial({color:0x353d4b,roughness:.68,metalness:.32,side:T.DoubleSide}),gold=new T.MeshStandardMaterial({color:0xbba26b,roughness:.38,metalness:.7}),wood=new T.MeshStandardMaterial({color:0x554635,roughness:.82}),light=new T.MeshStandardMaterial({color:0xb3eadc,emissive:0x72d9c2,emissiveIntensity:.8}),box=new T.BoxGeometry(1,1,1),ring=new T.TorusGeometry(1,.07,6,40);geometries.add(box);geometries.add(ring);for(const m of [wall,gold,wood,light])materials.add(m);
 const put=(parent,g,m,x,y,z,sx=1,sy=sx,sz=sx)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;};
 return{build(parent,w){const root=new T.Group();root.name='Tower-open-doorway';parent.add(root);let meshes=cache.get(w.yaw);if(!meshes){meshes=[shell(w.inner,w.outer,w.yaw+w.doorHalf,Math.PI*2-w.doorHalf*2,0,w.doorHeight),shell(w.inner,w.outer,0,Math.PI*2,w.doorHeight,w.h),shell(w.inner,w.outer,0,Math.PI*2,w.base,0)];meshes.forEach(g=>geometries.add(g));cache.set(w.yaw,meshes);}for(const g of meshes)put(root,g,wall,0,0,0);
  for(let y=4;y<18;y+=2){const band=put(root,ring,gold,0,y,0,3.0);band.rotation.x=Math.PI/2;}
  const doorway=new T.Group();doorway.rotation.y=w.yaw;root.add(doorway);const z=w.outer*Math.cos(w.doorHalf),width=w.outer*Math.sin(w.doorHalf)*2;
  for(const side of [-1,1]){put(doorway,box,gold,side*width/2,1.61,z,.16,3.22,.28);const hinge=new T.Group();hinge.name='Tower-open-door-leaf-'+side;hinge.position.set(side*(width/2-.12),0,z-.08);hinge.rotation.y=side*1.44;doorway.add(hinge);put(hinge,box,wood,-side*width/4,1.45,0,width/2-.16,2.9,.12);for(const y of [.34,2.55])put(hinge,box,gold,-side*width/4,y,.075,width/2-.20,.055,.035);put(hinge,box,gold,-side*.23,1.35,.12,.055,.23,.065);}
  put(doorway,box,gold,0,3.23,z,width+.25,.20,.36);put(doorway,box,light,0,3.45,z+.05,.55,.08,.08);put(doorway,box,gold,0,.018,z,.65,.035,1.25);
  for(let d=.5;d<4.7;d+=.75)put(doorway,box,gold,0,.014,d,.12,.025,.26);
  const lamp=new T.PointLight(0xe4c895,5,7,2);lamp.position.set(0,2.5,.5);root.add(lamp);return root;
 }};
}
