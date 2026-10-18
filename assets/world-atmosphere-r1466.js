import * as T from './vendor/three-r170.module.min.js';
import {momentSpec,streetLamps} from './world-moments-r1466.js?v=r1468';
const clamp=T.MathUtils.clamp,smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function atmosphereKit(geometries,materials,textures,assets){
 const {shape}=assets,box=shape.box,ball=shape.ball;
 const mat=(name,color,glow=0,alpha=1)=>{const m=new T.MeshStandardMaterial({color,roughness:.7,metalness:.12,emissive:color,emissiveIntensity:glow,transparent:alpha<1,opacity:alpha,depthWrite:alpha===1});m.name=name;materials.add(m);return m;};
 const metal=mat('Atmosphere-dark-metal',0x334958),gold=mat('Atmosphere-brass',0x9b8258),dark=mat('Atmosphere-unlit',0x172431),cyan=mat('Atmosphere-cyan',0x70d8d5,.8),green=mat('Atmosphere-restored',0x7de6ab,.65),red=mat('Atmosphere-alarm',0xe16b69,.55),warm=mat('Atmosphere-warm-light',0xdfbb82,.7),steam=mat('Atmosphere-soft-steam',0xaac4cc,0,.12);
 const windows=Array.from({length:6},(_,i)=>{const m=mat('City-window-phase-'+i,[0xd4b486,0xc6c8ad,0xb3c9cf,0xd6ba8e,0xc9c3a3,0xc2b8a3][i],.6);m.userData.base=m.color.clone();return m;});
 const torus=new T.TorusGeometry(1,.075,5,24),cGlyph=new T.TorusGeometry(.095,.016,5,20,Math.PI*2-.76);geometries.add(torus);geometries.add(cGlyph);
 const put=(parent,g,m,x,y,z,sx=1,sy=sx,sz=sx)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;};
 let lamps=[],signs=[],glyphSigns=[],atlas=null,lastTime=null;
 function glyphAtlas(){
  if(atlas)return atlas;
  if(typeof document==='undefined'){atlas=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);atlas.needsUpdate=true;}
  else {const c=document.createElement('canvas');c.width=1024;c.height=192;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#ffffff';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';for(let i=0;i<37;i++)ctx.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '[i],i%16*64+32,Math.floor(i/16)*64+33);atlas=new T.CanvasTexture(c);atlas.colorSpace=T.SRGBColorSpace;}
  textures.add(atlas);return atlas;
 }
 const lights={
  begin(){for(const q of glyphSigns){q.mesh.geometry.dispose();geometries.delete(q.mesh.geometry);q.mesh.material.dispose();materials.delete(q.mesh.material);}lamps=[];signs=[];glyphSigns=[];lastTime=null;},
  window(index){return windows[((index%6)+6)%6];},
  watchLamp(o,id,breakable=false){o.name='City-lamp-'+id;o.userData.dynamic=true;lamps.push({o,id,breakable});},
  watchSign(o,id){signs.push({m:o.material,id,base:o.material.emissiveIntensity||.7});},
  neonText(parent,text,x,y,z,width,color='#e37cb7',rotation=0){
   const root=new T.Group();root.name='City-neon-'+text;root.userData.dynamic=true;root.position.set(x,y,z);root.rotation.y=rotation;parent.add(root);
   put(root,box,metal,0,0,0,width+.25,.92,.10);
   const p=[],uv=[],idx=[],colors=[],count=text.length,h=.56,w=width/count,alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',base=new T.Color(color);
   for(let i=0;i<count;i++){const n=Math.max(0,alphabet.indexOf(text[i])),u=n%16/16,v=1-Math.floor(n/16)/3,left=-width/2+i*w,k=i*4;p.push(left,-h/2,.06,left+w,-h/2,.06,left+w,h/2,.06,left,h/2,.06);uv.push(u,v-1/3,u+1/16,v-1/3,u+1/16,v,u,v);idx.push(k,k+1,k+2,k,k+2,k+3);for(let j=0;j<4;j++)colors.push(base.r,base.g,base.b);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(idx);geometries.add(geometry);
   const m=new T.MeshBasicMaterial({map:glyphAtlas(),transparent:true,depthWrite:false,side:T.DoubleSide,vertexColors:true});materials.add(m);const mesh=new T.Mesh(geometry,m);mesh.name='Neon-letter-strip';root.add(mesh);glyphSigns.push({mesh,base,text});return root;
  },
  update(t,s,settings={}){
   const dt=lastTime===null?0:clamp(t-lastTime,0,.06);lastTime=t;const flash=settings.flashes??.65,blackout=s?.worldMoments?.data.phase==='ambush',restored=s?.worldMoments?.data.done;
   for(let i=0;i<windows.length;i++){const period=19+i*3.7,phase=((t+i*6.2)%period)/period,on=phase>.13&&phase<.90,target=(blackout?.10:on?.68:.035);windows[i].emissiveIntensity=T.MathUtils.lerp(windows[i].emissiveIntensity,target,Math.min(1,dt*2.8));windows[i].color.copy(windows[i].userData.base).multiplyScalar(.35+.65*clamp(windows[i].emissiveIntensity/.68,0,1));}
   for(const q of lamps){const broken=s?.worldMoments?.isBroken(q.id),phase=(t+q.id.length*.19)%17,faulty=q.breakable&&!restored&&flash>.05&&(phase<.12||phase>.31&&phase<.42);q.o.material=broken?dark:blackout||faulty?metal:warm;}
   for(const q of signs){const v=((t+q.id*3.1)%23+23)%23,dim=flash>.05&&v<.18?q.base*(1-.85*flash):q.base;q.m.emissiveIntensity=blackout?dim*.2:dim;}
   for(const q of glyphSigns){const phase=(t+4.3)%21,off=flash>.05&&(phase<.15||phase>.33&&phase<.50),a=q.mesh.geometry.attributes.color;for(let i=0;i<q.text.length;i++){const faulty=q.text.indexOf('O')===i,level=blackout?.15:faulty&&off?.06:1;for(let j=0;j<4;j++)a.setXYZ(i*4+j,q.base.r*level,q.base.g*level,q.base.b*level);}a.needsUpdate=true;}
  },get lampCount(){return lamps.length;},get signCount(){return glyphSigns.length+signs.length;}
 };
 function build(parent,{world,zone=0,geo,state=null,coarse=false}={}){
  const root=new T.Group();root.name='World-atmosphere-R1466';root.userData.dynamic=true;parent.add(root);let closed=false,last=null,doneAt=null,previousDone=!!state?.worldMoments?.data.done;
  if(geo?.startBoundary1467){const enclosure=new T.Group();enclosure.name='Start-enclosure-R1467';root.add(enclosure);const b=geo.startBoundary1467,city=b.kind==='city';
   if(city){for(const w of b.walls){const o=put(enclosure,box,metal,w.x,w.h/2,w.z,w.w,w.h,w.d);o.name='Solid-start-wall';}put(enclosure,box,metal,0,-.20,-1.4,29,.4,3);}
   const back=b.walls[0],face=back.z+back.d/2+.035;for(const x of city?[-9,0,9]:[-3.9,3.9]){put(enclosure,box,gold,x,3.2,face,.16,6.4,.12);put(enclosure,box,cyan,x,5.6,face+.09,.12,.55,.025);}put(enclosure,box,gold,0,6.4,face,back.w-.4,.15,.12);
   if(city)for(let x=-12;x<=12;x+=3)put(enclosure,box,dark,x,2.8,face,2.75,5.4,.06);
  }
  const q=state?momentSpec(state):null,marker=new T.Group();marker.name='Optional-world-moment';root.add(marker);const pieces={},lampsHere=state?streetLamps(state).filter(x=>x.breakable):[];
  if(q){marker.position.set(q.x,q.y,q.z);const theme=world==='portrait'?gold:world==='ruins'||world===4?gold:metal;
   put(marker,box,theme,0,.45,0,.64,.90,.44);pieces.screen=put(marker,box,cyan,0,.66,.235,.40,.24,.025);pieces.c=put(marker,cGlyph,cyan,0,1.25,0);pieces.c.rotation.z=.38;pieces.c.name='Moment-C-marker';
   if(world==='city'){
    const door=new T.Group();door.position.set(7.15,0,0);door.rotation.y=-Math.PI/2;marker.add(door);put(door,box,metal,0,1.4,0,1.65,2.8,.13);pieces.door=put(door,box,dark,0,1.4,-.08,1.45,2.6,.06);put(door,ball,red,.62,2.65,-.14,.065);pieces.door.name='Ambush-service-door';
   }else if(world==='portrait'){
    pieces.frame=new T.Group();marker.add(pieces.frame);pieces.frame.position.y=1.9;
    for(const s of [-1,1]){put(pieces.frame,box,gold,s*.65,0,0,.09,1.65,.1);put(pieces.frame,box,gold,0,s*.82,0,1.35,.08,.1);}put(pieces.frame,box,dark,0,0,0,1.18,1.48,.04);
    pieces.face=put(pieces.frame,ball,gold,0,.05,.035,.28,.38,.025);for(const s of [-1,1])put(pieces.frame,ball,cyan,s*.10,.11,.07,.035,.018,.01);
   }else if(world==='ruins'||world===4){
    pieces.gear=new T.Group();pieces.gear.position.set(0,1.9,0);marker.add(pieces.gear);put(pieces.gear,torus,gold,0,0,0,.47);for(let i=0;i<8;i++)put(pieces.gear,box,gold,Math.sin(i*Math.PI/4)*.47,Math.cos(i*Math.PI/4)*.47,0,.12,.12,.10);
    pieces.pendulum=new T.Group();pieces.pendulum.position.set(0,1.9,.16);marker.add(pieces.pendulum);put(pieces.pendulum,box,gold,0,-.32,0,.025,.64,.03);put(pieces.pendulum,ball,gold,0,-.65,0,.10,.12,.06);
   }else if(world===2){
    pieces.boat=new T.Group();marker.add(pieces.boat);pieces.boat.position.set(5.2,-q.y-1.65,0);put(pieces.boat,ball,metal,0,0,0,.65,.27,1.35);put(pieces.boat,box,gold,0,.10,0,1.05,.08,2.0);put(pieces.boat,torus,warm,0,.35,.6,.19);pieces.beacon=put(pieces.boat,ball,cyan,0,.55,-.65,.07);
   }else if(world===3){
    pieces.valve=put(marker,torus,red,0,1.32,.02,.30);pieces.puffs=[];for(let i=0;i<3;i++)pieces.puffs.push(put(marker,ball,steam,.4,.8,0,.12,.12,.18));
   }else if(world===5){pieces.chain=[];for(let i=0;i<6;i++)pieces.chain.push(put(marker,box,cyan,-1.0+i*.4,1.72,0,.22,.22,.16));}
  }else marker.visible=false;
  const props=[];for(const l of lampsHere){const o=put(root,box,metal,l.x,.55,l.z,.35,.9,.24),bulb=put(root,box,warm,l.x,.69,l.z-.13,.17,.12,.02);o.name='Breakable-lamp-fuse-'+l.id;props.push({q:l,o,bulb});}
  const route=(geo?.platforms||[]).filter(f=>!f.objectTop&&(!Number.isFinite(f.main)||f.main%4===1)&&(!Number.isFinite(f.dock)||f.dock%4===1)).slice(0,coarse?7:12),guides=[];
  if([2,3,4,5].includes(world))for(const [i,f]of route.entries()){
   const g=new T.Group();g.position.set(f.x+Math.min(f.w*.35,2.6),f.h+.16,f.z);g.name='Route-status-light-'+i;root.add(g);const light=put(g,world===2?ball:box,cyan,0,.10,0,.12,.15,.12);guides.push({g,light,index:i});
  }
  const particlesGeometry=new T.BufferGeometry(),pp=new Float32Array(32*3);particlesGeometry.setAttribute('position',new T.BufferAttribute(pp,3));particlesGeometry.setDrawRange(0,0);geometries.add(particlesGeometry);const particleMaterial=new T.PointsMaterial({color:0xffce7e,size:.055,transparent:true,opacity:.8,depthWrite:false});materials.add(particleMaterial);const sparks=new T.Points(particlesGeometry,particleMaterial);sparks.name='Bounded-decor-sparks';root.add(sparks);let age=1,origin=null;const known=new Set(state?.worldMoments?.data.broken||[]);
  const debris=new T.InstancedMesh(box,metal,24),dummy=new T.Object3D();debris.name='Mechanical-burst-debris';debris.instanceMatrix.setUsage(T.DynamicDrawUsage);debris.frustumCulled=false;debris.visible=false;root.add(debris);
  const cracks=[];if(world==='portrait'&&zone===2){for(const [i,p]of [{x:-6,z:10},{x:4,z:10},{x:4,z:20}].entries()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.33,.80,.045,-.04,.22,.045,-.04,.22,.045,.18,-.15,.045,.18,-.15,.045,-.10,-.75,.045,-.04,.22,.045,-.37,-.10,.045],3));geometries.add(g);const m=new T.LineBasicMaterial({color:0xd7bcad});materials.add(m);const o=new T.LineSegments(g,m);o.position.set(p.x,1.6,p.z);o.name='Progressive-mirror-crack-'+i;root.add(o);cracks.push({o,i});}}
  function update(t,p,camera,quality='auto',settings={}){
   if(closed)return;const dt=last===null?0:clamp(t-last,0,.06);last=t;const budget=quality==='low'?24:38,motion=settings.motion??.5,flash=settings.flashes??.65;
   if(world==='city')lights.update(t,state,settings);
   if(q){marker.visible=Math.hypot(q.x-p.x,q.z-p.z,q.y-p.y)<budget;const done=!!state?.worldMoments?.data.done;if(done&&!previousDone)doneAt=t;previousDone=done;const elapsed=doneAt===null?100:Math.max(0,t-doneAt);
    pieces.screen.material=done?green:state?.worldMoments?.data.phase==='ambush'?red:cyan;pieces.c.visible=!done;pieces.c.position.y=1.25+Math.sin(t*1.6)*.035*motion;
    if(pieces.door)pieces.door.rotation.y=state?.worldMoments?.data.phase==='ambush'?-.8:0;
    if(pieces.frame){pieces.frame.rotation.y=done?Math.sin(Math.min(1,elapsed/1.2)*Math.PI/2)*.14:0;pieces.face.visible=done;}
    if(pieces.gear)pieces.gear.rotation.z=done?t*.48:0;if(pieces.pendulum)pieces.pendulum.rotation.z=done?Math.sin(t*1.8)*.35*motion:0;
    if(pieces.boat){pieces.boat.position.y=-q.y-1.65+Math.sin(t*.8)*.055*motion;pieces.boat.rotation.z=Math.sin(t*.9)*.04*motion;pieces.beacon.material=done?warm:dark;}
    if(pieces.valve){pieces.valve.rotation.z=done?-Math.PI*.75*smooth(elapsed/.7):0;pieces.valve.material=done?green:red;for(const [i,o]of pieces.puffs.entries()){o.visible=!done;const u=(t*.55+i*.33)%1;o.position.set(.38+u*.65,.8+u*.4,0);o.scale.setScalar(.08+u*.25);}}
    if(pieces.chain)for(const [i,o]of pieces.chain.entries())o.material=done&&((t*2-i)%6+6)%6<1.8?green:done?cyan:dark;
   }
   const active=state?.flags?.length||0;for(const g of guides){g.g.visible=Math.hypot(g.g.position.x-p.x,g.g.position.z-p.z,g.g.position.y-p.y)<budget;const blink=flash>.05&&world===3&&!active&&Math.floor(t*.7+g.index)%3===0;g.light.material=active>g.index%3?green:blink?red:cyan;}
   for(const o of props){o.o.visible=o.bulb.visible=Math.hypot(o.q.x-p.x,o.q.z-p.z)<budget;o.bulb.material=state?.worldMoments?.isBroken(o.q.id)?dark:warm;}
   for(const id of state?.worldMoments?.data.broken||[])if(!known.has(id)){known.add(id);const lamp=lampsHere.find(q=>q.id===id);if(lamp){origin={x:lamp.x,y:1,z:lamp.z};age=0;}}
   age+=dt;if(origin&&age<.65&&flash>.05){particlesGeometry.setDrawRange(0,quality==='low'?12:24);for(let i=0;i<24;i++){const a=i*2.4;pp[i*3]=origin.x+Math.sin(a)*age*2;pp[i*3+1]=origin.y+age*(1.5+i%3)-age*age*5;pp[i*3+2]=origin.z+Math.cos(a)*age*2;}particlesGeometry.attributes.position.needsUpdate=true;sparks.frustumCulled=false;particleMaterial.opacity=(1-age/.65)*.8*flash;}else particlesGeometry.setDrawRange(0,0);
   for(const {o,i}of cracks){o.visible=!!state?.solved||!!state?.angles&&state.angles[i]!==[0,2,4][i];o.rotation.y=-(state?.angles?.[i]||0)*Math.PI/4;}
   const bursts=(state?.effects1466||[]).filter(f=>f.type==='mechanical'&&Math.hypot(f.x-p.x,f.z-p.z)<budget).slice(-3);debris.visible=bursts.length>0;debris.count=bursts.length*8;
   for(const [j,f]of bursts.entries())for(let i=0;i<8;i++){const a=i*2.4+f.id,scale=Math.max(0,1-f.t)*(.09+i%3*.035);dummy.position.set(f.x+Math.sin(a)*f.t*3,f.y+f.t*(2+i%3)-f.t*f.t*5,f.z+Math.cos(a)*f.t*3);dummy.rotation.set(f.t*6+i,f.t*5,-f.t*4+i);dummy.scale.set(scale,scale*.65,scale*1.3);dummy.updateMatrix();debris.setMatrixAt(j*8+i,dummy.matrix);}if(bursts.length){debris.instanceMatrix.needsUpdate=true;const f=bursts.at(-1);if(f.t<.55&&flash>.05){for(let i=0;i<24;i++){const a=i*2.4;pp[i*3]=f.x+Math.sin(a)*f.t*5;pp[i*3+1]=f.y+f.t*(2+i%4)-f.t*f.t*4;pp[i*3+2]=f.z+Math.cos(a)*f.t*5;}particlesGeometry.attributes.position.needsUpdate=true;particlesGeometry.setDrawRange(0,quality==='low'?12:24);particleMaterial.opacity=(1-f.t/.55)*flash;}}
  }
  return {root,marker,update,dispose(){if(closed)return;closed=true;debris.dispose();for(const {o}of cracks){o.geometry.dispose();geometries.delete(o.geometry);o.material.dispose();materials.delete(o.material);}particlesGeometry.dispose();geometries.delete(particlesGeometry);particleMaterial.dispose();materials.delete(particleMaterial);root.removeFromParent();}};
 }
 return {lights,build};
}
