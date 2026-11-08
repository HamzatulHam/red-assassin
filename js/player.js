/* ============================================================
   ИГРОК — фабрика персонажей
   ------------------------------------------------------------
   RA.createPlayer(opts) создаёт героя:
   - обычный раннер (авто-бег вправо),
   - свободное перемещение для дуэли (freeMove),
   - плащ с капюшоном (скины с cloak: true),
   - разворот влево/вправо (facing).
   RA.Player — главный герой (совместимость со старым кодом).
   ============================================================ */

window.RA = window.RA || {};

RA.createPlayer = function (opts) {
  opts = opts || {};
  const CFG = RA.CONFIG;

  const P = {
    id: opts.id || 'p1',
    x: 0, y: 0, w: CFG.player.w, h: CFG.player.h,
    vy: 0, kvx: 0,
    onGround: false, jumps: 0,
    state: 'run',                 // run | air | climb | dead
    climbRef: null,
    coyote: 0, buffer: 0, noClimb: 0,
    holdJump: false,
    runPhase: 0,
    deadT: 0, deadRot: 0, cause: null,
    colors: Object.assign({}, CFG.player.colors),
    cloak: false,
    shields: 0, invuln: 0,
    dashT: 0, dashCd: 0, dashesUsed: 0,
    kvx2: 0,
    /* дуэль / свободное движение */
    freeMove: !!opts.freeMove,
    facing: opts.facing || 1,
    dir: 0,
    hp: CFG.duel.hp, maxHp: CFG.duel.hp,
    hitCd: 0,
    spawnX: opts.spawnX != null ? opts.spawnX : 160,
    spawnY: opts.spawnY != null ? opts.spawnY : CFG.groundY - CFG.player.h
  };

  function applySkin(skin) {
    P.colors = Object.assign({}, CFG.player.colors, {
      suit: skin.suit, suit2: skin.suit2, scarf: skin.scarf,
      skin: skin.skin || CFG.player.colors.skin,
      eye: skin.eye || CFG.player.colors.eye
    });
    P.cloak = !!skin.cloak;
  }

  function reset() {
    P.x = P.spawnX; P.y = P.spawnY;
    P.vy = 0; P.kvx = 0; P.kvx2 = 0;
    P.onGround = true; P.jumps = 0; P.state = P.freeMove ? 'idle' : 'run';
    P.climbRef = null; P.coyote = 0; P.buffer = 0; P.noClimb = 0;
    P.holdJump = false; P.runPhase = 0;
    P.deadT = 0; P.deadRot = 0; P.cause = null;
    P.shields = 0; P.invuln = 0; P.hitCd = 0;
    P.dir = 0; P.facing = opts.facing || 1;
    // костюм из магазина (только у главного героя)
    if (!P.freeMove || opts.useShopSkin) {
      const d = RA.Save.get();
      const skin = CFG.shop.skins.find(function (s) { return s.id === d.skin; }) || CFG.shop.skins[0];
      applySkin(skin);
    } else if (opts.colors) {
      applySkin(opts.colors);
    }
  }

  function tryJump() { P.buffer = 0.12; }

  // рывок: короткий бросок вперёд с неуязвимостью
  function doDash(game) {
    if (P.dashCd > 0 || P.state === 'dead' || P.state === 'climb') return;
    P.dashT = CFG.player.dashTime;
    P.dashCd = CFG.player.dashCd;
    P.dashesUsed++;
    RA.Sound.sfx.throwK();
  }

  function die(cause, game) {
    if (P.state === 'dead') return;
    P.state = 'dead'; P.cause = cause;
    P.deadT = 0; P.deadRot = 0;
    if (cause === 'guard') { P.vy = -420; P.kvx = -(game.speed || 300) * 0.35; }
    else { P.kvx = 0; }
    RA.Particles.burst(P.x + P.w / 2, P.y + P.h / 2, '#eceff1', 10, { life: 0.6, spread: 150, up: 180, size: 3 });
  }

  // дуэльное поражение: отбрасывание + урон
  function hurt(dmg, fromX, game) {
    if (P.invuln > 0 || P.state === 'dead') return false;
    P.hp -= dmg || 1;
    P.invuln = CFG.duel.hitInvuln;
    P.vy = -260;
    P.kvx2 = (P.x + P.w / 2 < fromX ? -1 : 1) * 260;
    RA.Particles.burst(P.x + P.w / 2, P.y + P.h / 2, '#ff8a80', 8, { life: 0.5, spread: 120, up: 140 });
    if (P.hp <= 0) { P.hp = 0; P.state = 'dead'; P.deadT = 0; P.vy = -380; }
    return true;
  }

  function update(dt, game) {
    const C = CFG.player;

    if (P.state === 'dead') {
      P.deadT += dt; P.deadRot += 6.5 * dt;
      P.vy = Math.min(P.vy + C.gravity * dt, 1300);
      P.x += P.kvx * dt; P.kvx *= Math.pow(0.2, dt);
      P.y += P.vy * dt;
      return;
    }

    if (P.invuln > 0) P.invuln -= dt;
    if (P.hitCd > 0) P.hitCd -= dt;
    if (P.dashCd > 0) P.dashCd -= dt;

    // рывок: рывок вперёд + неуязвимость + шлейф
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.invuln = Math.max(P.invuln, 0.06);
      P.x += (P.freeMove ? P.facing : 1) * CFG.player.dashSpeed * dt;
      if (Math.random() < dt * 40) {
        RA.Particles.burst(P.x + P.w / 2, P.y + P.h / 2, P.colors.suit, 1, { life: 0.3, spread: 10, up: 10 });
      }
    }
    if (P.onGround) P.coyote = 0.09; else P.coyote = Math.max(0, P.coyote - dt);
    P.buffer = Math.max(0, P.buffer - dt);
    P.noClimb = Math.max(0, P.noClimb - dt);

    // прыжок (буфер)
    const jk = 1 + 0.05 * (game.jumpLvl || 0);
    if (P.buffer > 0 && P.state !== 'climb') {
      if (P.onGround || P.coyote > 0) {
        P.vy = -C.jumpV * jk; P.onGround = false; P.coyote = 0;
        P.jumps = 1; P.buffer = 0; P.state = 'air';
        RA.Particles.burst(P.x + P.w / 2, P.y + P.h, '#a1887f', 5, { life: 0.4, spread: 60, up: 60 });
        game.sfx.jump();
      } else if (P.jumps < 2) {
        P.vy = -C.jump2V * jk; P.jumps = 2; P.buffer = 0; P.state = 'air';
        RA.Particles.ring(P.x + P.w / 2, P.y + P.h);
        game.sfx.jump2();
      }
    }

    /* ---------- лазание ---------- */
    if (P.state === 'climb') {
      const s = P.climbRef;
      P.y -= C.climbSpeed * dt;
      P.runPhase += dt * 10;
      if (Math.random() < dt * 22) {
        RA.Particles.burst(s.x, P.y + P.h - Math.random() * P.h, '#8d6e63', 1, { life: 0.5, spread: 40, up: 40, dir: -1 });
      }
      if (P.y + P.h <= s.y) {
        P.y = s.y - P.h; P.vy = 0;
        P.onGround = true; P.jumps = 0;
        P.state = P.freeMove ? 'idle' : 'run'; P.climbRef = null; P.x += 6;
        RA.Particles.burst(P.x + P.w / 2, P.y + P.h, '#a1887f', 6, { life: 0.4, spread: 60, up: 50 });
      } else if (P.buffer > 0) {
        P.buffer = 0; P.noClimb = 0.3;
        P.state = 'air'; P.vy = -C.jumpV * 0.95;
        P.climbRef = null; P.onGround = false; P.x -= P.facing * 14;
        game.sfx.jump();
      }
      return;
    }

    /* ---------- движение ---------- */
    if (P.freeMove) {
      // дуэль: бег в сторону, разворот
      const sp = CFG.duel.speed;
      P.x += P.dir * sp * dt;
      P.x += P.kvx2 * dt; P.kvx2 *= Math.pow(0.05, dt);
      P.x = Math.max(8, Math.min(CFG.width - P.w - 8, P.x));
      if (P.dir !== 0) { P.facing = P.dir; P.runPhase += dt * 11; P.state = 'run'; }
      else P.state = P.onGround ? 'idle' : P.state;
    } else {
      P.x += game.speed * dt;
      P.runPhase += game.speed * dt * 0.045;
      if (P.onGround && Math.random() < dt * 14) {
        RA.Particles.burst(P.x + 4, P.y + P.h - 2, '#7a5c44', 1, { life: 0.4, spread: 30, up: 40, dir: -1 });
      }
    }

    P.vy += C.gravity * ((P.holdJump && P.vy < 0) ? C.holdAssist : 1) * dt;
    P.vy = Math.min(P.vy, 1200);

    const prevBottom = P.y + P.h, prevTop = P.y, prevRight = P.x + P.w;
    P.y += P.vy * dt;

    const wasGround = P.onGround;
    P.onGround = false;
    const solids = game.solids || RA.World.state.solids;

    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (P.x + P.w <= s.x || P.x >= s.x + s.w) continue;
      if (P.vy >= 0 && P.y + P.h >= s.y &&
          (prevBottom <= s.y + 1 || P.y + P.h <= s.y + 28)) {
        P.y = s.y - P.h; P.vy = 0;
        P.onGround = true; P.jumps = 0; P.climbRef = null;
        P.state = P.freeMove && P.dir === 0 ? 'idle' : 'run';
        if (!wasGround) {
          RA.Particles.burst(P.x + P.w / 2, P.y + P.h, '#8d6e63', 6, { life: 0.45, spread: 70, up: 60 });
          game.sfx.land && game.sfx.land();
        }
      } else if (P.vy < 0 && prevTop >= s.y + s.h - 1 && P.y < s.y + s.h) {
        P.y = s.y + s.h; P.vy = 0;
      }
    }

    // боковая грань → лазание (в дуэли не лазаем)
    if (!P.freeMove && P.noClimb <= 0) {
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        if (s.kind === 'beam' || P.climbRef === s) continue;
        if (prevRight <= s.x + 1 && P.x + P.w > s.x &&
            P.y + P.h > s.y + 26 && P.y < s.y + s.h - 4) {
          P.state = 'climb'; P.climbRef = s;
          P.x = s.x - P.w; P.vy = 0; P.onGround = false;
          game.sfx.grab();
          break;
        }
      }
    }
  }

  /* ---------- отрисовка ---------- */
  function leg(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function draw(ctx, cam, t) {
    const C = P.colors;
    const spd = (RA.Game && RA.Game.getSpeed) ? RA.Game.getSpeed() : 0;
    const cx = P.x - cam + P.w / 2, cy = P.y + P.h / 2;

    if (P.onGround && P.state !== 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx, P.y + P.h + 3, 15, 4, 0, 0, 7); ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (P.facing < 0) ctx.scale(-1, 1);
    if (P.state === 'dead') ctx.rotate(P.deadRot);
    if (P.invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.35;

    const lp = Math.sin(P.runPhase), lp2 = Math.sin(P.runPhase + Math.PI);
    ctx.lineCap = 'round';

    if (P.cloak) {
      /* ============ АССАСИН В ПЛАЩЕ: капюшон закрывает всё тело ============ */
      // ноги скрыты — вместо них колышущийся плащ
      const sway = Math.sin(P.runPhase * 0.8) * 3;
      const lift = P.state === 'air' ? -4 : 0;
      ctx.fillStyle = C.suit;
      ctx.beginPath();
      ctx.moveTo(-7, -14);                          // плечи
      ctx.quadraticCurveTo(-14 - sway, 4 + lift, -9 + sway, 22 + lift);   // левый край плаща
      ctx.lineTo(7, 24 + lift);                     // низ
      ctx.quadraticCurveTo(13 + sway, 6 + lift, 8, -14);  // правый край
      ctx.closePath(); ctx.fill();
      // тень складок
      ctx.fillStyle = C.suit2;
      ctx.beginPath();
      ctx.moveTo(-2, -10);
      ctx.quadraticCurveTo(-6 - sway, 6, -3 + sway, 21 + lift);
      ctx.lineTo(2, 22 + lift);
      ctx.quadraticCurveTo(-1, 6, 2, -10);
      ctx.closePath(); ctx.fill();
      // капюшон: острая вершина
      ctx.fillStyle = C.suit;
      ctx.beginPath();
      ctx.moveTo(-9, -14);
      ctx.quadraticCurveTo(-8, -30, 3, -28);        // затылок к вершине капюшона
      ctx.quadraticCurveTo(14, -26, 12, -15);
      ctx.quadraticCurveTo(2, -8, -9, -14);
      ctx.closePath(); ctx.fill();
      // тень внутри капюшона
      ctx.fillStyle = 'rgba(5,5,10,.92)';
      ctx.beginPath(); ctx.ellipse(5, -17, 6.5, 5, -0.15, 0, 7); ctx.fill();
      // светящиеся глаза во тьме
      ctx.fillStyle = C.eye;
      ctx.fillRect(2.5, -19, 2.6, 2.2);
      ctx.fillRect(6.8, -19, 2.6, 2.2);
      // шарф
      ctx.strokeStyle = C.scarf; ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-4, -11);
      for (let i = 1; i <= 4; i++) {
        ctx.lineTo(-4 - i * (6 + spd * 0.006), -11 + Math.sin(t * 9 - i * 1.2) * 2.5 + i * 1.1);
      }
      ctx.stroke();
    } else {
      /* ============ КЛАССИЧЕСКИЙ НИНДЗЯ ============ */
      // шарф
      ctx.strokeStyle = C.scarf; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-2, -11);
      for (let i = 1; i <= 4; i++) {
        ctx.lineTo(-2 - i * (6 + spd * 0.006), -11 + Math.sin(t * 9 - i * 1.2) * 2.5 + i * 1.1);
      }
      ctx.stroke();

      // ноги
      ctx.strokeStyle = C.suit2; ctx.lineWidth = 7;
      let f1, f2;
      if (P.state === 'run') {
        f1 = [6 + lp * 7, 24]; f2 = [-4 + lp2 * 7, 24];
        leg(ctx, 3, 11, f1[0], f1[1]); leg(ctx, -3, 11, f2[0], f2[1]);
      } else if (P.state === 'air') {
        f1 = [10, 18]; f2 = [-2, 20];
        leg(ctx, 3, 11, f1[0], f1[1]); leg(ctx, -3, 11, f2[0], f2[1]);
      } else if (P.state === 'climb') {
        f1 = [-4 + lp * 6, 24]; f2 = [4 - lp * 6, 24];
        leg(ctx, -2, 11, f1[0], f1[1]); leg(ctx, 2, 11, f2[0], f2[1]);
      } else {
        f1 = [8, 24]; f2 = [-7, 24];
        leg(ctx, 3, 11, f1[0], f1[1]); leg(ctx, -3, 11, f2[0], f2[1]);
      }
      ctx.fillStyle = '#141414';
      ctx.beginPath(); ctx.arc(f1[0], f1[1], 3.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(f2[0], f2[1], 3.2, 0, 7); ctx.fill();

      // задняя рука
      ctx.strokeStyle = C.suit2; ctx.lineWidth = 5.5;
      if (P.state === 'climb') leg(ctx, -3, -4, -8 - lp * 3, -14);
      else leg(ctx, -3, -4, -8 + lp * 5, 5);

      // торс и пояс
      ctx.fillStyle = C.suit; RA.rr(ctx, -10, -10, 20, 24, 7); ctx.fill();
      ctx.fillStyle = C.belt; RA.rr(ctx, -10, 4, 20, 5, 2); ctx.fill();
      // узел пояса
      ctx.fillRect(-12, 5, 4, 4);

      // передняя рука
      ctx.strokeStyle = C.suit; ctx.lineWidth = 6;
      if (P.state === 'climb') leg(ctx, 4, -4, 9 + lp * 3, -15);
      else if (P.state === 'air') leg(ctx, 4, -4, 12, -8);
      else leg(ctx, 4, -4, 9 - lp * 5, 6);

      // голова-капюшон
      ctx.fillStyle = C.suit;
      ctx.beginPath(); ctx.arc(2, -17, 9.5, 0, 7); ctx.fill();
      ctx.fillStyle = C.suit2;
      ctx.beginPath(); ctx.arc(0, -17, 9.5, Math.PI * 0.4, Math.PI * 1.5); ctx.fill();
      ctx.fillStyle = C.skin; RA.rr(ctx, 5, -20, 7.5, 6, 2); ctx.fill();
      if (P.state === 'dead') {
        ctx.strokeStyle = C.eye; ctx.lineWidth = 1.6;
        for (let e = 0; e < 2; e++) {
          const ex = 7 + e * 3.6;
          ctx.beginPath();
          ctx.moveTo(ex, -19); ctx.lineTo(ex + 2.6, -16);
          ctx.moveTo(ex + 2.6, -19); ctx.lineTo(ex, -16);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = C.eye;
        ctx.fillRect(6.5, -19, 2.1, 2.6);
        ctx.fillRect(10, -19, 2.1, 2.6);
      }
    }

    ctx.restore();
  }

  if (opts.autoReset !== false) reset();

  return {
    p: P, reset: reset, update: update, draw: draw,
    tryJump: tryJump, die: die, hurt: hurt, applySkin: applySkin, doDash: doDash
  };
};

// главный герой (совместимость: RA.Player.p / RA.Player.reset / ...)
RA.Player = RA.createPlayer({ id: 'hero', autoReset: false });
