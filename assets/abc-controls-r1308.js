// Shared three-button input. Combat queue is bounded; holds never also punch.
export const abcMarkup='<button data-abc="A" aria-label="A: прыжок, повторно двойной"><b>A</b><small>ПРЫЖОК</small></button><button data-abc="B" aria-label="B: удары, удерживать для гитары"><b>B</b><small>УДАР / ГИТАРА</small></button><button data-abc="C" aria-label="C: действие рядом с целью, иначе крик"><b>C</b><small>ДЕЙСТВИЕ / КРИК</small></button>';
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
