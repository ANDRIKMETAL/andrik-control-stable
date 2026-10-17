// Shared combat rules; no renderer or timers outside the state simulation.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const modernBoss=state=>state.isCity||!state.isRuins;
export function bossDamage(state,enemy,amount){
 return enemy.kind==='boss'&&modernBoss(state)?Math.max(1,Math.round(amount*(state.bossOpen>0?1.25:.40))):amount;
}
export function attackSlot(state,enemy){
 const active=state.living.filter(e=>e!==enemy&&e.kind!=='boss'&&!(e.down>0)&&['windup','strike','throw','aim'].includes(e.mode)).length;
 return active+(state.bossAction?1:0)<2;
}
export function facesTarget(enemy,target,threshold=.45){
 const d=distance(enemy,target);return d<.15||((target.x-enemy.x)*Math.sin(enemy.yaw)+(target.z-enemy.z)*Math.cos(enemy.yaw))/d>=threshold;
}
export function waitForAttack(state,e,dt,move){
 const p=state.p,d=distance(e,p);e.mode='circle';
 const angle=Math.atan2(e.x-p.x,e.z-p.z),side=e.id%2?1:-1;
 const radial=clamp((d-3.7)*1.2,-1.5,1.5);
 move(e,(-Math.sin(angle)*radial+Math.cos(angle)*side*.9)*dt,(-Math.cos(angle)*radial-Math.sin(angle)*side*.9)*dt,state.geo.walls,.48);
}
export function tuneBoss(state,e){
 if(e.bossRevision===1448)return;
 const ratio=clamp(e.hp/(Number.isFinite(e.max)&&e.max>0?e.max:(state.isCity?600:1000)),0,1);e.max=state.isCity?480:520;e.hp=ratio>0?Math.max(1,Math.round(e.max*ratio)):0;
 e.bossRevision=1448;e.step=Number(e.step)||0;e.summons=state.phase>=2?1:0;
 state.bossAction=null;state.bossClock=0;state.bossOpen=2.8;
 // Old Portrait saves may contain two strong doubles and broken arena tiles.
 if(!state.isCity){
  const adds=state.enemies.filter(q=>q!==e&&q.hp>0);for(const q of adds.slice(1)){q.hp=0;q.dead=.3;}
  if(adds[0]){const q=adds[0];q.kind='shadow';q.max=35;q.hp=Math.min(q.hp,35);q.echoAt=0;q.comboLeft=1;}
  for(const f of state.geo.platforms){f.gone=false;f.fragile=false;f.age=0;}
 }
 state.emit('notice',{text:state.isCity?'Надзиратель: уходи в сторону от рывка, затем контратакуй.':'Портрет: ядро светится голубым — время для сильного удара.'});
}
export function updateArenaBoss(state,e,dt,{move,blocked,enemyRouteDirection}){
 tuneBoss(state,e);if(e.hp<=0)return;
 const p=state.p,d=distance(e,p),ratio=e.hp/e.max,phase=ratio>.66?1:ratio>.33?2:3;
 const oldPhase=state.phase;state.phase=phase;if(oldPhase!==phase)state.emit('phase');
 e.hit=Math.max(0,e.hit-dt);e.vx=e.vz=0;e.t=(e.t||0)+dt;
 if(!state.isCity&&phase>=2){
  const bit=phase===2?1:2;
  if(!(e.summons&bit)&&!state.living.some(q=>q!==e)){
   e.summons=(e.summons||0)|bit;
   const add=state.spawn(phase===2?'shadow':'mask',e.x>0?-6:6,Math.max(10,e.z-5));add.cd=2.5;add.comboLeft=1;
   state.emit('notice',{text:'Портрет вызвал одного стража. Подкрепление ограничено.'});
  }
 }
 state.bossOpen=Math.max(0,state.bossOpen-dt);
 if(state.bossOpen>0){e.mode='open';state.bossClock=0;return;}
 const walk=(yaw,speed)=>{const x=e.x,z=e.z;move(e,Math.sin(yaw)*speed*dt,Math.cos(yaw)*speed*dt,state.geo.walls,.68);e.x=clamp(e.x,state.isCity?-12:-8.7,state.isCity?12:8.7);e.z=clamp(e.z,2,state.geo.length-3);e.vx=(e.x-x)/dt;e.vz=(e.z-z)/dt;};
 if(!state.bossAction){
  e.yaw=Math.atan2(p.x-e.x,p.z-e.z);state.bossClock+=dt;
  if(d>3.3){e.mode='chase';const dir=enemyRouteDirection(e,p,state.geo,state.time);walk(Math.atan2(dir.x,dir.z),2.7+(phase-1)*.2);}
  else {e.mode='circle';walk(e.yaw+(e.id%2?1:-1)*Math.PI/2,1.05);}
  if(state.bossClock<1.15)return;
  const near=['right','left','kick','slam'],far=['charge','volley','charge'];
  const step=d>5?(e.farStep||0):e.step;if(d>5)e.farStep=step+1;else e.step++;const kind=(d>5?far:near)[step%(d>5?far.length:near.length)];
  const wind=kind==='charge'?1.10:kind==='slam'?1.15:kind==='volley'?.95:kind==='kick'?.85:.72;
  const yaw=Math.atan2(p.x-e.x,p.z-e.z);
  state.bossAction={kind,t:0,wind,duration:wind+(kind==='charge'?.72:.42),x:p.x,z:p.z,startX:e.x,startZ:e.z,yaw,hit:false,travel:Math.min(8.5,Math.max(2,d-1.3))};
  e.yaw=yaw;state.bossClock=0;state.emit('bossWindup',{kind,x:e.x,z:e.z});return;
 }
 const a=state.bossAction;a.t+=dt;e.yaw=a.yaw;e.mode=a.t<a.wind?'windup':'strike';
 if(a.kind==='charge'&&a.t>=a.wind&&a.t<a.duration){
  walk(a.yaw,a.travel/.72);if(!a.hit&&distance(e,p)<2.1&&p.y-(e.y||0)<1.35&&facesTarget(e,p,.2)&&!blocked(e,p,state.geo.walls)){a.hit=true;state.damage(18);}
 }else if(a.t>=a.wind&&!a.hit){
  a.hit=true;state.emit('bossStrike',{x:e.x,z:e.z,kind:a.kind});
  if(a.kind==='volley'){
   const count=state.isCity?3:5;
   for(let i=0;i<count;i++){const yaw=a.yaw+(i-(count-1)/2)*.22;state.shots.push({x:e.x+Math.sin(yaw),z:e.z+Math.cos(yaw),vx:Math.sin(yaw)*6.3,vz:Math.cos(yaw)*6.3,life:4,damage:12,reflectable:true,source:e.id});}
  }else if(a.kind==='slam')state.waves.push({x:e.x,z:e.z,r:.15,life:1.65,hit:false});
  else if(distance(e,p)<(a.kind==='kick'?3.6:3.2)&&p.y-(e.y||0)<(a.kind==='kick'?1.5:1.8)&&facesTarget(e,p,a.kind==='kick'?.2:.45)&&!blocked(e,p,state.geo.walls))state.damage(a.kind==='kick'?17:14);
 }
 if(a.t>=a.duration){state.bossAction=null;state.bossClock=0;state.bossOpen=state.isCity?3.8:4.4;e.mode='open';state.emit('bossOpen',{x:e.x,z:e.z});}
}

export function legacyArenaBoss(state,e,dt){state.bossOpen=Math.max(0,state.bossOpen-dt);state.bossClock+=dt;const phase=e.hp>700?1:e.hp>350?2:3;if(phase!==state.phase){state.phase=phase;state.emit('phase');if(phase===2){state.spawn('double',-5,24);state.spawn('double',5,24);}}e.yaw=Math.atan2(state.p.x-e.x,state.p.z-e.z);if(state.bossOpen>0){e.mode='open';return;}if(!state.bossAction){if(state.bossClock<2)return;const kinds=phase===1?['slam','sweep']:phase===2?['bolt','shock','slam']:['right','left','beam','break','shards'];const kind=kinds[e.step++%kinds.length];state.bossAction={kind,t:0,x:state.p.x,z:state.p.z,yaw:e.yaw,hit:false};e.mode=kind;state.bossClock=0;return;}const a=state.bossAction,p=state.p;a.t+=dt;const wind=a.kind==='beam'?1.5:1.1;if(a.t>wind&&!a.hit){a.hit=true;state.emit('bossStrike',{x:a.x,z:a.z,kind:a.kind});if(['slam','right','left'].includes(a.kind)&&distance(p,a)<2.6&&p.y<2)state.damage(24);if(a.kind==='sweep'&&distance(p,e)<8&&p.y<1)state.damage(20);if(a.kind==='shock')state.waves.push({x:e.x,z:e.z,r:.1,life:5,hit:false});if(['bolt','shards'].includes(a.kind))for(let i=0;i<(a.kind==='shards'?7:3);i++){const angle=a.yaw+(i-(a.kind==='shards'?3:1))*.2;state.shots.push({x:e.x,z:e.z,vx:Math.sin(angle)*7,vz:Math.cos(angle)*7,life:6});}if(a.kind==='beam'&&Math.abs(Math.sin(a.yaw)*(p.z-e.z)-Math.cos(a.yaw)*(p.x-e.x))<1.3)state.damage(25);if(a.kind==='break'){const tiles=state.geo.platforms.filter(f=>!f.gone&&f.z>8&&f.z<42&&Math.abs(f.x-a.x)<3&&Math.abs(f.z-a.z)<3);if(tiles.length){tiles[0].fragile=true;tiles[0].age=.5;}}}if(a.t>wind+.7){state.bossAction=null;state.bossOpen=phase===1?4.5:phase===2?4:3.5;state.bossClock=0;}}
