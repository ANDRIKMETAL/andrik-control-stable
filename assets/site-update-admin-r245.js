(() => {
  'use strict';
  const SITE_UPDATE_UI_VERSION='55.00-r245';
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent',AUTO_RECOVERY_KEY='andrik-site-update-auto-recovery',CACHE_REFRESH_PREFIX='andrik-site-update-cache-refresh:',PENDING_DEPLOY_KEY='andrik-site-update-pending-deploy-r245';
  const byId=id=>document.getElementById(id),keyInput=byId('siteUpdateAdminKey'),archiveInput=byId('siteUpdateArchive'),previewButton=byId('siteUpdatePreview'),publishButton=byId('siteUpdatePublish'),confirmInput=byId('siteUpdateConfirm'),autoRecoveryInput=byId('siteUpdateAutoRecovery');
  let previewData=null,lastRelease='',lastPublish=null,lastOperationId='',operation=false;
  let siteBackupZipFile=null,siteBackupZipUrl='',zipBackupBusy=false;
  let runtimeAdminKey='',pendingResumeBusy=false,pendingResumeTimer=0;
  function savePendingDeploy(operationId='',release='',mode='publish'){
    if(!operationId)return;
    try{localStorage.setItem(PENDING_DEPLOY_KEY,JSON.stringify({operationId,release,mode,createdAt:Date.now()}));}catch(_){}
  }
  function readPendingDeploy(){
    try{const value=JSON.parse(localStorage.getItem(PENDING_DEPLOY_KEY)||'null');return value&&value.operationId?value:null}catch(_){return null}
  }
  function clearPendingDeploy(operationId=''){
    try{const current=readPendingDeploy();if(!operationId||!current||current.operationId===operationId)localStorage.removeItem(PENDING_DEPLOY_KEY);}catch(_){}
  }
  const OWNER_SENTINEL=window.AndrikOwnerSession?.sentinel||'__ANDRIK_OWNER_SESSION__';
  try{
    const stored=localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||'';
    if(stored&&stored!==OWNER_SENTINEL){runtimeAdminKey=stored;window.AndrikOwnerSession?.capture?.(stored);}
    if(stored)keyInput.value=stored;
    autoRecoveryInput.checked=localStorage.getItem(AUTO_RECOVERY_KEY)!=='0';
  }catch(_){autoRecoveryInput.checked=true}
  const visibleKey=()=>String(keyInput.value||'').trim();
  const captureKey=()=>{
    const value=visibleKey();
    if(value&&value!==OWNER_SENTINEL){runtimeAdminKey=value;window.AndrikOwnerSession?.capture?.(value);}
    return runtimeAdminKey;
  };
  const getKey=()=>captureKey()||(visibleKey()===OWNER_SENTINEL?OWNER_SENTINEL:'');
  const hasOwnerAccess=()=>Boolean(runtimeAdminKey||visibleKey()===OWNER_SENTINEL||window.AndrikOwnerSession?.isActive?.());
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const setText=(id,text)=>{const el=byId(id);if(el)el.textContent=text};
  const escapeHtml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const formatBytes=value=>{const n=Number(value||0);if(n<1024)return `${n} Б`;if(n<1024**2)return `${(n/1024).toFixed(1)} КБ`;return `${(n/1024**2).toFixed(2)} МБ`};
  const formatDate=value=>{try{return new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch(_){return value||'—'}};
  function saveKey(){captureKey();}
  async function ensureOwnerAccess(){
    const raw=captureKey();
    if(window.AndrikOwnerSession?.ensure){
      const data=await window.AndrikOwnerSession.ensure(raw||'');
      if(data?.owner){keyInput.value=OWNER_SENTINEL;return true;}
      if(data?.rawFallback&&raw)return true;
    }
    return Boolean(raw);
  }
  function apiTimeout(path,method='GET'){
    if(path.includes('/preview'))return 90000;
    if(path.includes('/publish'))return 150000;
    if(path.includes('/release'))return 150000;
    if(path.includes('/rollback'))return 75000;
    if(path.includes('/finalize'))return 110000;
    if(path.includes('/backup'))return 45000;
    return method==='GET'?18000:45000;
  }
  async function api(path,options={}){
    const {timeoutMs,...fetchOptions}=options;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Number(timeoutMs||apiTimeout(path,fetchOptions.method||'GET')));
    try{
      await ensureOwnerAccess();
      const raw=runtimeAdminKey;
      const headers={accept:'application/json',...(raw?{authorization:`Bearer ${raw}`}:{ }),...(fetchOptions.headers||{})};
      let response=await fetch(path,{...fetchOptions,headers,credentials:'include',cache:'no-store',signal:controller.signal});
      // If Android did not attach the cookie, re-establish once and retry with
      // the RAM-only ADMIN_KEY. Mutating requests are retried only after a 401,
      // before the Worker has executed the protected operation.
      if(response.status===401&&runtimeAdminKey){
        await window.AndrikOwnerSession?.establish?.(runtimeAdminKey).catch(()=>null);
        const retryHeaders={accept:'application/json',authorization:`Bearer ${runtimeAdminKey}`,...(fetchOptions.headers||{})};
        response=await fetch(path,{...fetchOptions,headers:retryHeaders,credentials:'include',cache:'no-store',signal:controller.signal});
      }
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
  function emitHeaderStage(source='stage'){
    try{window.dispatchEvent(new CustomEvent('andrik:site-update-stage',{detail:{source,at:Date.now()}}))}catch(_){}
  }
  function setResultState(kind,text){
    const el=byId('siteUpdateResultState');
    el.className=`service-access-state ${kind==='done'?'is-ready':kind==='warn'?'is-warn':kind==='error'?'is-error':''}`;
    el.textContent=text;
    emitHeaderStage('result');
  }
  function stage(name,status){
    const el=byId('siteUpdateStages')?.querySelector(`[data-stage="${name}"]`);
    if(!el)return;
    el.className=status?`is-${status}`:'';
    el.dataset.stageStatus=status||'';
    emitHeaderStage(name);
  }
  function resetStages(){
    byId('siteUpdateStages').hidden=false;
    ['check','backup','commit','release','deploy','protect'].forEach(name=>stage(name,''));
    emitHeaderStage('reset');
  }
  function setBusy(on){
    operation=on;
    previewButton.disabled=on||!archiveInput.files?.[0]||!hasOwnerAccess();
    publishButton.disabled=on||!canPublishPreview();
    byId('siteUpdateBackupNow').disabled=on;
    byId('siteUpdateHealthCheck').disabled=on;
    byId('siteUpdateCacheClear').disabled=on;
    autoRecoveryInput.disabled=on;
    document.querySelectorAll('[data-rollback]').forEach(button=>button.disabled=on);
  }
  function selectedFile(){return archiveInput.files?.[0]||null}
  function canPublishPreview(){return Boolean(previewData&&(previewData.hasChanges||previewData.canReinstall))}
  function setPublishMode(reinstall=false){
    publishButton.textContent=reinstall?'ПЕРЕПРОШИТЬ ЭТУ ЖЕ ВЕРСИЮ':'ОБНОВИТЬ САЙТ';
    publishButton.dataset.mode=reinstall?'reinstall':'update';
  }
  let statusRequestId=0;
  async function readStatusWithRetry(){
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      try{
        return await api(`/api/control/site-update/status?fresh=${Date.now()}-${attempt}`,{timeoutMs:18000,headers:{'cache-control':'no-cache','x-andrik-status-attempt':String(attempt)}})
      }catch(error){
        lastError=error;
        if(error.status===401||error.status===403||attempt===3)throw error;
        await sleep(500*attempt)
      }
    }
    throw lastError||new Error('Не удалось проверить подключение.')
  }
  async function loadStatus(){
    const requestId=++statusRequestId;
    try{
      await ensureOwnerAccess();
    }catch(error){
      setState(false,'Нужен ADMIN_KEY');
      setText('siteUpdateRepoText','Доступ владельца не подтверждён');
      setText('siteUpdateReleaseRepoText','GitHub ещё не проверялся');
      setText('siteUpdateConnectionMessage','Введите ADMIN_KEY один раз. После подтверждения сессия сохранится на этом устройстве.');
      byId('siteUpdateSetupCard').hidden=false;
      return
    }
    saveKey();
    setState(false,'Проверяем…');
    setText('siteUpdateRepoText','Проверяем ADMIN_KEY и GitHub…');
    setText('siteUpdateReleaseRepoText','До трёх безопасных попыток');
    setText('siteUpdateConnectionMessage','2FA GitHub не участвует в API: проверяем ADMIN_KEY, GITHUB_SITE_TOKEN и ветку main.');
    try{
      const data=await readStatusWithRetry();
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
        const message=data.message||'Нужен GitHub token.';
        setText('siteUpdateRepoText',/GITHUB_SITE_TOKEN|токен/i.test(message)?'GitHub token не настроен':'GitHub не готов');
        setText('siteUpdateReleaseRepoText','Проверь секрет в Cloudflare Production');
        setText('siteUpdateConnectionMessage',message);
        byId('siteUpdateSetupCard').hidden=false
      }
    }catch(error){
      if(requestId!==statusRequestId)return;
      const message=String(error.message||'Неизвестная ошибка');
      if(error.status===401){
        setState(false,'ADMIN_KEY');
        setText('siteUpdateRepoText','ADMIN_KEY не подтверждён');
        setText('siteUpdateReleaseRepoText','GitHub-токен ещё не проверялся');
        setText('siteUpdateConnectionMessage','Повтори ADMIN_KEY. Включение 2FA GitHub этот ключ не меняет.');
        byId('siteUpdateSetupCard').hidden=false;
        return
      }
      if(error.status===403||/GitHub отклонил токен|github-403|Contents: Read and write/i.test(message)){
        setState(false,'GitHub token');
        setText('siteUpdateRepoText','GitHub отклонил GITHUB_SITE_TOKEN');
        setText('siteUpdateReleaseRepoText','Нужен новый Fine-grained token');
        setText('siteUpdateConnectionMessage',message);
        byId('siteUpdateSetupCard').hidden=false;
        return
      }
      if(/GITHUB_SITE_TOKEN|токен/i.test(message)){
        setState(false,'GitHub token');
        setText('siteUpdateRepoText','GITHUB_SITE_TOKEN отсутствует или недействителен');
        setText('siteUpdateReleaseRepoText','Cloudflare Pages → Production secrets');
        setText('siteUpdateConnectionMessage',message);
        byId('siteUpdateSetupCard').hidden=false;
        return
      }
      setState(false,error.status===408?'Нет ответа':'Ошибка');
      setText('siteUpdateRepoText',error.status===408?'GitHub временно не ответил':'Проверка подключения не завершена');
      setText('siteUpdateReleaseRepoText','Нажми «Состояние» ещё раз');
      setText('siteUpdateConnectionMessage',message);
      byId('siteUpdateSetupCard').hidden=true
    }
  }
  archiveInput.addEventListener('change',()=>{
    const file=selectedFile();
    previewData=null;lastPublish=null;
    byId('siteUpdatePreviewCard').hidden=true;
    byId('siteUpdateResultCard').hidden=true;
    confirmInput.checked=false;
    setPublishMode(false);
    resetStages();
    if(!file){
      setText('siteUpdateFileName','до 25 МБ');
      setText('siteUpdateFileState','Не выбран');
      previewButton.disabled=true;publishButton.disabled=true;return
    }
    setText('siteUpdateFileName',`${file.name} · ${formatBytes(file.size)}`);
    setText('siteUpdateFileState','Проверяем…');
    previewButton.disabled=!hasOwnerAccess();publishButton.disabled=true;
    const match=file.name.match(/R\d+/i);
    if(match){
      lastRelease=match[0].toUpperCase();
      byId('siteUpdateRelease').value=lastRelease;
      byId('siteUpdateMessage').value=`ANDRIK Control — update website ${lastRelease}`
    }
    setText('siteUpdateUploadMessage',hasOwnerAccess()?'Автоматически проверяем ZIP…':'Сначала введи ADMIN_KEY в разделе подключения.');
    if(hasOwnerAccess())setTimeout(preview,120)
  });
  function pathsHtml(data){return [['Добавлены',data.paths?.added||[]],['Изменены',data.paths?.changed||[]],['Удалены',data.paths?.deleted||[]]].map(([title,items])=>`<section class="update-path-group"><h3>${escapeHtml(title)} · ${items.length}</h3>${items.length?items.map(path=>`<code>${escapeHtml(path)}</code>`).join(''):'<code>Нет</code>'}</section>`).join('')}
  async function preview(){
    const file=selectedFile();
    if(!file||!hasOwnerAccess()||operation)return;
    resetStages();stage('check','running');setBusy(true);
    setText('siteUpdateFileState','Проверяем…');
    setText('siteUpdateUploadMessage','CRC, структура и сравнение с GitHub…');
    const form=new FormData();form.append('archive',file,file.name);
    try{
      const data=await api('/api/control/site-update/preview',{method:'POST',body:form});
      previewData=data;
      const reinstall=!data.hasChanges&&data.canReinstall;
      stage('check','done');
      byId('siteUpdatePreviewCard').hidden=false;
      byId('siteUpdatePreviewState').textContent=reinstall?'Готово к перепрошивке':'Готово к обновлению';
      byId('siteUpdatePreviewState').className='service-access-state is-ready';
      byId('siteUpdateMetrics').innerHTML=[['Файлов',data.fileCount],['＋',data.added],['～',data.changed],['−',data.deleted]].map(([label,value])=>`<div class="update-metric"><strong>${Number(value||0)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
      byId('siteUpdatePaths').innerHTML=pathsHtml(data);
      confirmInput.checked=true;
      setPublishMode(reinstall);
      publishButton.disabled=false;
      setText('siteUpdateFileState',reinstall?'Можно перепрошить':'ZIP готов');
      setText('siteUpdateUploadMessage',`${data.fileCount} файлов · ${formatBytes(data.totalBytes)} · ＋${data.added} ～${data.changed} −${data.deleted}`);
      setText('siteUpdatePublishMessage',reinstall?'ZIP полностью совпадает с main. Повторная установка разрешена: будет создан новый commit и новый Cloudflare Deploy.':'Backup и Release включены. Нажми одну кнопку ниже.');
    }catch(error){
      stage('check','error');previewData=null;confirmInput.checked=false;setPublishMode(false);publishButton.disabled=true;
      setText('siteUpdateFileState','Ошибка');setText('siteUpdateUploadMessage',`Ошибка: ${error.message}`)
    }finally{setBusy(false)}
  }
  confirmInput.addEventListener('change',()=>{publishButton.disabled=operation||!canPublishPreview()});
  async function createBackup(label,manual=false){const data=await api('/api/control/site-update/backup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({label,manual})});return data}
  async function backupNow(){if(!hasOwnerAccess()||operation)return;setBusy(true);setText('siteUpdateConnectionMessage','Создаём резервную метку…');try{const data=await createBackup(byId('siteUpdateRelease').value||'manual',true);setText('siteUpdateConnectionMessage',data.message);await loadLog()}catch(error){setText('siteUpdateConnectionMessage',`Backup: ${error.message}`)}finally{setBusy(false)}}
  function backupFilenameFromResponse(response){
    const disposition=String(response.headers.get('content-disposition')||'');
    const utf=disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plain=disposition.match(/filename="?([^";]+)"?/i);
    try{return decodeURIComponent((utf?.[1]||plain?.[1]||'').trim())||`ANDRIK-BACKUP-${new Date().toISOString().slice(0,10)}.zip`}catch(_){return plain?.[1]||`ANDRIK-BACKUP-${new Date().toISOString().slice(0,10)}.zip`}
  }
  function releaseBackupZipUrl(){
    if(siteBackupZipUrl){try{URL.revokeObjectURL(siteBackupZipUrl)}catch(_){}}
    siteBackupZipUrl='';siteBackupZipFile=null;
  }
  function setBackupZipReady(file){
    siteBackupZipFile=file;
    siteBackupZipUrl=URL.createObjectURL(file);
    const download=byId('siteUpdateBackupZipDownload'),share=byId('siteUpdateBackupZipShare');
    if(download){download.disabled=false;download.hidden=false;download.textContent=`Скачать · ${formatBytes(file.size)}`;}
    if(share){share.disabled=false;share.hidden=false;}
    setText('siteUpdateBackupZipState',`${file.name} · ${formatBytes(file.size)} · готов к восстановлению`);
  }
  async function fetchBackupZip(){
    const raw=captureKey();
    if(!raw&&!hasOwnerAccess())throw new Error('Введите ADMIN_KEY и нажмите «Проверить».');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),120000);
    try{
      const headers={accept:'application/zip',...(raw?{authorization:`Bearer ${raw}`}:{})};
      let response=await fetch(`/api/control/site-update/backup-zip?fresh=${Date.now()}&v=r245`,{credentials:'include',cache:'no-store',headers,signal:controller.signal});
      if(response.status===401&&raw){
        await window.AndrikOwnerSession?.establish?.(raw).catch(()=>null);
        response=await fetch(`/api/control/site-update/backup-zip?fresh=${Date.now()}&v=r245-retry`,{credentials:'include',cache:'no-store',headers:{accept:'application/zip',authorization:`Bearer ${raw}`},signal:controller.signal});
      }
      if(!response.ok){
        const type=String(response.headers.get('content-type')||'');
        const data=type.includes('json')?await response.json().catch(()=>({})):{};
        throw new Error(data.message||data.error||`ZIP-бэкап: HTTP ${response.status}`);
      }
      const blob=await response.blob();
      if(blob.size<1000)throw new Error('GitHub вернул пустой или неполный архив.');
      const filename=backupFilenameFromResponse(response);
      return new File([blob],filename,{type:'application/zip',lastModified:Date.now()});
    }catch(error){
      if(error?.name==='AbortError')throw new Error('GitHub не отдал ZIP за 2 минуты. Нажмите «Повторить ZIP-бэкап».');
      throw error;
    }finally{clearTimeout(timer)}
  }
  async function createDownloadableZipBackup(){
    if(zipBackupBusy)return;
    zipBackupBusy=true;
    const button=byId('siteUpdateBackupZipCreate');
    if(button){button.disabled=true;button.textContent='Создаём ZIP…';}
    setText('siteUpdateBackupZipState','Запрашиваем текущий Commit напрямую. Общая проверка GitHub этому не мешает…');
    try{
      releaseBackupZipUrl();
      const file=await fetchBackupZip();
      setBackupZipReady(file);
      if(button)button.textContent='Создать новый ZIP-бэкап';
    }catch(error){
      setText('siteUpdateBackupZipState',`Ошибка ZIP-бэкапа: ${error.message}`);
      if(button)button.textContent='Повторить ZIP-бэкап';
    }finally{
      zipBackupBusy=false;
      if(button)button.disabled=false;
    }
  }
  function downloadZipBackup(){
    if(!siteBackupZipFile||!siteBackupZipUrl)return;
    const link=document.createElement('a');link.href=siteBackupZipUrl;link.download=siteBackupZipFile.name;link.rel='noopener';document.body.appendChild(link);link.click();link.remove();
    setText('siteUpdateBackupZipState',`${siteBackupZipFile.name} сохранён в загрузки.`);
  }
  async function shareZipBackup(){
    if(!siteBackupZipFile)return;
    try{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[siteBackupZipFile]}))){
        await navigator.share({title:'ANDRIK — ZIP-бэкап сайта',text:'Полная резервная копия сайта для восстановления через Control.',files:[siteBackupZipFile]});
        setText('siteUpdateBackupZipState','ZIP-бэкап передан в системное меню «Поделиться».');
        return;
      }
      downloadZipBackup();
      setText('siteUpdateBackupZipState','Телефон не поддерживает передачу ZIP напрямую. Архив скачан — поделитесь им из папки «Загрузки».');
    }catch(error){
      if(error?.name!=='AbortError')setText('siteUpdateBackupZipState',`Не удалось поделиться: ${error.message}`);
    }
  }
  async function createRelease(file,publishData){const form=new FormData();form.append('archive',file,file.name);form.append('release',byId('siteUpdateRelease').value.trim());form.append('commitSha',publishData.commitSha||'');form.append('added',String(publishData.added||0));form.append('changed',String(publishData.changed||0));form.append('deleted',String(publishData.deleted||0));return api('/api/control/site-update/release',{method:'POST',body:form})}
  async function readDirectDeployMarker(operationId=''){
    if(!operationId)return null;
    try{
      const response=await fetch(`/site-update-state.json?deploy_probe=${Date.now()}`,{
        method:'GET',cache:'no-store',
        headers:{accept:'application/json','cache-control':'no-cache'}
      });
      if(!response.ok)return null;
      const state=await response.json().catch(()=>null);
      if(state?.operationId===operationId){
        return {
          ok:true,deployed:true,operationId,
          deployedOperationId:state.operationId,
          deployedRelease:state.release||'',
          state,
          message:`Cloudflare опубликовал точную операцию ${operationId.split('-').slice(0,2).join('-')}.`
        }
      }
    }catch(_){}
    return null
  }
  async function checkDeployment(operationId='',release='',quiet=false){
    if(!operationId&&!release)return null;
    const direct=await readDirectDeployMarker(operationId);
    if(direct){
      setText('siteUpdateDeployMessage',direct.message);
      stage('deploy','done');
      setResultState('','Проверяем сайт');
      return direct
    }
    const query=new URLSearchParams();
    if(operationId)query.set('operationId',operationId);
    if(release)query.set('release',release);
    try{
      const data=await api(`/api/control/site-update/deployment?${query.toString()}`,{timeoutMs:22000});
      setText('siteUpdateDeployMessage',data.message);
      if(data.deployed){
        stage('deploy','done');
        setResultState('','Проверяем сайт');
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
  function healthStatusText(status){
    return status==='ok'?'Система исправна':status==='degraded'?'Есть предупреждения':'Критическая ошибка'
  }
  function renderHealth(health,message=''){
    const status=health?.status||'unknown';
    const state=byId('siteUpdateProtectionState');
    state.className=`service-access-state ${status==='ok'?'is-ready':status==='degraded'?'is-warn':status==='down'?'is-error':''}`;
    state.textContent=status==='ok'?'Защищено':status==='degraded'?'Предупреждение':status==='down'?'Ошибка':'Проверка';
    setText('siteUpdateHealthMessage',message||healthStatusText(status));
    const box=byId('siteUpdateHealthChecks');
    box.innerHTML=(health?.checks||[]).map(item=>`<span class="health-chip is-${escapeHtml(item.status)}"><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail)}</small></span>`).join('');
  }
  async function directHealthCheck(){
    const response=await fetch(`/api/health?health_probe=${Date.now()}`,{
      method:'GET',cache:'no-store',
      headers:{accept:'application/json','cache-control':'no-cache'}
    });
    const data=await response.json().catch(()=>({status:'down',checks:[]}));
    return data
  }
  async function clearControlRuntimeCaches({reload=true,operationId='',release='',manual=false}={}){
    const marker=`${CACHE_REFRESH_PREFIX}${operationId||'manual'}`;
    if(operationId&&sessionStorage.getItem(marker)==='1')return false;
    if(operationId)sessionStorage.setItem(marker,'1');
    setText('siteUpdateCacheMessage',manual?'Очищаем кэш Control…':'Новая версия опубликована. Обновляем кэш Control…');
    try{
      if('serviceWorker' in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations().catch(()=>[]);
        for(const registration of registrations){
          registration.active?.postMessage?.({type:'CLEAR_ALL_CACHES'});
          registration.waiting?.postMessage?.({type:'CLEAR_ALL_CACHES'});
          registration.installing?.postMessage?.({type:'CLEAR_ALL_CACHES'});
          await registration.update().catch(()=>false);
        }
      }
      if('caches' in window){
        const names=await caches.keys();
        await Promise.all(names.map(name=>caches.delete(name).catch(()=>false)));
      }
      for(const key of Object.keys(localStorage)){
        if(/andrik-control-(home-last-good|youtube-pane|youtube-monitor|system-cache|runtime-version)/i.test(key))localStorage.removeItem(key);
      }
      setText('siteUpdateCacheMessage','Кэш Control очищен. ADMIN_KEY и подписка push сохранены.');
      if(reload){
        await sleep(manual?450:5450);
        const url=new URL(location.href);
        url.searchParams.set('v',release?release.toLowerCase():SITE_UPDATE_UI_VERSION);
        url.searchParams.set('fresh',String(Date.now()));
        if(operationId)url.searchParams.set('deployed',operationId.slice(-12));
        location.replace(url.toString());
      }
      return true
    }catch(error){
      if(operationId)sessionStorage.removeItem(marker);
      setText('siteUpdateCacheMessage',`Не удалось полностью очистить кэш: ${error.message}`);
      return false
    }
  }
  function schedulePostDeployCacheRefresh(operationId='',release='',mode='publish'){
    if(!operationId||!['publish','rollback','recovery'].includes(mode))return;
    const marker=`${CACHE_REFRESH_PREFIX}${operationId}`;
    if(sessionStorage.getItem(marker)==='1')return;
    clearControlRuntimeCaches({reload:true,operationId,release,manual:false});
  }
  async function finalizeDeployment(operationId='',release='',mode='publish'){
    stage('protect','running');
    setResultState('','Проверяем сайт');
    setText('siteUpdateDeployMessage','Deploy готов. Проверяем Worker, D1 и главный сайт…');
    const allowRecovery=mode==='publish'&&autoRecoveryInput.checked;
    try{
      const data=await api('/api/control/site-update/finalize',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({operationId,release,autoRecovery:allowRecovery}),
        timeoutMs:110000
      });
      renderHealth(data.health,data.message);
      if(data.recoveryStarted){
        stage('protect','warn');
        setResultState('warn','Автовосстановление');
        setText('siteUpdateResultTitle','Запущено самовосстановление');
        setText('siteUpdateResultText',`Критическая ошибка подтверждена. Возвращаем backup ${data.backupTag||data.targetShort||''}. Не закрывай страницу.`);
        lastOperationId=data.recoveryOperationId||'';
        lastRelease=data.release||release;
        savePendingDeploy(lastOperationId,lastRelease,'recovery');
        stage('deploy','running');
        await watchDeployment(lastOperationId,lastRelease,'recovery');
        return data
      }
      if(data.health?.status==='ok'){
        stage('protect','done');
        setResultState('done',mode==='recovery'?'Восстановлено':'Опубликовано');
        setText('siteUpdateDeployMessage',mode==='recovery'?'Backup восстановлен, система исправна.':'Deploy завершён, система прошла проверку.');
        clearPendingDeploy(operationId);
        schedulePostDeployCacheRefresh(operationId,release,mode);
      }else if(data.health?.status==='degraded'){
        stage('protect','warn');
        setResultState('warn','Опубликовано');
        setText('siteUpdateDeployMessage','Сайт работает. Есть некритические предупреждения. Обновляем локальный кэш Control.');
        clearPendingDeploy(operationId);
        schedulePostDeployCacheRefresh(operationId,release,mode);
      }else{
        stage('protect','error');
        setResultState('error','Требуется проверка');
        setText('siteUpdateDeployMessage',data.message||'Критическая ошибка. Автовосстановление не запущено.');
        clearPendingDeploy(operationId);
      }
      await Promise.allSettled([loadStatus(),loadHistory(),loadLog()]);
      return data
    }catch(error){
      // При откате на более старую сборку endpoint finalize может отсутствовать.
      if(mode==='recovery'&&error.status===404){
        const health=await directHealthCheck().catch(()=>({status:'down',checks:[]}));
        renderHealth(health,healthStatusText(health.status));
        if(health.status==='down'){
          stage('protect','error');
          setResultState('error','Проверь вручную');
          setText('siteUpdateDeployMessage','Backup развернулся, но проверка здоровья всё ещё критическая.');
        }else{
          stage('protect',health.status==='ok'?'done':'warn');
          setResultState(health.status==='ok'?'done':'warn','Восстановлено');
          setText('siteUpdateDeployMessage','Backup развернулся. Проверка выполнена через публичный Health API.');
        }
        return {health}
      }
      stage('protect','warn');
      setResultState('warn','Проверка не завершена');
      setText('siteUpdateDeployMessage',`Deploy выполнен, но автопроверка не завершилась: ${error.message}`);
      return null
    }
  }
  async function manualHealthCheck(){
    if(operation)return;
    setBusy(true);
    stage('protect','running');
    setText('siteUpdateHealthMessage','Проверяем Worker, D1 и сайт…');
    try{
      const data=await api('/api/control/site-update/finalize',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({operationId:'',autoRecovery:false,manual:true}),
        timeoutMs:60000
      });
      renderHealth(data.health,data.message);
      stage('protect',data.health?.status==='ok'?'done':data.health?.status==='degraded'?'warn':'error');
      await loadLog();
    }catch(error){
      stage('protect','error');
      setText('siteUpdateHealthMessage',`Проверка: ${error.message}`);
    }finally{setBusy(false)}
  }
  async function watchDeployment(operationId='',release='',mode='publish'){
    if(operationId)savePendingDeploy(operationId,release,mode);
    stage('deploy','running');
    setText('siteUpdateDeployMessage',operationId?'Автопроверка точного Cloudflare Deploy запущена…':`Ищем ${release} на Control…`);
    for(let i=0;i<36;i++){
      const data=await checkDeployment(operationId,release,true);
      if(data?.deployed){
        await finalizeDeployment(operationId,release,mode);
        return data
      }
      setResultState('warn','Ждёт Cloudflare');
      setText('siteUpdateDeployMessage',`Cloudflare ещё разворачивает сайт. Автопроверка ${i+1}/36 — страницу можно свернуть.`);
      await sleep(document.hidden?15000:(i<4?2500:i<12?5000:8000));
    }
    stage('deploy','warn');
    stage('protect','skipped');
    setResultState('warn','Ждёт Cloudflare');
    setText('siteUpdateDeployMessage','Cloudflare ещё не подтвердил Deploy. Автопроверка продолжится после возврата или повторного открытия Control.');
    schedulePendingResume(12000);
    return null
  }
  function schedulePendingResume(delay=5000){
    clearTimeout(pendingResumeTimer);
    pendingResumeTimer=setTimeout(()=>resumePendingDeploy(),Math.max(500,delay));
  }
  async function resumePendingDeploy(force=false){
    const pending=readPendingDeploy();
    if(!pending||pendingResumeBusy||operation||!hasOwnerAccess())return null;
    pendingResumeBusy=true;
    lastOperationId=pending.operationId;lastRelease=pending.release||'';
    byId('siteUpdateResultCard').hidden=false;
    byId('siteUpdateConsoleR195')?.classList.add('is-active');
    stage('check','done');stage('backup','done');stage('commit','done');stage('release','done');stage('deploy','running');
    setResultState('warn','Проверяем Deploy');
    setText('siteUpdateResultTitle',`${pending.release||'Версия'} — продолжаем установку`);
    setText('siteUpdateDeployMessage','Возобновлена автоматическая проверка Cloudflare…');
    try{
      const data=await checkDeployment(pending.operationId,pending.release||'',true);
      if(data?.deployed){await finalizeDeployment(pending.operationId,pending.release||'',pending.mode||'publish');return data;}
      setResultState('warn','Ждёт Cloudflare');
      setText('siteUpdateDeployMessage','Cloudflare продолжает Deploy. Следующая проверка выполнится автоматически.');
      schedulePendingResume(document.hidden?20000:6000);
      return null;
    }catch(error){
      setResultState('warn','Повторная проверка');
      setText('siteUpdateDeployMessage',`Автопроверка временно не ответила: ${error.message}`);
      schedulePendingResume(10000);
      return null;
    }finally{pendingResumeBusy=false;}
  }
  async function checkDeployNow(){
    const pending=readPendingDeploy();
    const operationId=pending?.operationId||lastOperationId;
    const release=pending?.release||lastRelease||byId('siteUpdateRelease').value.trim().toUpperCase();
    if(!operationId&&!release)return null;
    stage('deploy','running');setResultState('','Проверяем Deploy');
    const data=await checkDeployment(operationId,release,false);
    if(data?.deployed)await finalizeDeployment(operationId,release,pending?.mode||'publish');
    else schedulePendingResume(5000);
    return data;
  }
  async function publish(){
    const file=selectedFile();
    if(operation){
      setText('siteUpdateUploadMessage','Установка уже запущена. Дождись завершения текущего этапа.');
      return;
    }
    if(!file){
      setText('siteUpdateFileState','Не выбран');
      setText('siteUpdateUploadMessage','Сначала выбери полный ZIP сайта.');
      return;
    }
    if(!previewData){
      setText('siteUpdateFileState','Проверяем…');
      setText('siteUpdateUploadMessage','ZIP ещё не проверен. Запускаю проверку повторно…');
      await preview();
      if(!previewData)return;
    }
    if(!canPublishPreview()){
      setText('siteUpdateFileState','Нет изменений');
      setText('siteUpdateUploadMessage','ZIP не содержит изменений и не разрешён для повторной установки.');
      return;
    }
    const release=byId('siteUpdateRelease').value.trim().toUpperCase();
    const reinstall=!previewData.hasChanges&&previewData.canReinstall;
    // R195: one-button installation. Android PWA/WebView sometimes suppresses
    // confirm() dialogs, making an active button appear dead. Preview has already
    // validated the archive, so start immediately and show progress inline.
    setText('siteUpdateUploadMessage',reinstall?'Запускаю безопасную повторную установку…':'Запускаю безопасное обновление…');
    resetStages();stage('check','done');stage('backup','running');byId('siteUpdateResultCard').hidden=false;
    setResultState('','В процессе');setText('siteUpdateResultTitle',reinstall?'Повторная установка запущена':'Обновление запущено');setText('siteUpdateResultText','Создаём защитный backup…');setBusy(true);
    let backupData=null,publishData=null,releaseData=null;
    try{
      backupData=await createBackup(release);stage('backup','done');setText('siteUpdateResultText','Backup готов. Отправляем commit в GitHub…');
      stage('commit','running');
      const form=new FormData();
      form.append('archive',file,file.name);
      form.append('message',byId('siteUpdateMessage').value.trim());
      form.append('release',release);
      form.append('expectedHead',previewData.headSha||'');
      form.append('backupSha',backupData?.sha||'');
      form.append('backupTag',backupData?.tag||'');
      form.append('autoRecovery',autoRecoveryInput.checked?'yes':'no');
      form.append('forceReinstall',reinstall?'yes':'no');
      form.append('confirm','yes');
      publishData=await api('/api/control/site-update/publish',{method:'POST',body:form});
      if(publishData.noChanges){
        stage('commit','done');stage('release','skipped');stage('deploy','skipped');
        setResultState('done','Без изменений');setText('siteUpdateResultTitle','Изменений нет');setText('siteUpdateResultText',publishData.message);return
      }
      stage('commit','done');
      const commitLink=byId('siteUpdateCommitLink');commitLink.href=publishData.commitUrl;commitLink.hidden=!publishData.commitUrl;
      stage('release','running');
      try{
        releaseData=await createRelease(file,publishData);
        stage('release',releaseData.skipped?'skipped':'done');
        if(releaseData.releaseUrl){const link=byId('siteUpdateReleaseLink');link.href=releaseData.releaseUrl;link.hidden=false}
      }catch(error){stage('release','warn');releaseData={warning:error.message}}
      lastRelease=release;lastOperationId=publishData.operationId||'';lastPublish={backupData,publishData,releaseData};savePendingDeploy(lastOperationId,lastRelease,'publish');
      setText('siteUpdateResultTitle',publishData.reinstall?`${release} отправлена на повторную установку`:`${release} отправлена`);
      setText('siteUpdateResultText',`${publishData.reinstall?'Повторная установка · ':''}Commit ${publishData.commitShort} · ＋${publishData.added} ～${publishData.changed} −${publishData.deleted}${backupData?` · backup ${backupData.short}`:''}${releaseData?.warning?` · Release: ${releaseData.warning}`:''}`);
      setResultState('','Проверяем');byId('siteUpdateConsoleR195')?.classList.add('is-active');
      previewData=null;confirmInput.checked=false;setPublishMode(false);
      await Promise.allSettled([loadStatus(),loadHistory(),loadLog()]);
      await watchDeployment(lastOperationId,release,'publish')
    }catch(error){
      if(!publishData)stage('commit','error');setResultState('error','Ошибка');
      setText('siteUpdateResultTitle',reinstall?'Перепрошивка остановлена':'Публикация остановлена');
      setText('siteUpdateResultText',error.message);setText('siteUpdatePublishMessage',`Ошибка: ${error.message}`)
    }finally{setBusy(false)}
  }
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
    if(!hasOwnerAccess())return;
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
    if(!hasOwnerAccess())return;
    try{
      const data=await api('/api/control/site-update/log',{timeoutMs:18000}),box=byId('siteUpdateLog');
      const labels={
        'backup-created':'Backup создан',
        'github-publish':'ZIP → Commit',
        'github-reinstall':'Повторная установка',
        'release-created':'Release + ZIP',
        'github-rollback':'Откат отправлен',
        'github-publish-failed':'Ошибка commit',
        'release-failed':'Ошибка Release',
        'health-ok':'Проверка пройдена',
        'health-degraded':'Есть предупреждения',
        'health-down':'Критическая ошибка',
        'auto-recovery-started':'Автовосстановление'
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
    byId('siteUpdateConsoleR195')?.classList.add('is-active');
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
      savePendingDeploy(lastOperationId,lastRelease,'rollback');
      const commitLink=byId('siteUpdateCommitLink');
      commitLink.href=data.commitUrl||'#';
      commitLink.hidden=!data.commitUrl;
      setText('siteUpdateHistoryMessage',data.message);
      setText('siteUpdateResultText',`Rollback commit ${data.commitShort} · backup ${data.backupTag}`);
      setResultState('','Проверяем');
      await Promise.allSettled([loadStatus(),loadHistory(),loadLog()]);
      await watchDeployment(lastOperationId,lastRelease,'rollback');
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
  byId('siteUpdateVerify').addEventListener('click',loadStatus);byId('siteUpdateRefresh').addEventListener('click',loadStatus);byId('siteUpdateBackupNow').addEventListener('click',backupNow);byId('siteUpdateBackupZipCreate')?.addEventListener('click',createDownloadableZipBackup);byId('siteUpdateBackupZipDownload')?.addEventListener('click',downloadZipBackup);byId('siteUpdateBackupZipShare')?.addEventListener('click',shareZipBackup);byId('siteUpdateHealthCheck').addEventListener('click',manualHealthCheck);byId('siteUpdateCacheClear').addEventListener('click',()=>clearControlRuntimeCaches({reload:true,release:'R245',manual:true}));autoRecoveryInput.addEventListener('change',()=>{try{localStorage.setItem(AUTO_RECOVERY_KEY,autoRecoveryInput.checked?'1':'0')}catch(_){};setText('siteUpdateHealthMessage',autoRecoveryInput.checked?'Автооткат включён: критический сбой вернёт предыдущий backup.':'Автооткат выключен: проверка останется активной.');});previewButton.addEventListener('click',preview);
  let lastPublishGesture=0;
  const startPublishFromGesture=event=>{
    if(event){event.preventDefault();event.stopPropagation();}
    const now=Date.now();
    if(now-lastPublishGesture<700)return;
    lastPublishGesture=now;
    publish().catch(error=>{
      setText('siteUpdateFileState','Ошибка');
      setText('siteUpdateUploadMessage',`Ошибка запуска: ${error?.message||error}`);
    });
  };
  publishButton.addEventListener('click',startPublishFromGesture,{capture:true});
  publishButton.addEventListener('pointerup',event=>{
    if(event.pointerType==='touch'||event.pointerType==='pen')startPublishFromGesture(event);
  },{capture:true,passive:false});
  publishButton.addEventListener('touchend',startPublishFromGesture,{capture:true,passive:false});
  window.AndrikSiteUpdateR245={preview,publish,start:startPublishFromGesture,resume:resumePendingDeploy,checkDeploy:checkDeployNow,createZipBackup:createDownloadableZipBackup,version:SITE_UPDATE_UI_VERSION};window.AndrikSiteUpdateR244=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR243=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR242=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR241=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR240=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR239=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR238=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR237=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR232=window.AndrikSiteUpdateR245;window.AndrikSiteUpdateR195=window.AndrikSiteUpdateR245;byId('siteUpdateHistoryRefresh').addEventListener('click',()=>Promise.allSettled([loadStatus(),loadHistory(),loadLog()]));byId('siteUpdateCheckDeploy').addEventListener('click',()=>checkDeployNow());keyInput.addEventListener('input',()=>{captureKey();previewButton.disabled=operation||!selectedFile()||!hasOwnerAccess()});keyInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadStatus()}});resetStages();
  window.addEventListener('andrik-owner-session',event=>{
    if(event.detail?.active){
      keyInput.value=OWNER_SENTINEL;
      if(!operation)loadStatus();
    }
  });
  (async()=>{
    try{await window.AndrikOwnerSession?.ready?.();}catch(_){}
    if(window.AndrikOwnerSession?.isActive?.()){
      keyInput.value=OWNER_SENTINEL;
      loadStatus();
    }else if(hasOwnerAccess()){
      loadStatus();
    }else{
      setState(false,'Нужен ADMIN_KEY');
    }
    if(readPendingDeploy())schedulePendingResume(500);
  })();
  window.addEventListener('pageshow',()=>{if(readPendingDeploy())schedulePendingResume(400)},{passive:true});
  window.addEventListener('online',()=>{if(readPendingDeploy())schedulePendingResume(300)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&readPendingDeploy())schedulePendingResume(300)},{passive:true});
})();
