// ===== NARRATOR 2.0 =====
// Two voices now talk to the player during the games:
//
//  1. THE NARRATOR - the existing 32 sarcastic floating prompts, now actually
//     spoken using the recorded prompt1..32.mp3 clips (clip N = promptLines[N-1]).
//     The background music ducks while it talks.
//
//  2. SYSTEM - a robotic heckler that watches how you play and roasts you for
//     it: dying twice on the same level, missing most of your shots, standing
//     still, hiding in a corner, taking forever, flipping 20 wrong memory cards.
//     Spoken with the browser's built-in speech voice, shown in a terminal-style
//     subtitle bar with a live waveform.
//
// Loaded after the main game script in index.html. It only wraps existing
// game functions (never rewrites them), so the game still works exactly the
// same if this file fails to load.

(function () {
  'use strict';

  // Clips that don't match their text. By length, #13 (1.3s for a 10-word line)
  // and #31 (7.8s for a 10-word line) are almost certainly the wrong recording.
  // These lines stay text-only. Re-check with prompt-review.html and edit here.
  const VOICE_SKIP = new Set([13, 31]);

  const VOICE_PREF_KEY = 'ntb-voice-on';
  let voiceOn = true;
  try { voiceOn = localStorage.getItem(VOICE_PREF_KEY) !== 'off'; } catch (e) {}

  // ---------- styles ----------
  const css = `
  .sys-voice {
    position: absolute; left: 10px; right: 10px; top: 18px; z-index: 25;
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 8px;
    background: rgba(8, 10, 12, 0.82);
    border: 1px solid rgba(255, 60, 80, 0.55);
    box-shadow: 0 0 18px rgba(255, 40, 70, 0.25);
    font-family: 'Courier New', ui-monospace, monospace; font-size: 0.82rem;
    color: #ff5a6e; pointer-events: none;
    opacity: 0; transform: translateY(-8px);
    transition: opacity 0.25s ease, transform 0.25s ease;
  }
  .sys-voice.show { opacity: 1; transform: translateY(0); }
  .sys-voice .sys-tag { font-weight: bold; letter-spacing: 0.12em; flex-shrink: 0; }
  .sys-voice .sys-text { color: #f2f2f2; line-height: 1.3; flex: 1; }
  .sys-voice .sys-text::after { content: '▌'; color: #ff5a6e; animation: sys-caret 0.8s steps(2) infinite; }
  @keyframes sys-caret { 50% { opacity: 0; } }
  .sys-wave { display: flex; align-items: center; gap: 2px; height: 18px; flex-shrink: 0; }
  .sys-wave i { width: 3px; height: 4px; background: #ff5a6e; border-radius: 2px; transition: height 0.08s ease; }
  .floating-prompt.speaking::before {
    content: '🔊'; font-style: normal; margin-right: 6px; display: inline-block;
    animation: np-pulse 0.5s ease-in-out infinite alternate;
  }
  @keyframes np-pulse { to { transform: scale(1.25); } }
  .voice-btn {
    background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.25);
    border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 1rem;
  }
  .voice-btn.off { opacity: 0.55; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- UI ----------
  const wrapper = document.querySelector('.canvas-wrapper');
  const bar = document.createElement('div');
  bar.className = 'sys-voice';
  bar.setAttribute('aria-live', 'polite');
  bar.innerHTML = '<span class="sys-tag">SYSTEM▸</span><span class="sys-text"></span><span class="sys-wave">' + '<i></i>'.repeat(7) + '</span>';
  if (wrapper) wrapper.appendChild(bar);
  const barText = bar.querySelector('.sys-text');
  const waveBars = Array.from(bar.querySelectorAll('.sys-wave i'));

  const voiceBtn = document.createElement('button');
  voiceBtn.className = 'voice-btn';
  voiceBtn.type = 'button';
  const renderVoiceBtn = () => {
    voiceBtn.textContent = voiceOn ? '🗣️' : '🔇';
    voiceBtn.title = voiceOn ? 'Narrator voices on (tap to mute them)' : 'Narrator voices muted';
    voiceBtn.classList.toggle('off', !voiceOn);
  };
  renderVoiceBtn();
  voiceBtn.addEventListener('click', () => {
    voiceOn = !voiceOn;
    try { localStorage.setItem(VOICE_PREF_KEY, voiceOn ? 'on' : 'off'); } catch (e) {}
    if (!voiceOn) stopAllVoices();
    renderVoiceBtn();
  });
  const pauseButton = document.getElementById('pause-btn');
  if (pauseButton && pauseButton.parentNode) pauseButton.parentNode.insertBefore(voiceBtn, pauseButton.nextSibling);

  // ---------- music ducking ----------
  let duckCount = 0;
  let savedVolume = null;
  function duck() {
    if (typeof bgMusic === 'undefined' || !bgMusic) return;
    if (duckCount === 0) {
      savedVolume = bgMusic.volume;
      fadeVolume(bgMusic, savedVolume * 0.3, 250);
    }
    duckCount++;
  }
  function unduck() {
    if (typeof bgMusic === 'undefined' || !bgMusic) return;
    duckCount = Math.max(0, duckCount - 1);
    if (duckCount === 0 && savedVolume !== null) fadeVolume(bgMusic, savedVolume, 500);
  }
  function fadeVolume(el, to, ms) {
    const from = el.volume;
    const start = performance.now();
    function tick(t) {
      const k = Math.min(1, (t - start) / ms);
      try { el.volume = from + (to - from) * k; } catch (e) {}
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------- 1. the recorded narrator ----------
  let currentClip = null;
  let narratorSpeaking = false;

  function playNarratorClip(n) {
    if (!voiceOn || VOICE_SKIP.has(n)) return;
    stopNarratorClip();
    const clip = new Audio(`prompt${n}.mp3`);
    clip.volume = 1;
    currentClip = clip;
    narratorSpeaking = true;
    if (typeof floatingPrompt !== 'undefined') floatingPrompt.classList.add('speaking');
    duck();
    const done = () => {
      if (currentClip !== clip) return;
      currentClip = null;
      narratorSpeaking = false;
      if (typeof floatingPrompt !== 'undefined') floatingPrompt.classList.remove('speaking');
      unduck();
      setTimeout(drainSystemQueue, 600);
    };
    clip.addEventListener('ended', done);
    clip.addEventListener('error', done);
    clip.play().catch(done);
  }

  function stopNarratorClip() {
    if (!currentClip) return;
    const c = currentClip;
    currentClip = null;
    try { c.pause(); } catch (e) {}
    narratorSpeaking = false;
    if (typeof floatingPrompt !== 'undefined') floatingPrompt.classList.remove('speaking');
    unduck();
  }

  if (typeof typeFloatingPrompt === 'function' && typeof promptLines !== 'undefined') {
    const origType = typeFloatingPrompt;
    window.typeFloatingPrompt = typeFloatingPrompt = function (line, hasUnlockWord) {
      const idx = promptLines.indexOf(line);
      if (idx >= 0) playNarratorClip(idx + 1);
      return origType.apply(this, arguments);
    };
  }

  // ---------- 2. SYSTEM, the reactive heckler ----------
  let sysVoice = null;
  function pickSysVoice() {
    if (!window.speechSynthesis) return null;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    const en = voices.filter(v => /^en/i.test(v.lang));
    const pref = en.find(v => /google uk english male|daniel|fred|alex|male/i.test(v.name));
    return pref || en[0] || voices[0];
  }
  if (window.speechSynthesis) {
    sysVoice = pickSysVoice();
    speechSynthesis.onvoiceschanged = () => { sysVoice = pickSysVoice(); };
  }

  let sysQueue = [];
  let sysSpeaking = false;
  let lastSysAt = 0;
  const SYS_GAP_MS = 7000; // never heckle more than once every 7s
  let waveTimer = null;
  let hideTimer = null;

  // priority: 2 = must say (deaths, level results), 1 = flavour
  function sys(text, priority = 1) {
    const now = Date.now();
    if (priority < 2 && now - lastSysAt < SYS_GAP_MS) return;
    sysQueue.push({ text, priority, at: now });
    sysQueue.sort((a, b) => b.priority - a.priority);
    if (sysQueue.length > 3) sysQueue.length = 3;
    drainSystemQueue();
  }

  function drainSystemQueue() {
    if (sysSpeaking || narratorSpeaking || !sysQueue.length) return;
    const item = sysQueue.shift();
    if (Date.now() - item.at > 6000) { drainSystemQueue(); return; } // stale
    sysSpeaking = true;
    lastSysAt = Date.now();
    showSysText(item.text);

    const startedAt = Date.now();
    const minShowMs = 1400 + item.text.length * 45; // enough time to read it, even if speech fails
    let finished = false;
    const finish = () => {
      if (finished) return;
      const wait = minShowMs - (Date.now() - startedAt);
      if (wait > 0) { setTimeout(finish, wait); return; }
      finished = true;
      sysSpeaking = false;
      stopWave();
      unduck();
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bar.classList.remove('show'), 1600);
      setTimeout(drainSystemQueue, 900);
    };

    duck();
    startWave();
    if (voiceOn && window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(item.text);
        if (sysVoice) u.voice = sysVoice;
        u.pitch = 0.55;
        u.rate = 1.08;
        u.volume = 1;
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
        // Some browsers never fire onend - don't let SYSTEM get stuck
        setTimeout(finish, 1500 + item.text.length * 75);
      } catch (e) { setTimeout(finish, 1200 + item.text.length * 45); }
    } else {
      setTimeout(finish, 1200 + item.text.length * 45);
    }
  }

  let typeTimer = null;
  function showSysText(text) {
    clearTimeout(hideTimer);
    clearTimeout(typeTimer);
    barText.textContent = '';
    bar.classList.add('show');
    let i = 0;
    (function type() {
      if (i >= text.length) return;
      barText.textContent += text[i++];
      typeTimer = setTimeout(type, 28);
    })();
  }

  function startWave() {
    stopWave();
    waveTimer = setInterval(() => {
      waveBars.forEach(b => { b.style.height = (3 + Math.random() * 15) + 'px'; });
    }, 90);
  }
  function stopWave() {
    clearInterval(waveTimer);
    waveBars.forEach(b => { b.style.height = '4px'; });
  }

  function stopAllVoices() {
    stopNarratorClip();
    if (window.speechSynthesis) speechSynthesis.cancel();
    sysQueue = [];
  }

  // iOS only allows speech after a tap - warm it up on "Begin Exploring"
  const startButton = document.getElementById('start-btn');
  if (startButton && window.speechSynthesis) {
    startButton.addEventListener('click', () => {
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
    }, { once: true });
  }

  // ---------- what SYSTEM knows about you ----------
  const LEVEL_KILLERS = [
    'a basic laser', 'a drifting car', 'a Latin word', 'a slice of bread',
    'a lime', 'frosting', 'a sword', 'pure chaos', 'a coat hanger'
  ];
  const LEVEL_TAUNTS = [
    'This is the tutorial level.',
    'The cars are not even trying.',
    'Cicero would be ashamed.',
    'The toaster is winning.',
    'Outplayed by citrus.',
    'Beaten by a cupcake. Twice.',
    'The knights are laughing at you.',
    'Chaos is undefeated.',
    'Defeated by laundry.'
  ];
  const stats = {
    deathsByLevel: {},
    totalDeaths: 0,
    shots: 0,
    hits: 0,
    levelShots: 0,
    levelHits: 0,
    levelStartedAt: 0,
    memoryFlips: 0,
    memoryMisses: 0,
    lastX: null,
    stillSince: 0,
    edgeSince: 0,
    lastAlive: null,
    pausedAt: 0
  };

  const levelName = i => (typeof levelConfigs !== 'undefined' && levelConfigs[i]) ? levelConfigs[i].name : `level ${i + 1}`;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const secs = ms => Math.round(ms / 1000);

  // Memory game: count attempts and misses
  if (typeof checkForMatch === 'function') {
    const orig = checkForMatch;
    window.checkForMatch = checkForMatch = function () {
      stats.memoryFlips++;
      return orig.apply(this, arguments);
    };
  }
  if (typeof unflipCards === 'function') {
    const orig = unflipCards;
    window.unflipCards = unflipCards = function () {
      stats.memoryMisses++;
      return orig.apply(this, arguments);
    };
  }

  // Shots fired (only counts when a bullet actually leaves the ship)
  if (typeof fireBullet === 'function') {
    const orig = fireBullet;
    window.fireBullet = fireBullet = function () {
      const before = Array.isArray(bullets) ? bullets.length : 0;
      const r = orig.apply(this, arguments);
      const after = Array.isArray(bullets) ? bullets.length : 0;
      if (after > before) { stats.shots++; stats.levelShots++; }
      return r;
    };
  }

  // Level transitions
  let lastLevelStarted = -1;
  if (typeof startLevel === 'function') {
    const orig = startLevel;
    window.startLevel = startLevel = function (levelIndex) {
      const now = Date.now();
      const prev = lastLevelStarted;
      const took = now - stats.levelStartedAt;
      const acc = stats.levelShots ? stats.levelHits / stats.levelShots : 1;
      const r = orig.apply(this, arguments);

      if (levelIndex === 0 && prev === -1) {
        // First time into Space Invaders - comment on the memory game
        if (stats.memoryFlips) {
          const perfect = stats.memoryMisses <= 2;
          sys(perfect
            ? `${stats.memoryFlips} tries for 8 pairs. Suspiciously good memory. Let's see your aim.`
            : `${stats.memoryFlips} tries for 8 pairs. Your memory is worrying. Let's hope your aim is better.`, 2);
        }
      } else if (levelIndex > prev && prev >= 0) {
        // Cleared the previous level
        const cleared = levelName(prev);
        const lines = [];
        if (took < 20000) lines.push(`${cleared} cleared in ${secs(took)} seconds. Show-off.`);
        if (took > 90000) lines.push(`${secs(took)} seconds on ${cleared}. The aliens aged.`);
        if (stats.levelShots >= 10 && acc >= 0.7) lines.push(`${Math.round(acc * 100)} percent accuracy. Who taught you that?`);
        if (stats.levelShots >= 20 && acc < 0.3) lines.push(`${stats.levelShots} shots, ${stats.levelHits} hits. You're spraying, not aiming.`);
        if (!(stats.deathsByLevel[prev] > 0) && prev >= 3) lines.push(`No deaths on ${cleared}. I'm writing that down.`);
        if (levelIndex === 7 && prev < 6) lines.push('Skipping ahead? The game feels sorry for you.');
        if (levelIndex === 7) lines.push('Final level. RANDOMODIUM. I cannot help you here.');
        if (lines.length) sys(pick(lines), 2);
      } else if (levelIndex === 0 && prev >= 0) {
        const tries = (typeof gameState !== 'undefined') ? gameState.attempts : 0;
        if (tries >= 2) sys(pick([
          `Attempt ${tries}. The game is starting to feel bad for you.`,
          `Attempt number ${tries}. Persistence over consistency, right?`,
          `Back again. Attempt ${tries}. The aliens remember you.`
        ]), 2);
      }

      lastLevelStarted = levelIndex;
      stats.levelStartedAt = now;
      stats.levelShots = 0;
      stats.levelHits = 0;
      stats.lastAlive = null;
      return r;
    };
  }

  // Deaths
  if (typeof loseLives === 'function') {
    const orig = loseLives;
    window.loseLives = loseLives = function (n) {
      const before = lives;
      const r = orig.apply(this, arguments);
      if (lives < before) {
        const lvl = currentLevel;
        stats.deathsByLevel[lvl] = (stats.deathsByLevel[lvl] || 0) + (before - lives);
        stats.totalDeaths += before - lives;
        const d = stats.deathsByLevel[lvl];
        if (lives <= 0) {
          sys(pick([
            `Game over. Final cause of death: ${LEVEL_KILLERS[lvl] || 'yourself'}.`,
            `And that's the end. ${levelName(lvl)} got you.`,
            `Dead. On ${levelName(lvl)}. I'll pretend I didn't see that.`
          ]), 2);
        } else if (d >= 2) {
          sys(`That's ${d === 2 ? 'twice' : d + ' times'} on ${levelName(lvl)}. ${LEVEL_TAUNTS[lvl] || ''}`, 2);
        } else if (lives === 1) {
          sys(pick(['One life left. No pressure. Well, some pressure.', 'Last life. Your hands are sweating. I can tell.']), 2);
        } else {
          sys(pick([
            `Killed by ${LEVEL_KILLERS[lvl] || 'something'}. Embarrassing.`,
            `Taken out by ${LEVEL_KILLERS[lvl] || 'something'}. On ${levelName(lvl)}.`,
            `${levelName(lvl)} one, you zero.`
          ]), 2);
        }
      }
      return r;
    };
  }

  // Gambles and messages the game already shows
  if (typeof showInGameMessage === 'function') {
    const orig = showInGameMessage;
    window.showInGameMessage = showInGameMessage = function (text) {
      const r = orig.apply(this, arguments);
      if (/^Rotten (lemon|chocolate)/.test(text)) sys(`You touched the ${RegExp.$1}. Nobody told you to touch the ${RegExp.$1}.`, 2);
      else if (/^Lucky (lemon|chocolate)/.test(text)) sys('Lucky. Do not get used to it.', 1);
      else if (/^controls flipped/i.test(text)) sys('Left is right now. Good luck.', 1);
      return r;
    };
  }

  // Pause / resume
  if (typeof togglePause === 'function') {
    const orig = togglePause;
    window.togglePause = togglePause = function () {
      const wasActive = gameActive;
      const r = orig.apply(this, arguments);
      if (wasActive && !gameActive) {
        stats.pausedAt = Date.now();
        stopAllVoices();
      } else if (!wasActive && gameActive && stats.pausedAt) {
        const away = Date.now() - stats.pausedAt;
        sys(away > 20000
          ? `You left for ${secs(away)} seconds. The aliens waited. Politely.`
          : 'Welcome back. Nothing happened. Probably.', 1);
      }
      return r;
    };
  }

  // Slow-mo unlock should cut whoever is talking
  if (typeof unlockSlowMo === 'function') {
    const orig = unlockSlowMo;
    window.unlockSlowMo = unlockSlowMo = function () {
      stopAllVoices();
      const r = orig.apply(this, arguments);
      setTimeout(() => sys('You found the secret. I did not think anyone would.', 2), 400);
      return r;
    };
  }

  // Watch hits, idling and corner-camping a few times a second
  setInterval(() => {
    if (typeof gameActive === 'undefined' || !gameActive || typeof player === 'undefined' || !player) return;
    const now = Date.now();

    if (Array.isArray(aliens)) {
      const alive = aliens.filter(a => a.alive).length;
      if (stats.lastAlive !== null && alive < stats.lastAlive) {
        const k = stats.lastAlive - alive;
        stats.hits += k;
        stats.levelHits += k;
      }
      stats.lastAlive = alive;
    }

    const x = player.x;
    if (stats.lastX === null || Math.abs(x - stats.lastX) > 2) { stats.stillSince = now; }
    stats.lastX = x;
    if (now - stats.stillSince > 7000) {
      sys(pick([
        `You haven't moved in ${secs(now - stats.stillSince)} seconds. Are you okay?`,
        'Standing still is a strategy. A bad one.',
        'Hello? Blink twice if you need help.'
      ]), 1);
      stats.stillSince = now;
    }

    const w = (typeof canvas !== 'undefined' && canvas.width) || 600;
    const atEdge = x < w * 0.08 || x + (player.width || 30) > w * 0.92;
    if (!atEdge) stats.edgeSince = now;
    if (atEdge && now - stats.edgeSince > 9000) {
      sys(pick(['Hiding in the corner will not save you.', 'The corner is not a safe space.']), 1);
      stats.edgeSince = now;
    }
  }, 300);

  // Let other features (and debugging) use the SYSTEM voice
  window.ntbNarrator = { say: sys, stats, stopAll: stopAllVoices };
})();
