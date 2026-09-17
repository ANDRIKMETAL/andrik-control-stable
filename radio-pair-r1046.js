(()=>{'use strict';
 const btn=document.getElementById('radioPairCreateR1046');
 const copy=document.getElementById('radioPairCopyR1046');
 const box=document.getElementById('radioPairResultR1046');
 const codeEl=document.getElementById('radioPairCodeR1046');
 const cmdEl=document.getElementById('radioPairCommandR1046');
 const msg=document.getElementById('radioPairMsgR1046');
 const state=document.getElementById('radioPairStateR1046');
 if(!btn)return;
 const savedKey=()=>{try{return localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||''}catch(_){return ''}};
 const say=(text,kind='')=>{msg.textContent=text;msg.dataset.kind=kind};
 btn.addEventListener('click',async()=>{
   btn.disabled=true;state.textContent='СОЗДАЮ…';say('Создаю одноразовый код на 15 минут…');
   try{
     const key=savedKey();
     const r=await fetch('/api/control/radio-remote-r627/pair/create',{method:'POST',credentials:'include',cache:'no-store',headers:{accept:'application/json','content-type':'application/json','cache-control':'no-cache',...(key?{'x-admin-key':key}:{})},body:'{}'});
     const d=await r.json().catch(()=>({}));
     if(!r.ok)throw new Error(d.error||d.message||('HTTP '+r.status));
     const code=String(d.code||'').trim();
     if(!code)throw new Error('pair-code-missing');
     const command=String(d.command||('sudo /usr/local/sbin/andrik-radio-web pair '+code));
     codeEl.textContent=code;cmdEl.textContent=command;box.hidden=false;state.textContent='КОД ГОТОВ';
     const until=d.expiresAt?new Date(d.expiresAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
     say('✅ Код создан'+(until?(' · действует примерно до '+until):' · действует 15 минут')+'. Выполни команду на VPS.','ok');
   }catch(err){
     state.textContent='ОШИБКА';
     const text=String(err&&err.message||err||'unknown');
     say(text==='unauthorized'?'❌ Owner-session не авторизована. Открой Control заново и войди, затем повтори.':'❌ Не удалось создать код: '+text,'bad');
   }finally{btn.disabled=false}
 });
 copy?.addEventListener('click',async()=>{
   const text=cmdEl.textContent.trim();if(!text||text==='—')return;
   try{await navigator.clipboard.writeText(text);say('✅ Команда скопирована. Вставь её в терминал VPS и нажми Enter.','ok')}
   catch(_){say('Команда готова выше. Удерживай текст и скопируй вручную.')}
 });
})();