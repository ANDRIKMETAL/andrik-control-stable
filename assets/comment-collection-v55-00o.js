/* Control ANDRIK v55.00r3o — monthly listener comment archive. */
(() => {
  'use strict';
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  let year=new Date().getFullYear();
  let data=null;
  let selectedMonth=0;

  function normalizeAuthor(value){
    return String(value||'').trim().toLowerCase().replace(/^@+/,'').replace(/\s+/g,' ');
  }
  function isOwnerComment(item){
    const author=normalizeAuthor(item?.author);
    return author==='andrikmetal';
  }
  async function api(path){
    const key=getKey();
    if(!key) throw new Error('unauthorized');
    const response=await fetch(path,{headers:{accept:'application/json',authorization:`Bearer ${key}`},cache:'no-store'});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body.ok) throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }
  function setAccess(ok,text){
    $('accessText').textContent=text;
    $('accessText').classList.toggle('ok',ok);
    $('collectionCard').classList.toggle('hidden',!ok);
    $('accessError').classList.toggle('hidden',ok);
  }
  function getVisibleMonths(){
    return (data?.months||[]).filter(item=>Number(item.total||0)>0);
  }
  function pickDefaultMonth(months){
    if(selectedMonth && months.some(item=>item.month===selectedMonth)) return selectedMonth;
    const currentMonth = Number(String(data?.currentDate||'').split('-')[1]||0);
    if(currentMonth && months.some(item=>item.month===currentMonth)) return currentMonth;
    return months.length ? months[months.length-1].month : 0;
  }
  function monthCard(item){
    const active=item.month===selectedMonth;
    return `<button class="month${item.total>0?' has-comments':''}${active?' is-active current':''}" data-month="${item.month}" type="button"><strong>${MONTHS[item.month-1]}</strong><b>${item.total}</b><small><span>🌐 ${item.site}</span><span>▶️ ${item.youtube}</span></small></button>`;
  }
  function renderMonths(){
    $('yearLabel').textContent=year;
    $('yearSummary').textContent=`Всего: ${data?.totals?.total||0} · Сайт: ${data?.totals?.site||0} · YouTube: ${data?.totals?.youtube||0}`;
    const months=getVisibleMonths();
    selectedMonth=pickDefaultMonth(months);
    const box=$('months');
    box.innerHTML=months.length?months.map(monthCard).join(''):'<div class="month-empty">В этом году комментариев пока нет.</div>';
    box.classList.toggle('is-single-month',months.length===1);
    box.classList.toggle('is-empty-months',months.length===0);
    box.querySelectorAll('[data-month]').forEach(button=>button.addEventListener('click',()=>{
      selectedMonth=Number(button.dataset.month)||0;
      $('monthsSpoiler').open=false;
      renderMonths();
      loadMonth();
    }));
    if(selectedMonth){ loadMonth(); }
    else {
      $('monthTitle').textContent='Нет месяцев с комментариями';
      $('monthCounts').textContent='';
      $('comments').innerHTML='<div class="empty-state">В этом году пока нет комментариев слушателей.</div>';
    }
  }
  function sourceName(source){return source==='youtube'?'▶️ YouTube':'🌐 Сайт';}
  function commentCard(item){
    const dateLine = item.date ? `${escapeHtml(item.date)} · ${escapeHtml(item.time||'')}` : escapeHtml(item.time||'');
    return `<article class="comment ${item.source}"><div class="comment-top"><span class="source">${sourceName(item.source)}</span><time class="time">${dateLine}</time></div><div class="author">${escapeHtml(item.author||'Слушатель')}</div><div class="message">${escapeHtml(item.message||'')}</div><div class="target"><span>${item.source==='youtube'?'🎬':'📄'} ${escapeHtml(item.targetTitle||'ANDRIK')}</span><a href="${escapeHtml(item.url||'#')}" target="_blank" rel="noopener">Открыть</a></div></article>`;
  }
  async function loadMonth(){
    if(!selectedMonth){
      $('monthTitle').textContent='Выберите месяц';
      $('monthCounts').textContent='';
      $('comments').innerHTML='<div class="empty-state">Выберите месяц в спойлере выше.</div>';
      return;
    }
    $('monthTitle').textContent=`${MONTHS[selectedMonth-1]} ${year}`;
    $('monthCounts').textContent='Собираем комментарии слушателей…';
    $('comments').innerHTML='<div class="empty-state">Загружаем единый список комментариев…</div>';
    try{
      const result=await api(`/api/control/comment-collection?year=${year}&month=${selectedMonth}&v=55.00-r3o&t=${Date.now()}`);
      const comments=(result.comments||[]).filter(item=>!isOwnerComment(item));
      const site=comments.filter(item=>item.source==='site').length;
      const youtube=comments.filter(item=>item.source==='youtube').length;
      $('monthTitle').textContent=`${MONTHS[selectedMonth-1]} ${year}`;
      $('monthCounts').textContent=`Слушатели: ${comments.length} · Сайт: ${site} · YouTube: ${youtube}`;
      $('comments').innerHTML=comments.length?comments.map(commentCard).join(''):'<div class="empty-state">В этом месяце есть только ваши сообщения или комментариев слушателей пока нет.</div>';
    }catch(error){
      $('monthCounts').textContent='';
      $('comments').innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }
  async function loadYear(){
    $('yearLabel').textContent=year;
    $('yearSummary').textContent='Загружаем архив…';
    $('months').innerHTML='';
    try{
      data=await api(`/api/control/comment-collection?year=${year}&v=55.00-r3o&t=${Date.now()}`);
      setAccess(true,'Доступ подтверждён');
      renderMonths();
    }catch(error){
      setAccess(false,error.message==='unauthorized'?'Нужен ADMIN_KEY':'Архив временно недоступен');
    }
  }
  $('yearPrev').addEventListener('click',()=>{year--;selectedMonth=0;loadYear();});
  $('yearNext').addEventListener('click',()=>{year++;selectedMonth=0;loadYear();});
  loadYear();
})();
