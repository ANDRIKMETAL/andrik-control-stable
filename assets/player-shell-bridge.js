(() => {
  const isPlayerUrl = url => url.origin === location.origin && url.pathname === '/player.html';
  const RESUME_STATE_KEY = 'andrik-player-resume-v1';

  const languageCode = () => {
    const lang = (document.documentElement.lang || 'ru').toLowerCase();
    return ['uk','sk','en'].includes(lang) ? lang : 'ru';
  };

  const readResumeState = () => {
    try {
      const value = JSON.parse(localStorage.getItem(RESUME_STATE_KEY) || 'null');
      if (!value || !value.collection || !value.hasMedia) return null;
      return value;
    } catch (error) { return null; }
  };

  const setupStandaloneResumeButton = () => {
    const state = readResumeState();
    if (!state) return;
    const button = document.createElement('button');
    button.id = 'andrik-standalone-resume-player';
    button.type = 'button';
    button.setAttribute('aria-label', languageCode() === 'en' ? 'Resume paused player' : 'Вернуть плеер с паузы');
    button.title = button.getAttribute('aria-label');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8L18.5 12 8 5.6Z"/></svg>';
    const style = document.createElement('style');
    style.textContent = `
      #andrik-standalone-resume-player{position:fixed;z-index:9999;right:10px;bottom:max(10px,env(safe-area-inset-bottom));width:50px;height:50px;border:1px solid rgba(150,220,255,.58);border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,rgba(10,24,35,.97),rgba(3,9,14,.99));color:#e7f8ff;box-shadow:0 16px 42px rgba(0,0,0,.55),0 0 25px rgba(82,186,239,.24);cursor:pointer;transition:transform .2s ease,border-color .2s ease}
      #andrik-standalone-resume-player:active{transform:scale(.94)}
      #andrik-standalone-resume-player svg{width:21px;height:21px;fill:currentColor;margin-left:2px}
    `;
    document.head.appendChild(style);
    document.body.appendChild(button);
    button.addEventListener('click', () => {
      const cleanCurrent = new URL(location.href);
      ['player-shell','returnScroll','_updated','v'].forEach(key => cleanCurrent.searchParams.delete(key));
      const params = new URLSearchParams({
        lang: languageCode(),
        collection: state.collection,
        resume: '1',
        scroll: String(Math.max(0, Math.round(window.scrollY || 0))),
        returnPath: `${cleanCurrent.pathname}${cleanCurrent.search}`
      });
      if (cleanCurrent.hash) params.set('returnHash', cleanCurrent.hash);
      location.href = `/player.html?${params.toString()}`;
    });
  };

  // On a freshly opened normal page, keep a paused round resume button when
  // a previous listening position exists. The full live shell is created only
  // after the user taps it, which respects mobile autoplay restrictions.
  if (window.self === window.top) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupStandaloneResumeButton, { once:true });
    else setupStandaloneResumeButton();
    return;
  }

  document.documentElement.classList.add('inside-andrik-player-shell');

  // Android WebView can report a newly loaded iframe as non-intersecting for
  // several frames. The normal reveal observer then keeps whole chapter cards
  // dimmed and can make Comments/Trika look as if they are blinking. Inside the
  // live player shell the page is already intentionally visible, so reveal it
  // immediately and disable the entrance transition.
  const revealShellContent = () => {
    document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));
    document.querySelectorAll('.release-card,.platform-card,.album-card,.stats-grid,.prosnis-compact,.philosophy-panel,.platform-mini-card,.trika-card,.trika-path,.trika-sources,.trika-final,.comments-panel').forEach(element => element.classList.add('glass-active'));
  };
  const shellVisibilityStyle = document.createElement('style');
  shellVisibilityStyle.id = 'andrik-shell-visibility-v5165';
  shellVisibilityStyle.textContent = `
    html.inside-andrik-player-shell .reveal{opacity:1!important;transform:none!important;transition:none!important}
    html.inside-andrik-player-shell body{visibility:visible!important;opacity:1!important}
  `;
  document.head.appendChild(shellVisibilityStyle);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealShellContent, { once:true });
  else revealShellContent();

  const setSafeBottomSpace = visible => {
    let style = document.getElementById('andrik-player-shell-safe-space');
    if (!style) {
      style = document.createElement('style');
      style.id = 'andrik-player-shell-safe-space';
      document.head.appendChild(style);
    }
    document.documentElement.classList.toggle('andrik-mini-player-visible', Boolean(visible));
    style.textContent = visible ? `
      html.inside-andrik-player-shell body{padding-bottom:146px!important}
      @media(max-width:760px){html.inside-andrik-player-shell body{padding-bottom:112px!important}}
    ` : `
      html.inside-andrik-player-shell body{padding-bottom:0!important}
    `;
  };

  const ensureRestoreButton = () => {
    let button = document.getElementById('andrik-restore-mini-player');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'andrik-restore-mini-player';
    button.type = 'button';
    const label = document.documentElement.lang === 'en' ? 'Restore mini player' : 'Вернуть мини-плеер';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8L18.5 12 8 5.6Z"/></svg>';
    button.dataset.playing = 'false';
    const style = document.createElement('style');
    style.id = 'andrik-restore-mini-player-style';
    style.textContent = `
      #andrik-restore-mini-player{position:fixed;z-index:9999;right:14px;bottom:max(14px,env(safe-area-inset-bottom));width:52px;height:52px;border:1px solid rgba(150,220,255,.48);border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,rgba(10,24,35,.96),rgba(3,9,14,.98));color:#e7f8ff;box-shadow:0 16px 42px rgba(0,0,0,.5),0 0 24px rgba(82,186,239,.22);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(12px) scale(.92);transition:opacity .24s ease,visibility .24s ease,transform .24s ease,border-color .2s ease;cursor:pointer}
      #andrik-restore-mini-player.is-visible{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
      #andrik-restore-mini-player:hover{border-color:rgba(190,236,255,.86);transform:translateY(-2px) scale(1.02)}
      #andrik-restore-mini-player svg{width:22px;height:22px;fill:currentColor}
      #andrik-restore-mini-player[data-playing="false"] svg{margin-left:2px}
      #andrik-restore-mini-player[data-playing="true"] svg{margin-left:0}
      @media(max-width:760px){#andrik-restore-mini-player{right:10px;bottom:max(10px,env(safe-area-inset-bottom));width:48px;height:48px}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(button);
    button.addEventListener('click', () => window.parent.postMessage({ type: 'andrik-restore-mini-player' }, location.origin));
    return button;
  };

  const setRestoreButtonVisible = visible => ensureRestoreButton().classList.toggle('is-visible', Boolean(visible));

  const setRestoreButtonPlaybackState = isPlaying => {
    const button = ensureRestoreButton();
    const playing = Boolean(isPlaying);
    button.dataset.playing = playing ? 'true' : 'false';
    button.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6Zm8 0h4v14h-4Z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8L18.5 12 8 5.6Z"/></svg>';
    const lang = document.documentElement.lang;
    const label = playing
      ? (lang === 'en' ? 'Music is playing — restore mini player' : 'Музыка играет — вернуть мини-плеер')
      : (lang === 'en' ? 'Music is paused — restore mini player' : 'Музыка на паузе — вернуть мини-плеер');
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  const currentReturnContext = anchor => {
    const cleanCurrent = new URL(location.href);
    ['player-shell','returnScroll','_updated','v'].forEach(key => cleanCurrent.searchParams.delete(key));
    const source = anchor?.closest?.('#video, #prosnis, #album-ocean, #album-illusion');
    const target = source?.id || null;
    return {
      returnPath: `${cleanCurrent.pathname}${cleanCurrent.search}`,
      returnHash: target ? `#${target}` : cleanCurrent.hash,
      returnTarget: target,
      returnScroll: Math.max(0, Math.round(window.scrollY || 0))
    };
  };

  const notifyParent = (collection, anchor = null) => {
    window.parent.postMessage({
      type: 'andrik-open-player',
      collection: collection || null,
      ...currentReturnContext(anchor)
    }, location.origin);
  };

  let internalNavigationLocked = false;
  let internalNavigationRequest = '';

  document.addEventListener('click', event => {
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    let url;
    try { url = new URL(anchor.href, location.href); }
    catch (error) { return; }

    // Player links expand the already-live parent player.
    if (isPlayerUrl(url)) {
      event.preventDefault();
      notifyParent(url.searchParams.get('collection'), anchor);
      return;
    }

    // Keep every internal ANDRIK page inside the shell iframe. This preserves
    // the same live YouTube player while navigating between Home, Trika and
    // language versions, even when the original link has target="_blank".
    if (url.origin === location.origin) {
      if (internalNavigationLocked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const current = new URL(location.href);
      const sameDocument = url.pathname === current.pathname && url.search === current.search;
      if (sameDocument && url.hash) return;
      event.preventDefault();
      internalNavigationLocked = true;
      window.setTimeout(() => { internalNavigationLocked = false; }, 900);
      const isTrikaTarget = /\/trika\.html$/.test(url.pathname);
      if (isTrikaTarget) {
        try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (_) {}
        url.hash = 'page-top';
      }
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      internalNavigationRequest = requestId;
      window.parent.postMessage({
        type: 'andrik-site-navigate',
        requestId,
        path: `${url.pathname}${url.search}`,
        hash: url.hash || '',
        forceTop: isTrikaTarget
      }, location.origin);
      // Parent shell owns iframe navigation. A second location.assign here caused
      // duplicate loads, flicker and dead taps on Trika/Comments.
      return;
    }
  }, { capture: true });

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || !event.data) return;
    if (event.data.type === 'andrik-mini-player-visibility') {
      const visible = Boolean(event.data.visible);
      setSafeBottomSpace(visible);
      setRestoreButtonVisible(Boolean(event.data.dismissed));
      setRestoreButtonPlaybackState(Boolean(event.data.playing));
    }
  });

  const reportVisualReady = async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    window.parent.postMessage({ type: 'andrik-site-ready' }, location.origin);
  };

  setSafeBottomSpace(true);
  setRestoreButtonVisible(false);
  setRestoreButtonPlaybackState(false);
  if (document.readyState === 'complete') reportVisualReady();
  else window.addEventListener('load', reportVisualReady, { once: true });
})();
