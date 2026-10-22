/* R1483: validate ZIP/CRC/SHA on the device; send STORE entries to the Worker. */
(() => {
  'use strict';
  const MAX_ZIP = 25*1024*1024, MAX_TOTAL = 40*1024*1024, MAX_FILE = 10*1024*1024, MAX_FILES = 1200;
  const MANIFEST = 'site-update-manifest-r1223.json', encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
  let table;
  function crc32(bytes) {
    if (!table) {
      table = new Uint32Array(256);
      for (let n=0;n<256;n++) { let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0; }
    }
    let crc=0xffffffff;
    for(let i=0;i<bytes.length;i++)crc=table[(crc^bytes[i])&255]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }
  function pathName(raw) {
    const path=String(raw).replace(/\\/g,'/').replace(/^\.\//,'');
    if(!path||path.startsWith('/')||path.length>260||path.split('/').some(part=>!part||part==='.'||part==='..'||/[\x00-\x1f\x7f]/.test(part)))throw new Error('В ZIP найден недопустимый путь.');
    return path;
  }
  const ignored = path => /(^|\/)(\.DS_Store|Thumbs\.db)$/.test(path)||/^(?:__MACOSX|\.git|node_modules|_inline_check[23]?)\//.test(path)||/(?:^|\/)R\d{1,6}-REPORT\.txt$/i.test(path)||/\.err$/i.test(path);
  function safeFile(path) {
    const base=path.split('/').pop();
    if(/^\.env(?:\.|$)|^\.dev\.vars$|^(?:id_rsa|id_ed25519|credentials|secrets|service-account)(?:\.|$)|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(base))throw new Error('ZIP содержит секретный файл: '+path);
  }
  async function inflate(bytes, limit) {
    let stream;
    try { stream=new DecompressionStream('deflate-raw'); }
    catch (_) { throw new Error('Этот браузер не умеет распаковывать сжатый ZIP. Выбери INSTALL.zip без сжатия.'); }
    const reader=new Blob([bytes]).stream().pipeThrough(stream).getReader(), chunks=[];
    let total=0;
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>limit||total>MAX_FILE){await reader.cancel();throw new Error('Файл в ZIP превышает объявленный размер.');}
      chunks.push(value);
    }
    const output=new Uint8Array(total);let offset=0;
    for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength;}
    return output;
  }
  async function readZip(file, onProgress) {
    if(file.size<22||file.size>MAX_ZIP)throw new Error('Нужен обычный ZIP размером до 25 МБ.');
    const bytes=new Uint8Array(await file.arrayBuffer()), view=new DataView(bytes.buffer);
    let eocd=-1;
    for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){eocd=p;break;}
    if(eocd<0)throw new Error('Файл не распознан как целый ZIP.');
    if(view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true))throw new Error('Многотомные ZIP не поддерживаются.');
    const count=view.getUint16(eocd+10,true), centralSize=view.getUint32(eocd+12,true), centralStart=view.getUint32(eocd+16,true);
    if(!count||count>MAX_FILES||count!==view.getUint16(eocd+8,true)||centralStart+centralSize>eocd)throw new Error('Некорректный каталог ZIP.');
    let offset=centralStart,total=0,compressed=false,skipped=false;
    const entries=[],seen=new Set();
    for(let index=0;index<count;index++) {
      if(offset+46>eocd||view.getUint32(offset,true)!==0x02014b50)throw new Error('Повреждён каталог ZIP.');
      const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true),crc=view.getUint32(offset+16,true),size=view.getUint32(offset+20,true),unpacked=view.getUint32(offset+24,true),nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),attributes=view.getUint32(offset+38,true),local=view.getUint32(offset+42,true);
      if([size,unpacked,local].includes(0xffffffff))throw new Error('ZIP64 не поддерживается. Нужен обычный ZIP.');
      const nameStart=offset+46,nameEnd=nameStart+nameLength,next=nameEnd+extraLength+commentLength;
      if(next>centralStart+centralSize)throw new Error('Повреждено имя файла ZIP.');
      let raw;
      try{raw=decoder.decode(bytes.subarray(nameStart,nameEnd));}catch(_){throw new Error('Имена файлов ZIP должны быть в UTF-8.');}
      offset=next;
      if(raw.endsWith('/')){skipped=true;continue;}
      const path=pathName(raw);
      if(ignored(path)){skipped=true;continue;}
      safeFile(path);
      if(seen.has(path))throw new Error('Повторяющийся файл в ZIP: '+path);seen.add(path);
      if(((attributes>>>16)&0xf000)===0xa000)throw new Error('Символические ссылки в ZIP запрещены.');
      if(flags&1)throw new Error('ZIP с паролем не поддерживается.');
      if(method!==0&&method!==8)throw new Error('Поддерживаются только обычные ZIP: STORE или DEFLATE.');
      total+=unpacked;
      if(unpacked>MAX_FILE||total>MAX_TOTAL)throw new Error('Слишком большой размер после распаковки ZIP.');
      if(local+30>centralStart||view.getUint32(local,true)!==0x04034b50)throw new Error('Повреждён заголовок файла: '+path);
      const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),end=start+size;
      if(start>centralStart||end>centralStart||view.getUint16(local+8,true)!==method)throw new Error('Повреждены границы файла ZIP: '+path);
      const content=method===8?await inflate(bytes.subarray(start,end),unpacked):bytes.subarray(start,end);
      compressed ||= method===8;
      if(content.byteLength!==unpacked||crc32(content)!==crc)throw new Error('Не совпала контрольная сумма CRC: '+path);
      entries.push({path,bytes:content,crc});
      if(index%24===0){onProgress(`Проверка на устройстве: ${index+1}/${count} файлов…`);await new Promise(resolve=>setTimeout(resolve,0));}
    }
    let stripped=false;
    if(!entries.some(entry=>entry.path==='index.html')&&entries.length) {
      const prefix=entries[0].path.split('/')[0]+'/';
      if(entries.every(entry=>entry.path.startsWith(prefix))&&entries.some(entry=>entry.path===prefix+'index.html')){
        for(const entry of entries){entry.path=pathName(entry.path.slice(prefix.length));safeFile(entry.path);}
        stripped=true;
      }
    }
    if(!['index.html','_worker.js','service-worker.js'].every(path=>entries.some(entry=>entry.path===path)))throw new Error('В ZIP должны быть index.html, _worker.js и service-worker.js полного сайта.');
    return {entries,compressed,changed:skipped||stripped};
  }
  async function gitSha(bytes) {
    const header=encoder.encode(`blob ${bytes.length}\0`),data=new Uint8Array(header.length+bytes.length);
    data.set(header);data.set(bytes,header.length);
    return [...new Uint8Array(await crypto.subtle.digest('SHA-1',data))].map(value=>value.toString(16).padStart(2,'0')).join('');
  }
  async function verifyManifest(entries, onProgress) {
    const entry=entries.find(item=>item.path===MANIFEST);
    let manifest=null;
    if(entry){try{manifest=JSON.parse(decoder.decode(entry.bytes));}catch(_){throw new Error('Не читается манифест контрольных сумм ZIP.');}}
    if(manifest&&(manifest.schema!==1||manifest.algorithm!=='git-blob-sha1'||!manifest.files))throw new Error('Неподдерживаемый манифест ZIP.');
    const files={}, ordinary=entries.filter(item=>item.path!==MANIFEST);
    for(let i=0;i<ordinary.length;i++){
      const item=ordinary[i],sha=await gitSha(item.bytes),meta=manifest?.files[item.path];
      if(manifest&&(Number(meta?.size)!==item.bytes.length||meta?.sha!==sha))throw new Error('Не совпала контрольная сумма SHA-1: '+item.path);
      files[item.path]={size:item.bytes.length,sha};
      if(i%32===0){onProgress(`Контрольные суммы: ${i+1}/${ordinary.length} файлов…`);await new Promise(resolve=>setTimeout(resolve,0));}
    }
    if(entry)return false;
    const bytes=encoder.encode(JSON.stringify({schema:1,algorithm:'git-blob-sha1',files}));
    entries.push({path:MANIFEST,bytes,crc:crc32(bytes)});return true;
  }
  function packStore(entries, filename) {
    const parts=[],central=[];let offset=0,centralSize=0;
    for(const item of entries){
      const name=encoder.encode(item.path),length=item.bytes.length,local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,item.crc,true);v.setUint32(18,length,true);v.setUint32(22,length,true);v.setUint16(26,name.length,true);local.set(name,30);
      const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);
      d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,item.crc,true);d.setUint32(20,length,true);d.setUint32(24,length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);
      parts.push(local,item.bytes);central.push(directory);offset+=local.length+length;centralSize+=directory.length;
    }
    const end=new Uint8Array(22),v=new DataView(end.buffer);
    v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    const output=new File([...parts,...central,end],filename,{type:'application/zip'});
    if(output.size>MAX_ZIP)throw new Error('После подготовки ZIP больше 25 МБ. Нужен компактный полный архив сайта.');
    return output;
  }
  async function prepare(file,{onProgress=()=>{}}={}) {
    onProgress('Распаковка и проверка ZIP на устройстве…');
    const parsed=await readZip(file,onProgress);
    const added=await verifyManifest(parsed.entries,onProgress);
    const output=parsed.compressed||parsed.changed||added?packStore(parsed.entries,file.name):file;
    onProgress(`CRC и SHA-1 проверены · ${parsed.entries.length} файлов. Сравниваем с GitHub…`);
    return output;
  }
  window.AndrikZipPreflightR1483={prepare};
})();
