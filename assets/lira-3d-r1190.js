import * as T from './vendor/three-r170.module.min.js';
import {material,box,sphere,cylinder,cone,ring,mesh,character,animateCharacter,dog,motorcycle,ship,collectible,crate,barrel,release,bat,animateBat} from './lira-models-r1190.js?v=55.00-r1205';
import {buildWorld,moveWorld} from './lira-world-r1190.js';
const game=window.LiraGame,classic=new URLSearchParams(location.search).get('graphics')==='classic';
if(game&&!classic)boot().catch(error=>{console.error('Dreaming of Líra 3D unavailable:',error);document.body.classList.remove('lira3d','menu-open');document.getElementById('lira3dRoot')?.remove();game.attachRenderer(null);});
async function boot(){
 const root=document.createElement('div');root.id='lira3dRoot';
 root.innerHTML=`<canvas id="lira3dCanvas" aria-label="Трёхмерный мир Dreaming of Líra" tabindex="0"></canvas><div class="lira3d-vignette"></div><div id="liraSpaceFlash" aria-hidden="true" style="position:absolute;inset:0;z-index:6;pointer-events:none;opacity:0;background:radial-gradient(circle at 48% 50%,rgba(255,255,255,1) 0%,rgba(223,250,255,.98) 18%,rgba(115,221,255,.72) 45%,rgba(25,104,184,.22) 72%,rgba(0,0,0,0) 100%);mix-blend-mode:screen"></div><div class="lira3d-boot-splash" id="liraBootSplash3d" aria-hidden="true"><img src="/assets/dreaming-lira-r1194-splash.webp" alt="Dreaming of Líra"></div>
 <div class="lira3d-top"><div class="lira3d-status"><header>LÍRA <span id="liraLives">♥ 3</span></header><div class="lira3d-bar" role="meter" aria-label="Здоровье" aria-valuemin="0" aria-valuemax="100" id="liraHealth"><i></i></div><div class="lira3d-bar super" role="meter" aria-label="Суперудар" aria-valuemin="0" aria-valuemax="100" id="liraSuper"><i></i></div><div class="lira3d-meta"><span id="liraScore">000000</span><span id="liraStars">★ 0</span></div></div><div class="lira3d-level"><small id="liraChapter"></small><strong id="liraLevel"></strong><span id="liraProgress"></span></div><div class="lira3d-tools"><select class="lira3d-tool" id="liraQuality" aria-label="Качество графики"><option value="auto">Авто</option><option value="high">Высокое</option><option value="low">Экономное</option></select><button class="lira3d-tool" id="liraSound" aria-label="Выключить звук" title="Звук" aria-pressed="true">♪</button><button class="lira3d-tool" id="liraFullscreen" aria-label="Полный экран" title="Полный экран">⛶</button><button class="lira3d-tool" id="liraPause" aria-label="Пауза" title="Пауза">Ⅱ</button></div></div>
 <div class="lira3d-bottom"><span><b>WASD / ↑↓←→</b> движение &nbsp; <b>A</b> прыжок &nbsp; <b>B</b> меч / предмет &nbsp; <b>S</b> супер</span><span><b>20 ♦</b> новый уровень Лиры &nbsp; <b>Enter</b> пауза</span></div>
 <div class="lira3d-message" id="liraMessage" role="status"></div><div class="lira3d-boss" id="liraBoss" hidden><span></span><i></i></div>
 <section class="lira3d-menu" id="liraMenu" aria-label="Меню игры"><a class="lira3d-home" href="/">← ANDRIK METAL</a><div class="lira3d-menu-content"><div class="lira3d-brand">ANDRIK · THE SIX DREAMS</div><h1 id="liraMenuTitle">Dreaming of<em>Líra</em></h1><p id="liraMenuText">Шесть миров одного сна.<br>Пройди сквозь иллюзии. Найди пробуждение.</p><div id="liraLevelList" class="lira3d-level-list" hidden></div><div class="lira3d-menu-actions"><button class="lira3d-button primary" id="liraStart">Войти в сон <span>→</span></button><button class="lira3d-button" id="liraLevels">Миры</button><button class="lira3d-button" id="liraNew">Новая игра</button><a class="lira3d-button" href="?graphics=classic">Классика 2D</a></div><div class="lira3d-help" id="liraHelp"><kbd>WASD / стрелки</kbd> — движение · <kbd>A</kbd> — прыжок<br><kbd>B</kbd> — меч / предмет · <kbd>S</kbd> — суперудар · <kbd>20 ♦</kbd> — новый уровень<br>Прогресс сохраняется автоматически в этом браузере.</div></div><div class="lira3d-edition">3D EDITION · SIX WORLDS · R1205</div></section><div class="lira3d-rotate">Для удобной игры поверни телефон горизонтально.</div>`;
 document.getElementById('gameShell').append(root);
 const canvas=root.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.38;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.background=new T.Color('#101b29');scene.fog=new T.FogExp2('#172230',.0015);
 const camera=new T.PerspectiveCamera(41,16/9,1,5000);
 const hemi=new T.HemisphereLight('#c1d8ed','#6e6154',3.0);scene.add(hemi);
 const sun=new T.DirectionalLight('#d7e9ff',3.3);sun.position.set(-90,370,200);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-380;sun.shadow.camera.right=380;sun.shadow.camera.top=350;sun.shadow.camera.bottom=-250;sun.shadow.camera.far=1100;sun.shadow.bias=-.001;sun.shadow.normalBias=.6;scene.add(sun,sun.target);
 const rim=new T.DirectionalLight('#e1b878',1.5);rim.position.set(250,120,-180);scene.add(rim);
 const spot=new T.PointLight('#f8ca87',2800,180,2);spot.position.set(45,94,-35);scene.add(spot);
 const worldCache=new Map(),dynamic=new T.Group();scene.add(dynamic);let world,mode='',frameCount=0,quality='auto',lastFrame=performance.now(),slow=0,autoLow=false,sound=true,confirmNew=false,menuMode='',lastUI=0,lastSnapshot;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,coarse=matchMedia('(pointer: coarse)').matches;
 const pool=new Map(),used=new Set();
 const names={1:'CITY OF SLEEP',2:'OCEAN',3:'STAR RUNNER',4:'THE TOWER',5:'BLOCK LABYRINTH',6:'RUINS OF EPOCHS'};
 const descriptions={1:'Ночной город · A прыжок · B меч',2:'Океан · A прыжок · B меч',3:'Космос · A манёвр · B огонь',4:'Башня · A прыжок · B меч',5:'Лабиринт · A вращать · B сброс',6:'Руины эпох · A прыжок · B меч'};
 const el=id=>document.getElementById(id);
 // R1201: the classic canvas splash is bypassed by the 3D renderer, so show the approved
 // full-screen splash in the 3D layer itself. The timer starts only after landscape is active.
 const splash3d=el('liraBootSplash3d'),splashImg3d=splash3d?.querySelector('img');
 let splash3dStarted=false;
 function beginSplash3d(){
  if(!splash3d||splash3dStarted)return;
  if(coarse&&innerWidth<innerHeight)return;
  if(splashImg3d&&!splashImg3d.complete)return;
  splash3dStarted=true;splash3d.classList.add('active');
  setTimeout(()=>splash3d.classList.add('leaving'),2350);
  setTimeout(()=>splash3d.remove(),2850);
 }
 if(splashImg3d){if(splashImg3d.complete)requestAnimationFrame(beginSplash3d);else splashImg3d.addEventListener('load',beginSplash3d,{once:true});}
 addEventListener('resize',beginSplash3d,{passive:true});
 addEventListener('orientationchange',()=>setTimeout(beginSplash3d,120),{passive:true});
 const fit=()=>{const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 function qualityApply(){const low=quality==='low'||quality==='auto'&&(coarse||autoLow);renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:1.5));renderer.shadowMap.enabled=!low;fit();}
 try{quality=localStorage.getItem('lira-3d-quality')||'auto';if(!['auto','high','low'].includes(quality))quality='auto';}catch{}
 el('liraQuality').value=quality;el('liraQuality').onchange=e=>{quality=e.target.value;try{localStorage.setItem('lira-3d-quality',quality);}catch{}qualityApply();};qualityApply();new ResizeObserver(fit).observe(root);
 function object(key,create){used.add(key);let obj=pool.get(key);if(!obj){obj=create();pool.set(key,obj);dynamic.add(obj);}obj.visible=true;return obj;}
 function located(key,create,x,y,z=0,scale=1){const o=object(key,create);o.position.set(x,y,z);o.scale.setScalar(scale);return o;}
 function actor(key,p,x,y,z=0,kind='lira',opts={}){const o=located(key,()=>kind==='dog'?dog():character(kind),x,y,z,kind==='boss'?1.5:opts.scale||1);if(kind!=='dog')animateCharacter(o,p,lastSnapshot.elapsed,{...opts,reduced,guitarCue:kind==='lira'?lastSnapshot.guitarCue:null});else{o.rotation.y=(p.face||1)<0?Math.PI:0;o.position.y+=Math.abs(Math.sin(lastSnapshot.elapsed*15))*1.4;}return o;}
 function pickup(key,p,x,y,z,kind){if(p.taken||p.picked||p.dead)return;const o=located(key,()=>collectible(kind),x,y+Math.sin(lastSnapshot.elapsed*3+x)*2,z);o.rotation.y=lastSnapshot.elapsed*1.3;}
 function solid(key,x,y,z,w,h,d,color){const o=object(key,()=>box(new T.Group(),0,0,0,1,1,1,material(color,.55,.3)));o.position.set(x,y,z);o.scale.set(w,h,d);o.material=material(color,.55,.3);return o;}
 function orb(key,x,y,z,size,color){const o=object(key,()=>sphere(new T.Group(),0,0,0,1,1,1,material(color,.35,.35,.7)));o.position.set(x,y,z);o.scale.setScalar(size);return o;}
 function floorZ(y=205){return (y-205)*1.65;}
 function setMode(next){if(mode===next)return;mode=next;if(world)scene.remove(world.group);if(!worldCache.has(mode))worldCache.set(mode,buildWorld(mode));world=worldCache.get(mode);scene.add(world.group);scene.background.set(mode==='ruins'?'#292027':mode==='bar'?'#100d17':'#111e2d');scene.fog.color.copy(scene.background);hemi.intensity=mode==='bar'?2.2:3.0;rim.color.set(mode==='ruins'?'#d59466':mode==='ocean'?'#8ac4d8':'#ceab78');}
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
 function renderSwordFxR1187(s,p){
  const atk=p?.attack,kind=atk?.kind||'';
  if(!/sword/i.test(kind))return;
  const t=Math.max(0,Math.min(1,atk.t/Math.max(.001,atk.duration))),face=(p.face||1)>=0?1:-1;
  const phase=Math.max(0,Math.min(1,(t-.08)/.76));
  const glow=Math.sin(phase*Math.PI);
  if(glow<=.015)return;
  const cut=Math.max(0,Math.min(1,(t-.12)/.56));
  const x=p.x+face*(13+cut*17),y=(p.z||0)+43-Math.sin(cut*Math.PI)*4,z=floorZ(p.y)+7;
  const colors=['#effcff','#9be8ff','#f1c86c'];
  for(let i=0;i<3;i++){
   const arc=object('r1187-sword-arc-'+i,()=>{
    const g=new T.Group();
    const m=new T.Mesh(new T.TorusGeometry(1,.045+i*.010,6,34,Math.PI*.92),new T.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
    m.userData.ownedMaterial=true;g.add(m);return g;
   });
   arc.position.set(x+face*i*2,y+i*.7,z+i*.45);
   arc.rotation.set(0,0,face>0?-Math.PI*.47:Math.PI*.47);
   arc.scale.set(24+i*4,16+i*2.8,1);
   if(arc.children[0]?.material)arc.children[0].material.opacity=glow*(.58-i*.12);
  }
  const tipX=p.x+face*(22+cut*28),tipY=(p.z||0)+41-Math.sin(cut*Math.PI)*7;
  for(let i=0;i<5;i++){
   const a=(i-2)*.34+cut*2.4,rad=4+i*1.8;
   const sp=orb('r1187-sword-spark-'+i,tipX+Math.cos(a)*rad,tipY+Math.sin(a)*rad,z+2+i*.35,.7+glow*(1.1+(i%2)*.5),i%2?'#d9f7ff':'#ffd47a');
   sp.rotation.set(s.elapsed*7+i,s.elapsed*5,0);
  }
  const light=object('r1187-sword-light',()=>new T.PointLight('#bdeeff',0,145,2));
  light.position.set(tipX,tipY+5,z+12);light.intensity=glow*3600;
 }
 function renderGround(s,cam){
  const p=s.player;
  actor('lira',p,p.x,p.z||0,floorZ(p.y),'lira',{walking:s.bar.active?(Math.abs(p.x-(renderGround.lastX??p.x))>.01):undefined});renderGround.lastX=p.x;
  renderSwordFxR1187(s,p);
  renderSuperFxR1183(s,p);
  // R1204 story doors: street entrance to the bar and the right-side bar exit.
  if(s.level===1&&!s.bike.active){
   if(!s.bar.active){
    if((s.bar?.ready||s.bar?.entry?.active)&&near(1106,cam)){const door=solid('r1204-city-door',1106,42,floorZ(204),28,84,5,'#173448');const halo=object('r1204-city-door-light',()=>new T.PointLight('#67d8ff',0,180,2));halo.position.set(1106,43,floorZ(204)+8);halo.intensity=(s.bar?.entry?.active?6200:3300)+Math.sin(s.elapsed*8)*650;const rr=located('r1204-city-door-ring',()=>ring(new T.Group(),0,0,0,1,.035,material('#9cecff',.15,.4,1.7)),1106,42,floorZ(204)+7);rr.rotation.y=Math.PI/2;rr.scale.setScalar(18+Math.sin(s.elapsed*6)*3);}
    if(s.bar?.done&&near(1725,cam)){solid('r1204-city-return-door',1725,41,floorZ(211),27,82,5,'#172a36');}
   }else{
    const allGone=(s.bar.enemies||[]).every(e=>!e.alive),allLoot=(s.bar.items||[]).every(it=>it.taken);
    if(allGone&&allLoot){const door=solid('r1204-bar-exit-door',468,42,floorZ(205),30,84,5,'#25405b');const halo=object('r1204-bar-exit-light',()=>new T.PointLight('#82e7ff',0,180,2));halo.position.set(468,44,floorZ(205)+8);halo.intensity=5000+Math.sin(s.elapsed*9)*850;}
   }
  }
  const enemies=s.bar.active?s.bar.enemies:s.level===6?[...s.ruins.enemies,...(s.ruins.boss?[s.ruins.boss]:[])]:s.enemies;
  for(const e of enemies){if(e.x<cam-90||e.x>cam+620||e.alive===false&&(e.deathTimer||0)<=0)continue;
   const kind=e.type==='dog'||e.r955Dog?'dog':e.type==='boss'||e===s.ruins.boss?'boss':s.level===6?'roman':e.type==='police'||e.type==='riot'?e.type:'gang';
   const enemyAttack=(e.attack&&typeof e.attack==='object')?e.attack:(e.attackAnimR1185||null);
   const forcedFace=kind==='dog'?(p.x>=e.x?1:-1):(e.face||1);
   const enemyPose=enemyAttack?{...e,face:forcedFace,attack:enemyAttack}:{...e,face:forcedFace};
   actor('enemy-'+e.id,enemyPose,e.x,e.z||0,floorZ(e.y),kind,{walking:!enemyAttack,attack:enemyAttack?(e.r955Boss==='night-enforcer'?'clubSmashR1203':'punch'):undefined,retreat:(e.retreatT||0)>0});
   if(e.r955Boss==='night-enforcer'&&e.alive!==false){
    const club=object('r1203-boss-club-'+e.id,()=>{const g=new T.Group();cylinder(g,0,0,0,3.8,70,material('#4e301f',.74,.08));sphere(g,0,35,0,8,10,8,material('#252a2f',.43,.58));for(let i=0;i<6;i++)cone(g,(i%2?1:-1)*5,36+(i%3)*5,(i%3-1)*4,1.5,7,material('#8b9297',.28,.75));return g;});
    const face=forcedFace,atk=e.attack&&e.attack.kind==='clubSmashR1203'?Math.max(0,Math.min(1,e.attack.t/Math.max(.001,e.attack.duration))):0;
    const swing=e.attack?Math.sin(atk*Math.PI):0;club.position.set(e.x+face*(17+11*swing),62-15*swing,floorZ(e.y)+7);club.rotation.set(0,0,face*(-.55+1.45*swing));
   }
   if(e.alive!==false&&e.hp<e.maxHp){solid('hpbg-'+e.id,e.x,kind==='boss'?112:79,floorZ(e.y),29,2,1,'#272e36');solid('hp-'+e.id,e.x-14.5+(e.hp/e.maxHp)*14.5,kind==='boss'?112:79,floorZ(e.y)+.2,29*Math.max(0,e.hp/e.maxHp),2,1,'#b45660');}
  }
  if(!s.bar.active&&s.level<=2){
   for(const c of s.crates)if(!c.broken&&near(c.x,cam))located('crate-'+c.id,crate,c.x,0,floorZ(c.y));
   for(const h of s.hearts)if(near(h.x,cam))pickup('heart-'+h.id,h,h.x,13,floorZ(h.y),'heart');
   for(const st of s.groundStars)if(near(st.x,cam))pickup('star-'+st.id,st,st.x,22,floorZ(st.y),'star');
   for(const l of s.lifeUps)if(l.level===s.level&&near(l.x,cam))pickup('life-'+l.id,l,l.x,18,floorZ(l.y),'life');
  }
  if(s.bar.active){
   // R1205 bartender: alive background detail, wiping a bottle behind the counter.
   const tender=actor('bar-bartender-r1205',{face:1,vx:0,vy:0,walkPhase:0},238,0,-96,'gang',{walking:false,scale:.78,presentationYaw:.08});
   const td=tender.userData,sw=Math.sin(s.elapsed*5.1),cw=Math.cos(s.elapsed*5.1);
   if(td?.limbs?.length>=2){td.limbs[0].arm.rotation.set(-1.02,0,.32);td.limbs[0].fore.rotation.set(-.72,0,-.16);td.limbs[1].arm.rotation.set(-.92+.08*sw,0,-.30);td.limbs[1].fore.rotation.set(-.82+.18*cw,0,.18*sw);td.head.rotation.y=.08*sw;}
   const bottle=located('bar-bartender-bottle-r1205',()=>{const g=new T.Group();cylinder(g,0,7,0,2.4,13,material('#4f8c80',.28,.2,.2));cylinder(g,0,15,0,1.2,4,material('#9bc9bd',.24,.12,.18));return g;},246,41+sw*1.1,-82);bottle.rotation.z=.16*sw;
   const cloth=solid('bar-bartender-cloth-r1205',230+sw*4,37+cw*1.5,-80,7,1.5,6,'#d7d1c6');cloth.rotation.z=.25*sw;
   for(const it of s.bar.items)pickup('bar-item-'+it.id,it,it.x,13,floorZ(it.y),'item');for(let i=0;i<s.bar.shots.length;i++){const p=s.bar.shots[i];solid('barshot-'+i,p.x,22,floorZ(p.y+20),15,1.5,2,'#c4d9e1');}
  }
  if(s.level===2){for(const b of s.ocean.barrels)if(!b.exploded&&near(b.x,cam))located('barrel-'+b.id,barrel,b.x,0,floorZ(b.y));for(const a of s.ocean.pickups)if(near(a.x,cam))pickup('ocean-item-'+a.id,a,a.x,18,floorZ(a.y),'item');for(let i=0;i<s.ocean.chains.length;i++){const c=s.ocean.chains[i];if(c.dead||!near(c.x,cam))continue;orb('chain-'+i,c.x,25,floorZ(c.y),5,'#c19f7b');}}
  if(s.level===6){
   for(const o of s.ruins.obstacles)if(near(o.x,cam)){solid('ruin-'+o.id,o.x,o.h/2,floorZ(o.y),o.w,o.h,25,o.type==='fire'?'#be693d':'#74665e');if(o.type==='fire')for(let i=0;i<4;i++){const f=located('flame-'+o.id+i,()=>cone(new T.Group(),0,0,0,4,1,material('#db864c',.4,.1,1)),o.x-o.w/2+8+i*10,18,floorZ(o.y));f.scale.set(1,20+Math.sin(s.elapsed*8+i)*7,1);}}
   for(const c of s.ruins.crows)if(c.alive&&near(c.x,cam)){const bird=located('crow-'+c.id,()=>{const g=new T.Group();sphere(g,0,0,0,6,3,3,'#171e28');const a=box(g,-6,0,0,13,1,6,'#1e2630'),b=box(g,6,0,0,13,1,6,'#1e2630');g.userData.wings=[a,b];return g;},c.x,205-c.y,-10);bird.userData.wings.forEach((w,i)=>w.rotation.z=Math.sin(s.elapsed*14)*(i?1:-1)*.6);}
  }
  if(s.level===1&&s.r1203){
   for(const it of s.r1203.loot||[]){if(it.taken||!near(it.x,cam))continue;if(it.kind==='ruby')pickup('r1203-ruby-'+it.id,it,it.x,18,floorZ(it.y),'ruby');else if(it.kind==='bottle'){const q=located('r1203-bottle-'+it.id,()=>{const g=new T.Group();cylinder(g,0,7,0,2.5,13,material('#477d78',.32,.24,.18));cylinder(g,0,15,0,1.4,4,material('#86c1b7',.26,.16,.2));return g;},it.x,0,floorZ(it.y));q.rotation.z=.08;}else if(it.kind==='stick'){const q=located('r1203-stick-'+it.id,()=>{const g=new T.Group();cylinder(g,0,22,0,2.5,45,material('#6d452b',.72,.06));return g;},it.x,0,floorZ(it.y));q.rotation.z=.42;}}
   for(const b of s.r1203.barrels||[])if(!b.exploded&&near(b.x,cam))located('r1203-barrel-'+b.id,barrel,b.x,0,floorZ(b.y));
   for(const q of s.r1203.throws||[])if(!q.dead&&near(q.x,cam)){const o=located('r1203-throw-'+q.id,()=>{const g=new T.Group();cylinder(g,0,0,0,2.3,12,material('#4e8a82',.3,.2,.24));return g;},q.x,22,floorZ(q.y));o.rotation.z=s.elapsed*11;}
  }
  for(let i=0;i<s.projectiles.length;i++){const b=s.projectiles[i];if(!b.dead&&near(b.x,cam))orb('bullet-'+i,b.x,18,floorZ(b.y),3.2,'#e0b576');}
  if(s.gate&&near(s.gate,cam)&&!s.bar.active){const g=located('gate',()=>{const g=new T.Group();for(let z=-55;z<65;z+=15)cylinder(g,0,8,z,.6,16,material('#c5a269',.4,.2,.4));return g;},s.gate,0,0);}
  for(let i=0;i<s.effects.length;i++){const fx=s.effects[i];if(!near(fx.x,cam))continue;const t=Math.min(1,fx.t/fx.duration);const pulse=/pulse|wave|ring|riff|super|guitar/i.test(fx.kind);if(pulse){const r=located('effect-ring-'+i,()=>ring(new T.Group(),0,0,0,1,.018,material('#b6d4df',.3,.3,1)),fx.x,1.5,floorZ(fx.y));r.rotation.x=-Math.PI/2;r.scale.setScalar(15+t*90);}else{const r=located('effect-spark-'+i,()=>mesh(new T.Group(),new T.OctahedronGeometry(1),material('#eed9ad',.4,.2,1.4)),fx.x,16+(1-t)*10,floorZ(fx.y));r.scale.setScalar(3+5*(1-t));r.rotation.z=s.elapsed*4;}}
 }
 function near(x,c){return Number.isFinite(x)&&x>c-80&&x<c+650;}
 function renderBike(s){
  const b=s.bike,intro=b.intro||{active:false,t:0,duration:1};

  // R1188 opening beat: motorcycle is waiting ahead; Líra walks up and visibly mounts it.
  if(intro.active){
   const u=Math.max(0,Math.min(1,intro.t/Math.max(.001,intro.duration)));
   const parkedX=118,walkEnd=.56,mountEnd=.88;
   located('bike',()=>motorcycle(),parkedX,0,floorZ(210));
   if(u<walkEnd){
    const q=u/walkEnd,e=q*q*(3-2*q),x=48+(94-48)*e;
    actor('rider', {face:1,vx:88,vy:0,walkPhase:s.elapsed*10}, x,0,floorZ(210),'lira',{walking:true,scale:.68});
   }else{
    const q=Math.max(0,Math.min(1,(u-walkEnd)/(mountEnd-walkEnd))),e=q*q*(3-2*q);
    const x=94+(104-94)*e,y=8*e;
    actor('rider',{face:1},x,y,floorZ(210),'lira',{mount:e,ride:e>.94,scale:.68});
   }
   const lamp=object('bike-intro-light',()=>new T.PointLight('#f0c477',0,120,2));lamp.position.set(154,34,floorZ(210));lamp.intensity=500+Math.sin(s.elapsed*4)*120;
   return;
  }

  const bike=located('bike',()=>motorcycle(),118,b.z,floorZ(b.y));
  const wheelie=Math.min(.50,Math.max(0,b.z)/38);bike.rotation.z=wheelie;
  const bikeAtk=b.attack>0?{kind:'swordSlashR950',t:Math.max(0,.26-b.attack),duration:.26}:null;
  const rider=actor('rider',{...s.player,face:1,attack:bikeAtk},104,b.z+8,floorZ(b.y),'lira',{ride:true,attack:bikeAtk?'swordSlashR950':b.super>0?'guitarSmash':null,scale:.68});
  rider.rotation.z=wheelie*.72;
  // Three readable traffic lanes.
  for(const zY of [192,220]){const zz=floorZ(zY);for(let i=0;i<8;i++){const x=20+i*78-((b.distance*.31)%78);solid('r1204-lane-'+zY+'-'+i,x,.12,zz,36,.3,2,'#d7d7c7');}}
  // Guitar super: white/red flash and expanding shock rings; nearby riders visibly fall before disappearing.
  if(b.super>0){const u=Math.max(0,Math.min(1,1-b.super/.72));for(let i=0;i<3;i++){const rg=located('r1204-bike-super-ring-'+i,()=>ring(new T.Group(),0,0,0,1,.04,material(i%2?'#ffffff':'#ff6a6a',.12,.4,2.1)),118,34,floorZ(b.y));rg.rotation.x=-Math.PI/2;rg.scale.setScalar(18+u*(52+i*26));}const ll=object('r1204-bike-super-light',()=>new T.PointLight('#fff4e0',0,360,2));ll.position.set(118,48,floorZ(b.y)+5);ll.intensity=(1-u)*9000;}
  // Final unavoidable log and fall-off-bike beat.
  if(Number.isFinite(b.logD)){const lx=118+(b.logD-b.distance)*.35;if(near(lx,0)){const log=located('r1204-final-log',()=>{const g=new T.Group();cylinder(g,0,9,0,8,112,material('#5f3b24',.72,.08));return g;},lx,0,floorZ(206));log.rotation.x=Math.PI/2;log.rotation.z=.08;}}
  if(b.fall>0){const q=Math.max(0,Math.min(1,(b.fall-.01)/1.47));bike.rotation.z=.25+q*1.15;bike.position.y-=q*14;rider.rotation.z=.35+q*1.35;rider.position.x+=q*28;rider.position.y+=Math.sin(q*Math.PI)*18-q*20;}

  // One readable rider duel at a time. Enemy punch pose follows the AI attack timer.
  for(const r of b.rivals){
   const x=118+(r.d-b.distance)*.31;if((!r.alive&&!(r.superKO_R1204>0))||!near(x,0))continue;
   const laneY=([178,206,234][Math.max(0,Math.min(2,Number(r.lane)||0))]??206),ry=floorZ(laneY),rear=!!(r.engaged&&r.attackT>0),face=rear?-1:1;
   const rb=located('bike-rival-'+r.id,()=>motorcycle(r.kind==='police'),x,0,ry);
   const ko=Math.max(0,Number(r.superKO_R1204)||0),koP=ko?1-ko/.72:0;
   if(ko){rb.rotation.z=-Math.min(1,koP)*1.15;rb.position.y=-koP*12;}
   const atk=rear?{kind:'punch',t:.42-r.attackT,duration:.42}:null;
   const rr=actor('bike-rider-'+r.id,{face,attack:atk,invuln:0},x-14,8-koP*10,ry,r.kind==='police'?'police':'gang',{ride:true,scale:.68,retreat:!r.engaged&&x<150});
   if(ko)rr.rotation.z=-koP*1.25;
   if(rear&&!ko){const club=located('bike-rival-club-'+r.id,()=>{const g=new T.Group();box(g,0,0,0,34,2.6,2.6,r.kind==='police'?'#383b40':'#765033');return g;},x-34,32,ry+2);club.rotation.z=-.18;}
  }

  // Obstacles are intentionally bright and high-contrast so they can be read before reaching Líra.
  for(let i=0;i<b.pits.length;i++){
   const p=b.pits[i],x=118+(p.d-b.distance)*.35;if(!near(x,0))continue;const z=floorZ(([178,206,234][Math.max(0,Math.min(2,Number(p.lane)||0))]??206));
   if(p.type==='barrier'){
    solid('barrier-body-'+i,x,9,z,34,18,44,'#a74732');
    solid('barrier-stripe-a-'+i,x,12,z,35,4,45,'#efb75c');
    solid('barrier-stripe-b-'+i,x,5,z,35,3,45,'#e7d8a1');
    const l=object('barrier-light-'+i,()=>new T.PointLight('#ff9f55',0,76,2));l.position.set(x,22,z);l.intensity=700+Math.sin(s.elapsed*9+i)*180;
    orb('barrier-warn-a-'+i,x-14,21,z+13,2.5,'#ffd480');orb('barrier-warn-b-'+i,x+14,21,z-13,2.5,'#ffd480');
   }else solid('pit-'+i,x,.05,z,p.w*.58,.3,42,'#02050a');
  }
  for(let i=0;i<b.posts.length;i++){
   const p=b.posts[i],x=118+(p.d-b.distance)*.35;if(!near(x,0))continue;const z=floorZ(p.y);
   solid('post-base-'+i,x,17,z,9,34,10,'#39434d');
   solid('post-yellow-'+i,x,24,z,10,6,11,'#e8b657');
   solid('post-red-'+i,x,12,z,10,6,11,'#c84d49');
   const l=object('post-light-'+i,()=>new T.PointLight('#ffc45f',0,68,2));l.position.set(x,31,z);l.intensity=620+Math.sin(s.elapsed*7+i)*120;
  }
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
  if(v.super){
   const t=Math.max(0,Math.min(1,v.super.t/Math.max(.001,v.super.duration))),charge=Math.min(1,t/.40),burst=Math.max(0,Math.min(1,(t-.39)/.22)),settle=Math.max(0,Math.min(1,(t-.62)/.30));
   r.rotation.z=Math.sin(t*Math.PI*14)*.12*(1-t)+Math.sin(burst*Math.PI)*.16;
   r.rotation.y=-charge*.08+Math.sin(burst*Math.PI)*.18;
   r.position.x+=-charge*10+Math.sin(burst*Math.PI)*24*(1-settle);
   r.scale.setScalar(1+Math.sin(Math.min(1,t/.55)*Math.PI)*.16+Math.sin(burst*Math.PI)*.12);
  }
  renderSpaceSuperR1185(s,v);
  for(const e of v.enemies){if(!e.alive)continue;const g=located('space-enemy-'+e.id,()=>e.kind==='asteroid'?mesh(new T.Group(),new T.DodecahedronGeometry(17,1),material('#676573',.93)):ship(e.kind),e.x,270-e.y,0,e.kind==='eye'?1.2:.85);g.rotation.x=s.elapsed*.7;if(e.kind==='asteroid')g.rotation.y=s.elapsed;}
  for(const [arr,prefix,color] of [[v.shots,'shot','#a4dae3'],[v.enemyShots,'foeshot','#eaaa76']])for(let i=0;i<arr.length;i++){const b=arr[i];if(!b.dead){const o=orb(prefix+i,b.x,270-b.y,0,b.r||3,color);if(b.kind==='laser')o.scale.set(18,1.5,1.5);}}
  for(let i=0;i<v.pickups.length;i++){const p=v.pickups[i];pickup('space-pick'+i,p,p.x,270-p.y,0,'item');}
  for(let i=0;i<v.stars.length;i++){const p=v.stars[i];pickup('space-star'+i,p,p.x,270-p.y,0,'star');}
  for(let i=0;i<v.lifeUps.length;i++){const p=v.lifeUps[i];if(Number.isFinite(p.x))pickup('space-life'+i,p,p.x,270-p.y,0,'life');}
  if(v.boss&&v.boss.hp>0){const b=v.boss;const o=located('space-boss',()=>{const g=new T.Group();sphere(g,0,0,0,40,36,19,material('#707c85',.45,.7));sphere(g,-5,0,20,18,21,6,material('#3a262c'));sphere(g,-10,0,25,9,13,4,material('#deac77',.4,.2,.6));for(let i=0;i<8;i++){const a=i*Math.PI/4;const spike=cone(g,Math.cos(a)*44,Math.sin(a)*40,0,6,30,material('#394750',.5,.6));spike.rotation.z=a-Math.PI/2;}return g;},b.x||395,270-(b.y||135),0);o.rotation.y=Math.sin(s.elapsed)*.15;}
 }
 function renderTower(s){const v=s.tower,sy=y=>34+y-v.camera;
  const towerAttack=v.sword>0?{kind:'swordSlashR950',t:Math.max(0,.48-v.sword),duration:.48}:null;
  actor('tower-lira',{face:v.face,attack:towerAttack,invuln:v.invuln},v.x,sy(v.y),10,'lira',{air:!v.grounded,scale:.7,walking:v.grounded&&!!v.move,look:v.look});
  if(towerAttack)renderSwordFxR1187(s,{x:v.x,y:210,z:sy(v.y)-12,face:v.face,attack:towerAttack});
  for(const b of v.bats||[]){const y=sy(b.y);if(y<-65||y>385)continue;const o=located('tower-bat-'+b.id,bat,b.x,y,18,b.dead?Math.max(.1,b.deathT/.32):.75);animateBat(o,s.elapsed+b.id,b.dead);o.rotation.y=Math.max(-.65,Math.min(.65,b.vx/100));}
  v.platforms.forEach((p,i)=>{const y=sy(p.y);if(y< -50||y>360)return;solid('platform-'+i,p.x+p.w/2,y-5,0,p.w,10,35,'#64747d');solid('platform-edge-'+i,p.x+p.w/2,y+.1,18,p.w,1.5,1, '#b4b6a4');});
  for(const e of v.enemies)if(e.alive&&sy(e.y)>-60&&sy(e.y)<360)actor('tower-foe-'+e.id,{face:e.dir,walkPhase:s.elapsed*8},e.x,sy(e.y),9,'gang',{walking:true,scale:.55});
  for(const c of v.crates)if(!c.broken&&sy(c.y)>-40&&sy(c.y)<350)located('tower-crate-'+c.id,crate,c.x,sy(c.y),12,.75);
  for(const [arr,kind]of[[v.hearts,'heart'],[v.stars,'star'],[v.lifeUps,'life']])arr.forEach((p,i)=>{if(sy(p.y)>-30&&sy(p.y)<340)pickup('tower-'+kind+i,p,p.x,sy(p.y),13,kind);});
  v.hazards.forEach((p,i)=>{const o=located('tower-hazard-'+i,()=>mesh(new T.Group(),new T.DodecahedronGeometry(1),material('#817582',.82)),p.x,sy(p.y),15,p.r||6);o.rotation.set(s.elapsed,s.elapsed*.7,0);});
 }
 function renderTetris(s){const v=s.tetris,colors=['#70d6e8','#cc5368','#e1a94d','#8a79db','#62b78c','#d96a4c','#7ab2e6'];
  for(let y=0;y<v.grid.length;y++)for(let x=0;x<10;x++){const c=v.grid[y][x];if(c){solid('block-'+x+'-'+y,168+x*16,207-y*16,7,14.5,14.5,14,c.color);if(c.star)pickup('block-star-'+x+'-'+y,{},168+x*16,207-y*16,16,'star');}}
  for(let i=0;i<v.cells.length;i++){const c=v.cells[i];if(c.y<0)continue;solid('fall-block-'+i,168+c.x*16,207-c.y*16,7,14.5,14.5,14,colors[v.piece.kind%colors.length]);if(c.star)pickup('fall-star-'+i,{},168+c.x*16,207-c.y*16,16,'star');}
  actor('tetris-lira',{face:1},87,20,20,'lira',{scale:1.25,dance:true});
 }
 function updateUI(s){
  const superButton=document.querySelector('[data-action="super"]');if(superButton){superButton.classList.toggle('ready',s.superMeter>=s.superCost);superButton.setAttribute('aria-label',s.superMeter>=s.superCost?'Суперудар готов':'Суперудар: нужно '+s.superCost+' заряда');}
  const health=Math.round(s.player.hp/s.player.maxHp*100);el('liraHealth').firstElementChild.style.width=health+'%';el('liraHealth').setAttribute('aria-valuenow',String(health));el('liraSuper').firstElementChild.style.width=s.superMeter+'%';el('liraSuper').setAttribute('aria-valuenow',String(Math.round(s.superMeter)));
  el('liraLives').textContent='♥ '+s.lives;el('liraScore').textContent=String(s.score).padStart(6,'0');el('liraStars').textContent=s.level===1&&s.r1203?`♦ ${s.r1203.rubies%20}/20 · LV ${s.r1203.skill}${s.r1203.weapon?' · '+s.r1203.weapon.toUpperCase()+' '+s.r1203.charges:''}`:'★ '+s.stars;
  el('liraChapter').textContent='СОН '+String(s.level).padStart(2,'0')+' / 06';el('liraLevel').textContent=s.bar.active?'NO CHOICE BAR':s.bike.active?(s.bike.intro?.active?'TAKE THE BIKE':'RIDE THE DREAM'):names[s.level];
  el('liraProgress').textContent=s.bike.active?(s.bike.intro?.active?'Подойди к мотоциклу · садись':'Погоня · '+Math.min(100,Math.floor(s.bike.distance/9800*100))+'%'):s.level===4?'Высота '+Math.max(0,Math.floor(s.tower.y))+' / 2280':s.level===5?'Этап '+s.tetris.stage+' / 5 · Линий '+s.tetris.lines:descriptions[s.level];
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
   if(shown&&coarse)el('liraHelp').innerHTML='Крестовина — движение и поворот · A — прыжок · B — меч / предмет<br>S — суперудар · 20 ♦ — новый уровень Лиры<br>В SPACE/TETRIS A и B выполняют действия уровня.';
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
  if(planar){camera.fov=36;camera.position.set(240,135,425);camera.lookAt(240,135,0);scene.fog.density=.0008;}
  else{camera.fov=36;camera.position.set(cam+240,210,460);camera.lookAt(cam+240,43,0);scene.fog.density=.0010;}
  if(camera.aspect<1&&!planar){camera.position.z=600;camera.position.y=300;camera.lookAt(cam+220,50,0);}
  camera.updateProjectionMatrix();
  if(s.shake>0&&!reduced&&s.started&&!s.paused){camera.position.x+=Math.sin(t*47)*Math.min(s.shake,6)*.2;camera.position.y+=Math.sin(t*53)*Math.min(s.shake,6)*.15;}
  sun.position.set(cam-90,370,200);sun.target.position.set(cam+220,0,0);spot.position.x=cam+45;
  if(s.bike.active)renderBike(s);else if(s.level===3)renderSpace(s);else if(s.level===4)renderTower(s);else if(s.level===5)renderTetris(s);else if(!s.started){actor('title-lira',{face:-.3},360,0,25,'lira',{scale:1.65,presentationYaw:-.17});}else renderGround(s,cam);
  for(const [key,o]of pool)if(!used.has(key))o.visible=false;
  // Bound dynamic actors to the active view so defeated/spawned entities do not accumulate.
  if(frameCount%180===0)for(const [key,o]of pool)if(!used.has(key)){dynamic.remove(o);release(o);pool.delete(key);}
  if(now-lastUI>80||!frameCount){updateUI(s);lastUI=now;}
  const flashBoost=Math.max(0,Math.min(reduced?.15:.85,(s.flash||0)*2.8));
  renderer.toneMappingExposure=1.38+flashBoost;
  rim.intensity=1.3+flashBoost*5.4;
  spot.intensity=2800+flashBoost*10500;
  const sf=el('liraSpaceFlash');
  if(sf){let op=0;const sp=s.space?.super;if(sp){const u=Math.max(0,Math.min(1,sp.t/Math.max(.001,sp.duration)));op=Math.max(0,1-Math.abs(u-.41)/.115)*.96;if(u>.50)op=Math.max(op,Math.max(0,1-u)*.16);}sf.style.opacity=String(reduced?op*.18:op);}
  renderer.render(scene,camera);
  canvas.dataset.scene=mode;canvas.dataset.quality=renderer.shadowMap.enabled?'high':'low';canvas.dataset.objects=String(renderer.info.render.calls);
 }
 game.attachRenderer(render);render(game.snapshot());
}
