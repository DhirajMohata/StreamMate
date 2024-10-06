// renderer.js
const { ipcRenderer } = require('electron');

// Correctly reference the container div and video element
const videoPlayerContainer = document.getElementById('video-player'); // Container div
const videoPlayer = document.getElementById('video-player-main'); // Video element

const fileInput = document.getElementById('file-input');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const roomIdInput = document.getElementById('room-id-input');
const roomInfo = document.getElementById('room-info');
const errorMsg = document.getElementById('error');
const fileError = document.getElementById('file-error');
const fileSelection = document.getElementById('file-selection');

let ws;
let isPeerReady = false;
let isFileVerified = false;
let localDuration = null;
let remoteDuration = null;

// Flag to prevent sync loop
let isSyncing = false;

// Debounce timer for seek events
let seekDebounceTimer = null;
const SEEK_DEBOUNCE_DELAY = 300; // milliseconds

// Initialize WebSocket connection
function initWebSocket() {
  ws = new WebSocket('ws://192.168.107.56:8080'); // Replace with your server's IP

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
  };

  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);

    switch (data.type) {
      case 'room_created':
        roomInfo.textContent = `Room Created. ID: ${data.roomId}`;
        break;

      case 'room_joined':
        roomInfo.textContent = `Joined Room: ${data.roomId}`;
        break;

      case 'both_joined':
        isPeerReady = true;
        fileSelection.style.display = 'flex'; // Use flex for better alignment
        break;

      case 'file_info':
        remoteDuration = data.duration;
        verifyFiles();
        break;

      case 'sync_action':
        handleSyncAction(data);
        break;

      case 'error':
        errorMsg.textContent = data.message;
        break;

      case 'peer_left':
        errorMsg.textContent = 'Peer has left the room.';
        videoPlayerContainer.style.display = 'none';
        fileSelection.style.display = 'none';
        break;

      default:
        break;
    }
  };

  ws.onclose = () => {
    console.log('Disconnected from WebSocket server');
  };
}

initWebSocket();

// Room creation
createRoomBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'create_room' }));
  errorMsg.textContent = '';
});

// Room joining
joinRoomBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (roomId) {
    ws.send(JSON.stringify({ type: 'join_room', roomId }));
    errorMsg.textContent = '';
  } else {
    errorMsg.textContent = 'Please enter a Room ID to join.';
  }
});

// File selection and verification
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const videoURL = URL.createObjectURL(file);
    videoPlayer.src = videoURL;
    videoPlayerContainer.style.display = 'flex'; // Show the video player container
    fileError.textContent = '';

    // Get video duration
    videoPlayer.onloadedmetadata = () => {
      localDuration = videoPlayer.duration;
      ws.send(JSON.stringify({ type: 'file_info', duration: localDuration }));
      verifyFiles();
    };
  }
});

// Verify if both files have the same duration
function verifyFiles() {
  if (localDuration !== null && remoteDuration !== null) {
    const epsilon = 0.1; // Allow slight difference
    if (Math.abs(localDuration - remoteDuration) < epsilon) {
      isFileVerified = true;
      fileError.textContent = '';
      console.log('Files are verified to have the same duration.');
    } else {
      isFileVerified = false;
      fileError.textContent = 'Selected files do not have the same duration.';
      videoPlayerContainer.style.display = 'none'; // Hide the container if verification fails
    }
  }
}

// Handle synchronization actions from the peer
function handleSyncAction(data) {
  if (!isFileVerified) return;

  console.log(`Action received from peer: ${data.action} at ${data.currentTime}`);

  isSyncing = true; // Set flag before performing the action

  switch (data.action) {
    case 'play':
      videoPlayer.currentTime = data.currentTime;
      videoPlayer.play();
      break;
    case 'pause':
      videoPlayer.currentTime = data.currentTime;
      videoPlayer.pause();
      break;
    case 'seek':
      videoPlayer.currentTime = data.currentTime;
      break;
    default:
      break;
  }

  // Use a timeout to ensure all related events are handled
  setTimeout(() => {
    isSyncing = false; // Reset flag after action
  }, 100); // 100ms delay
}

// Synchronize play, pause, and seek actions with checks
videoPlayer.addEventListener('play', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    console.log('Sending play action to peer');
    ws.send(JSON.stringify({ type: 'sync_action', action: 'play', currentTime: videoPlayer.currentTime }));
  }
});

videoPlayer.addEventListener('pause', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    console.log('Sending pause action to peer');
    ws.send(JSON.stringify({ type: 'sync_action', action: 'pause', currentTime: videoPlayer.currentTime }));
  }
});

videoPlayer.addEventListener('seeked', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    // Implement debouncing to prevent rapid-fire seek events
    clearTimeout(seekDebounceTimer);
    seekDebounceTimer = setTimeout(() => {
      console.log('Sending seek action to peer');
      ws.send(JSON.stringify({ type: 'sync_action', action: 'seek', currentTime: videoPlayer.currentTime }));
    }, SEEK_DEBOUNCE_DELAY);
  }
});
