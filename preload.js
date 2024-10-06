// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Initialize WebSocket connection
  initializeWebSocket: (url) => ipcRenderer.send('initialize-websocket', url),

  // Send messages through WebSocket
  sendMessage: (message) => ipcRenderer.send('send-message', message),

  // Receive messages from WebSocket
  onMessage: (callback) => ipcRenderer.on('receive-message', (event, message) => callback(message))
});
