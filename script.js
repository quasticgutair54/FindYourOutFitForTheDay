// Save playback position
const audio = document.getElementById("bg-music");

window.addEventListener("load", () => {
  const lastTime = localStorage.getItem("musicTime");
  if (lastTime) audio.currentTime = parseFloat(lastTime);
  audio.play();
});

window.addEventListener("beforeunload", () => {
  localStorage.setItem("musicTime", audio.currentTime);
});
