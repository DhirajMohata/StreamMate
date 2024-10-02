// renderer.js
const { ipcRenderer } = require('electron');
const videoPlayer = document.getElementById('video-player');
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

// Initialize WebSocket connection
function initWebSocket() {
  ws = new WebSocket('ws://localhost:8080');

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
        fileSelection.style.display = 'block';
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
        videoPlayer.style.display = 'none';
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
    videoPlayer.style.display = 'block';
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
      videoPlayer.style.display = 'none';
    }
  }
}

// Handle synchronization actions from the peer
function handleSyncAction(data) {
  if (!isFileVerified) return;

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
}

// Synchronize play, pause, and seek actions
videoPlayer.addEventListener('play', () => {
  if (isFileVerified) {
    ws.send(JSON.stringify({ type: 'sync_action', action: 'play', currentTime: videoPlayer.currentTime }));
  }
});

videoPlayer.addEventListener('pause', () => {
  if (isFileVerified) {
    ws.send(JSON.stringify({ type: 'sync_action', action: 'pause', currentTime: videoPlayer.currentTime }));
  }
});

videoPlayer.addEventListener('seeked', () => {
  if (isFileVerified) {
    ws.send(JSON.stringify({ type: 'sync_action', action: 'seek', currentTime: videoPlayer.currentTime }));
  }
});
