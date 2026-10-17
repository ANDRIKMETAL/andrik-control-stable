(() => {
'use strict';
if (window.AndrikSiteUpdateProgress) return;
const byId = id => document.getElementById(id);
const order = ['check', 'backup', 'commit', 'release', 'deploy', 'protect'];
const labels = {
  check: 'Проверка архива', backup: 'Резервная копия',
  commit: 'Сохранение новой версии', release: 'Сохранение архива',
  deploy: 'Публикация сайта', protect: 'Проверка сайта'
};
const descriptions = {
  check: 'Проверяем архив и список изменений.',
  backup: 'Закрепляем предыдущую версию для восстановления.',
  commit: 'Сохраняем новую версию сайта.',
  release: 'Сохраняем архив обновления.',
  deploy: 'Новая версия публикуется.',
  protect: 'Проверяем работоспособность сайта.'
};
let current = Object.freeze({ state: 'idle', percent: 0, headerState: 'green' });
let queued = false;

function readModel() {
  const stages = byId('siteUpdateStages');
  const mode = stages?.dataset.progressMode || 'install';
  const names = mode === 'health' ? ['protect'] : order;
  const values = names.map(name => {
    const node = stages?.querySelector(`[data-stage="${name}"]`);
    return node?.dataset.stageStatus || '';
  });
  const result = byId('siteUpdateResultState');
  const outcome = result?.dataset.updateOutcome || '';
  const errorAt = values.indexOf('error');
  const runningAt = values.indexOf('running');
  const hasLaterActivity = index => values.slice(index + 1).some(Boolean);
  let confirmed = 0;
  for (let i = 0; i < values.length; i++) {
    const passed = ['done', 'skipped'].includes(values[i]) ||
      (names[i] === 'release' && values[i] === 'warn' && hasLaterActivity(i));
    if (!passed) break;
    confirmed++;
  }
  // Percentages follow confirmed stages, never a timer or an estimated upload speed.
  let percent = Math.min(99, Math.round(confirmed / names.length * 100));
  const prefix = index => mode === 'health' ? '' :
    `${mode === 'rollback' || mode === 'recovery' ? 'Восстановление · ' : ''}Этап ${index + 1} из ${names.length} · `;
  const make = (state, title, badge, note, extra = {}) => Object.freeze({
    state, title, badge, note, percent,
    headerState: state === 'error' ? 'red' :
      ['waiting', 'warning', 'recovering'].includes(state) ? 'yellow' :
      ['running', 'ready'].includes(state) ? 'blue' : 'green',
    busy: state === 'running' || state === 'waiting' || state === 'recovering',
    ...extra
  });
  if (errorAt >= 0 || outcome === 'error' || result?.classList.contains('is-error')) {
    const index = errorAt >= 0 ? errorAt : Math.max(0, runningAt);
    return make('error', mode === 'health' ? 'Проверка остановлена' : 'Обновление остановлено',
      'Ошибка', `${prefix(index)}${labels[names[index]]}. Подробности ошибки — ниже.`);
  }
  if (outcome === 'unchanged') {
    return make('success', 'Сайт уже актуален', 'Без изменений',
      'Обновление не требуется.', { percent: 100 });
  }
  if (outcome === 'complete' || outcome === 'complete-warning') {
    const warned = outcome === 'complete-warning' || values.includes('warn');
    if (warned) return make('warning', 'Завершено с предупреждениями', 'Предупреждение',
      values[names.indexOf('release')] === 'warn'
        ? 'Сайт опубликован. Архив релиза не сохранён — подробности ниже.'
        : 'Сайт работает. Некритические предупреждения — ниже.', { percent: 100 });
    return make('success', mode === 'health' ? 'Проверка завершена' :
      mode === 'recovery' || mode === 'rollback' ? 'Восстановление завершено' : 'Обновление завершено',
      'Готово', mode === 'health' ? 'Сайт прошёл проверку.' :
      'Сайт опубликован и прошёл проверку.', { percent: 100 });
  }
  if (outcome === 'incomplete') {
    return make('warning', 'Проверка не завершена', 'Нужна проверка',
      'Сайт опубликован. Повтори проверку сайта.');
  }
  if (runningAt >= 0) {
    const name = names[runningAt];
    return make(mode === 'recovery' ? 'recovering' : 'running', labels[name],
      mode === 'recovery' ? 'Восстановление' : 'В процессе',
      `${prefix(runningAt)}${descriptions[name]}`);
  }
  const warningAt = values.lastIndexOf('warn');
  if (warningAt >= 0) {
    const waiting = names[warningAt] === 'deploy';
    return make(waiting ? 'waiting' : 'warning',
      waiting ? 'Ожидаем публикацию сайта' : labels[names[warningAt]],
      waiting ? 'Ожидание' : 'Предупреждение',
      `${prefix(warningAt)}${waiting
        ? 'Ожидаем подтверждения публикации. Проверка продолжится автоматически.'
        : 'Проверка требует внимания. Подробности — ниже.'}`);
  }
  if (mode !== 'health' && values[0] === 'done' && values.slice(1).every(value => !value)) {
    return make('ready', 'ZIP проверен', 'Готов к установке',
      'Этап 1 из 6 завершён · Нажми «Обновить сайт».');
  }
  if (values.some(Boolean)) {
    const next = Math.min(confirmed, names.length - 1);
    return make('running', labels[names[next]], 'В процессе',
      `${prefix(next)}${descriptions[names[next]]}`);
  }
  percent = 0;
  return make('idle', 'Подготовка обновления', 'Не начато', 'Выбери полный ZIP сайта.');
}

const setText = (id, text) => {
  const element = byId(id);
  if (element && element.textContent !== text) element.textContent = text;
};
function refresh() {
  queued = false;
  const box = byId('siteUpdateProgress');
  const bar = byId('siteUpdateProgressBar');
  if (!box || !bar) return;
  const model = readModel();
  const changed = JSON.stringify(model) !== JSON.stringify(current);
  current = model;
  box.dataset.state = model.state;
  document.documentElement.dataset.andrikInstallState = model.state;
  document.documentElement.dataset.andrikHeaderState = model.headerState;
  bar.setAttribute('aria-valuenow', String(model.percent));
  bar.setAttribute('aria-valuetext', `${model.percent}% · ${model.title}`);
  bar.setAttribute('aria-busy', String(model.busy));
  byId('siteUpdateProgressFill')?.style.setProperty('width', `${model.percent}%`);
  setText('siteUpdateProgressPercent', `${model.percent}%`);
  setText('siteUpdateProgressTitle', model.title);
  setText('siteUpdateProgressBadge', model.badge);
  setText('siteUpdateProgressNote', model.note);
  if (changed) window.dispatchEvent(new CustomEvent('andrik:eye-glow', {
    detail: { state: model.headerState, source: 'site-update-progress' }
  }));
}
function schedule() {
  if (queued) return;
  queued = true;
  queueMicrotask(refresh);
}
window.AndrikSiteUpdateProgress = Object.freeze({ get state() { return current; }, refresh });
function start() {
  const observer = new MutationObserver(schedule);
  for (const id of ['siteUpdateStages', 'siteUpdateResultState']) {
    const node = byId(id);
    if (node) observer.observe(node, { subtree: true, attributes: true,
      attributeFilter: ['class', 'data-stage-status', 'data-update-outcome', 'data-progress-mode'] });
  }
  window.addEventListener('andrik:site-update-stage', schedule);
  window.addEventListener('pageshow', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  refresh();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
})();
