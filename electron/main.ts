import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
} from 'electron';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

// ---------------------------------------------------------------------------
// Paths & Constants
// ---------------------------------------------------------------------------

const isDev = !app.isPackaged;
const GO_PORT = 3008;

// In dev, the Go binary is assumed already running or built at backend/.
// In production, it's bundled alongside the Electron app.
function goBackendPath(): string {
  if (isDev) {
    // During development, assume the Go backend is already running separately
    return '';
  }
  // Packaged: binary next to the Electron app
  const binName = process.platform === 'win32' ? 'bmad-backend.exe' : 'bmad-backend';
  return path.join(process.resourcesPath, 'bin', binName);
}

// ---------------------------------------------------------------------------
// Store (encrypted key-value for API keys)
// ---------------------------------------------------------------------------

const storeFilePath = path.join(app.getPath('userData'), 'secure-store.json');

function readStore(): Record<string, string> {
  try {
    const raw = fs.readFileSync(storeFilePath, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, string>): void {
  fs.writeFileSync(storeFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Go Backend Sidecar
// ---------------------------------------------------------------------------

let goProcess: ChildProcess | null = null;

function spawnGoBackend(): void {
  const binPath = goBackendPath();
  if (!binPath) return; // Dev mode — backend started externally

  console.log(`[electron] Spawning Go backend: ${binPath}`);
  goProcess = spawn(binPath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(GO_PORT) },
  });

  goProcess.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[go] ${data.toString()}`);
  });

  goProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[go:err] ${data.toString()}`);
  });

  goProcess.on('exit', (code) => {
    console.log(`[electron] Go backend exited with code ${code}`);
    goProcess = null;
  });
}

function killGoBackend(): void {
  if (goProcess) {
    console.log('[electron] Killing Go backend...');
    goProcess.kill('SIGTERM');
    goProcess = null;
  }
}

function waitForPort(port: number, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for port ${port}`));
      }
      const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        setTimeout(attempt, 200);
      });
    }
    attempt();
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIPC(): void {
  // Dialog: open folder
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select BMAD Project Folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Keychain: get
  ipcMain.handle('keychain:get', (_event, provider: string) => {
    const store = readStore();
    const encrypted = store[provider];
    if (!encrypted) return null;
    try {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  });

  // Keychain: set
  ipcMain.handle('keychain:set', (_event, provider: string, key: string) => {
    const store = readStore();
    const encrypted = safeStorage.encryptString(key);
    store[provider] = encrypted.toString('base64');
    writeStore(store);
  });

  // Keychain: delete
  ipcMain.handle('keychain:delete', (_event, provider: string) => {
    const store = readStore();
    delete store[provider];
    writeStore(store);
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'BMAD Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3007');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  registerIPC();
  spawnGoBackend();

  // Wait for Go backend to be ready (skip in dev if already running)
  if (goBackendPath()) {
    try {
      await waitForPort(GO_PORT);
      console.log('[electron] Go backend is ready');
    } catch (err) {
      console.error('[electron] Go backend failed to start:', err);
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  killGoBackend();
});
