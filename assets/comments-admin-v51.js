(() => {
  const keyInput = document.getElementById('commentsAdminKey');
  const rememberInput = document.getElementById('commentsAdminRemember');
  const statusSelect = document.getElementById('commentsAdminStatus');
  const searchInput = document.getElementById('commentsAdminSearch');
  const songFilter = document.getElementById('commentsAdminSong');
  const reportsOnly = document.getElementById('commentsAdminReportsOnly');
  const loadButton = document.getElementById('commentsAdminLoad');
  const forgetButton = document.getElementById('commentsAdminForget');
  const list = document.getElementById('commentsAdminList');
  const message = document.getElementById('commentsAdminMessage');
  const statsBox = document.getElementById('commentsAdminStats');
  const pushHistoryBox = document.getElementById('adminPushHistory');
  const pushHistoryCount = document.getElementById('adminPushHistoryCount');
  const automationHealth = document.getElementById('adminAutomationHealth');
  const automationLast = document.getElementById('adminAutomationLast');
  const automationNext = document.getElementById('adminAutomationNext');
  const automationMode = document.getElementById('adminAutomationMode');
  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  let installPrompt = null;
  let currentItems = [];
  let currentSubjects = [];
  let persistentKeyLoaded = false;
  const authStrip = document.getElementById('adminAuthStrip');
  const authText = document.getElementById('adminAuthText');
  const installButton = document.getElementById('adminInstallButton');
  const IS_CONTROL_HOST = location.hostname.toLowerCase() === 'control.andrikmetal.com';
  const MAIN_PUSH_ADMIN_URL = 'https://andrikmetal.com/comments-admin.html?owner-push=1';
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const adminUrlParams = new URLSearchParams(location.search);
  const requestedStatus = adminUrlParams.get('status');
  const requestedFocusId = adminUrlParams.get('focus') || '';
  if (statusSelect && ['pending','approved','rejected'].includes(requestedStatus)) statusSelect.value = requestedStatus;

  try {
    const persistent = localStorage.getItem(KEY_LOCAL) || '';
    const session = sessionStorage.getItem(KEY_SESSION) || '';
    if (keyInput) keyInput.value = persistent || session;
    if (rememberInput) rememberInput.checked = Boolean(persistent);
    persistentKeyLoaded = Boolean(persistent);
  } catch (_) {}

  const escapeHtml = value => String(value || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const formatDate = value => {
    try { return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
    catch (_) { return value; }
  };
  const getKey = () => keyInput?.value?.trim() || '';
  function renderAuthState(ok, text){
    if (authStrip) authStrip.classList.toggle('is-ready', Boolean(ok));
    if (authStrip) authStrip.classList.toggle('is-locked', !ok);
    if (authText) authText.textContent = text || (ok ? 'Доступ подтверждён' : 'Ключ не найден');
  }
  const authHeaders = () => ({ accept:'application/json', authorization:`Bearer ${getKey()}` });

  function saveKey(){
    const key=getKey();
    try{
      sessionStorage.setItem(KEY_SESSION,key);
      if(rememberInput?.checked)localStorage.setItem(KEY_LOCAL,key);else localStorage.removeItem(KEY_LOCAL);
    }catch(_){}
  }
  function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text}
  async function api(path, options={}){
    const response=await fetch(path,{...options,headers:{...authHeaders(),...(options.headers||{})},cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    return data;
  }

  function pushTypeLabel(type) {
    const labels = {
      'auto-release': '🎵 Авто-релиз',
      'release-publish': '🚀 Опубликованный релиз',
      'manual-broadcast': '📣 Ручная рассылка',
      'owner-test': '🔔 Тест владельца',
      'automation-error': '⚠️ Ошибка автоматики',
      'comment-owner': '💬 Новый отзыв',
      'comment-pending': '⏳ Ждёт решения',
      'comment-live': '💬 Опубликован сразу',
      'comment-approved': '✅ Опубликованный отзыв',
      'report-owner': '🚩 Жалоба на отзыв'
    };
    return labels[type] || '🔔 Уведомление';
  }

  function pushStatusLabel(status) {
    const labels = {
      sent: 'Отправлено',
      failed: 'Ошибка',
      skipped: 'Пропущено'
    };
    return labels[status] || status || '—';
  }

  function renderAutomation(automation = {}) {
    const health = automation.health || 'never';
    const labels = {
      active: 'Автоматика активна',
      late: 'Проверка задерживается',
      stale: 'Cron не отвечает',
      never: 'Ещё не запускалось'
    };
    if (automationHealth) {
      automationHealth.className = `automation-health is-${health}`;
      automationHealth.textContent = labels[health] || labels.never;
    }
    if (automationLast) {
      automationLast.textContent = automation.lastCheckAt
        ? `${formatDate(automation.lastCheckAt)}${Number.isFinite(automation.ageMinutes) ? ` · ${automation.ageMinutes} мин. назад` : ''}`
        : '—';
    }
    if (automationNext) automationNext.textContent = automation.nextExpectedAt ? formatDate(automation.nextExpectedAt) : '—';
    if (automationMode) {
      const source = automation.uploadsPlaylistId
        ? `${automation.channelHandle || '@andrikmetal'} · загрузки канала`
        : `${(automation.configuredPlaylists || []).length} плейлист(а)`;
      automationMode.textContent = `${automation.mode || 'YouTube'} · ${source}`;
    }
    const summary = automation.summary || {};
    if (automation.lastStatus === 'failed' && summary.error) {
      setText('adminPlaylistStatus', `Последняя автоматическая проверка завершилась ошибкой: ${summary.error}`);
    }
  }

  function renderPushHistory(items = []) {
    if (pushHistoryCount) pushHistoryCount.textContent = `${items.length} ${items.length === 1 ? 'запись' : items.length >= 2 && items.length <= 4 ? 'записи' : 'записей'}`;
    if (!pushHistoryBox) return;
    if (!items.length) {
      pushHistoryBox.innerHTML = '<div class="admin-empty">Уведомлений в истории пока нет.</div>';
      return;
    }
    pushHistoryBox.innerHTML = items.map(item => {
      const status = escapeHtml(item.status || '');
      const title = escapeHtml(item.title || item.videoTitle || 'ANDRIK');
      const messageText = escapeHtml(item.message || '');
      const source = escapeHtml(item.source || 'ANDRIK');
      const recipients = Number(item.recipients || 0);
      const error = item.error ? `<div class="push-history-error">${escapeHtml(item.error)}</div>` : '';
      const link = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Открыть ↗</a>` : '';
      return `
        <article class="push-history-item is-${status}">
          <div class="push-history-head">
            <span class="push-history-type">${escapeHtml(pushTypeLabel(item.type))}</span>
            <span class="push-history-status">${escapeHtml(pushStatusLabel(item.status))}</span>
          </div>
          <strong>${title}</strong>
          ${messageText ? `<p>${messageText}</p>` : ''}
          <div class="push-history-meta">
            <span>${escapeHtml(formatDate(item.createdAt))}</span>
            <span>${source}</span>
            ${item.audience === 'all' ? `<span>${recipients > 0 ? `Получателей: ${recipients}` : 'Рассылка: всем подписчикам'}</span>` : '<span>Владелец</span>'}
            ${link}
          </div>
          ${error}
        </article>`;
    }).join('');
  }

  async function loadPushHistory({ silent = false } = {}) {
    if (!getKey()) {
      if (!silent) setText('adminPlaylistStatus', 'Сначала введите мастер-ключ.');
      return;
    }
    try {
      const data = await api('/api/push/history?limit=50');
      renderAutomation(data.automation || {});
      renderPushHistory(data.history || []);
    } catch (error) {
      if (!silent) setText('adminPlaylistStatus', `История: ${error.message}`);
    }
  }

  function pluralReviews(count) {
    const value = Math.max(1, Number(count || 1));
    const mod10 = value % 10;
    const mod100 = value % 100;
    const word = mod10 === 1 && mod100 !== 11 ? 'отзыв' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'отзыва' : 'отзывов';
    return `${value} ${word}`;
  }

  function listenerBadge(item) {
    const count = Math.max(1, Number(item.authorCount || 1));
    if (count >= 10) return '🏔 Старейшина сообщества';
    if (count >= 5) return '🌊 Постоянный слушатель';
    if (count >= 3) return '🔥 Металлист';
    if (count >= 2) return '👁 Искатель';
    return '🌱 Первый отзыв';
  }

  function populateSubjects(subjects) {
    if (!songFilter || !Array.isArray(subjects) || !subjects.length) return;
    currentSubjects = subjects;
    const selected = songFilter.value;
    const groupLabels = {
      general:'Общие разделы',
      ocean:'Альбом OCEAN',
      illusion:'Альбом Illusion of Life',
      'official-audio':'Official Audio Collection',
      other:'Другие релизы'
    };
    const groups = [];
    const grouped = new Map();
    subjects.forEach(subject => {
      const key = String(subject.group || 'other');
      if (!grouped.has(key)) {
        const group = { key, label:groupLabels[key] || subject.groupTitle || key, subjects:[] };
        grouped.set(key, group);
        groups.push(group);
      }
      grouped.get(key).subjects.push(subject);
    });
    const options = groups.map(group => `<optgroup label="${escapeHtml(group.label)}">${group.subjects
      .map(subject => `<option value="${escapeHtml(subject.slug)}">${escapeHtml(subject.title)}</option>`).join('')}</optgroup>`).join('');
    songFilter.innerHTML = '<option value="">Все песни и разделы</option>' + options;
    songFilter.value = subjects.some(subject => subject.slug === selected) ? selected : '';
  }

  function renderStats(stats = {}) {
    if (!statsBox) return;
    const cards = [
      ['total','📝','Всего',stats.total],
      ['pending','⏳','Ожидают',stats.pending],
      ['approved','✅','Опубликовано',stats.approved],
      ['rejected','🚫','Отклонено',stats.rejected],
      ['likes','❤️','Лайков',stats.totalLikes],
      ['reports','🚩','Жалоб',stats.totalReports],
      ['pinned','📌','Закреплено',stats.pinned],
      ['replies','👁','Ответов ANDRIK',stats.replied]
    ];
    statsBox.innerHTML = cards.map(([key,icon,label,value]) => `
      <article class="admin-stat-card is-${key}"><span>${icon}</span><strong>${Number(value || 0)}</strong><small>${escapeHtml(label)}</small></article>
    `).join('');
  }

  function filteredItems() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const song = songFilter?.value || '';
    const onlyReported = Boolean(reportsOnly?.checked);
    return currentItems.filter(item => {
      if (song && item.songSlug !== song) return false;
      if (onlyReported && Number(item.reportCount || 0) < 1) return false;
      if (!q) return true;
      return [item.name,item.message,item.songTitle,item.ownerReply,item.moderationNote]
        .some(value => String(value || '').toLowerCase().includes(q));
    });
  }

  let focusApplied = false;
  function focusRequestedCard() {
    if (focusApplied || !requestedFocusId) return;
    const card = list?.querySelector(`[data-id="${CSS.escape(requestedFocusId)}"]`);
    if (!card) return;
    focusApplied = true;
    card.classList.add('is-push-focus');
    setTimeout(() => card.scrollIntoView({ behavior:'smooth', block:'center' }), 120);
  }
  function renderFiltered() {
    const items = filteredItems();
    render(items);
    focusRequestedCard();
    if (getKey()) message.textContent = `Показано: ${items.length} из ${currentItems.length}`;
  }

  async function loadComments({ silent = false } = {}) {
    if (!getKey()) { message.textContent = 'Введите ключ.'; return; }
    saveKey();
    loadButton.disabled = true;
    if (!silent) message.textContent = 'Проверка ключа и загрузка…';
    list.innerHTML = '';
    try {
      const data = await api(`/api/comments/moderate?status=${encodeURIComponent(statusSelect.value)}`);
      renderAuthState(true, 'Доступ подтверждён');
      currentItems = data.comments || [];
      populateSubjects(data.subjects || []);
      renderStats(data.stats || {});
      renderFiltered();
      loadPushHistory({ silent:true });
      if (!silent) message.textContent = `Вход выполнен. Найдено: ${currentItems.length}`;
    } catch (error) {
      currentItems = [];
      renderAuthState(false, error.message === 'unauthorized' ? 'Ключ неверный — откройте «Служебное»' : 'Ошибка подключения');
      message.textContent = error.message === 'unauthorized' ? 'Неверный секретный ключ.' : `Ошибка: ${error.message}`;
      if (list) list.innerHTML = '<div class="admin-empty">Не удалось загрузить отзывы. Проверьте ключ в разделе «Служебное».</div>';
    } finally {
      loadButton.disabled = false;
    }
  }

  function render(items) {
    if (!items.length) { list.innerHTML = '<div class="admin-empty">По выбранным фильтрам здесь пока пусто.</div>'; return; }
    list.innerHTML = items.map(item => {
      const approved = item.status === 'approved';
      const approveButton = approved ? '' : '<button class="btn btn-primary" data-action="approve" type="button">Разместить</button>';
      const rejectButton = approved ? '<button class="btn" data-action="reject" type="button">Снять с публикации</button>' : '';
      const pinButton = approved ? `<button class="btn admin-pin${item.isPinned ? ' is-active' : ''}" data-action="${item.isPinned ? 'unpin' : 'pin'}" type="button">${item.isPinned ? 'Открепить' : '📌 Выбор ANDRIK'}</button>` : '';
      const notifyOption = !approved ? '<label class="admin-notify-toggle"><input data-notify type="checkbox"/> Уведомить всех подписчиков после публикации</label>' : '';
      const reportCount = Number(item.reportCount || 0);
      const reportButton = reportCount > 0 ? `<button class="btn admin-report-clear" data-action="clear_reports" type="button">Очистить жалобы (${reportCount})</button>` : '';
      const reportReasons = item.reportReasons ? `<div class="admin-report-reasons"><strong>Причины жалоб:</strong> ${escapeHtml(item.reportReasons)}</div>` : '';
      const songBadge = item.songTitle ? `<span class="admin-badge admin-song-badge">🎵 ${escapeHtml(item.songTitle)}</span>` : '<span class="admin-badge">🎵 Проект ANDRIK</span>';
      const communityBadges = [
        `<span class="admin-badge">${escapeHtml(listenerBadge(item))}</span>`,
        item.isTopCommenter ? '<span class="admin-badge is-top">🏆 Топ-комментатор</span>' : ''
      ].join('');
      return `
        <article class="admin-card${item.isPinned ? ' is-pinned' : ''}${reportCount ? ' has-reports' : ''}" data-id="${escapeHtml(item.id)}">
          <div class="admin-card-head">
            <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(formatDate(item.createdAt))}</span></div>
            <div class="admin-card-badges">
              ${item.isPinned ? '<span class="admin-badge is-pinned">📌 Выбор ANDRIK</span>' : ''}
              <span class="admin-badge">❤️ ${Number(item.likeCount || 0)}</span>
              <span class="admin-badge">👤 ${escapeHtml(pluralReviews(item.authorCount))}</span>
              ${reportCount ? `<span class="admin-badge is-report">🚩 ${reportCount}</span>` : ''}
            </div>
          </div>
          <div class="admin-card-community">${songBadge}${communityBadges}</div>
          <p class="admin-comment-text">${escapeHtml(item.message)}</p>
          <div class="admin-card-meta">Язык: ${escapeHtml(item.locale)} · Спам-рейтинг: ${Number(item.spamScore || 0)}</div>
          ${reportReasons}
          <label class="admin-field-label">Примечание модератора
            <input class="admin-note" placeholder="Видно только владельцу" value="${escapeHtml(item.moderationNote || '')}"/>
          </label>
          ${notifyOption}
          <div class="admin-actions admin-moderation-actions">${approveButton}${rejectButton}${pinButton}${reportButton}<button class="btn admin-danger" data-action="delete" type="button">Удалить</button></div>
          <div class="admin-reply-box">
            <div class="admin-reply-title"><strong>Ответ от ANDRIK</strong><span class="admin-author-preview"><span aria-hidden="true">👁</span><strong>ANDRIK</strong><em>Автор</em></span></div>
            <textarea class="admin-reply" maxlength="1200" placeholder="Напишите ответ, который появится под отзывом…">${escapeHtml(item.ownerReply || '')}</textarea>
            <div class="admin-actions admin-reply-actions">
              <button class="btn btn-primary" data-action="save_reply" type="button">Сохранить ответ</button>
              ${item.ownerReply ? '<button class="btn" data-action="clear_reply" type="button">Удалить ответ</button>' : ''}
            </div>
          </div>
        </article>`;
    }).join('');
  }

  const actionMessages = {
    approve:'Комментарий размещён.',
    reject:'Отзыв снят с публикации или отклонён.',
    delete:'Отзыв удалён.',
    pin:'Отзыв отмечен как «Выбор ANDRIK» 📌',
    unpin:'Отметка «Выбор ANDRIK» снята.',
    save_reply:'Ответ 👁 ANDRIK Автор сохранён.',
    clear_reply:'Ответ ANDRIK удалён.',
    clear_reports:'Жалобы на этот отзыв очищены.'
  };

  async function moderate(card, action) {
    const id = card.dataset.id;
    const note = card.querySelector('.admin-note')?.value || '';
    const reply = card.querySelector('.admin-reply')?.value || '';
    const notify = Boolean(card.querySelector('[data-notify]')?.checked);
    if (action === 'delete' && !confirm('Удалить этот отзыв без возможности восстановления?')) return;
    if (action === 'clear_reports' && !confirm('Очистить все жалобы на этот отзыв?')) return;
    if (action === 'save_reply' && !reply.trim()) {
      message.textContent = 'Сначала напишите ответ ANDRIK.';
      card.querySelector('.admin-reply')?.focus();
      return;
    }
    card.classList.add('is-busy');
    try {
      await api('/api/comments/moderate', {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify({ id, action, note, reply, notify })
      });
      await loadComments({ silent:true });
      message.textContent = notify && action === 'approve'
        ? 'Отзыв опубликован; подписчикам отправлен push.'
        : (actionMessages[action] || 'Готово.');
    } catch (error) {
      message.textContent = error.message === 'comment-not-approved'
        ? 'Сначала одобрите отзыв, затем закрепите его.'
        : error.message === 'reply-required'
          ? 'Ответ не может быть пустым.'
          : `Ошибка: ${error.message}`;
      card.classList.remove('is-busy');
    }
  }

  async function registerOwnerPush(){
    if(IS_CONTROL_HOST){
      setText('adminPushStatus','Открываем основной домен ANDRIK. Web Push привязан к точному адресу сайта; подключение выполняется там один раз.');
      const opened=window.open(MAIN_PUSH_ADMIN_URL,'_blank','noopener,noreferrer');
      if(!opened) location.href=MAIN_PUSH_ADMIN_URL;
      return;
    }
    if(!getKey()){setText('adminPushStatus','Сначала введите мастер-ключ и нажмите «Войти и загрузить».');return}
    saveKey(); setText('adminPushStatus','Запрашиваем разрешение на уведомления…');
    const pushState=await window.AndrikPush?.status();
    if(pushState?.originMismatch){
      setText('adminPushStatus',`OneSignal настроен для ${pushState.siteOrigin || 'другого адреса'}. Откройте эту страницу именно на основном домене ANDRIK.`);
      return;
    }
    const subscriptionId=await window.AndrikPush?.subscribe();
    if(!subscriptionId){setText('adminPushStatus','Подписка не создана. Проверьте Web-настройку OneSignal и разрешение уведомлений в Chrome.');return}
    try{await api('/api/push/admin-device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscriptionId,label:navigator.userAgent.slice(0,70)})});setText('adminPushStatus','Этот телефон зарегистрирован как устройство владельца ✅ Вернитесь в ANDRIK Control и нажмите «Тестовый push мне».')}
    catch(error){setText('adminPushStatus',`Ошибка: ${error.message}`)}
  }
  async function sendPush(audience,title,messageText,url,statusId){
    if(!getKey()){setText(statusId,'Сначала введите ключ.');return}
    if(!messageText){setText(statusId,'Сначала напишите сообщение.');document.getElementById('adminPushMessage')?.focus();return}
    if(audience==='all'&&!confirm(`Отправить это уведомление ВСЕМ подписчикам?\n\n${title}\n${messageText}`))return;
    saveKey();setText(statusId,audience==='all'?'Отправляем всем подписчикам…':'Отправляем тест владельцу…');
    try{
      const data=await api('/api/push/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({audience,title,message:messageText,url})});
      setText(statusId,data.skipped?'Push-сервис пока не настроен.':audience==='all'?`OneSignal принял рассылку ✅${data.oneSignalId?` ID: ${data.oneSignalId}`:''}`:`Тест принят OneSignal ✅${data.oneSignalId?` ID: ${data.oneSignalId}`:''}`);
      loadPushHistory({ silent:true });
      window.dispatchEvent(new CustomEvent('andrik-control-refresh'));
    }
    catch(error){
      const reason=String(error.message||'');
      setText(statusId,reason.includes('no-subscribers-matched')?'Ошибка: OneSignal не нашёл активных подписчиков. Переподключите уведомления на телефонах.':`Ошибка: ${reason}`)
    }
  }
  function updatePushPreview(){
    const title=document.getElementById('adminPushTitle')?.value.trim()||'ANDRIK';
    const messageText=document.getElementById('adminPushMessage')?.value.trim()||'Здесь появится текст уведомления.';
    const url=document.getElementById('adminPushUrl')?.value.trim()||'https://andrikmetal.com/';
    setText('adminPushPreviewTitle',title);setText('adminPushPreviewMessage',messageText);setText('adminPushPreviewUrl',url);
    setText('adminPushMessageCount',`${document.getElementById('adminPushMessage')?.value.length||0} / 240`);
  }
  async function fillLatestVideo(){
    if(!getKey()){setText('adminPushBroadcastStatus','Сначала сохраните ключ в «Служебном».');return}
    const button=document.getElementById('adminPushFillLatest');if(button)button.disabled=true;
    setText('adminPushBroadcastStatus','Получаем последнее видео без рассылки…');
    try{
      const data=await api('/api/push/inspect-playlist',{method:'POST'});
      const item=data.latestItem;
      if(!item)throw new Error('video-not-found');
      document.getElementById('adminPushTitle').value='🎵 Новый трек ANDRIK';
      document.getElementById('adminPushMessage').value=`${String(item.title||'Новый трек').replace(/^ANDRIK\s*[-–—|]\s*/i,'').replace(/\s*[-–—|]\s*(Official Audio|Official Video|English Version).*$/i,'').trim()} · YouTube`;
      document.getElementById('adminPushUrl').value=item.url||`https://www.youtube.com/watch?v=${item.videoId}`;
      updatePushPreview();
      setText('adminPushBroadcastStatus',item.seen?'Заполнено последним видео канала ✅ Оно уже отмечено системой как просмотренное.':'Заполнено новым видео ✅ Сначала отправьте тест на свой телефон.');
    }catch(error){setText('adminPushBroadcastStatus',`Не удалось получить видео: ${error.message}`)}
    finally{if(button)button.disabled=false}
  }
  async function checkPlaylist(){
    if(!getKey()){setText('adminPlaylistStatus','Сначала введите ключ.');return}
    saveKey();setText('adminPlaylistStatus','Проверяем YouTube-канал и официальные плейлисты…');
    try{
      const data=await api('/api/push/check-playlist',{method:'POST'});
      const warning=(data.warnings||[]).length?` Предупреждения: ${(data.warnings||[]).join(' · ')}`:'';
      setText('adminPlaylistStatus',data.seeded
        ?`Первый запуск: запомнено ${data.checked} видео. Старые релизы не рассылались.${warning}`
        :`Проверено: ${data.checked}. Новых: ${(data.newItems||[]).length}. Push отправлено: ${data.notified}.${warning}`);
      await loadPushHistory({ silent:true });
    }
    catch(error){setText('adminPlaylistStatus',`Ошибка: ${error.message}`)}
  }

  loadButton?.addEventListener('click',loadComments);
  document.getElementById('commentsAdminReload')?.addEventListener('click',()=>{loadComments();loadPushHistory({silent:true});});
  statusSelect?.addEventListener('change',()=>{if(getKey())loadComments()});
  searchInput?.addEventListener('input',renderFiltered);
  songFilter?.addEventListener('change',renderFiltered);
  reportsOnly?.addEventListener('change',renderFiltered);
  keyInput?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();loadComments();}});
  forgetButton?.addEventListener('click',()=>{if(keyInput)keyInput.value='';if(rememberInput)rememberInput.checked=false;try{sessionStorage.removeItem(KEY_SESSION);localStorage.removeItem(KEY_LOCAL)}catch(_){}message.textContent='Ключ удалён с устройства.';renderAuthState(false,'Ключ удалён — откройте «Служебное»');});
  rememberInput?.addEventListener('change',saveKey);
  list?.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');const card=button?.closest('.admin-card');if(button&&card)moderate(card,button.dataset.action)});

  const ownerPushButton = document.getElementById('adminPushRegister');
  if (ownerPushButton && IS_CONTROL_HOST) ownerPushButton.textContent = 'Подключить через основной сайт';
  if (!IS_CONTROL_HOST && new URLSearchParams(location.search).get('owner-push') === '1') {
    setTimeout(() => {
      document.getElementById('adminPushRegister')?.scrollIntoView({ behavior:'smooth', block:'center' });
      setText('adminPushStatus','Введите мастер-ключ, нажмите «Войти и загрузить», затем «Подключить мой телефон».');
    }, 250);
  }
  document.getElementById('adminPushRegister')?.addEventListener('click',registerOwnerPush);
  document.getElementById('adminPushTestOwner')?.addEventListener('click',()=>sendPush('owner','ANDRIK Control','Тестовое уведомление владельца работает.','https://control.andrikmetal.com/','adminPushStatus'));
  document.getElementById('adminPlaylistCheck')?.addEventListener('click',checkPlaylist);
  document.getElementById('adminPushHistoryRefresh')?.addEventListener('click',()=>loadPushHistory());
  ['adminPushTitle','adminPushMessage','adminPushUrl'].forEach(id=>document.getElementById(id)?.addEventListener('input',updatePushPreview));
  document.getElementById('adminPushFillLatest')?.addEventListener('click',fillLatestVideo);
  document.getElementById('adminPushTestFromBroadcast')?.addEventListener('click',()=>sendPush('owner',document.getElementById('adminPushTitle').value.trim()||'ANDRIK',document.getElementById('adminPushMessage').value.trim(),document.getElementById('adminPushUrl').value.trim()||'https://andrikmetal.com/','adminPushBroadcastStatus'));
  document.getElementById('adminPushSendAll')?.addEventListener('click',()=>sendPush('all',document.getElementById('adminPushTitle').value.trim()||'ANDRIK',document.getElementById('adminPushMessage').value.trim(),document.getElementById('adminPushUrl').value.trim()||'https://andrikmetal.com/','adminPushBroadcastStatus'));
  updatePushPreview();
  if (IS_CONTROL_HOST && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js?v=55.00-r487', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.warn('ANDRIK Control service worker:', error));
  }

  if (installButton) {
    installButton.hidden = true;
    installButton.disabled = true;
  }

  window.addEventListener('beforeinstallprompt', event => { if (!IS_CONTROL_HOST) return; event.preventDefault(); installPrompt = event; });

  window.addEventListener('appinstalled', () => { installPrompt = null; if (installButton) { installButton.hidden = true; installButton.disabled = true; } });

  installButton?.addEventListener('click', async () => {
    if (!IS_CONTROL_HOST) return;
    if (isStandalone()) { return; }
    if (!installPrompt) {
      try { await navigator.serviceWorker?.ready; } catch (_) {}
      message.textContent = 'Если окно установки ещё не появилось: обновите страницу и нажмите кнопку снова. Также можно выбрать в меню Chrome «Установить приложение».';
      return;
    }
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    installPrompt = null;
    message.textContent = result.outcome === 'accepted' ? 'Установка подтверждена ✅' : 'Установка отменена.';
  });

  if (getKey()) { renderAuthState(true,'Проверяем сохранённый ключ…'); setTimeout(()=>{loadComments();loadPushHistory({silent:true});},120); }
  else { renderAuthState(false,'Ключ не сохранён — откройте «Служебное»'); if(list)list.innerHTML='<div class="admin-empty">Для входа откройте «Служебное», сохраните ключ и вернитесь сюда.</div>'; }
})();
