// server.js
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

const rooms = {};

server.on('connection', (socket) => {
  socket.roomId = null;

  socket.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'create_room':
        // Generate a unique room ID
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
          // Notify both clients that both have joined
          rooms[joinRoomId].forEach(client => {
            client.send(JSON.stringify({ type: 'both_joined' }));
          });
        } else {
          socket.send(JSON.stringify({ type: 'error', message: 'Room not found or full.' }));
        }
        break;

      case 'file_info':
        // Broadcast file info to the other client in the room
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
        // Broadcast playback actions (play, pause, seek) to the other client
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

      default:
        break;
    }
  });

  socket.on('close', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId] = rooms[socket.roomId].filter(client => client !== socket);
      // Notify the remaining client that the other has left
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
