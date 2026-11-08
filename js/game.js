/* ============================================================
   ИГРА — цикл, камера, очки, уровни, звук, фон
   ============================================================ */

window.RA = window.RA || {};

RA.Game = (function () {
  const CFG = RA.CONFIG;
  const T = CFG.texts;

  let ctx, canvas;
  let state = 'menu';            // menu | play | dead | pause
  let speed = 0, stomps = 0, coinsN = 0, dist = 0, level = 1;
  let time = 0, camX = 0, shake = 0;
  let deathT = 0, overShown = false;
  let best = RA.Save.get().best || 0;   // рекорд теперь живёт в общем сохранении
  // магазин: кошелёк, оружие и прокачка
  let runGold = 0;          // золото, собранное за текущий забег
  let weaponId = 'none';    // экипированное оружие
  let wcd = 0;              // перезарядка броска, сек
  let magnetLvl = 0, walletLvl = 0, jumpLvl = 0;

  let skyC, vinC, pitGrad;
  let last = 0;

  function score() {
    return Math.floor(dist) + coinsN * CFG.score.coinValue + stomps * CFG.score.stompValue;
  }

  /* ---------- звук (простые «бипы» на WebAudio, без файлов) ---------- */
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, muted = !CFG.sound;

  const sfx = {
    ensure: function () {
      if (!AC) return;
      if (!ac) ac = new AC();
      if (ac.state === 'suspended') ac.resume();
    },
    toggle: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },
    beep: function (f0, f1, dur, type, vol, delay) {
      if (muted || !ac) return;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    jump:  function () { this.beep(300, 560, 0.12); },
    jump2: function () { this.beep(360, 660, 0.11); },
    coin:  function () { this.beep(950, 1500, 0.08, 'sine', 0.12); this.beep(1275, 1900, 0.1, 'sine', 0.1, 0.06); },
    stomp: function () { this.beep(280, 70, 0.2, 'sawtooth', 0.2); },
    die:   function () { this.beep(420, 60, 0.5, 'sawtooth', 0.22); },
    grab:  function () { this.beep(180, 240, 0.06, 'triangle', 0.1); },
    throwK: function () { this.beep(720, 320, 0.09, 'triangle', 0.14); },
    level: function () { const n = [523, 659, 784, 1046]; for (let i = 0; i < n.length; i++) this.beep(n[i], n[i], 0.12, 'square', 0.12, i * 0.09); }
  };

  /* ---------- управление состоянием ---------- */

  function start() {
    RA.World.reset();
    RA.Player.reset();
    RA.Particles.clear();
    RA.Projectiles.clear();
    speed = CFG.player.speedStart;
    stomps = 0; coinsN = 0; dist = 0; level = 1;
    camX = -100; shake = 0;
    overShown = false;
    state = 'play';

    // экипировка и прокачка из сохранения
    const d = RA.Save.get();
    RA.Player.p.shields = d.up.shield || 0;
    RA.Player.p.invuln = 0;
    magnetLvl = d.up.magnet || 0;
    walletLvl = d.up.wallet || 0;
    jumpLvl = d.up.jump || 0;
    weaponId = d.weapon;
    wcd = 0;
    runGold = 0;

    RA.UI.hideOverlays();
    RA.UI.setPlaying(true);   // в игре: прячем «Установить» и «Скачать»
    // в Telegram (в том числе на iPhone) включаем настоящий полный экран
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.requestFullscreen) {
      try { window.Telegram.WebApp.requestFullscreen(); } catch (e) {}
    }
    sfx.ensure();
  }

  function die(cause) {
    if (state !== 'play') return;
    state = 'dead';
    deathT = 0; overShown = false;
    RA.Player.die(cause, { speed: speed });
    shake = 9;
    sfx.die();
  }

  function onCoin(c) {
    coinsN++;
    runGold += CFG.shop.goldPerCoin * (1 + 0.1 * walletLvl);   // в кошелёк, с бонусом прокачки
    sfx.coin();
    RA.Particles.burst(c.x, c.y, '#ffd54f', 7, { life: 0.5, spread: 90, up: 130, size: 3 });
    RA.Particles.pop(c.x, c.y - 16, '+' + CFG.score.coinValue, '#ffd54f');
  }

  function onStomp(g) {
    stomps++;
    sfx.stomp();
    shake = Math.max(shake, 5);
    RA.Particles.burst(g.x + g.w / 2, g.y - g.h, '#ffd54f', 10, { life: 0.6, spread: 120, up: 160, size: 4 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 12, '+' + CFG.score.stompValue, '#ffe082');
  }

  /* ---------- оружие и щиты ---------- */

  function curWeapon() {
    return RA.CONFIG.shop.weapons.find(function (w) { return w.id === weaponId; }) || null;
  }

  function throwWeapon() {
    if (state !== 'play') return;
    const w = curWeapon();
    if (!w || w.id === 'none' || wcd > 0) return;
    wcd = w.cooldown;
    const p = RA.Player.p;
    RA.Projectiles.throw(w.id, p.x + p.w - 2, p.y + p.h * 0.35, w.speed, w.pierce);
    sfx.throwK();
  }

  // стражник обезврежен метательным оружием
  function onWeaponKill(g) {
    stomps++;
    sfx.stomp();
    shake = Math.max(shake, 4);
    RA.Particles.burst(g.x + g.w / 2, g.y - g.h / 2, '#ff8a80', 8, { life: 0.5, spread: 110, up: 130, size: 3 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 12, '+' + CFG.score.stompValue, '#ff8a80');
  }

  // щит спас от стражника
  function onShieldHit(g) {
    sfx.stomp();
    shake = Math.max(shake, 6);
    RA.Particles.burst(RA.Player.p.x + RA.Player.p.w / 2, RA.Player.p.y + RA.Player.p.h / 2, '#90caf9', 12, { life: 0.6, spread: 140, up: 160, size: 4 });
    RA.Particles.pop(g.x + g.w / 2, g.y - g.h - 12, 'ЩИТ!', '#90caf9');
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

    if (state === 'play') {
      speed = Math.min(CFG.player.speedMax, speed + CFG.player.speedGain * dt);
      RA.World.ensure(camX, speed);
      RA.Player.update(dt, api);
      if (RA.Player.p.state !== 'dead') dist = Math.max(dist, RA.Player.p.x / CFG.score.meterDiv);

      // уровень: каждые levelEvery метров — ускорение и баннер
      const nl = Math.floor(dist / CFG.levelEvery) + 1;
      if (nl > level) {
        level = nl;
        speed = Math.min(CFG.player.speedMax, speed + CFG.player.speedLevelBonus);
        RA.UI.banner(T.levelWord + ' ' + level);
        sfx.level();
      }

      RA.Coins.update(dt, RA.Player.p, api);
      RA.Guards.update(dt, RA.Player.p, api);
      RA.Projectiles.update(dt, RA.World.state.guards, api);
      if (wcd > 0) wcd -= dt;

      // камера плавно догоняет героя
      const target = RA.Player.p.x - 260;
      camX += (target - camX) * Math.min(1, dt * 7);

      // упал в овраг?
      if (RA.Player.p.y > CFG.height + 80) die('pit');

    } else if (state === 'dead') {
      RA.Player.update(dt, api);
      deathT += dt;
      if (deathT > 1.05 && !overShown) {
        overShown = true;
        const sc = score();
        const record = sc > best;
        if (record) { best = sc; RA.Save.get().best = best; RA.Save.save(); }
        // заработанное золото — в кошелёк (сохранение)
        const earned = Math.floor(runGold);
        const d = RA.Save.get();
        d.gold += earned;
        RA.Save.save();
        RA.UI.setWallet(d.gold);
        RA.UI.gameOver({
          title: RA.Player.p.cause === 'guard' ? T.caughtTitle : T.pitTitle,
          score: sc, coins: coinsN, dist: Math.floor(dist), best: best, record: record,
          toWallet: earned
        });
        RA.UI.setPlaying(false);   // на экране результата кнопки возвращаются
        // выходим из полного экрана Telegram — показываем панель с кнопками
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.exitFullscreen) {
          try { window.Telegram.WebApp.exitFullscreen(); } catch (e) {}
        }
      }
    }

    RA.Particles.update(dt);
    shake = Math.max(0, shake - dt * 26);

    if (state === 'play') {
      const walletNow = RA.Save.get().gold + Math.floor(runGold);
      RA.UI.updateHUD(score(), coinsN, Math.floor(dist), level, best, RA.Player.p.shields, walletNow);
    }
  }

  /* ---------- фон: закат, луна, горы, пагоды, облака ---------- */

  function bake() {
    // печать фона в двойном разрешении — рисуем в логических координатах
    const S = 2;
    skyC = document.createElement('canvas');
    skyC.width = CFG.width * S; skyC.height = CFG.height * S;
    const c = skyC.getContext('2d');
    c.scale(S, S);
    const g = c.createLinearGradient(0, 0, 0, CFG.height);
    g.addColorStop(0, '#1a0c22'); g.addColorStop(0.45, '#5c1f33');
    g.addColorStop(0.75, '#a63c3c'); g.addColorStop(1, '#e8814f');
    c.fillStyle = g; c.fillRect(0, 0, CFG.width, CFG.height);
    // тёплое зарево над горизонтом
    const hg = c.createRadialGradient(CFG.width * 0.5, CFG.groundY + 30, 30,
                                      CFG.width * 0.5, CFG.groundY + 30, 540);
    hg.addColorStop(0, 'rgba(255,170,110,.45)');
    hg.addColorStop(1, 'rgba(255,170,110,0)');
    c.fillStyle = hg; c.fillRect(0, CFG.groundY - 260, CFG.width, 300);
    // звёзды
    for (let i = 0; i < 70; i++) {
      const x = RA.hash(i * 3 + 1) * CFG.width, y = RA.hash(i * 7 + 2) * 220;
      const big = RA.hash(i * 5) < 0.2;
      c.fillStyle = 'rgba(255,240,220,' + (0.25 + RA.hash(i) * 0.5).toFixed(2) + ')';
      c.fillRect(x, y, big ? 2 : 1.3, big ? 2 : 1.3);
    }
    // луна с ореолом
    const mg = c.createRadialGradient(740, 110, 10, 740, 110, 90);
    mg.addColorStop(0, 'rgba(255,236,210,.9)');
    mg.addColorStop(0.25, 'rgba(255,220,190,.35)');
    mg.addColorStop(1, 'rgba(255,220,190,0)');
    c.fillStyle = mg; c.beginPath(); c.arc(740, 110, 90, 0, 7); c.fill();
    c.fillStyle = '#ffe9d2'; c.beginPath(); c.arc(740, 110, 34, 0, 7); c.fill();
    c.fillStyle = 'rgba(230,180,150,.5)';
    c.beginPath(); c.arc(728, 102, 6, 0, 7); c.fill();
    c.beginPath(); c.arc(752, 120, 4, 0, 7); c.fill();
    c.beginPath(); c.arc(748, 96, 3, 0, 7); c.fill();
    // дымка у горизонта (глубина)
    const fog = c.createLinearGradient(0, CFG.groundY - 90, 0, CFG.groundY + 20);
    fog.addColorStop(0, 'rgba(255,190,150,0)');
    fog.addColorStop(1, 'rgba(255,190,150,.22)');
    c.fillStyle = fog; c.fillRect(0, CFG.groundY - 90, CFG.width, 110);

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

    initLanterns(); initBirds(); initPetals(); initEmbers();
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
    // дальний хребет — светлее (атмосферная перспектива = глубина)
    const off2 = camX * 0.12, p2 = 520, b2 = CFG.groundY + 12;
    const j0 = Math.floor(off2 / p2) - 1;
    ctx.fillStyle = '#6b2438';
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
    ctx.fillStyle = '#4a1626';
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

  /* ---------- фонари, птицы и лепестки (живой фон) ---------- */

  let lanterns = [], birds = [], petals = [], embers = [];

  function initEmbers() {
    embers = [];
    for (let i = 0; i < 26; i++) embers.push(newEmber(true));
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
    const span = 3440, off = camX * 0.35;
    for (let i = 0; i < lanterns.length; i++) {
      const l = lanterns[i];
      let sx = ((l.x0 - off) % span + span) % span - 60;
      if (sx > CFG.width + 60) continue;
      const sy = l.y + Math.sin(time * 0.8 + l.ph) * 8;
      const s = l.s;
      ctx.fillStyle = 'rgba(255,150,60,.16)';                    // тёплое свечение
      ctx.beginPath(); ctx.arc(sx, sy, 15 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff9d3c';                                 // корпус
      RA.rr(ctx, sx - 5 * s, sy - 7 * s, 10 * s, 14 * s, 4 * s); ctx.fill();
      ctx.fillStyle = '#ffd9a0';                                 // огонёк
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
    for (let i = 0; i < 30; i++) petals.push(newPetal(true));
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

  function drawPagodas() {
    const off = camX * 0.45, period = 470, baseY = CFG.groundY + 12;
    const i0 = Math.floor(off / period) - 1;
    ctx.fillStyle = '#35101e';
    for (let i = i0; i < i0 + Math.ceil(CFG.width / period) + 3; i++) {
      if (RA.hash(i * 31) < 0.3) continue;           // не на каждом холме
      const bx = i * period - off + 80;
      const tiers = 2 + Math.floor(RA.hash(i * 9) * 2);
      let y = baseY, w = 100 + RA.hash(i * 3) * 40;
      // ярус за ярусом
      for (let t = 0; t < tiers; t++) {
        ctx.fillRect(bx - w / 2 + 14, y - 18, w - 28, 18);   // тело яруса
        ctx.beginPath();                                      // крыша
        ctx.moveTo(bx - w / 2 - 10, y);
        ctx.lineTo(bx - w / 2, y - 20);
        ctx.lineTo(bx + w / 2, y - 20);
        ctx.lineTo(bx + w / 2 + 10, y);
        ctx.closePath(); ctx.fill();
        y -= 26; w *= 0.78;
      }
      ctx.fillRect(bx - 2, y - 16, 4, 16);                    // шпиль
      ctx.beginPath(); ctx.arc(bx, y - 18, 3, 0, 7); ctx.fill();
    }
  }

  /* ---------- отрисовка кадра ---------- */

  function draw() {
    ctx.drawImage(skyC, 0, 0, CFG.width, CFG.height);
    drawClouds();
    drawMountains();
    drawPagodas();
    drawLanterns();
    drawBirds();
    ctx.fillStyle = pitGrad;
    ctx.fillRect(0, CFG.groundY + 40, CFG.width, CFG.height - CFG.groundY - 40);

    const sx = shake ? (Math.random() * 2 - 1) * shake : 0;
    const sy = shake ? (Math.random() * 2 - 1) * shake : 0;

    // тряска экрана; сдвиг мира уже учтён внутри отрисовщиков (x - cam),
    // поэтому здесь НЕ сдвигаем на -camX, иначе всё уедет вдвое быстрее
    ctx.save();
    ctx.translate(sx, sy);
    RA.World.draw(ctx, camX);
    RA.Coins.draw(ctx, camX, time);
    RA.Guards.draw(ctx, camX, time);
    RA.Player.draw(ctx, camX, time);
    RA.Particles.draw(ctx, camX);
    ctx.restore();

    drawPetals();                    // лепестки на переднем плане — глубина
    drawEmbers();                    // тлеющие угли
    ctx.drawImage(vinC, 0, 0);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    if (state !== 'pause') update(dt);
    draw();
  }

  /* ---------- ввод ---------- */

  const JUMP_CODES = ['Space', 'ArrowUp', 'KeyW'];

  // распознаём клавиши и по code, и по key — надёжно на любой раскладке
  function isJumpKey(e) {
    return JUMP_CODES.indexOf(e.code) !== -1 ||
           e.key === ' ' || e.key === 'ArrowUp' ||
           e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц';
  }
  function isPauseKey(e) {
    return e.code === 'KeyP' || e.code === 'Escape' ||
           e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З';
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      if (isJumpKey(e)) {
        e.preventDefault();
        sfx.ensure();
        if (state === 'menu') start();
        else if (state === 'dead' && overShown) start();
        else if (state === 'pause') setPause(false);
        else { RA.Player.p.holdJump = true; RA.Player.tryJump(); }
      } else if (isPauseKey(e)) {
        if (state === 'play') setPause(true);
        else if (state === 'pause') setPause(false);
      } else if (e.code === 'KeyX' || e.key === 'x' || e.key === 'X' || e.key === 'ч' || e.key === 'Ч') {
        throwWeapon();
      } else if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
        RA.UI.soundIcon(sfx.toggle());
      }
    });
    window.addEventListener('keyup', function (e) {
      if (isJumpKey(e)) RA.Player.p.holdJump = false;
    });

    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      sfx.ensure();
      RA.Player.p.holdJump = true;
      RA.Player.tryJump();
    });
    window.addEventListener('pointerup', function () { RA.Player.p.holdJump = false; });

    // авто-пауза при уходе со вкладки
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
    // рендер в двойном разрешении: чёткая картинка на современных экранах
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CFG.width * dpr;
    canvas.height = CFG.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bake();
    bindInput();
    RA.World.reset();
    RA.Player.reset();
    RA.UI.soundIcon(muted);
    RA.UI.updateHUD(0, 0, 0, 1, best, 0, RA.Save.get().gold);
    RA.UI.showMenu(best);
    requestAnimationFrame(loop);
  }

  const api = {
    init: init,
    start: start,
    die: die,
    onCoin: onCoin,
    onStomp: onStomp,
    onWeaponKill: onWeaponKill,
    onShieldHit: onShieldHit,
    throwWeapon: throwWeapon,
    get speed() { return speed; },     // живая скорость для физики игрока
    get time() { return time; },       // живое время для анимаций сущностей
    get magnet() { return magnetLvl; },// уровень магнита (для притяжения золота)
    get jumpLvl() { return jumpLvl; }, // уровень прыгучести (для силы прыжка)
    getSpeed: function () { return speed; },
    sfx: sfx
  };

  return api;
})();

document.addEventListener('DOMContentLoaded', function () {
  RA.UI.init();     // сначала построить HUD/меню/рейтинг
  RA.Game.init();   // затем запустить игру
});
