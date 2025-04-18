  // Importación de módulos
  const { ipcRenderer } = require('electron');

  //#region Variables Globales
  let isShowMode = false;

  const DOUBLE_CLICK_DELAY = 250; // ms para detectar doble clic
  let startButtonClickTimeout = null;
  let nextButtonClickTimeout = null;

  let primaryLibrary = [];         // Archivos de la secuencia principal
  let overlayColor     = null;
  let overlayImagePath = null;
  let secondaryLibrary = [];       // Archivos de la secuencia secundaria
  let currentIndex = 0;            // Índice del archivo activo en la secuencia principal
  let isPlaying = false;           // Estado de reproducción principal (play/pausa)
  let videoStarted = false;        // Indica si el video ya inició alguna vez
  let currentPlayingIndex = null;  // Índice del video actualmente en reproducción (null si ninguno)
  let videoFinished = false;       // Flag que indica si el video ha finalizado
  let isSeekingSlider = false;
  let isSeekingSecondary = false;
  let secondaryMuteFlags = {};
  let mainTemporarilyMuted = false;

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

  // Efectos de sonidos instantaneos
  let instantSounds = [];  
  let modeInstant = null;
  let instantAudioPlayers = [];
  let instantGlobalVolume = 1;
  //#endregion

  //#region Elementos del DOM
  const path = require('path');

  const sequenceList = document.getElementById('sequenceList');
  const secondaryMediaList = document.getElementById('secondaryMediaList');

  const newProjectBtn = document.getElementById('newProject');
  const loadProjectBtn = document.getElementById('loadProject');
  const saveProjectBtn = document.getElementById('saveProject');
  const addFilesBtn = document.getElementById('addFiles');
  const removeSelectedBtn = document.getElementById('removeSelected');
  const overlayColorPicker = document.getElementById('overlayColorPicker');
  const overlayImageBtn    = document.getElementById('overlayImageBtn');
  const overlayImageLabel  = document.getElementById('overlayImageLabel');
  const overlayTypeColor  = document.getElementById('overlayTypeColor');
  const overlayTypeImage  = document.getElementById('overlayTypeImage');
  const colorControlSpan  = document.getElementById('colorControl');
  const imageControlSpan  = document.getElementById('imageControl');

  const togglePlayBtn = document.getElementById('togglePlay');
  const nextBtn = document.getElementById('next');
  const nextAndPlayBtn = document.getElementById('nextAndPlay');
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

  // Efectos de sonidos instantaneos
  const addInstantBtn          = document.getElementById('addInstant');
  const deleteInstantToggleBtn = document.getElementById('deleteInstantToggle');
  const editInstantToggleBtn   = document.getElementById('editInstantToggle');
  const emojiInstantToggleBtn = document.getElementById('emojiInstantToggle');
  const stopAllInstantBtn = document.getElementById('stopAllInstant');
  const globalVolSlider = document.getElementById('instantGlobalVolume');
  const instantVolumeIcon = document.getElementById('instantVolumeIcon');
  const instantDeck            = document.getElementById('instantDeck');

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

  //#region Modo espectaculo
  // Toggle Modo Espectaculo/Edicion
  const viewModeToggle = document.getElementById('viewModeToggle');
  viewModeToggle.addEventListener('click', () => {
    isShowMode = !isShowMode;
    viewModeToggle.textContent = isShowMode
      ? 'Visualizar modo Edición'
      : 'Visualizar modo Espectáculo';
    updateViewMode();
  });

  function updateViewMode() {
    // Controles principal
    document.getElementById("addFiles").classList.toggle("hidden", isShowMode);
    document
      .getElementById("removeSelected")
      .classList.toggle("hidden", isShowMode);
    // Controles secundaria
    document
      .getElementById("addFilesSecondary")
      .classList.toggle("hidden", isShowMode);
    document
      .getElementById("removeSecondarySelected")
      .classList.toggle("hidden", isShowMode);
    document
      .querySelectorAll("#instantColumn .deck-controls button")
      .forEach((btn) => {
        if (btn !== stopAllInstantBtn) {
          btn.classList.toggle("hidden", isShowMode);
        }
      });
  }

  // Ejecutar al arrancar para aplicar el estado inicial
  updateViewMode();
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
      li.draggable = true;

      // 1. Checkbox individual
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'secondary-mute-checkbox';
      cb.checked = !!secondaryMuteFlags[index];
      cb.addEventListener('change', () => {
        secondaryMuteFlags[index] = cb.checked;
      });

      // 2. Nombre de archivo
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.split(/(\\|\/)/g).pop();
      nameSpan.style.margin = '0 8px';

      // 3. Flechas de reorder
      const arrowContainer = document.createElement('div');
      arrowContainer.className = 'arrow-buttons';
      if (index > 0) {
        const up = document.createElement('button');
        up.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
        up.title = 'Mover arriba';
        up.addEventListener('click', e => {
          e.stopPropagation();
          [secondaryLibrary[index-1], secondaryLibrary[index]] =
            [secondaryLibrary[index], secondaryLibrary[index-1]];
          updateLibraryUI();
        });
        arrowContainer.appendChild(up);
      }
      if (index < secondaryLibrary.length - 1) {
        const down = document.createElement('button');
        down.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
        down.title = 'Mover abajo';
        down.addEventListener('click', e => {
          e.stopPropagation();
          [secondaryLibrary[index], secondaryLibrary[index+1]] =
            [secondaryLibrary[index+1], secondaryLibrary[index]];
          updateLibraryUI();
        });
        arrowContainer.appendChild(down);
      }

      // 4. Click para seleccionar
      li.addEventListener('click', () => {
        selectedSecondaryFile = item;
        // resetea fondos y pinta solo el seleccionado
        secondaryMediaList.querySelectorAll('li').forEach(el => el.style.background = '');
        li.style.background = '#99ff99';
      });

      // 5. Drag & drop (igual que antes)
      li.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', index);
        secondaryDraggedIndex = index;
        li.classList.add('secondary-dragging');
      });

      // Montaje final
      li.appendChild(cb);
      li.appendChild(nameSpan);
      li.appendChild(arrowContainer);
      secondaryMediaList.appendChild(li);
    });
  }

  const toggleAllSecondary = document.getElementById('toggleAllSecondary');
  toggleAllSecondary.addEventListener('change', () => {
    const v = toggleAllSecondary.checked;
    secondaryLibrary.forEach((_, idx) => {
      secondaryMuteFlags[idx] = v;
    });
    renderSecondaryMedia();
  });

  //#endregion

  //#region Actualización de la UI
  /**
   * Actualiza la interfaz de usuario volviendo a renderizar las listas principal y secundaria.
   */
  function updateLibraryUI() {
    renderMainSequence();
    renderSecondaryMedia();
    renderInstantDeck();
  }
  //#endregion

  //#region Manejo de Proyectos
  newProjectBtn.addEventListener('click', async () => {
    const response = await ipcRenderer.invoke('confirm-new-project');
    if (response === 0) {
      const projectData = {
        primaryLibrary,
        secondaryLibrary,
        secondaryMuteFlags,
        instantSounds,
        overlayType: overlayTypeColor.checked ? 'color' : 'image',
        overlayColor,
        overlayImagePath
      };
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
      // 0) Reset del overlay  
      overlayTypeColor.checked     = true;
      overlayTypeImage.checked     = false;
      overlayColor                 = '#000000';
      overlayImagePath             = null;
      overlayColorPicker.value     = overlayColor;
      overlayImageLabel.textContent = 'Ninguna';
      updateOverlayInputs();
      sendCurrentOverlay();

    // 1. Cierra reproductores
    ipcRenderer.send('close-playback-windows');

    // 2. Resetea librerías y selección
    primaryLibrary = [];
    secondaryLibrary = [];
    currentIndex = 0;
    selectedSecondaryFile = null;

    // 3. Resetea TODO el estado de playback
    isPlaying = false;
    videoStarted = false;
    videoFinished = false;
    currentPlayingIndex = null;

    // 4. Para y limpia audio secundario si existiera
    if (secondaryAudio) {
      secondaryAudio.pause();
      secondaryAudio = null;
      secondaryTimeSlider.value = 0;
      secondaryTimeDisplay.textContent = '0:00 / 0:00';
    }

    // 5. Restablece UI de controles de vídeo
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    timeSlider.value = 0;
    timeDisplay.textContent = '0:00 / 0:00';

    // 6. Resetea flags y checkboxes de secundaria
    secondaryMuteFlags = {};
    const globalCb = document.getElementById('toggleAllSecondary');
    if (globalCb) globalCb.checked = false;

    // 7. Resetea efectos instantaneos
    instantSounds = [];
    modeInstant    = null;
    addInstantBtn.classList.remove('active');
    deleteInstantToggleBtn.classList.remove('active');
    editInstantToggleBtn.classList.remove('active');

    // 8. Vuelve a renderizar listas (con todos los checkboxes desmarcados)
    updateLibraryUI();
  }

  loadProjectBtn.addEventListener('click', async () => {
    const loadedProject = await ipcRenderer.invoke('load-sequence');
    if (!loadedProject || typeof loadedProject !== 'object') return;

    // 1) Resto de restauración de librerías...
    primaryLibrary       = loadedProject.primaryLibrary       || [];
    secondaryLibrary     = loadedProject.secondaryLibrary     || [];
    secondaryMuteFlags   = loadedProject.secondaryMuteFlags   || {};
    instantSounds = (loadedProject.instantSounds || []).map(entry => ({
      file: entry.file,
      icon: entry.icon,
      // si no venía volumeDb, le damos 0 dB por defecto
      volumeDb: typeof entry.volumeDb === 'number' ? entry.volumeDb : 0
    }));

    // 2) Estado del overlay (completo)
    const { overlayType, overlayColor: c, overlayImagePath: img } = loadedProject;

    overlayTypeColor.checked = overlayType === 'color';
    overlayTypeImage.checked = overlayType === 'image';

    if (loadedProject.overlayType === 'image') {
      overlayTypeImage.checked = true;
      overlayImagePath = loadedProject.overlayImagePath;
      overlayImageLabel.textContent = path.basename(overlayImagePath);
      // Resetea color para no reenviar algo viejo
      overlayColor = '#000000';
      overlayColorPicker.value = overlayColor;
    } else {
      overlayTypeColor.checked = true;
      overlayColor = loadedProject.overlayColor || '#000000';
      // **ÉSTA línea** sincroniza el input con tu variable
      overlayColorPicker.value = overlayColor;
      // Asegúrate de limpiar cualquier ruta antigua de imagen
      overlayImagePath = null;
      overlayImageLabel.textContent = 'Ninguna';
    }

    updateOverlayInputs();
    sendCurrentOverlay();

    // 3) Reset de la UI de reproducción
    currentIndex = 0;
    isPlaying    = false;
    togglePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';

    updateLibraryUI();
  });

  saveProjectBtn.addEventListener('click', async () => {
    const projectData = {
      primaryLibrary,
      secondaryLibrary,
      secondaryMuteFlags,
      instantSounds,
      overlayType: overlayTypeColor.checked ? 'color' : 'image',
      overlayColor,
      overlayImagePath
    };
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

  // Boton de "Siguiente y reproducir"
  nextAndPlayBtn.addEventListener('click', () => {
    // Solo si hay un siguiente elemento
    if (primaryLibrary.length > 0 && currentIndex < primaryLibrary.length - 1) {
      currentIndex++;
      // Enviar directamente a reproduccion (no solo preview)
      ipcRenderer.send('play-video', primaryLibrary[currentIndex]);
      
      // Actualizar estado interno
      currentPlayingIndex = currentIndex;
      isPlaying = true;
      videoStarted = true;
      
      // Cambiar icono de Play/Pausa a “Pausa”
      togglePlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      
      // Refrescar UI
      renderMainSequence();
    } else {
      alert('No hay más elementos en la secuencia.');
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
    if (!isSeekingSlider) {
      timeSlider.value = currentTime;
      timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }
  });

  // Detectar inicio de drag:
  timeSlider.addEventListener('mousedown', () => {
    isSeekingSlider = true;
  });

  // Detectar fin de drag y mandar seek:
  timeSlider.addEventListener('mouseup', () => {
    const newTime = parseFloat(timeSlider.value);
    ipcRenderer.send('seek-video', newTime);
    // Actualizamos también la UI al momento
    timeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(timeSlider.max)}`;
    isSeekingSlider = false;
  });

  // (Opcional) Para feedback en tiempo real mientras arrastras:
  timeSlider.addEventListener('input', () => {
    const previewTime = parseFloat(timeSlider.value);
    timeDisplay.textContent = `${formatTime(previewTime)} / ${formatTime(timeSlider.max)}`;
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

    mainVolumeIcon.classList.remove(
      'fa-volume-mute','fa-volume-low','fa-volume-high'
    );
    if (vol === 0) {
      mainVolumeIcon.classList.add('fa-volume-mute');
      mainMuted = true;
    } else if (vol < 0.5) {
      mainVolumeIcon.classList.add('fa-volume-low');
      mainMuted = false;
    } else {
      mainVolumeIcon.classList.add('fa-volume-high');
      mainMuted = false;
    }
  });

  secondaryVolumeSlider.addEventListener('input', () => {
    const vol = parseFloat(secondaryVolumeSlider.value);
    if (secondaryAudio) secondaryAudio.volume = vol;

    secondaryVolumeIcon.classList.remove(
      'fa-volume-mute','fa-volume-low','fa-volume-high'
    );
    if (vol === 0) {
      secondaryVolumeIcon.classList.add('fa-volume-mute');
      secondaryMuted = true;
    } else if (vol < 0.5) {
      secondaryVolumeIcon.classList.add('fa-volume-low');
      secondaryMuted = false;
    } else {
      secondaryVolumeIcon.classList.add('fa-volume-high');
      secondaryMuted = false;
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

  // 2) Listener completo de playSecondaryBtn:
  playSecondaryBtn.addEventListener('click', () => {
    if (!selectedSecondaryFile) {
      alert("No se ha seleccionado ningún sonido para la secundaria.");
      return;
    }

    // 2.1 Detener cualquier instancia previa
    if (secondaryAudio) {
      secondaryAudio.pause();
      secondaryAudio = null;
    }

    // 2.2 Crear nuevo Audio y asignar volumen
    secondaryAudio = new Audio(selectedSecondaryFile);
    secondaryAudio.volume = parseFloat(secondaryVolumeSlider.value);

    // 2.3 Si toca mutear la principal...
    const idx = secondaryLibrary.indexOf(selectedSecondaryFile);
    if (secondaryMuteFlags[idx]) {
      mainPreviousVolume = parseFloat(mainVolumeSlider.value);
      ipcRenderer.send('set-main-volume', 0);

      // Visual: ponemos el slider a 0 y actualizamos icono
      mainVolumeSlider.value = 0;
      mainVolumeIcon.classList.remove('fa-volume-low','fa-volume-high');
      mainVolumeIcon.classList.add('fa-volume-mute');
      mainMuted = true;

      mainTemporarilyMuted = true;
    }

    // 2.4 Inicializar slider y display
    secondaryAudio.addEventListener('loadedmetadata', () => {
      secondaryTimeSlider.max = secondaryAudio.duration;
      secondaryTimeSlider.value = 0;
      secondaryTimeDisplay.textContent = `0:00 / ${formatTime(secondaryAudio.duration)}`;
    });

    // 2.5 Actualizar slider en reproducción normal
    secondaryAudio.addEventListener('timeupdate', () => {
      if (!isSeekingSecondary) {
        secondaryTimeSlider.value = secondaryAudio.currentTime;
        secondaryTimeDisplay.textContent =
          `${formatTime(secondaryAudio.currentTime)} / ${formatTime(secondaryAudio.duration)}`;
      }
    });

    // 2.6 Al acabar, restaurar la principal si la muteamos
    secondaryAudio.addEventListener('ended', () => {
      if (mainTemporarilyMuted) {
        ipcRenderer.send('set-main-volume', mainPreviousVolume);

        // Restauramos visual
        mainVolumeSlider.value = mainPreviousVolume;
        mainVolumeIcon.classList.remove('fa-volume-mute');
        // Elegimos icono según nivel restaurado
        if (mainPreviousVolume === 0) {
          mainVolumeIcon.classList.add('fa-volume-mute');
        } else if (mainPreviousVolume < 0.5) {
          mainVolumeIcon.classList.add('fa-volume-low');
        } else {
          mainVolumeIcon.classList.add('fa-volume-high');
        }
        mainMuted = false;

        mainTemporarilyMuted = false;
      }
    });

    secondaryAudio.play();
  });

  // Cuando el usuario empieza a arrastrar:
  secondaryTimeSlider.addEventListener('mousedown', () => {
    isSeekingSecondary = true;
  });

  // Mientras arrastra, actualizamos la vista previa:
  secondaryTimeSlider.addEventListener('input', () => {
    const t = parseFloat(secondaryTimeSlider.value);
    secondaryTimeDisplay.textContent = `${formatTime(t)} / ${formatTime(secondaryTimeSlider.max)}`;
  });

  // Al soltar, hacemos el seek y reactivamos updates:
  secondaryTimeSlider.addEventListener('mouseup', () => {
    const t = parseFloat(secondaryTimeSlider.value);
    if (secondaryAudio) {
      secondaryAudio.currentTime = t;
    }
    secondaryTimeDisplay.textContent = `${formatTime(t)} / ${formatTime(secondaryTimeSlider.max)}`;
    isSeekingSecondary = false;
  });

  stopSecondaryBtn.addEventListener('click', () => {
    if (secondaryAudio) {
      secondaryAudio.pause();
      secondaryAudio = null;
    }

    // Si habíamos muteado la principal, la restauramos al detener manualmente
    if (mainTemporarilyMuted) {
      // Funcional: restaurar volumen
      ipcRenderer.send('set-main-volume', mainPreviousVolume);

      // Visual: slider e icono
      mainVolumeSlider.value = mainPreviousVolume;
      mainVolumeIcon.classList.remove('fa-volume-mute');
      if (mainPreviousVolume === 0) {
        mainVolumeIcon.classList.add('fa-volume-mute');
      } else if (mainPreviousVolume < 0.5) {
        mainVolumeIcon.classList.add('fa-volume-low');
      } else {
        mainVolumeIcon.classList.add('fa-volume-high');
      }
      mainMuted = false;

      // Limpiar flag
      mainTemporarilyMuted = false;
    }
  });

  secondaryTimeSlider.addEventListener('change', () => {
    if (secondaryAudio) {
      secondaryAudio.currentTime = parseFloat(secondaryTimeSlider.value);
    }
  });
  //#endregion

  //#region Efectos instantaneos
  function renderInstantDeck() {
    instantDeck.innerHTML = '';
  
    instantSounds.forEach((entry, idx) => {
      // Contenedor para botón + control de volumen
      const container = document.createElement('div');
      container.className = 'instant-item';
  
      // --- Botón del efecto ---
      const btn = document.createElement('button');
      btn.className = 'instant-button';
      btn.innerHTML = entry.file
        ? (entry.icon || '🔊')
        : '<i class="fa-regular fa-square-plus"></i>';
      // Modo borrar / editar / emoji
      if (modeInstant === 'delete') btn.classList.add('instant-delete-mode');
      if (modeInstant === 'edit')   btn.classList.add('instant-edit-mode');
      if (modeInstant === 'emoji')  btn.classList.add('instant-emoji-mode');
  
      btn.addEventListener('click', async () => {
        // --- BORRAR ---
        if (modeInstant === 'delete') {
          instantSounds.splice(idx, 1);
          renderInstantDeck();
          return;
        }
        // --- EDITAR SONIDO ---
        if (modeInstant === 'edit' && entry.file) {
          const files = await ipcRenderer.invoke('open-file-dialog');
          if (files?.[0]) {
            entry.file = files[0];
            const emoji = await showEmojiPicker(entry.icon);
            if (emoji != null) entry.icon = emoji;
          }
          renderInstantDeck();
          return;
        }
        // --- CAMBIAR ICONO ---
        if (modeInstant === 'emoji' && entry.file) {
          const emoji = await showEmojiPicker(entry.icon);
          if (emoji != null) entry.icon = emoji;
          renderInstantDeck();
          return;
        }
        // --- ASIGNAR SONIDO A UN SLOT VACÍO ---
        if (!entry.file) {
          const files = await ipcRenderer.invoke('open-file-dialog');
          if (!files?.[0]) return;
          entry.file = files[0];
          const emoji = await showEmojiPicker('🔊');
          if (emoji == null) {
            instantSounds.splice(idx, 1);
          } else {
            entry.icon = emoji;
          }
          renderInstantDeck();
          return;
        }
        // --- REPRODUCIR con el volumen en dB ajustado a lineal ---
        const audio = new Audio(entry.file);
        // Guardamos cuánto dB tenía este entry para poder recalcular más tarde
        audio._entryVolumeDb = entry.volumeDb ?? 0;
        const baseVol = Math.pow(10, audio._entryVolumeDb / 20);
        audio.volume = Math.min(Math.max(baseVol * instantGlobalVolume, 0), 1);
        audio.play();
        instantAudioPlayers.push(audio);
        audio.addEventListener('ended', () => {
          instantAudioPlayers = instantAudioPlayers.filter(a => a !== audio);
        });
      });
  
      // --- Input numérico de volumen en dB individual ---
      const volInput = document.createElement('input');
      volInput.type = 'number';
      volInput.min = -60;
      volInput.max = 12;
      volInput.step = 1;
      volInput.value = entry.volumeDb ?? 0;
      volInput.title = `${volInput.value} dB`;
      volInput.className = 'instant-volume-input';

      volInput.addEventListener('change', () => {
        entry.volumeDb = parseFloat(volInput.value) || 0;
        volInput.title = `${entry.volumeDb} dB`;

        // Actualiza en tiempo real todas las instancias sonando
        const newLinear = Math.pow(10, entry.volumeDb / 20) * instantGlobalVolume;
        entry.players.forEach(a => {
          a.volume = Math.min(Math.max(newLinear, 0), 1);
        });
      });

      // Montaje
      container.appendChild(btn);
      container.appendChild(volInput);
      instantDeck.appendChild(container);
    });
  }
  
  // Añadir boton
  // Añade solo el slot vacio (icono +)
  addInstantBtn.addEventListener('click', () => {
    instantSounds.push({ file: null, icon: null, volumeDb: 0, players: [] });
    renderInstantDeck();
  });  

  /**
   * Muestra un modal flotante para que el usuario escriba o pegue un emoji.
   * Devuelve una Promise que resuelve con el emoji (o el valor por defecto).
   */
  function showEmojiPicker(defaultVal = '🔊') {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed', top:0, left:0,
        width:'100vw', height:'100vh',
        background:'rgba(0,0,0,0.5)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:10000
      });

      const modal = document.createElement('div');
      Object.assign(modal.style, {
        background:'#fff', padding:'20px', borderRadius:'8px',
        textAlign:'center', minWidth:'200px'
      });

      const prompt = document.createElement('div');
      prompt.textContent = 'Elige un emoji para el efecto';
      prompt.style.marginBottom = '10px';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = defaultVal;
      Object.assign(input.style, {
        fontSize:'2rem', textAlign:'center', width:'3rem', marginBottom:'10px'
      });

      const ok = document.createElement('button');
      ok.textContent = 'OK';
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancelar';
      cancel.style.marginLeft = '10px';

      modal.append(prompt, input, ok, cancel);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      input.focus();

      ok.addEventListener('click', () => {
        const val = input.value.trim() || defaultVal;
        document.body.removeChild(overlay);
        resolve(val);
      });
      cancel.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') ok.click();
        if (e.key === 'Escape') cancel.click();
      });
    });
  }

  // Toggle Delete
  deleteInstantToggleBtn.addEventListener('click', () => {
    modeInstant = modeInstant === 'delete' ? null : 'delete';
    deleteInstantToggleBtn.classList.toggle('active', modeInstant === 'delete');
    // desactiva el otro modo
    modeInstant === 'delete' && editInstantToggleBtn.classList.remove('active');
    renderInstantDeck();
  });

  // Toggle Edit
  editInstantToggleBtn.addEventListener('click', () => {
    modeInstant = modeInstant === 'edit' ? null : 'edit';
    editInstantToggleBtn.classList.toggle('active', modeInstant === 'edit');
    deleteInstantToggleBtn.classList.remove('active');
    renderInstantDeck();
  });

  //Toggle Edit emoji
  emojiInstantToggleBtn.addEventListener('click', () => {
    // alterna el modo emoji
    modeInstant = (modeInstant === 'emoji') ? null : 'emoji';

    // pinta/despinta el boton
    emojiInstantToggleBtn.classList.toggle('active', modeInstant === 'emoji');
    emojiInstantToggleBtn.classList.toggle('emoji', modeInstant === 'emoji');

    // desactiva los otros modos
    if (modeInstant === 'emoji') {
      deleteInstantToggleBtn.classList.remove('active');
      editInstantToggleBtn.classList.remove('active');
    }
    renderInstantDeck();
  });

  // Stop Audios instantaneos
  stopAllInstantBtn.addEventListener('click', () => {
    instantAudioPlayers.forEach(a => {
      a.pause();
      a.currentTime = 0;
    });
    instantAudioPlayers = [];
  });
  //#endregion

  //#region Inicialización de la Interfaz
  updateLibraryUI();
  //#endregion

  function updateOverlayInputs() {
    if (overlayTypeColor.checked) {
      // Mostrar solo color picker
      colorControlSpan.style.display = '';
      imageControlSpan.style.display = 'none';
    } else {
      // Mostrar solo file input
      colorControlSpan.style.display = 'none';
      imageControlSpan.style.display = '';
    }
  }

  function sendCurrentOverlay() {
    const type = overlayTypeColor.checked ? "color" : "image";
    const color = type === "color" ? overlayColorPicker.value : null;
    const image = type === "image" ? overlayImagePath : null;
    ipcRenderer.send("set-overlay", { type, color, image });
  }

  // Al cambiar tipo, actualizo inputs y reenvío
  overlayTypeColor.addEventListener("change", () => {
    updateOverlayInputs();
    sendCurrentOverlay();
  });
  overlayTypeImage.addEventListener("change", () => {
    updateOverlayInputs();
    sendCurrentOverlay();
  });

  overlayColorPicker.addEventListener("input", () => {
    if (overlayTypeColor.checked) sendCurrentOverlay();
  });

  // Iniciar estado correcto
  updateOverlayInputs();

  overlayImageBtn.addEventListener('click', async () => {
    const files = await ipcRenderer.invoke('open-file-dialog');
    if (!files || files.length === 0) return;
    overlayImagePath = files[0];
    overlayImageLabel.textContent = path.basename(overlayImagePath);
    sendCurrentOverlay();
  });

  overlayTypeColor.addEventListener("change", () => {
    updateOverlayInputs();
    sendCurrentOverlay();
  });
  overlayTypeImage.addEventListener("change", () => {
    updateOverlayInputs();
    sendCurrentOverlay();
  });

  // Toggle mute cuando se clickea el icono
  instantVolumeIcon.addEventListener('click', () => {
    if (instantGlobalVolume > 0) {
      instantGlobalVolume = 0;
      globalVolSlider.value = 0;
      instantVolumeIcon.classList.replace('fa-volume-high', 'fa-volume-mute');
    } else {
      instantGlobalVolume = parseFloat(globalVolSlider.getAttribute('data-previous')) || 1;
      globalVolSlider.value = instantGlobalVolume;
      instantVolumeIcon.classList.replace('fa-volume-mute', 'fa-volume-high');
    }
    // reajusta volúmenes en vuelo:
    instantAudioPlayers.forEach(a => {
      const base = Math.pow(10, (a._entryVolumeDb||0) / 20);
      a.volume = Math.min(Math.max(base * instantGlobalVolume, 0), 1);
    });
  });
  
  // Guarda el valor previo al mutear
  globalVolSlider.addEventListener('input', () => {
    instantGlobalVolume = parseFloat(globalVolSlider.value);
    globalVolSlider.setAttribute('data-previous', instantGlobalVolume);
    // ajusta icono
    if (instantGlobalVolume === 0) {
      instantVolumeIcon.classList.replace('fa-volume-high', 'fa-volume-mute');
    } else {
      instantVolumeIcon.classList.replace('fa-volume-mute', 'fa-volume-high');
    }
    // reajusta todos los sonidos en vuelo
    instantAudioPlayers.forEach(a => {
      const base = Math.pow(10, (a._entryVolumeDb||0) / 20);
      a.volume = Math.min(Math.max(base * instantGlobalVolume, 0), 1);
    });
  });
  