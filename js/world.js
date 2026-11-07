/* ============================================================
   МИР — генерация бесконечного уровня из «узоров»
   ------------------------------------------------------------
   Уровень строится кусками (паттернами) впереди камеры:
   ровная земля, овраг, башня, стена, ворота.
   Шансы паттернов и «злость» уровня настраиваются в config.js.

   КАК ДОБАВИТЬ СВОЁ ПРЕПЯТСТВИЕ:
   1) Напишите функцию-строитель по образцу patWall() ниже
      (не забудьте сдвинуть S.genX на ширину вашего куска!).
   2) Добавьте шанс в config.world (например trapChance: 0.1).
   3) Добавьте ветку в addPattern(): if (r < сумма) return patTrap(...)
   4) Если нужно особое рисование — добавьте вид в World.draw().
   ============================================================ */

window.RA = window.RA || {};

RA.World = (function () {

  // S — состояние мира (доступно извне как RA.World.state)
  const S = {
    solids: [],   // всё твёрдое: земля, башни, стены, балки ворот
    gates: [],    // ворота целиком (для рисования)
    coins: [],    // мешочки с золотом
    guards: [],   // охранники («закон»)
    genX: 0       // координата, до которой уровень уже сгенерирован
  };

  /* ---------- строители ---------- */

  // ровная земля: плита от y до низа экрана
  function ground(x, w, y) {
    S.solids.push({ kind: 'ground', x: x, y: y, w: w, h: RA.CONFIG.height - y + 80 });
  }

  // башня — приподнятая платформа
  function tower(x, w, y) {
    S.solids.push({ kind: 'tower', x: x, y: y, w: w, h: RA.CONFIG.height - y + 80 });
  }

  // узкая стена стоит на земле (по ней герой лазает)
  function wallAt(x, yTop, h) {
    S.solids.push({ kind: 'wall', x: x, y: yTop, w: 26, h: h });
  }

  // ворота: балка — твёрдая (на неё можно запрыгнуть), столбы — декорация
  function gateAt(x, yBase) {
    const beamY = yBase - 130, beamW = 110;
    S.solids.push({ kind: 'beam', x: x, y: beamY, w: beamW, h: 16 });
    S.gates.push({ x: x, y: beamY, w: beamW, base: yBase });
  }

  function coin(x, y) { S.coins.push({ x: x, y: y, taken: false, ph: Math.random() * 6 }); }

  function guard(x, y, range) {
    S.guards.push({ x: x, y: y, w: 36, h: 56, x0: x, range: range, dir: 1, dead: 0, ph: Math.random() * 6 });
  }

  /* ---------- паттерны уровня ---------- */

  // ровный участок: возможно золото и охранник
  function patFlat(G, diff) {
    const C = RA.CONFIG.world;
    const w = RA.rand(260, 470);
    ground(S.genX, w, G);
    if (RA.chance(C.coinChance)) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) coin(S.genX + w * 0.3 + i * 40, G - 64);
    }
    if (RA.chance(C.guardChance + C.guardChanceGrow * diff)) {
      guard(S.genX + w * 0.6, G, Math.min(110, w * 0.25));
    }
    S.genX += w;
  }

  // овраг + земля после него; иногда дуга золота над пропастью
  function patGap(speed, G, diff) {
    const C = RA.CONFIG.world;
    const gapW = Math.round(RA.rand(C.gapMin, Math.min(C.gapMax, 60 + speed * 0.5)));
    const gx0 = S.genX;
    S.genX += gapW;                       // сама яма
    const w = RA.rand(300, 500);
    ground(S.genX, w, G);
    if (RA.chance(C.gapCoinChance)) {
      coin(gx0 + gapW * 0.30, G - 95);
      coin(gx0 + gapW * 0.55, G - 130);
      coin(gx0 + gapW * 0.80, G - 95);
    }
    if (RA.chance(C.guardChance + C.guardChanceGrow * diff)) {
      guard(S.genX + w * 0.55, G, Math.min(120, w * 0.3));
    }
    S.genX += w;
  }

  // башня: забраться наверх прыжком, там золото или охранник
  function patTower(G, diff) {
    const C = RA.CONFIG.world;
    const pre = RA.rand(170, 260);
    ground(S.genX, pre, G); S.genX += pre;

    const tw = RA.rand(130, 230);
    const top = G - RA.rand(85, 150);
    tower(S.genX, tw, top);
    if (RA.chance(C.towerCoinChance)) {
      coin(S.genX + tw * 0.35, top - 34);
      coin(S.genX + tw * 0.65, top - 34);
    }
    if (RA.chance(C.towerGuardChance * (0.5 + diff))) {
      guard(S.genX + tw * 0.5, top, Math.min(70, tw * 0.4));
    }
    S.genX += tw;

    const post = RA.rand(210, 330);
    ground(S.genX, post, G);
    if (RA.chance(C.guardChance + C.guardChanceGrow * diff)) {
      guard(S.genX + post * 0.5, G, post * 0.3);
    }
    S.genX += post;
  }

  // стена: герой по ней залезает; сверху золото; за стеной может ждать стражник
  function patWall(G, diff) {
    const C = RA.CONFIG.world;
    const pre = RA.rand(160, 250);
    ground(S.genX, pre, G); S.genX += pre;

    const wh = RA.rand(95, 170);
    wallAt(S.genX, G - wh, wh);
    coin(S.genX + 13, G - wh - 42);
    S.genX += 26;

    const post = RA.rand(220, 320);
    ground(S.genX, post, G);
    if (RA.chance(C.guardChance * 1.4 + C.guardChanceGrow * diff)) {
      guard(S.genX + post * 0.55, G, post * 0.3);
    }
    S.genX += post;
  }

  // ворота: можно пробежать внизу или запрыгнуть на балку
  function patGate(G) {
    const pre = RA.rand(150, 230);
    ground(S.genX, pre, G); S.genX += pre;

    gateAt(S.genX, G);
    if (RA.chance(0.7)) {
      coin(S.genX + 30, G - 130 - 34);
      coin(S.genX + 80, G - 130 - 34);
    }
    S.genX += 110;

    const post = RA.rand(190, 290);
    ground(S.genX, post, G);
    S.genX += post;
  }

  // выбор очередного узора по весам из config
  function addPattern(speed) {
    const C = RA.CONFIG.world;
    const G = RA.CONFIG.groundY;
    // сложность 0..1 растёт с дистанцией
    const diff = Math.min(1, Math.max(0, (S.genX - 900) / C.difficultyRamp));
    const r = Math.random();
    if (r < C.gapChance) return patGap(speed, G, diff);
    if (r < C.gapChance + C.towerChance) return patTower(G, diff);
    if (r < C.gapChance + C.towerChance + C.wallChance) return patWall(G, diff);
    if (r < C.gapChance + C.towerChance + C.wallChance + C.gateChance) return patGate(G);
    return patFlat(G, diff);
  }

  // чистим то, что осталось далеко позади камеры
  function prune(camX) {
    const keep = camX - 350;
    S.solids = S.solids.filter(function (s) { return s.x + s.w > keep; });
    S.coins = S.coins.filter(function (c) { return !c.taken && c.x > keep; });
    S.guards = S.guards.filter(function (g) { return g.x + g.w > keep && !(g.dead && g.dead > 1.25); });
    S.gates = S.gates.filter(function (g) { return g.x + g.w > keep; });
  }

  /* ---------- публичный интерфейс ---------- */

  return {
    state: S,

    reset: function () {
      S.solids = []; S.gates = []; S.coins = []; S.guards = [];
      S.genX = 900;
      ground(-300, 1200, RA.CONFIG.groundY);   // стартовая безопасная площадка
    },

    // дорисовать мир впереди камеры (вызывать каждый кадр)
    ensure: function (camX, speed) {
      while (S.genX < camX + RA.CONFIG.width * 2) addPattern(speed);
      prune(camX);
    },

    // отрисовка земли, башен, стен и ворот (герой рисуется поверх)
    draw: function (ctx, cam) {
      const W = RA.CONFIG.width;

      for (let i = 0; i < S.solids.length; i++) {
        const s = S.solids[i];
        if (s.kind === 'beam') continue;               // балки рисуются с воротами
        const x = s.x - cam;
        if (x + s.w < -40 || x > W + 40) continue;

        if (s.kind === 'ground' || s.kind === 'tower') {
          ctx.fillStyle = s.kind === 'ground' ? '#241411' : '#2b1a15';
          ctx.fillRect(x, s.y, s.w, s.h);
          ctx.fillStyle = s.kind === 'ground' ? '#4a2c1f' : '#57301f';
          ctx.fillRect(x, s.y, s.w, 8);
          ctx.fillStyle = 'rgba(232,90,60,.35)';       // красная кромка на закате
          ctx.fillRect(x, s.y, s.w, 2);
          ctx.fillStyle = 'rgba(0,0,0,.22)';           // швы камня
          const step = 46, start = Math.ceil(s.x / step) * step;
          for (let sx = start; sx < s.x + s.w; sx += step) ctx.fillRect(sx - cam, s.y + 10, 2, 26);
        } else if (s.kind === 'wall') {
          ctx.fillStyle = '#4a1d18';
          ctx.fillRect(x, s.y, s.w, s.h);
          ctx.fillStyle = '#6b2a22';
          ctx.fillRect(x, s.y, s.w, 6);
          ctx.fillStyle = 'rgba(0,0,0,.25)';
          for (let by = s.y + 18; by < s.y + s.h; by += 18) ctx.fillRect(x, by, s.w, 2);
        }
      }

      // ворота в стиле тории
      for (let i = 0; i < S.gates.length; i++) {
        const g = S.gates[i];
        const x = g.x - cam;
        if (x + g.w < -60 || x > W + 60) continue;
        const pw = 14, base = g.base;
        ctx.fillStyle = '#a83228';                     // столбы
        ctx.fillRect(x, g.y + 8, pw, base - g.y - 8);
        ctx.fillRect(x + g.w - pw, g.y + 8, pw, base - g.y - 8);
        ctx.fillStyle = '#7e231c';                     // основания
        ctx.fillRect(x - 3, base - 10, pw + 6, 10);
        ctx.fillRect(x + g.w - pw - 3, base - 10, pw + 6, 10);
        ctx.fillStyle = '#b73a2e';                     // балка (твёрдая)
        ctx.fillRect(x - 6, g.y, g.w + 12, 16);
        ctx.fillStyle = '#d4553a';
        ctx.fillRect(x - 6, g.y, g.w + 12, 4);
        ctx.fillStyle = '#2a1512';                     // верхняя крыша
        ctx.fillRect(x - 20, g.y - 14, g.w + 40, 9);
        ctx.fillRect(x - 14, g.y - 5, 8, 6);
        ctx.fillRect(x + g.w + 6, g.y - 5, 8, 6);
      }
    }
  };
})();
