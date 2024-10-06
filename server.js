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
        const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
        rooms[roomId] = [socket];
        socket.roomId = roomId;
        socket.send(JSON.stringify({ type: 'room_created', roomId }));
        break;

      case 'join_room':
        const joinRoomId = data.roomId;
        if (rooms[joinRoomId] && rooms[joinRoomId].length < 2) {
          rooms[joinRoomId].push(socket);
          socket.roomId = joinRoomId;
          socket.send(JSON.stringify({ type: 'room_joined', roomId: joinRoomId }));
          rooms[joinRoomId].forEach(client => {
            client.send(JSON.stringify({ type: 'both_joined' }));
          });
        } else {
          socket.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
        }
        break;

      case 'file_info':
        const currentRoom = rooms[socket.roomId];
        if (currentRoom) {
          currentRoom.forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'file_info', duration: data.duration }));
            }
          });
        }
        break;

      case 'sync_action':
        const syncRoom = rooms[socket.roomId];
        if (syncRoom) {
          syncRoom.forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'sync_action',
                action: data.action,
                currentTime: data.currentTime
              }));
            }
          });
        }
        break;

      case 'chat_message':
        const chatRoom = rooms[socket.roomId];
        if (chatRoom) {
          chatRoom.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'chat_message',
                message: data.message
              }));
            }
          });
        }
        break;

      case 'voice_call':
      case 'video_call':
        const callRoom = rooms[socket.roomId];
        if (callRoom) {
          callRoom.forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: data.type,
                roomId: data.roomId
              }));
            }
          });
        }
        break;

      case 'call_offer':
      case 'call_answer':
      case 'ice_candidate':
        const signalingRoom = rooms[socket.roomId];
        if (signalingRoom) {
          signalingRoom.forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: data.type,
                roomId: data.roomId,
                ...data
              }));
            }
          });
        }
        break;

      default:
        socket.send(JSON.stringify({ type: 'error', message: 'Unknown message type.' }));
        break;
    }
  });

  socket.on('close', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId] = rooms[socket.roomId].filter(client => client !== socket);
      rooms[socket.roomId].forEach(client => {
        client.send(JSON.stringify({ type: 'peer_left' }));
      });
      if (rooms[socket.roomId].length === 0) {
        delete rooms[socket.roomId];
      }
    }
  });
});

console.log('WebSocket server is running on ws://localhost:8080');
