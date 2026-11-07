/* Service Worker: офлайн-кэш «Красного асасина».
   После первого открытия игра работает без интернета (PWA). */
const CACHE = 'ra-cache-v1';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/save.js',
  'js/world.js',
  'js/entities.js',
  'js/player.js',
  'js/game.js',
  'js/ui.js',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest',
  'red-assassin.zip'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (a) {
        return c.add(a).catch(function () {});   // недоступный файл не ломает установку
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// «сначала кэш, потом сеть»: офлайн — играем, онлайн — обновляем кэш в фоне
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (resp) {
        try {
          const copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        } catch (err) {}
        return resp;
      }).catch(function () {
        return e.request.mode === 'navigate' ? caches.match('./') : Response.error();
      });
    })
  );
});
