// frontend/preload.cjs
// CommonJS preload: with "type": "module" in package.json and a sandboxed
// renderer (the default when contextIsolation is true), the preload script
// must be CommonJS — ESM preloads only load with `sandbox: false`.
const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, explicit API to the renderer (window.luckyLefty.*).
// Each method maps to an ipcMain handler / channel in frontend/main.js.
contextBridge.exposeInMainWorld('luckyLefty', {
  // Relay a voice transcript to the Express backend (via the main process).
  // -> ipcMain.handle('voice:send-command', ...)
  sendVoiceCommand: (transcript) =>
    ipcRenderer.invoke('voice:send-command', { transcript }),

  // Fetch backend health/status.
  // -> ipcMain.handle('app:get-status', ...)
  getStatus: () => ipcRenderer.invoke('app:get-status'),

  // Subscribe to tray/menu navigation events pushed from the main process.
  // main.js does: mainWindow.webContents.send('navigate', '/route')
  // Returns an unsubscribe function.
  onNavigate: (callback) => {
    const handler = (_event, route) => callback(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
});
