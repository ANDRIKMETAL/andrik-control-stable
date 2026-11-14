(() => {
  'use strict';

  const byId = name => document.getElementById('watch-' + name);
  const text = (name, value) => { byId(name).textContent = value; };
  const date = new Intl.DateTimeFormat('ru-RU', { dateStyle:'short', timeStyle:'short' });
  const states = {
    'on-air':['Сигнал есть', 'Локальный выход радио активен', 'good'],
    off:['Выключено', 'Служба радио остановлена', ''],
    starting:['Запускается', 'Радио готовит сигнал', ''],
    degraded:['Сбой сигнала', 'Локальный выход требует проверки', 'warn'],
    unavailable:['Нет данных', 'Локальный статус радио недоступен', 'warn']
  };
  const media = { track:'Трек', clip:'Клип', bumper:'Заставка', special:'Спецэфир' };
  const issues = {
    'status-unreachable':'Не отвечает локальный статус радио.',
    'service-failed':'Служба радио завершилась со сбоем.',
    'signal-lost':'Пропал локальный сигнал радио.',
    'video-stalled':'Перестали продвигаться кадры видео.',
    'transport-stalled':'Данные RTMPS перестали продвигаться.',
    'ffmpeg-error':'FFmpeg сообщил об ошибке эфира.',
    'clip-handoff':'Сбой воспроизведения клипа или перехода между записями.'
  };
  let last = null;
  let codeTimer;
  let staleTimer;

  async function api(action, method = 'GET') {
    const response = await fetch('/api/control/agents/watch/' + action, {
      method, credentials:'same-origin', cache:'no-store',
      headers:{accept:'application/json'}, signal:AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      const error = new Error(data?.error || 'HTTP ' + response.status);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function connection(message, tone = '') {
    if (byId('connection').textContent !== message) text('connection', message);
    byId('connection').dataset.tone = tone;
  }

  function showReport(report, fresh) {
    byId('readings').hidden = !report;
    if (!report) return;
    const [label, detail, tone] = states[report.state] || states.unavailable;
    text('state', label);
    byId('state').dataset.tone = fresh ? tone : '';
    const frame = Number.isFinite(report.frameAgeMs) ? ` · Кадр ${(report.frameAgeMs / 1000).toLocaleString('ru-RU', {maximumFractionDigits:1})} с назад` : '';
    text('detail', detail + frame);
    text('sample', 'Последний замер · ' + date.format(report.sampledAt));
    text('current', report.current?.title || '—');
    const change = report.current && report.changedAt ? ' · с ' + date.format(report.changedAt) : '';
    text('current-detail', (media[report.current?.type] || '') + change);
    text('next', report.next?.title || '—');
    text('next-detail', media[report.next?.type] || '');
    text('ffmpeg', report.ffmpegErrors ?? '—');
    byId('issue').hidden = !report.issue;
    byId('issue').dataset.tone = fresh ? 'warn' : '';
    text('issue', report.issue ? `${fresh ? '' : 'В последнем отчёте · '}${issues[report.issue]}` : '');
  }

  function clearCode(message = '') {
    clearTimeout(codeTimer);
    byId('code').value = '';
    byId('code').hidden = byId('copy-code').hidden = true;
    text('pair-message', message);
  }

  async function refresh() {
    const button = byId('refresh');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const data = await api('status');
      clearTimeout(staleTimer);
      byId('push').hidden = byId('setup').hidden = false;
      if (data.state === 'unpaired' && last === null) byId('setup').open = true;
      last = data.report;
      showReport(last, data.state === 'fresh');
      if (data.state === 'unpaired') connection('WATCH ещё не подключён.');
      if (data.state === 'waiting') connection('WATCH подключён. Жду первый замер.');
      if (data.state === 'stale') connection('От WATCH давно нет данных. Показан последний замер.', 'warn');
      if (data.state === 'fresh') {
        connection('Связь с WATCH есть.', 'good');
        staleTimer = setTimeout(() => {
          showReport(last, false);
          connection('От WATCH давно нет данных. Показан последний замер.', 'warn');
        }, Math.max(0, 120000 - (data.ageMs ?? 0)));
      }
    } catch (error) {
      clearTimeout(staleTimer);
      if (error.status === 401) {
        last = null;
        byId('push').hidden = byId('setup').hidden = true;
        clearCode();
        connection('Войди как владелец в карточке GUARD.', 'warn');
      } else {
        connection(last ? 'Связь с контролькой прервалась. Показан последний замер.'
          : 'Не удалось загрузить статус WATCH.', 'warn');
      }
      showReport(last, false);
    } finally {
      button.disabled = false;
    }
  }

  byId('refresh').addEventListener('click', refresh);
  byId('pair').addEventListener('click', async () => {
    const button = byId('pair');
    button.disabled = true;
    clearCode('Получаю код…');
    try {
      const data = await api('pair', 'POST');
      byId('code').value = data.code;
      byId('code').hidden = byId('copy-code').hidden = false;
      text('pair-message', 'Код действует до ' + date.format(data.expiresAt) + '.');
      codeTimer = setTimeout(() => clearCode('Код истёк. Получи новый.'), Math.max(0, data.expiresAt - Date.now()));
    } catch (_) {
      clearCode('Не удалось получить код WATCH.');
    } finally {
      button.disabled = false;
    }
  });

  byId('copy-install').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(byId('command').textContent + '\n');
      text('pair-message', 'Команды скопированы.');
    } catch (_) {
      text('pair-message', 'Выдели и скопируй команды вручную.');
    }
  });

  byId('copy-code').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(byId('code').value);
      text('pair-message', 'Код скопирован. Вставь его в терминал VPS.');
    } catch (_) {
      byId('code').select();
      text('pair-message', 'Скопируй выделенный код.');
    }
  });

  byId('test').addEventListener('click', async () => {
    const button = byId('test');
    button.disabled = true;
    text('push-message', 'Отправляю…');
    try {
      const result = await api('test', 'POST');
      text('push-message', result.queued ? 'Уведомление поставлено в очередь.'
        : 'Push принят. Проверь уведомления на Android.');
    } catch (error) {
      const messages = {
        'owner-device-not-registered':'В контрольке нет подписанного устройства владельца.',
        'owner-subscription-invalid':'Подписка владельца недействительна. Обнови её в настройках push.',
        'push-not-configured':'Push ещё не настроен на сайте.'
      };
      text('push-message', messages[error.message] || 'Не удалось отправить тест.');
    } finally {
      button.disabled = false;
    }
  });

  window.addEventListener('andrik-owner-session', event => { if (event.detail.active) refresh(); });
  Promise.resolve(window.AndrikOwnerSession?.ready?.()).finally(refresh);
  setInterval(() => { if (!document.hidden && !byId('setup').hidden) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
