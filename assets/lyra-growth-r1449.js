export const GROWTH_KEY='andrik-lyra-growth-r1449';
export const SAVE_KEYS=['andrik-city-3d-r1289','andrik-portrait-r1280','andrik-ruins-3d-r1285',...['2','3','4','5'].map(id=>'andrik-world-'+id+'-r1306')];
const number=(v,a,b)=>Math.max(a,Math.min(b,Math.floor(Number(v)||0)));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const UPGRADES=Object.freeze([
 {id:'energy',name:'Дыхание',costs:[8,16],effects:['Восстановление энергии: 6/с вместо 5/с.','Восстановление энергии: 7/с вместо 5/с.']},
 {id:'guitar',name:'Резонанс',costs:[10,20],effects:['Гитара: +10% урона, радиус 3,70 м.','Гитара: +20% урона, радиус 3,85 м.']},
 {id:'combo',name:'Связка',costs:[12,24],effects:['Четвёртое короткое B: удар кулаком с разворота, 28 урона.','Удар с разворота: 34 урона; пауза между B до 1,8 с.']}
]);
export function statsFor(levels={}){
 const e=number(levels.energy,0,2),g=number(levels.guitar,0,2),c=number(levels.combo,0,2);
 return {energyRegen:5+e,guitarDamage:1+g*.1,guitarRange:(355+g*15)/100,comboLevel:c,comboWindow:c===2?1800:1400,backfistDamage:c===2?34:28};
}
export function validRecord(raw){
 if(raw?.version!==1||typeof raw.run!=='string'||raw.run.length<4||raw.run.length>96||!Number.isSafeInteger(raw.revision)||raw.revision<0||raw.revision>1e9||!Number.isSafeInteger(raw.balance)||raw.balance<0||raw.balance>9999)return null;
 return {version:1,run:raw.run,revision:raw.revision,balance:raw.balance,updatedAt:number(raw.updatedAt,0,1e15),levels:Object.fromEntries(UPGRADES.map(q=>[q.id,number(raw.levels?.[q.id],0,2)]))};
}
function readJson(storage,key){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
function storageDefault(){try{return localStorage;}catch{return null;}}
function newRecord(balance=0){return {version:1,run:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),revision:0,balance:number(balance,0,9999),updatedAt:Date.now(),levels:{energy:0,guitar:0,combo:0}};}
export function safeToUpgrade(s){
 if(s.dead)return false;if(s.won)return true;
 if(s.finale||s.attack||!s.p.grounded||s.race?.mounted&&!s.race.finished)return false;
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
 const base={load:state.load.bind(state),restore:state.restore.bind(state),snapshot:state.snapshot.bind(state),update:state.update.bind(state)};
 state.load=function(...args){restoring++;try{return base.load(...args);}finally{restoring--;}};
 state.restore=function(...args){restoring++;try{return base.restore(...args);}finally{restoring--;}};
 state.snapshot=function(){return {...base.snapshot(),growthR1449:{...account,levels:{...account.levels}}};};
 state.update=function(dt,input){const active=!this.dead&&!this.won&&!this.finale&&!this.race?.mounted,zone=this.zone;base.update(dt,input);if(active&&this.zone===zone&&!this.dead&&!this.finale)this.p.energy=Math.min(100,this.p.energy+Math.max(0,Math.min(.035,dt))*(stats.energyRegen-5));};
 state.growth={bindPause(fn){paused=fn;},read(){refresh();return {balance:account.balance,levels:{...account.levels},safe:safeToUpgrade(state),paused:paused(),error,stale};},
  purchase(id){
   refresh();const item=UPGRADES.find(q=>q.id===id),level=item?account.levels[id]:2;
   if(stale)return {ok:false,message:'В другой вкладке начата новая игра. Перезагрузи эту вкладку.'};
   if(!item||level>=2)return {ok:false,message:'Эта ветка уже улучшена полностью.'};
   if(!paused()||!safeToUpgrade(state))return {ok:false,message:'Покупки доступны в паузе, когда рядом нет боя.'};
   if(account.balance<item.costs[level])return {ok:false,message:'Нужно '+item.costs[level]+' кристаллов.'};
   const ok=commit(r=>{r.balance-=item.costs[level];r.levels[id]++;},true);
   if(!ok)return {ok:false,message:error||'Не удалось сохранить покупку.'};
   state.emit('upgradeBought',{upgrade:id,level:level+1});return {ok:true,message:item.name+' · уровень '+(level+1)+' сохранён.'};
  }};
 return state;
}
