'use strict';
const VERSION = '55.00-r301';
async function clearControlCaches(){
  if(!self.caches) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter(name => name.startsWith('andrik-control-') || name.startsWith('andrik-site-')).map(name => caches.delete(name)));
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async()=>{await clearControlCaches();await self.clients.claim();})()));
self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if(event.data?.type === 'CLEAR_ALL_CACHES') event.waitUntil(clearControlCaches());
});
// Intentionally no fetch listener.
