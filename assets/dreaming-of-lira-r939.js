(()=>{'use strict';
const canvas=document.getElementById('dolCanvas');if(!canvas)return;
const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
const W=960,H=540,WORLD=5200,GROUND=456;
const $=id=>document.getElementById(id);
const keys={left:false,right:false,jump:false};
let running=false,paused=false,finished=false,last=0,startAt=0,elapsed=0,sound=true,toastTimer=0,cameraX=0;
let lives=3,eyes=0,guitar=false,checkpoint=120,deathLock=0;
const player={x:120,y:GROUND-50,w:30,h:46,vx:0,vy:0,onGround:false,facing:1,walk:0};
const spawn={x:120,y:GROUND-50};
const platforms=[
  {x:0,y:GROUND,w:720,h:90},{x:790,y:GROUND,w:430,h:90},{x:1280,y:GROUND,w:560,h:90},{x:1910,y:GROUND,w:720,h:90},
  {x:2690,y:GROUND,w:500,h:90},{x:3260,y:GROUND,w:760,h:90},{x:4100,y:GROUND,w:1100,h:90},
  {x:420,y:382,w:150,h:20},{x:900,y:348,w:150,h:20},{x:1110,y:294,w:130,h:20},{x:1460,y:362,w:180,h:20},
  {x:1740,y:308,w:140,h:20},{x:2050,y:370,w:180,h:20},{x:2330,y:315,w:170,h:20},{x:2830,y:360,w:160,h:20},
  {x:3060,y:302,w:130,h:20},{x:3470,y:350,w:190,h:20},{x:3810,y:290,w:160,h:20},{x:4300,y:345,w:160,h:20},
  {x:4560,y:292,w:150,h:20}
];
const fragments=[
  {x:500,y:340,t:false},{x:965,y:306,t:false},{x:1500,y:320,t:false},{x:2110,y:326,t:false},
  {x:2895,y:318,t:false},{x:3855,y:248,t:false},{x:4355,y:303,t:false}
];
const enemies=[
  {x:920,y:GROUND-34,w:32,h:34,min:820,max:1180,v:55,dead:false},{x:1660,y:GROUND-34,w:32,h:34,min:1320,max:1810,v:-65,dead:false},
  {x:2440,y:GROUND-34,w:32,h:34,min:1950,max:2590,v:72,dead:false},{x:3030,y:GROUND-34,w:32,h:34,min:2720,max:3160,v:-58,dead:false},
  {x:3720,y:GROUND-34,w:32,h:34,min:3300,max:3990,v:74,dead:false},{x:4470,y:GROUND-34,w:32,h:34,min:4140,max:4800,v:-82,dead:false}
];
const guitarItem={x:3560,y:GROUND-54,w:28,h:44,t:false};
const portal={x:4930,y:GROUND-96,w:54,h:96};
const stars=Array.from({length:90},(_,i)=>({x:(i*137)%WORLD,y:30+(i*71)%240,s:1+(i%3)}));
const city=Array.from({length:48},(_,i)=>({x:i*125+30,w:45+(i*19)%66,h:55+(i*31)%150}));
let audioCtx=null;
function beep(freq=440,d=.07,type='square',gain=.025){if(!sound)return;try{audioCtx||=new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+d);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d)}catch(_){}}
function fmtTime(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60);return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function toast(msg){const el=$('dolToast');if(!el)return;el.textContent=msg;el.classList.add('is-on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('is-on'),1800)}
function questText(){if(eyes<5)return `Собери первые осколки · ${eyes}/5`;if(!guitar)return 'Найди гитару Лиры';if(eyes<7)return `Собери последние знаки · ${eyes}/7`;return 'Иди к порталу за иллюзией'}
function hud(){$('dolEyes').textContent=`${eyes} / 7`;$('dolQuest').textContent=questText();$('dolTime').textContent=fmtTime(elapsed);$('dolLives').textContent='♥ '.repeat(Math.max(0,lives)).trim()||'—'}
function resetLevel(){
  eyes=0;guitar=false;lives=3;checkpoint=120;spawn.x=120;spawn.y=GROUND-50;player.x=spawn.x;player.y=spawn.y;player.vx=player.vy=0;cameraX=0;
  fragments.forEach(x=>x.t=false);enemies.forEach((e,i)=>{e.dead=false;e.x=[920,1660,2440,3030,3720,4470][i]});guitarItem.t=false;finished=false;elapsed=0;deathLock=0;hud();
}
function startGame(){resetLevel();$('dolStart').classList.remove('is-visible');$('dolEnd').classList.remove('is-visible');running=true;paused=false;startAt=performance.now();last=performance.now();beep(220,.08);requestAnimationFrame(loop)}
function die(){if(deathLock>0||finished)return;deathLock=.9;lives--;beep(90,.22,'sawtooth',.04);if(lives<=0){lives=3;checkpoint=Math.max(120,checkpoint-350);toast('СОН СБРОШЕН · ПРОБУЙ ЕЩЁ')}else toast('ИЛЛЮЗИЯ ВЕРНУЛА ТЕБЯ НАЗАД');player.x=checkpoint;player.y=GROUND-70;player.vx=player.vy=0;cameraX=Math.max(0,checkpoint-300);hud()}
function rects(a,b){return a.x<a2(b)&&a.x+a.w>b.x&&a.y<a3(b)&&a.y+a.h>b.y}function a2(b){return b.x+b.w}function a3(b){return b.y+b.h}
function land(prevY){player.onGround=false;const prevBottom=prevY+player.h,nowBottom=player.y+player.h;for(const p of platforms){if(player.x+player.w<=p.x+4||player.x>=p.x+p.w-4)continue;if(prevBottom<=p.y+5&&nowBottom>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.onGround=true;return}}
}
function update(dt){
  if(paused||finished)return;elapsed=performance.now()-startAt;deathLock=Math.max(0,deathLock-dt);
  const accel=keys.left?-1:keys.right?1:0;player.vx=accel*270;if(accel)player.facing=accel;player.walk+=Math.abs(player.vx)*dt;
  if(keys.jump&&player.onGround){player.vy=-625;player.onGround=false;keys.jump=false;beep(270,.055)}
  const prevY=player.y;player.vy+=1750*dt;player.x+=player.vx*dt;player.y+=player.vy*dt;player.x=Math.max(0,Math.min(WORLD-player.w,player.x));land(prevY);
  if(player.y>H+120)die();
  if(player.x>1800&&checkpoint<1850){checkpoint=1940;toast('CHECKPOINT · ВИДЯЩИЙ ПРОСЫПАЕТСЯ')}
  if(player.x>3600&&guitar&&checkpoint<3650){checkpoint=3650;toast('CHECKPOINT · ГОЛОС НАЙДЕН')}
  for(const f of fragments){if(f.t)continue;const box={x:f.x-10,y:f.y-10,w:28,h:28};if(rects(player,box)){f.t=true;eyes++;beep(720,.08,'square',.03);toast(eyes===5?'5 ЗНАКОВ · ГИТАРА ТЕПЕРЬ ПРОЯВИТСЯ':`ОСКОЛОК СОЗНАНИЯ ${eyes}/7`);hud()}}
  if(!guitarItem.t&&eyes>=5&&rects(player,guitarItem)){guitarItem.t=true;guitar=true;beep(330,.08);setTimeout(()=>beep(495,.1),80);setTimeout(()=>beep(660,.13),170);toast('ГИТАРА ЛИРЫ · ТЫ ВСПОМНИЛА СВОЙ ГОЛОС');hud()}
  for(const e of enemies){if(e.dead)continue;e.x+=e.v*dt;if(e.x<e.min||e.x>e.max){e.v*=-1;e.x=Math.max(e.min,Math.min(e.max,e.x))}if(rects(player,e)){const prevBottom=prevY+player.h;if(player.vy>0&&prevBottom<e.y+12){e.dead=true;player.vy=-360;beep(130,.08,'square',.03)}else die()}}
  if(rects(player,portal)){if(guitar&&eyes>=7)finish();else if(deathLock<=0)toast(guitar?'ПОРТАЛ ЖДЁТ ВСЕ 7 ЗНАКОВ':'СНАЧАЛА НАЙДИ СВОЙ ГОЛОС')}
  cameraX+=(Math.max(0,Math.min(WORLD-W,player.x-W*.38))-cameraX)*Math.min(1,dt*5.5);hud();
}
function finish(){finished=true;running=false;const total=elapsed;let best=Number(localStorage.getItem('andrik-dol-best-r939')||0);if(!best||total<best){best=total;localStorage.setItem('andrik-dol-best-r939',String(Math.round(total)))}$('dolFinalStats').textContent=`Время ${fmtTime(total)} · Лучшее ${fmtTime(best)} · 7/7 знаков`;$('dolEndText').textContent='Лира проходит сквозь глаз. За ним — следующий мир ANDRIK.';$('dolEnd').classList.add('is-visible');beep(440,.12);setTimeout(()=>beep(660,.12),130);setTimeout(()=>beep(880,.22),270)}
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x-cameraX),Math.round(y),Math.round(w),Math.round(h))}
function bg(){
  ctx.fillStyle='#050812';ctx.fillRect(0,0,W,H);
  const t=elapsed/1000;ctx.fillStyle='#091526';ctx.fillRect(0,0,W,300);ctx.fillStyle='#0b1d2b';ctx.fillRect(0,300,W,240);
  for(const st of stars){const x=st.x-cameraX*.18;if(x<-5||x>W+5)continue;ctx.fillStyle=(Math.floor(t*2+st.x)%7===0)?'#d9f7ff':'#557b8e';ctx.fillRect(Math.round(x),st.y,st.s,st.s)}
  // giant observing eye
  const ex=760-cameraX*.06,ey=128;ctx.fillStyle='rgba(35,103,130,.18)';ctx.fillRect(ex-86,ey-34,172,68);ctx.fillStyle='#163848';ctx.fillRect(ex-64,ey-18,128,36);ctx.fillStyle='#75dfff';ctx.fillRect(ex-22,ey-14,44,28);ctx.fillStyle='#020305';ctx.fillRect(ex-7,ey-14,14,28);
  for(const b of city){const x=b.x-cameraX*.38;if(x>W||x+b.w<0)continue;ctx.fillStyle='#071019';ctx.fillRect(x,GROUND-b.h,b.w,b.h);ctx.fillStyle='#173243';for(let yy=GROUND-b.h+14;yy<GROUND-12;yy+=20)for(let xx=x+9;xx<x+b.w-6;xx+=18)if((Math.floor(xx+yy)%3)!==0)ctx.fillRect(xx,yy,4,5)}
  ctx.fillStyle='#101821';ctx.fillRect(0,GROUND,W,H-GROUND);
}
function drawPlatforms(){for(const p of platforms){const x=p.x-cameraX;if(x>W||x+p.w<0)continue;ctx.fillStyle='#152633';ctx.fillRect(Math.round(x),p.y,p.w,p.h);ctx.fillStyle='#3a6877';ctx.fillRect(Math.round(x),p.y,p.w,5);ctx.fillStyle='#0a1118';for(let xx=x+12;xx<x+p.w-8;xx+=28)ctx.fillRect(Math.round(xx),p.y+18,14,4)}}
function drawFragment(f){const x=f.x-cameraX,y=f.y;if(f.t||x<-30||x>W+30)return;const bob=Math.round(Math.sin(elapsed/210+f.x)*4);ctx.save();ctx.translate(Math.round(x),Math.round(y+bob));ctx.fillStyle='#d8b85e';ctx.fillRect(-12,-2,24,4);ctx.fillRect(-8,-6,16,12);ctx.fillStyle='#65dfff';ctx.fillRect(-5,-5,10,10);ctx.fillStyle='#020508';ctx.fillRect(-2,-5,4,10);ctx.restore()}
function drawGuitar(){if(guitarItem.t||eyes<5)return;const x=guitarItem.x-cameraX,y=guitarItem.y;if(x<-40||x>W+40)return;ctx.fillStyle='#dfc36f';ctx.fillRect(x+12,y-14,5,44);ctx.fillStyle='#f2d785';ctx.fillRect(x+5,y+18,20,18);ctx.fillStyle='#281b13';ctx.fillRect(x+9,y+21,12,12);ctx.fillStyle='#9bdfff';ctx.fillRect(x+13,y-12,3,30)}
function drawEnemy(e){if(e.dead)return;const x=e.x-cameraX;if(x<-50||x>W+50)return;ctx.fillStyle='#441b28';ctx.fillRect(x,e.y+8,e.w,e.h-8);ctx.fillStyle='#d95970';ctx.fillRect(x+5,e.y,e.w-10,10);ctx.fillStyle='#f3b6bf';ctx.fillRect(x+7,e.y+11,5,5);ctx.fillRect(x+20,e.y+11,5,5);ctx.fillStyle='#07080b';ctx.fillRect(x+8,e.y+12,3,3);ctx.fillRect(x+21,e.y+12,3,3)}
function drawPortal(){const x=portal.x-cameraX;if(x<-100||x>W+100)return;const unlocked=guitar&&eyes>=7;ctx.fillStyle=unlocked?'#4c9bb5':'#27313b';ctx.fillRect(x+6,portal.y,42,96);ctx.fillStyle='#071017';ctx.fillRect(x+12,portal.y+8,30,80);ctx.fillStyle=unlocked?'#e3c56f':'#5b6269';ctx.fillRect(x,portal.y+42,54,12);ctx.fillRect(x+21,portal.y+21,12,54);ctx.fillStyle=unlocked?'#72e4ff':'#182029';ctx.fillRect(x+19,portal.y+38,16,20);ctx.fillStyle='#020407';ctx.fillRect(x+25,portal.y+38,4,20)}
function drawPlayer(){const x=player.x-cameraX,y=player.y,step=Math.floor(player.walk/18)%2;ctx.save();if(player.facing<0){ctx.translate(Math.round(x+player.w),0);ctx.scale(-1,1)}else ctx.translate(Math.round(x),0);ctx.fillStyle='#0a0b0f';ctx.fillRect(8,y,18,18);ctx.fillRect(4,y+7,8,18);ctx.fillRect(24,y+5,6,20);ctx.fillStyle='#d9b9a2';ctx.fillRect(11,y+9,10,10);ctx.fillStyle='#a8eaff';ctx.fillRect(14,y+11,3,3);ctx.fillStyle='#171a22';ctx.fillRect(7,y+20,18,18);ctx.fillStyle='#2c313c';ctx.fillRect(5,y+24,5,15);ctx.fillRect(24,y+24,5,15);ctx.fillStyle='#d2b65f';ctx.fillRect(14,y+25,5,5);ctx.fillStyle='#08090d';if(step&&player.onGround){ctx.fillRect(8,y+38,7,8);ctx.fillRect(20,y+40,7,6)}else{ctx.fillRect(9,y+38,7,8);ctx.fillRect(20,y+38,7,8)}if(guitar){ctx.fillStyle='#d8bd68';ctx.fillRect(24,y+17,3,26);ctx.fillRect(20,y+34,11,8)}ctx.restore()}
function draw(){bg();drawPlatforms();fragments.forEach(drawFragment);drawGuitar();enemies.forEach(drawEnemy);drawPortal();drawPlayer();ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(0,0,W,2)}
function loop(now){if(!running)return;const dt=Math.min(.033,Math.max(.001,(now-last)/1000));last=now;update(dt);draw();if(running)requestAnimationFrame(loop)}
function setKey(name,on){keys[name]=on;const map={left:'dolLeft',right:'dolRight',jump:'dolJump'};$(map[name])?.classList.toggle('is-down',on)}
function bindHold(id,name){const el=$(id);if(!el)return;const on=e=>{e.preventDefault();setKey(name,true)};const off=e=>{e.preventDefault();setKey(name,false)};['pointerdown','touchstart'].forEach(ev=>el.addEventListener(ev,on,{passive:false}));['pointerup','pointercancel','pointerleave','touchend','touchcancel'].forEach(ev=>el.addEventListener(ev,off,{passive:false}))}
bindHold('dolLeft','left');bindHold('dolRight','right');bindHold('dolJump','jump');
window.addEventListener('keydown',e=>{if(['ArrowLeft','KeyA'].includes(e.code)){keys.left=true;e.preventDefault()}if(['ArrowRight','KeyD'].includes(e.code)){keys.right=true;e.preventDefault()}if(['Space','ArrowUp','KeyW'].includes(e.code)){keys.jump=true;e.preventDefault()}if(e.code==='Escape')togglePause()});
window.addEventListener('keyup',e=>{if(['ArrowLeft','KeyA'].includes(e.code))keys.left=false;if(['ArrowRight','KeyD'].includes(e.code))keys.right=false;if(['Space','ArrowUp','KeyW'].includes(e.code))keys.jump=false});
function togglePause(){if(!running||finished)return;paused=!paused;$('dolPause').textContent=paused?'▶':'II';toast(paused?'ПАУЗА':'СОН ПРОДОЛЖАЕТСЯ');if(!paused){last=performance.now()}}
$('dolStartBtn')?.addEventListener('click',startGame);$('dolStart')?.addEventListener('dblclick',e=>{if(e.target?.id==='dolStart')startGame()});$('dolRestart')?.addEventListener('click',startGame);$('dolPause')?.addEventListener('click',togglePause);$('dolSound')?.addEventListener('click',()=>{sound=!sound;$('dolSound').classList.toggle('dol-sound-off',!sound);$('dolSound').textContent=sound?'♪':'×♪';if(sound)beep(440,.06)});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)togglePause()});
resetLevel();draw();
})();
