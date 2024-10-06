// renderer.js

// UI Elements
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const roomIdInput = document.getElementById('room-id-input');
const errorMsg = document.getElementById('error');

// Handle WebSocket Initialization
window.addEventListener('DOMContentLoaded', () => {
  window.electronAPI.initializeWebSocket('ws://localhost:8080'); // Ensure this URL is correct
});

// Handle incoming WebSocket messages
window.electronAPI.onMessage((message) => {
  console.log('Received from server:', message);
  let data;
  try {
    data = JSON.parse(message);
  } catch (error) {
    console.error('Invalid JSON:', error);
    return;
  }

  switch (data.type) {
    case 'room_created':
      console.log(`Room created with ID: ${data.roomId}`);
      // Redirect to room page with roomId as a query parameter
      window.location.href = `room.html?roomId=${data.roomId}`;
      break;

    case 'room_joined':
      console.log(`Joined room with ID: ${data.roomId}`);
      // Redirect to room page with roomId as a query parameter
      window.location.href = `room.html?roomId=${data.roomId}`;
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
  console.log('Creating room...');
  window.electronAPI.sendMessage(JSON.stringify({ type: 'create_room' }));
  errorMsg.textContent = '';
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
  const roomId = roomIdInput.value.trim();
  if (roomId) {
    console.log(`Joining room: ${roomId}`);
    window.electronAPI.sendMessage(JSON.stringify({ type: 'join_room', roomId }));
    errorMsg.textContent = '';
  } else {
    errorMsg.textContent = 'Please enter a Room ID to join.';
  }
});
