// En playback.js
const { ipcRenderer } = require('electron');
const videoPlayer = document.getElementById('videoPlayer');

ipcRenderer.on('load-video', (event, videoPath) => {
  videoPlayer.src = videoPath;
  videoPlayer.play();
});

ipcRenderer.on('pause-video', () => {
  videoPlayer.pause();
});

ipcRenderer.on('resume-video', () => {
  videoPlayer.play();
});

ipcRenderer.on('seek-video', (event, newTime) => {
  videoPlayer.currentTime = newTime;
});

videoPlayer.addEventListener('timeupdate', () => {
  ipcRenderer.send('time-update', videoPlayer.currentTime, videoPlayer.duration);
});

videoPlayer.addEventListener('ended', () => {
  ipcRenderer.send('video-ended');
});

// Listener para ajustar el volumen principal
ipcRenderer.on('set-main-volume', (event, volume) => {
  videoPlayer.volume = volume;
});
