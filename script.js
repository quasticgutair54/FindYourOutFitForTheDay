// Wait for user interaction to play audio
let hasInteracted = false;

function setupAudio() {
  const audio = document.getElementById('bg-music');
  if (!audio) return;

  const savedTime = localStorage.getItem('music-time');
  if (savedTime) {
    audio.currentTime = parseFloat(savedTime);
  }

  audio.play().catch(() => {
    // Will wait until interaction
  });

  // Save current time regularly
  setInterval(() => {
    if (!audio.paused) {
      localStorage.setItem('music-time', audio.currentTime);
    }
  }, 500);

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

