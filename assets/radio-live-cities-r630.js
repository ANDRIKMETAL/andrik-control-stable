(()=>{
  'use strict';
  if(window.__ANDRIK_RADIO_CITIES_R630__)return;
  window.__ANDRIK_RADIO_CITIES_R630__=true;

  const q=(s)=>document.querySelector(s);
  const qa=(s)=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const headers=()=>{const h={accept:'application/json'};const k=getKey();if(k)h.authorization=`Bearer ${k}`;return h};
  const set=(sel,text)=>qa(sel).forEach(el=>el.textContent=text);
  const now=()=>Date.now();
  let timer=null;

  function eventTime(item){
    const raw=item?.createdAt||item?.updatedAt||item?.at||item?.timestamp||item?.time||'';
    const t=Date.parse(raw||'');
    return Number.isFinite(t)?t:0;
  }
  function isRadioEvent(item){
    const t=String(item?.type||item?.kind||'').toLowerCase();
    return ['radio-open','youtube-open','youtube-live-open','live-open','radio-listen','stream-open'].includes(t);
  }
  function normPoint(item,label='LIVE эфир'){
    const latitude=Number(item?.latitude ?? item?.lat);
    const longitude=Number(item?.longitude ?? item?.lon ?? item?.lng);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
    const city=String(item?.city||item?.region||item?.country||'Неизвестный город').trim();
    const country=String(item?.country||'').trim();
    const region=String(item?.region||'').trim();
    return {latitude,longitude,city,country,region,value:Math.max(1,Number(item?.value||item?.count||1)),label,type:item?.type||'',time:eventTime(item)};
  }
  function livePoints(data){
    const direct=[];
    const radio=Array.isArray(data?.radio?.points)?data.radio.points:[];
    for(const item of radio){const p=normPoint(item,'LIVE радио');if(p)direct.push(p)}
    const recent=[...(Array.isArray(data?.radio?.recent)?data.radio.recent:[]),...(Array.isArray(data?.recent)?data.recent:[])];
    for(const item of recent){
      if(!isRadioEvent(item))continue;
      const t=eventTime(item);
      if(t && now()-t>60*60*1000)continue;
      const p=normPoint(item,'LIVE открытие эфира');if(p)direct.push(p);
    }
    const merged=new Map();
    for(const p of direct){
      const key=`${p.country}|${p.city}|${p.latitude.toFixed(2)}|${p.longitude.toFixed(2)}`;
      const cur=merged.get(key)||{...p,value:0};cur.value+=p.value;cur.time=Math.max(cur.time||0,p.time||0);merged.set(key,cur);
    }
    return [...merged.values()].sort((a,b)=>b.value-a.value||b.time-a.time).slice(0,80);
  }
  function pos(p){
    const x=Math.max(0,Math.min(100,(p.longitude+180)/360*100));
    const y=Math.max(0,Math.min(100,(85-p.latitude)/145*100));
    return {x,y};
  }
  function renderMap(points){
    const layer=q('[data-radio-city-map]');
    const empty=q('[data-radio-city-empty]');
    const list=q('[data-radio-city-list]');
    if(!layer||!empty||!list)return;
    layer.innerHTML='';
    if(!points.length){
      empty.hidden=false;
      empty.textContent='Пока нет LIVE-географии открытий эфира за последний час. Карта заполнится автоматически.';
      list.innerHTML='';
      set('[data-radio-city-count]','0');set('[data-radio-event-count]','0');
      return;
    }
    empty.hidden=true;
    const total=points.reduce((s,p)=>s+p.value,0);
    set('[data-radio-city-count]',fmt(points.length));set('[data-radio-event-count]',fmt(total));
    const max=Math.max(1,...points.map(p=>p.value));
    for(const p of points){
      const {x,y}=pos(p);const dot=document.createElement('button');dot.type='button';dot.className='radio-city-dot';dot.dataset.count=String(p.value);dot.style.left=`${x.toFixed(2)}%`;dot.style.top=`${y.toFixed(2)}%`;dot.style.width=`${12+Math.round(8*p.value/max)}px`;dot.style.height=dot.style.width;dot.title=`${p.city}${p.country?' · '+p.country:''}: ${p.value}`;layer.appendChild(dot);
    }
    list.innerHTML=points.slice(0,8).map((p,i)=>`<div class="radio-city-row"><b>${i+1}</b><div><strong>${esc(p.city)}</strong><small>${esc([p.region,p.country].filter(Boolean).join(' · ')||'LIVE эфир')}</small></div><em>${fmt(p.value)}</em></div>`).join('');
  }
  async function fetchJson(path){
    const r=await fetch(path,{credentials:'include',cache:'no-store',headers:headers()});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(d.error||d.message||`HTTP ${r.status}`),{status:r.status});
    return d;
  }
  async function loadViewers(){
    try{
      const d=await fetchJson(`/api/control/youtube-live-r565?active=1&ts=${Date.now()}`);
      set('[data-radio-live-viewers]',fmt(d?.concurrentViewers));
      return d;
    }catch(_){set('[data-radio-live-viewers]','—');return null}
  }
  async function loadMap(){
    const state=q('[data-radio-city-state]');
    if(state)state.textContent='Обновляем…';
    try{
      const d=await fetchJson(`/api/control/ecosystem-map?ts=${Date.now()}`);
      const points=livePoints(d);renderMap(points);
      if(state){state.textContent=points.length?'LIVE · 60 мин':'Нет LIVE-точек';state.className='state '+(points.length?'service-access-state is-ready':'')}
    }catch(e){
      renderMap([]);
      const empty=q('[data-radio-city-empty]');if(empty)empty.textContent=e.status===401?'Нужен вход владельца для карты городов.':`Карта временно недоступна: ${e.message}`;
      if(state){state.textContent='Ошибка';state.className='state service-access-state is-error'}
    }
  }
  async function refresh(){await Promise.allSettled([loadViewers(),loadMap()])}
  refresh();timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  window.AndrikRadioCitiesR630={refresh};
})();
