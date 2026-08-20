(()=>{'use strict';
  const button=document.getElementById('trikaReleasePushAllR520');
  const status=document.getElementById('trikaReleasePushStatusR520');
  if(!button||!status)return;
  const title='🔥 ТРИКА — новый альбом ANDRIK';
  const message='«ТРИКА» уже вышла! Слушай новый альбом ANDRIK на сайте, YouTube Music, Spotify и Amazon Music. Полный MP3 ZIP уже доступен.';
  const url='https://andrikmetal.com/albums.html#album-trika';
  const key=()=>String(document.getElementById('lyricsAdminKey')?.value||'').trim();
  const set=t=>{status.textContent=t};
  button.addEventListener('click',async()=>{
    if(!confirm(`Отправить релизное уведомление ВСЕМ подписчикам?\n\n${title}\n${message}`))return;
    button.disabled=true;button.textContent='Отправляем…';set('Отправляем релизное push-уведомление всем подписчикам…');
    try{
      const headers={'content-type':'application/json'};const k=key();if(k)headers['x-admin-key']=k;
      const r=await fetch('/api/push/send',{method:'POST',headers,credentials:'include',cache:'no-store',body:JSON.stringify({audience:'all',title,message,url})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ok)throw new Error(d?.message||d?.error||`HTTP ${r.status}`);
      set(`Готово ✅ OneSignal принял релизную рассылку${d.oneSignalId?` · ID ${d.oneSignalId}`:''}.`);
    }catch(e){set(`Ошибка рассылки: ${String(e?.message||e)}`)}
    finally{button.disabled=false;button.textContent='🚀 Отправить релиз ТРИКА всем'}
  });
})();