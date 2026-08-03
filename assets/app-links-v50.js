(() => {
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const APP_LINK_SELECTOR = 'a[data-force-app][data-web-url]';

  const encodeFallback = url => encodeURIComponent(url);

  function httpsIntent(url, packageName = '') {
    try {
      const parsed = new URL(url, window.location.href);
      const pkg = packageName ? `package=${packageName};` : '';
      return `intent://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;${pkg}S.browser_fallback_url=${encodeFallback(parsed.href)};end`;
    } catch (_) {
      return url;
    }
  }

  function spotifyIntent(url) {
    const match = String(url || '').match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/i);
    if (!match) return httpsIntent(url, 'com.spotify.music');
    return `intent://album/${match[1]}#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=${encodeFallback(url)};end`;
  }

  function youtubeResolverIntent(webUrl, music = false) {
    try {
      const parsed = new URL(webUrl, window.location.href);
      const packageName = music
        ? 'com.google.android.apps.youtube.music'
        : 'com.google.android.youtube';
      // R212: address the official app package directly, so Android does not
      // show the extra resolver window. If the package is absent, Chrome uses
      // the original HTTPS address from browser_fallback_url.
      return `intent://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}#Intent;scheme=https;package=${packageName};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeFallback(parsed.href)};end`;
    } catch (_) {
      return webUrl;
    }
  }

  function instagramIntent(webUrl) {
    try {
      const parsed = new URL(webUrl, window.location.href);
      const username = parsed.pathname.split('/').filter(Boolean)[0] || 'andrikmetal';
      return `intent://user?username=${encodeURIComponent(username)}#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=${encodeFallback(parsed.href)};end`;
    } catch (_) {
      return httpsIntent(webUrl, 'com.instagram.android');
    }
  }

  function tiktokIntent(webUrl) {
    return httpsIntent(webUrl, 'com.zhiliaoapp.musically');
  }

  function forcedIntent(kind, webUrl) {
    switch (kind) {
      case 'youtube':
        return youtubeResolverIntent(webUrl, false);
      case 'ytmusic':
        return youtubeResolverIntent(webUrl, true);
      case 'spotify':
        return spotifyIntent(webUrl);
      case 'soundcloud':
        return httpsIntent(webUrl, 'com.soundcloud.android');
      case 'instagram':
        return instagramIntent(webUrl);
      case 'tiktok':
        return tiktokIntent(webUrl);
      case 'pinterest':
        return httpsIntent(webUrl, 'com.pinterest');
      case 'x':
        return httpsIntent(webUrl, 'com.twitter.android');
      default:
        return httpsIntent(webUrl);
    }
  }

  function normalizeLink(link) {
    const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
    if (!webUrl) return;

    // The real href always stays HTTPS. This prevents an intent:// URL from
    // loading inside the embedded site iframe and producing a blank page.
    link.setAttribute('href', webUrl);
    link.setAttribute('rel', 'noopener noreferrer external');

    if (isAndroid && link.hasAttribute('data-force-app')) {
      link.removeAttribute('target');
    } else {
      link.setAttribute('target', '_blank');
    }
  }

  function openAndroidApp(event, link) {
    if (!isAndroid) return;

    const kind = link.getAttribute('data-force-app');
    const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
    if (!kind || !webUrl) return;

    event.preventDefault();

    const intentUrl = forcedIntent(kind, webUrl);
    let completed = false;
    let fallbackTimer = 0;

    const cleanup = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };

    const finish = () => {
      if (completed) return;
      completed = true;
      cleanup();
    };

    const onVisibilityChange = () => {
      if (document.hidden) finish();
    };
    const onPageHide = () => finish();

    document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
    window.addEventListener('pagehide', onPageHide, { passive: true, once: true });

    // YouTube and YouTube Music deliberately use the Android resolver without
    // a timed browser fallback, so compatible official or modified apps can catch the link.
    if (kind !== 'youtube' && kind !== 'ytmusic') {
      fallbackTimer = window.setTimeout(() => {
        if (completed || document.hidden) return;
        finish();
        try {
          window.top.location.assign(webUrl);
        } catch (_) {
          window.location.assign(webUrl);
        }
      }, 1600);
    }

    try {
      // App links clicked inside the live-player iframe must launch from the
      // top browsing context. Navigating the iframe itself is what caused the
      // reported white YouTube pages.
      window.top.location.assign(intentUrl);
    } catch (_) {
      cleanup();
      try {
        window.top.location.assign(webUrl);
      } catch (__) {
        window.location.assign(webUrl);
      }
    }
  }

  function prepareAll(root = document) {
    root.querySelectorAll('a[data-web-url]').forEach(normalizeLink);
  }

  document.addEventListener('DOMContentLoaded', () => prepareAll());

  document.addEventListener('click', event => {
    const link = event.target.closest?.(APP_LINK_SELECTOR);
    if (!link) return;
    openAndroidApp(event, link);
  }, true);
})();
