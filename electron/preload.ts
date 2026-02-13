import { contextBridge, ipcRenderer } from 'electron';

/**
 * Creates an IPC event listener that forwards data to a callback.
 * Returns a cleanup function to unsubscribe.
 */
function onIpcEvent<T = void>(
  channel: string,
  callback: (data: T) => void
): () => void {
  const listener = (_event: unknown, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

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
  onStarting: (callback: () => void) =>
    onIpcEvent('sidecar:starting', callback),

  onReady: (callback: (data: { port: number }) => void) =>
    onIpcEvent('sidecar:ready', callback),

  onRestarting: (callback: (data: { retryCount: number }) => void) =>
    onIpcEvent('sidecar:restarting', callback),

  onError: (callback: (data: { code: string; message: string }) => void) =>
    onIpcEvent('sidecar:error', callback),
});

contextBridge.exposeInMainWorld('opencode', {
  onServerReady: (callback: (data: { port: number }) => void) =>
    onIpcEvent('opencode:server-ready', callback),

  onServerRestarting: (callback: (data: { retryCount: number }) => void) =>
    onIpcEvent('opencode:server-restarting', callback),

  onServerError: (callback: (data: { code: string; message: string }) => void) =>
    onIpcEvent('opencode:server-error', callback),

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
  ) => onIpcEvent('opencode:detection-result', callback),

  onNotInstalled: (callback: () => void) =>
    onIpcEvent('opencode:not-installed', callback),

  onNotConfigured: (callback: (data: { path: string }) => void) =>
    onIpcEvent('opencode:not-configured', callback),

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
