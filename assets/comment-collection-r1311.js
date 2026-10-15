(()=>{
'use strict';
window.__andrikArchiveR1311Started=true;
const $=id=>document.getElementById(id);
const owner=window.AndrikOwnerSession;
const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const esc=value=>String(value??'').replace(/[&<>\'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
let year=new Date().getFullYear(), selectedMonth=0, data=null, yearSeq=0, monthSeq=0;
const ARCHIVE_CACHE_PREFIX_R1313='andrik-archive-session-r1313:';
const cacheKey=(y,m)=>ARCHIVE_CACHE_PREFIX_R1313+y+':'+m;
function saveArchiveCache(y,m,value){try{sessionStorage.setItem(cacheKey(y,m),JSON.stringify({at:Date.now(),value}))}catch(_){}}
function readArchiveCache(y,m){try{const d=JSON.parse(sessionStorage.getItem(cacheKey(y,m))||'null');return d?.value?.ok&&Date.now()-d.at<24*3600*1000?d:null}catch(_){return null}}
const isOwnerComment=item=>String(item?.author||'').trim().toLowerCase().replace(/^@+/,'').replace(/\s+/g,' ')==='andrikmetal';
function text(id,message){if($(id))$(id).textContent=message;}
function status(label,kind='loading'){
 const node=$('accessText');
 if(node){node.textContent=label;node.classList.toggle('ok',kind==='ok');}
}
function errorView(message,needsLogin=false){
 const node=$('accessError');
 if(!node)return;
 node.classList.remove('hidden');
 text('archiveErrorMessage',message);
 const link=$('archiveLoginLink');
 if(link)link.hidden=!needsLogin;
}
function clearError(){$('accessError')?.classList.add('hidden');}
function friendlyError(err){
 const raw=String(err?.message||err||'Ошибка');
 if(err?.name==='AbortError'||raw==='timeout')return 'Сервер не ответил за 20 секунд. Нажми «Повторить».';
 if(/unauthorized|HTTP 401|HTTP 403|owner-session/i.test(raw))return 'Сессия владельца не подтверждена. Войди в «Служебное» и вернись сюда.';
 if(/network|failed to fetch|load failed/i.test(raw))return 'Нет соединения с API контрольки. Проверь интернет и нажми «Повторить».';
 return raw.length>180?raw.slice(0,180)+'…':raw;
}
async function waitForOwner(){
 if(!owner?.ready)return;
 await Promise.race([
  owner.ready().catch(()=>null),
  new Promise(resolve=>setTimeout(resolve,8000))
 ]);
}
async function api(path){
 await waitForOwner();
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(path,{
   headers:{accept:'application/json'},
   credentials:'include',cache:'no-store',signal:controller.signal
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.ok!==true){
   const error=new Error(body.error||`HTTP ${response.status}`);
   error.status=response.status;
   throw error;
  }
  return body;
 }finally{clearTimeout(timer);}
}
function getVisibleMonths(){return (data?.months||[]).filter(m=>Number(m.total||0)>0)}
function pickMonth(items){
 if(selectedMonth&&items.some(x=>x.month===selectedMonth))return selectedMonth;
 const current=Number(String(data?.currentDate||'').split('-')[1]||0);
 if(current&&items.some(x=>x.month===current))return current;
 return items.length?items[items.length-1].month:0;
}
function card(m){return `<button class="month${m.total>0?' has-comments':''}${m.month===selectedMonth?' is-active current':''}" data-month="${m.month}" type="button"><strong>${MONTHS[m.month-1]}</strong><b>${Number(m.total||0)}</b><small><span>🌐 ${Number(m.site||0)}</span><span>▶️ ${Number(m.youtube||0)}</span><span>👍 ${Number(m.likes||0)}</span></small></button>`;}
function commentCard(item){
 const dateLine=item.date?`${esc(item.date)} · ${esc(item.time||'')}`:esc(item.time||'');
 const source=item.source==='youtube'?'youtube':'site';
 const link=String(item.url||'');
 const safeUrl=/^https:\/\//i.test(link)?link:'#';
 return `<article class="comment ${source}"><div class="comment-top"><span class="source">${source==='youtube'?'▶️ YouTube':'🌐 Сайт'}</span><span class="comment-like-count">👍 ${Number(item.likeCount||0)}</span><time class="time">${dateLine}</time></div><div class="author">${esc(item.author||'Слушатель')}</div><div class="message">${esc(item.message||'')}</div><div class="target"><span>${source==='youtube'?'🎬':'📄'} ${esc(item.targetTitle||'ANDRIK')}</span><a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">Открыть</a></div></article>`;
}
function renderMonthResultR1313(result,thisMonth,thisYear){
 const comments=(result.comments||[]).filter(x=>!isOwnerComment(x));
 const site=comments.filter(x=>x.source==='site').length;
 const youtube=comments.filter(x=>x.source==='youtube').length;
 const meta=(result.months||[]).find(x=>Number(x.month)===thisMonth)||{};
 const likes=Math.max(Number(meta.likes||0),comments.reduce((sum,x)=>sum+Number(x.likeCount||0),0));
 text('monthTitle',`${MONTHS[thisMonth-1]} ${thisYear}`);
 text('monthCounts',`Слушатели: ${comments.length} · Сайт: ${site} · YouTube: ${youtube} · Лайков за месяц: ${likes}`);
 $('comments').innerHTML=comments.length?comments.map(commentCard).join(''):'<div class="empty-state">За этот месяц комментариев слушателей пока нет.</div>';
}
async function loadMonth(){
 const thisSeq=++monthSeq, thisYear=year, thisMonth=selectedMonth;
 if(!thisMonth){text('monthTitle','Нет месяцев с комментариями');text('monthCounts','');$('comments').innerHTML='<div class="empty-state">В этом году пока нет комментариев слушателей.</div>';return;}
 text('monthTitle',`${MONTHS[thisMonth-1]} ${thisYear}`);
 text('monthCounts','Загружаем комментарии…');
 $('comments').innerHTML='<div class="empty-state">Загружаем единый список комментариев…</div>';
 try{
  const result=await api(`/api/control/comment-collection?year=${thisYear}&month=${thisMonth}&v=r1311&t=${Date.now()}`);
  if(thisSeq!==monthSeq)return;
  saveArchiveCache(thisYear,thisMonth,result);
  renderMonthResultR1313(result,thisMonth,thisYear);
 }catch(err){
  if(thisSeq!==monthSeq)return;
  const message=friendlyError(err);
  const prior=readArchiveCache(thisYear,thisMonth);
  if(prior){renderMonthResultR1313(prior.value,thisMonth,thisYear);text('monthCounts',`⚠️ Последняя сохранённая копия · ${new Date(prior.at).toLocaleString('ru-RU')} · сервер: ${message}`);return;}
  text('monthCounts','Не удалось получить комментарии за месяц');
  $('comments').innerHTML=`<div class="empty-state">${esc(message)} <button type="button" id="archiveRetryMonth" class="archive-retry">↻ Повторить</button></div>`;
  $('archiveRetryMonth')?.addEventListener('click',loadMonth);
 }
}
function renderMonths(){
 text('yearLabel',year);
 text('yearSummary',`Всего: ${data?.totals?.total||0} · Сайт: ${data?.totals?.site||0} · YouTube: ${data?.totals?.youtube||0} · Лайков: ${data?.totals?.likes||0}`);
 const items=getVisibleMonths();selectedMonth=pickMonth(items);
 const list=$('months');
 list.innerHTML=items.length?items.map(card).join(''):'<div class="month-empty">В этом году комментариев пока нет.</div>';
 list.classList.toggle('is-single-month',items.length===1);
 list.classList.toggle('is-empty-months',items.length===0);
 list.querySelectorAll('[data-month]').forEach(button=>button.addEventListener('click',()=>{
  selectedMonth=Number(button.dataset.month)||0;
  $('monthsSpoiler').open=false;
  renderMonths();
 }));
 if(selectedMonth){if(Number(data?.selectedMonth)===selectedMonth)renderMonthResultR1313(data,selectedMonth,year);else loadMonth();}else{
  ++monthSeq;
  text('monthTitle','Пока нет комментариев');
  text('monthCounts','');
  $('comments').innerHTML='<div class="empty-state">Комментарии появятся после синхронизации с YouTube и сайтом.</div>';
 }
}
async function loadYear(){
 const thisSeq=++yearSeq;
 ++monthSeq;
 status('Запрашиваем архив…');clearError();
 text('yearLabel',year);text('yearSummary','Загружаем архив…');
 text('monthTitle','Загружаем…');
 text('monthCounts','');
 try{
  const initialMonth=selectedMonth||new Date().getMonth()+1;
  const result=await api(`/api/control/comment-collection?year=${year}&month=${initialMonth}&v=r1313&t=${Date.now()}`);
  if(thisSeq!==yearSeq)return;
  data=result;
  saveArchiveCache(year,initialMonth,result);
  status('✅ Доступ подтверждён','ok');clearError();
  renderMonths();
 }catch(err){
  if(thisSeq!==yearSeq)return;
  const message=friendlyError(err),auth=Number(err.status)===401||Number(err.status)===403||/unauthorized|owner-session/i.test(String(err.message||''));
  const prior=readArchiveCache(year,selectedMonth||new Date().getMonth()+1);
  if(prior&&!auth){data=prior.value;status('⚠️ Последняя сохранённая копия');clearError();renderMonths();text('yearSummary',`⚠️ Данные из сохранённой копии от ${new Date(prior.at).toLocaleString('ru-RU')} · ${message}`);return;}
  status(auth?'🔒 Нужен вход владельца':'⚠️ Ошибка загрузки');
  text('yearSummary','Не удалось загрузить архив.');
  text('monthTitle','Ошибка загрузки');
  text('monthCounts',message);
  $('comments').innerHTML='<div class="empty-state">Нажми «Повторить загрузку» ниже.</div>';
  errorView(message,auth);
 }
}
$('yearPrev')?.addEventListener('click',()=>{year--;selectedMonth=0;loadYear();});
$('yearNext')?.addEventListener('click',()=>{year++;selectedMonth=0;loadYear();});
$('archiveRetry')?.addEventListener('click',loadYear);
window.addEventListener('andrik-owner-session',event=>{
 if(event?.detail?.active&&$('accessError')&&!$('accessError').classList.contains('hidden'))loadYear();
});
loadYear().catch(err=>{
 status('⚠️ Ошибка модуля');
 text('yearSummary','Не удалось открыть архив.');
 errorView(friendlyError(err),false);
});
})();
