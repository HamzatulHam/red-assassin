/* ============================================================
   ИНТЕРФЕЙС — меню, карта кампании, магазин, HUD, дуэль, рейтинг
   ============================================================ */

window.RA = window.RA || {};

RA.UI = (function () {
  const el = function (id) { return document.getElementById(id); };
  let hudEls = {};
  let shopTab = 'skins';
  let shopFrom = 'menu';
  let msgTimer = null;

  function T() { return RA.CONFIG.texts; }
  function S() { return RA.CONFIG.texts.shop; }

  /* ---------- видимость панели (PWA) ---------- */

  let playing = false;
  let deferredPrompt = null;
  let rotateMode = false;

  const isStandalone = function () {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.navigator.standalone === true;
  };
  const inTelegram = function () {
    try {
      return !!(window.Telegram && window.Telegram.WebApp &&
                window.Telegram.WebApp.platform &&
                window.Telegram.WebApp.platform !== 'unknown');
    } catch (e) { return false; }
  };
  const isFullscreen = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  };
  const applyBarVisibility = function () {
    const dl = el('dl-btn'), inst = el('install-btn'), fs = el('fs-btn');
    if (!dl || !inst) return;
    const hide = playing || isFullscreen() || rotateMode;
    dl.classList.toggle('hidden', hide);
    inst.classList.toggle('hidden', hide || isStandalone() || inTelegram());
    if (fs) fs.classList.toggle('hidden', rotateMode || isStandalone());
  };
  function setPlaying(on) {
    playing = !!on;
    applyBarVisibility();
  }
  function setDuelHUD(on) {
    el('hud').style.display = on ? 'none' : '';
  }

  // сенсорные кнопки дуэли — только на тач-экранах
  function setDuelTouch(on) {
    const dt = el('duel-touch');
    if (!dt) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    dt.classList.toggle('hidden', !(on && coarse));
  }

  /* ---------- HUD ---------- */

  function buildHud() {
    const L = T().labels;
    el('hud').innerHTML =
      '<span>' + L.score + ': <b id="hud-score">0</b></span>' +
      '<span class="hud-gold">' + L.coins + ': <b id="hud-coins">0</b></span>' +
      '<span>' + L.dist + ': <b id="hud-dist">0</b></span>' +
      '<span class="hud-level" id="hud-level">' + T().levelWord + ' 1</span>' +
      '<span class="hud-shield" id="hud-shield">🛡 0</span>' +
      '<span class="hud-wallet" id="hud-wallet">💰 0</span>' +
      '<span class="hud-best">' + L.best + ': <b id="hud-best">0</b></span>';
    hudEls = {
      score: el('hud-score'), coins: el('hud-coins'),
      dist: el('hud-dist'), level: el('hud-level'), best: el('hud-best'),
      shield: el('hud-shield'), wallet: el('hud-wallet')
    };
  }

  function updateHUD(score, coins, dist, level, best, shields, wallet) {
    hudEls.score.textContent = score;
    hudEls.coins.textContent = coins;
    hudEls.dist.innerHTML = dist;
    hudEls.level.textContent = T().levelWord + ' ' + level;
    hudEls.best.textContent = best;
    hudEls.shield.textContent = '🛡 ' + shields;
    hudEls.shield.style.display = shields > 0 ? '' : 'none';
    hudEls.wallet.textContent = '💰 ' + wallet;
  }

  function setWallet(gold) {
    const bar = el('bar-wallet');
    if (bar) bar.textContent = '💰 ' + gold;
    const shop = el('shop-wallet');
    if (shop) shop.textContent = '💰 ' + gold;
  }

  /* ---------- меню / оверлеи ---------- */

  function buildMenu() {
    const T2 = T(), L = T2.labels, S2 = S();
    el('menu-sub').textContent = T2.subtitle;
    el('menu-controls').textContent = T2.controls;
    el('btn-start').textContent = T2.startBtn;
    el('btn-campaign').textContent = T2.campaignBtn;
    el('btn-duel').textContent = T2.duelBtn;
    el('btn-restart').textContent = T2.restartBtn;
    el('btn-shop').textContent = '🛒 ' + S2.title.replace('🛒 ', '');
    el('btn-shop2').textContent = el('btn-shop').textContent;
    el('fs-btn').textContent = T2.fullscreen;
    el('ov-shop').querySelector('h2').textContent = S2.title;
    el('ov-map').querySelector('h2').textContent = T2.mapTitle;
    el('ov-pause').querySelector('h2').textContent = T2.pauseTitle;
    el('ov-pause').querySelector('.ov-hint').textContent = T2.pauseHint;
    el('tab-skins').textContent = S2.tabSkins;
    el('tab-weapons').textContent = S2.tabWeapons;
    el('tab-upg').textContent = S2.tabUpg;
    const labels = el('ov-over').querySelectorAll('.stat span');
    if (labels.length === 5) {
      labels[0].textContent = L.score; labels[1].textContent = 'Враги';
      labels[2].textContent = L.coins;
      labels[3].textContent = L.dist; labels[4].textContent = L.best;
    }
  }

  function hideOverlays() {
    ['ov-menu', 'ov-over', 'ov-pause', 'ov-shop', 'ov-map', 'ov-win', 'ov-duel-end']
      .forEach(function (id) { el(id).classList.add('hidden'); });
  }

  function showMenu(best) {
    hideOverlays();
    el('ov-menu').classList.remove('hidden');
    el('menu-best').textContent = best > 0 ? T().labels.best + ': ' + best : '';
  }

  function toast(text) {
    const t = el('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function gameOver(d) {
    el('over-title').textContent = d.title;
    el('st-score').textContent = d.score;
    el('st-coins').textContent = d.coins;
    el('st-dist').textContent = d.dist + ' м';
    el('st-best').textContent = d.best;
    el('st-kills').textContent = d.kills || 0;
    el('over-record').classList.toggle('hidden', !d.record);
    el('over-wallet').textContent = d.toWallet > 0 ? S().toWallet + ': +' + d.toWallet + ' 💰' : '';
    el('btn-map').classList.toggle('hidden', !d.campaign);
    el('ov-over').classList.remove('hidden');
  }

  function showWin(d) {
    el('win-title').textContent = T().winTitle;
    el('win-level').textContent = T().levelWord + ' ' + (d.idx + 1);
    el('win-stats').textContent = T().labels.dist + ': ' + d.dist + ' м · ' +
      T().labels.coins + ': ' + d.coins + ' · ' + T().labels.score + ': ' + d.score;
    el('win-reward').textContent = T().reward + ': +' + d.reward + ' 💰';
    el('btn-next').classList.toggle('hidden', !d.hasNext);
    hideOverlays();
    el('ov-win').classList.remove('hidden');
  }

  function showDuelEnd(winner, s1, s2) {
    el('duel-title').textContent = (winner === 1 ? T().duelP1 : T().duelP2) + ' ' + T().duelWin + '!';
    el('duel-score').textContent = s1 + ' : ' + s2;
    hideOverlays();
    el('ov-duel-end').classList.remove('hidden');
  }

  function showPause(on) { el('ov-pause').classList.toggle('hidden', !on); }

  function soundIcon(muted) { el('sound-state').textContent = muted ? '🔇' : '🔊'; }

  /* ---------- МАГАЗИН ---------- */

  function shopMsg(text) {
    const m = el('shop-msg');
    m.textContent = text;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { m.textContent = ''; }, 1800);
  }

  function card(o) {
    const div = document.createElement('div');
    div.className = 'item-card';
    const b = document.createElement('button');
    b.className = 'btn-mini';
    b.innerHTML = o.btn;
    b.disabled = !!o.disabled;
    b.addEventListener('click', o.onBtn);
    div.innerHTML = o.top + '<b>' + o.name + '</b><span>' + o.sub + '</span>';
    div.appendChild(b);
    return div;
  }

  function renderShop() {
    const d = RA.Save.get();
    setWallet(d.gold);
    el('tab-skins').classList.toggle('on', shopTab === 'skins');
    el('tab-weapons').classList.toggle('on', shopTab === 'weapons');
    el('tab-upg').classList.toggle('on', shopTab === 'upgrades');
    el('shop-msg').textContent = '';

    const box = el('shop-items');
    box.innerHTML = '';

    if (shopTab === 'skins') {
      RA.CONFIG.shop.skins.forEach(function (s) {
        const owned = RA.Save.ownsSkin(s.id);
        const equipped = d.skin === s.id;
        box.appendChild(card({
          top: s.cloak
            ? '<div class="swatch cloak" style="background:linear-gradient(160deg,' + s.suit + ' 0 60%,' + s.suit2 + ' 60%)"></div><div class="cloak-eye" style="background:' + s.eye + '"></div>'
            : '<div class="swatch" style="background:linear-gradient(135deg,' + s.suit + ' 0 45%,' + s.suit2 + ' 45% 75%,' + s.scarf + ' 75%)"></div>',
          name: s.name + (s.cloak ? ' 🧥' : ''),
          sub: owned ? (equipped ? S().equipped : S().owned) : '💰 ' + s.price,
          btn: equipped ? S().equipped : (owned ? S().equip : S().buy + ' 💰' + s.price),
          disabled: equipped || (!owned && d.gold < s.price),
          onBtn: function () {
            if (equipped) return;
            if (!owned) {
              if (d.gold < s.price) return shopMsg(S().notEnough);
              d.gold -= s.price;
              d.skins.push(s.id);
            }
            d.skin = s.id;
            RA.Save.save();
            renderShop();
          }
        }));
      });

    } else if (shopTab === 'weapons') {
      RA.CONFIG.shop.weapons.forEach(function (w) {
        const owned = RA.Save.ownsWeapon(w.id);
        const equipped = d.weapon === w.id;
        box.appendChild(card({
          top: '<div class="wicon">' + (w.id === 'kunai' ? '🗡️' : w.id === 'shuriken' ? '✳️' :
                w.id === 'katana' ? '⚔️' : w.id === 'bow' ? '🏹' : w.id === 'bomb' ? '💣' : '🤜') + '</div>',
          name: w.name,
          sub: w.desc + (w.cooldown ? ' · ' + S().reload + ' ' + w.cooldown + 'с' : ''),
          btn: equipped ? S().equipped : (owned ? S().equip : S().buy + ' 💰' + w.price),
          disabled: equipped || (!owned && d.gold < w.price),
          onBtn: function () {
            if (equipped) return;
            if (!owned) {
              if (d.gold < w.price) return shopMsg(S().notEnough);
              d.gold -= w.price;
              d.weapons.push(w.id);
            }
            d.weapon = w.id;
            RA.Save.save();
            renderShop();
          }
        }));
      });

    } else {
      RA.CONFIG.shop.upgrades.forEach(function (u) {
        const lvl = d.up[u.id] || 0;
        const cost = RA.Save.upgradeCost(u);
        const maxed = cost === null;
        box.appendChild(card({
          top: '<div class="pips">' + '●'.repeat(lvl) + '<i>' + '●'.repeat(u.max - lvl) + '</i></div>',
          name: u.name,
          sub: u.desc + ' · ' + u.effect(Math.min(lvl + 1, u.max)),
          btn: maxed ? S().maxed : S().upgrade + ' 💰' + cost,
          disabled: maxed || (!maxed && d.gold < cost),
          onBtn: function () {
            if (maxed) return;
            if (d.gold < cost) return shopMsg(S().notEnough);
            d.gold -= cost;
            d.up[u.id] = lvl + 1;
            RA.Save.save();
            renderShop();
          }
        }));
      });
    }
  }

  function openShop(from) {
    shopFrom = from || 'menu';
    el('ov-menu').classList.add('hidden');
    el('ov-over').classList.add('hidden');
    renderShop();
    el('ov-shop').classList.remove('hidden');
  }

  function closeShop() {
    el('ov-shop').classList.add('hidden');
    (shopFrom === 'over' ? el('ov-over') : el('ov-menu')).classList.remove('hidden');
  }

  /* ---------- КАРТА КАМПАНИИ ---------- */

  function openMap() {
    hideOverlays();
    renderMap();
    el('ov-map').classList.remove('hidden');
  }

  function renderMap() {
    const d = RA.Save.get();
    const C = RA.CONFIG.campaign;
    const box = el('map-nodes');
    box.innerHTML = '';
    const biomes = RA.CONFIG.biomes;
    for (let i = 0; i < C.levels; i++) {
      const unlocked = i < d.campaign.unlocked;
      const done = d.campaign.done.indexOf(i) !== -1;
      const node = document.createElement('button');
      node.className = 'map-node' + (unlocked ? '' : ' locked') + (done ? ' done' : '');
      node.innerHTML =
        '<b>' + (done ? T().doneMark : unlocked ? (i + 1) : T().locked) + '</b>' +
        '<span>' + biomes[C.biome(i)].name + '</span>' +
        '<i>' + C.length(i) + ' м · 💰' + C.reward(i) + '</i>';
      node.style.left = (6 + (i % 6) * 15.5) + '%';
      node.style.top = (i % 2 === 0 ? 22 : 56) + '%';
      if (unlocked) {
        node.addEventListener('click', function () {
          RA.Game.startCampaign(i);
        });
      } else {
        node.disabled = true;
      }
      box.appendChild(node);
    }
  }

  /* ---------- рейтинг ---------- */

  function buildRating() {
    const stars = el('stars'), info = el('rating-info');
    let st = RA.lsGet('ra_rating_v1', null) || { avg: RA.CONFIG.rating.avg, votes: RA.CONFIG.rating.votes };
    const render = function () {
      stars.innerHTML = '';
      for (let k = 1; k <= 5; k++) {
        const s = document.createElement('span');
        s.textContent = '★';
        if (k <= Math.round(st.avg)) s.classList.add('on');
        s.title = k + ' из 5';
        s.addEventListener('click', function () {
          st.avg = (st.avg * st.votes + k) / (st.votes + 1);
          st.votes++;
          RA.lsSet('ra_rating_v1', st);
          render();
        });
        stars.appendChild(s);
      }
      info.textContent = '(' + st.votes + ' голосов, средний: ' +
        st.avg.toFixed(1).replace('.', ',') + ' из 5)';
    };
    render();
  }

  /* ---------- кнопки ---------- */

  function bindButtons() {
    el('btn-start').addEventListener('click', function () { this.blur(); RA.Game.start(); });
    el('btn-campaign').addEventListener('click', function () { this.blur(); openMap(); });
    el('btn-duel').addEventListener('click', function () { this.blur(); RA.Game.startDuel(); });
    el('btn-restart').addEventListener('click', function () { this.blur(); RA.Game.restart(); });
    el('btn-shop').addEventListener('click', function () { this.blur(); openShop('menu'); });
    el('btn-shop2').addEventListener('click', function () { this.blur(); openShop('over'); });
    el('btn-shop-close').addEventListener('click', function () { this.blur(); closeShop(); });
    el('btn-throw').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      RA.Game.throwWeapon();
    });
    el('btn-map').addEventListener('click', function () { this.blur(); openMap(); });
    el('btn-map2').addEventListener('click', function () { this.blur(); RA.Game.toMenu(); });
    el('btn-map2b').addEventListener('click', function () { this.blur(); openMap(); });
    el('btn-tomenu').addEventListener('click', function () {
      this.blur();
      RA.Game.toMenu();
    });
    el('btn-tomenu2').addEventListener('click', function () {
      this.blur();
      RA.Game.toMenu();
    });
    el('btn-again').addEventListener('click', function () { this.blur(); RA.Game.startDuel(); });
    el('btn-next').addEventListener('click', function () { this.blur(); RA.Game.nextLevel(); });

    ['tab-skins', 'tab-weapons', 'tab-upg'].forEach(function (id) {
      el(id).addEventListener('click', function () {
        shopTab = id === 'tab-skins' ? 'skins' : id === 'tab-weapons' ? 'weapons' : 'upgrades';
        renderShop();
      });
    });

    const fsBtn = el('fs-btn');
    fsBtn.addEventListener('click', function () {
      this.blur();
      const box = el('stage-wrap');
      const req = box.requestFullscreen || box.webkitRequestFullscreen;
      if (!req) {
        alert('В этом браузере полный экран не поддерживается (Safari на iPhone так не умеет — ограничение Apple).\n\nНа iPhone два способа:\n1) Установи игру: «Поделиться» → «На экран „Домой“» — из иконки она всегда на весь экран;\n2) Играй через Telegram: @ASSASINES_REDBOT → 🎮 — при старте полный экран включается сам.');
        return;
      }
      if (!document.fullscreenElement) req.call(box);
      else (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    });
    document.addEventListener('fullscreenchange', function () {
      fsBtn.textContent = document.fullscreenElement
        ? T().fullscreenOff
        : T().fullscreen;
    });

    /* ---------- установка как приложение (PWA) ---------- */
    const instBtn = el('install-btn');
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      applyBarVisibility();
    });
    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      applyBarVisibility();
    });
    instBtn.addEventListener('click', function () {
      this.blur();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') applyBarVisibility();
          deferredPrompt = null;
        }).catch(function () { deferredPrompt = null; });
        return;
      }
      const ua = navigator.userAgent || '';
      const isIOS = /iPad|iPhone|iPod/.test(ua) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        alert('На iPhone установите так (Safari):\n\n1. Нажмите «Поделиться» (квадрат со стрелкой внизу)\n2. Выберите «На экран „Домой“»\n3. Нажмите «Добавить»\n\nПоявится иконка игры — запуск в полный экран и работает без интернета.');
      } else {
        alert('Установите так (Chrome):\n\n1. Откройте меню браузера (⋮ три точки справа вверху)\n2. Выберите «Установить приложение» или «Добавить на главный экран»\n\nПоявится иконка игры — запуск в полный экран и работает без интернета.');
      }
    });

    applyBarVisibility();

    /* ---------- подсказка «поверни телефон» ---------- */
    const rotateHint = el('rotate-hint');
    const rotateClose = el('rotate-close');
    const stageWrap = el('stage-wrap');
    let rotateTimer = null;
    const noRotatePref = function () {
      try { return sessionStorage.getItem('ra_no_rotate') === '1'; } catch (e) { return false; }
    };
    const updateRotateMode = function () {
      if (!rotateHint || !stageWrap) return;
      const need = window.matchMedia('(pointer: coarse)').matches &&
                   window.matchMedia('(orientation: portrait)').matches &&
                   !noRotatePref();
      rotateMode = need;
      stageWrap.classList.toggle('rotated', need);
      rotateHint.classList.remove('show');
      clearTimeout(rotateTimer);
      if (need) rotateTimer = setTimeout(function () { rotateHint.classList.add('show'); }, 350);
      applyBarVisibility();
    };
    if (rotateClose) rotateClose.addEventListener('click', function () {
      try { sessionStorage.setItem('ra_no_rotate', '1'); } catch (e) {}
      updateRotateMode();
    });
    window.addEventListener('resize', updateRotateMode);
    window.addEventListener('orientationchange', function () {
      setTimeout(updateRotateMode, 80);
    });
    updateRotateMode();
  }

  function init() {
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        if (window.Telegram.WebApp.disableVerticalSwipes) window.Telegram.WebApp.disableVerticalSwipes();
      } catch (e) {}
    }
    buildHud();
    buildMenu();
    buildRating();
    bindButtons();
    setWallet(RA.Save.get().gold);
  }

  return {
    init: init,
    updateHUD: updateHUD,
    setWallet: setWallet,
    setPlaying: setPlaying,
    setDuelHUD: setDuelHUD,
    setDuelTouch: setDuelTouch,
    toast: toast,
    banner: function (text) {
      const b = el('banner');
      b.textContent = text;
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
    },
    hideOverlays: hideOverlays,
    showMenu: showMenu,
    gameOver: gameOver,
    showWin: showWin,
    showDuelEnd: showDuelEnd,
    showPause: showPause,
    soundIcon: soundIcon,
    openMap: openMap,
    openShop: openShop
  };
})();
