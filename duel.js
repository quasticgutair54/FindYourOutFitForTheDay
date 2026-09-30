// ===== DUEL MODE: two phones, one fight =====
// From the ship-select screen, "⚔️ Duel a friend" opens a lobby with a
// 4-letter room code and a QR code. The friend scans it (or types the code)
// and both phones connect directly to each other (WebRTC via PeerJS - the
// free public PeerJS relay only introduces them; no server of ours needed).
//
// Both play their own Space Invaders at the same time:
//   * A rival bar shows the other player's level, lives and live kill count.
//   * Every 5 kills charges an attack that lands on the OTHER phone:
//       FLIP (controls reversed), INVERT (colours), TILT, or REINFORCEMENTS
//       (a new row of aliens drops into their level).
//   * First to lose all lives loses the duel. Clear all 8 levels and you win.
//   * Rematch, or leave and go back to solo.
//
// Loaded after the main game script. Only wraps existing functions.

(function () {
  'use strict';

  // Leave empty to use the free public PeerJS relay. (Tests and self-hosting
  // can set window.NTB_DUEL_PEER_OPTIONS = { host, port, path, secure }.)
  const PEER_OPTIONS = Object.assign({ debug: 0 }, window.NTB_DUEL_PEER_OPTIONS || {});
  const ID_PREFIX = 'ntb-duel-';
  const KILLS_PER_ATTACK = 5;
  const ATTACKS = {
    flip:   { label: 'CONTROLS FLIPPED', emoji: '🔄' },
    invert: { label: 'COLOURS INVERTED', emoji: '🌗' },
    tilt:   { label: 'SCREEN TILT', emoji: '📐' },
    drop:   { label: 'REINFORCEMENTS', emoji: '👾' }
  };
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = t => { if (window.ntbNarrator) window.ntbNarrator.say(t, 2); };
  const buzz = p => { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

  const duel = {
    peer: null, conn: null, code: null, role: null,
    connected: false, meReady: false, themReady: false, live: false, over: false,
    myKills: 0, charge: 0, sent: 0, received: 0,
    them: { level: 1, lives: 3, kills: 0, ship: 'classic' },
    rematchMe: false, rematchThem: false
  };
  window.ntbDuel = duel;

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .du-open-btn { display: block; margin: 10px auto 0; background: transparent !important; border: 1px dashed var(--accent-2, #7cf3d6) !important; color: var(--accent-2, #7cf3d6) !important; }
  .du-overlay { position: fixed; inset: 0; z-index: 330; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: rgba(3, 6, 10, 0.9); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); overflow-y: auto; animation: du-in 0.3s ease; }
  @keyframes du-in { from { opacity: 0; } }
  .du-panel { width: min(380px, 100%); margin: auto; text-align: center; color: #e8fff8; font-family: 'Courier New', monospace;
    background: linear-gradient(160deg, #10201c, #080d0c); border: 1px solid rgba(124,243,214,0.35); border-radius: 18px; padding: 20px 18px;
    box-shadow: 0 0 40px rgba(124,243,214,0.15); }
  .du-k { font-size: 0.7rem; letter-spacing: 0.3em; color: #7cf3d6; margin: 0; }
  .du-h { font-family: Impact, 'Arial Black', sans-serif; font-size: 2rem; letter-spacing: 0.04em; margin: 4px 0 12px; }
  .du-code { display: flex; gap: 8px; justify-content: center; margin: 4px 0 12px; }
  .du-code span { width: 52px; height: 64px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: bold;
    background: #0b1614; border: 2px solid #7cf3d6; border-radius: 10px; box-shadow: inset 0 0 12px rgba(124,243,214,0.25); animation: du-flip 0.5s ease backwards; }
  .du-code span:nth-child(2) { animation-delay: 0.08s; } .du-code span:nth-child(3) { animation-delay: 0.16s; } .du-code span:nth-child(4) { animation-delay: 0.24s; }
  @keyframes du-flip { from { transform: rotateX(90deg); } }
  .du-qr { width: 170px; height: 170px; margin: 0 auto 10px; padding: 8px; background: #fff; border-radius: 12px; }
  .du-qr svg { width: 100%; height: 100%; display: block; }
  .du-status { min-height: 1.4em; font-size: 0.9rem; margin: 10px 0; }
  .du-status .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ffd27a; margin-right: 6px; animation: du-blink 1s steps(2) infinite; }
  .du-status.ok .dot { background: #5dff9a; animation: none; box-shadow: 0 0 8px #5dff9a; }
  .du-status.bad .dot { background: #ff5a6e; animation: none; }
  @keyframes du-blink { 50% { opacity: 0.2; } }
  .du-status:empty { display: none; }
  .du-row { display: flex; gap: 8px; margin-top: 10px; }
  .du-input { flex: 1; min-width: 0; font: bold 1.2rem 'Courier New', monospace; letter-spacing: 0.3em; text-transform: uppercase; text-align: center;
    padding: 10px; border-radius: 10px; border: 1px solid #3b5b54; background: #0b1614; color: #fff; }
  .du-btn { font: bold 0.95rem 'Courier New', monospace; padding: 11px 14px; border-radius: 10px; cursor: pointer; border: 1px solid #7cf3d6; background: #7cf3d6; color: #04130f; }
  .du-btn.ghost { background: transparent; color: #7cf3d6; }
  .du-btn.wide { width: 100%; margin-top: 8px; }
  .du-or { font-size: 0.75rem; opacity: 0.6; margin: 14px 0 4px; }

  .du-bar { width: 100%; max-width: 600px; margin: 6px 0 0; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 10px; background: rgba(0,0,0,0.5); border: 1px solid rgba(124,243,214,0.25); font-family: 'Courier New', monospace; color: #e8fff8; font-size: 0.75rem; }
  .du-side { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .du-side.them { text-align: right; align-items: flex-end; }
  .du-name { font-weight: bold; letter-spacing: 0.12em; }
  .du-them-name { color: #ff7a8a; }
  .du-hearts { letter-spacing: 1px; }
  .du-vs { font-family: Impact, sans-serif; font-size: 1.2rem; color: #ffd27a; }
  .du-charge { display: flex; gap: 3px; }
  .du-charge i { width: 12px; height: 7px; border-radius: 2px; background: rgba(124,243,214,0.18); transition: background 0.2s ease; }
  .du-charge i.on { background: #7cf3d6; box-shadow: 0 0 6px #7cf3d6; }
  .du-bar.hit { animation: du-hit 0.6s ease; }
  @keyframes du-hit { 30% { background: rgba(255, 60, 80, 0.55); border-color: #ff5a6e; } }

  .du-alert { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); z-index: 26; pointer-events: none; text-align: center; white-space: nowrap;
    font-family: Impact, 'Arial Black', sans-serif; letter-spacing: 0.05em; animation: du-alert 1.6s ease forwards; }
  .du-alert small { display: block; font-family: 'Courier New', monospace; font-size: 0.7rem; letter-spacing: 0.3em; }
  .du-alert b { display: block; font-size: 1.7rem; font-weight: normal; }
  .du-alert.in { color: #ff5a6e; text-shadow: 0 0 14px #ff2040; }
  .du-alert.out { color: #7cf3d6; text-shadow: 0 0 14px #7cf3d6; }
  @keyframes du-alert { 0% { opacity: 0; transform: translate(-50%, -50%) scale(2); } 15%, 75% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; } }
  .du-count { position: fixed; inset: 0; z-index: 331; display: flex; align-items: center; justify-content: center; pointer-events: none;
    font-family: Impact, 'Arial Black', sans-serif; font-size: 9rem; color: #7cf3d6; text-shadow: 0 0 30px #7cf3d6; background: rgba(0,0,0,0.55); }
  .du-count span { animation: du-num 0.9s ease forwards; }
  @keyframes du-num { from { transform: scale(2.2); opacity: 0; } 30% { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.8); } }
  .du-result .du-h { font-size: 2.6rem; }
  .du-result.win .du-h { color: #ffd27a; text-shadow: 0 0 20px rgba(255,210,122,0.6); }
  .du-result.lose .du-h { color: #ff5a6e; }
  .du-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 12px 0; font-size: 0.75rem; }
  .du-stats div { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 4px; }
  .du-stats b { display: block; font-size: 1.1rem; }
  `;
  document.head.appendChild(style);

  // ---------- small UI helpers ----------
  function overlay(html, cls = '') {
    const el = document.createElement('div');
    el.className = 'overlay du-overlay';
    el.innerHTML = `<div class="du-panel ${cls}">${html}</div>`;
    document.body.appendChild(el);
    return el;
  }
  function setStatus(el, text, kind) {
    const s = el && el.querySelector('.du-status');
    if (!s) return;
    s.className = 'du-status' + (kind ? ' ' + kind : '');
    s.innerHTML = `<span class="dot"></span>${esc(text)}`;
  }
  function newCode() {
    const b = new Uint8Array(4);
    crypto.getRandomValues(b);
    return Array.from(b, x => ALPHABET[x % ALPHABET.length]).join('');
  }
  function duelLink(code) {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('duel', code);
    return u.toString();
  }
  function loadScript(src, test) {
    if (test()) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const loadPeer = () => loadScript('vendor/peerjs.min.js', () => !!window.Peer);
  const loadQR = () => loadScript('vendor/qrcode-generator.min.js', () => !!window.qrcode);

  // ---------- networking ----------
  function send(msg) {
    if (duel.conn && duel.conn.open) { try { duel.conn.send(msg); } catch (e) {} }
  }
  function wire(conn) {
    duel.conn = conn;
    conn.on('open', () => {
      duel.connected = true;
      send({ t: 'hello', ship: typeof selectedShipSkin !== 'undefined' ? selectedShipSkin : 'classic' });
      onConnected();
    });
    conn.on('data', onMessage);
    conn.on('close', onDisconnect);
    conn.on('error', onDisconnect);
  }

  let lobby = null;
  function host() {
    duel.role = 'host';
    duel.code = newCode();
    const p = new Peer(ID_PREFIX + duel.code.toLowerCase(), PEER_OPTIONS);
    duel.peer = p;
    p.on('open', () => renderHostCode());
    p.on('connection', c => {
      if (duel.conn && duel.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
      wire(c);
    });
    p.on('error', err => {
      if (err && err.type === 'unavailable-id') { p.destroy(); host(); return; } // code clash, roll again
      if (!duel.connected) setStatus(lobby, 'Could not reach the duel relay. Check your connection.', 'bad');
    });
  }

  function join(code) {
    duel.role = 'guest';
    duel.code = code.toUpperCase();
    const p = new Peer(PEER_OPTIONS);
    duel.peer = p;
    p.on('open', () => wire(p.connect(ID_PREFIX + duel.code.toLowerCase(), { reliable: true })));
    p.on('error', err => {
      const msg = err && err.type === 'peer-unavailable' ? `No duel with code ${duel.code}. Check it and try again.` : 'Could not connect. Check your connection.';
      setStatus(lobby, msg, 'bad');
      const retry = lobby && lobby.querySelector('[data-a="retry"]');
      if (retry) retry.hidden = false;
    });
  }

  // ---------- lobby ----------
  function openLobby() {
    if (lobby) lobby.remove();
    lobby = overlay(`
      <p class="du-k">DUEL MODE</p>
      <h2 class="du-h">⚔️ CHALLENGE A FRIEND</h2>
      <p style="font-size:0.85rem;margin:0 0 8px">Get them to scan this, or type the code on their phone.</p>
      <div class="du-code"><span>·</span><span>·</span><span>·</span><span>·</span></div>
      <div class="du-qr"></div>
      <button class="du-btn ghost wide" data-a="share" hidden>Share invite link</button>
      <div class="du-status"><span class="dot"></span>Opening a room…</div>
      <p class="du-or">— or join theirs —</p>
      <div class="du-row"><input class="du-input" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters"><button class="du-btn" data-a="join">Join</button></div>
      <button class="du-btn ghost wide" data-a="cancel">Cancel</button>`);
    lobby.querySelector('[data-a="cancel"]').addEventListener('click', leaveDuel);
    lobby.querySelector('[data-a="join"]').addEventListener('click', () => {
      const code = lobby.querySelector('.du-input').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 4) { lobby.querySelector('.du-input').focus(); return; }
      if (duel.peer) duel.peer.destroy();
      duel.peer = null;
      setStatus(lobby, `Joining ${code}…`);
      join(code);
    });
    lobby.querySelector('.du-input').addEventListener('keydown', e => { if (e.key === 'Enter') lobby.querySelector('[data-a="join"]').click(); });
    loadPeer().then(host).catch(() => setStatus(lobby, 'Duel mode failed to load.', 'bad'));
  }

  function renderHostCode() {
    if (!lobby) return;
    const spans = lobby.querySelectorAll('.du-code span');
    duel.code.split('').forEach((ch, i) => { spans[i].textContent = ch; spans[i].style.animation = 'none'; void spans[i].offsetWidth; spans[i].style.animation = ''; });
    setStatus(lobby, 'Waiting for your opponent…');
    const link = duelLink(duel.code);
    loadQR().then(() => {
      const qr = qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      lobby.querySelector('.du-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }).catch(() => {});
    const share = lobby.querySelector('[data-a="share"]');
    share.hidden = false;
    share.onclick = () => {
      if (navigator.share) navigator.share({ title: 'NotTheBest duel', text: `Duel me. Code ${duel.code}.`, url: link }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => { share.textContent = 'Link copied'; });
    };
  }

  // Guest arriving from a scanned invite: ?duel=CODE
  const inviteCode = (new URLSearchParams(location.search).get('duel') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (inviteCode.length === 4 && typeof startExperience === 'function') {
    const title = document.getElementById('welcome-title');
    const text = document.querySelector('.welcome-text');
    const start = document.getElementById('start-btn');
    if (title) title.textContent = 'You\'ve been challenged.';
    if (text) text.textContent = `Someone wants to duel you in Space Invaders. Room ${inviteCode}. Loser has to admit it.`;
    if (start) start.textContent = 'Accept the duel';
    const orig = startExperience;
    window.startExperience = startExperience = function () {
      const r = orig.apply(this, arguments);
      lobby = overlay(`
        <p class="du-k">DUEL MODE · ROOM ${esc(inviteCode)}</p>
        <h2 class="du-h">⚔️ JOINING</h2>
        <div class="du-status"><span class="dot"></span>Connecting to your opponent…</div>
        <button class="du-btn wide" data-a="retry" hidden>Try again</button>
        <button class="du-btn ghost wide" data-a="cancel">Play solo instead</button>`);
      lobby.querySelector('[data-a="cancel"]').addEventListener('click', leaveDuel);
      lobby.querySelector('[data-a="retry"]').addEventListener('click', e => { e.target.hidden = true; if (duel.peer) duel.peer.destroy(); setStatus(lobby, 'Connecting…'); join(inviteCode); });
      loadPeer().then(() => join(inviteCode)).catch(() => setStatus(lobby, 'Duel mode failed to load.', 'bad'));
      return r;
    };
  }

  function onConnected() {
    if (lobby) setStatus(lobby, 'Opponent connected!', 'ok');
    buzz([40, 40, 40]);
    setTimeout(() => {
      if (lobby) { lobby.remove(); lobby = null; }
      // A guest who came from an invite skips the memory game
      if (typeof gameState !== 'undefined' && !gameState.memoryGameCompleted) {
        gameState.memoryGameCompleted = true;
        if (typeof memoryGameDiv !== 'undefined') memoryGameDiv.style.display = 'none';
      }
      if (typeof showShipSelect === 'function') showShipSelect();
      markShipSelect();
    }, 700);
  }

  // ---------- ship select: duel button + ready handshake ----------
  function markShipSelect() {
    const btn = document.getElementById('ship-launch-btn');
    const openBtn = document.querySelector('.du-open-btn');
    if (duel.connected) {
      if (openBtn) openBtn.textContent = `⚔️ Dueling room ${duel.code}`;
      if (btn) btn.textContent = duel.meReady ? 'Waiting for opponent…' : 'Ready';
    }
  }

  if (typeof showShipSelect === 'function') {
    const orig = showShipSelect;
    window.showShipSelect = showShipSelect = function () {
      const r = orig.apply(this, arguments);
      const launch = document.getElementById('ship-launch-btn');
      if (launch && !document.querySelector('.du-open-btn')) {
        const b = document.createElement('button');
        b.className = 'btn du-open-btn';
        b.type = 'button';
        b.textContent = '⚔️ Duel a friend';
        b.addEventListener('click', () => { if (!duel.connected) openLobby(); });
        launch.after(b);
      }
      markShipSelect();
      return r;
    };
  }

  // Intercept Launch while in a duel: it means "I'm ready"
  // (listening on the overlay in the capture phase guarantees this runs before
  //  the game's own Launch handler on the button, in every browser)
  const shipOverlayEl = document.getElementById('ship-select-overlay');
  if (shipOverlayEl) {
    shipOverlayEl.addEventListener('click', e => {
      if (!e.target.closest('#ship-launch-btn')) return;
      if (!duel.connected || duel.live) return;
      e.stopPropagation();
      if (duel.meReady) return;
      duel.meReady = true;
      send({ t: 'ready', ship: typeof selectedShipSkin !== 'undefined' ? selectedShipSkin : 'classic' });
      markShipSelect();
      maybeGo();
    }, true);
  }

  function maybeGo() {
    if (duel.role === 'host' && duel.meReady && duel.themReady) {
      send({ t: 'go' });
      countdownThenStart();
    }
  }

  function countdownThenStart() {
    if (typeof shipSelectOverlay !== 'undefined') shipSelectOverlay.style.display = 'none';
    const c = document.createElement('div');
    c.className = 'du-count';
    document.body.appendChild(c);
    let n = 3;
    const tickNum = () => {
      c.innerHTML = `<span>${n > 0 ? n : 'GO'}</span>`;
      buzz(n > 0 ? 30 : 120);
      if (n-- > 0) setTimeout(tickNum, 800);
      else setTimeout(() => { c.remove(); startDuelMatch(); }, 600);
    };
    tickNum();
  }

  function startDuelMatch() {
    Object.assign(duel, { live: true, over: false, myKills: 0, charge: 0, sent: 0, received: 0, rematchMe: false, rematchThem: false });
    duel.them.level = 1; duel.them.lives = 3; duel.them.kills = 0;
    buildBar();
    if (typeof beginSpaceInvadersMatch === 'function' && !duel.startedOnce) {
      duel.startedOnce = true;
      beginSpaceInvadersMatch();
    } else if (typeof resetSpaceInvaders === 'function') {
      if (typeof gameState !== 'undefined') gameState.attempts = 0; // duels never trigger the mercy skip
      resetSpaceInvaders();
    }
    say(duel.role === 'host' ? 'Duel on. Make them regret scanning your code.' : 'Duel on. Make them regret inviting you.');
  }

  // ---------- in-game rival bar ----------
  let bar = null;
  function buildBar() {
    if (bar) { updateBar(); return; }
    const si = document.getElementById('space-invaders');
    const wrap = si && si.querySelector('.canvas-wrapper');
    if (!wrap) return;
    bar = document.createElement('div');
    bar.className = 'du-bar';
    bar.innerHTML = `
      <div class="du-side me"><span class="du-name">YOU</span><span class="du-charge">${'<i></i>'.repeat(KILLS_PER_ATTACK)}</span></div>
      <span class="du-vs">VS</span>
      <div class="du-side them"><span class="du-name du-them-name">RIVAL</span><span class="du-them-stat"></span><span class="du-hearts"></span></div>`;
    wrap.before(bar);
    updateBar();
  }
  function updateBar() {
    if (!bar) return;
    bar.querySelectorAll('.du-charge i').forEach((i, k) => i.classList.toggle('on', k < duel.charge));
    bar.querySelector('.du-them-stat').textContent = `LVL ${duel.them.level} · ${duel.them.kills} kills`;
    bar.querySelector('.du-hearts').textContent = '❤️'.repeat(Math.max(0, duel.them.lives)) + '🖤'.repeat(Math.max(0, 3 - duel.them.lives));
  }
  function alertOnCanvas(kind, dir) {
    const wrap = document.querySelector('.canvas-wrapper');
    if (!wrap) return;
    const a = ATTACKS[kind];
    const el = document.createElement('div');
    el.className = 'du-alert ' + dir;
    el.innerHTML = dir === 'in' ? `<small>⚠ INCOMING</small><b>${a.emoji} ${a.label}</b>` : `<small>⚡ SENT</small><b>${a.emoji} ${a.label}</b>`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 1650);
  }

  // Count my kills from the alien list
  let prevAlive = null;
  (function watch() {
    requestAnimationFrame(watch);
    if (!duel.live || duel.over || typeof aliens === 'undefined' || !Array.isArray(aliens)) { prevAlive = null; return; }
    const alive = aliens.filter(a => a.alive).length;
    if (prevAlive !== null && alive < prevAlive && alive >= 0) {
      const k = prevAlive - alive;
      duel.myKills += k;
      duel.charge += k;
      while (duel.charge >= KILLS_PER_ATTACK) { duel.charge -= KILLS_PER_ATTACK; fireAttack(); }
      updateBar();
    }
    prevAlive = alive;
  })();

  function fireAttack() {
    const kinds = Object.keys(ATTACKS);
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    duel.sent++;
    send({ t: 'attack', kind });
    alertOnCanvas(kind, 'out');
  }

  function receiveAttack(kind) {
    if (!duel.live || duel.over || typeof chaosEffects === 'undefined') return;
    duel.received++;
    alertOnCanvas(kind, 'in');
    buzz([80, 50, 80]);
    if (bar) { bar.classList.remove('hit'); void bar.offsetWidth; bar.classList.add('hit'); }
    setTimeout(() => {
      if (!duel.live || duel.over) return;
      if (kind === 'flip') chaosEffects.controlsInvert = Math.max(chaosEffects.controlsInvert, 180);
      else if (kind === 'invert') chaosEffects.invert = Math.max(chaosEffects.invert, 150);
      else if (kind === 'tilt') chaosEffects.tilt = Math.max(chaosEffects.tilt, 150);
      else if (kind === 'drop') dropReinforcements();
    }, 700); // a beat of warning first
  }

  function dropReinforcements() {
    if (!Array.isArray(aliens) || typeof levelConfigs === 'undefined') return;
    const cfg = levelConfigs[currentLevel] || levelConfigs[0];
    const w = cfg.alienWidth, h = cfg.alienHeight, pad = 10, n = 5;
    const total = n * (w + pad) - pad;
    const startX = (canvas.width - total) / 2;
    for (let i = 0; i < n; i++) {
      const x = startX + i * (w + pad);
      aliens.push({
        x, y: 8, width: w, height: h, type: cfg.alienType, originalX: x, alive: true,
        movePattern: cfg.movement === 'zigzag' ? Math.random() * Math.PI * 2 : 0,
        driftSpeed: cfg.movement === 'zigzag' ? (0.85 + Math.random() * 0.4) : 1,
        word: cfg.alienType === 'latin' ? latinChars[Math.floor(Math.random() * latinChars.length)] : null,
        wordFlickerAt: Math.random() * 200, bobSeed: Math.random() * Math.PI * 2, isFlickering: false
      });
    }
    prevAlive = aliens.filter(a => a.alive).length; // reinforcements aren't kills
  }

  // Share my state twice a second
  setInterval(() => {
    if (!duel.live || duel.over) return;
    send({ t: 'state', level: (typeof currentLevel !== 'undefined' ? currentLevel : 0) + 1, lives: typeof lives !== 'undefined' ? lives : 0, kills: duel.myKills });
  }, 500);

  // ---------- results ----------
  if (typeof gameOver === 'function') {
    const orig = gameOver;
    window.gameOver = gameOver = function () {
      const r = orig.apply(this, arguments);
      if (duel.live && !duel.over) {
        if (typeof gameOverOverlay !== 'undefined') gameOverOverlay.style.display = 'none';
        send({ t: 'dead', level: currentLevel + 1, kills: duel.myKills });
        finish(false, 'You ran out of lives first.');
      }
      return r;
    };
  }
  if (typeof completeSpaceInvaders === 'function') {
    const orig = completeSpaceInvaders;
    window.completeSpaceInvaders = completeSpaceInvaders = function () {
      if (duel.live && !duel.over) {
        send({ t: 'cleared', kills: duel.myKills });
        finish(true, 'You cleared all 8 levels first.');
      }
      return orig.apply(this, arguments);
    };
  }

  let resultEl = null;
  function finish(won, why) {
    duel.over = true;
    if (won && typeof gameActive !== 'undefined' && !(typeof gameState !== 'undefined' && gameState.spaceInvadersCompleted)) {
      gameActive = false; // freeze the winner's board
    }
    buzz(won ? [60, 40, 60, 40, 200] : 400);
    if (resultEl) resultEl.remove();
    resultEl = overlay(`
      <p class="du-k">DUEL · ROOM ${esc(duel.code)}</p>
      <h2 class="du-h">${won ? '🏆 YOU WIN' : '💀 DEFEATED'}</h2>
      <p style="margin:0">${esc(why)}</p>
      <div class="du-stats">
        <div><b>${duel.myKills}</b>your kills</div>
        <div><b>${duel.sent}</b>attacks sent</div>
        <div><b>${duel.received}</b>attacks taken</div>
      </div>
      <p style="font-size:0.8rem;opacity:0.8;margin:0 0 6px">Rival: level ${duel.them.level}, ${duel.them.kills} kills</p>
      <div class="du-status"></div>
      <button class="du-btn wide" data-a="rematch">Rematch</button>
      <button class="du-btn ghost wide" data-a="leave">Leave duel</button>`, 'du-result ' + (won ? 'win' : 'lose'));
    resultEl.querySelector('.du-status').innerHTML = '';
    resultEl.querySelector('[data-a="rematch"]').addEventListener('click', e => {
      duel.rematchMe = true;
      e.target.textContent = 'Waiting for rival…';
      e.target.disabled = true;
      send({ t: 'rematch' });
      maybeRematch();
    });
    resultEl.querySelector('[data-a="leave"]').addEventListener('click', leaveDuel);
    say(won ? pick(['Duel won. Go and tell them.', 'Victory. Try to be humble. Or don\'t.']) : pick(['You lost a duel to a friend. Forever.', 'Defeated. They will bring this up.']));
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function maybeRematch() {
    if (!(duel.rematchMe && duel.rematchThem)) {
      if (duel.rematchThem && resultEl) setStatus(resultEl, 'Your rival wants a rematch!', 'ok');
      return;
    }
    if (resultEl) { resultEl.remove(); resultEl = null; }
    if (typeof gameState !== 'undefined') gameState.spaceInvadersCompleted = false;
    if (typeof winOverlay !== 'undefined') winOverlay.style.display = 'none';
    duel.meReady = duel.themReady = true;
    // both phones get here; the host starts the countdown for both
    if (duel.role === 'host') { send({ t: 'go' }); countdownThenStart(); }
  }

  // ---------- messages ----------
  function onMessage(m) {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'hello': duel.them.ship = String(m.ship || 'classic'); break;
      case 'full': setStatus(lobby, 'That duel already has two players.', 'bad'); break;
      case 'ready': duel.themReady = true; duel.them.ship = String(m.ship || duel.them.ship); maybeGo(); break;
      case 'go': countdownThenStart(); break;
      case 'state':
        duel.them.level = Math.max(1, Math.min(9, m.level | 0));
        duel.them.lives = Math.max(0, Math.min(3, m.lives | 0));
        duel.them.kills = Math.max(0, m.kills | 0);
        updateBar();
        break;
      case 'attack': if (ATTACKS[m.kind]) receiveAttack(m.kind); break;
      case 'dead':
        if (duel.live && !duel.over) {
          duel.them.level = m.level | 0 || duel.them.level;
          duel.them.lives = 0;
          finish(true, 'Your rival ran out of lives.');
        }
        break;
      case 'cleared':
        if (duel.live && !duel.over) finish(false, 'Your rival cleared all 8 levels first.');
        break;
      case 'rematch': duel.rematchThem = true; maybeRematch(); break;
      case 'bye': onDisconnect(); break;
    }
  }

  function onDisconnect() {
    if (!duel.connected) return;
    duel.connected = false;
    const wasLive = duel.live && !duel.over;
    duel.live = false;
    if (bar) { bar.remove(); bar = null; }
    const t = document.createElement('div');
    t.className = 'du-alert in';
    t.style.cssText = 'position:fixed;top:20%;left:50%;z-index:340';
    t.innerHTML = `<small>DUEL ENDED</small><b>${wasLive ? 'RIVAL FLED' : 'RIVAL LEFT'}</b>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1700);
    if (wasLive) say('Your rival disconnected. That counts as a win in my book.');
    if (resultEl) setStatus(resultEl, 'Your rival left.', 'bad');
    const launch = document.getElementById('ship-launch-btn');
    if (launch) launch.textContent = 'Launch';
    const openBtn = document.querySelector('.du-open-btn');
    if (openBtn) openBtn.textContent = '⚔️ Duel a friend';
    duel.meReady = duel.themReady = false;
  }

  function leaveDuel() {
    send({ t: 'bye' });
    try { if (duel.conn) duel.conn.close(); } catch (e) {}
    try { if (duel.peer) duel.peer.destroy(); } catch (e) {}
    const hadGuestInvite = inviteCode.length === 4;
    duel.conn = duel.peer = null;
    duel.connected = duel.live = false;
    if (lobby) { lobby.remove(); lobby = null; }
    if (resultEl) { resultEl.remove(); resultEl = null; }
    if (bar) { bar.remove(); bar = null; }
    if (hadGuestInvite && typeof gameState !== 'undefined' && !gameState.memoryGameCompleted) return; // back to their memory game
    if (duel.over) location.href = location.pathname; // fresh solo run
  }

  window.addEventListener('pagehide', () => send({ t: 'bye' }));
})();
