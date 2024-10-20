const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const os = require('os');
const fs = require('fs-extra'); //  Fs-extra for easy file operations
const { execFile } = require('child_process');
const path = require('path');
const pythonExecutable = path.join(app.getAppPath(), 'venv', 'bin', 'python');
// Directory to save playlists
const playlistsDir = path.join(app.getPath('userData'), 'playlists');

// Create the playlists directory if it doesn't exist
if (!fs.existsSync(playlistsDir)) {
    fs.mkdirSync(playlistsDir);
    console.log(`Playlists directory created at: ${playlistsDir}`);
}

// Function to create a new window
const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        },
    });
    win.loadFile('index.html');
};

// When the app is ready
app.whenReady().then(() => {
    createWindow();

    // Open directory dialog handler
    ipcMain.handle('open-directory-dialog', async () => {
        console.log('Opening directory dialog...');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            if (result.canceled) {
                console.log('Directory selection canceled');
                return []; // Return an empty array if the user cancels
            }
            console.log('Selected directory:', result.filePaths[0]);
            return result.filePaths;
        } catch (error) {
            console.error('Failed to open directory dialog:', error.message);
            throw new Error(`Failed to open directory dialog: ${error.message}`);
        }
    });

   // Handle importing songs
ipcMain.handle('import-songs', async (event, directory) => {
    console.log('Importing songs from directory:', directory);
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(app.getAppPath(), 'importer.py'); 

        console.log('Executing Python script:', pythonExecutable, scriptPath, directory);

        const pythonProcess = execFile(pythonExecutable, [scriptPath, directory]);

        let songs = [];
        // Listen for output from the Python process
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            try {
                // Attempt to parse the output as JSON
                const jsonOutput = JSON.parse(output);

                // Handle progress updates
                if (jsonOutput.progress_updates) {
                    jsonOutput.progress_updates.forEach(progress => {
                        event.sender.send('update-progress', progress.progress);
                    });
                }

                // Handle song data
                if (jsonOutput.song_data) {
                    songs.push(...jsonOutput.song_data); // Collect song data
                }
            } catch (error) {
                console.error('Error parsing Python output:', error);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error('Python script error:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(`Python script exited with code ${code}`);
            }
            resolve(songs);  // Resolve with the song data
        });
    });
});


    // Handle saving the playlist to a file
    ipcMain.handle('savePlaylist', async (_, data, playlistName) => {
        try {
            const filePath = path.join(playlistsDir, `${playlistName}.json`);
            console.log("Saving to file path:", filePath);
            fs.writeFileSync(filePath, data, 'utf-8');
            console.log(`Playlist saved successfully: ${playlistName}`);
            return true; // Return true on success
        } catch (error) {
            console.error("Error during save-file handler:", error);
            throw new Error('Failed to save playlist: ' + error.message);
        }
    });
});

// macOS behavior: Reopen the app on dock click if no windows are open
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Close app when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
