/* ANDRIK v55.00 R3N — live countdown to 20 August 2026, Europe/Bratislava. */
(() => {
  'use strict';
  const init = () => {
    const shell = document.getElementById('topTrikaCountdown');
    if (!shell || shell.dataset.bound === '1') return;
    shell.dataset.bound = '1';
    const target = new Date(shell.dataset.release || '2026-08-20T00:00:00+02:00');
    const done = document.getElementById('topTrikaCountdownDone');
    const out = {
      days: shell.querySelector('[data-unit="days"]'),
      hours: shell.querySelector('[data-unit="hours"]'),
      minutes: shell.querySelector('[data-unit="minutes"]'),
      seconds: shell.querySelector('[data-unit="seconds"]')
    };
    const pad = value => String(Math.max(0, value)).padStart(2, '0');
    let timer = 0;
    const tick = () => {
      let diff = target.getTime() - Date.now();
      if (!Number.isFinite(diff) || diff <= 0) {
        Object.values(out).forEach(node => { if (node) node.textContent = '00'; });
        shell.style.opacity = '.58';
        done?.classList.add('show');
        if (timer) clearInterval(timer);
        return;
      }
      const days = Math.floor(diff / 86400000); diff -= days * 86400000;
      const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
      const minutes = Math.floor(diff / 60000); diff -= minutes * 60000;
      const seconds = Math.floor(diff / 1000);
      if (out.days) out.days.textContent = pad(days);
      if (out.hours) out.hours.textContent = pad(hours);
      if (out.minutes) out.minutes.textContent = pad(minutes);
      if (out.seconds) out.seconds.textContent = pad(seconds);
    };
    tick();
    timer = window.setInterval(tick, 1000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
