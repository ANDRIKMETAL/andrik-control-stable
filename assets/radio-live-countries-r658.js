(()=>{
  'use strict';
  if(window.__ANDRIK_RADIO_COUNTRIES_R658__)return;
  window.__ANDRIK_RADIO_COUNTRIES_R658__=true;

  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(v)||0));
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent';
  const getKey=()=>{try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}};
  const headers=()=>{const h={accept:'application/json'};const k=getKey();if(k)h.authorization=`Bearer ${k}`;return h};
  const set=(sel,text)=>qa(sel).forEach(el=>el.textContent=text);
  const now=()=>Date.now();
  const ISO_GEO={"BJ":[2.2847,9.1889],"UY":[-55.8183,-32.5312],"AE":[53.9882,24.2762],"PG":[148.5101,-6.5762],"SZ":[31.3741,-26.473],"OM":[55.904,21.5235],"BS":[-77.99,25.375],"LV":[24.6163,56.7926],"DK":[10.39,56.265],"HR":[16.5237,44.4919],"BD":[90.3786,23.5587],"ET":[40.3718,9.1907],"UG":[32.3077,1.4033],"DE":[10.5028,51.1428],"RW":[29.9205,-2.0263],"PR":[-66.4167,18.2336],"KP":[127.5228,40.3272],"KR":[127.7929,36.5011],"TZ":[34.8283,-6.3355],"UA":[31.0832,48.3483],"GL":[-42.7528,71.8409],"TJ":[71.2111,38.8492],"AU":[133.4542,-27.1514],"LT":[23.822,55.1391],"DZ":[1.6576,28.0879],"AF":[67.8432,33.9024],"MY":[109.6338,3.8506],"IT":[12.6151,41.8677],"NC":[165.5748,-21.2528],"LR":[-9.4893,6.4484],"MD":[28.322,46.9777],"IN":[82.7896,21.7298],"SO":[46.0575,5.1707],"CA":[-96.8229,62.4542],"JO":[37.059,31.2881],"BR":[-54.3586,-14.2619],"NO":[18.1427,69.368],"LK":[80.7416,7.8962],"SB":[159.445,-8.7129],"ML":[-3.9503,17.5355],"JM":[-77.2687,18.1127],"IQ":[43.6802,33.2421],"KZ":[66.9132,48.0238],"DO":[-70.1315,18.7417],"PH":[121.8558,12.0431],"AL":[20.1623,41.1566],"NE":[8.0994,17.5659],"BA":[17.6749,43.9419],"BF":[-1.6467,12.3635],"BW":[24.6638,-22.2452],"ZA":[24.5876,-28.4552],"LA":[103.8403,18.1729],"PL":[19.0523,51.9395],"MW":[34.23,-13.016],"FK":[-59.475,-51.7],"BG":[25.4693,42.7347],"GA":[11.6117,-0.826],"KH":[104.9813,12.5286],"TH":[101.4825,13.0546],"ZW":[29.057,-18.8897],"KW":[47.4924,29.2926],"SE":[17.4654,62.234],"SY":[39.0252,34.7714],"TW":[121.0287,23.633],"LS":[28.1622,-29.6463],"VN":[105.7529,15.9759],"PT":[-7.9578,39.5594],"CY":[33.1308,34.8725],"SA":[45.1495,24.2544],"LY":[17.2421,26.3587],"MZ":[35.4775,-18.5296],"TT":[-61.4225,10.445],"PE":[-75.038,-9.2026],"FJ":[178.7459,-17.1544],"EG":[30.7831,26.7928],"MA":[-9.0725,28.5904],"SS":[29.5925,7.8786],"TF":[69.64,-49.2],"SN":[-14.5465,14.4652],"BZ":[-88.668,17.1935],"SI":[15.1315,46.1524],"BN":[114.8274,4.7277],"NI":[-85.4079,12.8716],"SR":[-56.0014,3.9215],"GQ":[10.2953,1.647],"ES":[-3.1767,39.8476],"GM":[-15.3432,13.5034],"GY":[-58.9748,4.8176],"CI":[-5.5825,7.4312],"AZ":[47.5934,40.0655],"VU":[167.237,-15.6122],"LU":[5.9584,49.7854],"JP":[137.4758,38.2905],"BY":[27.9466,53.7443],"EE":[25.7357,58.5428],"BI":[29.8886,-3.4242],"GE":[43.2965,42.3088],"NL":[5.2035,52.1571],"UZ":[64.4922,41.3659],"SK":[19.7191,48.665],"HT":[-73.0414,18.9733],"ER":[39.7022,15.2269],"FR":[2.4838,46.2643],"TN":[9.5066,33.8288],"MG":[46.8654,-18.821],"PK":[69.3559,30.4125],"AT":[13.2298,47.7354],"LB":[35.8689,33.867],"NP":[84.1316,28.4103],"QA":[51.1753,25.3355],"GN":[-11.4812,9.9476],"MK":[21.7078,41.5815],"SL":[-11.7383,8.4164],"US":[-119.3779,45.137],"ID":[118.1634,-2.4401],"AM":[45.0442,39.9947],"CZ":[15.5466,49.8363],"BE":[4.3351,50.5023],"SV":[-88.9095,13.7866],"GT":[-90.2271,15.7773],"BT":[90.459,27.5079],"GH":[-1.0921,7.9044],"CD":[21.6782,-4.0006],"GR":[23.3771,38.3734],"VE":[-66.5316,6.4434],"CL":[-71.3022,-36.5959],"TL":[126.1523,-8.8333],"GF":[-53.0913,3.905],"IS":[-18.968,65.0116],"ZM":[27.6868,-13.0997],"EH":[-12.8643,24.3281],"FI":[26.0808,65.0053],"CN":[104.3508,35.8282],"AR":[-63.5219,-38.5412],"TG":[0.9077,8.4738],"BM":[-64.7656,32.3174],"EC":[-78.1007,-1.7891],"MR":[-10.9934,21.0063],"KG":[74.8624,41.2889],"TM":[59.5243,39.0111],"HU":[19.4564,47.1917],"IE":[-8.005,53.4005],"GB":[-2.9453,54.2975],"TR":[35.4187,38.9815],"NA":[18.4093,-22.9934],"BO":[-63.5444,-16.3175],"RO":[24.9234,45.9547],"MN":[103.762,46.8224],"RU":[104.8805,61.2009],"DJ":[42.4898,11.8133],"CH":[8.2327,46.8039],"PA":[-80.1042,8.4161],"MT":[14.3733,35.948],"MX":[-101.9699,23.6298],"NG":[8.6344,9.0533],"HN":[-86.2503,14.4951],"NZ":[172.5131,-40.546],"SD":[30.1734,15.3099],"TD":[18.7136,15.4158],"GW":[-15.189,11.8343],"PY":[-58.489,-23.4456],"YE":[47.8567,15.793],"KE":[37.8743,0.4146],"CO":[-72.9336,4.0696],"CM":[12.2508,7.2935],"CU":[-79.5765,21.522],"AO":[17.86,-11.1843],"CG":[14.7734,-0.6549],"CF":[20.9168,6.705],"IR":[53.7129,32.3956],"IL":[35.0509,31.3894],"CR":[-84.244,9.7211]};
  const regionNames=(()=>{try{return new Intl.DisplayNames(['ru'],{type:'region'})}catch(_){return null}})();
  const countryName=code=>{const c=String(code||'').trim().toUpperCase();try{return regionNames?.of(c)||c}catch(_){return c||'—'}};
  const countryFlag=code=>{const c=String(code||'').trim().toUpperCase();return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>127397+x.charCodeAt(0))):'🏳️'};
  let timer=null;

  function eventTime(item){
    const raw=item?.createdAt||item?.updatedAt||item?.at||item?.timestamp||item?.time||'';
    const t=Date.parse(raw||'');return Number.isFinite(t)?t:0;
  }
  function isRadioEvent(item){
    const t=String(item?.type||item?.kind||'').toLowerCase();
    return ['radio-open','youtube-open','youtube-live-open','live-open','radio-listen','stream-open'].includes(t);
  }
  function normPoint(item,label='LIVE эфир'){
    const latitude=Number(item?.latitude ?? item?.lat),longitude=Number(item?.longitude ?? item?.lon ?? item?.lng);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
    const city=String(item?.city||item?.region||item?.country||'Неизвестный город').trim();
    return {latitude,longitude,city,country:String(item?.country||'').trim().toUpperCase(),region:String(item?.region||'').trim(),value:Math.max(1,Number(item?.value||item?.count||1)),label,type:item?.type||'',time:eventTime(item)};
  }
  function livePoints(data){
    const direct=[];
    const radio=Array.isArray(data?.radio?.points)?data.radio.points:[];
    for(const item of radio){const p=normPoint(item,'LIVE радио');if(p)direct.push(p)}
    const recent=[...(Array.isArray(data?.radio?.recent)?data.radio.recent:[]),...(Array.isArray(data?.recent)?data.recent:[])];
    for(const item of recent){
      if(!isRadioEvent(item))continue;const t=eventTime(item);if(t&&now()-t>60*60*1000)continue;
      const p=normPoint(item,'LIVE открытие эфира');if(p)direct.push(p);
    }
    const merged=new Map();
    for(const p of direct){const key=`${p.country}|${p.city}|${p.latitude.toFixed(2)}|${p.longitude.toFixed(2)}`;const cur=merged.get(key)||{...p,value:0};cur.value+=p.value;cur.time=Math.max(cur.time||0,p.time||0);merged.set(key,cur)}
    return [...merged.values()].sort((a,b)=>b.value-a.value||b.time-a.time).slice(0,80);
  }
  function youtubeCountries(data){
    const daily=Array.isArray(data?.youtube?.dailyCountries)?data.youtube.dailyCountries:[];
    const rolling=Array.isArray(data?.youtube?.countries)?data.youtube.countries:[];
    const source=daily.length?daily:rolling;
    const period=daily.length?(data?.youtube?.dailyDate?`YouTube · ${data.youtube.dailyDate}`:'YouTube · вчера'):'YouTube · 28 дней';
    const rows=source.map(row=>({country:String(row?.country||'').toUpperCase(),views:Math.max(0,Number(row?.views||row?.value||0))}))
      .filter(row=>ISO_GEO[row.country]&&row.views>0).sort((a,b)=>b.views-a.views).slice(0,80);
    return {rows,period};
  }
  function pos(latitude,longitude){
    return {x:Math.max(0,Math.min(100,(longitude+180)/360*100)),y:Math.max(0,Math.min(100,(85-latitude)/145*100))};
  }
  function renderMap(points,countryData){
    const layer=q('[data-radio-city-map]'),empty=q('[data-radio-city-empty]'),cityList=q('[data-radio-city-list]'),countryList=q('[data-radio-country-list]');
    if(!layer||!empty||!cityList||!countryList)return;
    layer.innerHTML='';
    const countries=countryData.rows||[];
    const totalLive=points.reduce((s,p)=>s+p.value,0);
    set('[data-radio-country-count]',fmt(countries.length));
    set('[data-radio-event-count]',fmt(totalLive));
    set('[data-radio-country-period]',countryData.period||'YouTube');

    const maxCountry=Math.max(1,...countries.map(x=>x.views));
    for(const row of countries){
      const geo=ISO_GEO[row.country];if(!geo)continue;const [lon,lat]=geo;const {x,y}=pos(lat,lon);
      const dot=document.createElement('button');dot.type='button';dot.className='radio-country-dot';dot.dataset.count=String(row.views);
      const size=13+Math.round(12*Math.sqrt(row.views/maxCountry));dot.style.left=`${x.toFixed(2)}%`;dot.style.top=`${y.toFixed(2)}%`;dot.style.width=`${size}px`;dot.style.height=`${size}px`;
      dot.title=`${countryName(row.country)}: ${fmt(row.views)} просмотров · ${countryData.period}`;layer.appendChild(dot);
    }
    const maxLive=Math.max(1,...points.map(p=>p.value));
    for(const p of points){
      const {x,y}=pos(p.latitude,p.longitude);const dot=document.createElement('button');dot.type='button';dot.className='radio-city-dot';dot.dataset.count=String(p.value);
      dot.style.left=`${x.toFixed(2)}%`;dot.style.top=`${y.toFixed(2)}%`;dot.style.width=`${12+Math.round(8*p.value/maxLive)}px`;dot.style.height=dot.style.width;dot.title=`LIVE: ${p.city}${p.country?' · '+countryName(p.country):''}: ${p.value}`;layer.appendChild(dot);
    }

    const hasAny=countries.length||points.length;empty.hidden=Boolean(hasAny);
    if(!hasAny)empty.textContent='Пока нет географии. YouTube-страны появятся после следующего обновления Studio, LIVE-точки — после открытий эфира через сайт.';

    countryList.innerHTML=countries.length?countries.slice(0,10).map((r,i)=>`<div class="radio-city-row radio-country-row"><b>${countryFlag(r.country)}</b><div><strong>${esc(countryName(r.country))}</strong><small>${esc(countryData.period)} · просмотры</small></div><em>${fmt(r.views)}</em></div>`).join(''):'<div class="radio-list-empty">Пока нет стран YouTube.</div>';
    cityList.innerHTML=points.length?points.slice(0,8).map((p,i)=>`<div class="radio-city-row"><b>${i+1}</b><div><strong>${esc(p.city)}</strong><small>${esc([p.region,p.country?countryName(p.country):''].filter(Boolean).join(' · ')||'LIVE эфир')}</small></div><em>${fmt(p.value)}</em></div>`).join(''):'<div class="radio-list-empty">LIVE-городов за 60 минут пока нет.</div>';
  }
  async function fetchJson(path){
    const r=await fetch(path,{credentials:'include',cache:'no-store',headers:headers()}),d=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(d.error||d.message||`HTTP ${r.status}`),{status:r.status});return d;
  }
  async function loadViewers(){
    try{const d=await fetchJson(`/api/control/youtube-live-r565?active=1&ts=${Date.now()}`);set('[data-radio-live-viewers]',fmt(d?.concurrentViewers));return d}
    catch(_){set('[data-radio-live-viewers]','—');return null}
  }
  async function loadMap(){
    const state=q('[data-radio-city-state]');if(state)state.textContent='Обновляем…';
    try{
      const d=await fetchJson(`/api/control/ecosystem-map?ts=${Date.now()}`),points=livePoints(d),countryData=youtubeCountries(d);
      renderMap(points,countryData);
      if(state){state.textContent=points.length&&countryData.rows.length?'LIVE + страны':points.length?'LIVE · 60 мин':countryData.rows.length?countryData.period:'Нет географии';state.className='state '+((points.length||countryData.rows.length)?'service-access-state is-ready':'')}
    }catch(e){
      renderMap([],{rows:[],period:'YouTube'});const empty=q('[data-radio-city-empty]');if(empty)empty.textContent=e.status===401?'Нужен вход владельца для карты стран.':`Карта временно недоступна: ${e.message}`;
      if(state){state.textContent='Ошибка';state.className='state service-access-state is-error'}
    }
  }
  async function refresh(){await Promise.allSettled([loadViewers(),loadMap()])}
  refresh();timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
  window.AndrikRadioCountriesR658={refresh};
})();
