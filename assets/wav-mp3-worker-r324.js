/* ANDRIK R324 — dedicated WAV PCM -> MP3 320 kbps worker.
   Loads unmodified lamejs 1.2.1 from cdnjs inside a classic Web Worker. */
'use strict';
const LAME_URL='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
let lameReady=false;
function ensureLame(){
  if(lameReady&&self.lamejs?.Mp3Encoder)return;
  importScripts(LAME_URL);
  if(!self.lamejs?.Mp3Encoder)throw new Error('LAME MP3 encoder не запустился в Worker');
  lameReady=true;
}
function clamp16(v){v=v>1?1:(v<-1?-1:v);return v<0?v*32768:v*32767}
self.onmessage=e=>{
  const d=e.data||{};
  if(d.type!=='encode')return;
  try{
    ensureLame();
    const left=new Float32Array(d.left),right=d.right?new Float32Array(d.right):null;
    const channels=right?2:1,sampleRate=Number(d.sampleRate)||44100,bitrate=320;
    const enc=new self.lamejs.Mp3Encoder(channels,sampleRate,bitrate);
    const block=1152,total=left.length,l16=new Int16Array(block),r16=right?new Int16Array(block):null,parts=[];
    let done=0,lastPost=0;
    for(let i=0;i<total;i+=block){
      const len=Math.min(block,total-i);
      for(let j=0;j<len;j++){
        l16[j]=clamp16(left[i+j]||0);
        if(r16)r16[j]=clamp16(right[i+j]||0);
      }
      const a=l16.subarray(0,len),b=r16?r16.subarray(0,len):null;
      const out=r16?enc.encodeBuffer(a,b):enc.encodeBuffer(a);
      if(out?.length)parts.push(new Uint8Array(out));
      done=i+len;
      const now=Date.now();
      if(now-lastPost>=450||done>=total){
        lastPost=now;
        self.postMessage({type:'progress',pct:Math.min(99,Math.round(done/Math.max(1,total)*100))});
      }
    }
    const tail=enc.flush();if(tail?.length)parts.push(new Uint8Array(tail));
    let bytes=0;for(const p of parts)bytes+=p.byteLength;
    const merged=new Uint8Array(bytes);let off=0;
    for(const p of parts){merged.set(p,off);off+=p.byteLength}
    self.postMessage({type:'done',buffer:merged.buffer},[merged.buffer]);
  }catch(err){
    self.postMessage({type:'error',message:String(err?.message||err)});
  }
};