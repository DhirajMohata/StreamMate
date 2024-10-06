// server.js
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080, host: '0.0.0.0' }); // Listen on all interfaces

const rooms = {};

server.on('connection', (socket) => {
  console.log('New client connected');
  socket.roomId = null;

  socket.on('message', (message) => {
    console.log('Received message:', message);
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
        if (validateRoom(socket.roomId)) {
          broadcastToRoom(socket.roomId, {
            type: 'file_info',
            duration: data.duration
          }, socket);
        } else {
          socket.send(JSON.stringify({ type: 'error', message: 'You are not in a valid room.' }));
        }
        break;

      case 'sync_action':
        if (validateRoom(socket.roomId)) {
          broadcastToRoom(socket.roomId, {
            type: 'sync_action',
            action: data.action,
            currentTime: data.currentTime
          }, socket);
        } else {
          socket.send(JSON.stringify({ type: 'error', message: 'You are not in a valid room.' }));
        }
        break;

      case 'chat_message':
        if (validateRoom(socket.roomId)) {
          broadcastToRoom(socket.roomId, {
            type: 'chat_message',
            message: data.message
          }, socket);
        } else {
          socket.send(JSON.stringify({ type: 'error', message: 'You are not in a valid room.' }));
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
        socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
        break;
    }
  });

  socket.on('close', () => {
    console.log('Client disconnected');
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId] = rooms[socket.roomId].filter(client => client !== socket);
      broadcastToRoom(socket.roomId, { type: 'peer_left' }, socket);
      console.log(`Client removed from room: ${socket.roomId}`);
      if (rooms[socket.roomId].length === 0) {
        delete rooms[socket.roomId];
        console.log(`Room deleted: ${socket.roomId}`);
      }
    }
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function createRoom(socket) {
  const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
  rooms[roomId] = [socket];
  socket.roomId = roomId;
  socket.send(JSON.stringify({ type: 'room_created', roomId }));
  console.log(`Room created: ${roomId}`);
  console.log(`Current Rooms:`, rooms);
}

function joinRoom(socket, roomId) {
  console.log(`Attempting to join room: ${roomId}`);
  console.log(`Current Rooms:`, rooms);
  if (rooms[roomId] && rooms[roomId].length < 2) {
    rooms[roomId].push(socket);
    socket.roomId = roomId;
    socket.send(JSON.stringify({ type: 'room_joined', roomId }));
    broadcastToRoom(roomId, { type: 'both_joined' }, socket);
    console.log(`Socket joined room: ${roomId}`);
    console.log(`Updated Rooms:`, rooms);
  } else {
    socket.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
    console.log(`Failed to join room: ${roomId} - Room not found or full.`);
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

function validateRoom(roomId) {
  return roomId && rooms[roomId] && rooms[roomId].length > 0;
}

console.log('WebSocket server is running on ws://localhost:8080');
