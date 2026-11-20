// A four-note call from the side of the bar, answered by two bars of music.
export const mic = {x:-12.5,z:33};
const riff=[164.81,196,185,164.81];
const bass=[82.41,82.41,98,92.50,82.41,98,92.50,82.41];
export function createSoundcheck(state,audio,notice,save){
 let nextCall=0,step=0,beat=16,wait=0,near=false;
 const active=()=>state.zone===2&&!state.dead&&!state.finale&&!state.won;
 const distance=()=>Math.hypot(state.p.x-mic.x,state.p.z-mic.z,state.p.y);
 function note(hz,length,volume,type,end=hz){
  const c=audio.ctx,level=audio.music*volume;
  if(!level||!c||c.state!=='running')return;
  const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;
  o.type=type;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(end,t+length);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(Math.max(.0001,level),t+.007);
  g.gain.exponentialRampToValueAtTime(.0001,t+length);o.connect(g);g.connect(c.destination);
  o.onended=()=>{o.disconnect();g.disconnect();};o.start(t);o.stop(t+length);
 }
 return {
  tick(dt){
   if(!active()){near=false;nextCall=0;beat=16;step=0;return;}
   const d=distance();
   if(d<1.9&&!near){near=true;notice('У микрофона · удерживай B / F',2);}
   if(d>2.6)near=false;
   if(beat<16){
    wait-=dt;if(wait<=0){
     const root=bass[(beat>>1)%8];note(root,.18,.42,'triangle');
     if(beat%2===0){note(root*2,.19,.17,'sawtooth');note(root*3,.19,.08,'triangle');}
     if(beat%4===0)note(145,.15,.45,'sine',42);
     if(beat%4===2)note(190,.09,.14,'square',68);
     note(3200,.035,.04,'square',1650);beat++;wait+=.23;
    }
   }else if(d<12){
    nextCall-=dt;if(nextCall<=0){
     note(riff[step],.29,.21*(1-d/12),'sawtooth');
     step=(step+1)%4;nextCall+=step===0?2.3:.38;
    }
   }else{step=0;nextCall=0;}
  },
  answer(){
   if(!active()||distance()>2.1||beat<16)return false;
   beat=0;wait=0;nextCall=2.8;
   const known=state.snapshot().battleR1468?.secrets?.includes('2:picture:'+mic.x+':'+mic.z);
   if(!known){state.emit('secretR1301',mic);save();}
   notice(known?'На бис!':'Секрет найден · саундчек ANDRIK',3);return true;
  }
 };
}
