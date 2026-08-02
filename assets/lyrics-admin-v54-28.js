(() => {
  const KEY_SESSION='andrik-comments-admin-key', KEY_LOCAL='andrik-comments-admin-key-persistent';
  const keyInput=document.getElementById('lyricsAdminKey');
  const videoInput=document.getElementById('lyricsVideoId');
  const titleInput=document.getElementById('lyricsTitle');
  const artistInput=document.getElementById('lyricsArtist');
  const enabledInput=document.getElementById('lyricsEnabled');
  const bodyInput=document.getElementById('lyricsBody');
  const rowsBox=document.getElementById('lyricsSyncRows');
  const message=document.getElementById('lyricsAdminMessage');
  const list=document.getElementById('lyricsAdminList');
  const authStrip=document.getElementById('lyricsAuthStrip');
  const authText=document.getElementById('lyricsAuthText');
  const previewTitle=document.getElementById('lyricsPreviewTitle');
  const timeText=document.getElementById('lyricsPlayerTime');
  const publishButton=document.getElementById('lyricsPublishRelease');
  const preflightTitle=document.getElementById('lyricsPreflightTitle');
  const preflightScore=document.getElementById('lyricsPreflightScore');
  const releaseModal=document.getElementById('lyricsReleaseModal');
  const releaseModalTitle=document.getElementById('lyricsReleaseModalTitle');
  const releaseModalText=document.getElementById('lyricsReleaseModalText');
  const releaseResultList=document.getElementById('lyricsReleaseResultList');
  const DRAFT_PREFIX='andrik-lyrics-draft-v54-27:';
  const LAST_DRAFT_KEY='andrik-lyrics-last-draft-v54-27';
  let rows=[], activeIndex=0, player=null, playerReady=false, timeTimer=0, pushConfigured=false, pendingAutofillVideoId='', draftTimer=0, draftIdle=0, lastDraftJson='', restoringDraft=false;

  try{keyInput.value=localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){}
  const getKey=()=>keyInput.value.trim();
  const escapeHtml=v=>String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const formatTime=ms=>{ms=Math.max(0,Math.round(Number(ms)||0));const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000),x=ms%1000;return `${m}:${String(s).padStart(2,'0')}.${String(x).padStart(3,'0')}`};
  const cleanVideoTitle=value=>String(value||'').replace(/^ANDRIK\s*[|–—-]\s*/i,'').replace(/\s*[|–—-]\s*(?:Official\s+(?:Audio|Music Video|Video)|Lyrics?\s*Video|Visualizer|Официальн(?:ое|ый)\s+(?:аудио|клип|видео)).*$/i,'').replace(/\s*\((?:Official\s+(?:Audio|Video)|Lyrics?\s*Video|Visualizer|Официальн(?:ое|ый)\s+(?:аудио|клип|видео))\)\s*$/i,'').trim();
  function setPreflightItem(id,ok,detail=''){
    const el=document.getElementById(id);if(!el)return;
    const steps={preflightVideo:'1',preflightTitle:'2',preflightLines:'3',preflightTimings:'4',preflightPush:'5'};
    el.classList.toggle('is-ready',Boolean(ok));el.classList.toggle('is-warning',!ok);
    const badge=el.querySelector(':scope > span');if(badge)badge.textContent=ok?'✓':steps[id]||'•';
    const small=el.querySelector('small');if(small&&detail)small.textContent=detail;
  }
  function updatePreflight(){
    const videoOk=Boolean(extractVideoId(videoInput.value));
    const titleOk=Boolean(titleInput.value.trim());
    const linesOk=rows.length>0;
    const marked=rows.filter(row=>Number.isFinite(row.startMs)).length;
    const timingsOk=linesOk&&marked===rows.length;
    const checks=[videoOk,titleOk,linesOk,timingsOk,pushConfigured];
    setPreflightItem('preflightVideo',videoOk,videoOk?'Видео определено':'Вставьте ID или ссылку YouTube');
    setPreflightItem('preflightTitle',titleOk,titleOk?'Название готово':'Заполните название песни');
    setPreflightItem('preflightLines',linesOk,linesOk?`${rows.length} строк подготовлено`:'Вставьте текст и подготовьте строки');
    setPreflightItem('preflightTimings',timingsOk,linesOk?`${marked} из ${rows.length} строк отмечено`:'Сначала подготовьте строки');
    setPreflightItem('preflightPush',pushConfigured,pushConfigured?'OneSignal подключён':'Push пока не настроен');
    const score=checks.filter(Boolean).length;
    if(preflightScore)preflightScore.textContent=`${score} / 5`;
    if(preflightTitle)preflightTitle.textContent=score===5?'Релиз полностью готов':score>=3?'Осталось немного':'Подготовьте релиз';
    const autoWordsButton=document.getElementById('lyricsAutoWords');if(autoWordsButton){autoWordsButton.disabled=!timingsOk;autoWordsButton.title=timingsOk?'Автоматически распределить слова между отмеченными строками':'Сначала отметьте начало всех строк'}
    if(publishButton){publishButton.disabled=!(videoOk&&titleOk&&linesOk&&timingsOk&&pushConfigured&&getKey());publishButton.title=publishButton.disabled?'Завершите все пункты проверки':'Текст, push и история будут опубликованы одним нажатием'}
  }
  async function loadPushStatus(){try{const r=await fetch('/api/push/config',{headers:{accept:'application/json'},cache:'no-store'});const d=await r.json().catch(()=>({}));pushConfigured=Boolean(r.ok&&d.enabled&&d.appId)}catch(_){pushConfigured=false}updatePreflight()}
  function fillFromVideo({force=false}={}){
    if(!playerReady||!player?.getVideoData){message.textContent='Сначала откройте видео.';return false}
    const data=player.getVideoData()||{};
    const title=cleanVideoTitle(data.title||'');
    if(title&&(force||!titleInput.value.trim()))titleInput.value=title;
    if(data.author&&(force||!artistInput.value.trim()||artistInput.value.trim()==='ANDRIK'))artistInput.value='ANDRIK';
    if(data.video_id)videoInput.value=data.video_id;
    previewTitle.textContent=titleInput.value.trim()||title||`YouTube · ${data.video_id||''}`;
    updatePreflight();
    if(title){message.textContent='Название и ID заполнены из YouTube ✅';return true}
    message.textContent='YouTube ещё не отдал название. Нажмите воспроизведение и повторите.';return false
  }
  function showReleaseModal(data){
    const duplicate=Boolean(data?.alreadyPublished);const pushOk=Boolean(data?.push?.ok);const recipients=Number(data?.push?.recipients);
    releaseModalTitle.textContent=duplicate?'Релиз обновлён':'Релиз опубликован';
    releaseModalText.textContent=duplicate?'Текст обновлён. Повторный push для этого видео безопасно заблокирован.':'Один клик выполнил весь цикл публикации ANDRIK.';
    const rows=[['✓','Текст сохранён в D1'],['✓','Текст включён в большом плеере'],[duplicate?'↺':(pushOk?'✓':'!'),duplicate?'Повторная рассылка не отправлена':(pushOk?`Push отправлен${Number.isFinite(recipients)?` · ${recipients} получателей`:''}`:`Push не отправлен · ${data?.push?.error||'ошибка'}`)],['✓','Событие записано в историю']];
    releaseResultList.innerHTML=rows.map(([icon,text],index)=>`<div class="lyrics-release-result${index===2&&!duplicate&&!pushOk?' is-warning':''}"><span>${icon}</span><strong>${escapeHtml(text)}</strong></div>`).join('');
    releaseModal.hidden=false;document.body.classList.add('lyrics-modal-open');
  }
  function closeReleaseModal(){releaseModal.hidden=true;document.body.classList.remove('lyrics-modal-open')}

  function auth(ok,text){authStrip?.classList.toggle('is-ready',ok);authStrip?.classList.toggle('is-locked',!ok);if(authText)authText.textContent=text|| (ok?'Доступ подтверждён':'Ключ не найден');updatePreflight()}
  async function api(url,options={}){const r=await fetch(url,{...options,headers:{accept:'application/json',authorization:`Bearer ${getKey()}`,...(options.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d}
  function extractVideoId(value){const raw=String(value||'').trim();if(/^[\w-]{11}$/.test(raw))return raw;try{const u=new URL(raw);if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';if(u.searchParams.get('v'))return u.searchParams.get('v');const p=u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/);return p?p[1]:''}catch(_){return ''}}
  function parseLine(line){const m=String(line).match(/^\[(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\]\s*(.*)$/);if(!m)return{startMs:null,text:String(line).trim()};return{startMs:(((Number(m[1]||0)*60+Number(m[2]||0))*60+Number(m[3]||0))*1000)+Number(String(m[4]||'0').padEnd(3,'0').slice(0,3)),text:m[5].trim()}}
  function parseText(text){return String(text||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map(parseLine).filter(x=>x.text)}
  function normalizeWords(words,text=''){
    const clean=(Array.isArray(words)?words:[]).map(word=>({
      startMs:Number.isFinite(Number(word?.startMs))?Math.max(0,Math.round(Number(word.startMs))):null,
      text:String(word?.text||'').trim()
    })).filter(word=>word.text);
    return clean;
  }
  function buildWordTimings(row,nextStartMs){
    if(!Number.isFinite(row?.startMs))return [];
    const words=String(row.text||'').trim().split(/\s+/).filter(Boolean);
    if(!words.length)return [];
    const start=Math.max(0,Math.round(row.startMs));
    const fallback=Math.max(1500,Math.min(7000,words.length*430));
    const end=Number.isFinite(nextStartMs)&&nextStartMs>start+300?Math.round(nextStartMs):start+fallback;
    const usable=Math.max(450,end-start-90);
    const weights=words.map(word=>Math.max(1.2,Math.min(8,String(word).replace(/[^\p{L}\p{N}]/gu,'').length*.72+1)));
    const total=weights.reduce((sum,value)=>sum+value,0)||words.length;
    let cursor=start;
    return words.map((word,index)=>{
      const entry={text:word,startMs:Math.round(cursor)};
      cursor+=usable*(weights[index]/total);
      return entry;
    });
  }
  function generateWordTimings({silent=false}={}){
    if(!rows.length)return false;
    const missing=rows.findIndex(row=>!Number.isFinite(row.startMs));
    if(missing>=0){if(!silent)message.textContent=`Сначала отметьте время строки ${missing+1}.`;return false}
    rows=rows.map((row,index)=>({...row,words:buildWordTimings(row,rows[index+1]?.startMs)}));
    renderRows({scroll:false});
    scheduleDraft();
    if(!silent)message.textContent='Слова автоматически распределены между строками ✅ При необходимости поправьте только начало строки.';
    return true;
  }
  function draftKey(){const id=extractVideoId(videoInput.value);return id?`${DRAFT_PREFIX}${id}`:LAST_DRAFT_KEY}
  function draftPayload(){return{
    videoId:extractVideoId(videoInput.value)||String(videoInput.value||'').trim(),
    title:titleInput.value.trim(),artist:artistInput.value.trim()||'ANDRIK',enabled:enabledInput.checked,
    body:bodyInput.value,rows,activeIndex,updatedAt:new Date().toISOString()
  }}
  function saveDraft(){
    if(restoringDraft)return;
    try{
      const payload=draftPayload();
      const json=JSON.stringify(payload);
      if(json===lastDraftJson)return;
      const key=draftKey();
      localStorage.setItem(key,json);
      if(key!==LAST_DRAFT_KEY)localStorage.setItem(LAST_DRAFT_KEY,JSON.stringify({ref:key,videoId:payload.videoId,updatedAt:payload.updatedAt}));
      lastDraftJson=json;
      const state=document.getElementById('lyricsDraftState');if(state)state.textContent='Черновик сохранён автоматически';
    }catch(_){}
  }
  function scheduleDraft(){
    window.clearTimeout(draftTimer);
    if(draftIdle&&'cancelIdleCallback' in window){try{cancelIdleCallback(draftIdle)}catch(_){}}
    draftTimer=window.setTimeout(()=>{
      const run=()=>{draftIdle=0;saveDraft()};
      if('requestIdleCallback' in window)draftIdle=requestIdleCallback(run,{timeout:1400});
      else draftIdle=window.setTimeout(run,0);
    },850);
  }
  function restoreDraft(){
    let raw='';try{raw=localStorage.getItem(draftKey())||localStorage.getItem(LAST_DRAFT_KEY)||''}catch(_){}
    if(!raw)return false;
    try{
      let draft=JSON.parse(raw);
      if(draft?.ref){try{const linked=localStorage.getItem(draft.ref);if(linked)draft=JSON.parse(linked)}catch(_){}}
      if(!draft||!Array.isArray(draft.rows)||!draft.rows.length)return false;
      const requested=extractVideoId(videoInput.value);const stored=extractVideoId(draft.videoId||'');
      if(requested&&stored&&requested!==stored)return false;
      restoringDraft=true;
      videoInput.value=stored||draft.videoId||videoInput.value;
      titleInput.value=draft.title||titleInput.value;
      artistInput.value=draft.artist||'ANDRIK';enabledInput.checked=draft.enabled!==false;
      rows=draft.rows.map(row=>({startMs:Number.isFinite(Number(row?.startMs))?Number(row.startMs):null,text:String(row?.text||''),words:normalizeWords(row?.words,row?.text)})).filter(row=>row.text);
      bodyInput.value=draft.body||rows.map(row=>row.text).join('\n');
      const missing=rows.findIndex(row=>!Number.isFinite(row.startMs));
      activeIndex=Number.isInteger(draft.activeIndex)?Math.max(0,Math.min(rows.length-1,draft.activeIndex)):(missing>=0?missing:Math.max(0,rows.length-1));
      renderRows({scroll:false});previewTitle.textContent=draft.title||'Черновик восстановлен';
      const state=document.getElementById('lyricsDraftState');if(state)state.textContent='Черновик восстановлен после возврата в приложение';
      message.textContent='Незавершённая разметка восстановлена ✅';
      lastDraftJson=JSON.stringify(draft);restoringDraft=false;return true;
    }catch(_){restoringDraft=false;return false}
  }
  function currentMs(){try{return playerReady&&player?.getCurrentTime?Math.max(0,Math.round(player.getCurrentTime()*1000)):0}catch(_){return 0}}
  function updateProgress(){const marked=rows.filter(r=>Number.isFinite(r.startMs)).length;const wordReady=rows.filter(r=>Array.isArray(r.words)&&r.words.length).length;document.getElementById('lyricsProgressText').textContent=`${marked} из ${rows.length} строк · слова ${wordReady}/${rows.length}`;document.getElementById('lyricsProgressBar').style.width=`${rows.length?marked/rows.length*100:0}%`;updatePreflight()}
  function keepActiveRowVisible(){
    const active=rowsBox.querySelector('.is-active');
    if(!active||rowsBox.scrollHeight<=rowsBox.clientHeight+4)return;
    const top=active.offsetTop;
    const bottom=top+active.offsetHeight;
    const visibleTop=rowsBox.scrollTop+8;
    const visibleBottom=rowsBox.scrollTop+rowsBox.clientHeight-8;
    if(top<visibleTop||bottom>visibleBottom){
      rowsBox.scrollTo({top:Math.max(0,top-(rowsBox.clientHeight-active.offsetHeight)/2),behavior:'auto'});
    }
  }
  function renderRows({scroll=false}={}){
    if(!rows.length){rowsBox.innerHTML='<div class="admin-empty">Сначала вставьте текст и нажмите «Подготовить строки».</div>';updateProgress();return}
    const previousScroll=rowsBox.scrollTop;
    rowsBox.innerHTML=rows.map((row,i)=>`<article class="lyrics-sync-row${i===activeIndex?' is-active':''}${Number.isFinite(row.startMs)?' is-marked':''}${Array.isArray(row.words)&&row.words.length?' has-word-timing':''}" data-index="${i}"><button class="lyrics-time-btn" data-action="seek" type="button">${Number.isFinite(row.startMs)?formatTime(row.startMs):'—:—.---'}</button><span class="lyrics-row-number">${i+1}</span><textarea data-action="edit" rows="1">${escapeHtml(row.text)}</textarea><button aria-label="Удалить строку" class="lyrics-row-delete" data-action="delete" type="button">×</button></article>`).join('');
    rowsBox.scrollTop=previousScroll;
    updateProgress();
    if(scroll)requestAnimationFrame(keepActiveRowVisible);
  }
  function prepare(){const parsed=parseText(bodyInput.value);if(!parsed.length){message.textContent='Вставьте текст песни.';return}rows=parsed.map(row=>({...row,words:[]}));const missing=rows.findIndex(r=>!Number.isFinite(r.startMs));activeIndex=missing>=0?missing:Math.max(0,rows.length-1);renderRows({scroll:false});scheduleDraft();message.textContent='Строки готовы. Откройте видео и начинайте синхронизацию.'}
  function openVideo(){const id=extractVideoId(videoInput.value);if(!id){message.textContent='Не удалось определить ID YouTube.';return}videoInput.value=id;pendingAutofillVideoId=id;previewTitle.textContent=titleInput.value.trim()||`YouTube · ${id}`;const build=()=>{if(player?.loadVideoById){player.loadVideoById({videoId:id,startSeconds:0});message.textContent='Загружаем видео и считываем название…';return}player=new YT.Player('lyricsYoutubePreview',{height:'100%',width:'100%',videoId:id,playerVars:{playsinline:1,rel:0,modestbranding:1},events:{onReady:()=>{playerReady=true;fillFromVideo();message.textContent='Видео готово. Название заполнено автоматически — запускайте песню и отмечайте строки.'},onStateChange:event=>{updatePlayButton(event);const current=player?.getVideoData?.()||{};if(pendingAutofillVideoId&&current.video_id===pendingAutofillVideoId){fillFromVideo({force:true});pendingAutofillVideoId=''}else if(!titleInput.value.trim())fillFromVideo()}}})};if(window.YT?.Player)build();else{window.onYouTubeIframeAPIReady=build;message.textContent='Подключаем YouTube…'}}
  function updatePlayButton(){const b=document.getElementById('lyricsPlayPause');if(!b||!playerReady)return;let state=-1;try{state=player.getPlayerState()}catch(_){};window.ANDRIK_SLEEP_MODE?.markMediaActive(state===1);b.textContent=state===1?'⏸ Пауза':'▶ Воспроизвести'}
  function mark(){if(!rows.length){message.textContent='Сначала подготовьте строки.';return}if(!playerReady){message.textContent='Сначала откройте видео.';return}const markedIndex=activeIndex;rows[markedIndex].startMs=currentMs();rows[markedIndex].words=[];if(markedIndex>0)rows[markedIndex-1].words=[];if(activeIndex<rows.length-1)activeIndex++;renderRows({scroll:true});scheduleDraft();message.textContent=`Отмечено: ${formatTime(rows[markedIndex].startMs)}. Следующая строка выделена.`}
  function undo(){if(!rows.length)return;if(activeIndex>0&&!Number.isFinite(rows[activeIndex].startMs))activeIndex--;rows[activeIndex].startMs=null;rows[activeIndex].words=[];if(activeIndex>0)rows[activeIndex-1].words=[];renderRows({scroll:true});scheduleDraft();message.textContent='Последняя отметка отменена.'}
  function clearTimes(){rows.forEach(r=>{r.startMs=null;r.words=[]});activeIndex=0;renderRows({scroll:false});scheduleDraft();message.textContent='Тайминги сброшены.'}
  async function loadList(){if(!getKey()){auth(false,'Откройте «Служебное» и сохраните ключ');list.innerHTML='<div class="admin-empty">Нет сохранённого ключа.</div>';return}try{const data=await api('/api/lyrics/admin');auth(true,'Доступ подтверждён');const items=data.lyrics||[];list.innerHTML=items.length?items.map(item=>`<button class="admin-lyric-row" data-video-id="${escapeHtml(item.videoId)}" type="button"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.videoId)} · ${item.enabled?'показывается в плеере':'выключен'} · ${item.source==='manual'?'база ANDRIK':escapeHtml(item.source)}</span></button>`).join(''):'<div class="admin-empty">Текстов пока нет.</div>'}catch(error){auth(false,error.message==='unauthorized'?'Ключ неверный — откройте «Служебное»':'Ошибка доступа');list.innerHTML=`<div class="admin-empty">${escapeHtml(error.message)}</div>`}}
  function applyLyric(lyric){if(!lyric)return;videoInput.value=lyric.videoId||videoInput.value;titleInput.value=lyric.title||'';artistInput.value=lyric.artist||'ANDRIK';enabledInput.checked=lyric.enabled!==false;rows=(lyric.lines||[]).map(r=>({startMs:Number.isFinite(Number(r.startMs))?Number(r.startMs):null,text:String(r.text||''),words:normalizeWords(r.words,r.text)})).filter(r=>r.text);bodyInput.value=rows.map(r=>r.text).join('\n');const missing=rows.findIndex(r=>!Number.isFinite(r.startMs));activeIndex=missing>=0?missing:Math.max(0,rows.length-1);renderRows({scroll:false});previewTitle.textContent=lyric.title||'Текст загружен';scheduleDraft()}
  async function loadOne(){const id=extractVideoId(videoInput.value);if(!id){message.textContent='Введите ID или ссылку YouTube.';return}videoInput.value=id;try{const data=await api(`/api/lyrics/admin?videoId=${encodeURIComponent(id)}`);if(!data.lyric){message.textContent='Сохранённый текст не найден.';return}applyLyric(data.lyric);message.textContent='Текст загружен.'}catch(error){message.textContent=`Ошибка: ${error.message}`}}
  function releasePayload({requireSynced=false}={}){const id=extractVideoId(videoInput.value),title=titleInput.value.trim();if(!id||!title||!rows.length)throw new Error('Заполните видео, название и строки.');const bad=rows.findIndex((r,i)=>i>0&&Number.isFinite(r.startMs)&&Number.isFinite(rows[i-1].startMs)&&r.startMs<rows[i-1].startMs);if(bad>=0)throw new Error(`Тайминг строки ${bad+1} раньше предыдущей. Исправьте отметку.`);if(requireSynced){const missing=rows.findIndex(r=>!Number.isFinite(r.startMs));if(missing>=0)throw new Error(`Сначала отметьте время строки ${missing+1}. Для публикации нужны тайминги всех строк.`)}if(rows.every(row=>Number.isFinite(row.startMs)))generateWordTimings({silent:true});return{videoId:id,title,artist:artistInput.value.trim()||'ANDRIK',enabled:true,lines:rows.map(row=>({startMs:row.startMs,text:row.text,words:normalizeWords(row.words,row.text)}))}}
  async function save(){if(!getKey()){message.textContent='Сначала сохраните ключ в «Служебное».';return}try{const payload=releasePayload();const data=await api('/api/lyrics/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});enabledInput.checked=true;message.textContent=data.synced?'Синхронизация строк и слов сохранена ✅':'Текст сохранён. Не все строки имеют тайминг.';saveDraft();await loadList()}catch(error){message.textContent=error.message.startsWith('Ошибка:')?error.message:`Ошибка: ${error.message}`}}
  async function publishRelease(){if(!getKey()){message.textContent='Сначала сохраните ключ в «Служебное».';return}const button=publishButton;let payload;try{payload=releasePayload({requireSynced:true})}catch(error){message.textContent=error.message;return}button.disabled=true;button.classList.add('is-publishing');message.textContent='Публикуем текст и отправляем push всем подписчикам…';try{const data=await api('/api/releases/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});enabledInput.checked=true;if(data.alreadyPublished){message.textContent='Текст обновлён ✅ Повторная рассылка безопасно заблокирована.'}else if(data.push?.ok){message.textContent=`Релиз опубликован ✅ Push отправлен${Number.isFinite(Number(data.push.recipients))?` (${Number(data.push.recipients)} получателей)`:''}.`}else{message.textContent=`Текст опубликован ✅ Но push не отправлен: ${data.push?.error||'неизвестная ошибка'}.`};showReleaseModal(data);await loadList();updatePreflight()}catch(error){message.textContent=`Ошибка публикации: ${error.message}`}finally{button.classList.remove('is-publishing');updatePreflight()}}
  async function remove(){const id=extractVideoId(videoInput.value);if(!id){message.textContent='Введите ID видео.';return}if(!confirm('Удалить этот текст?'))return;try{await api(`/api/lyrics/admin?videoId=${encodeURIComponent(id)}`,{method:'DELETE'});rows=[];bodyInput.value='';renderRows({scroll:false});message.textContent='Текст удалён.';await loadList()}catch(error){message.textContent=`Ошибка: ${error.message}`}}
  async function importYoutube(){const id=extractVideoId(videoInput.value);if(!id){message.textContent='Введите ID или ссылку YouTube.';return}message.textContent='Получаем субтитры YouTube…';try{const r=await fetch(`/api/youtube-captions?videoId=${encodeURIComponent(id)}&lang=ru`,{cache:'no-store'});const d=await r.json();if(d.status!=='available'||!d.lines?.length)throw new Error('YouTube не отдал субтитры для этого видео.');rows=d.lines.map(x=>({startMs:Number(x.startMs),text:String(x.text||'')}));bodyInput.value=rows.map(r=>r.text).join('\n');activeIndex=0;renderRows({scroll:false});message.textContent='Субтитры загружены как черновик. Проверьте слова и тайминги.'}catch(error){message.textContent=`Ошибка: ${error.message}`}}
  rowsBox.addEventListener('click',e=>{const rowEl=e.target.closest('.lyrics-sync-row');if(!rowEl)return;const i=Number(rowEl.dataset.index),action=e.target.dataset.action;if(action==='delete'){rows.splice(i,1);activeIndex=Math.min(activeIndex,Math.max(0,rows.length-1));renderRows({scroll:false});return}activeIndex=i;if(action==='seek'&&Number.isFinite(rows[i].startMs)&&playerReady){player.seekTo(rows[i].startMs/1000,true);player.playVideo()}renderRows({scroll:false})});
  rowsBox.addEventListener('input',e=>{if(e.target.dataset.action!=='edit')return;const row=e.target.closest('.lyrics-sync-row');if(row){const index=Number(row.dataset.index);rows[index].text=e.target.value;rows[index].words=[];bodyInput.value=rows.map(item=>item.text).join('\n');scheduleDraft()}});
  document.getElementById('lyricsPrepare').addEventListener('click',prepare);document.getElementById('lyricsOpenVideo').addEventListener('click',openVideo);document.getElementById('lyricsFillVideo').addEventListener('click',()=>fillFromVideo({force:true}));document.getElementById('lyricsLoad').addEventListener('click',loadOne);document.getElementById('lyricsMarkCurrent').addEventListener('click',mark);document.getElementById('lyricsUndoMark').addEventListener('click',undo);document.getElementById('lyricsClearTimes').addEventListener('click',clearTimes);document.getElementById('lyricsAutoWords')?.addEventListener('click',()=>generateWordTimings());document.getElementById('lyricsSave').addEventListener('click',save);document.getElementById('lyricsPublishRelease').addEventListener('click',publishRelease);document.getElementById('lyricsDelete').addEventListener('click',remove);document.getElementById('lyricsYoutube').addEventListener('click',importYoutube);document.getElementById('lyricsRefreshList').addEventListener('click',loadList);
  document.getElementById('lyricsPlayPause').addEventListener('click',()=>{if(!playerReady){openVideo();return}const st=player.getPlayerState();st===1?player.pauseVideo():player.playVideo()});
  list.addEventListener('click',async e=>{
    const row=e.target.closest('[data-video-id]');if(!row)return;
    const pageY=window.scrollY;
    videoInput.value=row.dataset.videoId;
    await loadOne();
    requestAnimationFrame(()=>window.scrollTo({top:pageY,behavior:'auto'}));
  });
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if(e.key==='Enter'){e.preventDefault();mark()}if(e.code==='Space'&&playerReady){e.preventDefault();const st=player.getPlayerState();st===1?player.pauseVideo():player.playVideo()}});
  [videoInput,titleInput,artistInput,enabledInput,bodyInput].forEach(el=>el?.addEventListener('input',()=>{updatePreflight();scheduleDraft()}));
  document.getElementById('lyricsReleaseModalClose')?.addEventListener('click',closeReleaseModal);
  document.getElementById('lyricsReleaseModalDone')?.addEventListener('click',closeReleaseModal);
  releaseModal?.addEventListener('click',event=>{if(event.target===releaseModal)closeReleaseModal()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!releaseModal?.hidden)closeReleaseModal()});
  const initialParams=new URLSearchParams(location.search);const initialVideo=extractVideoId(initialParams.get('videoId')||'');
  if(initialVideo){videoInput.value=initialVideo;titleInput.value=initialParams.get('title')||'';artistInput.value=initialParams.get('artist')||'ANDRIK'}
  const draftRestored=restoreDraft();
  if(initialVideo)setTimeout(openVideo,250);else if(draftRestored&&extractVideoId(videoInput.value))setTimeout(openVideo,350)
  timeTimer=setInterval(()=>{if(timeText)timeText.textContent=formatTime(currentMs());updatePlayButton()},160);
  loadPushStatus();updatePreflight();
  const flushDraft=()=>{window.clearTimeout(draftTimer);if(draftIdle&&'cancelIdleCallback' in window){try{cancelIdleCallback(draftIdle)}catch(_){}}draftIdle=0;saveDraft()};
  window.addEventListener('pagehide',flushDraft);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushDraft()});
  if(getKey()){auth(true,'Проверяем сохранённый ключ…');loadList()}else auth(false,'Ключ не сохранён — откройте «Служебное»');
})();