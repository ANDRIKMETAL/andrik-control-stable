(() => {
  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const cardsBox = document.getElementById('controlDashboardCards');
  const releaseBox = document.getElementById('controlReleaseHistory');
  const releaseCount = document.getElementById('controlReleaseCount');
  const message = document.getElementById('controlDashboardMessage');
  const backupLast = document.getElementById('controlBackupLast');
  const backupMode = document.getElementById('controlBackupMode');
  const backupDownload = document.getElementById('controlBackupDownload');
  const backupHistory = document.getElementById('controlBackupHistory');
  const backupHistoryCount = document.getElementById('controlBackupHistoryCount');
  const audienceBox = document.getElementById('controlAudienceCards');
  const analyticsStatus = document.getElementById('controlAnalyticsStatus');
  const analyticsRefresh = document.getElementById('controlAnalyticsRefresh');
  const systemGrid = document.getElementById('controlSystemGrid');
  const systemLog = document.getElementById('controlSystemLog');
  const systemRefresh = document.getElementById('controlSystemRefresh');
  const systemSummary = document.getElementById('controlSystemSummary');
  const systemCopy = document.getElementById('controlSystemCopy');
  let lastSystemText = '';
  const restorePanel = document.getElementById('controlRestorePanel');
  const restoreTitle = document.getElementById('controlRestoreTitle');
  const restoreDetails = document.getElementById('controlRestoreDetails');
  const restoreConfirm = document.getElementById('controlRestoreConfirm');
  const restoreExecute = document.getElementById('controlRestoreExecute');
  let latestBackupId = '';
  let selectedRestoreId = '';

  const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const getKey = () => {
    try { return localStorage.getItem(KEY_LOCAL) || sessionStorage.getItem(KEY_SESSION) || ''; }
    catch (_) { return ''; }
  };
  const formatDate = value => {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
    catch (_) { return value; }
  };
  const formatBytes = value => {
    const bytes = Number(value || 0);
    if (!bytes) return '0 КБ';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  };
  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { accept:'application/json', authorization:`Bearer ${getKey()}`, ...(options.headers || {}) },
      cache:'no-store'
    });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json().catch(() => ({})) : null;
    if (!response.ok) {
      const detail = data?.details ? `: ${data.details}` : '';
      throw new Error(`${data?.error || `HTTP ${response.status}`}${detail}`);
    }
    return data ?? response;
  }
  function card(icon, value, label, tone='') {
    return `<article class="control-overview-card ${tone ? `is-${tone}` : ''}"><span>${icon}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></article>`;
  }
  const formatNumber = value => new Intl.NumberFormat('ru-RU').format(Number(value || 0));
  function audienceCard(icon, value, label, source, tone='') {
    return `<article class="control-audience-metric ${tone ? `is-${tone}` : ''}"><span class="control-audience-icon">${icon}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small><em>${escapeHtml(source)}</em></article>`;
  }
  function renderAudience(data = {}) {
    if (!audienceBox || !analyticsStatus) return;
    const website = data.website || {};
    const youtube = data.youtube || {};
    const websiteReady = website.configured && !website.error;
    const youtubeReady = youtube.configured && !youtube.error;
    audienceBox.innerHTML = [
      audienceCard('🌐', websiteReady ? formatNumber(website.today?.visits) : '—', 'Визитов сегодня', 'Cloudflare', websiteReady ? 'site' : 'muted'),
      audienceCard('📅', websiteReady ? formatNumber(website.week?.visits) : '—', 'Визитов за 7 дней', 'Cloudflare', websiteReady ? 'site' : 'muted'),
      audienceCard('📈', websiteReady ? formatNumber(website.month?.visits) : '—', 'Визитов за 30 дней', 'Cloudflare', websiteReady ? 'site' : 'muted'),
      audienceCard('▶️', youtubeReady ? formatNumber(youtube.views) : '—', 'Просмотров YouTube', youtube.title || 'YouTube', youtubeReady ? 'youtube' : 'muted'),
      audienceCard('👥', youtubeReady && !youtube.hiddenSubscribers ? formatNumber(youtube.subscribers) : '—', youtube.hiddenSubscribers ? 'Подписчики скрыты' : 'Подписчиков YouTube', youtube.title || 'YouTube', youtubeReady ? 'youtube' : 'muted'),
      audienceCard('🎬', youtubeReady ? formatNumber(youtube.videos) : '—', 'Видео на канале', youtube.title || 'YouTube', youtubeReady ? 'youtube' : 'muted')
    ].join('');

    const status = [];
    if (websiteReady) status.push(`Сайт: данные обновлены ${formatDate(website.updatedAt || data.updatedAt)}`);
    else if (website.error) status.push('Сайт: источник статистики временно недоступен');
    else status.push('Сайт: аналитика пока не подключена');
    if (youtubeReady) status.push(`YouTube: @${String(youtube.handle || '').replace(/^@/, '') || 'andrikmetal'} подключён`);
    else if (youtube.error) status.push('YouTube: статистика временно недоступна');
    else status.push('YouTube: API пока не подключён');
    analyticsStatus.textContent = status.join(' · ');
    analyticsStatus.className = `control-analytics-status ${websiteReady || youtubeReady ? 'is-partial' : 'is-warning'} ${websiteReady && youtubeReady ? 'is-good' : ''}`;
  }

  function statusMeta(status='warning') {
    const map = {
      good: { label: 'Работает', symbol: '🟢' },
      warning: { label: 'Внимание', symbol: '🟡' },
      error: { label: 'Ошибка', symbol: '🔴' },
      optional: { label: 'Отложено', symbol: '🟡' }
    };
    return map[status] || map.warning;
  }
  function serviceCard(icon, title, detail, status='warning') {
    const meta = statusMeta(status);
    return `<article class="control-system-item is-${escapeHtml(status)}"><span class="system-service-icon">${icon}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small><em class="system-state"><i aria-hidden="true"></i>${escapeHtml(meta.label)}</em></div></article>`;
  }
  function renderSystem(data = {}) {
    if (!systemGrid || !systemLog) return;
    const services = data.services || {};
    const ordered = [
      ['🌐', 'Сайт ANDRIK', services.site],
      ['⚙️', 'Cloudflare Worker', services.worker],
      ['🗄️', 'База D1', services.database],
      ['🔔', 'OneSignal', services.oneSignal],
      ['👥', 'Push-аудитория', services.pushAudience],
      ['📨', 'Последний push', services.lastPush],
      ['▶️', 'YouTube', services.youtube],
      ['⏱️', 'Cron 15 минут', services.cron],
      ['🛡️', 'Резервные копии', services.backups],
      ['📊', 'Аналитика сайта', services.analytics]
    ];
    systemGrid.innerHTML = ordered.map(([icon,title,item]) => serviceCard(icon,title,item?.label || 'Нет данных',item?.status || 'warning')).join('');

    const critical = ordered;
    const good = critical.filter(([, , item]) => item?.status === 'good').length;
    const errors = critical.filter(([, , item]) => item?.status === 'error').length;
    const warnings = critical.length - good - errors;
    if (systemSummary) {
      systemSummary.className = `system-overall ${errors ? 'is-error' : warnings ? 'is-warning' : 'is-good'}`;
      systemSummary.textContent = errors ? `🔴 Ошибок: ${errors}` : warnings ? `🟡 Работает ${good}/${critical.length}` : `🟢 Всё работает ${good}/${critical.length}`;
    }

    const lines = [
      `ANDRIK Control v${data.version || '52.03'} — состояние системы`,
      `Обновлено: ${formatDate(data.updatedAt)}`,
      '',
      ...ordered.map(([,title,item]) => `${statusMeta(item?.status).symbol} ${title}: ${item?.label || 'Нет данных'}`)
    ];
    const events = Array.isArray(data.recentEvents) ? data.recentEvents : [];
    if (events.length) {
      lines.push('', 'Последние события:');
      events.forEach(item => lines.push(`${formatDate(item.createdAt)} | ${item.status || '—'} | ${item.title || item.type || 'Событие'} | ${item.error || item.message || item.source || ''}`));
    }
    lastSystemText = lines.join('\n');

    if (!events.length) {
      systemLog.innerHTML = '<div class="admin-empty">Системных событий пока нет. Это нормально для новой установки.</div>';
      return;
    }
    systemLog.innerHTML = `<span class="eyeline">Последние события</span>${events.map(item => `<article class="control-log-item is-${escapeHtml(item.status || 'sent')}"><time>${escapeHtml(formatDate(item.createdAt))}</time><strong>${escapeHtml(item.title || item.type || 'Событие ANDRIK')}</strong><small>${escapeHtml(item.error || item.message || item.source || '')}</small></article>`).join('')}`;
  }

  function renderDashboard(data) {
    const s = data.stats || {};
    const c = s.comments || {};
    const l = s.lyrics || {};
    const p = s.pushes || {};
    cardsBox.innerHTML = [
      card('🎵', s.catalogTracks || 0, 'Песен в каталоге', 'music'),
      card('📜', l.total || 0, 'Текстов сохранено', 'lyrics'),
      card('⏱', l.synced || 0, 'Текстов с синхронизацией', 'sync'),
      card('🚀', s.releases || 0, 'Релизов в истории', 'release'),
      card('💬', c.total || 0, 'Всего отзывов', 'comments'),
      card('⏳', c.pending || 0, 'Ожидают проверки', 'pending'),
      card('❤️', c.likes || 0, 'Лайков слушателей', 'likes'),
      card('🔔', p.sent || 0, 'Push отправлено', 'push'),
      card('⚠️', p.failed || 0, 'Ошибок push', p.failed ? 'error' : 'safe'),
      card('👥', s.pushAudience || 0, 'Устройств в push-аудитории', 'push'),
      card('📱', s.ownerDevices || 0, 'Телефонов владельца', 'device')
    ].join('');

    const latest = data.backup?.latest || null;
    latestBackupId = latest?.id || '';
    backupDownload.disabled = !latestBackupId || latest?.status !== 'completed';
    backupLast.textContent = latest
      ? `${latest.status === 'completed' ? '✅' : '⚠️'} ${formatDate(latest.createdAt)} · ${Number(latest.rowCount || 0)} строк · ${formatBytes(latest.sizeBytes)}`
      : 'Копий пока нет';
    if (data.backup?.r2Configured) {
      backupMode.textContent = `Внешнее хранилище R2 · хранится до ${data.backup.retention || 12} копий`;
      backupMode.className = 'is-good';
    } else {
      backupMode.textContent = `Локальный резерв D1 · до ${data.backup?.retention || 4} копий. Для независимой защиты подключите R2.`;
      backupMode.className = 'is-warning';
    }
  }
  function renderReleases(items = []) {
    releaseCount.textContent = `${items.length} ${items.length === 1 ? 'релиз' : items.length >= 2 && items.length <= 4 ? 'релиза' : 'релизов'}`;
    if (!items.length) {
      releaseBox.innerHTML = '<div class="admin-empty">История заполнится после первого опубликованного релиза или релизного push.</div>';
      return;
    }
    releaseBox.innerHTML = items.map(item => {
      const pushLabels = { sent:'Push отправлен', failed:'Ошибка push', skipped:'Push пропущен', unknown:'Без push' };
      const lyricsLabels = { synced:'Текст синхронизирован', saved:'Текст сохранён', missing:'Текста пока нет' };
      return `<article class="control-release-item is-${escapeHtml(item.pushStatus || 'unknown')}">
        <div class="control-release-main"><span class="control-release-eye">👁</span><div><strong>${escapeHtml(item.title || 'Релиз ANDRIK')}</strong><p>${escapeHtml(formatDate(item.publishedAt))} · ${escapeHtml(item.source || 'ANDRIK')}</p></div></div>
        <div class="control-release-tags"><span>${escapeHtml(pushLabels[item.pushStatus] || item.pushStatus || '—')}</span><span>${escapeHtml(lyricsLabels[item.lyricsStatus] || item.lyricsStatus || '—')}</span>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">YouTube ↗</a>` : ''}</div>
      </article>`;
    }).join('');
  }
  function renderBackups(items = []) {
    if (backupHistoryCount) backupHistoryCount.textContent = `${items.length} ${items.length === 1 ? 'копия' : items.length >= 2 && items.length <= 4 ? 'копии' : 'копий'}`;
    if (!backupHistory) return;
    if (!items.length) {
      backupHistory.innerHTML = '<div class="admin-empty">Копий пока нет. Нажмите «Создать копию сейчас».</div>';
      return;
    }
    backupHistory.innerHTML = items.map(item => {
      const completed = item.status === 'completed';
      const storage = item.storage === 'r2' ? 'R2' : item.storage === 'd1-fallback' ? 'D1' : (item.storage || '—');
      return `<article class="control-backup-item ${completed ? 'is-completed' : 'is-failed'}">
        <div class="control-backup-item-main">
          <span class="control-backup-icon">${completed ? '🗄' : '⚠️'}</span>
          <div><strong>${escapeHtml(formatDate(item.createdAt))}</strong><p>${escapeHtml(storage)} · ${Number(item.rowCount || 0)} строк · ${escapeHtml(formatBytes(item.sizeBytes))} · ${escapeHtml(item.reason || 'backup')}</p>${item.error ? `<small>${escapeHtml(item.error)}</small>` : ''}</div>
        </div>
        <div class="control-backup-actions">
          <button class="btn control-backup-download-one" data-backup-id="${escapeHtml(item.id)}" type="button" ${completed ? '' : 'disabled'}>Скачать</button>
          <button class="btn control-backup-restore-one" data-backup-id="${escapeHtml(item.id)}" type="button" ${completed ? '' : 'disabled'}>Восстановить</button>
        </div>
      </article>`;
    }).join('');
  }
  async function loadAll({ silent = false } = {}) {
    if (!getKey()) {
      if (!silent) message.textContent = 'Сначала сохраните ключ в разделе «Служебное».';
      return;
    }
    if (!silent) message.textContent = 'Обновляем панель…';
    try {
      const [dashboard, releases, backups, audience, system] = await Promise.all([
        api('/api/control/dashboard'),
        api('/api/releases/history?limit=40'),
        api('/api/backup/history?limit=20'),
        audienceBox ? api('/api/control/audience').catch(error => ({ ok:false, error:error.message })) : Promise.resolve(null),
        api('/api/control/system').catch(error => ({ ok:false, error:error.message }))
      ]);
      renderDashboard(dashboard);
      renderReleases(releases.releases || []);
      renderBackups(backups.backups || []);
      if (audience) renderAudience(audience);
      if (system.ok) renderSystem(system);
      else if (systemGrid) systemGrid.innerHTML = `<div class="admin-empty">Состояние системы: ${escapeHtml(system.error || 'недоступно')}</div>`;
      if (!silent) message.textContent = 'Все показатели обновлены ✅';
    } catch (error) {
      if (error.message === 'unauthorized') message.textContent = 'Ключ не принят. Проверьте его в «Служебном».';
      else message.textContent = `Панель: ${error.message}`;
    }
  }
  async function createBackup() {
    if (!getKey()) { message.textContent = 'Сначала сохраните ключ в разделе «Служебное».'; return; }
    const button = document.getElementById('controlBackupNow');
    button.disabled = true;
    message.textContent = 'Создаём полную резервную копию базы…';
    try {
      const data = await api('/api/backup/run', {
        method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({reason:'manual-control'})
      });
      message.textContent = data.warning === 'r2-not-configured'
        ? 'Копия создана внутри D1 ✅ Для независимого архива подключите R2.'
        : 'Резервная копия сохранена в R2 ✅';
      await loadAll({ silent:true });
    } catch (error) {
      message.textContent = `Резервная копия: ${error.message}`;
    } finally { button.disabled = false; }
  }
  async function downloadBackup(id) {
    if (!id) return;
    message.textContent = 'Готовим файл резервной копии…';
    const response = await fetch(`/api/backup/download?id=${encodeURIComponent(id)}`, {
      headers:{authorization:`Bearer ${getKey()}`}, cache:'no-store'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `andrik-d1-backup-${id}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    message.textContent = 'Файл резервной копии скачан ✅';
  }
  async function downloadLatest() {
    if (!latestBackupId) return;
    backupDownload.disabled = true;
    try { await downloadBackup(latestBackupId); }
    catch (error) { message.textContent = `Скачивание: ${error.message}`; }
    finally { backupDownload.disabled = false; }
  }
  async function openRestore(id) {
    selectedRestoreId = '';
    restoreExecute.disabled = true;
    restoreConfirm.value = '';
    document.getElementById("controlBackupSpoiler")?.setAttribute("open","");
    restorePanel.hidden = false;
    restoreTitle.textContent = 'Проверяем выбранную копию…';
    restoreDetails.textContent = 'Сверяем формат, контрольную сумму и структуру таблиц.';
    restorePanel.scrollIntoView({behavior:'smooth', block:'center'});
    try {
      const preview = await api(`/api/backup/preview?id=${encodeURIComponent(id)}`);
      selectedRestoreId = id;
      restoreTitle.textContent = `Копия от ${formatDate(preview.createdAt)}`;
      restoreDetails.textContent = preview.compatible
        ? `Готова к восстановлению: ${preview.tableCount} таблиц, ${preview.rowCount} строк, ${formatBytes(preview.sizeBytes)}. Перед восстановлением система сама создаст страховочную копию текущей базы.`
        : `Копия несовместима. Отсутствуют таблицы: ${(preview.missingTables || []).join(', ') || 'нет'}.`;
      restoreExecute.disabled = !preview.compatible;
    } catch (error) {
      restoreTitle.textContent = 'Копию нельзя восстановить';
      restoreDetails.textContent = error.message;
    }
  }
  async function executeRestore() {
    if (!selectedRestoreId || restoreConfirm.value.trim() !== 'ВОССТАНОВИТЬ') {
      message.textContent = 'Для защиты введите слово ВОССТАНОВИТЬ полностью.';
      return;
    }
    if (!window.confirm('Текущие комментарии, тексты, push-история и релизы будут заменены данными выбранной копии. Продолжить?')) return;
    restoreExecute.disabled = true;
    message.textContent = 'Создаём страховочную копию и восстанавливаем базу… Не закрывайте страницу.';
    try {
      const result = await api('/api/backup/restore', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id:selectedRestoreId, confirmation:'ВОССТАНОВИТЬ'})
      });
      message.textContent = `База восстановлена ✅ Строк: ${result.restored?.rows || 0}. Страховочная копия: ${result.safetyBackup?.id || 'создана'}.`;
      restorePanel.hidden = true;
      selectedRestoreId = '';
      await loadAll({silent:true});
      window.dispatchEvent(new CustomEvent('andrik-control-refresh'));
    } catch (error) {
      message.textContent = `Восстановление: ${error.message}`;
      restoreExecute.disabled = false;
    }
  }


  async function loadSystemOnly() {
    if (!getKey()) { if (systemLog) systemLog.innerHTML = '<div class="admin-empty">Сначала сохраните ключ в разделе «Служебное».</div>'; return; }
    if (systemRefresh) systemRefresh.disabled = true;
    try { renderSystem(await api('/api/control/system')); }
    catch (error) { if (systemGrid) systemGrid.innerHTML = `<div class="admin-empty">Проверка: ${escapeHtml(error.message)}</div>`; }
    finally { if (systemRefresh) systemRefresh.disabled = false; }
  }

  async function loadAudienceOnly() {
    if (!getKey()) { if (analyticsStatus) analyticsStatus.textContent = 'Сначала сохраните ключ в разделе «Служебное».'; return; }
    if (analyticsRefresh) analyticsRefresh.disabled = true;
    if (analyticsStatus) analyticsStatus.textContent = 'Обновляем Cloudflare и YouTube…';
    try {
      renderAudience(await api('/api/control/audience'));
    } catch (error) {
      renderAudience({ ok:false, error:error.message });
      if (analyticsStatus) analyticsStatus.textContent = `Аналитика: ${error.message}`;
    } finally {
      if (analyticsRefresh) analyticsRefresh.disabled = false;
    }
  }
  document.getElementById('controlDashboardRefresh')?.addEventListener('click', () => loadAll());
  analyticsRefresh?.addEventListener('click', loadAudienceOnly);
  systemRefresh?.addEventListener('click', loadSystemOnly);
  systemCopy?.addEventListener('click', async () => {
    if (!lastSystemText) await loadSystemOnly();
    try {
      await navigator.clipboard.writeText(lastSystemText);
      if (systemSummary) { const previous = systemSummary.textContent; systemSummary.textContent = '✅ Скопировано'; setTimeout(() => { systemSummary.textContent = previous; }, 1600); }
    } catch (_) {
      const area = document.createElement('textarea'); area.value = lastSystemText; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    }
  });
  document.getElementById('controlBackupNow')?.addEventListener('click', createBackup);
  document.getElementById('controlBackupHistoryRefresh')?.addEventListener('click', () => loadAll());
  backupDownload?.addEventListener('click', downloadLatest);
  backupHistory?.addEventListener('click', event => {
    const download = event.target.closest('.control-backup-download-one');
    const restore = event.target.closest('.control-backup-restore-one');
    if (download) downloadBackup(download.dataset.backupId).catch(error => { message.textContent = `Скачивание: ${error.message}`; });
    if (restore) openRestore(restore.dataset.backupId);
  });
  restoreConfirm?.addEventListener('input', () => {
    restoreExecute.disabled = !selectedRestoreId || restoreConfirm.value.trim() !== 'ВОССТАНОВИТЬ';
  });
  restoreExecute?.addEventListener('click', executeRestore);
  document.getElementById('controlRestoreCancel')?.addEventListener('click', () => {
    restorePanel.hidden = true; selectedRestoreId = ''; restoreConfirm.value = '';
  });
  window.addEventListener('andrik-control-refresh', () => loadAll({silent:true}));
  setTimeout(() => loadAll({silent:true}), 180);
  const dashboardAutoRefresh = setInterval(() => { if (!document.hidden) loadAll({silent:true}); }, 120000);
  window.addEventListener('beforeunload', () => clearInterval(dashboardAutoRefresh));
})();
