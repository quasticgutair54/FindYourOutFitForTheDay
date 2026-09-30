// ===== SHIRT BOUNTY BOARD =====
// Every shirt can carry its own ID in its QR code: index.html?shirt=7K3QX
// (print new codes with shirt-codes.html). Whoever scans a shirt is
// challenging the person WEARING it:
//
//   * An unclaimed shirt asks "Is this yours?" - the owner claims it with a name.
//   * Strangers who scan it get a WANTED poster: the owner's name and best level.
//   * During Space Invaders a rival track shows you racing the owner level by level.
//   * When the run ends, you sign that shirt's leaderboard. Beat the owner and
//     you get a "SHIRT DEFEATED" stamp to screenshot and show them.
//   * The owner sees, next time they scan, how many strangers played their
//     shirt and who beat them.
//
// STORAGE: scores have to live somewhere every phone can reach.
//   - Leave SHIRT_BOARD_API empty -> local mode: it all works, but only on
//     this phone (good for testing, useless for strangers).
//   - Deploy shirt-board-worker.js (free Cloudflare Worker, see the comment at
//     its top) and paste its URL below -> real shared leaderboards.
const SHIRT_BOARD_API = '';

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const rawId = (params.get('shirt') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (rawId.length < 4 || rawId.length > 10) return; // no shirt ID -> feature stays invisible
  const SHIRT_ID = rawId;

  const NAME_KEY = 'ntb-player-name';
  const TOKENS_KEY = 'ntb-owner-tokens';
  const SEEN_KEY = 'ntb-shirt-seen-' + SHIRT_ID;

  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanName = s => String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

  function levelLabel(best) {
    if (!best) return 'Not played yet';
    if (best >= 9) return 'Beat all 8 levels';
    const names = (typeof levelConfigs !== 'undefined') ? levelConfigs.map(l => l.name) : [];
    return `Level ${best}${names[best - 1] ? ' · ' + names[best - 1] : ''}`;
  }
  const fmtTime = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '';
  // Higher level wins, faster time breaks ties, assisted runs rank below clean ones
  const better = (a, b) => (a.best - b.best) || ((b.assisted ? 1 : 0) - (a.assisted ? 1 : 0)) || ((b.time || 1e9) - (a.time || 1e9));

  // ---------- storage adapters ----------
  const LocalStore = {
    _db() { return lsGet('ntb-shirt-db', {}); },
    _save(db) { lsSet('ntb-shirt-db', db); },
    async get(id) {
      const db = this._db();
      return db[id] || { id, owner: null, board: [], plays: 0 };
    },
    async claim(id, name) {
      const db = this._db();
      const s = db[id] || { id, owner: null, board: [], plays: 0 };
      if (s.owner) throw new Error('already claimed');
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      s.owner = { name, best: 0, time: 0, token };
      db[id] = s; this._save(db);
      return { token };
    },
    async score(id, entry, token) {
      const db = this._db();
      const s = db[id] || { id, owner: null, board: [], plays: 0 };
      if (s.owner && token && s.owner.token === token) {
        if (better(entry, s.owner) > 0) Object.assign(s.owner, { best: entry.best, time: entry.time, assisted: entry.assisted });
      } else {
        s.plays = (s.plays || 0) + 1; // only challengers count, not the owner
        const mine = s.board.find(r => r.name.toLowerCase() === entry.name.toLowerCase());
        if (!mine) s.board.push({ ...entry, at: Date.now() });
        else if (better(entry, mine) > 0) Object.assign(mine, entry, { at: Date.now() });
        s.board.sort((a, b) => better(b, a));
        s.board = s.board.slice(0, 50);
      }
      db[id] = s; this._save(db);
      return this.get(id);
    }
  };

  const RemoteStore = {
    async get(id) {
      const r = await fetch(`${SHIRT_BOARD_API}/shirt/${id}`);
      if (!r.ok) throw new Error('board unavailable');
      return r.json();
    },
    async claim(id, name) {
      const r = await fetch(`${SHIRT_BOARD_API}/shirt/${id}/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'claim failed');
      return r.json();
    },
    async score(id, entry, token) {
      const r = await fetch(`${SHIRT_BOARD_API}/shirt/${id}/score`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...entry, token })
      });
      if (!r.ok) throw new Error('score failed');
      return r.json();
    }
  };

  const store = SHIRT_BOARD_API ? RemoteStore : LocalStore;
  const myToken = () => (lsGet(TOKENS_KEY, {})[SHIRT_ID]) || null;
  let shirt = { id: SHIRT_ID, owner: null, board: [], plays: 0 };
  const iAmOwner = () => !!(shirt.owner && myToken());
  // the remote API never sends the token back, so ownership = "this phone holds a token for this shirt"

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .sb-overlay { position: fixed; inset: 0; z-index: 320; display: flex; align-items: center; justify-content: center;
    padding: 16px; background: rgba(0,0,0,0.82); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
    overflow-y: auto; animation: sb-fade 0.35s ease; }
  @keyframes sb-fade { from { opacity: 0; } }
  .sb-poster { position: relative; width: min(360px, 100%); margin: auto; padding: 26px 22px 22px; text-align: center;
    color: #3b2412; font-family: Georgia, 'Times New Roman', serif;
    background: radial-gradient(circle at 30% 20%, #f6e7c4, #e6cf9c 60%, #d4b77a);
    box-shadow: 0 20px 60px rgba(0,0,0,0.6), inset 0 0 60px rgba(120,70,20,0.35);
    clip-path: polygon(0 2%, 4% 0, 30% 1.5%, 55% 0, 82% 1%, 100% 0, 99% 30%, 100% 62%, 98.5% 100%, 70% 98.5%, 40% 100%, 12% 98.8%, 0 100%, 1.2% 70%, 0 40%);
    transform: rotate(-1.2deg); animation: sb-drop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1); }
  @keyframes sb-drop { from { transform: translateY(-40px) rotate(-6deg); opacity: 0; } }
  .sb-pin { position: absolute; top: 10px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #ff9a8a, #b3141c); box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
  .sb-wanted { font-family: 'Rockwell', 'Georgia', serif; font-size: 3rem; font-weight: 900; letter-spacing: 0.06em; margin: 6px 0 0; line-height: 1; }
  .sb-sub { font-size: 0.75rem; letter-spacing: 0.3em; text-transform: uppercase; margin: 4px 0 14px; }
  .sb-face { width: 120px; height: 120px; margin: 0 auto 10px; border: 3px solid #3b2412; display: flex; align-items: center; justify-content: center;
    font-size: 3.6rem; background: rgba(59,36,18,0.08); filter: sepia(0.6); }
  .sb-name { font-size: 1.9rem; font-weight: bold; margin: 0; word-break: break-word; }
  .sb-best { font-size: 1rem; margin: 6px 0 2px; }
  .sb-meta { font-size: 0.8rem; opacity: 0.8; margin: 0 0 14px; }
  .sb-reward { border-top: 2px dashed #6b4a2a; border-bottom: 2px dashed #6b4a2a; padding: 8px 0; margin: 10px 0 16px; font-size: 0.85rem; letter-spacing: 0.08em; }
  .sb-reward b { font-size: 1.15rem; display: block; letter-spacing: 0.02em; }
  .sb-id { position: absolute; right: 14px; bottom: 8px; font-family: 'Courier New', monospace; font-size: 0.65rem; opacity: 0.6; }
  .sb-btn { display: block; width: 100%; margin-top: 8px; padding: 12px; border-radius: 6px; cursor: pointer;
    font-family: Georgia, serif; font-weight: bold; font-size: 1rem; border: 2px solid #3b2412; background: #3b2412; color: #f6e7c4; }
  .sb-btn.ghost { background: transparent; color: #3b2412; }
  .sb-input { width: 100%; padding: 11px 12px; font-size: 1rem; border: 2px solid #3b2412; border-radius: 6px; background: #fff8e6; color: #3b2412; font-family: Georgia, serif; }
  .sb-err { color: #b3141c; font-size: 0.8rem; min-height: 1em; margin: 6px 0 0; }
  .sb-list { list-style: none; padding: 0; margin: 10px 0 0; text-align: left; font-size: 0.9rem; }
  .sb-list li { display: flex; gap: 8px; align-items: baseline; padding: 6px 4px; border-bottom: 1px dotted #8a6a45; }
  .sb-list li.me { background: rgba(179,20,28,0.12); font-weight: bold; }
  .sb-list li.owner { color: #7a1a1a; }
  .sb-rank { width: 1.6em; opacity: 0.7; }
  .sb-who { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sb-lvl { font-family: 'Courier New', monospace; font-size: 0.8rem; }
  .sb-stamp { position: relative; display: inline-block; margin: 2px 0 12px; transform: rotate(-8deg) scale(2.6); opacity: 0;
    color: #b3141c; border: 5px double #b3141c; padding: 4px 12px; font-family: Impact, 'Arial Black', sans-serif; font-size: 1.8rem;
    letter-spacing: 0.05em; white-space: nowrap; pointer-events: none; animation: sb-stamp 0.4s 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) forwards; }
  @keyframes sb-stamp { to { opacity: 0.9; transform: rotate(-8deg) scale(1); } }

  .sb-track { width: 100%; max-width: 760px; margin: 6px 0 2px; padding: 8px 10px 6px; border-radius: 10px;
    background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.12); font-family: 'Courier New', monospace; color: #ddd; }
  .sb-track-head { display: flex; justify-content: space-between; font-size: 0.7rem; letter-spacing: 0.08em; margin-bottom: 6px; opacity: 0.85; }
  .sb-rail { position: relative; height: 26px; }
  .sb-rail::before { content: ''; position: absolute; left: 4%; right: 4%; top: 50%; height: 2px; background: rgba(255,255,255,0.2); }
  .sb-node { position: absolute; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: rgba(255,255,255,0.35); }
  .sb-node.done { background: var(--accent-2, #7cf3d6); box-shadow: 0 0 6px var(--accent-2, #7cf3d6); }
  .sb-mark { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: 1.05rem; transition: left 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
  .sb-mark.rival { top: 2px; font-size: 0.95rem; filter: drop-shadow(0 0 4px gold); }
  .sb-track.passed { animation: sb-pass 0.6s ease 3; }
  @keyframes sb-pass { 50% { box-shadow: 0 0 24px gold; border-color: gold; } }

  .sb-toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 330; max-width: calc(100% - 32px);
    background: #f6e7c4; color: #3b2412; font-family: Georgia, serif; font-weight: bold; padding: 10px 16px; border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: sb-fade 0.3s ease; text-align: center; }
  `;
  document.head.appendChild(style);

  function overlay(html) {
    const el = document.createElement('div');
    el.className = 'overlay sb-overlay'; // "overlay" so the game's outside-click warning ignores it
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }
  function toast(text, ms = 3500) {
    const t = document.createElement('div');
    t.className = 'sb-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
  const say = (text) => { if (window.ntbNarrator) window.ntbNarrator.say(text, 2); };

  // ---------- 1. the poster (shown right after "Begin Exploring") ----------
  function showPoster() {
    return new Promise(resolve => {
      const beaten = shirt.owner ? shirt.board.filter(r => better(r, shirt.owner) > 0) : [];
      let html;
      if (!shirt.owner) {
        html = `
          <div class="sb-poster"><span class="sb-pin"></span>
            <p class="sb-sub">Found in the wild</p>
            <h2 class="sb-wanted" style="font-size:2.2rem">UNCLAIMED</h2>
            <p class="sb-sub">Shirt #${esc(SHIRT_ID)}</p>
            <div class="sb-face">👕</div>
            <p class="sb-meta">Nobody has claimed this shirt yet.<br>Is it yours? Put your name on it. Everyone who scans it will have to beat you.</p>
            <input class="sb-input" maxlength="16" placeholder="Your name" value="${esc(lsGet(NAME_KEY, ''))}">
            <p class="sb-err"></p>
            <button class="sb-btn" data-act="claim">It's mine. Claim it.</button>
            <button class="sb-btn ghost" data-act="skip">Not mine, just let me play</button>
            <span class="sb-id">#${esc(SHIRT_ID)}</span>
          </div>`;
      } else if (iAmOwner()) {
        const seen = lsGet(SEEN_KEY, 0);
        const newPlays = Math.max(0, (shirt.plays || 0) - seen);
        html = `
          <div class="sb-poster"><span class="sb-pin"></span>
            <p class="sb-sub">Owner's report</p>
            <h2 class="sb-wanted" style="font-size:2.1rem">YOUR SHIRT</h2>
            <p class="sb-sub">#${esc(SHIRT_ID)}</p>
            <p class="sb-name">${esc(shirt.owner.name)}</p>
            <p class="sb-best">Your best: ${esc(levelLabel(shirt.owner.best))}</p>
            <div class="sb-reward"><b>${shirt.plays || 0} ${shirt.plays === 1 ? 'person has' : 'people have'} played your shirt</b>
              ${newPlays ? `${newPlays} new since you last looked. ` : ''}${beaten.length ? `${beaten.length} beat you.` : 'Nobody has beaten you. Yet.'}</div>
            ${beaten.length ? `<ul class="sb-list">${beaten.slice(0, 5).map((r, i) => `<li><span class="sb-rank">${i + 1}.</span><span class="sb-who">${esc(r.name)}</span><span class="sb-lvl">${esc(levelLabel(r.best))}</span></li>`).join('')}</ul>` : ''}
            <button class="sb-btn" data-act="go" style="margin-top:14px">${beaten.length ? 'Take my title back' : 'Defend my title'}</button>
            <span class="sb-id">#${esc(SHIRT_ID)}</span>
          </div>`;
        lsSet(SEEN_KEY, shirt.plays || 0);
      } else {
        const unbeaten = !beaten.length;
        html = `
          <div class="sb-poster"><span class="sb-pin"></span>
            <h2 class="sb-wanted">WANTED</h2>
            <p class="sb-sub">Beaten or alive</p>
            <div class="sb-face">🤠</div>
            <p class="sb-name">${esc(shirt.owner.name)}</p>
            <p class="sb-best">${shirt.owner.best ? 'Best: ' + esc(levelLabel(shirt.owner.best)) : 'Has never even played. Coward.'}</p>
            <p class="sb-meta">You just scanned their shirt. ${shirt.plays ? `${shirt.plays} ${shirt.plays === 1 ? 'person has' : 'people have'} tried.` : 'You are the first challenger.'} ${unbeaten ? 'Nobody has beaten them.' : beaten.length + ' beat them.'}</p>
            <div class="sb-reward">REWARD<b>Bragging rights + a stamped screenshot</b></div>
            <button class="sb-btn" data-act="go">Accept the bounty</button>
            <span class="sb-id">#${esc(SHIRT_ID)}</span>
          </div>`;
      }
      const el = overlay(html);
      const close = () => { el.remove(); resolve(); };
      const go = el.querySelector('[data-act="go"]');
      if (go) go.addEventListener('click', close);
      const skip = el.querySelector('[data-act="skip"]');
      if (skip) skip.addEventListener('click', close);
      const claim = el.querySelector('[data-act="claim"]');
      if (claim) claim.addEventListener('click', async () => {
        const input = el.querySelector('.sb-input');
        const err = el.querySelector('.sb-err');
        const name = cleanName(input.value);
        if (!name) { err.textContent = 'A shirt needs a name.'; input.focus(); return; }
        claim.disabled = true;
        try {
          const { token } = await store.claim(SHIRT_ID, name);
          const tokens = lsGet(TOKENS_KEY, {}); tokens[SHIRT_ID] = token; lsSet(TOKENS_KEY, tokens);
          lsSet(NAME_KEY, name);
          shirt = await store.get(SHIRT_ID).catch(() => shirt);
          close();
          toast(`Shirt #${SHIRT_ID} is now yours, ${name}. Set a score worth beating.`);
        } catch (e) {
          err.textContent = /claimed/.test(e.message) ? 'Someone claimed it seconds before you. Tragic.' : 'Could not claim it right now. Try again.';
          claim.disabled = false;
        }
      });
    });
  }

  // ---------- 2. the rival track ----------
  let track = null;
  let announcedPass = false;
  function buildTrack() {
    if (track) return;
    const container = document.getElementById('space-invaders');
    const ui = container && container.querySelector('.game-ui');
    if (!container || !ui) return;
    track = document.createElement('div');
    track.className = 'sb-track';
    const rival = shirt.owner && !iAmOwner() ? shirt.owner : null;
    const self = iAmOwner() ? shirt.owner : null;
    const target = rival || self;
    const label = rival ? `vs ${esc(rival.name)} 👑 ${esc(levelLabel(rival.best))}` : self ? `your record 👑 ${esc(levelLabel(self.best))}` : `shirt #${esc(SHIRT_ID)}`;
    let nodes = '';
    for (let i = 1; i <= 8; i++) nodes += `<span class="sb-node" data-n="${i}" style="left:${4 + (i - 1) * (92 / 7)}%"></span>`;
    track.innerHTML = `<div class="sb-track-head"><span>🚀 YOU</span><span>${label}</span></div>
      <div class="sb-rail">${nodes}${target && target.best ? `<span class="sb-mark rival" style="left:${pos(target.best)}%">👑</span>` : ''}<span class="sb-mark you" style="left:${pos(1)}%">🚀</span></div>`;
    ui.parentNode.insertBefore(track, ui);
  }
  function pos(level) { return 4 + (Math.min(level, 8) - 1) * (92 / 7) + (level >= 9 ? 4 : 0); }
  function moveTrack(level) {
    if (!track) return;
    const you = track.querySelector('.sb-mark.you');
    if (you) you.style.left = pos(level) + '%';
    track.querySelectorAll('.sb-node').forEach(n => n.classList.toggle('done', +n.dataset.n < level));
  }

  // ---------- 3. run tracking ----------
  const run = { best: 0, start: 0, assisted: false, submitted: false, prevLevel: -1 };
  let sessionBest = null;

  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (levelIndex) {
      const r = orig.apply(this, arguments);
      if (levelIndex >= 8) return r; // completion is handled by completeSpaceInvaders
      if (levelIndex === 0) {
        Object.assign(run, { best: 1, start: Date.now(), assisted: false, submitted: false });
        announcedPass = false;
        buildTrack();
      }
      if (levelIndex === 7 && run.prevLevel >= 0 && run.prevLevel < 6) run.assisted = true; // mercy skip
      run.prevLevel = levelIndex;
      run.best = Math.max(run.best, levelIndex + 1);
      moveTrack(run.best);
      const rival = shirt.owner && !iAmOwner() ? shirt.owner : (iAmOwner() ? shirt.owner : null);
      if (rival && rival.best && run.best > rival.best && !announcedPass) {
        announcedPass = true;
        if (track) { track.classList.add('passed'); setTimeout(() => track && track.classList.remove('passed'), 2000); }
        say(iAmOwner() ? 'New personal record. The shirt is proud of you.' : `You just passed ${rival.name}. Their shirt. Your game.`);
      }
      return r;
    };
  }

  if (typeof completeSpaceInvaders === 'function') {
    const orig = completeSpaceInvaders;
    window.completeSpaceInvaders = completeSpaceInvaders = function () {
      const r = orig.apply(this, arguments);
      run.best = 9;
      moveTrack(9);
      setTimeout(() => whenScreenClear(() => endRun(true)), 8600); // after the win messages (and the vault, if earned)
      return r;
    };
  }
  if (typeof gameOver === 'function') {
    const orig = gameOver;
    window.gameOver = gameOver = function () {
      const r = orig.apply(this, arguments);
      setTimeout(() => endRun(false), 700);
      return r;
    };
  }

  // Wait until no other full-screen moment (vault, fake crash, duel) is showing
  function whenScreenClear(fn) {
    const busy = () => window.ntbVaultPending || document.querySelector('.vx-overlay, .fc-layer, .du-overlay');
    if (!busy()) { fn(); return; }
    const t = setInterval(() => { if (!busy()) { clearInterval(t); setTimeout(fn, 400); } }, 300);
  }

  // ---------- 4. end of run: sign the board ----------
  async function endRun(won) {
    if (run.submitted || !run.best) return;
    if (window.ntbDuel && window.ntbDuel.connected) return; // duels have their own result screen
    run.submitted = true;
    const entry = { best: run.best, time: Math.round((Date.now() - run.start) / 1000), assisted: run.assisted };
    const improved = !sessionBest || better(entry, sessionBest) > 0;
    if (improved) sessionBest = entry;
    const owner = shirt.owner;
    const beatsOwner = owner && !iAmOwner() && better(entry, owner) > 0;
    const newRecord = iAmOwner() && better(entry, owner) > 0;

    // Only interrupt with the full board for runs that matter
    if (!won && !improved && !beatsOwner && !newRecord) {
      toast(`${levelLabel(entry.best)}. Not your best on this shirt.`);
      return;
    }
    let name = iAmOwner() ? owner.name : lsGet(NAME_KEY, '');
    if (!name) name = await askName(entry, beatsOwner);
    if (!name) return;
    lsSet(NAME_KEY, name);
    try {
      shirt = await store.score(SHIRT_ID, { ...entry, name }, myToken());
    } catch (e) {
      toast('The leaderboard is unreachable right now. Your run still counted here.');
      return;
    }
    showBoard(entry, name, beatsOwner, newRecord);
  }

  function askName(entry, beatsOwner) {
    return new Promise(resolve => {
      const el = overlay(`
        <div class="sb-poster"><span class="sb-pin"></span>
          <p class="sb-sub">Sign the shirt</p>
          <h2 class="sb-wanted" style="font-size:2rem">${beatsOwner ? 'YOU WON' : 'YOUR RECORD'}</h2>
          <p class="sb-best">${esc(levelLabel(entry.best))}${entry.time ? ' · ' + fmtTime(entry.time) : ''}</p>
          <p class="sb-meta">Put your name on shirt #${esc(SHIRT_ID)}'s leaderboard.</p>
          <input class="sb-input" maxlength="16" placeholder="Your name">
          <button class="sb-btn" data-act="ok">Sign it</button>
          <button class="sb-btn ghost" data-act="no">Stay anonymous (don't save)</button>
        </div>`);
      const input = el.querySelector('.sb-input');
      setTimeout(() => input.focus(), 100);
      const done = v => { el.remove(); resolve(v); };
      el.querySelector('[data-act="ok"]').addEventListener('click', () => { const n = cleanName(input.value); if (n) done(n); else input.focus(); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { const n = cleanName(input.value); if (n) done(n); } });
      el.querySelector('[data-act="no"]').addEventListener('click', () => done(null));
    });
  }

  function showBoard(entry, name, beatsOwner, newRecord) {
    const rows = [];
    if (shirt.owner) rows.push({ ...shirt.owner, owner: true });
    (shirt.board || []).forEach(r => rows.push(r));
    rows.sort((a, b) => better(b, a));
    const list = rows.slice(0, 8).map((r, i) => {
      const me = r.name && name && r.name.toLowerCase() === name.toLowerCase() && !!r.owner === iAmOwner();
      return `<li class="${me ? 'me' : ''} ${r.owner ? 'owner' : ''}"><span class="sb-rank">${i + 1}.</span>
        <span class="sb-who">${r.owner ? '👑 ' : ''}${esc(r.name)}${r.assisted ? '*' : ''}</span>
        <span class="sb-lvl">${r.best >= 9 ? 'ALL 8' : 'LVL ' + r.best}${r.time ? ' ' + fmtTime(r.time) : ''}</span></li>`;
    }).join('');
    const el = overlay(`
      <div class="sb-poster"><span class="sb-pin"></span>
        <p class="sb-sub">Shirt #${esc(SHIRT_ID)}</p>
        ${beatsOwner ? '<div class="sb-stamp">SHIRT DEFEATED</div>' : ''}${newRecord ? '<div class="sb-stamp" style="color:#1c6b2a;border-color:#1c6b2a">NEW RECORD</div>' : ''}
        <h2 class="sb-wanted" style="font-size:1.9rem">LEADERBOARD</h2>
        <p class="sb-meta">${beatsOwner ? `You beat ${esc(shirt.owner.name)} on their own shirt. Screenshot this. Find them. Show them.` : newRecord ? 'Your shirt, your record. Let them try.' : `Signed by ${esc(name)}.`}</p>
        <ul class="sb-list">${list}</ul>
        ${rows.some(r => r.assisted) ? '<p class="sb-meta" style="margin-top:6px">* got the mercy skip</p>' : ''}
        <button class="sb-btn" data-act="close" style="margin-top:14px">Continue</button>
      </div>`);
    el.querySelector('[data-act="close"]').addEventListener('click', () => el.remove());
    if (beatsOwner) say(`Shirt defeated. ${shirt.owner.name} will hear about this.`);
  }

  // ---------- boot ----------
  // Load the shirt as early as possible, then show the poster once the
  // player taps "Begin Exploring" (so audio + the poster don't fight the welcome screen).
  const ready = store.get(SHIRT_ID).then(s => { shirt = s || shirt; }).catch(() => {});
  if (typeof startExperience === 'function') {
    const orig = startExperience;
    window.startExperience = startExperience = function () {
      const r = orig.apply(this, arguments);
      ready.then(showPoster);
      return r;
    };
  }
  window.ntbShirt = { id: SHIRT_ID, get: () => shirt };
})();
