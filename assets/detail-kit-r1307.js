import * as T from './vendor/three-r170.module.min.js';
// Shared geometry and batched static decoration; does not alter collision or quest objects.
export function detailKit({geometries,materials,textures}){
 const shapes={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(1,12,8),cyl:new T.CylinderGeometry(1,1,1,12),ring:new T.TorusGeometry(1,.075,5,24)};Object.values(shapes).forEach(g=>geometries.add(g));
 const bytes=new Uint8Array(64*64*4);let seed=1307;for(let i=0;i<4096;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=105+(seed>>>26);bytes.set([v,v,v,255],i*4);}const grain=new T.DataTexture(bytes,64,64);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(4,4);grain.needsUpdate=true;textures.add(grain);
 const palette={steel:0x75818f,dark:0x202a37,gold:0xb49155,stone:0x716b72,wood:0x77604b,cyan:0x53c9da,warm:0xebba74,red:0xa34567,green:0x497366};const mats={};for(const [name,color]of Object.entries(palette)){const glow=['cyan','warm','red'].includes(name);mats[name]=new T.MeshStandardMaterial({color,roughness:glow?.38:.74,metalness:name==='steel'||name==='gold'?.65:.15,emissive:glow?color:0,emissiveIntensity:glow?.35:0,bumpMap:glow?null:grain,bumpScale:.012});materials.add(mats[name]);}
 function add(parent,type,color,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0){const o=new T.Mesh(shapes[type],mats[color]);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);parent.add(o);return o;}
 function decor(parent,{world,zone=0,platforms=[],length=60}){
 const lists=new Map(),dummy=new T.Object3D();const put=(type,color,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0)=>{const key=type+':'+color;if(!lists.has(key))lists.set(key,[]);dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();lists.get(key).push(dummy.matrix.clone());};
 if(world==='city'){
  if(zone===2){ // Bar shelves, bottles, stools, stage cables: outside the central combat lane.
   for(const side of [-1,1])for(let z=6;z<34;z+=7){put('box','wood',side*15,2.1,z,1.7,.12,4);for(let i=0;i<5;i++){put('cyl',i%2?'green':'gold',side*15,2.42,z-1.4+i*.65,.10,.53,.10);put('cyl','dark',side*15,2.76,z-1.4+i*.65,.055,.14,.055);}}
   for(let i=0;i<8;i++)put('box','dark',-4+i, .27,35,.7,.025,5);for(const side of [-1,1]){put('cyl','steel',side*7,2.1,36,.035,3.4,.035);put('ball','dark',side*7,3.8,36,.13,.08,.08);}
  }else{
   const end=zone===3?Math.min(length,420):length;
   for(let z=7;z<end-3;z+=12)for(const side of [-1,1]){
    const x=side*(zone===3?23:13.30),h=10+(z%4)*2;
    put('box','stone',x,h-.1,z,.35,.28,10);put('box','dark',x,1.35,z,.12,2.7,1.9);put('box','gold',x-side*.09,1.3,z+.63,.08,.15,.06);
    for(let y=3;y<h-1;y+=2.8)for(let dz=-3;dz<=3;dz+=3){put('box','steel',x-side*.09,y-.76,z+dz,.32,.12,1.65);put('box','steel',x-side*.055,y,z+dz,.05,1.35,.05);}
    put('box','steel',x-side*.24,3.4,z+4,.65,.72,1.25);for(let j=0;j<5;j++)put('box','dark',x-side*.59,3.18+j*.10,z+4,.018,.04,1.03);
    put('cyl','steel',x-side*.06,h/2,z-4.6,.065,h,.065);
    if(zone!==3){put('cyl','dark',side*11.8,.45,z+4,.28,.9,.28);put('ring','steel',side*11.8,.93,z+4,.29,.29,.29,Math.PI/2);put('box','wood',side*11.6,.65,z-3,.85,.13,2.2);for(const dz of [-.8,.8])put('box','dark',side*11.6,.32,z-3+dz,.65,.64,.10);}
   }
  }
 }else if(world==='portrait'){
  for(let z=5;z<length-3;z+=7)for(const side of [-1,1]){
   put('box','gold',side*9.93,1.05,z,.055,.08,6.8);put('box','dark',side*9.92,2.2,z,.08,2.5,3.3);put('box','gold',side*9.83,3.48,z,.08,.07,3.5);
   for(const dz of [-1.7,1.7])put('box','gold',side*9.82,2.2,z+dz,.07,2.6,.07);
   put('box','red',side*9.7,5.8,z,.06,2.8,1.2);put('cyl','gold',side*9.0,2.7,z+2.6,.10,.2,.10);put('ball','warm',side*9.0,3.02,z+2.6,.055,.14,.055);
  }
 }else if(world==='ruins'){
  for(let z=6;z<length-2;z+=8)for(const side of [-1,1]){
   for(let i=0;i<12;i++){const a=i*Math.PI/6;put('box','gold',side*8+Math.cos(a)*1.65,5+Math.sin(a)*1.65,z,.10,.10,.22,0,0,a);}
   put('box','cyan',side*8,2.5,z-.66,.12,.85,.04);put('ring','gold',side*8,.4,z,.72,.72,.72,Math.PI/2);
  }
 }
 if(world===2||world==='ruins')for(const f of platforms){if(f.fragile)continue;for(const side of [-1,1])for(let z=f.z-f.d/2+.4;z<f.z+f.d/2;z+=2){put('ball','steel',f.x+side*(f.w/2-.24),f.h+.025,z,.055,.02,.055);}if(world===2){for(const side of [-1,1]){put('ring','wood',f.x+side*(f.w/2-.24),f.h+.19,f.z,.22,.22,.22,Math.PI/2);put('cyl','wood',f.x+side*(f.w/2-.24),f.h-.7,f.z,.20,2.2,.20);}put('ring','gold',f.x-f.w/2+.5,f.h+.055,f.z,.28,.28,.28,Math.PI/2);}}
 if(world===3)for(const [i,f]of platforms.entries()){
  put('box','dark',f.x,f.h-.6,f.z,f.w*.8,.15,f.d*.8);for(const side of [-1,1]){put('cyl','steel',f.x+side*(f.w/2-.3),f.h-.65,f.z,.14,f.d*.75,.14,Math.PI/2);put('box','cyan',f.x+side*(f.w/2-.1),f.h+.05,f.z,.10,.05,1);}
  for(let j=0;j<5;j++)put('box','steel',f.x-.6+j*.3,f.h+.015,f.z-1,.12,.03,.7);
  if(i%2===1){put('box','dark',f.x+f.w/2+1,f.h+.3,f.z,1.4,.25,2.2);for(let j=0;j<4;j++)put('box','cyan',f.x+f.w/2+1,f.h+.44,f.z-.7+j*.45,1.2,.02,.3);}
 }
 if(world===4){for(let y=0;y<16;y+=2){for(let i=0;i<12;i++){const angle=i*Math.PI/6;put('box',i%3?'stone':'gold',Math.sin(angle)*2.81,y,Math.cos(angle)*2.81,.32,.5,.08,0,angle);}}
 for(const [i,f]of platforms.entries())if(i>0){const a=Math.atan2(f.x,f.z);put('box','steel',f.x*.8,f.h-.65,f.z*.8,1,.18,3,0,a,.18);put('box','warm',f.x,f.h+.04,f.z+f.d/2-.25,1,.05,.12);}}
 if(world===5){for(const side of [-1,1])for(let z=3;z<49;z+=5){put('box','steel',side*12.1,1.1,z,.22,1.8,1.8);for(let j=0;j<3;j++)put('box','cyan',side*11.94,.7+j*.35,z,.055,.06,1.2);put('cyl','dark',side*12.2,3.1,z,.08,4.5,.08,Math.PI/2);}for(let z=3;z<48;z+=6)for(const side of [-1,1])put('box','gold',side*10.5,.04,z,.65,.03,.14,0,side*.5);}
 const result=[];for(const [key,matrices]of lists){const [type,color]=key.split(':'),batch=new T.InstancedMesh(shapes[type],mats[color],matrices.length);matrices.forEach((m,i)=>batch.setMatrixAt(i,m));batch.computeBoundingSphere();batch.receiveShadow=true;batch.userData.detail1307=true;parent.add(batch);result.push(batch);}return result;
 }
 function enemy(root,kind){if(root.userData.detail1307)return;root.userData.detail1307=true;const g=new T.Group();(root.userData.body||root).add(g);if(root.scale.x<.1)g.scale.setScalar(30);const accent=kind==='boss'?'gold':kind==='shadow'?'red':'steel';
 for(const side of [-1,1]){add(g,'box','dark',side*.17,1.29,.24,.06,.44,.035,0,0,side*.15);add(g,'box',accent,side*.16,1.12,.27,.075,.07,.025);for(let i=0;i<3;i++)add(g,'ball',accent,side*.24,1.25+i*.09,.20,.021);add(g,'box','dark',side*.20,.94,.15,.13,.17,.09);}
 add(g,'box',accent,0,1.40,.27,.13,.08,.025);add(g,'box','cyan',0,1.40,.29,.06,.025,.015);for(const l of root.userData.limbs||[]){if(!l.fore)continue;const sleeve=new T.Group();l.fore.add(sleeve);if(root.scale.x<.1)sleeve.scale.setScalar(30);add(sleeve,'cyl',accent,0,-.19,0,.045,.09,.045);for(let i=0;i<3;i++)add(sleeve,'ball','steel',0,-.16-i*.035,.047,.012);}return g;}
 function car(g){for(const side of [-1,1])for(const z of [-1.45,1.45]){add(g,'ring','dark',side*1.085,.43,z,.49,.49,.49,0,Math.PI/2);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(g,'box','steel',side*1.228,.43+Math.sin(a)*.12,z+Math.cos(a)*.12,.022,.032,.29,a,0,0);}}for(const side of [-1,1]){add(g,'box','dark',side*.40,1.36,.93,.022,.32,.025,.4,0,side*.2);add(g,'cyl','steel',side*.70,.29,-2.26,.065,.18,.065,Math.PI/2);add(g,'box','dark',side*1.075,.78,0,.008,.012,2.6);} }
 return {decor,enemy,car};
}
