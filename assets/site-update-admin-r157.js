(() => {
  'use strict';
  const SITE_UPDATE_UI_VERSION='55.00-r157';
  const KEY_SESSION='andrik-comments-admin-key',KEY_LOCAL='andrik-comments-admin-key-persistent',AUTO_RECOVERY_KEY='andrik-site-update-auto-recovery',CACHE_REFRESH_PREFIX='andrik-site-update-cache-refresh:';
  const byId=id=>document.getElementById(id),keyInput=byId('siteUpdateAdminKey'),archiveInput=byId('siteUpdateArchive'),previewButton=byId('siteUpdatePreview'),publishButton=byId('siteUpdatePublish'),confirmInput=byId('siteUpdateConfirm'),autoRecoveryInput=byId('siteUpdateAutoRecovery');
  let previewData=null,lastRelease='',lastPublish=null,lastOperationId='',operation=false;
  try{
    keyInput.value=localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||'';
    autoRecoveryInput.checked=localStorage.getItem(AUTO_RECOVERY_KEY)!=='0';
  }catch(_){autoRecoveryInput.checked=true}
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
    if(path.includes('/finalize'))return 110000;
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
  function resetStages(){byId('siteUpdateStages').hidden=false;['check','backup','commit','release','deploy','protect'].forEach(name=>stage(name,''))}
  function setBusy(on){
    operation=on;
    previewButton.disabled=on||!archiveInput.files?.[0]||!getKey();
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
    previewButton.disabled=!getKey();publishButton.disabled=true;
    const match=file.name.match(/R\d+/i);
    if(match){
      lastRelease=match[0].toUpperCase();
      byId('siteUpdateRelease').value=lastRelease;
      byId('siteUpdateMessage').value=`ANDRIK Control — update website ${lastRelease}`
    }
    setText('siteUpdateUploadMessage',getKey()?'Автоматически проверяем ZIP…':'Сначала введи ADMIN_KEY в разделе подключения.');
    if(getKey())setTimeout(preview,120)
  });
  function pathsHtml(data){return [['Добавлены',data.paths?.added||[]],['Изменены',data.paths?.changed||[]],['Удалены',data.paths?.deleted||[]]].map(([title,items])=>`<section class="update-path-group"><h3>${escapeHtml(title)} · ${items.length}</h3>${items.length?items.map(path=>`<code>${escapeHtml(path)}</code>`).join(''):'<code>Нет</code>'}</section>`).join('')}
  async function preview(){
    const file=selectedFile();
    if(!file||!getKey()||operation)return;
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
  async function backupNow(){if(!getKey()||operation)return;setBusy(true);setText('siteUpdateConnectionMessage','Создаём резервную метку…');try{const data=await createBackup(byId('siteUpdateRelease').value||'manual',true);setText('siteUpdateConnectionMessage',data.message);await loadLog()}catch(error){setText('siteUpdateConnectionMessage',`Backup: ${error.message}`)}finally{setBusy(false)}}
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
        await sleep(manual?450:1500);
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
        stage('deploy','running');
        await watchDeployment(lastOperationId,lastRelease,'recovery');
        return data
      }
      if(data.health?.status==='ok'){
        stage('protect','done');
        setResultState('done',mode==='recovery'?'Восстановлено':'Опубликовано');
        setText('siteUpdateDeployMessage',mode==='recovery'?'Backup восстановлен, система исправна.':'Deploy завершён, система прошла проверку.');
        schedulePostDeployCacheRefresh(operationId,release,mode);
      }else if(data.health?.status==='degraded'){
        stage('protect','warn');
        setResultState('warn','Опубликовано');
        setText('siteUpdateDeployMessage','Сайт работает. Есть некритические предупреждения. Обновляем локальный кэш Control.');
        schedulePostDeployCacheRefresh(operationId,release,mode);
      }else{
        stage('protect','error');
        setResultState('error','Требуется проверка');
        setText('siteUpdateDeployMessage',data.message||'Критическая ошибка. Автовосстановление не запущено.');
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
    stage('deploy','running');
    setText('siteUpdateDeployMessage',operationId?'Проверяем точный маркер нового Deploy…':`Ищем ${release} на Control…`);
    for(let i=0;i<9;i++){
      const data=await checkDeployment(operationId,release,true);
      if(data?.deployed){
        await finalizeDeployment(operationId,release,mode);
        return data
      }
      await sleep(i<2?2200:i<5?4000:6000)
    }
    stage('deploy','warn');
    stage('protect','skipped');
    setResultState('warn','Ждёт Cloudflare');
    setText('siteUpdateDeployMessage','GitHub готов. Cloudflare продолжает Deploy. Нажми «Проверить» через несколько секунд.');
    return null
  }
  async function publish(){
    const file=selectedFile();
    if(!file||!canPublishPreview()||operation)return;
    const release=byId('siteUpdateRelease').value.trim().toUpperCase();
    const reinstall=!previewData.hasChanges&&previewData.canReinstall;
    const confirmation=reinstall
      ?`Перепрошить ${release} повторно?\n\nZIP совпадает с main. Будут созданы новый backup, commit, Release и Cloudflare Deploy.`
      :`Опубликовать ${release}?\n\n＋${previewData.added}  ～${previewData.changed}  −${previewData.deleted}`;
    if(!confirm(confirmation))return;
    resetStages();stage('check','done');byId('siteUpdateResultCard').hidden=false;
    setResultState('','В процессе');setBusy(true);
    let backupData=null,publishData=null,releaseData=null;
    try{
      stage('backup','running');backupData=await createBackup(release);stage('backup','done');
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
      lastRelease=release;lastOperationId=publishData.operationId||'';lastPublish={backupData,publishData,releaseData};
      setText('siteUpdateResultTitle',publishData.reinstall?`${release} отправлена на повторную установку`:`${release} отправлена`);
      setText('siteUpdateResultText',`${publishData.reinstall?'Повторная установка · ':''}Commit ${publishData.commitShort} · ＋${publishData.added} ～${publishData.changed} −${publishData.deleted}${backupData?` · backup ${backupData.short}`:''}${releaseData?.warning?` · Release: ${releaseData.warning}`:''}`);
      setResultState('','Проверяем');byId('siteUpdateResultCard').scrollIntoView({behavior:'smooth',block:'start'});
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
  byId('siteUpdateVerify').addEventListener('click',loadStatus);byId('siteUpdateRefresh').addEventListener('click',loadStatus);byId('siteUpdateBackupNow').addEventListener('click',backupNow);byId('siteUpdateHealthCheck').addEventListener('click',manualHealthCheck);byId('siteUpdateCacheClear').addEventListener('click',()=>clearControlRuntimeCaches({reload:true,release:'R115',manual:true}));autoRecoveryInput.addEventListener('change',()=>{try{localStorage.setItem(AUTO_RECOVERY_KEY,autoRecoveryInput.checked?'1':'0')}catch(_){};setText('siteUpdateHealthMessage',autoRecoveryInput.checked?'Автооткат включён: критический сбой вернёт предыдущий backup.':'Автооткат выключен: проверка останется активной.');});previewButton.addEventListener('click',preview);publishButton.addEventListener('click',publish);byId('siteUpdateHistoryRefresh').addEventListener('click',()=>Promise.allSettled([loadStatus(),loadHistory(),loadLog()]));byId('siteUpdateCheckDeploy').addEventListener('click',()=>checkDeployment(lastOperationId,lastRelease||byId('siteUpdateRelease').value.trim().toUpperCase()));keyInput.addEventListener('input',()=>{previewButton.disabled=operation||!selectedFile()||!getKey()});keyInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadStatus()}});resetStages();if(getKey())loadStatus();else setState(false,'Нужен ADMIN_KEY');
})();
