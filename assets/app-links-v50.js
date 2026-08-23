(() => {
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const APP_LINK_SELECTOR = 'a[data-force-app][data-web-url]';
  const enc = value => encodeURIComponent(String(value || ''));

  function httpsIntent(url, packageName = '', fallback = '') {
    try {
      const u = new URL(url, window.location.href);
      const pkg = packageName ? `package=${packageName};` : '';
      const fb = fallback ? `S.browser_fallback_url=${enc(fallback)};` : '';
      return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;${pkg}${fb}end`;
    } catch (_) {
      return url;
    }
  }

  function youtubeIntent(webUrl) {
    // R586: force the Android YouTube package directly.
    // No Android chooser. If YouTube is absent, browser_fallback_url stays
    // in the browser instead of launching a second generic HTTPS intent.
    return httpsIntent(webUrl, 'com.google.android.youtube', webUrl);
  }

  function spotifyIntent(url) {
    const match = String(url || '').match(/open\.spotify\.com\/album\/([A-Za-z0-9]+)/i);
    if (!match) return httpsIntent(url, 'com.spotify.music', url);
    return `intent://album/${match[1]}#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=${enc(url)};end`;
  }

  function instagramIntent(url) {
    try {
      const u = new URL(url, window.location.href);
      const username = u.pathname.split('/').filter(Boolean)[0] || 'andrikmetal';
      return `intent://user?username=${enc(username)}#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=${enc(u.href)};end`;
    } catch (_) {
      return httpsIntent(url, 'com.instagram.android', url);
    }
  }

  function forcedIntent(kind, webUrl) {
    switch (kind) {
      case 'youtube':
        return youtubeIntent(webUrl);
      case 'ytmusic':
        return httpsIntent(webUrl, 'com.google.android.apps.youtube.music', webUrl);
      case 'spotify':
        return spotifyIntent(webUrl);
      case 'soundcloud':
        return httpsIntent(webUrl, 'com.soundcloud.android', webUrl);
      case 'instagram':
        return instagramIntent(webUrl);
      case 'tiktok':
        return httpsIntent(webUrl, 'com.zhiliaoapp.musically', webUrl);
      case 'pinterest':
        return httpsIntent(webUrl, 'com.pinterest', webUrl);
      case 'x':
        return httpsIntent(webUrl, 'com.twitter.android', webUrl);
      default:
        return httpsIntent(webUrl, '', webUrl);
    }
  }

  function normalizeLink(link) {
    const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
    if (!webUrl) return;

    // Keep a normal HTTPS href for copy/share/accessibility.
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

    // IMPORTANT: one navigation only.
    // The intent itself has browser_fallback_url. We intentionally do NOT
    // schedule a second window.location = https://... because that generic
    // URL is what caused Android to show "Chrome / YouTube" chooser.
    try {
      window.top.location.assign(intentUrl);
    } catch (_) {
      try {
        window.location.assign(intentUrl);
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