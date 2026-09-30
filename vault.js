// ===== THE VAULT: a reward for a flawless RANDOMODIUM =====
// Reach the final level (RANDOMODIUM) and a glass "✦ FLAWLESS" badge appears
// on the screen. Take a single hit and it shatters. Clear the level with it
// intact and, after the win messages, a steel vault rolls in: spin the dial
// RIGHT, LEFT, RIGHT to crack it and a holographic golden ticket slides out
// with a unique serial number (and your discount code, if you set one).
// One ticket per phone; it can be re-opened later from the same phone.

// ---- Set the prize here ----
const VAULT_REWARD = {
  // A real discount code you created in your store, e.g. 'FLAWLESS15'.
  // Leave empty and the ticket says "screenshot this and show us" instead.
  code: '',
  // What the code gets them, shown on the ticket, e.g. '15% off anything'
  label: '',
  // Where to use it
  shopUrl: 'https://www.notthebestplacetobuystuff.in/'
};

(function () {
  'use strict';

  const KEY = 'ntb-vault';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
  const say = t => { if (window.ntbNarrator) window.ntbNarrator.say(t, 2); };
  const FINAL = 7; // RANDOMODIUM

  let onFinal = false, flawless = false, earned = false;

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .vx-badge { position: absolute; right: 12px; bottom: 58px; z-index: 22; pointer-events: none;
    font-family: 'Courier New', monospace; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.18em; color: #fff;
    padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.7);
    background: linear-gradient(135deg, rgba(255,255,255,0.35), rgba(160,220,255,0.15));
    box-shadow: 0 0 18px rgba(170,220,255,0.45), inset 0 0 10px rgba(255,255,255,0.3);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    animation: vx-shine 2.4s ease-in-out infinite; }
  @keyframes vx-shine { 50% { box-shadow: 0 0 30px rgba(170,220,255,0.8), inset 0 0 16px rgba(255,255,255,0.5); } }
  .vx-shard { position: absolute; z-index: 23; pointer-events: none; width: 10px; height: 10px;
    background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(160,220,255,0.4));
    clip-path: polygon(50% 0, 100% 70%, 20% 100%); animation: vx-shard 0.9s ease-in forwards; }
  @keyframes vx-shard { to { transform: translate(var(--dx), 120px) rotate(var(--rot)); opacity: 0; } }

  .vx-overlay { position: fixed; inset: 0; z-index: 360; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 16px; background: radial-gradient(circle at 50% 40%, #1d2127, #050607 75%); overflow-y: auto; animation: vx-in 0.4s ease;
    font-family: 'Courier New', monospace; color: #e6e9ee; text-align: center; }
  @keyframes vx-in { from { opacity: 0; } }
  .vx-kicker { font-size: 0.72rem; letter-spacing: 0.35em; color: #ffd27a; margin: 0 0 4px; }
  .vx-title { font-family: Impact, 'Arial Black', sans-serif; font-size: 2.2rem; letter-spacing: 0.05em; margin: 0 0 14px; }
  .vx-stage { position: relative; width: min(300px, 80vw); aspect-ratio: 1; perspective: 900px; margin: 0 auto; }
  .vx-light { position: absolute; inset: 8%; border-radius: 18px; background: radial-gradient(circle, #fff6d6, #ffcf5a 40%, #7a4d00 80%);
    box-shadow: inset 0 0 60px rgba(0,0,0,0.6); }
  .vx-door { position: absolute; inset: 0; border-radius: 22px; transform-origin: left center; transform-style: preserve-3d;
    background: radial-gradient(circle at 30% 25%, #6b737e, #2f353d 60%, #1c2026);
    box-shadow: 0 30px 60px rgba(0,0,0,0.7), inset 0 0 0 6px #444b54, inset 0 0 0 10px #22272d;
    transition: transform 1.3s cubic-bezier(0.5, 0, 0.2, 1); }
  .vx-door.open { transform: rotateY(-112deg); }
  .vx-bolt { position: absolute; width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #9aa3ad, #3a4048); box-shadow: 0 2px 3px rgba(0,0,0,0.6); }
  .vx-dial { position: absolute; left: 50%; top: 50%; width: 62%; aspect-ratio: 1; transform: translate(-50%, -50%);
    border-radius: 50%; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
  .vx-dial:active { cursor: grabbing; }
  .vx-dial svg { width: 100%; height: 100%; display: block; }
  .vx-marker { position: absolute; left: 50%; top: 11%; width: 0; height: 0; transform: translateX(-50%);
    border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 12px solid #ffd27a; z-index: 2; pointer-events: none; }
  .vx-leds { display: flex; gap: 16px; justify-content: center; margin: 16px 0 6px; }
  .vx-led { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 0.65rem; letter-spacing: 0.12em; opacity: 0.6; }
  .vx-led i { width: 14px; height: 14px; border-radius: 50%; background: #3a1010; box-shadow: inset 0 1px 2px rgba(0,0,0,0.8); transition: all 0.2s ease; }
  .vx-led.on { opacity: 1; }
  .vx-led.on i { background: #5dff9a; box-shadow: 0 0 12px #5dff9a; }
  .vx-led.now { opacity: 1; }
  .vx-led.now i { background: #ffd27a; box-shadow: 0 0 10px #ffd27a; animation: vx-blink 0.8s steps(2) infinite; }
  @keyframes vx-blink { 50% { opacity: 0.3; } }
  .vx-hint { min-height: 1.3em; font-size: 0.9rem; margin: 4px 0 10px; }
  .vx-skip { font: inherit; font-size: 0.8rem; background: none; border: none; color: #8a939c; text-decoration: underline; cursor: pointer; margin-top: 6px; }

  .vx-ticket { position: relative; width: min(340px, 90vw); margin: 0 auto; padding: 22px 20px 18px; border-radius: 14px; color: #2a1a00;
    background: linear-gradient(115deg, #fff3c4 0%, #ffd46b 25%, #fff 40%, #ffc23a 55%, #ffe9a8 70%, #e8a91c 100%);
    background-size: 300% 300%; background-position: var(--hx, 50%) var(--hy, 50%);
    box-shadow: 0 25px 60px rgba(255, 190, 60, 0.35), 0 0 0 2px rgba(255,255,255,0.5) inset;
    transform: perspective(700px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
    animation: vx-ticket-in 1s cubic-bezier(0.2, 1.3, 0.4, 1); }
  @keyframes vx-ticket-in { from { transform: translateY(160px) scale(0.4) rotate(-12deg); opacity: 0; } }
  .vx-ticket::before, .vx-ticket::after { content: ''; position: absolute; top: 58%; width: 22px; height: 22px; border-radius: 50%; background: #0d0f12; }
  .vx-ticket::before { left: -11px; } .vx-ticket::after { right: -11px; }
  .vx-ticket > *:not(.vx-holo) { position: relative; z-index: 1; }
  .vx-ticket .vx-holo { position: absolute; inset: 0; z-index: 0; border-radius: 14px; pointer-events: none; mix-blend-mode: soft-light; opacity: 0.7;
    background: repeating-linear-gradient(calc(var(--ry, 0deg) * 4 + 60deg), #ff7ad9 0 8%, #7af0ff 8% 16%, #b4ff7a 16% 24%, #fff27a 24% 32%); }
  .vx-t-kicker { font-size: 0.68rem; letter-spacing: 0.35em; margin: 0; }
  .vx-t-title { font-family: Impact, 'Arial Black', sans-serif; font-size: 2.8rem; letter-spacing: 0.06em; margin: 2px 0; line-height: 1; }
  .vx-t-sub { font-size: 0.8rem; margin: 0 0 14px; }
  .vx-t-cut { border-top: 2px dashed rgba(42,26,0,0.45); margin: 14px -20px 12px; }
  .vx-code { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: rgba(255,255,255,0.65); border-radius: 8px; padding: 8px 10px; }
  .vx-code b { font-size: 1.25rem; letter-spacing: 0.12em; }
  .vx-code button { font: inherit; font-size: 0.75rem; font-weight: bold; border: 1px solid #2a1a00; background: #2a1a00; color: #ffd46b; border-radius: 6px; padding: 5px 9px; cursor: pointer; }
  .vx-meta { display: flex; justify-content: space-between; font-size: 0.7rem; margin-top: 10px; opacity: 0.8; }
  .vx-after { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; width: min(340px, 90vw); }
  .vx-after a, .vx-after button { font: inherit; font-weight: bold; padding: 12px; border-radius: 999px; text-decoration: none; cursor: pointer; }
  .vx-after a { background: #ffd27a; color: #1a1205; border: none; }
  .vx-after button { background: none; color: #ccc; border: 1px solid #555; }
  `;
  document.head.appendChild(style);

  // ---------- the FLAWLESS badge ----------
  let badge = null;
  function showBadge() {
    const wrap = document.querySelector('.canvas-wrapper');
    if (!wrap || badge) return;
    badge = document.createElement('div');
    badge.className = 'vx-badge';
    badge.textContent = '✦ FLAWLESS';
    wrap.appendChild(badge);
  }
  function shatterBadge() {
    if (!badge) return;
    const wrap = badge.parentNode;
    const r = badge.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('div');
      s.className = 'vx-shard';
      s.style.left = (r.left - w.left + Math.random() * r.width) + 'px';
      s.style.top = (r.top - w.top + Math.random() * r.height) + 'px';
      s.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
      s.style.setProperty('--rot', (Math.random() * 540 - 270) + 'deg');
      wrap.appendChild(s);
      setTimeout(() => s.remove(), 950);
    }
    badge.remove();
    badge = null;
  }
  function hideBadge() { if (badge) { badge.remove(); badge = null; } }

  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (i) {
      const wasFinal = onFinal;
      const r = orig.apply(this, arguments);
      if (wasFinal && i === FINAL + 1 && flawless) earned = true; // cleared RANDOMODIUM into the closet
      onFinal = i === FINAL;
      if (onFinal) {
        flawless = true;
        showBadge();
        setTimeout(() => say('Rumour says there is a vault. For anyone who clears this without getting hit.'), 4000);
      } else {
        hideBadge();
      }
      return r;
    };
  }
  if (typeof loseLives === 'function') {
    const orig = loseLives;
    window.loseLives = loseLives = function () {
      const before = lives;
      const r = orig.apply(this, arguments);
      if (onFinal && lives < before && flawless) {
        flawless = false;
        shatterBadge();
        say('And there goes the vault.');
      }
      return r;
    };
  }
  if (typeof completeSpaceInvaders === 'function') {
    const orig = completeSpaceInvaders;
    window.completeSpaceInvaders = completeSpaceInvaders = function () {
      if (onFinal && flawless) earned = true;
      onFinal = false;
      hideBadge();
      const r = orig.apply(this, arguments);
      if (earned) { earned = false; setTimeout(openVault, 9300); } // after the win messages
      return r;
    };
  }
  // Earned it on RANDOMODIUM but then died in the secret closet? Still yours.
  if (typeof gameOver === 'function') {
    const orig = gameOver;
    window.gameOver = gameOver = function () {
      const r = orig.apply(this, arguments);
      if (earned) { earned = false; setTimeout(openVault, 1500); }
      return r;
    };
  }
  if (typeof resetSpaceInvaders === 'function') {
    const orig = resetSpaceInvaders;
    window.resetSpaceInvaders = resetSpaceInvaders = function () { onFinal = false; flawless = false; hideBadge(); return orig.apply(this, arguments); };
  }

  // ---------- sound ----------
  let ac = null;
  function tick(freq = 1800, vol = 0.04, dur = 0.025) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = freq; g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    } catch (e) {}
  }
  const buzz = p => { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

  // ---------- the vault ----------
  function serial() {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    const s = Array.from(b, x => A[x % A.length]).join('');
    return `NTB-FLW-${s.slice(0, 4)}-${s.slice(4)}`;
  }

  function openVault() {
    const existing = load();
    const ov = document.createElement('div');
    ov.className = 'overlay vx-overlay';
    document.body.appendChild(ov);
    if (existing) { showTicket(ov, existing, true); return; }

    ov.innerHTML = `
      <p class="vx-kicker">FLAWLESS RANDOMODIUM</p>
      <h2 class="vx-title">THE VAULT</h2>
      <div class="vx-stage">
        <div class="vx-light"></div>
        <div class="vx-door">
          <span class="vx-bolt" style="left:7%;top:7%"></span><span class="vx-bolt" style="right:7%;top:7%"></span>
          <span class="vx-bolt" style="left:7%;bottom:7%"></span><span class="vx-bolt" style="right:7%;bottom:7%"></span>
          <div class="vx-marker"></div>
          <div class="vx-dial" role="slider" tabindex="0" aria-label="Vault dial: spin right, left, right">${dialSvg()}</div>
        </div>
      </div>
      <div class="vx-leds">
        <span class="vx-led now"><i></i>RIGHT</span><span class="vx-led"><i></i>LEFT</span><span class="vx-led"><i></i>RIGHT</span>
      </div>
      <p class="vx-hint">Spin the dial a full turn to the right.</p>
      <button class="vx-skip" hidden>Can't spin it? Tap to crack.</button>`;

    const dial = ov.querySelector('.vx-dial');
    const door = ov.querySelector('.vx-door');
    const leds = ov.querySelectorAll('.vx-led');
    const hint = ov.querySelector('.vx-hint');
    const skip = ov.querySelector('.vx-skip');
    setTimeout(() => { skip.hidden = false; }, 12000);

    // right = clockwise. Each step needs this much rotation in its direction.
    const STEPS = [{ dir: 1, need: 360 }, { dir: -1, need: 360 }, { dir: 1, need: 180 }];
    let step = 0, progress = 0, angle = 0, lastA = null, sinceTick = 0, done = false;

    const center = () => { const r = dial.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const pointerAngle = e => { const [cx, cy] = center(); return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI; };

    function turn(delta) {
      if (done) return;
      angle += delta;
      dial.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      sinceTick += Math.abs(delta);
      if (sinceTick > 9) { sinceTick = 0; tick(1500 + Math.random() * 500); }
      const want = STEPS[step];
      if (Math.sign(delta) === want.dir) {
        progress += Math.abs(delta);
      } else if (progress > 40) {
        // wrong way after committing to a turn: the tumblers slip
        progress = Math.max(0, progress - Math.abs(delta) * 2);
        hint.textContent = 'Wrong way. The tumblers slipped.';
      }
      if (progress >= want.need) {
        progress = 0;
        leds[step].classList.remove('now');
        leds[step].classList.add('on');
        tick(420, 0.12, 0.12);
        buzz(60);
        step++;
        if (step >= STEPS.length) return crack();
        leds[step].classList.add('now');
        hint.textContent = STEPS[step].dir === 1 ? 'Clunk. Now back to the right.' : 'Clunk. Now a full turn to the left.';
      }
    }

    dial.addEventListener('pointerdown', e => { dial.setPointerCapture(e.pointerId); lastA = pointerAngle(e); e.preventDefault(); });
    dial.addEventListener('pointermove', e => {
      if (lastA === null) return;
      const a = pointerAngle(e);
      let d = a - lastA;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastA = a;
      turn(d);
    });
    const release = () => { lastA = null; };
    dial.addEventListener('pointerup', release);
    dial.addEventListener('pointercancel', release);
    dial.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); turn(15); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); turn(-15); }
    });
    skip.addEventListener('click', () => { while (!done && step < STEPS.length) turn(STEPS[step].dir * 20); });

    function crack() {
      done = true;
      hint.textContent = 'Click.';
      tick(200, 0.2, 0.3);
      buzz([80, 60, 200]);
      setTimeout(() => door.classList.add('open'), 350);
      const prize = { serial: serial(), at: Date.now() };
      save(prize);
      setTimeout(() => showTicket(ov, prize, false), 1700);
    }
  }

  function dialSvg() {
    let ticks = '';
    for (let i = 0; i < 60; i++) {
      const a = i * 6, long = i % 5 === 0;
      ticks += `<line x1="50" y1="${long ? 6 : 8}" x2="50" y2="${long ? 14 : 11}" stroke="#c9cfd6" stroke-width="${long ? 1.2 : 0.6}" transform="rotate(${a} 50 50)"/>`;
      if (long) ticks += `<text x="50" y="21" font-size="5" fill="#c9cfd6" text-anchor="middle" font-family="monospace" transform="rotate(${a} 50 50)">${i}</text>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><radialGradient id="vxg" cx="35%" cy="30%"><stop offset="0" stop-color="#d9dee4"/><stop offset="0.55" stop-color="#7d8792"/><stop offset="1" stop-color="#3a4149"/></radialGradient></defs>
      <circle cx="50" cy="50" r="48" fill="#1f242a" stroke="#0e1114" stroke-width="2"/>
      ${ticks}
      <circle cx="50" cy="50" r="26" fill="url(#vxg)" stroke="#2a3037" stroke-width="1.5"/>
      <rect x="47" y="30" width="6" height="40" rx="3" fill="#4a525b"/>
      <circle cx="50" cy="50" r="5" fill="#2a3037"/>
    </svg>`;
  }

  function showTicket(ov, prize, again) {
    const date = new Date(prize.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const code = VAULT_REWARD.code;
    ov.innerHTML = `
      <p class="vx-kicker">${again ? 'ALREADY CLAIMED ON THIS PHONE' : 'THE VAULT IS OPEN'}</p>
      <div class="vx-ticket">
        <div class="vx-holo"></div>
        <p class="vx-t-kicker">NOTTHEBEST · GOLDEN TICKET</p>
        <p class="vx-t-title">FLAWLESS</p>
        <p class="vx-t-sub">Survived RANDOMODIUM without a single scratch.</p>
        <div class="vx-t-cut"></div>
        ${code ? `
          <div class="vx-code"><b>${code}</b><button type="button" data-act="copy">Copy</button></div>
          <p class="vx-t-sub" style="margin:8px 0 0">${VAULT_REWARD.label || 'Use it at checkout.'}</p>` : `
          <p class="vx-t-sub" style="margin:0"><b>Screenshot this ticket.</b> Show it to us. Almost nobody has one.</p>`}
        <div class="vx-meta"><span>${prize.serial}</span><span>${date}</span></div>
      </div>
      <div class="vx-after">
        ${code ? `<a href="${VAULT_REWARD.shopUrl}" target="_blank" rel="noopener">Spend it</a>` : ''}
        <button type="button" data-act="close">Close the vault</button>
      </div>`;
    const t = ov.querySelector('.vx-ticket');
    const tilt = (px, py) => {
      t.style.setProperty('--ry', (px * 18).toFixed(1) + 'deg');
      t.style.setProperty('--rx', (-py * 14).toFixed(1) + 'deg');
      t.style.setProperty('--hx', (50 + px * 100) + '%');
      t.style.setProperty('--hy', (50 + py * 100) + '%');
    };
    ov.addEventListener('pointermove', e => tilt(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));
    const orient = e => { if (e.gamma !== null) tilt(Math.max(-0.5, Math.min(0.5, e.gamma / 40)), Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 40))); };
    window.addEventListener('deviceorientation', orient);
    const copy = ov.querySelector('[data-act="copy"]');
    if (copy) copy.addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => { copy.textContent = 'Copied'; }).catch(() => { copy.textContent = code; });
    });
    ov.querySelector('[data-act="close"]').addEventListener('click', () => { window.removeEventListener('deviceorientation', orient); ov.remove(); });
    if (!again) say('Flawless. I have never been more annoyed.');
  }

  window.ntbVault = { open: openVault };
})();
