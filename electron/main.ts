import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import { ProcessManager, type ProcessStatusEvent } from './process-manager';
import {
  OpenCodeProcessManager,
  type OpenCodeStatusEvent,
} from './opencode-process-manager';
import { OpenCodeClient } from './opencode-client';
import { startForwarding, stopForwarding } from './opencode-event-forwarder';

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
const opencodeClient = new OpenCodeClient();

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

  if (!mainWindow) return;

  switch (event.status) {
    case 'running': {
      if (event.port) {
        opencodeClient.initialize(event.port);
      }
      // Start SSE event forwarding after client is initialized
      const sdkClient = opencodeClient.getSdkClient();
      if (sdkClient) {
        startForwarding(mainWindow, sdkClient).catch((err) => {
          console.error('[electron] Failed to start event forwarding:', err);
        });
      }
      mainWindow.webContents.send('opencode:server-ready', {
        port: event.port,
      });
      break;
    }
    case 'restarting':
      // Stop event forwarding before client is destroyed on restart
      stopForwarding().catch((err) => {
        console.error('[electron] Failed to stop event forwarding on restart:', err);
      });
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

/**
 * Runs OpenCode detection + config reading and sends results to renderer.
 * Returns true if OpenCode is installed and detection events were sent.
 */
async function detectAndNotify(): Promise<boolean> {
  if (!opencodeManager) return false;

  const detection = await opencodeManager.detectOpenCode();

  if (!detection.installed) {
    console.log('[electron] OpenCode not detected — skipping spawn');
    mainWindow?.webContents.send('opencode:not-installed', {});
    return false;
  }

  console.log('[electron] OpenCode detected at:', detection.path);

  const config = await opencodeManager.readOpenCodeConfig();
  opencodeConfigured = !!config;

  if (!config) {
    console.log('[electron] OpenCode detected but not configured');
    mainWindow?.webContents.send('opencode:not-configured', {
      path: detection.path,
    });
  }

  mainWindow?.webContents.send('opencode:detection-result', {
    installed: true,
    path: detection.path,
    version: detection.version,
    config: config ?? undefined,
  });

  return true;
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

  const installed = await detectAndNotify();
  if (!installed) return;

  try {
    await opencodeManager.spawn();
    console.log('[electron] OpenCode server is ready');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[electron] OpenCode server failed to start:', errorMessage);
  }
}

async function stopOpenCodeServer(): Promise<void> {
  if (opencodeManager) {
    console.log('[electron] Stopping OpenCode server...');
    await stopForwarding();
    opencodeClient.destroy();
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

  // OpenCode Session handlers — all share the same guard/error pattern
  function handleSdkCall<T>(fn: () => Promise<T>): Promise<T | { code: string; message: string }> {
    if (!opencodeClient.isReady()) {
      return Promise.resolve({ code: 'server_unavailable', message: 'OpenCode server is not running' });
    }
    return fn().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return { code: 'sdk_error', message };
    });
  }

  ipcMain.handle('opencode:create-session', (_event, opts: { title: string; workingDir: string }) =>
    handleSdkCall(async () => {
      const result = await opencodeClient.createSession(opts.title);
      return { sessionId: result.sessionId, title: result.title };
    })
  );

  ipcMain.handle('opencode:send-prompt', (_event, opts: {
    sessionId: string;
    model?: { providerID: string; modelID: string };
    parts: Array<{ type: string; [key: string]: unknown }>;
  }) =>
    handleSdkCall(async () => {
      await opencodeClient.sendPrompt(opts.sessionId, opts.parts, opts.model);
      return { success: true };
    })
  );

  ipcMain.handle('opencode:approve-permission', (_event, opts: {
    sessionId: string;
    permissionId: string;
    approved: boolean;
  }) =>
    handleSdkCall(async () => {
      await opencodeClient.approvePermission(opts.sessionId, opts.permissionId, opts.approved);
      return { success: true };
    })
  );

  ipcMain.handle('opencode:answer-question', (_event, opts: { questionId: string; answer: string }) =>
    handleSdkCall(async () => {
      await opencodeClient.answerQuestion(opts.answer);
      return { success: true };
    })
  );

  // OpenCode: manual re-detection
  ipcMain.handle('opencode:redetect', async () => {
    if (!opencodeManager) {
      console.error('[electron] OpenCode manager not initialized');
      return { success: false, error: 'Manager not initialized' };
    }

    console.log('[electron] Manual OpenCode re-detection triggered');

    try {
      const installed = await detectAndNotify();

      if (!installed) {
        return { success: true, installed: false };
      }

      // Try to spawn if not already running
      if (opencodeManager.getStatus() !== 'running') {
        await opencodeManager.spawn();
      }

      return { success: true, installed: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('[electron] Re-detection failed:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });

  // OpenCode: validate provider credentials
  ipcMain.handle(
    'opencode:validate-provider',
    async (
      _event,
      opts: { provider: string; apiKey: string; endpoint?: string }
    ): Promise<{ success: boolean; error?: string; models?: string[] }> => {
      console.log(`[electron] Validating provider: ${opts.provider}`);

      try {
        switch (opts.provider.toLowerCase()) {
          case 'anthropic':
            return await validateAnthropic(opts.apiKey);
          case 'openai':
            return await validateOpenAI(opts.apiKey);
          case 'ollama':
            return await validateOllama(opts.endpoint ?? 'http://localhost:11434');
          case 'gemini':
            return await validateGemini(opts.apiKey);
          default:
            return { success: false, error: `Unknown provider: ${opts.provider}` };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[electron] Provider validation failed:`, errorMessage);
        return { success: false, error: errorMessage };
      }
    }
  );

  // OpenCode: write provider config to OpenCode config file
  ipcMain.handle(
    'opencode:write-config',
    async (
      _event,
      opts: {
        provider: string;
        apiKey: string;
        endpoint?: string;
        models?: string[];
      }
    ): Promise<{ success: boolean; error?: string }> => {
      console.log(`[electron] Writing config for provider: ${opts.provider}`);

      try {
        const configDir = getOpenCodeConfigDir();
        const configPath = path.join(configDir, 'config.json');

        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        // Read existing config or start fresh
        let config: Record<string, unknown> = {};
        if (fs.existsSync(configPath)) {
          try {
            const raw = fs.readFileSync(configPath, 'utf-8');
            config = JSON.parse(raw);
          } catch {
            console.warn('[electron] Could not parse existing config, starting fresh');
          }
        }

        // Ensure providers array exists
        if (!Array.isArray(config.providers)) {
          config.providers = [];
        }

        const providers = config.providers as Array<Record<string, unknown>>;

        // Find or create provider entry
        const existingIndex = providers.findIndex(
          (p) => (p.name as string)?.toLowerCase() === opts.provider.toLowerCase()
        );

        const providerEntry: Record<string, unknown> = {
          name: opts.provider.toLowerCase(),
          apiKey: opts.apiKey,
        };

        if (opts.endpoint) {
          providerEntry.endpoint = opts.endpoint;
        }

        if (opts.models && opts.models.length > 0) {
          providerEntry.models = opts.models;
        }

        if (existingIndex >= 0) {
          // Merge with existing entry (preserve other fields)
          providers[existingIndex] = { ...providers[existingIndex], ...providerEntry };
        } else {
          providers.push(providerEntry);
        }

        config.providers = providers;

        // Update models list (union of all provider models)
        const allModels: string[] = [];
        for (const p of providers) {
          if (Array.isArray(p.models)) {
            for (const m of p.models as string[]) {
              if (!allModels.includes(m)) {
                allModels.push(m);
              }
            }
          }
        }
        if (allModels.length > 0) {
          config.models = allModels;
        }

        // Set default provider if none set
        if (!config.defaultProvider) {
          config.defaultProvider = opts.provider.toLowerCase();
        }

        // Write config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        console.log('[electron] OpenCode config written successfully');

        // Re-detect so store updates
        await detectAndNotify();

        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[electron] Config write failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Provider Validation Helpers
// ---------------------------------------------------------------------------

function getOpenCodeConfigDir(): string {
  const homeDir = os.homedir();
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || homeDir, 'opencode');
  }
  return path.join(homeDir, '.opencode');
}

function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        timeout: options.timeoutMs ?? 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ statusCode: res.statusCode ?? 0, body: data })
        );
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function validateAnthropic(
  apiKey: string
): Promise<{ success: boolean; error?: string; models?: string[] }> {
  // Send a minimal messages request with an invalid model.
  // 400 = key valid (bad request), 401 = key invalid.
  const body = JSON.stringify({
    model: 'invalid-model-for-validation',
    max_tokens: 1,
    messages: [{ role: 'user', content: 'test' }],
  });

  const res = await httpRequest('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  // 401 or 403 = invalid key, anything else (200, 400, 404) = valid key
  if (res.statusCode === 401 || res.statusCode === 403) {
    return { success: false, error: 'Invalid API key' };
  }

  return {
    success: true,
    models: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5'],
  };
}

async function validateOpenAI(
  apiKey: string
): Promise<{ success: boolean; error?: string; models?: string[] }> {
  const res = await httpRequest('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (res.statusCode === 401) {
    return { success: false, error: 'Invalid API key' };
  }

  if (res.statusCode !== 200) {
    return { success: false, error: `Unexpected response: ${res.statusCode}` };
  }

  // Extract model names from response
  try {
    const data = JSON.parse(res.body);
    const models = (data.data as Array<{ id: string }>)
      ?.map((m) => m.id)
      ?.filter((id) => id.startsWith('gpt-'))
      ?.slice(0, 10) ?? [];
    return { success: true, models };
  } catch {
    return { success: true };
  }
}

async function validateOllama(
  endpoint: string
): Promise<{ success: boolean; error?: string; models?: string[] }> {
  const url = `${endpoint.replace(/\/$/, '')}/api/tags`;

  try {
    const res = await httpRequest(url, {
      method: 'GET',
      timeoutMs: 5000,
    });

    if (res.statusCode !== 200) {
      return { success: false, error: `Ollama returned status ${res.statusCode}` };
    }

    // Extract model names
    try {
      const data = JSON.parse(res.body);
      const models = (data.models as Array<{ name: string }>)
        ?.map((m) => m.name) ?? [];
      return { success: true, models };
    } catch {
      return { success: true };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('ECONNREFUSED')) {
      return { success: false, error: 'Ollama is not running at this endpoint' };
    }
    return { success: false, error: msg };
  }
}

async function validateGemini(
  apiKey: string
): Promise<{ success: boolean; error?: string; models?: string[] }> {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`;

  const res = await httpRequest(url, { method: 'GET' });

  if (res.statusCode === 400 || res.statusCode === 403) {
    return { success: false, error: 'Invalid API key' };
  }

  if (res.statusCode !== 200) {
    return { success: false, error: `Unexpected response: ${res.statusCode}` };
  }

  try {
    const data = JSON.parse(res.body);
    const models = (data.models as Array<{ name: string }>)
      ?.map((m) => m.name.replace('models/', ''))
      ?.filter((name) => name.startsWith('gemini-'))
      ?.slice(0, 10) ?? [];
    return { success: true, models };
  } catch {
    return { success: true };
  }
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
