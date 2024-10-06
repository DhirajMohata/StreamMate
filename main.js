// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws'); // Ensure ws is installed: npm install ws

let ws; // WebSocket server instance

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Specify preload.js
      nodeIntegration: false, // Disable Node.js integration
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
  if (ws) {
    ws.close();
  }
  ws = new WebSocket(url);

  ws.on('open', () => {
    console.log('WebSocket connected');
  });

  ws.on('message', (data) => {
    event.sender.send('receive-message', data.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle Sending Messages through WebSocket
ipcMain.on('send-message', (event, message) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(message);
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
