/* ============================================================
   СУЩНОСТИ — частицы, золото, враги, метательное оружие, стрелы
   ============================================================ */

window.RA = window.RA || {};

/* ---------- Частицы ---------- */
RA.Particles = {
  list: [],
  clear: function () { this.list.length = 0; },

  burst: function (x, y, color, n, o) {
    o = o || {};
    const spread = o.spread != null ? o.spread : 90;
    const up = o.up != null ? o.up : 110;
    for (let i = 0; i < n; i++) {
      if (this.list.length > 260) return;
      this.list.push({
        kind: 'dot', x: x, y: y, color: color,
        vx: (o.dir != null ? o.dir : RA.rand(-1, 1)) * Math.random() * spread,
        vy: -RA.rand(0.2, 1) * up,
        life: o.life != null ? o.life : 0.5, t: 0,
        size: o.size != null ? o.size : 3, grav: 420
      });
    }
  },

  ring: function (x, y) {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      this.list.push({
        kind: 'dot', x: x, y: y, color: '#fff',
        vx: Math.cos(a) * 150, vy: Math.sin(a) * 60,
        life: 0.35, t: 0, size: 2.5, grav: 0
      });
    }
  },

  pop: function (x, y, text, color) {
    this.list.push({ kind: 'text', x: x, y: y, text: text, color: color, vx: 0, vy: -55, life: 0.8, t: 0, grav: 0 });
  },

  update: function (dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grav) p.vy += p.grav * dt;
    }
  },

  draw: function (ctx, cam) {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      const x = p.x - cam, y = p.y;
      if (p.kind === 'text') {
        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,10,10,.8)';
        ctx.strokeText(p.text, x, y);
        ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
};

/* ---------- Золото ---------- */
RA.Coins = {
  update: function (dt, player, game) {
    const cs = RA.World.state.coins;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.taken) continue;

      const lvl = game.magnet || 0;
      if (lvl > 0) {
        const dx = (player.x + player.w / 2) - c.x;
        const dy = (player.y + player.h / 2) - c.y;
        const R = 45 + 30 * lvl;
        if (dx * dx + dy * dy < R * R) {
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const pull = (90 + 90 * lvl) * dt;
          c.x += dx / d * pull;
          c.y += dy / d * pull;
        }
      }

      const bob = Math.sin(game.time * 3 + c.ph) * 4;
      if (player.x < c.x + 12 && player.x + player.w > c.x - 12 &&
          player.y < c.y + bob + 12 && player.y + player.h > c.y + bob - 12) {
        c.taken = true;
        game.onCoin(c);
      }
    }
  },

  draw: function (ctx, cam, t) {
    const cs = RA.World.state.coins, W = RA.CONFIG.width;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.taken) continue;
      const x = c.x - cam;
      if (x < -30 || x > W + 30) continue;
      const y = c.y + Math.sin(t * 3 + c.ph) * 4;
      ctx.fillStyle = '#8d5a2b';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 11, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6d4318';
      RA.rr(ctx, x - 5, y - 10, 10, 7, 3); ctx.fill();
      ctx.fillStyle = '#3e2723'; ctx.fillRect(x - 6, y - 5, 12, 3);
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(x - 3, y - 12, 3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3.5, y - 11, 2.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x - 3, y - 12, 3, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(x - 4, y + 1, 3, 5, -0.5, 0, 7); ctx.fill();
      if (Math.sin(t * 5 + c.ph * 7) > 0.93) {
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x + 8, y - 16); ctx.lineTo(x + 8, y - 8);
        ctx.moveTo(x + 4, y - 12); ctx.lineTo(x + 12, y - 12);
        ctx.stroke();
      }
    }
  }
};

/* ---------- Враги: стражник, лучник, тяжёлый воин, ниндзя-тень ---------- */
RA.Guards = {
  update: function (dt, player, game) {
    const gs = RA.World.state.guards;
    const E = RA.CONFIG.enemies;
    const diff = game.difficulty || 0;

    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];

      if (g.dead) {
        g.dead += dt;
        if (g.dead > 1.3) gs.splice(i, 1);
        continue;
      }
      if (g.hurtT > 0) g.hurtT -= dt;

      /* --- поведение по типу --- */
      if (g.type === 'archer') {
        g.cd = Math.max(0, (g.cd || 0) - dt);
        const dist = player.x - g.x;
        if (!player.freeMove && dist > -60 && dist < E.archerRange && g.cd <= 0 &&
            player.state !== 'dead') {
          g.cd = E.archerCd;
          g.draw = 0.5;                                  // анимация натяжения
          RA.EnemyArrows.throw(g.x + 4, g.y - 34, -(260 + 90 * diff));
          RA.Sound.sfx.arrowS();
        }
        if (g.draw > 0) g.draw -= dt;
      } else if (g.type === 'heavy') {
        g.ph += dt * 3.5;
        g.x += g.dir * 40 * dt;
        if (g.x < g.x0) { g.x = g.x0; g.dir = 1; }
        if (g.x > g.x0 + g.range) { g.x = g.x0 + g.range; g.dir = -1; }
      } else if (g.type === 'boss') {
        /* ---- БОСС: идёт к герою, прыгает и бьёт волной ---- */
        g.ph += dt * 4;
        const dxp = player.x - g.x;
        if (dxp > 0) g.x += 55 * dt;              // медленно догоняет
        g.slamCd = (g.slamCd || 3) - dt;
        if (g.slamCd <= 0 && dxp < 300 && dxp > -80) {
          g.slamCd = 3.5 + Math.random() * 2;
          g.jumpT = 0.55;                          // прыжок-замах
          g.waveQueued = true;
        }
        if (g.jumpT > 0) {
          g.jumpT -= dt;
          g.jumpOff = Math.sin((1 - g.jumpT / 0.55) * Math.PI) * 34;
          if (g.jumpT <= 0) {
            g.jumpOff = 0;
            if (g.waveQueued) {
              g.waveQueued = false;
              RA.EnemyArrows.wave(g.x - 20, g.y - 26);
              RA.Sound.sfx.boom();
              game.addShake(6);
            }
          }
        } else g.jumpOff = 0;
      } else if (g.type === 'shadow') {
        if (!g.dash) {
          g.ph += dt * 5;
          const dx = player.x - g.x;
          if (!player.freeMove && dx < 0 && dx > -E.shadowRange && player.state !== 'dead') {
            g.dash = true;
            RA.Particles.burst(g.x + g.w / 2, g.y - g.h / 2, '#4527a0', 10, { life: 0.5, spread: 90, up: 90 });
            RA.Sound.sfx.grab();
          }
        } else {
          g.x -= (E.shadowSpeed) * dt;
          g.ph += dt * 14;
          if (Math.random() < dt * 18) {
            RA.Particles.burst(g.x + g.w / 2, g.y - g.h / 2, '#4527a0', 1, { life: 0.4, spread: 30, up: 30 });
          }
        }
      } else {
        // обычный стражник
        g.ph += dt * 7;
        g.x += g.dir * RA.CONFIG.world.guardSpeed * dt;
        if (g.x < g.x0) { g.x = g.x0; g.dir = 1; }
        if (g.x > g.x0 + g.range) { g.x = g.x0 + g.range; g.dir = -1; }
      }

      if (player.state === 'dead' || player.state === 'climb' || player.invuln > 0) continue;

      /* --- столкновение --- */
      const touchY = g.jumpOff || 0;
      if (player.x < g.x + g.w && player.x + player.w > g.x &&
          player.y < g.y + touchY && player.y + player.h > g.y - g.h + touchY) {
        const stomp = RA.CONFIG.player.stompKill && player.vy > 120 &&
                      (player.y + player.h) < g.y - g.h * 0.45;
        const heavy = g.type === 'heavy';
        const boss = g.type === 'boss';
        if (boss) {
          // босс крепкий: топтание наносит 2 урона и подбрасывает
          player.vy = -RA.CONFIG.player.stompBounce;
          player.jumps = 1;
          g.hp -= 2;
          g.hurtT = 0.25;
          RA.Sound.sfx.clank();
          RA.Particles.burst(g.x + g.w / 2, g.y - g.h + 20, '#ffe0b2', 6, { life: 0.4, spread: 90, up: 90 });
          if (g.hp <= 0) { g.dead = 0.001; game.onBossKill(g); }
        } else if (stomp && !(heavy)) {
          g.dead = 0.001;
          player.vy = -RA.CONFIG.player.stompBounce;
          player.jumps = 1;
          game.onStomp(g);
        } else if (stomp && heavy) {
          // тяжёлого топтом не взять — отскок и звон
          player.vy = -RA.CONFIG.player.stompBounce * 0.8;
          player.jumps = 1;
          g.hurtT = 0.2;
          RA.Sound.sfx.clank();
        } else if (player.shields > 0) {
          player.shields--;
          player.invuln = 1.2;
          g.dead = g.type === 'heavy' ? false : 0.001;
          if (heavy) { g.hp--; if (g.hp <= 0) g.dead = 0.001; }
          game.onShieldHit(g);
        } else {
          game.die('guard');
        }
      }
    }
  },

  draw: function (ctx, cam, t) {
    const gs = RA.World.state.guards, W = RA.CONFIG.width;
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      const x = g.x - cam;
      if (x + g.w < -60 || x > W + 60) continue;

      ctx.save();
      let alpha = 1;
      if (g.dead) {
        alpha = Math.max(0, 1 - g.dead / 1.2);
        ctx.globalAlpha = alpha;
        ctx.translate(x + g.w / 2, g.y - 10);
        ctx.rotate(Math.PI / 2 * Math.min(1, g.dead * 4));
        ctx.translate(-(x + g.w / 2), -(g.y - 10));
      }
      if (g.type === 'shadow') ctx.globalAlpha = alpha * 0.85;

      const walk = g.dead ? 0 : Math.sin(g.ph) * 5;
      const hurt = g.hurtT > 0;

      if (g.type === 'boss') {
        /* ---- БОСС-СТРАЖНИК (рисование) ---- */
        const w = g.w, h = g.h, jy = g.jumpOff || 0;
        ctx.strokeStyle = '#263238'; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 20, g.y - 30 + jy); ctx.lineTo(x + 17 + walk * g.dir, g.y - 2 + jy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w - 20, g.y - 30 + jy); ctx.lineTo(x + w - 17 - walk * g.dir, g.y - 2 + jy); ctx.stroke();
        ctx.fillStyle = hurt ? '#ffffff' : '#4a148c';
        RA.rr(ctx, x + 8, g.y - h + 24 + jy, w - 16, h - 44, 8); ctx.fill();
        ctx.fillStyle = '#311b92';
        RA.rr(ctx, x + 8, g.y - h + 44 + jy, w - 16, 10, 4); ctx.fill();
        ctx.fillStyle = '#37474f';
        RA.rr(ctx, x - 4, g.y - h + 22 + jy, 16, 16, 5); ctx.fill();
        RA.rr(ctx, x + w - 12, g.y - h + 22 + jy, 16, 16, 5); ctx.fill();
        ctx.fillStyle = '#4a148c';
        ctx.beginPath(); ctx.arc(x + w / 2, g.y - h + 12 + jy, 14, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#b71c1c';
        ctx.fillRect(x + w / 2 - 3, g.y - h - 12 + jy, 6, 18);
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(x + w / 2 + 4, g.y - h + 8 + jy, 4, 4);
        ctx.strokeStyle = '#546e7a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(x + w + 6, g.y - 6 + jy); ctx.lineTo(x + w + 16, g.y - h + 24 + jy); ctx.stroke();
        if (!g.dead) {
          ctx.fillStyle = 'rgba(0,0,0,.5)';
          ctx.fillRect(x - 4, g.y - h - 26 + jy, w + 8, 8);
          ctx.fillStyle = '#ff1744';
          ctx.fillRect(x - 3, g.y - h - 25 + jy, (w + 6) * Math.max(0, g.hp / (g.maxHp || 12)), 6);
        }
      } else if (g.type === 'shadow') {
        /* ---- ниндзя-тень ---- */
        ctx.fillStyle = '#231a3e';
        ctx.beginPath();
        ctx.moveTo(x + 4, g.y);
        ctx.quadraticCurveTo(x - 2, g.y - 30, x + g.w / 2, g.y - g.h);
        ctx.quadraticCurveTo(x + g.w + 2, g.y - 30, x + g.w - 4, g.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#12091f';
        ctx.beginPath(); ctx.arc(x + g.w / 2, g.y - g.h + 10, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#ff1744';
        ctx.fillRect(x + g.w / 2 - 4, g.y - g.h + 8, 2.6, 2.2);
        ctx.fillRect(x + g.w / 2 + 2, g.y - g.h + 8, 2.6, 2.2);
        // кинжал в руке
        ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + g.w / 2 + 8, g.y - 26); ctx.lineTo(x + g.w / 2 + 15, g.y - 32); ctx.stroke();
      } else if (g.type === 'archer') {
        /* ---- лучник ---- */
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 13, g.y - 18); ctx.lineTo(x + 12, g.y - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 22, g.y - 18); ctx.lineTo(x + 24, g.y - 1); ctx.stroke();
        ctx.fillStyle = '#33691e';
        RA.rr(ctx, x + 6, g.y - 44, 24, 28, 5); ctx.fill();
        ctx.fillStyle = '#1b5e20'; ctx.fillRect(x + 6, g.y - 26, 24, 5);
        ctx.fillStyle = '#e8b98a';
        ctx.beginPath(); ctx.arc(x + 18, g.y - 51, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath(); ctx.arc(x + 18, g.y - 53, 8.6, Math.PI, 0); ctx.fill();
        ctx.fillRect(x + 9, g.y - 55, 18, 4);
        ctx.fillStyle = '#1a1a2e'; ctx.fillRect(x + 20, g.y - 51, 2.6, 2.6);
        // лук
        ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
        const pull = g.draw > 0 ? Math.min(1, g.draw / 0.5) * 8 : 0;
        ctx.beginPath(); ctx.arc(x + 34, g.y - 40, 14, -Math.PI / 2.4, Math.PI / 2.4); ctx.stroke();
        ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x + 34 + 14 * Math.cos(-Math.PI / 2.4), g.y - 40 + 14 * Math.sin(-Math.PI / 2.4));
        ctx.lineTo(x + 34 - pull, g.y - 40);
        ctx.lineTo(x + 34 + 14 * Math.cos(Math.PI / 2.4), g.y - 40 + 14 * Math.sin(Math.PI / 2.4));
        ctx.stroke();
        // колчан
        ctx.fillStyle = '#5d4037'; ctx.fillRect(x + 2, g.y - 52, 7, 16);
      } else if (g.type === 'heavy') {
        /* ---- тяжёлый воин ---- */
        const w = g.w, h = g.h;
        ctx.strokeStyle = '#263238'; ctx.lineWidth = 8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 15, g.y - 22); ctx.lineTo(x + 13 + walk * g.dir, g.y - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w - 15, g.y - 22); ctx.lineTo(x + w - 13 - walk * g.dir, g.y - 1); ctx.stroke();
        // доспех
        ctx.fillStyle = hurt ? '#ffffff' : '#455a64';
        RA.rr(ctx, x + 4, g.y - h + 16, w - 8, h - 36, 6); ctx.fill();
        ctx.fillStyle = '#263238';
        RA.rr(ctx, x + 4, g.y - h + 34, w - 8, 8, 3); ctx.fill();
        // наплечники
        ctx.fillStyle = '#37474f';
        RA.rr(ctx, x - 2, g.y - h + 14, 12, 12, 4); ctx.fill();
        RA.rr(ctx, x + w - 10, g.y - h + 14, 12, 12, 4); ctx.fill();
        // шлем с шипами
        ctx.fillStyle = '#263238';
        ctx.beginPath(); ctx.arc(x + w / 2, g.y - h + 8, 10, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 3;
        for (let s = -1; s <= 1; s++) {
          ctx.beginPath();
          ctx.moveTo(x + w / 2 + s * 6, g.y - h + 2);
          ctx.lineTo(x + w / 2 + s * 8, g.y - h - 8);
          ctx.stroke();
        }
        ctx.fillStyle = '#ff8a80'; ctx.fillRect(x + w / 2 + 3, g.y - h + 6, 3, 3);
        // щит
        ctx.fillStyle = '#4e342e';
        RA.rr(ctx, x + (g.dir > 0 ? w - 2 : -12), g.y - h + 22, 14, 30, 5); ctx.fill();
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
        RA.rr(ctx, x + (g.dir > 0 ? w - 2 : -12), g.y - h + 22, 14, 30, 5); ctx.stroke();
      } else {
        /* ---- обычный стражник ---- */
        ctx.strokeStyle = '#1c2563'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + 13, g.y - 18); ctx.lineTo(x + 13 + walk * g.dir, g.y - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 22, g.y - 18); ctx.lineTo(x + 22 - walk * g.dir, g.y - 1); ctx.stroke();
        ctx.fillStyle = '#303f9f';
        RA.rr(ctx, x + 6, g.y - 44, 24, 28, 5); ctx.fill();
        ctx.fillStyle = '#ffca28';
        ctx.fillRect(x + 6, g.y - 26, 24, 5);
        ctx.fillStyle = '#e8b98a';
        ctx.beginPath(); ctx.arc(x + 18, g.y - 51, 8, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a237e';
        ctx.beginPath(); ctx.arc(x + 18, g.y - 53, 8.6, Math.PI, 0); ctx.fill();
        ctx.fillRect(x + 9, g.y - 55, 18, 4);
        if (!g.dead) {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(x + 18 + g.dir * 3, g.y - 51, 2.6, 2.6);
        } else {
          ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.6;
          for (let e = 0; e < 2; e++) {
            const ex = x + 15 + e * 6, ey = g.y - 51;
            ctx.beginPath();
            ctx.moveTo(ex - 2, ey - 2); ctx.lineTo(ex + 2, ey + 2);
            ctx.moveTo(ex + 2, ey - 2); ctx.lineTo(ex - 2, ey + 2);
            ctx.stroke();
          }
          for (let s = 0; s < 3; s++) {
            const ang = t * 3 + s * 2.1;
            const sx = x + 18 + Math.cos(ang) * 14, sy = g.y - 66 + Math.sin(ang) * 4;
            ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy);
            ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 3);
            ctx.stroke();
          }
        }
        if (!g.dead) {
          ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x + 30, g.y - 74); ctx.lineTo(x + 30, g.y + 2); ctx.stroke();
          ctx.fillStyle = '#cfd8dc';
          ctx.beginPath();
          ctx.moveTo(x + 30, g.y - 86);
          ctx.lineTo(x + 26, g.y - 72); ctx.lineTo(x + 34, g.y - 72);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
  }
};

/* ---------- Метательное оружие героя ---------- */
RA.Projectiles = {
  list: [],
  clear: function () { this.list.length = 0; },

  throw: function (kind, x, y, cfg) {
    cfg = cfg || {};
    this.list.push({
      kind: kind, x: x, y: y, vx: cfg.vx || 0, vy: cfg.vy || 0, dist: 0,
      pierce: cfg.pierce || 0, dmg: cfg.dmg || 1, grav: !!cfg.grav,
      ph: Math.random() * 6, owner: cfg.owner || 'hero'
    });
  },

  // взмах катаной: мгновенный удар по площади
  slash: function (x, y, dir, dmg, game) {
    this.list.push({ kind: 'slash', x: x, y: y, t: 0, life: 0.16, dir: dir, owner: 'hero' });
    const gs = RA.World.state.guards;
    const x0 = x + (dir > 0 ? -10 : -95), x1 = x + (dir > 0 ? 105 : 10);
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      if (g.dead) continue;
      if (g.x + g.w > x0 && g.x < x1 && g.y - g.h < y + 40 && g.y > y - 50) {
        g.hp -= dmg; g.hurtT = 0.2;
        if (g.hp <= 0) { g.dead = 0.001; game.onWeaponKill(g); }
        else RA.Sound.sfx.clank();
      }
    }
  },

  update: function (dt, guards, game) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];

      if (p.kind === 'slash') {
        p.t += dt;
        if (p.t >= p.life) this.list.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      if (p.grav) p.vy += 1300 * dt;
      p.y += p.vy * dt;
      p.dist += Math.abs(p.vx) * dt;
      p.ph += dt * 25;

      let hitSomething = false;

      /* --- бомба: дистанционный взрыв у врага --- */
      if (p.kind === 'bomb' && p.owner === 'hero') {
        for (let j = 0; j < guards.length; j++) {
          const gN = guards[j];
          if (gN.dead) continue;
          const ddx = gN.x + gN.w / 2 - p.x, ddy = gN.y - gN.h / 2 - p.y;
          if (ddx * ddx + ddy * ddy < 30 * 30) {
            p.y = Math.max(p.y, RA.CONFIG.groundY - 12);
            game.onExplosion(p.x, p.y);
            this.list.splice(i, 1);
            hitSomething = true;
            break;
          }
        }
        if (hitSomething) continue;
      }

      /* --- дуэль: попадание в соперника --- */
      if (p.owner !== 'hero' && game.duelPlayers) {
        const foe = game.duelPlayers[p.owner === 'p1' ? 1 : 0];
        const fp = foe.p;
        if (fp.state !== 'dead' && fp.invuln <= 0 &&
            p.x > fp.x && p.x < fp.x + fp.w && p.y > fp.y && p.y < fp.y + fp.h) {
          foe.hurt(p.dmg || 1, p.x - p.vx, game);
          RA.Sound.sfx.duelHit();
          this.list.splice(i, 1);
          continue;
        }
      }

      /* --- попадания по врагам (только геройские снаряды) --- */
      if (p.owner === 'hero') {
        for (let j = 0; j < guards.length; j++) {
          const g = guards[j];
          if (g.dead) continue;
          if (p.x > g.x && p.x < g.x + g.w && p.y > g.y - g.h && p.y < g.y) {
            g.hp = (g.hp || 1) - p.dmg;
            g.hurtT = 0.2;
            RA.Sound.sfx.clank();
            RA.Particles.burst(p.x, p.y, '#ffe0b2', 5, { life: 0.3, spread: 70, up: 70 });
            if (g.hp <= 0) { g.dead = 0.001; game.onWeaponKill(g); }
            if (p.pierce > 0) { p.pierce--; } else { hitSomething = true; }
            break;
          }
        }
      }

      /* --- бомба: взрыв от земли или врага --- */
      if (p.kind === 'bomb' && (hitSomething || p.y >= RA.CONFIG.groundY - 4)) {
        game.onExplosion(p.x, p.y);
        this.list.splice(i, 1);
        continue;
      }

      if (hitSomething) { this.list.splice(i, 1); continue; }
      if (p.dist > 900 || p.y > RA.CONFIG.height + 20) this.list.splice(i, 1);
    }
  },

  draw: function (ctx, cam) {
    const W = RA.CONFIG.width;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.kind === 'slash') {
        const k = p.t / p.life;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.translate(p.x - cam, p.y);
        ctx.scale(p.dir, 1);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, 55, -1.1 + k * 0.6, 0.9 + k * 0.6); ctx.stroke();
        ctx.strokeStyle = '#ff8a80'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 62, -1 + k * 0.6, 1 + k * 0.6); ctx.stroke();
        ctx.restore();
        continue;
      }
      const x = p.x - cam;
      if (x < -40 || x > W + 40) continue;
      ctx.save();
      ctx.translate(x, p.y);
      if (p.kind === 'kunai') {
        ctx.rotate(p.vx < 0 ? Math.PI : 0);
        ctx.fillStyle = '#5d4037'; ctx.fillRect(-11, -2, 9, 4);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-2, -4); ctx.lineTo(-2, 4);
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'shuriken') {
        ctx.rotate(p.ph);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
          ctx.lineTo(Math.cos(a + 0.55) * 4, Math.sin(a + 0.55) * 4);
          ctx.closePath();
        }
        ctx.fill();
        ctx.fillStyle = '#f44336';
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill();
      } else if (p.kind === 'arrow') {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(8, 0); ctx.stroke();
        ctx.fillStyle = '#cfd8dc';
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(7, -3); ctx.lineTo(7, 3);
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'bomb') {
        ctx.fillStyle = '#263238';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ff9d3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(4, -13, 2, -16); ctx.stroke();
        if (Math.sin(p.ph * 4) > 0) {
          ctx.fillStyle = '#ffd54f';
          ctx.beginPath(); ctx.arc(2, -16, 2.4, 0, 7); ctx.fill();
        }
      }
      ctx.restore();
    }
  }
};

/* ---------- Стрелы врагов-лучников ---------- */
RA.EnemyArrows = {
  list: [],
  clear: function () { this.list.length = 0; },
  throw: function (x, y, vx) {
    this.list.push({ x: x, y: y, vx: vx, vy: 0, t: 0 });
  },
  throw: function (x, y) {                    // ударная волна босса
    this.list.push({ x: x, y: y, vx: -390, vy: 0, t: 0, ground: true });
  },
  update: function (dt, player, game) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (a.ground) {
        a.x += a.vx * dt; a.t += dt;
        if (Math.random() < dt * 20) {
          RA.Particles.burst(a.x, a.y + 10, '#8d6e63', 1, { life: 0.35, spread: 20, up: 50 });
        }
        if (player.state !== 'dead' && player.invuln <= 0 &&
            a.x > player.x && a.x < player.x + player.w &&
            player.y + player.h > a.y - 26) {
          if (player.shields > 0) {
            player.shields--;
            player.invuln = 1.2;
            game.onShieldHit({ x: a.x, y: a.y + 20, w: 0, h: 0 });
          } else {
            game.die('guard');
          }
          this.list.splice(i, 1);
          continue;
        }
        if (a.t > 2.4) this.list.splice(i, 1);
        continue;
      }
      a.x += a.vx * dt; a.y += a.vy * dt; a.t += dt;
      // столкновение с героем
      if (player.state !== 'dead' && player.invuln <= 0 &&
          a.x > player.x && a.x < player.x + player.w &&
          a.y > player.y && a.y < player.y + player.h) {
        if (player.shields > 0) {
          player.shields--;
          player.invuln = 1.2;
          game.onShieldHit({ x: a.x - 10, y: a.y + 20, w: 0, h: 0 });
        } else {
          game.die('arrow');
        }
        this.list.splice(i, 1);
        continue;
      }
      if (a.t > 4 || a.x < -60) this.list.splice(i, 1);
    }
  },
  draw: function (ctx, cam) {
    const W = RA.CONFIG.width;
    for (let i = 0; i < this.list.length; i++) {
      const a = this.list[i];
      const x = a.x - cam;
      if (x < -40 || x > W + 40) continue;
      if (a.ground) {
        // пылевая волна по земле
        ctx.fillStyle = 'rgba(141,110,99,.7)';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(x + k * 10, a.y + 6 - k * 4, 16 - k * 4, 9 - k * 2.4, 0, 0, 7);
          ctx.fill();
        }
        continue;
      }
      ctx.save();
      ctx.translate(x, a.y);
      ctx.rotate(Math.atan2(a.vy, a.vx));
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(8, -3); ctx.lineTo(8, 3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
};
