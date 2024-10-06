// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws'); // Ensure ws is installed: npm install ws

let wsClient; // WebSocket client instance

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Specify preload.js
      nodeIntegration: false, // Disable Node.js integration for security
      contextIsolation: true, // Enable context isolation
      enableRemoteModule: false, // Disable remote module for security
    }
  });

  win.loadFile('index.html');

  // Uncomment to open DevTools for debugging
  // win.webContents.openDevTools();
}

// Handle WebSocket Initialization
ipcMain.on('initialize-websocket', (event, url) => {
  if (wsClient) {
    wsClient.close();
  }
  wsClient = new WebSocket(url);

  wsClient.on('open', () => {
    console.log('WebSocket connected');
  });

  wsClient.on('message', (data) => {
    event.sender.send('receive-message', data.toString());
  });

  wsClient.on('close', () => {
    console.log('WebSocket disconnected');
    event.sender.send('receive-message', JSON.stringify({ type: 'server_disconnected' }));
  });

  wsClient.on('error', (error) => {
    console.error('WebSocket error:', error);
    event.sender.send('receive-message', JSON.stringify({ type: 'server_error', message: error.message }));
  });
});

// Handle Sending Messages through WebSocket
ipcMain.on('send-message', (event, message) => {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(message);
  } else {
    console.error('WebSocket is not connected. Unable to send message:', message);
    event.sender.send('receive-message', JSON.stringify({ type: 'error', message: 'WebSocket is not connected.' }));
  }
});

app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-create a window on macOS when the dock icon is clicked and there are no other windows open.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
