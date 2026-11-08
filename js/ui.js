/* ============================================================
   ИНТЕРФЕЙС СТРАНИЦЫ — HUD, меню, МАГАЗИН, рейтинг, полный экран
   ============================================================ */

window.RA = window.RA || {};

RA.UI = (function () {
  const el = function (id) { return document.getElementById(id); };
  let hudEls = {};
  let shopTab = 'skins';
  let shopFrom = 'menu';        // куда возвращаться после закрытия магазина
  let msgTimer = null;

  function T() { return RA.CONFIG.texts; }
  function S() { return RA.CONFIG.texts.shop; }

  /* ---------- видимость кнопок панели (PWA) ---------- */

  let playing = false;          // идёт игра: прячем «Установить» и «Скачать»
  let deferredPrompt = null;    // событие установки браузера
  let rotateMode = false;       // игра развернута на 90° (вертикальный тач-экран)

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

  // во время игры, в полноэкранном режиме или при авто-повороте
  // в панели остаются только звук/кошелёк (полный экран в повороте не нужен)
  const isFullscreen = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  };
  const applyBarVisibility = function () {
    const dl = el('dl-btn'), inst = el('install-btn'), fs = el('fs-btn');
    if (!dl || !inst) return;
    const hide = playing || isFullscreen() || rotateMode;
    dl.classList.toggle('hidden', hide);
    inst.classList.toggle('hidden', hide || isStandalone() || inTelegram());
    if (fs) fs.classList.toggle('hidden', rotateMode);
  };

  // вызывается из game.js при старте/конце забега
  function setPlaying(on) {
    playing = !!on;
    applyBarVisibility();
  }

  /* ---------- HUD ---------- */

  function buildHud() {
    const L = T().labels;
    el('hud').innerHTML =
      '<span>' + L.score + ': <b id="hud-score">0</b></span>' +
      '<span class="hud-gold">' + L.coins + ': <b id="hud-coins">0</b></span>' +
      '<span>' + L.dist + ': <b id="hud-dist">0</b> м</span>' +
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
    hudEls.dist.textContent = dist;
    hudEls.level.textContent = T().levelWord + ' ' + level;
    hudEls.best.textContent = best;
    hudEls.shield.textContent = '🛡 ' + shields;
    hudEls.shield.style.display = shields > 0 ? '' : 'none';
    hudEls.wallet.textContent = '💰 ' + wallet;
  }

  // кошелёк в верхней панели и в магазине
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
    el('btn-restart').textContent = T2.restartBtn;
    el('btn-shop').textContent = '🛒 ' + S2.title.replace('🛒 ', '');
    el('btn-shop2').textContent = el('btn-shop').textContent;
    el('fs-btn').textContent = T2.fullscreen;
    el('ov-shop').querySelector('h2').textContent = S2.title;
    el('ov-pause').querySelector('h2').textContent = T2.pauseTitle;
    el('ov-pause').querySelector('.ov-hint').textContent = T2.pauseHint;
    el('tab-skins').textContent = S2.tabSkins;
    el('tab-weapons').textContent = S2.tabWeapons;
    el('tab-upg').textContent = S2.tabUpg;
    const labels = el('ov-over').querySelectorAll('.stat span');
    if (labels.length === 4) {
      labels[0].textContent = L.score; labels[1].textContent = L.coins;
      labels[2].textContent = L.dist; labels[3].textContent = L.best;
    }
  }

  function hideOverlays() {
    ['ov-menu', 'ov-over', 'ov-pause', 'ov-shop'].forEach(function (id) { el(id).classList.add('hidden'); });
  }

  function showMenu(best) {
    hideOverlays();
    el('ov-menu').classList.remove('hidden');
    el('menu-best').textContent = best > 0 ? T().labels.best + ': ' + best : '';
  }

  function gameOver(d) {
    el('over-title').textContent = d.title;
    el('st-score').textContent = d.score;
    el('st-coins').textContent = d.coins;
    el('st-dist').textContent = d.dist + ' м';
    el('st-best').textContent = d.best;
    el('over-record').classList.toggle('hidden', !d.record);
    el('over-wallet').textContent = d.toWallet > 0 ? S().toWallet + ': +' + d.toWallet + ' 💰' : '';
    el('ov-over').classList.remove('hidden');
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

  // универсальная карточка товара
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
          top: '<div class="swatch" style="background:linear-gradient(135deg,' + s.suit + ' 0 45%,' + s.suit2 + ' 45% 75%,' + s.scarf + ' 75%)"></div>',
          name: s.name,
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
          top: '<div class="wicon">' + (w.id === 'kunai' ? '🗡️' : w.id === 'shuriken' ? '✳️' : '🤜') + '</div>',
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
          sub: u.desc,
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

  /* ---------- рейтинг (звёзды) ---------- */

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

  /* ---------- кнопки и полный экран ---------- */

  function bindButtons() {
    el('btn-start').addEventListener('click', function () { this.blur(); RA.Game.start(); });
    el('btn-restart').addEventListener('click', function () { this.blur(); RA.Game.start(); });
    el('btn-shop').addEventListener('click', function () { this.blur(); openShop('menu'); });
    el('btn-shop2').addEventListener('click', function () { this.blur(); openShop('over'); });
    el('btn-shop-close').addEventListener('click', function () { this.blur(); closeShop(); });
    el('btn-throw').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      RA.Game.throwWeapon();
    });

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
        alert('В этом браузере полный экран не поддерживается (Safari на iPhone так не умеет — ограничение Apple).\n\nНа iPhone два способа:\n1) Установи игру: «Поделиться» → «На экран „Домой“» — из иконки она открывается на весь экран;\n2) Играй через Telegram: кнопка 🎮 — при старте полный экран включается сам.');
        return;
      }
      if (!document.fullscreenElement) {
        const p = req.call(box);
        // на телефоне пробуем закрепить горизонтальную ориентацию
        if (p && p.then) {
          p.then(function () {
            try {
              if (window.screen && screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(function () {});
              }
            } catch (e) {}
          }).catch(function () {});
        }
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
      }
    });
    document.addEventListener('fullscreenchange', function () {
      fsBtn.textContent = document.fullscreenElement
        ? T().fullscreenOff
        : T().fullscreen;
      applyBarVisibility();
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
        deferredPrompt.prompt();                    // настоящее окно установки
        deferredPrompt.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted') applyBarVisibility();
          deferredPrompt = null;
        }).catch(function () { deferredPrompt = null; });
        return;
      }
      // события установки нет (iPhone или другой браузер) — показываем путь
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

    /* ---------- авто-поворот игры на вертикальных тач-экранах ----------
       В Telegram и некоторых браузерах экран не крутится при повороте
       телефона — тогда игра разворачивается сама на 90°: держи телефон
       боком, и она занимает весь экран. Кнопка ✕ отключает поворот. */
    const rotateHint = el('rotate-hint');
    const rotateClose = el('rotate-close');
    const stageWrap = el('stage-wrap');
    let rotateTimer = null;
    const noRotatePref = function () {
      try { return sessionStorage.getItem('ra_no_rotate') === '1'; } catch (e) { return false; }
    };
    const updateRotateMode = function () {
      if (!rotateHint || !stageWrap) return;
      const need = window.matchMedia('(pointer: coarse)').matches &&   // тач-экран
                   window.matchMedia('(orientation: portrait)').matches &&
                   !noRotatePref();
      rotateMode = need;
      stageWrap.classList.toggle('rotated', need);
      rotateHint.classList.remove('show');
      clearTimeout(rotateTimer);
      if (need) {
        rotateTimer = setTimeout(function () { rotateHint.classList.add('show'); }, 350);
      }
      applyBarVisibility();
    };
    if (rotateClose) rotateClose.addEventListener('click', function () {
      try { sessionStorage.setItem('ra_no_rotate', '1'); } catch (e) {}
      updateRotateMode();
    });
    window.addEventListener('resize', updateRotateMode);
    window.addEventListener('orientationchange', function () {
      setTimeout(updateRotateMode, 80);   // даём вьюпорту пересчитаться после поворота
    });
    updateRotateMode();
  }

  function init() {
    // Telegram Mini App: развернуть игру на весь экран внутри Telegram
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
    banner: function (text) {
      const b = el('banner');
      b.textContent = text;
      b.classList.remove('show');
      void b.offsetWidth;               // перезапуск CSS-анимации
      b.classList.add('show');
    },
    hideOverlays: hideOverlays,
    showMenu: showMenu,
    gameOver: gameOver,
    showPause: showPause,
    soundIcon: soundIcon,
    openShop: openShop
  };
})();
