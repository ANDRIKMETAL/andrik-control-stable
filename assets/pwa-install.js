(() => {
  const button = document.getElementById('pwaInstallButton');
  if (!button) return;

  const lang = (document.documentElement.lang || 'ru').toLowerCase();
  const copies = {
    en: {
      title: 'Install ANDRIK',
      ready: 'Install the official ANDRIK app on your home screen. It opens full-screen and keeps the website and player close at hand.',
      manual: 'Your browser has not opened the automatic installer. Add ANDRIK from the browser menu.',
      ios: 'On iPhone or iPad, add ANDRIK to the Home Screen through Safari.',
      installed: 'ANDRIK is already installed on this device. Open the music universe in one tap.',
      install: 'Install app', close: 'Close', player: 'Open app',
      stepMenu: 'Open the browser menu',
      stepInstall: 'Choose “Install app” or “Add to Home screen”',
      stepIosShare: 'Tap the Share button in Safari',
      stepIosHome: 'Choose “Add to Home Screen”',
      label: 'Install ANDRIK app', installedLabel: 'ANDRIK app installed'
    },
    uk: {
      title: 'Встановити ANDRIK',
      ready: 'Встановіть офіційний застосунок ANDRIK на головний екран. Він відкривається окремо від браузера та надає швидкий доступ до сайту й плеєра.',
      manual: 'Браузер не відкрив автоматичне встановлення. Додайте ANDRIK через меню браузера.',
      ios: 'На iPhone або iPad додайте ANDRIK на початковий екран через Safari.',
      installed: 'ANDRIK вже встановлено на цьому пристрої. Відкрийте музичний всесвіт одним дотиком.',
      install: 'Встановити застосунок', close: 'Закрити', player: 'Відкрити застосунок',
      stepMenu: 'Відкрийте меню браузера',
      stepInstall: 'Оберіть «Встановити застосунок» або «Додати на головний екран»',
      stepIosShare: 'Натисніть кнопку «Поділитися» в Safari',
      stepIosHome: 'Оберіть «На початковий екран»',
      label: 'Встановити застосунок ANDRIK', installedLabel: 'Застосунок ANDRIK встановлено'
    },
    sk: {
      title: 'Nainštalovať ANDRIK',
      ready: 'Nainštalujte si oficiálnu aplikáciu ANDRIK na domovskú obrazovku. Otvára sa samostatne od prehliadača a poskytuje rýchly prístup k webu aj prehrávaču.',
      manual: 'Prehliadač neotvoril automatickú inštaláciu. Pridajte ANDRIK cez ponuku prehliadača.',
      ios: 'Na iPhone alebo iPade pridajte ANDRIK na plochu cez Safari.',
      installed: 'ANDRIK je už v tomto zariadení nainštalovaný. Otvorte hudobný vesmír jediným dotykom.',
      install: 'Nainštalovať aplikáciu', close: 'Zavrieť', player: 'Otvoriť aplikáciu',
      stepMenu: 'Otvorte ponuku prehliadača',
      stepInstall: 'Vyberte „Nainštalovať aplikáciu“ alebo „Pridať na plochu“',
      stepIosShare: 'V Safari klepnite na tlačidlo Zdieľať',
      stepIosHome: 'Vyberte „Pridať na plochu“',
      label: 'Nainštalovať aplikáciu ANDRIK', installedLabel: 'Aplikácia ANDRIK je nainštalovaná'
    },
    ru: {
      title: 'Установить ANDRIK',
      ready: 'Установите официальное приложение ANDRIK на главный экран. Оно открывается отдельно от браузера и даёт быстрый доступ к сайту и плееру.',
      manual: 'Браузер пока не открыл автоматическую установку. Добавьте ANDRIK через меню браузера.',
      ios: 'На iPhone или iPad добавьте ANDRIK на экран «Домой» через Safari.',
      installed: 'ANDRIK уже установлен на этом устройстве. Откройте музыкальную вселенную одним касанием.',
      install: 'Установить приложение', close: 'Закрыть', player: 'Открыть приложение',
      stepMenu: 'Откройте меню браузера',
      stepInstall: 'Выберите «Установить приложение» или «Добавить на главный экран»',
      stepIosShare: 'Нажмите кнопку «Поделиться» в Safari',
      stepIosHome: 'Выберите «На экран Домой»',
      label: 'Установить приложение ANDRIK', installedLabel: 'Приложение ANDRIK установлено'
    }
  };
  const copy = copies[lang.startsWith('uk') ? 'uk' : lang.startsWith('sk') ? 'sk' : lang.startsWith('en') ? 'en' : 'ru'];

  let deferredPrompt = null;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const overlay = document.createElement('div');
  overlay.className = 'pwa-install-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'pwaInstallTitle');
  overlay.innerHTML = `
    <div class="pwa-install-card">
      <button class="pwa-install-close" type="button" aria-label="${copy.close}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg>
      </button>
      <div class="pwa-install-icon"><img src="/assets/andrik-eye-v22-192.png" width="58" height="58" alt=""></div>
      <h2 id="pwaInstallTitle">${copy.title}</h2>
      <p id="pwaInstallText"></p>
      <ol class="pwa-install-steps" id="pwaInstallSteps" hidden></ol>
      <div class="pwa-install-actions">
        <button class="pwa-install-primary" id="pwaInstallPrimary" type="button">${copy.install}</button>
        <a class="pwa-install-secondary" id="pwaInstallPlayer" href="/player" hidden>${copy.player}</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const closeButton = overlay.querySelector('.pwa-install-close');
  const text = overlay.querySelector('#pwaInstallText');
  const steps = overlay.querySelector('#pwaInstallSteps');
  const primary = overlay.querySelector('#pwaInstallPrimary');
  const playerLink = overlay.querySelector('#pwaInstallPlayer');
  let previousFocus = null;

  const setInstalledState = () => {
    button.classList.remove('install-ready');
    button.classList.add('is-installed');
    button.setAttribute('aria-label', copy.installedLabel);
    button.title = copy.installedLabel;
  };

  const openModal = mode => {
    previousFocus = document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    steps.innerHTML = '';
    steps.hidden = true;
    primary.hidden = false;
    playerLink.hidden = true;

    if (mode === 'installed') {
      text.textContent = copy.installed;
      primary.hidden = true;
      playerLink.hidden = false;
    } else if (mode === 'ios') {
      text.textContent = copy.ios;
      steps.innerHTML = `<li>${copy.stepIosShare}</li><li>${copy.stepIosHome}</li>`;
      steps.hidden = false;
      primary.textContent = copy.close;
    } else if (mode === 'manual') {
      text.textContent = copy.manual;
      steps.innerHTML = `<li>${copy.stepMenu}</li><li>${copy.stepInstall}</li>`;
      steps.hidden = false;
      primary.textContent = copy.close;
    } else {
      text.textContent = copy.ready;
      primary.textContent = copy.install;
    }
    closeButton.focus();
  };

  const closeModal = () => {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    previousFocus?.focus?.();
  };

  closeButton.addEventListener('click', closeModal);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
  addEventListener('keydown', event => { if (event.key === 'Escape' && overlay.classList.contains('is-open')) closeModal(); });

  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    button.classList.add('install-ready');
    button.setAttribute('aria-label', copy.label);
    button.title = copy.label;
  });

  addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setInstalledState();
    closeModal();
  });

  button.addEventListener('click', async () => {
    if (isStandalone()) {
      openModal('installed');
      return;
    }
    if (deferredPrompt) {
      openModal('ready');
      return;
    }
    openModal(isIos ? 'ios' : 'manual');
  });

  primary.addEventListener('click', async () => {
    if (!deferredPrompt) {
      closeModal();
      return;
    }
    closeModal();
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') button.classList.remove('install-ready');
    deferredPrompt = null;
  });

  if (isStandalone()) setInstalledState();
  else {
    button.hidden = false;
    button.setAttribute('aria-label', copy.label);
    button.title = copy.label;
  }
})();
