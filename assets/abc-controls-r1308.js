// Shared three-button input. Combat queue is bounded; holds never also punch.
export const abcMarkup=`<style>
.pt-actions:has([data-abc]),[id="world1306"] .actions:has([data-abc]){
 --abc-size:clamp(64px,9vh,80px);position:absolute!important;
 right:max(16px,env(safe-area-inset-right))!important;bottom:max(16px,env(safe-area-inset-bottom))!important;
 display:grid!important;grid-template-columns:repeat(2,var(--abc-size))!important;
 grid-template-rows:repeat(2,var(--abc-size))!important;column-gap:18px!important;row-gap:6px!important;
 width:calc(2 * var(--abc-size) + 18px)!important;height:calc(2 * var(--abc-size) + 6px)!important;
 padding:0!important;background:none!important;pointer-events:none;align-items:center;justify-items:center;
}
.pt-actions button[data-abc],[id="world1306"] .actions button[data-abc]{
 width:var(--abc-size)!important;height:var(--abc-size)!important;min-width:0!important;min-height:0!important;
 padding:0!important;aspect-ratio:1!important;border-radius:50%!important;
 display:grid!important;place-items:center!important;pointer-events:auto;touch-action:none;
 border:1.5px solid rgba(208,235,246,.52)!important;background:rgba(13,28,42,.32)!important;
 color:rgba(245,251,255,.94)!important;box-shadow:inset 0 0 15px rgba(198,231,247,.07),0 3px 12px rgba(0,0,0,.18)!important;
 text-shadow:0 1px 4px rgba(0,0,0,.65);-webkit-tap-highlight-color:transparent;user-select:none;
 transition:background .1s,border-color .1s,transform .1s;
}
.pt-actions button[data-abc] b,[id="world1306"] .actions button[data-abc] b{font:700 clamp(24px,3.5vh,32px)/1 system-ui!important;}
.pt-actions [data-abc="A"],[id="world1306"] .actions [data-abc="A"]{grid-column:1/3!important;grid-row:1!important;}
.pt-actions [data-abc="B"],[id="world1306"] .actions [data-abc="B"]{grid-column:1!important;grid-row:2!important;}
.pt-actions [data-abc="C"],[id="world1306"] .actions [data-abc="C"]{grid-column:2!important;grid-row:2!important;}
.pt-actions button[data-abc]:active,[id="world1306"] .actions button[data-abc]:active{background:rgba(81,130,159,.48)!important;border-color:rgba(222,248,255,.95)!important;transform:scale(.94);}
.pt-actions button[data-abc]:focus-visible,[id="world1306"] .actions button[data-abc]:focus-visible{outline:2px solid #a4eaff;outline-offset:4px;}
@media(max-height:450px){.pt-actions:has([data-abc]),[id="world1306"] .actions:has([data-abc]){--abc-size:clamp(54px,15vh,66px);right:max(12px,env(safe-area-inset-right))!important;bottom:max(12px,env(safe-area-inset-bottom))!important;}}
</style><button data-abc="A" aria-label="A: прыжок, повторно двойной"><b>A</b></button><button data-abc="B" aria-label="B: удары, удерживать для гитары"><b>B</b></button><button data-abc="C" aria-label="C: действие рядом с целью, иначе крик"><b>C</b></button>`;
export function createABC(state){
 let held=null,queue=[],step=0,lastTap=-Infinity,zone=state.zone;
 const reset=()=>{held=null;queue=[];step=0;lastTap=-Infinity;zone=state.zone;};
 const riding=()=>state.race?.mounted&&!state.race.finished;
 function submit(kind){if(state.dead||state.won||state.finale)return;if(!state.attack){state.action(kind);}else if(queue.length<2)queue.push(kind);}
 return {reset,down(button,now){if(button==='A')state.action('jump');else if(button==='C')state.action(state.canInteract?'interact':'scream');else if(button==='B'&&!held){held={at:now,fired:false};if(riding()){state.action('dash');held.fired=true;}}},
 up(button,now){if(button!=='B'||!held)return;const was=held;held=null;if(was.fired)return;if(now-was.at>=360){submit('attack');return;}if(now-lastTap>1400){step=0;if(!state.attack)state.nextUpper=false;}submit(step===2?'kick':'punch');step=(step+1)%3;lastTap=now;},
 tick(now){if(zone!==state.zone){reset();return;}if(state.dead||state.won||state.finale){reset();return;}if(held&&!held.fired&&now-held.at>=360){held.fired=true;submit('attack');step=0;}if(!state.attack&&queue.length)state.action(queue.shift());}
 };
}
export function bindABC(root,state,signal,isPaused){
 const controller=createABC(state),heldPointers=new Map();
 for(const button of root.querySelectorAll('[data-abc]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(isPaused()||heldPointers.has(button.dataset.abc))return;heldPointers.set(button.dataset.abc,e.pointerId);button.setPointerCapture?.(e.pointerId);controller.down(button.dataset.abc,performance.now());},{signal});
  button.addEventListener('pointerup',e=>{e.preventDefault();const k=button.dataset.abc;if(heldPointers.get(k)!==e.pointerId)return;heldPointers.delete(k);if(!isPaused())controller.up(k,performance.now());},{signal});
  button.addEventListener('pointercancel',()=>{heldPointers.clear();controller.reset();},{signal});
  button.addEventListener('lostpointercapture',()=>{if(heldPointers.has(button.dataset.abc)){heldPointers.clear();controller.reset();}},{signal});
 }
 const reset=controller.reset;controller.reset=()=>{heldPointers.clear();reset();};signal.addEventListener('abort',controller.reset,{once:true});return controller;
}
