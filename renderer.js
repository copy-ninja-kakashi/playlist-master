// Declare the audio variable and button variables
let audio; // Global audio variable
let playPauseBtn; // Global variable for play/pause button
let currentSongIndex = null; // Global variable for current song index
let importedSongs = []; // Global variable to store imported songs
let contextMenu; // Context menu 
let playlistContextMenu; 
let playlistCounter = 0; // Global counter for untitled playlists
let playlistUl;
let selectedPlaylist = '';
let currentPlaylistName = '';
let audioContext; // Global audio context
let analyser; // Global analyser node
let canvas; // Global canvas for p5.js visualization
let playProgressBar; // Global variable for the progress bar
let playlists = []; 

document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('import-btn');
    playlistUl = document.getElementById('play-list');
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    const saveBtn = document.getElementById('save-btn');
    playPauseBtn = document.getElementById('play-pause-btn'); 
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn'); 
    // Initialize the context menu
    contextMenu = document.getElementById('context-menu');
    playlistContextMenu = document.getElementById('playlistContextMenu');
    playProgressBar = document.getElementById('play-progress-bar'); // Get the progress bar
    
    // Add event listener to handle seeking
    playProgressBar.addEventListener('input', () => {
        if (audio) {
            const seekTime = audio.duration * (playProgressBar.value / 100); // Calculate the seek time
            audio.currentTime = seekTime; // Update the audio's current time
        }
    });

    // Initialize the audio element
    audio = new Audio(); // Create an audio element
    audio.addEventListener('timeupdate', updateplayProgressBar);

    // Add event listener
    importBtn.addEventListener('click', openDirectoryDialog);
    saveBtn.addEventListener('click', () => savePlaylist(currentPlaylistName)); // Pass the correct name
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPreviousSong);
    nextBtn.addEventListener('click', playNextSong);
    document.addEventListener('click', hideContextMenu);
    
    addPlaylistBtn.addEventListener('click', async () => {
        // Trigger import when the "+" button is clicked
        await openDirectoryDialog();
        // After importing, generate playlist name
        currentPlaylistName = generateDefaultPlaylistName(); // Set current playlist name
        playlists.push(currentPlaylistName); // Add the new playlist to the array
        displayPlaylists(); // Update the UI with the new playlist
        selectPlaylist(currentPlaylistName); // Automatically select the new playlist
    });
});


// Function to display the playlists
function displayPlaylists() {
    const ul = document.getElementById('play-list');
    ul.innerHTML = ''; // Clear the list

    playlists.forEach((playlist, index) => {
        const li = document.createElement('li');
        li.textContent = playlist;

        // Add event listener to select the playlist when clicked
        li.addEventListener('click', () => {
            selectPlaylist(playlist); // Call selectPlaylist on click
        });

        // Add event listener for right-click context menu for playlists
        li.addEventListener('contextmenu', (event) => {
            selectedPlaylist = playlist; // Set the current playlist as selected
            showPlaylistContextMenu(event); // Show the context menu
        });

        // Add double-click event to rename the playlist
        li.addEventListener('dblclick', () => {
            renamePlaylist(li, index); // Call the rename function
        });
        
        ul.appendChild(li);
    });
}

// Function to open directory selection dialog
async function openDirectoryDialog() {
    try {
        const result = await window.api.openDirectoryDialog();
        console.log("Directory Dialog Result:", result);
        if (result.length > 0) {
            const directory = result[0]; // Get the selected directory path
            importSongs(directory);  // Import songs from the selected directory
        }
    } catch (error) {
        console.error('Failed to open directory dialog:', error);
    }
}

async function importSongs(directory) {
    try {
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        progressContainer.style.display = 'block';
        progressBar.innerText = 'Loading...';
        progressBar.style.width = '100%';

        const newSongs = await window.api.importSongs(directory);
        progressContainer.style.display = 'none';

        // Store the imported songs in the selected playlist
        playlists[currentPlaylistName] = playlists[currentPlaylistName] || []; // Ensure it's initialized
        newSongs.forEach(song => {
            if (!playlists[currentPlaylistName].some(existingSong => existingSong.file_path === song.file_path)) {
                playlists[currentPlaylistName].push(song); // Add new song to the current playlist
            }
        });

        displaySongs(playlists[currentPlaylistName]); // Display songs for the current playlist
    } catch (error) {
        console.error('Failed to import songs:', error);
        document.getElementById('progress-container').style.display = 'none';
    }
}

// Function to handle playlist selection
function selectPlaylist(playlistName) {
    // Update the global selectedPlaylist variable
    selectedPlaylist = playlistName;
    currentPlaylistName = playlistName;

    // Clear previously selected playlist styling
    const previouslySelected = document.querySelector('.selected-playlist');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected-playlist');
    }

    // Highlight the newly selected playlist
    const currentPlaylistElement = Array.from(document.getElementById('play-list').children)
        .find(li => li.textContent === playlistName);
    if (currentPlaylistElement) {
        currentPlaylistElement.classList.add('selected-playlist');
    }

    // Load songs for the selected playlist
    const songsInSelectedPlaylist = playlists[playlistName] || []; // Get songs for the playlist
    displaySongs(songsInSelectedPlaylist); // Display songs only in the selected playlist
}


// For progress tracking
window.api.onUpdateProgress(() => {
    const progressBar = document.getElementById('progress-bar');
    // Simply show "Loading..." when there is progress
    progressBar.innerText = 'Loading...';
    progressBar.style.width = '100%';
});

// Function to show the context menu
function showContextMenu(event, songIndex) {
    event.preventDefault(); // Prevent the default context menu
    // Set the position of the context menu
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.style.display = 'block';

    // Add event listener for removing the song
    const removeSongOption = document.getElementById('remove-song');
    removeSongOption.onclick = () => {
        removeSong(songIndex);
        hideContextMenu(); // Hide the context menu after action
    };
     // Add event listener for creating visual effect
     const createVisualEffectOption = document.getElementById('create-visual-effect');
     createVisualEffectOption.onclick = () => {
         createVisualEffect(songIndex); // Call the function to create visual effects
         hideContextMenu(); // Hide the context menu after action
    };
}

// Function to hide the context menu
function hideContextMenu() {
    contextMenu.style.display = 'none';
    playlistContextMenu.style.display = 'none';// Event listener to hide context menu when clicking outside
    document.addEventListener('click', (event) => {
        const playlistContextMenu = document.getElementById('playlistContextMenu');
        if (playlistContextMenu && !playlistContextMenu.contains(event.target)) {
            hideContextMenu(); // Hide the context menu if clicked outside
        }
    });
}

// Function to show the context menu for playlists
function showPlaylistContextMenu(event) {
    event.preventDefault();
    playlistContextMenu.style.left = `${event.pageX}px`;
    playlistContextMenu.style.top = `${event.pageY}px`;
    playlistContextMenu.style.display = 'block';

    const deletePlaylistOption = document.getElementById('delete-playlist');
    deletePlaylistOption.onclick = () => {
        deletePlaylist(selectedPlaylist);
        hideContextMenu();
    };
}

// Function to delete a playlist
function deletePlaylist(playlistName) {
    const playlistIndex = playlists.indexOf(playlistName); // Find the index of the playlist to delete
    if (playlistIndex > -1) {
        playlists.splice(playlistIndex, 1); // Remove the playlist from the array
        displayPlaylists(); // Refresh the displayed playlists

        // Check if there are any remaining playlists
        if (playlists.length > 0) {
            const nextPlaylistIndex = playlistIndex >= playlists.length ? playlists.length - 1 : playlistIndex; // Get the next playlist index
            selectPlaylist(playlists[nextPlaylistIndex]); // Select and display the next playlist
        } else {
            // If no playlists remain, clear the displayed songs
            const tbody = document.querySelector('#song-table tbody');
            tbody.innerHTML = ''; // Clear the song table
            currentPlaylistName = ''; // Clear current playlist name
            console.log("No playlists remaining."); // Optional: Feedback for debugging
        }

        console.log(`Playlist '${playlistName}' deleted.`);
    } else {
        console.log(`Playlist '${playlistName}' not found.`); // Optional: Feedback if playlist is not found
    }
}


// Function to remove a song from the table
function removeSong(index) {
    importedSongs.splice(index, 1); // Remove song from the array
    displaySongs(importedSongs); // Update the displayed songs
}



function selectSong(index, file_path) {
    if (file_path) { // Check if file_path is valid
        currentSongIndex = index;
        audio.src = file_path; // Set the audio source
        audio.load(); // Load the new audio source
        console.log("Selected song:", file_path); // Log the selected song's source
        updateRowStyles(); // Update row styles for selection
    } else {
        console.error('Invalid file path or audio source.');
    }
}
// Function to toggle play/pause
function togglePlayPause() {
    if (currentSongIndex !== null) {
        if (audio.paused) {
            audio.play();
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            audio.pause();
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    } else {
        console.log("No song selected."); // Optional: Feedback if no song is selected
    }
}

// Function to update styles for selected rows
function updateRowStyles() {
    const rows = document.querySelectorAll('#song-table tbody tr');
    rows.forEach((row, index) => {
        if (index === currentSongIndex) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

// Function to play the previous song
function playPreviousSong() {
    if (currentSongIndex !== null && currentSongIndex > 0) {
        currentSongIndex--; // Decrement the index
        const song = getSongByIndex(currentSongIndex);
        if (song) {
            selectSong(currentSongIndex, song.file_path); // Set the new song
            audio.play(); // Play the selected song
            updateRowStyles(); // Update row styles
        }
    }
}

// Function to play the next song
function playNextSong() {
    if (currentSongIndex !== null && currentSongIndex < document.querySelectorAll('#song-table tbody tr').length - 1) {
        currentSongIndex++; // Increment the index
        const song = getSongByIndex(currentSongIndex);
        if (song) {
            selectSong(currentSongIndex, song.file_path); // Set the new song
            audio.play(); // Play the selected song
            updateRowStyles(); // Update row styles
        }
    }
}

// Function to get song by index
function getSongByIndex(index) {
    const tbody = document.querySelector('#song-table tbody');
    const rows = tbody.querySelectorAll('tr');
    if (rows[index]) {
        return {
            name: rows[index].cells[0].textContent,
            key: rows[index].cells[1].textContent,
            tempo: rows[index].cells[2].textContent,
            genre: rows[index].cells[3].textContent,
            file_path: rows[index].dataset.filePath // Assuming you store file_path in a data attribute
        };
    }
    return null;
}

// Modify the displaySongs function to include context menu event listeners
function displaySongs(songs) {
    const tbody = document.querySelector('#song-table tbody');
    tbody.innerHTML = '';  // Clear the table body

    songs.forEach((song, index) => {
        const row = document.createElement('tr');
        row.innerHTML = 
            `<td>${song.name}</td>
            <td>${song.key}</td>
            <td>${song.tempo}</td>
            <td>${song.genre}</td>`;
        row.dataset.filePath = song.file_path; // Store file path in a data attribute

        // Add event listener for song selection
        row.addEventListener('click', () => {
            selectSong(index, song.file_path); // Pass the song index and source
        });

        // Add event listener for right-click context menu
        row.addEventListener('contextmenu', (event) => {
            showContextMenu(event, index); // Pass the song index to the context menu
        });

        tbody.appendChild(row);
    });

    addSortingListeners(); // Re-apply sorting listeners if needed
}

// Function to add sorting listeners to table headers
function addSortingListeners() {
    const headers = document.querySelectorAll('th[data-column]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            sortTableByColumn(column, 'asc'); // Always sort in ascending order
        });
    });
}

function sortTableByColumn(column, direction = 'asc') { // Default to ascending order
    const tbody = document.querySelector('#song-table tbody');
    const thead = document.querySelector('#song-table thead');
    const headers = Array.from(thead.rows[0].cells);
    const rows = Array.from(tbody.rows);
    const index = headers.findIndex(cell => cell.dataset.column === column);
    
    if (index === -1) {
        console.error('No column found for:', column);
        return; // Exit the function if the column is not found
    }

    console.log(`Sorting column: ${column} in ${direction} order`);

    rows.sort((a, b) => {
        const aText = a.cells[index].textContent.trim();
        const bText = b.cells[index].textContent.trim();

        // Check if the column is a number
        const isNumeric = !isNaN(aText) && !isNaN(bText);

        // Compare accordingly
        if (isNumeric) {
            const aNum = parseFloat(aText); // Convert to number
            const bNum = parseFloat(bText); // Convert to number
            return aNum - bNum; // Always sort in ascending order
        } else {
            // Debugging: log the text being compared
            console.log(`Comparing strings: "${aText}" with "${bText}"`);
            return aText.localeCompare(bText); // Always sort in ascending order
        }
    });

    tbody.innerHTML = ''; // Clear the table body
    rows.forEach(row => tbody.appendChild(row)); // Append sorted rows
}



// Function to generate a default playlist name
function generateDefaultPlaylistName() {
    return `Untitled Playlist ${++playlistCounter}`;
}

// savePlaylist function
function savePlaylist(playlistName = currentPlaylistName) {
    const songs = playlists[playlistName] || []; // Get songs from the current playlist

    const playlistData = {
        name: playlistName,
        songs: songs
    };

    const playlistJSON = JSON.stringify(playlistData, null, 2);

    window.api.savePlaylist(playlistJSON, playlistName)
        .then(result => {
            if (result) {
                console.log(`Playlist '${playlistName}' saved successfully!`);
                showNotification(`Playlist '${playlistName}' saved successfully!`);
            } else {
                console.log('Playlist save was canceled.');
            }
        })
        .catch(error => {
            console.error('Error saving playlist:', error);
        });
}

// Function to show notification (can use a library or custom implementation)
function showNotification(message) {
    const notification = new Notification("Playlist Saved", {
        body: message,
    });
    notification.onclick = () => {
        console.log('Notification clicked');
    };
}

// Function to rename a playlist
function renamePlaylist(playlistElement, index) {
    const currentName = playlists[index];
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;

    // Replace the playlist name with an input field
    playlistElement.innerHTML = '';
    playlistElement.appendChild(input);
    input.focus();

    // Add event listeners for input field
    input.addEventListener('blur', () => {
        const newName = input.value.trim();
        updatePlaylistName(index, newName);
        playlistElement.innerHTML = newName; // Restore playlist name
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const newName = input.value.trim();
            updatePlaylistName(index, newName);
            playlistElement.innerHTML = newName; // Restore playlist name
        }
    });
}

// Function to update playlist name
function updatePlaylistName(index, newName) {
    if (newName && !playlists.includes(newName)) {
        playlists[index] = newName; // Update the name in the playlists array
        displayPlaylists(); // Refresh the displayed playlists
    } else {
        console.log("Invalid playlist name or already exists.");
        }

}

function createVisualEffect(songIndex) {
    const song = getSongByIndex(songIndex);
    if (song) {
        window.localStorage.setItem('currentSong', song.file_path); // Store current song path
        window.open('visualization.html', '_blank', 'width=800,height=600'); // Open visualization in a new window
    }
}
function updateplayProgressBar() {
    if (audio && audio.duration) {
        const progress = (audio.currentTime / audio.duration) * 100; // Calculate progress percentage
        playProgressBar.value = progress; // Update the progress bar's value
    }
}

function update() {
    if (audio && audio.duration) { // Check if audio is defined and has duration
        if (!audio.paused) {
            updateplayProgressBar(); // Update the progress bar
        }
    }
    requestAnimationFrame(update); // Call update again for the next frame
}

requestAnimationFrame(update); // Start the update loop
