const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
    importSongs: (directory) => ipcRenderer.invoke('import-songs', directory),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', callback),
    savePlaylist: (data, playlistName) => {
        // Use IPC to request the main process to save the file
        return ipcRenderer.invoke('savePlaylist', data, playlistName);
    } 
})
