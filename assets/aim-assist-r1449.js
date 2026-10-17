const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const supported=kind=>['slash','punch','kick','backfist'].includes(kind);
function range(kind,foe,state){const blade=state.growthStats?.bladeRange??2.85;return foe.kind==='boss'?3.9+(kind==='slash'?blade-2.85:0):kind==='slash'?blade:kind==='kick'?3.4:kind==='backfist'?2.75:2.35;}
function visible(state,e,kind,blocked,from){
 return e?.hp>0&&distance(state.p,e)<=range(kind,e,state)&&Math.abs((e.y||0)-state.p.y)<1.6&&Math.abs(angle(Math.atan2(e.x-state.p.x,e.z-state.p.z),from))<=Math.PI*55/180&&!blocked(state.p,e,state.geo.walls);
}
export function beginAim(state,blocked){
 const a=state.attack;if(!a||!supported(a.kind)||state.aimAssistEnabled===false||state.race?.mounted)return;
 const from=state.p.yaw,candidates=state.living.filter(e=>visible(state,e,a.kind,blocked,from));
 candidates.sort((x,y)=>{const score=e=>distance(state.p,e)+Math.abs(angle(Math.atan2(e.x-state.p.x,e.z-state.p.z),from))*1.7+(e.down>0?.8:0);return score(x)-score(y);});
 // Keep the previous combo target only while it is still in the same forward cone.
 const prior=candidates.find(e=>e.id===state.lastAimTarget1449?.id&&state.time-state.lastAimTarget1449.time<1.4);
 const e=prior||candidates[0];if(!e)return;
 a.aim={target:e.id,from,to:Math.atan2(e.x-state.p.x,e.z-state.p.z)};state.lastAimTarget1449={id:e.id,time:state.time};
}
export function updateAim(state,input,blocked,impact=false){
 const a=state.attack,aim=a?.aim;if(!aim)return;
 const e=state.enemies.find(e=>e.id===aim.target);
 if(state.aimAssistEnabled===false||!visible(state,e,a.kind,blocked,aim.from)){delete a.aim;return;}
 const x=input?.x||0,z=input?.z||0,l=Math.hypot(x,z);
 if(l>.35&&(x*Math.sin(aim.to)+z*Math.cos(aim.to))/Math.max(.001,l)<-.45){delete a.aim;return;}
 if(a.hit&&!impact)return;
 const u=impact?1:clamp(a.t/.13,0,1),smooth=u*u*(3-2*u);
 state.p.yaw=aim.from+angle(aim.to,aim.from)*smooth;
}
