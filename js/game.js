/* ============================================================
   ИГРА — цикл, биомы, погода, кампания, дуэль, камера, фон
   ============================================================ */

window.RA = window.RA || {};

RA.Game = (function () {
  const CFG = RA.CONFIG;
  const T = CFG.texts;
  const B = CFG.biomes;

  let ctx, canvas;
  let state = 'menu';            // menu | play | dead | won | pause | duel-end
  let mode = 'endless';          // endless | campaign | duel
  let speed = 0, stomps = 0, coinsN = 0, dist = 0, level = 1;
  let time = 0, camX = 0, shake = 0;
  let deathT = 0, overShown = false;
  let best = RA.lsGet('ra_best_v1', 0);

  // магазин и прокачка
  let runGold = 0, weaponId = 'none', wcd = 0;
  let magnetLvl = 0, walletLvl = 0, jumpLvl = 0;
  let difficulty = 0;

  // кампания
  let campaign = { active: false, idx: 0, goal: 0 };

  // биом (плавная смена палитры)
  let biomeIdx = 0, palFrom = null, palTo = B[0], palT = 1, pal = null;
  let lightningT = 5, flash = 0;

  // дуэль
  let duel = { p1: null, p2: null, s1: 0, s2: 0, phase: 'fight', timer: 0, winner: 0 };
  let duelKeys = { a: 0, d: 0, s: 0, left: 0, right: 0, up: 0, down: 0 };

  // босс, достижения, серия
  let nextBossDist = 1200, bossActive = false;
  let stats = { kills: 0 };
  let comboN = 0, comboT = 0;
  let lastStart = { mode: 'endless', idx: 0 };

  let skyC, vinC;
  let stars = [];
  let last = 0;
  let drawDt = 0;

  function score() {
    return Math.floor(dist) + coinsN * CFG.score.coinValue +
           stomps * CFG.score.stompValue + (api._scoreBonus || 0);
  }
  function walletNow() { return RA.Save.get().gold + Math.floor(runGold); }

  /* ---------- палитра биомов ---------- */

  function computePal(b, t) {   // t: 0 = from, 1 = to
    if (t >= 1) return resolvePal(b);
    const f = resolvePal(palFrom);
    const to = resolvePal(b);
    const out = {};
    for (let i = 0; i < 4; i++) out.sky[i] = RA.mixColor(f.sky[i], to.sky[i], t);
    ['glow', 'mtFar', 'mtNear', 'gTop', 'gBody', 'gBot', 'edge'].forEach(function (k) {
      out[k] = RA.mixColor(f[k], to[k], t);
    });
    out.starA = f.starA + (to.starA - f.starA) * t;
    out.moonA = f.moonA + (to.moonA - f.moonA) * t;
    return out;
  }

  function resolvePal(b) {
    const out = {
      sky: b.sky.slice(), glow: b.glow, mtFar: b.mtFar, mtNear: b.mtNear,
      gTop: b.gTop, gBody: b.gBody, gBot: b.gBot, edge: b.edge,
      starA: b.starA, moonA: b.moonA,
      particle: b.particle, decorType: b.decor, lanterns: b.lanterns, lightning: b.lightning,
      snow: b.particle === 'snow'
    };
    out.tuft = b.particle === 'snow' ? b.gBody : RA.mixColor('2f4a26', b.gBody, 0.35);
    out.wall = RA.mixColor(b.gBody, '#000000', 0.18);
    out.wallHi = RA.mixColor(b.gBody, '#ffffff', 0.14);
    out.wallLo = RA.mixColor(b.gBody, '#000000', 0.4);
    out.decor = RA.mixColor(b.mtNear, '#000000', 0.18);
    out.gate = '#a83228'; out.gateHi = '#c0432f'; out.roof = '#22100c';
    return out;
  }

  function setBiome(idx) {
    if (idx === biomeIdx && palT >= 1) return;
    palFrom = computePal(palTo, palT >= 1 ? 1 : palT);
    palTo = B[idx];
    biomeIdx = idx;
    palT = 0;
  }

  function updatePal(dt) {
    if (palT < 1) palT = Math.min(1, palT + dt / 1.8);
    pal = computePal(palTo, palT);
  }

  /* ---------- звук ---------- */

  const sfx = RA.Sound.sfx;

  /* ---------- состояния ---------- */

  function baseReset() {
    RA.World.reset();
    RA.Player.reset();
    RA.Particles.clear();
    RA.Projectiles.clear();
    RA.EnemyArrows.clear();
    speed = CFG.player.speedStart;
    stomps = 0; coinsN = 0; dist = 0; level = 1;
    camX = -100; shake = 0;
    overShown = false; deathT = 0;
    runGold = 0; wcd = 0;
    stats = { kills: 0 };
    comboN = 0; comboT = 0;
    api._scoreBonus = 0;
    bossActive = false; nextBossDist = 1200;
    state = 'play';
    const d = RA.Save.get();
    RA.Player.p.shields = d.up.shield || 0;
    RA.Player.p.invuln = 0;
    magnetLvl = d.up.magnet || 0;
    walletLvl = d.up.wallet || 0;
    jumpLvl = d.up.jump || 0;
    weaponId = d.weapon;
    difficulty = 0;
  }

  function start() {
    mode = 'endless';
    baseReset();
    setBiome(0);
    palT = 1;
    RA.UI.hideOverlays();
    RA.UI.setPlaying(true);
    RA.Sound.ensure();
    RA.Sound.sfx.ensure();
  }

  function startCampaign(idx) {
    mode = 'campaign';
    baseReset();
    campaign = { active: true, idx: idx, goal: CFG.campaign.length(idx) };
    difficulty = CFG.campaign.difficulty(idx);
    setBiome(CFG.campaign.biome(idx));
    palT = 1;
    RA.UI.hideOverlays();
    RA.UI.setPlaying(true);
    RA.Sound.ensure();
  }

  function startDuel() {
    mode = 'duel';
    state = 'play';
    RA.World.buildArena();
    RA.Particles.clear();
    RA.Projectiles.clear();
    RA.EnemyArrows.clear();
    camX = 0; shake = 0; time = 0;
    duel.p1 = RA.createPlayer({
      id: 'p1', freeMove: true, spawnX: 300, facing: 1,
      colors: CFG.shop.skins.find(function (s) { return s.id === RA.Save.get().skin; }) || CFG.shop.skins[0]
    });
    duel.p2 = RA.createPlayer({
      id: 'p2', freeMove: true, spawnX: 620, facing: -1,
      colors: { suit: '#1565c0', suit2: '#0d47a1', scarf: '#64b5f6', eye: '#e3f2fd' }
    });
    duel.s1 = 0; duel.s2 = 0; duel.phase = 'fight'; duel.timer = 0; duel.winner = 0;
    difficulty = 0;
    state = 'play';
    setBiome(Math.floor(Math.random() * B.length));
    palT = 1;
    RA.UI.hideOverlays();
    RA.UI.setPlaying(true);
    RA.UI.setDuelHUD(true);
    RA.Sound.ensure();
  }

  function restart() {
    if (mode === 'campaign') startCampaign(campaign.idx);
    else if (mode === 'duel') startDuel();
    else start();
  }

  function die(cause) {
    if (mode === 'duel') return;                 // в дуэли урон через hurt
    if (state !== 'play') return;
    state = 'dead';
    deathT = 0; overShown = false;
    RA.Player.die(cause, { speed: speed });
    shake = 9;
    sfx.die();
  }

  function onCoin(c) {
    coinsN++;
    runGold += CFG.shop.goldPerCoin * (1 + 0.1 * walletLvl);
    sfx.coin();
    RA.Particles.burst(c.x, c.y, '#ffd54f', 7, { life: 0.5, spread: 90, up: 130, size: 3 });
    RA.Particles.pop(c.x, c.y - 16, '+' + CFG.score.coinValue, '#ffd54f');
  }

  function ach(id) {
    const d = RA.Save.get();
    if (d.ach && d.ach.indexOf(id) !== -1) return;
    const def = CFG.achievements.find(function (a) { return a.id === id; });
    if (!def) return;
    if (!d.ach) d.ach = [];
    d.ach.push(id);
    RA.Save.save();
    RA.UI.toast('🏅 Достижение: ' + def.name);
    sfx.level();
  }

  function registerKill(g) {
    stats.kills++;
    comboN = comboT > 0 ? comboN + 1 : 1;
    comboT = 2.5;
    if (comboN >= 2) {
      RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 34, 'СЕРИЯ ×' + comboN, '#ffab40');
      api._scoreBonus = (api._scoreBonus || 0) + (comboN - 1) * 10;
    }
    if (stats.kills === 1) ach('firstkill');
    if (stats.kills >= 10) ach('slayer10');
  }

  function onStomp(g) {
    stomps++;
    registerKill(g);
    sfx.stomp();
    shake = Math.max(shake, 5);
    RA.Particles.burst(g.x + g.w / 2, g.y - g.h, '#ffd54f', 10, { life: 0.6, spread: 120, up: 160, size: 4 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 12, '+' + (CFG.score.stompValue + (comboN - 1) * 10), '#ffe082');
  }

  function onWeaponKill(g) {
    stomps++;
    registerKill(g);
    sfx.stomp();
    shake = Math.max(shake, 4);
    RA.Particles.burst(g.x + g.w / 2, g.y - g.h / 2, '#ff8a80', 8, { life: 0.5, spread: 110, up: 130, size: 3 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 12, '+' + (CFG.score.stompValue + (comboN - 1) * 10), '#ff8a80');
  }

  function onBossKill(g) {
    registerKill(g);
    shake = 14;
    sfx.win();
    ach('boss1');
    stomps += 8;
    RA.Particles.burst(g.x + g.w / 2, g.y - g.h / 2, '#ff1744', 30, { life: 0.9, spread: 300, up: 260, size: 5 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 20, 'БОСС ПОВЕРЖЕН!', '#ffd54f');
    for (let i = 0; i < 8; i++) {
      RA.World.state.coins.push({
        x: g.x + g.w / 2 + (i - 3.5) * 34, y: g.y - g.h - 10 - (i % 2) * 26,
        taken: false, ph: Math.random() * 6
      });
    }
  }

  function onShieldHit(g) {
    sfx.stomp();
    shake = Math.max(shake, 6);
    RA.Particles.burst(RA.Player.p.x + RA.Player.p.w / 2, RA.Player.p.y + RA.Player.p.h / 2, '#90caf9', 12, { life: 0.6, spread: 140, up: 160, size: 4 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 12, 'ЩИТ!', '#90caf9');
  }

  function onExplosion(x, y) {
    sfx.boom();
    shake = 12;
    RA.Particles.burst(x, y, '#ffb74d', 26, { life: 0.7, spread: 260, up: 240, size: 4.5 });
    RA.Particles.burst(x, y, '#fff3e0', 14, { life: 0.45, spread: 180, up: 190, size: 3 });
    const gs = RA.World.state.guards;
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      if (g.dead) continue;
      const dx = g.x + g.w / 2 - x, dy = g.y - g.h / 2 - y;
      if (dx * dx + dy * dy < 130 * 130) {
        g.dead = 0.001;
        onWeaponKill(g);
      }
    }
  }

  function throwWeapon() {
    if (state !== 'play' || mode === 'duel') return;
    const w = curWeapon();
    if (!w || w.id === 'none' || wcd > 0) return;
    wcd = w.cooldown;
    const p = RA.Player.p;
    const mx = p.x + p.w - 2, my = p.y + p.h * 0.35;
    if (w.melee) {
      RA.Projectiles.slash(mx, my + 6, 1, w.dmg, api);
      sfx.swing();
      return;
    }
    const cfg = { vx: w.speed || 760, vy: 0, pierce: w.pierce || 0, dmg: w.dmg || 1, owner: 'hero' };
    if (w.gravity) cfg.vy = -170;
    if (w.lob) { cfg.vx = 460; cfg.vy = -320; cfg.grav = true; }
    cfg.grav = cfg.grav || !!w.gravity;
    RA.Projectiles.throw(w.id, mx, my, cfg);
    if (w.id === 'dual') {
      cfg.vy = 46;
      RA.Projectiles.throw(w.id, mx, my - 12, cfg);
    }
    sfx.throwK();
  }

  function duelThrow(p, foe) {
    if (state !== 'play' || duel.phase !== 'fight') return;
    if (p.p.hitCd > 0) return;
    p.p.hitCd = CFG.duel.kunaiCd;
    RA.Projectiles.throw('kunai', p.p.x + (p.p.facing > 0 ? p.p.w : -6), p.p.y + p.p.h * 0.35,
      { vx: p.p.facing * 560, dmg: 1, owner: p.p.id });
    sfx.throwK();
  }

  function curWeapon() {
    return CFG.shop.weapons.find(function (w) { return w.id === weaponId; }) || null;
  }

  function setPause(on) {
    if (on && state === 'play') { state = 'pause'; RA.UI.showPause(true); }
    else if (!on && state === 'pause') { state = 'play'; RA.UI.showPause(false); }
  }

  /* ---------- обновление ---------- */

  function update(dt) {
    time += dt;
    updatePetals(dt);
    updateBirds(dt);
    updateEmbers(dt);
    updatePal(dt);

    // молния в грозу
    if (pal.lightning && mode !== 'menu') {
      lightningT -= dt;
      if (lightningT <= 0) {
        flash = 1;
        lightningT = 6 + Math.random() * 9;
        sfx.thunder();
      }
    }
    flash = Math.max(0, flash - dt * 2.4);

    if (state === 'play') {
      if (mode === 'duel') { updateDuel(dt); return; }

      speed = Math.min(CFG.player.speedMax, speed + CFG.player.speedGain * dt);
      difficulty = mode === 'campaign' ? difficulty
        : Math.min(1, (RA.World.state.genX - 900) / CFG.world.difficultyRamp);
      RA.World.ensure(camX, speed, difficulty);
      RA.Player.update(dt, api);
      if (RA.Player.p.state !== 'dead') dist = Math.max(dist, RA.Player.p.x / CFG.score.meterDiv);

      // уровень и биом
      const nl = Math.floor(dist / CFG.levelEvery) + 1;
      if (nl > level) {
        level = nl;
        speed = Math.min(CFG.player.speedMax, speed + CFG.player.speedLevelBonus);
        RA.UI.banner(T.levelWord + ' ' + level);
        sfx.level();
      }
      if (mode === 'endless') setBiome((level - 1) % B.length);

      RA.Coins.update(dt, RA.Player.p, api);
      RA.Guards.update(dt, RA.Player.p, api);
      RA.Projectiles.update(dt, RA.World.state.guards, api);
      RA.EnemyArrows.update(dt, RA.Player.p, api);
      if (wcd > 0) wcd -= dt;

      const target = RA.Player.p.x - 260;
      camX += (target - camX) * Math.min(1, dt * 7);

      // цель кампании
      if (mode === 'campaign' && dist >= campaign.goal) { onVictory(); return; }

      if (RA.Player.p.y > CFG.height + 80) die('pit');

    } else if (state === 'dead') {
      RA.Player.update(dt, api);
      deathT += dt;
      if (deathT > 1.05 && !overShown) {
        overShown = true;
        const sc = score();
        const record = sc > best;
        if (record) { best = sc; RA.Save.get().best = best; RA.Save.save(); }
        const earned = Math.floor(runGold);
        const d = RA.Save.get();
        d.gold += earned;
        RA.Save.save();
        RA.UI.setWallet(d.gold);
        const titles = { guard: T.caughtTitle, pit: T.pitTitle, arrow: T.arrowTitle };
        RA.UI.gameOver({
          title: titles[RA.Player.p.cause] || T.caughtTitle,
          score: sc, coins: coinsN, dist: Math.floor(dist), best: best, record: record,
          toWallet: earned, campaign: campaign.active, idx: campaign.idx,
          kills: stats.kills
        });
        RA.UI.setPlaying(false);
      }
    }

    RA.Particles.update(dt);
    comboT = Math.max(0, comboT - dt);
    shake = Math.max(0, shake - dt * 26);

    if (state === 'play') {
      // достижения
      if (dist >= 500) ach('run500');
      if (runGold >= 100) ach('rich');
      if (RA.Player.p.dashesUsed >= 5) ach('wind');
      const biomesSeen = RA.lsGet('ra_biomes_seen', []);
      if (biomesSeen.indexOf(biomeIdx) === -1) {
        biomesSeen.push(biomeIdx);
        RA.lsSet('ra_biomes_seen', biomesSeen);
      }
      if (biomesSeen.length >= 5) ach('allbiomes');
      if (mode === 'campaign' && RA.Save.get().campaign.done.length >= 5) ach('cam5');
      // контроль босса
      const guardsNow = RA.World.state.guards;
      if (bossActive && !guardsNow.some(function (g) { return g.type === 'boss' && !g.dead; })) {
        bossActive = false;
      }
      // босс в бесконечном режиме
      if (mode === 'endless' && !bossActive && dist >= nextBossDist) {
        bossActive = true;
        nextBossDist += 1200;
        RA.World.state.guards.push({
          type: 'boss', x: RA.Player.p.x + 760, y: CFG.groundY, w: 70, h: 92,
          x0: RA.Player.p.x + 760, range: 0, dir: -1, dead: 0, ph: 0,
          hp: 12, maxHp: 12, hurtT: 0, cd: 0, draw: 0, jumpT: 0, jumpOff: 0,
          slamCd: 2.5, waveQueued: false
        });
        RA.UI.banner('⚠ БОСС!');
        sfx.thunder();
      }
      // босс в кампании — финальный уровень
      if (mode === 'campaign' && campaign.idx === CFG.campaign.levels - 1 &&
          !bossActive && dist >= campaign.goal - 80) {
        bossActive = true;
        RA.World.state.guards.push({
          type: 'boss', x: RA.Player.p.x + 760, y: CFG.groundY, w: 70, h: 92,
          x0: RA.Player.p.x + 760, range: 0, dir: -1, dead: 0, ph: 0,
          hp: 12, maxHp: 12, hurtT: 0, cd: 0, draw: 0, jumpT: 0, jumpOff: 0,
          slamCd: 2.5, waveQueued: false
        });
        RA.UI.banner('⚠ БОСС!');
        sfx.thunder();
      }

      const distStr = campaign.active
        ? Math.min(Math.floor(dist), campaign.goal) + ' / ' + campaign.goal
        : Math.floor(dist);
      RA.UI.updateHUD(score(), coinsN, distStr, level, best, RA.Player.p.shields, walletNow());
    }
  }

  function updateDuel(dt) {
    // управление игроков
    duel.p1.p.dir = (duelKeys.a ? -1 : 0) + (duelKeys.d ? 1 : 0);
    duel.p2.p.dir = (duelKeys.left ? -1 : 0) + (duelKeys.right ? 1 : 0);

    duel.p1.update(dt, api);
    duel.p2.update(dt, api);
    RA.Projectiles.update(dt, [], api);

    if (duel.phase === 'roundEnd') {
      duel.timer -= dt;
      if (duel.timer <= 0) {
        if (duel.s1 >= CFG.duel.roundsToWin || duel.s2 >= CFG.duel.roundsToWin) {
          duel.phase = 'matchEnd';
          duel.winner = duel.s1 >= CFG.duel.roundsToWin ? 1 : 2;
          sfx.win();
          RA.UI.showDuelEnd(duel.winner, duel.s1, duel.s2);
          state = 'duel-end';
          RA.UI.setPlaying(false);
        } else {
          resetRound();
        }
      }
      return;
    }

    // конец раунда
    if (duel.p1.p.state === 'dead' || duel.p2.p.state === 'dead') {
      duel.phase = 'roundEnd';
      duel.timer = 1.6;
      if (duel.p1.p.state === 'dead') duel.s2++; else duel.s1++;
      shake = 8;
    }
  }

  function resetRound() {
    duel.p1.reset(); duel.p2.reset();
    duel.p1.p.hp = CFG.duel.hp; duel.p2.p.hp = CFG.duel.hp;
    RA.Projectiles.clear();
    duel.phase = 'fight';
  }

  function onVictory() {
    state = 'won';
    sfx.win();
    const idx = campaign.idx;
    const reward = CFG.campaign.reward(idx);
    const d = RA.Save.get();
    d.gold += reward;
    if (d.campaign.done.indexOf(idx) === -1) d.campaign.done.push(idx);
    d.campaign.unlocked = Math.max(d.campaign.unlocked, Math.min(idx + 2, CFG.campaign.levels));
    RA.Save.save();
    RA.UI.setWallet(d.gold);
    RA.UI.showWin({
      idx: idx, dist: Math.floor(dist), coins: coinsN,
      score: score(), reward: reward,
      hasNext: idx + 1 < CFG.campaign.levels
    });
    RA.UI.setPlaying(false);
  }

  /* ---------- фон: небо, горы, декор ---------- */

  function bake() {
    // виньетка
    vinC = document.createElement('canvas');
    vinC.width = CFG.width; vinC.height = CFG.height;
    const v = vinC.getContext('2d');
    const vg = v.createRadialGradient(CFG.width / 2, CFG.height / 2, CFG.height * 0.45,
                                      CFG.width / 2, CFG.height / 2, CFG.width * 0.72);
    vg.addColorStop(0, 'rgba(20,4,8,0)'); vg.addColorStop(1, 'rgba(20,4,8,.42)');
    v.fillStyle = vg; v.fillRect(0, 0, CFG.width, CFG.height);

    // тень глубины для оврагов
    pitGrad = ctx.createLinearGradient(0, CFG.groundY + 40, 0, CFG.height);
    pitGrad.addColorStop(0, 'rgba(15,3,6,0)');
    pitGrad.addColorStop(1, 'rgba(12,2,5,.9)');

    // звёзды
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: RA.hash(i * 3 + 1) * CFG.width,
        y: RA.hash(i * 7 + 2) * 230,
        big: RA.hash(i * 5) < 0.2,
        tw: RA.hash(i) * 6.3
      });
    }

    initLanterns(); initBirds(); initPetals(); initEmbers();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, CFG.height);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(0.45, pal.sky[1]);
    g.addColorStop(0.75, pal.sky[2]); g.addColorStop(1, pal.sky[3]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, CFG.width, CFG.height);
    // тёплое зарево над горизонтом
    const hg = ctx.createRadialGradient(CFG.width * 0.5, CFG.groundY + 30, 30,
                                        CFG.width * 0.5, CFG.groundY + 30, 540);
    hg.addColorStop(0, 'rgba(' + pal.glow + ',.4)');
    hg.addColorStop(1, 'rgba(' + pal.glow + ',0)');
    ctx.fillStyle = hg; ctx.fillRect(0, CFG.groundY - 260, CFG.width, 300);
    // звёзды (мерцают)
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.fillStyle = 'rgba(255,240,220,' + (pal.starA * (0.4 + 0.6 * Math.abs(Math.sin(time * 1.4 + s.tw)))).toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.big ? 2 : 1.3, s.big ? 2 : 1.3);
    }
    // луна
    if (pal.moonA > 0.02) {
      ctx.globalAlpha = pal.moonA;
      const mg = ctx.createRadialGradient(740, 110, 10, 740, 110, 90);
      mg.addColorStop(0, 'rgba(255,236,210,.9)');
      mg.addColorStop(0.25, 'rgba(255,220,190,.35)');
      mg.addColorStop(1, 'rgba(255,220,190,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(740, 110, 90, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9d2'; ctx.beginPath(); ctx.arc(740, 110, 34, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(230,180,150,.5)';
      ctx.beginPath(); ctx.arc(728, 102, 6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(752, 120, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(748, 96, 3, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // дымка у горизонта
    const fog = ctx.createLinearGradient(0, CFG.groundY - 90, 0, CFG.groundY + 20);
    fog.addColorStop(0, 'rgba(' + pal.glow + ',0)');
    fog.addColorStop(1, 'rgba(' + pal.glow + ',.2)');
    ctx.fillStyle = fog; ctx.fillRect(0, CFG.groundY - 90, CFG.width, 110);
  }

  function drawClouds() {
    const off = camX * 0.1 + time * 6;
    const period = 430;
    const i0 = Math.floor(off / period) - 1;
    ctx.fillStyle = 'rgba(255,190,160,.13)';
    for (let i = i0; i < i0 + Math.ceil(CFG.width / period) + 3; i++) {
      const bx = i * period - off;
      const y = 55 + RA.hash(i * 13) * 130;
      const r = 34 + RA.hash(i * 7) * 26;
      ctx.beginPath(); ctx.ellipse(bx, y, r, r * 0.38, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + r * 0.7, y + 8, r * 0.7, r * 0.3, 0, 0, 7); ctx.fill();
    }
  }

  function drawMountains() {
    // дальний хребет — светлее (атмосферная перспектива)
    const off2 = camX * 0.12, p2 = 520, b2 = CFG.groundY + 12;
    const j0 = Math.floor(off2 / p2) - 1;
    ctx.fillStyle = pal.mtFar;
    for (let i = j0; i < j0 + Math.ceil(CFG.width / p2) + 3; i++) {
      const bx = i * p2 - off2;
      const h = 150 + RA.hash(i * 5 + 2) * 90;
      ctx.beginPath();
      ctx.moveTo(bx, b2); ctx.lineTo(bx + p2 / 2, b2 - h); ctx.lineTo(bx + p2, b2);
      ctx.closePath(); ctx.fill();
    }
    // ближний хребет
    const off = camX * 0.22, period = 320, baseY = CFG.groundY + 12;
    const i0 = Math.floor(off / period) - 1;
    ctx.fillStyle = pal.mtNear;
    for (let i = i0; i < i0 + Math.ceil(CFG.width / period) + 3; i++) {
      const bx = i * period - off;
      const h = 90 + RA.hash(i) * 110;
      ctx.beginPath();
      ctx.moveTo(bx, baseY);
      ctx.lineTo(bx + 160, baseY - h);
      ctx.lineTo(bx + 320, baseY);
      ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- фонари, птицы, лепестки, угли, снег/дождь ---------- */

  let lanterns = [], birds = [], petals = [], embers = [], weather = [];

  function initLanterns() {
    lanterns = [];
    for (let i = 0; i < 8; i++) {
      lanterns.push({
        x0: i * 430 + RA.hash(i * 3) * 220,
        y: 80 + RA.hash(i * 7) * 150,
        ph: RA.hash(i) * 6.3,
        s: 0.8 + RA.hash(i * 11) * 0.5
      });
    }
  }

  function drawLanterns() {
    if (!pal.lanterns) return;
    const span = 3440, off = camX * 0.35;
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      const sx = ((l.x0 - off) % span + span) % span - 60;
      if (sx > CFG.width + 60) continue;
      const sy = l.y + Math.sin(time * 0.8 + l.ph) * 8;
      const s = l.s;
      ctx.fillStyle = 'rgba(255,150,60,.16)';
      ctx.beginPath(); ctx.arc(sx, sy, 15 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff9d3c';
      RA.rr(ctx, sx - 5 * s, sy - 7 * s, 10 * s, 14 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath(); ctx.arc(sx, sy, 2.6 * s, 0, 7); ctx.fill();
    }
  }

  function initBirds() {
    birds = [];
    for (let i = 0; i < 4; i++) {
      birds.push({ x: Math.random() * CFG.width, y: 60 + Math.random() * 130, v: 12 + Math.random() * 14, ph: Math.random() * 6 });
    }
  }
  function updateBirds(dt) {
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      b.x -= b.v * dt; b.ph += dt * 7;
      if (b.x < -30) { b.x = CFG.width + 30; b.y = 60 + Math.random() * 130; }
    }
  }
  function drawBirds() {
    ctx.strokeStyle = 'rgba(40,10,25,.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i], f = Math.sin(b.ph) * 4;
      ctx.beginPath();
      ctx.moveTo(b.x - 6, b.y - f);
      ctx.quadraticCurveTo(b.x, b.y + 3, b.x + 6, b.y - f);
      ctx.stroke();
    }
  }

  function newPetal(anywhere) {
    return {
      x: Math.random() * CFG.width,
      y: anywhere ? Math.random() * CFG.height : -8 - Math.random() * 30,
      vx: -(14 + Math.random() * 26), vy: 16 + Math.random() * 24,
      r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 3,
      s: 1.6 + Math.random() * 2.2, o: 0.2 + Math.random() * 0.35
    };
  }
  function initPetals() {
    petals = [];
    for (let i = 0; i < 26; i++) petals.push(newPetal(true));
  }
  function updatePetals(dt) {
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > CFG.height + 8 || p.x < -8) {
        p.x = CFG.width * (0.25 + Math.random() * 0.85);
        p.y = -8 - Math.random() * 30;
      }
    }
  }
  function drawPetals() {
    ctx.fillStyle = '#ffc7d4';
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      ctx.globalAlpha = p.o;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function initEmbers() {
    embers = [];
    for (let i = 0; i < 24; i++) embers.push(newEmber(true));
  }
  function newEmber(anywhere) {
    return {
      x: Math.random() * CFG.width,
      y: anywhere ? Math.random() * CFG.height : CFG.height + 6,
      vx: (Math.random() - 0.5) * 14, vy: -(10 + Math.random() * 22),
      s: 1 + Math.random() * 1.8, o: 0.12 + Math.random() * 0.3,
      ph: Math.random() * 6.3
    };
  }
  function updateEmbers(dt) {
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.y += e.vy * dt;
      e.x += (e.vx + Math.sin(time * 2 + e.ph) * 8) * dt;
      if (e.y < -6 || e.x < -6 || e.x > CFG.width + 6) {
        e.x = Math.random() * CFG.width; e.y = CFG.height + 6;
      }
    }
  }
  function drawEmbers() {
    ctx.fillStyle = '#ffb066';
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      ctx.globalAlpha = e.o * (0.55 + 0.45 * Math.sin(time * 3 + e.ph));
      ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- погода: дождь / снег / светлячки ---------- */

  function initWeather() {
    weather = [];
    for (let i = 0; i < 60; i++) {
      weather.push({
        x: Math.random() * CFG.width, y: Math.random() * CFG.height,
        vx: 0, vy: 0, s: 1 + Math.random() * 1.6,
        o: 0.3 + Math.random() * 0.4, ph: Math.random() * 6.3,
        type: pal ? pal.particle : 'petals'
      });
    }
  }
  function updateWeather(dt) {
    const type = pal.particle;
    for (let i = 0; i < weather.length; i++) {
      const w = weather[i];
      if (w.type !== type) {                       // биом сменился — частица перерождается
        w.type = type;
        w.x = Math.random() * CFG.width;
        w.y = Math.random() * CFG.height;
      }
      if (type === 'rain') {
        w.x -= 120 * dt; w.y += 640 * dt;
        if (w.y > CFG.height) { w.y = -10; w.x = Math.random() * (CFG.width + 120); }
        if (w.x < -10) w.x += CFG.width + 20;
      } else if (type === 'snow') {
        w.x += Math.sin(time * 1.6 + w.ph) * 22 * dt - 16 * dt;
        w.y += (34 + w.s * 8) * dt;
        if (w.y > CFG.height) { w.y = -8; w.x = Math.random() * CFG.width; }
      } else if (type === 'fireflies') {
        w.x += Math.sin(time * 0.9 + w.ph) * 26 * dt;
        w.y += Math.cos(time * 0.7 + w.ph * 1.3) * 20 * dt;
        if (w.x < -10) w.x = CFG.width + 10;
        if (w.x > CFG.width + 10) w.x = -10;
        if (w.y < 40) w.y = 40;
        if (w.y > CFG.groundY) w.y = CFG.groundY - 10;
      }
    }
  }
  function drawWeather() {
    const type = pal.particle;
    if (type === 'rain') {
      ctx.strokeStyle = 'rgba(190,215,240,.34)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < weather.length; i++) {
        const w = weather[i];
        ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - 2.2, w.y + 13);
      }
      ctx.stroke();
    } else if (type === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < weather.length; i++) {
        const w = weather[i];
        ctx.beginPath(); ctx.arc(w.x, w.y, w.s * 0.9, 0, 7); ctx.fill();
      }
    } else if (type === 'fireflies') {
      for (let i = 0; i < weather.length; i++) {
        const w = weather[i];
        const blink = 0.3 + 0.7 * Math.abs(Math.sin(time * 2.2 + w.ph));
        ctx.fillStyle = 'rgba(190,255,140,' + (blink * 0.8).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(w.x, w.y, 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(190,255,140,' + (blink * 0.16).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(w.x, w.y, 7, 0, 7); ctx.fill();
      }
    }
  }

  /* ---------- отрисовка кадра ---------- */

  function draw() {
    drawSky();
    drawClouds();
    drawMountains();
    drawLanterns();
    drawBirds();
    ctx.fillStyle = pitGrad;
    ctx.fillRect(0, CFG.groundY + 40, CFG.width, CFG.height - CFG.groundY - 40);

    const sx = shake ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake ? (Math.random() * 2 - 1) * shake : 0;

    ctx.save();
    ctx.translate(-camX + sx, sy);
    RA.World.draw(ctx, camX, pal);          // декор → платформы → ворота
    RA.Coins.draw(ctx, camX, time);
    RA.Guards.draw(ctx, camX, time);
    RA.EnemyArrows.draw(ctx, camX);
    RA.Projectiles.draw(ctx, camX);
    if (mode === 'duel') {
      duel.p1.draw(ctx, 0, time);
      duel.p2.draw(ctx, 0, time);
    } else {
      RA.Player.draw(ctx, camX, time);
    }
    RA.Particles.draw(ctx, camX);
    ctx.restore();

    drawWeather();                           // дождь/снег/светлячки — передний план
    drawPetals();
    drawEmbers();
    if (flash > 0) {
      ctx.fillStyle = 'rgba(235,240,255,' + (flash * 0.55).toFixed(2) + ')';
      ctx.fillRect(0, 0, CFG.width, CFG.height);
    }
    ctx.drawImage(vinC, 0, 0);
    if (mode === 'duel') drawDuelHUD();
  }

  /* ---------- HUD дуэли (на canvas) ---------- */

  function drawDuelHUD() {
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    // полоса игрока 1
    bar(20, 18, 240, '#e53935', duel.p1.p.hp / CFG.duel.hp, T.duelP1);
    // полоса игрока 2
    bar(CFG.width - 260, 18, 240, '#1e88e5', duel.p2.p.hp / CFG.duel.hp, T.duelP2, true);
    // счёт раундов
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Impact, "Arial Black", sans-serif';
    ctx.fillText(duel.s1 + ' : ' + duel.s2, CFG.width / 2, 36);
    for (let i = 0; i < CFG.duel.roundsToWin; i++) {
      ctx.fillStyle = i < duel.s1 ? '#e53935' : 'rgba(255,255,255,.2)';
      ctx.beginPath(); ctx.arc(CFG.width / 2 - 40, 30, 4, 0, 7); ctx.fill();
      ctx.fillStyle = i < duel.s2 ? '#1e88e5' : 'rgba(255,255,255,.2)';
      ctx.beginPath(); ctx.arc(CFG.width / 2 + 40, 30, 4, 0, 7); ctx.fill();
    }
    if (duel.phase === 'roundEnd') {
      ctx.font = 'bold 44px Impact, "Arial Black", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 4;
      const loser = duel.p1.p.state === 'dead' ? T.duelP2 : T.duelP1;
      ctx.strokeText(loser + ' ПРОИГРАЛ РАУНД', CFG.width / 2, 200);
      ctx.fillText(loser + ' ПРОИГРАЛ РАУНД', CFG.width / 2, 200);
    }

    function bar(x, y, w, color, k, name, right) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(x - 2, y - 2, w + 4, 16);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w * Math.max(0, Math.min(1, k)), 12);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      if (right) { ctx.textAlign = 'right'; ctx.fillText(name, x + w, y - 6); }
      else { ctx.textAlign = 'left'; ctx.fillText(name, x, y - 6); }
      ctx.textAlign = 'left';
    }
  }

  /* ---------- цикл ---------- */

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (state !== 'pause') update(dt);
    draw();
  }

  /* ---------- ввод ---------- */

  const JUMP_CODES = ['Space', 'ArrowUp', 'KeyW'];

  function isJumpKey(e) {
    return JUMP_CODES.indexOf(e.code) !== -1 ||
           e.key === ' ' || e.key === 'ArrowUp' ||
           e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц';
  }
  function isPauseKey(e) {
    return e.code === 'KeyP' || e.code === 'Escape' ||
           e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З';
  }
  function isThrowKey(e) {
    return e.code === 'KeyX' || e.key === 'x' || e.key === 'X' || e.key === 'ч' || e.key === 'Ч';
  }
  function isDuelKey(e) {
    return ['KeyA', 'KeyD', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].indexOf(e.code) !== -1;
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (isJumpKey(e)) {
        e.preventDefault();
        RA.Sound.ensure();
        if (mode === 'duel') {
          if (e.code === 'Space' || e.code === 'KeyW') {
            if (state === 'play' && duel.p1) duel.p1.tryJump();
            return;
          }
          if (e.code === 'ArrowUp') {
            if (state === 'play' && duel.p2) duel.p2.tryJump();
            return;
          }
          return;
        }
        if (state === 'menu') start();
        else if (state === 'dead' && overShown) restart();
        else if (state === 'pause') setPause(false);
        else { RA.Player.p.holdJump = true; RA.Player.tryJump(); }
      } else if (isPauseKey(e)) {
        if (state === 'play') setPause(true);
        else if (state === 'pause') setPause(false);
      } else if (isThrowKey(e)) {
        if (mode === 'duel' && state === 'play' && duel.p1) duelThrow(duel.p1, duel.p2);
        else throwWeapon();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyC' ||
                 e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С') {
        doDash();
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
        RA.UI.soundIcon(RA.Sound.toggle());
      }
    // дуэль: зажатия клавиш движения
    if (mode === 'duel') {
      if (e.code === 'KeyA') duelKeys.a = 1;
      if (e.code === 'KeyD') duelKeys.d = 1;
      if (e.code === 'ArrowLeft') duelKeys.left = 1;
      if (e.code === 'ArrowRight') duelKeys.right = 1;
      if (e.repeat) return;   // автоповтор не должен дёргать прыжки/броски
      if (e.code === 'KeyW' && state === 'play' && duel.p1) duel.p1.tryJump();
      if (e.code === 'KeyS' && state === 'play' && duel.p1) duelThrow(duel.p1, duel.p2);
      if (e.code === 'ArrowUp' && state === 'play' && duel.p2) duel.p2.tryJump();
      if (e.code === 'ArrowDown' && state === 'play' && duel.p2) duelThrow(duel.p2, duel.p1);
    }
    });
    window.addEventListener('keyup', function (e) {
      if (isJumpKey(e)) RA.Player.p.holdJump = false;
      if (e.code === 'KeyA') duelKeys.a = 0;
      if (e.code === 'KeyD') duelKeys.d = 0;
      if (e.code === 'KeyS') duelKeys.s = 0;
      if (e.code === 'ArrowLeft') duelKeys.left = 0;
      if (e.code === 'ArrowRight') duelKeys.right = 0;
      if (e.code === 'ArrowDown') duelKeys.down = 0;
    });

    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      RA.Sound.ensure();
      if (mode === 'duel') return;
      RA.Player.p.holdJump = true;
      RA.Player.tryJump();
    });
    window.addEventListener('pointerup', function () { RA.Player.p.holdJump = false; });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state === 'play') setPause(true);
    });
  }

  /* ---------- инициализация ---------- */

  function init() {
    // Telegram Mini App: развернуть игру на весь экран внутри Telegram
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        if (window.Telegram.WebApp.disableVerticalSwipes) window.Telegram.WebApp.disableVerticalSwipes();
      } catch (e) {}
    }
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CFG.width * dpr;
    canvas.height = CFG.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bake();
    bindInput();
    RA.World.reset();
    RA.Player.reset();
    pal = resolvePal(palTo);
    RA.UI.soundIcon(RA.Sound.isMuted());
    RA.UI.updateHUD(0, 0, 0, 1, best, 0, RA.Save.get().gold);
    RA.UI.showMenu(best);
    requestAnimationFrame(loop);
  }

  function toMenu() {
    mode = 'endless';
    state = 'menu';
    campaign = { active: false, idx: 0, goal: 0 };
    RA.World.reset();
    RA.Player.reset();
    camX = -100;
    RA.UI.setDuelHUD(false);
    RA.UI.setPlaying(false);
    RA.UI.showMenu(best);
  }

  function nextLevel() {
    startCampaign(Math.min(campaign.idx + 1, CFG.campaign.levels - 1));
  }

  function doDash() {
    if (mode === 'duel' || state !== 'play') return;
    RA.Player.doDash(api);
  }

  const api = {
    init: init,
    start: start,
    startCampaign: startCampaign,
    startDuel: startDuel,
    restart: restart,
    toMenu: toMenu,
    nextLevel: nextLevel,
    die: die,
    onCoin: onCoin,
    onStomp: onStomp,
    onWeaponKill: onWeaponKill,
    onBossKill: onBossKill,
    onShieldHit: onShieldHit,
    onExplosion: onExplosion,
    addShake: function (v) { shake = Math.max(shake, v); },
    throwWeapon: throwWeapon,
    doDash: doDash,
    get speed() { return speed; },
    get time() { return time; },
    get magnet() { return magnetLvl; },
    get jumpLvl() { return jumpLvl; },
    get difficulty() { return difficulty; },
    get solids() { return RA.World.state.solids; },
    get duelPlayers() { return mode === 'duel' ? [duel.p1, duel.p2] : null; },
    getSpeed: function () { return speed; },
    sfx: sfx,
    // тестовый хук: ручной шаг кадра (используется автотестами)
    debugStep: function (dt) { update(Math.min(dt, 0.05)); draw(); }
  };

  return api;
})();

document.addEventListener('DOMContentLoaded', function () {
  RA.UI.init();
  RA.Game.init();
});
