// ===== THE FITTING ROOM SCANNER + SECRET LEVEL 9 =====
// The ship-select screen gets a locked "???" tile. Tapping it opens the phone
// camera: point it at the QR code on ANY real NotTheBest shirt and you unlock
//   * Level 9, THE CLOSET - a hidden bonus level after RANDOMODIUM where the
//     invaders are flying t-shirts named after the real products, and
//   * the Tailor-Made ship - a tiny t-shirt with its own golden hanger bullets.
// No camera? "Use a photo instead" reads the QR from a picture.
// Every shirt ID you scan also goes into a little "shirts spotted in the
// wild" count, because collecting things is fun.
//
// Loaded after the main game script. Only wraps existing functions.

(function () {
  'use strict';

  const UNLOCK_KEY = 'ntb-closet-unlocked';
  const SPOTTED_KEY = 'ntb-shirts-spotted';
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const isUnlocked = () => !!lsGet(UNLOCK_KEY, false);
  const say = (t) => { if (window.ntbNarrator) window.ntbNarrator.say(t, 2); };

  // Which QR codes count as "one of ours"
  function isOurShirt(text) {
    try {
      const u = new URL(text);
      return /notthebest/i.test(u.hostname) || u.hostname === location.hostname || /findyouroutfitfortheday/i.test(u.pathname) || u.searchParams.has('shirt');
    } catch (e) {
      return /notthebest/i.test(text);
    }
  }
  function shirtIdFrom(text) {
    try { return (new URL(text).searchParams.get('shirt') || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null; } catch (e) { return null; }
  }

  // ---------- the secret level ----------
  const CLOSET_LEVEL = {
    name: 'THE CLOSET',
    rows: 4,
    cols: 7,
    speed: 0.24,
    fireRate: 0.0115,
    enemyBulletSpeed: 6.2,
    alienType: 'closet',
    alienWidth: 26,
    alienHeight: 22,
    description: 'Secret level: flying shirts, hanger bullets',
    movement: 'zigzag',
    secret: true,
    bg: { top: '#140b02', bottom: '#3a2508', particleColor: '#ffd27a', particleColor2: '#fff1c9', mode: 'bokeh' }
  };
  const PRODUCTS = ['Notthebest OG', 'Initial D', 'Lorem Ipsum', 'Your Toast', 'Grapefruit x Lime', 'Cake Was A Lie', 'Berserk', 'RANDOMODIUM'];
  const SHIRT_COLORS = ['#f4f1ea', '#ff2d95', '#00e6b8', '#ffcf7a', '#8aff65', '#ffb6d9', '#ff8a3d', '#b26bff'];

  function addClosetLevel() {
    if (typeof levelConfigs === 'undefined') return;
    if (!levelConfigs.some(l => l.alienType === 'closet')) levelConfigs.push(CLOSET_LEVEL);
  }
  if (isUnlocked()) addClosetLevel();

  // Draw the shirt invaders
  if (typeof drawAlien === 'function') {
    const orig = drawAlien;
    window.drawAlien = drawAlien = function (alien) {
      if (alien.type !== 'closet') return orig.apply(this, arguments);
      if (alien.productIdx === undefined) {
        alien.productIdx = Math.floor(Math.random() * PRODUCTS.length);
      }
      const c = ctx;
      c.save();
      c.globalAlpha = (typeof chaosEffects !== 'undefined' && chaosEffects.invisible > 0) ? 0.3 : 1;
      const sway = Math.sin((typeof gameTick !== 'undefined' ? gameTick : 0) / 10 + (alien.bobSeed || 0)) * 0.12;
      const w = alien.width, h = alien.height;
      const cx = alien.x + w / 2, top = alien.y + 3;
      c.translate(cx, top);
      c.rotate(sway); // swinging on its hanger
      // hanger
      c.strokeStyle = '#d9d9d9';
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, -1, 2.2, Math.PI, Math.PI * 2.2);
      c.moveTo(0, 1); c.lineTo(-w * 0.42, h * 0.2); c.lineTo(w * 0.42, h * 0.2); c.closePath();
      c.stroke();
      // tee
      const col = SHIRT_COLORS[alien.productIdx % SHIRT_COLORS.length];
      c.fillStyle = col;
      c.shadowColor = col;
      c.shadowBlur = 8;
      const sw = w, sh = h - 3;
      c.beginPath();
      c.moveTo(-sw * 0.18, 2);
      c.quadraticCurveTo(0, 6, sw * 0.18, 2);          // collar
      c.lineTo(sw * 0.5, sh * 0.2);                     // right shoulder
      c.lineTo(sw * 0.4, sh * 0.44);                    // right sleeve
      c.lineTo(sw * 0.3, sh * 0.36);
      c.lineTo(sw * 0.3, sh);                           // right hem
      c.lineTo(-sw * 0.3, sh);
      c.lineTo(-sw * 0.3, sh * 0.36);
      c.lineTo(-sw * 0.4, sh * 0.44);
      c.lineTo(-sw * 0.5, sh * 0.2);
      c.closePath();
      c.fill();
      c.shadowBlur = 0;
      // tiny chest print
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.font = 'bold 5px monospace';
      c.textAlign = 'center';
      c.fillText('NTB', 0, sh * 0.62);
      c.restore();
    };
  }

  // Shirts say their product name when you shoot them off the rack
  const killLayer = document.createElement('div');
  killLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:21';
  const wrap = document.querySelector('.canvas-wrapper');
  if (wrap) wrap.appendChild(killLayer);
  let prevAlive = null;
  (function watchKills() {
    requestAnimationFrame(watchKills);
    if (typeof currentLevel === 'undefined' || typeof levelConfigs === 'undefined') return;
    const cfg = levelConfigs[currentLevel];
    if (!cfg || cfg.alienType !== 'closet' || !Array.isArray(aliens)) { prevAlive = null; return; }
    if (!prevAlive || prevAlive.length !== aliens.length) { prevAlive = aliens.map(a => a.alive); return; }
    aliens.forEach((a, i) => {
      if (prevAlive[i] && !a.alive) {
        const tag = document.createElement('div');
        tag.textContent = PRODUCTS[(a.productIdx || 0) % PRODUCTS.length];
        tag.style.cssText = `position:absolute;left:${a.x + a.width / 2}px;top:${a.y + 10}px;transform:translateX(-50%);
          font:bold 11px 'Courier New',monospace;color:#ffd27a;text-shadow:0 0 6px #000;white-space:nowrap;
          transition:transform 0.9s ease-out, opacity 0.9s ease-out;`;
        killLayer.appendChild(tag);
        requestAnimationFrame(() => { tag.style.transform = 'translate(-50%, -26px)'; tag.style.opacity = '0'; });
        setTimeout(() => tag.remove(), 950);
      }
    });
    prevAlive = aliens.map(a => a.alive);
  })();

  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (levelIndex) {
      const r = orig.apply(this, arguments);
      const cfg = levelConfigs[levelIndex];
      if (cfg && cfg.secret) {
        showBanner();
        say(`Wait. There is a ninth level? You scanned a shirt, didn't you.`);
      }
      return r;
    };
  }

  function showBanner() {
    const b = document.createElement('div');
    b.className = 'fr-banner';
    b.innerHTML = '<span>SECRET LEVEL</span><b>THE CLOSET</b><i>unlocked by a real shirt</i>';
    const w = document.querySelector('.canvas-wrapper');
    if (w) { w.appendChild(b); setTimeout(() => b.remove(), 3200); }
  }

  // ---------- the Tailor-Made ship ----------
  function addTailorShip() {
    if (typeof shipSkins === 'undefined') return;
    if (!shipSkins.some(s => s.id === 'tailor')) shipSkins.push({ id: 'tailor', name: 'Tailor-Made' });
    if (typeof shipBulletProfiles !== 'undefined' && !shipBulletProfiles.tailor) {
      shipBulletProfiles.tailor = { color: '#ffd27a', rate: 1.2, speed: 1.3, blocks: true };
    }
  }
  if (isUnlocked()) addTailorShip();

  if (typeof drawShipBody === 'function') {
    const orig = drawShipBody;
    window.drawShipBody = drawShipBody = function (skin, x, y, w, h, cx, cy, c) {
      if (skin !== 'tailor') return orig.apply(this, arguments);
      c = c || (typeof mainCtx !== 'undefined' ? mainCtx : ctx);
      c.save();
      const grad = c.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#fff5d6');
      grad.addColorStop(1, '#e0a93b');
      c.fillStyle = grad;
      c.shadowColor = '#ffd27a';
      c.shadowBlur = 10;
      // a t-shirt pointing up, collar is the cockpit
      c.beginPath();
      c.moveTo(cx - w * 0.16, y + h * 0.12);
      c.quadraticCurveTo(cx, y + h * 0.3, cx + w * 0.16, y + h * 0.12);
      c.lineTo(x + w, y + h * 0.3);
      c.lineTo(x + w * 0.86, y + h * 0.56);
      c.lineTo(x + w * 0.74, y + h * 0.48);
      c.lineTo(x + w * 0.74, y + h);
      c.lineTo(x + w * 0.26, y + h);
      c.lineTo(x + w * 0.26, y + h * 0.48);
      c.lineTo(x + w * 0.14, y + h * 0.56);
      c.lineTo(x, y + h * 0.3);
      c.closePath();
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#3b2412';
      c.font = `bold ${Math.max(5, Math.round(w * 0.2))}px monospace`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('NTB', cx, y + h * 0.66);
      c.restore();
    };
  }

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .ship-tile.fr-locked { position: relative; border-style: dashed !important; }
  .ship-tile.fr-locked .fr-lock-art { width: 56px; height: 44px; display: flex; align-items: center; justify-content: center;
    font-size: 1.6rem; filter: grayscale(0.2); animation: fr-bob 1.6s ease-in-out infinite; }
  @keyframes fr-bob { 50% { transform: translateY(-3px) rotate(-4deg); } }
  .fr-spotted { display: block; font-size: 0.6rem; opacity: 0.75; margin-top: 2px; }

  .fr-overlay { position: fixed; inset: 0; z-index: 340; display: flex; align-items: center; justify-content: center; padding: 14px;
    background: rgba(0,0,0,0.9); animation: fr-in 0.3s ease; }
  @keyframes fr-in { from { opacity: 0; } }
  .fr-panel { width: min(400px, 100%); text-align: center; color: #fff; font-family: 'Courier New', monospace; }
  .fr-title { font-size: 0.75rem; letter-spacing: 0.3em; color: #ffd27a; margin: 0 0 4px; }
  .fr-head { font-family: Impact, 'Arial Black', sans-serif; font-size: 1.9rem; letter-spacing: 0.04em; margin: 0 0 12px; }
  .fr-view { position: relative; width: 100%; aspect-ratio: 3 / 4; max-height: 60vh; margin: 0 auto; border-radius: 16px; overflow: hidden;
    background: repeating-linear-gradient(45deg, #111 0 12px, #161616 12px 24px); }
  .fr-view video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fr-frame { position: absolute; left: 50%; top: 50%; width: 62%; aspect-ratio: 1; transform: translate(-50%, -50%); }
  .fr-frame i { position: absolute; width: 26px; height: 26px; border: 4px solid #ffd27a; }
  .fr-frame i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
  .fr-frame i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; border-radius: 0 8px 0 0; }
  .fr-frame i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 8px; }
  .fr-frame i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }
  .fr-laser { position: absolute; left: 4%; right: 4%; height: 2px; background: #ff3b5c; box-shadow: 0 0 12px #ff3b5c;
    animation: fr-laser 1.8s ease-in-out infinite alternate; }
  @keyframes fr-laser { from { top: 6%; } to { top: 94%; } }
  .fr-view.found .fr-frame i { border-color: #5dff9a; }
  .fr-view.found .fr-laser { display: none; }
  .fr-view.nope { animation: fr-shake 0.4s ease; }
  @keyframes fr-shake { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
  .fr-msg { min-height: 2.6em; margin: 12px 0 8px; font-size: 0.9rem; line-height: 1.35; }
  .fr-btn { display: block; width: 100%; margin-top: 8px; padding: 12px; border-radius: 999px; cursor: pointer;
    font: inherit; font-weight: bold; border: 1px solid #555; background: transparent; color: #ddd; }
  .fr-btn.primary { background: #ffd27a; color: #1a1205; border-color: #ffd27a; }
  .fr-unlocked { animation: fr-pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); }
  @keyframes fr-pop { from { transform: scale(0.6); opacity: 0; } }
  .fr-reward { display: flex; gap: 10px; justify-content: center; margin: 8px 0 4px; }
  .fr-reward div { flex: 1; padding: 12px 8px; border: 1px solid #ffd27a; border-radius: 12px; background: rgba(255,210,122,0.08); font-size: 0.8rem; }
  .fr-reward b { display: block; font-size: 1.6rem; margin-bottom: 4px; }
  .fr-flash { position: fixed; inset: 0; background: #fff; z-index: 350; pointer-events: none; animation: fr-flash 0.5s ease forwards; }
  @keyframes fr-flash { to { opacity: 0; } }

  .fr-banner { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 24; text-align: center; pointer-events: none;
    font-family: 'Courier New', monospace; color: #ffd27a; text-shadow: 0 0 12px #000; animation: fr-banner 3.2s ease forwards; }
  .fr-banner span { display: block; font-size: 0.75rem; letter-spacing: 0.4em; }
  .fr-banner b { display: block; font-family: Impact, 'Arial Black', sans-serif; font-size: 2.6rem; letter-spacing: 0.06em; color: #fff; }
  .fr-banner i { display: block; font-size: 0.75rem; opacity: 0.8; }
  @keyframes fr-banner { 0% { opacity: 0; letter-spacing: 1em; } 15%, 80% { opacity: 1; letter-spacing: normal; } 100% { opacity: 0; } }
  `;
  document.head.appendChild(style);

  // ---------- the locked tile on the ship-select screen ----------
  function spottedCount() { return lsGet(SPOTTED_KEY, []).length; }

  function addLockedTile() {
    const grid = document.getElementById('ship-grid');
    if (!grid || grid.querySelector('.fr-locked') || isUnlocked()) return;
    const tile = document.createElement('div');
    tile.className = 'ship-tile fr-locked';
    tile.title = 'Scan a real NotTheBest shirt to unlock';
    tile.innerHTML = '<div class="fr-lock-art">📷</div><span>??? Scan a shirt</span>';
    tile.addEventListener('click', openScanner);
    grid.appendChild(tile);
  }

  function addTailorTile() {
    const grid = document.getElementById('ship-grid');
    if (!grid || grid.querySelector('[data-skin="tailor"]')) return;
    const locked = grid.querySelector('.fr-locked');
    if (locked) locked.remove();
    const tile = document.createElement('div');
    tile.className = 'ship-tile';
    tile.dataset.skin = 'tailor';
    const cv = document.createElement('canvas');
    cv.width = 56; cv.height = 44;
    tile.appendChild(cv);
    const label = document.createElement('span');
    label.innerHTML = `Tailor-Made<span class="fr-spotted">${spottedCount()} shirt${spottedCount() === 1 ? '' : 's'} spotted</span>`;
    tile.appendChild(label);
    tile.addEventListener('click', () => {
      selectedShipSkin = 'tailor';
      try { localStorage.setItem('selected-ship-skin', 'tailor'); } catch (e) {}
      updateShipGridSelection();
    });
    grid.appendChild(tile);
    if (typeof renderShipTilePreview === 'function') renderShipTilePreview(cv, 'tailor');
  }

  if (typeof showShipSelect === 'function') {
    const orig = showShipSelect;
    window.showShipSelect = showShipSelect = function () {
      const r = orig.apply(this, arguments);
      if (isUnlocked()) addTailorTile(); else addLockedTile();
      if (typeof updateShipGridSelection === 'function') updateShipGridSelection();
      return r;
    };
  }

  // ---------- the scanner ----------
  let jsQRReady = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (jsQRReady) return jsQRReady;
    jsQRReady = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/jsQR.min.js';
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return jsQRReady;
  }

  function openScanner() {
    const ov = document.createElement('div');
    ov.className = 'overlay fr-overlay'; // "overlay" keeps the outside-click warning quiet
    ov.innerHTML = `
      <div class="fr-panel">
        <p class="fr-title">FITTING ROOM SCANNER</p>
        <h2 class="fr-head">SHOW ME A SHIRT</h2>
        <div class="fr-view"><video playsinline muted></video><div class="fr-frame"><i></i><i></i><i></i><i></i><div class="fr-laser"></div></div></div>
        <p class="fr-msg">Point the camera at the QR code on any real NotTheBest shirt.</p>
        <button class="fr-btn" data-act="photo">Use a photo instead</button>
        <button class="fr-btn" data-act="cancel">Cancel</button>
        <input type="file" accept="image/*" capture="environment" hidden>
      </div>`;
    document.body.appendChild(ov);
    const video = ov.querySelector('video');
    const view = ov.querySelector('.fr-view');
    const msg = ov.querySelector('.fr-msg');
    const fileInput = ov.querySelector('input[type=file]');
    const work = document.createElement('canvas');
    const wctx = work.getContext('2d', { willReadFrequently: true });
    let stream = null, running = true, lastNope = 0, busy = false;

    const stop = () => {
      running = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    };
    const close = () => { stop(); ov.remove(); };
    ov.querySelector('[data-act="cancel"]').addEventListener('click', close);
    ov.querySelector('[data-act="photo"]').addEventListener('click', () => fileInput.click());

    function handle(text) {
      if (busy) return;
      if (isOurShirt(text)) {
        busy = true;
        stop();
        view.classList.add('found');
        success(ov, text);
      } else if (Date.now() - lastNope > 1800) {
        lastNope = Date.now();
        view.classList.remove('nope'); void view.offsetWidth; view.classList.add('nope');
        msg.textContent = "That's a QR code, but it's not one of ours. Nice try.";
      }
    }

    function decode(source, sw, sh) {
      const max = 640;
      const k = Math.min(1, max / Math.max(sw, sh));
      work.width = Math.max(1, Math.round(sw * k));
      work.height = Math.max(1, Math.round(sh * k));
      wctx.drawImage(source, 0, 0, work.width, work.height);
      const data = wctx.getImageData(0, 0, work.width, work.height);
      const hit = window.jsQR(data.data, work.width, work.height, { inversionAttempts: 'attemptBoth' });
      return hit && hit.data;
    }

    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        await loadJsQR();
        const img = await createImageBitmap(f);
        const text = decode(img, img.width, img.height);
        if (text) handle(text);
        else { msg.textContent = "Couldn't find a QR code in that photo. Get closer, less blur."; view.classList.remove('nope'); void view.offsetWidth; view.classList.add('nope'); }
      } catch (e) {
        msg.textContent = 'Could not read that photo.';
      }
    });

    loadJsQR().then(async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = 'No camera access here. Use a photo instead.';
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!running) { stop(); return; }
        video.srcObject = stream;
        await video.play().catch(() => {});
        const tick = () => {
          if (!running) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const text = decode(video, video.videoWidth, video.videoHeight);
            if (text) handle(text);
          }
          if (running) setTimeout(() => requestAnimationFrame(tick), 120);
        };
        tick();
      } catch (e) {
        msg.textContent = 'Camera blocked. Allow camera access, or use a photo instead.';
      }
    }).catch(() => { msg.textContent = 'Scanner failed to load. Try again.'; });
  }

  function success(ov, text) {
    const id = shirtIdFrom(text);
    const spotted = lsGet(SPOTTED_KEY, []);
    const mine = window.ntbShirt && window.ntbShirt.id;
    if (id && !spotted.includes(id)) { spotted.push(id); lsSet(SPOTTED_KEY, spotted); }
    const firstTime = !isUnlocked();
    lsSet(UNLOCK_KEY, true);
    addClosetLevel();
    addTailorShip();

    const flash = document.createElement('div');
    flash.className = 'fr-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
    if (typeof matchSound !== 'undefined' && matchSound) { try { matchSound.currentTime = 0; matchSound.play().catch(() => {}); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate([40, 60, 120]); } catch (e) {} }

    const panel = ov.querySelector('.fr-panel');
    panel.innerHTML = `
      <div class="fr-unlocked">
        <p class="fr-title">SHIRT VERIFIED ✓${id ? ' · #' + id : ''}</p>
        <h2 class="fr-head">${firstTime ? 'SECRET UNLOCKED' : 'ANOTHER ONE'}</h2>
        ${firstTime ? `
        <div class="fr-reward">
          <div><b>🚪</b>Level 9<br>THE CLOSET<br><small>after RANDOMODIUM</small></div>
          <div><b>👕</b>Tailor-Made<br>ship</div>
        </div>` : ''}
        <p class="fr-msg">${id && mine && id === mine ? "That's the shirt you scanned to get here. Bold of you."
          : id ? `Shirts spotted in the wild: <b>${spotted.length}</b>.` : 'A real one. Respect.'}</p>
        <button class="fr-btn primary" data-act="done">${firstTime ? 'Suit up' : 'Nice'}</button>
      </div>`;
    panel.querySelector('[data-act="done"]').addEventListener('click', () => {
      ov.remove();
      addTailorTile();
      if (typeof updateShipGridSelection === 'function') updateShipGridSelection();
    });
    if (firstTime) say('A real shirt. Fine. The closet is open.');
  }

  window.ntbFittingRoom = { open: openScanner, unlocked: isUnlocked };
})();
