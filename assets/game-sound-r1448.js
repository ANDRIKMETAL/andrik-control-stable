// Short locally synthesized cues: no downloads, intervals or background playback.
export function createGameSound(getContext,getVolume){
 let noise=null,owner=null,live=0;const limit=18;
 function source(freq,duration,volume,type='sine',end=freq){
  const c=getContext(),level=getVolume();if(!c||c.state==='suspended'||level<=0||live>=limit)return;
  try{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
   g.gain.setValueAtTime(Math.max(.0001,volume*level),t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(c.destination);live++;o.onended=()=>{live--;o.disconnect();g.disconnect();};o.start();o.stop(t+duration);
  }catch{}
 }
 function hiss(duration,volume,cutoff){
  const c=getContext(),level=getVolume();if(!c||c.state==='suspended'||level<=0||live>=limit)return;
  try{if(owner!==c){owner=c;noise=null;}if(!noise){noise=c.createBuffer(1,Math.ceil(c.sampleRate*.4),c.sampleRate);const data=noise.getChannelData(0);let seed=59137;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/2147483647)*2-1;}}
   const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;s.buffer=noise;f.type='lowpass';f.frequency.setValueAtTime(cutoff,t);g.gain.setValueAtTime(volume*level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);s.connect(f);f.connect(g);g.connect(c.destination);live++;s.onended=()=>{live--;s.disconnect();f.disconnect();g.disconnect();};s.start();s.stop(t+duration);
  }catch{}
 }
 return {event(e,state){
  if(e.type==='step'){
   const wood=!state.isCity&&(state.isRuins||state.world===2),metal=state.world===3||state.world===4;
   hiss(.055,wood?.12:.075,metal?3100:wood?1100:650);source(metal?460:wood?150:75,.075,.04,'triangle',metal?300:50);
  }else if(e.type==='hit'){
   const kick=e.kind==='kick',guitar=e.kind==='attack',blade=e.kind==='slash',bat=blade&&state.weaponStats?.selected==='bat';source(bat?95:blade?380:kick?85:guitar?165:120,kick?.17:.10,kick?.19:.13,'triangle',bat?45:blade?190:42);hiss(bat?.12:.075,bat?.20:.15,bat?1200:blade?4200:guitar?2900:1700);
   if(guitar){source(220,.28,.065,'sawtooth',110);source(330,.24,.035,'triangle',165);}
  }else if(e.type==='swing')hiss(e.kind==='kick'?.18:state.weaponStats?.selected==='bat'?.18:.12,e.kind==='slash'?.085:.06,e.kind==='slash'&&state.weaponStats?.selected==='bat'?1700:e.kind==='slash'?3100:e.kind==='attack'?1900:900);
  else if(e.type==='dodge'){hiss(.18,.10,2300);source(190,.15,.04,'triangle',80);}
  else if(e.type==='shieldHit'){source(530,.12,.10,'triangle',220);hiss(.06,.1,4800);}
  else if(e.type==='shieldBreak'||e.type==='armorBreak'){hiss(.24,.18,3800);source(170,.25,.13,'triangle',45);}
  else if(e.type==='counterHit'){source(610,.18,.09,'triangle',980);}
  else if(e.type==='tacticShot'){source(810,.09,.05,'sawtooth',290);}
  else if(e.type==='bladeParry'){source(720,.2,.08,'triangle',330);hiss(.05,.08,5200);}
  else if(e.type==='finishImpact'){source(64,.23,.23,'sine',28);hiss(.13,.22,1800);}
  else if(e.type==='dogWarn'){source(130,.23,.08,'sawtooth',75);hiss(.14,.12,850);}
  else if(e.type==='dogBite'){source(205,.13,.1,'sawtooth',70);hiss(.09,.18,1300);}
  else if(e.type==='bossWindup'){source(e.kind==='charge'?95:140,.18,.06,'triangle',55);}
  else if(e.type==='bossOpen'){source(440,.20,.055,'sine',660);}
  else if(e.type==='mechanicalBurst'){source(70,.35,.15,'triangle',30);hiss(.25,.12,1800);}
  else if(e.type==='rageStart'){source(100,.32,.07,'sawtooth',220);hiss(.22,.08,1200);}
  else if(e.type==='land'){source(80,.12,.1,'triangle',38);hiss(.065,.06,800);}
 },get live(){return live;}};
}
