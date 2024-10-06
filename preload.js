// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // WebSocket Functions
  initializeWebSocket: (url) => ipcRenderer.send('initialize-websocket', url),
  sendMessage: (message) => ipcRenderer.send('send-message', message),
  onMessage: (callback) => ipcRenderer.on('receive-message', (event, message) => callback(message)),
  
  // Additional APIs can be exposed here as needed
});
