/* ============================================================
   КРАСНЫЙ АСАССИН — ФАЙЛ НАСТРОЕК
   ------------------------------------------------------------
   Здесь собраны ВСЕ основные параметры игры.
   Меняйте числа и тексты — обновите страницу (Ctrl+F5) и смотрите.
   Подробные рецепты — в README.md
   ============================================================ */

window.RA = window.RA || {};

RA.CONFIG = {

  // ---------- ОКНО ----------
  width: 960,             // ширина игрового поля, px
  height: 540,            // высота игрового поля, px
  groundY: 440,           // уровень земли (верх площадки), px сверху

  // ---------- ГЕРОЙ ----------
  player: {
    w: 34, h: 52,
    speedStart: 300,
    speedMax: 560,
    speedGain: 6,
    speedLevelBonus: 25,
    gravity: 2300,
    jumpV: 760,
    jump2V: 680,
    holdAssist: 0.75,     // удержание кнопки = прыжок выше: 1.0 = одинаково, 0.75 ≈ на треть выше
    climbSpeed: 250,
    dashSpeed: 720,       // рывок (Shift / C): скорость и длительность
    dashTime: 0.22,
    dashCd: 1.1,
    stompKill: true,
    stompBounce: 540,
    colors: {             // базовая палитра героя
      suit:  '#c62828',
      suit2: '#8e1b1b',
      belt:  '#1a1a1a',
      skin:  '#e8b98a',
      eye:   '#20242c',
      scarf: '#e53935'
    }
  },

  // ---------- БИОМЫ (окружение меняется с каждым уровнем) ----------
  // sky — 4 цвета неба сверху вниз; mtFar/mtNear — горы; gTop/gBody/gBot — платформы;
  // edge — подсветка кромки (rgb); particle — погода; decor — постройки на фоне
  biomes: [
    { id: 'sunset', name: 'Закат',   sky: ['#1a0c22', '#5c1f33', '#a63c3c', '#e8814f'],
      glow: '255,170,110', mtFar: '#6b2438', mtNear: '#4a1626',
      gTop: '#4e3025', gBody: '#3a221a', gBot: '#170c09', edge: '255,120,80',
      starA: 0.55, moonA: 1, particle: 'petals', decor: 'pagoda', lanterns: true, lightning: false },
    { id: 'night',  name: 'Ночь',    sky: ['#05070f', '#0d1428', '#1b2440', '#2c3654'],
      glow: '130,160,255', mtFar: '#1a2338', mtNear: '#0e1424',
      gTop: '#2a3244', gBody: '#161c2c', gBot: '#070a12', edge: '130,170,255',
      starA: 1, moonA: 1, particle: 'fireflies', decor: 'pine', lanterns: true, lightning: false },
    { id: 'rain',   name: 'Гроза',   sky: ['#0a0d12', '#1a222e', '#2a3442', '#3a4656'],
      glow: '160,190,220', mtFar: '#1e2836', mtNear: '#141c28',
      gTop: '#2c3644', gBody: '#1a222c', gBot: '#0a0e14', edge: '150,190,230',
      starA: 0.12, moonA: 0.3, particle: 'rain', decor: 'ruin', lanterns: false, lightning: true },
    { id: 'winter', name: 'Снег',    sky: ['#1c2430', '#2e3c4e', '#54627a', '#8fa0b8'],
      glow: '220,235,255', mtFar: '#5a6a84', mtNear: '#46566e',
      gTop: '#cdd9ea', gBody: '#8ea0b8', gBot: '#54657c', edge: '245,252,255',
      starA: 0.35, moonA: 0.8, particle: 'snow', decor: 'pine', lanterns: false, lightning: false },
    { id: 'dawn',   name: 'Рассвет', sky: ['#2a1a3a', '#6a3a5a', '#c96a6a', '#ffb56b'],
      glow: '255,215,150', mtFar: '#7a3a52', mtNear: '#54263e',
      gTop: '#5c3a2e', gBody: '#42281e', gBot: '#1c0f0a', edge: '255,185,120',
      starA: 0.18, moonA: 0.15, particle: 'petals', decor: 'bamboo', lanterns: false, lightning: false }
  ],
  biomeEveryLevels: 1,    // окружение меняется каждые N уровней (1 = каждый)

  // ---------- ВРАГИ ----------
  enemies: {
    archerChance: 0.10,   // лучник: стреляет стрелами
    heavyChance: 0.08,    // тяжёлый воин: 2 удара, топтом не берётся
    shadowChance: 0.07,   // ниндзя-тень: срывается в рывок
    growth: 0.35,         // прибавка шансов на максимальной сложности
    archerRange: 520,     // с какого расстояния лучник замечает
    archerCd: 1.8,        // перезарядка лучника
    shadowRange: 400,     // с какого расстояния тень идёт в рывок
    shadowSpeed: 640,     // скорость рывка тени
    heavyHp: 2            // сколько ударов держит тяжёлый
  },

  // ---------- КАМПАНИЯ ----------
  campaign: {
    levels: 12,                              // всего уровней
    length: function (i) { return 350 + i * 160; },   // длина уровня i (в метрах)
    reward: function (i) { return 40 + i * 18; },     // награда золотом
    biome: function (i) { return i % 5; },            // биом уровня i
    difficulty: function (i) { return Math.min(1, 0.15 + i * 0.09); }
  },

  // ---------- ГЕРОЙ: ПАРАМЕТРЫ ДУЭЛИ ----------
  duel: {
    hp: 3,                // жизни в раунде
    roundsToWin: 2,       // победить в 2 раундах
    speed: 340,           // скорость движения в дуэли
    kunaiCd: 0.9,         // перезарядка броска
    hitInvuln: 0.8        // мигание после попадания
  },

  // ---------- МИР (генерация уровня) ----------
  world: {
    gapMin: 90,
    gapMax: 200,
    gapChance: 0.26,
    towerChance: 0.20,
    wallChance: 0.16,
    gateChance: 0.12,
    coinChance: 0.55,
    gapCoinChance: 0.65,
    towerCoinChance: 0.6,
    guardChance: 0.14,
    guardChanceGrow: 0.30,
    towerGuardChance: 0.25,
    guardSpeed: 65,
    difficultyRamp: 9000
  },

  // ---------- ОЧКИ ----------
  score: {
    coinValue: 10,
    stompValue: 25,
    meterDiv: 50
  },
  levelEvery: 150,

  // ---------- ЗВУК ----------
  sound: true,            // звук и музыка (в игре: клавиша M)
  music: true,            // фоновая музыка (таико + мелодия)

  // ---------- РЕЙТИНГ НА СТРАНИЦЕ ----------
  rating: { avg: 4.4, votes: 16 },

  // ---------- МАГАЗИН ----------
  shop: {
    goldPerCoin: 1,

    // Костюмы: cloak = плащ с капюшоном закрывает всё тело (без ног)
    skins: [
      { id: 'classic', name: 'Классика',   price: 0,    suit: '#c62828', suit2: '#8e1b1b', scarf: '#e53935' },
      { id: 'shadow',  name: 'Тень',       price: 100,  suit: '#263238', suit2: '#11181b', scarf: '#455a64' },
      { id: 'snake',   name: 'Змей',       price: 200,  suit: '#2e7d32', suit2: '#1b5e20', scarf: '#66bb6a' },
      { id: 'thunder', name: 'Молния',     price: 350,  suit: '#f9a825', suit2: '#9c6d00', scarf: '#ffd54f' },
      { id: 'ice',     name: 'Лёд',        price: 350,  suit: '#4fc3f7', suit2: '#0277bd', scarf: '#b3e5fc' },
      { id: 'sakura',  name: 'Сакура',     price: 500,  suit: '#ec407a', suit2: '#ad1457', scarf: '#f8bbd0' },
      { id: 'reaper',  name: 'Жница',      price: 800,  cloak: true, suit: '#3a3a46', suit2: '#1e1e28', scarf: '#b71c1c', eye: '#ff5252' },
      { id: 'ghost',   name: 'Призрак',    price: 800,  cloak: true, suit: '#dfe8f2', suit2: '#9fb2c8', scarf: '#78909c', eye: '#4fc3f7' },
      { id: 'storm',   name: 'Гроза',      price: 600,  suit: '#212121', suit2: '#0d0d0d', scarf: '#ffd600', eye: '#ffd600' },
      { id: 'zorro',   name: 'Зорро',      price: 700,  suit: '#141414', suit2: '#000000', scarf: '#e8e8e8', eye: '#e53935' },
      { id: 'neon',    name: 'Неон',       price: 1400, suit: '#0d0d1a', suit2: '#000000', scarf: '#00e5ff', eye: '#00e5ff' },
      { id: 'lord',    name: 'Кровавый лорд', price: 1500, suit: '#4a0d0d', suit2: '#260404', scarf: '#8e0000', eye: '#ff1744' },
      { id: 'gold',    name: 'Золотой',    price: 1000, suit: '#ffd700', suit2: '#9c6d00', scarf: '#fff176' }
    ],

    // Оружие: dmg — сколько ударов держит тяжёлый враг; melee — рубит рядом;
    // gravity/lob — полёт по дуге; pierce — пробивает N врагов
    weapons: [
      { id: 'none',     name: 'Без оружия', price: 0,    desc: 'Только прыжки и ловкость', cooldown: 0,    dmg: 0 },
      { id: 'kunai',    name: 'Кунай',      price: 150,  desc: 'Бросок (X). Обезвреживает одного', cooldown: 1.1, speed: 760, dmg: 1 },
      { id: 'shuriken', name: 'Сюрикен',    price: 400,  desc: 'Быстрый бросок (X). Пробивает всех', cooldown: 0.45, speed: 950, pierce: 99, dmg: 1 },
      { id: 'dual',     name: 'Двойные куны', price: 2000, desc: 'Два кунайя веером (X)', cooldown: 1.1, speed: 820, dmg: 1 },
      { id: 'katana',   name: 'Катана',     price: 650,  desc: 'Взмах клинка (X). Рубит рядом даже тяжёлых', cooldown: 0.8, melee: true, dmg: 2 },
      { id: 'bow',      name: 'Лук',        price: 900,  desc: 'Дальнобойная стрела (X). Пробивает двоих', cooldown: 1.4, speed: 1100, pierce: 1, dmg: 2 },
      { id: 'bomb',     name: 'Бомба',      price: 1200, desc: 'Взрыв по площади (X). Сносит всех рядом', cooldown: 2.2, lob: true, dmg: 3 }
    ],

    upgrades: [
      { id: 'jump',   name: 'Прыгучесть', max: 5, base: 50,  step: 1.6, desc: 'Прыжок выше', effect: function (lvl) { return '+' + (lvl * 5) + '% к силе прыжка'; } },
      { id: 'shield', name: 'Щиты',       max: 3, base: 120, step: 2.0, desc: 'Спасают от врагов и стрел', effect: function (lvl) { return lvl + ' щит' + (lvl === 1 ? '' : 'а') + ' на забег'; } },
      { id: 'magnet', name: 'Магнит',     max: 5, base: 80,  step: 1.7, desc: 'Золото само летит к герою', effect: function (lvl) { return 'радиус ' + (45 + 30 * lvl) + ' px'; } },
      { id: 'wallet', name: 'Кошелёк',    max: 5, base: 60,  step: 1.6, desc: 'Доход с каждого мешочка', effect: function (lvl) { return '+' + (lvl * 10) + '% золота'; } }
    ]
  },

  // ---------- ЗВУК ----------
  sound: true,
  music: true,

  // ---------- РЕЙТИНГ ----------
  rating: { avg: 4.4, votes: 16 },

  // ---------- ДОСТИЖЕНИЯ ----------
  achievements: [
    { id: 'firstkill', name: 'Первая кровь',    desc: 'Обезвредь первого врага' },
    { id: 'run500',    name: 'Марафонец',       desc: 'Пробеги 500 м за забег' },
    { id: 'rich',      name: 'Богач',           desc: 'Собери 100 золота за забег' },
    { id: 'slayer10',  name: 'Гроза закона',    desc: 'Обезвредь 10 врагов за забег' },
    { id: 'boss1',     name: 'Убийца боссов',   desc: 'Победи стражника-босса' },
    { id: 'cam5',      name: 'Путешественник',  desc: 'Пройди 5 уровней кампании' },
    { id: 'wind',      name: 'Ветер',           desc: 'Сделай 5 рывков за забег' },
    { id: 'allbiomes', name: 'Всевидящий',      desc: 'Побывай во всех 5 биомах' }
  ],

  // ---------- ТЕКСТЫ ----------
  texts: {
    title:       'КРАСНЫЙ АСАССИН',
    subtitle:    'Беги не останавливаясь, лазай по стенам, собирай золото и не попадись закону!',
    startBtn:    '▶ БЕСКОНЕЧНЫЙ',
    campaignBtn: '🗺 КАМПАНИЯ',
    duelBtn:     '⚔ ДУЭЛЬ 1×1',
    restartBtn:  '↻ ЕЩЁ РАЗ',
    controls:    'ПРОБЕЛ — прыжок · X — оружие · P — пауза · M — звук',
    duelControls:'Игрок 1: A/D — бег, W — прыжок, S — бросок · Игрок 2: ←/→ — бег, ↑ — прыжок, ↓ — бросок',
    caughtTitle: 'ВАС ПОЙМАЛ ЗАКОН!',
    pitTitle:    'ВЫ УПАЛИ В ОВАГ!',
    arrowTitle:  'ПОРАЖЕНЫ СТРЕЛОЙ!',
    pauseTitle:  'ПАУЗА',
    pauseHint:   'Нажмите P, чтобы продолжить',
    levelWord:   'Уровень',
    newRecord:   '🎉 Новый рекорд!',
    fullscreen:  '⛶ Играть на весь экран',
    fullscreenOff: '☒ Свернуть',
    winTitle:    'УРОВЕНЬ ПРОЙДЕН!',
    reward:      'Награда',
    nextBtn:     'ДАЛЬШЕ →',
    mapBtn:      '🗺 К КАРТЕ',
    toMenuBtn:   'В МЕНЮ',
    mapTitle:    '🗺 КАРТА КАМПАНИИ',
    locked:      '🔒',
    doneMark:    '✓',
    duelP1:      'ИГРОК 1',
    duelP2:      'ИГРОК 2',
    duelWin:     'ПОБЕДИЛ',
    roundWord:   'Раунд',
    labels: { score: 'Очки', coins: 'Золото', dist: 'Дистанция', best: 'Рекорд' },

    shop: {
      title:      '🛒 МАГАЗИН',
      tabSkins:   'Костюмы',
      tabWeapons: 'Оружие',
      tabUpg:     'Прокачка',
      buy:        'Купить',
      equip:      'Надеть',
      equipped:   '✓ Надето',
      owned:      'Куплено',
      upgrade:    'Улучшить',
      maxed:      'МАКС',
      notEnough:  'Мало золота! Собирай мешочки в забегах',
      toWallet:   'В кошелёк',
      reload:     'перезарядка'
    }
  }
};

/* ---------- Служебные функции ---------- */

RA.rand = function (a, b) { return a + Math.random() * (b - a); };
RA.chance = function (p) { return Math.random() < p; };
RA.hash = function (n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
RA.rr = function (ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
RA.lsGet = function (key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : JSON.parse(v);
  } catch (e) { return def; }
};
RA.lsSet = function (key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
};

// смешивание цветов для плавной смены биома (принимает '#rrggbb' и 'r,g,b')
RA.mixColor = function (a, b, t) {
  function parse(c) {
    if (c.charAt(0) === '#') {
      return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
    }
    const p = c.split(',');
    return [parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10)];
  }
  const pa = parse(a), pb = parse(b);
  return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * t) + ',' +
                  Math.round(pa[1] + (pb[1] - pa[1]) * t) + ',' +
                  Math.round(pa[2] + (pb[2] - pa[2]) * t) + ')';
};
