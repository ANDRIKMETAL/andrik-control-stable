const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),finite=(n,f=0)=>Number.isFinite(n)?n:f;
export const voyageMounted=v=>!!v&&['active','crashed','lost'].includes(v.status);
export const courseX=(kind,z)=>kind==='space'?Math.sin(z/117)*6+Math.sin(z/49)*2:Math.sin(z/86)*5+Math.sin(z/177)*3;
export const courseY=z=>7+Math.sin(z/104)*2.2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function segmentHits(a,b,q,r){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz,t=l?clamp(((q.x-a.x)*dx+(q.y-a.y)*dy+(q.z-a.z)*dz)/l,0,1):0;return Math.hypot(a.x+dx*t-q.x,a.y+dy*t-q.y,a.z+dz*t-q.z)<r;}
export function makeVoyage(kind){
 const space=kind==='space',length=space?960:850,gates=Array.from({length:10},(_,i)=>{const z=space?80+i*88:[80,160,250,330,420,500,590,670,760,825][i];return{id:i,x:courseX(kind,z)+(space?Math.sin(i*1.8)*3.5:(i%2?4:-4)),y:space?courseY(z)+Math.cos(i*1.4)*1.5:0,z,r:space?4.2:4.6,passed:false,missed:false};});
 const obstacles=space?Array.from({length:33},(_,i)=>{const z=105+i*24;return{id:'rock-'+i,type:'meteor',x:courseX(kind,z)+Math.sin(i*7.1)*11,y:courseY(z)+Math.cos(i*3.3)*5,z,r:1.1+i%3*.45,hp:28+i%3*12,hit:false};}):Array.from({length:4},(_,i)=>{const z=185+i*178,x=courseX(kind,z)+(i%2?3:-3);return[{id:'ramp-'+i,type:'ramp',x,y:0,z,r:2.8,hit:false},{id:'whirl-'+i,type:'vortex',x,y:0,z:z+22,r:4.0,hit:false},{id:'shark-'+i,type:'shark',x:courseX(kind,z+42)+(i%2?-3:3),y:0,z:z+42,r:2.2,hit:false}];}).flat();
 const pickups=space?Array.from({length:19},(_,i)=>{const z=55+i*45,gate=gates.find(g=>Math.abs(g.z-z)<30);return{id:i,x:gate?.x??courseX(kind,z),y:gate?.y??courseY(z),z,type:i%5===0?'weapon':i%5===1?'rocket':i%5===2?'shield':i%5===3?'repair':'crystal',taken:false};}):gates.flatMap((g,i)=>[{id:i*2,x:g.x,y:0,z:g.z-8,type:i%3===0?'repair':'boost',taken:false},{id:i*2+1,x:g.x,y:0,z:g.z+7,type:'crystal',taken:false}]);
 const enemies=space?Array.from({length:18},(_,i)=>{const z=100+i*42;return{id:i,x:courseX(kind,z)+(i%3-1)*5,y:courseY(z)+(i%2?2:-2),z,baseX:courseX(kind,z)+(i%3-1)*5,baseY:courseY(z)+(i%2?2:-2),hp:i%4===0?52:30,max:i%4===0?52:30,cd:1+i%3*.3,wind:0,dead:0,lock:null};}):[];
 const bots=space?[]:Array.from({length:4},(_,i)=>({id:i,name:['Капитан Клешня','Алый Рак','Железный Ус','Бирюзовый Панцирь'][i],x:(i%2?1:-1)*(3+i%2),y:0,z:6+i*5,vy:0,speed:19+i*.25,stun:0,down:0,wind:0,cd:3+i*.8,nextGate:0,finished:false,rewarded:false}));
 return{version:1,kind,status:'dormant',length,p:{x:0,y:space?courseY(0):0,z:0,vx:0,vy:0,vz:0,yaw:0},time:0,countdown:3,speed:0,gates,obstacles,pickups,enemies,bots,shots:[],weapon:1,rockets:3,shield:0,shieldCD:0,boost:0,boostCD:0,attackCD:0,fireCD:0,firing:false,kick:null,nextGate:0,checkpoint:0,kills:0,points:0,impacts:0,jumps:0,rank:5,rewarded:false,started:false,inv:0};
}
export function startVoyage(s,retry=false){
 let v=s.voyage;if(!v)return false;
 if(retry){const checkpoint=v.status==='crashed'?v.checkpoint:0,kind=v.kind;v=s.voyage=makeVoyage(kind);if(checkpoint>0){v.p.z=checkpoint;v.p.x=courseX(kind,checkpoint);v.p.y=kind==='space'?courseY(checkpoint):0;for(const g of v.gates)if(g.z<checkpoint){g.passed=true;v.nextGate++;}for(const q of v.pickups)if(q.z<checkpoint)q.taken=true;for(const e of v.enemies)if(e.z<checkpoint-5)e.hp=0;for(const b of v.bots)b.z=checkpoint-8-b.id*3;}s.p.hp=100;s.dead=0;}
 if(!v.started){v.started=true;s.p.hp=Math.min(100,s.p.hp+25);}
 v.status='active';v.firing=false;v.inv=2;s.attack=null;s.queued=false;s.shots=[];s.waves=[];s.p.down=0;
 s.emit('vehicleBegin',{kind:v.kind});return true;
}
function hurt(s,v,n){if(v.inv>0||v.shield>0||v.status!=='active')return;const hp=s.p.hp;s.damage(n);if(s.p.hp<hp){v.inv=1.1;v.impacts++;v.speed*=.65;s.emit('vehicleHit',{x:v.p.x,y:v.p.y,z:v.p.z});}if(s.p.hp<=0){s.dead=0;v.status='crashed';v.firing=false;s.emit('vehicleCrash');s.emit('notice',{text:'Транспорт повреждён. C — повторить с контрольной точки.'});}}
function shoot(s,v,rocket=false){
 if(v.kind!=='space'||v.status!=='active'||v.countdown>0)return false;
 if(rocket&&(!v.rockets||v.attackCD>0)||!rocket&&v.fireCD>0)return false;
 const p=v.p,target=v.enemies.filter(e=>e.hp>0&&e.z>p.z+3&&e.z<p.z+100&&Math.hypot(e.x-p.x,e.y-p.y)<18).sort((a,b)=>distance(a,p)-distance(b,p))[0];
 const count=rocket?1:v.weapon===2?2:v.weapon===3?3:1;
 for(let i=0;i<count;i++){const spread=(i-(count-1)/2)*(v.weapon===3?.09:.025),dx=target?clamp((target.x-p.x)/(target.z-p.z),-.18,.18):0,dy=target?clamp((target.y-p.y)/(target.z-p.z),-.15,.15):0,speed=rocket?57:88;
  v.shots.push({x:p.x+(i-(count-1)/2)*.65,y:p.y+.1,z:p.z+1.7,vx:(dx+spread)*speed,vy:dy*speed,vz:speed,friendly:true,rocket,damage:rocket?85:v.weapon===3?16:18,life:2,target:rocket?target?.id:null});}
 if(rocket){v.rockets--;v.attackCD=.9;}else v.fireCD=v.weapon===3?.22:.27;s.emit('vehicleShot',{rocket});return true;
}
export function voyageAction(s,kind){
 const v=s.voyage;if(!voyageMounted(v))return false;
 if(v.status!=='active'){if(['interact','scream','jump'].includes(kind))return startVoyage(s,true);return false;}
 if(kind==='vehicleFireStop'){v.firing=false;return true;}if(kind==='vehicleFireStart'){if(v.kind==='space'){v.firing=true;shoot(s,v);}else voyageAction(s,'kick');return true;}
 if(v.countdown>0)return false;
 if(kind==='jump'){
  if(v.kind==='space'){if(v.shieldCD>0||s.p.energy<20)return false;s.p.energy-=20;v.shield=3;v.shieldCD=8;s.emit('vehicleShield');}
  else if(v.p.y<=.05){v.p.vy=8.8;v.jumps++;s.emit('vehicleJump');}else return false;return true;
 }
 if(['scream','dash','interact'].includes(kind)){
  if(v.kind==='space')return shoot(s,v,true);if(v.boostCD>0||s.p.energy<20)return false;s.p.energy-=20;v.boost=2.1;v.boostCD=3.4;s.emit('vehicleBoost');return true;
 }
 if(['attack','slash','slashReverse','slashHeavy','kick','punch','rideKick'].includes(kind)){
  if(v.kind==='space')return shoot(s,v);if(v.attackCD>0)return false;const bot=v.bots.filter(b=>!b.finished&&b.stun<=0&&Math.abs(b.z-v.p.z)<4.5&&Math.abs(b.x-v.p.x)<3.8).sort((a,b)=>distance(a,v.p)-distance(b,v.p))[0];
  v.kick={t:0,side:bot?Math.sign(bot.x-v.p.x)||1:1,hit:false};v.attackCD=.8;return true;
 }
 return false;
}
function pickup(s,v,q){q.taken=true;v.points+=25;
 if(q.type==='weapon'){v.weapon=Math.min(3,v.weapon+1);s.emit('notice',{text:v.weapon===2?'Двойная пушка · B удерживать — огонь':'Плазменный веер · B удерживать — огонь'});}
 else if(q.type==='rocket')v.rockets=Math.min(9,v.rockets+2);
 else if(q.type==='shield')v.shield=Math.max(v.shield,6);
 else if(q.type==='repair')s.p.hp=Math.min(100,s.p.hp+25);
 else if(q.type==='boost'){s.p.energy=Math.min(100,s.p.energy+30);v.boost=Math.max(v.boost,.8);}
 else s.crystals=Math.min(9999,s.crystals+2);s.emit('vehiclePickup',{kind:q.type});
}
function updateSpace(s,v,dt){
 for(const e of v.enemies){e.dead=Math.max(0,e.dead-dt);if(e.hp<=0||e.z<v.p.z-20||e.z>v.p.z+125)continue;e.x=e.baseX+Math.sin(v.time*1.4+e.id)*2;e.y=e.baseY+Math.sin(v.time*.8+e.id)*.8;e.cd-=dt;
  if(e.wind>0){e.wind-=dt;if(e.wind<=0){const target=e.lock,len=distance(e,target)||1;v.shots.push({x:e.x,y:e.y,z:e.z-1.3,vx:(target.x-e.x)/len*34,vy:(target.y-e.y)/len*34,vz:(target.z-e.z)/len*34,friendly:false,damage:9,life:3});e.cd=2.6;}}
  else if(e.cd<=0&&e.z>v.p.z+8&&e.z<v.p.z+95){e.wind=.8;e.lock={...v.p,z:v.p.z+5};s.emit('vehicleAim');}
  if(distance(e,v.p)<2.1){hurt(s,v,16);e.z-=5;}
 }
 for(const bullet of v.shots){const old={x:bullet.x,y:bullet.y,z:bullet.z};if(bullet.rocket&&bullet.target!=null){const e=v.enemies.find(q=>q.id===bullet.target&&q.hp>0);if(e){const len=distance(e,bullet)||1;bullet.vx+=(57*(e.x-bullet.x)/len-bullet.vx)*Math.min(1,dt*5);bullet.vy+=(57*(e.y-bullet.y)/len-bullet.vy)*Math.min(1,dt*5);}}
  bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.z+=bullet.vz*dt;bullet.life-=dt;
  if(bullet.friendly){const targets=[...v.enemies.filter(e=>e.hp>0),...v.obstacles.filter(o=>o.hp>0)];for(const q of targets){if(!segmentHits(old,bullet,q,(q.r||1.3)+.35))continue;q.hp=Math.max(0,q.hp-bullet.damage);bullet.life=0;s.emit('vehicleImpact',{x:q.x,y:q.y,z:q.z});if(q.hp<=0){q.dead=1.0;v.points+=q.type?15:75;if(!q.type)v.kills++;}if(bullet.rocket)for(const other of targets)if(other!==q&&other.hp>0&&distance(q,other)<5){other.hp=Math.max(0,other.hp-40);if(!other.hp){other.dead=1.0;v.points+=other.type?15:75;if(!other.type)v.kills++;}}break;}}
  else if(segmentHits(old,bullet,v.p,1.0)){hurt(s,v,bullet.damage);bullet.life=0;}
 }
 v.shots=v.shots.filter(q=>q.life>0&&q.z>v.p.z-40&&q.z<v.p.z+180).slice(-100);
}
function updateBots(s,v,dt){
 for(const b of v.bots){b.cd=Math.max(0,b.cd-dt);b.down=Math.max(0,b.down-dt);if(b.finished)continue;if(b.stun>0){b.stun=Math.max(0,b.stun-dt);b.z+=dt*4;b.vy-=14*dt;b.y=Math.max(0,b.y+b.vy*dt);if(!b.stun){b.x=courseX('water',b.z)+(b.id%2?4:-4);b.y=0;b.vy=0;}continue;}
  const next=v.gates[b.nextGate],ramp=v.obstacles.find(q=>q.type==='ramp'&&q.z>b.z&&q.z<b.z+36);const target=ramp&&Math.abs(ramp.z-(next?.z||0))>15?ramp:next||{x:courseX('water',b.z+20)};
  b.x+=clamp(target.x-b.x,-1,1)*dt*5.3;b.z+=dt*(b.speed+clamp((v.p.z-b.z)/100,-.8,1.5));b.vy-=dt*14;b.y=Math.max(0,b.y+b.vy*dt);if(!b.y)b.vy=0;
  for(const o of v.obstacles)if(o.type==='ramp'&&Math.abs(o.z-b.z)<2&&Math.abs(o.x-b.x)<2.8&&b.y<=.05)b.vy=10.5;
  if(next&&b.z>next.z)b.nextGate++;if(b.z>=v.length){b.z=v.length;b.finished=true;}
  if(b.wind>0){b.wind=Math.max(0,b.wind-dt);if(!b.wind&&distance(b,v.p)<3.5&&v.p.y<1.2)hurt(s,v,9);}
  else if(b.cd<=0&&Math.abs(b.z-v.p.z)<4&&Math.abs(b.x-v.p.x)<3.2){b.wind=.7;b.cd=3.8;s.emit('vehicleClawWarn',{bot:b.id});}
 }
 v.rank=1+v.bots.filter(b=>b.finished||b.z>v.p.z).length;
 if(v.kick){v.kick.t+=dt;if(!v.kick.hit&&v.kick.t>.2){v.kick.hit=true;const b=v.bots.find(b=>!b.finished&&b.stun<=0&&Math.abs(b.z-v.p.z)<4.5&&Math.abs(b.x-v.p.x)<3.8&&Math.sign(b.x-v.p.x)===v.kick.side&&Math.abs(b.y-v.p.y)<1.4);if(b){b.stun=3;b.down=1.1;b.wind=0;v.points+=40;if(!b.rewarded){b.rewarded=true;s.crystals++;}s.emit('vehicleKick',{x:b.x,y:b.y,z:b.z});}}if(v.kick.t>.65)v.kick=null;}
}
export function updateVoyage(s,dt,input={}){
 const v=s.voyage;if(!voyageMounted(v))return false;if(v.status!=='active')return true;dt=clamp(dt,0,.035);s.time+=dt;s.elapsed+=dt;v.time+=dt;s.p.inv=Math.max(0,s.p.inv-dt);v.inv=Math.max(0,v.inv-dt);
 for(const key of ['shield','shieldCD','boost','boostCD','attackCD','fireCD'])v[key]=Math.max(0,v[key]-dt);s.p.energy=Math.min(100,s.p.energy+dt*5);
 if(v.countdown>0){v.countdown=Math.max(0,v.countdown-dt);return true;}
 const p=v.p,space=v.kind==='space',steer=clamp(finite(input.steer),-1,1),lift=clamp(finite(input.lift),-1,1),desired=space?25:v.boost>0?29:lift<-.45?13:22;
 v.speed+=(desired-v.speed)*Math.min(1,dt*2.5);p.vx+=(-steer*(space?10:9)-p.vx)*Math.min(1,dt*6);p.x+=p.vx*dt;p.z=Math.min(v.length,p.z+v.speed*dt);p.vz=v.speed;
 if(space){p.vy+=(lift*7.5-p.vy)*Math.min(1,dt*6);p.y=clamp(p.y+p.vy*dt,1,16);}else{p.vy-=dt*14;p.y=Math.max(0,p.y+p.vy*dt);if(!p.y)p.vy=0;}
 const cx=courseX(v.kind,p.z),bound=space?18:14;if(Math.abs(p.x-cx)>bound){p.x=clamp(p.x,cx-bound,cx+bound);hurt(s,v,6);}p.yaw=Math.atan2(p.vx,Math.max(1,p.vz));
 for(const o of v.obstacles){if(o.type==='meteor'&&o.hp<=0)continue;if(Math.abs(o.z-p.z)>7)continue;
  if(o.type==='ramp'){if(!o.hit&&Math.abs(o.z-p.z)<2.7&&Math.abs(o.x-p.x)<2.8&&p.y<.4){o.hit=true;p.vy=10.5;v.jumps++;v.points+=30;s.emit('vehicleRamp');}}
  else if(o.type==='meteor'){if(distance(o,p)<o.r+1)hurt(s,v,15);}
  else if(Math.hypot(o.x-p.x,o.z-p.z)<o.r+1&&p.y<(o.type==='vortex'?1.5:1.2)&&!o.hit){o.hit=true;hurt(s,v,o.type==='vortex'?18:14);if(o.type==='vortex'){v.speed=8;p.x+=p.x<o.x?-2:2;}}
 }
 for(const q of v.pickups)if(!q.taken&&Math.abs(q.z-p.z)<3&&Math.hypot(q.x-p.x,(space?q.y-p.y:0))<2.7)pickup(s,v,q);
 const next=v.gates[v.nextGate];if(next&&p.z>=next.z){if(Math.hypot(p.x-next.x,space?p.y-next.y:0)<next.r){next.passed=true;v.points+=50;v.checkpoint=Math.max(0,next.z-15);v.nextGate++;s.emit('vehicleCheckpoint',{gate:next.id});}
  else if(space){next.missed=true;v.nextGate++;s.emit('notice',{text:'Навигационный маяк пропущен · держись стрелки'});}
  else{p.z=next.z-22;p.x=courseX('water',p.z);p.vx=0;v.speed=10;v.inv=Math.max(v.inv,1);s.emit('notice',{text:'Пройди между буйками · стрелка указывает ворота'});}}
 if(space){if(v.firing)shoot(s,v);updateSpace(s,v,dt);}else updateBots(s,v,dt);
 if(v.status==='active'&&p.z>=v.length){v.firing=false;if(!space&&v.rank>3){v.status='lost';s.emit('vehicleLost');s.emit('notice',{text:'Финиш: '+v.rank+'/5. Для прохода нужно место в тройке. C — повторить гонку.'});}
  else{v.status='finished';if(!v.rewarded){v.rewarded=true;s.crystals+=space?12:16;s.p.hp=Math.min(100,s.p.hp+20);}s.emit('vehicleFinish',{kind:v.kind,rank:v.rank});s.emit('notice',{text:space?'Ангар достигнут! +12 кристаллов · C — к АРЕС':'Гонка выиграна! Место '+v.rank+'/5 · +16 кристаллов · C — к маяку'});}}
 return true;
}
export function voyageObjective(v){if(!v)return'';if(v.status==='crashed')return 'Транспорт повреждён · C — повторить с контрольной точки';if(v.status==='lost')return 'Финиш '+v.rank+'/5 · C — повторить, нужно попасть в тройку';if(v.countdown>0)return 'СТАРТ ЧЕРЕЗ '+Math.ceil(v.countdown);return v.kind==='space'?'ПРОРЫВ К АНГАРУ · '+Math.floor(v.p.z/v.length*100)+'% · сбито '+v.kills:'ГОНКА К МАЯКУ · место '+v.rank+'/5 · ворота '+Math.min(10,v.nextGate+1)+'/10';}
export function voyageStory(kind){return kind==='space'?{title:'Маленький корабль · большой прорыв',text:'Капсулы спасены. До ангара АРЕС ведёт пояс метеоритов. Лира садится в разведчик: впереди истребители, оружейные контейнеры и навигационные кольца.',goal:'Джойстик / WASD — влево, вправо, вверх и вниз. Удерживай B / F — огонь. C / E — ракета. A / пробел — щит. Собирай оружие, ремонт и ракеты; лети по указателям.'}:{title:'Клешни на полном газу',text:'Катер выходит в открытое море. Дорогу к маяку перекрыли огромные раки на водных скутерах. Лира принимает вызов: между буйками, через трамплины, над воронками и акулами.',goal:'Джойстик / WASD — руль; вниз — тормоз. A / пробел — прыжок, трамплины подбрасывают сами. B / F — удар по соседнему гонщику. C / E — ускорение. Пройди все ворота и финишируй в тройке.'};}
export function voyageSnapshot(v){if(!v)return null;return{version:1,kind:v.kind,status:v.status,p:{...v.p},time:v.time,countdown:v.countdown,weapon:v.weapon,rockets:v.rockets,shield:v.shield,nextGate:v.nextGate,checkpoint:v.checkpoint,kills:v.kills,points:v.points,impacts:v.impacts,jumps:v.jumps,rank:v.rank,started:v.started,rewarded:v.rewarded,gates:v.gates.map(q=>({passed:q.passed,missed:q.missed})),taken:v.pickups.filter(q=>q.taken).map(q=>q.id),destroyed:v.enemies.filter(e=>e.hp<=0).map(e=>e.id),rocks:v.obstacles.filter(e=>e.type==='meteor'&&e.hp<=0).map(e=>e.id),hazards:v.obstacles.filter(e=>e.hit).map(e=>e.id),bots:v.bots.map(b=>({...b}))};}
export function restoreVoyage(kind,data){const v=makeVoyage(kind);if(data?.version!==1||data.kind!==kind)return v;
 if(['dormant','active','finished','crashed','lost'].includes(data.status))v.status=data.status;v.started=!!data.started;v.rewarded=!!data.rewarded;
 if(data.p&&['x','y','z'].every(k=>Number.isFinite(data.p[k]))){v.p.z=clamp(data.p.z,0,v.length);v.p.x=clamp(data.p.x,courseX(kind,v.p.z)-18,courseX(kind,v.p.z)+18);v.p.y=clamp(data.p.y,kind==='space'?1:0,kind==='space'?16:12);}
 for(const [key,max]of [['time',100000],['countdown',3],['weapon',3],['rockets',9],['shield',6],['nextGate',10],['checkpoint',v.length-25],['kills',100],['points',100000],['impacts',10000],['jumps',10000],['rank',5]])v[key]=clamp(finite(data[key],v[key]),0,max);v.weapon=Math.max(1,Math.floor(v.weapon));v.nextGate=Math.floor(v.nextGate);v.inv=2;
 v.gates.forEach((g,i)=>{g.passed=!!data.gates?.[i]?.passed;g.missed=!!data.gates?.[i]?.missed;});v.pickups.forEach(q=>q.taken=Array.isArray(data.taken)&&data.taken.includes(q.id));v.enemies.forEach(e=>{if(data.destroyed?.includes(e.id))e.hp=0;});v.obstacles.forEach(e=>{if(data.rocks?.includes(e.id))e.hp=0;if(data.hazards?.includes(e.id))e.hit=true;});
 if(Array.isArray(data.bots))for(const b of v.bots){const old=data.bots.find(q=>q.id===b.id);if(old&&['x','y','z'].every(k=>Number.isFinite(old[k]))){b.z=clamp(old.z,0,v.length);b.x=clamp(old.x,courseX('water',b.z)-14,courseX('water',b.z)+14);b.y=clamp(old.y,0,12);b.finished=!!old.finished;b.nextGate=clamp(Math.floor(finite(old.nextGate)),0,10);b.rewarded=!!old.rewarded;}}
 return v;
}
