import {updateBikeCombat} from './bike-combat-r1458.js?v=r1471';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*(3-2*t);
export const CHASE_LENGTH=1260,CHASE_FENCE=1218,CHASE_FINISH=1256;
export const CHASE_POINTS=[[0,0],[90,0],[125,28],[200,28],[242,-26],[320,-26],[358,32],[445,32],[490,-30],[585,-30],[630,26],[715,26],[757,-32],[850,-32],[900,24],[990,24],[1040,-16],[1128,-16],[1162,0],[1260,0]];
export function chaseCenter(z){
 z=clamp(Number(z)||0,0,CHASE_LENGTH);
 for(let i=1;i<CHASE_POINTS.length;i++){const [b,x]=CHASE_POINTS[i],[a,y]=CHASE_POINTS[i-1];if(z<=b)return y+(x-y)*smooth(clamp((z-a)/(b-a),0,1));}return 0;
}
export const chaseHeading=z=>Math.atan2(chaseCenter(z+.5)-chaseCenter(z-.5),1);
export const chaseBend=z=>chaseHeading(z+8)-chaseHeading(z-8);
export const CHASE_RAMPS=[
 {id:'dock',start:174,end:188,lane:-2.6,width:3.8,height:1.15,lift:8.4},
 {id:'freight',start:526,end:541,lane:2.6,width:3.8,height:1.4,lift:9.2},
 {id:'yard',start:944,end:959,lane:-2.5,width:4,height:1.35,lift:9},
 {id:'escape',start:1184,end:1204,lane:0,width:6,height:2.2,lift:11.8,final:true}
];
export const CHASE_CHECKPOINTS=[9,430,850,1120];
export const CHASE_HAZARDS=Array.from({length:38},(_,i)=>({z:64+i*29,lane:[-3.1,2.8,0,3.2,-2.8,1.6][i%6],type:i%4===0?'van':'barrier'})).filter(q=>!CHASE_RAMPS.some(r=>q.z>r.start-18&&q.z<r.end+24)&&Math.abs(chaseBend(q.z))<.65).map(q=>({...q,x:chaseCenter(q.z)+q.lane}));
export function rampHeight(z,lane,final=true){const r=CHASE_RAMPS.find(r=>(final||!r.final)&&z>=r.start&&z<r.end&&Math.abs(lane-r.lane)<r.width/2);return r?(z-r.start)/(r.end-r.start)*r.height:0;}
function putRival(e){e.x=chaseCenter(e.z)+(e.lane||0);e.yaw=chaseHeading(e.z);}
function rivalsAt(z,prior=[]){return Array.from({length:4},(_,i)=>{const old=prior[i]||{},e={id:i,lane:(i%2?1:-1)*(i>1?4.25:2.8),z:Math.max(0,z-(z<20?5+i*3:14+i*10)),speed:18+i*.3,y:0,vy:0,disabled:0,fallen:0,attackCD:1.5+i*.6,kickRewarded:!!old.kickRewarded};putRival(e);return e;});}
export function initBikeChase(s){
 s.race={version:1464,mounted:false,finished:false,postBoss:false,countdown:3,speed:0,offset:0,steer:0,impacts:0,checkpoint:9,launched:[],escapeReady:false,finalFlight:false,rewarded:false,elapsed:0,boost:0};
 s.rivals=rivalsAt(9);s.cityItems[0].x=chaseCenter(9);
}
export function restoreBikeChase(s,data){
 if(s.zone!==3||!data?.race)return;const old=data.race,newSave=old.version===1464,p=s.p;
 const z=old.finished?CHASE_FINISH:newSave?clamp(Number(p.z)||9,3,CHASE_FINISH):clamp((Number(p.z)||9)/416*CHASE_FINISH,9,CHASE_FENCE-70);
 s.race={...s.race,mounted:!!old.mounted,postBoss:!!old.postBoss,finished:!!old.finished,rewarded:!!old.rewarded||!!old.finished,countdown:clamp(Number(old.countdown)||0,0,3),offset:newSave?clamp(Number(old.offset)||0,-5.25,5.25):0,impacts:clamp(Number(old.impacts)||0,0,9999),knockouts:clamp(Number(old.knockouts)||0,0,9999),checkpoint:newSave?CHASE_CHECKPOINTS.filter(v=>v<=Number(old.checkpoint)).at(-1)||9:CHASE_CHECKPOINTS.filter(v=>v<=z).at(-1)||9,launched:newSave&&Array.isArray(old.launched)?old.launched.filter(id=>CHASE_RAMPS.some(r=>r.id===id)).slice(0,4):[],escapeReady:newSave&&!!old.escapeReady,finalFlight:newSave&&!!old.finalFlight,elapsed:Math.max(0,Number(old.elapsed)||0),speed:newSave?clamp(Number(old.speed)||0,0,30):0,crash:newSave?clamp(Number(old.crash)||0,0,1.1):0,wheelie:newSave&&old.wheelie&&Number.isFinite(old.wheelie.t)&&old.wheelie.t<.85?{t:Math.max(0,old.wheelie.t),lifted:!!old.wheelie.lifted}:null};
 if(s.race.mounted){p.z=z;p.x=chaseCenter(z)+s.race.offset;if(!newSave){p.y=0;p.vy=0;p.grounded=true;}else{p.y=clamp(Number(p.y)||0,0,9);p.vy=clamp(Number(p.vy)||0,-20,15);}}
 s.rivals=rivalsAt(z,data.rivals||[]);
 if(newSave&&Array.isArray(data.rivals))for(let i=0;i<4;i++){const old=data.rivals[i];if(!old)continue;const e=s.rivals[i];e.z=clamp(Number(old.z)||e.z,Math.max(0,z-180),Math.min(CHASE_FENCE-3,z+25));e.lane=clamp(Number(old.lane)||e.lane,-4.8,4.8);e.disabled=clamp(Number(old.disabled)||0,0,4);e.fallen=clamp(Number(old.fallen)||0,0,1.4);e.fallSide=old.fallSide<0?-1:1;e.blocked=!!old.blocked;putRival(e);}
}
export function constrainBikeChase(s){
 const r=s.race,p=s.p;if(!r?.mounted||r.version!==1464)return false;
 p.z=clamp(Number.isFinite(p.z)?p.z:r.checkpoint,3,CHASE_FINISH);r.offset=clamp(Number.isFinite(r.offset)?r.offset:0,-5.25,5.25);p.x=chaseCenter(p.z)+r.offset;
 if(!Number.isFinite(p.y)||p.y<-.1||p.y>10){p.y=0;p.vy=0;p.grounded=true;}
 for(const k of ['vx','vz','vy'])if(!Number.isFinite(p[k]))p[k]=0;return true;
}
export function bikeWheelie(s){const r=s.race;if(!r?.mounted||r.finished||r.countdown>0||r.crash>0||r.wheelie||!s.p.grounded)return false;r.wheelie={t:0,lifted:false};s.emit('bikeWheelie');return true;}
export function bikePitch(s){const r=s.race;if(r?.finalFlight)return clamp(-.32-(s.p.vy||0)*.025,-.65,.24);if(r?.wheelie)return -.72*Math.sin(Math.PI*clamp(r.wheelie.t/.85,0,1));return s.p.grounded?0:clamp(-(s.p.vy||0)*.035,-.32,.20);}
function retry(s){
 const r=s.race,p=s.p;r.offset=0;r.steer=0;r.speed=0;r.countdown=1;r.boost=0;r.crash=0;r.kick=null;r.kickCD=0;r.wheelie=null;r.finalFlight=false;r.escapeReady=false;r.wallHit=false;
 r.launched=r.launched.filter(id=>CHASE_RAMPS.find(q=>q.id===id)?.end<r.checkpoint);p.z=r.checkpoint;p.x=chaseCenter(p.z);p.y=p.vy=p.vx=p.vz=0;p.grounded=true;p.hp=Math.max(65,p.hp);p.inv=2;s.dead=0;s.rivals=rivalsAt(p.z,s.rivals);s.emit('respawn');s.emit('notice',{text:'Погоня продолжается · контрольный участок'});
}
function crash(s){const r=s.race;if(r.crash>0)return;r.impacts++;s.damage(12);r.crash=1.1;r.speed=0;r.finalFlight=false;s.emit('bikeFenceHit');s.emit('notice',{text:'Высокий забор! Вернись на центральный трамплин и держи скорость.'});}
function updateRivals(s,dt){
 const p=s.p,r=s.race;
 for(const [i,e]of s.rivals.entries()){
  e.attackCD=Math.max(0,(e.attackCD||0)-dt);e.y=Number(e.y)||0;e.vy=Number(e.vy)||0;
  if(e.blocked){e.speed=0;e.brake=true;continue;}
  const gap=p.z-e.z,desired=e.disabled>0?4:clamp(r.speed+clamp((gap-6)*.18,-4,5),12,30);
  e.speed+=(desired-e.speed)*Math.min(1,dt*1.8);e.z+=e.speed*dt;
  const final=e.z>1140,side=i%2?1:-1,target=final?side*4.15:gap<15?clamp(r.offset+side*2.25,-4.45,4.45):side*2.8+Math.sin(s.time*.7+i)*.7;
  e.lane+=clamp(target-e.lane,-dt*3.0,dt*3.0);
  const ramp=CHASE_RAMPS.find(q=>!q.final&&e.z>=q.start&&e.z<q.end&&Math.abs(e.lane-q.lane)<q.width/2);
  if(ramp&&e.y<=ramp.height+.1){e.y=rampHeight(e.z,e.lane,false);e.rampTouch=ramp.id;e.vy=0;}
  else{const launched=CHASE_RAMPS.find(q=>q.id===e.rampTouch);if(launched&&e.z>=launched.end&&e.y>launched.height-.2){e.vy=launched.lift;e.rampTouch=null;}e.vy-=20*dt;e.y=Math.max(0,e.y+e.vy*dt);if(!e.y)e.vy=0;}
  if(e.z>=CHASE_FENCE-3){e.z=CHASE_FENCE-3;e.speed=0;e.blocked=true;e.brake=true;e.attack=null;s.emit('bikePursuerStopped',{rival:i});}
  putRival(e);
  if(e.disabled>0||r.finalFlight||r.finished||r.crash>0)continue;
  if(e.attack){e.attack.t+=dt;if(!e.attack.hit&&e.attack.t>.62){e.attack.hit=true;if(Math.abs(e.z-p.z)<3.4&&Math.abs(e.lane-r.offset)<3.1&&p.y<1.5){s.damage(8);r.offset=clamp(r.offset+(r.offset>=e.lane?.55:-.55),-5.25,5.25);s.emit('bikeRivalHit');}}if(e.attack.t>1)e.attack=null;}
  else if(e.attackCD<=0&&Math.abs(e.z-p.z)<3.5&&Math.abs(e.lane-r.offset)<3.2&&p.y<1.5){e.attack={t:0,hit:false};e.attackCD=2.7+i*.3;s.emit('bikeRivalWarn',{rival:i});}
 }
}
export function updateBikeChase(s,dt,input={}){
 const r=s.race,p=s.p;dt=clamp(dt,0,.035);s.time+=dt;s.elapsed+=dt;r.elapsed+=dt;p.inv=Math.max(0,p.inv-dt);
 if(s.dead>0){s.dead=Math.max(0,s.dead-dt);if(!s.dead)retry(s);return;}
 if(r.crash>0){r.crash=Math.max(0,r.crash-dt);if(!r.crash)retry(s);return;}
 if(r.finished){if(!s.won&&!s.finale){s.finale=.01;s.emit('finale');}return;}
 r.countdown=Math.max(0,r.countdown-dt);if(r.countdown>0)return;
 updateBikeCombat(s,dt);r.boost=Math.max(0,(r.boost||0)-dt);const boost=(input.run||r.boost>0)&&p.energy>0,final=p.z>1150;
 const desired=input.z<-.3?10:boost?29:final?25:22;
 p.energy=clamp(p.energy+dt*(boost?-12:6),0,100);r.speed+=(desired-r.speed)*Math.min(1,dt*2.8);
 const before=p.z,oldX=p.x,steer=clamp(input.x||0,-1,1),bend=chaseBend(p.z);r.steer+=(steer-r.steer)*Math.min(1,dt*9);
 r.offset+=dt*(r.steer*(r.finalFlight?2:7.8)-bend*3.6*(r.speed/20)**2);
 if(Math.abs(r.offset)>5.25){r.offset=clamp(r.offset,-5.25,5.25);r.speed*=.82;s.damage(5);s.emit('bikeRail');}
 p.z=Math.min(CHASE_FINISH,p.z+r.speed*dt);p.x=chaseCenter(p.z)+r.offset;p.vx=(p.x-oldX)/Math.max(.001,dt);p.vz=r.speed;p.yaw=chaseHeading(p.z)+Math.atan2(r.steer*2.2,Math.max(10,r.speed));
 if(r.wheelie){r.wheelie.t+=dt;if(!r.wheelie.lifted&&r.wheelie.t>=.22){r.wheelie.lifted=true;if(p.grounded){p.vy=7.6;p.grounded=false;s.emit('bikeHop');}}if(r.wheelie.t>=.85)r.wheelie=null;}
 const touch=CHASE_RAMPS.find(q=>p.z>=q.start&&p.z<q.end&&Math.abs(r.offset-q.lane)<q.width/2);
 if(touch&&p.grounded){p.y=rampHeight(p.z,r.offset);p.vy=0;r.rampTouch=touch.id;}
 else{
  const ramp=CHASE_RAMPS.find(q=>q.id===r.rampTouch);
  if(ramp&&before<ramp.end&&p.z>=ramp.end&&Math.abs(r.offset-ramp.lane)<ramp.width/2&&p.y>=ramp.height-.3&&!r.launched.includes(ramp.id)){
   r.launched.push(ramp.id);r.rampTouch=null;p.y=ramp.height;p.vy=ramp.final&&r.speed<18?7:ramp.lift;p.grounded=false;r.finalFlight=!!ramp.final;s.emit('bikeRamp',{id:ramp.id,final:!!ramp.final});
  }
  const airborne=!p.grounded;p.vy-=20*dt;p.y+=p.vy*dt;p.grounded=false;
  const floor=rampHeight(p.z,r.offset);if(p.y<=floor){const landing=airborne&&p.vy<0;p.y=floor;p.vy=0;p.grounded=true;if(landing){s.emit('land');if(r.finalFlight){r.finalFlight=false;s.emit('bikeEscapeLand');}}}
 }
 for(const q of CHASE_HAZARDS)if(Math.abs(p.z-q.z)<(q.type==='van'?2.6:1.0)&&Math.abs(r.offset-q.lane)<1.15&&p.inv<=0&&(q.type==='van'?p.y<1.8:p.y<1.1)){
  s.damage(14);r.impacts++;r.speed=Math.max(8,r.speed*.48);r.offset=clamp(q.lane+(r.offset<q.lane?-1.7:1.7),-5.25,5.25);s.emit('bikeImpact');
 }
 if(before<CHASE_FENCE&&p.z>=CHASE_FENCE){if(p.y<4.45){crash(s);return;}r.escapeReady=true;s.emit('bikeFenceClear');}
 for(const checkpoint of CHASE_CHECKPOINTS)if(p.z>=checkpoint&&r.checkpoint<checkpoint){r.checkpoint=checkpoint;s.emit('bikeCheckpoint',{distance:checkpoint});}
 updateRivals(s,dt);
 if(p.z>=CHASE_FINISH&&r.escapeReady&&p.grounded){
  r.finished=true;r.escaped=true;r.speed=0;p.vx=p.vz=0;for(const e of s.rivals){e.z=Math.min(e.z,CHASE_FENCE-3);e.blocked=true;e.speed=0;e.brake=true;e.attack=null;putRival(e);}
  if(!r.rewarded){r.rewarded=true;s.crystals+=8;}s.finale=.01;s.emit('finale');s.emit('puzzle');s.emit('bikeEscape');s.emit('storyLine',{key:'bike-escape',text:'Попробуйте теперь меня догнать.',duration:4});
 }
}
export function chaseCue(s){
 const r=s.race,z=s.p.z;if(!r?.mounted)return null;
 if(r.finished)return{arrow:'✓',text:'Погоня осталась за ограждением',detail:'Побег удался'};
 if(r.crash>0)return{arrow:'↻',text:'Возвращение к контрольной точке',detail:'Для забора нужен центральный трамплин'};
 if(z>1140)return{arrow:'↑',text:z<1204?'ФИНАЛ · центральный трамплин':r.escapeReady?'ПРИЗЕМЛЕНИЕ ЗА ЗАБОРОМ':'ПЕРЕЛЁТ ЧЕРЕЗ ПРОВОЛОКУ',detail:'Держи центр и скорость · C: турбо'};
 const ramp=CHASE_RAMPS.find(q=>!q.final&&q.start>z&&q.start-z<65);if(ramp)return{arrow:ramp.lane<0?'↗':ramp.lane>0?'↖':'↑',text:'Трамплин · '+Math.round(ramp.start-z)+' м',detail:'A: на заднее колесо и перелёт · B: удар ногой'};
 const turn=CHASE_POINTS.slice(1).map(([end,x],i)=>({start:CHASE_POINTS[i][0],end,left:x>CHASE_POINTS[i][1],changed:x!==CHASE_POINTS[i][1]})).find(q=>q.changed&&q.end>z+5);
 if(turn&&turn.start-z<80)return{arrow:turn.left?'↖':'↗',text:(turn.left?'Крутой левый':'Крутой правый')+(turn.start>z?' · '+Math.round(turn.start-z)+' м':' · сейчас'),detail:'Перед поворотом ↓: тормоз · C: ускорение'};
 const gap=Math.min(...s.rivals.filter(e=>!e.blocked&&!(e.disabled>0)).map(e=>Math.abs(z-e.z)));
 return{arrow:'↑',text:gap<12?'ПРЕСЛЕДОВАТЕЛЬ РЯДОМ · '+Math.round(gap)+' м':'УХОДИ ОТ ПОГОНИ',detail:'B: удар ногой · C: турбо · ↓: тормоз'};
}
