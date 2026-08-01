(() => {
  'use strict';
  const list = document.getElementById('worldCountries');
  const map = document.getElementById('worldMap');
  if (!list || !map || window.__andrikCountryFocusUiV5482Ready) return;
  window.__andrikCountryFocusUiV5482Ready = true;

  const card = map.closest('.world-map-card');
  const growthToggle = document.getElementById('countryGrowthToggle');
  let focusActions = document.getElementById('mapFocusActions');
  let lastFocused = null;
  let frame = 0;

  function ensureActionsInsideCard(){
    if (!card) return null;
    if (!focusActions) {
      focusActions = document.createElement('nav');
      focusActions.id = 'mapFocusActions';
      focusActions.className = 'map-focus-actions';
      focusActions.hidden = true;
      focusActions.setAttribute('aria-hidden', 'true');
      focusActions.setAttribute('aria-label', 'Быстрые действия выбранной страны');
      focusActions.innerHTML = '<a class="map-focus-action is-daily" href="/control-home.html?page=summary&v=54.82">📊 Аналитика за день</a><a class="map-focus-action is-activity" href="/control-home.html?page=activity&v=54.82">⚡ Последняя активность</a>';
    } else {
      const daily = focusActions.querySelector('.is-daily');
      const activity = focusActions.querySelector('.is-activity');
      if (daily) { daily.href = '/control-home.html?page=summary&v=54.82'; daily.textContent = '📊 Аналитика за день'; }
      if (activity) { activity.href = '/control-home.html?page=activity&v=54.82'; activity.textContent = '⚡ Последняя активность'; }
    }
    if (growthToggle && (focusActions.parentElement !== card || focusActions.nextElementSibling !== growthToggle)) {
      card.insertBefore(focusActions, growthToggle);
    } else if (!growthToggle && focusActions.parentElement !== card) {
      card.appendChild(focusActions);
    }
    return focusActions;
  }

  function syncNow(){
    ensureActionsInsideCard();
    let selected = list.querySelector('.world-country-button.is-selected');
    const focusCountry = String(map.dataset.focusCountry || '');
    if (!selected && focusCountry) {
      const encoded = encodeURIComponent(focusCountry);
      selected = list.querySelector(`.world-country-button[data-country="${encoded}"]`);
      if (selected) {
        selected.classList.add('is-selected');
        selected.setAttribute('aria-pressed','true');
      }
    }
    const focused = Boolean(selected || map.classList.contains('is-country-focused') || focusCountry) && document.body.dataset.analyticsPage === 'map';
    list.classList.toggle('is-country-focus-mode', focused);
    card?.classList.toggle('has-country-focus', focused);
    document.body.classList.toggle('is-country-focus-active', focused);
    if (focusActions) {
      focusActions.hidden = !focused;
      focusActions.classList.toggle('is-visible', focused);
      focusActions.setAttribute('aria-hidden', focused ? 'false' : 'true');
    }
    if (lastFocused !== focused) {
      lastFocused = focused;
      window.dispatchEvent(new CustomEvent('andrik:country-focus-changed', { detail: { focused } }));
    }
  }

  function sync(){
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncNow);
  }

  const observer = new MutationObserver(sync);
  observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
  observer.observe(map, { attributes: true, attributeFilter: ['class', 'data-focus-country'] });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-analytics-page'] });
  window.addEventListener('andrik:analytics-page-changed', sync);
  window.addEventListener('andrik:audience-data', sync);
  window.addEventListener('pageshow', sync);
  document.addEventListener('click', event => {
    if (event.target.closest?.('.world-country-button,.world-map-dot,[data-country-toggle]')) setTimeout(sync, 0);
  });
  ensureActionsInsideCard();
  syncNow();
  setTimeout(syncNow, 250);
  setTimeout(syncNow, 1200);
})();
