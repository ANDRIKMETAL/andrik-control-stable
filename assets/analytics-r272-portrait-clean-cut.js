(() => {
  'use strict';
  if (window.__ANDRIK_R272_PORTRAIT_CLEAN_CUT__) return;
  window.__ANDRIK_R272_PORTRAIT_CLEAN_CUT__ = true;

  const exactActions = () => {
    const nodes = [...document.querySelectorAll('#mapFocusActions')];
    const actions = nodes.shift();
    nodes.forEach(node => node.remove());
    if (!actions) return;

    const valid = [...actions.children].filter(node => node.matches?.('a.map-focus-action'));
    const activity = valid.find(node => node.classList.contains('is-activity'));
    const daily = valid.find(node => node.classList.contains('is-daily'));
    const correct = valid.length === 2 && valid[0] === activity && valid[1] === daily;
    if (!correct) {
      actions.innerHTML = '<a class="map-focus-action is-activity" href="/control-home.html?page=activity&amp;v=55.00-r272">⚡ Последняя активность</a><a class="map-focus-action is-daily" href="/control-home.html?page=summary&amp;v=55.00-r272">📊 Аналитика за день</a>';
    } else {
      activity.href = '/control-home.html?page=activity&v=55.00-r272';
      daily.href = '/control-home.html?page=summary&v=55.00-r272';
      activity.textContent = '⚡ Последняя активность';
      daily.textContent = '📊 Аналитика за день';
    }
  };

  const sync = () => {
    exactActions();
    const portrait = window.matchMedia?.('(orientation:portrait)')?.matches === true;
    const map = document.getElementById('worldMap');
    const list = document.getElementById('worldCountries');
    const focused = Boolean(
      map?.dataset?.focusCountry ||
      map?.classList?.contains('is-country-focused') ||
      list?.querySelector?.('.world-country-button.is-selected,.world-country-selected-card.is-selected,[aria-pressed="true"]')
    );
    document.body.classList.toggle('r272-portrait-country-focused', portrait && focused);
  };

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  };

  const boot = () => {
    sync();
    const map = document.getElementById('worldMap');
    const list = document.getElementById('worldCountries');
    if (map) new MutationObserver(schedule).observe(map, {attributes:true, attributeFilter:['class','data-focus-country']});
    if (list) new MutationObserver(schedule).observe(list, {childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-pressed']});
    new MutationObserver(schedule).observe(document.body, {attributes:true, attributeFilter:['class','data-analytics-page']});
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
  addEventListener('pageshow', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  addEventListener('orientationchange', () => setTimeout(schedule, 120), {passive:true});
  addEventListener('andrik:country-focus-changed', schedule);
  addEventListener('andrik:audience-data', schedule);
})();
