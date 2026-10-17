import {buildOcean,oceanEnemy,oceanInteract,oceanObjective,oceanTarget,updateOcean,strikeOceanObjects,restoreOcean,oceanSnapshot} from './ocean-r1457.js?v=r1457';
import {State,clamp} from './portrait-core-r1295.js?v=r1457';
import {buildRouteWorld} from './world-layout-r1457.js?v=r1457';
import {routeFloor} from './world-route-r1457.js?v=r1457';
import {spaceEnemy,worldBoss} from './world-combat-r1457.js?v=r1457';
import {updatePlayerImpact} from './player-impact-r1457.js?v=r1457';
export const WORLDS={2:{name:'ОКЕАН',stages:['Затопленные причалы','Острова прилива','Логово Восьмирукого'],color:0x4de4cd},3:{name:'КОСМОС',stages:['Разгерметизация','Капсулы в поясе обломков','Протокол АРЕС'],color:0x60dfff},4:{name:'БАШНЯ',stages:['Лестница маятника','Ход против времени','Над облаками'],color:0xffcc82},5:{name:'БЛОКИ',stages:['Код архитектора','Ломаный маршрут','За пределами сетки'],color:0xd18aff}};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class WorldState extends State{
 constructor(world=3,saved){super();this.world=WORLDS[world]?world:3;this.load(0);if(saved)this.restore(saved);}
 load(zone){
  super.load(clamp(zone,0,2));this.world=this.world||3;this.isRuins=true;this.enemies=[];this.shrines=[];this.wave=3;this.laser=null;this.flags=[];this.hazards=[];this.hazardClock=0;this.finale=0;this.won=false;this.loot=[];this.layoutR1457=1;this.routeLinks=[];
  const main=this.world===2?buildOcean(this,zone):buildRouteWorld(this,this.world,zone);
  this.switches.forEach(q=>q.active=false);const start=this.geo.platforms[0];Object.assign(this.p,{x:start.x,z:start.z,y:start.h,vy:0,vx:0,vz:0,yaw:0,hp:100,energy:100,grounded:true,down:0,knockT:0});this.safe={x:start.x,z:start.z,y:start.h};this.safeIndex=0;this.safeRoute=0;
  const choices=[main[Math.floor(main.length*.36)],main[Math.floor(main.length*.72)]];
  this.loot=choices.map((f,i)=>({x:f.x+1.7,z:f.z-1,y:f.h,id:'cache-'+i,taken:false}));this.events=[];this.emit('zone');
 }
 spawnAt(kind,f,offset=0){const e=this.spawn(kind,f.x+offset,f.z);e.y=e.homeY=f.h;e.navPlatform=f.node;return e;}
 get nearby(){return this.switches.find(q=>!q.active&&dist(q,this.p)<2.3&&Math.abs(q.h-this.p.y)<1.3);}
 get exitOpen(){return this.flags.length===3&&!this.living.length;}
 get canInteract(){return !!this.nearby||dist(this.p,this.exit)<3&&Math.abs(this.p.y-this.exit.y)<1.5;}
 get navigationObjective(){
  if(this.world===2)return oceanTarget(this);const q=this.switches.find(q=>!q.active);
  if(this.world===3&&this.zone===2&&q?.id===2&&this.living.some(e=>e.kind==='boss')){const e=this.living.find(e=>e.kind==='boss');return {...e,label:e.name}}
  if(q)return {...q,label:q.label};const e=this.living.slice().sort((a,b)=>dist(a,this.p)-dist(b,this.p))[0];return e?{...e,label:e.name||(e.kind==='boss'?'Босс':'Противник')}:{...this.exit,label:'Выход'};
 }
 strikeWorldObjects(attack,damage,range){strikeOceanObjects(this,attack,damage,range);}
 get objective(){
  if(this.p.down>0)return 'Лира поднимается · уходи из круга до удара босса';
  if(this.world===2)return oceanObjective(this);
  if(this.world===3){if(this.zone===1)return this.flags.length<3?'Спаси капсулы: '+this.flags.length+'/3 · подойди к капсуле':this.living.length?'Уничтожь преследователей: '+this.living.length:'Капсулы спасены — к шлюзу';if(this.zone===2&&this.living.some(e=>e.kind==='boss'))return this.flags.length<2?'Отключи охлаждение и щит · '+Math.min(2,this.flags.length)+'/2':'Победи АРЕС · уходи от очередей и прыжков';}
  return this.flags.length<3?(this.world===5?'Активируй коды по порядку: '+(this.flags.length+1)+'/3':this.nearby?.label||'Механизмы: '+this.flags.length+'/3'):this.living.length?'Противников осталось: '+this.living.length:'Выход открыт · C';
 }
 activate(q){if(q.active)return;q.active=true;this.flags.push(q.id);this.p.energy=Math.min(100,this.p.energy+20);this.p.hp=Math.min(100,this.p.hp+15);this.crystals+=4;this.emit('puzzle');this.emit('notice',{text:q.label+' · готово'});}
 interact(){const q=this.nearby;
  if(this.world===2&&q&&oceanInteract(this,q))return;
  if(q){
   if((this.world===5||this.world===3&&this.zone===0)&&q.id!==this.flags.length){this.emit('notice',{text:'Следующая цель: '+this.switches[this.flags.length].label});return;}
   if(this.world===3&&this.zone===2&&q.id===2&&this.living.some(e=>e.kind==='boss')){this.emit('notice',{text:'Сначала останови осадного робота АРЕС. Ядро доступно после боя.'});return;}
   this.activate(q);return;
  }
  if(this.exitOpen&&dist(this.p,this.exit)<3&&Math.abs(this.p.y-this.exit.y)<1.5){if(this.zone===2){this.won=true;this.emit('won');}else{this.checkpoint=this.zone+1;this.load(this.zone+1);this.emit('checkpoint');}}
 }
 action(kind){if(this.p.down>0)return false;return super.action(kind);}
 hit(e,n,knock=.5){
  const was=e.hp,ox=e.x,oz=e.z,dropStart=this.drops.length;
  if(e.kind==='boss'&&this.world===2)n=Math.max(1,Math.round(n*(.45+.55*this.flags.length/3)));
  if(e.kind==='boss'&&this.world===3)n=Math.max(1,Math.round(n*(.65+.35*Math.min(2,this.flags.length)/2)));
  super.hit(e,n,Math.min(knock,.65));const f=routeFloor(this,e);if(!f||Math.abs(f.h-(e.homeY||e.y||0))>2){e.x=ox;e.z=oz;}
  if(e.kind==='boss'){this.finale=0;this.won=false;}
  if(was>0&&e.hp<=0)for(const d of this.drops.slice(dropStart))d.y=e.y;
 }
 attackHit(){const ignored=this.enemies.filter(e=>Math.abs((e.y||0)+(e.airLift||0)-this.p.y)>2.5),hp=ignored.map(e=>e.hp);ignored.forEach(e=>e.hp=0);super.attackHit();ignored.forEach((e,i)=>e.hp=hp[i]);}
 boss(e,dt){worldBoss(this,e,dt);}
 enemy(e,dt){if(e.kind==='boss')return worldBoss(this,e,dt);return this.world===2?oceanEnemy(this,e,dt):spaceEnemy(this,e,dt);}
 update(dt,input={}){
  dt=clamp(dt,0,.035);const oldZone=this.zone,oldY=this.p.y,grounded=this.p.grounded,down=updatePlayerImpact(this,dt);
  if(this.world===3&&!this.p.grounded)this.p.vy+=dt*9;
  super.update(dt,down?{x:0,z:0,run:false}:input);this.laser=null;if(this.dead||this.won||this.zone!==oldZone)return;
  if(grounded&&!(this.p.vy>0)&&!down){const step=this.geo.platforms.filter(f=>Math.abs(this.p.x-f.x)<f.w/2&&Math.abs(this.p.z-f.z)<f.d/2&&f.h>=oldY-.08&&f.h<=oldY+.32).sort((a,b)=>b.h-a.h)[0];if(step){this.p.y=step.h;this.p.vy=0;this.p.grounded=true;}}
  if(this.p.grounded){const f=routeFloor(this,this.p);if(f&&(f.route||0)>=this.safeRoute){this.safeRoute=f.route||0;this.safeIndex=f.node;this.safe={x:this.p.x,y:this.p.y,z:this.p.z};}}
  if(this.p.y<Math.min(...this.geo.platforms.map(f=>f.h))-4||this.world===4&&this.p.y<this.safe.y-5){this.damage(20);Object.assign(this.p,this.safe,{vy:0,vx:0,vz:0,grounded:true,inv:1.5,down:0,knockT:0});this.emit('notice',{text:'Возврат на последний уступ · −20 HP'});}
  for(const q of this.loot)if(!q.taken&&dist(q,this.p)<1.4&&Math.abs(q.y-this.p.y)<1.2){q.taken=true;this.crystals+=8;this.p.hp=Math.min(100,this.p.hp+25);this.emit('puzzle');this.emit('notice',{text:'Тайник: +8 кристаллов, +25 HP'});}
  if(this.world===2)updateOcean(this,dt);
  if(this.world===3&&this.zone===1)for(const q of this.switches)if(!q.active&&dist(q,this.p)<1.9&&Math.abs(q.h-this.p.y)<1.4)this.activate(q);
  if(this.world===5){this.hazardClock+=dt;if(this.hazardClock>3.4-this.zone*.25){this.hazardClock=0;this.hazards.push({x:this.p.x,z:this.p.z,y:this.p.y,t:0,hit:false});}
   for(const b of this.hazards){b.t+=dt;if(!b.hit&&b.t>1.4){b.hit=true;if(Math.abs(this.p.x-b.x)<1.5&&Math.abs(this.p.z-b.z)<1.5&&Math.abs(this.p.y-b.y)<1.1)this.damage(18);}}this.hazards=this.hazards.filter(b=>b.t<2.6);}
 }
 snapshot(){return {...super.snapshot(),world:this.world,worldLayoutR1457:1,flags:[...this.flags],safe:this.safe,safeIndex:this.safeIndex,safeRoute:this.safeRoute,loot:this.loot,...(this.world===2?{oceanR1451:oceanSnapshot(this)}:{})};}
 restore(s){
  if(s?.world!==this.world||s.version!==1||![0,1,2].includes(s.zone))return;
  const legacy=s.worldLayoutR1457!==1,oldBoss=s.enemies?.find(e=>e.kind==='boss'),input={...s,p:s.p?{...s.p,y:Math.max(0,s.p.y)}:s.p};super.restore(legacy?{...input,enemies:undefined,platforms:[]}:input);
  this.flags=[...new Set((s.flags||[]).filter(n=>[0,1,2].includes(n)))];this.switches.forEach(q=>q.active=this.flags.includes(q.id));
  if(legacy){for(const e of this.enemies)if(e.objectiveId>=0&&this.flags.includes(e.objectiveId)){e.hp=0;e.dead=0;}const boss=this.enemies.find(e=>e.kind==='boss');if(boss&&oldBoss)boss.hp=Math.max(0,Math.round(clamp(oldBoss.hp/Math.max(1,oldBoss.max||320),0,1)*boss.max));}
  this.safeRoute=0;const floor=routeFloor(this,this.p)||this.geo.platforms[0];if(!this.p.grounded||Math.abs(floor.h-this.p.y)>.3||legacy)Object.assign(this.p,{x:floor.x,z:floor.z,y:floor.h,vy:0,vx:0,vz:0,grounded:true,down:0,knockT:0});this.safe={x:this.p.x,y:this.p.y,z:this.p.z};this.safeIndex=floor.node;this.safeRoute=floor.route||0;
  for(const e of this.enemies){e.navJump=null;e.routeUntil=0;e.worldAction=null;delete e.anchor;const f=routeFloor(this,e)||this.geo.platforms[e.navPlatform]||floor;e.y=e.homeY=f.h;e.navPlatform=f.node;if(e.kind==='boss')e.arena=this.geo.platforms.find(q=>q.arena)||this.geo.platforms.at(-1);}
  if(Array.isArray(s.loot))for(const q of this.loot)q.taken=!!s.loot.find(v=>v.id===q.id)?.taken;this.finale=0;this.won=!!s.won;
  if(this.world===2)restoreOcean(this,s);
 }
}
