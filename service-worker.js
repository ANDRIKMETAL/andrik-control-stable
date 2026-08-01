'use strict';

const VERSION = '55.00-r128';
const IS_CONTROL_HOST = self.location.hostname.toLowerCase() === 'control.andrikmetal.com';

async function deleteControlCaches(){
  if(!self.caches) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith('andrik-control-') || key.startsWith('andrik-site-')).map(key => caches.delete(key)));
}

if(IS_CONTROL_HOST){
  // Control ANDRIK recovery mode.
  // This exact /service-worker.js URL was used by older Control builds,
  // therefore it must remain a no-fetch worker on the control subdomain.
  self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', event => {
    event.waitUntil((async() => {
      await deleteControlCaches();
      await self.clients.claim();
    })());
  });

  self.addEventListener('message', event => {
    if(event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
    if(event.data?.type === 'CLEAR_ALL_CACHES') event.waitUntil(deleteControlCaches());
  });

  // Intentionally NO fetch listener on control.andrikmetal.com.
  // Every page and asset must come directly from Cloudflare Pages.
}else{
  const CACHE = `andrik-site-v${VERSION}-public`;
  const OFFLINE = '/offline.html';
  const PUBLIC_HOME = '/';
  const CORE = [
    '/', '/index.html', '/offline.html', '/open-youtube.html?v=54.66',
    '/manifest.webmanifest?v=55.00-r87', '/assets/v50.js?v=54.42', '/assets/v50-26.css?v=52.03',
    '/assets/pwa-install.css', '/assets/pwa-install.js', '/assets/push-v54-07.js?v=54.07',
    '/player.html?v=55.00-r128', '/assets/player-v54-27-r125.js?v=55.00-r128',
    '/assets/player-v54-27.css?v=54.27', '/assets/player-v54-53.css?v=54.54',
    '/assets/player-mini-clean-v55-00-r3u.css?v=55.00-r3u',
    '/assets/player-r86-album-carousel.css?v=55.00-r86',
    '/assets/player-r86-album-carousel.js?v=55.00-r86',
    '/assets/andrik-site-illusion-r87-192.png', '/assets/andrik-site-illusion-r87-512.png', '/favicon.ico'
  ];

  async function deleteOldPublicCaches(){
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('andrik-site-') && key !== CACHE).map(key => caches.delete(key)));
  }

  self.addEventListener('install', event => {
    event.waitUntil((async() => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(CORE.map(url => cache.add(new Request(url,{cache:'reload'}))));
      await self.skipWaiting();
    })());
  });

  self.addEventListener('activate', event => {
    event.waitUntil(deleteOldPublicCaches().then(() => self.clients.claim()));
  });

  self.addEventListener('message', event => {
    if(event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
    if(event.data?.type === 'CLEAR_ALL_CACHES') event.waitUntil(deleteOldPublicCaches());
  });

  self.addEventListener('fetch', event => {
    const request = event.request;
    if(request.method !== 'GET' || request.headers.has('range')) return;
    const url = new URL(request.url);
    if(url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/oauth/')) return;

    if(request.mode === 'navigate'){
      event.respondWith(fetch(request,{cache:'no-store'}).then(response => {
        if(response?.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,response.clone())));
        return response;
      }).catch(async() => {
        return (await caches.match(request,{ignoreSearch:true})) ||
               (await caches.match(PUBLIC_HOME,{ignoreSearch:true})) ||
               (await caches.match(OFFLINE));
      }));
      return;
    }

    const networkFirst = request.destination === 'script' || request.destination === 'style' || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.json');
    if(networkFirst){
      event.respondWith(fetch(request,{cache:'no-store'}).then(response => {
        if(response?.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,response.clone())));
        return response;
      }).catch(() => caches.match(request)));
      return;
    }

    event.respondWith(caches.match(request).then(cached => {
      const update = fetch(request,{cache:'no-cache'}).then(response => {
        if(response?.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(request,response.clone())));
        return response;
      }).catch(() => cached);
      if(cached){ event.waitUntil(update); return cached; }
      return update;
    }));
  });
}
