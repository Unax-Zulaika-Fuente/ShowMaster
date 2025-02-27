const { ipcRenderer } = require('electron');

// Bibliotecas separadas para cada área
let primaryLibrary = [];
let secondaryLibrary = [];
let currentIndex = 0;
let isPlaying = false;  // Estado para reproducción principal
let videoStarted = false; // Indica si el video ya se inició alguna vez
let currentPlayingIndex = null; // Almacena el índice del video que se está reproduciendo
let videoFinished = false; // Variable para indicar si el video/sonido ha finalizado

// Variables para detectar doble clic en los botones "inicio" y "siguiente"
const DOUBLE_CLICK_DELAY = 250; // ms
let startButtonClickTimeout = null;
let nextButtonClickTimeout = null;

// --- Elementos de la UI ---
const sequenceList = document.getElementById('sequenceList');
const secondaryMediaList = document.getElementById('secondaryMediaList');

const newProjectBtn = document.getElementById('newProject');
const loadProjectBtn = document.getElementById('loadProject');
const saveProjectBtn = document.getElementById('saveProject');
const addFilesBtn = document.getElementById('addFiles');
const removeSelectedBtn = document.getElementById('removeSelected');

// En lugar de play y pause separados, usaremos un único botón
const togglePlayBtn = document.getElementById('togglePlay');
const nextBtn = document.getElementById('next');
const finalizeBtn = document.getElementById('finalize');

const timeSlider = document.getElementById('timeSlider');
const timeDisplay = document.getElementById('timeDisplay');
const secondaryTimeSlider = document.getElementById('secondaryTimeSlider');
const secondaryTimeDisplay = document.getElementById('secondaryTimeDisplay');

// Controles de volumen
const mainVolumeSlider = document.getElementById('mainVolumeSlider');
const secondaryVolumeSlider = document.getElementById('secondaryVolumeSlider');

// Para la carga de archivos secundarios
const addFilesSecondaryBtn = document.getElementById('addFilesSecondary');
const removeSecondarySelectedBtn = document.getElementById('removeSecondarySelected');
const playSecondaryBtn = document.getElementById('playSecondary');
const stopSecondaryBtn = document.getElementById('stopSecondary');

// Variable para almacenar el archivo seleccionado para la secundaria
let selectedSecondaryFile = null;
let secondaryAudio = null;

// Función para formatear segundos a mm:ss (o hh:mm:ss)
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

// --- Renderizado de la Secuencia Principal (Izquierda) con reordenación ---
function renderMainSequence() {
  sequenceList.innerHTML = '';
  primaryLibrary.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.split(/(\\|\/)/g).pop();
    li.dataset.index = index;
    li.draggable = true; // Hacemos que el elemento sea draggable

    // Resalta el elemento actual
    li.style.backgroundColor = (index === currentIndex) ? '#99ff99' : '';

    // Al iniciar el drag se guarda el índice del elemento
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      e.dataTransfer.effectAllowed = "move";
    });

    // Permite que el elemento reciba drops
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    // Al soltar, se reordena la lista
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const targetIndex = index;
      if (draggedIndex === targetIndex) return;
      
      const [movedItem] = primaryLibrary.splice(draggedIndex, 1);
      primaryLibrary.splice(targetIndex, 0, movedItem);
      
      if (currentIndex === draggedIndex) {
        currentIndex = targetIndex;
      } else if (draggedIndex < currentIndex && targetIndex >= currentIndex) {
        currentIndex--;
      } else if (draggedIndex > currentIndex && targetIndex <= currentIndex) {
        currentIndex++;
      }
      
      updateLibraryUI();
    });

    // Seleccionar elemento al hacer click
    li.addEventListener('click', () => {
      currentIndex = index;
      renderMainSequence();
    });

    sequenceList.appendChild(li);
  });
}

// --- Renderizado de la Media para Secundaria (Derecha) ---
function renderSecondaryMedia() {
  secondaryMediaList.innerHTML = '';
  secondaryLibrary.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = item.split(/(\\|\/)/g).pop();
    li.dataset.filePath = item;
    li.dataset.index = index;
    li.style.backgroundColor = (selectedSecondaryFile === item) ? '#99ff99' : '';
    li.addEventListener('click', () => {
      selectedSecondaryFile = item;
      const allItems = secondaryMediaList.querySelectorAll('li');
      allItems.forEach(el => el.style.backgroundColor = '');
      li.style.backgroundColor = '#99ff99';
    });
    secondaryMediaList.appendChild(li);
  });
}

// Actualiza ambas listas
function updateLibraryUI() {
  renderMainSequence();
  renderSecondaryMedia();
}

// --- Eventos para la Secuencia Principal ---
newProjectBtn.addEventListener('click', async () => {
  // Invoca el diálogo de confirmación
  const response = await ipcRenderer.invoke('confirm-new-project');
  if (response === 0) {
    // Guardar y Nuevo
    const projectData = {
      primaryLibrary: primaryLibrary,
      secondaryLibrary: secondaryLibrary
    };
    const result = await ipcRenderer.invoke('save-sequence', projectData);
    if(result.success){
      alert('Proyecto guardado. Se creará un nuevo proyecto.');
      primaryLibrary = [];
      secondaryLibrary = [];
      currentIndex = 0;
      selectedSecondaryFile = null;
      isPlaying = false;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      updateLibraryUI();
    } else {
      alert('Error al guardar el proyecto.');
    }
  } else if (response === 1) {
    // Nuevo sin guardar
    primaryLibrary = [];
    secondaryLibrary = [];
    currentIndex = 0;
    selectedSecondaryFile = null;
    isPlaying = false;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    updateLibraryUI();
  } 
  // Si response === 2, Cancelar: no se hace nada.
});


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
  const projectData = {
    primaryLibrary: primaryLibrary,
    secondaryLibrary: secondaryLibrary
  };
  const result = await ipcRenderer.invoke('save-sequence', projectData);
  if(result.success){
    alert('Proyecto guardado exitosamente.');
  }
});

addFilesBtn.addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('open-file-dialog');
  if(files && files.length > 0){
    primaryLibrary = primaryLibrary.concat(files);
    updateLibraryUI();
  }
});

removeSelectedBtn.addEventListener('click', () => {
  const lis = document.querySelectorAll('#sequenceList li');
  lis.forEach(li => {
    if(li.style.backgroundColor === 'rgb(153, 255, 153)'){
      const index = parseInt(li.dataset.index);
      primaryLibrary.splice(index, 1);
    }
  });
  currentIndex = 0;
  updateLibraryUI();
});

const startOrPrevBtn = document.getElementById('startOrPrev');

// Evento para el botón "Inicio/Anterior"
startOrPrevBtn.addEventListener('click', () => {
  if (startButtonClickTimeout) {
    // Doble pulsación: ir al video anterior
    clearTimeout(startButtonClickTimeout);
    startButtonClickTimeout = null;
    if (currentIndex > 0) {
      currentIndex--;
      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      isPlaying = true;
      videoStarted = true;
      currentPlayingIndex = currentIndex;
      // Reiniciamos el flag de finalización
      videoFinished = false;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      renderMainSequence();
    }
  } else {
    startButtonClickTimeout = setTimeout(() => {
      // Acción simple: reiniciar al inicio del video actual
      ipcRenderer.send('seek-video', 0);
      // Aseguramos que el video ya no esté marcado como finalizado
      videoFinished = false;
      startButtonClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);
  }
});

// Evento combinado de toggle play/pause para la reproducción principal
togglePlayBtn.addEventListener('click', () => {
  // Si se ha seleccionado un video distinto al que se está reproduciendo...
  if (currentPlayingIndex !== currentIndex) {
    // Reproducir el nuevo video y actualizar el estado
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length) {
      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      currentPlayingIndex = currentIndex;
      isPlaying = true;
      videoStarted = true;
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      renderMainSequence();
    }
    return; // Salir del handler
  }
  
  // Si el video actual ya es el seleccionado:
  if (!isPlaying) {
    // Reanudar la reproducción
    ipcRenderer.send('resume-video');
    isPlaying = true;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    // Pausar la reproducción
    ipcRenderer.send('pause-video');
    isPlaying = false;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
});

// Botón "Siguiente"
nextBtn.addEventListener('click', () => {
  // Si el video ya terminó, con un solo clic se pasa al siguiente
  if (videoFinished) {
    videoFinished = false; // Reiniciamos el estado
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
    return; // Salir sin esperar doble clic
  }

  // Si el video no ha finalizado, se utiliza el comportamiento de doble pulsación:
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
      // Acción simple: avanzar al final del video actual (seek a la duración)
      const duration = parseFloat(timeSlider.max) || 0;
      ipcRenderer.send('seek-video', duration);
      nextButtonClickTimeout = null;
    }, DOUBLE_CLICK_DELAY);
  }
});

// Botón "Finalizar": detiene la reproducción y cierra la ventana reproductora
finalizeBtn.addEventListener('click', () => {
  ipcRenderer.send('finalize-video');
  isPlaying = false;
  videoStarted = false;
  currentPlayingIndex = null;
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  // Reinicia la barra de tiempo
  timeSlider.value = 0;
  timeDisplay.textContent = '0:00 / 0:00';
});

// Slider de tiempo principal
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
  // Cambia el botón a icono de play para indicar que se puede iniciar nuevamente
  togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
});

// --- Control de Volumen ---
mainVolumeSlider.addEventListener('input', () => {
  let vol = parseFloat(mainVolumeSlider.value);
  ipcRenderer.send('set-main-volume', vol);
});

secondaryVolumeSlider.addEventListener('input', () => {
  let vol = parseFloat(secondaryVolumeSlider.value);
  if (secondaryAudio) {
    secondaryAudio.volume = vol;
  }
});

// --- Eventos para la Media Secundaria ---
addFilesSecondaryBtn.addEventListener('click', async () => {
  const files = await ipcRenderer.invoke('open-file-dialog');
  if(files && files.length > 0){
    secondaryLibrary = secondaryLibrary.concat(files);
    renderSecondaryMedia();
  }
});

removeSecondarySelectedBtn.addEventListener('click', () => {
  if(selectedSecondaryFile) {
    secondaryLibrary = secondaryLibrary.filter(item => item !== selectedSecondaryFile);
    selectedSecondaryFile = null;
    renderSecondaryMedia();
  } else {
    alert("No se ha seleccionado ningún archivo en la secundaria.");
  }
});

// Reproducción secundaria con barra de tiempo
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

// Inicializa la UI
updateLibraryUI();
