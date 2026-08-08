/* ANDRIK R324 — faster WAV -> MP3 320 kbps.
   - keeps native 32/44.1/48 kHz instead of always resampling;
   - MP3 encoding runs in a dedicated Web Worker when available;
   - progress is throttled; fallback stays available for compatibility. */
(()=>{'use strict';
const LAME_URL='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
const SUPPORTED=[32000,44100,48000];
let lamePromise=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));

function loadLame(){
  if(window.lamejs?.Mp3Encoder)return Promise.resolve(window.lamejs);
  if(lamePromise)return lamePromise;
  lamePromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=LAME_URL;s.async=true;s.crossOrigin='anonymous';
    s.onload=()=>window.lamejs?.Mp3Encoder?resolve(window.lamejs):reject(new Error('LAME MP3 encoder не запустился'));
    s.onerror=()=>reject(new Error('Не удалось загрузить MP3-кодировщик. Проверьте интернет.'));
    document.head.appendChild(s);
  });
  return lamePromise;
}
function abortErr(){return new DOMException('Операция отменена','AbortError')}
function ensureNotAborted(signal){if(signal?.aborted)throw abortErr()}
async function readFile(file,onProgress,signal){
  let lastErr=null;
  for(let attempt=1;attempt<=2;attempt++){
    ensureNotAborted(signal);
    try{
      onProgress?.(3,attempt===1?'Читаем WAV…':'Повторяем чтение WAV…');
      return await file.arrayBuffer();
    }catch(e){lastErr=e;if(attempt<2)await sleep(220)}
  }
  throw lastErr||new Error('Не удалось прочитать WAV');
}
function nearestRate(rate){
  if(SUPPORTED.includes(rate))return rate;
  return SUPPORTED.reduce((best,n)=>Math.abs(n-rate)<Math.abs(best-rate)?n:best,44100);
}
async function preparePcm(file,onProgress,signal){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)throw new Error('Этот браузер не поддерживает обработку WAV.');
  const ctx=new AC();
  try{
    const raw=await readFile(file,onProgress,signal);
    onProgress?.(7,'Декодируем WAV…');
    ensureNotAborted(signal);const decoded=await ctx.decodeAudioData(raw);ensureNotAborted(signal);
    const channels=Math.max(1,Math.min(2,decoded.numberOfChannels||1));
    let buffer=decoded,targetRate=nearestRate(decoded.sampleRate);
    if(decoded.sampleRate!==targetRate){
      onProgress?.(11,`Преобразуем ${Math.round(decoded.sampleRate/100)/10} → ${Math.round(targetRate/100)/10} кГц…`);
      const frames=Math.max(1,Math.ceil(decoded.duration*targetRate));
      const offline=new OfflineAudioContext(channels,frames,targetRate);
      const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
      buffer=await offline.startRendering();ensureNotAborted(signal);
    }else{
      onProgress?.(11,`Без ресэмплинга · ${Math.round(targetRate/100)/10} кГц`);
    }
    // Copy exactly one track to transferable PCM, then release AudioContext/AudioBuffer references.
    const left=new Float32Array(buffer.getChannelData(0));
    const right=channels>1?new Float32Array(buffer.getChannelData(1)):null;
    return {left,right,sampleRate:targetRate};
  }finally{
    try{await ctx.close()}catch(_){}
  }
}
function workerEncode(pcm,onProgress,signal){
  if(!window.Worker)return Promise.reject(new Error('Web Worker недоступен'));
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(abortErr());return}
    const w=new Worker('/assets/wav-mp3-worker-r324.js?v=55.00-r325');
    let finished=false;
    const cleanup=()=>{signal?.removeEventListener('abort',onAbort)};
    const finish=()=>{if(!finished){finished=true;try{w.terminate()}catch(_){}cleanup()}};
    const onAbort=()=>{finish();reject(abortErr())};
    signal?.addEventListener('abort',onAbort,{once:true});
    w.onmessage=e=>{
      const d=e.data||{};
      if(d.type==='progress'){onProgress?.(15+Math.round((Number(d.pct)||0)*.82),`MP3 320 kbps · ${Number(d.pct)||0}%`);return}
      if(d.type==='done'){const b=d.buffer;finish();resolve(b);return}
      if(d.type==='error'){const msg=d.message||'Ошибка Worker';finish();reject(new Error(msg))}
    };
    w.onerror=e=>{const msg=e?.message||'Ошибка Web Worker';finish();reject(new Error(msg))};
    const transfer=[pcm.left.buffer];if(pcm.right)transfer.push(pcm.right.buffer);
    w.postMessage({type:'encode',left:pcm.left.buffer,right:pcm.right?pcm.right.buffer:null,sampleRate:pcm.sampleRate},transfer);
  });
}
function clamp16(v){v=v>1?1:(v<-1?-1:v);return v<0?v*32768:v*32767}
async function fallbackEncode(pcm,onProgress,signal){
  const lame=await loadLame(),channels=pcm.right?2:1,enc=new lame.Mp3Encoder(channels,pcm.sampleRate,320);
  const block=1152,total=pcm.left.length,l16=new Int16Array(block),r16=pcm.right?new Int16Array(block):null,parts=[];
  let lastUi=0,blocks=0;
  for(let i=0;i<total;i+=block){
    ensureNotAborted(signal);
    const len=Math.min(block,total-i);
    for(let j=0;j<len;j++){l16[j]=clamp16(pcm.left[i+j]||0);if(r16)r16[j]=clamp16(pcm.right[i+j]||0)}
    const out=r16?enc.encodeBuffer(l16.subarray(0,len),r16.subarray(0,len)):enc.encodeBuffer(l16.subarray(0,len));
    if(out?.length)parts.push(new Uint8Array(out));
    blocks++;
    const now=performance.now();
    if(now-lastUi>=550){lastUi=now;const pct=Math.min(99,Math.round((i+len)/Math.max(1,total)*100));onProgress?.(15+Math.round(pct*.82),`MP3 320 kbps · ${pct}%`);await nextFrame()}
  }
  const tail=enc.flush();if(tail?.length)parts.push(new Uint8Array(tail));
  return new Blob(parts,{type:'audio/mpeg'}).arrayBuffer();
}
async function convert(file,onProgress,signal){
  if(!file||!/\.wav$/i.test(file.name))return file;
  ensureNotAborted(signal);const pcm=await preparePcm(file,onProgress,signal);
  onProgress?.(15,'Запускаем быстрый MP3 320 kbps…');
  let buffer;
  try{
    buffer=await workerEncode(pcm,onProgress,signal);
  }catch(workerErr){
    console.warn('R324 Worker fallback:',workerErr);
    onProgress?.(16,'Режим совместимости MP3 320 kbps…');
    // Worker transfer detaches PCM, so decode once more only if Worker had already received it.
    if(workerErr?.name==='AbortError')throw workerErr;
    const pcm2=(pcm.left.byteLength===0)?await preparePcm(file,onProgress,signal):pcm;
    buffer=await fallbackEncode(pcm2,onProgress,signal);
  }
  ensureNotAborted(signal);onProgress?.(98,'MP3 готов. Записываем теги…');
  const name=file.name.replace(/\.wav$/i,'')+'.mp3';
  return new File([buffer],name,{type:'audio/mpeg',lastModified:Date.now()});
}
window.andrikWavToMp3R324=convert;
})();