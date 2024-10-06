// roomRenderer.js

// UI Elements
const roomNameDisplay = document.getElementById('room-name');
const fileInput = document.getElementById('file-input');
const fileError = document.getElementById('file-error');
const fileSelection = document.getElementById('file-selection');
const videoPlayerContainer = document.getElementById('video-player');
const videoPlayer = document.getElementById('video-player-main');

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');

const errorMsg = document.getElementById('error');

// Get Room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('roomId');

if (!roomId) {
  errorMsg.textContent = 'No Room ID provided.';
  // Optionally, redirect back to the landing page
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2000);
}

// Display Room Name
roomNameDisplay.textContent = `Room: ${roomId}`;

// Handle WebSocket Initialization
window.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.initializeWebSocket('ws://192.168.61.120:8080'); // Replace with your server's IP if needed
});

// Handle incoming WebSocket messages
window.electronAPI.onMessage((message) => {
  let data;
  try {
    data = JSON.parse(message);
  } catch (error) {
    console.error('Invalid JSON:', error);
    return;
  }

  switch (data.type) {
    case 'both_joined':
      // Both users have joined, show file selection
      fileSelection.style.display = 'flex';
      break;

    case 'file_info':
      remoteDuration = data.duration;
      verifyFiles();
      break;

    case 'sync_action':
      handleSyncAction(data);
      break;

    case 'chat_message':
      appendChatMessage('Peer', data.message);
      break;

    case 'peer_left':
      appendChatMessage('System', 'Peer has left the room.');
      break;

    case 'error':
      errorMsg.textContent = data.message;
      break;

    case 'server_disconnected':
      errorMsg.textContent = 'Disconnected from server.';
      break;

    case 'server_error':
      errorMsg.textContent = `Server Error: ${data.message}`;
      break;

    default:
      console.log('Unknown message type:', data.type);
      break;
  }
});

// Send join_room message upon loading the room
window.addEventListener('DOMContentLoaded', () => {
  if (roomId) {
    window.electronAPI.sendMessage(JSON.stringify({ type: 'join_room', roomId }));
  }
});

// File selection and verification
let localDuration = null;
let remoteDuration = null;
let isFileVerified = false;

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
      window.electronAPI.sendMessage(JSON.stringify({ type: 'file_info', duration: localDuration }));
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
let isSyncing = false;

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
    window.electronAPI.sendMessage(JSON.stringify({ type: 'sync_action', action: 'play', currentTime: videoPlayer.currentTime }));
  }
});

videoPlayer.addEventListener('pause', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    console.log('Sending pause action to peer');
    window.electronAPI.sendMessage(JSON.stringify({ type: 'sync_action', action: 'pause', currentTime: videoPlayer.currentTime }));
  }
});

videoPlayer.addEventListener('seeked', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    // Implement debouncing to prevent rapid-fire seek events
    clearTimeout(seekDebounceTimer);
    seekDebounceTimer = setTimeout(() => {
      console.log('Sending seek action to peer');
      window.electronAPI.sendMessage(JSON.stringify({ type: 'sync_action', action: 'seek', currentTime: videoPlayer.currentTime }));
    }, SEEK_DEBOUNCE_DELAY);
  }
});

// Debounce timer for seek events
let seekDebounceTimer = null;
const SEEK_DEBOUNCE_DELAY = 300; // milliseconds

// Chat Functionality

// Send chat message
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message && isPeerReady()) {
    const chatData = { type: 'chat_message', message };
    window.electronAPI.sendMessage(JSON.stringify(chatData));
    appendChatMessage('You', message);
    chatInput.value = '';
  }
});

// Check if peer is ready
function isPeerReady() {
  // Both users have joined and file is verified
  return isFileVerified;
}

// Append chat message to the chat box with differentiation
function appendChatMessage(sender, message) {
  const messageElement = document.createElement('div');
  if (sender === 'You') {
    // Sent messages
    messageElement.classList.add('self-end', 'bg-blue-500', 'text-white', 'p-2', 'rounded-md', 'mb-2', 'max-w-xs');
  } else if (sender === 'System') {
    // System messages
    messageElement.classList.add('self-center', 'bg-yellow-500', 'text-white', 'p-2', 'rounded-md', 'mb-2', 'max-w-xs');
  } else {
    // Received messages
    messageElement.classList.add('self-start', 'bg-gray-300', 'text-gray-800', 'p-2', 'rounded-md', 'mb-2', 'max-w-xs');
  }
  messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  window.electronAPI.sendMessage(JSON.stringify({ type: 'disconnect' }));
});
