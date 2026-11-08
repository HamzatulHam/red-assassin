/* Service Worker: офлайн-кэш «Красного асасина».
   Стратегия «сеть прежде всего»: обновления подхватываются сразу,
   а без интернета игра работает из кэша. При выкладке новой версии
   поднимай номер в имени CACHE (ra-cache-v6 → v7 → …). */
const CACHE = 'ra-cache-v9';
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

// «сеть прежде всего»: онлайн — берём свежее и обновляем кэш, офлайн — из кэша
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      try {
        const copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      } catch (err) {}
      return resp;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('./');
      });
    })
  );
});
