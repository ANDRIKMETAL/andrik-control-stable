(() => {
  'use strict';
  if (window.__ANDRIK_SITE_UPDATE_HEADER_R239__) return;
  window.__ANDRIK_SITE_UPDATE_HEADER_R239__ = true;

  const GOLD_MS = 5200;
  let goldUntil = 0;
  let successLatched = false;
  let timer = 0;

  const root = document.documentElement;
  const stagesRoot = () => document.getElementById('siteUpdateStages');
  const stage = name => stagesRoot()?.querySelector(`[data-stage="${name}"]`);
  const has = (node, status) => Boolean(node?.classList.contains(`is-${status}`));

  function derive() {
    const rootStages = stagesRoot();
    if (!rootStages) return 'green';
    const items = Array.from(rootStages.querySelectorAll('[data-stage]'));
    const release = stage('release');
    const deploy = stage('deploy');
    const protect = stage('protect');
    const result = document.getElementById('siteUpdateResultState');
    const failureText = [
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
    const explicitFailure = /ошиб|неуда|сбой|failed|failure|deploy\s+failed|критичес/i.test(failureText);
    if (items.some(item => has(item,'error')) || result?.classList.contains('is-error') || explicitFailure) return 'red';
    if (has(release,'warn') || has(protect,'warn')) return 'red';
    if (has(deploy,'running') || has(deploy,'warn')) return 'yellow';
    if (items.some(item => has(item,'running'))) return 'blue';

    const releaseComplete = has(release,'done') || has(release,'skipped');
    const completed = releaseComplete && has(deploy,'done') && has(protect,'done') && result?.classList.contains('is-ready');
    if (completed && !successLatched) {
      successLatched = true;
      goldUntil = Date.now() + GOLD_MS;
      try { sessionStorage.setItem('andrik-header-gold-until', String(goldUntil)); } catch (_) {}
    }
    if (completed && Date.now() < goldUntil) return 'gold';
    return 'green';
  }

  function apply() {
    clearTimeout(timer);
    const state = derive();
    root.dataset.andrikHeaderState = state;
    try { window.dispatchEvent(new CustomEvent('andrik:eye-glow', { detail:{ state } })); } catch (_) {}
    if (state === 'gold') timer = setTimeout(apply, Math.max(40, goldUntil - Date.now() + 40));
  }

  function restoreGold() {
    try {
      const saved = Number(sessionStorage.getItem('andrik-header-gold-until') || 0);
      if (saved > Date.now()) {
        goldUntil = saved;
        successLatched = true;
        root.dataset.andrikHeaderState = 'gold';
        window.dispatchEvent(new CustomEvent('andrik:eye-glow', { detail:{ state:'gold' } }));
        timer = setTimeout(() => {
          sessionStorage.removeItem('andrik-header-gold-until');
          apply();
        }, Math.max(40, saved - Date.now() + 40));
      }
    } catch (_) {}
  }

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
    restoreGold();
    apply();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once:true });
  else observe();
})();
