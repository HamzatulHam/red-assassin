/* ============================================================
   МИР — генерация бесконечного уровня из «узоров»
   Биом-палитра приходит из game (pal) — платформы и декор
   перекрашиваются под окружение (закат/ночь/гроза/снег/рассвет).
   ============================================================ */

window.RA = window.RA || {};

RA.World = (function () {

  const S = {
    solids: [], gates: [], coins: [], guards: [],
    genX: 0
  };
  let pruneTick = 0;

  /* ---------- строители ---------- */

  function ground(x, w, y) {
    S.solids.push({ kind: 'ground', x: x, y: y, w: w, h: RA.CONFIG.height - y + 80 });
  }
  function tower(x, w, y) {
    S.solids.push({ kind: 'tower', x: x, y: y, w: w, h: RA.CONFIG.height - y + 80 });
  }
  function wallAt(x, yTop, h) {
    S.solids.push({ kind: 'wall', x: x, y: yTop, w: 26, h: h });
  }
  function gateAt(x, yBase) {
    const beamY = yBase - 130, beamW = 110;
    S.solids.push({ kind: 'beam', x: x, y: beamY, w: beamW, h: 16 });
    S.gates.push({ x: x, y: beamY, w: beamW, base: yBase });
  }
  function coin(x, y) { S.coins.push({ x: x, y: y, taken: false, ph: Math.random() * 6 }); }

  // враг: тип по шансам (лучники/тяжёлые/тени чаще на высокой сложности)
  function enemy(x, y, range, diff, allowHeavy) {
    const E = RA.CONFIG.enemies;
    const aC = E.archerChance + E.growth * diff * 0.5;
    const hC = (allowHeavy === false ? 0 : E.heavyChance + E.growth * diff * 0.4);
    const sC = E.shadowChance + E.growth * diff * 0.4;
    const r = Math.random();
    let type = 'guard', w = 36, h = 56;
    if (r < aC) { type = 'archer'; }
    else if (r < aC + hC) { type = 'heavy'; w = 48; h = 64; }
    else if (r < aC + hC + sC) { type = 'shadow'; w = 34; h = 56; }
    S.guards.push({
      type: type, x: x, y: y, w: w, h: h, x0: x, range: range,
      dir: Math.random() < 0.5 ? 1 : -1, dead: 0, ph: Math.random() * 6,
      hp: type === 'heavy' ? RA.CONFIG.enemies.heavyHp : 1,
      cd: 0, draw: 0, hurtT: 0, dash: false
    });
  }

  /* ---------- паттерны ---------- */

  function patFlat(G, diff, biomeIdx) {
    const C = RA.CONFIG.world;
    const w = RA.rand(260, 470);
    ground(S.genX, w, G);
    if (RA.chance(C.coinChance)) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) coin(S.genX + w * 0.3 + i * 40, G - 64);
    }
    if (RA.chance(C.guardChance + C.guardChanceGrow * diff)) {
      enemy(S.genX + w * 0.6, G, Math.min(110, w * 0.25), diff);
    }
    S.genX += w;
  }

  function patGap(speed, G, diff) {
    const C = RA.CONFIG.world;
    const gapW = Math.round(RA.rand(C.gapMin, Math.min(C.gapMax, 60 + speed * 0.5)));
    const gx0 = S.genX;
    S.genX += gapW;
    const w = RA.rand(300, 500);
    ground(S.genX, w, G);
    if (RA.chance(C.gapCoinChance)) {
      coin(gx0 + gapW * 0.30, G - 95);
      coin(gx0 + gapW * 0.55, G - 130);
      coin(gx0 + gapW * 0.80, G - 95);
    }
    if (RA.chance(C.guardChance + C.guardChanceGrow * diff)) {
      enemy(S.genX + w * 0.55, G, Math.min(120, w * 0.3), diff);
    }
    S.genX += w;
  }

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
      enemy(S.genX + tw * 0.5, top, Math.min(70, tw * 0.4), diff, false);  // на башне без тяжёлых
    }
    S.genX += tw;

    const post = RA.rand(210, 330);
    ground(S.genX, post, G);
    if (RA.chance(C.guardChance + C.guardChanceGrow * diff)) {
      enemy(S.genX + post * 0.5, G, post * 0.3, diff);
    }
    S.genX += post;
  }

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
      enemy(S.genX + post * 0.55, G, post * 0.3, diff);
    }
    S.genX += post;
  }

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

  function addPattern(speed, diff) {
    const C = RA.CONFIG.world;
    const G = RA.CONFIG.groundY;
    const r = Math.random();
    if (r < C.gapChance) return patGap(speed, G, diff);
    if (r < C.gapChance + C.towerChance) return patTower(G, diff);
    if (r < C.gapChance + C.towerChance + C.wallChance) return patWall(G, diff);
    if (r < C.gapChance + C.towerChance + C.wallChance + C.gateChance) return patGate(G);
    return patFlat(G, diff);
  }

  function prune(camX) {
    const keep = camX - 350;
    S.solids = S.solids.filter(function (s) { return s.x + s.w > keep; });
    S.coins = S.coins.filter(function (c) { return !c.taken && c.x > keep; });
    S.guards = S.guards.filter(function (g) { return g.x + g.w > keep && !(g.dead && g.dead > 1.3); });
    S.gates = S.gates.filter(function (g) { return g.x + g.w > keep; });
  }

  /* ---------- отрисовка платформ ---------- */

  function drawSolids(ctx, cam, pal) {
    const W = RA.CONFIG.width;
    for (let i = 0; i < S.solids.length; i++) {
      const s = S.solids[i];
      if (s.kind === 'beam') continue;
      const x = s.x - cam;
      if (x + s.w < -40 || x > W + 40) continue;

      if (s.kind === 'ground' || s.kind === 'tower') {
        const g2 = ctx.createLinearGradient(0, s.y, 0, s.y + Math.min(s.h, 210));
        g2.addColorStop(0, pal.gBody);
        g2.addColorStop(1, pal.gBot);
        ctx.fillStyle = g2;
        ctx.fillRect(x, s.y, s.w, s.h);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(x + s.w - 4, s.y, 4, s.h);
        ctx.fillStyle = pal.gTop;
        ctx.fillRect(x, s.y, s.w, 8);
        ctx.fillStyle = 'rgba(' + pal.edge + ',.4)';
        ctx.fillRect(x, s.y, s.w, 2);
        // трава/снежные бугорки
        const tufts = Math.min(6, Math.floor(s.w / 95));
        for (let tI = 0; tI < tufts; tI++) {
          const tx = s.x + (0.15 + 0.75 * RA.hash(s.x * 0.37 + tI * 13)) * s.w;
          const th = 5 + RA.hash(s.x + tI) * 6;
          ctx.fillStyle = pal.tuft;
          ctx.beginPath();
          ctx.moveTo(tx - 4, s.y + 1);
          ctx.lineTo(tx, s.y - th);
          ctx.lineTo(tx + 4, s.y + 1);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        const step = 46, start = Math.ceil(s.x / step) * step;
        for (let sx = start; sx < s.x + s.w; sx += step) ctx.fillRect(sx - cam, s.y + 10, 2, 26);
      } else if (s.kind === 'wall') {
        const wg = ctx.createLinearGradient(x, 0, x + s.w, 0);
        wg.addColorStop(0, pal.wallHi); wg.addColorStop(0.35, pal.wall); wg.addColorStop(1, pal.wallLo);
        ctx.fillStyle = wg;
        ctx.fillRect(x, s.y, s.w, s.h);
        ctx.fillStyle = pal.wallHi;
        ctx.fillRect(x, s.y, s.w, 6);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        for (let by = s.y + 18; by < s.y + s.h; by += 18) ctx.fillRect(x, by, s.w, 2);
      }
    }
  }

  /* ---------- постройки фона по биому ---------- */

  function drawPagoda(ctx, x, baseY, seed) {
    const tiers = 2 + Math.floor(RA.hash(seed * 9) * 2);
    let y = baseY, w = 100 + RA.hash(seed * 3) * 40;
    for (let t = 0; t < tiers; t++) {
      ctx.fillRect(x - w / 2 + 14, y - 18, w - 28, 18);
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 10, y);
      ctx.lineTo(x - w / 2, y - 20);
      ctx.lineTo(x + w / 2, y - 20);
      ctx.lineTo(x + w / 2 + 10, y);
      ctx.closePath(); ctx.fill();
      y -= 26; w *= 0.78;
    }
    ctx.fillRect(x - 2, y - 16, 4, 16);
    ctx.beginPath(); ctx.arc(x, y - 18, 3, 0, 7); ctx.fill();
  }

  function drawPines(ctx, x, baseY, seed) {
    const n = 1 + Math.floor(RA.hash(seed) * 2);
    for (let t = 0; t < n; t++) {
      const px = x + t * 46, h = 80 + RA.hash(seed * 7 + t) * 70, w = 40 + RA.hash(seed + t) * 20;
      ctx.fillRect(px - 3, baseY - 14, 6, 14);
      for (let k = 0; k < 3; k++) {
        const kw = w * (1 - k * 0.28), ky = baseY - 14 - k * h * 0.3;
        ctx.beginPath();
        ctx.moveTo(px - kw / 2, ky);
        ctx.lineTo(px, ky - h * 0.38);
        ctx.lineTo(px + kw / 2, ky);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawRuins(ctx, x, baseY, seed) {
    // сломанные колонны и арка
    const cw = 16, ch = 50 + RA.hash(seed) * 40;
    ctx.fillRect(x, baseY - ch, cw, ch);
    ctx.fillRect(x - 3, baseY - ch - 6, cw + 6, 8);
    if (RA.hash(seed * 3) > 0.4) {
      ctx.fillRect(x + 60, baseY - ch * 0.7, cw, ch * 0.7);
      ctx.fillRect(x - 3, baseY - ch - 6, 90, 8);
    }
  }

  function drawBamboo(ctx, x, baseY, seed) {
    const n = 2 + Math.floor(RA.hash(seed) * 3);
    for (let t = 0; t < n; t++) {
      const bx = x + t * 22, h = 90 + RA.hash(seed * 5 + t) * 80;
      const lean = (RA.hash(seed + t) - 0.5) * 20;
      ctx.fillRect(bx - 3 + lean * 0.4, baseY - h, 6, h);
      for (let k = 0; k < 3; k++) {
        const ly = baseY - h + 14 + k * 22;
        ctx.beginPath();
        ctx.moveTo(bx + lean * 0.6, ly);
        ctx.quadraticCurveTo(bx + lean + 18, ly - 8, bx + lean + 30, ly + 4);
        ctx.quadraticCurveTo(bx + lean + 16, ly + 2, bx + lean * 0.6, ly + 4);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  function drawDecor(ctx, cam, pal, type) {
    const W = RA.CONFIG.width, period = 470, off = cam * 0.45, baseY = RA.CONFIG.groundY + 12;
    const i0 = Math.floor(off / period) - 1;
    for (let i = i0; i < i0 + Math.ceil(W / period) + 3; i++) {
      const bx = i * period - off + 80;
      if (bx < -140 || bx > W + 140) continue;
      if (type === 'pagoda' && RA.hash(i * 31) > 0.3) drawPagoda(ctx, bx, baseY, i);
      else if (type === 'pine') drawPines(ctx, bx, baseY, i);
      else if (type === 'ruin') drawRuins(ctx, bx, baseY, i);
      else if (type === 'bamboo') drawBamboo(ctx, bx, baseY, i);
    }
  }

  /* ---------- ворота ---------- */

  function drawGates(ctx, cam, pal) {
    const W = RA.CONFIG.width;
    for (let i = 0; i < S.gates.length; i++) {
      const g = S.gates[i];
      const x = g.x - cam;
      if (x + g.w < -60 || x > W + 60) continue;
      const pw = 14, base = g.base;
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(x + g.w / 2, base + 3, g.w * 0.75, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = pal.gate;
      ctx.fillRect(x, g.y + 8, pw, base - g.y - 8);
      ctx.fillRect(x + g.w - pw, g.y + 8, pw, base - g.y - 8);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(x - 3, base - 10, pw + 6, 10);
      ctx.fillRect(x + g.w - pw - 3, base - 10, pw + 6, 10);
      ctx.fillStyle = pal.gateHi;
      ctx.fillRect(x - 6, g.y, g.w + 12, 16);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(x - 6, g.y, g.w + 12, 4);
      ctx.fillStyle = pal.roof;
      ctx.fillRect(x - 20, g.y - 14, g.w + 40, 9);
      ctx.fillRect(x - 14, g.y - 5, 8, 6);
      ctx.fillRect(x + g.w + 6, g.y - 5, 8, 6);
    }
  }

  /* ---------- публичный интерфейс ---------- */

  return {
    state: S,

    reset: function () {
      S.solids = []; S.gates = []; S.coins = []; S.guards = [];
      S.genX = 900;
      ground(-300, 1200, RA.CONFIG.groundY);
    },

    // сборка арены для дуэли
    buildArena: function () {
      S.solids = []; S.gates = []; S.coins = []; S.guards = [];
      const G = RA.CONFIG.groundY;
      S.solids.push({ kind: 'ground', x: -40, y: G, w: RA.CONFIG.width + 80, h: RA.CONFIG.height - G + 80 });
      S.solids.push({ kind: 'tower', x: 110, y: G - 120, w: 190, h: RA.CONFIG.height - (G - 120) + 80 });
      S.solids.push({ kind: 'tower', x: RA.CONFIG.width - 300, y: G - 120, w: 190, h: RA.CONFIG.height - (G - 120) + 80 });
      S.solids.push({ kind: 'tower', x: 400, y: G - 210, w: 160, h: RA.CONFIG.height - (G - 210) + 80 });
      S.solids.push({ kind: 'wall', x: -26, y: G - 190, w: 26, h: 190 });
      S.solids.push({ kind: 'wall', x: RA.CONFIG.width, y: G - 190, w: 26, h: 190 });
    },

    ensure: function (camX, speed, diff) {
      while (S.genX < camX + RA.CONFIG.width * 2) addPattern(speed, diff);
      if ((pruneTick++ & 31) === 0) prune(camX);
    },

    draw: function (ctx, cam, pal) {
      const W = RA.CONFIG.width;
      ctx.fillStyle = pal.decor;
      drawDecor(ctx, cam, pal, pal.decorType);
      drawSolids(ctx, cam, pal);
      drawGates(ctx, cam, pal);
    }
  };
})();
