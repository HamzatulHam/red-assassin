/* ============================================================
   ЗВУК — эффекты, фоновая музыка, эмбиенс (всё синтезировано,
   без файлов). Модуль RA.Sound.
   ------------------------------------------------------------
   Музыка: луп в стиле таико-барабанов + пентатоническая
   мелодия на «кото». Планирование — с опережением по часам
   AudioContext, чтобы ритм не плыл.
   ============================================================ */

window.RA = window.RA || {};

RA.Sound = (function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master = null, musicBus = null;
  let muted = false, musicOn = true;
  let seqTimer = null, nextNoteTime = 0, step = 0;
  let windSrc = null;

  const BPM = 92;
  const STEP = 60 / BPM / 2;           // 8-е доли
  const KICK  = [1, 0, 0, .6, 1, 0, .5, .4,  1, 0, .6, 0, 1, .5, 0, .6];  // тайко
  const SCALE = [0, 3, 5, 7, 10, 12, 10, 7,  5, 3, 0, 3, 5, 7, 12, 15];   // пентатоника
  const MELODY = [1, 0, .7, 0, 1, .8, 0, .9,  1, 0, .7, .5, 1, 0, .8, 0]; // плотность мелодии

  function ensure() {
    if (!AC) return false;
    if (!ac) {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.9;
      master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.gain.value = 0.5;
      musicBus.connect(master);
      startWind();
      startSequencer();
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  function tone(o) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 || o.f0), t0 + o.dur);
    g.gain.setValueAtTime(o.vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(o.bus || master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.03);
  }

  function noise(o) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const len = Math.ceil(ac.sampleRate * o.dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = o.ftype || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || master);
    src.start(t0);
  }

  /* ---------- фоновая музыка ---------- */

  function kick(t, vol) {   // тайко: глухой удар
    tone({ f0: 150, f1: 42, dur: 0.24, type: 'sine', vol: vol * 0.5, delay: t, bus: musicBus });
    noise({ dur: 0.05, f0: 900, vol: vol * 0.12, delay: t, bus: musicBus });
  }
  function pluck(t, semi, vol) {   // «кото»: щипковая нота
    const f = 220 * Math.pow(2, semi / 12);
    tone({ f0: f, f1: f * 0.995, dur: 0.34, type: 'triangle', vol: vol * 0.16, delay: t, bus: musicBus });
    tone({ f0: f * 2.01, f1: f * 2, dur: 0.18, type: 'sine', vol: vol * 0.05, delay: t, bus: musicBus });
  }

  function schedule() {
    if (!ac || muted || !musicOn) return;
    while (nextNoteTime < ac.currentTime + 0.25) {
      const s = step % 16;
      const v = KICK[s];
      if (v > 0) kick(nextNoteTime - ac.currentTime, v);
      if (MELODY[s] > 0) pluck(nextNoteTime - ac.currentTime, SCALE[s] + 12, MELODY[s]);
      nextNoteTime += STEP;
      step++;
    }
  }
  function startSequencer() {
    nextNoteTime = ac.currentTime + 0.1;
    if (seqTimer) clearInterval(seqTimer);
    seqTimer = setInterval(schedule, 60);
  }

  function startWind() {   // эмбиенс: ветер
    if (!ac || muted) return;
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    windSrc = ac.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = ac.createGain(); g.gain.value = 0.035;
    windSrc.connect(f); f.connect(g); g.connect(musicBus);
    windSrc.start();
  }

  /* ---------- эффекты ---------- */

  const sfx = {
    ensure: ensure,
    toggle: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },

    jump:  function () { tone({ f0: 300, f1: 560, dur: 0.12 }); },
    jump2: function () { tone({ f0: 360, f1: 660, dur: 0.11 }); },
    land:  function () { noise({ dur: 0.08, f0: 700, f1: 200, vol: 0.12 }); },
    coin:  function () { tone({ f0: 950, f1: 1500, dur: 0.08, type: 'sine', vol: 0.12 }); tone({ f0: 1275, f1: 1900, dur: 0.1, type: 'sine', vol: 0.1, delay: 0.06 }); },
    stomp: function () { tone({ f0: 280, f1: 70, dur: 0.2, type: 'sawtooth', vol: 0.2 }); noise({ dur: 0.1, f0: 500, vol: 0.1 }); },
    die:   function () { tone({ f0: 420, f1: 60, dur: 0.5, type: 'sawtooth', vol: 0.22 }); },
    grab:  function () { tone({ f0: 180, f1: 240, dur: 0.06, type: 'triangle', vol: 0.1 }); },
    level: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone({ f0: f, f1: f, dur: 0.12, vol: 0.12, delay: i * 0.09 }); }); },
    throwK: function () { noise({ dur: 0.12, f0: 2400, f1: 600, ftype: 'bandpass', vol: 0.16 }); },
    swing:  function () { noise({ dur: 0.14, f0: 3200, f1: 400, ftype: 'bandpass', vol: 0.2 }); },
    arrowS: function () { noise({ dur: 0.16, f0: 1800, f1: 500, ftype: 'bandpass', vol: 0.14 }); },
    clank:  function () { tone({ f0: 820, f1: 190, dur: 0.12, type: 'square', vol: 0.14 }); noise({ dur: 0.06, f0: 3000, vol: 0.08 }); },
    boom:   function () { noise({ dur: 0.5, f0: 900, f1: 60, vol: 0.35 }); tone({ f0: 120, f1: 30, dur: 0.5, type: 'sine', vol: 0.4 }); },
    thunder: function () { noise({ dur: 1.3, f0: 400, f1: 50, vol: 0.3 }); },
    hurt:   function () { tone({ f0: 500, f1: 180, dur: 0.14, type: 'sawtooth', vol: 0.2 }); },
    win:    function () { [523, 659, 784, 1046, 784, 1046].forEach(function (f, i) { tone({ f0: f, f1: f, dur: 0.16, type: 'triangle', vol: 0.14, delay: i * 0.11 }); }); },
    duelHit: function () { tone({ f0: 600, f1: 150, dur: 0.16, type: 'square', vol: 0.2 }); noise({ dur: 0.08, f0: 2500, vol: 0.1 }); }
  };

  return {
    ensure: ensure,
    sfx: sfx,
    toggle: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },
    setMusic: function (on) { musicOn = on; }
  };
})();
