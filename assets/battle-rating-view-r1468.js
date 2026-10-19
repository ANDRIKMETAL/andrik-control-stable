import {RANK_COLORS} from './battle-rating-r1468.js?v=r1471';
import {bossAction} from './boss-styles-r1468.js?v=r1471';
const css=`
@media(max-height:430px) and (orientation:landscape){
 [data-game1448] .battle1471-screen .battle1468-result{display:grid;grid-template-columns:minmax(135px,.9fr) 2fr;grid-template-areas:"head stats" "skip stats" "record stats" "actions actions";gap:6px 18px;padding:12px 16px}
 [data-game1448] .battle1471-screen .battle1468-result-head{grid-area:head;gap:12px;padding:0;margin:0;border:0}
 [data-game1448] .battle1471-screen .battle1468-result-head b{font-size:48px}
 [data-game1448] .battle1471-screen .battle1468-result-head strong{font-size:20px}
 [data-game1448] .battle1471-screen .battle1468-result-head small{font-size:9px;margin-bottom:4px}
 [data-game1448] .battle1471-screen .battle1471-tally{grid-area:skip;min-height:20px!important;margin:0!important;font-size:10px!important}
 [data-game1448] .battle1471-screen .battle1468-result dl{grid-area:stats;gap:9px 12px;font-size:12px;padding:4px 0}
 [data-game1448] .battle1471-screen .battle1468-record{grid-area:record;font-size:10px;margin:0}
 [data-game1448] .battle1471-screen .battle1471-actions{grid-area:actions;margin-top:4px;grid-template-columns:repeat(4,minmax(0,1fr))}
}

[data-game1448] .battle1471-screen{position:absolute;z-index:50;inset:0;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#050b18ed;touch-action:pan-y;box-sizing:border-box}
[data-game1448] .battle1471-screen[hidden]{display:none!important}
[data-game1448][data-results=true] .pt-panel,[data-game1448][data-results=true] .panel{display:none!important}
[data-game1448] .battle1471-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:18px}
[data-game1448] .battle1471-actions button,[data-game1448] .battle1471-actions a{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:44px;padding:10px;border:1px solid #d4b87a88;border-radius:10px;color:#f2dfb7;background:#d4b87a10;font:600 13px/1.3 system-ui;text-decoration:none;text-align:center;touch-action:manipulation;cursor:pointer}
[data-game1448] .battle1471-actions [data-battle-continue]{background:#d4b87a;color:#101b2b;font-weight:800}
[data-game1448] .battle1471-tally{display:block;margin:4px 0 0;padding:0;background:transparent!important;border:0!important;min-height:28px!important;color:#a6bacb!important;font:11px system-ui!important;text-align:left}
[data-game1448] .battle1468-result dd,[data-game1448] .battle1468-result strong{font-variant-numeric:tabular-nums}
@media(max-width:600px){[data-game1448] .battle1471-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-height:450px){[data-game1448] .battle1468-result{padding:14px 20px}[data-game1448] .battle1468-result-head{padding-bottom:8px;margin-bottom:10px}[data-game1448] .battle1468-result-head b{font-size:52px}[data-game1448] .battle1468-record{margin:10px 0 6px}[data-game1448] .battle1471-actions{margin-top:10px}}

[data-game1448] .battle1468-hud{--rank:#a9bfd2;position:absolute;z-index:8;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);box-sizing:border-box;width:min(222px,32vw);display:grid;grid-template-columns:48px 1fr;gap:9px;align-items:center;padding:10px 12px;border:1px solid color-mix(in srgb,var(--rank) 45%,transparent);border-radius:18px;background:linear-gradient(145deg,#0c1527ef,#060b17ed);box-shadow:0 6px 25px #0005;pointer-events:none;color:#edf5fb;font-family:system-ui}
[data-game1448] .battle1468-letter{font:italic 900 49px/.95 system-ui;letter-spacing:-4px;text-align:center;color:var(--rank);text-shadow:0 0 18px color-mix(in srgb,var(--rank) 25%,transparent);transition:color .2s}
[data-game1448] .battle1468-top{display:flex;justify-content:space-between;gap:8px;font-size:9px;letter-spacing:.10em;color:#bdcbdc;white-space:nowrap}
[data-game1448] .battle1468-track{height:5px;background:#b0c3e019;border-radius:5px;overflow:hidden;margin:7px 0 4px}
[data-game1448] .battle1468-track i{display:block;height:100%;background:linear-gradient(90deg,#ecf4fc,var(--rank));box-shadow:0 0 9px var(--rank);transform-origin:left;transition:transform .12s linear}
[data-game1448] .battle1468-steps{display:flex;justify-content:space-between;color:#637386;font:700 9px system-ui}
[data-game1448] .battle1468-steps [data-lit=true]{color:var(--rank)}
[data-game1448] .battle1468-label{grid-column:1/-1;min-height:12px;color:var(--rank);text-align:center;font:600 10px/1.2 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-game1448] .battle1468-hud[data-rank=S]{box-shadow:0 0 22px #f8d68b24,inset 0 0 18px #f8d68b0a}
[data-game1448] .battle1468-result{box-sizing:border-box;width:min(760px,100%);max-height:100%;overflow-y:auto;overscroll-behavior:contain;padding:clamp(16px,3vw,30px);margin:0;border:1px solid #c5a86d70;border-radius:20px;background:linear-gradient(130deg,#192336,#10121f);color:#edf5fb;font-family:system-ui}
[data-game1448] .battle1468-result-head{display:flex;align-items:center;gap:20px;border-bottom:1px solid #c5d6ec20;padding-bottom:14px;margin-bottom:14px}
[data-game1448] .battle1468-result-head b{font:italic 900 70px/1 system-ui;letter-spacing:-4px}
[data-game1448] .battle1468-result-head small{display:block;font:600 10px system-ui;letter-spacing:.15em;color:#b5c7d5;margin-bottom:7px}
[data-game1448] .battle1468-result-head strong{font:700 22px system-ui;color:#f5ddb3}
[data-game1448] .battle1468-result dl{display:grid;grid-template-columns:1fr auto 1fr auto;gap:10px 14px;margin:0;font-size:13px}
[data-game1448] .battle1468-result dt{color:#b8c6d7;margin:0}[data-game1448] .battle1468-result dd{color:#edf5fb;font-weight:700;margin:0}
[data-game1448] .battle1468-record{font:600 12px/1.5 system-ui;color:#f1cf88;margin:17px 0 12px}
[data-game1448] .battle1468-result button{padding:11px 16px;min-height:44px;border:1px solid #d4b87a88;border-radius:10px;color:#f2dfb7;background:#d4b87a10;font:600 14px system-ui;cursor:pointer}
[data-game1448] .battle1468-boss-cue{position:absolute;z-index:8;top:99px;left:50%;transform:translateX(-50%);width:min(300px,36vw);pointer-events:none;color:#f4cb8b;text-align:center;text-shadow:0 2px 6px #000;font:700 12px/1.3 system-ui}
[data-game1448] .battle1468-boss-cue small{display:block;font:500 10px/1.4 system-ui;color:#d3dbe7;margin-top:3px}
[data-game1448] .battle1468-boss-cue[data-phase=strike]{color:#ff94a4}[data-game1448] .battle1468-boss-cue[data-phase=open]{color:#82f2de}
[data-game1448] .battle1468-hud[hidden],[data-game1448] .battle1468-result[hidden],[data-game1448] .battle1468-boss-cue[hidden],[data-game1448][data-pause-menu=true] .battle1468-hud,[data-game1448][data-pause-menu=true] .battle1468-boss-cue{display:none!important}
[data-game1448][data-battle1468] [data-r1301=combo],[data-game1448][data-battle1468] .r1301-results{display:none!important}
@media(max-height:430px){[data-game1448] .battle1468-hud{padding:7px 10px;gap:6px;grid-template-columns:38px 1fr;bottom:max(8px,env(safe-area-inset-bottom));border-radius:14px;width:min(200px,32vw)}[data-game1448] .battle1468-letter{font-size:40px}[data-game1448] .battle1468-label{font-size:9px}[data-game1448] .battle1468-boss-cue{top:87px;font-size:11px}}
@media(max-width:600px) and (orientation:portrait){[data-game1448] .battle1468-hud{left:14px;top:145px;bottom:auto;transform:none;width:168px}[data-game1448] .battle1468-boss-cue{top:98px;width:44vw;left:52%}[data-game1448] .battle1468-result dl{grid-template-columns:1fr auto}}
@media(prefers-reduced-motion:reduce){[data-game1448] .battle1468-track i{transition:none}}
`;
export function createBattleRatingUI(root,state,{signal,isPaused=()=>false,onSave=()=>{},getMotion=()=>1}={}){
 if(!state.battle)return()=>{};
 root.dataset.battle1468='';const help=document.createElement('p');help.textContent='Рейтинг C → B → A → S: чередуй успешные удары, уклоняйся перед попаданием и добивай. Повторы дают меньше очков, полученный урон прерывает серию.';root.querySelector('.game1448-settings')?.append(help);const style=document.createElement('style');style.textContent=css;root.append(style);
 const hud=document.createElement('div');hud.className='battle1468-hud';hud.hidden=true;hud.setAttribute('aria-label','Рейтинг боя');hud.innerHTML='<b class="battle1468-letter">C</b><div><div class="battle1468-top"><span>СТИЛЬ БОЯ</span><span data-chain>×1</span></div><div class="battle1468-track" role="meter" aria-label="Сила серии" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="battle1468-steps"><span>C</span><span>B</span><span>A</span><span>S</span></div></div><div class="battle1468-label"></div>';root.append(hud);
 const letter=hud.querySelector('b'),fill=hud.querySelector('i'),track=hud.querySelector('[role=meter]'),chain=hud.querySelector('[data-chain]'),caption=hud.querySelector('.battle1468-label'),steps=[...hud.querySelector('.battle1468-steps').children];
 const cue=document.createElement('div');cue.className='battle1468-boss-cue';cue.hidden=true;const move=document.createElement('span'),hint=document.createElement('small');cue.append(move,hint);root.append(cue);
 const screen=document.createElement('div');screen.className='battle1471-screen';screen.hidden=true;screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');screen.setAttribute('aria-label','Итоги мира');root.append(screen);
 const result=document.createElement('section');result.className='battle1468-result';result.setAttribute('aria-label','Итоги мира');screen.append(result);
 let shown=null,lastRank='',lastSerial=-1,lastMeter=-1,tallyStart=0,tallyDone=false,fields=[],scoreNode,rankNode,recordNode,skipNode;
 const text=(node,value)=>{if(node.textContent!==String(value))node.textContent=String(value);};
 const clickExisting=ids=>{for(const id of ids){const button=root.querySelector(id);if(button){button.click();return;}}};
 result.addEventListener('click',event=>{
  if(event.target.closest('[data-battle-tally]')){tallyStart=-Infinity;tally();return;}
  if(event.target.closest('[data-battle-replay]')){state.battle.reset();shown=null;screen.hidden=true;root.dataset.results='false';clickExisting(['#pt-restart','#restart']);onSave();}
  else if(event.target.closest('[data-battle-continue]')){onSave();clickExisting(['#pt-resume','#resume']);}
  else if(event.target.closest('[data-battle-worlds]')){onSave();clickExisting(['#pt-exit','#exit']);}
  else if(event.target.closest('[data-battle-home]')){onSave();clickExisting(['[data-game-home]']);}
 },{signal});
 function showResult(r){
  result.replaceChildren();fields=[];tallyStart=performance.now();tallyDone=false;root.dataset.results='true';
  const head=document.createElement('div');head.className='battle1468-result-head';rankNode=document.createElement('b');const info=document.createElement('div'),eyebrow=document.createElement('small');scoreNode=document.createElement('strong');rankNode.textContent='—';rankNode.style.color=RANK_COLORS[r.grade];eyebrow.textContent='МИР ПРОЙДЕН · ИТОГИ БОЯ';scoreNode.textContent='0 очков';info.append(eyebrow,scoreNode);head.append(rankNode,info);result.append(head);
  skipNode=document.createElement('button');skipNode.type='button';skipNode.className='battle1471-tally';skipNode.dataset.battleTally='';skipNode.textContent='Подсчёт результатов… Нажми, чтобы показать итог.';result.append(skipNode);
  const dl=document.createElement('dl');
  for(const [label,value,format]of [['Время',r.seconds,n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0')],['Побеждено',r.kills],['Секреты',r.secrets],['Гибели',r.deaths],['Точные уклонения',r.dodges],['Добивания',r.finishers],['Лучшая серия',r.maxChain,n=>'×'+n],['Сложность',({easy:'Лёгкая',normal:'Нормальная',hard:'Сложная',mixed:'Менялась'})[r.difficulty]]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=typeof value==='number'?(format?format(0):'0'):String(value);if(typeof value==='number')fields.push({node:dd,value,format:format||String});dl.append(dt,dd);}result.append(dl);
  recordNode=document.createElement('p');recordNode.className='battle1468-record';recordNode.textContent='Подсчитываем очки за прохождение';result.append(recordNode);
  const actions=document.createElement('div');actions.className='battle1471-actions';
  for(const [key,label]of [['replay','Пройти ещё раз'],['continue','Продолжить'],['worlds','Выбрать мир'],['home','Выйти']]){const button=document.createElement('button');button.type='button';button.setAttribute('data-battle-'+key,'');button.textContent=label;actions.append(button);}result.append(actions);screen.hidden=false;
  (root.querySelector('#pt-resume')||root.querySelector('#resume'))?.blur?.();skipNode.focus?.({preventScroll:true});window.AndrikI18n?.refresh?.();
 }
 function tally(){
  if(!shown||tallyDone)return;const elapsed=Math.max(0,(performance.now()-tallyStart)/1000),ease=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3),p=ease(elapsed/2.8);
  text(scoreNode,Math.round(shown.score*p).toLocaleString('ru')+' очков');fields.forEach((f,i)=>text(f.node,f.format(Math.round(f.value*ease((elapsed-i*.12)/1.25)))));
  if(elapsed>=2.8){tallyDone=true;text(rankNode,shown.grade);text(skipNode,'Подсчёт завершён');skipNode.disabled=true;const r=shown;text(recordNode,r.saved?(r.newBest?'★ НОВЫЙ РЕКОРД · ':'Рекорд · ')+r.bestScore.toLocaleString('ru')+' очков':'Результат этой игры · браузер не сохранил рекорд');if(getMotion()>0)rankNode.animate?.([{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:250});}
 }
 return function update(){
  const b=state.battle,paused=isPaused();hud.hidden=paused||!b.visible||!!state.race?.mounted||!!state.finale||!!state.won;
  if(!hud.hidden){const rank=b.rank,meter=Math.round(b.meter);if(lastRank!==rank){lastRank=rank;hud.dataset.rank=rank;hud.style.setProperty('--rank',RANK_COLORS[rank]);text(letter,rank);for(const step of steps)step.dataset.lit=String('CBAS'.indexOf(step.textContent)<='CBAS'.indexOf(rank));}
   if(meter!==lastMeter){fill.style.transform='scaleX('+(meter/100)+')';track.setAttribute('aria-valuenow',String(meter));lastMeter=meter;}
   text(chain,'×'+Math.max(1,b.chain));if(lastSerial!==b.serial){lastSerial=b.serial;if(getMotion()>0)letter.animate?.([{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:180});}text(caption,b.label);
  }
  const boss=state.living.find(e=>e.kind==='boss'&&e.boss1468&&Math.hypot(e.x-state.p.x,e.z-state.p.z)<26),a=bossAction(state,boss);cue.hidden=paused||!boss||state.dead||state.won||!!state.finale;
  if(!cue.hidden){cue.dataset.phase=boss.mode;if(a){text(move,a.label);text(hint,a.hint||'');}else if(state.bossOpen>0){text(move,'ОТКРЫТ ДЛЯ КОНТРАТАКИ');text(hint,'Подойди и атакуй');}else{text(move,boss.name);text(hint,'Следи за подготовкой удара');}}
  const r=b.result;if(r&&shown!==r){shown=r;showResult(r);}if(!r){screen.hidden=true;root.dataset.results='false';shown=null;}else tally();
 };
}
