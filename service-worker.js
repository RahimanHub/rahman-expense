// Rahman Expense v2.14 legacy service-worker cleanup.
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('rahman-expense-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({type:'window'});
    clients.forEach(c => c.navigate(c.url));
  })());
});
