// players/playback.js
const { ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

let videoElement = document.getElementById('videoPlayer');
let imageViewer  = document.getElementById('imageViewer');
let overlayDiv   = document.getElementById('overlay');
let isPaused     = false;
let overlaySettings = { type: null, color: null, image: null };

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
    overlayDiv.style.opacity = "1"; // siempre opacidad total
  }
  isPaused = true;

  applyOverlay();
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

    overlayDiv.style.opacity = "1";
    applyOverlay();
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

function applyOverlay() {
  const o = overlaySettings;
  // Si pedimos imagen pero no hay ruta → nada
  if (o.type === "image") {
    if (o.image) {
      overlayDiv.style.backgroundImage = `url("${pathToFileURL(o.image).href}")`;
      overlayDiv.style.backgroundColor = "transparent";
      overlayDiv.style.display = "block";
    } else {
      overlayDiv.style.display = "none";
    }
    return;
  }
  // Si pedimos color pero no hay color → nada
  if (o.type === "color") {
    if (o.color) {
      overlayDiv.style.backgroundImage = "";
      overlayDiv.style.backgroundColor = o.color;
      overlayDiv.style.display = "block";
    } else {
      overlayDiv.style.display = "none";
    }
    return;
  }
  // fallback: ocultamos
  overlayDiv.style.display = "none";
}