const { ipcRenderer } = require('electron');

let videoElement = document.getElementById('videoPlayer');
let isPaused = false;

//#region 🔄 Eventos del reproductor
ipcRenderer.on('load-video', (event, videoPath) => {
  videoElement.src = videoPath;
  videoElement.play();
});

ipcRenderer.on('pause-video', () => {
  videoElement.pause();
  isPaused = true;
});

ipcRenderer.on('resume-video', () => {
  if (isPaused) {
    videoElement.play();
    isPaused = false;
  }
});

ipcRenderer.on('seek-video', (event, newTime) => {
  videoElement.currentTime = newTime;
});

ipcRenderer.on('set-main-volume', (event, volume) => {
  videoElement.volume = volume;
});
//#endregion

//#region 📡 Emitir eventos de progreso
videoElement.addEventListener('timeupdate', () => {
  ipcRenderer.send('time-update', videoElement.currentTime, videoElement.duration);
});

videoElement.addEventListener('ended', () => {
  ipcRenderer.send('video-ended');
});
//#endregion
