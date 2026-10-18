import {blocked,move} from './portrait-core-r1295.js?v=r1465';
import {attackSlot} from './encounters-r1448.js?v=r1448';
import {downedEnemyR1447} from './combat-r1447.js?v=r1465';
import {enemyRouteDirection} from './enemy-navigation-r1446.js?v=r1465';
import {routeFloor,navigateRoute,tickRouteJump} from './world-route-r1457.js?v=r1465';
import {isMirrorDuel,updateMirrorDuel,mirrorParry} from './mirror-duel-r1463.js?v=r1465';
import {navigateCityEnemy,tickCityJump,settleCityEnemy,keepCitySupport} from './city-pursuit-r1463.js?v=r1465';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),roles=['guard','fast','shooter','heavy','duelist'];
const angle=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z),turn=(a,b,n)=>a+clamp(Math.atan2(Math.sin(b-a),Math.cos(b-a)),-n,n);
export const TACTIC_NAMES={guard:'Щитоносец',fast:'Обходчик',shooter:'Стрелок',heavy:'Тяжёлый',duelist:'Зеркальная Лира'};
export function tacticWorld(s){return s.isCity?'city':s.world|| (s.isRuins?'ruins':'portrait');}
function roleFor(s,e,index){if(e.kind==='boss'||e.kind==='dog')return null;if(isMirrorDuel(s,e))return'duelist';if(['drone','astronaut'].includes(e.kind)||e.kind==='double'&&!s.world)return'shooter';if(e.kind==='statue')return'heavy';if(e.kind==='shadow')return'fast';if(e.kind==='robot')return['guard','heavy','fast'][Math.floor(index/4)%3];return roles[index%4];}
export function assignTactic(s,e,index=0,saved=null){
 const role=roleFor(s,e,index);if(!role)return null;
 if(e.tactic?.version===1&&roles.includes(e.tactic.role)&&!saved)return e.tactic;
 const chosen=isMirrorDuel(s,e)?'duelist':saved&&roles.includes(saved.role)&&saved.role!=='duelist'?saved.role:role,shield=chosen==='guard'?36:0,armor=chosen==='heavy'?28:0;
 e.tactic={version:1,role:chosen,world:tacticWorld(s),shield:saved?clamp(Number(saved.shield)||0,0,shield):shield,shieldMax:shield,armor:saved?clamp(Number(saved.armor)||0,0,armor):armor,armorMax:armor,phase:'ready',t:0,stun:0,exposed:0,counterUsed:false,side:e.id%2?1:-1,orbitCD:1.0+e.id%3*.35,flash:0,cover:null,coverAt:0,hintAt:-10};
 if(e.hp>0&&!e.navJump&&!(e.down>0))e.mode='chase';e.t=0;e.cd=Math.max(.8,Number(e.cd)||1);return e.tactic;
}
function supported(s,p,margin=.12){return s.geo.platforms.some(f=>!f.gone&&!f.weaponCrate&&Math.abs(p.x-f.x)<f.w/2-margin&&Math.abs(p.z-f.z)<f.d/2-margin&&Math.abs((p.y||0)-f.h)<.45);}
function travel(s,e,target,speed,dt){
 if(s.isCity){navigateCityEnemy(s,e,target,speed,dt);return;}
 const old={x:e.x,y:e.y||0,z:e.z};
 if(s.routeLinks?.length){let goal=target;const f=routeFloor(s,{...target,y:target.y??s.p.y});if(!f||f.weaponCrate){const floor=routeFloor(s,s.p);if(floor)goal={x:clamp(target.x,floor.x-floor.w/2+.6,floor.x+floor.w/2-.6),z:clamp(target.z,floor.z-floor.d/2+.6,floor.z+floor.d/2-.6),y:floor.h};}navigateRoute(s,e,goal,dt,speed);}
 else{const dir=enemyRouteDirection(e,target,s.geo,s.time);move(e,dir.x*speed*dt,dir.z*speed*dt,s.geo.walls,.4);
  if(!supported(s,e)){e.x=old.x;e.z=old.z;let landing=null;for(let d=.35;d<=4;d+=.15){const p={x:old.x+dir.x*d,y:old.y,z:old.z+dir.z*d};if(supported(s,p,.25)){landing=p;break;}}if(landing)e.tactic.hop={from:old,to:landing,t:0,duration:.58+distance(old,landing)/9};}
 }
 e.vx=(e.x-old.x)/Math.max(.001,dt);e.vz=(e.z-old.z)/Math.max(.001,dt);
}
function coverFor(s,e,role){const t=e.tactic;if(s.time<t.coverAt)return s.living.find(q=>q.id===t.cover)||null;t.coverAt=s.time+.45;const candidates=s.living.filter(q=>q!==e&&q.tactic?.role===role&&(!q.tactic.shieldMax||q.tactic.shield>0)&&Math.abs((q.y||0)-(e.y||0))<1.2&&distance(e,q)<10);candidates.sort((a,b)=>distance(e,a)-distance(e,b));t.cover=candidates[0]?.id??null;return candidates[0]||null;}
function beginAttack(s,e,kind){const t=e.tactic;t.phase='windup';t.t=0;t.kind=kind;t.wind=kind==='shot'?.9:t.role==='heavy'?1.25:t.role==='fast'?.60:.82;t.active=kind==='shot'?.48:.34;t.recovery=t.role==='heavy'?1.25:t.role==='fast'?.9:.85;t.yaw=e.yaw;t.lock={x:s.p.x,y:s.p.y,z:s.p.z};t.contact=false;t.round=0;t.missed=false;e.t=0;e.mode=kind==='shot'?'aim':'windup';e.attackStep=(e.attackStep||0)+1;e.attackKind=t.role==='heavy'?'heavy':['right','left','kick'][(e.attackStep-1)%3];e.hand=e.attackKind==='left'?1:0;s.emit('tacticWarn',{enemy:e.id,role:t.role,x:e.x,y:e.y||0,z:e.z});}
function fire(s,e){const t=e.tactic;if(s.shots.length>=64||blocked(e,t.lock,s.geo.walls))return;const yaw=angle(e,t.lock),d=distance(e,t.lock)||1,speed=t.world===3?11:8.5;s.shots.push({x:e.x+Math.sin(yaw)*.7,z:e.z+Math.cos(yaw)*.7,y:e.y||0,vx:Math.sin(yaw)*speed,vz:Math.cos(yaw)*speed,vy:((t.lock.y||0)-(e.y||0))/Math.max(.25,d/speed),life:2.8,damage:6,tactical:true,reflectable:true,source:e.id,kind:t.world===3?'laser':t.world===2?'water':'plasma'});s.emit('tacticShot',{x:e.x,y:e.y||0,z:e.z,enemy:e.id});}
function strike(s,e){const t=e.tactic,p=s.p,range=t.role==='heavy'?3.2:t.role==='fast'?2.6:2.65,d=distance(e,p),facing=d<.1||((p.x-e.x)*Math.sin(t.yaw)+(p.z-e.z)*Math.cos(t.yaw))/d>.52,height=p.y-(e.y||0),hp=p.hp;
 if(d<range&&Math.abs(height)<1.3&&!(t.role==='heavy'&&height>.72)&&facing&&!blocked(e,p,s.geo.walls)){s.damage(t.role==='heavy'?16:t.role==='fast'?8:10);if(p.hp<hp&&t.role==='heavy')move(p,Math.sin(t.yaw)*.65,Math.cos(t.yaw)*.65,s.geo.walls,.4);}
 t.missed=p.hp===hp;
 if(t.role==='heavy')for(const q of s.weaponCrates||[]){const len=distance(e,q),dot=((q.x-e.x)*Math.sin(t.yaw)+(q.z-e.z)*Math.cos(t.yaw))/Math.max(.01,len);if(!q.broken&&len<3.3&&Math.abs(q.y-(e.y||0))<.7&&dot>.4&&!blocked(e,q,s.geo.walls.filter(w=>w.weaponCrateId!==q.id)))s.damageWeaponCrate?.(q.id,40,'heavy');}
 s.emit('tacticStrike',{enemy:e.id,role:t.role,x:e.x,y:e.y||0,z:e.z});
}
export function tacticalEnemy(s,e,dt){
 const t=e.tactic;if(!t)return false;dt=clamp(dt,0,.035);t.flash=Math.max(0,t.flash-dt);t.exposed=Math.max(0,t.exposed-dt);t.orbitCD=Math.max(0,t.orbitCD-dt);e.hit=Math.max(0,(e.hit||0)-dt);e.vx=e.vz=0;
 if(e.hp<=0){e.dead=Math.max(0,(e.dead||0)-dt);return true;}
 if(s.isCity&&tickCityJump(s,e,dt)){downedEnemyR1447(s,e,dt);return true;}
 if(e.navJump){downedEnemyR1447(s,e,dt);tickRouteJump(s,e,dt);return true;}
 if(t.hop){const h=t.hop;h.t+=dt;const u=clamp(h.t/h.duration,0,1);e.x=h.from.x+(h.to.x-h.from.x)*u;e.z=h.from.z+(h.to.z-h.from.z)*u;e.y=h.from.y+(h.to.y-h.from.y)*u+Math.sin(u*Math.PI)*1.65;e.mode='leap';if(u>=1){e.y=h.to.y;t.hop=null;e.homeY=e.y;}return true;}
 if(downedEnemyR1447(s,e,dt))return true;
 if(t.stun>0){t.stun=Math.max(0,t.stun-dt);e.mode='stagger';e.t=0;return true;}
 const p=s.p,d=distance(e,p),height=Math.abs((e.y||0)-p.y),los=!blocked(e,p,s.geo.walls);e.cd=Math.max(0,(e.cd||0)-dt);t.t+=dt;e.t=t.t;
 if(t.role==='duelist'){updateMirrorDuel(s,e,dt,{travel,blocked,attackSlot});return true;}
 if(t.phase==='windup'){e.yaw=t.yaw;e.mode=t.kind==='shot'?'aim':'windup';if(t.t>=t.wind){t.phase='strike';t.t=0;e.t=0;e.mode=t.kind==='shot'?'throw':'strike';}return true;}
 if(t.phase==='strike'){e.yaw=t.yaw;e.mode=t.kind==='shot'?'throw':'strike';if(t.kind==='shot'){if(t.round<2&&t.t>=t.round*.22){fire(s,e);t.round++;}}else if(!t.contact&&t.t>=.12){t.contact=true;strike(s,e);}if(t.t>=t.active){t.phase='recover';t.t=0;e.mode='recover';t.counterUsed=false;t.exposed=t.missed?t.recovery:0;if(t.exposed)s.emit('counterOpen',{enemy:e.id,x:e.x,y:e.y||0,z:e.z});}return true;}
 if(t.phase==='recover'){e.mode='recover';if(t.t<t.recovery){if(t.role==='fast'){const yaw=angle(p,e)+t.side*.55;travel(s,e,{x:p.x+Math.sin(yaw)*3.4,z:p.z+Math.cos(yaw)*3.4,y:p.y},2.7,dt);}return true;}t.phase='ready';t.t=0;e.cd=t.role==='heavy'?1.5:t.role==='shooter'?1.65:.65;t.exposed=0;}
 e.yaw=turn(e.yaw||0,angle(e,p),dt*(t.role==='guard'?2.4:5));
 if(s.isCity&&height>.36&&!['windup','strike','recover'].includes(t.phase)){e.mode='chase';travel(s,e,p,t.role==='fast'?4.25:3.1,dt);return true;}
 if(d>32||height>5){e.mode='patrol';if(d<45)travel(s,e,p,2.5,dt);return true;}
 if(t.role==='shooter'){
  if(s.isCity&&d<2.35&&height<1.4&&los&&e.cd<=0&&attackSlot(s,e)){beginAttack(s,e,'melee');return true;}
  const guard=coverFor(s,e,'guard');let goal;if(guard){const yaw=angle(p,guard),side=t.side;goal={x:guard.x+Math.sin(yaw)*2.8+Math.cos(yaw)*side*1.8,z:guard.z+Math.cos(yaw)*2.8-Math.sin(yaw)*side*1.8,y:guard.y||0};}
  else if(d<5){const yaw=angle(p,e)+t.side*.35;goal={x:p.x+Math.sin(yaw)*6.5,z:p.z+Math.cos(yaw)*6.5,y:p.y};}
  else if(d>11||!los||height>1.4)goal=p;
  if(goal&&distance(e,goal)>.7){e.mode='chase';travel(s,e,goal,2.8,dt);}
  else e.mode='circle';
  if(d>3&&d<14&&height<4&&los&&e.cd<=0&&attackSlot(s,e)){beginAttack(s,e,'shot');}return true;
 }
 const blocker=t.role==='heavy'&&(s.weaponCrates||[]).find(q=>!q.broken&&Math.abs(q.y-(e.y||0))<.6&&distance(e,q)<2.7&&distance(p,q)<d+1);
 if((d<(t.role==='heavy'?2.9:2.2)||blocker)&&height<1.4&&(los||blocker&&!blocked(e,blocker,s.geo.walls.filter(w=>w.weaponCrateId!==blocker.id)))&&e.cd<=0&&attackSlot(s,e)){if(blocker)e.yaw=angle(e,blocker);beginAttack(s,e,'melee');return true;}
 if(t.role==='fast'&&t.phase==='flank'){e.mode='circle';const yaw=angle(p,e)+t.side*.65;travel(s,e,{x:p.x+Math.sin(yaw)*2.7,z:p.z+Math.cos(yaw)*2.7,y:p.y},4.4,dt);if(t.t>.65){t.phase='ready';t.t=0;t.orbitCD=3.4;}return true;}
 if(t.role==='fast'&&d<6&&d>2.4&&t.orbitCD<=0){t.phase='flank';t.t=0;e.mode='circle';return true;}
 if(d<3.8&&(!attackSlot(s,e)||e.cd>0)){e.mode='circle';const yaw=angle(p,e)+t.side*.24;travel(s,e,{x:p.x+Math.sin(yaw)*3.3,z:p.z+Math.cos(yaw)*3.3,y:p.y},1.3,dt);return true;}
 let target=p;if(t.role==='guard'){const shooter=coverFor(s,e,'shooter');if(shooter&&d>3.2){const yaw=angle(shooter,p);target={x:shooter.x+Math.sin(yaw)*2.6,z:shooter.z+Math.cos(yaw)*2.6,y:shooter.y||0};if(distance(target,p)>distance(shooter,p))target=p;}}
 e.mode='chase';travel(s,e,target,t.role==='heavy'?2.35:t.role==='fast'?(t.world===2?4.7:4.25):3.0,dt);return true;
}
export function attachTactics(s,{saved=null}={}){
 if(s.tactics)return s;const base={load:s.load.bind(s),restore:s.restore.bind(s),spawn:s.spawn.bind(s),enemy:s.enemy.bind(s),hit:s.hit.bind(s),snapshot:s.snapshot.bind(s),action:s.action.bind(s),update:s.update.bind(s)};let restoring=false;
 function configure(data){const records=data?.tacticsR1460?.version===1&&Array.isArray(data.tacticsR1460.enemies)?data.tacticsR1460.enemies.slice(0,40):[];let i=0;for(const e of s.enemies){settleCityEnemy(s,e);const record=records.find(q=>q.id===e.id);if(e.kind!=='boss'&&e.kind!=='dog'){delete e.tactic;assignTactic(s,e,i++,record||null);}else delete e.tactic;}s.shots=s.shots.filter(q=>!s.enemies.some(e=>isMirrorDuel(s,e)&&q.source===e.id));}
 s.spawn=function(...args){const e=base.spawn(...args);assignTactic(s,e,this.enemies.filter(q=>q!==e&&q.kind!=='boss'&&q.kind!=='dog').length);return e;};
 s.load=function(...args){const result=base.load(...args);this.dodge1460=null;this.tacticalInput=null;if(!restoring)configure(null);return result;};
 s.restore=function(data){restoring=true;try{const result=base.restore(data);configure(data);return result;}finally{restoring=false;}};
 s.enemy=function(e,dt){if(e.kind==='boss')return base.enemy(e,dt);if(e.kind==='dog'){
  if(this.isCity&&e.hp>0){if(downedEnemyR1447(this,e,dt))return;if(tickCityJump(this,e,dt))return;const d=distance(e,this.p),height=Math.abs((e.y||0)-this.p.y);if((this.p.y>.5||e.y>.5)&&!['windup','strike'].includes(e.mode)&&(d>1.65||height>.8||blocked(e,this.p,this.geo.walls))){e.hit=Math.max(0,(e.hit||0)-dt);e.cd=Math.max(0,(e.cd||0)-dt);e.yaw=angle(e,this.p);e.mode='chase';navigateCityEnemy(this,e,this.p,4.1,dt);return;}}
  const before={x:e.x,y:e.y||0,z:e.z};const result=base.enemy(e,dt);keepCitySupport(this,e,before);return result;
 }if(!e.tactic)assignTactic(this,e,this.enemies.filter(q=>q.kind!=='boss'&&q.kind!=='dog').indexOf(e));if(tacticalEnemy(this,e,dt))return;return base.enemy(e,dt);};
 s.hit=function(e,n,knock=.5){
  if(mirrorParry(this,e)){base.hit(e,Math.max(1,Math.round(n*.20)),0);e.mode='recover';e.t=0;return;}
  const t=e.tactic;if(!t||e.hp<=0)return base.hit(e,n,knock);const a=this.attack,blade=a?.kind==='slash',bat=blade&&this.weaponStats?.selected==='bat',counter=blade&&!bat&&t.exposed>0&&!t.counterUsed,front=distance(e,this.p)<.1||Math.cos(angle(e,this.p)-(e.yaw||0))>.42,shielded=t.shield>0&&front&&!['windup','strike','recover'].includes(t.phase)&&t.stun<=0&&!(e.down>0)&&a?.kind!=='finish';
  if(shielded){const oldMode=e.mode,oldT=e.t,oldDown=e.down||0,airT=e.airT||0,airHeight=e.airHeight||0,cost=bat?28+(this.weaponStats?.level||0)*4:a?.kind==='attack'?24:a?.kind==='scream'?40:a?.kind==='kick'?14:6+(this.weaponStats?.level||0)*2;t.shield=Math.max(0,t.shield-cost);t.flash=.2;this.emit('shieldHit',{x:e.x,y:e.y||0,z:e.z,enemy:e.id,broken:!t.shield});base.hit(e,Math.max(1,Math.round(n*(t.shield>0?.12:.5))),0);
   if(e.hp>0&&t.shield>0){e.mode=oldMode;e.t=oldT;e.down=oldDown;e.airT=airT;e.airHeight=airHeight;}else if(e.hp>0){t.stun=1.15;t.phase='ready';e.down=0;e.mode='stagger';this.emit('shieldBreak',{x:e.x,y:e.y||0,z:e.z,enemy:e.id});}
   if(this.time>t.hintAt){t.hintAt=this.time+7;this.emit('notice',{text:t.shield?'Щит спереди · обойди сбоку или разбей битой':'Щит разбит · атакуй!'});}return;
  }
  if(t.armor>0&&a?.kind!=='finish'){t.armor=Math.max(0,t.armor-(bat?24:counter?18:a?.kind==='scream'?30:a?.kind==='attack'?20:3));if(!t.armor){t.stun=.9;t.phase='ready';t.t=0;this.emit('armorBreak',{x:e.x,y:e.y||0,z:e.z,enemy:e.id});}else if(!bat&&!counter)n=Math.max(1,Math.round(n*.72));}
  if(counter){t.counterUsed=true;t.exposed=0;n=Math.round(n*1.5);this.emit('counterHit',{x:e.x,y:e.y||0,z:e.z,enemy:e.id});}
  base.hit(e,n,bat?Math.max(knock,a.step===2?2.05:.85):knock);
  if(e.hp>0&&e.down>0){t.phase='ready';t.t=0;t.contact=false;t.exposed=0;}
  if(e.hp>0&&bat){t.stun=Math.max(t.stun,a.step===2?.85:.55);t.phase='ready';this.emit('batStun',{x:e.x,y:e.y||0,z:e.z,enemy:e.id});}
  else if(e.hp>0&&blade&&t.armor<=0){t.stun=Math.max(t.stun,counter?.45:.16);if(counter){t.phase='ready';t.t=0;}}
 };
 s.action=function(kind){
  if(!['dodge','dash'].includes(kind))return base.action(kind);
  if(this.vehicleActive||this.race?.mounted&&!this.race.finished)return base.action(kind==='dodge'?'dash':kind);
  const p=this.p;if(this.dead||this.won||this.finale||p.down>0||this.dashCD>0||p.energy<18||this.attack?.kind==='finish')return false;
  const input=this.tacticalInput||{},len=Math.hypot(input.x||0,input.z||0),x=len>.1?input.x/len:-Math.sin(p.yaw),z=len>.1?input.z/len:-Math.cos(p.yaw);
  this.attack=null;this.queued=false;this.dash=.22;this.dashCD=.90;p.energy-=18;p.inv=Math.max(p.inv,.26);p.vx=x*11;p.vz=z*11;
  this.dodge1460={x,z,t:.30,duration:.30};this.emit('dodge',{x:p.x,y:p.y,z:p.z});return true;
 };
 s.update=function(dt,input={}){this.tacticalInput=input;base.update(dt,input);if(this.dodge1460){this.dodge1460.t=Math.max(0,this.dodge1460.t-dt);if(this.dodge1460.t<.0001)this.dodge1460=null;}};
 s.snapshot=function(){return{...base.snapshot(),tacticsR1460:{version:1,enemies:s.enemies.filter(e=>e.tactic).map(e=>({id:e.id,role:e.tactic.role,shield:e.tactic.shield,armor:e.tactic.armor}))}};};
 s.tactics={version:1,describe:e=>TACTIC_NAMES[e.tactic?.role]||'',configure};configure(saved);return s;
}
