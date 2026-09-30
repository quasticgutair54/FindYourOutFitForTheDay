// ===== LEVELS+ : per-level upgrades that keep it pure Space Invaders =====
// Built level by level. Everything here wraps the original game functions.
//
// Shared systems (used by several levels):
//   * SCORE      - classic points per invader row + mystery ship bonus, with a
//                  saved high score, drawn arcade-style at the top of the screen.
//   * MARCH      - the 1978 formation march: the block steps sideways, drops a
//                  row at each edge, and speeds up as invaders die. Each step
//                  plays the 4-note "heartbeat" bass.
//   * BUNKERS    - pixel shields that erode where they're hit, themed per level.
//   * MYSTERY    - a bonus ship that crosses the top now and then.
//
// Level 1 · Notthebest OG: classic march + heartbeat, bunkers shaped N · T · B · ✦,
//                         and the coat-hanger mystery ship (sometimes drops a shirt = +1 life).

(function () {
  'use strict';

  const HI_KEY = 'ntb-hiscore';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const rand = (a, b) => a + Math.random() * (b - a);
  const say = t => { if (window.ntbNarrator) window.ntbNarrator.say(t, 1); };

  // Per-level settings. Levels not listed keep their original behaviour.
  const LEVELS = {
    0: { march: { step: 10, drop: 18, slow: 520, fast: 55 }, bunkers: 'ntb', mystery: 'hanger' },
    // Initial D: the formation drifts into every turn; headlights flash before a car fires;
    // skidding bullets leave burn marks that weaken the bunkers.
    1: { march: { step: 12, drop: 16, slow: 430, fast: 50, drift: true }, bunkers: 'arch', bunkerColor: '#aab4be', burn: true,
         headlights: { every: [1500, 2600], warn: 420, skid: 1.6 } },
    // Lorem Ipsum: rows spell words (clear a row = word bonus, in reading order = sentence bonus);
    // panels go "loading" (grey skeleton, can't be hit) for a moment; the formation moves like a
    // typewriter carriage - clack, clack, ding, and zip back.
    2: { march: { step: 10, drop: 18, slow: 470, fast: 55, typewriter: true }, bunkers: 'glyphs', glyphs: ['¶', '&', '§', '¶'],
         bunkerColor: '#c9a6ff', lorem: { words: ['LOREM', 'IPSUM', 'DOLOR', 'SIT', 'AMET'], every: [2200, 3600], load: 1200, share: 0.3 } },
    // Your Toast: bread visibly rises in a toaster, then POPS and falls at you; burnt (black) slices
    // stick to bunkers and patch them; a butter meter shows how close the "too much butter" restart is.
    3: { march: { step: 10, drop: 16, slow: 450, fast: 50 }, bunkers: 'loaf', bunkerColor: '#e0a458',
         toast: { every: [1200, 2100], rise: 700, burnt: 0.3, double: 0.15 } },
    // Grapefruit x Lime: grapefruits split into two halves on the first hit; halves drip juice that
    // pools into sticky puddles (slows your ship); falling lemons that reach the bunker line settle as extra cover.
    4: { march: { step: 10, drop: 16, slow: 460, fast: 55 }, bunkers: 'wedge', bunkerColor: '#9be15d',
         citrus: { puddle: 4200, slow: 0.45, maxLemons: 3 } },
    // Cake Was A Lie: candles light one by one - at 8 the whole cake fires one volley to "Happy Birthday";
    // clearing the bottom layer makes the cake collapse a layer; the last cupcake flees across the top.
    5: { march: { step: 10, drop: 16, slow: 460, fast: 55 }, bunkers: 'cake', bunkerColor: '#ffb6d9',
         cake: { lightEvery: [450, 800], volleyAt: 8, keepFire: 0.3 } },
    // Berserk: knights take 2 hits (the first knocks the helmet off); a red rage wave rolls down the
    // formation just before each berserk burst; during rage, swords slam into the ground as barriers;
    // flying into a shield pickup now works too (not just shooting it).
    6: { march: { step: 10, drop: 16, slow: 440, fast: 50 }, bunkers: 'shield', bunkerColor: '#c0c6cf',
         berserk: { warnTicks: 70, swords: 3, swordLife: 190 } }
  };
  // The game used to delete a level's special bullet for good (e.g. shooting a chocolate on Level 6
  // lost the frosting laser until a page reload). Remember the originals and restore them each level.
  const ORIGINAL_SPECIAL = typeof levelConfigs !== 'undefined' ? levelConfigs.map(l => l.special) : [];
  const ORIGINAL_FIRE = typeof levelConfigs !== 'undefined' ? levelConfigs.map(l => l.fireRate) : [];
  const cfg = () => LEVELS[typeof currentLevel !== 'undefined' ? currentLevel : -1] || null;

  // ---------- audio (tiny synth, no files) ----------
  let ac = null;
  function audio() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    return ac;
  }
  function tone(freq, dur, { type = 'square', vol = 0.1, slide = 0, filter = 0 } = {}) {
    const a = audio();
    if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, a.currentTime);
      if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + dur);
      g.gain.setValueAtTime(vol, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      let node = o;
      if (filter) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
      node.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + dur + 0.02);
    } catch (e) {}
  }
  function screech() {
    const a = audio();
    if (!a) return;
    try {
      const len = 0.4, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'bandpass'; f.Q.value = 9;
      f.frequency.setValueAtTime(2600, a.currentTime); f.frequency.linearRampToValueAtTime(1300, a.currentTime + len);
      g.gain.value = 0.07;
      src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
    } catch (e) {}
  }
  let smoke = [];
  function puff(x, y) {
    for (let i = 0; i < 4; i++) smoke.push({ x: x + rand(-4, 4), y: y + rand(-3, 3), r: rand(3, 6), vx: rand(-0.5, 0.5), vy: rand(-0.6, -0.1), life: rand(30, 55) });
  }
  function drawSmoke() {
    if (!smoke.length) return;
    const c = ctx;
    c.save();
    smoke = smoke.filter(p => p.life > 0);
    smoke.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.r += 0.18; p.life--;
      c.globalAlpha = Math.min(0.45, p.life / 90);
      c.fillStyle = '#c9ccd2';
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    });
    c.restore();
  }

  function clack() {
    const a = audio();
    if (!a) return;
    try {
      const len = 0.03, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = 0.25;
      src.buffer = buf; src.connect(f).connect(g).connect(a.destination); src.start();
    } catch (e) {}
  }
  const HEART = [98, 87, 78, 73]; // the descending 4-note march
  let heartIdx = 0;
  function heartbeat() { tone(HEART[heartIdx++ % 4], 0.11, { vol: 0.16, filter: 420 }); }

  // ================= SCORE =================
  const score = { now: 0, hi: lsGet(HI_KEY, 0), flash: 0 };
  let popups = [];
  function addScore(n, x, y, color) {
    score.now += n;
    if (score.now > score.hi) { score.hi = score.now; lsSet(HI_KEY, score.hi); score.flash = 40; }
    if (x !== undefined) popups.push({ x, y, text: String(n), life: 50, color: color || '#fff' });
  }
  function pad(n) { return String(n).padStart(5, '0'); }
  function drawScore() {
    const c = ctx;
    c.save();
    c.font = 'bold 13px "Courier New", monospace';
    c.textBaseline = 'top';
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.textAlign = 'left';
    c.fillText('SCORE ' + pad(score.now), 10, 8);
    c.textAlign = 'right';
    c.fillStyle = score.flash > 0 && (score.flash >> 2) % 2 ? '#ffd27a' : 'rgba(255,255,255,0.6)';
    c.fillText('HI ' + pad(score.hi), canvas.width - 10, 8);
    if (score.flash > 0) score.flash--;
    // floating point numbers
    c.textAlign = 'center';
    popups = popups.filter(p => p.life > 0);
    popups.forEach(p => {
      c.globalAlpha = Math.min(1, p.life / 20);
      c.fillStyle = p.color;
      c.font = 'bold 12px "Courier New", monospace';
      c.fillText(p.text, p.x, p.y - (50 - p.life) * 0.5);
      p.life--;
    });
    c.restore();
  }

  // Row points: top row is worth the most (classic 30/20/10)
  function assignPoints() {
    if (!Array.isArray(aliens)) return;
    const ys = [...new Set(aliens.map(a => Math.round(a.y)))].sort((a, b) => a - b);
    aliens.forEach(a => { a.points = 10 * (ys.length - ys.indexOf(Math.round(a.y))); });
  }

  // Count kills by watching aliens die
  let prevAlive = null;
  function trackKills() {
    if (!Array.isArray(aliens)) return;
    if (!prevAlive || prevAlive.length !== aliens.length) { prevAlive = aliens.map(a => a.alive); return; }
    aliens.forEach((a, i) => {
      if (prevAlive[i] && !a.alive) { if (onKill(a) !== 'absorbed') addScore(a.points || 10, a.x + a.width / 2, a.y, '#fff'); }
    });
    prevAlive = aliens.map(a => a.alive);
  }

  // ================= MARCH =================
  const march = { dir: 1, acc: 0, total: 0, frame: -1 };
  function marchStep(settings) {
    const alive = aliens.filter(a => a.alive && !a.flee);
    if (!alive.length) return;
    const minX = Math.min(...alive.map(a => a.x));
    const maxX = Math.max(...alive.map(a => a.x + a.width));
    const margin = 8;
    if (settings.typewriter) {
      if (maxX + settings.step > canvas.width - margin) {
        // end of the line: ding, line feed, carriage return
        tone(1760, 0.5, { type: 'sine', vol: 0.09 });
        alive.forEach(a => { a.y += settings.drop; });
        march.drift = { n: 6, dx: -(minX - margin) / 6, dy: 0, acc: 0 };
      } else {
        alive.forEach(a => { a.x += settings.step; a.originalX = a.x; });
        clack();
      }
      return;
    }
    if ((march.dir > 0 && maxX + settings.step > canvas.width - margin) || (march.dir < 0 && minX - settings.step < margin)) {
      if (settings.drift) {
        // slide into the turn: a few quick micro-steps that ease toward the wall while dropping
        const room = march.dir > 0 ? (canvas.width - 3) - maxX : minX - 3;
        march.drift = { n: 4, dx: march.dir * Math.max(0, Math.min(3, room / 4)), dy: settings.drop / 4, acc: 0 };
        screech();
        const back = alive.filter(a => a.y >= Math.max(...alive.map(z => z.y)) - 1);
        back.forEach(a => puff(march.dir > 0 ? a.x : a.x + a.width, a.y + a.height * 0.7));
        march.dir *= -1;
        heartbeat();
        return;
      }
      march.dir *= -1;
      alive.forEach(a => { a.y += settings.drop; });
    } else {
      alive.forEach(a => { a.x += settings.step * march.dir; a.originalX = a.x; });
    }
    heartbeat();
  }
  function marchInterval(settings) {
    const alive = aliens.filter(a => a.alive).length;
    const frac = march.total ? alive / march.total : 1;
    return settings.fast + (settings.slow - settings.fast) * Math.pow(frac, 1.35);
  }

  if (typeof updateAlienPosition === 'function') {
    const orig = updateAlienPosition;
    window.updateAlienPosition = updateAlienPosition = function (alien) {
      const c = cfg();
      if (!c || !c.march) return orig.apply(this, arguments);
      // the formation moves once per frame, not once per alien
      if (march.frame !== lastFrameTime) {
        march.frame = lastFrameTime;
        if (march.drift) {
          march.drift.acc += deltaTime;
          while (march.drift && march.drift.acc >= 45) {
            march.drift.acc -= 45;
            aliens.forEach(a => { if (a.alive && !a.flee) { a.x += march.drift.dx; a.y += march.drift.dy; a.originalX = a.x; } });
            if (--march.drift.n <= 0) march.drift = null;
          }
          return;
        }
        march.acc += deltaTime;
        const iv = marchInterval(c.march);
        if (march.acc >= iv) { march.acc = 0; marchStep(c.march); }
      }
    };
  }

  // ================= BUNKERS =================
  const CELL = 3;
  let bunkers = [];
  function buildBunkers(kind) {
    bunkers = [];
    if (!kind) return;
    const shapes = kind === 'ntb' ? ['N', 'T', 'B', '✦'] : kind === 'glyphs' ? (cfg() && cfg().glyphs || ['#'])
      : kind === 'loaf' ? ['#loaf', '#loaf', '#loaf', '#loaf'] : kind === 'wedge' ? ['#wedge', '#wedge', '#wedge', '#wedge']
      : kind === 'cake' ? ['#cake', '#cake', '#cake', '#cake'] : kind === 'shield' ? ['#shield', '#shield', '#shield', '#shield']
      : ['#arch', '#arch', '#arch', '#arch'];
    const W = canvas.width, n = shapes.length;
    const bw = Math.min(66, Math.floor(W / (n * 1.75)));
    const bh = Math.round(bw * 0.78);
    const y = player.y - bh - 46;
    const off = document.createElement('canvas');
    off.width = bw; off.height = bh;
    const o = off.getContext('2d', { willReadFrequently: true });
    shapes.forEach((ch, i) => {
      o.clearRect(0, 0, bw, bh);
      o.fillStyle = '#fff';
      if (ch === '#shield') {
        // a heater shield
        o.beginPath();
        o.moveTo(bw * 0.05, 0); o.lineTo(bw * 0.95, 0); o.lineTo(bw * 0.95, bh * 0.45);
        o.quadraticCurveTo(bw * 0.9, bh * 0.85, bw * 0.5, bh); o.quadraticCurveTo(bw * 0.1, bh * 0.85, bw * 0.05, bh * 0.45);
        o.closePath(); o.fill();
      }
      if (ch === '#cake') {
        // a two-tier cake
        o.fillRect(0, bh * 0.45, bw, bh * 0.55);
        o.fillRect(bw * 0.18, bh * 0.08, bw * 0.64, bh * 0.4);
        o.beginPath(); o.arc(bw * 0.5, bh * 0.08, bw * 0.08, 0, Math.PI * 2); o.fill(); // cherry
      }
      if (ch === '#wedge') {
        // a citrus slice: half-moon, flat side down
        o.beginPath();
        o.moveTo(0, bh); o.arc(bw / 2, bh, bw / 2, Math.PI, 0); o.closePath();
        o.fill();
      }
      if (ch === '#lemon') {
        o.beginPath(); o.ellipse(bw / 2, bh / 2, bw / 2, bh / 2.2, 0, 0, Math.PI * 2); o.fill();
      }
      if (ch === '#loaf') {
        // a slice of bread: puffy top, straight sides
        o.beginPath();
        o.moveTo(bw * 0.12, bh);
        o.lineTo(bw * 0.12, bh * 0.42);
        o.bezierCurveTo(-bw * 0.08, bh * 0.35, bw * 0.02, 0, bw * 0.3, bh * 0.04);
        o.quadraticCurveTo(bw * 0.5, -bh * 0.06, bw * 0.7, bh * 0.04);
        o.bezierCurveTo(bw * 0.98, 0, bw * 1.08, bh * 0.35, bw * 0.88, bh * 0.42);
        o.lineTo(bw * 0.88, bh);
        o.closePath();
        o.fill();
      }
      if (ch === '#arch') {
        // the 1978 bunker: flat top with bevelled corners and a notch underneath
        o.beginPath();
        o.moveTo(bw * 0.2, 0); o.lineTo(bw * 0.8, 0); o.lineTo(bw, bh * 0.25); o.lineTo(bw, bh);
        o.lineTo(bw * 0.72, bh); o.quadraticCurveTo(bw * 0.5, bh * 0.45, bw * 0.28, bh);
        o.lineTo(0, bh); o.lineTo(0, bh * 0.25); o.closePath();
        o.fill();
      }
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.font = `900 ${Math.round(bh * 1.15)}px "Arial Black", Impact, sans-serif`;
      if (ch.startsWith('#')) o.globalAlpha = 0; // shape already drawn; skip the text below
      o.strokeStyle = '#fff';
      o.lineWidth = Math.max(3, bw * 0.09); // thicken the letters so the bunkers are chunky
      o.lineJoin = 'round';
      o.strokeText(ch, bw / 2, bh / 2 + bh * 0.05);
      o.fillText(ch, bw / 2, bh / 2 + bh * 0.05);
      o.globalAlpha = 1;
      const data = o.getImageData(0, 0, bw, bh).data;
      const cols = Math.floor(bw / CELL), rows = Math.floor(bh / CELL);
      const cells = [];
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const px = (r * CELL + 1) * bw + (q * CELL + 1);
        if (data[px * 4 + 3] > 110) cells.push({ q, r, alive: true });
      }
      const x = Math.round((W / n) * (i + 0.5) - bw / 2);
      bunkers.push({ x, y, cols, rows, cells, map: new Map(cells.map(c => [c.q + ',' + c.r, c])) });
    });
  }
  function addShapeBunker(shape, x, y, bw, bh, color) {
    const off = document.createElement('canvas');
    off.width = bw; off.height = bh;
    const o = off.getContext('2d', { willReadFrequently: true });
    o.fillStyle = '#fff';
    if (shape === 'lemon') { o.beginPath(); o.ellipse(bw / 2, bh / 2, bw / 2 - 0.5, bh / 2 - 0.5, 0, 0, Math.PI * 2); o.fill(); }
    const data = o.getImageData(0, 0, bw, bh).data;
    const cols = Math.floor(bw / CELL), rows = Math.floor(bh / CELL), cells = [];
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      const px = (r * CELL + 1) * bw + (q * CELL + 1);
      if (data[px * 4 + 3] > 110) cells.push({ q, r, alive: true, tint: color });
    }
    const b = { x, y, cols, rows, cells, map: new Map(cells.map(c => [c.q + ',' + c.r, c])), extra: shape };
    bunkers.push(b);
    return b;
  }
  function bunkerHit(b, rx, ry, rw, rh) {
    // any live cell under the rectangle?
    const q0 = Math.floor((rx - b.x) / CELL), q1 = Math.floor((rx + rw - b.x) / CELL);
    const r0 = Math.floor((ry - b.y) / CELL), r1 = Math.floor((ry + rh - b.y) / CELL);
    for (let r = Math.max(0, r0); r <= Math.min(b.rows - 1, r1); r++) {
      for (let q = Math.max(0, q0); q <= Math.min(b.cols - 1, q1); q++) {
        const c = b.map.get(q + ',' + r);
        if (c && c.alive) return c;
      }
    }
    return null;
  }
  function erode(b, cell, radius) {
    b.cells.forEach(c => {
      if (!c.alive) return;
      const d = Math.hypot(c.q - cell.q, c.r - cell.r);
      if (d <= radius && Math.random() < 1.15 - d / (radius + 1)) c.alive = false;
    });
  }
  function bunkersVs(list, radius, burn) {
    if (!Array.isArray(list)) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (!s) continue;
      for (const b of bunkers) {
        const cell = bunkerHit(b, s.x, s.y, s.width, s.height);
        if (!cell) continue;
        if (s.toast && s.burnt) {
          // burnt toast sticks to the bunker and fills the holes around where it lands
          b.cells.forEach(c => { if (!c.alive && Math.hypot(c.q - cell.q, c.r - cell.r) <= 3.2) { c.alive = true; c.crust = true; } });
          tone(180, 0.08, { type: 'triangle', vol: 0.05 });
        } else if (cell.burnt) {
          erode(b, cell, radius + 1.6); // burnt rubber crumbles
        } else if (burn && Math.abs(s.vx || 0) > 0.3) {
          // a skidding bullet scorches a streak across the bunker and only chips it
          erode(b, cell, 1);
          const dir = Math.sign(s.vx);
          b.cells.forEach(c => { if (c.alive && Math.abs(c.r - cell.r) <= 1 && (c.q - cell.q) * dir >= -1 && (c.q - cell.q) * dir <= 7) c.burnt = true; });
        } else {
          erode(b, cell, radius);
        }
        list.splice(i, 1);
        break;
      }
    }
  }
  function drawBunkers(color) {
    const c = ctx;
    c.save();
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 6;
    bunkers.forEach(b => b.cells.forEach(cell => { if (cell.alive && !cell.burnt && !cell.crust && !cell.tint) c.fillRect(b.x + cell.q * CELL, b.y + cell.r * CELL, CELL, CELL); }));
    bunkers.forEach(b => b.cells.forEach(cell => { if (cell.alive && cell.tint) { c.fillStyle = cell.tint; c.fillRect(b.x + cell.q * CELL, b.y + cell.r * CELL, CELL, CELL); } }));
    c.fillStyle = '#6b3b1a';
    bunkers.forEach(b => b.cells.forEach(cell => { if (cell.alive && cell.crust) c.fillRect(b.x + cell.q * CELL, b.y + cell.r * CELL, CELL, CELL); }));
    c.shadowBlur = 0;
    c.fillStyle = '#3a2a22';
    bunkers.forEach(b => b.cells.forEach(cell => { if (cell.alive && cell.burnt) c.fillRect(b.x + cell.q * CELL, b.y + cell.r * CELL, CELL, CELL); }));
    c.restore();
  }
  function aliensEatBunkers() {
    aliens.forEach(a => {
      if (!a.alive) return;
      bunkers.forEach(b => b.cells.forEach(cell => {
        if (!cell.alive) return;
        const cx = b.x + cell.q * CELL, cy = b.y + cell.r * CELL;
        if (cx < a.x + a.width && cx + CELL > a.x && cy < a.y + a.height && cy + CELL > a.y) cell.alive = false;
      }));
    });
  }

  // ================= MYSTERY SHIP =================
  let ufo = null, ufoTimer = 0, drops = [];
  function spawnUfo(kind) {
    const fromLeft = Math.random() < 0.5;
    ufo = { kind, x: fromLeft ? -40 : canvas.width + 40, y: 30, w: 34, h: 18, vx: fromLeft ? 1.5 : -1.5 };
    tone(660, 0.25, { type: 'sine', vol: 0.05, slide: -120 });
  }
  function drawHanger(u) {
    const c = ctx, cx = u.x + u.w / 2, t = (typeof gameTick !== 'undefined' ? gameTick : 0);
    c.save();
    c.translate(cx, u.y + 4);
    c.rotate(Math.sin(t / 8) * 0.12);
    c.strokeStyle = '#ffd27a';
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 10;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, -2, 3.5, Math.PI, Math.PI * 2.25);        // hook
    c.moveTo(0, 1.5); c.lineTo(-u.w / 2, u.h - 6);     // shoulders
    c.lineTo(u.w / 2, u.h - 6); c.closePath();
    c.stroke();
    // blinking lights on the bar
    c.shadowBlur = 0;
    for (let i = -2; i <= 2; i++) {
      c.fillStyle = ((t >> 3) + i) % 2 ? '#ff5a6e' : '#7cf3d6';
      c.fillRect(i * 6 - 1, u.h - 8, 2, 2);
    }
    c.restore();
  }
  function updateUfo(settings) {
    if (!settings.mystery) { ufo = null; drops = []; return; }
    if (!ufo) {
      ufoTimer -= deltaTime;
      if (ufoTimer <= 0) { spawnUfo(settings.mystery); ufoTimer = rand(16000, 26000); }
    } else {
      ufo.x += ufo.vx * (deltaTime / 16);
      if ((typeof gameTick !== 'undefined' ? gameTick : 0) % 14 === 0) tone(520, 0.05, { type: 'sine', vol: 0.02 });
      drawHanger(ufo);
      // shot?
      if (Array.isArray(bullets)) {
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          if (b.x < ufo.x + ufo.w && b.x + b.width > ufo.x && b.y < ufo.y + ufo.h && b.y + b.height > ufo.y) {
            bullets.splice(i, 1);
            const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
            addScore(pts, ufo.x + ufo.w / 2, ufo.y, '#ffd27a');
            if (typeof spawnExplosion === 'function') spawnExplosion(ufo.x + ufo.w / 2, ufo.y + 8, '#ffd27a');
            tone(880, 0.35, { type: 'triangle', vol: 0.1, slide: -600 });
            if (Math.random() < 0.3) drops.push({ x: ufo.x + ufo.w / 2 - 9, y: ufo.y + 10, w: 18, h: 16 });
            ufo = null;
            break;
          }
        }
      }
      if (ufo && (ufo.x < -60 || ufo.x > canvas.width + 60)) ufo = null;
    }
    // falling shirts: +1 life (or +500 at full health)
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += 1.6 * (deltaTime / 16);
      drawTee(d.x, d.y, d.w, d.h);
      if (d.x < player.x + player.width && d.x + d.w > player.x && d.y < player.y + player.height && d.y + d.h > player.y) {
        drops.splice(i, 1);
        if (lives < 3) {
          lives++;
          document.querySelectorAll('.life').forEach((l, k) => { l.style.opacity = k < lives ? '1' : '0.3'; if (k < lives) l.classList.remove('lost'); });
          if (typeof showInGameMessage === 'function') showInGameMessage('Caught a shirt! +1 life');
        } else addScore(500, d.x + 9, d.y, '#7cf3d6');
        tone(990, 0.15, { type: 'triangle', vol: 0.08, slide: 400 });
      } else if (d.y > canvas.height) drops.splice(i, 1);
    }
  }
  function drawTee(x, y, w, h) {
    const c = ctx;
    c.save();
    c.fillStyle = '#f4f1ea';
    c.shadowColor = '#fff';
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(x + w * 0.32, y); c.quadraticCurveTo(x + w / 2, y + 3, x + w * 0.68, y);
    c.lineTo(x + w, y + h * 0.25); c.lineTo(x + w * 0.85, y + h * 0.45); c.lineTo(x + w * 0.75, y + h * 0.38);
    c.lineTo(x + w * 0.75, y + h); c.lineTo(x + w * 0.25, y + h); c.lineTo(x + w * 0.25, y + h * 0.38);
    c.lineTo(x + w * 0.15, y + h * 0.45); c.lineTo(x, y + h * 0.25); c.closePath();
    c.fill();
    c.restore();
  }

  // ================= HEADLIGHTS (telegraphed enemy fire) =================
  // The level's own random fire is switched off; instead a front-line car flashes
  // its headlights, then fires a skidding shot.
  let hl = { timer: 1500, warned: [] };
  function frontLine() {
    const cols = {};
    aliens.forEach(a => { if (!a.alive) return; const k = Math.round(a.x / 8); if (!cols[k] || a.y > cols[k].y) cols[k] = a; });
    return Object.values(cols);
  }
  function updateHeadlights(h) {
    hl.timer -= deltaTime;
    if (hl.timer <= 0 && !respawning) {
      const alive = aliens.filter(a => a.alive).length;
      const front = frontLine();
      if (front.length) {
        const car = front[Math.floor(Math.random() * front.length)];
        car.flash = h.warn;
        hl.warned.push(car);
        tone(1320, 0.05, { type: 'square', vol: 0.03 });
      }
      const speedUp = march.total ? 0.45 + 0.55 * (alive / march.total) : 1;
      hl.timer = rand(h.every[0], h.every[1]) * speedUp;
    }
    const c = ctx;
    hl.warned = hl.warned.filter(car => {
      if (!car.alive) return false;
      car.flash -= deltaTime;
      // twin headlight beams pointing down at you
      const a = Math.max(0, Math.min(1, car.flash / h.warn));
      c.save();
      c.globalAlpha = 0.25 + 0.5 * (1 - a) * (Math.sin(car.flash / 25) > 0 ? 1 : 0.6);
      const g = c.createLinearGradient(0, car.y + car.height, 0, car.y + car.height + 70);
      g.addColorStop(0, 'rgba(255,245,200,0.9)'); g.addColorStop(1, 'rgba(255,245,200,0)');
      c.fillStyle = g;
      [0.28, 0.72].forEach(f => {
        const x = car.x + car.width * f;
        c.beginPath(); c.moveTo(x - 1.5, car.y + car.height); c.lineTo(x + 1.5, car.y + car.height);
        c.lineTo(x + 9, car.y + car.height + 70); c.lineTo(x - 9, car.y + car.height + 70); c.closePath(); c.fill();
      });
      c.globalAlpha = 1;
      c.fillStyle = '#fff8d0';
      c.fillRect(car.x + car.width * 0.2, car.y + car.height - 2, 3, 2);
      c.fillRect(car.x + car.width * 0.72, car.y + car.height - 2, 3, 2);
      c.restore();
      if (car.flash <= 0) {
        enemyBullets.push({ x: car.x + car.width / 2 - 2, y: car.y + car.height, width: 4, height: 10, active: true, color: '#ffd27a', vx: rand(-h.skid, h.skid) });
        if (typeof playSound === 'function' && typeof shootSound !== 'undefined') playSound(shootSound, { volume: 0.35, rate: 0.7 });
        return false;
      }
      return true;
    });
  }

  // ================= LOREM IPSUM =================
  let lorem = { timer: 2500, rowsDone: [], letters: [] };
  function setupLorem(L) {
    lorem = { timer: 2500, rowsDone: [], letters: [], rows: 0 };
    const ys = [...new Set(aliens.map(a => Math.round(a.y)))].sort((a, b) => a - b);
    lorem.rows = ys.length;
    aliens.forEach(a => {
      a.row = ys.indexOf(Math.round(a.y));
      a.word = L.words[a.row % L.words.length];
      a.width = Math.max(a.width, 34); // room for the word
      a.isFlickering = false;
      a.loading = 0;
    });
    // re-centre after widening the panels
    const cols = Math.round(aliens.length / lorem.rows);
    const w = aliens[0].width, gap = 6, total = cols * w + (cols - 1) * gap, x0 = (canvas.width - total) / 2;
    aliens.forEach((a, i) => { const q = i % cols; a.x = a.originalX = x0 + q * (w + gap); });
  }
  function updateLorem(L) {
    lorem.timer -= deltaTime;
    if (lorem.timer <= 0) {
      lorem.timer = rand(L.every[0], L.every[1]);
      aliens.forEach(a => { if (a.alive && !a.loading && Math.random() < L.share) { a.loading = L.load; a.isFlickering = true; } });
    }
    aliens.forEach(a => {
      if (a.loading > 0) { a.loading -= deltaTime; if (a.loading <= 0) { a.loading = 0; a.isFlickering = false; } }
    });
    // flying letters from cleared words
    const c = ctx;
    c.save();
    c.font = 'bold 16px "Courier New", monospace';
    c.textAlign = 'center';
    lorem.letters = lorem.letters.filter(l => l.life > 0);
    lorem.letters.forEach(l => {
      l.x += l.vx; l.y += l.vy; l.vy += 0.08; l.rot += l.vr; l.life--;
      c.globalAlpha = Math.min(1, l.life / 30);
      c.fillStyle = '#e7d4ff';
      c.save(); c.translate(l.x, l.y); c.rotate(l.rot); c.fillText(l.ch, 0, 0); c.restore();
    });
    c.restore();
  }
  function onKill(a) {
    const c = cfg();
    if (c && c.berserk) { if (a.type === 'armor' && a.helmet !== false) return knockHelmet(a); return; }
    if (c && c.cake) { cakeKill(a); return; }
    if (c && c.citrus) {
      if (a.type === 'grapefruit' && !a.half) splitGrapefruit(a);
      else if (a.half) citrus.drips.push({ x: a.x + a.width / 2, y: a.y + a.height });
      return;
    }
    if (!c || !c.lorem || a.row === undefined) return;
    const rowLeft = aliens.some(z => z.alive && z.row === a.row);
    if (rowLeft || lorem.rowsDone.includes(a.row)) return;
    lorem.rowsDone.push(a.row);
    const word = a.word;
    addScore(100, canvas.width / 2, a.y - 22, '#c9a6ff');
    word.split('').forEach((ch, k) => lorem.letters.push({ ch, x: canvas.width / 2 + (k - word.length / 2) * 14, y: a.y, vx: rand(-2, 2), vy: rand(-3.5, -1.5), vr: rand(-0.15, 0.15), rot: 0, life: 70 }));
    tone(1320, 0.12, { type: 'triangle', vol: 0.07 }); setTimeout(() => tone(1760, 0.2, { type: 'triangle', vol: 0.07 }), 90);
    if (typeof showInGameMessage === 'function') showInGameMessage(`"${word}" deleted`);
    if (lorem.rowsDone.length === lorem.rows) {
      const inOrder = lorem.rowsDone.every((r, k) => r === k);
      if (inOrder) {
        addScore(500, canvas.width / 2, canvas.height / 2, '#ffd27a');
        setTimeout(() => { if (typeof showInGameMessage === 'function') showInGameMessage('Read in order. SENTENCE BONUS +500'); }, 2100);
        say('You read it top to bottom. A scholar.');
      }
    }
  }
  // "loading" panels: a grey skeleton box with a moving shimmer
  if (typeof drawAlien === 'function') {
    const orig = drawAlien;
    window.drawAlien = drawAlien = function (alien) {
      if (!(alien.type === 'latin' && alien.loading > 0)) return orig.apply(this, arguments);
      const c = ctx, x = alien.x, y = alien.y, w = alien.width, h = alien.height;
      c.save();
      c.globalAlpha = 0.55;
      c.fillStyle = '#3b3a4a';
      drawRoundedRect(x, y, w, h, 5); c.fill();
      const t = (performance.now() / 600) % 1;
      const g = c.createLinearGradient(x - w + t * w * 3, 0, x + t * w * 3, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      drawRoundedRect(x, y, w, h, 5); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(x + 5, y + h / 2 - 2, w - 10, 3);
      c.restore();
    };
  }

  // ================= YOUR TOAST =================
  let toast = { timer: 1500, loading: [] };
  function ding() { tone(2093, 0.35, { type: 'sine', vol: 0.06 }); setTimeout(() => tone(2637, 0.3, { type: 'sine', vol: 0.04 }), 40); }
  function drawSlice(c, x, y, w, h, burnt, rot) {
    c.save();
    c.translate(x + w / 2, y + h / 2);
    c.rotate(rot || 0);
    c.fillStyle = burnt ? '#2b1a10' : '#e7b46a';
    c.strokeStyle = burnt ? '#120a05' : '#9a5b22';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-w / 2, h / 2); c.lineTo(-w / 2, -h * 0.1);
    c.quadraticCurveTo(-w / 2, -h / 2, 0, -h / 2); c.quadraticCurveTo(w / 2, -h / 2, w / 2, -h * 0.1);
    c.lineTo(w / 2, h / 2); c.closePath();
    c.fill(); c.stroke();
    if (!burnt) { c.fillStyle = '#f6dca8'; c.fillRect(-w / 2 + 2, -h * 0.1, w - 4, h / 2 + h * 0.1 - 2); }
    c.restore();
  }
  function updateToast(T) {
    toast.timer -= deltaTime;
    if (toast.timer <= 0 && !respawning) {
      const front = frontLine().filter(a => !toast.loading.includes(a));
      if (front.length) {
        const t = front[Math.floor(Math.random() * front.length)];
        t.rise = 0; t.burntNext = Math.random() < T.burnt; t.doubleNext = Math.random() < T.double;
        toast.loading.push(t);
      }
      const alive = aliens.filter(a => a.alive).length;
      toast.timer = rand(T.every[0], T.every[1]) * (march.total ? 0.45 + 0.55 * alive / march.total : 1);
    }
    const c = ctx;
    toast.loading = toast.loading.filter(t => {
      if (!t.alive) return false;
      t.rise += deltaTime;
      const k = Math.min(1, t.rise / T.rise);
      // slices poking out of the top of the toaster, rising (and shaking just before the pop)
      const shake = k > 0.8 ? Math.sin(t.rise / 18) * 1.2 : 0;
      const sw = t.width * 0.36, sh = 13;
      const top = t.y - sh * k + 4;
      drawSlice(c, t.x + t.width * (t.doubleNext ? 0.12 : 0.32) + shake, top, sw, sh, t.burntNext, 0);
      if (t.doubleNext) drawSlice(c, t.x + t.width * 0.52 + shake, top, sw, sh, t.burntNext, 0);
      if (k >= 1) {
        ding();
        const shots = t.doubleNext ? [-1.1, 1.1] : [0];
        shots.forEach(vx => enemyBullets.push({ x: t.x + t.width / 2 - 5, y: t.y - 6, width: 10, height: 10, active: true,
          color: t.burntNext ? '#2b1a10' : '#e7b46a', vx, vy: -3.2, toast: true, burnt: t.burntNext, spin: rand(-0.2, 0.2) }));
        return false;
      }
      return true;
    });
  }
  // popped slices fly up, arc over and fall with gravity; drawn as toast on top of the game's dot
  function drawToastBullets() {
    enemyBullets.forEach(b => {
      if (!b.toast) return;
      if (b.vy !== undefined && !b.bounced) b.vy = Math.min(b.vy + 0.16 * (deltaTime / 16), 5.2);
      b.rot = (b.rot || 0) + b.spin;
      drawSlice(ctx, b.x - 1, b.y - 1, 12, 12, b.burnt, b.rot);
    });
  }
  function drawButterMeter() {
    const n = typeof levelButterHits !== 'undefined' ? levelButterHits : 0;
    const c = ctx;
    c.save();
    c.font = 'bold 12px "Courier New", monospace';
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.fillStyle = n >= 3 ? (Math.floor(performance.now() / 250) % 2 ? '#ff5a6e' : '#ffe27a') : 'rgba(255,255,255,0.8)';
    c.fillText('BUTTER', 10, 26);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i < n ? '#ffe27a' : 'rgba(255,255,255,0.18)';
      c.fillRect(64 + i * 13, 27, 10, 9);
    }
    c.restore();
  }

  // ================= GRAPEFRUIT x LIME =================
  let citrus = { drips: [], puddles: [], lemons: 0, baseSpeed: 7 };
  function splitGrapefruit(a) {
    [-1, 1].forEach(side => {
      const w = Math.round(a.width * 0.62), h = Math.round(a.height * 0.6);
      const x = Math.max(4, Math.min(canvas.width - w - 4, a.x + (side < 0 ? 0 : a.width - w)));
      aliens.push({ x, y: a.y + 4, width: w, height: h, type: 'gfhalf', side, half: true, alive: true, originalX: x,
        points: 15, kick: side * 1.8, movePattern: 0, driftSpeed: 1, bobSeed: Math.random() * 6, isFlickering: false });
    });
    tone(300, 0.15, { type: 'triangle', vol: 0.08, slide: -160 });
  }
  function updateCitrus(C) {
    const c = ctx;
    // halves spring apart after a split
    aliens.forEach(a => {
      if (a.half && a.kick) {
        a.x = Math.max(4, Math.min(canvas.width - a.width - 4, a.x + a.kick * (deltaTime / 16)));
        a.originalX = a.x;
        a.kick *= 0.88;
        if (Math.abs(a.kick) < 0.05) a.kick = 0;
      }
    });
    // juice drips fall straight down and pool on the floor
    const floor = player.y + player.height - 3;
    citrus.drips = citrus.drips.filter(d => {
      d.y += 3.4 * (deltaTime / 16);
      c.save(); c.fillStyle = '#ff7b93'; c.beginPath();
      c.moveTo(d.x, d.y - 5); c.quadraticCurveTo(d.x + 4, d.y + 2, d.x, d.y + 3); c.quadraticCurveTo(d.x - 4, d.y + 2, d.x, d.y - 5); c.fill(); c.restore();
      if (d.y >= floor) { citrus.puddles.push({ x: d.x, w: 40, life: C.puddle, born: C.puddle }); tone(140, 0.12, { type: 'sine', vol: 0.06 }); return false; }
      return true;
    });
    let sticky = false;
    citrus.puddles = citrus.puddles.filter(p => {
      p.life -= deltaTime;
      const k = Math.min(1, p.life / 600, (p.born - p.life) / 200);
      c.save();
      c.globalAlpha = 0.55 * k;
      c.fillStyle = '#ff5f86';
      c.beginPath(); c.ellipse(p.x, floor + 2, p.w / 2 * Math.min(1, (p.born - p.life) / 250), 4, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.8 * k; c.fillStyle = '#ffd1dc';
      c.beginPath(); c.ellipse(p.x - 6, floor + 1, 4, 1.2, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      if (player.x + player.width > p.x - p.w / 2 && player.x < p.x + p.w / 2) sticky = true;
      return p.life > 0;
    });
    player.speed = sticky ? citrus.baseSpeed * C.slow : citrus.baseSpeed;
    if (sticky && !citrus.wasSticky) tone(200, 0.2, { type: 'sine', vol: 0.05, slide: -80 });
    citrus.wasSticky = sticky;
    // lemons that reach the bunker line settle there as extra round cover
    if (Array.isArray(obstacles) && bunkers.length && citrus.lemons < C.maxLemons) {
      const lineY = bunkers[0].y + 6;
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        if (o.type !== 'lemon' || o.y + o.height < lineY - 14) continue;
        const bw = 24, bh = 18, x = Math.max(4, Math.min(canvas.width - bw - 4, o.x + o.width / 2 - bw / 2));
        const main = bunkers.filter(b => !b.extra);
        const under = main.find(b => x + bw / 2 > b.x && x + bw / 2 < b.x + b.cols * CELL);
        let y;
        if (under) {
          // no room beside it: the lemon perches on top of that bunker (one lemon per bunker)
          if (under.lemonOnTop) continue;
          under.lemonOnTop = true;
          y = under.y - bh + 4;
        } else {
          if (bunkers.some(b => x < b.x + b.cols * CELL + 2 && x + bw > b.x - 2)) continue;
          y = main[0].y + main[0].rows * CELL - bh;
        }
        obstacles.splice(i, 1);
        addShapeBunker('lemon', x, y, bw, bh, '#fff45c');
        citrus.lemons++;
        tone(520, 0.1, { type: 'triangle', vol: 0.06 });
        if (typeof showInGameMessage === 'function') showInGameMessage('A lemon took cover with you');
      }
    }
  }
  // grapefruit halves
  if (typeof drawAlien === 'function') {
    const orig2 = drawAlien;
    window.drawAlien = drawAlien = function (alien) {
      if (alien.type !== 'gfhalf') return orig2.apply(this, arguments);
      const c = ctx, w = alien.width, h = alien.height, cx = alien.x + w / 2, cy = alien.y + h * 0.35;
      c.save();
      c.translate(cx, cy);
      c.rotate(alien.side * 0.3);
      c.shadowColor = 'rgba(255,107,129,0.6)'; c.shadowBlur = 8;
      c.fillStyle = '#ff6b6b';
      c.beginPath(); c.arc(0, 0, w / 2, 0, Math.PI); c.closePath(); c.fill();     // rind
      c.shadowBlur = 0;
      c.fillStyle = '#ff9aa8';
      c.beginPath(); c.arc(0, 0, w / 2 - 2, 0, Math.PI); c.closePath(); c.fill();  // flesh
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8;
      for (let k = 1; k < 5; k++) { const an = (k / 5) * Math.PI; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(an) * (w / 2 - 2), Math.sin(an) * (w / 2 - 2)); c.stroke(); }
      c.restore();
    };
  }

  // ================= CAKE WAS A LIE =================
  let cake = { timer: 900, lit: 0, rows: 0, rowGap: 0, layersDone: [], liar: null };
  function setupCake() {
    const ys = [...new Set(aliens.map(a => Math.round(a.y)))].sort((a, b) => a - b);
    cake = { timer: 900, lit: 0, rows: ys.length, rowGap: ys.length > 1 ? ys[1] - ys[0] : 34, layersDone: [], liar: null };
    aliens.forEach(a => { a.row = ys.indexOf(Math.round(a.y)); a.candle = false; });
  }
  function drawCandle(a) {
    const c = ctx, x = a.x + a.width / 2, top = a.y - 7;
    c.save();
    c.fillStyle = '#fff'; c.fillRect(x - 1, top, 2.4, 8);
    c.fillStyle = '#ff5fa2'; c.fillRect(x - 1, top + 2, 2.4, 1.4); c.fillRect(x - 1, top + 5, 2.4, 1.4);
    if (a.candle) {
      const f = 1 + Math.sin(performance.now() / 70 + a.x) * 0.25;
      c.shadowColor = '#ffb13b'; c.shadowBlur = 10;
      c.fillStyle = '#ffd15c';
      c.beginPath(); c.ellipse(x + 0.2, top - 3.5, 2.2, 3.8 * f, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6c2';
      c.beginPath(); c.ellipse(x + 0.2, top - 2.5, 1, 1.8 * f, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  function birthday() {
    // the first line of "Happy Birthday", slightly out of tune
    [[392, 0], [392, 150], [440, 300], [392, 520], [523, 740], [494, 960]].forEach(([f, t]) =>
      setTimeout(() => tone(f * (0.97 + Math.random() * 0.06), 0.2, { type: 'triangle', vol: 0.06 }), t));
  }
  function updateCake(K) {
    const alive = aliens.filter(a => a.alive && !a.flee);
    // light one more candle
    cake.timer -= deltaTime;
    if (cake.timer <= 0 && !respawning) {
      cake.timer = rand(K.lightEvery[0], K.lightEvery[1]);
      const unlit = alive.filter(a => !a.candle);
      if (unlit.length) { unlit[Math.floor(Math.random() * unlit.length)].candle = true; tone(1600, 0.04, { type: 'sine', vol: 0.03 }); }
    }
    cake.lit = alive.filter(a => a.candle).length;
    const target = Math.min(K.volleyAt, alive.length);
    alive.forEach(drawCandle);
    if (target > 0 && cake.lit >= target) {
      // the volley: every lit cupcake fires at once
      birthday();
      alive.filter(a => a.candle).forEach(a => {
        enemyBullets.push({ x: a.x + a.width / 2 - 3, y: a.y + a.height, width: 6, height: 12, active: true, color: '#ff69b4', vx: 0 });
        a.candle = false;
      });
      if (typeof showInGameMessage === 'function') showInGameMessage('Happy birthday to you…');
      cake.lit = 0;
      cake.timer = 1500;
    }
    // candle meter
    const c = ctx;
    c.save();
    c.font = 'bold 12px "Courier New", monospace';
    c.textBaseline = 'top'; c.textAlign = 'left';
    c.fillStyle = cake.lit >= target - 2 ? (Math.floor(performance.now() / 220) % 2 ? '#ff69b4' : '#ffd15c') : 'rgba(255,255,255,0.8)';
    c.fillText('CANDLES', 10, 26);
    for (let i = 0; i < K.volleyAt; i++) {
      c.fillStyle = i < cake.lit ? '#ffd15c' : 'rgba(255,255,255,0.18)';
      c.fillRect(72 + i * 9, 27, 6, 9);
    }
    c.restore();
    // the last cupcake runs away and zooms around the top
    if (!cake.liar && alive.length === 1 && aliens.filter(a => a.alive).length === 1) {
      const a = alive[0];
      a.flee = true; a.candle = false; a.vx = 3.4; a.y = 34;
      cake.liar = a;
      tone(700, 0.4, { type: 'sine', vol: 0.06, slide: 500 });
      if (typeof showInGameMessage === 'function') showInGameMessage('The last cupcake is running!');
      say('The last cupcake is making a run for it. Of course it is.');
    }
    if (cake.liar && cake.liar.alive) {
      const a = cake.liar;
      a.x += a.vx * (deltaTime / 16);
      a.y = 34 + Math.sin(performance.now() / 180) * 6;
      if (a.x < 4) { a.x = 4; a.vx = Math.abs(a.vx); }
      if (a.x + a.width > canvas.width - 4) { a.x = canvas.width - 4 - a.width; a.vx = -Math.abs(a.vx); }
      a.originalX = a.x;
    }
  }
  function cakeKill(a) {
    if (a === cake.liar) {
      addScore(300, a.x + a.width / 2, a.y + 16, '#ffd15c');
      if (typeof showInGameMessage === 'function') showInGameMessage('It was hollow. THE CAKE WAS A LIE.');
      say('Hollow. I told you. The cake was a lie.');
      tone(196, 0.5, { type: 'sawtooth', vol: 0.06, slide: -80 });
      return;
    }
    // bottom layer gone? the cake collapses one layer
    const bottom = Math.max(...aliens.filter(z => z.alive && !z.flee).map(z => z.row).concat([-1]));
    const remainingRows = [...new Set(aliens.filter(z => z.alive && !z.flee).map(z => z.row))];
    if (!aliens.some(z => z.alive && !z.flee && z.row === a.row) && !cake.layersDone.includes(a.row) && a.row > bottom && remainingRows.length) {
      cake.layersDone.push(a.row);
      addScore(100, canvas.width / 2, a.y - 20, '#ffb6d9');
      march.drift = { n: 5, dx: 0, dy: cake.rowGap / 5, acc: 0 };
      if (typeof chaosEffects !== 'undefined') chaosEffects.shake = 12;
      tone(80, 0.3, { type: 'sine', vol: 0.2 });
      if (typeof showInGameMessage === 'function') showInGameMessage('A layer fell. The cake collapses.');
    }
  }

  // ================= BERSERK =================
  let bz = { helmets: [], swords: [], wasRaging: false };
  function knockHelmet(a) {
    a.alive = true;           // the armour took the hit
    a.helmet = false;
    bz.helmets.push({ x: a.x + a.width / 2, y: a.y, vx: rand(-2.2, 2.2), vy: -3.2, rot: 0, vr: rand(-0.3, 0.3), life: 70 });
    tone(1200, 0.08, { type: 'square', vol: 0.06 }); tone(700, 0.15, { type: 'triangle', vol: 0.05, slide: -300 });
    addScore(5, a.x + a.width / 2, a.y, '#c0c6cf');
    return 'absorbed';
  }
  function updateBerserk(Z) {
    const c = ctx;
    const raging = typeof berserkRage !== 'undefined' && berserkRage > 0;
    const left = 300 - (gameTick % 300);
    const alive = aliens.filter(a => a.alive);
    const rows = [...new Set(alive.map(a => Math.round(a.y)))].sort((p, q) => p - q);
    // the warning wave: rows glow red one after another, top to bottom
    if (!raging && left <= Z.warnTicks) {
      const k = 1 - left / Z.warnTicks;
      const lit = Math.ceil(k * rows.length);
      c.save();
      alive.forEach(a => {
        const r = rows.indexOf(Math.round(a.y));
        if (r >= lit) return;
        c.globalAlpha = 0.35 + 0.3 * Math.sin(performance.now() / 60);
        c.fillStyle = '#ff2a2a';
        c.shadowColor = '#ff2a2a'; c.shadowBlur = 14;
        c.fillRect(a.x - 2, a.y - 2, a.width + 4, a.height + 4);
      });
      c.restore();
      if (left === Z.warnTicks) tone(110, 0.9, { type: 'sawtooth', vol: 0.05, slide: 60, filter: 600 });
    }
    // rage: everyone glows and steams
    if (raging) {
      c.save();
      alive.forEach(a => {
        c.globalAlpha = 0.25 + 0.2 * Math.sin(performance.now() / 40 + a.x);
        c.fillStyle = '#ff2a2a';
        c.fillRect(a.x - 1, a.y - 1, a.width + 2, a.height + 2);
      });
      c.restore();
    }
    // rage just began: swords slam into the ground between you and them
    if (raging && !bz.wasRaging) {
      const top = alive.length ? Math.max(...alive.map(a => a.y + a.height)) + 20 : 200;
      const bottom = bunkers.length ? bunkers[0].y - 34 : player.y - 90;
      const y = Math.min(bottom, Math.max(top, (top + bottom) / 2));
      for (let i = 0; i < Z.swords; i++) {
        const x = canvas.width * ((i + 0.5) / Z.swords) + rand(-25, 25);
        bz.swords.push({ x, y, h: 30, life: Z.swordLife, slam: 1 });
      }
      tone(70, 0.4, { type: 'sine', vol: 0.2 });
      if (typeof chaosEffects !== 'undefined') chaosEffects.shake = 10;
    }
    bz.wasRaging = raging;
    // swords: block your shots, then crumble
    bz.swords = bz.swords.filter(sw => {
      sw.life--;
      sw.slam = Math.max(0, sw.slam - 0.12);
      const yy = sw.y - sw.slam * 60;
      c.save();
      c.globalAlpha = Math.min(1, sw.life / 20);
      c.fillStyle = '#dfe6ee'; c.shadowColor = '#fff'; c.shadowBlur = 6;
      c.beginPath(); c.moveTo(sw.x - 3, yy); c.lineTo(sw.x + 3, yy); c.lineTo(sw.x + 3, yy + sw.h - 4); c.lineTo(sw.x, yy + sw.h); c.lineTo(sw.x - 3, yy + sw.h - 4); c.closePath(); c.fill(); // blade (point down)
      c.shadowBlur = 0;
      c.fillStyle = '#d4a93a'; c.fillRect(sw.x - 9, yy - 3, 18, 3);   // crossguard
      c.fillStyle = '#6b3b1a'; c.fillRect(sw.x - 1.5, yy - 11, 3, 8); // grip
      c.fillStyle = '#d4a93a'; c.beginPath(); c.arc(sw.x, yy - 12, 2.5, 0, Math.PI * 2); c.fill(); // pommel
      c.restore();
      if (Array.isArray(bullets)) {
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          if (b.x < sw.x + 9 && b.x + b.width > sw.x - 9 && b.y < yy + sw.h && b.y + b.height > yy - 12) {
            bullets.splice(i, 1);
            tone(1800 + Math.random() * 400, 0.06, { type: 'square', vol: 0.04 });
            if (typeof spawnExplosion === 'function') spawnExplosion(sw.x, yy + sw.h / 2, '#ffffff');
          }
        }
      }
      return sw.life > 0;
    });
    // flying helmets
    bz.helmets = bz.helmets.filter(h => {
      h.x += h.vx; h.y += h.vy; h.vy += 0.18; h.rot += h.vr; h.life--;
      c.save(); c.translate(h.x, h.y); c.rotate(h.rot);
      c.fillStyle = '#9aa3ad'; c.beginPath(); c.arc(0, 0, 6, Math.PI, 0); c.lineTo(6, 3); c.lineTo(-6, 3); c.closePath(); c.fill();
      c.fillStyle = '#222'; c.fillRect(-4, -1, 8, 1.5);
      c.restore();
      return h.life > 0;
    });
    // PDF rule: flying INTO a shield pickup also grants invisibility
    if (Array.isArray(shields)) {
      for (let i = shields.length - 1; i >= 0; i--) {
        const sh = shields[i];
        if (sh.x < player.x + player.width && sh.x + sh.size > player.x && sh.y < player.y + player.height && sh.y + sh.size > player.y) {
          shields.splice(i, 1);
          playerInvisible = true;
          invisibleTimer = Math.max(invisibleTimer || 0, 300);
          if (typeof showInGameMessage === 'function') showInGameMessage('Shield grabbed! Invisible for 5 seconds');
          tone(880, 0.3, { type: 'sine', vol: 0.07, slide: 440 });
        }
      }
    }
  }
  // helmetless knights: cracked armour and glowing red eyes
  if (typeof drawAlien === 'function') {
    const orig3 = drawAlien;
    window.drawAlien = drawAlien = function (alien) {
      const r = orig3.apply(this, arguments);
      if (alien.type === 'armor' && alien.helmet === false) {
        const c = ctx, x = alien.x, y = alien.y, w = alien.width, h = alien.height;
        c.save();
        c.strokeStyle = 'rgba(20,20,20,0.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x + w * 0.3, y + h * 0.2); c.lineTo(x + w * 0.45, y + h * 0.5); c.lineTo(x + w * 0.35, y + h * 0.8);
        c.moveTo(x + w * 0.7, y + h * 0.3); c.lineTo(x + w * 0.6, y + h * 0.6); c.stroke();
        c.fillStyle = '#ff2a2a'; c.shadowColor = '#ff2a2a'; c.shadowBlur = 8;
        c.fillRect(x + w * 0.28, y + h * 0.3, 3, 2); c.fillRect(x + w * 0.62, y + h * 0.3, 3, 2);
        c.restore();
      }
      return r;
    };
  }

  // ================= hooks =================
  // Runs every frame, right after the aliens are drawn
  if (typeof updateEnemyBullets === 'function') {
    const orig = updateEnemyBullets;
    window.updateEnemyBullets = updateEnemyBullets = function () {
      const c = cfg();
      trackKills();
      if (c && c.bunkers && bunkers.length) {
        bunkersVs(bullets, 1.6);      // your shots chip the top of the bunker
        bunkersVs(enemyBullets, 2.4, c.burn); // theirs blast bigger holes (or scorch, on Initial D)
        aliensEatBunkers();
        drawBunkers(c.bunkerColor || '#7cf3d6');
      }
      if (c) updateUfo(c);
      if (c && c.headlights && Array.isArray(aliens)) updateHeadlights(c.headlights);
      if (c && c.lorem && Array.isArray(aliens)) updateLorem(c.lorem);
      if (c && c.toast && Array.isArray(aliens)) updateToast(c.toast);
      if (c && c.citrus && Array.isArray(aliens)) updateCitrus(c.citrus);
      if (c && c.cake && Array.isArray(aliens)) updateCake(c.cake);
      if (c && c.berserk && Array.isArray(aliens)) updateBerserk(c.berserk);
      drawSmoke();
      const r = orig.apply(this, arguments);
      if (c && c.toast) { drawToastBullets(); drawButterMeter(); }
      drawScore();
      return r;
    };
  }

  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (i) {
      // the game ends a level the instant the last invader dies, before our per-frame
      // hook runs - so settle the final kills (and any word/sentence bonus) first
      if (Array.isArray(aliens) && prevAlive) trackKills();
      if (levelConfigs[i]) {
        if (ORIGINAL_SPECIAL[i] !== undefined) levelConfigs[i].special = ORIGINAL_SPECIAL[i]; // chocolate bug fix
        if (ORIGINAL_FIRE[i] !== undefined) levelConfigs[i].fireRate = ORIGINAL_FIRE[i];
      }
      const r = orig.apply(this, arguments);
      const c = LEVELS[i];
      march.dir = 1; march.acc = 0; march.frame = -1;
      march.total = Array.isArray(aliens) ? aliens.length : 0;
      prevAlive = null;
      ufo = null; drops = [];
      ufoTimer = rand(7000, 12000);
      if (c && c.lorem) setupLorem(c.lorem);
      bz = { helmets: [], swords: [], wasRaging: false };
      if (c && c.cake) { setupCake(); if (levelConfigs[i]) levelConfigs[i].fireRate = ORIGINAL_FIRE[i] * c.cake.keepFire; }
      assignPoints();
      buildBunkers(c && c.bunkers);
      march.drift = null; smoke = [];
      hl = { timer: 1800, warned: [] };
      toast = { timer: 1600, loading: [] };
      if (player) { player.speed = citrus.baseSpeed || 7; }
      citrus = { drips: [], puddles: [], lemons: 0, baseSpeed: 7, wasSticky: false };
      if (c && c.toast && levelConfigs[i]) levelConfigs[i].fireRate = 0; // toasters only fire by popping
      if (c && c.headlights && levelConfigs[i]) levelConfigs[i].fireRate = 0; // headlights decide who fires
      if (i === 1 && c) setTimeout(() => say('Watch the headlights. They blink before they shoot.'), 3000);
      if (i === 2 && c) setTimeout(() => say('Grey boxes are still loading. Your bullets go straight through them.'), 3000);
      if (i === 3 && c) setTimeout(() => say('Burnt toast still hurts. But it fixes your bunkers.'), 3000);
      if (i === 4 && c) setTimeout(() => say('Grapefruits split. And the juice is sticky. Mind your step.'), 3000);
      if (i === 5 && c) setTimeout(() => say('Count the candles. At eight, they all fire. Happy birthday.'), 3000);
      if (i === 6 && c) setTimeout(() => say('Armour takes two hits. And when you see red, hide.'), 3000);
      if (i === 0 && c) setTimeout(() => say('Classic formation. They march. You shoot. Like 1978.'), 2500);
      return r;
    };
  }

  if (typeof completeSpaceInvaders === 'function') {
    const orig = completeSpaceInvaders;
    window.completeSpaceInvaders = completeSpaceInvaders = function () {
      if (Array.isArray(aliens) && prevAlive) trackKills();
      return orig.apply(this, arguments);
    };
  }

  // A new run (fresh match or "Try Again") resets the score
  ['beginSpaceInvadersMatch', 'resetSpaceInvaders'].forEach(name => {
    if (typeof window[name] !== 'function') return;
    const orig = window[name];
    window[name] = function () { score.now = 0; popups = []; return orig.apply(this, arguments); };
  });

  window.ntbLevels = { score, march, get bunkers() { return bunkers; }, spawnUfo: () => spawnUfo(cfg() && cfg().mystery || 'hanger') };
})();
