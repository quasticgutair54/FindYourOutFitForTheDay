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

// ==================== SPACE INVADERS (DUMMY PLACEHOLDER) ====================
// Your actual game logic will come here
