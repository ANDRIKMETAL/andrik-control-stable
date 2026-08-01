/* Control ANDRIK v55.00 FINAL STABLE GITHUB — runtime cache recovery. */
(() => {
  'use strict';
  const VERSION='55.00-final-stable-github';
  const KEY='andrik-control-runtime-version';
  const ONCE='andrik-control-runtime-reload-final-stable-github';
  if(location.hostname.toLowerCase()!=='control.andrikmetal.com')return;

  async function clearAllCaches(){
    if(!('caches' in window))return;
    const names=await caches.keys();
    await Promise.all(names.map(name=>caches.delete(name).catch(()=>false)));
  }
  async function removeOldWorkers(){
    if(!('serviceWorker' in navigator))return;
    const registrations=await navigator.serviceWorker.getRegistrations().catch(()=>[]);
    for(const registration of registrations){
      const script=String(registration.active?.scriptURL||registration.waiting?.scriptURL||registration.installing?.scriptURL||'');
      if(/OneSignalSDK|\/push\/onesignal\//i.test(script))continue;
      registration.active?.postMessage?.({type:'CLEAR_ALL_CACHES'});
      registration.waiting?.postMessage?.({type:'CLEAR_ALL_CACHES'});
      await registration.unregister().catch(()=>false);
    }
  }

  (async()=>{
    try{
      if(localStorage.getItem(KEY)===VERSION)return;
      await clearAllCaches();
      await removeOldWorkers();
      for(const key of Object.keys(localStorage)){
        if(/andrik-control-(home-last-good|youtube-pane|youtube-monitor|system-cache|runtime-version)/i.test(key))localStorage.removeItem(key);
      }
      localStorage.setItem(KEY,VERSION);
      if(sessionStorage.getItem(ONCE)==='1')return;
      sessionStorage.setItem(ONCE,'1');
      const url=new URL(location.href);
      url.searchParams.set('v',VERSION);
      url.searchParams.set('fresh',String(Date.now()));
      location.replace(url.toString());
    }catch(error){console.warn('Control runtime cache reset R3U:',error)}
  })();
})();
