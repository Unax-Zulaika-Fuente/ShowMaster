// players/playback.js
const { ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

let videoElement = document.getElementById('videoPlayer');
let imageViewer  = document.getElementById('imageViewer');
let overlayDiv   = document.getElementById('overlay');
let isPaused     = false;
let overlaySettings = { color: null, image: null };

ipcRenderer.on('set-overlay', (event, settings) => {
  // Actualiza ajustes de overlay (color o imagen)
  overlaySettings = settings;
});

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
    // Asegurarnos de no mostrar overlay sobre imágenes
    overlayDiv.style.display = 'none';
  } else {
    // Reproducir video
    imageViewer.style.display = 'none';
    videoElement.style.display = 'block';
    videoElement.src = mediaPath;
    videoElement.load();
    videoElement.play();
    // Ocultar overlay al arrancar
    overlayDiv.style.display = 'none';
  }
});

ipcRenderer.on("pause-video", () => {
  if (videoElement.style.display === "block") {
    videoElement.pause();
    // Mostrar overlay completo al pausar
    overlayDiv.style.display = "block";
    if (overlaySettings.image) {
        // convertir ruta de archivo a URL válida
        const imgUrl = pathToFileURL(overlaySettings.image).href;
        overlayDiv.style.backgroundImage   = `url("${imgUrl}")`;
        overlayDiv.style.backgroundColor   = "transparent";
      } else if (overlaySettings.color) {
        overlayDiv.style.backgroundImage   = "";
        overlayDiv.style.backgroundColor   = overlaySettings.color;
      }
    overlayDiv.style.opacity = "1"; // siempre opacidad total
  }
  isPaused = true;
});

ipcRenderer.on('resume-video', () => {
    if (videoElement.style.display === "block" && isPaused) {
      videoElement.play();
      // Ocultar overlay al reanudar
      overlayDiv.style.display = "none";
      isPaused = false;
    }
});

ipcRenderer.on("load-video-preview", (event, mediaPath) => {
  const ext = mediaPath.split(".").pop().toLowerCase();
  if (imageExtensions.includes(ext)) {
    // Muestra imagen y oculta overlay
    videoElement.pause();
    videoElement.style.display = "none";
    imageViewer.src = mediaPath;
    imageViewer.style.display = "block";
    overlayDiv.style.display = "none";
  } else {
    // Previsualiza vídeo en pausa y aplica overlay
    imageViewer.style.display = "none";
    videoElement.style.display = "block";
    videoElement.src = mediaPath;
    videoElement.load();
    videoElement.pause();
    videoElement.currentTime = 0;

    // Mostrar overlay en preview
    overlayDiv.style.display = "block";
    if (overlaySettings.image) {
      const imgUrl = pathToFileURL(overlaySettings.image).href;
      overlayDiv.style.backgroundImage = `url("${imgUrl}")`;
      overlayDiv.style.backgroundColor = "transparent";
    } else if (overlaySettings.color) {
      overlayDiv.style.backgroundImage = "";
      overlayDiv.style.backgroundColor = overlaySettings.color;
    }
    overlayDiv.style.opacity = "1";
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

ipcRenderer.on("finalize-video", () => {
  // Limpiar video, imagen y overlay
  videoElement.pause();
  videoElement.src = "";
  imageViewer.src = "";
  imageViewer.style.display = "none";
  overlayDiv.style.display = "none";
});

videoElement.addEventListener('timeupdate', () => {
  ipcRenderer.send('time-update', videoElement.currentTime, videoElement.duration);
});

videoElement.addEventListener('ended', () => {
  ipcRenderer.send('video-ended');
});
