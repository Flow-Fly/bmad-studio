import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ProcessManager, type ProcessStatusEvent } from './process-manager';
import {
  OpenCodeProcessManager,
  type OpenCodeStatusEvent,
} from './opencode-process-manager';

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

let processManager: ProcessManager | null = null;

// ---------------------------------------------------------------------------
// OpenCode Server
// ---------------------------------------------------------------------------

let opencodeManager: OpenCodeProcessManager | null = null;
let opencodeConfigured = false; // Track whether config was found

function handleSidecarStatusChange(event: ProcessStatusEvent): void {
  console.log('[electron] Sidecar status changed:', event);

  // Forward status changes to renderer
  if (mainWindow) {
    switch (event.status) {
      case 'starting':
        mainWindow.webContents.send('sidecar:starting', {});
        break;
      case 'running':
        mainWindow.webContents.send('sidecar:ready', { port: GO_PORT });
        break;
      case 'restarting':
        mainWindow.webContents.send('sidecar:restarting', {
          retryCount: event.retryCount,
        });
        break;
      case 'failed':
        mainWindow.webContents.send('sidecar:error', {
          code: 'SIDECAR_FAILED',
          message: event.error || 'Unknown error',
        });
        break;
    }
  }
}

async function startGoBackend(): Promise<void> {
  const binPath = goBackendPath();
  if (!binPath) {
    console.log('[electron] Dev mode — skipping Go backend spawn');
    return; // Dev mode — backend started externally
  }

  if (!fs.existsSync(binPath)) {
    const msg = `Go backend binary not found at: ${binPath}`;
    console.error(`[electron] ${msg}`);
    dialog.showErrorBox(
      'BMAD Studio — Backend Missing',
      `${msg}\n\nThe application cannot start without the backend binary. Please reinstall BMAD Studio.`,
    );
    app.quit();
    return;
  }

  processManager = new ProcessManager(
    {
      binaryPath: binPath,
      port: GO_PORT,
      maxRetries: 3,
      retryDelayMs: 1000,
      healthCheckPath: '/health',
      shutdownTimeoutMs: 5000,
    },
    handleSidecarStatusChange
  );

  try {
    await processManager.spawn();
    console.log('[electron] Go backend is ready');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[electron] Go backend failed to start:', errorMessage);
    dialog.showMessageBox({
      type: 'warning',
      title: 'Backend Unavailable',
      message: 'BMAD Studio Backend Failed to Start',
      detail: `${errorMessage}\n\nThe app will continue running but backend-dependent features will be disabled.`,
      buttons: ['Continue'],
    });
  }
}

async function stopGoBackend(): Promise<void> {
  if (processManager) {
    console.log('[electron] Stopping Go backend...');
    await processManager.shutdown();
    processManager = null;
  }
}

function handleOpenCodeStatusChange(event: OpenCodeStatusEvent): void {
  console.log('[electron] OpenCode status changed:', event);

  // Forward status changes to renderer
  if (mainWindow) {
    switch (event.status) {
      case 'not-installed':
        // Don't send event — renderer assumes not-installed by default
        console.log('[electron] OpenCode not detected on PATH');
        break;
      case 'starting':
        // No event needed — renderer shows "connecting" until ready/error
        break;
      case 'running':
        mainWindow.webContents.send('opencode:server-ready', {
          port: event.port,
        });
        break;
      case 'restarting':
        mainWindow.webContents.send('opencode:server-restarting', {
          retryCount: event.retryCount,
        });
        break;
      case 'failed':
        mainWindow.webContents.send('opencode:server-error', {
          code: 'server_start_failed',
          message: event.error || 'Unknown error',
        });
        break;
    }
  }
}

async function startOpenCodeServer(): Promise<void> {
  opencodeManager = new OpenCodeProcessManager(
    {
      maxRetries: 3,
      retryDelayMs: 1000,
      portRangeMin: 49152,
      portRangeMax: 65535,
      healthCheckPath: '/health',
      healthCheckTimeoutMs: 15000,
      shutdownTimeoutMs: 5000,
    },
    handleOpenCodeStatusChange
  );

  // Detect if OpenCode is installed
  const detectionResult = await opencodeManager.detectOpenCode();

  if (!detectionResult.installed) {
    console.log('[electron] OpenCode not detected — skipping spawn');

    // Send not-installed event to renderer
    if (mainWindow) {
      mainWindow.webContents.send('opencode:not-installed', {});
    }

    return;
  }

  console.log('[electron] OpenCode detected at:', detectionResult.path);

  // Try to read config
  const config = await opencodeManager.readOpenCodeConfig();
  opencodeConfigured = !!config;

  if (!config) {
    console.log('[electron] OpenCode detected but not configured');

    // Send not-configured event to renderer
    if (mainWindow) {
      mainWindow.webContents.send('opencode:not-configured', {
        path: detectionResult.path,
      });
    }

    // Still try to spawn — OpenCode may work without config
  }

  // Send detection result to renderer
  if (mainWindow) {
    mainWindow.webContents.send('opencode:detection-result', {
      installed: true,
      path: detectionResult.path,
      version: detectionResult.version,
      config: config || undefined,
    });
  }

  try {
    await opencodeManager.spawn();
    console.log('[electron] OpenCode server is ready');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[electron] OpenCode server failed to start:', errorMessage);
    // No dialog — app stays functional, workflows just disabled
  }
}

async function stopOpenCodeServer(): Promise<void> {
  if (opencodeManager) {
    console.log('[electron] Stopping OpenCode server...');
    await opencodeManager.shutdown();
    opencodeManager = null;
  }
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

  // OpenCode: get current status
  ipcMain.handle('opencode:get-status', () => {
    if (!opencodeManager) {
      return {
        installed: false,
        configured: false,
        serverStatus: 'not-installed',
        port: null,
      };
    }

    const state = opencodeManager.getState();
    return {
      ...state,
      configured: opencodeConfigured,
    };
  });

  // OpenCode: manual re-detection
  ipcMain.handle('opencode:redetect', async () => {
    if (!opencodeManager) {
      console.error('[electron] OpenCode manager not initialized');
      return { success: false, error: 'Manager not initialized' };
    }

    console.log('[electron] Manual OpenCode re-detection triggered');

    try {
      // Detect OpenCode
      const detectionResult = await opencodeManager.detectOpenCode();

      if (!detectionResult.installed) {
        // Send not-installed event
        if (mainWindow) {
          mainWindow.webContents.send('opencode:not-installed', {});
        }

        return {
          success: true,
          installed: false,
        };
      }

      // Read config
      const config = await opencodeManager.readOpenCodeConfig();
      opencodeConfigured = !!config;

      if (!config) {
        // Send not-configured event
        if (mainWindow) {
          mainWindow.webContents.send('opencode:not-configured', {
            path: detectionResult.path,
          });
        }
      }

      // Send detection result
      if (mainWindow) {
        mainWindow.webContents.send('opencode:detection-result', {
          installed: true,
          path: detectionResult.path,
          version: detectionResult.version,
          config: config || undefined,
        });
      }

      // Try to spawn if not already running
      if (opencodeManager.getStatus() !== 'running') {
        await opencodeManager.spawn();
      }

      return {
        success: true,
        installed: true,
        path: detectionResult.path,
        version: detectionResult.version,
        config: config || undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[electron] Re-detection failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
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

  // Start Go backend and wait for it to be ready
  await startGoBackend();

  // Start OpenCode server (non-blocking — app works without it)
  await startOpenCodeServer();

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

app.on('before-quit', async (event) => {
  if (processManager || opencodeManager) {
    event.preventDefault();
    await stopGoBackend();
    await stopOpenCodeServer();
    app.quit();
  }
});
