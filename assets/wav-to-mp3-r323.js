/* ANDRIK R323 — WAV -> MP3 320 kbps browser-side converter.
   LAME.js is loaded on demand as a separate LGPL-3.0 library from cdnjs. */
(()=>{'use strict';
const LAME_URL='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
const LAME_SRI='sha512-xT0S/xXvkrfkRXGBPlzZPCAncnMK5c1N7slRkToUbv8Z901aUEuKO84tLy8dWU+3ew4InFEN7TebPaVMy2npZw==';
let lamePromise=null;

function loadLame(){
  if(window.lamejs?.Mp3Encoder)return Promise.resolve(window.lamejs);
  if(lamePromise)return lamePromise;
  lamePromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=LAME_URL;s.async=true;s.crossOrigin='anonymous';s.integrity=LAME_SRI;
    s.onload=()=>window.lamejs?.Mp3Encoder?resolve(window.lamejs):reject(new Error('LAME MP3 encoder не запустился'));
    s.onerror=()=>reject(new Error('Не удалось загрузить MP3-кодировщик. Проверьте интернет.'));
    document.head.appendChild(s);
  });
  return lamePromise;
}

const tick=()=>new Promise(r=>requestAnimationFrame(()=>r()));
function toInt16(src,start,end){
  const out=new Int16Array(end-start);
  for(let i=start,j=0;i<end;i++,j++){
    const v=Math.max(-1,Math.min(1,src[i]||0));
    out[j]=v<0?v*32768:v*32767;
  }
  return out;
}

async function decodeAndResample(file,onProgress){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)throw new Error('Этот браузер не поддерживает обработку WAV.');
  const ctx=new AC();
  try{
    onProgress?.(3,'Читаем WAV…');
    const raw=await file.arrayBuffer();
    onProgress?.(8,'Декодируем WAV…');
    const decoded=await ctx.decodeAudioData(raw.slice(0));
    const channels=Math.max(1,Math.min(2,decoded.numberOfChannels||1));
    const targetRate=44100;
    if(decoded.sampleRate===targetRate){
      return {buffer:decoded,channels,sampleRate:targetRate,cleanup:()=>ctx.close().catch(()=>{})};
    }
    onProgress?.(12,`Преобразуем ${Math.round(decoded.sampleRate/100)/10} → 44,1 кГц…`);
    const frames=Math.max(1,Math.ceil(decoded.duration*targetRate));
    const offline=new OfflineAudioContext(channels,frames,targetRate);
    const source=offline.createBufferSource();
    source.buffer=decoded;source.connect(offline.destination);source.start();
    const rendered=await offline.startRendering();
    return {buffer:rendered,channels,sampleRate:targetRate,cleanup:()=>ctx.close().catch(()=>{})};
  }catch(e){
    try{await ctx.close()}catch(_){}
    throw e;
  }
}

async function convert(file,onProgress){
  if(!file||!/\.wav$/i.test(file.name))return file;
  const lame=await loadLame();
  const decoded=await decodeAndResample(file,onProgress);
  try{
    const {buffer,channels,sampleRate}=decoded;
    const enc=new lame.Mp3Encoder(channels,sampleRate,320);
    const left=buffer.getChannelData(0);
    const right=channels>1?buffer.getChannelData(1):null;
    const block=1152,parts=[],total=left.length;
    onProgress?.(15,'Кодируем MP3 320 kbps…');
    let blocks=0;
    for(let i=0;i<total;i+=block){
      const end=Math.min(total,i+block);
      const l=toInt16(left,i,end);
      const mp3=channels>1?enc.encodeBuffer(l,toInt16(right,i,end)):enc.encodeBuffer(l);
      if(mp3?.length)parts.push(new Int8Array(mp3));
      blocks++;
      if((blocks&63)===0){
        const pct=15+Math.round((i/Math.max(1,total))*80);
        onProgress?.(Math.min(95,pct),`MP3 320 kbps · ${Math.min(99,Math.round((i/Math.max(1,total))*100))}%`);
        await tick();
      }
    }
    const tail=enc.flush();if(tail?.length)parts.push(new Int8Array(tail));
    onProgress?.(98,'MP3 готов. Записываем теги…');
    const name=file.name.replace(/\.wav$/i,'')+'.mp3';
    return new File(parts,name,{type:'audio/mpeg',lastModified:Date.now()});
  }finally{
    decoded.cleanup?.();
  }
}
window.andrikWavToMp3R323=convert;
})();