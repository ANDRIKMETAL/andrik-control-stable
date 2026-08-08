/* ANDRIK R330 — robust internal navigation to the full singles catalog. */
(()=>{'use strict';
const selector='.andrik-singles-more';
function go(e){
  const a=e.target?.closest?.(selector);if(!a)return;
  e.preventDefault();e.stopPropagation();
  const target='/singles.html?v=55.00-r330';
  try{
    if(window.top && window.top!==window) window.top.location.assign(target);
    else window.location.assign(target);
  }catch(_){window.location.href=target}
}
document.addEventListener('click',go,true);
document.addEventListener('pointerup',e=>{
  const a=e.target?.closest?.(selector);if(!a)return;
  if(e.pointerType==='mouse')return;
  go(e);
},true);
})();