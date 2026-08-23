(()=>{
'use strict';
const root=document.getElementById('mp3TagEditorCard');
if(!root)return;
const getKey=()=>{try{return localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||''}catch(_){return''}};
const auth=()=>{const key=getKey();return key?{authorization:`Bearer ${key}`,accept:'application/json'}:{accept:'application/json'}};
const status=document.getElementById('tagEditorStatus');
const library=document.getElementById('tagR2Library');
const refresh=document.getElementById('tagRefreshR2');
const load=document.getElementById('tagLoadR2');
const setStatus=(text,kind='')=>{if(!status)return;status.textContent=text;status.classList.toggle('is-ok',kind==='ok');status.classList.toggle('is-error',kind==='error')};
function ensureButton(){
  const head=root.querySelector('.mp3-tag-library-head');
  if(!head||document.getElementById('tagDedupeR572'))return;
  const btn=document.createElement('button');
  btn.className='btn admin-danger';btn.id='tagDedupeR572';btn.type='button';btn.textContent='🧹 Удалить точные дубли';
  head.appendChild(btn);
  btn.addEventListener('click',run);
}
async function run(){
  const btn=document.getElementById('tagDedupeR572');
  if(btn)btn.disabled=true;
  if(library)library.hidden=false;
  setStatus('R2: ищу только точные байт-в-байт MP3-дубли внутри одного раздела…');
  try{
    const scan=await fetch('/api/control/music/dedupe?ts='+Date.now(),{headers:auth(),cache:'no-store'});
    const data=await scan.json().catch(()=>({}));
    if(!scan.ok)throw new Error(data.message||data.error||('HTTP '+scan.status));
    const count=Number(data.duplicateCount||0);
    if(!count){setStatus(`R2 чисто: проверено ${Number(data.objectsScanned||0)} MP3, точных дублей нет.`,'ok');return}
    const lines=(data.groups||[]).flatMap(g=>(g.remove||[]).map(x=>`${x.key} → оставить ${g.keep?.key||'основной файл'}`)).slice(0,12);
    const extra=count>lines.length?`\n…и ещё ${count-lines.length}`:'';
    if(!confirm(`Найдено точных дублей: ${count}.\n\nБудут удалены ТОЛЬКО байт-в-байт одинаковые MP3 внутри одной папки.\nКопии между singles и albums не трогаются.\n\n${lines.join('\n')}${extra}\n\nУдалить лишние?`)){
      setStatus(`Найдено ${count} точных дублей. Удаление отменено.`);return;
    }
    setStatus(`Удаляю ${count} точных дублей из R2…`);
    const res=await fetch('/api/control/music/dedupe',{method:'POST',headers:{...auth(),'content-type':'application/json'},body:JSON.stringify({confirm:'DELETE_EXACT_DUPLICATES'}),cache:'no-store'});
    const result=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(result.message||result.error||('HTTP '+res.status));
    setStatus(`R2 очищено: удалено ${Number(result.deleted||0)} точных MP3-дублей. Основные файлы сохранены.`,'ok');
    refresh?.click();
  }catch(error){setStatus('Ошибка очистки R2: '+String(error?.message||error),'error')}
  finally{if(btn)btn.disabled=false}
}
ensureButton();
load?.addEventListener('click',()=>setTimeout(ensureButton,100));
})();
