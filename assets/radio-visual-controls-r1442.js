(()=>{'use strict';
const slots=['illusion','ocean','trika','beyond','silent'];
const fmt=n=>(Number(n||0)/1048576).toFixed(1)+' МБ';
let settings=null,busy=false;
function auth(){let key=String(document.getElementById('key')?.value||'').trim();if(!key){try{key=localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||sessionStorage.getItem('andrik-radio-visuals-key-r620')||''}catch(_){}}return key?{'x-admin-key':key,'authorization':'Bearer '+key}:{}}
async function api(path,options={}){const r=await fetch(path,{cache:'no-store',credentials:'include',...options,headers:{accept:'application/json',...auth(),...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.message||d.error||('HTTP '+r.status));return d}
const message=(el,text,kind='')=>{if(el){el.textContent=text;el.dataset.kind=kind}};
function render(data){
 settings=data;
 document.querySelectorAll('[data-r1442-ticker-switch]').forEach(button=>{button.disabled=false;button.setAttribute('aria-checked',String(data.ticker.enabled));button.querySelector('[data-r1442-switch-label]').textContent=data.ticker.enabled?'Строка включена':'Строка выключена'});
 document.querySelectorAll('[data-r1442-ticker-state]').forEach(el=>{el.textContent=data.ticker.enabled?'ВКЛ':'ВЫКЛ';el.classList.toggle('r1442-state-off',!data.ticker.enabled)});
 document.querySelectorAll('[data-r1442-ticker-style]').forEach(select=>{select.disabled=false;select.value=data.ticker.albumStyle});
 for(const slot of slots){
  const area=document.querySelector(`[data-r1442-album="${slot}"]`);if(!area)continue;
  const item=data.albums[slot],select=area.querySelector('[data-r1442-kind]');select.disabled=false;select.value=item.kind;
  area.querySelector('[data-r1442-preview]').disabled=!item.video.exists;
  area.querySelector('[data-r1442-delete]').disabled=!item.video.exists;
  const summary=area.querySelector('[data-r1442-summary]');
  summary.textContent=(item.kind==='video'?'Выбрано видео':'Выбрано изображение')+(item.video.exists?' · MP4 загружен, '+fmt(item.video.size):' · MP4 ещё не загружен');
 }
}
async function load(){if(busy)return;try{render(await api('/api/radio/visual-settings-r1442'))}catch(error){document.querySelectorAll('[data-r1442-message]').forEach(el=>message(el,'Настройки недоступны: '+error.message,'error'))}}
async function save(value,el){if(busy)return;busy=true;message(el,'Сохраняю…');try{const data=await api('/api/control/radio-visual-settings-r1442',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(value)});render(data);const text=value.album&&data.albumMode==='studio'?'Выбор сохранён. Сверху включи «Фоны альбомов», чтобы использовать этот фон.':value.albumTicker&&data.albumMode==='studio'?'Стиль сохранён для режима «Фоны альбомов». Сейчас включена студия.':'Сохранено. Применится с начала следующей песни или клипа.';message(el,text,'ok')}catch(error){if(settings)render(settings);message(el,error.message,'error')}finally{busy=false}}
document.querySelectorAll('[data-r1442-ticker-switch]').forEach(button=>{button.addEventListener('click',()=>{if(!settings||busy)return;button.disabled=true;save({tickerEnabled:!settings.ticker.enabled},button.closest('.r1442-ticker-control').querySelector('[data-r1442-message]'))})});
document.querySelectorAll('[data-r1442-ticker-style]').forEach(select=>select.addEventListener('change',()=>save({albumTicker:select.value},select.closest('.r1442-ticker-control').querySelector('[data-r1442-message]'))));
for(const slot of slots){
 const card=document.querySelector(`[data-bg-slot="${slot}"]`);if(!card)continue;
 const area=document.createElement('div');area.className='r1442-album';area.dataset.r1442Album=slot;
 area.innerHTML=`<label>Фон этого альбома<select data-r1442-kind disabled aria-label="Тип фона альбома"><option value="image">Изображение PNG / JPG / WebP</option><option value="video">Зацикленное видео · 8 секунд</option></select></label><div class="small" data-r1442-summary>Загружаю настройки…</div><input type="file" data-r1442-file accept="video/mp4,.mp4" aria-label="MP4 для альбома"><button type="button" data-r1442-upload>⬆ Загрузить видео этого альбома</button><div class="r1442-clip-actions"><button type="button" class="secondary" data-r1442-preview disabled>Посмотреть видео</button><button type="button" class="secondary" data-r1442-delete disabled>Удалить видео</button></div><video data-r1442-video muted loop playsinline controls preload="none" hidden></video><div class="progress"><div class="bar" data-r1442-bar></div></div><p class="r1442-control-note">MP4, около 8 секунд, желательно 1920×1080 и 25 fps. Максимум 32 МБ. Изображение сохраняется отдельно: к нему можно вернуться.</p><div class="r1442-status" data-r1442-message role="status" aria-live="polite"></div>`;
 card.append(area);
 const select=area.querySelector('[data-r1442-kind]'),msg=area.querySelector('[data-r1442-message]'),file=area.querySelector('[data-r1442-file]'),upload=area.querySelector('[data-r1442-upload]'),bar=area.querySelector('[data-r1442-bar]'),video=area.querySelector('video');
 select.addEventListener('change',()=>save({album:{slot,kind:select.value}},msg));
 upload.addEventListener('click',()=>{
  if(busy)return;const f=file.files?.[0];
  if(!f){message(msg,'Выбери MP4 для этого альбома.','error');return}
  if(!/\.mp4$/i.test(f.name)||f.size>32*1048576){message(msg,'Нужен MP4 размером до 32 МБ.','error');return}
  busy=true;upload.disabled=true;bar.style.width='0%';message(msg,'Загружаю видео…');
  const xhr=new XMLHttpRequest();xhr.open('PUT','/api/control/radio-album-loops-r1442?slot='+slot);xhr.withCredentials=true;xhr.timeout=180000;xhr.setRequestHeader('content-type','video/mp4');for(const [key,value] of Object.entries(auth()))xhr.setRequestHeader(key,value);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)bar.style.width=Math.round(e.loaded/e.total*100)+'%'};
  const finish=()=>{busy=false;upload.disabled=false};
  xhr.onerror=xhr.ontimeout=()=>{finish();message(msg,'Загрузка не завершена. Проверь связь и повтори.','error')};
  xhr.onload=async()=>{try{let data={};try{data=JSON.parse(xhr.responseText||'{}')}catch(_){}if(xhr.status<200||xhr.status>=300||!data.ok)throw Error(data.message||data.error||('HTTP '+xhr.status));bar.style.width='100%';file.value='';video.pause();video.hidden=true;video.removeAttribute('src');message(msg,'Видео загружено. Выбери «Зацикленное видео». Оно включится после подготовки, со следующей песни этого альбома.','ok')}catch(error){message(msg,error.message,'error')}finally{finish();await load()}};
  xhr.send(f);
 });
 area.querySelector('[data-r1442-preview]').addEventListener('click',()=>{if(!settings?.albums[slot]?.video.exists)return;if(!video.hidden){video.pause();video.hidden=true;return}video.src='/api/media/radio-album-loop-r1442?slot='+slot+'&v='+encodeURIComponent(settings.albums[slot].video.etag||'');video.hidden=false;video.load();video.play().catch(()=>{})});
 area.querySelector('[data-r1442-delete]').addEventListener('click',async()=>{if(busy||!confirm('Удалить видео этого альбома и выбрать изображение?'))return;busy=true;try{await api('/api/control/radio-album-loops-r1442?slot='+slot,{method:'DELETE'});video.pause();video.hidden=true;video.removeAttribute('src');message(msg,'Видео удалено. Изображение включится со следующей песни альбома.','ok')}catch(error){message(msg,error.message,'error')}finally{busy=false;await load()}});
}
document.getElementById('useKey')?.addEventListener('click',()=>setTimeout(load,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setInterval(()=>{if(!document.hidden)load()},15000);load();
})();
