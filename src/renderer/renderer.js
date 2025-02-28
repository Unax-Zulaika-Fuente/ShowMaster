const { ipcRenderer } = require('electron');

let primaryLibrary = [];         // Archivos de la secuencia principal
let secondaryLibrary = [];       // Archivos de la secuencia secundaria
let currentIndex = 0;            // Indice del archivo activo en la secuencia principal
let isPlaying = false;           // Estado de reproducción principal (play/pausa)
let videoStarted = false;        // Indica si el video ya inicio alguna vez
let currentPlayingIndex = null;  // Indice del archivo que se esta reproduciendo actualmente
let videoFinished = false;       // Flag que indica si el video/sonido ha finalizado

//#region 🔁 Variables para Doble Clic
const DOUBLE_CLICK_DELAY = 250; // ms para detectar doble clic
let startButtonClickTimeout = null;
let nextButtonClickTimeout = null;
//#endregion

//#region 🎛️ Elementos de la Interfaz (DOM)
const sequenceList = document.getElementById('sequenceList');
const secondaryMediaList = document.getElementById('secondaryMediaList');

const newProjectBtn = document.getElementById('newProject');
const loadProjectBtn = document.getElementById('loadProject');
const saveProjectBtn = document.getElementById('saveProject');
const addFilesBtn = document.getElementById('addFiles');
const removeSelectedBtn = document.getElementById('removeSelected');

// Botones de reproduccion
const togglePlayBtn = document.getElementById('togglePlay');
const nextBtn = document.getElementById('next');
const finalizeBtn = document.getElementById('finalize');

// Sliders de tiempo y display
const timeSlider = document.getElementById('timeSlider');
const timeDisplay = document.getElementById('timeDisplay');
const secondaryTimeSlider = document.getElementById('secondaryTimeSlider');
const secondaryTimeDisplay = document.getElementById('secondaryTimeDisplay');

// Controles de volumen
const mainVolumeSlider = document.getElementById('mainVolumeSlider');
const secondaryVolumeSlider = document.getElementById('secondaryVolumeSlider');

// Botones y variables para la secuencia secundaria
const addFilesSecondaryBtn = document.getElementById('addFilesSecondary');
const removeSecondarySelectedBtn = document.getElementById('removeSecondarySelected');
const playSecondaryBtn = document.getElementById('playSecondary');
const stopSecondaryBtn = document.getElementById('stopSecondary');

// Archivo seleccionado en la secuencia secundaria
let selectedSecondaryFile = null;
let secondaryAudio = null;
//#endregion

console.log('RENDERER.js');

//#region ⏲️ Funcion de Formateo de Tiempo
/**
 * Convierte segundos en formato hh:mm:ss o mm:ss.
 * @param {number} seconds - Segundos totales.
 * @returns {string} - Tiempo formateado.
 */
function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  } else {
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
//#endregion

//#region 📋 Renderizado de la Secuencia Principal
/**
 * Muestra la lista de archivos en la secuencia principal, con posibilidad de arrastrar/soltar para reordenar.
 */
function renderMainSequence() {
  sequenceList.innerHTML = '';
  primaryLibrary.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.split(/(\\|\/)/g).pop();
    li.dataset.index = index;
    li.draggable = true;

    // Resaltar el elemento si es el actual
    li.style.backgroundColor = (index === currentIndex) ? '#99ff99' : '';

    // Contenedor para los botones de flecha
    const arrowContainer = document.createElement('div');
    arrowContainer.className = 'arrow-buttons';

    // Solo agregar la flecha hacia arriba si no es el primer elemento
    if (index > 0) {
      const upButton = document.createElement('button');
      upButton.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      upButton.title = "Mover arriba";
      upButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que se active el clic del li
        // Intercambiar el elemento actual con el anterior
        [primaryLibrary[index - 1], primaryLibrary[index]] = [primaryLibrary[index], primaryLibrary[index - 1]];
        // Actualizar currentIndex si es necesario
        if (currentIndex === index) {
          currentIndex = index - 1;
        } else if (currentIndex === index - 1) {
          currentIndex = index;
        }
        updateLibraryUI();
      });
      arrowContainer.appendChild(upButton);
    }

    // Solo agregar la flecha hacia abajo si no es el último elemento
    if (index < primaryLibrary.length - 1) {
      const downButton = document.createElement('button');
      downButton.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
      downButton.title = "Mover abajo";
      downButton.addEventListener('click', (e) => {
        e.stopPropagation();
        // Intercambiar el elemento actual con el siguiente
        [primaryLibrary[index], primaryLibrary[index + 1]] = [primaryLibrary[index + 1], primaryLibrary[index]];
        if (currentIndex === index) {
          currentIndex = index + 1;
        } else if (currentIndex === index + 1) {
          currentIndex = index;
        }
        updateLibraryUI();
      });
      arrowContainer.appendChild(downButton);
    }

    li.appendChild(arrowContainer);

    // Drag & Drop
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
      if (draggedIndex === index) return;

      const [movedItem] = primaryLibrary.splice(draggedIndex, 1);
      primaryLibrary.splice(index, 0, movedItem);

      // Ajustar el currentIndex si es necesario
      if (currentIndex === draggedIndex) {
        currentIndex = index;
      } else if (draggedIndex < currentIndex && index >= currentIndex) {
        currentIndex--;
      } else if (draggedIndex > currentIndex && index <= currentIndex) {
        currentIndex++;
      }
      updateLibraryUI();
    });

    // Al hacer clic, seleccionar este archivo
    li.addEventListener('click', () => {
      currentIndex = index;
      renderMainSequence();
    });

    sequenceList.appendChild(li);
  });
}
//#endregion

//#region 📋 Renderizado de la Secuencia Secundaria
/**
 * Muestra la lista de archivos en la secuencia secundaria (efectos de sonido).
 */
function renderSecondaryMedia() {
  secondaryMediaList.innerHTML = '';
  secondaryLibrary.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.split(/(\\|\/)/g).pop();
    li.dataset.filePath = item;
    li.dataset.index = index;
    li.style.backgroundColor = (selectedSecondaryFile === item) ? '#99ff99' : '';

    // Al hacer clic, marcar este archivo como seleccionado
    li.addEventListener('click', () => {
      selectedSecondaryFile = item;
      const allItems = secondaryMediaList.querySelectorAll('li');
      allItems.forEach(el => el.style.backgroundColor = '');
      li.style.backgroundColor = '#99ff99';
    });

    secondaryMediaList.appendChild(li);
  });
}
//#endregion

//#region 🔄 Actualización de la UI
/**
 * Actualiza la lista de la secuencia principal y secundaria.
 */
function updateLibraryUI() {
  renderMainSequence();
  renderSecondaryMedia();
}
//#endregion

//#region 📂 Manejo de Proyectos
newProjectBtn.addEventListener('click', async () => {
  // Mostrar cuadro de confirmacion para nuevo proyecto
  const response = await ipcRenderer.invoke('confirm-new-project');
  if (response === 0) {
    // Guardar y Nuevo
    const projectData = {
      primaryLibrary: primaryLibrary,
      secondaryLibrary: secondaryLibrary
    };
    const result = await ipcRenderer.invoke('save-sequence', projectData);
    if (result.success) {
      alert('Proyecto guardado. Se creará un nuevo proyecto.');
      resetProject();
    } else {
      alert('Error al guardar el proyecto.');
    }
  } else if (response === 1) {
    // Nuevo sin guardar
    resetProject();
  }
  // response === 2 => Cancelar, no se hace nada
});

/**
 * Restablece la lista de archivos (proyecto en blanco).
 */
function resetProject() {
  primaryLibrary = [];
  secondaryLibrary = [];
  currentIndex = 0;
  selectedSecondaryFile = null;
  isPlaying = false;
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  updateLibraryUI();
}

loadProjectBtn.addEventListener('click', async () => {
  // Cargar proyecto desde un archivo JSON
  const loadedProject = await ipcRenderer.invoke('load-sequence');
  if (loadedProject && typeof loadedProject === 'object') {
    primaryLibrary = loadedProject.primaryLibrary || [];
    secondaryLibrary = loadedProject.secondaryLibrary || [];
    currentIndex = 0;
    isPlaying = false;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    updateLibraryUI();
  }
});

saveProjectBtn.addEventListener('click', async () => {
  // Guardar el proyecto actual
  const projectData = { primaryLibrary, secondaryLibrary };
  const result = await ipcRenderer.invoke('save-sequence', projectData);
  if (result.success) {
    alert('Proyecto guardado exitosamente.');
  }
});
//#endregion

//#region 📂 Manejo de Archivos en la Secuencia Principal
addFilesBtn.addEventListener('click', async () => {
  // Abre el dialogo para seleccionar archivos
  const files = await ipcRenderer.invoke('open-file-dialog');
  if (files && files.length > 0) {
    primaryLibrary = primaryLibrary.concat(files);
    updateLibraryUI();
  }
});

removeSelectedBtn.addEventListener('click', () => {
  // Elimina el archivo resaltado (seleccionado) de la lista principal
  const lis = document.querySelectorAll('#sequenceList li');
  lis.forEach(li => {
    if (li.style.backgroundColor === 'rgb(153, 255, 153)') {
      const index = parseInt(li.dataset.index);
      primaryLibrary.splice(index, 1);
    }
  });
  currentIndex = 0;
  updateLibraryUI();
});
//#endregion

//#region 🎬 Control de Reproduccion Principal
// Botón "Inicio/Anterior" (con doble clic)
const startOrPrevBtn = document.getElementById('startOrPrev');
startOrPrevBtn.addEventListener('click', () => {
  if (startButtonClickTimeout) {
    // Doble pulsacion: ir al video anterior
    clearTimeout(startButtonClickTimeout);
    startButtonClickTimeout = null;
    if (currentIndex > 0) {
      currentIndex--;
      console.log('Línea A: Se ha cargado renderer.js por completo');
      console.log('Línea B: Valor de primaryLibrary:', primaryLibrary);

      console.log('Reproduciendo archivo:', primaryLibrary[currentIndex]);

      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      isPlaying = true;
      videoStarted = true;
      currentPlayingIndex = currentIndex;
      videoFinished = false;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      renderMainSequence();
    }
  } else {
    // Primera pulsacion: volver al inicio del video
    startButtonClickTimeout = setTimeout(() => {
      ipcRenderer.send('seek-video', 0);
      videoFinished = false;
      startButtonClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);
  }
});

// Boton combinado de play/pause
togglePlayBtn.addEventListener('click', () => {
  // Si se selecciona un archivo distinto al que se reproduce, iniciar ese nuevo archivo
  if (currentPlayingIndex !== currentIndex) {
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length) {
      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      currentPlayingIndex = currentIndex;
      isPlaying = true;
      videoStarted = true;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      renderMainSequence();
    }
    return;
  }

  // Si el archivo actual ya es el que esta reproduciendo, alternar entre pausa y reanudar
  if (!isPlaying) {
    ipcRenderer.send('resume-video');
    isPlaying = true;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    ipcRenderer.send('pause-video');
    isPlaying = false;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
});

// Boton "Siguiente" (con doble clic)
nextBtn.addEventListener('click', () => {
  if (videoFinished) {
    // Si el video ya terminó, con un clic se pasa al siguiente
    videoFinished = false;
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length - 1) {
      currentIndex++;
      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      isPlaying = true;
      videoStarted = true;
      currentPlayingIndex = currentIndex;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      renderMainSequence();
    } else {
      alert('No hay más elementos en la secuencia.');
    }
    return;
  }

  // Si no ha finalizado, se detecta el doble clic
  if (nextButtonClickTimeout) {
    clearTimeout(nextButtonClickTimeout);
    nextButtonClickTimeout = null;
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length - 1) {
      currentIndex++;
      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      isPlaying = true;
      videoStarted = true;
      currentPlayingIndex = currentIndex;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      renderMainSequence();
    }
  } else {
    nextButtonClickTimeout = setTimeout(() => {
      const duration = parseFloat(timeSlider.max) || 0;
      ipcRenderer.send('seek-video', duration);
      nextButtonClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);
  }
});

// Boton "Finalizar"
finalizeBtn.addEventListener('click', () => {
  ipcRenderer.send('finalize-video');
  isPlaying = false;
  videoStarted = false;
  currentPlayingIndex = null;
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  // Reiniciar la barra de tiempo
  timeSlider.value = 0;
  timeDisplay.textContent = '0:00 / 0:00';
});
//#endregion

//#region ⏱️ Slider de tiempo principal
ipcRenderer.on('time-update', (event, currentTime, duration) => {
  timeSlider.max = duration;
  timeSlider.value = currentTime;
  timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
});

timeSlider.addEventListener('change', () => {
  ipcRenderer.send('seek-video', parseFloat(timeSlider.value));
});

ipcRenderer.on('video-ended', () => {
  console.log('Video principal terminó.');
  videoFinished = true;
  isPlaying = false;
  videoStarted = false;
  currentPlayingIndex = null;
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
});
//#endregion

//#region 🔊 Control de Volumen Principal
mainVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(mainVolumeSlider.value);
  ipcRenderer.send('set-main-volume', vol);
});
//#endregion

//#region 🔊 Control de Volumen Secundario
secondaryVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(secondaryVolumeSlider.value);
  if (secondaryAudio) {
    secondaryAudio.volume = vol;
  }
});
//#endregion

//#region 🎶 Manejo de la Secuencia Secundaria
addFilesSecondaryBtn.addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('open-file-dialog');
  if (files && files.length > 0) {
    secondaryLibrary = secondaryLibrary.concat(files);
    renderSecondaryMedia();
  }
});

removeSecondarySelectedBtn.addEventListener('click', () => {
  if (selectedSecondaryFile) {
    secondaryLibrary = secondaryLibrary.filter(item => item !== selectedSecondaryFile);
    selectedSecondaryFile = null;
    renderSecondaryMedia();
  } else {
    alert('No se ha seleccionado ningún archivo en la secundaria.');
  }
});

// Reproduccion secundaria con barra de tiempo
playSecondaryBtn.addEventListener('click', () => {
  if (!selectedSecondaryFile) {
    alert("No se ha seleccionado ningún sonido para la secundaria.");
    return;
  }
  // Si ya habia un audio en reproduccion, pausarlo
  if (secondaryAudio) {
    secondaryAudio.pause();
    secondaryAudio = null;
  }
  // Crear un nuevo Audio y reproducirlo
  secondaryAudio = new Audio(selectedSecondaryFile);
  secondaryAudio.volume = parseFloat(secondaryVolumeSlider.value);

  secondaryAudio.addEventListener('loadedmetadata', () => {
    secondaryTimeSlider.max = secondaryAudio.duration;
    secondaryTimeDisplay.textContent = `0:00 / ${formatTime(secondaryAudio.duration)}`;
  });

  secondaryAudio.addEventListener('timeupdate', () => {
    secondaryTimeSlider.value = secondaryAudio.currentTime;
    secondaryTimeDisplay.textContent = `${formatTime(secondaryAudio.currentTime)} / ${formatTime(secondaryAudio.duration)}`;
  });

  secondaryAudio.play();
});

// Detener la reproduccion secundaria
stopSecondaryBtn.addEventListener('click', () => {
  if (secondaryAudio) {
    secondaryAudio.pause();
    secondaryAudio = null;
  }
});

// Permitir hacer seek en la reproducción secundaria
secondaryTimeSlider.addEventListener('change', () => {
  if (secondaryAudio) {
    secondaryAudio.currentTime = parseFloat(secondaryTimeSlider.value);
  }
});
//#endregion

//#region 🔄 Inicializacion de la Interfaz
// Al cargar, se actualiza la UI para mostrar los archivos si existen
updateLibraryUI();
//#endregion
