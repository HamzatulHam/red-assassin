/* ============================================================
   СУЩНОСТИ — частицы, золото, охранники
   ============================================================ */

window.RA = window.RA || {};

/* ---------- Частицы: пыль, искры, всплывающие «+10» ---------- */
RA.Particles = {
  list: [],
  clear: function () { this.list.length = 0; },

  // выброс цветных точек (пыль, искры)
  burst: function (x, y, color, n, o) {
    o = o || {};
    const spread = o.spread != null ? o.spread : 90;
    const up = o.up != null ? o.up : 110;
    for (let i = 0; i < n; i++) {
      this.list.push({
        kind: 'dot', x: x, y: y, color: color,
        vx: (o.dir != null ? o.dir : RA.rand(-1, 1)) * Math.random() * spread,
        vy: -RA.rand(0.2, 1) * up,
        life: o.life != null ? o.life : 0.5, t: 0,
        size: o.size != null ? o.size : 3, grav: 420
      });
    }
  },

  // кольцо при двойном прыжке
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

  // всплывающий текст («+10», «+25»)
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

/* ---------- Золото (мешочки с монетами) ---------- */
RA.Coins = {
  update: function (dt, player, game) {
    const cs = RA.World.state.coins;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.taken) continue;

      // магнит золота (прокачка): притягиваем мешочки поблизости
      const lvl = game.magnet || 0;
      if (lvl > 0) {
        const dx = (player.x + player.w / 2) - c.x;
        const dy = (player.y + player.h / 2) - c.y;
        const R = 70 + 45 * lvl;
        if (dx * dx + dy * dy < R * R) {
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const pull = (280 + 100 * lvl) * dt;
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
      // мешочек
      ctx.fillStyle = '#8d5a2b';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 11, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6d4318';
      RA.rr(ctx, x - 5, y - 10, 10, 7, 3); ctx.fill();
      ctx.fillStyle = '#3e2723'; ctx.fillRect(x - 6, y - 5, 12, 3);
      // золото выглядывает
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(x - 3, y - 12, 3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3.5, y - 11, 2.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x - 3, y - 12, 3, 0, 7); ctx.stroke();
      // блик
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(x - 4, y + 1, 3, 5, -0.5, 0, 7); ctx.fill();
      // искра
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

/* ---------- Охранники («закон») ---------- */
RA.Guards = {
  update: function (dt, player, game) {
    const gs = RA.World.state.guards;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      if (g.dead) {
        g.dead += dt;
        if (g.dead > 1.3) gs.splice(i, 1);
        continue;
      }
      // патрулирование
      g.ph += dt * 7;
      g.x += g.dir * RA.CONFIG.world.guardSpeed * dt;
      if (g.x < g.x0) { g.x = g.x0; g.dir = 1; }
      if (g.x > g.x0 + g.range) { g.x = g.x0 + g.range; g.dir = -1; }

      if (player.state === 'dead' || player.state === 'climb') continue;

      // столкновение с героем (прямоугольник охранника: x..x+w, y-h..y)
      if (player.x < g.x + g.w && player.x + player.w > g.x &&
          player.y < g.y && player.y + player.h > g.y - g.h) {
        const stomp = RA.CONFIG.player.stompKill &&
                      player.vy > 120 &&
                      (player.y + player.h) < g.y - g.h * 0.45;
        if (stomp) {
          g.dead = 0.001;
          player.vy = -RA.CONFIG.player.stompBounce;
          player.jumps = 1;
          game.onStomp(g);
        } else if (player.invuln > 0) {
          // неуязвимость после сработавшего щита — просто пробегаем мимо
        } else if (player.shields > 0) {
          // щит спасает: стражник обезврежен, щит потрачен
          player.shields--;
          player.invuln = 1.2;
          g.dead = 0.001;
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
      if (x + g.w < -40 || x > W + 40) continue;

      ctx.save();
      let alpha = 1;
      if (g.dead) {
        alpha = Math.max(0, 1 - g.dead / 1.2);
        ctx.globalAlpha = alpha;
        // падает/лежит
        ctx.translate(x + g.w / 2, g.y - 10);
        ctx.rotate(Math.PI / 2 * Math.min(1, g.dead * 4));
        ctx.translate(-(x + g.w / 2), -(g.y - 10));
      }

      const walk = g.dead ? 0 : Math.sin(g.ph) * 5;
      // ноги
      ctx.strokeStyle = '#1c2563'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + 13, g.y - 18); ctx.lineTo(x + 13 + walk * g.dir, g.y - 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 22, g.y - 18); ctx.lineTo(x + 22 - walk * g.dir, g.y - 1); ctx.stroke();
      // тело
      ctx.fillStyle = '#303f9f';
      RA.rr(ctx, x + 6, g.y - 44, 24, 28, 5); ctx.fill();
      ctx.fillStyle = '#ffca28';                     // ремень
      ctx.fillRect(x + 6, g.y - 26, 24, 5);
      // голова
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(x + 18, g.y - 51, 8, 0, 7); ctx.fill();
      // шлем
      ctx.fillStyle = '#1a237e';
      ctx.beginPath(); ctx.arc(x + 18, g.y - 53, 8.6, Math.PI, 0); ctx.fill();
      ctx.fillRect(x + 9, g.y - 55, 18, 4);
      // лицо
      if (!g.dead) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(x + 18 + g.dir * 3, g.y - 51, 2.6, 2.6);
      } else {
        // крестики в глазах и звёздочки
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
      // копьё
      if (!g.dead) {
        ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + 30, g.y - 74); ctx.lineTo(x + 30, g.y + 2); ctx.stroke();
        ctx.fillStyle = '#cfd8dc';
        ctx.beginPath();
        ctx.moveTo(x + 30, g.y - 86);
        ctx.lineTo(x + 26, g.y - 72); ctx.lineTo(x + 34, g.y - 72);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
};

/* ---------- Метательное оружие (кунай, сюрикен) ---------- */
RA.Projectiles = {
  list: [],
  clear: function () { this.list.length = 0; },

  // kind: 'kunai' | 'shuriken'
  throw: function (kind, x, y, speed, pierce) {
    this.list.push({ kind: kind, x: x, y: y, vx: speed, dist: 0, pierce: pierce, ph: Math.random() * 6 });
  },

  update: function (dt, guards, game) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt;
      p.dist += p.vx * dt;
      p.ph += dt * 25;

      // попадание в стражника
      for (let j = 0; j < guards.length; j++) {
        const g = guards[j];
        if (g.dead) continue;
        if (p.x > g.x && p.x < g.x + g.w && p.y > g.y - g.h && p.y < g.y) {
          g.dead = 0.001;
          game.onWeaponKill(g);
          if (!p.pierce) { this.list.splice(i, 1); break; }
        }
      }

      // улетел далеко вперёд — убрать
      if (p.dist > 750) this.list.splice(i, 1);
    }
  },

  draw: function (ctx, cam) {
    const W = RA.CONFIG.width;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      const x = p.x - cam;
      if (x < -40 || x > W + 40) continue;
      ctx.save();
      ctx.translate(x, p.y);
      if (p.kind === 'kunai') {
        // нож: стальное остриё вправо, деревянная рукоять
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-11, -2, 9, 4);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath();
        ctx.moveTo(13, 0); ctx.lineTo(-2, -4); ctx.lineTo(-2, 4);
        ctx.closePath(); ctx.fill();
      } else {
        // сюрикен: вращающаяся четырёхлучевая звезда
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
      }
      ctx.restore();
    }
  }
};
