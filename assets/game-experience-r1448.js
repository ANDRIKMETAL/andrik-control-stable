import {createWeaponUI} from './weapon-ui-r1458.js?v=r1460';
import {createGrowthUI} from './growth-ui-r1449.js?v=r1460';
import {createGameSound} from './game-sound-r1448.js?v=r1460';
const KEY='andrik-game-settings-r1448',LEARN='andrik-game-learned-r1448';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const DEFAULTS={quality:'auto',fps:60,buttonScale:1,stickScale:1,opacity:.38,horizontal:16,vertical:16,follow:false,aimAssist:true,guidance:'auto',tutorial:true,motion:.5,flashes:.65};
export function normalizeSettings(raw={}){
 const v={...DEFAULTS};for(const [key,min,max]of [['buttonScale',.8,1.15],['stickScale',.8,1.2],['opacity',.2,.8],['horizontal',8,64],['vertical',8,56],['motion',0,1],['flashes',0,1]])if(Number.isFinite(Number(raw[key])))v[key]=clamp(Number(raw[key]),min,max);
 for(const key of ['follow','tutorial','aimAssist'])if(typeof raw[key]==='boolean')v[key]=raw[key];
 if(['auto','low','high'].includes(raw.quality))v.quality=raw.quality;if(['auto','on','off'].includes(raw.guidance))v.guidance=raw.guidance;v.fps=Number(raw.fps)===30?30:60;return v;
}
export function graphicsBudget(settings,coarse,dpr=1){return {ratio:Math.min(dpr,settings.quality==='low'?.75:settings.quality==='high'?(coarse?1.25:1.6):(coarse?1:1.5)),shadows:settings.quality==='high'||settings.quality==='auto'&&!coarse};}
export function followYaw(yaw,facing,dt){const delta=Math.atan2(Math.sin(facing-yaw),Math.cos(facing-yaw));return yaw+delta*(1-Math.exp(-Math.min(.05,dt)*3.2));}
export function navigationTarget(s){
 const p=s.p,nearest=list=>list.slice().sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
 if(s.race?.mounted&&!s.race.finished)return null;
 if(s.isCity){const item=s.cityItems?.find(q=>!q.optional&&!s.cityFlags.includes(q.id));if(item)return {...item,label:item.label};}
 if(s.navigationObjective)return s.navigationObjective;
 if(s.world){const q=s.switches?.find(q=>!q.active);if(q)return {...q,label:s.world===5?'Плита '+(q.id+1):'Маяк '+(q.id+1)};if(s.exitOpen)return {...s.exit,label:'Выход'};}
 else if(s.zone===2&&!s.exitOpen){
  if(s.relayAngles){const i=s.puzzle.lit.findIndex(v=>!v),q=[{x:-6,z:10},{x:6,z:19},{x:-5,z:29}][i];if(q)return {...q,label:'Отражатель '+(i+1)};}
  else if(!s.isCity&&!s.solved)return {...nearest([{x:-6,z:10},{x:4,z:10},{x:4,z:20}]),label:'Зеркало'};
 }
 if(s.exitOpen)return {x:0,z:s.geo.length-2,label:'Выход'};
 if(!s.isCity&&!s.isRuins&&s.zone===0&&!s.living.length&&!s.seal)return {x:0,z:53,label:'Печать'};
 const foe=nearest(s.living);return foe?{x:foe.x,z:foe.z,label:foe.kind==='boss'?'Босс':'Противник'}:null;
}
const markup=`<style>
 [data-game1448] .game1448-settings{border:1px solid #8fa5b64d;border-radius:14px;margin:12px 0;padding:12px;color:#dce8f2;background:#07111c80}
 [data-game1448] .game1448-settings summary{cursor:pointer;font-weight:700;min-height:32px;display:flex;align-items:center}
 [data-game1448] .game1448-settings label{display:flex!important;align-items:center;justify-content:space-between;gap:12px;min-height:36px;font:13px/1.3 system-ui;margin:7px 0}
 [data-game1448] .game1448-settings input[type=range]{width:44%;min-width:90px;accent-color:#75ded6}
 [data-game1448] .game1448-settings select{max-width:48%;border:1px solid #a7c5d055;border-radius:8px;padding:6px;background:#142535;color:#fff;font:inherit}
 [data-game1448] .game1448-settings input[type=checkbox]{accent-color:#75ded6;width:20px;height:20px}
 [data-game1448] .pt-card,[data-game1448] .card{max-height:90dvh;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y}
 [data-game1448] .pt-actions,[data-game1448] .actions{right:max(var(--game-x),env(safe-area-inset-right))!important;bottom:max(var(--game-y),env(safe-area-inset-bottom))!important}
 [data-game1448] .pt-stick,[data-game1448] .stick{left:max(var(--game-x),env(safe-area-inset-left))!important;bottom:max(var(--game-y),env(safe-area-inset-bottom))!important;transform:scale(var(--game-stick));transform-origin:bottom left;background:rgba(13,28,42,var(--game-opacity))!important}
 [data-game1448] button[data-abc]{background:rgba(13,28,42,var(--game-opacity))!important}
 [data-game1448] button[data-abc][data-ready=finish]{border-color:#ffd686!important;box-shadow:0 0 16px #ffd68677,inset 0 0 15px #ffd68622!important;color:#ffdf9d!important}
 [data-game1448] button[data-abc][data-ready=interact]{border-color:#79e8df!important;box-shadow:0 0 14px #79e8df55,inset 0 0 15px #79e8df22!important}
 [data-game1448] .pt-damage{filter:opacity(var(--game-flash))}
 [data-game1448] .game1448-hint{position:absolute;z-index:6;pointer-events:none;left:50%;bottom:calc(var(--game-y) + 2 * clamp(64px,9vh,80px) * var(--game-scale) + 20px);transform:translateX(-50%);max-width:min(44%,400px);padding:7px 12px;border-radius:10px;background:#08131ddd;border:1px solid #8cb0c14d;color:#e2f5fa;text-align:center;font:12px/1.4 system-ui;text-shadow:0 1px 2px #000}
 [data-game1448] .game1448-nav{position:absolute;z-index:6;pointer-events:none;top:32%;left:50%;transform:translateX(-50%);padding:7px 11px;border-radius:14px;border:1px solid #76dbd580;background:#07141bd9;color:#bcf7ed;font:12px/1.4 system-ui;display:flex;align-items:center;gap:8px}
 [data-game1448] .game1448-nav b{display:inline-block;font-size:23px;line-height:1}
 [data-game1448] .game1448-hint[hidden],[data-game1448] .game1448-nav[hidden]{display:none!important}
 @media(max-height:450px){[data-game1448] .game1448-hint{bottom:calc(var(--game-y) + 2 * clamp(54px,15vh,66px) * var(--game-scale) + 20px)}}
 </style><summary>Управление, камера и графика</summary>
 <label>Качество<select data-setting=quality><option value=auto>Авто</option><option value=low>Экономное</option><option value=high>Высокое</option></select></label>
 <label>Частота кадров<select data-setting=fps><option value=60>60 кадров/с</option><option value=30>30 кадров/с</option></select></label>
 <label>Размер A/B/C<input data-setting=buttonScale type=range min=.8 max=1.15 step=.05></label>
 <label>Размер крестовины<input data-setting=stickScale type=range min=.8 max=1.2 step=.05></label>
 <label>Непрозрачность кнопок<input data-setting=opacity type=range min=.2 max=.8 step=.05></label>
 <label>Отступ от боков<input data-setting=horizontal type=range min=8 max=64 step=4></label>
 <label>Отступ снизу<input data-setting=vertical type=range min=8 max=56 step=4></label>
 
 <p>Крестовина перемещает Лиру без разворота. Камера поворачивается только при движении пальцем справа.</p>
 <label>Указатель цели<select data-setting=guidance><option value=auto>Если заблудился</option><option value=on>Всегда</option><option value=off>Выключен</option></select></label>
 <label>Обучающие подсказки<input data-setting=tutorial type=checkbox></label>
 <label>Встряска камеры<input data-setting=motion type=range min=0 max=1 step=.1></label>
 <label>Яркость вспышек<input data-setting=flashes type=range min=0 max=1 step=.1></label>
 <button type=button data-reset-settings>Сбросить настройки</button><button type=button data-replay-help>Повторить подсказки</button>`;
export function createExperience(root,state,{signal,isPaused,onSettings,getAudioContext=()=>null,getFxVolume=()=>0,onSave=()=>{}}={}){
 let raw={},learned={};try{raw=JSON.parse(localStorage.getItem(KEY))||{};if(!raw.quality)raw.quality=localStorage.getItem('lira-3d-quality')||'auto';learned=JSON.parse(localStorage.getItem(LEARN))||{};}catch{}
 if(matchMedia('(prefers-reduced-motion: reduce)').matches&&raw.motion===undefined)raw.motion=0;
 let settings=normalizeSettings(raw),lastFrame=-Infinity,zone=state.zone,elapsed=0,stalled=0,best=Infinity,targetKey='',shake=0,nextHint=0,lastContext='',hintUntil=0,hintText='';
 const sound=createGameSound(getAudioContext,getFxVolume);root.dataset.game1448='';const refreshGrowth=createGrowthUI(root,state,{signal,isPaused,onSave});const refreshWeapons=createWeaponUI(root,state,{signal,onSave});
 const panel=document.createElement('details');panel.className='game1448-settings';panel.innerHTML=markup;(root.querySelector('.pt-card')||root.querySelector('.card')).append(panel);
 const hint=document.createElement('div');hint.className='game1448-hint';hint.setAttribute('role','status');hint.hidden=true;root.append(hint);
 const nav=document.createElement('div');nav.className='game1448-nav';nav.hidden=true;const arrow=document.createElement('b'),label=document.createElement('span');arrow.textContent='↑';arrow.setAttribute('aria-hidden','true');nav.append(arrow,label);root.append(nav);
 const a=root.querySelector('[data-abc="A"]'),b=root.querySelector('[data-abc="B"]'),c=root.querySelector('[data-abc="C"]');
 const inputs=Array.from(panel.querySelectorAll('[data-setting]'));
 function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));localStorage.setItem('lira-3d-quality',settings.quality);}catch{}}
 function apply(){state.aimAssistEnabled=settings.aimAssist&&!state.facingLocked;settings.follow=false;
  for(const [k,v]of Object.entries({'--game-scale':settings.buttonScale,'--game-stick':settings.stickScale,'--game-opacity':settings.opacity,'--game-x':settings.horizontal+'px','--game-y':settings.vertical+'px','--game-flash':settings.flashes}))root.style.setProperty(k,String(v));
  for(const input of inputs){const v=settings[input.dataset.setting];if(input.type==='checkbox')input.checked=v;else input.value=String(v);}
  onSettings?.(settings);
 }
 for(const input of inputs)input.addEventListener('input',()=>{settings=normalizeSettings({...settings,[input.dataset.setting]:input.type==='checkbox'?input.checked:input.value});apply();save();},{signal});
 panel.querySelector('[data-reset-settings]').addEventListener('click',()=>{settings={...DEFAULTS};apply();save();},{signal});
 panel.querySelector('[data-replay-help]').addEventListener('click',()=>{learned={};elapsed=0;nextHint=0;try{localStorage.setItem(LEARN,'{}');}catch{}},{signal});
 function teach(key){if(learned[key])return;learned[key]=true;try{localStorage.setItem(LEARN,JSON.stringify(learned));}catch{}}
 apply();
 return {get settings(){return settings;},frameDue(now){if(now-lastFrame<1000/settings.fps-.5)return false;lastFrame=now;return true;},
  event(e){if(isPaused())return;sound.event(e,state);if(['hit','hurt','finishImpact'].includes(e.type))shake=.22;if(e.type==='puzzle')teach('interact');if(e.type==='finishImpact')teach('finish');if(e.type==='dodge'){teach('dodge');hintText='УКЛОНЕНИЕ';hintUntil=elapsed+.65;}if(e.type==='counterHit'){hintText='КОНТРАТАКА · +50%';hintUntil=elapsed+1.3;}if(e.type==='shieldBreak'||e.type==='armorBreak'){hintText=e.type==='shieldBreak'?'ЩИТ РАЗБИТ':'БРОНЯ РАЗБИТА';hintUntil=elapsed+1.3;}},
  cameraRoll(time){return shake>0?Math.sin(time*47)*.012*settings.motion*(shake/.22):0;},
  update(dt,yaw){
   refreshGrowth();refreshWeapons();const paused=isPaused();hint.hidden=nav.hidden=paused;if(paused)return;elapsed+=dt;shake=Math.max(0,shake-dt);
   if(zone!==state.zone){zone=state.zone;stalled=0;best=Infinity;targetKey='';elapsed=0;lastContext='';hintUntil=0;}
   const p=state.p,moving=Math.hypot(p.vx||0,p.vz||0)>.2;if(moving)teach('move');if(state.attack?.spin)teach('guitar');if(['slash','punch','kick','backfist'].includes(state.attack?.kind))teach('punch');if(!p.grounded&&state.jumps===0)teach('double');
   if(state.vehicleActive){const space=state.voyage.kind==='space';if(a)a.setAttribute('aria-label',space?'A: защитный щит':'A: прыжок на скутере');if(b)b.setAttribute('aria-label',space?'B: удерживать — стрельба':'B: удар по соседнему гонщику');if(c)c.setAttribute('aria-label',space?'C: ракета; после аварии — повтор':'C: ускорение; после аварии — повтор');hint.hidden=false;hint.textContent=space?'Крестовина: ← → ↑ ↓ · B: огонь · C: ракета · A: щит':'Между буйками · A: прыжок · B: удар · C: ускорение';nav.hidden=true;return;}if(a)a.setAttribute('aria-label','A: прыжок, повторно — двойной; A+B вместе: уклонение');const finish=state.finisherTarget,interact=state.canInteract;
   if(b){b.dataset.ready=finish?'finish':'';b.setAttribute('aria-label',finish?'B: добивание':state.weaponStats?.selected==='bat'?'B: бита двумя руками и удар ногой; удерживать для гитары':'B: меч и удар ногой; удерживать для гитары');}
   if(state.race?.mounted&&!state.race.finished){if(c)c.setAttribute('aria-label','C: ускорение на мотоцикле');if(b)b.setAttribute('aria-label','B: сбить соперника ногой');hint.hidden=false;hint.textContent='B — удар ногой · C — ускорение · A — прыжок';nav.hidden=true;return;}if(c){c.dataset.ready=interact?'interact':'';c.setAttribute('aria-label',interact?'C: взаимодействовать':'C: крик');}
   const context=finish?'finish':interact?'interact':'';
   if(context&&context!==lastContext){hintUntil=elapsed+2.8;hintText=context==='finish'?'B — добить лежащего противника':'C — взаимодействовать';}lastContext=context;
   if(elapsed>=hintUntil&&settings.tutorial&&elapsed>2&&elapsed>=nextHint){
    const lesson=!learned.move?['Крестовина слева — движение. Справа — поворот камеры.',5]:!learned.double?['A, затем ещё A в воздухе — двойной прыжок.',6]:!learned.punch?[state.weaponStats?.selected==='bat'?'Короткие B — удары битой двумя руками, затем ногой.':'Короткие B — две рубки мечом, затем удар ногой.',6]:!learned.dodge?['A+B вместе — уклонение. Крестовина задаёт направление; без неё — назад.',7]:!learned.guitar?['Удерживай B — круговой удар гитарой.',6]:null;
    if(lesson){hintText=lesson[0];hintUntil=elapsed+lesson[1];nextHint=elapsed+22;}
   }
   hint.hidden=!(settings.tutorial&&elapsed<hintUntil)||!!state.dead||!!state.finale||state.won;hint.textContent=hintText;
   const goal=navigationTarget(state),key=goal?(goal.id??goal.label)+':'+state.zone:'';
   if(key!==targetKey){targetKey=key;stalled=0;best=Infinity;}
   if(goal){const d=Math.hypot(goal.x-p.x,goal.z-p.z);if(d<best-.8){best=d;stalled=0;}else stalled+=dt;
    nav.hidden=settings.guidance==='off'||settings.guidance==='auto'&&stalled<18||!!state.dead||!!state.finale||state.won;
    const bearing=Math.atan2(goal.x-p.x,goal.z-p.z)-yaw;arrow.style.transform='rotate('+(-bearing*180/Math.PI)+'deg)';label.textContent=goal.label+' · '+Math.round(d)+' м';
   }else nav.hidden=true;
  }
 };
}
