import * as T from './vendor/three-r170.module.min.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const palette={city:[0x374957,0x95dcd9],portrait:[0x4c394f,0xe8c5c0],ruins:[0x697d76,0xb8e8b7],2:[0x753e42,0xffba88],3:[0x354f6b,0x8ae9ff],4:[0x8e7045,0xffd282],5:[0x654a89,0xd2b1ff]};
export function tacticalViewKit(geometries,materials){
 const shape={ball:new T.SphereGeometry(1,12,8),box:new T.BoxGeometry(1,1,1),disc:new T.CylinderGeometry(1,1,1,12),ring:new T.TorusGeometry(1,.08,5,16),blade:new T.ConeGeometry(1,1,5)};Object.values(shape).forEach(g=>geometries.add(g));const cache=new Map();
 function mat(c,glow=0){const key=c+':'+glow;if(!cache.has(key)){const m=new T.MeshStandardMaterial({color:c,roughness:.46,metalness:.58,emissive:c,emissiveIntensity:glow});materials.add(m);cache.set(key,m);}return cache.get(key);}
 // Warm all palettes once: restarts never allocate new materials or geometry.
 for(const [base,accent]of Object.values(palette))for(const c of [base,accent,0x172535,0xffe7b8])for(const glow of [0,.7])mat(c,glow);
 function put(parent,k,c,x,y,z,sx,sy=sx,sz=sx,glow=0){const o=new T.Mesh(shape[k],mat(c,glow));o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
 function make(root,e){
  const t=e.tactic,u=root.userData,[base,accent]=palette[t.world]||palette.portrait,gear=new T.Group();gear.name='Tactical-'+t.role;gear.scale.setScalar(root.scale.x<.1?1/root.scale.x:1);(u.automaton?root:u.body||root).add(gear);const g={gear,shield:null,armor:[],fins:[],weapon:null,claws:[],eyes:[],role:t.role};
  if(t.role==='guard'){
   const shield=new T.Group();shield.position.set(-.43,1.16,.45);shield.name='Breakable-front-shield';gear.add(shield);g.shield=shield;
   if(t.world===2){put(shield,'ball',base,0,0,0,.54,.67,.20);for(let i=-2;i<=2;i++){const ridge=put(shield,'ring',accent,0,-.05,-.05,.17+Math.abs(i)*.06,.55,.18);ridge.rotation.z=i*.24;}}
   else if(t.world===4||t.world==='ruins'){const disc=put(shield,'disc',base,0,0,0,.55,.13,.55);disc.rotation.x=Math.PI/2;for(let i=0;i<10;i++){const a=i*Math.PI/5,bit=put(shield,'box',accent,Math.sin(a)*.54,Math.cos(a)*.54,0,.16,.16,.15);bit.rotation.z=-a;}put(shield,'ring',accent,0,0,.08,.35);}
   else{put(shield,'box',base,0,0,0,.85,1.05,.14);for(const x of [-.39,.39])put(shield,'box',accent,x,0,.08,.035,.96,.04);put(shield,'box',accent,0,.45,.08,.78,.04,.035);put(shield,'box',0x172535,0,.13,.09,.55,.23,.04);}
   put(shield,'box',accent,0,-.20,.13,.29,.045,.035,.7);
  }
  if(t.role==='heavy'){
   for(const side of [-1,1]){const o=put(gear,'ball',base,side*.40,1.47,0,.29,.26,.28);g.armor.push(o);put(o,'ring',accent,0,0,.7,.8,.8,.2);}
   const chest=put(gear,t.world===5?'box':'ball',base,0,1.23,.08,.39,.37,.28);g.armor.push(chest);
   const weapon=new T.Group();weapon.position.set(.44,1.43,0);gear.add(weapon);g.weapon=weapon;
   const handle=put(weapon,'disc',0x172535,0,-.63,0,.06,1.18,.06);handle.rotation.z=-.07;
   if(t.world===2){const anchor=put(weapon,'ring',accent,0,-1.03,0,.36,.42,.18);anchor.rotation.z=Math.PI/2;for(const side of [-1,1]){const claw=put(weapon,'blade',base,side*.28,-.99,.01,.16,.44,.18);claw.rotation.z=-side*.65;}}
   else{put(weapon,t.world==='city'?'ball':'box',base,0,-1.04,0,.60,.30,.30);put(weapon,'ring',accent,0,-1.04,.3,.20);}
  }
  if(t.role==='fast'){
   for(const side of [-1,1]){const fin=put(gear,'blade',base,side*.36,1.34,-.17,.19,.64,.12);fin.rotation.z=-side*.75;g.fins.push(fin);put(gear,'blade',accent,side*.27,.37,.17,.07,.4,.07,.7);}
   const band=put(gear,'ring',accent,0,1.72,0,.27,.12,.27);band.rotation.x=Math.PI/2;
  }
  if(t.role==='shooter'&&u.worldShape!=='drone'){
   const gun=new T.Group();gun.position.set(.42,1.24,.25);gear.add(gun);g.weapon=gun;
   put(gun,'box',base,0,0,.22,.19,.22,.65);const barrel=put(gun,'disc',accent,0,0,.59,.065,.2,.065,.7);barrel.rotation.x=Math.PI/2;put(gun,'ball',accent,0,.16,.15,.06,.06,.06,.7);
   for(const side of [-1,1])put(gear,'disc',base,side*.16,1.3,-.33,.11,.57,.11);
  }
  if(t.world===2){
   // Shells, stalked eyes and articulated pincers turn the divers into sea raiders.
   if(u.head)u.head.visible=false;const shell=put(gear,'ball',base,0,1.50,-.02,t.role==='heavy'?.53:.40,.37,.35);g.shell=shell;
   for(const side of [-1,1]){put(gear,'disc',base,side*.21,1.88,.16,.035,.24,.035);put(gear,'ball',0x172535,side*.21,2.02,.17,.09,.09,.09);put(gear,'ball',accent,side*.22,2.03,.245,.036,.036,.018,.7);
    const claw=new T.Group();claw.position.set(side*.48,1.24,.08);gear.add(claw);put(claw,'ball',base,0,-.14,.10,.16,.23,.16);for(const sign of [-1,1]){const finger=put(claw,'blade',accent,sign*.105,-.26,.18,.09,.32,.12);finger.rotation.z=-sign*.4;g.eyes.push(finger);}g.claws.push(claw);}
  }
  if(t.world==='portrait'){for(const side of [-1,1])put(gear,'ball',accent,side*.09,1.74,.247,.035,.06,.025,.7);}
  if(t.world===3&&e.kind==='astronaut'){const visor=put(gear,'ball',0x172535,0,1.76,.15,.25,.17,.15);put(visor,'box',accent,0,0,.9,.72,.10,.035,.7);}
  root.userData.tactical1460=g;return g;
 }
 function enemy(root,e,state){
  if(!e.tactic)return;let g=root.userData.tactical1460;if(!g)g=make(root,e);const t=e.tactic,u=root.userData,alive=e.hp>0,down=e.down>0,wind=t.phase==='windup',strike=t.phase==='strike',warn=clamp(t.t/Math.max(.01,t.wind||1),0,1),impact=strike?Math.sin(Math.PI*clamp(t.t/Math.max(.01,t.active||.34),0,1)):0;
  g.gear.visible=alive||e.dead>0;if(g.shield){g.shield.visible=t.shield>0;g.shield.rotation.y=t.flash>0?Math.sin(state.time*50)*.12:Math.sin(state.time*2)*.025;g.shield.position.z=t.flash>0?.37:.45;const lowered=['windup','strike','recover'].includes(t.phase);g.shield.position.y=lowered?.84:1.16;g.shield.rotation.z=lowered?-.24:0;}
  for(const o of g.armor)o.visible=t.armor>0;
  for(const [i,o]of g.fins.entries())o.rotation.x=Math.sin(state.time*8+i)*.12;
  if(!alive||down)return;
  if(g.weapon&&t.role==='heavy')g.weapon.rotation.x=wind?-2.25*warn:strike?-2.25+2.9*impact:t.phase==='recover'?.52:0;
  if(g.weapon&&t.role==='shooter')g.weapon.rotation.x=wind?-.10:Math.sin(state.time*2)*.04;
  for(const [i,c]of g.claws.entries()){c.rotation.x=wind?-.9*warn:-impact*1.7+Math.sin(state.time*4+i)*.10;c.rotation.z=(i?1:-1)*(.13+impact*.16);}
  for(const [i,o]of g.eyes.entries())o.rotation.z=(i%2?1:-1)*(.4+Math.sin(state.time*3)*.10);
  if(!u.limbs?.length)return;
  if(t.role==='heavy'){
   u.body.rotation.x=wind?-.18*warn:strike?.48*impact:t.phase==='recover'?.25:0;
   for(const l of u.limbs){l.arm.rotation.x=wind?-2.2*warn:strike?-2.2+2.9*impact:-.18;l.fore.rotation.x=wind?-.7:-.35;l.shin.rotation.x=wind?.3*warn:.12;}
  }else if(t.role==='guard'&&t.shield>0&&!strike){const l=u.limbs[0];l.arm.rotation.set(-.68,0,-.2);l.fore.rotation.x=-1.15;}
  else if(t.role==='fast'&&['flank','recover'].includes(t.phase)){u.body.rotation.x=.22;u.body.rotation.z=t.side*.12;for(const [i,l]of u.limbs.entries()){l.leg.rotation.x=Math.sin(state.time*13+i*Math.PI)*.55;l.arm.rotation.x=-.5;l.fore.rotation.x=-1.0;}}
  else if(t.role==='shooter'&&['windup','strike'].includes(t.phase)){for(const l of u.limbs){l.arm.rotation.x=-1.25;l.fore.rotation.x=-.35;}}
  u.head.rotation.z=t.stun>0?Math.sin(state.time*24)*.13:0;if(t.stun>0)u.body.rotation.x-=.20;
 }
 return {enemy};
}
export function poseDodge(root,state){
 const d=state.dodge1460,u=root.userData;if(!d||!u?.limbs||state.p.down>0)return;
 const k=Math.sin(Math.PI*clamp(1-d.t/d.duration,0,1)),unit=root.scale.x<.1?1/root.scale.x:1,side=d.x*Math.cos(state.p.yaw)-d.z*Math.sin(state.p.yaw),forward=d.x*Math.sin(state.p.yaw)+d.z*Math.cos(state.p.yaw);
 u.body.position.y-=.32*unit*k;u.body.rotation.x=-forward*.55*k;u.body.rotation.z=-side*.4*k;u.head.rotation.x=.15*k;
 for(const [i,l]of u.limbs.entries()){l.leg.rotation.x=(i?-.95:.60)*k;l.shin.rotation.x=1.1*k;l.arm.rotation.x=-.9*k;l.fore.rotation.x=-1.25*k;}
}
