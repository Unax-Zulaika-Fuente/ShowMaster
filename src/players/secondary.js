const { ipcRenderer } = require('electron');

let scheduledTimers = []; // Para guardar los timeouts programados

ipcRenderer.on('load-secondary', (event, timeline) => {
  // Inicia la reproducción secundaria a partir de "ahora"
  const playStart = Date.now();
  // Limpiar cualquier timer previo
  scheduledTimers.forEach(timerId => clearTimeout(timerId));
  scheduledTimers = [];
  
  timeline.forEach(clip => {
    const delay = clip.startTime * 1000; // convertir a milisegundos
    const timerId = setTimeout(() => {
      playClip(clip);
    }, delay);
    scheduledTimers.push(timerId);
  });
});

ipcRenderer.on('stop-secondary', () => {
  scheduledTimers.forEach(timerId => clearTimeout(timerId));
  scheduledTimers = [];
});

// Función para reproducir un clip (se crea un elemento multimedia oculto)
function playClip(clip) {
  // Crear un elemento video (o audio) y reproducirlo
  let mediaEl = document.createElement('video');
  mediaEl.src = clip.file;
  mediaEl.style.display = 'none'; // oculto, ya que no queremos visualización
  document.body.appendChild(mediaEl);
  mediaEl.play();
  // Cuando termine, se elimina del DOM
  mediaEl.addEventListener('ended', () => {
    document.body.removeChild(mediaEl);
  });
}
