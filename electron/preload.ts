import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  getApiKey: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('keychain:get', provider),

  setApiKey: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('keychain:set', provider, key),

  deleteApiKey: (provider: string): Promise<void> =>
    ipcRenderer.invoke('keychain:delete', provider),
});

contextBridge.exposeInMainWorld('sidecar', {
  onStarting: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('sidecar:starting', listener);
    return () => ipcRenderer.removeListener('sidecar:starting', listener);
  },

  onReady: (callback: (data: { port: number }) => void) => {
    const listener = (_event: unknown, data: { port: number }) => callback(data);
    ipcRenderer.on('sidecar:ready', listener);
    return () => ipcRenderer.removeListener('sidecar:ready', listener);
  },

  onRestarting: (callback: (data: { retryCount: number }) => void) => {
    const listener = (_event: unknown, data: { retryCount: number }) => callback(data);
    ipcRenderer.on('sidecar:restarting', listener);
    return () => ipcRenderer.removeListener('sidecar:restarting', listener);
  },

  onError: (callback: (data: { code: string; message: string }) => void) => {
    const listener = (_event: unknown, data: { code: string; message: string }) =>
      callback(data);
    ipcRenderer.on('sidecar:error', listener);
    return () => ipcRenderer.removeListener('sidecar:error', listener);
  },
});

contextBridge.exposeInMainWorld('opencode', {
  onServerReady: (callback: (data: { port: number }) => void) => {
    const listener = (_event: unknown, data: { port: number }) => callback(data);
    ipcRenderer.on('opencode:server-ready', listener);
    return () => ipcRenderer.removeListener('opencode:server-ready', listener);
  },

  onServerRestarting: (callback: (data: { retryCount: number }) => void) => {
    const listener = (_event: unknown, data: { retryCount: number }) =>
      callback(data);
    ipcRenderer.on('opencode:server-restarting', listener);
    return () => ipcRenderer.removeListener('opencode:server-restarting', listener);
  },

  onServerError: (callback: (data: { code: string; message: string }) => void) => {
    const listener = (_event: unknown, data: { code: string; message: string }) =>
      callback(data);
    ipcRenderer.on('opencode:server-error', listener);
    return () => ipcRenderer.removeListener('opencode:server-error', listener);
  },

  onDetectionResult: (
    callback: (data: {
      installed: boolean;
      path?: string;
      version?: string;
      config?: {
        providers: Array<{ name: string; configured: boolean }>;
        models: string[];
        defaultProvider?: string;
      };
    }) => void
  ) => {
    const listener = (
      _event: unknown,
      data: {
        installed: boolean;
        path?: string;
        version?: string;
        config?: {
          providers: Array<{ name: string; configured: boolean }>;
          models: string[];
          defaultProvider?: string;
        };
      }
    ) => callback(data);
    ipcRenderer.on('opencode:detection-result', listener);
    return () =>
      ipcRenderer.removeListener('opencode:detection-result', listener);
  },

  onNotInstalled: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('opencode:not-installed', listener);
    return () => ipcRenderer.removeListener('opencode:not-installed', listener);
  },

  onNotConfigured: (callback: (data: { path: string }) => void) => {
    const listener = (_event: unknown, data: { path: string }) => callback(data);
    ipcRenderer.on('opencode:not-configured', listener);
    return () =>
      ipcRenderer.removeListener('opencode:not-configured', listener);
  },

  redetect: (): Promise<{
    success: boolean;
    installed?: boolean;
    path?: string;
    version?: string;
    config?: {
      providers: Array<{ name: string; configured: boolean }>;
      models: string[];
      defaultProvider?: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('opencode:redetect'),

  getStatus: (): Promise<{
    installed: boolean;
    configured: boolean;
    serverStatus: string;
    port: number | null;
    version?: string;
    path?: string;
  }> => ipcRenderer.invoke('opencode:get-status'),
});
