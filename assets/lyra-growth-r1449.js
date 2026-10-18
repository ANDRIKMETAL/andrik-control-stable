import {attachNarration} from './story-lines-r1461.js?v=r1465';
import {attachWeaponry} from './weaponry-r1458.js?v=r1465';
import {attachTactics} from './tactics-core-r1460.js?v=r1465';
export const GROWTH_KEY='andrik-lyra-growth-r1449';
export const SAVE_KEYS=['andrik-city-3d-r1289','andrik-portrait-r1280','andrik-ruins-3d-r1285',...['2','3','4','5'].map(id=>'andrik-world-'+id+'-r1306')];
const number=(v,a,b)=>Math.max(a,Math.min(b,Math.floor(Number(v)||0)));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const UPGRADES=Object.freeze([
 {id:'energy',name:'Дыхание',base:'Восстановление энергии: 5/с.',costs:[8,16,28],effects:['Восстановление энергии: 6/с.','Восстановление энергии: 7/с.','Восстановление энергии: 8/с.']},
 {id:'guitar',name:'Резонанс',base:'Гитара: 26 урона, радиус 3,55 м.',costs:[10,20,32],effects:['Гитара: 29 урона, радиус 3,70 м.','Гитара: 31 урон, радиус 3,85 м.','Гитара: 35 урона, радиус 4,05 м.']},
 {id:'combo',name:'Связка',base:'Две рубки мечом, затем удар ногой.',costs:[12,24,36],effects:['Четвёртое короткое B: круговая рубка, 36 базового урона.','Круговая рубка: 44 базового урона; связка до 1,8 с.','Круговая рубка: 52 базового урона; попадание возвращает 5 энергии.']},
 {id:'blade',name:'Клинок',base:'Меч: 18 / 20 урона, радиус 2,85 м.',costs:[10,20,34],effects:['Урон меча +12%, радиус 3,00 м.','Урон меча +24%, радиус 3,15 м.','Урон меча +36%, радиус 3,30 м.']},
 {id:'armor',name:'Стойкость',base:'Обычный входящий урон.',costs:[10,18,30],effects:['Входящий урон снижен на 8%.','Входящий урон снижен на 14%.','Входящий урон снижен на 20%.']}
]);
export function statsFor(levels={}){
 const e=number(levels.energy,0,3),g=number(levels.guitar,0,3),c=number(levels.combo,0,3),b=number(levels.blade,0,3),a=number(levels.armor,0,3);
 return {energyRegen:5+e,guitarDamage:[1,1.1,1.2,1.35][g],guitarRange:[3.55,3.70,3.85,4.05][g],comboLevel:c,comboWindow:c>=2?1800:1400,backfistDamage:c>=2?34:28,bladeSpinDamage:[0,36,44,52][c],bladeEnergyReturn:c===3?5:0,bladeDamage:1+b*.12,bladeRange:(285+b*15)/100,armor:[0,.08,.14,.20][a]};
}
export function validRecord(raw){
 if(raw?.version!==1||typeof raw.run!=='string'||raw.run.length<4||raw.run.length>96||!Number.isSafeInteger(raw.revision)||raw.revision<0||raw.revision>1e9||!Number.isSafeInteger(raw.balance)||raw.balance<0||raw.balance>9999)return null;
 return {version:1,run:raw.run,revision:raw.revision,balance:raw.balance,updatedAt:number(raw.updatedAt,0,1e15),levels:Object.fromEntries(UPGRADES.map(q=>[q.id,number(raw.levels?.[q.id],0,q.costs.length)]))};
}
function readJson(storage,key){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
function storageDefault(){try{return localStorage;}catch{return null;}}
function newRecord(balance=0){return {version:1,run:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),revision:0,balance:number(balance,0,9999),updatedAt:Date.now(),levels:Object.fromEntries(UPGRADES.map(q=>[q.id,0]))};}
export function safeToUpgrade(s){
 if(s.dead)return false;if(s.won)return true;
 if(s.finale||s.attack||!s.p.grounded||s.vehicleActive||s.race?.mounted&&!s.race.finished)return false;
 if(s.ocean?.pump?.started&&!s.ocean.pump.done)return false;
 if(s.living.some(e=>e.kind==='boss'||distance(e,s.p)<13))return false;
 if(s.shots.some(q=>q.life>0&&distance(q,s.p)<15)||s.waves.some(q=>q.life>0&&Math.abs(distance(q,s.p)-q.r)<6))return false;
 if(s.hazards?.some(q=>distance(q,s.p)<5&&q.t<2.6))return false;
 if(s.laser?.active&&Math.abs(s.p.z-s.laser.z)<2||s.surge?.active&&Math.abs(s.p.z-s.surge.z)<3)return false;
 return !s.geo.platforms.some(f=>f.fragile&&Math.abs(s.p.x-f.x)<f.w/2&&Math.abs(s.p.z-f.z)<f.d/2);
}
export function attachGrowth(state,{saveKey,saved=null,storage=storageDefault()}={}){
 if(state.growth)return state;
 const saves=new Map(SAVE_KEYS.map(key=>[key,readJson(storage,key)]));if(saveKey&&saved?.version===1)saves.set(saveKey,saved);
 if(saveKey&&!saves.get(saveKey))saves.set(saveKey,{version:1,crystals:state.crystals});
 let account=validRecord(readJson(storage,GROWTH_KEY));
 if(!account){
  const copies=[...saves.values()].map(v=>validRecord(v?.growthR1449)).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt||b.revision-a.revision);
  account=copies[0]||newRecord([...saves.values()].reduce((sum,v)=>sum+(v?.version===1&&!v.growthR1449?number(v.crystals,0,9999):0),0));
 }
 let restoring=0,error='',paused=()=>false,stale=false,stats=statsFor(account.levels);
 const persist=record=>{try{if(!storage)throw Error('no-storage');storage.setItem(GROWTH_KEY,JSON.stringify(record));error='';return true;}catch{error='Браузер не сохранил покупку. Освободи место или разреши сохранение данных сайта.';return false;}};
 persist(account);
 function refresh(){const disk=validRecord(readJson(storage,GROWTH_KEY));if(disk&&disk.run!==account.run){stale=true;return;}if(disk&&disk.revision>account.revision){account=disk;stats=statsFor(account.levels);}}
 function commit(change,strict){
  refresh();if(stale)return false;
  const next={...account,levels:{...account.levels},revision:account.revision+1,updatedAt:Date.now()};change(next);
  if(!persist(next)&&strict)return false;
  account=next;stats=statsFor(account.levels);return true;
 }
 Object.defineProperty(state,'crystals',{configurable:true,get:()=>account.balance,set(value){if(restoring)return;const delta=number(value,0,9999)-account.balance;if(delta)commit(r=>r.balance=number(r.balance+delta,0,9999),false);}});
 Object.defineProperty(state,'growthStats',{configurable:true,get:()=>stats});
 const base={load:state.load.bind(state),restore:state.restore.bind(state),snapshot:state.snapshot.bind(state),update:state.update.bind(state),damage:state.damage.bind(state)};
 state.damage=function(n){return base.damage(Math.max(1,Math.round(n*(1-stats.armor))));};
 state.load=function(...args){restoring++;try{return base.load(...args);}finally{restoring--;}};
 state.restore=function(...args){restoring++;try{return base.restore(...args);}finally{restoring--;}};
 state.snapshot=function(){return {...base.snapshot(),growthR1449:{...account,levels:{...account.levels}}};};
 state.update=function(dt,input){const active=!this.dead&&!this.won&&!this.finale&&!this.race?.mounted,zone=this.zone;base.update(dt,input);if(active&&this.zone===zone&&!this.dead&&!this.finale)this.p.energy=Math.min(100,this.p.energy+Math.max(0,Math.min(.035,dt))*(stats.energyRegen-5));};
 state.growth={bindPause(fn){paused=fn;},read(){refresh();return {balance:account.balance,levels:{...account.levels},safe:safeToUpgrade(state),paused:paused(),error,stale};},
  purchase(id){
   refresh();const item=UPGRADES.find(q=>q.id===id),level=item?account.levels[id]:3;
   if(stale)return {ok:false,message:'В другой вкладке начата новая игра. Перезагрузи эту вкладку.'};
   if(!item||level>=item.costs.length)return {ok:false,message:'Эта ветка уже улучшена полностью.'};
   if(!paused()||!safeToUpgrade(state))return {ok:false,message:'Покупки доступны в паузе, когда рядом нет боя.'};
   if(account.balance<item.costs[level])return {ok:false,message:'Нужно '+item.costs[level]+' кристаллов.'};
   const ok=commit(r=>{r.balance-=item.costs[level];r.levels[id]++;},true);
   if(!ok)return {ok:false,message:error||'Не удалось сохранить покупку.'};
   state.emit('upgradeBought',{upgrade:id,level:level+1});return {ok:true,message:item.name+' · уровень '+(level+1)+' сохранён.'};
  }};
 return attachNarration(attachTactics(attachWeaponry(state,{storage,saved,saveKey}),{saved}),{saved});
}
