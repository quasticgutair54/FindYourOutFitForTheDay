// ===== "RELAX. IT WAS US." - the fake crash =====
// Right as the player reaches the final level (RANDOMODIUM), the site pretends
// their phone is dying. One of three pranks, rotating so repeat players get a
// new one:
//   battery - a lock screen: 1% battery, "Shutting down..."
//   crack   - the screen cracks from where their ship is, dead-pixel lines bleed
//   offline - a "you're offline" page whose Retry button runs away from your thumb
// Then a fake reboot scrolls past and it admits: "Relax. It was us."
// The game is paused the whole time, so it never costs a life.
//
// Nothing here asks for or collects anything - it's a harmless visual gag, and
// it never imitates a specific phone brand.

(function () {
  'use strict';

  const FINAL = 7;
  const SEEN_KEY = 'ntb-crash-seen';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const say = t => { if (window.ntbNarrator) window.ntbNarrator.say(t, 2); };
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ranThisVisit = false;

  const VARIANTS = ['battery', 'crack', 'offline'];
  function chooseVariant() {
    const seen = lsGet(SEEN_KEY, []);
    const fresh = VARIANTS.filter(v => !seen.includes(v));
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
    // seen them all: only sometimes, so it stays a surprise
    return Math.random() < 0.3 ? VARIANTS[Math.floor(Math.random() * VARIANTS.length)] : null;
  }

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .fc-layer { position: fixed; inset: 0; z-index: 9000; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .fc-black { background: #000; }

  /* battery */
  .fc-lock { display: flex; flex-direction: column; align-items: center; padding-top: 12vh; color: #fff;
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: radial-gradient(circle at 30% 20%, #3b3f6b, #141527 60%, #07070d); animation: fc-fade 0.25s ease; }
  .fc-lock .t { font-size: clamp(4rem, 22vw, 6.5rem); font-weight: 200; letter-spacing: -0.02em; line-height: 1; }
  .fc-lock .d { font-size: 1rem; opacity: 0.85; margin-top: 6px; }
  .fc-card { margin-top: 9vh; width: min(320px, 84vw); padding: 16px; border-radius: 20px; text-align: center;
    background: rgba(40, 40, 48, 0.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: fc-rise 0.4s cubic-bezier(0.2, 1.2, 0.4, 1); }
  @keyframes fc-rise { from { transform: translateY(30px); opacity: 0; } }
  .fc-batt { display: inline-flex; align-items: center; gap: 2px; margin-bottom: 8px; }
  .fc-batt b { position: relative; width: 44px; height: 20px; border: 2px solid #fff; border-radius: 5px; }
  .fc-batt b::after { content: ''; position: absolute; left: 2px; top: 2px; bottom: 2px; width: 3px; background: #ff3b30; border-radius: 1px; animation: fc-blink 0.6s steps(2) infinite; }
  .fc-batt i { width: 3px; height: 8px; background: #fff; border-radius: 0 2px 2px 0; }
  .fc-card h3 { margin: 0 0 4px; font-size: 1.05rem; font-weight: 600; }
  .fc-card p { margin: 0; font-size: 0.85rem; opacity: 0.8; }
  .fc-spin { width: 34px; height: 34px; margin: 14px auto 0; border-radius: 50%; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; animation: fc-rot 0.9s linear infinite; }
  @keyframes fc-rot { to { transform: rotate(360deg); } }
  @keyframes fc-blink { 50% { opacity: 0.2; } }
  @keyframes fc-fade { from { opacity: 0; } }
  .fc-off { animation: fc-off 0.45s ease-in forwards; }
  @keyframes fc-off { 60% { transform: scaleY(0.01); filter: brightness(3); } 100% { transform: scale(0, 0.01); } }

  /* crack */
  .fc-crack svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .fc-crack path { fill: none; stroke: rgba(255,255,255,0.92); stroke-linecap: round; filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 2px rgba(0,0,0,0.8));
    stroke-dasharray: var(--len); stroke-dashoffset: var(--len); animation: fc-draw 0.35s ease-out forwards; }
  @keyframes fc-draw { to { stroke-dashoffset: 0; } }
  .fc-bleed { position: absolute; top: 0; bottom: 0; width: 3px; opacity: 0; animation: fc-bleed 0.3s steps(3) forwards; }
  @keyframes fc-bleed { to { opacity: 0.9; } }
  .fc-tilt { animation: fc-tilt 0.5s ease; }
  @keyframes fc-tilt { 20% { transform: translate(-6px, 4px) rotate(-0.6deg); } 50% { transform: translate(5px, -3px) rotate(0.5deg); } }

  /* offline */
  .fc-offline { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 0 12vw;
    background: #f1f3f4; color: #3c4043; font-family: Roboto, 'Segoe UI', Arial, sans-serif; animation: fc-fade 0.15s ease; }
  .fc-offline .ico { width: 64px; height: 64px; margin-bottom: 26px; }
  .fc-offline h1 { font-size: 1.5rem; font-weight: 500; margin: 0 0 12px; }
  .fc-offline p { font-size: 0.95rem; margin: 0 0 6px; color: #5f6368; }
  .fc-offline code { font-size: 0.75rem; color: #80868b; margin-top: 10px; }
  .fc-retry { position: absolute; padding: 10px 22px; border-radius: 6px; border: none; background: #1a73e8; color: #fff;
    font: 500 0.95rem Roboto, Arial, sans-serif; cursor: pointer; transition: left 0.18s ease-out, top 0.18s ease-out; }

  /* reboot + reveal */
  .fc-boot { background: #000; color: #5dff9a; font: 0.8rem/1.5 'Courier New', monospace; padding: 18px; white-space: pre-wrap; }
  .fc-reveal { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;
    background: radial-gradient(circle at 50% 45%, #10231a, #000 70%); color: #fff; animation: fc-fade 0.3s ease; }
  .fc-reveal .e { font-size: 4rem; animation: fc-bob 1.6s ease-in-out infinite; }
  @keyframes fc-bob { 50% { transform: translateY(-8px) rotate(-6deg); } }
  .fc-reveal h2 { font-family: Impact, 'Arial Black', sans-serif; font-size: clamp(2.2rem, 11vw, 3.4rem); letter-spacing: 0.03em; margin: 10px 0 6px; }
  .fc-reveal p { font-family: 'Courier New', monospace; font-size: 0.9rem; opacity: 0.8; margin: 0 0 22px; max-width: 320px; }
  .fc-btns { display: flex; gap: 10px; }
  .fc-btns button { font: bold 0.95rem 'Courier New', monospace; padding: 12px 18px; border-radius: 999px; cursor: pointer; border: 1px solid #5dff9a; background: transparent; color: #5dff9a; }
  .fc-btns button:first-child { background: #5dff9a; color: #04130a; }
  `;
  document.head.appendChild(style);

  // ---------- helpers ----------
  const layer = cls => { const el = document.createElement('div'); el.className = 'fc-layer ' + cls; document.body.appendChild(el); return el; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let savedVol = null;
  function muteMusic(on) {
    if (typeof bgMusic === 'undefined' || !bgMusic) return;
    try {
      if (on) { savedVol = bgMusic.volume; bgMusic.volume = 0; }
      else if (savedVol !== null) { bgMusic.volume = savedVol; savedVol = null; }
    } catch (e) {}
  }
  function sfx(el, opts) { if (typeof playSound === 'function' && el) playSound(el, opts); }
  const buzz = p => { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

  // ---------- 1. battery ----------
  async function battery() {
    const now = new Date();
    const el = layer('fc-lock');
    el.innerHTML = `
      <div class="t">${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')}</div>
      <div class="d">${now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <div class="fc-card">
        <div class="fc-batt"><b></b><i></i></div>
        <h3>Battery critically low</h3>
        <p class="msg">1% remaining. Connect to power.</p>
      </div>`;
    buzz([120, 80, 120]);
    await wait(2200);
    el.querySelector('.msg').textContent = 'Shutting down…';
    el.querySelector('.fc-card').insertAdjacentHTML('beforeend', '<div class="fc-spin"></div>');
    await wait(1800);
    el.classList.add('fc-off');
    el.style.background = '#000';
    const black = layer('fc-black');
    await wait(450);
    el.remove();
    await wait(1400);
    return black;
  }

  // ---------- 2. crack ----------
  async function crack() {
    const W = innerWidth, H = innerHeight;
    // start from the player's ship if we can find it on screen
    let ox = W / 2, oy = H * 0.7;
    try {
      const r = canvas.getBoundingClientRect();
      ox = r.left + (player.x + player.width / 2) * (r.width / canvas.width);
      oy = r.top + (player.y + player.height / 2) * (r.height / canvas.height);
    } catch (e) {}
    const el = layer('fc-crack');
    let paths = '';
    const rays = 11;
    for (let i = 0; i < rays; i++) {
      let a = (i / rays) * Math.PI * 2 + Math.random() * 0.4;
      let x = ox, y = oy, d = `M${ox.toFixed(1)} ${oy.toFixed(1)}`, len = 0;
      const segs = 6 + Math.floor(Math.random() * 6);
      for (let s = 0; s < segs; s++) {
        const step = 25 + Math.random() * 70;
        a += (Math.random() - 0.5) * 0.7;
        x += Math.cos(a) * step; y += Math.sin(a) * step;
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`; len += step;
        if (Math.random() < 0.25) { // branch
          const ba = a + (Math.random() < 0.5 ? 0.9 : -0.9), bl = 20 + Math.random() * 50;
          paths += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} L${(x + Math.cos(ba) * bl).toFixed(1)} ${(y + Math.sin(ba) * bl).toFixed(1)}" style="--len:${bl + 5};stroke-width:0.8;animation-delay:${(0.1 + s * 0.04).toFixed(2)}s"/>`;
        }
      }
      paths += `<path d="${d}" style="--len:${(len + 10).toFixed(0)};stroke-width:${(1 + Math.random() * 1.2).toFixed(1)}"/>`;
    }
    // ring around the impact
    let ring = '';
    for (let i = 0; i < 9; i++) {
      const a1 = (i / 9) * Math.PI * 2, a2 = ((i + 1) / 9) * Math.PI * 2, rr = 16 + Math.random() * 10;
      ring += ` L${(ox + Math.cos(a2) * rr).toFixed(1)} ${(oy + Math.sin(a2) * rr).toFixed(1)}`;
      if (i === 0) ring = `M${(ox + Math.cos(a1) * rr).toFixed(1)} ${(oy + Math.sin(a1) * rr).toFixed(1)}` + ring;
    }
    paths += `<path d="${ring} Z" style="--len:200;stroke-width:1.4"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${paths}</svg>`;
    sfx(typeof explosionSound !== 'undefined' ? explosionSound : null, { volume: 1, rate: 1.8 });
    buzz(250);
    if (!reduceMotion) { document.body.classList.add('fc-tilt'); setTimeout(() => document.body.classList.remove('fc-tilt'), 500); }
    await wait(900);
    // LCD bleed: coloured vertical lines
    ['#ff00ff', '#00ffcc', '#ffffff', '#00ff00'].forEach((c, i) => {
      const b = document.createElement('div');
      b.className = 'fc-bleed';
      b.style.left = (ox + (i - 1.5) * (30 + Math.random() * 40)) + 'px';
      b.style.background = c;
      b.style.animationDelay = (i * 0.15) + 's';
      el.appendChild(b);
    });
    await wait(1700);
    el.style.transition = 'background 0.2s';
    el.style.background = '#000';
    await wait(300);
    el.innerHTML = '';
    await wait(1100);
    return el;
  }

  // ---------- 3. offline ----------
  async function offline() {
    const el = layer('fc-offline');
    el.innerHTML = `
      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#9aa0a6" d="M12 4C7.3 4 3.1 5.8 0 8.7L12 21 24 8.7C20.9 5.8 16.7 4 12 4z" opacity=".35"/><path d="M3 3l18 18" stroke="#5f6368" stroke-width="2"/></svg>
      <h1>You're offline</h1>
      <p>Check your internet connection.</p>
      <p>Your progress may not be saved.</p>
      <code>ERR_INTERNET_DISCONNECTED</code>
      <button class="fc-retry" type="button">Retry</button>`;
    const btn = el.querySelector('.fc-retry');
    const place = (x, y) => { btn.style.left = x + 'px'; btn.style.top = y + 'px'; };
    place(innerWidth * 0.12, innerHeight * 0.66);
    let dodges = 0;
    return new Promise(resolve => {
      let finished = false;
      const finish = () => { if (finished) return; finished = true; el.innerHTML = ''; el.style.background = '#000'; setTimeout(() => resolve(el), 700); };
      const dodge = e => {
        if (e) e.preventDefault();
        dodges++;
        if (dodges >= 4) { btn.textContent = 'fine'; setTimeout(finish, 350); return; }
        const bw = btn.offsetWidth, bh = btn.offsetHeight;
        const top = el.querySelector('code').getBoundingClientRect().bottom + 16; // stay below the text
        place(12 + Math.random() * (innerWidth - bw - 24), top + Math.random() * Math.max(10, innerHeight - top - bh - 20));
        btn.textContent = ['Retry', 'nope', 'too slow', 'almost'][dodges] || 'Retry';
      };
      btn.addEventListener('pointerdown', dodge);
      btn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') dodge(); });
      setTimeout(finish, 7000); // don't strand anyone who just stares at it
    });
  }

  // ---------- reboot + reveal ----------
  async function reboot(el) {
    el.className = 'fc-layer fc-boot';
    const lines = [
      'NOTTHEBEST OS v0.99 (not the best os)',
      'checking battery ........ 100% (lol)',
      'checking screen ......... not cracked',
      'checking internet ....... fine, always was',
      'loading RANDOMODIUM.exe . [OK]',
      'restoring your dignity .. [FAILED]',
      ''
    ];
    el.textContent = '';
    for (const l of lines) {
      for (let i = 0; i <= l.length; i += 3) { el.textContent = el.textContent.replace(/[^\n]*$/, l.slice(0, i)); await wait(12); }
      el.textContent += '\n';
      await wait(90);
    }
    await wait(350);
    return new Promise(resolve => {
      el.className = 'fc-layer fc-reveal';
      el.innerHTML = `
        <div class="e">😌</div>
        <h2>Relax. It was us.</h2>
        <p>Your phone is fine. Your nerves, maybe not. The final level starts when you're ready.</p>
        <div class="fc-btns"><button type="button" data-a="knew">I knew it</button><button type="button" data-a="rude">That was rude</button></div>`;
      el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { el.remove(); resolve(b.dataset.a); }));
    });
  }

  // ---------- trigger ----------
  async function run(variant) {
    ranThisVisit = true;
    const wasActive = typeof gameActive !== 'undefined' && gameActive;
    if (typeof gameActive !== 'undefined') gameActive = false;
    if (typeof resetControlState === 'function') resetControlState();
    if (window.ntbNarrator) window.ntbNarrator.stopAll();
    muteMusic(true);
    const seen = lsGet(SEEN_KEY, []);
    if (!seen.includes(variant)) { seen.push(variant); lsSet(SEEN_KEY, seen); }

    let el;
    if (variant === 'battery') el = await battery();
    else if (variant === 'crack') el = await crack();
    else el = await offline();
    const answer = await reboot(el);

    muteMusic(false);
    if (wasActive) { // only resume a game that was actually running
      // fair restart: clear bullets in flight and give a moment of invincibility
      try { enemyBullets.length = 0; playerInvisible = true; invisibleTimer = Math.max(invisibleTimer || 0, 150); } catch (e) {}
      if (typeof showInGameMessage === 'function') showInGameMessage('Back online. Go.');
      gameActive = true;
      lastFrameTime = performance.now();
      requestAnimationFrame(gameLoop);
    }
    setTimeout(() => say(answer === 'knew'
      ? { battery: 'You knew? Your heart rate says otherwise.', crack: 'Sure you did. You checked your screen for cracks.', offline: 'You knew. That is why you chased the button.' }[variant]
      : { battery: 'Rude? You believed a website about your battery.', crack: 'It was rude. It was also very funny.', offline: 'The button was the rude one.' }[variant]), 900);
  }

  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (i) {
      const r = orig.apply(this, arguments);
      if (i === FINAL && !ranThisVisit) {
        const v = chooseVariant();
        if (v) {
          ranThisVisit = true;
          // run after the caller has restarted the game loop, then freeze it
          setTimeout(() => run(v), 1200);
        }
      }
      return r;
    };
  }

  window.ntbFakeCrash = { run: v => run(v || chooseVariant() || 'battery') };
})();
