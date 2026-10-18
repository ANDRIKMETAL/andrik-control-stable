import {bikeKick,updateBikeCombat} from './bike-combat-r1458.js?v=r1458';
import {attackSlot,facesTarget,waitForAttack,modernBoss,bossDamage,updateArenaBoss} from './encounters-r1448.js?v=r1448';
import {downedEnemyR1447} from './combat-r1447.js?v=r1458';
import {enemyRouteDirection} from './enemy-navigation-r1446.js';
import {State,move,blocked,clamp} from './portrait-core-r1295.js?v=r1458';
export const CITY_SAVE='andrik-city-3d-r1289';
export const CITY_ZONES=['Улица пробуждения','Неоновый перекрёсток','NO CHOICE BAR','Мотоциклетная погоня','Ночной надзиратель'];
export const roadCenter=z=>Math.sin(z/43)*3.3+Math.sin(z/91)*2;
export const RACE_HAZARDS=Array.from({length:18},(_,i)=>({x:roadCenter(30+i*20)+[-3,2,0,3,-2][i%5],z:30+i*20,type:i%3===0?'van':'barrier'}));
export function cityGeometry(zone){
 const length=[64,62,40,420,48][zone];
 const walls=zone===3?[]:[{x:-17,z:length/2,w:2,d:length+4,h:14},{x:17,z:length/2,w:2,d:length+4,h:14},{x:0,z:-2,w:36,d:2,h:12},{x:-10,z:length,w:14,d:2,h:9},{x:10,z:length,w:14,d:2,h:9},{x:0,z:length+2,w:8,d:1,h:9}];
 const props=[];
 if(zone===0||zone===1){for(const [i,q]of [[-6,18],[6,32],[-5,46]].entries()){props.push({type:'car',x:q[0],z:q[1],variant:i});walls.push({x:q[0],z:q[1],w:2.14,d:4.42,h:.955,carBase:true},{x:q[0],z:q[1]-.39,w:1.90,d:2.25,h:1.665,carRoof:true});}for(const side of [-1,1])for(const z of [12,38]){props.push({type:'crate',x:side*12,z});walls.push({x:side*12,z,w:1.8,d:1.8,h:1.3});}}
 if(zone===2){walls.push({x:-9,z:23,w:3,d:17,h:1.2});props.push({type:'counter',x:-9,z:23});for(const x of [3,10])for(const z of [12,22]){walls.push({x,z,w:1.5,d:1.5,h:1});props.push({type:'table',x,z});}}
 if(zone===4)for(const x of [-7,7]){walls.push({x,z:24,w:3,d:2,h:1.2});props.push({type:'cover',x,z:24});}
 const platforms=[{x:0,z:length/2,w:34,d:length+4,h:0}];
 for(const w of walls)if(w.h>0&&w.h<=2.2&&!w.carBase)platforms.push({x:w.x,z:w.z,w:w.w,d:w.d,h:w.h,objectTop:true});
 for(const q of props)if(q.type==='car')platforms.push({x:q.x,z:q.z+1.26,w:2.02,d:1.35,h:1.075,objectTop:true},{x:q.x,z:q.z-1.88,w:2.02,d:.65,h:.98,objectTop:true});
 return{length,walls,props,platforms};
}
export class CityState extends State {
 load(zone){super.load(zone);this.events=this.events.filter(e=>e.type!=='wave');this.isCity=true;this.isRuins=true;this.geo=cityGeometry(zone);this.enemies=[];this.shrines=[];this.wave=3;this.laser=null;this.cityItems=[];this.cityFlags=[];this.race=null;this.rivals=[];this.gateWall={x:0,z:this.geo.length-1,w:6.2,d:.4,h:6,gate:true};if(zone<3)this.geo.walls.push(this.gateWall);
 if(zone===0){this.cityItems=[{id:'key',x:-11,z:29,label:'Ключ от переулка'}];this.spawn('mask',-3,22);this.spawn('shadow',8,35);this.spawn('mask',0,49);this.spawn('shadow',-8,42);this.spawn('mask',7,55);}
 if(zone===1){this.cityItems=[{id:'power-left',x:-11,z:22,label:'Щит питания A'},{id:'power-right',x:11,z:43,label:'Щит питания B'}];this.spawn('double',-6,28);this.spawn('mask',4,38);this.spawn('statue',0,49);this.spawn('shadow',-8,47);this.spawn('mask',8,53);}
 if(zone===2){this.cityItems=[{id:'jukebox',x:10,z:31,label:'Музыкальный автомат'}];this.spawn('shadow',-3,16);this.spawn('mask',6,24);this.spawn('statue',-3,29);this.spawn('shadow',7,35);}
 if(zone===3){this.cityItems=[{id:'bike',x:0,z:9,label:'Сесть на мотоцикл'}];this.race={mounted:false,finished:false,countdown:3,speed:0,impacts:0};this.rivals=[{x:-2,z:20,speed:12.5},{x:2,z:32,speed:13.2}];}
 if(zone===0){this.spawn('dog',7,25);this.spawn('dog',-7,51);}
 if(zone===1){this.spawn('dog',7,18);this.spawn('dog',-4,42);}
 if(zone===4){const b=this.spawn('boss',0,33);b.hp=b.max=480;this.bossStep=0;}
 }
 get exitOpen(){if(this.zone===3)return !!this.race.finished;return this.zone<4&&!this.living.length&&this.cityItems.every(q=>q.optional||this.cityFlags.includes(q.id));}
 get nearbyItem(){return this.cityItems.find(q=>!this.cityFlags.includes(q.id)&&Math.hypot(q.x-this.p.x,q.z-this.p.z)<2.5&&Math.abs(this.p.y)<1);}
 get objective(){if(this.zone===3&&this.race.mounted)return this.race.finished?'Финиш! ДЕЙСТВИЕ — слезть и продолжить':this.race.countdown>0?'СТАРТ ЧЕРЕЗ '+Math.ceil(this.race.countdown):'Погоня · '+Math.round(this.p.z/420*100)+'% · B: удар ногой · C: ускорение · вниз: тормоз';const q=this.nearbyItem;if(q)return q.label+' · ДЕЙСТВИЕ';if(this.zone===4)return this.bossOpen>0?'Надзиратель устал — атакуй!':'Уходи от рывка. Голубое кольцо — усиленный урон.';if(this.exitOpen)return 'К светящемуся выходу · ДЕЙСТВИЕ';const missing=this.cityItems.filter(q=>!q.optional&&!this.cityFlags.includes(q.id));return this.zone===3?'Подойди к мотоциклу · ДЕЙСТВИЕ':missing.length?(this.zone===1?'Включи питание: '+this.cityFlags.length+'/2':this.zone===2?'Найди и включи музыкальный автомат':'Найди ключ в боковом переулке')+' · врагов '+this.living.length:'Победи противников: '+this.living.length;}
 get canInteract(){return !!this.nearbyItem||(this.p.z>this.geo.length-7&&Math.abs(this.p.x)<4);}
 interact(){const q=this.nearbyItem;if(q){this.cityFlags.push(q.id);if(q.id==='bike'){this.race.mounted=true;this.p.x=roadCenter(9);this.p.z=9;this.emit('notice',{text:'Погоня: влево / вправо — руль, B — сбить ногой, C — ускорение, A — прыжок'});this.emit('puzzle');return;}this.crystals+=q.optional?5:2;this.p.hp=Math.min(100,this.p.hp+15);this.emit('notice',{text:q.label+' · готово · +'+(q.optional?5:2)+' кристалла'});this.emit('puzzle');return;}if(this.exitOpen&&this.p.z>this.geo.length-7&&Math.abs(this.p.x)<4){this.checkpoint=this.zone+1;this.load(this.checkpoint);this.emit('checkpoint');}else if(this.p.z>this.geo.length-7)this.emit('notice',{text:this.objective});}
 action(kind){if(this.dead||this.finale||this.won)return false;if(this.zone===3&&this.race?.mounted&&!this.race.finished&&kind!=='interact'){
 if(kind==='jump'&&this.p.grounded&&!this.race.countdown){this.p.vy=6.5;this.p.grounded=false;return true;}
 if(['rideKick','kick','attack','slash','punch'].includes(kind))return bikeKick(this);
 if(['scream','dash'].includes(kind)&&this.p.energy>=20){this.p.energy-=20;this.race.boost=1.4;return true;}return false;}return super.action(kind);}

 update(dt,input={}){
 dt=clamp(dt,0,.035);if(this.zone<3){this.geo.walls=this.geo.walls.filter(w=>!w.gate);if(!this.exitOpen)this.geo.walls.push(this.gateWall);}
 if(this.zone===3&&this.race.mounted&&!this.race.finished&&!this.dead){
 this.time+=dt;this.elapsed+=dt;this.p.inv=Math.max(0,this.p.inv-dt);this.race.countdown=Math.max(0,this.race.countdown-dt);if(this.race.countdown)return;
 updateBikeCombat(this,dt);this.race.boost=Math.max(0,(this.race.boost||0)-dt);const boost=(input.run||this.race.boost>0)&&this.p.energy>0,desired=input.z<-.3?6:boost?20:14;this.p.energy=clamp(this.p.energy+dt*(boost?-13:6),0,100);
 this.race.speed+=(desired-this.race.speed)*Math.min(1,dt*2.8);this.p.vx=(input.x||0)*6;this.p.vz=this.race.speed;this.p.x+=this.p.vx*dt;this.p.z+=this.p.vz*dt;this.p.yaw=Math.atan2(this.p.vx,this.p.vz);this.p.vy-=20*dt;this.p.y+=this.p.vy*dt;if(this.p.y<=0){this.p.y=0;this.p.vy=0;this.p.grounded=true;}
 const center=roadCenter(this.p.z);if(Math.abs(this.p.x-center)>5.7){this.p.x=clamp(this.p.x,center-5.7,center+5.7);this.race.speed*=.93;this.damage(8);}
 for(const q of RACE_HAZARDS)if(Math.abs(this.p.z-q.z)<(q.type==='van'?2.5:1)&&Math.abs(this.p.x-q.x)<1.15&&this.p.inv<=0&&(q.type==='van'||this.p.y<.8)){this.damage(16);this.race.impacts++;this.race.speed=5;this.p.x=clamp(q.x+(this.p.x<q.x?-1.7:1.7),center-5.5,center+5.5);}
 for(const [i,r] of this.rivals.entries()){if(r.disabled>0){r.z+=dt*3;continue;}r.z+=dt*r.speed;r.x=roadCenter(r.z)+(i?2.8:-2.8)+Math.sin(this.time*.8+i)*.4;if(Math.hypot(r.x-this.p.x,r.z-this.p.z)<1.3&&this.p.y<.8){this.damage(10);this.race.speed*=.95;}}
 if(this.p.z>=this.geo.length-4){this.p.z=this.geo.length-4;this.p.x=0;this.race.finished=true;this.race.speed=0;this.p.vx=this.p.vz=0;this.crystals+=8;this.emit('notice',{text:'Финиш! +8 кристаллов · ДЕЙСТВИЕ — продолжить'});this.emit('puzzle');}return;
 }
 this.shots=this.shots.filter(s=>!blocked(s,{x:s.x+s.vx*dt,z:s.z+s.vz*dt},this.geo.walls));
 super.update(dt,input);this.laser=null;
 }
 enemy(e,dt){if(e.kind==='double'&&downedEnemyR1447(this,e,dt))return;if(e.kind!=='double'||e.hp<=0){super.enemy(e,dt);return;}e.hit=Math.max(0,e.hit-dt);e.cd-=dt;e.t+=dt;const d=Math.hypot(this.p.x-e.x,this.p.z-e.z);if(e.mode!=='windup')e.yaw=Math.atan2(this.p.x-e.x,this.p.z-e.z);
 if(e.mode==='stagger'){if(e.t>.35){e.mode='chase';e.t=0;}return;}
 if(e.mode==='windup'){if(e.t>.9){if(!blocked(e,this.p,this.geo.walls))this.shots.push({x:e.x,z:e.z,vx:Math.sin(e.yaw)*8,vz:Math.cos(e.yaw)*8,life:4,reflectable:true});e.mode='retreat';e.t=0;e.cd=2;}return;}
 if(e.mode==='retreat'&&e.t<.5){move(e,-Math.sin(e.yaw)*dt*2,-Math.cos(e.yaw)*dt*2,this.geo.walls);return;}
 e.mode='chase';if(d<16&&!blocked(e,this.p,this.geo.walls)&&e.cd<=0&&attackSlot(this,e)){e.mode='windup';e.t=0;}else if(d>7||blocked(e,this.p,this.geo.walls)){const aim=enemyRouteDirection(e,this.p,this.geo,this.time);move(e,aim.x*dt*2.7,aim.z*dt*2.7,this.geo.walls,.48);}
 }
 boss(e,dt){updateArenaBoss(this,e,dt,{move,blocked,enemyRouteDirection});}

 attackHit(){super.attackHit();if(this.attack?.kind!=='attack')return;for(const s of this.shots){if(!s.reflectable||s.friendly||Math.hypot(s.x-this.p.x,s.z-this.p.z)>2.7)continue;const e=this.living.find(e=>e.kind==='double'&&!blocked(this.p,e,this.geo.walls));if(e){this.hit(e,30,0);s.life=0;this.emit('notice',{text:'Выстрел отражён!'});}}}
 snapshot(){return {...super.snapshot(),cityVersion:1,cityFlags:[...this.cityFlags],race:this.race?{...this.race}:null,rivals:this.rivals?.map(r=>({...r}))};}
 restore(s){super.restore(s);this.cityFlags=Array.isArray(s.cityFlags)?s.cityFlags.filter(id=>this.cityItems.some(q=>q.id===id)):[];this.wave=3;if(this.zone===3&&s.race){this.race={...this.race,mounted:!!s.race.mounted,finished:!!s.race.finished,countdown:clamp(Number(s.race.countdown)||0,0,3),speed:0};if(Array.isArray(s.rivals)&&s.rivals.length===2&&s.rivals.every(r=>Number.isFinite(r.z)))this.rivals=s.rivals.map((r,i)=>({x:Number.isFinite(r.x)?r.x:roadCenter(r.z)+(i?2.8:-2.8),z:r.z,speed:i?13.2:12.5,disabled:clamp(Number(r.disabled)||0,0,4),fallen:clamp(Number(r.fallen)||0,0,1.4),fallSide:r.fallSide<0?-1:1,kickRewarded:!!r.kickRewarded}));}}
}
