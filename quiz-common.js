// Shared logic for every personality-path quiz page. Each HTML page defines
// a small QUIZ_CONFIG object before loading this script:
//
// const QUIZ_CONFIG = {
//   pathName: 'allout',        // used for the result image lookup (${pathName}.jpeg)
//   questionNumber: 1,         // 1-5, or omit on the result page
//   nextPage: 'allout-q2.html',
//   emoji: '🔥',
//   judgmentLines: [...],      // optional override; falls back to DEFAULT_JUDGMENTS
//   onSelect: (optionEl) => {} // optional extra per-path behaviour on selection
// };

const DEFAULT_JUDGMENTS = [
  "Would Jeff Bezos choose this?",
  "That's a bold choice… or is it?",
  "Yikes. Even your shadow disagrees.",
  "Congrats, you broke the algorithm.",
  "Braver than the Marines.",
  "No cap? Full clown mode.",
  "I met a random guy yesterday who chose better than this.",
  "This option just reported itself.",
  "Your outfit chose violence.",
  "Someone's definitely overcompensating.",
  "How to lose friends and scare strangers 101.",
  "Bold. Questionable. Iconic?",
  "Honestly, that was unexpected.",
  "Your ancestors blinked twice.",
  "This choice just got cancelled.",
  "Can't unsee this now.",
  "Therapist: And how does that make you feel?",
  "Alexa, delete this option.",
  "Somewhere, Tim Gunn just fainted.",
  "Even Crocs have limits."
];

// ===== Audio continuity across page reloads (localStorage-based resume) =====
function setupQuizAudio() {
  const audio = document.getElementById('bg-music');
  if (!audio) return;

  const storedTime = localStorage.getItem('quiz-music-time');
  if (storedTime) audio.currentTime = parseFloat(storedTime);

  const tryPlay = () => audio.play().catch(() => {});
  window.addEventListener('load', tryPlay);

  // If autoplay was blocked, start on the first tap/click instead of staying silent
  const resumeOnInteraction = () => {
    tryPlay();
    document.removeEventListener('click', resumeOnInteraction);
    document.removeEventListener('touchstart', resumeOnInteraction);
  };
  document.addEventListener('click', resumeOnInteraction);
  document.addEventListener('touchstart', resumeOnInteraction);

  setInterval(() => {
    if (!audio.paused) localStorage.setItem('quiz-music-time', audio.currentTime);
  }, 500);
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('quiz-music-time', audio.currentTime);
  });
}

// ===== Progress bar =====
function renderProgressBar(questionNumber) {
  const track = document.createElement('div');
  track.className = 'progress-track';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  track.appendChild(fill);
  document.body.prepend(track);
  requestAnimationFrame(() => {
    fill.style.width = `${(questionNumber / 5) * 100}%`;
  });
}

// ===== Subtle 3D pointer-tilt on option cards =====
function enable3DTilt(optionEls) {
  optionEls.forEach(el => {
    const handleMove = (clientX, clientY) => {
      if (el.classList.contains('selected')) return;
      const rect = el.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width - 0.5;
      const py = (clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `rotateX(${(-py * 10).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) scale(1.02)`;
    };
    el.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
    el.addEventListener('mouseleave', () => {
      if (!el.classList.contains('selected')) el.style.transform = '';
    });
    el.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (t) handleMove(t.clientX, t.clientY);
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (!el.classList.contains('selected')) el.style.transform = '';
    });
  });
}

// ===== Emoji pop / judgment toast / confetti (shared feedback on selection) =====
function showEmojiPop(el, emoji) {
  const pop = document.createElement('div');
  pop.textContent = emoji;
  pop.className = 'emoji-pop';
  const rect = el.getBoundingClientRect();
  pop.style.left = `${rect.left + rect.width / 2}px`;
  pop.style.top = `${rect.top - 30}px`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1000);
}

function showJudgment(lines) {
  const pool = lines && lines.length ? lines : DEFAULT_JUDGMENTS;
  const judgment = document.createElement('div');
  judgment.className = 'judgment';
  judgment.textContent = pool[Math.floor(Math.random() * pool.length)];
  judgment.style.left = `${Math.random() * 70 + 10}%`;
  judgment.style.top = `${Math.random() * 60 + 10}%`;
  document.body.appendChild(judgment);
  setTimeout(() => judgment.remove(), 3000);
}

function launchConfetti(count = 10) {
  for (let i = 0; i < count; i++) {
    const conf = document.createElement('div');
    conf.textContent = '✨';
    conf.style.position = 'fixed';
    conf.style.left = Math.random() * window.innerWidth + 'px';
    conf.style.top = '-20px';
    conf.style.fontSize = '1.2rem';
    conf.style.opacity = '0.85';
    conf.style.zIndex = '150';
    conf.style.animation = `confetti-fall ${Math.random() * 2 + 2}s ease-out forwards`;
    document.body.appendChild(conf);
    conf.addEventListener('animationend', () => conf.remove());
  }
}

function screenShake(intensityPx, durationMs) {
  document.body.style.setProperty('--shake-amt', `${intensityPx}px`);
  document.body.style.setProperty('--shake-duration', `${durationMs}ms`);
  document.body.classList.remove('shake-hit');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add('shake-hit');
  setTimeout(() => document.body.classList.remove('shake-hit'), durationMs);
}

// Somewhat Out's cool, restrained counterpart to screenShake - a brief icy
// glow wash across the screen instead of a violent jolt
function frostPulse(durationMs) {
  const pulse = document.createElement('div');
  pulse.className = 'frost-pulse';
  pulse.style.animationDuration = `${durationMs}ms`;
  document.body.appendChild(pulse);
  setTimeout(() => pulse.remove(), durationMs);
}

// Maybe's hesitant counterpart to screenShake/frostPulse - a brief unsure
// rock side to side, like shaking your head "maybe... maybe not"
function indecisionWobble(durationMs) {
  document.body.style.setProperty('--wobble-duration', `${durationMs}ms`);
  document.body.classList.remove('wobble-hit');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add('wobble-hit');
  setTimeout(() => document.body.classList.remove('wobble-hit'), durationMs);
}

// Never's deadpan counterpart to screenShake/frostPulse/indecisionWobble -
// a brief bored flicker, like the screen itself can't be bothered to react
function boredomFlicker(durationMs) {
  document.body.style.setProperty('--flicker-duration', `${durationMs}ms`);
  document.body.classList.remove('mono-flicker');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add('mono-flicker');
  setTimeout(() => document.body.classList.remove('mono-flicker'), durationMs);
}

// Two Sides' duality counterpart to screenShake/frostPulse/indecisionWobble/
// boredomFlicker - two halves sweep across and settle into balance
function balanceFlash(durationMs) {
  const flash = document.createElement('div');
  flash.className = 'balance-flash';
  flash.style.animationDuration = `${durationMs}ms`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), durationMs);
}

// ===== Wires up a question page =====
function initQuizQuestion(config) {
  setupQuizAudio();
  if (config.questionNumber) renderProgressBar(config.questionNumber);

  const options = Array.from(document.querySelectorAll('.option'));
  const nextBtn = document.getElementById('nextBtn');
  enable3DTilt(options);

  options.forEach(option => {
    option.addEventListener('click', () => {
      options.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      option.style.transform = '';

      showEmojiPop(option, config.emoji || '✨');
      showJudgment(config.judgmentLines);
      launchConfetti(config.confettiCount ?? 10);
      if (nextBtn) nextBtn.style.display = 'inline-block';
      if (typeof config.onSelect === 'function') config.onSelect(option);
    });
  });

  if (nextBtn && config.nextPage) {
    nextBtn.addEventListener('click', () => {
      window.location.href = config.nextPage;
    });
  }
}

// ===== Subtle 3D tilt on the floating outfit-photo card (mouse or device
// tilt) - this only ever touches the separate photo element, never the
// page's core background =====
function enablePhotoCardTilt(cardEl) {
  if (!cardEl) return;
  const move = (px, py) => {
    cardEl.style.transform = `rotateX(${(-py * 14).toFixed(2)}deg) rotateY(${(px * 14).toFixed(2)}deg)`;
  };
  window.addEventListener('mousemove', e => {
    move(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
  });
  window.addEventListener('deviceorientation', e => {
    if (e.gamma === null) return;
    move(Math.max(-0.5, Math.min(0.5, e.gamma / 45)), Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 45)));
  });
}

// ===== Gentle ambient sparkles drifting over the result photo =====
function startAmbientSparkles(emoji) {
  setInterval(() => {
    const s = document.createElement('div');
    s.className = 'ambient-sparkle';
    s.textContent = emoji || '✨';
    s.style.left = `${Math.random() * 100}%`;
    s.style.fontSize = `${0.8 + Math.random() * 1}rem`;
    s.style.animationDuration = `${8 + Math.random() * 6}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 15000);
  }, 1400);
}

// ===== Wires up a result page =====
function initQuizResult(config) {
  setupQuizAudio();
  const photoCard = document.querySelector('.reveal-photo-frame');
  if (photoCard) enablePhotoCardTilt(photoCard);
  startAmbientSparkles(config.emoji);
}
