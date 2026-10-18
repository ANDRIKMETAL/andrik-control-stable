(() => {
'use strict';
const panel=document.getElementById('liraLaunch');
if(!panel)return;
const text=document.getElementById('liraLaunchText'),reason=document.getElementById('liraLaunchError');
const retry=document.getElementById('liraLaunchRetry'),cover=panel.querySelector('img');
const shell=document.getElementById('gameShell');
const mobile=matchMedia('(pointer:coarse)').matches||Math.min(innerWidth,innerHeight)<600;
let ready=false,failed=false,coverReady=!cover||cover.complete;
const portrait=()=>mobile&&innerWidth<innerHeight;
async function requestLandscape(){
 try{if(!document.fullscreenElement&&shell?.requestFullscreen)await shell.requestFullscreen();}catch{}
 try{await screen.orientation?.lock?.('landscape');}catch{}
 handoff();
 return !portrait();
}
function handoff(){
 if(failed||panel.hidden)return;
 if(ready&&portrait())text.textContent='Поверни телефон горизонтально — обложка и игра готовы.';
 else if(!ready)text.textContent='Открываем миры Лиры…';
 if(!ready||!coverReady||portrait())return;
 panel.hidden=true;document.body.classList.remove('lira-loading');
 window.dispatchEvent(new Event('resize'));
}
function error(message){
 failed=true;panel.hidden=false;panel.dataset.phase='error';document.body.classList.add('lira-loading');
 window.LiraGame?.hold?.();text.textContent='Не удалось открыть игру. Сохранения остаются на месте.';
 reason.textContent=String(message);reason.hidden=false;retry.hidden=false;
}
window.AndrikLiraLaunch=Object.freeze({requestLandscape,visible:()=>!panel.hidden});
document.getElementById('liraLaunchRotate').onclick=requestLandscape;
retry.onclick=()=>{const url=new URL(location.href);url.searchParams.set('boot',Date.now());location.replace(url.href);};
window.addEventListener('lira3d-error',event=>error(event.detail||'Графика временно недоступна. Повтори запуск.'));
window.addEventListener('resize',handoff,{passive:true});
window.addEventListener('orientationchange',handoff,{passive:true});
if(cover){for(const event of ['load','error'])cover.addEventListener(event,()=>{coverReady=true;handoff();},{once:true});}
const timer=setTimeout(()=>error('Загрузка занимает слишком долго. Проверь соединение и повтори запуск.'),25000);
import('./lira-3d-r1308.js?v=r1459').then(()=>window.lira3DBootPromise).then(()=>{
 clearTimeout(timer);
 if(!document.body.classList.contains('lira3d'))throw Error('Игровое меню не загрузилось.');
 ready=true;failed=false;reason.hidden=true;retry.hidden=true;handoff();
}).catch(cause=>{clearTimeout(timer);console.error(cause);error(cause?.message||String(cause));});
})();
