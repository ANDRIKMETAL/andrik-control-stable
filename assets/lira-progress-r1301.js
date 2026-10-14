/* ANDRIK R1301 — three-chapter 3D gameplay improvements; no 2D path.
   All modifications are per-state-instance, not global prototype patches. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const VARIANTS={easy:{incoming:.70,outgoing:1.22},normal:{incoming:1,outgoing:1},hard:{incoming:1.35,outgoing:.87}};
const labels={city:'STREETS',portrait:'PORTRAIT',ruins:'RUINS'};
const diffKey='andrik-difficulty-r1301';
const safeRead=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function attachProgressR1301(state,saved,chapter){
 if(state.r1301)return state;
 chapter=['city','portrait','ruins'].includes(chapter)?chapter:'portrait';
 const base={load:state.load.bind(state),hit:state.hit.bind(state),damage:state.damage.bind(state),update:state.update.bind(state),snapshot:state.snapshot.bind(state),interact:state.interact.bind(state),attackHit:state.attackHit.bind(state),enemy:state.enemy.bind(state)};
 const getter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Object.getPrototypeOf(state)),'canInteract')||Object.getOwnPropertyDescriptor(Object.getPrototypeOf(state),'canInteract');
 const d=saved?.r1301?.difficulty||safeRead(diffKey)||'normal';
 const previous=saved?.r1301||{};
 const progress={difficulty:VARIANTS[d]?d:'normal',score:clamp(Number(previous.score)||0,0,9999999),kills:clamp(Number(previous.kills)||0,0,99999),hits:clamp(Number(previous.hits)||0,0,99999),maxCombo:clamp(Number(previous.maxCombo)||0,0,9999),combo:0,lastHit:-20,damageTaken:clamp(Number(previous.damageTaken)||0,0,999999),deaths:clamp(Number(previous.deaths)||0,0,9999),parries:clamp(Number(previous.parries)||0,0,9999),secrets:clamp(Number(previous.secrets)||0,0,100),objects:clamp(Number(previous.objects)||0,0,999),activeSeconds:clamp(Number(previous.activeSeconds)||0,0,999999),checkpoint:clamp(Number(previous.checkpoint)||0,0,4),mid:null};
 state.r1301=progress;
 let checkpointBackup=previous.midSnapshot&&typeof previous.midSnapshot==='object'&&previous.midSnapshot.zone===state.zone?previous.midSnapshot:null;
 let checkpointRestore=false,restoring=false, lastZone=state.zone;
 const hasSecret=()=>chapter==='portrait'&&state.zone<2;
 const secretsForZone=(zone)=>zone===0?[{id:'echo',x:-9,z:11,kind:'reward'},{id:'ambush',x:9,z:25,kind:'trap'},{id:'memory',x:-9,z:39,kind:'memory'}]:zone===1?[{id:'gallery',x:7,z:22,kind:'reward'}]:[];
 let secrets=secretsForZone(state.zone), opened=new Set(Array.isArray(previous.opened)&&saved?.zone===state.zone?previous.opened:[]);
 const nearSecret=()=>hasSecret()?secrets.find(q=>!opened.has(q.id)&&distance(q,state.p)<2.8&&state.p.y<1.3):undefined;
 const crates=()=>chapter==='city'?state.geo.props.filter(q=>q.type==='crate'):[];
 if(chapter==='city'){
  // Restore previously smashed crates and their collision geometry.
  const prior=Array.isArray(previous.smashed)&&saved?.zone===state.zone?previous.smashed:[];
  for(const q of crates())if(prior.includes(q.x+':'+q.z))q.destroyed=true;
  state.geo.walls=state.geo.walls.filter(w=>!crates().some(q=>q.destroyed&&Math.abs(w.x-q.x)<.01&&Math.abs(w.z-q.z)<.01));
 }
 const originalCan=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(state),'canInteract')?.get||getter?.get;
 if(chapter==='portrait'&&originalCan){Object.defineProperty(state,'canInteract',{configurable:true,get(){return !!nearSecret()||originalCan.call(this);}});}
 state.r1301SecretMarkers=()=>secrets.map(q=>({...q,opened:opened.has(q.id)}));state.r1301HasCheckpoint=()=>checkpointBackup?.zone===state.zone;
 state.resetR1301=()=>{const difficulty=progress.difficulty;for(const field of ['score','kills','hits','maxCombo','combo','damageTaken','deaths','parries','secrets','objects','activeSeconds','checkpoint'])progress[field]=0;progress.lastHit=-20;progress.difficulty=difficulty;checkpointBackup=null;checkpointRestore=false;opened.clear();state.load(0);state.emit('puzzle');};
 const saveData=()=>({...progress,combo:0,lastHit:-20,opened:[...opened],smashed:crates().filter(q=>q.destroyed).map(q=>q.x+':'+q.z),midSnapshot:checkpointBackup});
 state.snapshot=function(){return {...base.snapshot(),r1301:saveData()};};
 state.load=function(zone){
  const isDeath=checkpointRestore&&!restoring;
  const backup=isDeath&&checkpointBackup?.zone===zone?checkpointBackup:null;
  checkpointRestore=false;
  base.load(zone);
  if(backup){
   restoring=true;
   try{ // Full original restore includes enemy states, objective progress and player position.
    // Use the base-class restore: it reloads the zone, preserving R1301 bookkeeping.
    const restore=Object.getPrototypeOf(this)?.restore;
    restore.call(this,backup);
    this.p.inv=2;this.p.hp=Math.max(this.p.hp,65);this.p.energy=Math.max(this.p.energy,65);
    this.emit('notice',{text:'Контрольная точка восстановлена'});
   }catch(err){console.warn('R1301 checkpoint restore',err);}finally{restoring=false;}
  }
  if(!restoring){
   if(lastZone!==zone){checkpointBackup=null;lastZone=zone;}
   progress.combo=0;progress.lastHit=-20;progress.checkpoint=zone;
   secrets=secretsForZone(zone);opened=new Set(backup?.r1301Checkpoint?.opened||[]);
   if(backup?.r1301Checkpoint?.smashed&&chapter==='city'){for(const q of crates())q.destroyed=backup.r1301Checkpoint.smashed.includes(q.x+':'+q.z);this.geo.walls=this.geo.walls.filter(w=>!crates().some(q=>q.destroyed&&Math.abs(w.x-q.x)<.01&&Math.abs(w.z-q.z)<.01));}
  }
 };
 if(chapter==='ruins')state.enemy=function(e,dt){
  if(e?.kind!=='double'||e.hp<=0){base.enemy(e,dt);return;}
  if(e.hop){e.hop.t+=dt;const u=Math.min(1,e.hop.t/.7);e.x=e.hop.x+(e.hop.tx-e.hop.x)*u;e.z=e.hop.z+(e.hop.tz-e.hop.z)*u;e.y=Math.sin(u*Math.PI)*1.7;if(u===1){e.hop=null;e.y=0;}return;}
  const ox=e.x,oz=e.z;base.enemy(e,dt);
  if(!state.support(e.x,e.z)&&state.support(ox,oz)){const dx=e.x-ox,dz=e.z-oz,len=Math.hypot(dx,dz)||1;let landing=null;for(let step=.3;step<=3.6;step+=.15){const x=ox+dx/len*step,z=oz+dz/len*step;if(state.support(x,z,.15)){landing={x,z};break;}}e.x=ox;e.z=oz;if(landing)e.hop={x:ox,z:oz,tx:landing.x,tz:landing.z,t:0};}
 };
 state.damage=function(n){
  if(this.p.inv>0||this.dead||this.finale||this.won)return;
  const amount=Math.max(1,Math.round(n*VARIANTS[progress.difficulty].incoming));
  const before=this.p.hp;base.damage(amount);
  const actual=before-this.p.hp;
  if(actual>0){progress.damageTaken+=actual;progress.combo=0;progress.lastHit=-20;this.emit('comboBreak');}
  if(before>0&&this.p.hp===0){progress.deaths++;checkpointRestore=!!checkpointBackup;}
 };
 state.hit=function(enemy,amount,knock){
  if(!enemy||enemy.hp<=0)return;
  const before=enemy.hp;
  base.hit(enemy,Math.max(1,Math.round(amount*VARIANTS[progress.difficulty].outgoing)),knock);
  if(enemy.hp>=before)return;
  progress.hits++;
  progress.combo=(this.time-progress.lastHit<=2.8)?Math.min(99,progress.combo+1):1;
  progress.lastHit=this.time;
  progress.maxCombo=Math.max(progress.maxCombo,progress.combo);
  const gained=10*progress.combo;
  progress.score+=gained;
  this.emit('comboR1301',{count:progress.combo,points:gained,x:enemy.x,z:enemy.z});
  if(enemy.hp<=0){progress.kills++;progress.score+=100+Math.min(600,progress.combo*30);if(progress.combo===5||progress.combo===10){this.crystals=Math.min(9999,this.crystals+progress.combo/5);this.emit('notice',{text:'КОМБО x'+progress.combo+' · бонус кристаллов!'});}}
 };
 state.interact=function(){
  const secret=nearSecret();
  if(secret){
   opened.add(secret.id);progress.secrets++;progress.score+=200;
   if(secret.kind==='trap'){
    this.spawn('shadow',0,Math.max(5,secret.z-3));this.spawn('mask',-3,Math.max(5,secret.z-5));
    this.emit('notice',{text:'Ловушка! Картина выпустила две тени'});
   }else if(secret.kind==='memory'){
    this.p.energy=100;this.crystals=Math.min(9999,this.crystals+6);
    this.emit('notice',{text:'Тайна портрета: +6 кристаллов, энергия восстановлена'});
   }else{
    this.p.hp=Math.min(100,this.p.hp+25);this.crystals=Math.min(9999,this.crystals+4);
    this.emit('notice',{text:'Тайник в картине: +4 кристалла, +25 HP'});
   }
   this.emit('secretR1301',{x:secret.x,z:secret.z});this.emit('puzzle');return;
  }
  base.interact();
 };
 state.attackHit=function(){
  const before=chapter==='ruins'?new Set(this.shots.filter(s=>s.reflectable&&!s.friendly&&s.life>0)):null;
  base.attackHit();
  if(before){const deflected=[...before].filter(s=>s.friendly||s.life<=0).length;if(deflected){progress.parries+=deflected;progress.score+=deflected*150;this.crystals=Math.min(9999,this.crystals+deflected);this.emit('parryR1301',{count:deflected,x:this.p.x,z:this.p.z});}}
  if(chapter==='city'&&this.attack?.kind==='attack'&&this.zone<2){
   for(const q of crates()){
    if(q.destroyed||distance(q,this.p)>3.0)continue;
    const dx=q.x-this.p.x,dz=q.z-this.p.z,d=Math.hypot(dx,dz)||1;
    if((dx*Math.sin(this.p.yaw)+dz*Math.cos(this.p.yaw))/d<-.1)continue;
    q.destroyed=true;
    this.geo.walls=this.geo.walls.filter(w=>!(Math.abs(w.x-q.x)<.01&&Math.abs(w.z-q.z)<.01&&w.h<2));
    this.drops.push({id:'r1301-crate-'+this.zone+'-'+q.x+'-'+q.z,kind:'crystal',x:q.x,z:q.z,age:0});
    this.drops.push({id:'r1301-crate2-'+this.zone+'-'+q.x+'-'+q.z,kind:'crystal',x:q.x+.5,z:q.z+.4,age:0});
    progress.objects++;progress.score+=120;
    this.emit('smashR1301',{x:q.x,z:q.z});this.emit('notice',{text:'Ящик разбит! Кристаллы внутри'});this.emit('puzzle');
   }
  }
 };
 state.update=function(dt,input){
  const wasDead=!!this.dead,wasZone=this.zone;
  const seconds=clamp(Number(dt)||0,0,.035);
  if(!this.won&&!this.dead&&!this.finale)progress.activeSeconds+=seconds;
  if(progress.combo>0&&this.time-progress.lastHit>2.8){progress.combo=0;this.emit('comboBreak');}
  base.update(dt,input);
  if(!wasDead&&this.dead){checkpointRestore=!!checkpointBackup;if(this.p.hp>0)progress.deaths++;}
  // Checkpoint in the middle of safe corridor, with full level state, once per zone.
  if(this.zone===wasZone&&this.zone<4&&!this.dead&&!this.finale&&!this.won&&this.p.grounded&&this.p.z>this.geo.length*.53&&this.p.z<this.geo.length*.77&&this.zone!==3&&(!checkpointBackup||checkpointBackup.zone!==this.zone)){
   checkpointBackup=base.snapshot();checkpointBackup.r1301Checkpoint={opened:[...opened],smashed:crates().filter(q=>q.destroyed).map(q=>q.x+':'+q.z)};progress.score+=75;
   this.emit('checkpointR1301');
  }
  if(this.zone!==wasZone){checkpointBackup=null;progress.checkpoint=this.zone;}
 };
 state.setDifficulty=function(choice){if(!VARIANTS[choice])return;progress.difficulty=choice;safeWrite(diffKey,choice);this.emit('notice',{text:'Сложность: '+({easy:'Лёгкая',normal:'Нормальная',hard:'Сложная'}[choice])});this.emit('puzzle');};
 state.r1301Result=()=>{
  const seconds=Math.max(1,Math.round(progress.activeSeconds));
  const score=Math.round(progress.score+(progress.damageTaken===0?1000:0)+(progress.deaths===0?500:0));
  const grade=score>8000?'S':score>4700?'A':score>2400?'B':'C';
  const result={chapter,difficulty:progress.difficulty,score,grade,seconds,kills:progress.kills,maxCombo:progress.maxCombo,deaths:progress.deaths,parries:progress.parries,secrets:progress.secrets,objects:progress.objects,damageTaken:progress.damageTaken};
  const key='andrik-best-r1301-'+chapter+'-'+progress.difficulty;
  let prev=null;try{prev=JSON.parse(safeRead(key)||'null');}catch{}if(!prev||score>prev.score)safeWrite(key,JSON.stringify(result));
  return result;
 };
 return state;
}
export function createProgressUiR1301(root,state,chapter){
 const h=root.querySelector('.pt-health'),card=root.querySelector('.pt-card');
 if(!h||!card)return ()=>{};
 const hud=document.createElement('div');hud.className='r1301-stats';hud.innerHTML='<span data-r1301="score">★ 0</span><span data-r1301="combo"></span><span data-r1301="checkpoint"></span>';h.append(hud);
 const label=document.createElement('label');label.className='r1301-difficulty';label.innerHTML='<span>Сложность</span><select id="r1301-difficulty"><option value="easy">Лёгкая</option><option value="normal">Нормальная</option><option value="hard">Сложная</option></select>';
 const row=card.querySelector('.pt-row');card.insertBefore(label,row||null);
 const select=label.querySelector('select');select.value=state.r1301.difficulty;
 select.addEventListener('change',()=>{state.setDifficulty(select.value);root.querySelector('.pt-panel').hidden=false;});
 const results=document.createElement('section');results.className='r1301-results';results.hidden=true;card.insertBefore(results,row||null);
 const score=hud.querySelector('[data-r1301="score"]'),combo=hud.querySelector('[data-r1301="combo"]'),cp=hud.querySelector('[data-r1301="checkpoint"]');
 let lastCombo=0,finished=false;
 function refresh(){const p=state.r1301;
  score.textContent='★ '+Math.round(p.score).toLocaleString('ru');
  combo.textContent=p.combo>1?'⚡ КОМБО x'+p.combo:'';
  if(lastCombo!==p.combo){combo.classList.remove('pulse');void combo.offsetWidth;combo.classList.add('pulse');lastCombo=p.combo;}
  cp.textContent='⚑ '+(state.zone+1)+'/5'+(state.r1301HasCheckpoint()?' ✓':'');
  if(state.won&&!finished){finished=true;const r=state.r1301Result();results.hidden=false;
   const phrases=[['ГЛАВА ПРОЙДЕНА','CHAPTER COMPLETE'],['Ранг','Rank'],['Очки','Score'],['Победы','Defeats'],['Лучшее комбо','Best combo'],['Падения','Deaths'],['Секреты','Secrets'],['Отбитые снаряды','Deflections'],['Время','Time'],['Сложность','Difficulty']];
   // Use Russian source text; global i18n translates this section live.
   results.innerHTML='<h2>ГЛАВА ПРОЙДЕНА · '+r.grade+'</h2><div><span>Очки</span><b>'+r.score+'</b><span>Победы</span><b>'+r.kills+'</b><span>Лучшее комбо</span><b>x'+r.maxCombo+'</b><span>Падения</span><b>'+r.deaths+'</b><span>Секреты</span><b>'+r.secrets+'</b><span>Отбитые снаряды</span><b>'+r.parries+'</b><span>Время</span><b>'+Math.floor(r.seconds/60)+':'+String(r.seconds%60).padStart(2,'0')+'</b></div>';
   window.AndrikI18n?.refresh?.();
  }
 }
 refresh.reset=()=>{finished=false;results.hidden=true;results.textContent='';lastCombo=0;refresh();};
 return refresh;
}
