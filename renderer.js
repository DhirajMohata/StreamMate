// renderer.js

// UI Elements
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const roomIdInput = document.getElementById('room-id-input');
const roomInfo = document.getElementById('room-info');
const errorMsg = document.getElementById('error');

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
    case 'room_created':
      roomInfo.textContent = `Room Created. ID: ${data.roomId}`;
      // Redirect to room page after a short delay
      setTimeout(() => {
        window.location.href = `room.html?roomId=${data.roomId}`;
      }, 1000);
      break;

    case 'room_joined':
      roomInfo.textContent = `Joined Room: ${data.roomId}`;
      // Redirect to room page after a short delay
      setTimeout(() => {
        window.location.href = `room.html?roomId=${data.roomId}`;
      }, 1000);
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

// Create Room
createRoomBtn.addEventListener('click', () => {
  window.electronAPI.sendMessage(JSON.stringify({ type: 'create_room' }));
  errorMsg.textContent = '';
  roomInfo.textContent = 'Creating room...';
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (roomId) {
    window.electronAPI.sendMessage(JSON.stringify({ type: 'join_room', roomId }));
    errorMsg.textContent = '';
    roomInfo.textContent = 'Joining room...';
  } else {
    errorMsg.textContent = 'Please enter a Room ID to join.';
  }
});
