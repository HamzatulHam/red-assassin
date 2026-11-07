/* ============================================================
   СОХРАНЕНИЕ ПРОГРЕССА — кошелёк, покупки, экипировка, прокачка
   ------------------------------------------------------------
   Хранится в localStorage под ключом ra_save_v1.
   Если игра открыта в Telegram (Mini App) — то же самое
   дополнительно пишется в ОБЛАКО Telegram (CloudStorage),
   поэтому прогресс переживает даже смену устройства:
   где бы игрок ни открыл игру — сейв подтянется.

   Формат: { gold, best, skins:[id], skin, weapons:[id], weapon,
             up:{id:уровень}, ts: время последней записи }
   ============================================================ */

window.RA = window.RA || {};

RA.Save = (function () {
  const KEY = 'ra_save_v1';
  let data = null;

  // стартовый набор: первый костюм и первое оружие из config всегда бесплатны
  function defaults() {
    const up = {};
    RA.CONFIG.shop.upgrades.forEach(function (u) { up[u.id] = 0; });
    return {
      gold: 0,
      best: 0,
      skins: [RA.CONFIG.shop.skins[0].id],
      skin: RA.CONFIG.shop.skins[0].id,
      weapons: [RA.CONFIG.shop.weapons[0].id],
      weapon: RA.CONFIG.shop.weapons[0].id,
      up: up,
      ts: 0
    };
  }

  function load() {
    const def = defaults();
    const d = RA.lsGet(KEY, {}) || {};
    data = Object.assign(def, d);
    // защита от битых/старых сохранений
    if (typeof data.gold !== 'number' || data.gold < 0 || !isFinite(data.gold)) data.gold = 0;
    if (typeof data.best !== 'number' || data.best < 0 || !isFinite(data.best)) {
      data.best = RA.lsGet('ra_best_v1', 0) || 0;   // перенос старого рекорда
    }
    if (!Array.isArray(data.skins)) data.skins = def.skins;
    if (!Array.isArray(data.weapons)) data.weapons = def.weapons;
    if (!RA.CONFIG.shop.skins.some(function (s) { return s.id === data.skin; })) data.skin = def.skin;
    if (!RA.CONFIG.shop.weapons.some(function (w) { return w.id === data.weapon; })) data.weapon = def.weapon;
    if (!data.up || typeof data.up !== 'object') data.up = def.up;
    RA.CONFIG.shop.upgrades.forEach(function (u) {
      const v = data.up[u.id];
      if (typeof v !== 'number' || v < 0 || v > u.max) data.up[u.id] = 0;
    });
    if (typeof data.ts !== 'number') data.ts = 0;

    syncFromCloud();   // в Telegram: подтянуть сейв из облака, если он новее
    return data;
  }

  function save() {
    data.ts = Date.now();
    RA.lsSet(KEY, data);
    pushToCloud();
  }

  /* ---------- Telegram CloudStorage (работает только в Telegram) ---------- */

  function cloud() {
    try {
      return (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage)
        ? window.Telegram.WebApp.CloudStorage : null;
    } catch (e) { return null; }
  }

  // при запуске: если в облаке сейв новее локального — берём его
  function syncFromCloud() {
    const cs = cloud();
    if (!cs) return;
    try {
      cs.getItem(KEY, function (err, val) {
        if (err || !val || !data) return;
        try {
          const remote = JSON.parse(val);
          if (remote && (remote.ts || 0) > (data.ts || 0)) {
            for (const k in data) delete data[k];
            Object.assign(data, remote);
            RA.lsSet(KEY, data);
            if (RA.UI && RA.UI.setWallet) RA.UI.setWallet(data.gold);
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  // при каждом сохранении: зеркалим в облако
  function pushToCloud() {
    const cs = cloud();
    if (!cs) return;
    try { cs.setItem(KEY, JSON.stringify(data), function () {}); } catch (e) {}
  }

  return {
    // текущие данные (загружаются при первом обращении)
    get: function () { if (!data) load(); return data; },

    // записать изменения в браузер (+ в облако Telegram)
    save: function () { save(); },

    // сбросить весь прогресс (пригодится для отладки)
    wipe: function () { data = defaults(); RA.lsSet(KEY, data); pushToCloud(); return data; },

    ownsSkin: function (id) { return this.get().skins.indexOf(id) !== -1; },
    ownsWeapon: function (id) { return this.get().weapons.indexOf(id) !== -1; },

    // цена следующего уровня прокачки (или null, если максимум)
    upgradeCost: function (u) {
      const lvl = this.get().up[u.id] || 0;
      if (lvl >= u.max) return null;
      return Math.round(u.base * Math.pow(u.step, lvl));
    }
  };
})();
