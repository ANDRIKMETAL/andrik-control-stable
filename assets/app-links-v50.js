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
    link.setAttribute('href', webUrl);
    link.setAttribute('rel', 'noopener noreferrer external');
    if (isAndroid && link.hasAttribute('data-force-app')) link.removeAttribute('target');
    else link.setAttribute('target', '_blank');
  }

  function openYoutubeGreenTuber(event, link, webUrl) {
    event.preventDefault();

    // Direct user click -> current GreenTuber package first.
    // If the app is absent and the page stays visible, try the older GreenTuber package.
    // Only after both attempts do we open the YouTube website.
    const primary = httpsIntent(webUrl, 'by.green.tuber', '');
    const legacy = httpsIntent(webUrl, 'tr.green.tuber', '');

    let leftPage = false;
    const markLeft = () => { if (document.hidden) leftPage = true; };
    document.addEventListener('visibilitychange', markLeft, {passive:true});

    try { window.top.location.assign(primary); }
    catch (_) { try { window.location.assign(primary); } catch (__) {} }

    window.setTimeout(() => {
      if (leftPage || document.hidden) return;
      try { window.top.location.assign(legacy); }
      catch (_) { try { window.location.assign(legacy); } catch (__) {} }
    }, 650);

    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', markLeft);
      if (leftPage || document.hidden) return;
      try { window.top.location.assign(webUrl); }
      catch (_) { window.location.assign(webUrl); }
    }, 1500);
  }

  function openAndroidApp(event, link) {
    if (!isAndroid) return;
    const kind = link.getAttribute('data-force-app');
    const webUrl = link.getAttribute('data-web-url') || link.getAttribute('href');
    if (!kind || !webUrl) return;

    if (kind === 'youtube') {
      openYoutubeGreenTuber(event, link, webUrl);
      return;
    }

    event.preventDefault();
    const intentUrl = forcedIntent(kind, webUrl);
    try { window.top.location.assign(intentUrl); }
    catch (_) { try { window.location.assign(intentUrl); } catch (__) { window.location.assign(webUrl); } }
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