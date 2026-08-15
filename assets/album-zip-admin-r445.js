/* ANDRIK R445 — browser-side STORE ZIP + R2 multipart uploader. Large albums are never buffered as one file. */
(()=>{'use strict';
  const root=document.getElementById('albumZipCardR445'); if(!root)return;
  const grid=document.getElementById('albumZipGridR445'), status=document.getElementById('albumZipStatusR445'), refresh=document.getElementById('albumZipRefreshR445');
  const cache=new Map();
  const PART_SIZE=8*1024*1024;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const size=n=>{n=Number(n||0);if(!n)return '0 Б';const u=['Б','КБ','МБ','ГБ'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`};
  const auth=()=>{const h={};const k=document.getElementById('lyricsAdminKey')?.value?.trim();if(k)h['x-admin-key']=k;return h};
  const setStatus=(t,kind='')=>{status.textContent=t;status.dataset.kind=kind};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function renderAlbum(a){
    const zip=a.zip||{},tracks=a.tracks||[],sourceCount=Number(a.sourceTrackCount||a.trackCount||0),archiveCount=Number(a.trackCount||0),dupes=Number(a.duplicateCount||0);
    return `<article class="album-zip-item-r445" data-album="${esc(a.slug)}">
      <div><span class="eyeline">ANDRIK · R2</span><strong>${esc(a.label)}</strong></div>
      <div class="album-zip-stats-r445">
        <span class="album-zip-pill-r445 ok">MP3 в R2: ${sourceCount}</span>
        <span class="album-zip-pill-r445 ${archiveCount?'ok':'warn'}">В ZIP: ${archiveCount}</span>
        <span class="album-zip-pill-r445">${esc(size(a.totalBytes))}</span>
        <span class="album-zip-pill-r445 ${zip.exists?'ok':'warn'}">ZIP: ${zip.exists?esc(size(zip.size)):'нет'}</span>
      </div>
      ${dupes?`<div class="album-zip-note-r445">ℹ️ Найдено дублей по номеру трека: ${dupes}. В архив попадёт только выбранная основная версия.</div>`:''}
      <div class="album-zip-tracks-r445">${tracks.length?tracks.map((t,i)=>`<div class="album-zip-track-r445"><span>${esc(String(t.track||i+1).padStart(2,'0'))}. ${esc(t.title||t.key)}</span><span>${esc(size(t.size))}</span></div>`).join(''):'<div class="admin-empty">MP3 не найдены.</div>'}</div>
      <div class="album-zip-progress-r445" hidden><span></span></div>
      <div class="album-zip-actions-r445">
        <button class="btn album-zip-check-r445" type="button">Проверить</button>
        <button class="btn btn-primary album-zip-build-r445" type="button" ${tracks.length?'':'disabled'}>${zip.exists?'↻ Пересобрать ZIP':'📦 Собрать ZIP'}</button>
        <a class="btn album-zip-download-r445" ${zip.exists?`href="${esc(zip.downloadUrl)}"`:'aria-disabled="true"'}>${zip.exists?'⬇ Скачать готовый ZIP':'ZIP ещё не создан'}</a>
      </div>
    </article>`;
  }

  async function requestJson(url,options={}){
    const r=await fetch(url,{cache:'no-store',...options,headers:{...auth(),...(options.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||d.error||('HTTP '+r.status));
    return d;
  }

  async function load(album=''){
    setStatus(album?'Проверяем альбом в R2…':'Проверяем два альбома в R2…');
    try{
      const d=await requestJson('/api/control/music/albums'+(album?'?album='+encodeURIComponent(album):''));
      (d.albums||[]).forEach(a=>cache.set(a.slug,a));
      if(album){const current=grid.querySelector(`[data-album="${CSS.escape(album)}"]`),a=d.albums?.[0];if(current&&a)current.outerHTML=renderAlbum(a)}
      else grid.innerHTML=(d.albums||[]).map(renderAlbum).join('')||'<div class="admin-empty">Альбомы не найдены.</div>';
      const src=(d.albums||[]).reduce((s,a)=>s+Number(a.sourceTrackCount||a.trackCount||0),0),arc=(d.albums||[]).reduce((s,a)=>s+Number(a.trackCount||0),0);
      setStatus(`R2 доступен ✅ MP3 найдено: ${src}. В архивы попадёт: ${arc}.`,'ok');
      return d.albums||[];
    }catch(e){setStatus('Ошибка проверки R2: '+e.message,'error');if(!album)grid.innerHTML='<div class="admin-empty">Не удалось прочитать R2.</div>';throw e}
  }

  const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();
  const crcUpdate=(crc,bytes)=>{let c=crc>>>0;for(let i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&255]^(c>>>8);return c>>>0};
  const u16=(v,o,n)=>v.setUint16(o,n&0xffff,true),u32=(v,o,n)=>v.setUint32(o,n>>>0,true);
  function dos(date){const d=date instanceof Date&&!Number.isNaN(date.valueOf())?date:new Date(),y=Math.max(1980,Math.min(2107,d.getUTCFullYear()));return {time:((d.getUTCHours()&31)<<11)|((d.getUTCMinutes()&63)<<5)|((Math.floor(d.getUTCSeconds()/2))&31),date:(((y-1980)&127)<<9)|(((d.getUTCMonth()+1)&15)<<5)|(d.getUTCDate()&31)}}
  function localHeader(nameBytes,dt){const b=new Uint8Array(30+nameBytes.length),v=new DataView(b.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x0808);u16(v,8,0);u16(v,10,dt.time);u16(v,12,dt.date);u32(v,14,0);u32(v,18,0);u32(v,22,0);u16(v,26,nameBytes.length);u16(v,28,0);b.set(nameBytes,30);return b}
  function descriptor(crc,n){const b=new Uint8Array(16),v=new DataView(b.buffer);u32(v,0,0x08074b50);u32(v,4,crc);u32(v,8,n);u32(v,12,n);return b}
  function centralHeader(m){const b=new Uint8Array(46+m.nameBytes.length),v=new DataView(b.buffer);u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0808);u16(v,10,0);u16(v,12,m.dt.time);u16(v,14,m.dt.date);u32(v,16,m.crc);u32(v,20,m.size);u32(v,24,m.size);u16(v,28,m.nameBytes.length);u16(v,30,0);u16(v,32,0);u16(v,34,0);u16(v,36,0);u32(v,38,0);u32(v,42,m.offset);b.set(m.nameBytes,46);return b}
  function endRecord(count,centralSize,centralOffset){const b=new Uint8Array(22),v=new DataView(b.buffer);u32(v,0,0x06054b50);u16(v,4,0);u16(v,6,0);u16(v,8,count);u16(v,10,count);u32(v,12,centralSize);u32(v,16,centralOffset);u16(v,20,0);return b}

  class MultipartWriter{
    constructor(album,uploadId,partSize=PART_SIZE){this.album=album;this.uploadId=uploadId;this.partSize=partSize;this.queue=[];this.queued=0;this.offset=0;this.partNumber=1;this.parts=[]}
    _take(n){const out=new Uint8Array(n);let pos=0;while(pos<n){const first=this.queue[0],take=Math.min(first.byteLength,n-pos);out.set(first.subarray(0,take),pos);pos+=take;if(take===first.byteLength)this.queue.shift();else this.queue[0]=first.subarray(take);this.queued-=take}return out}
    async write(bytes){const u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(!u.byteLength)return;this.offset+=u.byteLength;this.queue.push(u);this.queued+=u.byteLength;while(this.queued>=this.partSize)await this.upload(this._take(this.partSize))}
    async upload(bytes){const url=`/api/control/music/albums/mpu/part?album=${encodeURIComponent(this.album)}&uploadId=${encodeURIComponent(this.uploadId)}&partNumber=${this.partNumber}`;const d=await requestJson(url,{method:'PUT',body:bytes,headers:{'content-type':'application/octet-stream'}});this.parts.push({partNumber:Number(d.partNumber),etag:String(d.etag)});this.partNumber++}
    async finish(){if(this.queued)await this.upload(this._take(this.queued));return this.parts}
  }

  async function abortMultipart(album,uploadId){if(!uploadId)return;await fetch(`/api/control/music/albums/mpu/abort?album=${encodeURIComponent(album)}&uploadId=${encodeURIComponent(uploadId)}`,{method:'DELETE',headers:auth(),cache:'no-store'}).catch(()=>null)}

  async function build(album,button){
    if(!album||button.disabled)return;
    const card=button.closest('.album-zip-item-r445'),progress=card?.querySelector('.album-zip-progress-r445'),bar=progress?.querySelector('span');
    card?.classList.add('is-building');if(progress)progress.hidden=false;if(bar)bar.style.width='1%';button.textContent='Собираем…';
    let uploadId='';
    try{
      let a=cache.get(album);if(!a){const arr=await load(album);a=arr[0]}if(!a?.tracks?.length)throw new Error('В альбоме нет MP3.');
      const start=await requestJson('/api/control/music/albums/mpu/start?album='+encodeURIComponent(album),{method:'POST'});uploadId=start.uploadId;a=start.album||a;cache.set(album,a);
      const writer=new MultipartWriter(album,uploadId,Number(start.partSize||PART_SIZE));
      const encoder=new TextEncoder(),central=[];let doneBytes=0;const total=Math.max(1,Number(a.totalBytes||0));
      for(let i=0;i<a.tracks.length;i++){
        const track=a.tracks[i],nameBytes=encoder.encode(track.entryName||`${String(i+1).padStart(2,'0')} - ${track.title||'Track'}.mp3`),dt=dos(track.uploaded?new Date(track.uploaded):new Date()),localOffset=writer.offset;
        await writer.write(localHeader(nameBytes,dt));
        setStatus(`${a.label}: ${i+1}/${a.tracks.length} · ${track.title||track.key} — читаем MP3 и считаем CRC…`);
        const r=await fetch('/api/control/music/file?key='+encodeURIComponent(track.key),{headers:auth(),cache:'no-store'});if(!r.ok)throw new Error(`Не удалось прочитать ${track.title||track.key}: HTTP ${r.status}`);if(!r.body)throw new Error('Браузер не дал поток MP3.');
        const reader=r.body.getReader();let crc=0xffffffff,fileSize=0;
        while(true){const x=await reader.read();if(x.done)break;const chunk=x.value instanceof Uint8Array?x.value:new Uint8Array(x.value);crc=crcUpdate(crc,chunk);fileSize+=chunk.byteLength;doneBytes+=chunk.byteLength;await writer.write(chunk);if(bar)bar.style.width=Math.min(94,Math.max(2,doneBytes/total*94)).toFixed(1)+'%'}
        crc=(crc^0xffffffff)>>>0;await writer.write(descriptor(crc,fileSize));central.push({nameBytes,dt,crc,size:fileSize,offset:localOffset});
      }
      const centralOffset=writer.offset;let centralSize=0;for(const meta of central){const h=centralHeader(meta);centralSize+=h.byteLength;await writer.write(h)}await writer.write(endRecord(central.length,centralSize,centralOffset));
      const parts=await writer.finish();if(!parts.length)throw new Error('ZIP не создал ни одной части.');
      setStatus(`${a.label}: загружено ${parts.length} частей ZIP. Завершаем архив в R2…`);if(bar)bar.style.width='98%';
      const complete=await requestJson(`/api/control/music/albums/mpu/complete?album=${encodeURIComponent(album)}&uploadId=${encodeURIComponent(uploadId)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({parts})});uploadId='';
      if(bar)bar.style.width='100%';setStatus(complete.message||`${a.label}: ZIP сохранён в R2 ✅`,'ok');await sleep(350);await load(album);
    }catch(e){setStatus('Ошибка сборки ZIP: '+e.message,'error');await abortMultipart(album,uploadId)}finally{card?.classList.remove('is-building');button.textContent='📦 Собрать ZIP'}
  }

  refresh?.addEventListener('click',()=>load().catch(()=>{}));
  grid?.addEventListener('click',e=>{const card=e.target.closest('[data-album]');if(!card)return;const album=card.dataset.album;if(e.target.closest('.album-zip-check-r445'))load(album).catch(()=>{});const b=e.target.closest('.album-zip-build-r445');if(b)build(album,b)});
  setTimeout(()=>load().catch(()=>{}),350);
})();
