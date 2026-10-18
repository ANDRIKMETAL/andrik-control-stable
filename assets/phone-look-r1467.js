const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),frames=new WeakMap();
export function lookDelta(dx,dy,width,height,sensitivity=1,mouse=false){
 const scale=mouse?.0038:2.4/clamp(Math.min(width||640,height||360),320,960),gain=scale*clamp(Number(sensitivity)||1,.5,1.5);
 return {yaw:-clamp((Number(dx)||0)*gain,-.30,.30),pitch:clamp((Number(dy)||0)*gain*.68,-.20,.20)};
}
// Only distance breathes with nearby combat. Camera yaw remains under the
// player's right finger; left-hand movement never turns the view.
export function combatDistance(s,distance,dt,mode=0){
 let f=frames.get(s);if(!f){f={extra:0,geo:s.geo};frames.set(s,f);}if(f.geo!==s.geo){f.extra=0;f.geo=s.geo;}
 if(mode||s.vehicleActive||s.race?.mounted)return distance;
 const count=s.living.filter(e=>Math.hypot(e.x-s.p.x,e.z-s.p.z)<6.5&&Math.abs((e.y||0)-s.p.y)<2.3).length,target=distance>2.8?count>=3?.65:count===2?.35:0:0;
 f.extra+=(target-f.extra)*(1-Math.exp(-Math.max(0,Math.min(.1,dt))*3));return distance+f.extra;
}
