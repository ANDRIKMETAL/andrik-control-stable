(() => {
  const topbar = document.querySelector('.topbar');
  const onScroll = () => topbar?.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealItems = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealItems.forEach(el => el.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -28px' });
    revealItems.forEach((el, index) => {
      el.style.transitionDelay = `${Math.min((index % 6) * 55, 275)}ms`;
      observer.observe(el);
    });
  }

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());


  // v51.47 — album breathing is controlled by the final CSS override.

  const glassItems = document.querySelectorAll('.release-card,.platform-card,.album-card,.stats-grid,.prosnis-compact,.philosophy-panel,.platform-mini-card,.trika-card,.trika-path,.trika-sources,.trika-final');
  if (reduced || !('IntersectionObserver' in window)) {
    glassItems.forEach(el => el.classList.add('glass-active'));
  } else {
    const glassObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('glass-active', entry.isIntersecting));
    }, { threshold: 0, rootMargin: '140px 0px 140px' });
    glassItems.forEach(el => glassObserver.observe(el));
  }


  const audio = document.getElementById('andrikAudio');
  const navToggle = document.getElementById('navToggle');
  const siteMenu = document.getElementById('siteMenu');
  const audioToggle = document.getElementById('audioToggle');
  audioToggle?.addEventListener('click', async () => {
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
        audioToggle.classList.add('is-playing');
        audioToggle.setAttribute('aria-label', audioToggle.dataset.stopLabel || 'Stop music');
      } else {
        audio.pause();
        audioToggle.classList.remove('is-playing');
        audioToggle.setAttribute('aria-label', audioToggle.dataset.playLabel || 'Play music');
      }
    } catch (error) {
      console.warn('Audio playback was blocked:', error);
    }
  });
  audio?.addEventListener('pause', () => audioToggle?.classList.remove('is-playing'));

  if (navToggle && siteMenu) {
    const closeMenu = () => {
      siteMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', navToggle.dataset.openLabel || 'Открыть меню');
      document.body.classList.remove('menu-open');
    };
    navToggle.addEventListener('click', () => {
      const open = siteMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? (navToggle.dataset.closeLabel || 'Закрыть меню') : (navToggle.dataset.openLabel || 'Открыть меню'));
      document.body.classList.toggle('menu-open', open);
    });
    siteMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    addEventListener('resize', () => { if (innerWidth > 820) closeMenu(); });
    addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  }


  // v50.38 — clearly visible blue-to-white glow for the main hero title.
  // Web Animations API is used because some Android PWA builds freeze CSS text-color animations.
  const heroTitle = document.querySelector('.hero h1');
  if (heroTitle && typeof heroTitle.animate === 'function') {
    const titleParts = [heroTitle, ...heroTitle.querySelectorAll('span')];
    const keyframes = [
      { color: '#88d8ff', textShadow: '0 0 10px rgba(80,190,255,.35), 0 0 28px rgba(80,190,255,.25)', filter: 'brightness(1.03)' },
      { color: '#ffffff', textShadow: '0 0 18px rgba(210,245,255,.70), 0 0 46px rgba(90,205,255,.48)', filter: 'brightness(1.28)' },
      { color: '#9edfff', textShadow: '0 0 14px rgba(90,200,255,.48), 0 0 34px rgba(90,200,255,.34)', filter: 'brightness(1.10)' },
      { color: '#ffffff', textShadow: '0 0 20px rgba(220,248,255,.78), 0 0 50px rgba(100,210,255,.52)', filter: 'brightness(1.32)' },
      { color: '#88d8ff', textShadow: '0 0 10px rgba(80,190,255,.35), 0 0 28px rgba(80,190,255,.25)', filter: 'brightness(1.03)' }
    ];
    titleParts.forEach((element, index) => {
      element.style.background = 'none';
      element.style.webkitTextFillColor = 'currentColor';
      element.style.color = '#88d8ff';
      element.animate(keyframes, {
        duration: 2600,
        iterations: Infinity,
        easing: 'ease-in-out',
        delay: index ? -1300 : 0
      });
    });
  }


  // v51.13 — the visible page is the source of truth for language.
  // This prevents stale storage from switching the home page after leaving the player.
  const ANDRIK_LANGUAGE_KEY = 'andrikPreferredLanguage';
  const supportedLanguages = new Set(['ru', 'uk', 'sk', 'en']);
  const currentLanguage = (document.documentElement.lang || 'ru').toLowerCase().split('-')[0];
  try {
    if (supportedLanguages.has(currentLanguage)) {
      localStorage.setItem(ANDRIK_LANGUAGE_KEY, currentLanguage);
    }
  } catch (_) {}

  document.addEventListener('click', event => {
    const languageLink = event.target.closest('a.language-option[lang]');
    if (!languageLink) return;
    const selectedLanguage = (languageLink.getAttribute('lang') || '').toLowerCase().split('-')[0];
    if (!supportedLanguages.has(selectedLanguage)) return;
    try {
      localStorage.setItem(ANDRIK_LANGUAGE_KEY, selectedLanguage);
      sessionStorage.setItem('andrikManualLanguage', selectedLanguage);
    } catch (_) {}
  }, true);

  // v50.54 — compact language picker with full language names.
  const languagePicker = document.querySelector('.language-picker');
  const languageToggle = languagePicker?.querySelector('.language-toggle');
  const languageDropdown = languagePicker?.querySelector('.language-dropdown');
  if (languagePicker && languageToggle && languageDropdown) {
    const closeLanguagePicker = () => {
      languagePicker.classList.remove('is-open');
      languageToggle.setAttribute('aria-expanded', 'false');
    };
    languageToggle.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = !languagePicker.classList.contains('is-open');
      languagePicker.classList.toggle('is-open', willOpen);
      languageToggle.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) languageDropdown.querySelector('.active')?.focus({ preventScroll: true });
    });
    languageDropdown.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', closeLanguagePicker);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeLanguagePicker();
        languageToggle.focus({ preventScroll: true });
      }
    });
  }
  // v51.1 — Trika uses the same uninterrupted CSS breathing model as the main page.
  // No Web Animations override: running two animation engines caused long pauses and sudden jumps on Android.

  const insideLivePlayerShell = window.self !== window.top;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !insideLivePlayerShell) {
    addEventListener('load', async () => {
      try {
        const cleanUrl = new URL(location.href);
        if (cleanUrl.searchParams.has('_updated')) {
          cleanUrl.searchParams.delete('_updated');
          history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        }
        const registration = await navigator.serviceWorker.register('/service-worker.js?v=54.42', { updateViaCache: 'none' });
        const lang = (document.documentElement.lang || 'ru').toLowerCase();
        const copy = lang.startsWith('uk')
          ? { text: 'Доступна нова версія ANDRIK', button: 'Оновити', working: 'Оновлення…' }
          : lang.startsWith('sk')
            ? { text: 'Je dostupná nová verzia ANDRIK', button: 'Aktualizovať', working: 'Aktualizuje sa…' }
            : lang.startsWith('en')
              ? { text: 'A new version of ANDRIK is available', button: 'Update', working: 'Updating…' }
              : { text: 'Доступна новая версия ANDRIK', button: 'Обновить', working: 'Обновление…' };

        let refreshing = false;
        let updateRequested = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          const url = new URL(location.href);
          url.searchParams.set('_updated', Date.now().toString());
          location.replace(url.toString());
        });

        const activateWaitingWorker = async (worker, button) => {
          if (updateRequested) return;
          updateRequested = true;
          if (button) {
            button.disabled = true;
            button.textContent = copy.working;
          }

          // Ask the installed worker to activate immediately.
          const target = registration.waiting || worker;
          if (target) target.postMessage({ type: 'SKIP_WAITING' });

          // Re-check registration once, because on some Android WebViews
          // the waiting reference becomes available a moment after installation.
          try { await registration.update(); } catch (_) {}
          setTimeout(() => {
            const waiting = registration.waiting;
            if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
          }, 350);

          // Safety fallback: never leave the update button spinning forever.
          setTimeout(() => {
            if (refreshing) return;
            updateRequested = false;
            if (button) {
              button.disabled = false;
              button.textContent = copy.button;
            }
            registration.update().catch(() => {});
          }, 3500);
        };

        const showUpdate = worker => {
          if (!worker || document.querySelector('.andrik-update-toast')) return;
          const promptKey = `andrik-update-seen:${worker.scriptURL || 'site'}`;
          try {
            if (sessionStorage.getItem(promptKey) === '1') return;
            sessionStorage.setItem(promptKey, '1');
          } catch (_) {}
          const toast = document.createElement('div');
          toast.className = 'andrik-update-toast';
          toast.setAttribute('role', 'status');
          toast.innerHTML = `<span>${copy.text}</span><button type="button">${copy.button}</button>`;
          const button = toast.querySelector('button');
          button.addEventListener('click', () => activateWaitingWorker(worker, button));
          document.body.appendChild(toast);
          requestAnimationFrame(() => toast.classList.add('is-visible'));
        };

        if (registration.waiting && navigator.serviceWorker.controller) showUpdate(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
            // Wait a tick so registration.waiting is populated before showing the button.
            setTimeout(() => showUpdate(registration.waiting || worker), 100);
          });
        });

        registration.update().catch(() => {});
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      } catch (error) {
        console.warn(error);
      }
    });
  }

  // v51.19 — remember the exact point from which the full player was opened.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href*="/player.html"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin || url.pathname !== '/player.html') return;
      const source = link.closest('#video, #prosnis, #album-ocean, #album-illusion');
      if (source?.id) url.searchParams.set('return', source.id);
      const cleanCurrent = new URL(location.href);
      ['player-shell','returnScroll','_updated','v'].forEach(key => cleanCurrent.searchParams.delete(key));
      const currentPath = `${cleanCurrent.pathname}${cleanCurrent.search}`;
      const currentHash = source?.id ? `#${source.id}` : cleanCurrent.hash;
      const currentScroll = String(Math.max(0, Math.round(window.scrollY)));
      url.searchParams.set('scroll', currentScroll);
      url.searchParams.set('returnPath', currentPath);
      if (currentHash) url.searchParams.set('returnHash', currentHash);
      link.href = `${url.pathname}${url.search}${url.hash}`;
      sessionStorage.setItem('andrik-player-return-scroll', currentScroll);
      sessionStorage.setItem('andrik-player-return-path', currentPath);
      if (currentHash) sessionStorage.setItem('andrik-player-return-hash', currentHash);
      else sessionStorage.removeItem('andrik-player-return-hash');
      if (source?.id) sessionStorage.setItem('andrik-player-return-target', source.id);
      else sessionStorage.removeItem('andrik-player-return-target');
    } catch (error) {}
  }, true);

  // Restore only an explicit player return position. A stale session value must
  // never move a newly opened page to an old album section.
  const restoreScrollParam = new URLSearchParams(location.search).get('returnScroll');
  if (restoreScrollParam !== null && /^\d+$/.test(restoreScrollParam)) {
    const y = Number(restoreScrollParam);
    const restore = () => window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    requestAnimationFrame(restore);
    window.addEventListener('load', () => {
      restore();
      setTimeout(restore, 80);
      setTimeout(restore, 260);
    }, { once: true });
    const clean = new URL(location.href);
    clean.searchParams.delete('returnScroll');
    history.replaceState(history.state, '', `${clean.pathname}${clean.search}${clean.hash}`);
    try {
      sessionStorage.removeItem('andrik-player-return-scroll');
      sessionStorage.removeItem('andrik-player-return-target');
      sessionStorage.removeItem('andrik-player-return-path');
      sessionStorage.removeItem('andrik-player-return-hash');
    } catch (_) {}
  }



  const commentsForm = document.querySelector('[data-comments-form]');
  const commentsList = document.querySelector('[data-comments-list]');
  const commentsStatus = document.querySelector('[data-comments-status]');
  const commentsTurnstileWrap = document.querySelector('[data-turnstile-wrap]');
  const commentsSongSelect = document.querySelector('[data-comments-song]');
  const commentsFilterSong = document.querySelector('[data-comments-filter-song]');
  const commentsSearch = document.querySelector('[data-comments-search]');
  const commentsResultStatus = document.querySelector('[data-comments-result-status]');
  let commentsTurnstileWidgetId = null;
  let commentsTurnstileSiteKey = '';
  let commentsFormStartedAt = Date.now();
  let commentsSubjects = [];
  let commentsSearchTimer = null;

  const COMMENT_VISITOR_KEY = 'andrik-comment-visitor-v1';
  const createCommentVisitorId = () => {
    const secureCrypto = window.crypto;
    if (secureCrypto?.randomUUID) return secureCrypto.randomUUID();
    const bytes = new Uint8Array(24);
    secureCrypto?.getRandomValues?.(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };
  const getCommentVisitorId = () => {
    try {
      const stored = localStorage.getItem(COMMENT_VISITOR_KEY);
      if (stored) return stored;
      const created = createCommentVisitorId();
      localStorage.setItem(COMMENT_VISITOR_KEY, created);
      return created;
    } catch (_) {
      return createCommentVisitorId();
    }
  };
  const commentVisitorId = getCommentVisitorId();

  const COMMENT_COPY = {
    ru: {
      loading:'Загружаем отзывы…', empty:'По вашему запросу отзывов пока нет.',
      pending:'Спасибо! Отзыв отправлен на модерацию.', validation:'Введите имя и отзыв.',
      rate:'Слишком много отправок. Попробуйте немного позже.', turnstile:'Подтвердите, что вы не робот.',
      backend:'Публичные отзывы ещё не подключены в Cloudflare.', error:'Не удалось отправить отзыв. Попробуйте ещё раз.',
      loadError:'Не удалось загрузить публичные отзывы.', like:'Нравится', liked:'Понравилось', likeError:'Ошибка',
      pinned:'Выбор ANDRIK', authorBadge:'👁 ANDRIK Автор', report:'Пожаловаться', reported:'Жалоба отправлена',
      reportPrompt:'Коротко укажите причину жалобы. Поле можно оставить пустым.', reportError:'Не удалось отправить жалобу.', reportThanks:'Спасибо. Жалоба отправлена модератору.', authorName:'ANDRIK', authorRole:'Автор',
      project:'Проект ANDRIK', allSongs:'Все песни и разделы', results:'Найдено отзывов', song:'🎵',
      first:'🌱 Новичок', seeker:'⚡ Бывалый', metal:'🔥 Постоянный', regular:'🌊 Верный слушатель', elder:'🏔 Старейшина', top:'🏆 Топ-комментатор'
    },
    uk: {
      loading:'Завантажуємо відгуки…', empty:'За вашим запитом відгуків поки немає.',
      pending:'Дякуємо! Відгук надіслано на модерацію.', validation:'Введіть ім’я та відгук.',
      rate:'Забагато надсилань. Спробуйте трохи пізніше.', turnstile:'Підтвердьте, що ви не робот.',
      backend:'Публічні відгуки ще не підключені в Cloudflare.', error:'Не вдалося надіслати відгук. Спробуйте ще раз.',
      loadError:'Не вдалося завантажити публічні відгуки.', like:'Подобається', liked:'Сподобалось', likeError:'Помилка',
      pinned:'Вибір ANDRIK', authorBadge:'👁 ANDRIK Автор', report:'Поскаржитися', reported:'Скаргу надіслано',
      reportPrompt:'Коротко вкажіть причину скарги. Поле можна залишити порожнім.', reportError:'Не вдалося надіслати скаргу.', reportThanks:'Дякуємо. Скаргу надіслано модератору.', authorName:'ANDRIK', authorRole:'Автор',
      project:'Проєкт ANDRIK', allSongs:'Усі пісні та розділи', results:'Знайдено відгуків', song:'🎵',
      first:'🌱 Перший відгук', seeker:'👁 Шукач', metal:'🔥 Металіст', regular:'🌊 Постійний слухач', elder:'🏔 Старійшина спільноти', top:'🏆 Топ-коментатор'
    },
    sk: {
      loading:'Načítavajú sa reakcie…', empty:'Pre váš výber zatiaľ nie sú žiadne reakcie.',
      pending:'Ďakujeme! Reakcia bola odoslaná na moderovanie.', validation:'Zadajte meno a reakciu.',
      rate:'Príliš veľa odoslaní. Skúste to neskôr.', turnstile:'Potvrďte, že nie ste robot.',
      backend:'Verejné komentáre ešte nie sú pripojené v Cloudflare.', error:'Reakciu sa nepodarilo odoslať. Skúste to znova.',
      loadError:'Verejné reakcie sa nepodarilo načítať.', like:'Páči sa mi', liked:'Páči sa', likeError:'Chyba',
      pinned:'Výber ANDRIK', authorBadge:'👁 ANDRIK Автор', report:'Nahlásiť', reported:'Nahlásenie odoslané',
      reportPrompt:'Stručne uveďte dôvod. Pole môže zostať prázdne.', reportError:'Nahlásenie sa nepodarilo odoslať.', reportThanks:'Ďakujeme. Nahlásenie bolo odoslané moderátorovi.', authorName:'ANDRIK', authorRole:'Autor',
      project:'Projekt ANDRIK', allSongs:'Všetky skladby a sekcie', results:'Nájdené reakcie', song:'🎵',
      first:'🌱 Prvá reakcia', seeker:'👁 Hľadač', metal:'🔥 Metalista', regular:'🌊 Stály poslucháč', elder:'🏔 Starší komunity', top:'🏆 Top komentátor'
    },
    en: {
      loading:'Loading comments…', empty:'No comments match your selection yet.',
      pending:'Thank you! Your comment was sent for moderation.', validation:'Enter your name and comment.',
      rate:'Too many submissions. Please try again later.', turnstile:'Please confirm that you are not a robot.',
      backend:'Public comments are not connected in Cloudflare yet.', error:'The comment could not be submitted. Please try again.',
      loadError:'Public comments could not be loaded.', like:'Like', liked:'Liked', likeError:'Error',
      pinned:'ANDRIK choice', authorBadge:'👁 ANDRIK Автор', report:'Report', reported:'Report sent',
      reportPrompt:'Briefly describe the reason. You may leave this blank.', reportError:'The report could not be sent.', reportThanks:'Thank you. The report was sent to the moderator.', authorName:'ANDRIK', authorRole:'Author',
      project:'ANDRIK project', allSongs:'All songs and sections', results:'Comments found', song:'🎵',
      first:'🌱 Newcomer', seeker:'⚡ Regular', metal:'🔥 Steady listener', regular:'🌊 Loyal listener', elder:'🏔 Elder', top:'🏆 Top commenter'
    }
  };
  const commentLang = (document.documentElement.lang || 'ru').toLowerCase().split('-')[0];
  const commentCopy = COMMENT_COPY[commentLang] || COMMENT_COPY.ru;

  const escapeCommentHtml = value => String(value || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');

  const formatCommentDate = iso => {
    try {
      return new Intl.DateTimeFormat(document.documentElement.lang || 'ru', { day:'2-digit', month:'short', year:'numeric' }).format(new Date(iso));
    } catch (_) {
      return iso;
    }
  };

  const formatAuthorCount = count => {
    const value = Math.max(1, Number(count || 1));
    if (commentLang === 'en') return `${value} ${value === 1 ? 'comment' : 'comments'}`;
    if (commentLang === 'sk') return `${value} ${value === 1 ? 'reakcia' : 'reakcie'}`;
    if (commentLang === 'uk') return `${value} ${value === 1 ? 'відгук' : 'відгуки'}`;
    const mod10 = value % 10;
    const mod100 = value % 100;
    const word = mod10 === 1 && mod100 !== 11 ? 'отзыв' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'отзыва' : 'отзывов';
    return `${value} ${word}`;
  };

  const listenerBadges = item => {
    const count = Math.max(1, Number(item.authorCount || 1));
    const badges = [];
    if (count >= 10) badges.push({ text:commentCopy.elder, tier:'elder' });
    else if (count >= 5) badges.push({ text:commentCopy.regular, tier:'regular' });
    else if (count >= 3) badges.push({ text:commentCopy.metal, tier:'metal' });
    else if (count >= 2) badges.push({ text:commentCopy.seeker, tier:'seeker' });
    else badges.push({ text:commentCopy.first, tier:'first' });
    if (item.isTopCommenter) badges.push({ text:commentCopy.top, tier:'top' });
    return badges;
  };

  let commentsToastTimer = null;
  const showCommentsToast = (text, type = 'success') => {
    let toast = document.querySelector('[data-comments-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.dataset.commentsToast = '1';
      toast.className = 'comments-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    clearTimeout(commentsToastTimer);
    toast.textContent = text;
    toast.className = `comments-toast is-visible is-${type}`;
    commentsToastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3200);
  };

  const displaySubjectTitle = subject => {
    const slug = String(subject?.slug || '');
    const title = String(subject?.title || '');
    if (slug === 'project') return commentCopy.project;
    if (commentLang === 'en') return title.replace(/^Альбом /, 'Album ');
    if (commentLang === 'sk') return title.replace(/^Альбом /, 'Album ');
    if (commentLang === 'uk') return title.replace(/^Альбом /, 'Альбом ');
    return title;
  };

  const subjectGroupLabel = subject => {
    const group = String(subject?.group || 'other');
    const labels = {
      ru: {
        general:'Общие разделы', ocean:'Альбом OCEAN', illusion:'Альбом Illusion of Life',
        'official-audio':'Official Audio Collection', other:'Другие релизы'
      },
      en: {
        general:'General sections', ocean:'OCEAN album', illusion:'Illusion of Life album',
        'official-audio':'Official Audio Collection', other:'Other releases'
      },
      uk: {
        general:'Загальні розділи', ocean:'Альбом OCEAN', illusion:'Альбом Illusion of Life',
        'official-audio':'Official Audio Collection', other:'Інші релізи'
      },
      sk: {
        general:'Všeobecné sekcie', ocean:'Album OCEAN', illusion:'Album Illusion of Life',
        'official-audio':'Official Audio Collection', other:'Ďalšie vydania'
      }
    };
    return labels[commentLang]?.[group] || String(subject?.groupTitle || group);
  };

  const buildSubjectOptions = subjects => {
    const groups = [];
    const grouped = new Map();
    subjects.forEach(subject => {
      const key = String(subject?.group || 'other');
      if (!grouped.has(key)) {
        const item = { key, label:subjectGroupLabel(subject), subjects:[] };
        grouped.set(key, item);
        groups.push(item);
      }
      grouped.get(key).subjects.push(subject);
    });
    return groups.map(group => `<optgroup label="${escapeCommentHtml(group.label)}">${group.subjects
      .map(subject => `<option value="${escapeCommentHtml(subject.slug)}">${escapeCommentHtml(displaySubjectTitle(subject))}</option>`).join('')}</optgroup>`).join('');
  };

  const populateSubjectSelects = subjects => {
    if (!Array.isArray(subjects) || !subjects.length) return;
    commentsSubjects = subjects;
    const currentSong = new URL(location.href).searchParams.get('song') || '';
    const options = buildSubjectOptions(subjects);
    if (commentsSongSelect) {
      const selected = currentSong || commentsSongSelect.value || 'project';
      commentsSongSelect.innerHTML = options;
      commentsSongSelect.value = subjects.some(subject => subject.slug === selected) ? selected : 'project';
    }
    if (commentsFilterSong) {
      const selected = commentsFilterSong.value || currentSong;
      commentsFilterSong.innerHTML = `<option value="">${escapeCommentHtml(commentCopy.allSongs)}</option>` + options;
      commentsFilterSong.value = subjects.some(subject => subject.slug === selected) ? selected : '';
    }
  };

  const renderPublicComments = items => {
    if (!commentsList) return;
    if (commentsResultStatus) commentsResultStatus.textContent = `${commentCopy.results}: ${Array.isArray(items) ? items.length : 0}`;
    if (!Array.isArray(items) || !items.length) {
      commentsList.innerHTML = `<div class="comments-empty">${escapeCommentHtml(commentCopy.empty)}</div>`;
      return;
    }
    commentsList.innerHTML = items.map((item, index) => {
      const authorCount = formatAuthorCount(item.authorCount);
      const pinned = item.isPinned ? `<span class="comments-pinned-badge">📌 ${escapeCommentHtml(commentCopy.pinned)}</span>` : '';
      const songTitle = item.songTitle || commentCopy.project;
      const song = `<span class="comments-song-badge"><span aria-hidden="true">${commentCopy.song}</span><span>${escapeCommentHtml(songTitle)}</span></span>`;
      const badges = listenerBadges(item).map(badge => `<span class="comments-listener-badge is-${escapeCommentHtml(badge.tier)}">${escapeCommentHtml(badge.text)}</span>`).join('');
      const reply = item.ownerReply ? `
        <div class="comments-owner-reply">
          <div class="comments-owner-reply-head">
            <span class="comments-author-badge"><span class="comments-author-eye" aria-hidden="true">👁</span><strong>${escapeCommentHtml(commentCopy.authorName)}</strong><span class="comments-author-role">${escapeCommentHtml(commentCopy.authorRole)}</span></span>
            ${item.ownerReplyAt ? `<span>${escapeCommentHtml(formatCommentDate(item.ownerReplyAt))}</span>` : ''}
          </div>
          <p>${escapeCommentHtml(item.ownerReply)}</p>
        </div>` : '';
      return `
        <article class="comments-item comments-item-enter${item.isPinned ? ' is-pinned' : ''}" data-comment-id="${escapeCommentHtml(item.id)}" style="--comment-enter-delay:${Math.min(index * 46, 460)}ms">
          <div class="comments-item-head">
            <div class="comments-item-identity">
              <strong class="comments-item-name">${escapeCommentHtml(item.name)}</strong>
              <span class="comments-author-count">${escapeCommentHtml(authorCount)}</span>
            </div>
            <div class="comments-item-flags">${pinned}<span class="comments-item-date">${escapeCommentHtml(formatCommentDate(item.createdAt))}</span></div>
          </div>
          <div class="comments-community-badges">${song}${badges}</div>
          <p class="comments-item-text">${escapeCommentHtml(item.message)}</p>
          ${reply}
          <div class="comments-item-actions">
            <button class="comments-report-btn${item.reportedByViewer ? ' is-reported' : ''}" data-comment-report="" data-id="${escapeCommentHtml(item.id)}" ${item.reportedByViewer ? 'disabled' : ''} type="button">
              <span aria-hidden="true">🚩</span><span data-report-label="">${escapeCommentHtml(item.reportedByViewer ? commentCopy.reported : commentCopy.report)}</span>
            </button>
            <button class="comments-like-btn${item.likedByViewer ? ' is-liked' : ''}" data-comment-like="" data-id="${escapeCommentHtml(item.id)}" aria-pressed="${item.likedByViewer ? 'true' : 'false'}" aria-label="${escapeCommentHtml(item.likedByViewer ? commentCopy.liked : commentCopy.like)}" title="${escapeCommentHtml(item.likedByViewer ? commentCopy.liked : commentCopy.like)}" type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7.8 21H4.5A1.5 1.5 0 0 1 3 19.5v-8A1.5 1.5 0 0 1 4.5 10h3.3v11Zm2-11 3.1-6.1c.35-.68 1.08-1.08 1.84-1 .99.1 1.68 1.02 1.48 2l-.72 3.6H20a2 2 0 0 1 1.95 2.44l-1.7 7.4A3.4 3.4 0 0 1 16.94 21H9.8V10Z"></path></svg>
              <strong data-like-count="" ${Number(item.likeCount || 0) > 0 ? '' : 'hidden'}>${Number(item.likeCount || 0)}</strong>
            </button>
          </div>
        </article>`;
    }).join('');
  };

  const loadPublicComments = async () => {
    if (!commentsList) return;
    commentsList.innerHTML = `<div class="comments-empty">${escapeCommentHtml(commentCopy.loading)}</div>`;
    const params = new URLSearchParams({ limit:'100', viewer:commentVisitorId });
    const q = (commentsSearch?.value || '').trim();
    const song = commentsFilterSong?.value || new URL(location.href).searchParams.get('song') || '';
    if (q) params.set('q', q);
    if (song) params.set('song', song);
    try {
      const response = await fetch(`/api/comments?${params.toString()}`, { headers:{ accept:'application/json' }, cache:'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'load-failed');
      populateSubjectSelects(payload.subjects || []);
      renderPublicComments(payload.comments || []);
    } catch (error) {
      if (commentsResultStatus) commentsResultStatus.textContent = '';
      commentsList.innerHTML = `<div class="comments-empty">${escapeCommentHtml(error.message === 'backend-not-configured' ? commentCopy.backend : commentCopy.loadError)}</div>`;
    }
  };

  commentsList?.addEventListener('click', async event => {
    const likeButton = event.target.closest('[data-comment-like]');
    if (likeButton && !likeButton.disabled) {
      likeButton.disabled = true;
      const count = likeButton.querySelector('[data-like-count]');
      const oldAriaLabel = likeButton.getAttribute('aria-label') || commentCopy.like;
      try {
        const response = await fetch('/api/comments/like', {
          method:'POST',
          headers:{ 'content-type':'application/json', accept:'application/json' },
          body:JSON.stringify({ id:likeButton.dataset.id, viewerId:commentVisitorId })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'like-failed');
        likeButton.classList.toggle('is-liked', Boolean(payload.liked));
        likeButton.classList.add('is-pop');
        setTimeout(() => likeButton.classList.remove('is-pop'), 460);
        likeButton.setAttribute('aria-pressed', payload.liked ? 'true' : 'false');
        const nextLabel = payload.liked ? commentCopy.liked : commentCopy.like;
        likeButton.setAttribute('aria-label', nextLabel);
        likeButton.setAttribute('title', nextLabel);
        if (count) {
          const nextCount = Number(payload.likeCount || 0);
          count.textContent = String(nextCount);
          count.hidden = nextCount <= 0;
        }
      } catch (_) {
        likeButton.setAttribute('aria-label', oldAriaLabel);
        likeButton.setAttribute('title', oldAriaLabel);
        showCommentsToast(commentCopy.likeError, 'error');
      } finally {
        likeButton.disabled = false;
      }
      return;
    }

    const reportButton = event.target.closest('[data-comment-report]');
    if (!reportButton || reportButton.disabled) return;
    const reason = window.prompt(commentCopy.reportPrompt, '');
    if (reason === null) return;
    reportButton.disabled = true;
    const label = reportButton.querySelector('[data-report-label]');
    try {
      const response = await fetch('/api/comments/report', {
        method:'POST',
        headers:{ 'content-type':'application/json', accept:'application/json' },
        body:JSON.stringify({ id:reportButton.dataset.id, viewerId:commentVisitorId, reason })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'report-failed');
      reportButton.classList.add('is-reported');
      if (label) label.textContent = commentCopy.reported;
      showCommentsToast(commentCopy.reportThanks, 'success');
    } catch (_) {
      if (label) label.textContent = commentCopy.reportError;
      showCommentsToast(commentCopy.reportError, 'error');
      setTimeout(() => { if (label) label.textContent = commentCopy.report; reportButton.disabled = false; }, 1700);
    }
  });

  const loadTurnstileScript = () => new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const existing = document.querySelector('script[data-andrik-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once:true });
      existing.addEventListener('error', reject, { once:true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.andrikTurnstile = '1';
    script.addEventListener('load', () => resolve(window.turnstile), { once:true });
    script.addEventListener('error', reject, { once:true });
    document.head.appendChild(script);
  });

  const setupCommentsBackend = async () => {
    if (!commentsForm && !commentsList) return;
    try {
      const response = await fetch('/api/comments/config', { headers:{ accept:'application/json' }, cache:'no-store' });
      const config = await response.json().catch(() => ({}));
      populateSubjectSelects(config.subjects || []);
      commentsTurnstileSiteKey = String(config.turnstileSiteKey || '');
      if (!commentsForm || !commentsTurnstileSiteKey || !commentsTurnstileWrap) return;
      commentsTurnstileWrap.hidden = false;
      await loadTurnstileScript();
      if (!window.turnstile) return;
      commentsTurnstileWidgetId = window.turnstile.render('#commentsTurnstileWidget', {
        sitekey: commentsTurnstileSiteKey,
        theme: 'dark',
        size: 'flexible'
      });
    } catch (_) {}
  };

  const scheduleCommentsReload = () => {
    clearTimeout(commentsSearchTimer);
    commentsSearchTimer = setTimeout(loadPublicComments, 280);
  };
  commentsSearch?.addEventListener('input', scheduleCommentsReload);
  commentsFilterSong?.addEventListener('change', () => {
    const url = new URL(location.href);
    if (commentsFilterSong.value) url.searchParams.set('song', commentsFilterSong.value); else url.searchParams.delete('song');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    loadPublicComments();
  });

  if (commentsForm) {
    loadPublicComments();
    setupCommentsBackend();
    commentsFormStartedAt = Date.now();
    commentsForm.addEventListener('submit', async event => {
      event.preventDefault();
      const nameField = commentsForm.elements.namedItem('name');
      const messageField = commentsForm.elements.namedItem('message');
      const songField = commentsForm.elements.namedItem('song');
      const websiteField = commentsForm.elements.namedItem('website');
      const submitButton = commentsForm.querySelector('button[type="submit"]');
      const name = (nameField?.value || '').trim();
      const message = (messageField?.value || '').trim();
      if (!name || !message) {
        if (commentsStatus) commentsStatus.textContent = commentCopy.validation;
        return;
      }
      const turnstileToken = commentsTurnstileSiteKey && window.turnstile && commentsTurnstileWidgetId !== null
        ? window.turnstile.getResponse(commentsTurnstileWidgetId)
        : '';
      if (commentsTurnstileSiteKey && !turnstileToken) {
        if (commentsStatus) commentsStatus.textContent = commentCopy.turnstile;
        return;
      }
      if (submitButton) submitButton.disabled = true;
      if (commentsStatus) commentsStatus.textContent = '';
      try {
        const response = await fetch('/api/comments', {
          method:'POST',
          headers:{ 'content-type':'application/json', accept:'application/json' },
          body:JSON.stringify({
            name,
            message,
            song:(songField?.value || 'project'),
            website:(websiteField?.value || '').trim(),
            locale:commentLang,
            visitorId:commentVisitorId,
            turnstileToken,
            startedAt:commentsFormStartedAt
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'submit-failed');
        const selectedSong = songField?.value || 'project';
        commentsForm.reset();
        if (songField) songField.value = selectedSong;
        commentsFormStartedAt = Date.now();
        if (commentsStatus) commentsStatus.textContent = commentCopy.pending;
        if (commentsTurnstileSiteKey && window.turnstile && commentsTurnstileWidgetId !== null) window.turnstile.reset(commentsTurnstileWidgetId);
      } catch (error) {
        const messageText = error.message === 'rate-limit'
          ? commentCopy.rate
          : error.message === 'turnstile-required' || error.message === 'turnstile-failed'
            ? commentCopy.turnstile
            : error.message === 'backend-not-configured'
              ? commentCopy.backend
              : commentCopy.error;
        if (commentsStatus) commentsStatus.textContent = messageText;
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  } else if (commentsList) {
    loadPublicComments();
    setupCommentsBackend();
  }

})();
