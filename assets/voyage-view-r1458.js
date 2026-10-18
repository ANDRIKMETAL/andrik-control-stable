import * as T from './vendor/three-r170.module.min.js';
import {courseX,courseY,voyageMounted} from './voyage-core-r1458.js?v=r1459';
import {poseRidingKick} from './bike-combat-r1458.js?v=r1459';
export function createVoyageView(scene,assets,lifeKit){
 const root=new T.Group();root.name='Vehicle-episode';scene.add(root);const {put,shape,mat}=assets;let voyage=null,life=null,player,foes=[],hazards=[],gates=[],pickups=[],bullets=[],bots=[],shield,trail=[],owned=[];
 function clear(){life?.dispose();life=null;for(const o of owned)o.dispose();owned=[];root.clear();foes=[];hazards=[];gates=[];pickups=[];bullets=[];bots=[];trail=[];}
 function build(v){clear();voyage=v;if(!v)return;const space=v.kind==='space';life=lifeKit.build(root,{world:space?3:2,zone:0,vehicle:true,geo:{length:v.length},seaY:-.18});
  player=space?assets.ship():assets.jetski(0xe8c46d);root.add(player);shield=put(player,'ball',0x6bd8ef,0,.1,0,2.8,1.4,3.4,.3,.14);shield.name='Vehicle-shield';
  for(const q of v.gates){const g=new T.Group();g.name='Vehicle-gate-'+q.id;g.position.set(q.x,space?q.y:0,q.z);root.add(g);
   if(space){put(g,'ring',0x68f0df,0,0,0,q.r,q.r,q.r,.8);for(const side of [-1,1]){const a=put(g,'box',0xc6fff0,side*.42,0,0,.1,.85,.12,.8);a.rotation.z=side*.65;}}
   else{for(const side of [-1,1]){put(g,'ball',side<0?0xee664e:0x75e2a9,side*q.r,.38,0,.42,.62,.42);put(g,'cyl',0xe5e4bc,side*q.r,1.0,0,.04,.8,.04);const flag=put(g,'cone',side<0?0xef7860:0x96efb7,side*q.r+.18,1.3,0,.28,.55,.03);flag.rotation.z=-Math.PI/2;}}
   gates.push({o:g,q});}
  for(const q of v.obstacles){let o;if(q.type==='meteor'){o=put(root,'rock',0x6a6878,q.x,q.y,q.z,q.r);}
   else if(q.type==='shark'){o=assets.shark();o.scale.setScalar(1.5);o.position.set(q.x,-.2,q.z);root.add(o);}
   else if(q.type==='vortex'){o=new T.Group();o.position.set(q.x,0,q.z);root.add(o);for(let i=0;i<5;i++){const r=put(o,'ring',i%2?0x1b5b68:0x8ec8c5,0,-.05-i*.035,0,q.r-i*.6,q.r-i*.6,q.r-i*.6,.05);r.rotation.x=-Math.PI/2;}}
   else{o=new T.Group();o.position.set(q.x,0,q.z);root.add(o);const ramp=put(o,'box',0xd2a866,0,.35,0,4.9,.24,5.6);ramp.rotation.x=.20;for(const x of [-1.9,1.9]){const stripe=put(o,'box',0xa0fff0,x,.50,0,.12,.04,5.2,.4);stripe.rotation.x=.20;}const arrow=put(o,'cone',0xeeeee0,0,.60,.5,.55,1.25,.03);arrow.rotation.x=Math.PI/2;}
   o.name='Vehicle-obstacle-'+q.id;hazards.push({o,q});}
  for(const q of v.pickups){const color={weapon:0xe7a1ff,rocket:0xffba6e,shield:0x6edfed,repair:0x8cffb0,boost:0x8addff,crystal:0xffe28c}[q.type],g=new T.Group();g.position.set(q.x,(space?q.y:0)+.6,q.z);root.add(g);put(g,'rock',color,0,0,0,.52,.52,.52,.7);put(g,'ring',color,0,0,0,.78,.78,.78,.4);g.name='Vehicle-pickup-'+q.id;pickups.push({o:g,q});}
  for(const e of v.enemies){const o=assets.ship(true);o.scale.setScalar(.72);o.rotation.y=Math.PI;root.add(o);foes.push({o,e});}
  for(const b of v.bots){const o=assets.jetski([0xdb7456,0xbf4755,0x8f9eac,0x4bc5bd][b.id]),rider=assets.crab([0xa9472c,0xbd4c43,0x8c6b4d,0x3d9e9c][b.id]);o.add(rider);o.name='Crayfish-racer-'+b.id;root.add(o);bots.push({o,b,rider});}
  for(let i=0;i<16;i++){const o=put(root,'ball',space?0x7eeeff:0xc2f0e7,0,0,0,.07,.07,.25,.2,.55);o.name='Vehicle-trail-'+i;trail.push(o);}
  const finish=new T.Group();finish.position.set(courseX(v.kind,v.length),space?courseY(v.length):0,v.length);root.add(finish);put(finish,'ring',0xa9ffe3,0,space?0:2.5,0,space?6:6,space?6:4,space?6:6,.8);
 }
 function sync(v){if(v!==voyage)build(v);root.visible=voyageMounted(v);return root.visible;}
 function draw(state,hero,camera,quality='auto'){
  const v=state.voyage;if(!sync(v))return false;const p=v.p,space=v.kind==='space',t=v.time;
  player.position.set(p.x,p.y+(space?0:Math.sin(t*3)*.035),p.z);player.rotation.set(space?-Math.atan2(p.vy,Math.max(1,p.vz))*.65:-Math.min(.22,p.vy*.018),p.yaw,-p.vx*.035);shield.visible=v.shield>0;shield.rotation.y=t*.8;
  const u=hero.userData;hero.visible=true;hero.scale.setScalar(space?.66:1);hero.position.set(p.x,p.y+(space?.05:.0),p.z-(space?.25:.32));hero.rotation.set(0,p.yaw,0);u.body.position.set(0,-.25,0);u.body.rotation.set(.17,0,-p.vx*.014);u.head.rotation.set(0,0,0);u.guitar.visible=false;if(u.blade)u.blade.visible=false;if(u.bat)u.bat.visible=false;if(u.bladeTrace)u.bladeTrace.visible=false;
  for(const [i,l]of u.limbs.entries()){l.leg.rotation.set(-1.22,0,i?.15:-.15);l.shin.rotation.set(1.65,0,0);l.arm.rotation.set(-1.05,0,i?.24:-.24);l.fore.rotation.set(-.20,0,0);}if(!space)poseRidingKick(hero,v.kick);
  for(const {o,e}of foes){o.visible=e.hp>0&&e.z>p.z-15&&e.z<p.z+145;o.position.set(e.x,e.y,e.z);o.rotation.set(Math.sin(t+e.id)*.04,Math.PI,Math.sin(t*1.4+e.id)*.10);if(e.wind>0)o.scale.setScalar(.72+Math.sin(t*18)*.02);else o.scale.setScalar(.72);}
  for(const {o,b,rider}of bots){o.visible=(!b.finished||Math.abs(b.z-p.z)<60)&&Math.abs(b.z-p.z)<140;o.position.set(b.x,b.y,b.z);o.rotation.set(-Math.min(.25,b.vy*.015),Math.atan2(courseX('water',b.z+2)-courseX('water',b.z),2),b.down>0?(b.id%2?1:-1)*1.15:Math.sin(t*2+b.id)*.035);for(const {arm,jaw,side}of rider.userData.claws){arm.rotation.x=b.wind>0?-1.1-Math.sin(t*8)*.1:Math.sin(t*1.8+b.id)*.10;arm.rotation.z=side*(b.wind>0?.18:.02);jaw.rotation.y=side*(.25+Math.sin(t*5+b.id)*.22);}rider.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*3+i)*.09);}
  for(const {o,q}of hazards){o.visible=(q.type!=='meteor'||q.hp>0)&&q.z>p.z-30&&q.z<p.z+180;if(q.type==='meteor')o.rotation.set(t*.16+q.r,t*.1,t*.08+q.r);else if(q.type==='vortex')o.rotation.y=t*.9;else if(q.type==='shark'){o.position.y=-.25+Math.max(0,Math.sin(t*.8+q.z))*1.05;o.rotation.y=Math.sin(t*.5+q.z)*.35;o.userData.tail.rotation.y=Math.sin(t*4+q.z)*.3;}}
  for(const {o,q}of gates){o.visible=!q.passed&&!q.missed&&q.z>p.z-10&&q.z<p.z+190;if(space)o.rotation.z=Math.sin(t*.4+q.id)*.035;}
  for(const {o,q}of pickups){o.visible=!q.taken&&q.z>p.z-5&&q.z<p.z+135;o.rotation.y=t*1.2;o.rotation.z=t*.6;}
  for(const [i,q]of v.shots.entries()){if(!bullets[i]){const o=put(root,'ball',0x82ffe9,0,0,0,.08,.08,.75,1.3);o.name='Vehicle-projectile-'+i;bullets[i]=o;}const o=bullets[i];o.visible=true;o.position.set(q.x,q.y,q.z);o.rotation.set(-Math.atan2(q.vy,Math.hypot(q.vx,q.vz)),Math.atan2(q.vx,q.vz),0);o.scale.set(q.rocket?.18:.08,q.rocket?.18:.08,q.rocket?.50:.75);o.material=mat(q.friendly?q.rocket?0xffd08e:0x80ffe4:0xff577a,1.3);}bullets.forEach((o,i)=>{if(i>=v.shots.length)o.visible=false;});
  trail.forEach((o,i)=>{o.visible=v.countdown<=0&&v.speed>2&&v.status==='active';o.position.set(p.x+Math.sin(t*7+i)*.25,p.y+(space?-.10:.06),p.z-2.4-i*.55);o.scale.set(space?.08:.16,space?.08:.025,space?.45:.35);});
  const target=new T.Vector3(p.x,p.y+(space?.7:1.1),p.z+(space?17:12)),desired=new T.Vector3(p.x+.35,p.y+(space?3.4:3.0),p.z-(space?10:8));camera.position.lerp(desired,.18);camera.lookAt(target);life.update(t,p,camera,quality);
  return true;
 }
 return{root,sync,draw,dispose(){clear();root.removeFromParent();}};
}
