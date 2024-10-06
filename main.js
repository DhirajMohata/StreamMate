// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true, // Enable Node.js integration
      contextIsolation: false, // Disable context isolation
      enableRemoteModule: true,
    }
  });

  win.loadFile('index.html');

  // Open DevTools for debugging
  // win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS, it's common for applications to stay open until the user explicitly quits.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
