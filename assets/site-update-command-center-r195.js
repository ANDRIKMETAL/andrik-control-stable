(()=>{
  'use strict';

  // R466: safety guard for Android/WebView installs. The backup endpoint can
  // finish creating the GitHub tag while its HTTP request stays open. Never let
  // step 2 block the whole updater indefinitely: wait up to 60s, then verify the
  // freshly-created backup through the existing history API and synthesize the
  // successful response for the original R247 installer. If verification fails,
  // return a normal JSON error so the UI unlocks instead of spinning forever.
  if(!window.__ANDRIK_BACKUP_GUARD_R466__){
    window.__ANDRIK_BACKUP_GUARD_R466__=true;
    const nativeFetch=window.fetch.bind(window);
    const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const urlOf=input=>{
      try{return new URL(typeof input==='string'?input:(input?.url||String(input)),location.href)}catch(_){return null}
    };
    const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{
      status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
    });
    const safeLabel=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');

    window.fetch=async function andrikFetchR466(input,init={}){
      const url=urlOf(input);
      const method=String(init?.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
      if(!url||url.pathname!=='/api/control/site-update/backup'||method!=='POST')return nativeFetch(input,init);

      let label='';
      try{label=safeLabel(JSON.parse(String(init?.body||'{}'))?.label||'')}catch(_){}
      const ownController=new AbortController();
      const requestInit={...init,signal:ownController.signal};
      let settled=false;
      const request=nativeFetch(input,requestInit).then(response=>{settled=true;return response}).catch(error=>{settled=true;throw error});
      const first=await Promise.race([request,delay(60000).then(()=>null)]).catch(error=>({__error:error}));
      if(first instanceof Response)return first;
      if(!settled){try{ownController.abort()}catch(_){}}

      const verifyHeaders=new Headers(init?.headers||{});
      verifyHeaders.set('accept','application/json');
      const verifyUrl=`/api/control/site-update/history?backup_verify_r466=${Date.now()}`;
      let historyResponse=null;
      try{
        historyResponse=await Promise.race([
          nativeFetch(verifyUrl,{method:'GET',credentials:'include',cache:'no-store',headers:verifyHeaders}),
          delay(18000).then(()=>null)
        ]);
      }catch(_){}
      if(historyResponse?.ok){
        const history=await historyResponse.json().catch(()=>({}));
        const backups=(history.restorePoints||[]).filter(item=>item?.kind==='backup'&&item?.sha&&item?.message);
        const needle=label?`-${label}-`:'';
        const match=(needle?backups.find(item=>String(item.message).toLowerCase().includes(needle)):backups[0])||null;
        if(match){
          return jsonResponse({
            ok:true,tag:String(match.message),sha:String(match.sha),short:String(match.short||String(match.sha).slice(0,7)),
            url:String(match.url||''),recovered:true,
            message:`Backup подтверждён после задержки: ${String(match.message)}`
          });
        }
      }
      return jsonResponse({
        ok:false,error:'backup-timeout',
        message:'Backup не подтвердился за 60 секунд. Установка остановлена безопасно; кнопка снова доступна. Повтори обновление.'
      },504);
    };
  }

  const byId=id=>document.getElementById(id);
  const text=id=>String(byId(id)?.textContent||'').trim();
  const visible=el=>Boolean(el && !el.hidden && getComputedStyle(el).display!=='none');

  const versioned=base=>byId(`${base}R195`)||byId(`${base}R185`)||byId(`${base}R184`);
  const consoleBox=versioned('siteUpdateConsole');
  const consoleState=versioned('siteUpdateConsoleState');
  const consoleMetrics=versioned('siteUpdateConsoleMetrics');
  const consoleMessage=versioned('siteUpdateConsoleMessage');
  const consoleCheck=versioned('siteUpdateConsoleCheck');
  const consoleCommit=versioned('siteUpdateConsoleCommit');
  const consoleRelease=versioned('siteUpdateConsoleRelease');

  if(!consoleBox||!consoleState||!consoleMetrics||!consoleMessage)return;

  const pickMessage=()=>{
    const resultCard=byId('siteUpdateResultCard');
    const previewCard=byId('siteUpdatePreviewCard');
    const deploy=text('siteUpdateDeployMessage');
    const result=text('siteUpdateResultText');
    const publish=text('siteUpdatePublishMessage');
    const upload=text('siteUpdateUploadMessage');
    const connection=text('siteUpdateConnectionMessage');

    if(visible(resultCard) && deploy) return deploy;
    if(visible(resultCard) && result) return result;
    if(visible(previewCard) && publish) return publish;
    return upload || connection || 'Выбери полный ZIP сайта.';
  };

  const pickState=()=>{
    const resultCard=byId('siteUpdateResultCard');
    const previewCard=byId('siteUpdatePreviewCard');
    if(visible(resultCard)) return text('siteUpdateResultState') || 'В процессе';
    if(visible(previewCard)) return text('siteUpdatePreviewState') || 'ZIP готов';
    return text('siteUpdateFileState') || 'Ожидание ZIP';
  };

  const syncMetrics=()=>{
    const source=byId('siteUpdateMetrics');
    if(source && source.children.length){
      consoleMetrics.innerHTML=source.innerHTML;
    }else{
      const fileName=text('siteUpdateFileName');
      consoleMetrics.innerHTML=`<span>${fileName && fileName!=='до 25 МБ' ? fileName : 'Выбери полный ZIP сайта'}</span>`;
    }
  };

  const syncLink=(sourceId,target)=>{
    const source=byId(sourceId);
    if(!source||!target)return;
    const href=source.getAttribute('href')||'';
    target.href=href||'#';
    target.hidden=source.hidden||!href||href==='#';
  };

  const sync=()=>{
    consoleState.textContent=pickState();
    consoleMessage.textContent=pickMessage();
    syncMetrics();

    const resultVisible=visible(byId('siteUpdateResultCard'));
    const deployText=text('siteUpdateDeployMessage');
    consoleCheck.disabled=!resultVisible && !deployText;
    syncLink('siteUpdateCommitLink',consoleCommit);
    syncLink('siteUpdateReleaseLink',consoleRelease);

    const hasRunning=[...document.querySelectorAll('#siteUpdateStages>div')]
      .some(el=>el.classList.contains('is-running'));
    consoleBox.classList.toggle('is-active',hasRunning||resultVisible);
  };

  consoleCheck?.addEventListener('click',()=>{
    const original=byId('siteUpdateCheckDeploy');
    if(original && !original.disabled) original.click();
  });

  const watchedIds=[
    'siteUpdateFileState','siteUpdateFileName','siteUpdateUploadMessage',
    'siteUpdatePreviewCard','siteUpdatePreviewState','siteUpdateMetrics',
    'siteUpdatePublishMessage','siteUpdateResultCard','siteUpdateResultState',
    'siteUpdateResultText','siteUpdateDeployMessage','siteUpdateConnectionMessage',
    'siteUpdateCommitLink','siteUpdateReleaseLink','siteUpdateStages'
  ];

  const observer=new MutationObserver(sync);
  watchedIds.forEach(id=>{
    const el=byId(id);
    if(el) observer.observe(el,{
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:['hidden','class','href','disabled']
    });
  });

  const archive=byId('siteUpdateArchive');
  archive?.addEventListener('change',()=>setTimeout(sync,0));

  window.addEventListener('load',sync,{once:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
  [0,150,500,1200].forEach(ms=>setTimeout(sync,ms));
})();
