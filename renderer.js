// renderer.js
const { ipcRenderer } = require('electron');

// UI Elements
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

// Chat Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');

// Call Elements (Assuming you have these in your HTML)
const voiceCallBtn = document.getElementById('voice-call');
const videoCallBtn = document.getElementById('video-call');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let ws;
let isPeerReady = false;
let isFileVerified = false;
let localDuration = null;
let remoteDuration = null;

// WebRTC Variables
let peerConnection;
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, // Public STUN server
  ]
};

// Queue to hold ICE candidates received before remote description is set
let iceCandidateQueue = [];

// Flag to prevent sync loop
let isSyncing = false;

// Debounce timer for seek events
let seekDebounceTimer = null;
const SEEK_DEBOUNCE_DELAY = 300; // milliseconds

// Initialize WebSocket connection
function initWebSocket() {
  ws = new WebSocket('ws://192.168.61.120:8080'); // Replace with your server's IP

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
  };

  ws.onmessage = async (message) => {
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
        // Initialize WebRTC Peer Connection
        initializePeerConnection();
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

      case 'ice_candidate':
        await handleRemoteIceCandidate(data.candidate);
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

// Initialize WebRTC Peer Connection
function initializePeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice_candidate', candidate: event.candidate }));
    }
  };

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // Add local stream if any (for voice/video calls)
  // This section can be expanded based on call implementations
}

// Handle incoming ICE candidates
async function handleRemoteIceCandidate(candidate) {
  try {
    if (peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue the candidate if remote description is not set yet
      iceCandidateQueue.push(candidate);
    }
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

// After setting remote description, process the queued ICE candidates
async function setRemoteDescriptionAndProcessQueue(description) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(description));

    // Process queued ICE candidates
    while (iceCandidateQueue.length > 0) {
      const candidate = iceCandidateQueue.shift();
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    console.error('Error setting remote description:', error);
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

// Chat Functionality

// Send chat message
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message && isPeerReady) {
    const chatData = { type: 'chat_message', message };
    ws.send(JSON.stringify(chatData));
    appendChatMessage('You', message);
    chatInput.value = '';
  }
});

// Append chat message to the chat box with differentiation
function appendChatMessage(sender, message) {
  const messageElement = document.createElement('div');
  if (sender === 'You') {
    // Sent messages
    messageElement.classList.add('self-end', 'bg-blue-500', 'text-white', 'p-2', 'rounded-md', 'mb-2', 'max-w-xs');
  } else {
    // Received messages
    messageElement.classList.add('self-start', 'bg-gray-300', 'text-gray-800', 'p-2', 'rounded-md', 'mb-2', 'max-w-xs');
  }
  messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
