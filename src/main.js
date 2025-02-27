const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let playbackWindow;
let secondaryPlaybackWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // para simplificar el ejemplo
      contextIsolation: false
    }
  });
  mainWindow.loadFile('index.html');
}

function createPlaybackWindow() {
  // Buscamos una pantalla secundaria si existe
  let displays = screen.getAllDisplays();
  let externalDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0);
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
  playbackWindow.loadFile('playback.html');
  playbackWindow.hide();
}

function createSecondaryPlaybackWindow() {
  // Esta ventana no se mostrará visualmente (puede estar oculta o ser minimizada)
  secondaryPlaybackWindow = new BrowserWindow({
    show: false, // No se muestra
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  secondaryPlaybackWindow.loadFile('secondary.html');
}

app.whenReady().then(() => {
  createMainWindow();
  createPlaybackWindow();
  createSecondaryPlaybackWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Canales IPC para la secuencia principal (archivo, reproducción, slider, etc.)
ipcMain.handle('open-file-dialog', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: ['mp4', 'mp3', 'avi', 'mkv', 'wav'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('save-sequence', async (event, sequenceData) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar Secuencia',
    defaultPath: 'secuencia.json',
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
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
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    const sequenceData = JSON.parse(data);
    return sequenceData;
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


// Secuencia principal
ipcMain.on('play-video', (event, videoPath) => {
  if (!playbackWindow) {
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
  if (playbackWindow) {
    playbackWindow.webContents.send('pause-video');
  }
});

ipcMain.on('resume-video', () => {
  if (playbackWindow) {
    playbackWindow.webContents.send('resume-video');
  }
});

ipcMain.on('finalize-video', () => {
  if (playbackWindow) {
    playbackWindow.close();
    playbackWindow = null;
  }
});


ipcMain.on('seek-video', (event, newTime) => {
  if (playbackWindow) {
    playbackWindow.webContents.send('seek-video', newTime);
  }
});

ipcMain.on('time-update', (event, currentTime, duration) => {
  if (mainWindow) {
    mainWindow.webContents.send('time-update', currentTime, duration);
  }
});

ipcMain.on('video-ended', () => {
  mainWindow.webContents.send('video-ended');
});

// Secuencia secundaria (timeline) – se envía la "línea de tiempo" completa
ipcMain.on('play-secondary', (event, secondaryTimeline) => {
  if (secondaryPlaybackWindow) {
    secondaryPlaybackWindow.show(); // Aunque la ventana no se muestre, es necesaria para reproducir
    secondaryPlaybackWindow.webContents.send('load-secondary', secondaryTimeline);
  }
});

ipcMain.on('stop-secondary', () => {
  if (secondaryPlaybackWindow) {
    secondaryPlaybackWindow.webContents.send('stop-secondary');
  }
});

ipcMain.on('set-main-volume', (event, volume) => {
  if (playbackWindow) {
    playbackWindow.webContents.send('set-main-volume', volume);
  }
});

