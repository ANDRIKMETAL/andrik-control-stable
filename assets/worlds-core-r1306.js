import {State,clamp,move} from './portrait-core-r1295.js?v=r1446';
export const WORLDS={2:{name:'ОКЕАН',stages:['Затопленные причалы','Острова прилива','Маяк глубины'],color:0x4de4cd},3:{name:'КОСМОС',stages:['Обломки орбитальной станции','Пояс безмолвия','Сердце звезды'],color:0x60dfff},4:{name:'БАШНЯ',stages:['Винтовой подъём','Часовой механизм','Над облаками'],color:0xffcc82},5:{name:'БЛОКИ',stages:['Код архитектора','Падающие фигуры','Последняя комбинация'],color:0xd18aff}};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class WorldState extends State{
 constructor(world=3,saved){super();this.world=WORLDS[world]?world:3;this.load(0);if(saved)this.restore(saved);}
 load(zone){super.load(clamp(zone,0,2));this.world=this.world||3;this.isRuins=true;this.enemies=[];this.shrines=[];this.wave=3;this.laser=null;this.flags=[];this.hazards=[];this.hazardClock=0;this.finale=0;this.won=false;this.rescue=null;this.loot=[];this.geo={length:65,walls:[],platforms:[]};const add=(x,z,w,d,h=0)=>{const f={x,z,w,d,h};this.geo.platforms.push(f);return f;};
 if(this.world===2){
  for(let i=0;i<9;i++)add(i%2?4:-3,i*6,8,5.2,(i%3)*.25);this.switches=[2,4,6].map((n,i)=>({...this.geo.platforms[n],id:i,active:false}));const end=this.geo.platforms.at(-1);this.exit={x:end.x,z:end.z,y:end.h};this.spawnAt('mask',this.geo.platforms[3],0);this.spawnAt('double',this.geo.platforms[6],1);
 }else if(this.world===3){
  add(0,3,10,10);for(let i=1;i<=7;i++)add(Math.sin(i*1.3+zone*.65)*4,3+i*7,8,5.4,(i%3)*.4);add(0,61,15,12);
  this.switches=[2,4,6].map((n,i)=>({...this.geo.platforms[n],id:i,active:false}));this.exit={x:0,z:63,y:0};
  this.spawnAt('shadow',this.geo.platforms[3],-1);this.spawnAt('double',this.geo.platforms[5],1);
 }else if(this.world===4){
  add(0,0,10,10);for(let i=0;i<18;i++){const angle=i*.55+zone*.2;add(Math.sin(angle)*6,Math.cos(angle)*6,4.2,4.2,.55+i*.65);}const last=this.geo.platforms.at(-1);add(last.x*1.5,last.z*1.5,7,7,last.h+.5);
  this.switches=[5,11,17].map((n,i)=>({...this.geo.platforms[n],id:i,active:false}));const f=this.geo.platforms.at(-1);this.exit={x:f.x,z:f.z,y:f.h};
  this.spawnAt('mask',this.geo.platforms[8],0);this.spawnAt('shadow',this.geo.platforms[14],0);
 }else{
  add(0,24,24,56);this.geo.walls=[{x:-12.5,z:24,w:1,d:56,h:3},{x:12.5,z:24,w:1,d:56,h:3}];
  this.switches=[{x:-7,z:14,h:0,id:0},{x:7,z:27,h:0,id:1},{x:-4,z:41,h:0,id:2}];this.exit={x:0,z:48,y:0};
  this.geo.walls.push({x:2,z:18,w:2,d:3,h:2.8},{x:-2,z:33,w:2,d:3,h:2.8});this.spawnAt('mask',{x:4,z:20,h:0},0);this.spawnAt('shadow',{x:-3,z:34,h:0},0);
 }
 this.switches.forEach(q=>q.active=false);const start=this.geo.platforms[0];Object.assign(this.p,{x:start.x,z:start.z,y:start.h,vy:0,vx:0,vz:0,yaw:0,hp:100,energy:100,grounded:true});this.safe={x:start.x,z:start.z,y:start.h};this.safeIndex=0;
 const f=this.geo.platforms.at(-1);const mid=this.geo.platforms[Math.floor(this.geo.platforms.length/2)];this.loot=[{x:f.x+2,z:f.z-2,y:f.h,id:'cache',taken:false},{x:mid.x-2,z:mid.z+1,y:mid.h,id:'hidden',taken:false}];if(zone===1&&this.world!==5)this.spawnAt('mask',this.geo.platforms[Math.max(1,this.geo.platforms.length-3)],0);
 if(zone===2){const e=this.spawn('boss',this.exit.x+2,this.exit.z-2);e.y=this.exit.y;e.homeY=e.y;e.hp=e.max=320;e.mode='guard';this.bossOpen=1;}
 this.events=[];this.emit('zone');
 }
 spawnAt(kind,f,offset){const e=this.spawn(kind,f.x+offset,f.z);e.y=e.homeY=f.h;e.anchor={w:8,d:8,...f};}
 get nearby(){return this.switches.find(q=>dist(q,this.p)<2.3&&Math.abs(q.h-this.p.y)<1.3);}
 get exitOpen(){return this.flags.length===3&&!this.living.length;}
 get canInteract(){return !!this.nearby||dist(this.p,this.exit)<3&&Math.abs(this.p.y-this.exit.y)<1.5;}
 get objective(){return this.flags.length<3?(this.world===5?'Плиты по порядку: '+(this.flags.length+1)+'/3':'Включи маяки: '+this.flags.length+'/3'):this.living.length?'Осталось стражей: '+this.living.length:'Выход открыт — Действие';}
 interact(){const q=this.nearby;if(q&&!q.active){if(this.world===5&&q.id!==this.flags.length){this.emit('notice',{text:'Следующая плита: '+(this.flags.length+1)});return;}q.active=true;this.flags.push(q.id);this.p.energy=Math.min(100,this.p.energy+20);this.p.hp=Math.min(100,this.p.hp+12);this.crystals+=3;this.emit('puzzle');return;}
 if(this.exitOpen&&dist(this.p,this.exit)<3&&Math.abs(this.p.y-this.exit.y)<1.5){if(this.zone===2){this.won=true;this.emit('won');}else{this.checkpoint=this.zone+1;this.load(this.zone+1);this.emit('checkpoint');}}}
 hit(e,n,knock=.5){const was=e.hp;super.hit(e,n,Math.min(knock,this.world===5?5:.65));if(e.anchor){e.x=clamp(e.x,e.anchor.x-e.anchor.w/2+.5,e.anchor.x+e.anchor.w/2-.5);e.z=clamp(e.z,e.anchor.z-e.anchor.d/2+.5,e.anchor.z+e.anchor.d/2-.5);}if(e.kind==='boss'){this.finale=0;this.won=false;}if(was>0&&e.hp<=0){for(const d of this.drops)d.y=e.y;}}
 attackHit(){const ignored=this.enemies.filter(e=>Math.abs((e.y||0)-this.p.y)>2.5);const h=ignored.map(e=>e.hp);ignored.forEach(e=>e.hp=0);super.attackHit();ignored.forEach((e,i)=>e.hp=h[i]);}
 boss(e,dt){e.t+=dt;this.bossOpen=1;e.yaw=Math.atan2(this.p.x-e.x,this.p.z-e.z);const cycle=e.t%4; e.mode=cycle<1.2?'windup':'guard';if(cycle<1.2){if(!e.mark)e.mark={x:this.p.x,z:this.p.z,y:this.p.y};}else if(e.mark){if(dist(this.p,e.mark)<2.7&&Math.abs(this.p.y-e.mark.y)<1.0)this.damage(24);this.emit('bossStrike',{x:e.mark.x,z:e.mark.z});e.mark=null;}}
 enemy(e,dt){const ox=e.x,oz=e.z,py=this.p.y;if(Math.abs((e.homeY||0)-py)>2.2&&e.kind!=='boss'){e.hit=Math.max(0,e.hit-dt);e.dead=Math.max(0,e.dead-dt);return;}if(e.kind!=='boss')this.p.y=py-(e.homeY||0);try{super.enemy(e,dt);}finally{this.p.y=py;}if(e.anchor&&(Math.abs(e.x-e.anchor.x)>e.anchor.w/2-.5||Math.abs(e.z-e.anchor.z)>e.anchor.d/2-.5)){e.x=ox;e.z=oz;}e.y=e.homeY||0;}
 update(dt,input={}){dt=clamp(dt,0,.035);if(this.world===3&&!this.p.grounded)this.p.vy+=dt*9;const height=this.p.y;super.update(dt,input);this.laser=null;if(this.dead||this.won)return;
 if(this.p.grounded){const i=this.geo.platforms.findIndex(f=>Math.abs(f.h-this.p.y)<.05&&Math.abs(this.p.x-f.x)<f.w/2&&Math.abs(this.p.z-f.z)<f.d/2);if(i>this.safeIndex){this.safeIndex=i;this.safe={x:this.p.x,y:this.p.y,z:this.p.z};}}
 if(this.world===4&&this.p.y<this.safe.y-4||[2,3].includes(this.world)&&this.p.y<-4){this.damage(20);Object.assign(this.p,this.safe,{vy:0,vx:0,vz:0,grounded:true,inv:1.5});this.emit('notice',{text:'Возврат на последний уступ · −20 HP'});}
 for(const q of this.loot)if(!q.taken&&dist(q,this.p)<1.2&&Math.abs(q.y-this.p.y)<1.2){q.taken=true;this.crystals+=8;this.p.hp=Math.min(100,this.p.hp+25);this.emit('notice',{text:'Тайник: +8 кристаллов, +25 HP'});this.emit('puzzle');}
 if(this.world===2){const phase=this.time%6;this.surge={warn:phase<1.3,active:phase>=1.3&&phase<2.0,z:(Math.floor(this.time/6)%7+1)*6};if(this.surge.active&&Math.abs(this.p.z-this.surge.z)<1.3&&this.p.y<1.4)this.damage(16);}
 for(const d of this.drops)if(!d.taken&&this.p.y>=2&&dist(d,this.p)<1.4&&Math.abs((d.y||0)-this.p.y)<1.3){d.taken=true;if(d.kind==='heart')this.p.hp=Math.min(100,this.p.hp+30);else this.crystals++;}
 // Telegraphs precede every falling block; blocks disappear, so the route cannot be sealed.
 if(this.world===5){this.hazardClock+=dt;if(this.hazardClock>2.8-this.zone*.35){this.hazardClock=0;this.hazards.push({x:Math.round(this.p.x/3)*3,z:Math.round(this.p.z/3)*3,t:0,hit:false});}
 for(const b of this.hazards){b.t+=dt;if(!b.hit&&b.t>1.4){b.hit=true;if(Math.abs(this.p.x-b.x)<1.5&&Math.abs(this.p.z-b.z)<1.5&&this.p.y<3)this.damage(22);}}this.hazards=this.hazards.filter(b=>b.t<2.6);}
 }
 snapshot(){return {...super.snapshot(),world:this.world,flags:[...this.flags],safe:this.safe,safeIndex:this.safeIndex,loot:this.loot};}
 restore(s){if(s?.world!==this.world||s.version!==1||![0,1,2].includes(s.zone))return;super.restore(s);this.flags=[...new Set((s.flags||[]).filter(n=>[0,1,2].includes(n)))];this.switches.forEach(q=>q.active=this.flags.includes(q.id));if(s.safe&&['x','y','z'].every(k=>Number.isFinite(s.safe[k]))){this.safe={...s.safe};this.safeIndex=clamp(s.safeIndex||0,0,this.geo.platforms.length-1);}if(Array.isArray(s.loot))for(const q of this.loot)q.taken=!!s.loot.find(v=>v.id===q.id)?.taken;this.finale=0;this.won=!!s.won;}
}
