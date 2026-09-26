/* ANDRIK R1168 — direct ZIP uploader for album / covers archives. */
(()=>{'use strict';
 const file=document.getElementById('archiveFileR1168'),choose=document.getElementById('archiveChooseR1168'),upload=document.getElementById('archiveUploadBtnR1168'),sel=document.getElementById('archiveAlbumR1168'),status=document.getElementById('archiveStatusR1168'),bar=document.getElementById('archiveProgressR1168');
 if(!file||!choose||!upload||!sel||!status)return;
 const auth=()=>{const h={};const k=document.getElementById('lyricsAdminKey')?.value?.trim();if(k)h['x-admin-key']=k;return h};
 const fmt=n=>{const u=['Б','КБ','МБ','ГБ'];let i=0,x=Number(n||0);while(x>=1024&&i<3){x/=1024;i++}return `${x.toFixed(i?1:0)} ${u[i]}`};
 const json=async(url,opt={})=>{const r=await fetch(url,{cache:'no-store',...opt,headers:{...auth(),...(opt.headers||{})}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||`HTTP ${r.status}`);return d};
 choose.onclick=()=>file.click();
 file.onchange=()=>{const f=file.files?.[0];upload.disabled=!f;status.textContent=f?`${f.name} · ${fmt(f.size)} · готов к загрузке`:'Файл не выбран.'};
 upload.onclick=async()=>{const f=file.files?.[0];if(!f)return; if(!/\.zip$/i.test(f.name)){status.textContent='Нужен ZIP-архив.';return} upload.disabled=true;choose.disabled=true;let id='';try{
   status.textContent=`${sel.options[sel.selectedIndex].text}: начинаем загрузку…`;bar.style.width='2%';
   const start=await json(`/api/control/music/albums/mpu/start?album=${encodeURIComponent(sel.value)}&direct=1`,{method:'POST'});id=start.uploadId;const partSize=Number(start.partSize||8*1024*1024),parts=[];let off=0,num=1;
   while(off<f.size){const end=Math.min(f.size,off+partSize),blob=f.slice(off,end);const d=await json(`/api/control/music/albums/mpu/part?album=${encodeURIComponent(sel.value)}&uploadId=${encodeURIComponent(id)}&partNumber=${num}`,{method:'PUT',body:blob,headers:{'content-type':'application/octet-stream'}});parts.push({partNumber:Number(d.partNumber),etag:String(d.etag)});off=end;num++;bar.style.width=Math.max(2,Math.min(96,off/f.size*96)).toFixed(1)+'%';status.textContent=`Загружено ${fmt(off)} из ${fmt(f.size)}…`}
   const done=await json(`/api/control/music/albums/mpu/complete?album=${encodeURIComponent(sel.value)}&uploadId=${encodeURIComponent(id)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({parts})});id='';bar.style.width='100%';status.textContent=(done.message||'Архив сохранён в R2')+' 📦';
 }catch(e){status.textContent='Ошибка: '+e.message;if(id)fetch(`/api/control/music/albums/mpu/abort?album=${encodeURIComponent(sel.value)}&uploadId=${encodeURIComponent(id)}`,{method:'DELETE',headers:auth()}).catch(()=>{})}finally{upload.disabled=!file.files?.[0];choose.disabled=false}}
})();
