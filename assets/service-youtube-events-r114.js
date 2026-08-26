(() => {
  'use strict';
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return (localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||'').trim()}catch(_){return ''}};
  const byId=id=>document.getElementById(id);
  const set=(id,text)=>{const el=byId(id);if(el)el.textContent=text};
  const fmt=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch(_){return value}};
  async function api(path,options={}){
    const response=await fetch(path,{...options,headers:{accept:'application/json',authorization:`Bearer ${getKey()}`,...(options.headers||{})},cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||data.details||data.error||`HTTP ${response.status}`);
    return data;
  }
  function paintKpi(id,value,tone=''){
    const box=byId(id);if(!box)return;box.classList.toggle('is-warning',tone==='warning');box.classList.toggle('is-error',tone==='error');
    const strong=box.querySelector('strong');if(strong)strong.textContent=String(value??0);
  }
  function render(data={}){
    const summary=data.summary||{},today=data.today||{},fast=data.fast||{},reserve=data.reserve||{},subscriberPoll=data.subscriberPoll||{};
    const status=String(data.status||'never');
    const fastStatus=String(fast.status||'never');
    const fastHardError=fastStatus==='failed'||fast.healthy===false;
    const effectiveStatus=fastHardError?'failed':fastStatus==='success'?'success':reserve.status==='success'?'success':status;
    const badge=byId('youtubeEventsState');
    if(badge){badge.className=`service-access-state ${effectiveStatus==='success'?'is-ready':effectiveStatus==='failed'?'is-error':effectiveStatus==='warning'?'is-warn':''}`;badge.textContent=effectiveStatus==='success'?'Работает':effectiveStatus==='failed'?'Ошибка':effectiveStatus==='warning'?'Очередь':'Ожидает'}
    paintKpi('youtubeEventsComments',today.commentsSent||summary.commentsSent||0);
    paintKpi('youtubeEventsReplies',today.repliesSent||0);
    paintKpi('youtubeEventsLikes',today.likesSent||summary.likesSent||0);
    paintKpi('youtubeEventsSubscribers',today.subscribersSent||summary.subscribersSent||0);
    const queue=Number(summary.commentsQueued||0)+Number(summary.subscribersQueued||0)+Number(summary.likesQueued||0);
    const errors=Number(summary.commentsFailed||0)+Number(summary.subscribersFailed||0)+Number(summary.likesFailed||0);
    paintKpi('youtubeEventsQueue',queue,queue?'warning':'');
    paintKpi('youtubeEventsErrors',errors,errors?'error':'');
    const fastAge=Number.isFinite(Number(fast.ageMinutes))?` · ${Number(fast.ageMinutes)} мин. назад`:'';
    set('youtubeEventsFastCheck',`Быстрый cron 2 мин: ${fmt(fast.lastCheckAt)}${fastAge} · подписчики: ${subscriberPoll.lastCheckAt?fmt(subscriberPoll.lastCheckAt):'ожидает'} · последний доставленный total ${Number(subscriberPoll.lastNotifiedTotal||0)}`);
    const commentDirect=['direct-video-r473','direct-video-r474','direct-video+livechat-r669'].includes(fast.summary?.commentMode);
    const commentNote=commentDirect?` · комментарии: прямой контроль ${Number(fast.summary?.commentTargets||0)} видео`:'';
    set('youtubeEventsFastResult',`Быстрый результат: ${fastStatus==='success'?'успех':fastStatus==='warning'?'предупреждение':fastStatus==='failed'?'ОШИБКА':'ожидает'} · отправлено ${Number(fast.summary?.sent||0)} · LIVE-чат ${Number(fast.summary?.liveChatSent||0)} · LIVE лайки ${fast.summary?.liveVideoPinned?'в контроле':'—'} · ошибок ${Number(fast.summary?.failed||0)}${commentNote} · восстановлено stale ${Number(fast.staleLikeClaims||0)}`);
    set('youtubeEventsLastCheck',`Резерв 5 мин: ${reserve.lastCheckAt?fmt(reserve.lastCheckAt):'ожидает первого цикла'} · ${reserve.status==='success'?'готов':reserve.status==='warning'?'контроль':'ожидает'}`);
    set('youtubeEventsLastSuccess',`Последний успешный контроль: ${fmt(data.effectiveSuccessAt||data.lastSuccessAt)}`);
    const message=fastHardError
      ?`Быстрый 2-минутный cron требует внимания${fast.error?`: ${fast.error}`:''}.`
      :data.lastError?`Последняя ошибка: ${data.lastError}`
      :queue?`В очереди ${queue}. Нажмите «Повторить очередь».`
      :commentDirect?'Комментарии проверяются напрямую по видео; 2-минутный контроль активен ✅':'YouTube-контроль работает без выявленных потерь.';
    set('youtubeEventsMessage',message);
  }
  async function load(){
    if(!getKey()){set('youtubeEventsMessage','Сначала сохраните ADMIN_KEY.');return}
    try{render(await api('/api/control/youtube-events/status'))}catch(error){set('youtubeEventsMessage',`Ошибка: ${error.message}`)}
  }
  async function run(retry=false){
    if(!getKey()){set('youtubeEventsMessage','Сначала сохраните ADMIN_KEY.');return}
    const ids=['youtubeEventsCheck','youtubeEventsRetry'];ids.forEach(id=>{const b=byId(id);if(b)b.disabled=true});
    set('youtubeEventsMessage',retry?'Повторяем очередь и прошлые ошибки…':'Проверяем реальные события YouTube…');
    try{
      const data=await api('/api/push/check-youtube-events',{method:'POST'});
      set('youtubeEventsMessage',`Готово: комментарии ${Number(data.commentsSent||0)}/${Number(data.commentsAttempted||0)}, лайки ${Number(data.likesSent||0)}, подписчики ${Number(data.subscribersSent||0)}, очередь ${Number(data.commentsQueued||0)+Number(data.likesQueued||0)+Number(data.subscribersQueued||0)}.`);
      await load();
      byId('adminDiagnosticLogRefresh')?.click();
    }catch(error){set('youtubeEventsMessage',`Ошибка: ${error.message}`);await load()}
    finally{ids.forEach(id=>{const b=byId(id);if(b)b.disabled=false})}
  }
  byId('youtubeEventsCheck')?.addEventListener('click',()=>run(false));
  byId('youtubeEventsRetry')?.addEventListener('click',()=>run(true));
  byId('youtubeEventsOpenLog')?.addEventListener('click',()=>{byId('adminDiagnosticLogRefresh')?.click();document.querySelector('.diagnostic-log-card')?.scrollIntoView({behavior:'smooth',block:'start'})});
  window.addEventListener('andrik-control-version-ready',load,{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,450),{once:true});else setTimeout(load,450);
})();
