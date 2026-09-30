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
    0: { march: { step: 10, drop: 18, slow: 520, fast: 55 }, bunkers: 'ntb', mystery: 'hanger' }
  };
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
      if (prevAlive[i] && !a.alive) addScore(a.points || 10, a.x + a.width / 2, a.y, '#fff');
    });
    prevAlive = aliens.map(a => a.alive);
  }

  // ================= MARCH =================
  const march = { dir: 1, acc: 0, total: 0, frame: -1 };
  function marchStep(settings) {
    const alive = aliens.filter(a => a.alive);
    if (!alive.length) return;
    const minX = Math.min(...alive.map(a => a.x));
    const maxX = Math.max(...alive.map(a => a.x + a.width));
    const margin = 8;
    if ((march.dir > 0 && maxX + settings.step > canvas.width - margin) || (march.dir < 0 && minX - settings.step < margin)) {
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
    const shapes = kind === 'ntb' ? ['N', 'T', 'B', '✦'] : ['■', '■', '■', '■'];
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
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.font = `900 ${Math.round(bh * 1.15)}px "Arial Black", Impact, sans-serif`;
      o.strokeStyle = '#fff';
      o.lineWidth = Math.max(3, bw * 0.09); // thicken the letters so the bunkers are chunky
      o.lineJoin = 'round';
      o.strokeText(ch, bw / 2, bh / 2 + bh * 0.05);
      o.fillText(ch, bw / 2, bh / 2 + bh * 0.05);
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
  function bunkersVs(list, radius) {
    if (!Array.isArray(list)) return;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (!s) continue;
      for (const b of bunkers) {
        const cell = bunkerHit(b, s.x, s.y, s.width, s.height);
        if (cell) { erode(b, cell, radius); list.splice(i, 1); break; }
      }
    }
  }
  function drawBunkers(color) {
    const c = ctx;
    c.save();
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 6;
    bunkers.forEach(b => b.cells.forEach(cell => { if (cell.alive) c.fillRect(b.x + cell.q * CELL, b.y + cell.r * CELL, CELL, CELL); }));
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

  // ================= hooks =================
  // Runs every frame, right after the aliens are drawn
  if (typeof updateEnemyBullets === 'function') {
    const orig = updateEnemyBullets;
    window.updateEnemyBullets = updateEnemyBullets = function () {
      const c = cfg();
      trackKills();
      if (c && c.bunkers && bunkers.length) {
        bunkersVs(bullets, 1.6);      // your shots chip the top of the bunker
        bunkersVs(enemyBullets, 2.4); // theirs blast bigger holes
        aliensEatBunkers();
        drawBunkers(c.bunkerColor || '#7cf3d6');
      }
      if (c) updateUfo(c);
      const r = orig.apply(this, arguments);
      drawScore();
      return r;
    };
  }

  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (i) {
      const r = orig.apply(this, arguments);
      const c = LEVELS[i];
      march.dir = 1; march.acc = 0; march.frame = -1;
      march.total = Array.isArray(aliens) ? aliens.length : 0;
      prevAlive = null;
      ufo = null; drops = [];
      ufoTimer = rand(7000, 12000);
      assignPoints();
      buildBunkers(c && c.bunkers);
      if (i === 0 && c) setTimeout(() => say('Classic formation. They march. You shoot. Like 1978.'), 2500);
      return r;
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
