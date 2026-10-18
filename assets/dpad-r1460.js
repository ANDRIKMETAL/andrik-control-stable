// Movement and view use independent pointers. No view state is touched here.
export const dpadMarkup=`<style>
 [data-game1448] [data-dpad],#portrait [data-dpad],#world1306 [data-dpad]{width:144px!important;height:144px!important;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);border:0!important;border-radius:0!important;background:transparent!important;gap:2px;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto}
 [data-dpad] button{padding:0!important;min-height:44px!important;min-width:44px!important;border:1px solid #d1e8eb80!important;border-radius:12px!important;background:rgba(13,28,42,var(--game-opacity,.38))!important;color:#e6f6f6!important;font:700 23px/1 system-ui!important;touch-action:none;box-shadow:inset 0 1px 8px #d3f5ff12;text-shadow:0 1px 3px #000}
 [data-dpad] [data-dir=up]{grid-area:1/2}[data-dpad] [data-dir=left]{grid-area:2/1}[data-dpad] [data-dir=right]{grid-area:2/3}[data-dpad] [data-dir=down]{grid-area:3/2}
 [data-dpad] button[data-pressed=true]{border-color:#8cf4de!important;background:#255c65bb!important;box-shadow:0 0 12px #8cf4de33}
 [data-dpad] i{display:none!important}
 @media(max-height:450px){[data-game1448] [data-dpad],#portrait [data-dpad],#world1306 [data-dpad]{width:136px!important;height:136px!important}}
 </style><button type="button" data-dir="up" aria-label="Вперёд">↑</button><button type="button" data-dir="left" aria-label="Влево">←</button><button type="button" data-dir="right" aria-label="Вправо">→</button><button type="button" data-dir="down" aria-label="Назад">↓</button><i></i>`;
export function padDirection(x,z){const l=Math.hypot(x,z);if(l<.19)return {x:0,z:0};const limit=Math.max(Math.abs(x),Math.abs(z))*.44;return {x:Math.abs(x)>=limit?Math.sign(x):0,z:Math.abs(z)>=limit?Math.sign(z):0};}
export function movementInput(x,z,yaw,run=false,facingYaw=yaw){const l=Math.max(1,Math.hypot(x,z));return {x:(-Math.cos(yaw)*x+Math.sin(yaw)*z)/l,z:(Math.sin(yaw)*x+Math.cos(yaw)*z)/l,run,facingYaw};}
export function bindDpad(pad,{signal,isPaused=()=>false}={}){
 const pointers=new Map(),buttons=Array.from(pad.querySelectorAll('[data-dir]'));const value={x:0,z:0};
 function refresh(){let x=0,z=0;for(const v of pointers.values()){x+=v.x;z+=v.z;}value.x=Math.sign(x);value.z=Math.sign(z);for(const b of buttons)b.dataset.pressed=String(b.dataset.dir==='left'?value.x<0:b.dataset.dir==='right'?value.x>0:b.dataset.dir==='up'?value.z>0:value.z<0);}
 function coordinates(e){const r=pad.getBoundingClientRect();return padDirection((e.clientX-r.left-r.width/2)/(r.width/2),-(e.clientY-r.top-r.height/2)/(r.height/2));}
 function release(e){if(pointers.delete(e.pointerId))refresh();}
 pad.addEventListener('pointerdown',e=>{if(isPaused()||pointers.size>=4)return;e.preventDefault();e.stopPropagation();pointers.set(e.pointerId,coordinates(e));pad.setPointerCapture(e.pointerId);refresh();},{signal});
 pad.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();e.stopPropagation();pointers.set(e.pointerId,coordinates(e));refresh();},{signal});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,release,{signal});
 const reset=()=>{pointers.clear();refresh();};window.addEventListener('blur',reset,{signal});signal?.addEventListener('abort',reset,{once:true});
 return {get x(){return value.x;},get z(){return value.z;},reset};
}
