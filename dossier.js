// ===== THE DOSSIER: a site that holds a grudge =====
// The site keeps a file on every visitor - on their own phone only
// (localStorage), never sent anywhere. It remembers:
//   visits, time away, rage-quits (leaving mid-game), deaths per level,
//   best level, wins, memory-game record, which path they picked last,
//   and what the lie detector said about them.
// Its attitude changes as the relationship grows: stranger -> annoyed ->
// suspicious -> attached -> clingy -> family (or holding a grudge after a
// rage-quit). The welcome screen greets returning visitors with receipts,
// a "View your file" button opens a classified folder with redacted facts
// you tap to reveal, and "Shred my file" wipes everything.
// Switching tabs mid-game changes the tab title to beg you to come back.

(function () {
  'use strict';

  const KEY = 'ntb-dossier';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];

  const d = Object.assign({
    visits: 0, firstAt: 0, lastAt: 0, deaths: {}, bestLevel: 0, wins: 0,
    rageQuits: 0, lastExit: null, memoryBest: 0, outsideClicks: 0, tabLeaves: 0, caseNo: 0
  }, load());
  const prevVisitAt = d.lastAt;
  const previousVisits = d.visits;
  const lastExit = d.lastExit;
  d.visits += 1;
  d.firstAt = d.firstAt || Date.now();
  d.lastAt = Date.now();
  d.caseNo = d.caseNo || Math.floor(1000 + Math.random() * 9000);
  d.lastExit = null;
  save(d);

  const levelName = i => (typeof levelConfigs !== 'undefined' && levelConfigs[i]) ? levelConfigs[i].name : `Level ${i + 1}`;
  const PATH_NAMES = { allout: 'All Out', somewhatout: 'Somewhat Out', maybe: 'Maybe', never: 'Never', twosides: 'Two Sides' };

  // ---------- the relationship ----------
  function mood() {
    if (lastExit && lastExit.stage) return 'grudge';
    const n = previousVisits;
    if (n === 0) return 'stranger';
    if (n === 1) return 'annoyed';
    if (n <= 3) return 'suspicious';
    if (n <= 6) return 'attached';
    if (n <= 11) return 'clingy';
    return 'family';
  }
  const MOODS = {
    stranger:   { emoji: '🙂', label: 'Stranger',   level: 0 },
    annoyed:    { emoji: '😒', label: 'Annoyed',    level: 1 },
    suspicious: { emoji: '🤨', label: 'Suspicious', level: 2 },
    attached:   { emoji: '🥹', label: 'Attached',   level: 3 },
    clingy:     { emoji: '🥺', label: 'Clingy',     level: 4 },
    family:     { emoji: '🫶', label: 'Family',     level: 5 },
    grudge:     { emoji: '😤', label: 'Holding a grudge', level: 1 }
  };
  const GREETINGS = {
    annoyed: ['Oh. You\'re back.', 'You again.', 'Back so soon?'],
    suspicious: ['Again? Okay.', 'Visit number ' + d.visits + '. Interesting.', 'We need to stop meeting like this.'],
    attached: ['I was hoping you\'d come back.', 'There you are.', 'Missed you. A normal amount.'],
    clingy: ['Where were you? I waited.', 'Don\'t leave like that again.', 'I counted the seconds. All of them.'],
    family: ['You live here now.', 'Welcome home.', 'Visit ' + d.visits + '. We should get you a key.'],
    grudge: ['We need to talk about last time.', 'Oh. The quitter returns.', 'Look who came crawling back.']
  };

  function ago(ms) {
    const m = Math.round(ms / 60000);
    if (m < 2) return 'a minute ago';
    if (m < 60) return `${m} minutes ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
    const days = Math.round(h / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  function worstLevel() {
    let worst = null;
    Object.keys(d.deaths).forEach(k => { if (!worst || d.deaths[k] > d.deaths[worst]) worst = k; });
    return worst === null ? null : { i: +worst, n: d.deaths[worst] };
  }

  // Receipts: specific things we remember, spiciest first
  function receipts() {
    const r = [];
    if (lastExit && lastExit.stage === 'invaders') r.push(`Last time you left on Level ${lastExit.level + 1} · ${levelName(lastExit.level)} with ${lastExit.lives} ${lastExit.lives === 1 ? 'life' : 'lives'} left. We saw that.`);
    if (lastExit && lastExit.stage === 'memory') r.push(`Last time you walked out of the memory game with ${lastExit.pairs} of 8 pairs. Just left them there.`);
    if (lastExit && lastExit.stage === 'quiz') r.push(`Last time you ran away halfway through the ${PATH_NAMES[lastExit.path] || ''} quiz.`);
    const q = d.quiz || {};
    if (q.honesty !== undefined && q.honesty < 60) r.push(`The lie detector caught you last time. ${q.honesty}% honest.`);
    const w = worstLevel();
    if (w && w.n >= 2) r.push(`You've died ${w.n} times on ${levelName(w.i)}. It remembers you too.`);
    if (d.wins >= 1) r.push(d.wins === 1 ? 'You beat all of it once. Why are you back?' : `You've beaten this ${d.wins} times. Why are you still here?`);
    if (q.path) r.push(`Last time you picked ${PATH_NAMES[q.path]}. ${q.earned && q.earned !== q.path ? `The machine said ${PATH_NAMES[q.earned]}.` : 'Bold.'}`);
    if (prevVisitAt) {
      const gap = Date.now() - prevVisitAt;
      if (gap < 15 * 60000) r.push(`You were literally here ${ago(gap)}.`);
      else if (gap > 7 * 86400000) r.push(`It's been ${ago(gap).replace(' ago', '')}. No call, no text.`);
    }
    const hr = new Date().getHours();
    if (hr >= 0 && hr < 5) r.push(`It's ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Go to sleep.`);
    if (d.memoryBest) r.push(`Your memory game record: ${d.memoryBest} tries.`);
    return r;
  }

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .dz-mood { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); margin-bottom: 10px; }
  .dz-receipt { font-style: italic; opacity: 0.9; margin: 8px 0 0; font-size: 0.95rem; }
  .dz-file-btn { opacity: 0; animation: welcome-fade-up-btn 0.5s ease-out 1.6s forwards; margin: 10px 0 0 14px; background: transparent !important; border: 1px dashed rgba(255,255,255,0.4) !important; font-size: 0.9rem !important; }

  .dz-overlay { position: fixed; inset: 0; z-index: 330; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: rgba(0,0,0,0.85); overflow-y: auto; animation: dz-in 0.3s ease; }
  @keyframes dz-in { from { opacity: 0; } }
  .dz-folder { position: relative; width: min(400px, 100%); margin: auto; padding: 34px 20px 20px; color: #2b2112;
    font-family: 'Courier New', monospace; background: #e9cf8e; border-radius: 4px 12px 12px 12px;
    box-shadow: 0 30px 70px rgba(0,0,0,0.6), inset 0 0 40px rgba(120,80,20,0.25); animation: dz-open 0.5s cubic-bezier(0.2, 1.3, 0.4, 1); }
  @keyframes dz-open { from { transform: rotateX(70deg) translateY(40px); opacity: 0; } }
  .dz-folder::before { content: ''; position: absolute; left: 0; top: -18px; width: 42%; height: 20px; background: #e9cf8e; border-radius: 8px 8px 0 0; }
  .dz-tab { position: absolute; left: 14px; top: -14px; font-size: 0.7rem; font-weight: bold; letter-spacing: 0.1em; }
  .dz-stamp { position: absolute; right: 16px; top: 14px; transform: rotate(8deg); border: 3px solid #a3121c; color: #a3121c;
    font-weight: bold; padding: 2px 8px; font-size: 0.8rem; letter-spacing: 0.15em; opacity: 0.85; }
  .dz-h { font-size: 1.3rem; font-weight: bold; margin: 0 0 4px; }
  .dz-sub { font-size: 0.75rem; opacity: 0.75; margin: 0 0 14px; }
  .dz-gauge { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 16px; padding: 8px 10px; background: rgba(0,0,0,0.07); border-radius: 8px; }
  .dz-gauge span { font-size: 1.3rem; filter: grayscale(1); opacity: 0.35; transition: all 0.3s ease; }
  .dz-gauge span.on { filter: none; opacity: 1; transform: scale(1.35); }
  .dz-rows { list-style: none; padding: 0; margin: 0; font-size: 0.85rem; }
  .dz-rows li { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px dashed rgba(43,33,18,0.3); }
  .dz-rows li b { font-weight: normal; opacity: 0.75; }
  .dz-redact { position: relative; cursor: pointer; text-align: right; }
  .dz-redact::after { content: ''; position: absolute; inset: -2px -3px; background: #111; border-radius: 2px; transition: transform 0.35s ease; transform-origin: right; }
  .dz-redact.open::after { transform: scaleX(0); }
  .dz-notes { margin: 14px 0 0; padding: 10px; background: #fff8e1; border-radius: 6px; font-size: 0.82rem; line-height: 1.45;
    box-shadow: 2px 3px 0 rgba(0,0,0,0.15); transform: rotate(-0.6deg); }
  .dz-notes p { margin: 0 0 6px; }
  .dz-notes p::before { content: '✎ '; }
  .dz-actions { display: flex; gap: 8px; margin-top: 16px; }
  .dz-actions button { flex: 1; font: inherit; font-weight: bold; padding: 11px 8px; border-radius: 8px; cursor: pointer; border: 2px solid #2b2112; background: #2b2112; color: #e9cf8e; }
  .dz-actions button.ghost { background: transparent; color: #a3121c; border-color: #a3121c; }
  .dz-strip { position: fixed; top: 45%; width: 12px; background: #e9cf8e; z-index: 340; pointer-events: none;
    background-image: repeating-linear-gradient(180deg, transparent 0 6px, rgba(0,0,0,0.15) 6px 7px); animation: dz-fall 1.3s ease-in forwards; }
  @keyframes dz-fall { to { transform: translateY(80vh) rotate(var(--r)); opacity: 0; } }
  `;
  document.head.appendChild(style);

  // ---------- welcome screen ----------
  const m = mood();
  const title = document.getElementById('welcome-title');
  const text = document.querySelector('.welcome-text');
  const startBtn = document.getElementById('start-btn');
  if (m !== 'stranger' && title && text) {
    title.textContent = pick(GREETINGS[m]);
    const r = receipts();
    const badge = document.createElement('div');
    badge.className = 'dz-mood';
    badge.innerHTML = `${MOODS[m].emoji} Relationship: ${MOODS[m].label}`;
    title.before(badge);
    if (r.length) {
      const p = document.createElement('p');
      p.className = 'dz-receipt';
      p.textContent = r[0];
      text.after(p);
    }
    if (startBtn) {
      startBtn.textContent = { annoyed: 'Fine, begin', suspicious: 'Begin (again)', attached: 'Let\'s go', clingy: 'I\'m here now', family: 'Go home', grudge: 'Redeem myself' }[m] || startBtn.textContent;
      const fileBtn = document.createElement('button');
      fileBtn.className = 'btn dz-file-btn';
      fileBtn.type = 'button';
      fileBtn.textContent = '📁 View your file';
      fileBtn.addEventListener('click', e => { e.stopPropagation(); openFile(); });
      startBtn.after(fileBtn);
    }
  }

  // ---------- the file ----------
  function openFile() {
    const w = worstLevel();
    const q = d.quiz || {};
    const rows = [
      ['Visits', d.visits],
      ['First seen', new Date(d.firstAt).toLocaleDateString()],
      ['Last seen', prevVisitAt ? ago(Date.now() - prevVisitAt) : 'just now'],
      ['Rage-quits', d.rageQuits],
      ['Best level', d.bestLevel ? `${d.bestLevel >= 9 ? 'Beat it all' : 'Level ' + d.bestLevel}` : 'None yet'],
      ['Deaths', Object.values(d.deaths).reduce((a, b) => a + b, 0)],
      ['Nemesis', w ? `${levelName(w.i)} (${w.n})` : 'None yet'],
      ['Wins', d.wins],
      ['Last path', q.path ? PATH_NAMES[q.path] : 'Unknown'],
      ['Honesty', q.honesty !== undefined ? q.honesty + '%' : 'Untested'],
      ['Wandered off-screen', d.outsideClicks + ' clicks'],
      ['Left the tab', d.tabLeaves + ' times']
    ];
    const moodKeys = ['stranger', 'annoyed', 'suspicious', 'attached', 'clingy', 'family'];
    const notes = receipts().slice(0, 3);
    const ov = document.createElement('div');
    ov.className = 'overlay dz-overlay';
    ov.innerHTML = `
      <div class="dz-folder" role="dialog" aria-label="Your file">
        <span class="dz-tab">SUBJECT #${d.caseNo}</span>
        <span class="dz-stamp">CLASSIFIED</span>
        <p class="dz-h">YOUR FILE</p>
        <p class="dz-sub">Tap the black bars. Kept on this phone only.</p>
        <div class="dz-gauge" title="How the site feels about you">${moodKeys.map(k => `<span class="${k === m || (m === 'grudge' && k === 'annoyed') ? 'on' : ''}" title="${MOODS[k].label}">${MOODS[k].emoji}</span>`).join('')}</div>
        <ul class="dz-rows">${rows.map(([k, v]) => `<li><b>${k}</b><span class="dz-redact">${esc(v)}</span></li>`).join('')}</ul>
        ${notes.length ? `<div class="dz-notes">${notes.map(n => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
        <div class="dz-actions"><button type="button" data-act="close">Close file</button><button type="button" class="ghost" data-act="shred">Shred my file</button></div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('.dz-redact').forEach((el, i) => {
      el.addEventListener('click', () => el.classList.add('open'));
    });
    ov.querySelector('[data-act="close"]').addEventListener('click', () => ov.remove());
    ov.querySelector('[data-act="shred"]').addEventListener('click', () => shred(ov));
  }

  function shred(ov) {
    const folder = ov.querySelector('.dz-folder');
    const r = folder.getBoundingClientRect();
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('div');
      s.className = 'dz-strip';
      s.style.left = (r.left + (r.width / 26) * i) + 'px';
      s.style.height = (r.height * (0.5 + Math.random() * 0.5)) + 'px';
      s.style.top = r.top + 'px';
      s.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg');
      s.style.animationDelay = (Math.random() * 0.25) + 's';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1700);
    }
    ov.remove();
    try {
      Object.keys(localStorage).filter(k => k.startsWith('ntb-dossier')).forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    shredded = true;
    if (title) title.textContent = 'Who are you?';
    if (text) text.textContent = 'Never met you before in my life. Finish the games, unlock the path, and find your outfit.';
    document.querySelectorAll('.dz-mood, .dz-receipt, .dz-file-btn').forEach(el => el.remove());
    if (startBtn) startBtn.textContent = 'Begin Exploring';
  }
  let shredded = false;

  // ---------- keep the file up to date ----------
  const update = fn => { if (shredded) return; const cur = Object.assign(d, load()); fn(cur); save(cur); };

  if (typeof loseLives === 'function') {
    const orig = loseLives;
    window.loseLives = loseLives = function () {
      const before = lives;
      const r = orig.apply(this, arguments);
      if (lives < before) update(x => { x.deaths[currentLevel] = (x.deaths[currentLevel] || 0) + (before - lives); });
      return r;
    };
  }
  let greeted = false;
  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (i) {
      const r = orig.apply(this, arguments);
      if (i < 8) update(x => { x.bestLevel = Math.max(x.bestLevel || 0, i + 1); });
      if (i === 0 && m !== 'stranger' && window.ntbNarrator && !greeted) {
        greeted = true;
        const line = { grudge: 'Try not to quit this time.', clingy: 'Stay this time. Please.', family: 'Same aliens. Same you. Let\'s go.', attached: 'Good to have you back.', suspicious: 'Let\'s see if you improved.', annoyed: 'Round two. Try to keep up.' }[m];
        if (line) setTimeout(() => window.ntbNarrator.say(line, 1), 12000);
      }
      return r;
    };
  }
  if (typeof completeSpaceInvaders === 'function') {
    const orig = completeSpaceInvaders;
    window.completeSpaceInvaders = completeSpaceInvaders = function () {
      const r = orig.apply(this, arguments);
      update(x => { x.wins = (x.wins || 0) + 1; x.bestLevel = 9; });
      return r;
    };
  }
  let memoryTries = 0;
  if (typeof checkForMatch === 'function') {
    const orig = checkForMatch;
    window.checkForMatch = checkForMatch = function () { memoryTries++; return orig.apply(this, arguments); };
  }
  if (typeof completeMemoryGame === 'function') {
    const orig = completeMemoryGame;
    window.completeMemoryGame = completeMemoryGame = function () {
      const r = orig.apply(this, arguments);
      update(x => { x.memoryBest = x.memoryBest ? Math.min(x.memoryBest, memoryTries) : memoryTries; });
      return r;
    };
  }
  if (typeof handleOutsideClick === 'function') {
    const orig = handleOutsideClick;
    window.handleOutsideClick = handleOutsideClick = function () {
      update(x => { x.outsideClicks = (x.outsideClicks || 0) + 1; });
      return orig.apply(this, arguments);
    };
  }

  // Leaving mid-game = rage-quit (unless they finished Space Invaders)
  window.addEventListener('pagehide', () => {
    if (shredded || typeof gameState === 'undefined' || !gameState.initialized || gameState.spaceInvadersCompleted) return;
    let exit = null;
    if (gameState.memoryGameCompleted && typeof currentLevel !== 'undefined') exit = { stage: 'invaders', level: currentLevel, lives: typeof lives !== 'undefined' ? lives : 0 };
    else if (typeof matchedPairs !== 'undefined' && matchedPairs > 0) exit = { stage: 'memory', pairs: matchedPairs };
    if (exit) update(x => { x.lastExit = exit; x.rageQuits = (x.rageQuits || 0) + 1; });
  });

  // Tab title begging
  const origTitle = document.title;
  const BEG = {
    stranger: ['👀 hello?', 'come back?'], annoyed: ['😒 really?', 'rude.'], suspicious: ['🤨 where are you going', 'we saw that'],
    attached: ['🥹 come back', 'miss you already'], clingy: ['🥺 come back', 'DON\'T LEAVE', 'i\'ll wait here'],
    family: ['🫶 dinner\'s getting cold', 'come home'], grudge: ['😤 quitting again?', 'typical.']
  };
  let begTimer = null;
  document.addEventListener('visibilitychange', () => {
    if (shredded) return;
    if (document.hidden) {
      if (typeof gameState === 'undefined' || !gameState.initialized) return;
      update(x => { x.tabLeaves = (x.tabLeaves || 0) + 1; });
      const lines = BEG[m] || BEG.stranger;
      let i = 0;
      document.title = lines[0];
      begTimer = setInterval(() => { i = (i + 1) % lines.length; document.title = lines[i]; }, 2000);
    } else {
      clearInterval(begTimer);
      if (document.title !== origTitle) {
        document.title = origTitle;
        if (window.ntbNarrator && typeof gameActive !== 'undefined' && gameActive) window.ntbNarrator.say(pick(['Oh, you came back.', 'Where did you go? Never mind.', 'I changed the tab title while you were gone. Did you see?']), 1);
      }
    }
  });

  window.ntbDossier = { open: openFile, mood: m, data: () => load() };
})();
