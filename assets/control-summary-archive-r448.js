/* ANDRIK R448 — resilient in-place daily summary archive. */
(()=>{
  'use strict';
  const button=document.getElementById('controlSummaryArchiveR442');
  if(!button)return;
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const params=new URLSearchParams(location.search);
  let selectedKey=/^\d{4}-\d{2}-\d{2}$/.test(String(params.get('summaryWindow')||''))?String(params.get('summaryWindow')):'';
  const ruMonth=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
  const modal=document.createElement('div');
  modal.className='control-summary-archive-modal-r442';
  modal.id='controlSummaryArchiveModalR442';
  modal.hidden=true;
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<button class="control-summary-archive-backdrop-r442" type="button" aria-label="Закрыть архив"></button><section class="control-summary-archive-panel-r442" role="dialog" aria-modal="true" aria-label="Архив сводок"><header class="control-summary-archive-head-r442"><button type="button" data-archive-prev aria-label="Предыдущий месяц">‹</button><div class="control-summary-archive-month-r442" data-archive-month>Архив</div><button type="button" data-archive-next aria-label="Следующий месяц">›</button><button type="button" data-archive-close aria-label="Закрыть">×</button></header><div class="control-summary-archive-week-r442"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="control-summary-archive-grid-r442" data-archive-grid></div><div class="control-summary-archive-status-r442" data-archive-status>Загружаем сохранённые дни…</div><div class="control-summary-archive-legend-r442">Зелёные даты — сохранённая сводка. Архив хранит завершённые циклы 06:05 → 06:05.</div></section>`;
  document.body.appendChild(modal);
  const grid=modal.querySelector('[data-archive-grid]');
  const monthLabel=modal.querySelector('[data-archive-month]');
  const status=modal.querySelector('[data-archive-status]');
  const available=new Map();
  let loaded=false;
  let loadingDay=false;
  let viewDate=new Date(`${selectedKey||new Date().toISOString().slice(0,7)+'-01'}T00:00:00Z`);
  if(!selectedKey)viewDate=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1));
  else viewDate=new Date(Date.UTC(viewDate.getUTCFullYear(),viewDate.getUTCMonth(),1));

  const close=()=>{modal.hidden=true;modal.setAttribute('aria-hidden','true');document.documentElement.style.overflow='';};
  const keyFor=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  function render(){
    const y=viewDate.getUTCFullYear(),m=viewDate.getUTCMonth();
    monthLabel.textContent=ruMonth.format(viewDate);
    const first=new Date(Date.UTC(y,m,1));
    const start=(first.getUTCDay()+6)%7;
    const days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    const cells=[];
    for(let i=0;i<start;i++)cells.push('<span class="control-summary-archive-day-r442 is-empty"></span>');
    for(let d=1;d<=days;d++){
      const key=keyFor(y,m,d),entry=available.get(key);
      if(entry){
        const cls=`control-summary-archive-day-r442 is-available${key===selectedKey?' is-selected':''}`;
        const tip=`Открыть сохранённую сводку за ${String(d).padStart(2,'0')}.${String(m+1).padStart(2,'0')}.${y}`;
        cells.push(`<button class="${cls}" type="button" data-archive-key="${key}" title="${tip}">${d}</button>`);
      }else cells.push(`<span class="control-summary-archive-day-r442">${d}</span>`);
    }
    grid.innerHTML=cells.join('');
    if(loaded&&!loadingDay)status.textContent=available.size?`Сохранено дней: ${available.size}`:'Архив пока пуст.';
  }

  async function fetchJson(url,timeoutMs=6500){
    const key=getKey();
    if(!key)throw new Error('Ключ владельца не сохранён');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal,headers:{accept:'application/json',authorization:`Bearer ${key}`}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.ok===false)throw new Error(data?.details||data?.error||`HTTP ${response.status}`);
      return data;
    }catch(error){
      if(error?.name==='AbortError')throw new Error('Архив отвечает слишком долго');
      throw error;
    }finally{clearTimeout(timer)}
  }

  async function loadArchive(){
    if(loaded)return;
    try{
      const data=await fetchJson(`/api/control/daily-summary/archive?v=55.00-r448&t=${Date.now()}`,6500);
      for(const entry of Array.isArray(data.entries)?data.entries:[]){
        if(/^\d{4}-\d{2}-\d{2}$/.test(String(entry?.key||'')))available.set(entry.key,entry);
      }
      loaded=true;
      if(!selectedKey&&available.size){
        const newest=[...available.keys()].sort().reverse()[0];
        viewDate=new Date(`${newest.slice(0,7)}-01T00:00:00Z`);
      }
      render();
    }catch(error){
      loaded=true;
      status.textContent=`Не удалось открыть архив: ${String(error?.message||error)}`;
    }
  }

  async function openDay(key){
    if(loadingDay||!/^\d{4}-\d{2}-\d{2}$/.test(String(key||'')))return;
    loadingDay=true;
    status.textContent='Открываем сохранённую сводку…';
    try{
      const data=await fetchJson(`/api/control/daily-summary/archive/day?window=${encodeURIComponent(key)}&v=55.00-r448&t=${Date.now()}`,6500);
      selectedKey=key;
      const apply=window.andrikApplyArchiveSummaryR448||window.andrikApplyArchiveSummaryR442;
      if(typeof apply==='function'){
        const applied=apply(data,key);
        if(applied===false)throw new Error('Не удалось отрисовать сохранённую сводку');
        render();
        status.textContent=`Открыта сводка за ${key.split('-').reverse().join('.')}`;
        setTimeout(close,160);
      }else{
        location.href=`/control-home.html?page=summary&source=push&archive=1&summaryWindow=${encodeURIComponent(key)}&v=55.00-r448`;
      }
    }catch(error){
      console.warn('R448 archive day render',error);
      status.textContent='Не удалось отобразить сохранённый день. Повторите ещё раз.';
    }finally{
      loadingDay=false;
    }
  }

  button.addEventListener('click',()=>{modal.hidden=false;modal.setAttribute('aria-hidden','false');document.documentElement.style.overflow='hidden';render();loadArchive();});
  grid.addEventListener('click',event=>{
    const target=event.target.closest?.('[data-archive-key]');
    if(target)openDay(target.getAttribute('data-archive-key'));
  });
  modal.querySelector('[data-archive-close]').addEventListener('click',close);
  modal.querySelector('.control-summary-archive-backdrop-r442').addEventListener('click',close);
  modal.querySelector('[data-archive-prev]').addEventListener('click',()=>{viewDate=new Date(Date.UTC(viewDate.getUTCFullYear(),viewDate.getUTCMonth()-1,1));render();});
  modal.querySelector('[data-archive-next]').addEventListener('click',()=>{viewDate=new Date(Date.UTC(viewDate.getUTCFullYear(),viewDate.getUTCMonth()+1,1));render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close();});
})();
