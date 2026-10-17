import {createHomePlayer} from './home-player-r1450.js?v=r1450';

export const normaliseTitle = value => String(value || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\.(mp3|wav)$/i, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function selectReviews(items, limit = 3) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .filter(item => item && String(item.name || '').trim() && String(item.message || '').trim().length >= 8 && (!item.status || item.status === 'approved'))
    .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || Number(b.likeCount || 0) - Number(a.likeCount || 0) || (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .filter(item => { const name = normaliseTitle(item.name); if (seen.has(name)) return false; seen.add(name); return true; })
    .slice(0, limit);
}

const WORDS = {
  ru: {play: 'Слушать', pause: 'Пауза', heroPlay: 'Послушать ANDRIK', loading: 'Загружаем песню…', tapAgain: 'Нажми ▶ ещё раз, чтобы включить песню.', error: 'Не удалось включить песню. Попробуй ещё раз или открой альбом.', finished: 'Подборка завершена. Можно выбрать другую песню.', radio: 'ANDRIK METAL RADIO', offline: 'Эфир сейчас недоступен', unknown: 'Статус эфира временно недоступен', pending: 'Название песни уточняется', next: 'Далее: ', first: 'Для знакомства: ', review: 'Читать отзыв', listen: 'Слушать'},
  en: {play: 'Listen', pause: 'Pause', heroPlay: 'Listen to ANDRIK', loading: 'Loading the song…', tapAgain: 'Tap ▶ again to start the song.', error: 'Could not play this song. Try again or open the album.', finished: 'The selection has ended. Choose another song.', radio: 'ANDRIK METAL RADIO', offline: 'The stream is currently unavailable', unknown: 'Live status is temporarily unavailable', pending: 'Checking the song title', next: 'Next: ', first: 'Start with: ', review: 'Read the comment', listen: 'Listen'},
  uk: {play: 'Слухати', pause: 'Пауза', heroPlay: 'Послухати ANDRIK', loading: 'Завантажуємо пісню…', tapAgain: 'Натисни ▶ ще раз, щоб увімкнути пісню.', error: 'Не вдалося ввімкнути пісню. Спробуй ще раз або відкрий альбом.', finished: 'Добірка завершилася. Можна вибрати іншу пісню.', radio: 'ANDRIK METAL RADIO', offline: 'Ефір зараз недоступний', unknown: 'Статус ефіру тимчасово недоступний', pending: 'Уточнюємо назву пісні', next: 'Далі: ', first: 'Для знайомства: ', review: 'Читати відгук', listen: 'Слухати'},
  sk: {play: 'Počúvať', pause: 'Pozastaviť', heroPlay: 'Vypočuť ANDRIK', loading: 'Načítava sa skladba…', tapAgain: 'Ťukni znova na ▶ a spusti skladbu.', error: 'Skladbu sa nepodarilo spustiť. Skús to znova alebo otvor album.', finished: 'Výber sa skončil. Vyber si ďalšiu skladbu.', radio: 'ANDRIK METAL RADIO', offline: 'Vysielanie je teraz nedostupné', unknown: 'Stav vysielania je dočasne nedostupný', pending: 'Overujeme názov skladby', next: 'Ďalej: ', first: 'Na zoznámenie: ', review: 'Prečítať komentár', listen: 'Počúvať'}
};

export function startHome(doc = document, win = window) {
  if (!doc.body.classList.contains('home-r1450')) return null;
  const lang = (doc.documentElement.lang || 'ru').split('-')[0], text = WORDS[lang] || WORDS.en;
  const player = createHomePlayer({doc, win, text});
  const hero = doc.querySelector('.h-hero'), video = doc.getElementById('homeHeroVideo'), motion = doc.getElementById('heroMotionToggle');
  const heroListen = doc.getElementById('homeListen'), listenNote = doc.getElementById('homeListenNote');
  const coverByAlbum = {'silent': 'silent-cover-r1159.webp', 'beyond': 'beyond-cover-r601.webp', 'trika': 'trika-third-album-cover-r479.webp', 'ocean': 'ocean-cover-v51-crop.webp', 'illusion-of-life': 'illusion-of-life-static-v52.jpg'};
  const artByTitle = new Map(), controllers = new Set();
  let heroVisible = true, radioVisible = false, radioTimer = 0, radioBusy = false, radioController = null;
  let userPaused = Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches || win.navigator?.connection?.saveData);
  let albumsLoaded = false, albumsPending = false, reviewsLoaded = false, reviewsPending = false;
  let pickIds = [], fallbackId = null, singleId = null, lastMeaningfulRadioTitle = '', lastMeaningfulNextTitle = '';

  function syncHero() {
    if (!video) return;
    motion.hidden = false;
    const paused = userPaused || !heroVisible || doc.hidden;
    motion.textContent = userPaused ? '▶' : 'Ⅱ';
    motion.setAttribute('aria-label', userPaused ? motion.dataset.playLabel : motion.dataset.pauseLabel);
    motion.setAttribute('aria-pressed', String(!userPaused));
    if (paused) { video.pause(); return; }
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    try {
      const result = video.play();
      result?.catch?.(() => { userPaused = true; motion.textContent = '▶'; motion.setAttribute('aria-label', motion.dataset.playLabel); motion.setAttribute('aria-pressed', 'false'); });
    } catch { userPaused = true; }
  }
  video?.addEventListener('playing', () => video.classList.add('is-ready'));
  motion?.addEventListener('click', () => { userPaused = !userPaused; syncHero(); });

  async function getJSON(url, signal) {
    const controller = signal ? null : new AbortController();
    if (controller) controllers.add(controller);
    const timer = controller ? win.setTimeout(() => controller.abort(), 8000) : 0;
    try {
      const response = await win.fetch(url, {cache: 'no-store', headers: {accept: 'application/json'}, signal: signal || controller.signal});
      if (!response.ok) throw Error('unavailable');
      const value = await response.json();
      if (value.ok === false) throw Error('unavailable');
      return value;
    } finally { win.clearTimeout(timer); if (controller) controllers.delete(controller); }
  }

  function refreshQueue() {
    const ids = [...pickIds];
    if (!ids.length && fallbackId) ids.push(fallbackId);
    if (singleId) ids.push(singleId);
    player.setQueue(ids);
    const first = pickIds[0] || fallbackId || singleId;
    if (first) player.bind(heroListen, first, text.heroPlay);
  }

  function attachPlayer(root, raw) {
    const id = player.register(raw);
    if (!id || !root) return id;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'h-song-play';
    root.replaceChildren(button);
    player.bind(button, id);
    return id;
  }

  async function loadAlbums() {
    if (albumsLoaded || albumsPending) return;
    albumsPending = true;
    try {
      const value = await getJSON('/api/music/albums/status');
      const albums = Array.isArray(value.albums) ? value.albums : [];
      const ids = [];
      for (const album of albums) for (const track of album.tracks || []) {
        if (coverByAlbum[album.slug]) artByTitle.set(normaliseTitle(track.title), coverByAlbum[album.slug]);
      }
      doc.querySelectorAll('[data-home-pick]').forEach(card => {
        const album = albums.find(item => item.slug === card.dataset.album);
        const track = album?.tracks?.find(item => normaliseTitle(item.title) === normaliseTitle(card.dataset.homePick));
        if (!track) return;
        const id = attachPlayer(card.querySelector('.h-pick-player'), {...track, album: album.label, art: '/assets/' + coverByAlbum[album.slug]});
        if (id) ids.push(id);
      });
      pickIds = ids;
      const preferred = albums.find(album => album.slug === 'illusion-of-life' && album.tracks?.length) || albums.find(album => album.tracks?.length);
      if (preferred) {
        const track = preferred.tracks[0];
        fallbackId = player.register({...track, album: preferred.label, art: '/assets/' + coverByAlbum[preferred.slug]});
      }
      const firstCard = [...doc.querySelectorAll('[data-home-pick]')].find(card => card.querySelector('.h-song-play'));
      if (firstCard) listenNote.textContent = text.first + firstCard.dataset.homePick;
      albumsLoaded = true;
      refreshQueue();
    } catch { /* Existing album links remain usable when the catalogue is unavailable. */ }
    finally { albumsPending = false; }
  }

  async function loadNews() {
    await Promise.allSettled([
      (async () => {
        const value = await getJSON('/api/music/singles');
        const tracks = (Array.isArray(value.tracks) ? value.tracks : [])
          .filter(track => track.releaseType !== 'cover' && !String(track.key || '').startsWith('covers/'))
          .sort((a, b) => (Date.parse(b.publishedAt || b.uploaded) || 0) - (Date.parse(a.publishedAt || a.uploaded) || 0));
        const newest = tracks[0];
        if (!newest) return;
        doc.getElementById('singles').querySelector('.h-eyebrow').textContent = {ru: 'Последний сингл', en: 'Latest single', uk: 'Останній сингл', sk: 'Najnovší singel'}[lang] || 'Latest single';
        doc.getElementById('latestSingleTitle').textContent = newest.title || newest.name || 'ANDRIK';
        singleId = attachPlayer(doc.getElementById('latestSinglePlayer'), {...newest, album: 'ANDRIK', art: '/assets/andrik-radio-mini-r1199.webp'});
        refreshQueue();
      })(),
      (async () => {
        const value = await getJSON('/api/public/youtube-latest');
        if (!/^[A-Za-z0-9_-]{11}$/.test(value.latest?.videoId || '')) return;
        const link = doc.getElementById('homeLatestVideo'), url = 'https://www.youtube.com/watch?v=' + value.latest.videoId;
        link.href = url;
        link.dataset.webUrl = url;
        doc.getElementById('homeVideoTitle').textContent = value.latest.title || 'ANDRIK';
      })()
    ]);
  }

  const isInsertTitle = value => /^(?:заставка|вставка|спецвставка|идент|джингл|station\b|bumper\b)|(?:\b(?:30|60)\s*мин\b)/i.test(String(value || '').trim());
  const meaningfulTitle = value => { const title = String(value || '').trim(); return title && !isInsertTitle(title) ? title : ''; };
  function showRadio(value) {
    const card = doc.getElementById('radio'), title = doc.getElementById('radioTrack'), note = doc.getElementById('radioNote'), image = card.querySelector('img');
    const age = value ? Date.now() - Date.parse(value.lastSeen || '') : Infinity;
    const fresh = Boolean(value?.online && Number.isFinite(age) && age >= -60000 && age < 90000);
    const live = fresh && value.service === 'active' && value.publisher === true && value.producer === true && value.transportHealthy !== false && Number(value.rtmpsEstablishedConnectionsR792) > 0;
    card.classList.toggle('is-live', Boolean(live));
    const current = live ? meaningfulTitle(value.current) : '';
    const queued = (Array.isArray(value?.upcoming) ? value.upcoming : []).find(item => ['track', 'clip'].includes(String(item?.type || '').toLowerCase()) && meaningfulTitle(item?.title || item?.name));
    const next = live ? meaningfulTitle(queued?.title || queued?.name) || meaningfulTitle(value.next) : '';
    if (current) lastMeaningfulRadioTitle = current;
    if (next && normaliseTitle(next) !== normaliseTitle(current)) lastMeaningfulNextTitle = next;
    if (current && normaliseTitle(lastMeaningfulNextTitle) === normaliseTitle(current)) lastMeaningfulNextTitle = '';
    const shown = current || lastMeaningfulRadioTitle || text.radio;
    title.textContent = live ? shown : text.radio;
    note.textContent = live ? text.next + (next || lastMeaningfulNextTitle || text.pending) : !fresh ? text.unknown : text.offline;
    const src = '/assets/' + (live && artByTitle.get(normaliseTitle(shown)) || 'andrik-radio-mini-r1199.webp');
    if (image.getAttribute('src') !== src) image.src = src;
  }
  async function pollRadio() {
    win.clearTimeout(radioTimer);
    if (!radioVisible || doc.hidden || radioBusy) return;
    radioBusy = true;
    radioController = new AbortController();
    const timer = win.setTimeout(() => radioController?.abort(), 8000);
    try { const value = await getJSON('/api/public/radio-diagnostics-r803', radioController.signal); if (radioVisible && !doc.hidden) showRadio(value); }
    catch { if (radioVisible && !doc.hidden) showRadio(null); }
    finally {
      win.clearTimeout(timer); radioBusy = false; radioController = null;
      if (radioVisible && !doc.hidden) radioTimer = win.setTimeout(pollRadio, 30000);
    }
  }

  async function loadReviews() {
    if (reviewsLoaded || reviewsPending) return;
    reviewsPending = true;
    const root = doc.getElementById('homeReviews');
    try {
      const value = await getJSON('/api/comments?limit=12');
      const reviews = selectReviews(value.comments);
      root.replaceChildren();
      for (const item of reviews) {
        const figure = doc.createElement('figure'), quote = doc.createElement('blockquote'), author = doc.createElement('figcaption'), name = doc.createElement('strong'), link = doc.createElement('a');
        figure.className = 'h-review';
        quote.textContent = String(item.message).trim();
        if (['ru', 'en', 'uk', 'sk'].includes(item.locale)) quote.lang = item.locale;
        quote.setAttribute('translate', 'no');
        name.textContent = String(item.name).trim();
        link.href = (lang === 'ru' ? '' : '/' + lang) + '/comments.html#page-top';
        link.textContent = text.review + ' ↗';
        author.append(name, link);
        figure.append(quote, author);
        root.append(figure);
      }
      root.hidden = !reviews.length;
      reviewsLoaded = true;
    } catch { root.hidden = true; }
    finally { reviewsPending = false; }
  }

  if ('IntersectionObserver' in win) {
    const observer = new win.IntersectionObserver(entries => {
      for (const entry of entries) {
        const node = entry.target;
        if (node === hero) { heroVisible = entry.isIntersecting; syncHero(); }
        if (node.id === 'radio') {
          radioVisible = entry.isIntersecting;
          if (radioVisible) { void loadAlbums(); void pollRadio(); }
          else { win.clearTimeout(radioTimer); radioController?.abort(); }
        }
        if (node.hasAttribute('data-home-reviews') && entry.isIntersecting) void loadReviews();
        if (node.id === 'start' && entry.isIntersecting) void loadAlbums();
      }
    }, {threshold: 0.01});
    doc.querySelectorAll('.h-hero,#radio,#start,[data-home-reviews]').forEach(node => observer.observe(node));
    win.addEventListener('pagehide', () => observer.disconnect());
    win.addEventListener('pageshow', () => doc.querySelectorAll('.h-hero,#radio,#start,[data-home-reviews]').forEach(node => observer.observe(node)));
  } else { radioVisible = true; void pollRadio(); void loadReviews(); }
  doc.addEventListener('visibilitychange', () => {
    syncHero();
    if (doc.hidden) { win.clearTimeout(radioTimer); radioController?.abort(); }
    else void pollRadio();
  });
  win.addEventListener('pagehide', () => { video?.pause(); win.clearTimeout(radioTimer); radioController?.abort(); controllers.forEach(controller => controller.abort()); });
  win.addEventListener('pageshow', () => { syncHero(); void pollRadio(); });
  syncHero();
  void loadAlbums();
  void loadNews();
  return {player, loadAlbums, loadReviews, showRadio};
}

if (typeof document !== 'undefined') startHome();
