(() => {
  'use strict';
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent';
  const releaseDate=new Date('2026-08-20T00:00:00+02:00');
  const getKey=()=>{try{return (localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||'').trim()}catch(_){return ''}};
  const byId=id=>document.getElementById(id),set=(id,text)=>{const el=byId(id);if(el)el.textContent=text};
  const days=()=>Math.max(0,Math.ceil((releaseDate-Date.now())/86400000));
  async function api(path){const r=await fetch(path,{headers:{accept:'application/json',authorization:`Bearer ${getKey()}`},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
  function renderBase(){const left=days();set('releaseCenterDays',left);set('releaseCenterDayWord',left===1?'день':left>=2&&left<=4?'дня':'дней');set('releaseCenterDate','20 августа 2026');}
  async function load(){
    renderBase();
    if(!getKey()){set('releaseCenterMessage','Сохрани ADMIN_KEY в «Служебном», чтобы увидеть готовность проекта.');return}
    try{
      const data=await api('/api/control/dashboard'),stats=data.stats||{},lyrics=stats.lyrics||{};
      set('releaseCenterLyrics',`${Number(lyrics.enabled||0)} / ${Number(stats.catalogTracks||0)}`);
      set('releaseCenterSynced',`${Number(lyrics.synced||0)} готово`);
      set('releaseCenterPush',Number(stats.pushAudience||0)>0?`Готов · ${Number(stats.pushAudience)} устройств`:'Нужна аудитория');
      set('releaseCenterMessage',`ТРИКА · до релиза ${days()} дней. Треклист можно менять — панель не фиксирует неверное число песен.`);
    }catch(error){set('releaseCenterMessage',`Не удалось получить готовность: ${error.message}`)}
  }
  byId('releaseCenterRefresh')?.addEventListener('click',load);
  byId('releaseCenterLyricsButton')?.addEventListener('click',event=>{event.preventDefault();byId('bulkLyricsImport')?.scrollIntoView({behavior:'smooth',block:'start'})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
