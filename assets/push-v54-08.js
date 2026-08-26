(() => {
  if (window.__ANDRIK_PUSH_V54_08__) return;
  window.__ANDRIK_PUSH_V54_08__ = true;
  // Push must be initialized only in the top-level site window.
  if (window.self !== window.top) return;

  const CONFIG_URL = '/api/push/config';
  const REGISTER_URL = '/api/push/subscriber';
  const lang = (document.documentElement.lang || 'ru').toLowerCase().split('-')[0];
  const copy = {
    ru:{
      on:'Уведомления включены',
      off:'Включить уведомления',
      unsupported:'Уведомления не поддерживаются',
      failed:'Не удалось включить уведомления',
      introTitle:'Включить уведомления ANDRIK?',
      introText:'Мы будем присылать только новые релизы и важные обновления. На следующем шаге Chrome покажет системное окно — нажмите «Разрешить» (Allow).',
      introAllow:'Включить уведомления',
      introLater:'Позже',
      welcomeTitle:'✅ Спасибо за подписку!',
      welcomeBody:'Новые песни будут приходить прямо на телефон.',
      successTitle:'✅ Спасибо за подписку!',
      successText:'Теперь новые песни будут приходить автоматически прямо на телефон.',
      successOk:'Отлично'
    },
    uk:{
      on:'Сповіщення ввімкнено',
      off:'Увімкнути сповіщення',
      unsupported:'Сповіщення не підтримуються',
      failed:'Не вдалося ввімкнути сповіщення',
      introTitle:'Увімкнути сповіщення ANDRIK?',
      introText:'Ми надсилатимемо лише нові релізи та важливі оновлення. На наступному кроці Chrome покаже системне вікно — натисніть «Дозволити» (Allow).',
      introAllow:'Увімкнути сповіщення',
      introLater:'Пізніше',
      welcomeTitle:'✅ Дякуємо за підписку!',
      welcomeBody:'Нові пісні надходитимуть прямо на телефон.',
      successTitle:'✅ Дякуємо за підписку!',
      successText:'Тепер нові пісні надходитимуть автоматично прямо на телефон.',
      successOk:'Чудово'
    },
    sk:{
      on:'Upozornenia sú zapnuté',
      off:'Zapnúť upozornenia',
      unsupported:'Upozornenia nie sú podporované',
      failed:'Upozornenia sa nepodarilo zapnúť',
      introTitle:'Zapnúť upozornenia ANDRIK?',
      introText:'Budeme posielať iba nové vydania a dôležité aktualizácie. V ďalšom kroku Chrome zobrazí systémové okno — stlačte „Povoliť“ (Allow).',
      introAllow:'Zapnúť upozornenia',
      introLater:'Neskôr',
      welcomeTitle:'✅ Ďakujeme za odber!',
      welcomeBody:'Nové piesne budú prichádzať priamo do telefónu.',
      successTitle:'✅ Ďakujeme za odber!',
      successText:'Nové piesne vám teraz budú automaticky prichádzať priamo do telefónu.',
      successOk:'Super'
    },
    en:{
      on:'Notifications enabled',
      off:'Enable notifications',
      unsupported:'Notifications are not supported',
      failed:'Could not enable notifications',
      introTitle:'Enable ANDRIK notifications?',
      introText:'We will only send new releases and important updates. On the next step Chrome will show the system dialog — tap “Allow”.',
      introAllow:'Enable notifications',
      introLater:'Later',
      welcomeTitle:'✅ Thanks for subscribing!',
      welcomeBody:'New songs will arrive directly on your phone.',
      successTitle:'✅ Thanks for subscribing!',
      successText:'New songs will now arrive automatically directly on your phone.',
      successOk:'Great'
    }
  }[lang] || null;
  const t = copy || {
    on:'Уведомления включены',off:'Включить уведомления',unsupported:'Уведомления не поддерживаются',failed:'Не удалось включить уведомления',
    introTitle:'Включить уведомления ANDRIK?',introText:'Мы будем присылать только новые релизы и важные обновления. На следующем шаге Chrome покажет системное окно — нажмите «Разрешить» (Allow).',
    introAllow:'Включить уведомления',introLater:'Позже',welcomeTitle:'✅ Спасибо за подписку!',welcomeBody:'Новые песни будут приходить прямо на телефон.',successTitle:'✅ Спасибо за подписку!',successText:'Теперь новые песни будут приходить автоматически прямо на телефон.',successOk:'Отлично'
  };
  const WELCOME_PREFIX = 'andrik-push-welcomed:';
  let sdk = null;
  let config = null;
  let readyPromise = null;
  let originMismatch = false;
  let configuredOrigin = '';

  function addStyle(){
    if(document.getElementById('andrik-push-style')) return;
    const style=document.createElement('style');
    style.id='andrik-push-style';
    style.textContent=`
      .andrik-push-btn{position:relative}
      .andrik-push-btn svg{width:22px;height:22px;fill:currentColor}
      .andrik-push-btn[data-state="on"]{color:#9df0c6!important;border-color:rgba(103,228,163,.52)!important;box-shadow:0 0 26px rgba(75,215,144,.17)!important}
      .andrik-push-btn[data-state="busy"]{pointer-events:none;opacity:.62}
      .andrik-push-btn[data-state="busy"] svg{animation:andrikPushSpin 1s linear infinite}
      @keyframes andrikPushSpin{to{transform:rotate(360deg)}}
      .admin-push-status{color:#b9d8e8;font-size:.92rem;line-height:1.5}
      .andrik-push-intro{position:fixed;inset:0;z-index:2500;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
      .andrik-push-intro[hidden]{display:none!important}
      .andrik-push-intro-card{width:min(460px,100%);padding:24px 22px 20px;border-radius:24px;border:1px solid rgba(166,220,245,.18);background:linear-gradient(180deg,rgba(7,20,31,.97),rgba(5,10,17,.98));box-shadow:0 24px 70px rgba(0,0,0,.45);color:#eef8ff}
      .andrik-push-intro-card h3{margin:0 0 10px;font-size:clamp(1.28rem,5vw,1.56rem);line-height:1.1}
      .andrik-push-intro-card p{margin:0;color:#b8ccda;font-size:.98rem;line-height:1.6}
      .andrik-push-intro-note{display:flex;align-items:center;gap:10px;margin:16px 0 0;padding:12px 14px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(143,198,226,.12);color:#dbeef8;font-size:.9rem}
      .andrik-push-intro-note strong{color:#fff}
      .andrik-push-intro-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
      .andrik-push-intro-btn{appearance:none;border:none;border-radius:999px;padding:13px 16px;font:inherit;font-weight:800;cursor:pointer;transition:transform .18s ease,opacity .18s ease,box-shadow .18s ease}
      .andrik-push-intro-btn:hover{transform:translateY(-1px)}
      .andrik-push-intro-btn-primary{background:linear-gradient(180deg,#e7f6ff,#bddcff);color:#05111d;box-shadow:0 10px 28px rgba(98,177,226,.22)}
      .andrik-push-intro-btn-secondary{background:transparent;color:#d2e8f6;border:1px solid rgba(160,210,235,.24)}
      .andrik-push-success-mark{font-size:2.2rem;line-height:1;margin-bottom:12px;filter:drop-shadow(0 0 14px rgba(96,232,161,.28))}
      .andrik-push-success-card{text-align:center}
      .andrik-push-success-card p{white-space:pre-line}
      .andrik-push-success-card .andrik-push-intro-actions{grid-template-columns:1fr}
      @media(max-width:560px){.andrik-push-intro-card{padding:20px 18px 18px;border-radius:22px}.andrik-push-intro-actions{grid-template-columns:1fr}.andrik-push-intro-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }
  function bellSvg(){return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 22a2.4 2.4 0 0 0 2.3-1.7H9.7A2.4 2.4 0 0 0 12 22Zm7-5.2-1.8-2.1V10a5.3 5.3 0 0 0-4.2-5.2V4a1 1 0 0 0-2 0v.8A5.3 5.3 0 0 0 6.8 10v4.7L5 16.8V19h14v-2.2Z"></path></svg>'}
  function findHost(){return document.querySelector('.top-actions') || document.querySelector('.nav-tools')}
  function ensureButton(){
    let btn=document.querySelector('.andrik-push-btn'); if(btn) return btn;
    const host=findHost(); if(!host || document.body.classList.contains('comments-admin-page')) return null;
    btn=document.createElement('button');
    btn.type='button';
    btn.className='icon-button icon-btn andrik-push-btn';
    btn.innerHTML=bellSvg();
    btn.dataset.state='off';
    btn.setAttribute('aria-label',t.off);
    btn.title=t.off;
    host.insertBefore(btn,host.lastElementChild || null);
    btn.addEventListener('click',()=>window.AndrikPush?.requestPermissionFlow());
    return btn;
  }
  function setButtonState(state,title){const btn=ensureButton(); if(!btn)return; btn.dataset.state=state; btn.setAttribute('aria-label',title); btn.title=title}
  async function syncSubscription(subscriptionId,active=true){
    const id=String(subscriptionId||'').trim();
    if(!id)return null;
    try{
      let ownerKey='';
      try{ownerKey=localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key')||''}catch(_){}
      const headers={'content-type':'application/json'};
      if(ownerKey)headers.authorization=`Bearer ${ownerKey}`;
      const response=await fetch(REGISTER_URL,{method:'POST',headers,body:JSON.stringify({subscriptionId:id,active:Boolean(active),source:'site',label:navigator.userAgent.slice(0,110)}),cache:'no-store',keepalive:true});
      if(!response.ok)throw new Error(`push-register-${response.status}`);
      return await response.json();
    }catch(error){console.warn('ANDRIK push register:',error);return null}
  }
  function loadSdkScript(){
    return new Promise((resolve,reject)=>{
      if(window.OneSignalDeferred && document.querySelector('script[data-andrik-onesignal]')) return resolve();
      window.OneSignalDeferred=window.OneSignalDeferred||[];
      const s=document.createElement('script'); s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer=true; s.dataset.andrikOnesignal='1'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
  }
  function buildIntroDialog(){
    let root=document.getElementById('andrikPushIntro');
    if(root) return root;
    root=document.createElement('div');
    root.id='andrikPushIntro';
    root.className='andrik-push-intro';
    root.hidden=true;
    root.innerHTML=`<div class="andrik-push-intro-card" role="dialog" aria-modal="true" aria-labelledby="andrikPushIntroTitle"><h3 id="andrikPushIntroTitle">${t.introTitle}</h3><p>${t.introText}</p><div class="andrik-push-intro-note"><span aria-hidden="true">🔔</span><span><strong>ANDRIK</strong> · ${t.off}</span></div><div class="andrik-push-intro-actions"><button type="button" class="andrik-push-intro-btn andrik-push-intro-btn-primary" data-action="allow">${t.introAllow}</button><button type="button" class="andrik-push-intro-btn andrik-push-intro-btn-secondary" data-action="later">${t.introLater}</button></div></div>`;
    document.body.appendChild(root);
    return root;
  }
  function showPermissionIntro(){
    const root=buildIntroDialog();
    root.hidden=false;
    document.body.style.overflow='hidden';
    const primary=root.querySelector('[data-action="allow"]');
    const secondary=root.querySelector('[data-action="later"]');
    primary?.focus();
    return new Promise(resolve=>{
      const cleanup=(result)=>{
        root.hidden=true;
        document.body.style.overflow='';
        root.removeEventListener('click',onClick);
        document.removeEventListener('keydown',onKey);
        resolve(result);
      };
      const onClick=(event)=>{
        const action=event.target?.closest?.('[data-action]')?.dataset?.action;
        if(action==='allow') cleanup(true);
        if(action==='later') cleanup(false);
        if(event.target===root) cleanup(false);
      };
      const onKey=(event)=>{
        if(event.key==='Escape') cleanup(false);
      };
      root.addEventListener('click',onClick);
      document.addEventListener('keydown',onKey);
    });
  }
  function buildSuccessDialog(){
    let root=document.getElementById('andrikPushSuccess');
    if(root) return root;
    root=document.createElement('div');
    root.id='andrikPushSuccess';
    root.className='andrik-push-intro';
    root.hidden=true;
    root.innerHTML=`<div class="andrik-push-intro-card andrik-push-success-card" role="dialog" aria-modal="true" aria-labelledby="andrikPushSuccessTitle"><div class="andrik-push-success-mark" aria-hidden="true">✅</div><h3 id="andrikPushSuccessTitle">${t.successTitle.replace(/^✅\s*/, '')}</h3><p>${t.successText}</p><div class="andrik-push-intro-actions"><button type="button" class="andrik-push-intro-btn andrik-push-intro-btn-primary" data-action="close">${t.successOk}</button></div></div>`;
    document.body.appendChild(root);
    return root;
  }
  function showSubscriptionSuccess(){
    const root=buildSuccessDialog();
    root.hidden=false;
    document.body.style.overflow='hidden';
    root.querySelector('[data-action="close"]')?.focus();
    return new Promise(resolve=>{
      const close=()=>{root.hidden=true;document.body.style.overflow='';root.removeEventListener('click',onClick);document.removeEventListener('keydown',onKey);resolve();};
      const onClick=(event)=>{if(event.target===root || event.target?.closest?.('[data-action="close"]')) close();};
      const onKey=(event)=>{if(event.key==='Escape' || event.key==='Enter') close();};
      root.addEventListener('click',onClick);
      document.addEventListener('keydown',onKey);
    });
  }
  async function showWelcomeNotification(){
    // v54.05: confirmation is shown inside the site only. System welcome
    // notifications are disabled to prevent duplicate English messages.
    await clearGenericWelcomeNotifications();
  }

  const GENERIC_WELCOME_RE = /thanks\s+for\s+subscribing|спасибо\s+за\s+подписку|дякуємо\s+за\s+підписку|ďakujeme\s+za\s+odber/i;

  async function cleanupLegacyPushSubscriptions(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const desiredScope = new URL(config?.serviceWorkerScope || '/push/onesignal/', location.origin).href;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(async registration => {
        // Keep the current OneSignal worker. Old root/legacy workers may still
        // hold an additional browser PushSubscription and cause duplicates.
        if(registration.scope === desiredScope) return;
        try{
          const subscription = await registration.pushManager?.getSubscription?.();
          if(subscription) await subscription.unsubscribe();
        }catch(error){console.warn('ANDRIK legacy push cleanup:', error)}
      }));
    }catch(error){console.warn('ANDRIK push registrations:', error)}
  }

  async function clearGenericWelcomeNotifications(){
    if(!('serviceWorker' in navigator)) return;
    try{
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(async registration => {
        try{
          const notifications = await registration.getNotifications();
          notifications.forEach(notification => {
            const text = `${notification.title || ''} ${notification.body || ''}`;
            if(GENERIC_WELCOME_RE.test(text)) notification.close();
          });
        }catch(_){}
      }));
    }catch(_){}
  }

  async function init(){
    if(readyPromise) return readyPromise;
    readyPromise=(async()=>{
      addStyle();
      const response=await fetch(CONFIG_URL,{cache:'no-store',headers:{accept:'application/json'}});
      if(!response.ok) throw new Error('push-config');
      config=await response.json();
      if(!config.enabled || !config.appId) return null;
      try { configuredOrigin = new URL(config.siteOrigin || location.origin).origin; } catch (_) { configuredOrigin = location.origin; }
      originMismatch = location.origin !== configuredOrigin;
      if(originMismatch) return null;
      await cleanupLegacyPushSubscriptions();
      await clearGenericWelcomeNotifications();
      ensureButton(); setButtonState('busy',t.off);
      await loadSdkScript();
      await new Promise((resolve,reject)=>{
        window.OneSignalDeferred.push(async function(OneSignal){
          try{
            await OneSignal.init({
              appId:config.appId,
              serviceWorkerPath:config.serviceWorkerPath || 'push/onesignal/OneSignalSDKWorker.js',
              serviceWorkerParam:{scope:config.serviceWorkerScope || '/push/onesignal/'},
              notifyButton:{enable:false},
              welcomeNotification:{disable:true},
              allowLocalhostAsSecureOrigin:false,
              autoResubscribe:true
            });
            sdk=OneSignal;
            try{await OneSignal.User.setLanguage(lang)}catch(_){}
            const update=()=>{
              const optedIn=Boolean(OneSignal.User.PushSubscription.optedIn);
              const id=OneSignal.User.PushSubscription.id||'';
              setButtonState(optedIn?'on':'off',optedIn?t.on:t.off);
              if(id)syncSubscription(id,optedIn);
            };
            update();
            OneSignal.User.PushSubscription.addEventListener('change',update);
            let currentId=OneSignal.User.PushSubscription.id||'';
            if(currentId)await syncSubscription(currentId,Boolean(OneSignal.User.PushSubscription.optedIn));
            else if(typeof Notification!=='undefined' && Notification.permission==='granted'){
              // R673: old cache-reset pages removed the OneSignal worker. Recover
              // the subscription automatically when permission is still granted.
              try{
                await ensureOneSignalWorkerR675();
                await OneSignal.User.PushSubscription.optIn();
                currentId=await waitForSubscriptionId(OneSignal,20000);
                if(currentId)await syncSubscription(currentId,true);
              }catch(error){console.warn('ANDRIK OneSignal auto-resubscribe R675:',error)}
            }
            resolve();
          }catch(error){reject(error)}
        });
      });
      return sdk;
    })().catch(error=>{console.warn('ANDRIK push init:',error); setButtonState('off',t.failed); return null});
    return readyPromise;
  }
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitForSubscriptionId(OneSignal, timeoutMs=30000){
    const first=String(OneSignal?.User?.PushSubscription?.id||'').trim();
    if(first)return first;
    return await new Promise(resolve=>{
      let finished=false;
      let interval=null;
      let timeout=null;
      const finish=id=>{
        if(finished)return; finished=true;
        if(interval)clearInterval(interval); if(timeout)clearTimeout(timeout);
        try{OneSignal?.User?.PushSubscription?.removeEventListener?.('change',onChange)}catch(_){}
        resolve(id||null);
      };
      const check=()=>{const id=String(OneSignal?.User?.PushSubscription?.id||'').trim();if(id)finish(id)};
      const onChange=()=>check();
      try{OneSignal?.User?.PushSubscription?.addEventListener?.('change',onChange)}catch(_){}
      interval=setInterval(check,400);
      timeout=setTimeout(()=>finish(null),timeoutMs);
      check();
    });
  }
  async function ensureOneSignalWorkerR675(){
    if(!('serviceWorker' in navigator))return null;
    const scope=String(config?.serviceWorkerScope||'/push/onesignal/');
    const rawPath=String(config?.serviceWorkerPath||'/push/onesignal/OneSignalSDKWorker.js');
    const workerUrl=new URL(rawPath, location.origin+'/').pathname; window.__andrikPushWorkerError='';
    try{
      let registration=await navigator.serviceWorker.getRegistration(scope);
      if(!registration){
        registration=await navigator.serviceWorker.register(workerUrl,{scope,updateViaCache:'none'});
      }else{
        try{await registration.update()}catch(_){}
      }
      const started=Date.now();
      while(!registration.active && Date.now()-started<12000){await sleep(300)}
      return registration;
    }catch(error){window.__andrikPushWorkerError=String(error?.message||error||'worker-register-failed');console.warn('ANDRIK OneSignal worker R675:',error);return null}
  }
  async function repairSubscription(existingSdk=null){
    const OneSignal=existingSdk||await init();
    if(!OneSignal)return null;
    let id=String(OneSignal.User.PushSubscription.id||'').trim();
    if(id)return id;
    const permission=(typeof Notification!=='undefined'?Notification.permission:'default');
    if(permission==='granted'){
      await ensureOneSignalWorkerR675();
      try{await OneSignal.Notifications.requestPermission({fallbackToSettings:true})}catch(_){}
      try{await OneSignal.User.PushSubscription.optIn()}catch(error){console.warn('ANDRIK OneSignal optIn R675:',error)}
      id=await waitForSubscriptionId(OneSignal,9000);
      if(id)return id;
      // One retry clears an SDK-level opt-out but keeps the browser permission
      // and the dedicated OneSignal worker intact.
      try{await OneSignal.User.PushSubscription.optOut()}catch(_){}
      await sleep(700);
      try{await OneSignal.User.PushSubscription.optIn()}catch(_){}
      id=await waitForSubscriptionId(OneSignal,9000);
      return id||null;
    }
    try{await OneSignal.User.PushSubscription.optIn()}catch(_){}
    return await waitForSubscriptionId(OneSignal,9000);
  }
  async function subscribe(skipIntro=false){
    const OneSignal=await init(); if(!OneSignal){setButtonState('off',t.unsupported);return null}
    setButtonState('busy',t.off);
    try{
      if(!OneSignal.Notifications.isPushSupported()) throw new Error('unsupported');
      const needsIntro = !skipIntro && typeof Notification !== 'undefined' && Notification.permission === 'default' && !OneSignal.User.PushSubscription.optedIn;
      if(needsIntro){
        const allowed = await showPermissionIntro();
        if(!allowed){
          setButtonState(OneSignal.User.PushSubscription.optedIn?'on':'off',OneSignal.User.PushSubscription.optedIn?t.on:t.off);
          return null;
        }
      }
      let id=String(OneSignal.User.PushSubscription.id||'').trim();
      if(!id)id=await repairSubscription(OneSignal);
      if(id){
        await syncSubscription(id,true);
        await clearGenericWelcomeNotifications();
        setTimeout(clearGenericWelcomeNotifications,450);
        setTimeout(clearGenericWelcomeNotifications,1400);
        await showSubscriptionSuccess();
        setButtonState('on',t.on);
        return id;
      }
      setButtonState('off',t.failed);
      return null;
    }catch(error){console.warn(error);setButtonState('off',error.message==='unsupported'?t.unsupported:t.failed);return null}
  }
  async function requestPermissionFlow(){
    const state=await status();
    if(state?.optedIn){setButtonState('on',t.on);return state.subscriptionId || null}
    return await subscribe(false);
  }
  async function hardResetSubscription(){
    if(originMismatch)return false;
    try{
      const desiredScope=new URL(config?.serviceWorkerScope||'/push/onesignal/',location.origin).href;
      if('serviceWorker' in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations();
        for(const registration of registrations){
          if(registration.scope!==desiredScope)continue;
          try{const sub=await registration.pushManager?.getSubscription?.();if(sub)await sub.unsubscribe()}catch(_){}
          try{await registration.unregister()}catch(_){}
        }
      }
      try{
        if(indexedDB?.databases){
          const dbs=await indexedDB.databases();
          for(const item of dbs||[]){if(/onesignal/i.test(String(item?.name||''))&&item.name)indexedDB.deleteDatabase(item.name)}
        }
      }catch(_){}
      try{
        for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key&&/onesignal/i.test(key))localStorage.removeItem(key)}
      }catch(_){}
      sdk=null; readyPromise=null;
      return true;
    }catch(error){console.warn('ANDRIK push hard reset:',error);return false}
  }
  async function getSubscriptionId(){const OneSignal=await init();return OneSignal?.User?.PushSubscription?.id || null}
  async function status(){
    const OneSignal=await init();
    let nativeSubscription=false,workerActive=false;
    try{
      const scope=config?.serviceWorkerScope||'/push/onesignal/';
      const registration=await navigator.serviceWorker?.getRegistration?.(scope);
      workerActive=Boolean(registration?.active);
      nativeSubscription=Boolean(await registration?.pushManager?.getSubscription?.());
    }catch(_){}
    return {configured:Boolean(config?.enabled),supported:Boolean(OneSignal?.Notifications?.isPushSupported?.()),browserPermission:(typeof Notification!=='undefined'?Notification.permission:'unknown'),optedIn:Boolean(OneSignal?.User?.PushSubscription?.optedIn),subscriptionId:OneSignal?.User?.PushSubscription?.id || null,pushToken:OneSignal?.User?.PushSubscription?.token || null,nativeSubscription,workerActive,workerError:String(window.__andrikPushWorkerError||''),originMismatch,siteOrigin:configuredOrigin || config?.siteOrigin || ''}
  }
  window.AndrikPush={init,subscribe,repairSubscription,hardResetSubscription,getSubscriptionId,status,syncSubscription,requestPermissionFlow,cleanupLegacyPushSubscriptions,clearGenericWelcomeNotifications};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
