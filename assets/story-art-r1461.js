const path='/assets/lyra-story-r1461/';
export const STORY_ART={
 intro:{file:'00-prologue.webp',title:'Пролог · Комната перед рассветом',text:'Лира просыпается в своей комнате от собственной мелодии. За окном снег и свет NO CHOICE BAR. Она берёт гитару и выходит на улицу.'},
 city:{file:'01-city-portrait.webp',title:'Город → Портрет · Зеркало помнит',text:'«Ты вернулась». — «Я здесь раньше не была». — «Ты каждый раз так говоришь». В зеркале мотоцикла открывается галерея.'},
 portrait:{file:'02-portrait-ruins.webp',title:'Портрет → Руины эпох · Украденное начало',text:'В расколотом портрете Лира узнаёт свою комнату. Песок открывает лестницу к древнему механизму. Время сохранило то, что стёрли лица.'},
 ruins:{file:'03-ruins-ocean.webp',title:'Руины эпох → Океан · Затопленная память',text:'«Память повреждена. Продолжение перенесено в Океан». Лира выходит к причалам и маяку. На глубине ещё горит свет.'},
 ocean:{file:'04-ocean-space.webp',title:'Океан → Космос · Кто-нибудь слышит?',text:'«Если кто-нибудь слышит… нас стирают». — «Я слышу». Луч маяка открывает путь к орбитальной станции. Сигнал услышан.'},
 space:{file:'05-space-tower.webp',title:'Космос → Башня · Её собственный приказ',text:'Из терминала звучит голос Лиры: «Пусть эта ночь никогда не заканчивается». — «Это сказала я?» Ночь удерживает её собственный голос.'},
 tower:{file:'06-tower-blocks.webp',title:'Башня → Блоки · Цена неизменности',text:'«Я сохранил всё. Больше ничего не изменится». — «Ты оставил только повторение». Живое нельзя повторить точно.'},
 ending:{file:'07-epilogue.webp',title:'Финал · Я здесь',text:'Утро впервые наступило. Лира снова дома, часы идут, за окном живой город. «Песня может закончиться. Я здесь».'}
};
export const transitionArt=id=>({1:'city',portrait:'portrait',6:'ruins',2:'ocean',3:'space',4:'tower',5:'ending'})[id];
export const STORY_KEY='andrik-lyra-story-r1461';
export function createStoryArt(host,{onVisibility=()=>{}}={}){
 const layer=document.createElement('section');layer.className='lyra-story1461';layer.hidden=true;layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','История Лиры');
 layer.innerHTML=`<style>
 .lyra-story1461{position:absolute;inset:0;z-index:1000;background:#030509;color:#f3ece0;display:flex;flex-direction:column;overflow:hidden;font:14px/1.4 system-ui;touch-action:pan-y}
 .lyra-story1461[hidden]{display:none!important}.lira-story-open #lira3dRoot{visibility:hidden}.lyra-story1461 *{box-sizing:border-box}
 .lyra-story1461 .story-view{flex:1;min-height:0;overflow:auto;display:grid;place-items:center;touch-action:pan-x pan-y pinch-zoom}
 .lyra-story1461 img{display:block;width:100%;height:100%;min-height:0;object-fit:contain}
 .lyra-story1461[data-zoom=true] .story-view{display:block}.lyra-story1461[data-zoom=true] img{width:max(100%,1280px);height:auto;max-width:none;object-fit:contain}
 .lyra-story1461 .story-bar{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:8px max(12px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom));border-top:1px solid #d9b87a40;background:#091019}
 .lyra-story1461 .story-label{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lyra-story1461 button{min-height:44px;padding:8px 14px;border:1px solid #bca87966;border-radius:10px;background:#14202d;color:#eee8d9;font:600 13px system-ui;touch-action:manipulation;cursor:pointer}
 .lyra-story1461 button[data-story-go]{background:#dec38b;color:#161b23}.lyra-story1461 button:focus-visible{outline:2px solid #dff7fa;outline-offset:2px}.lyra-story1461 .story-status{margin:0 10px;font-size:12px;color:#e6cda4}.lyra-story1461 .story-status:empty{display:none}
 @media(max-height:500px){.lyra-story1461 .story-bar{padding-top:4px;padding-bottom:4px;gap:6px}.lyra-story1461 .story-label{font-size:11px}.lyra-story1461 button{padding:7px 10px;font-size:12px}}
 @media(max-width:520px){.lyra-story1461 .story-label{display:none}}
 </style><div class="story-view"><img alt="" decoding="async"></div><p class="story-status" role="status"></p><div class="story-bar"><span class="story-label"></span><button type="button" data-story-zoom aria-pressed="false">Крупнее</button><button type="button" data-story-worlds>Миры</button><button type="button" data-story-go>Продолжить →</button></div>`;
 host.append(layer);const image=layer.querySelector('img'),label=layer.querySelector('.story-label'),status=layer.querySelector('.story-status'),zoom=layer.querySelector('[data-story-zoom]'),worlds=layer.querySelector('[data-story-worlds]'),go=layer.querySelector('[data-story-go]'),abort=new AbortController();let resolve=null,current=null;
 function finish(action){if(!resolve)return;const complete=resolve;resolve=null;current=null;layer.hidden=true;image.removeAttribute?.('src');document.body.classList.remove('lira-story-open');onVisibility(false);complete(action);}
 go.addEventListener('click',()=>finish('continue'),{signal:abort.signal});worlds.addEventListener('click',()=>finish('worlds'),{signal:abort.signal});zoom.addEventListener('click',()=>{const enlarged=layer.dataset.zoom!=='true';layer.dataset.zoom=String(enlarged);zoom.textContent=enlarged?'Целиком':'Крупнее';zoom.setAttribute('aria-pressed',String(enlarged));},{signal:abort.signal});
 image.addEventListener('error',()=>{status.textContent=(current?.text||'')+' Можно продолжить без изображения.';},{signal:abort.signal});
 window.addEventListener('keydown',e=>{if(!resolve)return;e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(['Enter','Space','Escape'].includes(e.code))finish('continue');if(e.code==='Tab'){const buttons=[zoom,worlds,go],index=buttons.indexOf(document.activeElement),next=(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length;buttons[next].focus?.();}},{signal:abort.signal,capture:true});
 return {get visible(){return !!resolve;},get current(){return current;},show(key){const scene=STORY_ART[key];if(!scene)return Promise.resolve('continue');if(resolve)return Promise.resolve('busy');current=scene;layer.dataset.scene=key;layer.dataset.zoom='false';zoom.textContent='Крупнее';zoom.setAttribute('aria-pressed','false');label.textContent=scene.title;status.textContent='';image.alt=scene.text;image.src=path+scene.file;layer.hidden=false;document.body.classList.add('lira-story-open');onVisibility(true);go.focus?.();return new Promise(done=>{resolve=done;});},dispose(){finish('worlds');abort.abort();layer.remove();}};
}
