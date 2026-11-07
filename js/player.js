/* ============================================================
   ИГРОК — красный асасин
   ------------------------------------------------------------
   Состояния: run (бег) / air (в воздухе) / climb (лазание) / dead.
   Физика: авто-бег вправо, прыжок + двойной прыжок, авто-лазание
   по стенам и башням. Все числа — в config.js (RA.CONFIG.player).
   ============================================================ */

window.RA = window.RA || {};

RA.Player = (function () {

  const P = {
    x: 0, y: 0, w: 34, h: 52,
    vy: 0, kvx: 0,               // вертикальная и «смертная» горизонтальная скорость
    onGround: false,
    jumps: 0,                    // сколько прыжков использовано (1 — обычный, 2 — двойной)
    state: 'run',
    climbRef: null,              // стена/башня, по которой лезем
    coyote: 0,                   // «койот-тайм»: можно прыгнуть сразу после схода с края
    buffer: 0,                   // буфер прыжка: нажатие чуть раньше земли не пропадёт
    noClimb: 0,                  // пауза на лазание (после прыжка со стены)
    holdJump: false,             // держит ли игрок кнопку прыжка
    runPhase: 0,
    deadT: 0, deadRot: 0, cause: null
  };

  function reset() {
    const C = RA.CONFIG;
    P.x = 160; P.y = C.groundY - C.player.h;
    P.w = C.player.w; P.h = C.player.h;
    P.vy = 0; P.kvx = 0;
    P.onGround = true; P.jumps = 0; P.state = 'run';
    P.climbRef = null; P.coyote = 0; P.buffer = 0; P.noClimb = 0;
    P.holdJump = false; P.runPhase = 0;
    P.deadT = 0; P.deadRot = 0; P.cause = null;
    P.shields = 0; P.invuln = 0;
    // костюм из магазина (перекрашиваем базовую палитру)
    const d = RA.Save.get();
    const skin = RA.CONFIG.shop.skins.find(function (s) { return s.id === d.skin; }) || RA.CONFIG.shop.skins[0];
    P.colors = Object.assign({}, RA.CONFIG.player.colors, { suit: skin.suit, suit2: skin.suit2, scarf: skin.scarf });
  }

  function tryJump() { P.buffer = 0.12; }

  function die(cause, game) {
    if (P.state === 'dead') return;
    P.state = 'dead'; P.cause = cause;
    P.deadT = 0; P.deadRot = 0;
    if (cause === 'guard') { P.vy = -420; P.kvx = -game.speed * 0.35; }
    else { P.kvx = 0; }
    RA.Particles.burst(P.x + P.w / 2, P.y + P.h / 2, '#eceff1', 10, { life: 0.6, spread: 150, up: 180, size: 3 });
  }

  function update(dt, game) {
    const C = RA.CONFIG.player;

    // смерть: летим-spin по физике
    if (P.state === 'dead') {
      P.deadT += dt; P.deadRot += 6.5 * dt;
      P.vy = Math.min(P.vy + C.gravity * dt, 1300);
      P.x += P.kvx * dt; P.kvx *= Math.pow(0.2, dt);
      P.y += P.vy * dt;
      return;
    }

    // таймеры
    if (P.onGround) P.coyote = 0.09; else P.coyote = Math.max(0, P.coyote - dt);
    P.buffer = Math.max(0, P.buffer - dt);
    P.noClimb = Math.max(0, P.noClimb - dt);
    if (P.invuln > 0) P.invuln -= dt;   // мигание после сработавшего щита

    // расход буфера прыжка (прокачка «Прыгучесть» усиливает прыжки)
    const jk = 1 + 0.04 * (game.jumpLvl || 0);
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
        // забрались наверх
        P.y = s.y - P.h; P.vy = 0;
        P.onGround = true; P.jumps = 0;
        P.state = 'run'; P.climbRef = null; P.x += 6;
        RA.Particles.burst(P.x + P.w / 2, P.y + P.h, '#a1887f', 6, { life: 0.4, spread: 60, up: 50 });
      } else if (P.buffer > 0) {
        // прыжок со стены
        P.buffer = 0; P.noClimb = 0.3;
        P.state = 'air'; P.vy = -C.jumpV * 0.95;
        P.climbRef = null; P.onGround = false; P.x -= 14;
        game.sfx.jump();
      }
      return; // при лазании бег вперёд остановлен
    }

    /* ---------- бег и падение ---------- */
    P.x += game.speed * dt;
    P.vy += C.gravity * ((P.holdJump && P.vy < 0) ? C.holdAssist : 1) * dt;
    P.vy = Math.min(P.vy, 1200);

    const prevBottom = P.y + P.h, prevTop = P.y, prevRight = P.x + P.w;
    P.y += P.vy * dt;

    const wasGround = P.onGround;
    P.onGround = false;
    const solids = RA.World.state.solids;

    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (P.x + P.w <= s.x || P.x >= s.x + s.w) continue;

      // приземление на верх (с «прощением» угла до 28px)
      if (P.vy >= 0 && P.y + P.h >= s.y &&
          (prevBottom <= s.y + 1 || P.y + P.h <= s.y + 28)) {
        P.y = s.y - P.h; P.vy = 0;
        P.onGround = true; P.jumps = 0; P.climbRef = null; P.state = 'run';
        if (!wasGround) RA.Particles.burst(P.x + P.w / 2, P.y + P.h, '#8d6e63', 6, { life: 0.45, spread: 70, up: 60 });
      }
      // удар головой о низ балки
      else if (P.vy < 0 && prevTop >= s.y + s.h - 1 && P.y < s.y + s.h) {
        P.y = s.y + s.h; P.vy = 0;
      }
    }

    // боковая грань → начинаем лезть
    if (P.noClimb <= 0) {
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

    // анимация бега + пыль из-под ног
    if (P.onGround) {
      P.runPhase += game.speed * dt * 0.045;
      if (Math.random() < dt * 14) {
        RA.Particles.burst(P.x + 4, P.y + P.h - 2, '#7a5c44', 1, { life: 0.4, spread: 30, up: 40, dir: -1 });
      }
    }
  }

  /* ---------- отрисовка ---------- */
  function leg(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function draw(ctx, cam, t) {
    const C = P.colors || RA.CONFIG.player.colors;
    const spd = RA.Game.getSpeed();
    const cx = P.x - cam + P.w / 2, cy = P.y + P.h / 2;

    // тень под ногами
    if (P.onGround && P.state !== 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(cx, P.y + P.h + 3, 15, 4, 0, 0, 7); ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, cy);
    if (P.state === 'dead') ctx.rotate(P.deadRot);
    if (P.invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.35; // мигание щита

    const lp = Math.sin(P.runPhase), lp2 = Math.sin(P.runPhase + Math.PI);
    ctx.lineCap = 'round';

    // шарф (за спиной, машет на скорости)
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
    // ступни
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
    // прорезь лица
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

    ctx.restore();
  }

  return { p: P, reset: reset, update: update, draw: draw, tryJump: tryJump, die: die };
})();
