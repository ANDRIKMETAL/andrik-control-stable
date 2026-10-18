import {worldKey,momentSpec} from './world-moments-r1466.js?v=r1467';
// Short, distance-attenuated local sounds. No audio downloads or endless loops.
export function createLocalAmbience(getContext,getVolume,signal){
 const playing=new Set();let owner=null,buffer=null,clock=0,next=2.8,serial=0,dead=false,lastYaw=0;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function play(kind,at,p,yaw,force=.65){
  const c=getContext(),volume=getVolume();if(dead||!c||['suspended','closed'].includes(c.state)||volume<=0||playing.size>=3)return false;
  const d=Math.hypot(at.x-p.x,at.z-p.z,(at.y||0)-(p.y||0)),range=kind==='water'?19:14;if(d>=range)return false;
  const gain=volume*force*Math.pow(1-d/range,2),pan=clamp(Math.sin(Math.atan2(at.x-p.x,at.z-p.z)-yaw)*.8,-.8,.8);if(gain<.001)return false;
  let nodes=[],entry=null;
  try{
   const t=c.currentTime,g=c.createGain(),panner=c.createStereoPanner?.();nodes.push(g);if(panner){nodes.push(panner);panner.pan.setValueAtTime(pan,t);g.connect(panner);panner.connect(c.destination);}else g.connect(c.destination);
   const duration=kind==='water'?1.05:kind==='air'?.75:kind==='clock'?.19:kind==='glass'?.5:kind==='stone'?.42:.36;
   g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(Math.max(.0002,gain*.065),t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
   let source;
   if(['water','air','stone','electric'].includes(kind)){
    if(owner!==c){owner=c;buffer=null;}if(!buffer){buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.4),c.sampleRate);const a=buffer.getChannelData(0);let seed=1466;for(let i=0;i<a.length;i++){seed=seed*16807%2147483647;a[i]=seed/1073741823.5-1;}}
    source=c.createBufferSource();source.buffer=buffer;source.loop=true;const f=c.createBiquadFilter();nodes.push(f);f.type=kind==='electric'?'bandpass':'lowpass';f.frequency.setValueAtTime(kind==='water'?550:kind==='air'?1700:kind==='stone'?420:1600,t);source.connect(f);f.connect(g);
   }else {source=c.createOscillator();source.type=kind==='clock'?'triangle':'sine';const freq=kind==='clock'?680:kind==='glass'?920:kind==='code'?520:110;source.frequency.setValueAtTime(freq,t);source.frequency.exponentialRampToValueAtTime(kind==='code'?780:freq*.65,t+duration);source.connect(g);}
   nodes.push(source);entry={source,nodes,done:false};playing.add(entry);source.onended=()=>clean(entry);source.start();source.stop(t+duration+.03);return true;
  }catch{if(entry)clean(entry);else for(const n of nodes)try{n.disconnect();}catch{}return false;}
 }
 function clean(e){if(e.done)return;e.done=true;playing.delete(e);for(const n of e.nodes)try{n.disconnect();}catch{}}
 function dispose(){if(dead)return;dead=true;for(const e of [...playing]){try{e.source.stop();}catch{}clean(e);}buffer=null;owner=null;}
 signal?.addEventListener('abort',dispose,{once:true});
 return {update(dt,s,yaw=0){
  if(dead||dt<=0||s.dead||s.won||s.finale||s.vehicleActive||s.race?.mounted)return;lastYaw=yaw;clock+=Math.min(.06,dt);if(clock<next)return;next=clock+5+(serial++%4)*1.7;
  const world=worldKey(s),q=momentSpec(s),near=q&&Math.hypot(q.x-s.p.x,q.z-s.p.z)<12;
  let at,kind;
  if(near){at=q;kind=s.worldMoments?.data.done?(world===2?'water':world===4?'clock':'hum'):q.sound;}
  else if(world==='city'){const lamps=s.worldMoments?.lamps||[];at=lamps.slice().sort((a,b)=>Math.hypot(a.x-s.p.x,a.z-s.p.z)-Math.hypot(b.x-s.p.x,b.z-s.p.z))[0];kind=serial%2?'hum':'electric';}
  else {const f=(s.geo?.platforms||[]).find(f=>Math.hypot(f.x-s.p.x,f.z-s.p.z)<5);at=f?{x:f.x+2,y:f.h,z:f.z}:null;kind=world===2?'water':world===3?'hum':world===4?'clock':world===5?'code':world==='portrait'?'glass':'stone';}
  if(at)play(kind,at,s.p,yaw,(s.living||[]).some(e=>Math.hypot(e.x-s.p.x,e.z-s.p.z)<5)?.25:.65);
 },event(e,s){if(['momentBegin','momentDone','decorBreak','fragileWarning'].includes(e.type))play(e.type==='decorBreak'?'electric':e.type==='fragileWarning'?'stone':e.sound||'code',e,s.p,lastYaw,.85);},dispose,get live(){return playing.size;},get disposed(){return dead;}};
}
