import {UPGRADES} from './lyra-growth-r1449.js?v=r1468';
export function createGrowthUI(root,state,{signal,isPaused,onSave=()=>{}}){
 if(!state.growth)return ()=>{};state.growth.bindPause(isPaused);
 const card=root.querySelector('.pt-card')||root.querySelector('.card'),panel=document.createElement('details');panel.className='growth1449';panel.open=true;
 panel.innerHTML=`<style>
 [data-game1448] .growth1449{border:1px solid #73d9cf66;border-radius:15px;padding:12px;margin:12px 0;background:linear-gradient(135deg,#133238cc,#0c1929dd);touch-action:pan-y}
 [data-game1448] .growth1449 summary{font:700 16px/1.4 system-ui;cursor:pointer;color:#d8fff6;min-height:28px}
 [data-game1448] .growth1449 small{display:block;margin:3px 0 10px;color:#b8ced4;font:12px/1.4 system-ui}
 [data-game1448] .growth1449-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
 [data-game1448] .growth1449 article{display:flex;flex-direction:column;border:1px solid #a7c5cd33;border-radius:10px;padding:10px;background:#06121c80;min-width:0}
 [data-game1448] .growth1449 article strong{display:flex;justify-content:space-between;gap:6px;color:#e9f7fa;font:700 13px/1.4 system-ui}
 [data-game1448] .growth1449 article p{font:12px/1.4 system-ui!important;color:#bed1db!important;margin:7px 0!important;min-height:0;white-space:pre-line}
 [data-game1448] .growth1449 article button{display:block;width:100%;min-height:42px;margin-top:auto;padding:6px!important;border:1px solid #79e5cbaa!important;border-radius:8px!important;background:#1c6d5c!important;color:#ecfff7!important;font:700 12px/1.3 system-ui!important}
 [data-game1448] .growth1449 article button:disabled{opacity:.5;background:#243440!important;cursor:default}
 [data-game1448] .growth1449-status{margin-top:9px;color:#c6d9df;font:12px/1.4 system-ui;min-height:18px}
 </style><summary>Прокачка Лиры · <span data-growth-balance></span></summary><small>5 веток по 6 уровней. Общие кристаллы для всех семи миров.</small><div class="growth1449-grid">${UPGRADES.map(q=>`<article><strong>${q.name}<span data-growth-level="${q.id}"></span></strong><p data-growth-effect="${q.id}"></p><button type="button" data-upgrade="${q.id}"></button></article>`).join('')}</div><div class="growth1449-status" role="status"></div>`;
 const row=card.querySelector('.pt-row')||card.querySelector('#resume');if(row)card.insertBefore(panel,row.nextSibling||null);else card.append(panel);
 const balance=panel.querySelector('[data-growth-balance]'),status=panel.querySelector('.growth1449-status');
 const rows=UPGRADES.map(item=>({item,level:panel.querySelector(`[data-growth-level="${item.id}"]`),effect:panel.querySelector(`[data-growth-effect="${item.id}"]`),button:panel.querySelector(`[data-upgrade="${item.id}"]`)}));
 let signature='',message='';
 function refresh(){
  if(!isPaused())return;const info=state.growth.read(),key=JSON.stringify(info)+message;if(key===signature)return;signature=key;balance.textContent='◆ '+info.balance;
  for(const {item,level,effect,button}of rows){const n=info.levels[item.id],max=n>=item.costs.length;level.textContent=n+'/'+item.costs.length;effect.textContent='Сейчас: '+(n?item.effects[n-1]:item.base)+(max?'':'\nДалее: '+item.effects[n]);button.disabled=max||info.stale||!info.safe||info.balance<item.costs[n];button.textContent=max?'Изучено':info.balance<item.costs[n]?'Нужно '+item.costs[n]+' ◆':'Улучшить · '+item.costs[n]+' ◆';}
  status.textContent=message||(info.stale?'Начата новая игра в другой вкладке. Перезагрузи эту.':!info.safe?'Отойди от противников и остановись на безопасном месте.':info.error||'Выбери улучшение. Покупки сохраняются сразу.');
 }
 for(const row of rows)row.button.addEventListener('click',()=>{if(!isPaused())return;const result=state.growth.purchase(row.item.id);message=result.message;if(result.ok)onSave();refresh();},{signal});
 refresh();return refresh;
}
