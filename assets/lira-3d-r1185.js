import * as T from './vendor/three-r170.module.min.js';
import {material,box,sphere,cylinder,cone,ring,mesh,character,animateCharacter,dog,motorcycle,ship,collectible,crate,barrel,release} from './lira-models-r1185.js';
import {buildWorld,moveWorld} from './lira-world-r1182.js';
const game=window.LiraGame,classic=new URLSearchParams(location.search).get('graphics')==='classic';
if(game&&!classic)boot().catch(error=>{console.error('Dreaming of Líra 3D unavailable:',error);document.body.classList.remove('lira3d','menu-open');document.getElementById('lira3dRoot')?.remove();game.attachRenderer(null);});
async function boot(){
 const root=document.createElement('div');root.id='lira3dRoot';
 root.innerHTML=`<canvas id="lira3dCanvas" aria-label="Трёхмерный мир Dreaming of Líra" tabindex="0"></canvas><div class="lira3d-vignette"></div>
 <div class="lira3d-top"><div class="lira3d-status"><header>LÍRA <span id="liraLives">♥ 3</span></header><div class="lira3d-bar" role="meter" aria-label="Здоровье" aria-valuemin="0" aria-valuemax="100" id="liraHealth"><i></i></div><div class="lira3d-bar super" role="meter" aria-label="Суперудар" aria-valuemin="0" aria-valuemax="100" id="liraSuper"><i></i></div><div class="lira3d-meta"><span id="liraScore">000000</span><span id="liraStars">★ 0</span></div></div><div class="lira3d-level"><small id="liraChapter"></small><strong id="liraLevel"></strong><span id="liraProgress"></span></div><div class="lira3d-tools"><select class="lira3d-tool" id="liraQuality" aria-label="Качество графики"><option value="auto">Авто</option><option value="high">Высокое</option><option value="low">Экономное</option></select><button class="lira3d-tool" id="liraSound" aria-label="Выключить звук" title="Звук" aria-pressed="true">♪</button><button class="lira3d-tool" id="liraFullscreen" aria-label="Полный экран" title="Полный экран">⛶</button><button class="lira3d-tool" id="liraPause" aria-label="Пауза" title="Пауза">Ⅱ</button></div></div>
 <div class="lira3d-bottom"><span><b>WASD / ↑↓←→</b> движение &nbsp; <b>J</b> удар &nbsp; <b>K</b> прыжок &nbsp; <b>C</b> подсечка &nbsp; <b>L</b> супер</span><span><b>J + K</b> меч &nbsp; <b>Enter</b> пауза</span></div>
 <div class="lira3d-message" id="liraMessage" role="status"></div><div class="lira3d-boss" id="liraBoss" hidden><span></span><i></i></div>
 <section class="lira3d-menu" id="liraMenu" aria-label="Меню игры"><a class="lira3d-home" href="/">← ANDRIK METAL</a><div class="lira3d-menu-content"><div class="lira3d-brand">ANDRIK · THE SIX DREAMS</div><h1 id="liraMenuTitle">Dreaming of<em>Líra</em></h1><p id="liraMenuText">Шесть миров одного сна.<br>Пройди сквозь иллюзии. Найди пробуждение.</p><div id="liraLevelList" class="lira3d-level-list" hidden></div><div class="lira3d-menu-actions"><button class="lira3d-button primary" id="liraStart">Войти в сон <span>→</span></button><button class="lira3d-button" id="liraLevels">Миры</button><button class="lira3d-button" id="liraNew">Новая игра</button><a class="lira3d-button" href="?graphics=classic">Классика 2D</a></div><div class="lira3d-help" id="liraHelp"><kbd>WASD / стрелки</kbd> — движение · <kbd>J</kbd> — удар<br><kbd>K</kbd> — прыжок · <kbd>J + K</kbd> — меч · <kbd>L</kbd> — суперудар<br>Прогресс сохраняется автоматически в этом браузере.</div></div><div class="lira3d-edition">3D EDITION · SIX WORLDS · R1185</div></section><div class="lira3d-rotate">Для удобной игры поверни телефон горизонтально.</div>`;
 document.getElementById('gameShell').append(root);
 const canvas=root.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.background=new T.Color('#101b29');scene.fog=new T.FogExp2('#172230',.0015);
 const camera=new T.PerspectiveCamera(41,16/9,1,5000);
 const hemi=new T.HemisphereLight('#c1d8ed','#5b4a42',2.3);scene.add(hemi);
 const sun=new T.DirectionalLight('#c5dce9',3);sun.position.set(-90,370,200);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-380;sun.shadow.camera.right=380;sun.shadow.camera.top=350;sun.shadow.camera.bottom=-250;sun.shadow.camera.far=1100;sun.shadow.bias=-.001;sun.shadow.normalBias=.6;scene.add(sun,sun.target);
 const rim=new T.DirectionalLight('#ceab78',1.3);rim.position.set(250,120,-180);scene.add(rim);
 const spot=new T.PointLight('#f8ca87',2800,180,2);spot.position.set(45,94,-35);scene.add(spot);
 const worldCache=new Map(),dynamic=new T.Group();scene.add(dynamic);let world,mode='',frameCount=0,quality='auto',lastFrame=performance.now(),slow=0,autoLow=false,sound=true,confirmNew=false,menuMode='',lastUI=0,lastSnapshot;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,coarse=matchMedia('(pointer: coarse)').matches;
 const pool=new Map(),used=new Set();
 const names={1:'CITY OF SLEEP',2:'OCEAN',3:'STAR RUNNER',4:'THE TOWER',5:'BLOCK LABYRINTH',6:'RUINS OF EPOCHS'};
 const descriptions={1:'Ночной город · освободи дорогу',2:'Океан · пройди сквозь шторм',3:'Космос · удерживай J для огня',4:'Башня · двойной прыжок K',5:'Лабиринт · J повернуть, K сбросить',6:'Руины эпох · остерегайся щитов'};
 const el=id=>document.getElementById(id);
 const fit=()=>{const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 function qualityApply(){const low=quality==='low'||quality==='auto'&&(coarse||autoLow);renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:1.5));renderer.shadowMap.enabled=!low;fit();}
 try{quality=localStorage.getItem('lira-3d-quality')||'auto';if(!['auto','high','low'].includes(quality))quality='auto';}catch{}
 el('liraQuality').value=quality;el('liraQuality').onchange=e=>{quality=e.target.value;try{localStorage.setItem('lira-3d-quality',quality);}catch{}qualityApply();};qualityApply();new ResizeObserver(fit).observe(root);
 function object(key,create){used.add(key);let obj=pool.get(key);if(!obj){obj=create();pool.set(key,obj);dynamic.add(obj);}obj.visible=true;return obj;}
 function located(key,create,x,y,z=0,scale=1){const o=object(key,create);o.position.set(x,y,z);o.scale.setScalar(scale);return o;}
 function actor(key,p,x,y,z=0,kind='lira',opts={}){const o=located(key,()=>kind==='dog'?dog():character(kind),x,y,z,kind==='boss'?1.5:opts.scale||1);if(kind!=='dog')animateCharacter(o,p,lastSnapshot.elapsed,opts);else{o.rotation.y=(p.face||1)*.4;o.position.y+=Math.abs(Math.sin(lastSnapshot.elapsed*12))*1.4;}return o;}
 function pickup(key,p,x,y,z,kind){if(p.taken||p.picked||p.dead)return;const o=located(key,()=>collectible(kind),x,y+Math.sin(lastSnapshot.elapsed*3+x)*2,z);o.rotation.y=lastSnapshot.elapsed*1.3;}
 function solid(key,x,y,z,w,h,d,color){const o=object(key,()=>box(new T.Group(),0,0,0,1,1,1,material(color,.55,.3)));o.position.set(x,y,z);o.scale.set(w,h,d);o.material=material(color,.55,.3);return o;}
 function orb(key,x,y,z,size,color){const o=object(key,()=>sphere(new T.Group(),0,0,0,1,1,1,material(color,.35,.35,.7)));o.position.set(x,y,z);o.scale.setScalar(size);return o;}
 function floorZ(y=205){return (y-205)*1.65;}
 function setMode(next){if(mode===next)return;mode=next;if(world)scene.remove(world.group);if(!worldCache.has(mode))worldCache.set(mode,buildWorld(mode));world=worldCache.get(mode);scene.add(world.group);scene.background.set(mode==='ruins'?'#292027':mode==='bar'?'#100d17':'#111e2d');scene.fog.color.copy(scene.background);hemi.intensity=mode==='bar'?1.7:2.3;rim.color.set(mode==='ruins'?'#d59466':mode==='ocean'?'#8ac4d8':'#ceab78');}
 function renderSuperFxR1183(s,p){
  const atk=p?.attack,kind=atk?.kind||'';
  if(!/guitar|super/i.test(kind))return;
  const t=Math.max(0,Math.min(1,atk.t/Math.max(.001,atk.duration))),face=(p.face||1)>=0?1:-1;
  const rise=Math.sin(Math.min(1,t/.82)*Math.PI),impact=Math.exp(-Math.pow((t-.48)/.14,2));
  const baseX=p.x+face*(10+t*18),baseY=(p.z||0)+39,baseZ=floorZ(p.y);

  for(let i=0;i<3;i++){
   const delay=i*.12,u=Math.max(0,Math.min(1,(t-delay)/Math.max(.001,.72-delay)));
   if(u<=0)continue;
   const r=located('r1183-super-ring-v-'+i,()=>ring(new T.Group(),0,0,0,1,.024,material(i===1?'#e9b85d':'#c8e9f2',.18,.72,1.25)),baseX+face*i*5,baseY+i*3,baseZ+3);
   r.rotation.set(0,0,face*(i-1)*.08);r.scale.setScalar(10+u*(62+i*12));
  }
  const ground=located('r1183-super-ring-ground',()=>ring(new T.Group(),0,0,0,1,.026,material('#f2c66d',.2,.68,1.2)),p.x,1.2,baseZ);
  ground.rotation.set(Math.PI/2,0,0);ground.scale.setScalar(15+t*105);

  for(let i=0;i<7;i++){
   const a=i*Math.PI*2/7+t*11,rad=13+rise*(20+(i%3)*5),sy=baseY-10+(i%3)*9+Math.sin(t*18+i)*5;
   const sp=orb('r1183-super-spark-'+i,baseX+Math.cos(a)*rad,sy,baseZ+5+Math.sin(a)*10,1.4+impact*2.2,i%2?'#f5c66a':'#d9f3ff');
   sp.rotation.set(t*8+i,t*6,0);
  }
  const core=orb('r1183-super-core',baseX,baseY-1,baseZ+8,3.5+impact*8,'#fff0b3');
  const light=object('r1183-super-light',()=>new T.PointLight('#ffd17b',0,210,2));
  light.position.set(baseX,baseY+8,baseZ+24);light.intensity=1200+impact*7200+rise*1700;
 }
 function renderGround(s,cam){
  const p=s.player;
  actor('lira',p,p.x,p.z||0,floorZ(p.y),'lira',{walking:s.bar.active?(Math.abs(p.x-(renderGround.lastX??p.x))>.01):undefined});renderGround.lastX=p.x;
  renderSuperFxR1183(s,p);
  const enemies=s.bar.active?s.bar.enemies:s.level===6?[...s.ruins.enemies,...(s.ruins.boss?[s.ruins.boss]:[])]:s.enemies;
  for(const e of enemies){if(e.x<cam-90||e.x>cam+620||e.alive===false&&(e.deathTimer||0)<=0)continue;
   const kind=e.type==='dog'||e.r955Dog?'dog':e.type==='boss'||e===s.ruins.boss?'boss':s.level===6?'roman':e.type==='police'||e.type==='riot'?e.type:'gang';
   const enemyAttack=(e.attack&&typeof e.attack==='object')?e.attack:(e.attackAnimR1185||null);
   const enemyPose=enemyAttack?{...e,attack:enemyAttack}:e;
   actor('enemy-'+e.id,enemyPose,e.x,e.z||0,floorZ(e.y),kind,{walking:!enemyAttack,attack:enemyAttack?'punch':undefined,retreat:(e.retreatT||0)>0});
   if(e.alive!==false&&e.hp<e.maxHp){solid('hpbg-'+e.id,e.x,kind==='boss'?112:79,floorZ(e.y),29,2,1,'#272e36');solid('hp-'+e.id,e.x-14.5+(e.hp/e.maxHp)*14.5,kind==='boss'?112:79,floorZ(e.y)+.2,29*Math.max(0,e.hp/e.maxHp),2,1,'#b45660');}
  }
  if(!s.bar.active&&s.level<=2){
   for(const c of s.crates)if(!c.broken&&near(c.x,cam))located('crate-'+c.id,crate,c.x,0,floorZ(c.y));
   for(const h of s.hearts)if(near(h.x,cam))pickup('heart-'+h.id,h,h.x,13,floorZ(h.y),'heart');
   for(const st of s.groundStars)if(near(st.x,cam))pickup('star-'+st.id,st,st.x,22,floorZ(st.y),'star');
   for(const l of s.lifeUps)if(l.level===s.level&&near(l.x,cam))pickup('life-'+l.id,l,l.x,18,floorZ(l.y),'life');
  }
  if(s.bar.active){for(const it of s.bar.items)pickup('bar-item-'+it.id,it,it.x,13,floorZ(it.y),'item');for(let i=0;i<s.bar.shots.length;i++){const p=s.bar.shots[i];solid('barshot-'+i,p.x,22,floorZ(p.y+20),15,1.5,2,'#c4d9e1');}}
  if(s.level===2){for(const b of s.ocean.barrels)if(!b.exploded&&near(b.x,cam))located('barrel-'+b.id,barrel,b.x,0,floorZ(b.y));for(const a of s.ocean.pickups)if(near(a.x,cam))pickup('ocean-item-'+a.id,a,a.x,18,floorZ(a.y),'item');for(let i=0;i<s.ocean.chains.length;i++){const c=s.ocean.chains[i];if(c.dead||!near(c.x,cam))continue;orb('chain-'+i,c.x,25,floorZ(c.y),5,'#c19f7b');}}
  if(s.level===6){
   for(const o of s.ruins.obstacles)if(near(o.x,cam)){solid('ruin-'+o.id,o.x,o.h/2,floorZ(o.y),o.w,o.h,25,o.type==='fire'?'#be693d':'#74665e');if(o.type==='fire')for(let i=0;i<4;i++){const f=located('flame-'+o.id+i,()=>cone(new T.Group(),0,0,0,4,1,material('#db864c',.4,.1,1)),o.x-o.w/2+8+i*10,18,floorZ(o.y));f.scale.set(1,20+Math.sin(s.elapsed*8+i)*7,1);}}
   for(const c of s.ruins.crows)if(c.alive&&near(c.x,cam)){const bird=located('crow-'+c.id,()=>{const g=new T.Group();sphere(g,0,0,0,6,3,3,'#171e28');const a=box(g,-6,0,0,13,1,6,'#1e2630'),b=box(g,6,0,0,13,1,6,'#1e2630');g.userData.wings=[a,b];return g;},c.x,205-c.y,-10);bird.userData.wings.forEach((w,i)=>w.rotation.z=Math.sin(s.elapsed*14)*(i?1:-1)*.6);}
  }
  for(let i=0;i<s.projectiles.length;i++){const b=s.projectiles[i];if(!b.dead&&near(b.x,cam))orb('bullet-'+i,b.x,18,floorZ(b.y),3.2,'#e0b576');}
  if(s.gate&&near(s.gate,cam)&&!s.bar.active){const g=located('gate',()=>{const g=new T.Group();for(let z=-55;z<65;z+=15)cylinder(g,0,8,z,.6,16,material('#c5a269',.4,.2,.4));return g;},s.gate,0,0);}
  for(let i=0;i<s.effects.length;i++){const fx=s.effects[i];if(!near(fx.x,cam))continue;const t=Math.min(1,fx.t/fx.duration);const pulse=/pulse|wave|ring|riff|super|guitar/i.test(fx.kind);if(pulse){const r=located('effect-ring-'+i,()=>ring(new T.Group(),0,0,0,1,.018,material('#b6d4df',.3,.3,1)),fx.x,1.5,floorZ(fx.y));r.rotation.x=-Math.PI/2;r.scale.setScalar(15+t*90);}else{const r=located('effect-spark-'+i,()=>mesh(new T.Group(),new T.OctahedronGeometry(1),material('#eed9ad',.4,.2,1.4)),fx.x,16+(1-t)*10,floorZ(fx.y));r.scale.setScalar(3+5*(1-t));r.rotation.z=s.elapsed*4;}}
 }
 function near(x,c){return Number.isFinite(x)&&x>c-80&&x<c+650;}
 function renderBike(s){
  const b=s.bike;located('bike',()=>motorcycle(),118,b.z,floorZ(b.y));actor('rider',s.player,116,b.z+25,floorZ(b.y),'lira',{ride:true,attack:b.attack>0?'punch':b.super>0?'guitarSmash':null,scale:.68});
  for(const r of b.rivals){const x=118+(r.d-b.distance)*.31;if(!r.alive||!near(x,0))continue;located('bike-rival-'+r.id,()=>motorcycle(r.kind==='police'),x,0,floorZ(r.lane?228:184));actor('bike-rider-'+r.id,{face:-1},x,25,floorZ(r.lane?228:184),r.kind==='police'?'police':'gang',{ride:true,scale:.68});}
  for(let i=0;i<b.pits.length;i++){const p=b.pits[i],x=118+(p.d-b.distance)*.35;if(!near(x,0))continue;solid('pit-'+i,x,.05,floorZ(p.lane?228:184),p.w*.58,.3,42,'#02050a');}
  for(let i=0;i<b.posts.length;i++){const p=b.posts[i],x=118+(p.d-b.distance)*.35;if(near(x,0)){located('post-'+i,()=>{const g=new T.Group();cylinder(g,0,19,0,3,38,'#786951');cylinder(g,0,27,0,3.4,5,'#cbc1a2');return g;},x,0,floorZ(p.y));}}
 }
 function renderSpaceSuperR1185(s,v){
  const sp=v.super;if(!sp)return;
  const t=Math.max(0,Math.min(1,sp.t/Math.max(.001,sp.duration))),x=v.x,y=270-v.y;
  const charge=Math.min(1,t/.42),blast=Math.max(0,Math.min(1,(t-.36)/.34)),fade=Math.max(0,1-Math.max(0,t-.62)/.38);
  for(let i=0;i<4;i++){
   const u=Math.max(0,Math.min(1,(t-i*.055)/.72));if(u<=0)continue;
   const rr=located('space-super-ring-'+i,()=>ring(new T.Group(),0,0,0,1,.035,material(i%2?'#fff0a8':'#9eefff',.15,.45,2.0)),x,y,4-i*1.5);
   rr.rotation.z=s.elapsed*(i%2?1.8:-1.4);rr.scale.setScalar(13+u*(38+i*18));
  }
  const core=orb('space-super-core',x,y,6,5+charge*12+blast*24,'#fff4c2');core.scale.z=.55+blast*1.8;
  const wave=located('space-super-wave',()=>ring(new T.Group(),0,0,0,1,.05,material('#d6fbff',.12,.38,2.4)),x+blast*155,y,0);wave.scale.setScalar(8+blast*105);wave.rotation.y=Math.PI/2;
  for(let i=0;i<10;i++){const a=i*Math.PI*2/10+s.elapsed*7,rad=14+charge*38+blast*28;const q=orb('space-super-spark-'+i,x+Math.cos(a)*rad,y+Math.sin(a)*rad*.65,8+(i%3)*3,1.5+blast*2.8,i%2?'#ffd76f':'#baf4ff');q.scale.z=2.2;}
  const light=object('space-super-light',()=>new T.PointLight('#dff8ff',0,520,2));light.position.set(x+blast*40,y,45);light.intensity=(2200+charge*5000+blast*13500)*fade;
 }
 function renderSpace(s){
  const v=s.space,r=located('space-ship',()=>ship('lira'),v.x,270-v.y,0);r.rotation.x=Math.sin(s.elapsed*2)*.06+(v.roll>0?s.elapsed*20:0);
  if(v.super){const t=Math.max(0,Math.min(1,v.super.t/Math.max(.001,v.super.duration)));r.rotation.z=Math.sin(t*Math.PI*10)*.08*(1-t);r.scale.setScalar(1+Math.sin(Math.min(1,t/.55)*Math.PI)*.10);}
  renderSpaceSuperR1185(s,v);
  for(const e of v.enemies){if(!e.alive)continue;const g=located('space-enemy-'+e.id,()=>e.kind==='asteroid'?mesh(new T.Group(),new T.DodecahedronGeometry(17,1),material('#676573',.93)):ship(e.kind),e.x,270-e.y,0,e.kind==='eye'?1.2:.85);g.rotation.x=s.elapsed*.7;if(e.kind==='asteroid')g.rotation.y=s.elapsed;}
  for(const [arr,prefix,color] of [[v.shots,'shot','#a4dae3'],[v.enemyShots,'foeshot','#eaaa76']])for(let i=0;i<arr.length;i++){const b=arr[i];if(!b.dead){const o=orb(prefix+i,b.x,270-b.y,0,b.r||3,color);if(b.kind==='laser')o.scale.set(18,1.5,1.5);}}
  for(let i=0;i<v.pickups.length;i++){const p=v.pickups[i];pickup('space-pick'+i,p,p.x,270-p.y,0,'item');}
  for(let i=0;i<v.stars.length;i++){const p=v.stars[i];pickup('space-star'+i,p,p.x,270-p.y,0,'star');}
  for(let i=0;i<v.lifeUps.length;i++){const p=v.lifeUps[i];if(Number.isFinite(p.x))pickup('space-life'+i,p,p.x,270-p.y,0,'life');}
  if(v.boss&&v.boss.hp>0){const b=v.boss;const o=located('space-boss',()=>{const g=new T.Group();sphere(g,0,0,0,40,36,19,material('#707c85',.45,.7));sphere(g,-5,0,20,18,21,6,material('#3a262c'));sphere(g,-10,0,25,9,13,4,material('#deac77',.4,.2,.6));for(let i=0;i<8;i++){const a=i*Math.PI/4;const spike=cone(g,Math.cos(a)*44,Math.sin(a)*40,0,6,30,material('#394750',.5,.6));spike.rotation.z=a-Math.PI/2;}return g;},b.x||395,270-(b.y||135),0);o.rotation.y=Math.sin(s.elapsed)*.15;}
 }
 function renderTower(s){const v=s.tower,sy=y=>34+y-v.camera;
  actor('tower-lira',{face:s.player.face,attack:null},v.x,sy(v.y),10,'lira',{air:!v.grounded,attack:v.sword>0?'swordSlashR950':null,scale:.7,walking:!v.grounded});
  v.platforms.forEach((p,i)=>{const y=sy(p.y);if(y< -50||y>360)return;solid('platform-'+i,p.x+p.w/2,y-5,0,p.w,10,35,'#64747d');solid('platform-edge-'+i,p.x+p.w/2,y+.1,18,p.w,1.5,1, '#b4b6a4');});
  for(const e of v.enemies)if(e.alive&&sy(e.y)>-60&&sy(e.y)<360)actor('tower-foe-'+e.id,{face:e.dir,walkPhase:s.elapsed*8},e.x,sy(e.y),9,'gang',{walking:true,scale:.55});
  for(const c of v.crates)if(!c.broken&&sy(c.y)>-40&&sy(c.y)<350)located('tower-crate-'+c.id,crate,c.x,sy(c.y),12,.75);
  for(const [arr,kind]of[[v.hearts,'heart'],[v.stars,'star'],[v.lifeUps,'life']])arr.forEach((p,i)=>{if(sy(p.y)>-30&&sy(p.y)<340)pickup('tower-'+kind+i,p,p.x,sy(p.y),13,kind);});
  v.hazards.forEach((p,i)=>{const o=located('tower-hazard-'+i,()=>mesh(new T.Group(),new T.DodecahedronGeometry(1),material('#817582',.82)),p.x,sy(p.y),15,p.r||6);o.rotation.set(s.elapsed,s.elapsed*.7,0);});
 }
 function renderTetris(s){const v=s.tetris,colors=['#72a6b7','#bb9464','#986b76','#a58ab5','#889c73','#587dad','#b76c70'];
  for(let y=0;y<v.grid.length;y++)for(let x=0;x<10;x++){const c=v.grid[y][x];if(c){solid('block-'+x+'-'+y,168+x*16,207-y*16,7,14.5,14.5,14,c.color);if(c.star)pickup('block-star-'+x+'-'+y,{},168+x*16,207-y*16,16,'star');}}
  for(let i=0;i<v.cells.length;i++){const c=v.cells[i];if(c.y<0)continue;solid('fall-block-'+i,168+c.x*16,207-c.y*16,7,14.5,14.5,14,colors[v.piece.kind%colors.length]);if(c.star)pickup('fall-star-'+i,{},168+c.x*16,207-c.y*16,16,'star');}
  actor('tetris-lira',{face:1},87,20,20,'lira',{scale:1.25});
 }
 function updateUI(s){
  const health=Math.round(s.player.hp/s.player.maxHp*100);el('liraHealth').firstElementChild.style.width=health+'%';el('liraHealth').setAttribute('aria-valuenow',String(health));el('liraSuper').firstElementChild.style.width=s.superMeter+'%';el('liraSuper').setAttribute('aria-valuenow',String(Math.round(s.superMeter)));
  el('liraLives').textContent='♥ '+s.lives;el('liraScore').textContent=String(s.score).padStart(6,'0');el('liraStars').textContent='★ '+s.stars;
  el('liraChapter').textContent='СОН '+String(s.level).padStart(2,'0')+' / 06';el('liraLevel').textContent=s.bar.active?'NO CHOICE BAR':s.bike.active?'RIDE THE DREAM':names[s.level];
  el('liraProgress').textContent=s.level===4?'Высота '+Math.max(0,Math.floor(s.tower.y))+' / 2280':s.level===5?'Этап '+s.tetris.stage+' / 5 · Линий '+s.tetris.lines:descriptions[s.level];
  let notice=s.message;if(s.cinematic?.t>0)notice=s.cinematic.title+' · '+(s.cinematic.subtitle||'');if(s.space.insert?.t>0&&s.level===3)notice=s.space.insert.title+' · '+s.space.insert.sub;
  el('liraMessage').textContent=notice;el('liraMessage').classList.toggle('visible',!!notice&&s.started&&!s.paused);
  const boss=s.level===3?s.space.boss:s.level===6?s.ruins.boss:s.enemies.find(e=>e.type==='boss'&&e.alive);
  el('liraBoss').hidden=!boss||boss.hp<=0||!s.started; if(boss){el('liraBoss').querySelector('i').style.width=Math.max(0,boss.hp/(boss.maxHp||780)*100)+'%';el('liraBoss').querySelector('span').textContent=s.level===2?'SACRED DESTROYER':s.level===6?'KEEPER OF EPOCHS':s.level===3?'THE VOID':'NIGHT ENFORCER';}
  const next=confirmNew?'confirm':s.levelSelect?'levels':!s.started?'title':s.gameOver?'over':s.victory?'win':s.paused?'pause':'none';
  if(next!==menuMode){menuMode=next;const shown=next!=='none';el('liraMenu').hidden=!shown;document.body.classList.toggle('menu-open',shown);el('liraLevelList').hidden=next!=='levels';el('liraNew').hidden=next==='confirm'||next==='levels'||(!s.started&&!s.saved);el('liraLevels').hidden=false;
   el('liraMenuTitle').innerHTML=next==='title'?'Dreaming of<em>Líra</em>':next==='pause'?'Сон<em>на паузе</em>':next==='levels'?'Шесть<em>миров</em>':next==='win'?'Сон<em>пройден</em>':next==='confirm'?'Новый<em>сон?</em>':'Попробуй<em>снова</em>';
   el('liraMenuText').innerHTML=next==='title'?'Шесть миров одного сна.<br>Пройди сквозь иллюзии. Найди пробуждение.':next==='pause'?'Прогресс сохранён. Продолжи, когда будешь готов.':next==='levels'?'Выбери открытый мир. Следующий откроется после победы.':next==='win'?(s.level<6?'Следующий мир уже открыт. Продолжай путь.':'Все шесть миров пройдены. Ты пробудился.') :next==='confirm'?'Текущее прохождение будет заменено. Начать с первого мира?':'Сон ещё не окончен. Продолжи с начала этого мира.';
   el('liraStart').innerHTML=(next==='title'?(s.saved?'Продолжить сон':'Войти в сон'):next==='levels'?'Назад':next==='confirm'?'Начать заново':next==='win'?(s.level<6?'Следующий мир':'Открыть миры'):next==='over'?'Попробовать снова':'Продолжить')+' <span>→</span>';
   el('liraLevels').textContent=next==='confirm'?'Отмена':next==='levels'?'Миры':'Выбрать мир';
   if(next==='levels'){el('liraLevelList').replaceChildren();for(let n=1;n<=6;n++){const b=document.createElement('button');b.className='lira3d-button';b.disabled=n>s.unlocked;b.innerHTML='<small>СОН 0'+n+(b.disabled?' · ЗАКРЫТ':'')+'</small>'+names[n];b.onclick=()=>{confirmNew=false;game.level(n);};el('liraLevelList').append(b);}}
   if(shown&&coarse)el('liraHelp').innerHTML='Крестовина — движение · A — удар · B — прыжок<br>A+B — меч · C — подсечка · ⚡ — суперудар<br>Прогресс сохраняется автоматически.';
  }
 }
 el('liraStart').onclick=()=>{if(menuMode==='confirm'){confirmNew=false;game.start(true);}else if(menuMode==='levels'){game.start();}else game.start();};
 el('liraNew').onclick=()=>{confirmNew=!confirmNew;menuMode='';};
 el('liraLevels').onclick=()=>{if(confirmNew){confirmNew=false;menuMode='';return;}if(!game.snapshot().started){game.start();game.pause();}game.levels();};
 el('liraPause').onclick=()=>game.pause();
 el('liraSound').onclick=()=>{sound=!sound;game.sound(sound);el('liraSound').textContent=sound?'♪':'×';el('liraSound').setAttribute('aria-pressed',String(sound));el('liraSound').setAttribute('aria-label',sound?'Выключить звук':'Включить звук');};
 el('liraFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.getElementById('gameShell').requestFullscreen();}catch{el('liraMessage').textContent='Полный экран недоступен в этом браузере';el('liraMessage').classList.add('visible');}};
 // UI keys must not also trigger movement or the legacy pause handler.
 root.addEventListener('keydown',e=>{if(e.target.closest('button,select,a'))e.stopPropagation();});
 window.addEventListener('keydown',e=>{if(!document.body.classList.contains('lira3d')||e.target?.closest?.('button,select,a'))return;if(['Escape','Enter','KeyP'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(confirmNew){confirmNew=false;menuMode='';}else{const s=game.snapshot();if(!s.started||s.paused||s.gameOver||s.victory)game.start();else game.pause();}}},true);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();game.pause();document.body.classList.remove('lira3d','menu-open');root.remove();game.attachRenderer(null);});
 document.body.classList.add('lira3d');
 function render(s){
  lastSnapshot=s;used.clear();const nextMode=s.bar.active?'bar':s.bike.active?'bike':({1:'city',2:'ocean',3:'space',4:'tower',5:'tetris',6:'ruins'})[s.level];setMode(nextMode);
  const now=performance.now(),dt=now-lastFrame;lastFrame=now;frameCount++;
  if(s.started&&!s.paused&&!document.hidden&&dt>40&&dt<200)slow++;else slow=Math.max(0,slow-.3);
  if(quality==='auto'&&!autoLow&&slow>90){autoLow=true;qualityApply();}
  const t=s.started?s.elapsed:now/1000;const planar=s.level>=3&&s.level<=5,cam=s.bike.active?0:s.bar.active?0:planar?0:s.cameraX;
  moveWorld(world,s.bike.active?s.bike.distance*.7:cam,t);
  if(s.bike.active){world.group.position.x=-s.bike.distance*.7;}else world.group.position.x=0;
  if(planar){camera.fov=36;camera.position.set(240,135,425);camera.lookAt(240,135,0);scene.fog.density=.0013;}
  else{camera.fov=36;camera.position.set(cam+240,210,460);camera.lookAt(cam+240,43,0);scene.fog.density=.0015;}
  if(camera.aspect<1&&!planar){camera.position.z=600;camera.position.y=300;camera.lookAt(cam+220,50,0);}
  camera.updateProjectionMatrix();
  if(s.shake>0&&!reduced&&s.started&&!s.paused){camera.position.x+=Math.sin(t*47)*Math.min(s.shake,6)*.2;camera.position.y+=Math.sin(t*53)*Math.min(s.shake,6)*.15;}
  sun.position.set(cam-90,370,200);sun.target.position.set(cam+220,0,0);spot.position.x=cam+45;
  if(s.bike.active)renderBike(s);else if(s.level===3)renderSpace(s);else if(s.level===4)renderTower(s);else if(s.level===5)renderTetris(s);else if(!s.started){actor('title-lira',{face:-.3},360,0,25,'lira',{scale:1.65});}else renderGround(s,cam);
  for(const [key,o]of pool)if(!used.has(key))o.visible=false;
  // Bound dynamic actors to the active view so defeated/spawned entities do not accumulate.
  if(frameCount%180===0)for(const [key,o]of pool)if(!used.has(key)){dynamic.remove(o);release(o);pool.delete(key);}
  if(now-lastUI>80||!frameCount){updateUI(s);lastUI=now;}
  const flashBoost=Math.max(0,Math.min(.55,(s.flash||0)*2.25));
  renderer.toneMappingExposure=1.22+flashBoost;
  rim.intensity=1.3+flashBoost*4.2;
  spot.intensity=2800+flashBoost*7000;
  renderer.render(scene,camera);
  canvas.dataset.scene=mode;canvas.dataset.quality=renderer.shadowMap.enabled?'high':'low';canvas.dataset.objects=String(renderer.info.render.calls);
 }
 game.attachRenderer(render);render(game.snapshot());
}
