const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let playbackWindow;
let secondaryPlaybackWindow;

//#region 🏠 Crear la ventana principal
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carga el index.html desde la carpeta src/renderer
  mainWindow.loadFile(
    path.join(__dirname, 'renderer', 'index.html')
  );

  // Cuando se cierre la ventana principal, también cerramos las ventanas secundarias
  mainWindow.on('closed', () => {
    mainWindow = null;
    closeAllWindows();
  });
}
//#endregion

//#region 🎬 Crear la ventana de reproducción principal
function createPlaybackWindow() {
  let displays = screen.getAllDisplays();
  let externalDisplay = displays.find(display => display.bounds.x !== 0 || display.bounds.y !== 0);
  
  let winOptions = {
    width: 800,
    height: 600,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };

  if (externalDisplay) {
    winOptions.x = externalDisplay.bounds.x + 50;
    winOptions.y = externalDisplay.bounds.y + 50;
  }

  playbackWindow = new BrowserWindow(winOptions);

  // Carga el playback.html desde la carpeta src/players
  playbackWindow.loadFile(
    path.join(__dirname, 'players', 'playback.html')
  );
  
  playbackWindow.hide();

  playbackWindow.on('closed', () => {
    playbackWindow = null;
  });
}
//#endregion

//#region 🎵 Crear la ventana de reproducción secundaria
function createSecondaryPlaybackWindow() {
  secondaryPlaybackWindow = new BrowserWindow({
    show: false, // No se muestra
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carga el secondary.html desde la carpeta src/players
  secondaryPlaybackWindow.loadFile(
    path.join(__dirname, 'players', 'secondary.html')
  );

  secondaryPlaybackWindow.on('closed', () => {
    secondaryPlaybackWindow = null;
  });
}
//#endregion

//#region 🚀 Inicializar la aplicación
app.whenReady().then(() => {
  createMainWindow();
  createPlaybackWindow();
  createSecondaryPlaybackWindow();

  app.on('activate', () => {
    // En macOS, re-crea la ventana principal si no hay ventanas abiertas
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
//#endregion

//#region ❌ Cerrar correctamente la aplicación
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeAllWindows();
    app.quit();
  }
});

/**
 * Cierra las ventanas secundarias (reproductores) si aún están abiertas.
 */
function closeAllWindows() {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.close();
  }
  if (secondaryPlaybackWindow && !secondaryPlaybackWindow.isDestroyed()) {
    secondaryPlaybackWindow.close();
  }
}
//#endregion

//#region 📂 Diálogo para abrir archivos
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{
      name: 'Media & Image Files',
      extensions: [
        'mp4', 'mp3', 'avi', 'mkv', 'wav',
        'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'
      ]
    }]
  });
  return result.filePaths;
});
//#endregion

//#region 💾 Guardar y cargar secuencias
ipcMain.handle('save-sequence', async (event, sequenceData) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar Secuencia',
    defaultPath: 'secuencia.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, JSON.stringify(sequenceData, null, 2), 'utf-8');
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('load-sequence', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(data);
  }
  return null;
});

ipcMain.handle('confirm-new-project', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Guardar y Nuevo', 'Nuevo sin guardar', 'Cancelar'],
    defaultId: 0,
    cancelId: 2,
    title: 'Confirmar Nuevo Proyecto',
    message: '¿Estás seguro de que deseas crear un nuevo proyecto?',
    detail: 'Puedes guardar el proyecto actual o descartarlo.'
  });
  return result.response; // 0: Guardar y Nuevo, 1: Nuevo sin guardar, 2: Cancelar
});
//#endregion

//#region ▶️ Control de reproducción principal
ipcMain.on('play-video', (event, videoPath) => {
  console.log('VideoPath recibido:', videoPath);
  // Verifica si la ventana de reproducción ya existe o está destruida
  if (!playbackWindow || playbackWindow.isDestroyed()) {
    createPlaybackWindow();
    playbackWindow.webContents.once('did-finish-load', () => {
      playbackWindow.show();
      playbackWindow.webContents.send('load-video', videoPath);
    });
  } else {
    playbackWindow.show();
    playbackWindow.webContents.send('load-video', videoPath);
  }
});

ipcMain.on('pause-video', () => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.webContents.send('pause-video');
  }
});

ipcMain.on('resume-video', () => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.webContents.send('resume-video');
  }
});

ipcMain.on('load-video-preview', (event, videoPath) => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.webContents.send('load-video-preview', videoPath);
  }
});


ipcMain.on('finalize-video', () => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.close();
    playbackWindow = null;
  }
});

ipcMain.on('seek-video', (event, newTime) => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.webContents.send('seek-video', newTime);
  }
});

ipcMain.on('time-update', (event, currentTime, duration) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('time-update', currentTime, duration);
  }
});

ipcMain.on('video-ended', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('video-ended');
  }
});
//#endregion

//#region 🔊 Control de volumen
ipcMain.on('set-main-volume', (event, volume) => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.webContents.send('set-main-volume', volume);
  }
});
//#endregion

//#region 🎵 Control de reproducción secundaria
ipcMain.on('play-secondary', (event, secondaryTimeline) => {
  if (secondaryPlaybackWindow && !secondaryPlaybackWindow.isDestroyed()) {
    secondaryPlaybackWindow.show();
    secondaryPlaybackWindow.webContents.send('load-secondary', secondaryTimeline);
  }
});

ipcMain.on('stop-secondary', () => {
  if (secondaryPlaybackWindow && !secondaryPlaybackWindow.isDestroyed()) {
    secondaryPlaybackWindow.webContents.send('stop-secondary');
  }
});
//#endregion

//#region NUEVO: Cerrar reproductores al crear un nuevo proyecto
ipcMain.on('close-playback-windows', () => {
  closeAllWindows();
});
//#endregion

// Recibe configuración de overlay desde renderer y la reenvía al playback
ipcMain.on('set-overlay', (event, overlay) => {
  if (playbackWindow && !playbackWindow.isDestroyed()) {
    playbackWindow.webContents.send('set-overlay', overlay);
  }
});
