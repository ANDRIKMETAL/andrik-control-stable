(() => {
  'use strict';
  if (window.__ANDRIK_SITE_UPDATE_HEADER_R255__) return;
  window.__ANDRIK_SITE_UPDATE_HEADER_R255__ = true;

  const GOLD_MS = 5200;
  const root = document.documentElement;
  let goldUntil = 0;
  let successLatched = false;
  let timer = 0;

  const stagesRoot = () => document.getElementById('siteUpdateStages');
  const stage = name => stagesRoot()?.querySelector(`[data-stage="${name}"]`);
  const has = (node, status) => Boolean(node?.classList.contains(`is-${status}`));

  const derive = () => {
    const stages = stagesRoot();
    if (!stages) return 'green';
    const items = [...stages.querySelectorAll('[data-stage]')];
    const deploy = stage('deploy');
    const protect = stage('protect');
    const result = document.getElementById('siteUpdateResultState');
    const text = [
      result?.textContent,
      document.getElementById('siteUpdateResultText')?.textContent,
      document.getElementById('siteUpdateDeployMessage')?.textContent,
      document.getElementById('siteUpdatePublishMessage')?.textContent
    ].filter(Boolean).join(' ');
    const anyState = items.some(item => /\bis-(?:running|done|warn|error|skipped)\b/.test(item.className));
    if (!anyState) {
      successLatched = false;
      goldUntil = 0;
      return 'green';
    }
    if (items.some(item => has(item, 'error')) || result?.classList.contains('is-error') || /ошиб|неуда|сбой|failed|failure|критичес/i.test(text)) return 'red';

    // Этап 5: сайт разворачивается — весь глаз и ореол жёлтые.
    if (has(deploy, 'running') || has(deploy, 'warn')) return 'yellow';
    // Этап 6: проверяется защита — весь глаз и ореол синие.
    if (has(protect, 'running') || has(protect, 'warn')) return 'blue';
    if (items.some(item => has(item, 'running'))) return 'blue';

    const completed = has(deploy, 'done') && has(protect, 'done') && result?.classList.contains('is-ready');
    if (completed && !successLatched) {
      successLatched = true;
      goldUntil = Date.now() + GOLD_MS;
      try { sessionStorage.setItem('andrik-header-gold-until-r255', String(goldUntil)); } catch (_) {}
    }
    if (completed && Date.now() < goldUntil) return 'gold';
    return 'green';
  };

  const apply = () => {
    clearTimeout(timer);
    const state = derive();
    root.dataset.andrikHeaderState = state;
    try { window.dispatchEvent(new CustomEvent('andrik:eye-glow', { detail:{ state } })); } catch (_) {}
    if (state === 'gold') timer = setTimeout(apply, Math.max(50, goldUntil - Date.now() + 50));
  };

  const observe = () => {
    const targets = [
      stagesRoot(),
      document.getElementById('siteUpdateResultState'),
      document.getElementById('siteUpdateResultText'),
      document.getElementById('siteUpdateDeployMessage'),
      document.getElementById('siteUpdatePublishMessage')
    ].filter(Boolean);
    const observer = new MutationObserver(() => requestAnimationFrame(apply));
    targets.forEach(target => observer.observe(target, { subtree:true, attributes:true, childList:true, characterData:true }));
    window.addEventListener('andrik:site-update-stage', apply);
    window.addEventListener('pageshow', apply, { passive:true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); }, { passive:true });
    try {
      const saved = Number(sessionStorage.getItem('andrik-header-gold-until-r255') || 0);
      if (saved > Date.now()) {
        goldUntil = saved;
        successLatched = true;
      }
    } catch (_) {}
    apply();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once:true });
  else observe();
})();
