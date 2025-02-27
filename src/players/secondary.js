const { ipcRenderer } = require('electron');

let scheduledTimers = [];

//#region Eventos IPC

// Evento para cargar y reproducir la linea de tiempo secundaria
ipcRenderer.on('load-secondary', (event, timeline) => {
  const playStart = Date.now();
  // Limpiar cualquier temporizador previo
  scheduledTimers.forEach(timerId => clearTimeout(timerId));
  scheduledTimers = [];
  
  // Programar la reproduccion de cada clip en la linea de tiempo
  timeline.forEach(clip => {
    const delay = clip.startTime * 1000; // convertir a milisegundos
    const timerId = setTimeout(() => {
      playClip(clip);
    }, delay);
    scheduledTimers.push(timerId);
  });
});

// Evento para detener la reproduccion secundaria
ipcRenderer.on('stop-secondary', () => {
  scheduledTimers.forEach(timerId => clearTimeout(timerId));
  scheduledTimers = [];
});
//#endregion

//#region Funcion para Reproducir Clips
/**
 * Reproduce un archivo multimedia (video o audio) sin mostrarlo en la UI.
 * @param {Object} clip - Objeto con la información del archivo multimedia.
 */
function playClip(clip) {
  // Crear un elemento de video/audio y configurarlo
  let mediaEl = document.createElement('video');
  mediaEl.src = clip.file;
  mediaEl.style.display = 'none'; // Se oculta el elemento
  document.body.appendChild(mediaEl);
  mediaEl.play();

  // Cuando finaliza, elimina el elemento del DOM
  mediaEl.addEventListener('ended', () => {
    document.body.removeChild(mediaEl);
  });
}
//#endregion
