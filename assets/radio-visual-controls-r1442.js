(()=>{'use strict';
const slots=['illusion','ocean','trika','beyond','silent','extras'];
const fmt=n=>(Number(n||0)/1048576).toFixed(1)+' МБ';
let settings=null,busy=false,loading=false;let pingPong=null,pingPongFresh=false;
function auth(){return window.AndrikRadioVisualAuth?.headers()||{}}
const authError=(data,status)=>window.AndrikRadioVisualAuth?.error(data,status)||data.message||data.error||('HTTP '+status);
async function api(path,options={}){const r=await fetch(path,{cache:'no-store',credentials:'include',...options,headers:{accept:'application/json',...auth(),...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(authError(d,r.status));return d}
const message=(el,text,kind='')=>{if(el){el.textContent=text;el.dataset.kind=kind}};
function render(data){
 settings=data;
 document.querySelectorAll('[data-r1442-ticker-switch]').forEach(button=>{button.disabled=false;button.setAttribute('aria-checked',String(data.ticker.enabled));button.querySelector('[data-r1442-switch-label]').textContent=data.ticker.enabled?'Строка включена':'Строка выключена'});
 document.querySelectorAll('[data-r1442-ticker-state]').forEach(el=>{el.textContent=data.ticker.enabled?'ВКЛ':'ВЫКЛ';el.classList.toggle('r1442-state-off',!data.ticker.enabled)});
 document.querySelectorAll('[data-r1442-ticker-style]').forEach(select=>{select.disabled=false;select.value=data.ticker.albumStyle});
 for(const slot of slots){
  const area=document.querySelector(`[data-r1442-album="${slot}"]`);if(!area)continue;
  const item=data.albums[slot]||{kind:'image',video:{exists:false}},select=area.querySelector('[data-r1442-kind]');select.disabled=false;select.value=item.kind;
  area.querySelector('[data-r1442-preview]').disabled=!item.video.exists;
  area.querySelector('[data-r1442-delete]').disabled=!item.video.exists;
  const summary=area.querySelector('[data-r1442-summary]');
  summary.textContent=(item.kind==='video'?'Выбрано видео':'Выбрано изображение')+(item.video.exists?' · MP4 загружен, '+fmt(item.video.size):' · MP4 ещё не загружен');
 }
}
function renderPingPong(){
 for(const slot of slots){const el=document.querySelector(`[data-r1442-album="${slot}"] [data-r1473-loop-state]`);if(!el)continue;el.hidden=false;const item=settings?.albums?.[slot],row=pingPong?.albums?.[slot];
  if(item?.kind!=='video'||!item.video?.exists){el.textContent='';el.hidden=true;continue;}
  if(slot!=='extras'&&settings?.albumMode==='studio'){el.textContent='Чтобы использовать этот ролик, сверху выбери «Фоны альбомов».';continue;}
  if(!pingPongFresh){el.textContent='Нет свежих данных о подготовке с сервера.';continue;}
  if(!row){el.textContent='Для автоматического обратного прохода нужен патч VPS R1473.';continue;}
  el.dataset.kind='';if(row.etag!==item.video.etag){el.textContent='Новый ролик ожидает подготовки прохода вперёд-назад.';continue;}
  if(row.phase==='ready'&&row.readyEtag===item.video.etag){const n=Number(row.inputSeconds||0),out=Number(row.outputSeconds||0),fmt=v=>Number.isInteger(v)?String(v):v.toFixed(2);el.textContent=`✓ Луп готов: ${fmt(n)} с вперёд + ${fmt(n)} с назад = ${fmt(out)} с. Включится с начала песни.`;el.dataset.kind='ok';}
  else if(row.phase==='error'){el.textContent='Подготовка отложена: '+String(row.error||'не удалось подготовить видео')+'. Старый фон сохранён.';el.dataset.kind='error';}
  else if(row.phase==='waiting'){el.textContent='Подготовка ждёт свободной нагрузки. Старый фон остаётся в эфире.';el.dataset.kind='';}
  else if(['normalize','reverse','verify','download'].includes(row.phase)){el.textContent='Готовлю проход вперёд-назад · '+Math.max(0,Math.min(100,Number(row.progress)||0))+'%. Старый фон остаётся в эфире.';el.dataset.kind='';}
  else{el.textContent='Ролик ожидает подготовки прохода вперёд-назад. Старый фон сохранён.';el.dataset.kind='';}
 }
}
async function load(){if(busy||loading)return;loading=true;try{const result=await Promise.allSettled([api('/api/radio/visual-settings-r1442'),api('/api/control/radio-remote-r627/status')]);if(result[0].status==='rejected')throw result[0].reason;const remote=result[1].status==='fulfilled'?result[1].value:null,live=remote?.agent?.status;pingPong=live?.albumPingPongR1473||live?.diagnosticsR803?.albumPingPongR1473||live?.diagnosticsR802?.albumPingPongR1473||null;pingPongFresh=!!remote?.online&&Date.now()-Date.parse(remote?.agent?.lastSeen||'')<90000;render(result[0].value);renderPingPong();}catch(error){document.querySelectorAll('[data-r1442-message]').forEach(el=>message(el,'Настройки недоступны: '+error.message,'error'))}finally{loading=false}}
async function save(value,el){if(busy)return;busy=true;message(el,'Сохраняю…');try{const data=await api('/api/control/radio-visual-settings-r1442',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(value)});render(data);const text=value.album&&value.album.slot!=='extras'&&data.albumMode==='studio'?'Выбор сохранён. Сверху включи «Фоны альбомов», чтобы использовать этот фон.':value.albumTicker&&data.albumMode==='studio'?'Стиль сохранён для режима «Фоны альбомов». Сейчас включена студия.':'Сохранено. Применится с начала следующей песни или клипа.';message(el,text,'ok')}catch(error){if(settings)render(settings);message(el,error.message,'error')}finally{busy=false}}
document.querySelectorAll('[data-r1442-ticker-switch]').forEach(button=>{button.addEventListener('click',()=>{if(!settings||busy)return;button.disabled=true;save({tickerEnabled:!settings.ticker.enabled},button.closest('.r1442-ticker-control').querySelector('[data-r1442-message]'))})});
document.querySelectorAll('[data-r1442-ticker-style]').forEach(select=>select.addEventListener('change',()=>save({albumTicker:select.value},select.closest('.r1442-ticker-control').querySelector('[data-r1442-message]'))));
for(const slot of slots){
 const card=document.querySelector(`[data-bg-slot="${slot}"]`);if(!card)continue;
 const area=document.createElement('div');area.className='r1442-album';area.dataset.r1442Album=slot;
 area.innerHTML=`<label>Фон этого раздела<select data-r1442-kind disabled aria-label="Тип фона раздела"><option value="image">Изображение PNG / JPG / WebP</option><option value="video">Видео ↔ вперёд-назад</option></select></label><div class="small" data-r1442-summary>Загружаю настройки…</div><input type="file" data-r1442-file accept="video/mp4,.mp4" aria-label="MP4 для раздела"><button type="button" data-r1442-upload>⬆ Загрузить видео этого раздела</button><div class="r1442-clip-actions"><button type="button" class="secondary" data-r1442-preview disabled>Посмотреть исходник</button><button type="button" class="secondary" data-r1442-delete disabled>Удалить видео</button></div><video data-r1442-video muted loop playsinline controls preload="none" hidden></video><div class="progress"><div class="bar" data-r1442-bar></div></div><p class="r1442-control-note">Загрузи обычный MP4 от 1 до 16 секунд без обратного прохода, до 32 МБ. Сервер с патчем R1473 один раз добавит обратное движение: 16 с вперёд + 16 с назад = 32 с. Для 8-секундного исходника получится 8+8. Пока идёт подготовка, в эфире остаётся прежний фон. Изображение сохраняется отдельно.</p><p class="r1442-status" data-r1473-loop-state role="status" hidden></p><div class="r1442-status" data-r1442-message role="status" aria-live="polite"></div>`;
 card.append(area);
 const select=area.querySelector('[data-r1442-kind]'),msg=area.querySelector('[data-r1442-message]'),file=area.querySelector('[data-r1442-file]'),upload=area.querySelector('[data-r1442-upload]'),bar=area.querySelector('[data-r1442-bar]'),video=area.querySelector('video');
 select.addEventListener('change',()=>save({album:{slot,kind:select.value}},msg));
 upload.addEventListener('click',async()=>{
  if(busy)return;const f=file.files?.[0];
  if(!f){message(msg,'Выбери MP4 для этого раздела.','error');return}
  if(!/\.mp4$/i.test(f.name)||f.size>32*1048576){message(msg,'Нужен MP4 размером до 32 МБ.','error');return}
  busy=true;upload.disabled=true;bar.style.width='0%';message(msg,'Загружаю видео…');
  try{await window.AndrikRadioVisualAuth?.ensure()}catch(error){busy=false;upload.disabled=false;message(msg,error.message,'error');return}
  const xhr=new XMLHttpRequest();xhr.open('PUT','/api/control/radio-album-loops-r1442?slot='+slot);xhr.withCredentials=true;xhr.timeout=180000;xhr.setRequestHeader('content-type','video/mp4');for(const [key,value] of Object.entries(auth()))xhr.setRequestHeader(key,value);
  xhr.upload.onprogress=e=>{if(e.lengthComputable)bar.style.width=Math.round(e.loaded/e.total*100)+'%'};
  const finish=()=>{busy=false;upload.disabled=false};
  xhr.onerror=xhr.ontimeout=()=>{finish();bar.style.width='0%';message(msg,'Загрузка не завершена. Проверь связь и повтори.','error')};
  xhr.onload=async()=>{try{let data={};try{data=JSON.parse(xhr.responseText||'{}')}catch(_){}if(xhr.status<200||xhr.status>=300||!data.ok)throw Error(authError(data,xhr.status));bar.style.width='100%';file.value='';video.pause();video.hidden=true;video.removeAttribute('src');message(msg,'Исходник загружен. Выбери «Видео ↔ вперёд-назад». После подготовки сервер включит готовый луп с начала песни этого раздела.','ok')}catch(error){bar.style.width='0%';message(msg,error.message,'error')}finally{finish();await load()}};
  xhr.send(f);
 });
 area.querySelector('[data-r1442-preview]').addEventListener('click',()=>{if(!settings?.albums[slot]?.video.exists)return;if(!video.hidden){video.pause();video.hidden=true;return}video.src='/api/media/radio-album-loop-r1442?slot='+slot+'&v='+encodeURIComponent(settings.albums[slot].video.etag||'');video.hidden=false;video.load();video.play().catch(()=>{})});
 area.querySelector('[data-r1442-delete]').addEventListener('click',async()=>{if(busy||!confirm('Удалить видео этого раздела и выбрать изображение?'))return;busy=true;try{await api('/api/control/radio-album-loops-r1442?slot='+slot,{method:'DELETE'});video.pause();video.hidden=true;video.removeAttribute('src');message(msg,'Видео удалено. Изображение включится со следующей песни этого раздела.','ok')}catch(error){message(msg,error.message,'error')}finally{busy=false;await load()}});
}
document.getElementById('useKey')?.addEventListener('click',()=>setTimeout(load,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
setInterval(()=>{if(!document.hidden)load()},15000);load();
})();
