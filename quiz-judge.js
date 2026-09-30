// ===== THE LIE DETECTOR =====
// Every quiz answer secretly leans toward one of the five personalities.
// On the result page the player holds their thumb on a scanner, a polygraph
// needle replays their five answers, and the machine decides whether the
// path they *picked* matches the person their answers *reveal*.
//
// Loaded on result pages after quiz-common.js. Needs the answers recorded by
// recordQuizAnswer(); if there are none (someone opened a result page
// directly) it quietly does nothing.

const JUDGE_PATHS = {
  allout: {
    name: 'All Out', title: 'an All Out Anomaly', emoji: '💥',
    photo: 'allout.jpeg', color: '#ff2d95', color2: '#ffe600',
    url: 'https://www.notthebestplacetobuystuff.in/randomodium-unisex-sweatshirt',
    page: 'allout-result.html'
  },
  somewhatout: {
    name: 'Somewhat Out', title: 'Somewhat Out', emoji: '🤔',
    photo: 'somewhatout.jpeg', color: '#00e6b8', color2: '#3dff3d',
    url: 'https://www.notthebestplacetobuystuff.in/lorem-ipsum-unisex-hoodie',
    page: 'somewhatout-result.html'
  },
  maybe: {
    name: 'Maybe', title: 'a Maybe Maverick', emoji: '🤷',
    photo: 'maybe.jpeg', color: '#a64dff', color2: '#00fff0',
    url: 'https://www.notthebestplacetobuystuff.in/notthebest-og-tee',
    page: 'maybe-result.html'
  },
  never: {
    name: 'Never', title: 'a Never', emoji: '🚫',
    photo: 'never.jpeg', color: '#bdbdbd', color2: '#ffffff',
    url: 'https://www.notthebestplacetobuystuff.in/notthebest-t-shirt',
    page: 'never-result.html'
  },
  twosides: {
    name: 'Two Sides', title: 'Two Sides of the Same Coin', emoji: '☯️',
    photo: 'twosides.jpeg', color: '#39ff14', color2: '#ffffff',
    url: 'https://www.notthebestplacetobuystuff.in/your-toast-unisex-oversized-tee',
    page: 'twosides-result.html'
  }
};

// Which personality each option (in on-screen order) actually gives away.
// A = allout, S = somewhatout, M = maybe, N = never, T = twosides.
// Most answers on a path point home, but not all - that's how people get caught.
const VIBE_CODES = { A: 'allout', S: 'somewhatout', M: 'maybe', N: 'never', T: 'twosides' };
const ANSWER_VIBES = {
  allout:      [['A','T','S','A'], ['S','M','A','A'], ['S','A','A','T'], ['S','A','T','M'], ['T','A','A','A']],
  maybe:       [['M','N','M','S'], ['S','M','N','M'], ['M','M','S','T'], ['M','N','T','M'], ['A','S','T','N']],
  never:       [['N','N','M','N'], ['N','N','M','T'], ['N','M','S','N'], ['S','M','A','N'], ['N','S','N','N']],
  somewhatout: [['A','S','S','M'], ['N','S','M','S'], ['A','S','S','T'], ['S','A','S','A'], ['S','T','S','A']],
  twosides:    [['T','T','S','A'], ['S','T','A','N'], ['N','T','M','S'], ['M','T','N','A'], ['T','N','M','A']]
};

function vibeOf(pathName, answer) {
  const row = (ANSWER_VIBES[pathName] || [])[answer.q - 1];
  const code = row && row[answer.idx];
  return VIBE_CODES[code] || pathName;
}

// Works out who the player really is from their answers.
// Ties go to the path they picked (benefit of the doubt), then to whichever
// tied personality showed up most recently.
function judgeQuizRun(run) {
  const answers = (run.answers || []).filter(Boolean);
  const vibes = answers.map(a => vibeOf(run.path, a));
  const counts = {};
  vibes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const top = Math.max(...Object.values(counts));
  const tied = Object.keys(counts).filter(k => counts[k] === top);
  let earned = tied.includes(run.path) ? run.path : null;
  if (!earned) {
    for (let i = vibes.length - 1; i >= 0; i--) {
      if (tied.includes(vibes[i])) { earned = vibes[i]; break; }
    }
  }
  const honest = vibes.filter(v => v === run.path).length;
  return { answers, vibes, counts, earned, honest, total: answers.length };
}

function pickLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function verdictCopy(result, chosen) {
  const picked = JUDGE_PATHS[chosen];
  const real = JUDGE_PATHS[result.earned];
  const pct = Math.round((result.honest / result.total) * 100);
  if (result.earned === chosen && result.honest === result.total) {
    return {
      stamp: 'CERTIFIED HONEST', tone: 'honest', pct,
      line: pickLine([
        `Five for five. Suspiciously honest. You really are ${picked.title}.`,
        `Not one lie. The machine is bored. You're ${picked.title}, confirmed.`,
        `Clean scan. Either you're honest or you're very, very good.`
      ])
    };
  }
  if (result.earned === chosen) {
    return {
      stamp: 'MOSTLY HONEST', tone: 'honest', pct,
      line: pickLine([
        `A couple of wobbles, but yes, you're ${picked.title}. We'll allow it.`,
        `The needle twitched ${result.total - result.honest} time${result.total - result.honest === 1 ? '' : 's'}. Still ${picked.title}. Barely.`,
        `You drifted, but you came home. ${picked.name} it is.`
      ])
    };
  }
  return {
    stamp: 'LIAR DETECTED', tone: 'liar', pct,
    line: pickLine([
      `You picked ${picked.name}… but your answers scream ${real.name}.`,
      `Nice try. You clicked ${picked.name}. Your answers belong to ${real.name}.`,
      `${picked.name}? Really? Every needle spike says ${real.name}.`,
      `You walked in wearing ${picked.name}. You're leaving as ${real.name}.`
    ])
  };
}

// Tiny synth so the scanner can beep without shipping more audio files.
let judgeAudioCtx = null;
function judgeBeep(freq, durationMs, type = 'square', volume = 0.05) {
  try {
    judgeAudioCtx = judgeAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = judgeAudioCtx.createOscillator();
    const gain = judgeAudioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.0001, judgeAudioCtx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(judgeAudioCtx.destination);
    osc.start();
    osc.stop(judgeAudioCtx.currentTime + durationMs / 1000);
  } catch (e) {}
}

function judgeVibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== The UI =====
function initLieDetector(chosenPath) {
  const run = typeof readQuizRun === 'function' ? readQuizRun() : null;
  if (!run || run.path !== chosenPath) return;
  const result = judgeQuizRun(run);
  if (result.total < 3) return; // not enough evidence to accuse anyone
  const copy = verdictCopy(result, chosenPath);
  const picked = JUDGE_PATHS[chosenPath];
  const real = JUDGE_PATHS[result.earned];

  const overlay = document.createElement('div');
  overlay.className = 'ld-overlay';
  overlay.innerHTML = `
    <div class="ld-panel" role="dialog" aria-label="Lie detector">
      <div class="ld-header">
        <span class="ld-rec"></span>
        <span>NOTTHEBEST POLYGRAPH v0.99</span>
        <span class="ld-case">CASE #${String(Math.floor(Math.random() * 90000) + 10000)}</span>
      </div>
      <p class="ld-intro">Before we show you anything… let's check if you were honest.</p>
      <div class="ld-paper"><canvas class="ld-canvas"></canvas><div class="ld-stamp"></div></div>
      <div class="ld-chips"></div>
      <div class="ld-scan-zone">
        <button class="ld-pad" aria-label="Hold to scan">
          <svg viewBox="0 0 100 100" class="ld-ring"><circle cx="50" cy="50" r="46"></circle><circle class="ld-ring-fill" cx="50" cy="50" r="46"></circle></svg>
          <svg viewBox="0 0 48 48" class="ld-print" aria-hidden="true">
            <path d="M24 6c-8 0-15 6-15 15"/><path d="M39 21c0-8-7-15-15-15"/>
            <path d="M14 22c0-6 4-10 10-10s10 4 10 10c0 4-1 8-3 11"/>
            <path d="M19 23c0-3 2-5 5-5s5 2 5 5c0 6-2 11-6 15"/>
            <path d="M24 23c0 7-2 13-8 18"/><path d="M9 28c0 5 1 9 3 12"/>
            <path d="M34 36c-1 2-2 4-4 6"/>
          </svg>
        </button>
        <p class="ld-hint">Hold your thumb on the scanner</p>
      </div>
      <div class="ld-verdict" hidden>
        <p class="ld-line"></p>
        <div class="ld-meter"><div class="ld-meter-fill"></div><span class="ld-meter-label"></span></div>
        <div class="ld-cards"></div>
        <div class="ld-actions"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('ld-open');

  const canvas = overlay.querySelector('.ld-canvas');
  const cctx = canvas.getContext('2d');
  const pad = overlay.querySelector('.ld-pad');
  const ringFill = overlay.querySelector('.ld-ring-fill');
  const hint = overlay.querySelector('.ld-hint');
  const chips = overlay.querySelector('.ld-chips');
  const stamp = overlay.querySelector('.ld-stamp');
  const verdict = overlay.querySelector('.ld-verdict');

  // Paper sizing (crisp on retina)
  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', () => { sizeCanvas(); drawPaper(progress); });

  // Pre-compute the needle trace: calm noise, with a spike at each answer.
  // Truthful answers barely twitch; lies throw the needle across the paper.
  const SAMPLES = 400;
  const spikeAt = result.answers.map((a, i) => ({
    pos: (i + 1) / (result.total + 1),
    lie: result.vibes[i] !== chosenPath,
    vibe: result.vibes[i]
  }));
  const trace = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    let y = Math.sin(t * 90) * 0.04 + (Math.random() - 0.5) * 0.06;
    spikeAt.forEach(s => {
      const d = (t - s.pos) * 60;
      const amp = s.lie ? 0.85 : 0.18;
      y += Math.exp(-d * d) * amp * Math.sin(d * 3.2);
    });
    trace.push(Math.max(-0.95, Math.min(0.95, y)));
  }

  function drawPaper(p) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    cctx.clearRect(0, 0, w, h);
    // grid
    cctx.strokeStyle = 'rgba(255, 60, 60, 0.18)';
    cctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 16) { cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, h); cctx.stroke(); }
    for (let y = 0; y <= h; y += 16) { cctx.beginPath(); cctx.moveTo(0, y); cctx.lineTo(w, y); cctx.stroke(); }
    // answer markers already passed
    spikeAt.forEach(s => {
      if (s.pos > p) return;
      const x = s.pos * w;
      cctx.strokeStyle = s.lie ? 'rgba(255, 70, 70, 0.9)' : 'rgba(120, 255, 170, 0.8)';
      cctx.setLineDash([4, 4]);
      cctx.beginPath(); cctx.moveTo(x, 0); cctx.lineTo(x, h); cctx.stroke();
      cctx.setLineDash([]);
    });
    // trace
    const upto = Math.floor(p * (SAMPLES - 1));
    cctx.strokeStyle = '#111';
    cctx.lineWidth = 2;
    cctx.beginPath();
    for (let i = 0; i <= upto; i++) {
      const x = (i / (SAMPLES - 1)) * w;
      const y = h / 2 - trace[i] * (h / 2);
      if (i === 0) cctx.moveTo(x, y); else cctx.lineTo(x, y);
    }
    cctx.stroke();
    // needle
    if (p > 0 && p < 1) {
      const x = (upto / (SAMPLES - 1)) * w;
      const y = h / 2 - trace[upto] * (h / 2);
      cctx.fillStyle = '#e11';
      cctx.beginPath(); cctx.arc(x, y, 4, 0, Math.PI * 2); cctx.fill();
    }
  }

  // ---- hold-to-scan ----
  const SCAN_MS = 3200;
  const CIRC = 2 * Math.PI * 46;
  ringFill.style.strokeDasharray = CIRC;
  ringFill.style.strokeDashoffset = CIRC;
  let progress = 0, holding = false, lastT = 0, done = false, chipsShown = 0;
  drawPaper(0);

  function step(t) {
    if (!holding || done) return;
    const dt = lastT ? t - lastT : 16;
    lastT = t;
    progress = Math.min(1, progress + dt / SCAN_MS);
    ringFill.style.strokeDashoffset = CIRC * (1 - progress);
    drawPaper(progress);
    // light up a chip as the needle passes each answer
    while (chipsShown < spikeAt.length && progress >= spikeAt[chipsShown].pos) {
      addChip(chipsShown);
      chipsShown++;
    }
    if (progress >= 1) { finish(); return; }
    requestAnimationFrame(step);
  }

  function addChip(i) {
    const s = spikeAt[i];
    const p = JUDGE_PATHS[s.vibe];
    const a = result.answers[i];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ld-chip' + (s.lie ? ' lie' : '');
    chip.style.setProperty('--chip', p.color);
    chip.innerHTML = `<span>Q${a.q}</span> ${p.emoji}`;
    chip.title = `"${a.text}" → ${p.name}`;
    chip.addEventListener('click', () => showEvidence(i));
    chips.appendChild(chip);
    if (s.lie) { judgeBeep(180, 220, 'sawtooth', 0.06); judgeVibrate([60, 40, 60]); }
    else { judgeBeep(880, 90, 'sine', 0.04); judgeVibrate(20); }
  }

  function showEvidence(i) {
    const s = spikeAt[i];
    const a = result.answers[i];
    const p = JUDGE_PATHS[s.vibe];
    const old = overlay.querySelector('.ld-evidence');
    if (old) old.remove();
    const ev = document.createElement('div');
    ev.className = 'ld-evidence';
    ev.innerHTML = `<b>Q${a.q}</b> ${escapeHtml(a.question)}<br>You said: <i>"${escapeHtml(a.text)}"</i><br>
      That's ${s.lie ? '<span class="ld-bad">a ' + escapeHtml(p.name) + ' answer</span>' : '<span class="ld-good">pure ' + escapeHtml(p.name) + '</span>'}.`;
    chips.after(ev);
  }

  function startHold(e) {
    if (done) return;
    e.preventDefault();
    holding = true;
    lastT = 0;
    pad.classList.add('holding');
    hint.textContent = 'Scanning… don\'t let go';
    judgeBeep(440, 60, 'square', 0.03);
    requestAnimationFrame(step);
  }

  function endHold() {
    if (!holding || done) return;
    holding = false;
    pad.classList.remove('holding');
    hint.textContent = pickLine([
      'You let go. Liars let go. Hold it again.',
      'Nervous? Hold it down.',
      'The machine noticed that. Try again.'
    ]);
    pad.classList.add('shake');
    setTimeout(() => pad.classList.remove('shake'), 400);
  }

  pad.addEventListener('pointerdown', startHold);
  pad.addEventListener('pointerup', endHold);
  pad.addEventListener('pointerleave', endHold);
  pad.addEventListener('pointercancel', endHold);
  pad.addEventListener('contextmenu', e => e.preventDefault());
  pad.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); });
  pad.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') endHold(); });

  function finish() {
    done = true;
    holding = false;
    pad.classList.remove('holding');
    pad.classList.add('done');
    hint.textContent = 'Scan complete';
    if (typeof noteDossier === 'function') noteDossier({ honesty: copy.pct, earned: result.earned });
    drawPaper(1);

    setTimeout(() => {
      stamp.textContent = copy.stamp;
      stamp.className = 'ld-stamp show ' + copy.tone;
      judgeBeep(copy.tone === 'liar' ? 90 : 520, 400, copy.tone === 'liar' ? 'sawtooth' : 'triangle', 0.08);
      judgeVibrate(copy.tone === 'liar' ? [200, 80, 200] : 80);
      if (copy.tone === 'liar') overlay.classList.add('ld-alarm');
    }, 250);

    setTimeout(() => {
      overlay.querySelector('.ld-scan-zone').hidden = true;
      verdict.hidden = false;
      verdict.querySelector('.ld-line').textContent = copy.line;
      const fill = verdict.querySelector('.ld-meter-fill');
      verdict.querySelector('.ld-meter-label').textContent = `${copy.pct}% honest`;
      requestAnimationFrame(() => { fill.style.width = copy.pct + '%'; });
      buildOutcome();
      verdict.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 1300);
  }

  function card(p, label, extraClass) {
    return `
      <a class="ld-card ${extraClass}" href="${p.url}" target="_blank" rel="noopener" style="--c1:${p.color};--c2:${p.color2}">
        <span class="ld-card-label">${label}</span>
        <span class="ld-card-photo"><img src="${p.photo}" alt=""></span>
        <span class="ld-card-name">${p.emoji} ${p.name}</span>
      </a>`;
  }

  function buildOutcome() {
    const cards = verdict.querySelector('.ld-cards');
    const actions = verdict.querySelector('.ld-actions');
    if (copy.tone === 'liar') {
      cards.innerHTML = card(picked, 'You picked', 'picked') + '<span class="ld-vs">VS</span>' + card(real, 'You actually are', 'real');
      actions.innerHTML = `
        <a class="ld-btn primary" href="${real.page}">Trust the machine → ${real.name}</a>
        <button class="ld-btn" data-act="deny">Stay in denial</button>`;
    } else {
      cards.innerHTML = card(picked, 'Confirmed', 'real solo');
      actions.innerHTML = `<button class="ld-btn primary" data-act="deny">See my result</button>`;
    }
    actions.querySelectorAll('[data-act="deny"]').forEach(b => b.addEventListener('click', closeDetector));
    // "Trust the machine" jumps to the other result page - mark this run as
    // already judged so that page doesn't accuse them all over again.
    const trust = actions.querySelector('a.ld-btn');
    if (trust) trust.addEventListener('click', () => {
      try { sessionStorage.setItem('ntb-judged-redirect', result.earned); } catch (e) {}
    });
  }

  function closeDetector() {
    overlay.classList.add('closing');
    document.body.classList.remove('ld-open');
    setTimeout(() => overlay.remove(), 450);
    // Leave a small badge so they can re-read the verdict
    const badge = document.createElement('button');
    badge.className = 'ld-badge ' + copy.tone;
    badge.innerHTML = `🕵️ ${copy.pct}% honest`;
    badge.addEventListener('click', () => { badge.remove(); initLieDetectorReplay(chosenPath, result, copy); });
    document.body.appendChild(badge);
  }
}

// Re-opening from the badge shows the finished verdict straight away (no rescan).
function initLieDetectorReplay(chosenPath, result, copy) {
  const picked = JUDGE_PATHS[chosenPath];
  const real = JUDGE_PATHS[result.earned];
  const rows = result.answers.map((a, i) => {
    const p = JUDGE_PATHS[result.vibes[i]];
    const lie = result.vibes[i] !== chosenPath;
    return `<li class="${lie ? 'lie' : ''}"><b>Q${a.q}</b> "${escapeHtml(a.text)}" <span style="color:${p.color}">→ ${p.emoji} ${escapeHtml(p.name)}</span></li>`;
  }).join('');
  const overlay = document.createElement('div');
  overlay.className = 'ld-overlay';
  overlay.innerHTML = `
    <div class="ld-panel">
      <div class="ld-header"><span class="ld-rec"></span><span>CASE FILE</span></div>
      <div class="ld-stamp show ${copy.tone} static">${copy.stamp}</div>
      <p class="ld-line">${escapeHtml(copy.line)}</p>
      <ul class="ld-evidence-list">${rows}</ul>
      <div class="ld-actions">
        ${copy.tone === 'liar' ? `<a class="ld-btn primary" href="${real.page}">Go be ${escapeHtml(real.name)}</a>` : ''}
        <button class="ld-btn" data-act="close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const goBtn = overlay.querySelector('a.ld-btn');
  if (goBtn) goBtn.addEventListener('click', () => {
    try { sessionStorage.setItem('ntb-judged-redirect', result.earned); } catch (e) {}
  });
  overlay.querySelector('[data-act="close"]').addEventListener('click', () => {
    overlay.remove();
    const badge = document.createElement('button');
    badge.className = 'ld-badge ' + copy.tone;
    badge.innerHTML = `🕵️ ${copy.pct}% honest`;
    badge.addEventListener('click', () => { badge.remove(); initLieDetectorReplay(chosenPath, result, copy); });
    document.body.appendChild(badge);
  });
}

// Result pages call this. If they arrived here by trusting the machine,
// greet them instead of scanning again.
function initResultJudging(pathName) {
  let redirected = null;
  try { redirected = sessionStorage.getItem('ntb-judged-redirect'); sessionStorage.removeItem('ntb-judged-redirect'); } catch (e) {}
  if (redirected === pathName) {
    const note = document.createElement('div');
    note.className = 'ld-toast';
    note.textContent = pickLine([
      'The machine was right. Welcome home.',
      'Denial is over. This is you now.',
      'Case closed. You belong here.'
    ]);
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 4200);
    return;
  }
  initLieDetector(pathName);
}
