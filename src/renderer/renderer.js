// Importación de módulos
const { ipcRenderer } = require('electron');

//#region Variables Globales
const DOUBLE_CLICK_DELAY = 250; // ms para detectar doble clic
let startButtonClickTimeout = null;
let nextButtonClickTimeout = null;

let primaryLibrary = [];         // Archivos de la secuencia principal
let secondaryLibrary = [];       // Archivos de la secuencia secundaria
let currentIndex = 0;            // Índice del archivo activo en la secuencia principal
let isPlaying = false;           // Estado de reproducción principal (play/pausa)
let videoStarted = false;        // Indica si el video ya inició alguna vez
let currentPlayingIndex = null;  // Índice del video actualmente en reproducción (null si ninguno)
let videoFinished = false;       // Flag que indica si el video ha finalizado

// Variables para Drag & Drop en la secuencia principal
let dragPlaceholder = null;
let draggedIndex = null;
let dragNewIndex = null;

// Variables para Drag & Drop en la secuencia secundaria
let secondaryDragPlaceholder = null;
let secondaryDraggedIndex = null;
let secondaryDragNewIndex = null;

let selectedSecondaryFile = null; // Archivo seleccionado en la lista secundaria
let secondaryAudio = null;        // Objeto Audio para la reproducción secundaria
//#endregion

//#region Elementos del DOM
const sequenceList = document.getElementById('sequenceList');
const secondaryMediaList = document.getElementById('secondaryMediaList');

const newProjectBtn = document.getElementById('newProject');
const loadProjectBtn = document.getElementById('loadProject');
const saveProjectBtn = document.getElementById('saveProject');
const addFilesBtn = document.getElementById('addFiles');
const removeSelectedBtn = document.getElementById('removeSelected');

const togglePlayBtn = document.getElementById('togglePlay');
const nextBtn = document.getElementById('next');
const finalizeBtn = document.getElementById('finalize');

const timeSlider = document.getElementById('timeSlider');
const timeDisplay = document.getElementById('timeDisplay');

const secondaryTimeSlider = document.getElementById('secondaryTimeSlider');
const secondaryTimeDisplay = document.getElementById('secondaryTimeDisplay');

const mainVolumeSlider = document.getElementById('mainVolumeSlider');
const secondaryVolumeSlider = document.getElementById('secondaryVolumeSlider');

const addFilesSecondaryBtn = document.getElementById('addFilesSecondary');
const removeSecondarySelectedBtn = document.getElementById('removeSecondarySelected');
const playSecondaryBtn = document.getElementById('playSecondary');
const stopSecondaryBtn = document.getElementById('stopSecondary');

// Elementos para controlar mute/desmute mediante ícono
const mainVolumeIcon = document.getElementById('mainVolumeIcon');
const secondaryVolumeIcon = document.getElementById('secondaryVolumeIcon');

let mainMuted = false;
let mainPreviousVolume = parseFloat(mainVolumeSlider.value);

let secondaryMuted = false;
let secondaryPreviousVolume = parseFloat(secondaryVolumeSlider.value);
//#endregion

//#region Funciones Auxiliares
/**
 * Convierte segundos a formato hh:mm:ss o mm:ss.
 * @param {number} seconds - Segundos totales.
 * @returns {string} - Tiempo formateado.
 */
function formatTime(seconds) {
  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` 
    : `${m}:${s.toString().padStart(2, '0')}`;
}
//#endregion

//#region Event Listeners para mute/desmute al hacer clic en los íconos de volumen
mainVolumeIcon.addEventListener('click', () => {
  mainMuted = !mainMuted;
  if (mainMuted) {
    // Al mutear, se guarda el volumen actual y se establece en 0
    mainPreviousVolume = parseFloat(mainVolumeSlider.value);
    mainVolumeSlider.value = 0;
    ipcRenderer.send('set-main-volume', 0);
    mainVolumeIcon.classList.remove('fa-volume-high');
    mainVolumeIcon.classList.add('fa-volume-mute');
  } else {
    // Al desmutear, se restaura el volumen previo
    mainVolumeSlider.value = mainPreviousVolume;
    ipcRenderer.send('set-main-volume', mainPreviousVolume);
    mainVolumeIcon.classList.remove('fa-volume-mute');
    mainVolumeIcon.classList.add('fa-volume-high');
  }
});

secondaryVolumeIcon.addEventListener('click', () => {
  secondaryMuted = !secondaryMuted;
  if (secondaryMuted) {
    secondaryPreviousVolume = parseFloat(secondaryVolumeSlider.value);
    secondaryVolumeSlider.value = 0;
    if (secondaryAudio) {
      secondaryAudio.volume = 0;
    }
    secondaryVolumeIcon.classList.remove('fa-volume-high');
    secondaryVolumeIcon.classList.add('fa-volume-mute');
  } else {
    secondaryVolumeSlider.value = secondaryPreviousVolume;
    if (secondaryAudio) {
      secondaryAudio.volume = secondaryPreviousVolume;
    }
    secondaryVolumeIcon.classList.remove('fa-volume-mute');
    secondaryVolumeIcon.classList.add('fa-volume-high');
  }
});
//#endregion

//#region Drag & Drop en Secuencia Principal
sequenceList.addEventListener('dragover', containerDragOver);
sequenceList.addEventListener('drop', containerDrop);

/**
 * Maneja el evento de "dragover" para calcular la posición destino ignorando el placeholder.
 */
function containerDragOver(e) {
  e.preventDefault();
  const containerRect = sequenceList.getBoundingClientRect();
  const mouseY = e.clientY - containerRect.top;
  
  // Calcular índice destino (sin contar el placeholder)
  const children = Array.from(sequenceList.children).filter(child => !child.classList.contains('drag-placeholder'));
  let newIndex = primaryLibrary.length;
  for (let i = 0; i < children.length; i++) {
    const childRect = children[i].getBoundingClientRect();
    const childTop = childRect.top - containerRect.top;
    const childHeight = childRect.height;
    if (mouseY < childTop + childHeight / 2) {
      newIndex = i;
      break;
    }
  }
  dragNewIndex = newIndex;
  
  // Crear o actualizar el placeholder
  if (dragPlaceholder && dragPlaceholder.parentNode) {
    dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    dragPlaceholder = null;
  }
  dragPlaceholder = document.createElement('li');
  dragPlaceholder.className = 'drag-placeholder';
  dragPlaceholder.textContent = primaryLibrary[draggedIndex].split(/(\\|\/)/g).pop();
  
  if (newIndex >= sequenceList.children.length) {
    sequenceList.appendChild(dragPlaceholder);
  } else {
    sequenceList.insertBefore(dragPlaceholder, sequenceList.children[newIndex]);
  }
}

/**
 * Maneja el evento de "drop" para mover el elemento arrastrado a la nueva posición.
 */
function containerDrop(e) {
  e.preventDefault();
  if (dragPlaceholder && dragPlaceholder.parentNode) {
    dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    dragPlaceholder = null;
  }
  const draggedIdx = draggedIndex;
  let newIndex = (dragNewIndex !== null) ? dragNewIndex : primaryLibrary.length;
  if (draggedIdx < newIndex) newIndex--;
  if (draggedIdx === newIndex) return;
  
  const [movedItem] = primaryLibrary.splice(draggedIdx, 1);
  primaryLibrary.splice(newIndex, 0, movedItem);
  
  // Mantener selección si el archivo movido era el activo
  if (draggedIdx === currentIndex) {
    currentIndex = newIndex;
  }
  
  updateLibraryUI();
  draggedIndex = null;
  dragNewIndex = null;
}

document.addEventListener('dragend', () => {
  if (dragPlaceholder && dragPlaceholder.parentNode) {
    dragPlaceholder.parentNode.removeChild(dragPlaceholder);
    dragPlaceholder = null;
  }
  document.querySelectorAll('.dragging').forEach(item => item.classList.remove('dragging'));
});
//#endregion

//#region Renderizado de la Secuencia Principal
/**
 * Renderiza la lista principal de archivos.
 */
function renderMainSequence() {
  sequenceList.innerHTML = '';
  primaryLibrary.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.split(/(\\|\/)/g).pop();
    li.dataset.index = index;
    li.draggable = true;
    li.style.backgroundColor = (index === currentIndex) ? '#99ff99' : '';
    
    // Contenedor de botones de reordenar
    const arrowContainer = document.createElement('div');
    arrowContainer.className = 'arrow-buttons';
    if (index > 0) {
      const upButton = document.createElement('button');
      upButton.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      upButton.title = "Mover arriba";
      upButton.addEventListener('click', (e) => {
        e.stopPropagation();
        [primaryLibrary[index - 1], primaryLibrary[index]] = [primaryLibrary[index], primaryLibrary[index - 1]];
        if (currentIndex === index) {
          currentIndex = index - 1;
        } else if (currentIndex === index - 1) {
          currentIndex = index;
        }
        updateLibraryUI();
      });
      arrowContainer.appendChild(upButton);
    }
    if (index < primaryLibrary.length - 1) {
      const downButton = document.createElement('button');
      downButton.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
      downButton.title = "Mover abajo";
      downButton.addEventListener('click', (e) => {
        e.stopPropagation();
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
    
    // Eventos para arrastrar y seleccionar
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      draggedIndex = index;
      li.classList.add('dragging');
    });
    li.addEventListener('click', () => {
      currentIndex = index;
      renderMainSequence();
    });
    
    sequenceList.appendChild(li);
  });
}
//#endregion

//#region Drag & Drop en Secuencia Secundaria
secondaryMediaList.addEventListener('dragover', secondaryContainerDragOver);
secondaryMediaList.addEventListener('drop', secondaryContainerDrop);

/**
 * Maneja el "dragover" para la lista secundaria.
 */
function secondaryContainerDragOver(e) {
  e.preventDefault();
  const containerRect = secondaryMediaList.getBoundingClientRect();
  const mouseY = e.clientY - containerRect.top;
  
  const children = Array.from(secondaryMediaList.children).filter(child => !child.classList.contains('drag-placeholder'));
  let newIndex = secondaryLibrary.length;
  for (let i = 0; i < children.length; i++) {
    const childRect = children[i].getBoundingClientRect();
    const childTop = childRect.top - containerRect.top;
    const childHeight = childRect.height;
    if (mouseY < childTop + childHeight / 2) {
      newIndex = i;
      break;
    }
  }
  secondaryDragNewIndex = newIndex;
  
  if (secondaryDragPlaceholder && secondaryDragPlaceholder.parentNode) {
    secondaryDragPlaceholder.parentNode.removeChild(secondaryDragPlaceholder);
    secondaryDragPlaceholder = null;
  }
  secondaryDragPlaceholder = document.createElement('li');
  secondaryDragPlaceholder.className = 'drag-placeholder';
  secondaryDragPlaceholder.textContent = secondaryLibrary[secondaryDraggedIndex].split(/(\\|\/)/g).pop();
  
  if (newIndex >= secondaryMediaList.children.length) {
    secondaryMediaList.appendChild(secondaryDragPlaceholder);
  } else {
    secondaryMediaList.insertBefore(secondaryDragPlaceholder, secondaryMediaList.children[newIndex]);
  }
}

/**
 * Maneja el "drop" para mover el archivo en la lista secundaria.
 */
function secondaryContainerDrop(e) {
  e.preventDefault();
  if (secondaryDragPlaceholder && secondaryDragPlaceholder.parentNode) {
    secondaryDragPlaceholder.parentNode.removeChild(secondaryDragPlaceholder);
    secondaryDragPlaceholder = null;
  }
  const draggedIdx = secondaryDraggedIndex;
  let newIndex = (secondaryDragNewIndex !== null) ? secondaryDragNewIndex : secondaryLibrary.length;
  if (draggedIdx < newIndex) newIndex--;
  if (draggedIdx === newIndex) return;
  
  const [movedItem] = secondaryLibrary.splice(draggedIdx, 1);
  secondaryLibrary.splice(newIndex, 0, movedItem);
  
  // Mantener selección si corresponde
  if (secondaryDraggedIndex === selectedSecondaryFile) {
    selectedSecondaryFile = movedItem;
  }
  
  updateLibraryUI();
  secondaryDraggedIndex = null;
  secondaryDragNewIndex = null;
}

document.addEventListener('dragend', () => {
  if (secondaryDragPlaceholder && secondaryDragPlaceholder.parentNode) {
    secondaryDragPlaceholder.parentNode.removeChild(secondaryDragPlaceholder);
    secondaryDragPlaceholder = null;
  }
  document.querySelectorAll('.secondary-dragging').forEach(item => item.classList.remove('secondary-dragging'));
});
//#endregion

//#region Renderizado de la Secuencia Secundaria
/**
 * Renderiza la lista de archivos secundarios.
 */
function renderSecondaryMedia() {
  secondaryMediaList.innerHTML = '';
  secondaryLibrary.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.split(/(\\|\/)/g).pop();
    li.dataset.index = index;
    li.draggable = true;
    li.style.backgroundColor = (selectedSecondaryFile === item) ? '#99ff99' : '';
    
    // Botones para reordenar
    const arrowContainer = document.createElement('div');
    arrowContainer.className = 'arrow-buttons';
    if (index > 0) {
      const upButton = document.createElement('button');
      upButton.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      upButton.title = "Mover arriba";
      upButton.addEventListener('click', (e) => {
        e.stopPropagation();
        [secondaryLibrary[index - 1], secondaryLibrary[index]] = [secondaryLibrary[index], secondaryLibrary[index - 1]];
        updateLibraryUI();
      });
      arrowContainer.appendChild(upButton);
    }
    if (index < secondaryLibrary.length - 1) {
      const downButton = document.createElement('button');
      downButton.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
      downButton.title = "Mover abajo";
      downButton.addEventListener('click', (e) => {
        e.stopPropagation();
        [secondaryLibrary[index], secondaryLibrary[index + 1]] = [secondaryLibrary[index + 1], secondaryLibrary[index]];
        updateLibraryUI();
      });
      arrowContainer.appendChild(downButton);
    }
    li.appendChild(arrowContainer);
    
    // Eventos para arrastrar y seleccionar
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      secondaryDraggedIndex = index;
      li.classList.add('secondary-dragging');
    });
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

//#region Actualización de la UI
/**
 * Actualiza la interfaz de usuario volviendo a renderizar las listas principal y secundaria.
 */
function updateLibraryUI() {
  renderMainSequence();
  renderSecondaryMedia();
}
//#endregion

//#region Manejo de Proyectos
newProjectBtn.addEventListener('click', async () => {
  const response = await ipcRenderer.invoke('confirm-new-project');
  if (response === 0) {
    const projectData = { primaryLibrary, secondaryLibrary };
    const result = await ipcRenderer.invoke('save-sequence', projectData);
    if (result.success) {
      alert('Proyecto guardado. Se creará un nuevo proyecto.');
      resetProject();
    } else {
      alert('Error al guardar el proyecto.');
    }
  } else if (response === 1) {
    resetProject();
  }
});

/**
 * Reinicia el proyecto.
 */
function resetProject() {
  // Se envía un mensaje al proceso principal para cerrar las ventanas de reproducción (si estuvieran activas)
  ipcRenderer.send('close-playback-windows');
  primaryLibrary = [];
  secondaryLibrary = [];
  currentIndex = 0;
  selectedSecondaryFile = null;
  isPlaying = false;
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  updateLibraryUI();
}

loadProjectBtn.addEventListener('click', async () => {
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
  const projectData = { primaryLibrary, secondaryLibrary };
  const result = await ipcRenderer.invoke('save-sequence', projectData);
  if (result.success) {
    alert('Proyecto guardado exitosamente.');
  }
});
//#endregion

//#region Manejo de Archivos en la Secuencia Principal
addFilesBtn.addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('open-file-dialog');
  if (files && files.length > 0) {
    primaryLibrary = primaryLibrary.concat(files);
    updateLibraryUI();
  }
});

removeSelectedBtn.addEventListener('click', () => {
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

//#region Controles de Reproducción Principal
// Botón "Inicio/Anterior"
const startOrPrevBtn = document.getElementById('startOrPrev');
startOrPrevBtn.addEventListener('click', () => {
  if (parseFloat(timeSlider.value) <= 0.1 && !isPlaying) {
    // Si el video está detenido en el inicio, avanzar al anterior solo con doble clic
    if (startButtonClickTimeout) {
      clearTimeout(startButtonClickTimeout);
      startButtonClickTimeout = null;
      if (currentIndex > 0) {
        currentIndex--;
        ipcRenderer.send('load-video-preview', primaryLibrary[currentIndex]);
        isPlaying = false;
        videoStarted = false;
        currentPlayingIndex = null;
        togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        renderMainSequence();
      } else {
        alert('No hay videos anteriores.');
      }
    } else {
      // Esperar segundo clic
      startButtonClickTimeout = setTimeout(() => {
        startButtonClickTimeout = null;
      }, DOUBLE_CLICK_DELAY);
    }
    return;
  }

  if (startButtonClickTimeout) {
    // Doble clic: ir al video anterior
    clearTimeout(startButtonClickTimeout);
    startButtonClickTimeout = null;
    if (currentIndex > 0) {
      currentIndex--;
      ipcRenderer.send('load-video-preview', primaryLibrary[currentIndex]);
      isPlaying = false;
      videoStarted = false;
      currentPlayingIndex = null;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      renderMainSequence();
    }
  } else {
    // Primera pulsación: rebobinar el video al inicio
    startButtonClickTimeout = setTimeout(() => {
      ipcRenderer.send('seek-video', 0);
      ipcRenderer.send('pause-video');
      currentPlayingIndex = null;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      startButtonClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);
  }
});

// Botón "Play/Pausa"
togglePlayBtn.addEventListener('click', () => {
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

// Botón "Siguiente/Finalizar"
nextBtn.addEventListener('click', () => {
  const isAtStart = parseFloat(timeSlider.value) <= 0.1;
  const isAtEnd = parseFloat(timeSlider.value) >= (parseFloat(timeSlider.max) - 0.1);

  if (isAtEnd || videoFinished) {
    // Si el video ya terminó, avanzar al siguiente con un solo clic
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length - 1) {
      currentIndex++;
      ipcRenderer.send('load-video-preview', primaryLibrary[currentIndex]);
      isPlaying = false;
      videoStarted = false;
      currentPlayingIndex = null;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      renderMainSequence();
      // Reiniciar flags
      videoFinished = false;
      nextButtonClickTimeout = null;
    } else {
      alert('No hay más elementos en la secuencia.');
    }
    return;
  }

  if (isAtStart && !isPlaying) {
    // Si el video está al inicio y pausado, avanzar solo con doble clic
    if (nextButtonClickTimeout) {
      clearTimeout(nextButtonClickTimeout);
      nextButtonClickTimeout = null;
      if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length - 1) {
        currentIndex++;
        ipcRenderer.send('load-video-preview', primaryLibrary[currentIndex]);
        isPlaying = false;
        videoStarted = false;
        currentPlayingIndex = null;
        togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        renderMainSequence();
        nextButtonClickTimeout = null;
      }
    } else {
      nextButtonClickTimeout = setTimeout(() => {
        nextButtonClickTimeout = null;
      }, DOUBLE_CLICK_DELAY);
    }
    return;
  }

  if (nextButtonClickTimeout) {
    // Doble clic: avanzar al siguiente video
    clearTimeout(nextButtonClickTimeout);
    nextButtonClickTimeout = null;
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length - 1) {
      currentIndex++;
      ipcRenderer.send('load-video-preview', primaryLibrary[currentIndex]);
      isPlaying = false;
      videoStarted = false;
      currentPlayingIndex = null;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      renderMainSequence();
    }
  } else {
    // Primera pulsación: llevar el video al final
    nextButtonClickTimeout = setTimeout(() => {
      ipcRenderer.send('seek-video', parseFloat(timeSlider.max) || 0);
      ipcRenderer.send('pause-video');
      videoFinished = true;
      currentPlayingIndex = null;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      nextButtonClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);
  }
});

// Botón "Finalizar"
finalizeBtn.addEventListener('click', () => {
  ipcRenderer.send('finalize-video');
  isPlaying = false;
  videoStarted = false;
  currentPlayingIndex = null;
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  timeSlider.value = 0;
  timeDisplay.textContent = '0:00 / 0:00';
});
//#endregion

//#region Slider de Tiempo Principal
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

//#region Controles de Volumen
mainVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(mainVolumeSlider.value);
  ipcRenderer.send('set-main-volume', vol);
});

secondaryVolumeSlider.addEventListener('input', () => {
  const vol = parseFloat(secondaryVolumeSlider.value);
  if (secondaryAudio) {
    secondaryAudio.volume = vol;
  }
});
//#endregion

//#region Controles de Reproducción Secundaria
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

playSecondaryBtn.addEventListener('click', () => {
  if (!selectedSecondaryFile) {
    alert("No se ha seleccionado ningún sonido para la secundaria.");
    return;
  }
  if (secondaryAudio) {
    secondaryAudio.pause();
    secondaryAudio = null;
  }
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

stopSecondaryBtn.addEventListener('click', () => {
  if (secondaryAudio) {
    secondaryAudio.pause();
    secondaryAudio = null;
  }
});

secondaryTimeSlider.addEventListener('change', () => {
  if (secondaryAudio) {
    secondaryAudio.currentTime = parseFloat(secondaryTimeSlider.value);
  }
});
//#endregion

//#region Inicialización de la Interfaz
updateLibraryUI();
//#endregion
