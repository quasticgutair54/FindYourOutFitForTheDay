// ===== TWO SIDES: SPLIT-SCREEN QUIZ =====
// On the Two Sides path every question is answered twice, once for each half
// of you:  ☀️ THE ONE YOU SHOW  |  🌙 THE ONE YOU HIDE
// A ☯️ seam splits the screen; drag it (or tap a side) to give either half
// more room. The result page then splits your outfit photo down the middle
// with a slider, and reads out who your front and your back really are.
//
// Needs quiz-common.js (and quiz-judge.js on the result page).

function initTwoSidesQuestion(config) {
  setupQuizAudio(config.questionNumber === 1);
  if (config.questionNumber) renderProgressBar(config.questionNumber);
  if (config.questionNumber === 1) resetQuizRun(config.pathName);

  const optionsEl = document.querySelector('.options');
  const nextBtn = document.getElementById('nextBtn');
  const texts = Array.from(optionsEl.querySelectorAll('.option')).map(o => o.textContent.trim());

  const split = document.createElement('div');
  split.className = 'ts-split';
  split.innerHTML = `
    <section class="ts-side ts-show" data-side="show">
      <header><span>☀️</span> The one you show</header>
      <div class="ts-opts"></div>
    </section>
    <div class="ts-seam" role="slider" tabindex="0" aria-label="Drag to resize your two sides" aria-valuemin="28" aria-valuemax="72" aria-valuenow="50">
      <span class="ts-knob">☯️</span>
      <span class="ts-verdict"></span>
    </div>
    <section class="ts-side ts-hide" data-side="hide">
      <header><span>🌙</span> The one you hide</header>
      <div class="ts-opts"></div>
    </section>`;
  optionsEl.replaceWith(split);

  const picks = { show: null, hide: null };
  const verdict = split.querySelector('.ts-verdict');
  let ratio = 50;

  function setRatio(v, animate) {
    ratio = Math.max(28, Math.min(72, v));
    split.classList.toggle('ts-animate', !!animate);
    split.style.setProperty('--ts-left', ratio + '%');
    split.querySelector('.ts-seam').setAttribute('aria-valuenow', Math.round(ratio));
  }
  setRatio(50);

  ['show', 'hide'].forEach(side => {
    const box = split.querySelector(`.ts-${side} .ts-opts`);
    texts.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option ts-opt';
      b.textContent = t;
      b.style.animationDelay = `${0.3 + i * 0.08 + (side === 'hide' ? 0.15 : 0)}s`;
      b.addEventListener('click', e => {
        e.stopPropagation();
        box.querySelectorAll('.ts-opt').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        picks[side] = i;
        showEmojiPop(b, side === 'show' ? '☀️' : '🌙');
        showJudgment(config.judgmentLines);
        balanceFlash(600);
        // nudge focus to the half that still needs an answer
        if (picks.show === null) setRatio(64, true);
        else if (picks.hide === null) setRatio(36, true);
        else settle();
      });
      box.appendChild(b);
    });
    // tapping a half (not an option) gives it the room
    split.querySelector(`.ts-${side}`).addEventListener('click', () => setRatio(side === 'show' ? 64 : 36, true));
  });

  function settle() {
    setRatio(50, true);
    const same = picks.show === picks.hide;
    const lines = same
      ? ['Consistent. Suspicious.', 'Same answer both sides. Liar or saint?', 'No hidden side? Sure.']
      : ['Two-faced. Iconic.', 'The mask slipped.', 'Your sides are not speaking.'];
    verdict.textContent = lines[Math.floor(Math.random() * lines.length)];
    split.classList.toggle('ts-same', same);
    split.classList.add('ts-done');
    verdict.classList.remove('pop'); void verdict.offsetWidth; verdict.classList.add('pop');
    recordQuizAnswer(config.pathName, config.questionNumber, picks.show, texts[picks.show]);
    const run = readQuizRun();
    if (run && run.answers[config.questionNumber - 1]) {
      Object.assign(run.answers[config.questionNumber - 1], { hidden: picks.hide, hiddenText: texts[picks.hide] });
      writeQuizRun(run);
    }
    if (nextBtn) nextBtn.style.display = 'inline-block';
    launchConfetti(config.confettiCount ?? 10);
  }

  // Dragging the seam
  const seam = split.querySelector('.ts-seam');
  let dragging = false;
  const fromEvent = e => {
    const r = split.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  seam.addEventListener('pointerdown', e => { dragging = true; seam.setPointerCapture(e.pointerId); split.classList.add('ts-dragging'); e.stopPropagation(); });
  seam.addEventListener('pointermove', e => { if (dragging) setRatio(fromEvent(e), false); });
  const end = () => { dragging = false; split.classList.remove('ts-dragging'); };
  seam.addEventListener('pointerup', end);
  seam.addEventListener('pointercancel', end);
  seam.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') setRatio(ratio - 4, true);
    if (e.key === 'ArrowRight') setRatio(ratio + 4, true);
  });

  if (nextBtn && config.nextPage) {
    nextBtn.addEventListener('click', () => { window.location.href = config.nextPage; });
  }
}

// ===== Result page: the split reveal =====
function initTwoSidesResult() {
  const frame = document.querySelector('.reveal-photo-frame');
  const img = frame && frame.querySelector('img');
  if (frame && img) {
    const dark = img.cloneNode();
    dark.className = 'ts-dark-img';
    dark.alt = '';
    frame.appendChild(dark);
    frame.classList.add('ts-reveal');
    frame.insertAdjacentHTML('beforeend',
      '<span class="ts-tag ts-tag-l">SHOW</span><span class="ts-tag ts-tag-r">HIDE</span><span class="ts-handle" aria-hidden="true"><i>☯️</i></span>');
    let pos = 50, auto = true;
    const set = v => { pos = Math.max(0, Math.min(100, v)); frame.style.setProperty('--ts-cut', pos + '%'); };
    set(50);
    // idle "breathing" until the player grabs it
    const t0 = performance.now();
    (function breathe(t) {
      if (!auto) return;
      set(50 + Math.sin((t - t0) / 900) * 18);
      requestAnimationFrame(breathe);
    })(t0);
    const fromEvent = e => { const r = frame.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
    let drag = false;
    frame.addEventListener('pointerdown', e => { auto = false; drag = true; frame.setPointerCapture(e.pointerId); set(fromEvent(e)); });
    frame.addEventListener('pointermove', e => { if (drag) set(fromEvent(e)); });
    frame.addEventListener('pointerup', () => { drag = false; });
    frame.addEventListener('pointercancel', () => { drag = false; });
  }

  // Front vs back read-out, using the lie detector's answer map
  const run = typeof readQuizRun === 'function' ? readQuizRun() : null;
  if (!run || run.path !== 'twosides' || typeof ANSWER_VIBES === 'undefined') return;
  const answers = (run.answers || []).filter(a => a && a.hidden !== undefined);
  if (answers.length < 3) return;
  const vibeFor = idx => (q) => VIBE_CODES[(ANSWER_VIBES.twosides[q.q - 1] || [])[idx(q)]] || 'twosides';
  const tally = list => {
    const c = {};
    list.forEach(v => { c[v] = (c[v] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a] || (b === 'twosides') - (a === 'twosides'))[0];
  };
  const front = tally(answers.map(vibeFor(a => a.idx)));
  const back = tally(answers.map(vibeFor(a => a.hidden)));
  const agreed = answers.filter(a => a.idx === a.hidden).length;
  const gap = Math.round(((answers.length - agreed) / answers.length) * 100);
  const F = JUDGE_PATHS[front], B = JUDGE_PATHS[back];
  const line = front === back
    ? `Front and back match. You're ${F.name} all the way through. Either very honest, or very good at this.`
    : `You show ${F.name}. You hide ${B.name}. That's the whole coin.`;

  const report = document.createElement('div');
  report.className = 'ts-report';
  report.innerHTML = `
    <button type="button" class="ts-coin" aria-label="Flip the coin">
      <span class="ts-coin-inner">
        <span class="ts-face ts-face-front" style="--c:${F.color}"><small>FRONT</small><b>${F.emoji}</b><span>${F.name}</span></span>
        <span class="ts-face ts-face-back" style="--c:${B.color}"><small>BACK</small><b>${B.emoji}</b><span>${B.name}</span></span>
      </span>
    </button>
    <p class="ts-line">${line}</p>
    <div class="ts-stats"><span><b>${agreed}/${answers.length}</b> answers agreed</span><span><b>${gap}%</b> gap between your sides</span></div>
    <div class="ts-links">
      <a href="${F.url}" target="_blank" rel="noopener">☀️ Front outfit</a>
      ${front !== back ? `<a href="${B.url}" target="_blank" rel="noopener">🌙 Back outfit</a>` : ''}
    </div>`;
  const box = document.querySelector('.result-box');
  const certified = box && box.querySelector('.certified');
  if (certified) certified.before(report); else if (box) box.appendChild(report);

  const coin = report.querySelector('.ts-coin');
  coin.addEventListener('click', () => coin.classList.toggle('flipped'));
  setTimeout(() => coin.classList.add('spin-in'), 50);
}
