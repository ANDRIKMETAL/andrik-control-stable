(() => {
  'use strict';
  const SITE_UPDATE_UI_VERSION='55.00-r106';
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent';
  const byId=id=>document.getElementById(id),keyInput=byId('siteUpdateAdminKey'),archiveInput=byId('siteUpdateArchive'),previewButton=byId('siteUpdatePreview'),publishButton=byId('siteUpdatePublish'),confirmInput=byId('siteUpdateConfirm');
  let previewData=null,lastRelease='',lastPublish=null,lastOperationId='',operation=false;
  try{keyInput.value=localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){}
  const getKey=()=>keyInput.value.trim(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setText=(id,text)=>{const el=byId(id);if(el)el.textContent=text};
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const formatBytes=value=>{const n=Number(value||0);if(n<1024)return `${n} Б`;if(n<1024**2)return `${(n/1024).toFixed(1)} КБ`;return `${(n/1024**2).toFixed(2)} МБ`};
  const formatDate=value=>{try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch(_){return value||'—'}};
  function saveKey(){const key=getKey();try{sessionStorage.setItem(KEY_SESSION,key);if(localStorage.getItem(KEY_LOCAL))localStorage.setItem(KEY_LOCAL,key)}catch(_){}}
  function apiTimeout(path,method='GET'){
    if(path.includes('/preview'))return 90000;
    if(path.includes('/publish'))return 150000;
    if(path.includes('/release'))return 150000;
    if(path.includes('/rollback'))return 75000;
    if(path.includes('/backup'))return 45000;
    return method==='GET'?18000:45000;
  }
  async function api(path,options={}){
    const {timeoutMs,...fetchOptions}=options;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Number(timeoutMs||apiTimeout(path,fetchOptions.method||'GET')));
    const headers={accept:'application/json',authorization:`Bearer ${getKey()}`,...(fetchOptions.headers||{})};
    try{
      const response=await fetch(path,{...fetchOptions,headers,cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        const fallback=(response.status===404&&data.error==='not-found')
          ?'API обновления ещё не опубликован. Дождитесь зелёного Deploy Cloudflare и повторите.'
          :(data.message||data.error||`HTTP ${response.status}`);
        const error=new Error(fallback);error.data=data;error.status=response.status;throw error
      }
      return data
    }catch(error){
      if(error?.name==='AbortError'){
        const timeoutError=new Error('GitHub не ответил вовремя. Соединение остановлено безопасно — нажмите «Состояние» и повторите.');
        timeoutError.status=408;
        throw timeoutError
      }
      throw error
    }finally{clearTimeout(timer)}
  }
  function setState(ok,text){const el=byId('siteUpdateState');el.className=`service-access-state ${ok?'is-ready':'is-error'}`;el.textContent=text}
  function setResultState(kind,text){const el=byId('siteUpdateResultState');el.className=`service-access-state ${kind==='done'?'is-ready':kind==='warn'?'is-warn':kind==='error'?'is-error':''}`;el.textContent=text}
  function stage(name,status){const el=byId('siteUpdateStages')?.querySelector(`[data-stage="${name}"]`);if(!el)return;el.className=status?`is-${status}`:''}
  function resetStages(){byId('siteUpdateStages').hidden=false;['check','backup','commit','release','deploy'].forEach(name=>stage(name,''))}
  function setBusy(on){
    operation=on;
    previewButton.disabled=on||!archiveInput.files?.[0]||!getKey();
    publishButton.disabled=on||!previewData?.hasChanges;
    byId('siteUpdateBackupNow').disabled=on;
    document.querySelectorAll('[data-rollback]').forEach(button=>button.disabled=on);
  }
  function selectedFile(){return archiveInput.files?.[0]||null}
  let statusRequestId=0;
  async function loadStatus(){
    const requestId=++statusRequestId;
    if(!getKey()){
      setState(false,'Нужен ADMIN_KEY');
      setText('siteUpdateRepoText','GitHub не проверен');
      setText('siteUpdateReleaseRepoText','');
      setText('siteUpdateConnectionMessage','Введите ключ владельца.');
      return
    }
    saveKey();
    setState(false,'Проверяем…');
    setText('siteUpdateRepoText','Проверяем GitHub…');
    setText('siteUpdateReleaseRepoText','Ожидание ответа — не более 18 секунд');
    setText('siteUpdateConnectionMessage','Проверяем токен, ветку main и последний commit…');
    try{
      const data=await api('/api/control/site-update/status',{timeoutMs:18000});
      if(requestId!==statusRequestId)return;
      byId('siteUpdateRepoLink').href=data.repoUrl;
      setText('siteUpdateRepoText',`${data.owner}/${data.repo} · ${data.branch}`);
      setText('siteUpdateReleaseRepoText',`Release: ${data.releaseRepository}`);
      if(data.connected){
        setState(true,`Готово · ${data.headShort}`);
        setText('siteUpdateConnectionMessage',`GitHub и Cloudflare готовы. ${data.headMessage||''}`);
        byId('siteUpdateSetupCard').hidden=true;
        Promise.allSettled([loadHistory(),loadLog()]);
        if(selectedFile()&&!previewData&&!operation)preview()
      }else{
        setState(false,'Не настроено');
        setText('siteUpdateConnectionMessage',data.message||'Нужен GitHub token.');
        byId('siteUpdateSetupCard').hidden=false
      }
    }catch(error){
      if(requestId!==statusRequestId)return;
      setState(false,error.status===408?'Нет ответа':'Ошибка');
      setText('siteUpdateRepoText',error.status===408?'GitHub: превышено время ожидания':'GitHub не подключён');
      setText('siteUpdateReleaseRepoText','Нажмите «Состояние» для повторной проверки');
      setText('siteUpdateConnectionMessage',error.message);
      const needsSetup=error.status===401||/GITHUB_SITE_TOKEN|токен|репозиторий не найден/i.test(error.message);
      byId('siteUpdateSetupCard').hidden=!needsSetup
    }
  }
  archiveInput.addEventListener('change',()=>{const file=selectedFile();previewData=null;lastPublish=null;byId('siteUpdatePreviewCard').hidden=true;byId('siteUpdateResultCard').hidden=true;confirmInput.checked=false;resetStages();if(!file){setText('siteUpdateFileName','до 25 МБ');setText('siteUpdateFileState','Не выбран');previewButton.disabled=true;publishButton.disabled=true;return}setText('siteUpdateFileName',`${file.name} · ${formatBytes(file.size)}`);setText('siteUpdateFileState','Проверяем…');previewButton.disabled=!getKey();publishButton.disabled=true;const match=file.name.match(/R\d+/i);if(match){lastRelease=match[0].toUpperCase();byId('siteUpdateRelease').value=lastRelease;byId('siteUpdateMessage').value=`ANDRIK Control — update website ${lastRelease}`}setText('siteUpdateUploadMessage',getKey()?'Автоматически проверяем ZIP…':'Сначала введи ADMIN_KEY в разделе подключения.');if(getKey())setTimeout(preview,120)});
  function pathsHtml(data){return [['Добавлены',data.paths?.added||[]],['Изменены',data.paths?.changed||[]],['Удалены',data.paths?.deleted||[]]].map(([title,items])=>`<section class="update-path-group"><h3>${escapeHtml(title)} · ${items.length}</h3>${items.length?items.map(path=>`<code>${escapeHtml(path)}</code>`).join(''):'<code>Нет</code>'}</section>`).join('')}
  async function preview(){const file=selectedFile();if(!file||!getKey()||operation)return;resetStages();stage('check','running');setBusy(true);setText('siteUpdateFileState','Проверяем…');setText('siteUpdateUploadMessage','CRC, структура и сравнение с GitHub…');const form=new FormData();form.append('archive',file,file.name);try{const data=await api('/api/control/site-update/preview',{method:'POST',body:form});previewData=data;stage('check','done');byId('siteUpdatePreviewCard').hidden=false;byId('siteUpdatePreviewState').textContent=data.hasChanges?'Готово к обновлению':'Изменений нет';byId('siteUpdatePreviewState').className=`service-access-state ${data.hasChanges?'is-ready':''}`;byId('siteUpdateMetrics').innerHTML=[['Файлов',data.fileCount],['＋',data.added],['～',data.changed],['−',data.deleted]].map(([label,value])=>`<div class="update-metric"><strong>${Number(value||0)}</strong><span>${escapeHtml(label)}</span></div>`).join('');byId('siteUpdatePaths').innerHTML=pathsHtml(data);confirmInput.checked=!!data.hasChanges;publishButton.disabled=!data.hasChanges;setText('siteUpdateFileState',data.hasChanges?'ZIP готов':'Совпадает');setText('siteUpdateUploadMessage',`${data.fileCount} файлов · ${formatBytes(data.totalBytes)} · ＋${data.added} ～${data.changed} −${data.deleted}`);setText('siteUpdatePublishMessage',data.hasChanges?'Backup и Release включены. Нажми одну кнопку ниже.':'Этот ZIP уже совпадает с main.')}catch(error){stage('check','error');previewData=null;confirmInput.checked=false;publishButton.disabled=true;setText('siteUpdateFileState','Ошибка');setText('siteUpdateUploadMessage',`Ошибка: ${error.message}`)}finally{setBusy(false)}}
  confirmInput.addEventListener('change',()=>{publishButton.disabled=operation||!previewData?.hasChanges});
  async function createBackup(label,manual=false){const data=await api('/api/control/site-update/backup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label,manual})});return data}
  async function backupNow(){if(!getKey()||operation)return;setBusy(true);setText('siteUpdateConnectionMessage','Создаём резервную метку…');try{const data=await createBackup(byId('siteUpdateRelease').value||'manual',true);setText('siteUpdateConnectionMessage',data.message);await loadLog()}catch(error){setText('siteUpdateConnectionMessage',`Backup: ${error.message}`)}finally{setBusy(false)}}
  async function createRelease(file,publishData){const form=new FormData();form.append('archive',file,file.name);form.append('release',byId('siteUpdateRelease').value.trim());form.append('commitSha',publishData.commitSha||'');form.append('added',String(publishData.added||0));form.append('changed',String(publishData.changed||0));form.append('deleted',String(publishData.deleted||0));return api('/api/control/site-update/release',{method:'POST',body:form})}
  async function checkDeployment(operationId='',release='',quiet=false){
    if(!operationId&&!release)return null;
    const query=new URLSearchParams();
    if(operationId)query.set('operationId',operationId);
    if(release)query.set('release',release);
    try{
      const data=await api(`/api/control/site-update/deployment?${query.toString()}`,{timeoutMs:22000});
      setText('siteUpdateDeployMessage',data.message);
      if(data.deployed){
        stage('deploy','done');
        setResultState('done','Опубликовано');
      }else{
        stage('deploy','warn');
        setResultState('warn','Ждёт Cloudflare');
      }
      return data
    }catch(error){
      stage('deploy','warn');
      if(!quiet)setText('siteUpdateDeployMessage',`Проверка Cloudflare: ${error.message}`);
      return null
    }
  }
  async function watchDeployment(operationId='',release=''){
    stage('deploy','running');
    setText('siteUpdateDeployMessage',operationId?'Проверяем точный маркер нового Deploy…':`Ищем ${release} на Control…`);
    for(let i=0;i<8;i++){
      const data=await checkDeployment(operationId,release,true);
      if(data?.deployed){
        await Promise.allSettled([loadStatus(),loadHistory(),loadLog()]);
        return data
      }
      await sleep(i<2?2200:i<5?4000:6000)
    }
    stage('deploy','warn');
    setResultState('warn','Ждёт Cloudflare');
    setText('siteUpdateDeployMessage','GitHub готов. Cloudflare продолжает Deploy. Нажми «Проверить» через несколько секунд.');
    return null
  }
  async function publish(){const file=selectedFile();if(!file||!previewData?.hasChanges||operation)return;const release=byId('siteUpdateRelease').value.trim().toUpperCase();if(!confirm(`Опубликовать ${release}?\n\n＋${previewData.added}  ～${previewData.changed}  −${previewData.deleted}`))return;resetStages();stage('check','done');byId('siteUpdateResultCard').hidden=false;setResultState('','В процессе');setBusy(true);let backupData=null,publishData=null,releaseData=null;try{stage('backup','running');backupData=await createBackup(release);stage('backup','done');stage('commit','running');const form=new FormData();form.append('archive',file,file.name);form.append('message',byId('siteUpdateMessage').value.trim());form.append('release',release);form.append('expectedHead',previewData.headSha||'');form.append('confirm','yes');publishData=await api('/api/control/site-update/publish',{method:'POST',body:form});if(publishData.noChanges){stage('commit','done');stage('release','skipped');stage('deploy','skipped');setResultState('done','Без изменений');setText('siteUpdateResultTitle','Изменений нет');setText('siteUpdateResultText',publishData.message);return}stage('commit','done');const commitLink=byId('siteUpdateCommitLink');commitLink.href=publishData.commitUrl;commitLink.hidden=!publishData.commitUrl;stage('release','running');try{releaseData=await createRelease(file,publishData);stage('release',releaseData.skipped?'skipped':'done');if(releaseData.releaseUrl){const link=byId('siteUpdateReleaseLink');link.href=releaseData.releaseUrl;link.hidden=false}}catch(error){stage('release','warn');releaseData={warning:error.message}};lastRelease=release;lastOperationId=publishData.operationId||'';lastPublish={backupData,publishData,releaseData};setText('siteUpdateResultTitle',`${release} отправлена`);setText('siteUpdateResultText',`Commit ${publishData.commitShort} · ＋${publishData.added} ～${publishData.changed} −${publishData.deleted}${backupData?` · backup ${backupData.short}`:''}${releaseData?.warning?` · Release: ${releaseData.warning}`:''}`);setResultState('','Проверяем');byId('siteUpdateResultCard').scrollIntoView({behavior:'smooth',block:'start'});previewData=null;confirmInput.checked=false;await Promise.allSettled([loadStatus(),loadHistory(),loadLog()]);watchDeployment(lastOperationId,release)}catch(error){if(!publishData)stage('commit','error');setResultState('error','Ошибка');setText('siteUpdateResultTitle','Публикация остановлена');setText('siteUpdateResultText',error.message);setText('siteUpdatePublishMessage',`Ошибка: ${error.message}`)}finally{setBusy(false)}}
  function pointBadge(kind,current){
    if(current)return '<span class="history-kind is-current">ТЕКУЩАЯ</span>';
    const labels={release:'RELEASE',backup:'BACKUP',stable:'ВЕРСИЯ',commit:'COMMIT'};
    return `<span class="history-kind is-${escapeHtml(kind||'commit')}">${escapeHtml(labels[kind]||'ВЕРСИЯ')}</span>`;
  }
  function historyPointHtml(item){
    const current=Boolean(item.current);
    const release=item.release||'';
    const links=[
      item.url?`<a class="history-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">GitHub ↗</a>`:'',
      item.releaseUrl?`<a class="history-link" href="${escapeHtml(item.releaseUrl)}" target="_blank" rel="noopener">Release ↗</a>`:''
    ].filter(Boolean).join('');
    const action=current
      ?pointBadge(item.kind,true)
      :`<button class="btn history-rollback-button" type="button"
          data-rollback="${escapeHtml(item.sha)}"
          data-label="${escapeHtml(item.label||item.short)}"
          data-release="${escapeHtml(release)}"
          data-kind="${escapeHtml(item.kind||'stable')}">ОТКАТИТЬ</button>`;
    return `<article class="update-history-item history-point is-${escapeHtml(item.kind||'stable')}">
      <div class="history-main">
        <div class="history-title-line">${pointBadge(item.kind,false)}<strong>${escapeHtml(item.label||item.message||item.short)}</strong></div>
        <small>${escapeHtml(item.short)} · ${escapeHtml(formatDate(item.date))}${item.message&&item.message!==item.label?` · ${escapeHtml(item.message)}`:''}</small>
        ${links?`<div class="history-links">${links}</div>`:''}
      </div>
      ${action}
    </article>`;
  }
  function technicalCommitHtml(item){
    return `<article class="update-history-item technical-commit">
      <div><strong>${escapeHtml(item.message||item.short)}</strong><small>${escapeHtml(item.short)} · ${escapeHtml(formatDate(item.date))}</small></div>
      ${item.url?`<a class="history-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">↗</a>`:''}
    </article>`;
  }
  async function loadHistory(){
    if(!getKey())return;
    const historyBox=byId('siteUpdateHistory'),technicalBox=byId('siteUpdateTechnicalHistory');
    try{
      setText('siteUpdateHistoryMessage','Загрузка…');
      const data=await api('/api/control/site-update/history',{timeoutMs:30000});
      const points=data.restorePoints||[];
      historyBox.innerHTML=points.map(historyPointHtml).join('')||'<div class="admin-empty">Точек восстановления пока нет</div>';
      technicalBox.innerHTML=(data.technicalCommits||[]).map(technicalCommitHtml).join('')||'<div class="admin-empty">Технических коммитов нет</div>';
      historyBox.querySelectorAll('[data-rollback]').forEach(button=>button.addEventListener('click',()=>rollback({
        targetSha:button.dataset.rollback,
        label:button.dataset.label,
        release:button.dataset.release,
        kind:button.dataset.kind
      })));
      setText('siteUpdateHistoryMessage',`${points.length} точек · ${(data.technicalCommits||[]).length} коммитов`);
    }catch(error){
      historyBox.innerHTML=`<div class="admin-empty">${escapeHtml(error.message)}</div>`;
      setText('siteUpdateHistoryMessage',`История: ${error.message}`);
    }
  }
  async function loadLog(){
    if(!getKey())return;
    try{
      const data=await api('/api/control/site-update/log',{timeoutMs:18000}),box=byId('siteUpdateLog');
      const labels={
        'backup-created':'Backup создан',
        'github-publish':'ZIP → Commit',
        'release-created':'Release + ZIP',
        'github-rollback':'Откат отправлен',
        'github-publish-failed':'Ошибка commit',
        'release-failed':'Ошибка Release'
      };
      box.innerHTML=(data.entries||[]).map(item=>`<article class="update-log-item is-${escapeHtml(item.level)}">
        <div><strong>${escapeHtml(labels[item.event]||item.event||'Событие')}</strong>
        <small>${escapeHtml(item.message)} · ${escapeHtml(formatDate(item.createdAt))}</small></div><span class="log-dot"></span>
      </article>`).join('')||'<div class="admin-empty">Журнал пуст</div>';
    }catch(error){
      byId('siteUpdateLog').innerHTML=`<div class="admin-empty">${escapeHtml(error.message)}</div>`;
    }
  }
  async function rollback(point){
    if(operation)return;
    const label=point.label||point.targetSha?.slice(0,7)||'выбранной версии';
    const kindText=point.kind==='backup'?'резервной копии':point.kind==='release'?'релиза':'версии';
    if(!confirm(`Откатить сайт к ${kindText} ${label}?\n\nПеред откатом автоматически создастся новый backup текущего сайта.`))return;
    resetStages();
    stage('check','skipped');
    stage('backup','running');
    byId('siteUpdateResultCard').hidden=false;
    setResultState('','Откат');
    setText('siteUpdateResultTitle',`Откат к ${label}`);
    setText('siteUpdateResultText','Создаём защитный backup и новый rollback commit…');
    setText('siteUpdateDeployMessage','Ожидание GitHub…');
    byId('siteUpdateResultCard').scrollIntoView({behavior:'smooth',block:'start'});
    setBusy(true);
    setText('siteUpdateHistoryMessage',`Откат к ${label}…`);
    try{
      const data=await api('/api/control/site-update/rollback',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({targetSha:point.targetSha,label,release:point.release||''}),
        timeoutMs:90000
      });
      stage('backup','done');
      stage('commit','done');
      stage('release','skipped');
      lastOperationId=data.operationId||'';
      lastRelease=data.release||point.release||'';
      const commitLink=byId('siteUpdateCommitLink');
      commitLink.href=data.commitUrl||'#';
      commitLink.hidden=!data.commitUrl;
      setText('siteUpdateHistoryMessage',data.message);
      setText('siteUpdateResultText',`Rollback commit ${data.commitShort} · backup ${data.backupTag}`);
      setResultState('','Проверяем');
      await Promise.allSettled([loadStatus(),loadHistory(),loadLog()]);
      await watchDeployment(lastOperationId,lastRelease);
    }catch(error){
      stage('backup','warn');
      stage('commit','error');
      setResultState('error','Ошибка');
      setText('siteUpdateResultTitle','Откат остановлен');
      setText('siteUpdateResultText',error.message);
      setText('siteUpdateHistoryMessage',`Ошибка: ${error.message}`);
    }finally{
      setBusy(false);
    }
  }
  byId('siteUpdateVerify').addEventListener('click',loadStatus);byId('siteUpdateRefresh').addEventListener('click',loadStatus);byId('siteUpdateBackupNow').addEventListener('click',backupNow);previewButton.addEventListener('click',preview);publishButton.addEventListener('click',publish);byId('siteUpdateHistoryRefresh').addEventListener('click',()=>Promise.allSettled([loadStatus(),loadHistory(),loadLog()]));byId('siteUpdateCheckDeploy').addEventListener('click',()=>checkDeployment(lastOperationId,lastRelease||byId('siteUpdateRelease').value.trim().toUpperCase()));keyInput.addEventListener('input',()=>{previewButton.disabled=operation||!selectedFile()||!getKey()});keyInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadStatus()}});resetStages();if(getKey())loadStatus();else setState(false,'Нужен ADMIN_KEY');
})();
