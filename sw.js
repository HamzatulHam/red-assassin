/* Service Worker: РѕС„Р»Р°Р№РЅ-РєСЌС€ В«РљСЂР°СЃРЅРѕРіРѕ Р°СЃР°СЃРёРЅР°В».
   РЎС‚СЂР°С‚РµРіРёСЏ В«СЃРµС‚СЊ РїСЂРµР¶РґРµ РІСЃРµРіРѕВ»: РѕР±РЅРѕРІР»РµРЅРёСЏ РїРѕРґС…РІР°С‚С‹РІР°СЋС‚СЃСЏ СЃСЂР°Р·Сѓ,
   Р° Р±РµР· РёРЅС‚РµСЂРЅРµС‚Р° РёРіСЂР° СЂР°Р±РѕС‚Р°РµС‚ РёР· РєСЌС€Р°. РџСЂРё РІС‹РєР»Р°РґРєРµ РЅРѕРІРѕР№ РІРµСЂСЃРёРё
   РїРѕРґРЅРёРјР°Р№ РЅРѕРјРµСЂ РІ РёРјРµРЅРё CACHE (ra-cache-v2 в†’ v3 в†’ вЂ¦). */
const CACHE = 'ra-cache-v6';
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
        return c.add(a).catch(function () {});   // РЅРµРґРѕСЃС‚СѓРїРЅС‹Р№ С„Р°Р№Р» РЅРµ Р»РѕРјР°РµС‚ СѓСЃС‚Р°РЅРѕРІРєСѓ
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

// В«СЃРµС‚СЊ РїСЂРµР¶РґРµ РІСЃРµРіРѕВ»: РѕРЅР»Р°Р№РЅ вЂ” Р±РµСЂС‘Рј СЃРІРµР¶РµРµ Рё РѕР±РЅРѕРІР»СЏРµРј РєСЌС€, РѕС„Р»Р°Р№РЅ вЂ” РёР· РєСЌС€Р°
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
