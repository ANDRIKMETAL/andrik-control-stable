import {RANK_COLORS} from './battle-rating-r1468.js?v=r1468';
import {bossAction} from './boss-styles-r1468.js?v=r1468';
const css=`
[data-game1448] .battle1468-hud{--rank:#a9bfd2;position:absolute;z-index:8;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);box-sizing:border-box;width:min(222px,32vw);display:grid;grid-template-columns:48px 1fr;gap:9px;align-items:center;padding:10px 12px;border:1px solid color-mix(in srgb,var(--rank) 45%,transparent);border-radius:18px;background:linear-gradient(145deg,#0c1527ef,#060b17ed);box-shadow:0 6px 25px #0005;pointer-events:none;color:#edf5fb;font-family:system-ui}
[data-game1448] .battle1468-letter{font:italic 900 49px/.95 system-ui;letter-spacing:-4px;text-align:center;color:var(--rank);text-shadow:0 0 18px color-mix(in srgb,var(--rank) 25%,transparent);transition:color .2s}
[data-game1448] .battle1468-top{display:flex;justify-content:space-between;gap:8px;font-size:9px;letter-spacing:.10em;color:#bdcbdc;white-space:nowrap}
[data-game1448] .battle1468-track{height:5px;background:#b0c3e019;border-radius:5px;overflow:hidden;margin:7px 0 4px}
[data-game1448] .battle1468-track i{display:block;height:100%;background:linear-gradient(90deg,#ecf4fc,var(--rank));box-shadow:0 0 9px var(--rank);transform-origin:left;transition:transform .12s linear}
[data-game1448] .battle1468-steps{display:flex;justify-content:space-between;color:#637386;font:700 9px system-ui}
[data-game1448] .battle1468-steps [data-lit=true]{color:var(--rank)}
[data-game1448] .battle1468-label{grid-column:1/-1;min-height:12px;color:var(--rank);text-align:center;font:600 10px/1.2 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-game1448] .battle1468-hud[data-rank=S]{box-shadow:0 0 22px #f8d68b24,inset 0 0 18px #f8d68b0a}
[data-game1448] .battle1468-result{padding:20px;margin:18px 0;border:1px solid #c5a86d70;border-radius:20px;background:linear-gradient(130deg,#192336,#10121f);color:#edf5fb;font-family:system-ui}
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
 const card=root.querySelector('.pt-card')||root.querySelector('.card'),actions=card?.querySelector('.pt-row'),result=document.createElement('section');result.className='battle1468-result';result.hidden=true;result.setAttribute('aria-label','Итоги мира');if(actions)actions.after(result);else card?.append(result);
 let shown=null,lastRank='',lastSerial=-1,lastMeter=-1;
 const text=(node,value)=>{if(node.textContent!==String(value))node.textContent=String(value);};
 result.addEventListener('click',event=>{if(!event.target.closest('[data-battle-replay]'))return;const restart=root.querySelector('#pt-restart')||root.querySelector('#restart');if(restart){state.battle.reset();shown=null;result.hidden=true;restart.click();onSave();}},{signal});
 function showResult(r){
  result.replaceChildren();const head=document.createElement('div');head.className='battle1468-result-head';const rank=document.createElement('b'),info=document.createElement('div'),eyebrow=document.createElement('small'),score=document.createElement('strong');rank.textContent=r.grade;rank.style.color=RANK_COLORS[r.grade];eyebrow.textContent='МИР ПРОЙДЕН · ЛУЧШИЙ РАНГ';score.textContent=r.score.toLocaleString('ru')+' очков';info.append(eyebrow,score);head.append(rank,info);result.append(head);
  const dl=document.createElement('dl'),time=Math.floor(r.seconds/60)+':'+String(r.seconds%60).padStart(2,'0');
  for(const [label,value]of [['Время',time],['Побеждено',r.kills],['Секреты',r.secrets],['Гибели',r.deaths],['Точные уклонения',r.dodges],['Добивания',r.finishers],['Лучшая серия','×'+r.maxChain],['Сложность',({easy:'Лёгкая',normal:'Нормальная',hard:'Сложная',mixed:'Менялась'})[r.difficulty]]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);dl.append(dt,dd);}result.append(dl);
  const record=document.createElement('p');record.className='battle1468-record';record.textContent=r.saved?(r.newBest?'★ НОВЫЙ РЕКОРД · ':'Рекорд · ')+r.bestScore.toLocaleString('ru')+' очков':'Результат этой игры · браузер не сохранил рекорд';result.append(record);
  const replay=document.createElement('button');replay.type='button';replay.dataset.battleReplay='';replay.textContent='Пройти ещё раз';result.append(replay);result.hidden=false;window.AndrikI18n?.refresh?.();
 }
 return function update(){
  const b=state.battle,paused=isPaused();hud.hidden=paused||!b.visible;
  if(!hud.hidden){const rank=b.rank,meter=Math.round(b.meter);if(lastRank!==rank){lastRank=rank;hud.dataset.rank=rank;hud.style.setProperty('--rank',RANK_COLORS[rank]);text(letter,rank);for(const step of steps)step.dataset.lit=String('CBAS'.indexOf(step.textContent)<='CBAS'.indexOf(rank));}
   if(meter!==lastMeter){fill.style.transform='scaleX('+(meter/100)+')';track.setAttribute('aria-valuenow',String(meter));lastMeter=meter;}
   text(chain,'×'+Math.max(1,b.chain));if(lastSerial!==b.serial){lastSerial=b.serial;if(getMotion()>0)letter.animate?.([{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:180});}text(caption,b.label);
  }
  const boss=state.living.find(e=>e.kind==='boss'&&e.boss1468&&Math.hypot(e.x-state.p.x,e.z-state.p.z)<26),a=bossAction(state,boss);cue.hidden=paused||!boss||state.dead||state.won||!!state.finale;
  if(!cue.hidden){cue.dataset.phase=boss.mode;if(a){text(move,a.label);text(hint,a.hint||'');}else if(state.bossOpen>0){text(move,'ОТКРЫТ ДЛЯ КОНТРАТАКИ');text(hint,'Подойди и атакуй');}else{text(move,boss.name);text(hint,'Следи за подготовкой удара');}}
  const r=b.result;if(r&&shown!==r){shown=r;showResult(r);}if(!r){result.hidden=true;shown=null;}
 };
}
