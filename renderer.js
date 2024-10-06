// renderer.js

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

// Call Elements
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const videoCallPopup = document.getElementById('video-call-popup');
const closeCallBtn = document.getElementById('close-call');

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

// Media Streams
let localStream = null;

// Initialize WebSocket
function initializeWebSocket() {
  window.electronAPI.initializeWebSocket('ws://192.168.61.120:8080'); // Replace with your server's IP if needed
}

initializeWebSocket();

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
    case 'room_created':
      roomInfo.textContent = `Room Created. ID: ${data.roomId}`;
      break;

    case 'room_joined':
      roomInfo.textContent = `Joined Room: ${data.roomId}`;
      break;

    case 'both_joined':
      isPeerReady = true;
      fileSelection.style.display = 'flex'; // Show file selection
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

    case 'offer':
      handleOffer(data.offer);
      break;

    case 'answer':
      handleAnswer(data.answer);
      break;

    case 'ice_candidate':
      handleRemoteIceCandidate(data.candidate);
      break;

    case 'peer_left':
      handlePeerDisconnection();
      break;

    case 'error':
      errorMsg.textContent = data.message;
      break;

    case 'server_disconnected':
      handleServerDisconnection();
      break;

    case 'server_error':
      handleServerError(data.message);
      break;

    default:
      console.log('Unknown message type:', data.type);
      break;
  }
});

// Room creation
createRoomBtn.addEventListener('click', () => {
  window.electronAPI.sendMessage(JSON.stringify({ type: 'create_room' }));
  errorMsg.textContent = '';
});

// Room joining
joinRoomBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (roomId) {
    window.electronAPI.sendMessage(JSON.stringify({ type: 'join_room', roomId }));
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

// Chat Functionality

// Send chat message
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message && isPeerReady) {
    const chatData = { type: 'chat_message', message };
    window.electronAPI.sendMessage(JSON.stringify(chatData));
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

// WebRTC Signaling

// Initialize WebRTC Peer Connection
function initializePeerConnection() {
  if (peerConnection) {
    console.warn('PeerConnection already exists');
    return;
  }

  peerConnection = new RTCPeerConnection(configuration);

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      window.electronAPI.sendMessage(JSON.stringify({ type: 'ice_candidate', candidate: event.candidate }));
    }
  };

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // Handle connection state change
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      console.log('Peers connected!');
    } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
      console.log('Peer disconnected.');
      handlePeerDisconnection();
    }
  };
}

// Handle Offer
async function handleOffer(offer) {
  try {
    if (!peerConnection) {
      initializePeerConnection();
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    // Add any queued ICE candidates
    while (iceCandidateQueue.length > 0) {
      const candidate = iceCandidateQueue.shift();
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    window.electronAPI.sendMessage(JSON.stringify({ type: 'answer', answer }));
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

// Handle Answer
async function handleAnswer(answer) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    // Add any queued ICE candidates
    while (iceCandidateQueue.length > 0) {
      const candidate = iceCandidateQueue.shift();
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (error) {
    console.error('Error handling answer:', error);
  }
}

// Handle Remote ICE Candidate
async function handleRemoteIceCandidate(candidate) {
  try {
    if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue the candidate if remote description is not set yet
      iceCandidateQueue.push(candidate);
    }
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

// Initiate Voice Call
voiceCallBtn.addEventListener('click', async () => {
  if (!isPeerReady) {
    alert('Please join a room first.');
    return;
  }

  if (peerConnection) {
    alert('Already in a call.');
    return;
  }

  try {
    // Get user's audio stream
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localVideo.srcObject = localStream;

    // Initialize Peer Connection
    initializePeerConnection();

    // Add audio tracks to Peer Connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    window.electronAPI.sendMessage(JSON.stringify({ type: 'offer', offer }));

    // Show video call popup (audio-only)
    showVideoCallPopup();
  } catch (error) {
    console.error('Error initiating voice call:', error);
    alert('Failed to initiate voice call. Please check your microphone settings.');
  }
});

// Initiate Video Call
videoCallBtn.addEventListener('click', async () => {
  if (!isPeerReady) {
    alert('Please join a room first.');
    return;
  }

  if (peerConnection) {
    alert('Already in a call.');
    return;
  }

  try {
    // Get user's video and audio stream
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localVideo.srcObject = localStream;
    remoteVideo.srcObject = null; // Clear previous remote stream if any

    // Initialize Peer Connection
    initializePeerConnection();

    // Add video and audio tracks to Peer Connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    window.electronAPI.sendMessage(JSON.stringify({ type: 'offer', offer }));

    // Show video call popup
    showVideoCallPopup();
  } catch (error) {
    console.error('Error initiating video call:', error);
    alert('Failed to initiate video call. Please check your camera and microphone settings.');
  }
});

// Show Video Call Popup
function showVideoCallPopup() {
  videoCallPopup.classList.remove('hidden');
  videoCallPopup.classList.add('flex');
}

// Close Video Call Popup
closeCallBtn.addEventListener('click', () => {
  handlePeerDisconnection();
});

// Clean up on peer disconnection
function handlePeerDisconnection() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  videoCallPopup.classList.add('hidden');
  videoCallPopup.classList.remove('flex');
}

// Handle server disconnection
function handleServerDisconnection() {
  errorMsg.textContent = 'Disconnected from server.';
  handlePeerDisconnection();
}

// Handle server errors
function handleServerError(message) {
  errorMsg.textContent = `Server Error: ${message}`;
}

// Draggable Video Call Popup
makeDraggable(document.getElementById("video-call-popup"));

// Function to make an element draggable
function makeDraggable(element) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  const handleMouseDown = (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = element.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${initialX + dx}px`;
      element.style.top = `${initialY + dy}px`;
    }
  };

  const handleMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  element.addEventListener('mousedown', handleMouseDown);
}
