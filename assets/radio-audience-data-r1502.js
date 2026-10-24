/* R1502: shared, bounded requests for LIVE counters and dated history. */
(() => {
  'use strict';
  if (window.AndrikRadioDataR1502) return;
  const cache=new Map(),pending=new Map();
  const today=()=>{
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  function headers(authenticated=true){
    let key='';
    if(authenticated)try{key=localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||'';}catch(_){}
    return {accept:'application/json',...(key?{'x-admin-key':key,authorization:`Bearer ${key}`}:{})};
  }
  async function requestJson(url,{timeoutMs=20000,authenticated=true}={}){
    const controller=new AbortController();let timer;
    const work=(async()=>{
      const response=await fetch(url,{credentials:'include',cache:'no-store',headers:headers(authenticated),signal:controller.signal});
      let data;
      try{data=await response.json();}catch(_){throw Object.assign(new Error(`Сервер вернул нечитаемый ответ (HTTP ${response.status}).`),{status:response.status});}
      if(!response.ok||data?.ok===false)throw Object.assign(new Error(data?.message||data?.error||`HTTP ${response.status}`),{status:response.status,code:data?.code||data?.error||''});
      if(!data||typeof data!=='object')throw new Error('Сервер вернул пустой ответ статистики.');
      return data;
    })();
    const deadline=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        reject(Object.assign(new Error(`Нет ответа статистики за ${Math.round(timeoutMs/1000)} секунд. Повтори обновление.`),{code:'RADIO_REQUEST_TIMEOUT'}));
        controller.abort();
      },timeoutMs);
    });
    try{return await Promise.race([work,deadline]);}
    finally{clearTimeout(timer);}
  }
  async function shared(key,url,{force=false,maxAgeMs=15000,timeoutMs=20000}={}){
    const saved=cache.get(key);
    if(!force&&saved&&Date.now()-saved.at<maxAgeMs)return saved.data;
    if(pending.has(key))return pending.get(key);
    const work=requestJson(url,{timeoutMs}).then(data=>{
      cache.set(key,{at:Date.now(),data});
      if(cache.size>12)cache.delete(cache.keys().next().value);
      return data;
    });
    pending.set(key,work);
    try{return await work;}finally{if(pending.get(key)===work)pending.delete(key);}
  }
  function load(date='',{force=false}={}){
    const day=today(),selected=date&&date!==day?String(date):'';
    const qs=new URLSearchParams({ts:String(Date.now())});
    if(selected)qs.set('date',selected);
    return shared('day:'+(selected||day),`/api/control/radio-audience-r1157?${qs}`,{force,timeoutMs:25000});
  }
  function metrics({force=false}={}){
    return shared('metrics:U0bzXBNBs2Y',`/api/control/radio-metrics-r1484?id=U0bzXBNBs2Y&ts=${Date.now()}`,{force,maxAgeMs:45000,timeoutMs:25000});
  }
  window.AndrikRadioDataR1502=window.AndrikRadioDataR1483={load,metrics,requestJson,invalidate:()=>cache.clear()};
})();
