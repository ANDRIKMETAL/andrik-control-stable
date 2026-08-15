/* ANDRIK R440 — calendar navigation for stored daily summaries. */
(()=>{
  'use strict';
  const button=document.getElementById('controlSummaryArchiveR440');
  if(!button)return;
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const params=new URLSearchParams(location.search);
  const selectedKey=/^\d{4}-\d{2}-\d{2}$/.test(String(params.get('summaryWindow')||''))?String(params.get('summaryWindow')):'';
  const ruMonth=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'});
  const modal=document.createElement('div');
  modal.className='control-summary-archive-modal-r440';
  modal.id='controlSummaryArchiveModalR440';
  modal.hidden=true;
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<button class="control-summary-archive-backdrop-r440" type="button" aria-label="Закрыть архив"></button><section class="control-summary-archive-panel-r440" role="dialog" aria-modal="true" aria-label="Архив сводок"><header class="control-summary-archive-head-r440"><button type="button" data-archive-prev aria-label="Предыдущий месяц">‹</button><div class="control-summary-archive-month-r440" data-archive-month>Архив</div><button type="button" data-archive-next aria-label="Следующий месяц">›</button><button type="button" data-archive-close aria-label="Закрыть">×</button></header><div class="control-summary-archive-week-r440"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="control-summary-archive-grid-r440" data-archive-grid></div><div class="control-summary-archive-status-r440" data-archive-status>Загружаем сохранённые дни…</div><div class="control-summary-archive-legend-r440">Зелёные даты — сохранённая сводка. Архив хранит завершённые циклы 06:05 → 06:05.</div></section>`;
  document.body.appendChild(modal);
  const grid=modal.querySelector('[data-archive-grid]');
  const monthLabel=modal.querySelector('[data-archive-month]');
  const status=modal.querySelector('[data-archive-status]');
  const available=new Map();
  let loaded=false;
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
    for(let i=0;i<start;i++)cells.push('<span class="control-summary-archive-day-r440 is-empty"></span>');
    for(let d=1;d<=days;d++){
      const key=keyFor(y,m,d),entry=available.get(key);
      if(entry){
        const cls=`control-summary-archive-day-r440 is-available${key===selectedKey?' is-selected':''}`;
        const tip=`Открыть сохранённую сводку за ${String(d).padStart(2,'0')}.${String(m+1).padStart(2,'0')}.${y}`;
        const href=`/control-home.html?page=summary&source=push&archive=1&summaryWindow=${encodeURIComponent(key)}&v=55.00-r440`;
        cells.push(`<a class="${cls}" href="${href}" title="${tip}">${d}</a>`);
      }else cells.push(`<span class="control-summary-archive-day-r440">${d}</span>`);
    }
    grid.innerHTML=cells.join('');
    if(loaded)status.textContent=available.size?`Сохранено дней: ${available.size}`:'Архив пока пуст.';
  }
  async function loadArchive(){
    if(loaded)return;
    const key=getKey();
    if(!key){status.textContent='Ключ владельца не сохранён.';loaded=true;return;}
    try{
      const response=await fetch(`/api/control/daily-summary/archive?v=55.00-r440&t=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json',authorization:`Bearer ${key}`}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.details||data?.error||`HTTP ${response.status}`);
      for(const entry of Array.isArray(data.entries)?data.entries:[]){if(/^\d{4}-\d{2}-\d{2}$/.test(String(entry?.key||'')))available.set(entry.key,entry);}
      loaded=true;
      if(!selectedKey&&available.size){const newest=[...available.keys()].sort().reverse()[0];viewDate=new Date(`${newest.slice(0,7)}-01T00:00:00Z`);}
      render();
    }catch(error){loaded=true;status.textContent=`Не удалось открыть архив: ${String(error?.message||error)}`;}
  }
  button.addEventListener('click',()=>{modal.hidden=false;modal.setAttribute('aria-hidden','false');document.documentElement.style.overflow='hidden';render();loadArchive();});
  modal.querySelector('[data-archive-close]').addEventListener('click',close);
  modal.querySelector('.control-summary-archive-backdrop-r440').addEventListener('click',close);
  modal.querySelector('[data-archive-prev]').addEventListener('click',()=>{viewDate=new Date(Date.UTC(viewDate.getUTCFullYear(),viewDate.getUTCMonth()-1,1));render();});
  modal.querySelector('[data-archive-next]').addEventListener('click',()=>{viewDate=new Date(Date.UTC(viewDate.getUTCFullYear(),viewDate.getUTCMonth()+1,1));render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close();});
})();
