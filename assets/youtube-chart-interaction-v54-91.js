(() => {
  'use strict';
  if (window.__andrikYoutubeChartInteractionV5491) return;
  window.__andrikYoutubeChartInteractionV5491 = true;

  const card = document.getElementById('youtubeStudioTrendCard');
  const chart = document.getElementById('youtubeStudioTrend');
  if (!card || !chart) return;

  chart.setAttribute('role','button');
  chart.setAttribute('tabindex','0');
  chart.setAttribute('aria-pressed','false');
  chart.setAttribute('aria-label','Нажмите, чтобы слегка увеличить график YouTube и подсветить цвета');
  chart.title = 'Нажмите, чтобы увеличить график';

  const toggle = () => {
    const active = card.classList.toggle('is-chart-zoomed');
    chart.setAttribute('aria-pressed', active ? 'true' : 'false');
  };

  chart.addEventListener('click', toggle);
  chart.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  });
})();
