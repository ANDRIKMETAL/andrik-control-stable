(()=>{'use strict';
const root=document.getElementById('radioScheduleR1517');if(!root)return;
const $=id=>root.querySelector(`[data-r1517="${id}"]`);
const slots=[['illusion','1 · ILLUSION'],['ocean','2 · OCEAN'],['trika','3 · TRIKA'],['beyond','4 · BEYOND'],['silent','5 · SILENT'],['no-one-to-become','6 · NO ONE TO BECOME']];
let model=null;
const ui={};
function html(){
 root.innerHTML=`<p>Сервер в Словакии будет запускать и завершать эфиры без телефона. Время — Europe/Bratislava (летнее и зимнее автоматически).</p>
 <div class="r1517-modes"><label class="r1517-mode"><input name="r1517-mode" value="always" type="radio">♾️ Круглосуточный эфир</label><label class="r1517-mode"><input name="r1517-mode" value="timed" type="radio">⏰ Автоматический по часам</label></div>
 <div class="r1517-sessions" data-r1517="sessions"></div>
 <p>📱 <b>16:9 + 9:16:</b> в YouTube Studio → Начать эфир → Dual Stream установи вертикальный режим «Auto». YouTube сам сделает вертикальную версию из горизонтальной без второго кодировщика на VPS. Эта настройка YouTube не переключается данным расписанием. <a class="r1517-ytlink" href="https://studio.youtube.com/" target="_blank" rel="noopener">Открыть YouTube Studio</a>.</p>
 <p>💾 Для архива каждый сеанс создаётся как отдельное публичное LIVE-видео, с записью и DVR. После окончания сервер отправляет YouTube команду завершения. Архив не гарантирует зачётные часы до обработки YouTube.</p>
 <button class="r1517-save" type="button" data-r1517="save">💾 СОХРАНИТЬ РЕЖИМ И РАСПИСАНИЕ</button>
 <div class="r1517-status" data-r1517="message" role="status" aria-live="polite">Загружаю расписание…</div>`;
 root.querySelectorAll('input[name="r1517-mode"]').forEach(i=>i.addEventListener('change',()=>{model.mode=i.value;drawMode()}));
 $('save').addEventListener('click',save);
}
function sessionUI(session){
 const el=document.createElement('div');el.className='r1517-session';el.dataset.slot=session.id;
 el.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3>${session.id==='day'?'☀️ Дневной эфир':'🌙 Вечерний эфир'}</h3><label class="r1517-on"><input type="checkbox" data-field="enabled">Включён</label></div>
 <div class="r1517-clock"><label>Начало<input type="time" data-field="start" step="60"></label><label>Завершение<input type="time" data-field="end" step="60"></label></div>
 <div class="r1517-hint">Альбомы в этом эфире (можно менять). Клипы остаются общими:</div><div class="r1517-albums"></div>
 <label class="r1517-on"><input data-field="clips" type="checkbox">Включать музыкальные клипы</label>
 <details class="r1517-meta"><summary style="margin:10px 0;cursor:pointer">✏️ Название и описание отдельного эфира</summary><label>Название YouTube (до 100 символов)<input maxlength="100" data-field="title"></label><label style="margin-top:8px">Описание YouTube<textarea maxlength="5000" data-field="description" rows="3"></textarea></label></details>`;
 el.querySelector('.r1517-albums').replaceChildren(...slots.map(([id,name])=>{const lab=document.createElement('label');lab.className='r1517-album';const inp=document.createElement('input');inp.type='checkbox';inp.dataset.album=id;inp.checked=session.albums.includes(id);lab.append(inp,document.createTextNode(name));return lab}));
 for(const field of ['enabled','clips','start','end','title','description']){const i=el.querySelector(`[data-field="${field}"]`);if(i.type==='checkbox')i.checked=!!session[field];else i.value=session[field]||''}
 return el;
}
function drawMode(){const panel=$('sessions');panel.hidden=model.mode!=='timed';root.querySelectorAll('input[name="r1517-mode"]').forEach(i=>i.checked=i.value===model.mode)}
function draw(){
 $('sessions').replaceChildren(...model.sessions.map(sessionUI));drawMode();
}
function msg(value,kind=''){const el=$('message');el.textContent=value;el.dataset.kind=kind}
function gather(){
 const sessions=[...root.querySelectorAll('.r1517-session')].map(el=>{
 const o={id:el.dataset.slot,albums:[...el.querySelectorAll('[data-album]:checked')].map(x=>x.dataset.album)};
 for(const f of ['enabled','clips','start','end','title','description']){const input=el.querySelector(`[data-field="${f}"]`);o[f]=input.type==='checkbox'?input.checked:input.value.trim()}
 return o;
 });return {mode:model.mode,portrait:'auto',timeZone:'Europe/Bratislava',sessions};
}
async function api(method,body){
 const auth=window.AndrikRadioVisualAuth;
 if(method!=='GET')await auth?.ensure?.();
 const res=await fetch('/api/control/radio-schedule-r1517',{method,credentials:'include',cache:'no-store',headers:{accept:'application/json',...(auth?.headers?.()||{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw Error(auth?.error?.(data,res.status)||data.error||'Ошибка связи с сервером');return data;
}
async function load(){try{const data=await api('GET');model=data.schedule;draw();const info=data.session;
 msg(info?.videoId?`Текущий/последний сеанс: ${info.id} · YouTube ID: ${info.videoId} · статус: ${info.status||'—'}`:'Расписание загружено. Для автоматического выполнения установи VPS R1517.','ok');
 }catch(e){msg('Не удалось получить расписание: '+e.message,'error')}}
async function save(){const button=$('save');if(!model||button.disabled)return;button.disabled=true;msg('Сохраняю настройки…');
 try{const data=await api('PUT',gather());model=data.schedule;draw();msg('✅ Сохранено! VPS применит расписание в течение следующей минуты. Для переключения формата 9:16 проверь Dual Stream в YouTube Studio.','ok')}
 catch(e){msg('❌ Не сохранено: '+e.message,'error')}
 finally{button.disabled=false}}
html();load();
})();
