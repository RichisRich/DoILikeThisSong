const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readAudioFiles: (folderPath) => ipcRenderer.invoke('read-audio-files', folderPath),
  getMetadata: (filePath) => ipcRenderer.invoke('get-metadata', filePath),
  moveRatedFiles: (folderPath, ratings) => ipcRenderer.invoke('move-rated-files', folderPath, ratings)
});
