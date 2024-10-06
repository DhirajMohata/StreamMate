// renderer.js
const { ipcRenderer } = require('electron');

// Video Elements
const videoPlayerContainer = document.getElementById('video-player'); // Container div
const videoPlayer = document.getElementById('video-player-main'); // Video element

// Chat Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');

// Voice and Video Call Buttons
const voiceCallBtn = document.getElementById('voice-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');

// Video Call Elements
const videoCallContainer = document.getElementById('video-call-container');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

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

// WebRTC Variables
let localStream = null;
let peerConnection = null;

// STUN Servers - Publicly available for development
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // You can add TURN servers here for better connectivity
  ]
};

// Initialize WebSocket connection
function initWebSocket() {
  ws = new WebSocket('ws://192.168.107.56:8080'); // Replace with your server's IP

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

      case 'voice_call':
        await handleIncomingCall('voice');
        break;

      case 'video_call':
        await handleIncomingCall('video');
        break;

      case 'call_offer':
        await handleCallOffer(data);
        break;

      case 'call_answer':
        await handleCallAnswer(data);
        break;

      case 'ice_candidate':
        await handleNewICECandidate(data);
        break;

      case 'error':
        errorMsg.textContent = data.message;
        break;

      case 'peer_left':
        errorMsg.textContent = 'Peer has left the room.';
        videoPlayerContainer.style.display = 'none';
        fileSelection.style.display = 'none';
        endCall();
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

// Append chat message to the chat box
function appendChatMessage(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('mb-2');
  messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Voice and Video Call Functionality

// Handle Voice Call Button Click
voiceCallBtn.addEventListener('click', async () => {
  if (isPeerReady) {
    initiateCall('voice');
  }
});

// Handle Video Call Button Click
videoCallBtn.addEventListener('click', async () => {
  if (isPeerReady) {
    initiateCall('video');
  }
});

// Initiate Call (Voice or Video)
async function initiateCall(callType) {
  try {
    // Get user media
    const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;

    // Display video call container if it's a video call
    if (callType === 'video') {
      videoCallContainer.classList.remove('hidden');
    }

    // Create RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteVideo.srcObject = remoteStream;
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: event.candidate,
          roomId: roomIdInput.value.trim()
        }));
      }
    };

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to peer
    ws.send(JSON.stringify({
      type: callType === 'video' ? 'video_call' : 'voice_call',
      offer: offer,
      roomId: roomIdInput.value.trim()
    }));

    console.log(`${callType} call initiated.`);
  } catch (error) {
    console.error('Error initiating call:', error);
    errorMsg.textContent = `Error initiating call: ${error.message}`;
  }
}

// Handle Incoming Call (Voice or Video)
async function handleIncomingCall(callType) {
  try {
    // Get user media
    const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true, video: false };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;

    // Display video call container if it's a video call
    if (callType === 'video') {
      videoCallContainer.classList.remove('hidden');
    }

    // Create RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream tracks to peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteVideo.srcObject = remoteStream;
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'ice_candidate',
          candidate: event.candidate,
          roomId: roomIdInput.value.trim()
        }));
      }
    };

    console.log(`Incoming ${callType} call received.`);

  } catch (error) {
    console.error('Error handling incoming call:', error);
    errorMsg.textContent = `Error handling incoming call: ${error.message}`;
  }
}

// Handle Call Offer
async function handleCallOffer(data) {
  try {
    const offer = data.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send answer back to caller
    ws.send(JSON.stringify({
      type: 'call_answer',
      answer: answer,
      roomId: roomIdInput.value.trim()
    }));

    console.log('Call offer handled and answer sent.');
  } catch (error) {
    console.error('Error handling call offer:', error);
    errorMsg.textContent = `Error handling call offer: ${error.message}`;
  }
}

// Handle Call Answer
async function handleCallAnswer(data) {
  try {
    const answer = data.answer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    console.log('Call answer received and set.');
  } catch (error) {
    console.error('Error handling call answer:', error);
    errorMsg.textContent = `Error handling call answer: ${error.message}`;
  }
}

// Handle New ICE Candidate
async function handleNewICECandidate(data) {
  try {
    const candidate = data.candidate;
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('New ICE candidate added.');
  } catch (error) {
    console.error('Error adding received ICE candidate:', error);
    errorMsg.textContent = `Error adding ICE candidate: ${error.message}`;
  }
}

// End Call and Clean Up
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  videoCallContainer.classList.add('hidden');
}

// Handle Incoming Call Type (voice or video)
async function handleIncomingCall(data) {
  const callType = data.type === 'video_call' ? 'video' : 'voice';
  await handleIncomingCall(callType);
}

// Synchronize play, pause, and seek actions with checks
videoPlayer.addEventListener('play', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    console.log('Sending play action to peer');
    ws.send(JSON.stringify({ type: 'sync_action', action: 'play', currentTime: videoPlayer.currentTime, roomId: roomIdInput.value.trim() }));
  }
});

videoPlayer.addEventListener('pause', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    console.log('Sending pause action to peer');
    ws.send(JSON.stringify({ type: 'sync_action', action: 'pause', currentTime: videoPlayer.currentTime, roomId: roomIdInput.value.trim() }));
  }
});

videoPlayer.addEventListener('seeked', () => {
  if (isFileVerified && !isSyncing) { // Check if not syncing
    // Implement debouncing to prevent rapid-fire seek events
    clearTimeout(seekDebounceTimer);
    seekDebounceTimer = setTimeout(() => {
      console.log('Sending seek action to peer');
      ws.send(JSON.stringify({ type: 'sync_action', action: 'seek', currentTime: videoPlayer.currentTime, roomId: roomIdInput.value.trim() }));
    }, SEEK_DEBOUNCE_DELAY);
  }
});
