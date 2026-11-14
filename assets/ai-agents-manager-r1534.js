(() => {
  'use strict';

  const byId = id => document.getElementById(`manager-${id}`);
  const priorities = { urgent:'Срочно', attention:'Проверить', planned:'Планово', setup:'Подключение' };
  const states = { open:'Открыта', working:'В работе', awaiting:'Ждёт замера', resolved:'Закрыта', rejected:'Отклонена' };
  const radio = { 'on-air':'локальный сигнал есть', off:'радио выключено', starting:'радио запускается',
    degraded:'сбой сигнала', unavailable:'статус радио недоступен' };
  const sourceStates = { unpaired:'Ожидает подключения', waiting:'Ожидает первый отчёт', stale:'Отчёт устарел', fresh:'Свежий отчёт' };
  const priorityOrder = ['urgent', 'attention', 'setup', 'planned'];
  const date = new Intl.DateTimeFormat('ru-RU', { dateStyle:'short', timeStyle:'short', timeZone:'Europe/Bratislava' });
  const cards = new Map();
  let snapshot = null;
  let connected = false;
  let busy = false;
  let accessVersion = 0;

  async function api(path, body) {
    const response = await fetch(`/api/control/agents/manager/${path}`, {
      method:body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store',
      headers:{ accept:'application/json', ...(body ? {'content-type':'application/json'} : {}) },
      ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      const error = new Error(data?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function sourceLine(agent, source) {
    const details = [sourceStates[source.state]];
    if (source.sampledAt !== null) details.push(date.format(source.sampledAt));
    if (agent === 'watch' && radio[source.radio]) details.push(radio[source.radio]);
    return details.join(' · ');
  }

  function activeTasks(data) {
    return data.tasks.filter(task => !['resolved', 'rejected'].includes(task.state)).sort((a, b) =>
      Number(a.state === 'awaiting') - Number(b.state === 'awaiting') ||
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority) || b.updatedAt - a.updatedAt);
  }

  function setConnection(message, tone = '') {
    const target = byId('connection');
    target.textContent = message;
    target.dataset.tone = tone;
  }

  function setBusy(value) {
    busy = value;
    byId('refresh').disabled = value;
    for (const card of cards.values()) card.querySelectorAll('.manager-decisions button').forEach(button => { button.disabled = value || !connected; });
  }

  function renderCard(task) {
    let card = cards.get(task.id);
    if (!card) {
      card = byId('task-template').content.firstElementChild.cloneNode(true);
      card.querySelector('.manager-task-accept').addEventListener('click', () => changeTask(task.id, 'working'));
      card.querySelector('.manager-task-reject').addEventListener('click', () => changeTask(task.id, 'rejected'));
      card.querySelector('.manager-task-reopen').addEventListener('click', () => changeTask(task.id, 'open'));
      cards.set(task.id, card);
    }
    const { state } = task;
    const set = (selector, value) => { card.querySelector(selector).textContent = value; };
    card.dataset.priority = ['awaiting', 'resolved', 'rejected'].includes(state) ? '' : task.priority;
    card.dataset.state = state;
    set('.manager-priority', priorities[task.priority]);
    set('.manager-task-state', states[state]);
    set('.manager-task-title', task.title);
    set('.manager-task-evidence', task.eventAt
      ? `${task.evidence} Событие зафиксировано ${date.format(task.eventAt)}.` : task.evidence);
    set('.manager-task-action', state === 'awaiting' ? 'Дождись свежего отчёта по этой проблеме.' : task.action);
    card.querySelector('.manager-task-action').hidden = ['resolved','rejected'].includes(state);
    card.querySelector('.manager-command').hidden = !task.command || ['awaiting','resolved','rejected'].includes(state);
    set('pre', task.command);
    card.querySelector('.manager-task-sources').replaceChildren(...task.agents.map(agent => {
      const link = document.createElement('a');
      link.href = `#${agent}`;
      link.textContent = agent.toUpperCase();
      return link;
    }));
    card.querySelector('.manager-task-accept').hidden = state !== 'open';
    card.querySelector('.manager-task-reject').hidden = !['open','working'].includes(state);
    card.querySelector('.manager-task-reopen').hidden = !['working','rejected'].includes(state);
    return card;
  }

  function placeCards(container, tasks) {
    const wanted = tasks.map(renderCard);
    let cursor = container.firstElementChild;
    for (const card of wanted) {
      if (card === cursor) cursor = cursor.nextElementSibling;
      else container.insertBefore(card, cursor);
    }
    while (cursor) {
      const next = cursor.nextElementSibling;
      cursor.remove();
      cursor = next;
    }
  }

  function render(data) {
    if (snapshot?.updatedAt !== data.updatedAt) {
      byId('copy-fallback').hidden = true;
      byId('copy-fallback').value = '';
    }
    snapshot = data;
    connected = true;
    byId('login').hidden = true;
    byId('content').hidden = false;
    byId('copy').disabled = false;
    for (const [agent, source] of Object.entries(data.sources)) byId(agent).textContent = sourceLine(agent, source);
    const open = activeTasks(data);
    const closed = data.tasks.filter(task => ['resolved','rejected'].includes(task.state)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
    const allFresh = Object.values(data.sources).every(source => source.state === 'fresh');
    setConnection(allFresh ? `Сводка обновлена · ${date.format(data.updatedAt)}`
      : `Ожидаю свежие отчёты · ${date.format(data.updatedAt)}`, allFresh ? 'good' : 'warn');
    byId('open-title').textContent = `Открытые задачи · ${open.length}`;
    placeCards(byId('tasks'), open);
    placeCards(byId('closed'), closed);
    byId('empty').hidden = open.length !== 0;
    byId('empty').textContent = 'Открытых задач нет.';
    byId('history').hidden = closed.length === 0;
    byId('history-title').textContent = `История · ${closed.length}`;
  }

  function showError(error) {
    connected = false;
    byId('copy').disabled = true;
    byId('copy-fallback').hidden = true;
    byId('copy-fallback').value = '';
    byId('feedback').textContent = '';
    if (error.status === 401 || error.status === 403) {
      snapshot = null;
      byId('content').hidden = true;
      byId('login').hidden = false;
      byId('tasks').replaceChildren();
      byId('closed').replaceChildren();
      cards.clear();
      setConnection('Войди как владелец, чтобы открыть отчёты и задачи.', 'warn');
    } else {
      setConnection(snapshot ? 'Связь прервалась. На экране последняя загруженная сводка.'
        : 'Не удалось получить сводку. Нажми «Обновить».', 'warn');
    }
  }

  async function refresh() {
    if (busy) return;
    const access = accessVersion;
    setBusy(true);
    try {
      const data = await api('status');
      if (access === accessVersion) render(data);
    }
    catch (error) { showError(error); }
    finally { setBusy(false); }
  }

  async function changeTask(id, nextState) {
    const task = snapshot?.tasks.find(item => item.id === id);
    if (busy || !connected || !task) return;
    const access = accessVersion;
    setBusy(true);
    try {
      const data = await api('task', { id, openedAt:task.openedAt, state:nextState });
      if (access !== accessVersion) return;
      render(data);
      byId('feedback').textContent = nextState === 'rejected' ? 'Рекомендация отклонена. При новой критичности задача появится снова.' : 'Решение сохранено.';
    } catch (error) {
      if (error.status === 409) {
        setBusy(false);
        await refresh();
        if (connected) byId('feedback').textContent = 'Пришёл новый отчёт. Список задач обновлён.';
      } else showError(error);
    } finally { setBusy(false); }
  }

  byId('copy').addEventListener('click', async () => {
    if (!snapshot || !connected) return;
    const access = accessVersion;
    const open = activeTasks(snapshot);
    const lines = [
      `ANDRIK MANAGER · ${date.format(snapshot.updatedAt)} (Europe/Bratislava)`,
      ...Object.entries(snapshot.sources).map(([agent, source]) => `${agent.toUpperCase()} · ${sourceLine(agent, source)}`),
      '',
      ...open.map(task => {
        const nextStep = task.state === 'awaiting' ? 'Дождись свежего отчёта.' : task.action;
        return `[${priorities[task.priority]} · ${states[task.state]}] ${task.title}\n${task.evidence}\n${nextStep}`;
      })
    ];
    if (!open.length) lines.push('Открытых задач нет.');
    const report = lines.join('\n');
    const fallback = byId('copy-fallback');
    try {
      await navigator.clipboard.writeText(report);
      if (access !== accessVersion) return;
      fallback.hidden = true;
      byId('feedback').textContent = 'Сводка скопирована.';
    } catch (_) {
      if (access !== accessVersion) return;
      fallback.value = report;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      byId('feedback').textContent = 'Скопируй выделенный текст сводки.';
    }
  });

  byId('refresh').addEventListener('click', refresh);
  byId('login').addEventListener('click', () => document.getElementById('admin-key').focus({preventScroll:true}));
  window.addEventListener('andrik-owner-session', event => {
    if (event.detail.active) refresh();
    else {
      accessVersion += 1;
      showError({ status:401 });
    }
  });
  Promise.resolve(window.AndrikOwnerSession?.ready?.()).finally(refresh);
  setInterval(() => { if (!document.hidden && connected) refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
