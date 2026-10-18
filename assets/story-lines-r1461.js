export const STORY_LINES={checkpoint:'Я запомню это место',returned:'Моя история ещё не закончилась',capsule:'Они живые. Убери их из списка ошибок',architect:'Архитектор: «Я исполнил твою просьбу».\nЛира: «Теперь дай песне закончиться».'};
export function attachNarration(s,{saved=null}={}){
 if(s.narration)return s;let seen=new Set(),returning=false,lastCheckpoint=-Infinity,lastCheckpointZone=-1;
 const read=data=>new Set(Array.isArray(data?.narrationR1461)?data.narrationR1461.filter(x=>typeof x==='string'&&x.length<90).slice(-96):[]);seen=read(saved);
 const base={emit:s.emit.bind(s),activate:s.activate?.bind(s),update:s.update.bind(s),snapshot:s.snapshot.bind(s),restore:s.restore.bind(s)};
 function line(key,once=false){if(once&&seen.has(key))return;if(once)seen.add(key);base.emit('storyLine',{key,text:STORY_LINES[key],duration:key==='architect'?7:4});}
 s.emit=function(type,data={}){base.emit(type,data);
  if(type==='death'||type==='fall')returning=true;
  if(type==='respawn'&&returning){returning=false;line('returned');}
  if((type==='checkpoint'||type==='checkpointR1301')&&(this.zone!==lastCheckpointZone||this.time<lastCheckpoint||this.time-lastCheckpoint>.8)){lastCheckpoint=this.time;lastCheckpointZone=this.zone;line('checkpoint');}
 };
 if(base.activate)s.activate=function(q){const fresh=!q.active,result=base.activate(q);if(fresh&&q.active&&this.world===3&&this.zone===1)line('capsule',true);return result;};
 s.update=function(dt,input){base.update(dt,input);if(this.world===5&&this.zone===2&&!this.dead&&!this.won){const e=this.living.find(e=>e.kind==='boss');if(e&&Math.hypot(e.x-this.p.x,e.z-this.p.z)<36&&Math.abs((e.y||0)-this.p.y)<4)line('architect',true);}};
 s.snapshot=function(){return {...base.snapshot(),narrationR1461:[...seen]};};
 s.restore=function(data){const result=base.restore(data);seen=read(data);returning=false;lastCheckpoint=-Infinity;return result;};
 s.narration={version:1};return s;
}
