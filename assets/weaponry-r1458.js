import {blocked} from './portrait-core-r1295.js?v=r1468';
export const WEAPON_KEY='andrik-lyra-weapons-r1458';
export const WEAPONS={sword:{name:'Меч',costs:[3,5,8,11,14,18]},bat:{name:'Бейсбольная бита',costs:[3,5,8,11,14,18]}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Math.floor(Number(v)||0))),d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function valid(q){if(q?.version!==1)return null;return{version:1,selected:q.selected==='bat'?'bat':'sword',balance:clamp(q.balance,0,9999),levels:{sword:clamp(q.levels?.sword,0,6),bat:clamp(q.levels?.bat,0,6)},claims:Array.isArray(q.claims)?[...new Set(q.claims.filter(x=>typeof x==='string'&&x.length<140))].slice(-1000):[],revision:clamp(q.revision,0,1e9)};}
export function attachWeaponry(s,{storage,saved,saveKey}={}){
 if(s.weaponry)return s;let record;try{record=valid(JSON.parse(storage?.getItem(WEAPON_KEY)||'null'));}catch{}record=record||valid(saved?.weaponryR1458)||{version:1,selected:'sword',balance:0,levels:{sword:0,bat:0},claims:[],revision:0};let error='',restoring=false,stats;
 const chapter=saveKey||('world-'+s.world),claimKey=id=>chapter+':'+s.zone+':'+id;
 const refresh=()=>{const level=record.levels[record.selected];stats={selected:record.selected,level,damage:1+level*.15,rangeBonus:level*.08};};refresh();
 function persist(next,strict=false){try{if(!storage)throw Error();storage.setItem(WEAPON_KEY,JSON.stringify(next));error='';}catch{error='Не удалось сохранить оружие в браузере.';if(strict)return false;}record=next;refresh();return true;}
 persist(record);Object.defineProperty(s,'weaponStats',{configurable:true,get:()=>stats});
 const base={load:s.load.bind(s),restore:s.restore.bind(s),update:s.update.bind(s),snapshot:s.snapshot.bind(s),attackHit:s.attackHit.bind(s),emit:s.emit.bind(s)};
 function buildCrates(prior=[]){
  s.weaponCrates=[];s.weaponDrops=[];s.geo.walls=s.geo.walls.filter(w=>!w.weaponCrate);s.geo.platforms=s.geo.platforms.filter(f=>!f.weaponCrate);if(s.routeLinks)s.routeLinks=s.routeLinks.filter(e=>!e.weaponCrate);
  if(s.zone===3&&s.isCity)return;
  const main=s.geo.platforms.filter(f=>!f.objectTop&&!f.refuge&&!f.bridge&&!f.stair),single=main.length<3;
  for(let i=0;i<3;i++){const f=main[Math.min(main.length-1,Math.floor(main.length*[.25,.55,.77][i]))];if(!f)continue;const radial=s.world===4&&!single,rad=Math.hypot(f.x,f.z)||1;const id='weapon-cache-'+i,x=radial?f.x+f.x/rad*1.8:single?(i%2?-1:1)*Math.min(6.5,f.w*.28):f.x+f.w*.28,z=radial?f.z+f.z/rad*1.8:single?Math.max(7,s.geo.length*[.23,.50,.73][i]):f.z-.65,y=f.h,old=prior.find(q=>q.id===id),q={id,x,y,z,hp:old?.hp===0?0:36,max:36,broken:old?.hp===0||record.claims.includes(claimKey(id)),collected:record.claims.includes(claimKey(id)),flash:0};if(q.broken)q.hp=0;
   s.weaponCrates.push(q);if(!q.broken){const top={x,z,w:1.05,d:1.05,h:y+1.05,objectTop:true,weaponCrate:true,weaponCrateId:id,supportNode:f.node,node:s.geo.platforms.length,route:f.route||0};s.geo.platforms.push(top);s.geo.walls.push({x,z,w:1.05,d:1.05,h:y+1.05,base:y,weaponCrate:true,weaponCrateId:id});if(s.routeLinks&&f.node!==undefined)s.routeLinks.push({a:f.node,b:top.node,jump:true,weaponCrate:true});}
   else if(!q.collected)s.weaponDrops.push({id,x,y,z,taken:false});
  }
 }
 function dropCore(id,p){if(record.claims.includes(claimKey(id))||s.weaponDrops.some(q=>q.id===id))return;s.weaponDrops.push({id,x:p.x,y:p.y||0,z:p.z,taken:false});s.emit('weaponCacheBreak',{x:p.x,y:p.y||0,z:p.z});}
 s.emit=function(type,data={}){base.emit(type,data);if(type==='smashR1301')dropCore('city-crate-'+data.x+':'+data.z,data);};
 s.load=function(...args){const result=base.load(...args);buildCrates();return result;};
 s.restore=function(data){restoring=true;try{const result=base.restore(data);buildCrates(data?.weaponCratesR1458||[]);if(Array.isArray(data?.weaponDropsR1458))for(const q of data.weaponDropsR1458.slice(0,30)){if(typeof q.id==='string'&&['x','y','z'].every(k=>Number.isFinite(q[k]))&&!record.claims.includes(claimKey(q.id))&&!s.weaponDrops.some(d=>d.id===q.id))s.weaponDrops.push({...q,taken:false});}return result;}finally{restoring=false;}};
 s.damageWeaponCrate=function(id,damage,source='player'){
  const q=s.weaponCrates.find(q=>q.id===id);if(!q||q.broken||!Number.isFinite(damage)||damage<=0)return false;
  q.hp=Math.max(0,q.hp-damage);q.flash=.16;s.emit('weaponCacheHit',{x:q.x,y:q.y,z:q.z,source});
  if(!q.hp){q.broken=true;s.geo.walls=s.geo.walls.filter(w=>w.weaponCrateId!==q.id);for(const f of s.geo.platforms)if(f.weaponCrateId===q.id){f.gone=true;for(const e of s.enemies){if(e.navJump?.node===f.node){e.navJump.to.y=q.y;e.navJump.node=f.supportNode;}if(e.navPlatform===f.node&&Math.abs((e.y||0)-f.h)<.25&&d(e,q)<1.6){e.y=e.homeY=q.y;e.navPlatform=f.supportNode;e.routeUntil=0;}}}if(s.routeLinks)s.routeLinks=s.routeLinks.filter(e=>!e.weaponCrate||s.geo.platforms[e.b]?.weaponCrateId!==q.id);dropCore(q.id,q);}return true;
 };
 function strikeCrates(){const a=s.attack;if(!a||!['slash','attack','kick','punch','backfist'].includes(a.kind))return;const range=(s.growthStats?.bladeRange||2.85)+(stats.rangeBonus||0)+(stats.selected==='bat'?.25:0);a.weaponCrates??=new Set();
  for(const q of s.weaponCrates){const len=d(q,s.p),dot=((q.x-s.p.x)*Math.sin(s.p.yaw)+(q.z-s.p.z)*Math.cos(s.p.yaw))/Math.max(.01,len);if(q.broken||a.weaponCrates.has(q.id)||len>range||Math.abs(q.y-s.p.y)>1.5||!a.bladeSpin&&dot<.05||blocked(s.p,q,s.geo.walls.filter(w=>w.weaponCrateId!==q.id)))continue;a.weaponCrates.add(q.id);s.damageWeaponCrate(q.id,Math.round((stats.selected==='bat'?26:20)*stats.damage));}

 }
 s.attackHit=function(){base.attackHit();strikeCrates();};
 s.update=function(dt,input){base.update(dt,input);if(s.dead||s.vehicleActive)return;for(const q of s.weaponCrates)q.flash=Math.max(0,q.flash-dt);for(const q of s.weaponDrops){if(q.taken||d(q,s.p)>1.5||Math.abs(q.y-s.p.y)>1.5)continue;const key=claimKey(q.id);q.taken=true;if(!record.claims.includes(key)){persist({...record,balance:Math.min(9999,record.balance+1),claims:[...record.claims,key].slice(-1000),revision:record.revision+1});s.emit('weaponBonus',{x:q.x,y:q.y,z:q.z});s.emit('notice',{text:'Оружейный бонус +1 · улучшения оружия доступны в паузе'});}}s.weaponDrops=s.weaponDrops.filter(q=>!q.taken);};
 s.snapshot=function(){return{...base.snapshot(),weaponryR1458:{...record,levels:{...record.levels},claims:[...record.claims]},weaponCratesR1458:s.weaponCrates.map(q=>({id:q.id,hp:q.hp})),weaponDropsR1458:s.weaponDrops.map(q=>({...q}))};};
 const available=()=>!s.dead&&!s.attack&&!s.vehicleActive&&!(s.race?.mounted&&!s.race.finished);
 s.weaponry={read(){return{...record,levels:{...record.levels},claims:undefined,error,available:available()};},select(id){if(!WEAPONS[id]||!s.growth?.read().paused||!available())return{ok:false,message:'Выбери оружие в паузе, закончив текущий удар.'};if(!persist({...record,selected:id,revision:record.revision+1},true))return{ok:false,message:error};s.emit('weaponChanged',{weapon:id});return{ok:true,message:WEAPONS[id].name+' · выбрано'};},upgrade(id){const level=record.levels[id],definition=WEAPONS[id];if(!definition||level>=definition.costs.length)return{ok:false,message:'Оружие улучшено до максимума.'};if(!s.growth?.read().paused||!available()||s.living.some(e=>d(e,s.p)<12))return{ok:false,message:'Улучшай оружие в паузе вдали от противников.'};const cost=definition.costs[level];if(record.balance<cost)return{ok:false,message:'Нужно '+cost+' оружейных бонусов.'};if(!persist({...record,balance:record.balance-cost,levels:{...record.levels,[id]:level+1},revision:record.revision+1},true))return{ok:false,message:error};s.emit('weaponUpgrade',{weapon:id,level:level+1});return{ok:true,message:definition.name+' · уровень '+(level+1)+' сохранён'};}};
 buildCrates(saved?.weaponCratesR1458||[]);if(Array.isArray(saved?.weaponDropsR1458))for(const q of saved.weaponDropsR1458.slice(0,30))if(typeof q.id==='string'&&['x','y','z'].every(k=>Number.isFinite(q[k]))&&!record.claims.includes(claimKey(q.id))&&!s.weaponDrops.some(d=>d.id===q.id))s.weaponDrops.push({...q});return s;
}
