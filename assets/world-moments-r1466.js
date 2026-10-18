const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const worldKey=s=>s.isCity?'city':s.world|| (s.isRuins?'ruins':'portrait');
export const MOMENTS={
 city:{title:'Неоновая засада',action:'Вернуть свет',intro:'Свет погас. Из служебной двери выходят двое.',line:'Город ещё не погас. Я верну ему голос.',sound:'electric'},
 portrait:{title:'Лицо из памяти',action:'Открыть пустую раму',intro:'За пустой рамой кто-то шепчет. Подойди и нажми C.',line:'Это лицо не исчезло. Его просто перестали замечать.',sound:'glass'},
 ruins:{title:'Память камня',action:'Запустить древний циферблат',intro:'Под песком остановились маленькие часы. C — запустить.',line:'Даже камень помнит первый удар сердца.',sound:'stone'},
 2:{title:'Огонёк у причала',action:'Зажечь сигнальный буй',intro:'У старой лодки погас сигнальный огонь. C — вернуть свет.',line:'Пока горит хотя бы один огонь, берег можно найти.',sound:'water'},
 3:{title:'Последний воздух',action:'Закрыть аварийный клапан',intro:'Из аварийного клапана уходит воздух. C — перекрыть утечку.',line:'Пусть у тех, кто вернётся, останется ещё один вдох.',sound:'air'},
 4:{title:'Потерянная секунда',action:'Освободить малый маятник',intro:'Малая шестерня заклинена. C — вернуть ход маятнику.',line:'Эту секунду больше никто не заберёт.',sound:'clock'},
 5:{title:'Правило света',action:'Соединить световую цепь',intro:'В схеме осталась свободная цепь. C — соединить.',line:'Я могу оставить здесь своё правило. Пусть оно будет светом.',sound:'code'}
};
function clearPoint(s,p,r=.45){return !(s.geo?.walls||[]).some(w=>Math.abs(p.x-w.x)<w.w/2+r&&Math.abs(p.z-w.z)<w.d/2+r&&(w.h||0)>p.y+.3);}
function onFloor(s,p){return (s.geo?.platforms||[]).some(f=>!f.gone&&Math.abs(p.x-f.x)<f.w/2-.55&&Math.abs(p.z-f.z)<f.d/2-.55&&Math.abs(p.y-f.h)<.3);}
export function momentSpec(s){
 const world=worldKey(s);if(s.zone!==0||!MOMENTS[world])return null;
 let p;
 if(world==='city')p={x:6.15,y:0,z:19};
 else if(world==='portrait')p={x:-6,y:0,z:13};
 else if(world==='ruins')p={x:4.8,y:0,z:11.2};
 else {const floors=(s.geo?.platforms||[]).filter(f=>world===2?f.dock!==undefined:Number.isFinite(f.main));const f=floors[world===2?1:2]||s.geo?.platforms?.[0];if(!f)return null;p={x:f.x+Math.min(1.55,f.w*.23),y:f.h,z:f.z-.7};}
 if(!onFloor(s,p)||!clearPoint(s,p))return null;
 return {...MOMENTS[world],...p,id:String(world),world,zone:0};
}
export function streetLamps(s){
 if(!s.isCity||![0,1,4].includes(s.zone))return [];
 const out=[];for(const side of [-1,1])for(let z=7;z<s.geo.length-4;z+=12)out.push({id:s.zone+':'+side+':'+z,x:side*7,y:0,z,bulbX:side*6.2,breakable:z===19||z===43});return out;
}
function normalData(raw,world){
 const r=raw?.version===1?raw:{},done=!!r.done,seen=!!r.seen,phase=done?'done':['quiet','ambush','ready'].includes(r.phase)?r.phase:'quiet';
 return {version:1,world:String(world),done,seen,phase,broken:Array.isArray(r.broken)?[...new Set(r.broken.filter(v=>typeof v==='string'&&/^\d+:-?1:\d+$/.test(v)))].slice(0,16):[],hits:{},warnings:Array.isArray(r.warnings)?r.warnings.filter(v=>typeof v==='string').slice(0,16):[]};
}
function baseGetter(s,key){for(let p=s;p;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d?.get)return ()=>d.get.call(s);if(d&&'value'in d)return ()=>d.value;}return ()=>false;}
export function attachWorldMoments(s,{saved=null}={}){
 if(s.worldMoments)return s;let data=normalData(saved?.worldMomentsR1466,worldKey(s)),cacheGeo=null,cacheZone=-1,definition=null,lamps=[];
 if(s.growth?.momentClaimed(String(worldKey(s)))){data.done=data.seen=true;data.phase='done';}
 const base={update:s.update.bind(s),snapshot:s.snapshot.bind(s),restore:s.restore.bind(s),interact:s.interact.bind(s),attackHit:s.attackHit.bind(s)},primary=baseGetter(s,'canInteract');
 function spec(){if(cacheGeo!==s.geo||cacheZone!==s.zone){cacheGeo=s.geo;cacheZone=s.zone;definition=momentSpec(s);lamps=streetLamps(s);}return definition;}
 const active=()=>!s.dead&&!s.won&&!s.finale&&!s.race?.mounted&&!s.vehicleActive&&!(s.p.down>0);
 function nearby(){const q=spec();return q&&!data.done&&data.phase==='ready'&&active()&&Math.hypot(s.p.x-q.x,s.p.z-q.z)<1.85&&Math.abs(s.p.y-q.y)<.9?q:null;}
 function spawnAmbush(q){
  const marked=s.enemies.filter(e=>e.worldMoment1466==='city');if(marked.length)return;
  for(const [i,kind]of ['mask','shadow'].entries()){
   let p={x:11.5,y:0,z:q.z+(i?2.2:-1.3)};
   if(!onFloor(s,p)||!clearPoint(s,p,.55))p={x:q.x+2.5,y:q.y,z:q.z+(i?3:-3)};
   if(!onFloor(s,p)||!clearPoint(s,p,.55)||s.living.length>=10)continue;
   const e=s.spawn(kind,p.x,p.z);Object.assign(e,{y:p.y,homeY:p.y,mode:'wake',t:.65,worldMoment1466:'city',throwCD:3,cd:2.2});
  }
 }
 function finish(q){
  if(data.done)return false;const claim=s.growth?.claimMoment(q.id);if(claim&&!claim.ok){s.emit('notice',{text:claim.message||'Не удалось сохранить событие. Попробуй ещё раз.'});return false;}data.done=true;data.phase='done';if(claim&&!claim.claimed){s.emit('momentDone',{world:q.world,x:q.x,y:q.y,z:q.z,sound:q.sound});return true;}if(!claim)s.crystals=Math.min(9999,s.crystals+4);s.p.hp=Math.min(100,s.p.hp+10);s.p.energy=Math.min(100,s.p.energy+15);
  s.emit('momentDone',{world:q.world,x:q.x,y:q.y,z:q.z,sound:q.sound});s.emit('notice',{text:q.title+' · +4 кристалла · +10 HP'});s.emit('storyLine',{key:'moment-'+q.id,text:q.line,duration:4.5});return true;
 }
 s.worldMoments={get data(){return data;},get spec(){return spec();},get nearby(){return primary()?null:nearby();},get lamps(){spec();return lamps;},isBroken(id){return data.broken.includes(id);}};
 Object.defineProperty(s,'canInteract',{configurable:true,get:()=>primary()||!!nearby()});
 s.interact=function(){const q=!primary()&&nearby();if(q)return finish(q);return base.interact();};
 s.update=function(dt,input){
  const zone=this.zone;base.update(dt,input);if(zone!==this.zone||!active())return;const q=spec();
  if(q&&!data.done){const near=Math.hypot(this.p.x-q.x,this.p.z-q.z)<6&&Math.abs(this.p.y-q.y)<1.6;
   if(!data.seen&&near){data.seen=true;data.phase=q.world==='city'?'ambush':'ready';this.emit('momentBegin',{world:q.world,x:q.x,y:q.y,z:q.z,sound:q.sound});this.emit('notice',{text:q.intro});}
   if(data.phase==='ambush'&&q.world==='city'){
    if(near)spawnAmbush(q);
    const guards=this.enemies.filter(e=>e.worldMoment1466==='city');if(guards.length&&!guards.some(e=>e.hp>0)){data.phase='ready';this.emit('notice',{text:'Засада отбита. C у щитка — вернуть свет.'});}
    // If the scene is reloaded after death, its two guards are re-created once.
    // Existing enemies are never multiplied while a tagged guard is present.
   }
  }
  if(this.isRuins&&!this.isCity&&this.zone===3){const f=this.geo.platforms.find(f=>f.fragile&&!f.gone&&Math.hypot(f.x-this.p.x,f.z-this.p.z)<5.8);if(f){const id=this.zone+':'+Math.round(f.z);if(!data.warnings.includes(id)&&data.warnings.length<16){data.warnings.push(id);this.emit('fragileWarning',{x:f.x,y:f.h,z:f.z});this.emit('notice',{text:'Доски трещат. Не задерживайся на мосту.'});}}}
 };
 s.attackHit=function(){
  base.attackHit();if(!active()||!this.attack||!['slash','punch','backfist','kick','attack','scream'].includes(this.attack.kind))return;
  spec();for(const q of lamps){if(!q.breakable||data.broken.includes(q.id))continue;const dx=q.x-this.p.x,dz=q.z-this.p.z,d=Math.hypot(dx,dz),dot=(dx*Math.sin(this.p.yaw)+dz*Math.cos(this.p.yaw))/Math.max(.01,d);if(d>2.45||Math.abs(this.p.y-q.y)>1.3||dot<.15)continue;
   data.hits[q.id]=(data.hits[q.id]||0)+(this.weaponStats?.selected==='bat'||['attack','scream'].includes(this.attack.kind)?2:1);
   this.emit('decorImpact',{x:q.x,y:1,z:q.z});if(data.hits[q.id]>=2){data.broken.push(q.id);this.emit('decorBreak',{id:q.id,x:q.x,y:1,z:q.z});}
  }
 };
 s.snapshot=function(){return {...base.snapshot(),worldMomentsR1466:{...data,broken:[...data.broken],warnings:[...data.warnings],hits:{...data.hits}}};};
 s.restore=function(raw){const prior=data;base.restore(raw);data=normalData(raw?.worldMomentsR1466,worldKey(this));data.done=prior.done||data.done||!!s.growth?.momentClaimed(String(worldKey(this)));data.seen=prior.seen||data.seen;data.broken=[...new Set([...prior.broken,...data.broken])].slice(0,16);data.warnings=[...new Set([...prior.warnings,...data.warnings])].slice(0,16);data.phase=data.done?'done':data.phase==='quiet'&&prior.seen?prior.phase:data.phase;cacheGeo=null;};
 return s;
}
