// players/playback.js
const { ipcRenderer } = require('electron');

let videoElement = document.getElementById('videoPlayer');
let imageViewer  = document.getElementById('imageViewer');
let isPaused     = false;

// Extensiones válidas de imagen
const imageExtensions = ['png','jpg','jpeg','gif','bmp','webp'];

ipcRenderer.on('load-video', (event, mediaPath) => {
  const ext = mediaPath.split('.').pop().toLowerCase();
  if (imageExtensions.includes(ext)) {
    // Mostrar imagen
    videoElement.pause();
    videoElement.style.display = 'none';
    imageViewer.src = mediaPath;
    imageViewer.style.display = 'block';
  } else {
    // Reproducir video
    imageViewer.style.display = 'none';
    videoElement.style.display = 'block';
    videoElement.src = mediaPath;
    videoElement.load();
    videoElement.play();
  }
});

ipcRenderer.on('pause-video', () => {
  if (videoElement.style.display === 'block') videoElement.pause();
  isPaused = true;
});

ipcRenderer.on('resume-video', () => {
  if (videoElement.style.display === 'block' && isPaused) {
    videoElement.play();
    isPaused = false;
  }
});

ipcRenderer.on('load-video-preview', (event, mediaPath) => {
  const ext = mediaPath.split('.').pop().toLowerCase();
  if (imageExtensions.includes(ext)) {
    videoElement.pause();
    videoElement.style.display = 'none';
    imageViewer.src = mediaPath;
    imageViewer.style.display = 'block';
  } else {
    imageViewer.style.display = 'none';
    videoElement.style.display = 'block';
    videoElement.src = mediaPath;
    videoElement.load();
    videoElement.pause();
    videoElement.currentTime = 0;
  }
});

ipcRenderer.on('seek-video', (event, newTime) => {
  if (videoElement.style.display === 'block') {
    videoElement.currentTime = newTime;
  }
});

ipcRenderer.on('set-main-volume', (event, volume) => {
  videoElement.volume = volume;
});

ipcRenderer.on('finalize-video', () => {
  // Limpiar video e imagen
  videoElement.pause();
  videoElement.src = '';
  imageViewer.src = '';
  imageViewer.style.display = 'none';
});

videoElement.addEventListener('timeupdate', () => {
  ipcRenderer.send('time-update', videoElement.currentTime, videoElement.duration);
});

videoElement.addEventListener('ended', () => {
  ipcRenderer.send('video-ended');
});
