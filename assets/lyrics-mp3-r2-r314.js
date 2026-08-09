(()=>{'use strict';
const $=id=>document.getElementById(id), file=$('mp3R2File'), choose=$('mp3R2Choose'), copy=$('mp3R2Copy'), del=$('mp3R2Delete'), status=$('mp3R2Status'), badge=$('mp3R2Badge'), card=$('mp3R2Card');
if(!card)return;
let currentUrl='', currentKey='', latestKey='', latestUrl='', latestTitle='';

function headers(extra={}){const h={...extra};const k=$('lyricsAdminKey')?.value?.trim();if(k)h['x-admin-key']=k;return h}
function humanTitle(name){return String(name||'').replace(/\.mp3$/i,'').replace(/^\s*\d{1,3}[\s._-]+/,'').replace(/[_]+/g,' ').trim()}
function translit(v){const m={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};return [...String(v||'').toLowerCase()].map(c=>m[c]??c).join('')}
function safeName(name,title=''){let base=humanTitle(name)||String(title||'');base=translit(base).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');return (base||('track_'+Date.now()))+'.mp3'}
function setState(msg,ok=false){status.textContent=msg;badge.textContent=ok?'MP3 загружен ✓':'Нет файла';badge.classList.toggle('ok',ok);copy.disabled=!currentUrl;del.disabled=!currentKey}

const editor=document.createElement('div');
editor.className='mp3-r2-title-editor-r335';
editor.innerHTML='<label>Название сингла<input id="mp3R2TitleR335" type="text" autocomplete="off" placeholder="Например: Свобода"></label><button class="btn" id="mp3R2RenameR335" type="button" disabled>✎ Сохранить название</button><small id="mp3R2RenameHintR335">Название будет показано на главной и в «Все синглы».</small>';
const actions=card.querySelector('.mp3-r2-actions');
actions?.before(editor);
const titleInput=$('mp3R2TitleR335'), renameBtn=$('mp3R2RenameR335'), renameHint=$('mp3R2RenameHintR335');

async function loadLatest(){
  try{
    const r=await fetch('/api/control/music/library',{headers:headers(),cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)return;
    const x=(d.tracks||[]).find(t=>String(t.key||'').startsWith('singles/'));
    if(!x)return;
    latestKey=x.key; latestUrl=x.url||('https://music.andrikmetal.com/'+x.key);
    latestTitle=String(x.title||'').trim();
    const generated=/^track[\s_-]?\d+$/i.test(String(x.name||'').trim()) || /\/track_\d+\.mp3$/i.test(x.key||'');
    if(!titleInput.value && latestTitle && !/^track[\s_-]?\d+$/i.test(latestTitle)) titleInput.value=latestTitle;
    renameBtn.disabled=false;
    renameHint.textContent=generated
      ? 'Последний MP3 имеет техническое имя. Введите русское название и нажмите «Сохранить название».'
      : 'Можно изменить название последнего сингла без повторной загрузки MP3.';
  }catch(_){}
}

choose?.addEventListener('click',()=>file.click());
file?.addEventListener('change',async()=>{
  const f=file.files?.[0];if(!f)return;
  if(!/\.mp3$/i.test(f.name)){setState('Нужен файл MP3.');return}
  const title=(titleInput.value.trim()||humanTitle(f.name)||'Без названия');
  titleInput.value=title;
  const name=safeName(f.name,title);
  choose.disabled=true;renameBtn.disabled=true;setState('Загружаем '+name+'…');
  try{
    const r=await fetch('/api/control/music/mp3?name='+encodeURIComponent(name),{
      method:'PUT',
      headers:headers({'content-type':'audio/mpeg','x-andrik-track-title':encodeURIComponent(title),'x-andrik-track-artist':encodeURIComponent('ANDRIK')}),
      body:f
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||d.error||('HTTP '+r.status));
    currentUrl=d.url;currentKey=d.key;latestUrl=d.url;latestKey=d.key;latestTitle=title;
    renameBtn.disabled=false;
    setState('Готово: '+title+' · '+d.url,true);
  }catch(e){setState('Ошибка: '+e.message)}
  finally{choose.disabled=false;file.value=''}
});

renameBtn?.addEventListener('click',async()=>{
  const title=titleInput.value.trim();
  const key=currentKey||latestKey;
  if(!key){status.textContent='Сначала загрузите MP3 или обновите страницу.';return}
  if(!title){status.textContent='Введите название песни.';titleInput.focus();return}
  renameBtn.disabled=true;
  status.textContent='Сохраняем название «'+title+'»…';
  try{
    const r=await fetch('/api/control/music/mp3?key='+encodeURIComponent(key),{
      method:'PATCH',
      headers:headers({'x-andrik-track-title':encodeURIComponent(title)})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||d.error||('HTTP '+r.status));
    latestKey=d.key;latestUrl=d.url;latestTitle=d.title||title;
    if(currentKey===key){currentKey=d.key;currentUrl=d.url}
    renameHint.textContent='Готово: на сайте будет показано «'+latestTitle+'».';
    status.textContent='Название сохранено ✓ '+latestTitle+' · '+d.key;
    if(currentUrl)setState(status.textContent,true);
  }catch(e){status.textContent='Ошибка названия: '+e.message}
  finally{renameBtn.disabled=false}
});

copy?.addEventListener('click',async()=>{if(!currentUrl)return;try{await navigator.clipboard.writeText(currentUrl);status.textContent='Ссылка скопирована: '+currentUrl}catch(_){prompt('Скопируйте ссылку',currentUrl)}});
del?.addEventListener('click',async()=>{if(!currentKey||!confirm('Удалить этот MP3 из R2?'))return;del.disabled=true;try{const r=await fetch('/api/control/music/mp3?key='+encodeURIComponent(currentKey),{method:'DELETE',headers:headers()});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||d.error||('HTTP '+r.status));currentUrl='';currentKey='';setState('MP3 удалён из R2.');await loadLatest()}catch(e){status.textContent='Ошибка удаления: '+e.message}finally{del.disabled=!currentKey}});
loadLatest();
})();