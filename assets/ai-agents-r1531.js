(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const setText = (id, text) => { byId(id).textContent = text; };
  const apiRoot = '/api/control/agents/guard';
  const units = {
    'andrik-radio.service': 'Радио',
    'andrik-radio-web-control.service': 'Веб-агент радио',
    'andrik-radio-web-agent.service': 'Веб-агент радио (другое имя)',
    'andrik-radio-schedule-r1517.service': 'Расписание радио',
    'ssh.service': 'SSH',
    'ssh.socket': 'Сокет SSH'
  };
  const unitState = {
    active: 'Работает', inactive: 'Остановлена', failed: 'Сбой', activating: 'Запускается',
    deactivating: 'Останавливается', reloading: 'Перезагрузка', maintenance: 'Обслуживание',
    missing: 'Отсутствует', unknown: 'Нет данных'
  };
  const formatDate = new Intl.DateTimeFormat('ru-RU', { dateStyle:'short', timeStyle:'short' });
  const formatNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits:1 });
  const percent = value => Number.isFinite(value) ? `${formatNumber.format(value)}%` : '—';
  const capacity = value => value ? `Свободно ${size(value.availableBytes)} из ${size(value.totalBytes)}` : 'Нет данных';
  let current = null;
  let pairTimer;
  let staleTimer;

  function size(bytes) {
    if (bytes >= 1024 ** 3) return `${formatNumber.format(bytes / 1024 ** 3)} ГБ`;
    if (bytes >= 1024 ** 2) return `${formatNumber.format(bytes / 1024 ** 2)} МБ`;
    if (bytes >= 1024) return `${formatNumber.format(bytes / 1024)} КБ`;
    return `${bytes} Б`;
  }

  async function api(path, method = 'GET') {
    const response = await fetch(apiRoot + path, {
      method, credentials:'same-origin', cache:'no-store',
      headers:{ accept:'application/json' }, signal:AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      const error = new Error(data?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function connection(text, tone = '') {
    const el = byId('connection');
    if (el.textContent !== text) el.textContent = text;
    el.dataset.tone = tone;
  }

  function metric(id, value, detail = '', tone = '') {
    setText(`${id}-value`, value);
    setText(`${id}-detail`, detail);
    byId(`${id}-value`).dataset.tone = tone;
  }

  function clearPair(message = '') {
    clearTimeout(pairTimer);
    byId('pair-code').value = '';
    byId('pair-code').hidden = true;
    byId('copy-code').hidden = true;
    setText('pair-message', message);
  }

  function showRadio(report, fresh) {
    const state = report.services['andrik-radio.service'];
    if (state === 'active') {
      const signal = {
      ok:['Сигнал есть', 'Локальный выход радио активен', 'good'],
        'not-ready':['Нет сигнала', 'Служба запущена. Локальный выход не готов.', 'warn'],
        unavailable:['Нет статуса', 'Локальная проверка сигнала недоступна', 'warn']
      }[report.radioSignal] || ['Служба запущена', 'Нет данных о сигнале', 'warn'];
      metric('radio', signal[0], signal[1], fresh ? signal[2] : '');
    } else {
      const status = { inactive:'Выключено', failed:'Сбой', missing:'Служба отсутствует' };
      metric('radio', status[state] || unitState[state] || '—', 'Состояние службы',
        fresh && state === 'failed' ? 'bad' : '');
    }
  }

  function recommendations(report, fresh) {
    const issues = [];
    if (!fresh) return ['Эти значения из последнего замера. Проверь связь GUARD с контролькой перед действиями.'];
    if (report.disk?.usedPct >= 85) issues.push('Корневой диск заполнен на 85% или больше. Проверь размер журналов, архивов и кэша.');
    if (report.radioDisk?.usedPct >= 85) issues.push('Диск с кэшем радио заполнен на 85% или больше. Проверь объём кэша и временных файлов.');
    if (report.ram?.usedPct >= 85) issues.push('Занято 85% RAM или больше. Проверь процессы по потреблению памяти.');
    if (report.cpuHistory?.['15m']?.samples >= 4 && report.cpuHistory['15m'].average >= 90) issues.push('Средняя загрузка CPU за 15 минут выше 90%. Проверь самые активные процессы.');
    for (const [unit, state] of Object.entries(report.services)) {
      if (state === 'failed') issues.push(`Сбой службы «${units[unit]}». Посмотри журнал командой sudo journalctl -u ${unit} -n 30 --no-pager`);
    }
    if (report.services['andrik-radio.service'] === 'active' && report.radioSignal !== 'ok') {
      issues.push('Служба радио активна, но локальный статус не подтвердил сигнал. Если эфир должен идти, проверь журнал радио и выход на площадке.');
    }
    if (report.ffmpeg?.zombies) issues.push('Найдены завершившиеся процессы FFmpeg в состоянии zombie. Проверь родительский процесс.');
    if (report.temporary?.files) issues.push('Найдены старые временные файлы. Проверь, используются ли они, перед ручной очисткой.');
    if (report.ffmpeg?.partial || report.temporary?.partial) issues.push('Часть процессов или файлов недоступна для проверки либо достигнут лимит сканирования.');
    if (!report.disk || !report.ram || report.cpuPercent === null || !report.ffmpeg || !report.temporary ||
        Object.values(report.services).includes('unknown')) issues.push('Часть показателей VPS недоступна в этом замере.');
    return issues.length ? issues : ['В проверенных показателях отклонений нет.'];
  }

  function render(data) {
    clearTimeout(staleTimer);
    const report = data.report;
    const fresh = data.state === 'fresh';
    const statuses = {
      unpaired:['VPS ещё не подключён.', ''],
      waiting:['VPS подключён. Ждём первый отчёт.', ''],
      fresh:['Связь с GUARD есть.', 'good'],
      stale:['Данные устарели. Последнему замеру 5 минут или больше.', 'warn']
    };
    connection(...statuses[data.state]);
    byId('measurements').hidden = !report;
    byId('fill').disabled = !report;
    current = report ? { ...report, state:data.state } : null;
    if (!report) return;
    if (fresh) {
      staleTimer = setTimeout(() => render({ state:'stale', report }), Math.max(0, 300000 - (data.ageMs ?? 0)));
    }
    setText('last-sample', `Последний замер · ${formatDate.format(report.sampledAt)}`);
    const diskDetail = report.radioDisk ? `${capacity(report.disk)} · Диск радио ${percent(report.radioDisk.usedPct)}` : capacity(report.disk);
    metric('disk', percent(report.disk?.usedPct), diskDetail,
      fresh && (report.disk?.usedPct >= 85 || report.radioDisk?.usedPct >= 85) ? 'warn' : '');
    metric('ram', percent(report.ram?.usedPct), capacity(report.ram), fresh && report.ram?.usedPct >= 85 ? 'warn' : '');
    metric('cpu', percent(report.cpuPercent), report.cpuPercent === null ? 'Нет данных' : ('5/15/60 мин: ' + ['5m','15m','60m'].map(k => report.cpuHistory?.[k] ? percent(report.cpuHistory[k].average) : '—').join(' / ')),
      fresh && report.cpuPercent >= 90 ? 'warn' : '');
    showRadio(report, fresh);
    const ffmpeg = report.ffmpeg;
    metric('ffmpeg', ffmpeg ? String(ffmpeg.running) : '—', ffmpeg
      ? `Живых процессов${ffmpeg.radio === null ? '' : ` · В службе радио ${ffmpeg.radio}`}${ffmpeg.zombies ? ` · Zombie ${ffmpeg.zombies}` : ''}`
      : 'Нет данных', fresh && ffmpeg?.zombies ? 'warn' : '');
    metric('temp', report.temporary ? String(report.temporary.files) : '—',
      report.temporary ? `${size(report.temporary.bytes)} · Кэш радио и временные каталоги` : 'Нет данных',
      fresh && report.temporary?.files ? 'warn' : '');

    byId('issues').replaceChildren(...recommendations(report, fresh).map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    byId('units').replaceChildren(...Object.entries(units).map(([unit, label]) => {
      const row = document.createElement('div');
      const title = document.createElement('dt');
      const value = document.createElement('dd');
      title.textContent = label;
      title.title = unit;
      const state = report.services[unit];
      value.textContent = unitState[state] || 'Нет данных';
      value.dataset.tone = fresh && state === 'failed' ? 'bad' : '';
      row.append(title, value);
      return row;
    }));
  }

  async function refresh() {
    const button = byId('refresh');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const data = await api('/status');
      byId('login').hidden = true;
      byId('setup').hidden = false;
      if (data.state === 'unpaired') byId('setup').open = true;
      render(data);
    } catch (error) {
      if (error.status === 401) {
        clearTimeout(staleTimer);
        byId('login').hidden = false;
        byId('setup').hidden = true;
        byId('measurements').hidden = true;
        byId('fill').disabled = true;
        current = null;
        clearPair();
        connection('Для просмотра отчёта войди как владелец.', 'warn');
      } else {
        if (current) {
          render({ state:'stale', report:current });
        }
        const message = error.status === 404 ? 'API GUARD появится после публикации R1531.'
          : 'Не удалось получить данные из контрольки. Попробуй обновить.';
        connection(current ? `${message} Показан последний полученный замер.` : message, 'warn');
      }
    } finally {
      button.disabled = false;
    }
  }

  byId('refresh').addEventListener('click', refresh);
  byId('login').addEventListener('submit', async event => {
    event.preventDefault();
    const field = byId('admin-key');
    const button = event.currentTarget.querySelector('button');
    const key = field.value.trim();
    if (!key) return;
    field.value = '';
    button.disabled = true;
    setText('login-message', 'Проверяю доступ…');
    try {
      await window.AndrikOwnerSession.establish(key);
      setText('login-message', '');
      await refresh();
    } catch (error) {
      const message = error.status === 401 ? 'Проверь ADMIN_KEY.'
        : error.status === 429 ? 'Слишком много попыток входа. Повтори позже.'
        : 'Не удалось открыть сессию. Попробуй ещё раз.';
      setText('login-message', message);
    } finally {
      button.disabled = false;
    }
  });

  byId('pair').addEventListener('click', async () => {
    const button = byId('pair');
    button.disabled = true;
    clearPair('Получаю код…');
    try {
      const data = await api('/pair', 'POST');
      byId('pair-code').value = data.code;
      byId('pair-code').hidden = false;
      byId('copy-code').hidden = false;
      setText('pair-message', `Код действует до ${formatDate.format(data.expiresAt)}. Вставь его в терминал VPS.`);
      pairTimer = setTimeout(() => clearPair('Код истёк. Получи новый.'), Math.max(0, data.expiresAt - Date.now()));
    } catch (error) {
      if (error.status === 401) await refresh();
      else setText('pair-message', 'Не удалось получить код. Попробуй ещё раз.');
    } finally {
      button.disabled = false;
    }
  });

  byId('copy-install').addEventListener('click', async () => {
    const command = byId('setup').querySelector('pre');
    try {
      await navigator.clipboard.writeText(command.textContent + '\n');
      setText('install-message', 'Команды скопированы.');
    } catch (_) {
      setText('install-message', 'Выдели и скопируй команды вручную.');
    }
  });

  byId('copy-code').addEventListener('click', async () => {
    const code = byId('pair-code');
    try {
      await navigator.clipboard.writeText(code.value);
      setText('pair-message', 'Код скопирован. Вставь его в терминал VPS.');
    } catch (_) {
      code.focus();
      code.select();
      setText('pair-message', 'Скопируй выделенный код.');
    }
  });

  const reportBox = byId('report');
  byId('fill').addEventListener('click', () => {
    if (!current) return;
    reportBox.value = JSON.stringify(current, null, 2);
    setText('report-message', 'Последний замер подставлен.');
  });
  byId('copy').addEventListener('click', async () => {
    const report = reportBox.value.trim();
    if (!report) {
      setText('report-message', 'Сначала подставь или вставь отчёт.');
      return;
    }
    const prefix = 'Проанализируй отчёт ANDRIK GUARD для Ubuntu VPS. Объясни проблемы и предложи шаги диагностики. Ничего не удаляй и не перезапускай.\n\n';
    const request = report.startsWith(prefix) ? report : prefix + report;
    try {
      await navigator.clipboard.writeText(request);
      setText('report-message', 'Запрос скопирован. Вставь его в ChatGPT.');
    } catch (_) {
      reportBox.value = request;
      reportBox.focus();
      reportBox.select();
      setText('report-message', 'Скопируй выделенный запрос.');
    }
  });
  byId('clear').addEventListener('click', () => {
    reportBox.value = '';
    setText('report-message', '');
  });

  Promise.resolve(window.AndrikOwnerSession?.ready?.()).finally(refresh);
  setInterval(() => { if (!document.hidden && byId('login').hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && byId('login').hidden) refresh();
  });
})();
