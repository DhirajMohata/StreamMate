// server.js
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080, host: '0.0.0.0' }); // Listen on all interfaces

const rooms = {};

server.on('connection', (socket) => {
  socket.roomId = null;

  socket.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (error) {
      console.error('Invalid JSON:', error);
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format.' }));
      return;
    }

    switch (data.type) {
      case 'create_room':
        createRoom(socket);
        break;

      case 'join_room':
        joinRoom(socket, data.roomId);
        break;

      case 'file_info':
        broadcastToRoom(socket.roomId, {
          type: 'file_info',
          duration: data.duration
        }, socket);
        break;

      case 'sync_action':
        broadcastToRoom(socket.roomId, {
          type: 'sync_action',
          action: data.action,
          currentTime: data.currentTime
        }, socket);
        break;

      case 'chat_message':
        broadcastToRoom(socket.roomId, {
          type: 'chat_message',
          message: data.message
        }, socket);
        break;

      case 'offer':
        broadcastToRoom(socket.roomId, {
          type: 'offer',
          offer: data.offer
        }, socket);
        break;

      case 'answer':
        broadcastToRoom(socket.roomId, {
          type: 'answer',
          answer: data.answer
        }, socket);
        break;

      case 'ice_candidate':
        broadcastToRoom(socket.roomId, {
          type: 'ice_candidate',
          candidate: data.candidate
        }, socket);
        break;

      default:
        console.log('Unknown message type:', data.type);
        socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
        break;
    }
  });

  socket.on('close', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId] = rooms[socket.roomId].filter(client => client !== socket);
      broadcastToRoom(socket.roomId, { type: 'peer_left' }, socket);
      if (rooms[socket.roomId].length === 0) {
        delete rooms[socket.roomId];
      }
    }
  });
});

function createRoom(socket) {
  const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
  rooms[roomId] = [socket];
  socket.roomId = roomId;
  socket.send(JSON.stringify({ type: 'room_created', roomId }));
  console.log(`Room created: ${roomId}`);
}

function joinRoom(socket, roomId) {
  if (rooms[roomId] && rooms[roomId].length < 2) {
    rooms[roomId].push(socket);
    socket.roomId = roomId;
    socket.send(JSON.stringify({ type: 'room_joined', roomId }));
    broadcastToRoom(roomId, { type: 'both_joined' }, socket);
    console.log(`Socket joined room: ${roomId}`);
  } else {
    socket.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
    console.log(`Failed to join room: ${roomId}`);
  }
}

function broadcastToRoom(roomId, message, senderSocket) {
  if (rooms[roomId]) {
    rooms[roomId].forEach(client => {
      if (client !== senderSocket && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

console.log('WebSocket server is running on ws://localhost:8080');
