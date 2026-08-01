(() => {
  'use strict';
  if (window.__andrikControlStatusEyeR88) return;
  window.__andrikControlStatusEyeR88 = true;

  const KEY_SESSION = 'andrik-comments-admin-key';
  const KEY_LOCAL = 'andrik-comments-admin-key-persistent';
  const KEY_STATE = 'andrik-control-system-eye-state';
  const GOOD_SRC = '/assets/control-topbar-eye-triangle.jpg?v=55.00-r88';
  const ERROR_SRC = '/assets/andrik-control-red-triangle-192.png?v=55.00-r88';
  const logo = document.getElementById('controlCenterLogo');
  if (!logo) return;

  const okImage = logo.querySelector('.logo-ok');
  const errorImage = logo.querySelector('.logo-error');
  if (okImage) okImage.src = GOOD_SRC;
  if (errorImage) errorImage.src = ERROR_SRC;

  const staleStyles = [
    'andrik-status-eye-v54-99c7-style',
    'andrik-status-eye-v55-00-r3l-style'
  ];
  staleStyles.forEach(id => document.getElementById(id)?.remove());

  const style = document.createElement('style');
  style.id = 'andrik-status-eye-v55-00-r88-style';
  style.textContent = `
    .control-center-logo{
      isolation:isolate!important;
      overflow:visible!important;
    }
    .control-center-logo:not(.is-error) .logo-ok,
    .control-center-logo.is-good .logo-ok,
    .control-center-logo.is-warning .logo-ok,
    .control-center-logo.is-checking .logo-ok{
      display:block!important;
      opacity:1!important;
      visibility:visible!important;
      filter:brightness(1.22) saturate(1.42)
        drop-shadow(0 0 10px rgba(150,255,194,.96))
        drop-shadow(0 0 30px rgba(43,226,105,.84))
        drop-shadow(0 0 56px rgba(13,176,68,.56))!important;
    }
    .control-center-logo:not(.is-error) .logo-error,
    .control-center-logo.is-good .logo-error,
    .control-center-logo.is-warning .logo-error,
    .control-center-logo.is-checking .logo-error{
      display:block!important;
      opacity:0!important;
      visibility:hidden!important;
      pointer-events:none!important;
    }
    .control-center-logo.is-error .logo-ok{
      opacity:0!important;
      visibility:hidden!important;
    }
    .control-center-logo.is-error .logo-error{
      display:block!important;
      opacity:1!important;
      visibility:visible!important;
      filter:drop-shadow(0 0 10px rgba(255,83,83,.72))
        drop-shadow(0 0 30px rgba(255,34,34,.52))!important;
    }
    html[data-control-system-state="warning"] .control-topbar::before,
    html[data-control-system-state="good"] .control-topbar::before,
    html[data-control-system-state="checking"] .control-topbar::before{
      filter:saturate(1.08) brightness(.92)!important;
    }
  `;
  document.head.appendChild(style);

  const readKey = () => {
    try { return localStorage.getItem(KEY_LOCAL) || sessionStorage.getItem(KEY_SESSION) || ''; }
    catch (_) { return ''; }
  };

  const saveState = state => {
    try { localStorage.setItem(KEY_STATE, state); } catch (_) {}
  };

  const setState = (state, title) => {
    const normalized = state === 'error' ? 'error' : state === 'warning' ? 'warning' : 'good';
    logo.classList.remove('is-checking', 'is-error', 'is-warning', 'is-good');
    logo.classList.add(normalized === 'error' ? 'is-error' : normalized === 'warning' ? 'is-warning' : 'is-good');
    document.documentElement.dataset.controlSystemState = normalized;
    if (okImage) okImage.src = GOOD_SRC;
    if (errorImage) errorImage.src = ERROR_SRC;
    saveState(normalized);
    logo.setAttribute('title', title);
    logo.setAttribute('aria-label', `${title}. Открыть главный сайт ANDRIK`);
  };

  /* Initial and warning states stay visually green. Only a confirmed critical failure is red. */
  setState('warning', 'Проверяем состояние служб');

  let checking = false;
  const checkStatus = async () => {
    if (checking) return;
    checking = true;
    logo.classList.add('is-checking');
    const key = readKey();
    if (!key) {
      setState('warning', 'Control открыт · служебный статус ожидает ADMIN_KEY');
      checking = false;
      return;
    }
    try {
      const response = await fetch(`/api/control/system?eye=1&t=${Date.now()}`, {
        headers: { accept: 'application/json', authorization: `Bearer ${key}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'system');

      const criticalKeys = ['site','worker','database','oneSignal','youtube','cron','nativeMonitor'];
      const allServices = data.services || {};
      const services = criticalKeys.map(key => allServices[key]).filter(Boolean);
      const normalized = services.map(item => String(item?.status || '').toLowerCase());
      const errors = normalized.filter(status => status === 'error').length;
      const warnings = normalized.filter(status => ['warning','optional','pending','never','configured'].includes(status)).length;

      if (errors) setState('error', `Критических ошибок: ${errors}`);
      else if (warnings) setState('warning', `Система работает · предупреждений: ${warnings}`);
      else setState('good', `Всё работает ${services.length}/${services.length}`);
    } catch (_) {
      /* A temporary status-request miss is not proof of an outage. Keep the green eye. */
      setState('warning', 'Control работает · повторяем служебную проверку');
    } finally {
      checking = false;
    }
  };

  checkStatus();
  window.setInterval(() => { if (!document.hidden) checkStatus(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkStatus(); });
  window.addEventListener('pageshow', () => checkStatus(), { passive: true });
  window.addEventListener('andrik-control-system-refresh', () => checkStatus());
})();
