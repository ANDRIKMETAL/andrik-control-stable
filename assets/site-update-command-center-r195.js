(()=>{
  'use strict';

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
