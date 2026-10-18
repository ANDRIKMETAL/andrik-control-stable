import * as T from './vendor/three-r170.module.min.js';
import {CHASE_LENGTH,CHASE_FENCE,CHASE_RAMPS,CHASE_POINTS,CHASE_HAZARDS,chaseCenter,chaseHeading} from './bike-chase-r1464.js?v=r1466';
export function buildChaseTrack({group,mesh,material,geometries,materials,cityText,cityCar}){
 const asphalt=material('#172532',.65,.12),curb=material('#526e7a',.65,.35),gold=material('#f0c56c',.45,.3,.3),cyan=material('#69e8de',.3,.3,.65),dark=material('#101c29');
 function ribbon(name,left,right,y,mat){
  const positions=[];for(let z=0;z<CHASE_LENGTH;z+=4){const next=Math.min(CHASE_LENGTH,z+4),a=chaseCenter(z),b=chaseCenter(next);positions.push(a+left,y,z,b+left,y,next,a+right,y,z,a+right,y,z,b+left,y,next,b+right,y,next);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometries.add(geometry);const road=new T.Mesh(geometry,mat);road.name=name;road.receiveShadow=true;road.userData.dynamic=true;group.add(road);return road;
 }
 ribbon('Chase-road',-6.5,6.5,0,asphalt);ribbon('Chase-left-edge',-6.6,-6.25,.025,gold);ribbon('Chase-right-edge',6.25,6.6,.025,gold);
 for(let z=0;z<CHASE_LENGTH;z+=8){const x=chaseCenter(z),yaw=chaseHeading(z);for(const side of [-1,1]){const rail=mesh(group,'box',curb,x+side*6.7,.43,z,.20,.76,8.2);rail.rotation.y=yaw;mesh(group,'box',cyan,x+side*6.84,.85,z,.05,.05,1.6);}const line=mesh(group,'box',gold,x,.025,z,.12,.025,2.8);line.rotation.y=yaw;}
 for(let z=24;z<1160;z+=32)for(const side of [-1,1]){
  const x=chaseCenter(z),h=10+(z%5)*2;mesh(group,'box',material(side<0?'#263e50':'#303948'),x+side*19,h/2-1,z,10,h,20);
  for(let y=2;y<h-2;y+=4)for(const dz of [-6,0,6])mesh(group,'box',material((z+y+dz)%3?'#1b3044':'#dbbc86',.7,.1,(z+y+dz)%3?0:.5),x+side*13.95,y,z+dz,.03,1.6,1.8);
  const lamp=mesh(group,'cylinder',curb,x+side*7.6,3.2,z,.06,6.4,.06);const arm=mesh(group,'box',curb,x+side*7,6.3,z,1.2,.08,.1);mesh(group,'ball',cyan,x+side*6.45,6.18,z,.2,.06,.15);
 }
 for(const [i,[at,x]]of CHASE_POINTS.entries()){
  if(!i||x===CHASE_POINTS[i-1][1]||at>1140)continue;const z=Math.max(15,CHASE_POINTS[i-1][0]-20),side=x>CHASE_POINTS[i-1][1]?-1:1;
  cityText(side<0?'<<<':'>>>',chaseCenter(z)+side*5.8,2.6,z,3.1,'#f5cd72');mesh(group,'cylinder',curb,chaseCenter(z)+side*5.8,1.2,z,.055,2.4,.055);
 }
 const wedgeGeometry=new T.BufferGeometry(),v=[-.5,0,0,.5,0,0,-.5,1,1,.5,1,1,-.5,0,1,.5,0,1],order=[0,2,1,1,2,3,0,4,2,1,3,5,2,4,3,3,4,5,0,1,4,1,5,4],a=[];for(const i of order)a.push(...v.slice(i*3,i*3+3));wedgeGeometry.setAttribute('position',new T.Float32BufferAttribute(a,3));wedgeGeometry.computeVertexNormals();geometries.add(wedgeGeometry);
 for(const r of CHASE_RAMPS){
  const g=new T.Group();g.name=r.final?'Chase-final-ramp':'Chase-ramp-'+r.id;g.userData.dynamic=true;group.add(g);
  const ramp=new T.Mesh(wedgeGeometry,r.final?gold:curb);ramp.position.set(chaseCenter(r.start)+r.lane,.02,r.start);ramp.scale.set(r.width,r.height,r.end-r.start);ramp.receiveShadow=true;g.add(ramp);
  for(let z=r.start+2;z<r.end;z+=3)for(const side of [-1,1])mesh(g,'box',cyan,chaseCenter(z)+r.lane+side*(r.width/2-.10),(z-r.start)/(r.end-r.start)*r.height+.05,z,.07,.06,.8);
  cityText(r.final?'ESCAPE  /  C >>>':'RAMP',chaseCenter(r.start)+r.lane,3.5,r.start-12,r.final?5:3,'#79efe1');
 }
 for(const q of CHASE_HAZARDS){if(q.type==='van'){const van=cityCar({...q,variant:1});van.rotation.y=chaseHeading(q.z);}else{const b=mesh(group,'box',gold,q.x,.52,q.z,1.9,1.04,.65);b.rotation.y=chaseHeading(q.z);for(const dx of [-.6,0,.6])mesh(group,'box',dark,q.x+dx,.52,q.z-.34,.22,1,.025);}}
 const fence=new T.Group();fence.name='Chase-wire-fence';fence.userData.dynamic=true;fence.position.set(chaseCenter(CHASE_FENCE),0,CHASE_FENCE);group.add(fence);
 const lines=[];for(let x=-10;x<=10;x+=.45){for(let y=0;y<4;y+=.5){lines.push(x,y,0,x+.45,y+.5,0,x+.45,y,0,x,y+.5,0);}}
 for(let x=-10;x<10;x+=.23){const phase=x*8;lines.push(x,4.14+Math.sin(phase)*.22,.20*Math.cos(phase),x+.23,4.14+Math.sin(phase+1.84)*.22,.20*Math.cos(phase+1.84));if(Math.round(x*100)%3===0)lines.push(x-.1,4.4,0,x+.1,4.0,0);}
 const wireGeometry=new T.BufferGeometry();wireGeometry.setAttribute('position',new T.Float32BufferAttribute(lines,3));geometries.add(wireGeometry);const wireMat=new T.LineBasicMaterial({color:0xc0d3d9,transparent:true,opacity:.85});materials.add(wireMat);fence.add(new T.LineSegments(wireGeometry,wireMat));
 for(let x=-10;x<=10;x+=5){mesh(fence,'cylinder',curb,x,2.15,0,.07,4.3,.07);mesh(fence,'box',gold,x,3.8,0,.18,.13,.2);}
 cityText('NO WAY BACK',0,5.2,CHASE_FENCE,8,'#e9c682');cityText('FREEDOM',0,4.3,1248,7,'#7ef5de');
 for(const side of [-1,1]){mesh(group,'box',dark,side*17,4,1238,15,8,38);for(let z=1226;z<1255;z+=7)mesh(group,'ball',cyan,side*7.2,.24,z,.10,.10,.10);}
 return fence;
}
