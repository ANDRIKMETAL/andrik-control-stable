(function(){
  const form = document.querySelector('[data-comments-form]');
  if (!form) return;

  const lang = (document.documentElement.lang || 'ru').toLowerCase().split('-')[0];
  const allCopy = {
    ru:{
      heading:'💬 Выберите способ общения',
      intro:'Присоединяйтесь к обсуждению удобным способом.',
      google:'🟢 Войти через Google', googleSub:'Комментарий публикуется сразу',
      anonymous:'🟡 Написать анонимно', anonymousSub:'Сообщение отправляется на модерацию и после одобрения появится на сайте',
      googleTitle:'Для быстрого чата нужна авторизация Google',
      googleHint:'После входа комментарии публикуются сразу. Все сообщения модерируются.',
      anonymousTitle:'Анонимный комментарий с модерацией',
      anonymousHint:'Напишите имя или псевдоним. Сообщение появится после модерации.',
      signed:'Вы вошли через Google:', signOut:'Выйти', change:'Изменить способ', anonymousSwitch:'Перейти на анонимный',
      fallback:'Если окно Google не появилось, нажмите кнопку входа ниже.',
      verifying:'Проверяем Google…', verified:'Google подключён. Можно писать в обсуждение.',
      verifyError:'Не удалось подтвердить вход Google. Попробуйте ещё раз.',
      published:'Комментарий опубликован сразу.', authExpired:'Сессия Google истекла. Войдите снова.',
      validation:'Введите имя и сообщение.', reload:'Обновляем обсуждение…',
      chooseFirst:'Сначала выберите: Google или анонимная отправка.',
      anonymousMode:'Анонимный режим: сообщение уйдёт ANDRIK на подтверждение.',
      googleMode:'Google-режим: сообщение появится сразу.', publishGoogle:'Опубликовать сразу', publishAnonymous:'Отправить на модерацию', publishChoice:'Выберите способ общения'
    },
    uk:{
      heading:'Як залишити коментар?', intro:'Оберіть зручний спосіб публікації.',
      google:'Увійти через Google', googleSub:'Повідомлення одразу з’явиться в обговоренні',
      anonymous:'Продовжити анонімно', anonymousSub:'Спочатку повідомлення побачить ANDRIK і вирішить: опублікувати чи видалити',
      googleTitle:'Для швидкого чату потрібна авторизація Google', googleHint:'Після входу коментарі публікуються одразу. Усі повідомлення модеруються.',
      anonymousTitle:'Анонімний коментар з модерацією', anonymousHint:'Напишіть ім’я або псевдонім. Повідомлення з’явиться після модерації.',
      signed:'Ви увійшли через Google:', signOut:'Вийти', change:'Змінити спосіб', anonymousSwitch:'Перейти в анонімний режим', fallback:'Якщо вікно Google не з’явилося, натисніть кнопку входу нижче.',
      verifying:'Перевіряємо Google…', verified:'Google підключено. Можна писати в обговорення.', verifyError:'Не вдалося підтвердити вхід Google. Спробуйте ще раз.',
      published:'Коментар опубліковано одразу.', authExpired:'Сесія Google завершилася. Увійдіть знову.', validation:'Введіть ім’я та повідомлення.', reload:'Оновлюємо обговорення…', chooseFirst:'Спочатку оберіть Google або анонімне надсилання.', anonymousMode:'Анонімний режим: повідомлення надійде ANDRIK на підтвердження.', googleMode:'Google-режим: повідомлення з’явиться одразу.', publishGoogle:'Опублікувати одразу', publishAnonymous:'Надіслати на модерацію', publishChoice:'Оберіть спосіб спілкування'
    },
    sk:{
      heading:'Ako chcete pridať komentár?', intro:'Vyberte si spôsob zverejnenia.',
      google:'Prihlásiť sa cez Google', googleSub:'Správa sa hneď zobrazí v diskusii',
      anonymous:'Pokračovať anonymne', anonymousSub:'Správu najprv uvidí ANDRIK a rozhodne: zverejniť alebo odstrániť',
      googleTitle:'Pre rýchly chat je potrebné prihlásenie Google', googleHint:'Po prihlásení sa komentáre zverejnia okamžite. Všetky správy sú moderované.',
      anonymousTitle:'Anonymný komentár s moderovaním', anonymousHint:'Napíšte meno alebo prezývku. Správa sa zobrazí po moderovaní.',
      signed:'Ste prihlásený cez Google:', signOut:'Odhlásiť sa', change:'Zmeniť spôsob', anonymousSwitch:'Prepnúť na anonymný režim', fallback:'Ak sa okno Google neotvorilo, použite tlačidlo nižšie.',
      verifying:'Overujeme Google…', verified:'Google je pripojený. Môžete písať do diskusie.', verifyError:'Prihlásenie Google sa nepodarilo overiť. Skúste znova.', published:'Komentár bol zverejnený okamžite.', authExpired:'Relácia Google vypršala. Prihláste sa znova.', validation:'Zadajte meno a správu.', reload:'Obnovujeme diskusiu…', chooseFirst:'Najprv vyberte Google alebo anonymné odoslanie.', anonymousMode:'Anonymný režim: správu musí potvrdiť ANDRIK.', googleMode:'Google režim: správa sa zobrazí okamžite.', publishGoogle:'Zverejniť okamžite', publishAnonymous:'Odoslať na moderovanie', publishChoice:'Vyberte spôsob komunikácie'
    },
    en:{
      heading:'How would you like to comment?', intro:'Choose a publishing method.',
      google:'Sign in with Google', googleSub:'The message appears in the discussion immediately',
      anonymous:'Continue anonymously', anonymousSub:'ANDRIK sees it first and decides whether to publish or delete it',
      googleTitle:'Google sign-in is required for instant chat', googleHint:'After signing in, comments are published immediately. All messages are moderated.',
      anonymousTitle:'Anonymous comment with moderation', anonymousHint:'Enter a name or nickname. The message appears after moderation.',
      signed:'Signed in with Google:', signOut:'Sign out', change:'Change method', anonymousSwitch:'Switch to anonymous', fallback:'If Google did not open, use the sign-in button below.',
      verifying:'Verifying Google…', verified:'Google connected. You can post in the discussion.', verifyError:'Google sign-in could not be verified. Please try again.', published:'Comment published immediately.', authExpired:'The Google session expired. Sign in again.', validation:'Enter a name and message.', reload:'Refreshing the discussion…', chooseFirst:'Choose Google or anonymous posting first.', anonymousMode:'Anonymous mode: ANDRIK must approve the message.', googleMode:'Google mode: the message appears immediately.', publishGoogle:'Publish immediately', publishAnonymous:'Send for moderation', publishChoice:'Choose how to join'
    }
  };
  const t = allCopy[lang] || allCopy.en;
  const status = document.querySelector('[data-comments-status]');
  const note = form.querySelector('.comments-note');
  const turnstileWrap = document.querySelector('[data-turnstile-wrap]');
  const submitButton = form.querySelector('button[type="submit"]');
  const nameInput = form.elements.namedItem('name');
  const songSelect = form.elements.namedItem('song');
  const messageInput = form.elements.namedItem('message');
  const AUTH_KEY = 'andrik-google-comment-session-v1';
  const MODE_KEY = 'andrik-comment-post-mode-v1';
  let googleClientId = '';
  let googleReady = false;
  let session = readSession();
  let mode = session ? (readMode() === 'anonymous' ? 'anonymous' : 'google') : 'choice';

  function escapeHtml(value){return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function readSession(){
    try {
      const parsed = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (!parsed?.credential || !parsed?.profile) return null;
      if (Number(parsed.expiresAt || 0) && Number(parsed.expiresAt) < Date.now() - 30000) return null;
      return parsed;
    } catch (_) { return null; }
  }
  function readMode(){try{return sessionStorage.getItem(MODE_KEY)||'';}catch(_){return '';}}
  function saveSession(data){session=data;try{localStorage.setItem(AUTH_KEY,JSON.stringify(data));sessionStorage.setItem(MODE_KEY,'google');}catch(_){} mode='google';render();}
  function clearSession(){session=null;try{localStorage.removeItem(AUTH_KEY);sessionStorage.setItem(MODE_KEY,'choice');}catch(_){} mode='choice';render();}
  function setMode(next){mode=next;try{sessionStorage.setItem(MODE_KEY,next);}catch(_){}render();}

  const googleIcon='<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.26-.98 2.32-2.08 3.03l3.36 2.61c1.96-1.8 3.09-4.45 3.09-7.61 0-.74-.07-1.45-.19-2.14H12Z"></path><path fill="#34A853" d="M6.43 14.29 5.67 14.87l-2.68 2.09A9.97 9.97 0 0 0 12 22c2.7 0 4.96-.89 6.62-2.41l-3.36-2.61c-.92.62-2.09.99-3.26.99-2.6 0-4.8-1.75-5.57-4.1Z"></path><path fill="#4A90E2" d="M2.99 7.04A9.94 9.94 0 0 0 2 11c0 1.43.3 2.79.84 4.04l3.6-2.79A6 6 0 0 1 6.22 11c0-.43.07-.84.21-1.23l-3.44-2.73Z"></path><path fill="#FBBC05" d="M12 5.02c1.47 0 2.79.51 3.83 1.5l2.88-2.88C16.95 1.99 14.69 1 12 1 8.11 1 4.76 3.22 2.99 7.04l3.44 2.73C7.19 6.77 9.4 5.02 12 5.02Z"></path></svg>';

  const box=document.createElement('section');
  box.className='comments-auth-box comments-mode-box';
  form.prepend(box);

  function syncForm(){
    form.dataset.postMode=mode;
    const choice=mode==='choice';
    if(submitButton){submitButton.disabled=choice;submitButton.title=choice?t.chooseFirst:'';submitButton.textContent=choice?(t.publishChoice||t.heading):mode==='google'?(t.publishGoogle||t.google):(t.publishAnonymous||t.anonymous);}
    if(nameInput){nameInput.readOnly=mode==='google'&&Boolean(session);if(mode==='google'&&session)nameInput.value=session.profile.name||String(session.profile.email||'').split('@')[0]||'';}
    form.classList.toggle('comments-chat-live',mode==='google'&&Boolean(session));
    form.classList.toggle('comments-anonymous-mode',mode==='anonymous');
    if(note) note.textContent=mode==='anonymous'?t.anonymousHint:mode==='google'?t.googleHint:t.intro;
  }

  function renderGoogleButton(){
    const wrap=box.querySelector('[data-google-button]');
    if(!wrap||!googleReady||!window.google?.accounts?.id)return;
    wrap.innerHTML='';
    window.google.accounts.id.renderButton(wrap,{theme:'outline',size:'large',shape:'pill',width:300,text:'signin_with',logo_alignment:'left'});
  }

  function render(){
    box.classList.toggle('is-signed-compact', mode==='google' && Boolean(session));
    if(mode==='choice'){
      box.innerHTML=`<div class="comments-mode-heading"><strong>${escapeHtml(t.heading)}</strong><p>${escapeHtml(t.intro)}</p></div><div class="comments-mode-grid"><button class="comments-mode-card is-google" data-mode="google" type="button"><span class="comments-mode-icon">${googleIcon}</span><span><strong>${escapeHtml(t.google)}</strong><small>${escapeHtml(t.googleSub)}</small></span></button><button class="comments-mode-card is-anonymous" data-mode="anonymous" type="button"><span class="comments-mode-icon">👤</span><span><strong>${escapeHtml(t.anonymous)}</strong><small>${escapeHtml(t.anonymousSub)}</small></span></button></div>`;
    }else if(mode==='anonymous'){
      box.innerHTML=`<div class="comments-auth-head"><div class="comments-auth-icon">👤</div><div><strong class="comments-auth-title">${escapeHtml(t.anonymousTitle)}</strong><p class="comments-auth-subtitle">${escapeHtml(t.anonymousHint)}</p></div></div><div class="comments-mode-selected"><span>${escapeHtml(t.anonymousMode)}</span><button class="btn" data-change-mode type="button">${escapeHtml(t.change)}</button></div>`;
    }else if(session){
      box.innerHTML=`<details class="comments-auth-spoiler"><summary class="btn comments-auth-spoiler-summary">${escapeHtml(t.change)}</summary><div class="comments-auth-spoiler-body"><div class="comments-auth-head"><div class="comments-auth-icon">${googleIcon}</div><div><strong class="comments-auth-title">${escapeHtml(t.googleTitle)}</strong><p class="comments-auth-subtitle">${escapeHtml(t.googleHint)}</p></div></div><div class="comments-auth-user">${session.profile.picture?`<img alt="" class="comments-auth-avatar" src="${escapeHtml(session.profile.picture)}">`:'<span class="comments-auth-avatar comments-auth-avatar-fallback">G</span>'}<div class="comments-auth-meta"><span class="comments-auth-signed">${escapeHtml(t.signed)}</span><strong>${escapeHtml(session.profile.name||session.profile.email||'Google')}</strong>${session.profile.email?`<span>${escapeHtml(session.profile.email)}</span>`:''}</div><button class="btn comments-auth-signout" data-google-signout type="button">${escapeHtml(t.signOut)}</button></div><div class="comments-mode-selected"><span>${escapeHtml(t.googleMode)}</span><button class="btn" data-anonymous-mode type="button">${escapeHtml(t.anonymousSwitch)}</button></div></div></details>`;
    }else{
      box.innerHTML=`<div class="comments-auth-head"><div class="comments-auth-icon">${googleIcon}</div><div><strong class="comments-auth-title">${escapeHtml(t.googleTitle)}</strong><p class="comments-auth-subtitle">${escapeHtml(t.googleHint)}</p></div></div><div class="comments-google-button" data-google-button></div><p class="comments-auth-fallback">${escapeHtml(t.fallback)}</p><div class="comments-mode-selected"><button class="btn" data-change-mode type="button">${escapeHtml(t.change)}</button></div>`;
      setTimeout(renderGoogleButton,0);
    }
    syncForm();
  }

  box.addEventListener('click',event=>{
    const modeButton=event.target.closest('[data-mode]');
    if(modeButton){setMode(modeButton.dataset.mode);if(modeButton.dataset.mode==='google'&&!session)setTimeout(()=>{try{window.google?.accounts?.id?.prompt();}catch(_){}},180);return;}
    if(event.target.closest('[data-change-mode]')){setMode('choice');return;}
    if(event.target.closest('[data-anonymous-mode]')){setMode('anonymous');if(status)status.textContent='';return;}
    if(event.target.closest('[data-google-signout]')){clearSession();if(status)status.textContent='';}
  });

  async function verifyCredential(credential){
    if(status)status.textContent=t.verifying;
    const response=await fetch('/api/comments/google-session',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({credential})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.ok||!payload.profile)throw new Error(payload.error||'verify-failed');
    saveSession({credential,profile:payload.profile,expiresAt:Number(payload.profile.exp||0)||(Date.now()+3600000)});
    if(status)status.textContent=t.verified;
  }

  function loadGoogleScript(){return new Promise((resolve,reject)=>{if(window.google?.accounts?.id)return resolve();const existing=document.querySelector('script[data-comments-google]');if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.dataset.commentsGoogle='1';s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}

  async function initGoogle(clientId){googleClientId=String(clientId||'');if(!googleClientId)return;await loadGoogleScript();if(!window.google?.accounts?.id)return;window.google.accounts.id.initialize({client_id:googleClientId,callback:async response=>{try{await verifyCredential(response.credential);}catch(_){if(status)status.textContent=t.verifyError;clearSession();}},auto_select:false,cancel_on_tap_outside:true});googleReady=true;renderGoogleButton();}

  document.addEventListener('submit',async event=>{
    if(event.target!==form)return;
    if(mode==='choice'){event.preventDefault();event.stopImmediatePropagation();if(status)status.textContent=t.chooseFirst;box.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(mode!=='google'||!session?.credential)return;
    event.preventDefault();event.stopImmediatePropagation();
    const message=String(messageInput?.value||'').trim();
    if(!message){if(status)status.textContent=t.validation;return;}
    if(submitButton)submitButton.disabled=true;
    try{
      const response=await fetch('/api/comments',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({name:session.profile.name||'',message,song:String(songSelect?.value||'project'),locale:lang,visitorId:'',googleIdToken:session.credential,startedAt:Date.now(),website:''})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'submit-failed');
      if(status)status.textContent=`${t.published} ${t.reload}`;
      const keepSong=String(songSelect?.value||'project');messageInput.value='';if(songSelect)songSelect.value=keepSong;setTimeout(()=>location.reload(),550);
    }catch(error){if(/google-token|google-auth|expired|audience|issuer/i.test(String(error.message||''))){clearSession();if(status)status.textContent=t.authExpired;}else if(status)status.textContent=t.verifyError;}finally{if(submitButton)submitButton.disabled=false;}
  },true);

  const observer=new MutationObserver(()=>{if(mode==='google'&&session&&turnstileWrap)turnstileWrap.hidden=true;});
  if(turnstileWrap)observer.observe(turnstileWrap,{attributes:true,attributeFilter:['hidden','style','class']});

  render();
  fetch('/api/comments/config',{headers:{accept:'application/json'},cache:'no-store'}).then(r=>r.json().catch(()=>({}))).then(cfg=>initGoogle(cfg.googleClientId||'')).catch(()=>{});
  if(new URL(location.href).searchParams.get('auth')==='1')setTimeout(()=>box.scrollIntoView({behavior:'smooth',block:'start'}),250);
})();