(() => {
  const shell = document.getElementById('youtubeLatestNews');
  if (!shell) return;
  const link = shell.querySelector('.youtube-news-card');
  const title = shell.querySelector('.youtube-news-title');
  const meta = shell.querySelector('.youtube-news-meta');
  const eyeline = shell.querySelector('.youtube-news-eyeline');
  const action = shell.querySelector('.youtube-news-action');
  const lang = (document.documentElement.lang || 'ru').toLowerCase().split('-')[0];
  const copy = {
    ru: { label:'Последнее на YouTube', action:'Смотреть ↗', unavailable:'Последние новости YouTube пока недоступны' },
    uk: { label:'Останнє на YouTube', action:'Дивитися ↗', unavailable:'Останні новини YouTube поки недоступні' },
    sk: { label:'Najnovšie na YouTube', action:'Pozrieť ↗', unavailable:'Najnovšie YouTube video zatiaľ nie je dostupné' },
    en: { label:'Latest on YouTube', action:'Watch ↗', unavailable:'Latest YouTube update is not available yet' }
  }[lang] || null;
  const t = copy || copy.ru;
  const formatDate = value => {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat(lang === 'sk' ? 'sk-SK' : lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU', {
        dateStyle:'medium', timeStyle:'short'
      }).format(new Date(value));
    } catch (_) { return value; }
  };
  async function load() {
    try {
      const response = await fetch('/api/public/youtube-latest', { cache:'no-store', headers:{ accept:'application/json' } });
      const data = await response.json().catch(() => ({}));
      const latest = data.latest;
      if (!response.ok || !latest?.videoId) throw new Error(data.error || 'latest-unavailable');
      eyeline.textContent = t.label;
      title.textContent = latest.title || 'ANDRIK';
      meta.textContent = formatDate(latest.publishedAt || latest.updatedAt || data.updatedAt);
      action.textContent = t.action;
      link.href = latest.url || `https://www.youtube.com/watch?v=${encodeURIComponent(latest.videoId)}`;
      link.dataset.webUrl = link.href;
      shell.hidden = false;
    } catch (_) {
      shell.hidden = true;
      title.textContent = t.unavailable;
    }
  }
  load();
  window.setInterval(load, 5 * 60 * 1000);
})();
