(()=>{
'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owner=window.AndrikOwnerSession;
const setStatus=(message,ok=false)=>{ $('message').textContent=message; $('message').className=ok?'ok':'warn'; };
const ownerActive=()=>Boolean(owner?.isActive?.());
function syncAuth(){
  const signed=ownerActive();
  $('manual-auth').hidden=signed;
  $('auth-state').textContent=signed?'🔐 Защищённая сессия владельца подключена. ADMIN_KEY не нужен.':'🔐 Требуется вход владельца';
  if(signed)$('key').value='';
}
async function req(method='GET',body){
  await owner?.ready?.().catch(()=>null);
  const raw=$('key').value.trim();
  if(!ownerActive()&&!raw)throw new Error('Сессия владельца не активна. Открой «Служебное» и войди.');
  const headers={accept:'application/json'};
  // Only pass a real key supplied directly on this page, never the session sentinel.
  if(raw && raw!==owner?.sentinel)headers.authorization='Bearer '+raw;
  if(body)headers['content-type']='application/json';
  const response=await fetch('/api/control/youtube-release-monitor',{
    method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok){
    if(response.status===401){syncAuth();throw Error('Доступ не подтверждён. Повтори вход в разделе «Служебное».');}
    throw Error(data.error||`HTTP ${response.status}`);
  }
  syncAuth();
  return data;
}
async function load(){
  try{
    const d=await req();
    setStatus('✅ Доступ подтверждён. Ответ сервера получен.',true);
    const c=d.catalogue||{},stats=d.stats||{},sweep=d.sweep||{};
    $('catalogue').innerHTML='<p>Найдено треков: <b>'+Number(c.count||0)+'</b> · обновлено: '+escape(c.updatedAt||'ещё не проверялось')+'</p><table><tr><th>Альбом</th><th>Треков</th><th>Состояние</th></tr>'+
    (c.albums||[]).map(x=>'<tr><td>'+escape(x.album)+'</td><td>'+Number(x.count||0)+'</td><td class="'+(x.status==='ok'?'ok':'warn')+'">'+escape(x.status)+(x.error?' · '+escape(x.error):'')+'</td></tr>').join('')+'</table>';
    $('sweep').textContent='Проверка: '+(stats.checkedAt||'нет')+' · доступно '+(stats.tracked||0)+' · комментариев последняя выборка '+(sweep.seen||0)+' · уведомлений '+(sweep.sent||0);
    $('ids').value=(d.manualVideoIds||[]).join('\n');
    $('extra').textContent='Вручную: '+(d.manualVideoIds||[]).length;
  }catch(error){setStatus(error.message);}
}
$('load').addEventListener('click',load);
$('refresh').addEventListener('click',async()=>{
  try{setStatus('Проверяем плейлисты…');await req('POST',{action:'refresh-catalog'});await load();}
  catch(error){setStatus(error.message);}
});
$('save').addEventListener('click',async()=>{
  try{const d=await req('POST',{action:'set-video-ids',ids:$('ids').value});$('extra').textContent='Сохранено ID: '+(d.manualVideoIds||[]).length;await load();}
  catch(error){setStatus(error.message);}
});
(async()=>{
  await owner?.ready?.().catch(()=>null);
  syncAuth();
  await load();
})();
})();
