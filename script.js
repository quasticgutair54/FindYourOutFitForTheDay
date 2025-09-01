// ✅ Welcome Popup JS
document.addEventListener("DOMContentLoaded", function() {
  const popup = document.getElementById("welcomePopup");
  const closeBtn = document.getElementById("closePopup");

  // Show popup on page load
  popup.style.display = "flex";

  // Close when "x" clicked
  closeBtn.addEventListener("click", () => {
    popup.style.display = "none";
  });

  // Close popup when user clicks any game/personality card
  document.querySelectorAll(".game-card, .personality-card").forEach(card => {
    card.addEventListener("click", () => {
      popup.style.display = "none";
    });
  });
});
// ✅ JS for popup
document.addEventListener("DOMContentLoaded", function() {
  const popup = document.getElementById("welcomePopup");
  const closeBtn = document.getElementById("closePopup");

  popup.style.display = "flex"; // show on load

  closeBtn.addEventListener("click", () => {
    popup.style.display = "none";
  });
});

// ==================== AUDIO SETUP ====================
let hasInteracted = false;

function setupAudio() {
  const audio = document.getElementById('bg-music');
  if (!audio) return;

  const savedTime = localStorage.getItem('music-time');
  if (savedTime) {
    audio.currentTime = parseFloat(savedTime);
  }

  audio.play().catch(() => {
    // Will auto-play after first user interaction
  });

  // Save music time every 500ms
  setInterval(() => {
    if (!audio.paused) {
      localStorage.setItem('music-time', audio.currentTime);
    }
  }, 500);

  // Save when leaving page
  window.addEventListener('beforeunload', () => {
    localStorage.setItem('music-time', audio.currentTime);
  });
}

window.addEventListener('click', () => {
  if (!hasInteracted) {
    hasInteracted = true;
    setupAudio();
  }
});

// ==================== PERSONALITY HANDLING ====================
function choosePersonality(personality) {
  localStorage.setItem('chosenPersonality', personality);
  window.location.href = `questions-${personality}.html`;
}

// ==================== MEMORY GAME ====================
const memoryCards = document.querySelectorAll(".memory-card");
let hasFlippedCard = false;
let lockBoard = false;
let firstCard, secondCard;

function flipCard() {
  if (lockBoard) return;
  if (this === firstCard) return;

  this.classList.add("flip");

  if (!hasFlippedCard) {
    hasFlippedCard = true;
    firstCard = this;
    return;
  }

  secondCard = this;
  checkForMatch();
}

function checkForMatch() {
  let isMatch = firstCard.dataset.framework === secondCard.dataset.framework;
  isMatch ? disableCards() : unflipCards();
}

function disableCards() {
  firstCard.removeEventListener("click", flipCard);
  secondCard.removeEventListener("click", flipCard);
  resetBoard();
}

function unflipCards() {
  lockBoard = true;
  setTimeout(() => {
    firstCard.classList.remove("flip");
    secondCard.classList.remove("flip");
    resetBoard();
  }, 1500);
}

function resetBoard() {
  [hasFlippedCard, lockBoard] = [false, false];
  [firstCard, secondCard] = [null, null];
}

(function shuffle() {
  memoryCards.forEach(card => {
    let randomPos = Math.floor(Math.random() * 12);
    card.style.order = randomPos;
  });
})();

memoryCards.forEach(card => card.addEventListener("click", flipCard));

const levelConfig = {
  1: { name: "NotTheBest OG", enemySpeed: 1, movement: "straight", sprite: "👾" },
  2: { name: "Initial D", enemySpeed: 2, movement: "zigzag", sprite: "🚗" },
  3: { name: "Lorem Ipsum", enemySpeed: 1.5, movement: "random", sprite: "ℒ𝓸𝓻𝓮𝓶" },
  4: { name: "Your Toast", enemySpeed: 2, movement: "straight", sprite: "🍞🔥", bulletType: "toast" },
  5: { name: "Grapefruit x Lime", enemySpeed: 1.2, movement: "straight", sprite: "🍋", blockers: true },
  6: { name: "Cake Was A Lie", enemySpeed: 2.5, movement: "tricky", sprite: "🧁" },
  7: { name: "Berserk", enemySpeed: 4, movement: "rush", sprite: "💢", rapidFire: true },
  8: { 
    name: "RANDOMODIUM", enemySpeed: 3, movement: "chaotic", sprite: "💀", 
    chaosObjects: ["📕","💵","❓","🍩","🕶️","🫧"], 
    chaosEffects: true 
  }
};
function startLevel(levelNumber) {
  const config = levelConfig[levelNumber];
  currentLevel = config;

  // update level title
  document.getElementById("levelTitle").innerText = config.name;

  // spawn enemies with new sprite + behavior
  spawnEnemies(config);
}
function spawnEnemies(config) {
  enemies = [];
  for (let i = 0; i < 10; i++) {
    enemies.push({
      x: i * 50,
      y: 50,
      sprite: config.sprite,
      speed: config.enemySpeed,
      movement: config.movement
    });
  }
}
function updateEnemy(enemy, config) {
  if (config.movement === "zigzag") {
    enemy.x += Math.sin(Date.now() / 200) * 3;
  } else if (config.movement === "random") {
    enemy.x += (Math.random() - 0.5) * enemy.speed;
  } else if (config.movement === "rush") {
    enemy.y += enemy.speed * 2; // berserk style
  } else if (config.movement === "chaotic") {
    enemy.x += (Math.random() - 0.5) * 10;
    enemy.y += (Math.random() - 0.5) * 5;
  }
}
function spawnChaos() {
  if (Math.random() < 0.05) {
    let chaosObj = currentLevel.chaosObjects[
      Math.floor(Math.random() * currentLevel.chaosObjects.length)
    ];
    chaosObjects.push({ sprite: chaosObj, x: Math.random()*canvas.width, y: 0 });
  }
}
function applyChaosEffect(obj) {
  switch(obj.sprite) {
    case "📕": blockBullets(); break;
    case "💵": hideScreen(); break;
    case "❓": shakeScreen(); break;
    case "🍩": spinShield(); break;
    case "🕶️": makeEnemiesInvisible(); break;
    case "🫧": blockShots(); break;
  }
}
function showFinalMessage() {
  document.getElementById("gameOver").innerHTML = 
    "⚠️ <span style='color:red; font-size:24px;'>You weren’t supposed to beat this…</span><br>" +
    "But here you are.<br><b>NotTheBest, but still alive.</b>";
}

